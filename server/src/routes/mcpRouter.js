const express = require('express');
const router = express.Router();
const mcpServer = require('../mcp/mcpServer');

// List available typed tools
router.get('/tools', (req, res) => {
  const tools = [
    {
      name: 'search_case',
      description: 'RAG search over case documents and facts using Multi-Query and Reciprocal Rank Fusion (RRF).',
      parameters: { caseId: 'string', query: 'string', filterType: 'LAW | CASE' }
    },
    {
      name: 'get_law',
      description: 'Verified statutory lookup under BNS 2023, BNSS 2023, BSA 2023, and IT Act (cited only).',
      parameters: { query: 'string', act: 'string', section: 'string' }
    },
    {
      name: 'compute_deadlines',
      description: 'Calculates BNSS Section 187 60/90-day default bail clock and Section 193 90-day victim update deadline.',
      parameters: { caseId: 'string', arrestDate: 'ISO string', maxPenaltyYears: 'number' }
    },
    {
      name: 'trace_money',
      description: 'Analyzes Layer 1, 2, and 3 mule accounts and produces freeze priority orders under Section 107 BNSS.',
      parameters: { caseId: 'string', transactions: 'array' }
    },
    {
      name: 'find_gaps',
      description: 'Audits case file for missing statutory evidence (Sec 63 BSA certificate, CDR, Bank KYC).',
      parameters: { caseId: 'string' }
    },
    {
      name: 'list_links',
      description: 'Identifies cross-case syndicate linkages by suspect phone, bank account, UPI ID, or IMEI.',
      parameters: { caseId: 'string', identifiers: 'object' }
    },
    {
      name: 'draft_notice',
      description: 'Generates print-ready statutory notices (Sec 94/107 BNSS Bank Freeze, Sec 106 Telecom CDR, Victim Update).',
      parameters: { caseId: 'string', noticeType: 'string', language: 'en | hi', customData: 'object' }
    },
    {
      name: 'check_citations',
      description: 'Verifies that every cited statute in generated text matches the authoritative law corpus.',
      parameters: { text: 'string' }
    },
    {
      name: 'check_contradictions',
      description: 'Detects internal factual, date, amount, and account clashes in the case before the defense does.',
      parameters: { caseId: 'string' }
    }
  ];

  res.json({ success: true, count: tools.length, tools });
});

// Execute a typed tool with guardrails & audit
router.post('/call', async (req, res) => {
  try {
    const { tool, params = {}, context = {} } = req.body;
    if (!tool) {
      return res.status(400).json({ success: false, error: 'tool name is required' });
    }

    const result = await mcpServer.executeTool(tool, params, context);
    res.json(result);
  } catch (err) {
    console.error(`MCP Error on tool:`, err);
    res.status(400).json({
      success: false,
      error: err.message,
      guardrailTriggered: err.message.includes('Access Denied') || err.message.includes('Guardrail Violation')
    });
  }
});

module.exports = router;
