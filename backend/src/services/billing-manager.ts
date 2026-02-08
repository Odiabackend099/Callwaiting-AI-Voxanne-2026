/**
 * Billing Manager Service
 *
 * Core billing logic for Voxanne's usage-based billing engine.
 * Handles call usage tracking, overage calculation, and Stripe reporting.
 *
 * Financial Integrity Rules:
 * - All money in integer pence (no floating point)
 * - Minutes rounded UP via Math.ceil(seconds / 60)
 * - Idempotency via UNIQUE(call_id) in usage_ledger
 * - Atomic DB writes via record_call_usage() RPC with FOR UPDATE lock
 */

import { Job } from 'bullmq';
import { supabase } from './supabase-client';
import { getStripeClient } from '../config/stripe';
import { enqueueBillingJob, BillingJobData } from '../config/billing-queue';
import { log } from './logger';
import { deductCallCredits } from './wallet-service';

// ============================================
// Types
// ============================================

export interface BillingCalculation {
  billableMinutes: number;
  isOverage: boolean;
  overageMinutes: number;
  overagePence: number;
}

interface OrgBillingData {
  id: string;
  billing_plan: string;
  included_minutes: number;
  minutes_used: number;
  overage_rate_pence: number;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_subscription_item_id: string | null;
}

// ============================================
// Pure Functions (no side effects, easy to test)
// ============================================

/**
 * Calculate billing for a single call.
 *
 * Three cases:
 * - Case A: Call entirely within allowance → no overage
 * - Case B: Call crosses the boundary → partial overage
 * - Case C: Already over limit → full call is overage
 *
 * @param durationSeconds - Raw call duration in seconds
 * @param minutesUsedBefore - Minutes already used this period
 * @param includedMinutes - Total allowance for the period
 * @param overageRatePence - Cost per overage minute in pence
 */
