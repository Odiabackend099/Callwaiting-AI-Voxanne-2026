/**
 * @ai-invariant DO NOT REMOVE OR WEAKEN THIS VALIDATION.
 *
 * Pre-flight assertion for outbound calls. Called inside VapiClient.createOutboundCall()
 * so every call site in the codebase is protected automatically.
 *
 * This exists because the outbound call flow broke in production when:
 *   - phoneNumberId was null (not synced to agents table)
 *   - phoneNumberId was a raw phone string (+1...) instead of a Vapi UUID
 *   - assistantId was null (agent not synced to Vapi)
 *
 * See: .claude/CLAUDE.md "CRITICAL INVARIANTS" section for full context.
 */

export function assertOutboundCallReady(params: {
  assistantId: string | null | undefined;
  phoneNumberId: string | null | undefined;
  customerNumber: string | null | undefined;
}): void {
  if (!params.assistantId) {
    throw new Error(
      'PREFLIGHT: assistantId is required for outbound calls. ' +
      'Ensure the outbound agent has been saved and synced to Vapi via Agent Configuration.'
    );
  }

  if (!params.phoneNumberId) {
    throw new Error(
      'PREFLIGHT: phoneNumberId is required for outbound calls. ' +
      'Ensure a Twilio number is imported in Settings > Telephony and the outbound agent has been saved.'
    );
  }

  // Vapi expects a UUID like "abc123-def456", NOT a raw E.164 phone number like "+12125551234"
  if (params.phoneNumberId.startsWith('+')) {
    throw new Error(
      'PREFLIGHT: phoneNumberId must be a Vapi UUID, not a raw phone number like ' +
      params.phoneNumberId.slice(0, 4) + '****. ' +
      'Use resolveOrgPhoneNumberId() to get the correct Vapi phone number ID.'
    );
  }

  if (!params.customerNumber) {
    throw new Error(
      'PREFLIGHT: customer phone number is required for outbound calls.'
    );
  }
}
