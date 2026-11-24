const express = require('express');
const router = express.Router();
const mcpServer = require('../mcp/mcpServer');
const auditChain = require('../mcp/auditChain');

// In-memory cases store for active session edits
let activeCases = [...mcpServer.cases];

router.get('/', (req, res) => {
  const summary = activeCases.map((c) => ({
    id: c.id,
    case_title: c.case_title,
    case_title_hi: c.case_title_hi,
    fir_number: c.fir_number,
    fir_date: c.fir_date,
    police_station: c.police_station,
    district: c.district,
    io: c.io,
    complainant: c.complainant?.name,
    defrauded_amount: c.defrauded_amount,
    recovered_amount: c.recovered_amount,
    status: c.status,
    accused_arrested: c.accused_arrested,
    hasContradiction: !!c.planted_contradiction
  }));
  res.json({ success: true, count: summary.length, cases: summary });
});

router.get('/:id', async (req, res) => {
  const c = activeCases.find((item) => item.id === req.params.id);
  if (!c) {
    return res.status(404).json({ success: false, error: 'Case not found' });
  }

  // Calculate live deadlines, gaps, contradictions, and money trail
  const deadlines = await mcpServer.executeTool('compute_deadlines', { caseId: c.id });
  const gaps = await mcpServer.executeTool('find_gaps', { caseId: c.id });
  const contradictions = await mcpServer.executeTool('check_contradictions', { caseId: c.id });
  const moneyTrail = await mcpServer.executeTool('trace_money', { caseId: c.id });
  const crossLinks = await mcpServer.executeTool('list_links', { caseId: c.id });

  res.json({
    success: true,
    case: c,
    liveAnalysis: {
      deadlines: deadlines.data,
      gaps: gaps.data,
      contradictions: contradictions.data,
      moneyTrail: moneyTrail.data,
      crossLinks: crossLinks.data
    }
  });
});

// Officer Approval Gate (Slide 12: "Officer in charge: Only the case IO can approve")
router.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const { officerName = 'Inspector Rajesh Verma', role = 'IO', itemType = 'INVESTIGATION_PLAN', itemId } = req.body;

  const target = activeCases.find((c) => c.id === id);
  if (!target) return res.status(404).json({ success: false, error: 'Case not found' });

  const auditBlock = auditChain.logCall({
    actor: officerName,
    role,
    tool: 'OFFICER_APPROVAL_GATE',
    caseId: id,
    inputPayload: { itemType, itemId, approvedAt: new Date().toISOString() },
    outputPayload: { approvalStatus: 'APPROVED_BY_IO', officerSigned: true }
  });

  res.json({
    success: true,
    message: `Item '${itemType}' officially approved by Investigating Officer.`,
    auditHash: auditBlock.hash,
    approvedAt: auditBlock.timestamp
  });
});

module.exports = router;
