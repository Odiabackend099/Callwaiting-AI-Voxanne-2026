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
import { sendSlackAlert } from './slack-alerts';
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

      sendSlackAlert('🚨 Debt Limit Exceeded — Call Not Billed', {
        orgId,
        callId,
        balancePence: rpcResult.current_balance,
        debtLimitPence: rpcResult.debt_limit,
        attemptedPence: rpcResult.attempted_deduction,
        note: 'Org wallet is in debt beyond limit. Auto-recharge may be needed.',
      }).catch(() => {});

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
    log.warn('WalletService', 'Low balance warning', {
      orgId,
      balancePence: rpcResult.balance_after,
      thresholdPence: lowBalanceThresholdPence,
    });
    sendSlackAlert('⚠️ Low Wallet Balance', {
      orgId,
      balancePence: rpcResult.balance_after,
      thresholdPence: lowBalanceThresholdPence,
      note: `Balance £${(rpcResult.balance_after / 100).toFixed(2)} is below the warning threshold.`,
    }).catch(() => {});
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
// Phone Provisioning Deduction
// ============================================

/**
 * Deduct cost for phone number provisioning.
 *
 * PHONE PROVISIONING BILLING:
 * - Fixed cost: 1000 pence ($10.00 at current exchange rate)
 * - Atomic deduction via direct transaction
 * - No idempotency key (provisioning handles retries differently)
 * - Logs to credit_transactions with type 'phone_provisioning'
 *
 * @param orgId - Organization ID
 * @param costPence - Cost in pence (typically 1000 for $10)
 * @param phoneNumber - Phone number being provisioned (for logging)
 * @returns DeductionResult with success/failure status
 */
