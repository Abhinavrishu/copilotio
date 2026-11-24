class GapEngine {
  static findGaps(caseData) {
    if (!caseData) return { gaps: [], completionPercentage: 0 };

    const explicitGaps = caseData.gaps || [];

    // Core statutory checklist items
    const checklist = [
      {
        id: 'chk_bsa_63',
        item: 'Section 63 BSA Digital Evidence Certificate',
        statute: 'Bharatiya Sakshya Adhiniyam, 2023 Section 63',
        description: 'Mandatory certificate signed by device custodian for chats, call logs, bank screenshots.',
        severity: 'CRITICAL',
        status: explicitGaps.find((g) => g.legal_statute.includes('63'))?.status || 'MISSING'
      },
      {
        id: 'chk_bnss_94_kyc',
        item: 'Certified Bank Ledger & AOF KYC',
        statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 Section 94',
        description: 'Account Opening Form, photo ID, and ledger certified by bank manager.',
        severity: 'HIGH',
        status: explicitGaps.find((g) => g.item.toLowerCase().includes('bank'))?.status || 'PENDING'
      },
      {
        id: 'chk_bnss_106_cdr',
        item: 'Telecom CDR, CAF & Tower Location Analysis',
        statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 Section 106',
        description: 'Call records and subscriber identification for suspect mobile numbers.',
        severity: 'HIGH',
        status: explicitGaps.find((g) => g.item.toLowerCase().includes('cdr'))?.status || 'RECEIVED'
      },
      {
        id: 'chk_bnss_193_victim',
        item: 'Mandatory 90-Day Victim Update Dispatch',
        statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 Section 193(3)(ii)',
        description: 'Formal written or electronic notification to complainant on investigation status.',
        severity: 'MEDIUM',
        status: explicitGaps.find((g) => g.legal_statute.includes('193'))?.status || 'PENDING'
      },
      {
        id: 'chk_atm_cctv',
        item: 'ATM / POS Cash Withdrawal CCTV Footage',
        statute: 'BNSS Section 94 read with BSA Section 61',
        description: 'Footage requisition before 30-day bank server overwrite cycle.',
        severity: 'MEDIUM',
        status: 'PENDING'
      }
    ];

    const criticalPending = checklist.filter((c) => c.severity === 'CRITICAL' && c.status !== 'RESOLVED' && c.status !== 'RECEIVED');
    const totalItems = checklist.length;
    const completedItems = checklist.filter((c) => c.status === 'RESOLVED' || c.status === 'RECEIVED').length;
    const completionPercentage = Math.round((completedItems / totalItems) * 100);

    return {
      caseId: caseData.id,
      firNumber: caseData.fir_number,
      totalChecklistItems: totalItems,
      completedItems,
      completionPercentage,
      criticalGapsCount: criticalPending.length,
      weakCaseAlert: criticalPending.length > 0 || completionPercentage < 60,
      checklist,
      recommendations: checklist
        .filter((c) => c.status !== 'RESOLVED' && c.status !== 'RECEIVED')
        .map((c) => ({
          item: c.item,
          statute: c.statute,
          severity: c.severity,
          action: `Issue requisition / notice under ${c.statute} to secure ${c.item}.`
        }))
    };
  }
}

module.exports = GapEngine;
