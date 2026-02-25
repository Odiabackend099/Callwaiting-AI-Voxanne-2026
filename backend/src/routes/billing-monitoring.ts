/**
 * Billing Monitoring Route
 *
 * Operator-level aggregate billing metrics across all orgs.
 * All endpoints require the 'admin' role (Supabase app_metadata.role = 'admin').
 *
 * Mounted at: GET /api/billing/monitoring
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../services/logger';

const router = Router();
const logger = createLogger('BillingMonitoring');

router.use(requireAuth);
router.use(requireRole('admin'));

// ============================================
// GET /api/billing/monitoring
// Aggregate billing health across all orgs
// ============================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Run queries in parallel for speed
    const [
      orgBalancesResult,
      revenueResult,
      chargesResult,
      phoneProvisioningResult,
      recentFailedRechargesResult,
    ] = await Promise.all([
      // 1. All org balances (for tier bucketing)
      supabase
        .from('organizations')
        .select('id, wallet_balance_pence, wallet_auto_recharge, onboarding_completed_at')
        .not('wallet_balance_pence', 'is', null),

      // 2. Total topups (last 30 days)
      supabase
        .from('credit_transactions')
        .select('amount_pence, org_id, created_at')
        .eq('type', 'topup')
        .gte('created_at', thirtyDaysAgo),

      // 3. Total call charges (last 30 days)
      supabase
        .from('credit_transactions')
        .select('amount_pence, org_id, created_at')
        .eq('type', 'call_deduction')
        .gte('created_at', thirtyDaysAgo),

      // 4. Phone number purchases (last 30 days)
      supabase
        .from('credit_transactions')
        .select('amount_pence, org_id, created_at')
        .eq('type', 'phone_provisioning')
        .gte('created_at', thirtyDaysAgo),

      // 5. Recent failed auto-recharge attempts (any org with negative balance + auto_recharge on)
      supabase
        .from('organizations')
        .select('id, wallet_balance_pence')
        .lt('wallet_balance_pence', 0)
        .eq('wallet_auto_recharge', true),
    ]);

    const orgs = orgBalancesResult.data || [];
    const topups = revenueResult.data || [];
    const charges = chargesResult.data || [];
    const phonePurchases = phoneProvisioningResult.data || [];
    const negativeAutoRechargeOrgs = recentFailedRechargesResult.data || [];

    // Balance tier bucketing
    let emptyCount = 0;
    let lowCount = 0;
    let healthyCount = 0;
    for (const org of orgs) {
      const bal = org.wallet_balance_pence ?? 0;
      if (bal <= 0) emptyCount++;
      else if (bal <= 500) lowCount++;
      else healthyCount++;
    }

    // Revenue aggregates
    const totalTopupsPence = topups.reduce((sum, t) => sum + (t.amount_pence || 0), 0);
    const totalCallChargesPence = charges.reduce((sum, t) => sum + Math.abs(t.amount_pence || 0), 0);
    const totalPhonePurchasesPence = phonePurchases.reduce((sum, t) => sum + Math.abs(t.amount_pence || 0), 0);

    // Unique active orgs (had a call charge in last 30 days)
    const activeOrgIds = new Set(charges.map((c) => c.org_id));

    // Onboarded orgs
    const onboardedOrgs = orgs.filter((o) => o.onboarding_completed_at !== null);

    res.json({
      timestamp: new Date().toISOString(),
      window_days: 30,

      orgs: {
        total: orgs.length,
        onboarded: onboardedOrgs.length,
        active_last_30d: activeOrgIds.size,
        balance_tiers: {
          empty: emptyCount,       // balance ≤ 0
          low: lowCount,           // 1p – 500p (£0–£5)
          healthy: healthyCount,   // > 500p
        },
        negative_with_auto_recharge: negativeAutoRechargeOrgs.length,
      },

      revenue: {
        total_topups_pence: totalTopupsPence,
        total_topups_gbp: `£${(totalTopupsPence / 100).toFixed(2)}`,
        total_call_charges_pence: totalCallChargesPence,
        total_call_charges_gbp: `£${(totalCallChargesPence / 100).toFixed(2)}`,
        total_phone_purchases_pence: totalPhonePurchasesPence,
        total_phone_purchases_gbp: `£${(totalPhonePurchasesPence / 100).toFixed(2)}`,
        phone_count: phonePurchases.length,
        call_transaction_count: charges.length,
      },

      risk: {
        orgs_at_zero_or_negative: emptyCount,
        orgs_in_debt_with_auto_recharge: negativeAutoRechargeOrgs.length,
        note: negativeAutoRechargeOrgs.length > 0
          ? 'These orgs have auto-recharge enabled but are still negative — recharge may have failed.'
          : 'No at-risk orgs detected.',
      },
    });
  } catch (err: any) {
    logger.error('Billing monitoring overview failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch billing monitoring data' });
  }
});

export default router;
