/**
 * Billing Manager Service
 *
 * Fixed-rate prepaid billing: $0.70/min flat rate (presented as 10 credits/min to customers).
 * Routes to deductCallCredits() in wallet-service for atomic deduction.
 */

import { log } from './logger';
import { deductCallCredits } from './wallet-service';

// ============================================
// Prepaid Credit Ledger Billing
// ============================================

/**
 * Process call billing using the prepaid credit ledger.
 * Routes to deductCallCredits() from wallet-service.
 * Called from webhook handlers as a non-blocking side-effect.
 *
 * FIXED-RATE BILLING MODEL (2026-02-08):
 * - Billing driven by duration at $0.70/min flat rate
 * - Skip condition: duration <= 0 (NOT cost === 0)
 * - Guard: Prepaid billing is exclusive (processCallUsage() should not run)
 *
 * @param orgId - Organization ID
 * @param callId - Internal call ID
 * @param vapiCallId - Vapi call ID
 * @param durationSeconds - Call duration (drives billing)
 * @param vapiCostDollars - Vapi's reported cost in USD (kept for profit tracking)
 * @param costBreakdown - Vapi's cost breakdown (from call.costs)
 */
export async function processCallBilling(
  orgId: string,
  callId: string,
  vapiCallId: string,
  durationSeconds: number,
  vapiCostDollars: number | null,
  costBreakdown: Record<string, any> | null
): Promise<void> {
  // Step 3b: Skip condition changed to duration (not cost)
  if (!durationSeconds || durationSeconds <= 0) {
    log.debug('BillingManager', 'Zero-duration call, skipping prepaid billing', {
      orgId,
      callId,
      vapiCostDollars,
    });
    return;
  }

  // Step 3c: Guard against dual billing (Agent Team Finding #4)
  // CRITICAL: Fixed-rate prepaid billing is the ONLY billing model.

  const result = await deductCallCredits(
    orgId,
    callId,
    vapiCallId,
    durationSeconds, // Duration now drives billing
    vapiCostDollars || 0, // Kept for profit tracking only
    costBreakdown
  );

  if (!result.success && !result.duplicate) {
    log.error('BillingManager', 'Prepaid billing deduction failed', {
      orgId,
      callId,
      error: result.error,
    });
  }
}