export async function deductPhoneProvisioningCost(
  orgId: string,
  costPence: number,
  phoneNumber: string
): Promise<DeductionResult> {
  if (costPence <= 0) {
    return { success: false, error: 'Cost must be positive' };
  }

  try {
    // Use a transaction to ensure atomic check + deduct
    // We'll use the add_wallet_credits RPC with a negative amount
    const { data: result, error } = await supabase.rpc('add_wallet_credits', {
      p_org_id: orgId,
      p_amount_pence: -costPence, // Negative for deduction
      p_type: 'phone_provisioning',
      p_stripe_payment_intent_id: null,
      p_stripe_charge_id: null,
      p_description: `Phone number provisioning: ${phoneNumber}`,
      p_created_by: 'system',
    });

    if (error) {
      log.error('WalletService', 'Phone provisioning deduction failed', {
        orgId,
        phoneNumber,
        costPence,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    const rpcResult = result as any;

    if (!rpcResult?.success) {
      log.error('WalletService', 'Phone provisioning deduction returned failure', {
        orgId,
        phoneNumber,
        error: rpcResult?.error,
      });
      return { success: false, error: rpcResult?.error };
    }

    log.info('WalletService', 'Phone provisioning cost deducted', {
      orgId,
      phoneNumber,
      costPence,
      balanceBefore: rpcResult.balance_before,
      balanceAfter: rpcResult.balance_after,
    });

    return {
      success: true,
      transactionId: rpcResult.transaction_id,
      balanceBefore: rpcResult.balance_before,
      balanceAfter: rpcResult.balance_after,
    };
  } catch (err) {
    log.error('WalletService', 'Unexpected error during phone provisioning deduction', {
      orgId,
      phoneNumber,
      error: (err as Error).message,
    });
    return { success: false, error: (err as Error).message };
  }
}

// ============================================
// Atomic Asset Cost Deduction (Phase 1 - TOCTOU Fix)
// ============================================

export interface DeductAssetResult {
  success: boolean;
  duplicate: boolean;
  balanceBefore: number;
  balanceAfter: number;
  transactionId?: string;
  error?: string;
  shortfallPence?: number;
}

/**
 * Atomically check balance and deduct cost for asset purchases.
 *
 * CRITICAL FIX (2026-02-14): Replaces the old checkBalance() + deductPhoneProvisioningCost()
 * pattern which had a TOCTOU race condition allowing double-spending.
 *
 * This function uses a single Postgres RPC with FOR UPDATE lock:
 * 1. Locks the organization row (prevents concurrent reads)
 * 2. Checks balance >= cost (zero-debt policy for assets)
 * 3. Deducts atomically
 * 4. Inserts ledger entry with idempotency protection
 *
 * @param orgId - Organization ID
 * @param costPence - Cost in pence (e.g., 1000 for $10 phone number)
 * @param assetType - Type: 'phone_number', 'did', 'license', 'phone_provisioning'
 * @param description - Human-readable description
 * @param idempotencyKey - Unique key to prevent duplicate charges
 */
export async function deductAssetCost(
  orgId: string,
  costPence: number,
  assetType: 'phone_number' | 'did' | 'license' | 'phone_provisioning',
  description: string,
  idempotencyKey: string
): Promise<DeductAssetResult> {
  const { data, error } = await supabase.rpc('check_balance_and_deduct_asset_cost', {
    p_org_id: orgId,
    p_cost_pence: costPence,
    p_asset_type: assetType,
    p_description: description,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    log.error('WalletService', 'check_balance_and_deduct_asset_cost RPC failed', {
      error: error.message,
      orgId,
      costPence,
      assetType,
    });
    return {
      success: false,
      duplicate: false,
      balanceBefore: 0,
      balanceAfter: 0,
      error: error.message,
    };
  }

  const result = data as any;

  if (!result?.success) {
    const isDuplicate = result?.error === 'duplicate_request';

    if (isDuplicate) {
      log.info('WalletService', 'Duplicate asset deduction detected (idempotent)', {
        orgId,
        idempotencyKey,
      });
    } else {
      log.warn('WalletService', 'Asset deduction rejected', {
        orgId,
        error: result?.error,
        balancePence: result?.balance_pence,
        requiredPence: result?.required_pence,
        shortfallPence: result?.shortfall_pence,
      });
      sendSlackAlert('🚫 Asset Purchase Rejected — Insufficient Funds', {
        orgId,
        assetType,
        balancePence: result?.balance_pence,
        requiredPence: result?.required_pence,
        shortfallPence: result?.shortfall_pence,
        note: `Org tried to purchase ${assetType} but wallet balance is too low.`,
      }).catch(() => {});
    }

    return {
      success: false,
      duplicate: isDuplicate,
      balanceBefore: result?.balance_pence || 0,
      balanceAfter: result?.balance_pence || 0,
      error: result?.error,
      shortfallPence: result?.shortfall_pence,
    };
  }

  log.info('WalletService', 'Asset cost deducted atomically', {
    orgId,
    costPence,
    assetType,
    idempotencyKey,
    balanceBefore: result.balance_before_pence,
    balanceAfter: result.balance_after_pence,
    transactionId: result.transaction_id,
  });

  return {
    success: true,
    duplicate: false,
    balanceBefore: result.balance_before_pence,
    balanceAfter: result.balance_after_pence,
    transactionId: result.transaction_id,
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

// ============================================
// Phase 2: Credit Reservation Pattern
// ============================================

export interface ReservationResult {
  success: boolean;
  duplicate: boolean;
  reservationId?: string;
  reservedPence?: number;
  balancePence?: number;
  effectiveBalancePence?: number;
  activeReservationsPence?: number;
  error?: string;
}

export interface CommitResult {
  success: boolean;
  duplicate: boolean;
  transactionId?: string;
  reservedPence?: number;
  actualCostPence?: number;
  releasedPence?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  actualMinutes?: number;
  durationSeconds?: number;
  error?: string;
  fallbackToDirectBilling?: boolean;
}

/**
 * Reserve credits for an incoming call (authorize phase).
 * Called at assistant-request webhook to hold estimated cost.
 */
export async function reserveCallCredits(
  orgId: string,
  callId: string,
  vapiCallId: string,
  estimatedMinutes: number = 5
): Promise<ReservationResult> {
  const { data, error } = await supabase.rpc('reserve_call_credits', {
    p_org_id: orgId,
    p_call_id: callId,
    p_vapi_call_id: vapiCallId,
    p_estimated_minutes: estimatedMinutes,
  });

  if (error) {
    log.error('WalletService', 'reserve_call_credits RPC failed', {
      error: error.message, orgId, callId,
    });
    return { success: false, duplicate: false, error: error.message };
  }

  const result = data as any;

  if (!result?.success) {
    log.warn('WalletService', 'Credit reservation rejected', {
      orgId, callId, error: result?.error,
      effectiveBalance: result?.effective_balance_pence,
    });
    return {
      success: false,
      duplicate: false,
      balancePence: result?.balance_pence,
      effectiveBalancePence: result?.effective_balance_pence,
      error: result?.error,
    };
  }

  log.info('WalletService', 'Credits reserved for call', {
    orgId, callId,
    reservedPence: result.reserved_pence,
    reservationId: result.reservation_id,
    duplicate: result.duplicate,
  });

  return {
    success: true,
    duplicate: result.duplicate || false,
    reservationId: result.reservation_id,
    reservedPence: result.reserved_pence,
    balancePence: result.balance_pence,
    effectiveBalancePence: result.effective_balance_pence,
    activeReservationsPence: result.active_reservations_pence,
  };
}

/**
 * Commit reserved credits after call ends (capture phase).
 * Charges actual usage and releases unused portion.
 */
export async function commitReservedCredits(
  callId: string,
  actualDurationSeconds: number
): Promise<CommitResult> {
  const { data, error } = await supabase.rpc('commit_reserved_credits', {
    p_call_id: callId,
    p_actual_duration_seconds: actualDurationSeconds,
  });

  if (error) {
    log.error('WalletService', 'commit_reserved_credits RPC failed', {
      error: error.message, callId,
    });
    return { success: false, duplicate: false, error: error.message };
  }

  const result = data as any;

  if (!result?.success) {
    log.warn('WalletService', 'Commit failed — fallback to direct billing', {
      callId, error: result?.error,
    });
    return {
      success: false,
      duplicate: false,
      error: result?.error,
      fallbackToDirectBilling: result?.fallback_to_direct_billing || false,
    };
  }

  log.info('WalletService', 'Reserved credits committed', {
    callId,
    reserved: result.reserved_pence,
    actual: result.actual_cost_pence,
    released: result.released_pence,
    balanceAfter: result.balance_after_pence,
  });

  return {
    success: true,
    duplicate: result.duplicate || false,
    transactionId: result.transaction_id,
    reservedPence: result.reserved_pence,
    actualCostPence: result.actual_cost_pence,
    releasedPence: result.released_pence,
    balanceBefore: result.balance_before_pence,
    balanceAfter: result.balance_after_pence,
    actualMinutes: result.actual_minutes,
    durationSeconds: result.duration_seconds,
  };
}

/**
 * Get active reservation for a call (used by kill switch).
 */
export async function getActiveReservation(callId: string) {
  const { data, error } = await supabase
    .from('credit_reservations')
    .select('*')
    .eq('call_id', callId)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return data;
}
