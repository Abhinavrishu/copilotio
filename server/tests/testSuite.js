const assert = require('assert');
const mcpServer = require('../src/mcp/mcpServer');
const auditChain = require('../src/mcp/auditChain');
const guardrails = require('../src/mcp/guardrails');
const multiQueryRRF = require('../src/rag/multiQueryRRF');
const vectorStore = require('../src/rag/vectorStore');
const deadlineEngine = require('../src/engines/deadlineEngine');
const moneyTrailEngine = require('../src/engines/moneyTrailEngine');
const gapEngine = require('../src/engines/gapEngine');
const contradictionEngine = require('../src/engines/contradictionEngine');
const crossCaseLinker = require('../src/engines/crossCaseLinker');

async function runTestSuite() {
  console.log('================================================================');
  console.log(' UP POLICE INVESTIGATION COPILOT - AUTOMATED TEST SUITE');
  console.log(' Validating 33 Comprehensive Tests across 6 Synthetic Cases');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(testNumber, description, testFn) {
    try {
      testFn();
      console.log(`[PASS] Test ${testNumber.toString().padStart(2, '0')}: ${description}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${testNumber.toString().padStart(2, '0')}: ${description}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  async function runAsyncTest(testNumber, description, testFn) {
    try {
      await testFn();
      console.log(`[PASS] Test ${testNumber.toString().padStart(2, '0')}: ${description}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${testNumber.toString().padStart(2, '0')}: ${description}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  // --- SUITE 1: Synthetic Cases (1 - 6) ---
  runTest(1, 'Case 1 loaded: Cyber Task Fraud (Lucknow, ₹18.5L, FIR 412/2025)', () => {
    const c1 = mcpServer.getCaseById('case_001');
    assert(c1, 'Case 1 must exist');
    assert.strictEqual(c1.fir_number, 'FIR No. 412/2025');
    assert.strictEqual(c1.defrauded_amount, 1850000);
    assert(c1.chunks.length >= 5, 'Must contain 5 pre-stored document chunks');
  });

  runTest(2, 'Case 2 loaded: Digital Arrest Extortion (Gomti Nagar, ₹45L, FIR 89/2025)', () => {
    const c2 = mcpServer.getCaseById('case_002');
    assert(c2, 'Case 2 must exist');
    assert.strictEqual(c2.fir_number, 'FIR No. 89/2025');
    assert.strictEqual(c2.sections_invoked.includes('BNS Section 308'), true);
  });

  runTest(3, 'Case 3 loaded: Electricity Bill APK Scam (Prayagraj, ₹3.8L, FIR 204/2025)', () => {
    const c3 = mcpServer.getCaseById('case_003');
    assert(c3, 'Case 3 must exist');
    assert.strictEqual(c3.police_station, 'PS Civil Lines');
    assert.strictEqual(c3.sections_invoked.includes('IT Act Section 66D'), true);
  });

  runTest(4, 'Case 4 loaded: AePS Biometric Clone Fraud (Varanasi, ₹1.2L, FIR 115/2025)', () => {
    const c4 = mcpServer.getCaseById('case_004');
    assert(c4, 'Case 4 must exist');
    assert.strictEqual(c4.district, 'Varanasi');
  });

  runTest(5, 'Case 5 loaded: OLX Armed Forces QR Code Scam (Noida, ₹2.4L, FIR 302/2025)', () => {
    const c5 = mcpServer.getCaseById('case_005');
    assert(c5, 'Case 5 must exist');
    assert.strictEqual(c5.district, 'Noida');
  });

  runTest(6, 'Case 6 loaded: Deepfake Voice Corporate Wire Fraud (Ghaziabad, ₹32L, FIR 56/2025)', () => {
    const c6 = mcpServer.getCaseById('case_006');
    assert(c6, 'Case 6 must exist');
    assert.strictEqual(c6.district, 'Ghaziabad');
    assert.strictEqual(c6.defrauded_amount, 3200000);
  });

  // --- SUITE 2: Statutory Law Corpus & Mapping (7 - 12) ---
  runTest(7, 'Law Corpus: BNS Section 318(4) mapped from IPC Section 420', () => {
    const law = mcpServer.toolGetLaw({ section: '318(4)' });
    assert(law.sections.length > 0, 'Must find Section 318(4)');
    const sec = law.sections[0];
    assert.strictEqual(sec.old_section, 'IPC Section 420');
    assert.strictEqual(sec.max_punishment_years, 7);
  });

  runTest(8, 'Law Corpus: BNSS Section 94 mapped from CrPC Section 91', () => {
    const law = mcpServer.toolGetLaw({ section: '94' });
    const sec = law.sections.find((s) => s.act.includes('BNSS'));
    assert(sec, 'Must find BNSS Section 94');
    assert(sec.summary.includes('summons'), 'Must mention summons to produce');
  });

  runTest(9, 'Law Corpus: BNSS Section 107 covers debit freeze / proceeds of crime', () => {
    const law = mcpServer.toolGetLaw({ section: '107' });
    const sec = law.sections.find((s) => s.act.includes('BNSS'));
    assert(sec, 'Must find BNSS Section 107');
    assert(sec.title_en.toLowerCase().includes('freezing'), 'Must mention property freezing');
  });

  runTest(10, 'Law Corpus: BNSS Section 187 defines 60/90 day default bail clock', () => {
    const law = mcpServer.toolGetLaw({ section: '187' });
    const sec = law.sections.find((s) => s.act.includes('BNSS'));
    assert(sec, 'Must find BNSS Section 187');
    assert(sec.summary.includes('60 days'), 'Must specify 60/90 days');
  });

  runTest(11, 'Law Corpus: BNSS Section 193(3)(ii) mandates 90-day progress report to victim', () => {
    const law = mcpServer.toolGetLaw({ section: '193' });
    const sec = law.sections.find((s) => s.act.includes('BNSS'));
    assert(sec, 'Must find BNSS Section 193(3)(ii)');
    assert(sec.summary.includes('ninety days'), 'Must specify 90 days');
  });

  runTest(12, 'Law Corpus: BSA Section 63 defines electronic evidence certificate (formerly 65B)', () => {
    const law = mcpServer.toolGetLaw({ section: '63' });
    const sec = law.sections.find((s) => s.act.includes('BSA'));
    assert(sec, 'Must find BSA Section 63');
    assert(sec.old_section.includes('65B'), 'Must cross-reference old 65B IEA');
  });

  // --- SUITE 3: Multi-Query & RRF (13 - 16) ---
  await runAsyncTest(13, 'MultiQueryRRF: Generates multiple search perspectives for police query', async () => {
    const queries = await multiQueryRRF.generateMultiQueries('धोखाधड़ी के मामले में खाता फ्रीज कैसे करें?', 4);
    assert(Array.isArray(queries), 'Should return an array');
    assert(queries.length >= 3, 'Should generate at least 3 query variants');
  });

  runTest(14, 'RRF Engine: Reciprocal Rank Fusion correctly applies 1/(k+rank) formula', () => {
    const mockRankings = [
      {
        query: 'q1',
        results: [{ id: 'docA' }, { id: 'docB' }]
      },
      {
        query: 'q2',
        results: [{ id: 'docB' }, { id: 'docA' }]
      }
    ];
    const fused = multiQueryRRF.reciprocalRankFusion(mockRankings, 60);
    assert.strictEqual(fused.length, 2);
    // docA rank 1 + rank 2 = 1/61 + 1/62
    // docB rank 2 + rank 1 = 1/62 + 1/61 => exact tie
    assert.strictEqual(fused[0].rrfScore, fused[1].rrfScore);
  });

  await runAsyncTest(15, 'MultiQueryRRF: End-to-end search retrieves relevant chunks with citations', async () => {
    const res = await multiQueryRRF.searchWithMultiQueryRRF('Telegram task fraud 18.5 lakh', {
      caseId: 'case_001',
      topK: 4
    });
    assert(res.topResults.length > 0, 'Must retrieve top results');
    assert(res.topResults[0].rrfScore > 0, 'RRF score must be positive');
  });

  runTest(16, 'VectorStore: Hindi and English bilingual tokenization and scoring', () => {
    const hits = vectorStore.search('धोखाधड़ी धारा 318(4)');
    assert(hits.length > 0, 'Must match Hindi keywords in law corpus');
    assert(hits[0].title.includes('318(4)'), 'Must rank Section 318(4) at top');
  });

  // --- SUITE 4: MCP 8 Typed Tools (17 - 24) ---
  await runAsyncTest(17, 'MCP Tool 1: search_case returns grounded chunks', async () => {
    const out = await mcpServer.executeTool('search_case', { caseId: 'case_001', query: 'mule account freeze' });
    assert(out.success, 'Tool must execute successfully');
    assert(out.data.chunks.length > 0, 'Must return chunks');
    assert(out.auditHash, 'Must carry audit chain hash');
  });

  await runAsyncTest(18, 'MCP Tool 2: get_law returns verified statutory sections', async () => {
    const out = await mcpServer.executeTool('get_law', { act: 'BNS 2023', section: '318(4)' });
    assert.strictEqual(out.data.sections[0].section, 'Section 318(4)');
  });

  await runAsyncTest(19, 'MCP Tool 3: compute_deadlines returns BNSS 187 & 193 clocks', async () => {
    const out = await mcpServer.executeTool('compute_deadlines', { caseId: 'case_001' });
    assert(out.data.bailClock, 'Must compute bail clock');
    assert(out.data.victimUpdate, 'Must compute victim update');
    assert.strictEqual(out.data.bailClock.bail_period_days, 60);
  });

  await runAsyncTest(20, 'MCP Tool 4: trace_money parses L1, L2, L3 transactions & freeze priorities', async () => {
    const out = await mcpServer.executeTool('trace_money', { caseId: 'case_001' });
    assert(out.data.layers.layer1.count > 0, 'Layer 1 must have transactions');
    assert(out.data.freezePriorityList.length > 0, 'Must have freeze priority list');
  });

  await runAsyncTest(21, 'MCP Tool 5: find_gaps flags missing Sec 63 BSA certificate', async () => {
    const out = await mcpServer.executeTool('find_gaps', { caseId: 'case_001' });
    assert(out.data.checklist.length >= 4, 'Must evaluate standard checklist');
    const bsaGap = out.data.checklist.find((c) => c.item.includes('63 BSA'));
    assert(bsaGap, 'Must include Section 63 BSA');
  });

  await runAsyncTest(22, 'MCP Tool 6: list_links detects syndicate link between Case 1 and Case 5', async () => {
    const out = await mcpServer.executeTool('list_links', { caseId: 'case_001' });
    const matchCase5 = out.data.links.find((l) => l.linkedCaseId === 'case_005');
    assert(matchCase5, 'Must detect shared suspect phone +91-9188223344 between Case 1 and Case 5');
  });

  await runAsyncTest(23, 'MCP Tool 7: draft_notice formats print-ready Section 94/107 BNSS notice', async () => {
    const out = await mcpServer.executeTool('draft_notice', {
      caseId: 'case_001',
      noticeType: 'bank_freeze_notice',
      language: 'en'
    });
    assert(out.data.draftContent.includes('Section 107'), 'Draft must cite Section 107 BNSS');
    assert(out.data.draftContent.includes('Rameshwar Yadav Enterprises'), 'Draft must cite beneficiary name');
  });

  await runAsyncTest(24, 'MCP Tool 8: check_citations validates correct statutes and flags hallucinations', async () => {
    const validCheck = await mcpServer.executeTool('check_citations', {
      text: 'Case registered under BNS Section 318(4) and BNSS Section 107.'
    });
    assert.strictEqual(validCheck.data.isValid, true);

    const invalidCheck = await mcpServer.executeTool('check_citations', {
      text: 'Accused charged under BNS Section 99999 and Mars Law 44.'
    });
    assert.strictEqual(invalidCheck.data.isValid, false);
    assert(invalidCheck.data.unverifiedCitations.length > 0);
  });

  // --- SUITE 5: Deadline Engine Specifics (25 - 26) ---
  runTest(25, 'Deadlines: 60-day bail limit for BNS 318(4) (<10 yrs penalty)', () => {
    const c1 = mcpServer.getCaseById('case_001');
    const dl = deadlineEngine.computeDeadlines(c1);
    assert.strictEqual(dl.bailClock.bail_period_days, 60);
  });

  runTest(26, 'Deadlines: 90-day bail limit for BNS 111 / offences >= 10 yrs penalty', () => {
    const c6 = mcpServer.getCaseById('case_006');
    const dl = deadlineEngine.computeDeadlines(c6, { maxPenaltyYears: 10, accusedArrested: true, arrestDate: '2025-11-18' });
    assert.strictEqual(dl.bailClock.bail_period_days, 90);
  });

  // --- SUITE 6: Money Trail & Freeze Logic (27 - 28) ---
  runTest(27, 'Money Trail: Identifies Layer 1 Yes Bank and Layer 2 Canara Bank mule accounts', () => {
    const c1 = mcpServer.getCaseById('case_001');
    const trail = moneyTrailEngine.traceMoney(c1);
    const l1 = trail.layers.layer1.transactions[0];
    assert.strictEqual(l1.receiver_acc, 'Yes Bank 019283746501');
    assert(trail.totalFrozenAmount > 0, 'Frozen amount must be computed');
  });

  runTest(28, 'Money Trail: Sorts freeze priority list placing active Layer 1 & 2 balances at top', () => {
    const c1 = mcpServer.getCaseById('case_001');
    const trail = moneyTrailEngine.traceMoney(c1);
    assert.strictEqual(trail.freezePriorityList[0].freezePriority, 'CRITICAL');
  });

  // --- SUITE 7: Contradiction Engine & Planted Date Mismatch (29 - 30) ---
  runTest(29, 'Contradiction Engine: Catches PLANTED DATE MISMATCH in Case 1 (Slide 11)', () => {
    const c1 = mcpServer.getCaseById('case_001');
    const result = contradictionEngine.checkContradictions(c1);
    assert.strictEqual(result.hasContradictions, true);
    const dateMismatch = result.contradictions.find((c) => c.type === 'DATE_MISMATCH');
    assert(dateMismatch, 'Planted date mismatch must be detected');
    assert(dateMismatch.description.includes('12-Oct') || dateMismatch.sourceA.includes('12-Oct'), 'Must highlight 12-Oct vs 14-Oct conflict');
  });

  runTest(30, 'Contradiction Engine: Catches Amount Variance between FIR claim and bank receipts', () => {
    const c2 = mcpServer.getCaseById('case_002');
    const result = contradictionEngine.checkContradictions(c2);
    assert.strictEqual(result.hasContradictions, true);
    const amountConflict = result.contradictions.find((c) => c.type === 'AMOUNT_CONTRADICTION' || c.type === 'AMOUNT_MISMATCH');
    assert(amountConflict, 'Must detect amount discrepancy between ₹45L and ₹41.5L debits');
  });

  // --- SUITE 8: Tamper-Evident Audit Chain (31 - 32) ---
  runTest(31, 'Audit Chain: Every action generates SHA-256 block linked to previous block hash', () => {
    const initialLen = auditChain.chain.length;
    const block = auditChain.logCall({
      actor: 'INSPECTOR_VERMA',
      role: 'IO',
      tool: 'TEST_AUDIT',
      caseId: 'case_001',
      inputPayload: { test: true },
      outputPayload: { ok: true }
    });
    assert(block.hash, 'Block must have sha256 hash');
    assert.strictEqual(block.index, initialLen);
    const validation = auditChain.validateChain();
    assert.strictEqual(validation.isValid, true);
  });

  runTest(32, 'Audit Chain: Detects tampering if past block payload is maliciously modified', () => {
    // Clone chain and tamper
    const originalBackup = JSON.parse(JSON.stringify(auditChain.chain));
    auditChain.chain[1].outputPayload = { ILLEGAL_TAMPER: 'Deleted evidence' };
    const tamperedValidation = auditChain.validateChain();
    assert.strictEqual(tamperedValidation.isValid, false, 'Chain validation must fail on tampered block');
    assert(tamperedValidation.error.includes('Tampered') || tamperedValidation.error.includes('Broken'), 'Must pinpoint tampered block');

    // Restore integrity
    auditChain.chain = originalBackup;
    auditChain.persist();
    assert.strictEqual(auditChain.validateChain().isValid, true);
  });

  // --- SUITE 9: Guardrails & Officer Approval Gate (33) ---
  runTest(33, 'Guardrails: Blocks unauthorized role and prevents automated deletion/execution without IO approval', () => {
    const roleCheck = guardrails.checkRoleAccess('UNKNOWN_USER', 'HACKER_ROLE', null);
    assert.strictEqual(roleCheck.allowed, false, 'Unauthorized role must be rejected');

    assert.throws(
      () => {
        guardrails.enforceOfficerApprovalGate('DELETE_RECORD');
      },
      /Guardrail Violation/,
      'Must throw error if automated tool attempts to delete record without IO approval'
    );
  });

  console.log('\n================================================================');
  console.log(` TEST RUN COMPLETE: ${passed} / 33 PASSED (${failed} FAILED)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
