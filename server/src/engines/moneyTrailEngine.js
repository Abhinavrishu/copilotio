class MoneyTrailEngine {
  static traceMoney(caseData, customTransactions = null) {
    const transactions = customTransactions || (caseData ? caseData.transactions : []) || [];

    let totalDisputed = 0;
    let totalFrozen = 0;
    let totalWithdrawnOrLost = 0;

    const layers = {
      layer1: [],
      layer2: [],
      layer3: []
    };

    const muleAccounts = new Map();

    transactions.forEach((tx) => {
      totalDisputed += tx.amount || 0;

      // Group into layers
      const layerNum = tx.layer || 1;
      if (layerNum === 1) layers.layer1.push(tx);
      else if (layerNum === 2) layers.layer2.push(tx);
      else layers.layer3.push(tx);

      // Analyze freeze status
      const freezeStr = (tx.freeze_status || '').toLowerCase();
      if (freezeStr.includes('frozen') || freezeStr.includes('held')) {
        const match = tx.freeze_status.match(/₹([\d,]+)/);
        if (match) {
          totalFrozen += parseInt(match[1].replace(/,/g, ''), 10);
        } else {
          totalFrozen += tx.amount * 0.5;
        }
      } else if (freezeStr.includes('cash') || freezeStr.includes('withdrawn') || freezeStr.includes('crypto')) {
        totalWithdrawnOrLost += tx.amount;
      }

      // Catalog mule accounts
      if (tx.receiver_acc && tx.receiver_acc !== 'N/A') {
        muleAccounts.set(tx.receiver_acc, {
          holder: tx.receiver,
          accountNumber: tx.receiver_acc,
          ifsc: tx.ifsc || 'UNKNOWN',
          layer: tx.layer,
          receivedAmount: tx.amount,
          freezePriority: tx.freeze_priority || 'HIGH',
          currentFreezeStatus: tx.freeze_status || 'Pending Action'
        });
      }
    });

    // Sort freeze actions by priority: CRITICAL > HIGH > MEDIUM > LOW > EXPIRED
    const priorityWeights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, EXPIRED: 0 };
    const freezePriorityOrder = Array.from(muleAccounts.values()).sort(
      (a, b) => (priorityWeights[b.freezePriority] || 0) - (priorityWeights[a.freezePriority] || 0)
    );

    return {
      caseId: caseData ? caseData.id : 'N/A',
      firNumber: caseData ? caseData.fir_number : 'N/A',
      totalDisputedAmount: totalDisputed,
      totalFrozenAmount: totalFrozen,
      totalWithdrawnOrSiphoned: totalWithdrawnOrLost,
      recoveryRatio: totalDisputed > 0 ? parseFloat(((totalFrozen / totalDisputed) * 100).toFixed(1)) : 0,
      layers: {
        layer1: { count: layers.layer1.length, transactions: layers.layer1 },
        layer2: { count: layers.layer2.length, transactions: layers.layer2 },
        layer3: { count: layers.layer3.length, transactions: layers.layer3 }
      },
      freezePriorityList: freezePriorityOrder,
      recommendedActions: freezePriorityOrder.map((mule) => ({
        account: mule.accountNumber,
        bank: mule.ifsc,
        action: `Issue immediate Section 107 BNSS freeze notice to ${mule.ifsc.substring(0, 4)} Bank Nodal Officer for Rs. ${mule.receivedAmount}.`,
        urgency: mule.freezePriority
      })),
      statutory_provisions: [
        'BNSS 2023 Section 107 (Attachment and Freezing of Proceeds of Crime)',
        'UP Police SOP on CFCFRMS / 1930 Portal Debit Freeze'
      ]
    };
  }
}

module.exports = MoneyTrailEngine;
