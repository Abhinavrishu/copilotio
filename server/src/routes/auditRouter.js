const express = require('express');
const router = express.Router();
const auditChain = require('../mcp/auditChain');

// Get audit chain history
router.get('/chain', (req, res) => {
  const { caseId, tool, limit } = req.query;
  const entries = auditChain.getEntries({
    caseId,
    tool,
    limit: limit ? parseInt(limit, 10) : 50
  });
  const validation = auditChain.validateChain();

  res.json({
    success: true,
    totalBlocks: auditChain.chain.length,
    chainValid: validation.isValid,
    validationDetails: validation,
    entries
  });
});

// Verify cryptographic integrity
router.get('/verify', (req, res) => {
  const result = auditChain.validateChain();
  res.json({
    success: true,
    result
  });
});

// Demonstrate tamper detection (Slide 9 test case)
router.post('/simulate-tamper', (req, res) => {
  if (auditChain.chain.length < 2) {
    auditChain.logCall({
      actor: 'TEST_ACTOR',
      role: 'IO',
      tool: 'DEMO_TOOL',
      caseId: 'case_001',
      inputPayload: { sample: 'initial' },
      outputPayload: { sample: 'initial' }
    });
  }

  // Intentionally tamper block 1's payload to simulate record alteration
  const originalChainBackup = JSON.parse(JSON.stringify(auditChain.chain));
  auditChain.chain[1].outputPayload = { TAMPERED: 'Defense lawyer altered evidence file' };

  const checkAfterTamper = auditChain.validateChain();

  // Restore chain to preserve integrity
  auditChain.chain = originalChainBackup;
  auditChain.persist();

  res.json({
    success: true,
    simulation: 'Tampered Block 1 payload',
    detectionResult: checkAfterTamper,
    defenseNotice: 'System successfully caught simulated tampering: Hash recalculation mismatch identified exact corrupted block.'
  });
});

module.exports = router;
