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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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

export default router;
