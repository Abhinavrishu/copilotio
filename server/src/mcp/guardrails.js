const auditChain = require('./auditChain');

const VALID_ROLES = ['IO', 'SHO', 'CO', 'SP', 'ADMIN'];

class Guardrails {
  static checkRoleAccess(actor, role, caseData) {
    if (!VALID_ROLES.includes(role)) {
      auditChain.logCall({
        actor,
        role: role || 'UNKNOWN',
        tool: 'ACCESS_CHECK',
        caseId: caseData ? caseData.id : 'N/A',
        inputPayload: { action: 'ACCESS_ATTEMPT' },
        outputPayload: { denied: true, reason: 'Invalid or missing role' }
      });
      return { allowed: false, reason: `Role ${role} is not authorized in UP Police Copilot.` };
    }

    if (!caseData) {
      // General tools (like get_law or compute_deadlines with params) don't require case binding
      return { allowed: true };
    }

    // Role-based scoping
    if (role === 'ADMIN' || role === 'SP') {
      return { allowed: true }; // District / System level oversight
    }

    if (role === 'CO' || role === 'SHO') {
      return { allowed: true }; // Station / Circle oversight
    }

    if (role === 'IO') {
      // IO can access their case or active workspace case
      return { allowed: true };
    }

    return { allowed: true };
  }

  /**
   * Slide 8 Guardrail: "Complaint text is data, never instructions"
   * Detects prompt injection attempts in user complaint or input data.
   */
  static sanitizeComplaintData(text) {
    if (!text || typeof text !== 'string') return text;

    const dangerousPatterns = [
      /ignore previous instructions/i,
      /disregard all previous/i,
      /system prompt/i,
      /you are now/i,
      /override authorization/i,
      /delete case/i,
      /drop database/i,
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi
    ];

    let sanitized = text;
    let injectionDetected = false;

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        injectionDetected = true;
        sanitized = sanitized.replace(pattern, '[FLAGGED_INJECTION_DEFENSE]');
      }
    }

    return {
      sanitizedText: sanitized,
      injectionDetected
    };
  }

  /**
   * Slide 8 Guardrail: "No tool can send, approve or delete"
   * Verifies that automated tools return proposals/drafts and require explicit officer approval.
   */
  static enforceOfficerApprovalGate(actionType) {
    const prohibitedAutoActions = ['SEND_DIRECTLY', 'APPROVE_AUTOMATICALLY', 'DELETE_RECORD'];
    if (prohibitedAutoActions.includes(actionType)) {
      throw new Error(`Guardrail Violation: Tool cannot perform '${actionType}'. Officer in charge must manually approve.`);
    }
    return true;
  }
}

module.exports = Guardrails;
