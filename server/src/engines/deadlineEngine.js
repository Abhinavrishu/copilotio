class DeadlineEngine {
  /**
   * Computes legal deadlines under BNSS 2023:
   * 1. Default Bail Clock under Section 187 BNSS (60 vs 90 days from arrest/remand)
   * 2. Mandatory 90-day progress report to victim under Section 193(3)(ii) BNSS
   */
  static computeDeadlines(caseData, customParams = {}) {
    const firDateStr = customParams.firDate || (caseData ? caseData.fir_date : null) || new Date().toISOString();
    const firDate = new Date(firDateStr);

    const isArrested = customParams.accusedArrested !== undefined 
      ? customParams.accusedArrested 
      : (caseData ? caseData.accused_arrested : false);

    const arrestDateStr = customParams.arrestDate || (caseData ? caseData.arrest_date : null);
    const arrestDate = arrestDateStr ? new Date(arrestDateStr) : null;

    const maxPenaltyYears = customParams.maxPenaltyYears || (caseData ? caseData.max_penalty_years : 7);

    // Rule: BNSS 187 Default Bail Period
    // 90 days if punishable with death, imprisonment for life, or imprisonment >= 10 years
    // 60 days for any other offence
    const bailPeriodDays = maxPenaltyYears >= 10 ? 90 : 60;

    let bailClock = null;
    const now = new Date();

    if (isArrested && arrestDate) {
      const bailExpiryDate = new Date(arrestDate.getTime() + bailPeriodDays * 24 * 60 * 60 * 1000);
      const diffMs = bailExpiryDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.floor((now.getTime() - arrestDate.getTime()) / (1000 * 60 * 60 * 24));

      let urgency = 'NORMAL'; // GREEN
      if (daysRemaining <= 0) {
        urgency = 'EXPIRED'; // CRITICAL RED
      } else if (daysRemaining <= 10) {
        urgency = 'CRITICAL'; // RED
      } else if (daysRemaining <= 25) {
        urgency = 'WARNING'; // YELLOW
      }

      bailClock = {
        statutory_act: 'BNSS 2023 Section 187',
        bail_period_days: bailPeriodDays,
        arrest_date: arrestDate.toISOString(),
        bail_expiry_date: bailExpiryDate.toISOString(),
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        urgency,
        status: daysRemaining <= 0 ? 'DEFAULT_BAIL_ACCRUED' : 'ACTIVE_COUNTDOWN',
        legal_consequence: daysRemaining <= 0 
          ? 'Accused has indefeasible right to default bail if chargesheet is not filed immediately.' 
          : `Chargesheet / Police Report must be submitted within ${daysRemaining} days.`
      };
    } else {
      bailClock = {
        statutory_act: 'BNSS 2023 Section 187',
        bail_period_days: bailPeriodDays,
        status: 'NO_ARREST_YET',
        legal_consequence: 'Bail clock starts from date of arrest / remand.'
      };
    }

    // Rule: BNSS 193(3)(ii) - 90 Days Victim Update from FIR Date
    const victimUpdateExpiry = new Date(firDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    const victimDiffMs = victimUpdateExpiry.getTime() - now.getTime();
    const victimDaysRemaining = Math.ceil(victimDiffMs / (1000 * 60 * 60 * 24));
    const victimDaysElapsed = Math.floor((now.getTime() - firDate.getTime()) / (1000 * 60 * 60 * 24));

    let victimUrgency = 'NORMAL';
    if (victimDaysRemaining <= 0) {
      victimUrgency = 'OVERDUE';
    } else if (victimDaysRemaining <= 15) {
      victimUrgency = 'CRITICAL';
    } else if (victimDaysRemaining <= 30) {
      victimUrgency = 'WARNING';
    }

    const victimUpdate = {
      statutory_act: 'BNSS 2023 Section 193(3)(ii)',
      fir_date: firDate.toISOString(),
      deadline_date: victimUpdateExpiry.toISOString(),
      days_elapsed: victimDaysElapsed,
      days_remaining: victimDaysRemaining,
      urgency: victimUrgency,
      status: victimDaysRemaining <= 0 ? 'OVERDUE' : 'PENDING_DISPATCH',
      duty: 'Mandatory progress update to victim/informant by electronic or written means within 90 days of FIR.'
    };

    return {
      caseId: caseData ? caseData.id : 'N/A',
      firNumber: caseData ? caseData.fir_number : 'N/A',
      computedAt: now.toISOString(),
      bailClock,
      victimUpdate,
      statutory_references: [
        'BNSS 2023 Section 187 (Default Bail 60/90 Days)',
        'BNSS 2023 Section 193(3)(ii) (Victim 90-day progress report)'
      ]
    };
  }
}

module.exports = DeadlineEngine;
