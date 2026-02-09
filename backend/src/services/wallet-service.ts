/**
 * Wallet Service
 *
 * Core logic for the Pre-Paid Credit Ledger billing model.
 * Handles balance checks, credit deductions, top-ups, and summaries.
 *
 * Financial Integrity Rules:
 * - All amounts in integer pence (GBP, no floating point)
 * - Vapi costs (USD) converted to GBP pence via USD_TO_GBP_RATE
 * - Fixed-rate billing: $0.70/min flat rate for all orgs
 * - Atomic writes via Postgres FOR UPDATE lock in RPC functions
 * - Idempotency via UNIQUE(call_id) in credit_transactions
 */

import { supabase } from './supabase-client';
import { log } from './logger';
import { enqueueAutoRechargeJob } from '../config/wallet-queue';
import { config } from '../config';

// ============================================
// Types
// ============================================

export interface WalletBalance {
  balancePence: number;
  lowBalancePence: number;
  isLowBalance: boolean;
  autoRechargeEnabled: boolean;
  hasPaymentMethod: boolean;
}

export interface DeductionResult {
  success: boolean;
  duplicate?: boolean;
  transactionId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  clientChargedPence?: number;
  providerCostPence?: number;
  grossProfitPence?: number;
  needsRecharge?: boolean;
  error?: string;
}

export interface TopUpResult {
  success: boolean;
  transactionId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  amountAdded?: number;
  error?: string;
}

// ============================================
// Constants
// ============================================

/** USD to GBP exchange rate. Use config constant for consistency. */
const USD_TO_GBP_RATE = parseFloat(config.USD_TO_GBP_RATE);

/** Minimum wallet balance (pence) required to start a call. Updated to 79p ($1.00) for fixed-rate billing. */
const MIN_BALANCE_FOR_CALL = config.WALLET_MIN_BALANCE_FOR_CALL;

// ============================================
// Pure Functions
// ============================================

/**
 * Convert Vapi cost (USD dollars) to GBP pence.
 * Always rounds UP to avoid undercharging.
 */
export function usdToPence(usdDollars: number): number {
  if (usdDollars <= 0) return 0;
  return Math.ceil(usdDollars * USD_TO_GBP_RATE * 100);
}

/**
 * Fixed-rate charge: per-second precision, rounds UP to nearest cent.
 * Formula: Math.ceil((durationSeconds / 60) * ratePerMinuteCents)
 * Then converts to pence for internal storage.
 *
 * INTENTIONAL DOUBLE ROUNDING (Agent Team Finding #5):
 * - Step 1: Round seconds→cents UP (prevents undercharging in USD)
 * - Step 2: Round cents→pence UP (prevents undercharging in GBP)
 * - Maximum overcharge: ~$0.02 per call (industry standard, protects platform)
 *
 * Examples at $0.70/min (rate=70, 10 credits/min):
 *   30s  → ceil(0.5  * 70) = 35 cents → ceil(35 * 0.79) = 28p (5 credits)
 *   60s  → ceil(1.0  * 70) = 70 cents → ceil(70 * 0.79) = 56p (10 credits)
 *   91s  → ceil(1.517 * 70) = 107 cents → ceil(107 * 0.79) = 85p (16 credits)
 *   1s   → ceil(0.0167 * 70) = 2 cents → ceil(2 * 0.79) = 2p (1 credit)
 */
export function calculateFixedRateCharge(
  durationSeconds: number,
  ratePerMinuteCents: number = config.RATE_PER_MINUTE_USD_CENTS
): { usdCents: number; pence: number } {
  if (durationSeconds <= 0 || ratePerMinuteCents <= 0) return { usdCents: 0, pence: 0 };

  const usdCents = Math.ceil((durationSeconds / 60) * ratePerMinuteCents);
  const pence = Math.ceil(usdCents * parseFloat(config.USD_TO_GBP_RATE));

  return { usdCents, pence };
}

// ============================================
// Balance Check (for call authorization gate)
// ============================================

/**
 * Check wallet balance for an organization.
 * Single indexed query, <50ms. Used before starting calls.
 */
export async function checkBalance(orgId: string): Promise<WalletBalance | null> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select(
      'wallet_balance_pence, wallet_low_balance_pence, ' +
      'wallet_auto_recharge, stripe_default_pm_id'
    )
    .eq('id', orgId)
    .single();

  if (error || !org) {
    log.error('WalletService', 'Failed to check balance', {
      orgId,
      error: error?.message,
    });
    return null;
  }

  const o = org as any;
  return {
    balancePence: o.wallet_balance_pence ?? 0,
    lowBalancePence: o.wallet_low_balance_pence ?? 500,
    isLowBalance: (o.wallet_balance_pence ?? 0) <= (o.wallet_low_balance_pence ?? 500),
    autoRechargeEnabled: o.wallet_auto_recharge ?? false,
    hasPaymentMethod: !!o.stripe_default_pm_id,
  };
}

