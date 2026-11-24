const fs = require('fs');
const path = require('path');

class CrossCaseLinker {
  static getAllCases() {
    try {
      const data = fs.readFileSync(path.join(__dirname, '../../data/cases.json'), 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  static findLinks(targetCaseId, customIdentifiers = {}) {
    const allCases = this.getAllCases();
    const currentCase = allCases.find((c) => c.id === targetCaseId);

    const targetPhones = new Set(customIdentifiers.phones || (currentCase?.linked_identifiers?.suspect_phones || []));
    const targetAccounts = new Set(customIdentifiers.accounts || (currentCase?.linked_identifiers?.bank_accounts || []));
    const targetUpi = new Set(customIdentifiers.upi || (currentCase?.linked_identifiers?.suspect_upi || []));
    const targetImei = new Set(customIdentifiers.imei || (currentCase?.linked_identifiers?.imei_numbers || []));

    const matchedLinks = [];

    allCases.forEach((otherCase) => {
      if (otherCase.id === targetCaseId) return;

      const otherIds = otherCase.linked_identifiers || {};
      const shared = {
        phones: (otherIds.suspect_phones || []).filter((p) => targetPhones.has(p)),
        accounts: (otherIds.bank_accounts || []).filter((a) => targetAccounts.has(a)),
        upi: (otherIds.suspect_upi || []).filter((u) => targetUpi.has(u)),
        imei: (otherIds.imei_numbers || []).filter((i) => targetImei.has(i))
      };

      const matchCount = shared.phones.length + shared.accounts.length + shared.upi.length + shared.imei.length;

      if (matchCount > 0) {
        matchedLinks.push({
          linkedCaseId: otherCase.id,
          linkedFir: otherCase.fir_number,
          linkedTitle: otherCase.case_title,
          policeStation: otherCase.police_station,
          district: otherCase.district,
          sharedCount: matchCount,
          sharedIdentifiers: shared,
          syndicateRisk: matchCount >= 2 ? 'HIGH_CONFIDENCE_SYNDICATE' : 'MODERATE_LINK'
        });
      }
    });

    return {
      sourceCaseId: targetCaseId,
      sourceFir: currentCase ? currentCase.fir_number : 'N/A',
      totalLinkedCases: matchedLinks.length,
      links: matchedLinks,
      syndicateAlert: matchedLinks.length > 0 
        ? `Common suspect infrastructure detected across ${matchedLinks.length} other FIRs in UP Police records.` 
        : 'No cross-case linkages detected for current identifiers.'
    };
  }
}

module.exports = CrossCaseLinker;
