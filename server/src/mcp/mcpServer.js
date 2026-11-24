const fs = require('fs');
const path = require('path');
const auditChain = require('./auditChain');
const guardrails = require('./guardrails');
const multiQueryRRF = require('../rag/multiQueryRRF');
const vectorStore = require('../rag/vectorStore');
const deadlineEngine = require('../engines/deadlineEngine');
const moneyTrailEngine = require('../engines/moneyTrailEngine');
const gapEngine = require('../engines/gapEngine');
const contradictionEngine = require('../engines/contradictionEngine');
const crossCaseLinker = require('../engines/crossCaseLinker');

class MCPServer {
  constructor() {
    this.cases = [];
    this.lawCorpus = [];
    this.noticeTemplates = {};
    this.loadData();
  }

  loadData() {
    try {
      this.cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cases.json'), 'utf8'));
      this.lawCorpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/law_corpus.json'), 'utf8'));
      this.noticeTemplates = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/notice_templates.json'), 'utf8'));
    } catch (e) {
      console.error('MCPServer loadData error:', e);
    }
  }

  getCaseById(caseId) {
    return this.cases.find((c) => c.id === caseId) || null;
  }

  /**
   * Helper to execute tool with mandatory guardrails & hash-chained audit logging
   */
  async executeTool(toolName, params = {}, context = {}) {
    const actor = context.actor || 'INSPECTOR_RAJESH_VERMA';
    const role = context.role || 'IO';
    const caseId = params.caseId || context.caseId || 'N/A';
    const targetCase = caseId !== 'N/A' ? this.getCaseById(caseId) : null;

    // 1. Guardrail: Role & Case Access
    const accessCheck = guardrails.checkRoleAccess(actor, role, targetCase);
    if (!accessCheck.allowed) {
      throw new Error(`Access Denied: ${accessCheck.reason}`);
    }

    // 2. Guardrail: Prompt Injection Defense on textual inputs
    if (params.query) {
      const sanitized = guardrails.sanitizeComplaintData(params.query);
      params.query = sanitized.sanitizedText;
    }
    if (params.complaintText) {
      const sanitized = guardrails.sanitizeComplaintData(params.complaintText);
      params.complaintText = sanitized.sanitizedText;
    }

    // 3. Guardrail: Officer Approval Gate
    if (params.action) {
      guardrails.enforceOfficerApprovalGate(params.action);
    }

    let output = null;

    switch (toolName) {
      case 'search_case':
        output = await this.toolSearchCase(params, targetCase);
        break;

      case 'get_law':
        output = this.toolGetLaw(params);
        break;

      case 'compute_deadlines':
        output = this.toolComputeDeadlines(params, targetCase);
        break;

      case 'trace_money':
        output = this.toolTraceMoney(params, targetCase);
        break;

      case 'find_gaps':
        output = this.toolFindGaps(params, targetCase);
        break;

      case 'list_links':
        output = this.toolListLinks(params, targetCase);
        break;

      case 'draft_notice':
        output = this.toolDraftNotice(params, targetCase);
        break;

      case 'check_citations':
        output = this.toolCheckCitations(params);
        break;

      case 'check_contradictions':
        output = this.toolCheckContradictions(params, targetCase);
        break;

      default:
        throw new Error(`MCP Tool '${toolName}' is not recognized.`);
    }

    // 4. Guardrail: Every call written to the tamper-evident hash-chained audit log
    const auditBlock = auditChain.logCall({
      actor,
      role,
      tool: toolName,
      caseId,
      inputPayload: params,
      outputPayload: {
        summary: `Executed ${toolName} successfully`,
        resultKeys: Object.keys(output || {})
      }
    });

    return {
      success: true,
      tool: toolName,
      auditHash: auditBlock.hash,
      auditBlockIndex: auditBlock.index,
      data: output
    };
  }

