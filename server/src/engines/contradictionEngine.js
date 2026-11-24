class ContradictionEngine {
  static checkContradictions(caseData) {
    if (!caseData) return { contradictions: [], totalCount: 0 };

    const detected = [];

    // 1. Check explicit planted contradiction if present
    if (caseData.planted_contradiction) {
      detected.push({
        id: 'contra_planted',
        type: caseData.planted_contradiction.type,
        severity: caseData.planted_contradiction.severity || 'HIGH',
        sourceA: caseData.planted_contradiction.field_1,
        sourceB: caseData.planted_contradiction.field_2,
        description: caseData.planted_contradiction.description,
        defenseRisk: caseData.planted_contradiction.defense_vulnerability,
        remedy: 'IO must clarify discrepancy in supplementary Case Diary (Parcha) before filing chargesheet.'
      });
    }

    // 2. Multi-detailed contradictions if specified in case data
    if (Array.isArray(caseData.contradiction_details)) {
      caseData.contradiction_details.forEach((cd, idx) => {
        detected.push({
          id: `contra_detail_${idx + 1}`,
          type: cd.type,
          severity: 'HIGH',
          sourceA: `${cd.doc1}: "${cd.claim1}"`,
          sourceB: `${cd.doc2}: "${cd.claim2}"`,
          description: `Discrepancy between ${cd.doc1} and ${cd.doc2}`,
          defenseRisk: 'Defense will argue fabrication or procedural inaccuracy during cross-examination.',
          remedy: cd.recommendation
        });
      });
    }

    // 3. Automated Rule-Based Audit across transactions and case chunks
    if (caseData.transactions && caseData.transactions.length > 0) {
      const sumTransactions = caseData.transactions
        .filter((tx) => tx.layer === 1)
        .reduce((acc, tx) => acc + (tx.amount || 0), 0);

      const allegedAmount = caseData.defrauded_amount || 0;

      if (allegedAmount > 0 && sumTransactions > 0 && Math.abs(allegedAmount - sumTransactions) > 1000) {
        // Only add if not already covered
        if (!detected.some((d) => d.type === 'AMOUNT_MISMATCH' || d.type === 'AMOUNT_CONTRADICTION')) {
          detected.push({
            id: 'contra_amount_auto',
            type: 'AMOUNT_MISMATCH',
            severity: 'HIGH',
            sourceA: `FIR Claimed Loss: Rs. ${allegedAmount.toLocaleString('en-IN')}`,
            sourceB: `Sum of Layer 1 Bank Transfers: Rs. ${sumTransactions.toLocaleString('en-IN')}`,
            description: `Variance of Rs. ${Math.abs(allegedAmount - sumTransactions).toLocaleString('en-IN')} between FIR narrative and primary bank debits.`,
            defenseRisk: 'Defense can challenge charge under BNS 318(4) for inflated damages.',
            remedy: 'Obtain payment gateway convenience charge receipt or reconcile non-banking transfers.'
          });
        }
      }
    }

    return {
      caseId: caseData.id,
      firNumber: caseData.fir_number,
      totalCount: detected.length,
      hasContradictions: detected.length > 0,
      severityLevel: detected.some((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH') ? 'HIGH_ALERT' : 'NORMAL',
      contradictions: detected,
      defenseWarning: detected.length > 0 
        ? 'Defense counsel may target these contradictions in bail opposition or trial. IO action required.' 
        : 'No internal evidentiary contradictions detected.'
    };
  }
}

module.exports = ContradictionEngine;
