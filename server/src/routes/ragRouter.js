const express = require('express');
const router = express.Router();
const officerRag = require('../rag/officerRag');
const multiQueryRRF = require('../rag/multiQueryRRF');
const auditChain = require('../mcp/auditChain');
const vectorStore = require('../rag/vectorStore');
const supabaseVectorStore = require('../rag/supabaseVectorStore');

// Supabase Vector DB Connection Status
router.get('/supabase-status', async (req, res) => {
  try {
    const status = await supabaseVectorStore.checkConnection();
    res.json({
      success: true,
      configured: !!supabaseVectorStore.connectionString,
      maskedConnectionString: supabaseVectorStore.connectionString
        ? supabaseVectorStore.connectionString.replace(/:([^:@]+)@/, ':****@')
        : null,
      status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Supabase Connection String dynamically
router.post('/supabase-config', async (req, res) => {
  try {
    const { connectionString } = req.body;
    if (!connectionString) {
      return res.status(400).json({ success: false, error: 'connectionString is required' });
    }

    supabaseVectorStore.initPool(connectionString);
    const testResult = await supabaseVectorStore.checkConnection();

    if (testResult.connected) {
      // Create table if not exists
      await supabaseVectorStore.initSchema();
    }

    res.json({
      success: testResult.connected,
      result: testResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Supabase Two-Branch Architecture Stats
router.get('/supabase-stats', async (req, res) => {
  try {
    const stats = await supabaseVectorStore.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Seed / Sync pre-stored chunks into Supabase table
router.post('/supabase-sync', async (req, res) => {
  try {
    const syncRes = await vectorStore.syncToSupabase();
    res.json(syncRes);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Officer Q&A with Multi-Query RAG & RRF
router.post('/ask', async (req, res) => {
  try {
    const { query, caseId, role = 'IO', language = 'auto' } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const answerData = await officerRag.answerOfficerQuery(query, {
      caseId,
      role,
      language
    });

    // Log to tamper-evident audit chain
    const auditBlock = auditChain.logCall({
      actor: `OFFICER_${role}`,
      role,
      tool: 'RAG_OFFICER_QA',
      caseId: caseId || 'GENERAL',
      inputPayload: { query, language },
      outputPayload: {
        modelUsed: answerData.modelUsed,
        citationValid: answerData.citations.isValid,
        topRankedSource: answerData.rrfRanks[0]?.source || 'None'
      }
    });

    res.json({
      success: true,
      auditHash: auditBlock.hash,
      ...answerData
    });
  } catch (err) {
    console.error('RAG Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct Multi-Query & RRF visualizer endpoint
router.post('/multiquery', async (req, res) => {
  try {
    const { query, caseId, topK = 8 } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const results = await multiQueryRRF.searchWithMultiQueryRRF(query, { caseId, topK });
    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
