/**
 * Billing API Routes
 *
 * Frontend-facing endpoints for billing state, usage, and Stripe Checkout/Portal.
 * All endpoints require JWT authentication. org_id derived from token.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getStripeClient } from '../config/stripe';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import { checkBalance, getWalletSummary } from '../services/wallet-service';
import { config } from '../config';

interface OrgUsageRow {
  billing_plan: string;
  included_minutes: number;
  minutes_used: number;
  overage_rate_pence: number;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_currency: string;
}

interface OrgPlanRow {
  billing_plan: string;
  included_minutes: number;
  overage_rate_pence: number;
  setup_fee_paid: boolean;
  billing_currency: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface OrgCheckoutRow {
  stripe_customer_id: string | null;
  name: string | null;
}

const router = Router();

// Tier configuration for checkout
const TIER_PRICES: Record<string, {
  recurringPriceEnv: string;
  overagePriceEnv: string;
  setupPriceEnv: string;
  includedMinutes: number;
  overageRatePence: number;
}> = {
  starter: {
    recurringPriceEnv: 'STRIPE_STARTER_PRICE_ID',
    overagePriceEnv: 'STRIPE_STARTER_OVERAGE_PRICE_ID',
    setupPriceEnv: 'STRIPE_STARTER_SETUP_PRICE_ID',
    includedMinutes: 400,
    overageRatePence: 45,
  },
  professional: {
    recurringPriceEnv: 'STRIPE_PROFESSIONAL_PRICE_ID',
    overagePriceEnv: 'STRIPE_PROFESSIONAL_OVERAGE_PRICE_ID',
    setupPriceEnv: 'STRIPE_PROFESSIONAL_SETUP_PRICE_ID',
    includedMinutes: 1200,
    overageRatePence: 40,
  },
  enterprise: {
    recurringPriceEnv: 'STRIPE_ENTERPRISE_PRICE_ID',
    overagePriceEnv: 'STRIPE_ENTERPRISE_OVERAGE_PRICE_ID',
    setupPriceEnv: 'STRIPE_ENTERPRISE_SETUP_PRICE_ID',
    includedMinutes: 2000,
    overageRatePence: 35,
  },
};

/**
 * GET /api/billing/usage
 * Returns current period usage breakdown for the authenticated org.
 */
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: org, error } = await supabase
      .from('organizations')
      .select(
        'billing_plan, included_minutes, minutes_used, overage_rate_pence, ' +
        'current_period_start, current_period_end, billing_currency'
      )
      .eq('id', orgId)
      .single();

    if (error || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const o = org as unknown as OrgUsageRow;
    const minutesRemaining = Math.max(0, o.included_minutes - o.minutes_used);
    const overageMinutes = Math.max(0, o.minutes_used - o.included_minutes);
    const overageCostPence = overageMinutes * o.overage_rate_pence;

    res.json({
      billing_plan: o.billing_plan,
      included_minutes: o.included_minutes,
      minutes_used: o.minutes_used,
      minutes_remaining: minutesRemaining,
      overage_minutes: overageMinutes,
      overage_rate_pence: o.overage_rate_pence,
      overage_cost_pence: overageCostPence,
      overage_cost_formatted: `£${(overageCostPence / 100).toFixed(2)}`,
      current_period_start: o.current_period_start,
      current_period_end: o.current_period_end,
      currency: o.billing_currency,
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error fetching usage', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/history
 * Returns paginated usage_ledger entries for the authenticated org.
 * Query params: page (default 1), limit (default 50, max 100)
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const { data: entries, error, count } = await supabase
      .from('usage_ledger')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      log.error('BillingAPI', 'Error fetching usage history', { error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      entries: entries || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error fetching history', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/plan
 * Returns current plan details for the authenticated org.
 */
router.get('/plan', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: org, error } = await supabase
      .from('organizations')
      .select(
        'billing_plan, included_minutes, overage_rate_pence, ' +
        'setup_fee_paid, billing_currency, stripe_customer_id, stripe_subscription_id'
      )
      .eq('id', orgId)
      .single();

    if (error || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const p = org as unknown as OrgPlanRow;
    res.json({
      billing_plan: p.billing_plan,
      included_minutes: p.included_minutes,
      overage_rate_pence: p.overage_rate_pence,
      overage_rate_formatted: `£${(p.overage_rate_pence / 100).toFixed(2)}`,
      setup_fee_paid: p.setup_fee_paid,
      currency: p.billing_currency,
      has_stripe_customer: !!p.stripe_customer_id,
      has_subscription: !!p.stripe_subscription_id,
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error fetching plan', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout session for subscription onboarding.
 * Body: { tier: 'starter' | 'professional' | 'enterprise', includeSetupFee?: boolean }
 */
router.post('/create-checkout-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Billing not configured' });
    }

    const { tier, includeSetupFee = true } = req.body;

    if (!tier || !TIER_PRICES[tier]) {
      return res.status(400).json({ error: 'Invalid tier. Must be starter, professional, or enterprise' });
    }

    const tierConfig = TIER_PRICES[tier];
    const recurringPriceId = process.env[tierConfig.recurringPriceEnv];
    const overagePriceId = process.env[tierConfig.overagePriceEnv];
    const setupPriceId = process.env[tierConfig.setupPriceEnv];

    if (!recurringPriceId || !overagePriceId) {
      return res.status(503).json({ error: 'Stripe prices not configured for this tier' });
    }

    // Look up or create Stripe customer
    const { data: orgData } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', orgId)
      .single();

    const checkoutOrg = orgData as unknown as OrgCheckoutRow | null;
    let customerId = checkoutOrg?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          org_id: orgId,
          voxanne_tier: tier,
        },
        name: checkoutOrg?.name || undefined,
      });
      customerId = customer.id;

      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId);
    }

    // Build line items
    const lineItems: any[] = [
      {
        price: recurringPriceId,
        quantity: 1,
      },
      {
        price: overagePriceId,
      },
    ];

    // Add setup fee if applicable
    if (includeSetupFee && setupPriceId && !checkoutOrg?.stripe_customer_id) {
      lineItems.push({
        price: setupPriceId,
        quantity: 1,
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      subscription_data: {
        metadata: {
          org_id: orgId,
          voxanne_tier: tier,
        },
      },
      success_url: `${frontendUrl}/dashboard?billing=success`,
      cancel_url: `${frontendUrl}/dashboard?billing=canceled`,
      metadata: {
        org_id: orgId,
        voxanne_tier: tier,
      },
    });

    log.info('BillingAPI', 'Checkout session created', {
      orgId,
      tier,
      sessionId: session.id,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    log.error('BillingAPI', 'Error creating checkout session', { error: error.message });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Creates a Stripe Customer Portal session for subscription management.
 */
router.post('/create-portal-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Billing not configured' });
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single();

    if (!org?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001';

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${frontendUrl}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    log.error('BillingAPI', 'Error creating portal session', { error: error.message });
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ============================================
// Wallet (Prepaid Credit) Endpoints
// ============================================

/**
 * GET /api/billing/wallet
 * Returns wallet balance, config, and spend summary.
 */
router.get('/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const balance = await checkBalance(orgId);
    if (!balance) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const summary = await getWalletSummary(orgId);

    // Fixed-rate billing constants
    const USD_TO_GBP_RATE = parseFloat(config.USD_TO_GBP_RATE || '0.79');
    const RATE_PER_MINUTE_USD_CENTS = config.RATE_PER_MINUTE_USD_CENTS || 70;
    const pencePerMinute = Math.ceil(RATE_PER_MINUTE_USD_CENTS * USD_TO_GBP_RATE); // 56p

    res.json({
      // Existing fields (backward compatibility)
      balance_pence: balance.balancePence,
      balance_formatted: `£${(balance.balancePence / 100).toFixed(2)}`,
      low_balance_pence: balance.lowBalancePence,
      is_low_balance: balance.isLowBalance,
      auto_recharge_enabled: balance.autoRechargeEnabled,
      has_payment_method: balance.hasPaymentMethod,
      summary: summary || null,

      // NEW: USD display fields (Step 5a)
      balance_usd: (balance.balancePence / USD_TO_GBP_RATE / 100).toFixed(2),
      rate_per_minute: '$0.70',
      rate_per_minute_cents: RATE_PER_MINUTE_USD_CENTS,
      credits_per_minute: 10,
      estimated_minutes_remaining: Math.floor(balance.balancePence / pencePerMinute),
      estimated_credits_remaining: Math.floor(balance.balancePence / pencePerMinute) * 10,
      currency_display: 'usd',
      exchange_rate_used: USD_TO_GBP_RATE,
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error fetching wallet', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/wallet/transactions
 * Returns paginated credit_transactions for the authenticated org.
 * Query params: page (default 1), limit (default 50, max 100), type (optional filter)
 */
router.get('/wallet/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const typeFilter = req.query.type as string | undefined;

    let query = supabase
      .from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    const { data: entries, error, count } = await query;

    if (error) {
      log.error('BillingAPI', 'Error fetching wallet transactions', { error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      transactions: entries || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error fetching wallet transactions', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/wallet/topup
 * Creates a Stripe Checkout session for a one-time credit purchase.
 * Body: { amount_pence: number } — minimum 2500 (£25)
 */
router.post('/wallet/topup', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Billing not configured' });
    }

    const minTopUp = parseInt(process.env.WALLET_MIN_TOPUP_PENCE || '2500', 10);
    const { amount_pence } = req.body;

    // SECURITY FIX: Comprehensive amount validation (prevents billing manipulation)
    // Protects against: negative amounts, zero amounts, NaN, Infinity, non-integers
    if (
      !amount_pence ||
      typeof amount_pence !== 'number' ||
      !Number.isFinite(amount_pence) ||      // Reject NaN, Infinity, -Infinity
      !Number.isInteger(amount_pence) ||     // Reject decimals (pence must be whole number)
      amount_pence <= 0 ||                   // Reject negative and zero
      amount_pence < minTopUp                // Reject below minimum
    ) {
      return res.status(400).json({
        error: `Invalid amount. Minimum top-up is £${(minTopUp / 100).toFixed(2)} (${minTopUp}p). Must be a positive integer.`,
      });
    }

    // Fixed-rate billing constants for USD display
    const USD_TO_GBP_RATE = parseFloat(config.USD_TO_GBP_RATE || '0.79');
    const RATE_PER_MINUTE_USD_CENTS = config.RATE_PER_MINUTE_USD_CENTS || 70;
    const pencePerMinute = Math.ceil(RATE_PER_MINUTE_USD_CENTS * USD_TO_GBP_RATE); // 56p

    // Calculate USD equivalent, estimated minutes, and credits
    const amount_usd = (amount_pence / USD_TO_GBP_RATE / 100).toFixed(2);
    const estimated_minutes = Math.floor(amount_pence / pencePerMinute);
    const estimated_credits = estimated_minutes * 10;

    // Look up or create Stripe customer
    const { data: orgData } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', orgId)
      .single();

    const orgName = orgData?.name || undefined;

    const createStripeCustomer = async () => {
      const customer = await stripe.customers.create({
        metadata: { org_id: orgId },
        name: orgName,
      });

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ stripe_customer_id: customer.id })
        .eq('id', orgId);

      if (updateError) {
        log.warn('BillingAPI', 'Failed to persist new Stripe customer ID', {
          orgId,
          error: updateError.message,
        });
      }

      return customer.id;
    };

    let customerId = orgData?.stripe_customer_id || await createStripeCustomer();

    const isMissingCustomerError = (error: any) => {
      const code = error?.code || error?.raw?.code;
      const message = error?.message || error?.raw?.message;
      return code === 'resource_missing' && typeof message === 'string' && message.includes('No such customer');
    };

    const ensureValidCustomer = async () => {
      if (!customerId) {
        customerId = await createStripeCustomer();
        return customerId;
      }

      try {
        await stripe.customers.retrieve(customerId);
        return customerId;
      } catch (error: any) {
        if (isMissingCustomerError(error)) {
          log.warn('BillingAPI', 'Cached Stripe customer no longer exists, recreating', {
            orgId,
            staleCustomerId: customerId,
          });
          customerId = await createStripeCustomer();
          return customerId;
        }
        throw error;
      }
    };

    customerId = await ensureValidCustomer();

    const createCheckoutSession = async (customer: string) => stripe.checkout.sessions.create({
      customer,
      client_reference_id: orgId, // CRITICAL: Stripe best practice for reconciliation
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Voxanne AI Credits',
              // Show BOTH currencies in description to prevent confusion
              description: `Voxanne AI Top-up: ~$${Math.round(parseFloat(amount_usd))} (£${(amount_pence / 100).toFixed(2)} GBP) — ~${estimated_credits} credits`,
            },
            unit_amount: amount_pence,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        setup_future_usage: 'off_session', // Save card for auto-recharge
        metadata: {
          type: 'wallet_topup',
          org_id: orgId,
          amount_pence: String(amount_pence),
          amount_usd: amount_usd,
          estimated_minutes: String(estimated_minutes),
          estimated_credits: String(estimated_credits),
        },
      },
      success_url: `${frontendUrl}/dashboard/wallet?topup=success`,
      cancel_url: `${frontendUrl}/dashboard/wallet?topup=canceled`,
      metadata: {
        type: 'wallet_topup',
        org_id: orgId,
        amount_pence: String(amount_pence),
        amount_usd: amount_usd,
        estimated_minutes: String(estimated_minutes),
        estimated_credits: String(estimated_credits),
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001';

    let session;
    try {
      // Step 5b: Dual-currency Stripe metadata (CRITICAL - prevents customer confusion)
      session = await createCheckoutSession(customerId);
    } catch (error: any) {
      if (isMissingCustomerError(error)) {
        customerId = await createStripeCustomer();
        session = await createCheckoutSession(customerId);
      } else {
        throw error;
      }
    }

    log.info('BillingAPI', 'Wallet top-up checkout session created', {
      orgId,
      amountPence: amount_pence,
      amountUsd: amount_usd,
      estimatedMinutes: estimated_minutes,
      sessionId: session.id,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    log.error('BillingAPI', 'Error creating wallet top-up session', { error: error.message });
    res.status(500).json({ error: 'Failed to create top-up session' });
  }
});

/**
 * POST /api/billing/wallet/auto-recharge
 * Configure auto-recharge settings.
 * Body: { enabled: boolean, amount_pence?: number, threshold_pence?: number }
 */
router.post('/wallet/auto-recharge', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { enabled, amount_pence, threshold_pence } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const updateData: Record<string, any> = {
      wallet_auto_recharge: enabled,
    };

    if (amount_pence !== undefined) {
      if (typeof amount_pence !== 'number' || amount_pence < 1000) {
        return res.status(400).json({ error: 'amount_pence must be at least 1000 (£10)' });
      }
      updateData.wallet_recharge_amount_pence = amount_pence;
    }

    if (threshold_pence !== undefined) {
      if (typeof threshold_pence !== 'number' || threshold_pence < 100) {
        return res.status(400).json({ error: 'threshold_pence must be at least 100 (£1)' });
      }
      updateData.wallet_low_balance_pence = threshold_pence;
    }

    const { error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', orgId);

    if (error) {
      log.error('BillingAPI', 'Failed to update auto-recharge config', {
        orgId,
        error: error.message,
      });
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    log.info('BillingAPI', 'Auto-recharge config updated', {
      orgId,
      enabled,
      amountPence: amount_pence,
      thresholdPence: threshold_pence,
    });

    res.json({
      success: true,
      auto_recharge_enabled: enabled,
      recharge_amount_pence: updateData.wallet_recharge_amount_pence,
      threshold_pence: updateData.wallet_low_balance_pence,
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error updating auto-recharge', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/wallet/profit
 * Returns profit analytics: total provider cost, total charged, gross profit.
 * Query params: days (default 30)
 */
router.get('/wallet/profit', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select('type, direction, amount_pence, provider_cost_pence, client_charged_pence, gross_profit_pence, created_at')
      .eq('org_id', orgId)
      .eq('type', 'call_deduction')
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      log.error('BillingAPI', 'Error fetching profit data', { error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Fixed-rate billing constants for USD display
    const USD_TO_GBP_RATE = parseFloat(config.USD_TO_GBP_RATE || '0.79');

    let totalProviderCost = 0;
    let totalClientCharged = 0;
    let totalGrossProfit = 0;
    const dailyBreakdown: Record<string, { provider: number; charged: number; profit: number; calls: number }> = {};

    for (const tx of (transactions || [])) {
      totalProviderCost += tx.provider_cost_pence || 0;
      totalClientCharged += tx.client_charged_pence || 0;
      totalGrossProfit += tx.gross_profit_pence || 0;

      const day = tx.created_at.split('T')[0];
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { provider: 0, charged: 0, profit: 0, calls: 0 };
      }
      dailyBreakdown[day].provider += tx.provider_cost_pence || 0;
      dailyBreakdown[day].charged += tx.client_charged_pence || 0;
      dailyBreakdown[day].profit += tx.gross_profit_pence || 0;
      dailyBreakdown[day].calls += 1;
    }

    res.json({
      period_days: days,
      total_calls: (transactions || []).length,
      // Existing GBP fields (backward compatibility)
      total_provider_cost_pence: totalProviderCost,
      total_client_charged_pence: totalClientCharged,
      total_gross_profit_pence: totalGrossProfit,
      total_provider_cost_formatted: `£${(totalProviderCost / 100).toFixed(2)}`,
      total_client_charged_formatted: `£${(totalClientCharged / 100).toFixed(2)}`,
      total_gross_profit_formatted: `£${(totalGrossProfit / 100).toFixed(2)}`,
      margin_percent: totalClientCharged > 0
        ? Math.round((totalGrossProfit / totalClientCharged) * 100)
        : 0,
      daily_breakdown: dailyBreakdown,

      // NEW: Step 5c - USD display fields
      total_provider_cost_usd: (totalProviderCost / USD_TO_GBP_RATE / 100).toFixed(2),
      total_client_charged_usd: (totalClientCharged / USD_TO_GBP_RATE / 100).toFixed(2),
      total_gross_profit_usd: (totalGrossProfit / USD_TO_GBP_RATE / 100).toFixed(2),
      total_provider_cost_usd_formatted: `$${(totalProviderCost / USD_TO_GBP_RATE / 100).toFixed(2)}`,
      total_client_charged_usd_formatted: `$${(totalClientCharged / USD_TO_GBP_RATE / 100).toFixed(2)}`,
      total_gross_profit_usd_formatted: `$${(totalGrossProfit / USD_TO_GBP_RATE / 100).toFixed(2)}`,
      currency_display: 'usd',
      exchange_rate_used: USD_TO_GBP_RATE,
    });
  } catch (error: any) {
    log.error('BillingAPI', 'Error fetching profit data', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