  // --- TOOL 1: search_case ---
  async toolSearchCase(params, targetCase) {
    const query = params.query || '';
    const caseId = targetCase ? targetCase.id : params.caseId;
    const searchRes = await multiQueryRRF.searchWithMultiQueryRRF(query, {
      caseId,
      filterType: params.filterType,
      topK: params.topK || 6
    });

    return {
      caseId,
      query,
      multiQueryUsed: searchRes.generatedQueries,
      totalHits: searchRes.topResults.length,
      chunks: searchRes.topResults.map((c) => ({
        id: c.id,
        type: c.type,
        source: c.type === 'LAW' ? `${c.act} ${c.section}` : `${c.source_doc} (Pg ${c.page_number})`,
        title: c.title,
        rrfScore: c.rrfScore,
        content: c.content
      }))
    };
  }

  // --- TOOL 2: get_law ---
  toolGetLaw(params) {
    const { query = '', act, section } = params;
    let results = this.lawCorpus;

    if (act) {
      results = results.filter((l) => l.act.toLowerCase().includes(act.toLowerCase()));
    }
    if (section) {
      results = results.filter((l) => l.section.toLowerCase().includes(section.toLowerCase()));
    }
    if (query) {
      const qLower = query.toLowerCase();
      results = results.filter(
        (l) =>
          l.section.toLowerCase().includes(qLower) ||
          l.title_en.toLowerCase().includes(qLower) ||
          l.title_hi.toLowerCase().includes(qLower) ||
          l.summary.toLowerCase().includes(qLower) ||
          (l.keywords || []).some((k) => k.toLowerCase().includes(qLower)) ||
          (l.old_section || '').toLowerCase().includes(qLower)
      );
    }

    return {
      queryCount: results.length,
      verifiedActs: ['BNS 2023', 'BNSS 2023', 'BSA 2023', 'IT Act 2000', 'UP Police SOP'],
      sections: results.map((r) => ({
        id: r.id,
        act: r.act,
        section: r.section,
        old_section: r.old_section,
        title_en: r.title_en,
        title_hi: r.title_hi,
        summary: r.summary,
        hindi_summary: r.hindi_summary,
        bailable: r.bailable,
        cognizable: r.cognizable,
        max_punishment_years: r.max_punishment_years,
        citation: `${r.act} ${r.section}`
      }))
    };
  }

  // --- TOOL 3: compute_deadlines ---
  toolComputeDeadlines(params, targetCase) {
    return deadlineEngine.computeDeadlines(targetCase, params);
  }

  // --- TOOL 4: trace_money ---
  toolTraceMoney(params, targetCase) {
    return moneyTrailEngine.traceMoney(targetCase, params.transactions);
  }

  // --- TOOL 5: find_gaps ---
  toolFindGaps(params, targetCase) {
    return gapEngine.findGaps(targetCase);
  }

  // --- TOOL 6: list_links ---
  toolListLinks(params, targetCase) {
    const caseId = targetCase ? targetCase.id : params.caseId;
    return crossCaseLinker.findLinks(caseId, params.identifiers);
  }