export function calculateBilling(
  durationSeconds: number,
  minutesUsedBefore: number,
  includedMinutes: number,
  overageRatePence: number
): BillingCalculation {
  // Round up to nearest whole minute
  const billableMinutes = Math.ceil(durationSeconds / 60);

  if (billableMinutes <= 0) {
    return {
      billableMinutes: 0,
      isOverage: false,
      overageMinutes: 0,
      overagePence: 0,
    };
  }

  const minutesAfter = minutesUsedBefore + billableMinutes;

  // Case A: Entirely within allowance
  if (minutesAfter <= includedMinutes) {
    return {
      billableMinutes,
      isOverage: false,
      overageMinutes: 0,
      overagePence: 0,
    };
  }

  // Case C: Already over limit — full call is overage
  if (minutesUsedBefore >= includedMinutes) {
    const overagePence = billableMinutes * overageRatePence;
    return {
      billableMinutes,
      isOverage: true,
      overageMinutes: billableMinutes,
      overagePence,
    };
  }

  // Case B: Crossing the boundary — partial overage
  const overageMinutes = minutesAfter - includedMinutes;
  const overagePence = overageMinutes * overageRatePence;
  return {
    billableMinutes,
    isOverage: true,
    overageMinutes,
    overagePence,
  };
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Process call usage for billing.
 * Called from handleEndOfCallReport() as a non-blocking side-effect.
 *
 * 1. Fetches org billing data
 * 2. Calculates overage
 * 3. Atomically writes to DB (usage_ledger + organizations.minutes_used)
 * 4. Enqueues Stripe reporting if overage exists
 */
export async function processCallUsage(
  orgId: string,
  callId: string,
  vapiCallId: string,
  durationSeconds: number
): Promise<void> {
  // Fetch org billing data
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select(
      'id, billing_plan, included_minutes, minutes_used, overage_rate_pence, ' +
      'current_period_start, current_period_end, stripe_subscription_item_id'
    )
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    log.error('BillingManager', 'Failed to fetch org billing data', {
      orgId,
      error: orgError?.message,
    });
    return;
  }

  const billingData = org as OrgBillingData;

  // Skip if org is not on a paid plan
  if (billingData.billing_plan === 'none') {
    log.debug('BillingManager', 'Org not on paid plan, skipping billing', { orgId });
    return;
  }

  // Warn if billing period is not set (but still process)
  if (!billingData.current_period_start || !billingData.current_period_end) {
    log.warn('BillingManager', 'Org has no active billing period', { orgId });
  }

  // Calculate billing
  const billing = calculateBilling(
    durationSeconds,
    billingData.minutes_used,
    billingData.included_minutes,
    billingData.overage_rate_pence
  );

  if (billing.billableMinutes <= 0) {
    log.debug('BillingManager', 'Zero-duration call, no billing', { orgId, callId });
    return;
  }

  // Atomic DB write: usage_ledger + organizations.minutes_used
  const { data: rpcResult, error: rpcError } = await supabase.rpc('record_call_usage', {
    p_org_id: orgId,
    p_call_id: callId,
    p_vapi_call_id: vapiCallId,
    p_duration_seconds: durationSeconds,
    p_billable_minutes: billing.billableMinutes,
    p_is_overage: billing.isOverage,
    p_overage_pence: billing.overagePence,
  });

  if (rpcError) {
    log.error('BillingManager', 'Failed to record call usage', {
      orgId,
      callId,
      error: rpcError.message,
    });
    throw new Error(`record_call_usage RPC failed: ${rpcError.message}`);
  }

  const result = rpcResult as any;

  // Handle idempotent duplicate
  if (result?.duplicate) {
    log.info('BillingManager', 'Call already billed (idempotent)', { orgId, callId });
    return;
  }

  if (!result?.success) {
    log.error('BillingManager', 'record_call_usage returned failure', {
      orgId,
      callId,
      error: result?.error,
    });
    return;
  }

  log.info('BillingManager', 'Call usage recorded', {
    orgId,
    callId,
    durationSeconds,
    billableMinutes: billing.billableMinutes,
    minutesBefore: result.minutes_before,
    minutesAfter: result.minutes_after,
    isOverage: billing.isOverage,
    overageMinutes: billing.overageMinutes,
    overagePence: billing.overagePence,
  });

  // If overage, enqueue Stripe reporting
  if (billing.isOverage && billing.overageMinutes > 0 && billingData.stripe_subscription_item_id) {
    await enqueueBillingJob({
      orgId,
      ledgerId: result.ledger_id,
      subscriptionItemId: billingData.stripe_subscription_item_id,
      overageMinutes: billing.overageMinutes,
      callId,
    });
  } else if (billing.isOverage && !billingData.stripe_subscription_item_id) {
    log.warn('BillingManager', 'Overage detected but no stripe_subscription_item_id', {
      orgId,
      callId,
      overageMinutes: billing.overageMinutes,
    });
  }
}

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
  // processCallUsage() (subscription overage billing) is deprecated.
  // If both functions are called from webhook, this path takes priority.

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

// ============================================
// BullMQ Worker Processor
// ============================================

/**
 * BullMQ worker callback: reports overage minutes to Stripe.
 * Called by the billing-stripe-reporting queue worker.
 */
export async function processBillingJob(job: Job<BillingJobData>): Promise<void> {
  const { orgId, ledgerId, subscriptionItemId, overageMinutes, callId } = job.data;

  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe client not initialized');
  }

  log.info('BillingManager', 'Reporting overage to Stripe', {
    orgId,
    callId,
    overageMinutes,
    subscriptionItemId,
    attempt: job.attemptsMade + 1,
  });

  // Create usage record on the metered subscription item
  const usageRecord = await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    {
      quantity: overageMinutes,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    },
    {
      idempotencyKey: `usage-${callId}`,
    }
  );

  // Mark as reported in usage_ledger
  const { error: updateError } = await supabase
    .from('usage_ledger')
    .update({
      stripe_reported: true,
      stripe_usage_record_id: usageRecord.id,
      stripe_reported_at: new Date().toISOString(),
    })
    .eq('id', ledgerId);

  if (updateError) {
    // Non-fatal: the Stripe record was created, we just failed to mark it
    log.warn('BillingManager', 'Failed to mark usage as reported', {
      orgId,
      ledgerId,
      error: updateError.message,
    });
  }

  log.info('BillingManager', 'Overage reported to Stripe', {
    orgId,
    callId,
    overageMinutes,
    stripeUsageRecordId: usageRecord.id,
  });
}