/**
 * Check if an org has enough balance to start a call.
 * Returns true if balance >= MIN_BALANCE_FOR_CALL (79p ≈ $1.00 at $0.70/min rate).
 */
export async function hasEnoughBalance(orgId: string): Promise<boolean> {
  const balance = await checkBalance(orgId);
  if (!balance) return false;
  return balance.balancePence >= MIN_BALANCE_FOR_CALL;
}

// ============================================
// Credit Deduction (after call ends)
// ============================================

/**
 * Deduct credits from wallet after a call ends.
 *
 * FIXED-RATE BILLING MODEL (2026-02-08):
 * 1. Calculates charge based on duration at fixed $0.70/min rate
 * 2. Converts USD cents to GBP pence
 * 3. Atomic deduction via deduct_call_credits() RPC
 * 4. Enqueues auto-recharge if balance drops below threshold
 * 5. Sends low balance warning email if needed
 *
 * CRITICAL: Does NOT read wallet_markup_percent from org (Agent Team Finding #1).
 * The fixed rate is the ONLY billing input, regardless of telephony mode.
 *
 * @param durationSeconds - Call duration (drives billing)
 * @param vapiCostDollars - Vapi cost (kept for profit tracking only)
 */
export async function deductCallCredits(
  orgId: string,
  callId: string,
  vapiCallId: string,
  durationSeconds: number,
  vapiCostDollars: number,
  costBreakdown: Record<string, any> | null
): Promise<DeductionResult> {
  // Skip zero-duration calls (Step 2d: skip condition based on duration)
  if (!durationSeconds || durationSeconds <= 0) {
    log.debug('WalletService', 'Zero-duration call, skipping deduction', { orgId, callId });
    return { success: true };
  }

  // Calculate fixed-rate charge (Step 2a, 2b)
  const { usdCents, pence: clientChargedPence } = calculateFixedRateCharge(
    durationSeconds,
    config.RATE_PER_MINUTE_USD_CENTS
  );

  if (clientChargedPence <= 0) {
    log.debug('WalletService', 'Calculated charge is zero, skipping', { orgId, callId });
    return { success: true };
  }

  // Convert Vapi cost to pence (for profit tracking only)
  const providerCostPence = usdToPence(vapiCostDollars);

  // Augment cost breakdown with fixed-rate billing metadata (Step 2b)
  const enhancedCostBreakdown = {
    ...(costBreakdown || {}),
    billing_model: 'fixed_rate',
    rate_cents: config.RATE_PER_MINUTE_USD_CENTS,
    duration_seconds: durationSeconds,
    usd_charged: usdCents,
    gbp_charged: clientChargedPence,
  };

  // Atomic deduction via RPC (Step 2b: p_markup_percent: 0)
  const { data: result, error: rpcError } = await supabase.rpc('deduct_call_credits', {
    p_org_id: orgId,
    p_call_id: callId,
    p_vapi_call_id: vapiCallId,
    p_provider_cost_pence: providerCostPence,
    p_markup_percent: 0, // Fixed-rate model has no markup
    p_client_charged_pence: clientChargedPence,
    p_cost_breakdown: enhancedCostBreakdown,
    p_description: `Call ${callId} | ${Math.ceil(durationSeconds / 60 * 10)} credits × ${durationSeconds}s = ${clientChargedPence}p`,
  });

  if (rpcError) {
    log.error('WalletService', 'deduct_call_credits RPC failed', {
      orgId,
      callId,
      error: rpcError.message,
    });
    return { success: false, error: rpcError.message };
  }

  const rpcResult = result as any;

  // Handle idempotent duplicate
  if (rpcResult?.duplicate) {
    log.info('WalletService', 'Call already billed (idempotent)', { orgId, callId });
    return { success: true, duplicate: true };
  }

  if (!rpcResult?.success) {
    // Handle debt limit exceeded error gracefully
    if (rpcResult?.error === 'debt_limit_exceeded') {
      log.error('WalletService', 'Debt limit exceeded - call charge blocked', {
        orgId,
        callId,
        currentBalance: rpcResult.current_balance,
        debtLimit: rpcResult.debt_limit,
        attemptedDeduction: rpcResult.attempted_deduction,
        newBalanceWouldBe: rpcResult.new_balance_would_be,
        amountOverLimit: rpcResult.amount_over_limit,
        message: rpcResult.message,
      });

      // Trigger auto-recharge immediately if configured
      const balance = await checkBalance(orgId);
      if (balance?.autoRechargeEnabled && balance?.hasPaymentMethod) {
        log.info('WalletService', 'Triggering auto-recharge due to debt limit', { orgId });
        try {
          await enqueueAutoRechargeJob({ orgId });
        } catch (err) {
          log.warn('WalletService', 'Failed to enqueue auto-recharge for debt limit', {
            orgId,
            error: (err as Error).message,
          });
        }
      }

      return {
        success: false,
        error: 'debt_limit_exceeded',
        balanceBefore: rpcResult.current_balance,
        needsRecharge: true,
      };
    }

    log.error('WalletService', 'deduct_call_credits returned failure', {
      orgId,
      callId,
      error: rpcResult?.error,
    });
    return { success: false, error: rpcResult?.error };
  }

  log.info('WalletService', 'Credits deducted (fixed-rate billing)', {
    orgId,
    callId,
    durationSeconds,
    usdCents,
    clientChargedPence,
    providerCostPence,
    grossProfitPence: rpcResult.gross_profit_pence,
    balanceBefore: rpcResult.balance_before,
    balanceAfter: rpcResult.balance_after,
    needsRecharge: rpcResult.needs_recharge,
  });

  // Step 2e: Low balance email warning (fire and forget)
  const lowBalanceThresholdPence = Math.ceil(
    config.WALLET_LOW_BALANCE_WARNING_CENTS * parseFloat(config.USD_TO_GBP_RATE)
  );
  if (rpcResult.balance_after < lowBalanceThresholdPence) {
    try {
      // TODO: Implement sendLowBalanceWarning(orgId, rpcResult.balance_after)
      // Non-blocking email via Resend API
      log.warn('WalletService', 'Low balance warning needed', {
        orgId,
        balancePence: rpcResult.balance_after,
        thresholdPence: lowBalanceThresholdPence,
      });
    } catch (err) {
      log.warn('WalletService', 'Failed to send low balance email (non-blocking)', {
        orgId,
        error: (err as Error).message,
      });
    }
  }

  // Trigger auto-recharge if needed
  if (rpcResult.needs_recharge) {
    try {
      await enqueueAutoRechargeJob({ orgId });
    } catch (err) {
      log.warn('WalletService', 'Failed to enqueue auto-recharge (non-blocking)', {
        orgId,
        error: (err as Error).message,
      });
    }
  }

  return {
    success: true,
    transactionId: rpcResult.transaction_id,
    balanceBefore: rpcResult.balance_before,
    balanceAfter: rpcResult.balance_after,
    clientChargedPence: rpcResult.client_charged_pence,
    providerCostPence: rpcResult.provider_cost_pence,
    grossProfitPence: rpcResult.gross_profit_pence,
    needsRecharge: rpcResult.needs_recharge,
  };
}