  // --- TOOL 7: draft_notice ---
  toolDraftNotice(params, targetCase) {
    const { noticeType = 'bank_freeze_notice', language = 'en', customData = {} } = params;
    const templateObj = this.noticeTemplates[noticeType] || this.noticeTemplates['bank_freeze_notice'];

    const mergedData = {
      policeStation: customData.policeStation || targetCase?.police_station || 'Cyber Crime PS Lucknow',
      district: customData.district || targetCase?.district || 'Lucknow',
      firNo: customData.firNo || targetCase?.fir_number || '412/2025',
      firDate: customData.firDate || (targetCase?.fir_date ? targetCase.fir_date.substring(0, 10) : '15-10-2025'),
      sections: (targetCase?.sections_invoked || ['Section 318(4) BNS', 'Section 66D IT Act']).join(', '),
      defraudedAmount: (customData.defraudedAmount || targetCase?.defrauded_amount || 1850000).toLocaleString('en-IN'),
      ioName: customData.ioName || targetCase?.io?.name || 'Inspector Rajesh Verma',
      ioRank: customData.ioRank || targetCase?.io?.rank || 'Inspector',
      ioPno: customData.ioPno || targetCase?.io?.pno || 'UPP-984210',
      bankName: customData.bankName || 'Yes Bank Ltd',
      branchName: customData.branchName || 'Hazratganj Branch, Lucknow',
      accountHolder: customData.accountHolder || 'Rameshwar Yadav Enterprises',
      accountNumber: customData.accountNumber || '019283746501',
      ifscCode: customData.ifscCode || 'YESB0000192',
      transactionRef: customData.transactionRef || 'UTR HDFC987123',
      transferredAmount: (customData.transferredAmount || 500000).toLocaleString('en-IN'),
      transferDateTime: customData.transferDateTime || '14-Oct-2025 16:42 IST',
      statementFromDate: customData.statementFromDate || '01-Oct-2025',
      telecomCompany: customData.telecomCompany || 'Reliance Jio Infocomm Ltd',
      targetMobile: customData.targetMobile || '+91-9188223344',
      startDate: customData.startDate || '01-Oct-2025',
      endDate: customData.endDate || '20-Oct-2025',
      complainantName: targetCase?.complainant?.name || 'Alok Ranjan Tripathi',
      complainantAddress: targetCase?.complainant?.address || 'Flat 402, Gomti Enclave, Lucknow',
      complainantPhone: targetCase?.complainant?.phone || '+91-9876543210',
      investigationStatus: 'Active - Multi-layer money trail traced, primary mule accounts debit frozen',
      frozenAccountsCount: targetCase?.transactions?.filter((t) => (t.freeze_status || '').includes('frozen')).length || 2,
      frozenAmount: (targetCase?.recovered_amount || 620000).toLocaleString('en-IN'),
      suspectsSummary: 'Rameshwar Yadav (Arrested in custody), Telegram coordinators under cyber surveillance',
      nextSteps: 'Requisitioning Section 63 BSA certificate from Complainant; filing Final Report under BNSS 193',
      reportDate: new Date().toLocaleDateString('en-GB')
    };

    let body = language === 'hi' ? templateObj.hindi_template : templateObj.template;

    // Fill variables
    Object.keys(mergedData).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      body = body.replace(regex, mergedData[key]);
    });

    return {
      noticeType,
      title: templateObj.title,
      statutoryActs: templateObj.sections,
      recipientType: templateObj.recipient_type,
      language: language === 'hi' ? 'Hindi' : 'English',
      draftContent: body,
      officerApprovalRequired: true,
      approvalStatus: 'DRAFT_PENDING_IO_SIGNATURE',
      statutoryWarning: 'This draft is generated by Investigation Copilot for officer review. Do NOT dispatch without IO digital sign-off.'
    };
  }

  // --- TOOL 8: check_citations ---
  toolCheckCitations(params) {
    const text = params.text || '';
    const citationRegex = /(BNS\s*(?:Section|Sec|धारा)?\s*\d+(?:\(\d+\))?|BNSS\s*(?:Section|Sec|धारा)?\s*\d+(?:\(\d+\))*(?:\([a-zivx]+\))*|BSA\s*(?:Section|Sec|धारा)?\s*\d+|IT Act\s*(?:Section|Sec)?\s*66[A-Z]|IPC\s*(?:Section)?\s*\d+|CrPC\s*(?:Section)?\s*\d+)/gi;

    const matches = text.match(citationRegex) || [];
    const uniqueCited = Array.from(new Set(matches.map((m) => m.trim().toUpperCase())));

    const verifiedCorpus = this.lawCorpus.map((l) => `${l.act} ${l.section}`.toUpperCase());

    const verified = [];
    const unverified = [];

    uniqueCited.forEach((cite) => {
      const numMatch = cite.match(/\d+/);
      const isPresent = verifiedCorpus.some((vc) => {
        if (numMatch && vc.includes(numMatch[0])) return true;
        return vc.includes(cite);
      });

      if (isPresent) {
        verified.push(cite);
      } else {
        unverified.push(cite);
      }
    });

    return {
      totalFound: uniqueCited.length,
      isValid: unverified.length === 0,
      verifiedCitations: verified,
      unverifiedCitations: unverified,
      verdict: unverified.length === 0 
        ? 'PASSED: All cited statutory provisions verified against authoritative law corpus.' 
        : `BLOCKED: Detected unverified or hallucinated citations: ${unverified.join(', ')}.`
    };
  }

  // --- EXTRA: check_contradictions ---
  toolCheckContradictions(params, targetCase) {
    return contradictionEngine.checkContradictions(targetCase);
  }
}

module.exports = new MCPServer();
