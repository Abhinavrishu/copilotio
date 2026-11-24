const express = require('express');
const router = express.Router();
const mcpServer = require('../mcp/mcpServer');
const deadlineEngine = require('../engines/deadlineEngine');
const gapEngine = require('../engines/gapEngine');
const contradictionEngine = require('../engines/contradictionEngine');

router.get('/dashboard', (req, res) => {
  const { role = 'SP' } = req.query;
  const cases = mcpServer.cases;

  let totalDefrauded = 0;
  let totalFrozen = 0;
  let imminentBailCount = 0;
  let overdueVictimUpdateCount = 0;
  let weakCasesCount = 0;
  let contradictionCasesCount = 0;

  const analyzedCases = cases.map((c) => {
    totalDefrauded += c.defrauded_amount || 0;
    totalFrozen += c.recovered_amount || 0;

    const dl = deadlineEngine.computeDeadlines(c);
    const gaps = gapEngine.findGaps(c);
    const contra = contradictionEngine.checkContradictions(c);

    if (dl.bailClock && (dl.bailClock.urgency === 'CRITICAL' || dl.bailClock.urgency === 'EXPIRED')) {
      imminentBailCount++;
    }

    if (dl.victimUpdate && (dl.victimUpdate.urgency === 'OVERDUE' || dl.victimUpdate.urgency === 'CRITICAL')) {
      overdueVictimUpdateCount++;
    }

    if (gaps.weakCaseAlert) {
      weakCasesCount++;
    }

    if (contra.hasContradictions) {
      contradictionCasesCount++;
    }

    return {
      id: c.id,
      fir_number: c.fir_number,
      case_title: c.case_title,
      police_station: c.police_station,
      district: c.district,
      io_name: c.io?.name,
      defrauded_amount: c.defrauded_amount,
      recovered_amount: c.recovered_amount,
      recoveryRate: c.defrauded_amount > 0 ? Math.round((c.recovered_amount / c.defrauded_amount) * 100) : 0,
      bailClockUrgency: dl.bailClock?.urgency || 'NO_ARREST',
      bailDaysRemaining: dl.bailClock?.days_remaining,
      victimUpdateUrgency: dl.victimUpdate?.urgency,
      victimDaysRemaining: dl.victimUpdate?.days_remaining,
      gapsCount: gaps.criticalGapsCount,
      completionRate: gaps.completionPercentage,
      isWeakCase: gaps.weakCaseAlert,
      hasContradiction: contra.hasContradictions,
      status: c.status
    };
  });

  const recoveryPercentage = totalDefrauded > 0 ? parseFloat(((totalFrozen / totalDefrauded) * 100).toFixed(1)) : 0;

  res.json({
    success: true,
    supervisorRole: role,
    summary: {
      totalCases: cases.length,
      totalDefraudedAmount: totalDefrauded,
      totalFrozenAmount: totalFrozen,
      recoveryPercentage,
      imminentBailCount,
      overdueVictimUpdateCount,
      weakCasesCount,
      contradictionCasesCount
    },
    cases: analyzedCases
  });
});

module.exports = router;