// ============================================
// Add Credits (top-up / refund / bonus)
// ============================================

/**
 * Add credits to an organization's wallet.
 */
export async function addCredits(
  orgId: string,
  amountPence: number,
  type: 'topup' | 'refund' | 'adjustment' | 'bonus',
  stripePaymentIntentId?: string,
  stripeChargeId?: string,
  description?: string,
  createdBy?: string
): Promise<TopUpResult> {
  if (amountPence <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }

  const { data: result, error } = await supabase.rpc('add_wallet_credits', {
    p_org_id: orgId,
    p_amount_pence: amountPence,
    p_type: type,
    p_stripe_payment_intent_id: stripePaymentIntentId || null,
    p_stripe_charge_id: stripeChargeId || null,
    p_description: description || `${type}: ${amountPence}p`,
    p_created_by: createdBy || 'system',
  });

  if (error) {
    log.error('WalletService', 'add_wallet_credits RPC failed', {
      orgId,
      amountPence,
      type,
      error: error.message,
    });
    return { success: false, error: error.message };
  }

  const rpcResult = result as any;

  if (!rpcResult?.success) {
    return { success: false, error: rpcResult?.error };
  }

  log.info('WalletService', 'Credits added', {
    orgId,
    amountPence,
    type,
    balanceBefore: rpcResult.balance_before,
    balanceAfter: rpcResult.balance_after,
    stripePaymentIntentId,
  });

  return {
    success: true,
    transactionId: rpcResult.transaction_id,
    balanceBefore: rpcResult.balance_before,
    balanceAfter: rpcResult.balance_after,
    amountAdded: rpcResult.amount_added,
  };
}

// ============================================
// Wallet Summary (for dashboard)
// ============================================

/**
 * Get full wallet summary for an organization.
 */
export async function getWalletSummary(orgId: string): Promise<any> {
  const { data: result, error } = await supabase.rpc('get_wallet_summary', {
    p_org_id: orgId,
  });

  if (error) {
    log.error('WalletService', 'get_wallet_summary RPC failed', {
      orgId,
      error: error.message,
    });
    return null;
  }

  return result;
}
