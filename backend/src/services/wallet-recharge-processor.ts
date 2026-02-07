/**
 * Wallet Auto-Recharge Processor
 *
 * BullMQ worker that processes auto-recharge jobs.
 * When a wallet balance drops below threshold, this processor:
 * 1. Verifies auto-recharge is still enabled
 * 2. Checks balance hasn't been manually topped up
 * 3. Creates a Stripe PaymentIntent (off-session, auto-confirm)
 * 4. Credits the wallet on successful charge
 *
 * Pattern cloned from billing-manager.ts processBillingJob().
 */

import { Job } from 'bullmq';
import { getStripeClient } from '../config/stripe';
import { AutoRechargeJobData } from '../config/wallet-queue';
import { addCredits } from './wallet-service';
import { supabase } from './supabase-client';
import { log } from './logger';
import { sendSlackAlert } from './slack-alerts';

/**
 * BullMQ worker callback: processes auto-recharge for an organization.
 * Called by the wallet-auto-recharge queue worker.
 */
export async function processAutoRecharge(job: Job<AutoRechargeJobData>): Promise<void> {
  const { orgId } = job.data;

  log.info('WalletRecharge', 'Processing auto-recharge', {
    orgId,
    attempt: job.attemptsMade + 1,
  });

  // 1. Fetch org wallet config
  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select(
      'id, wallet_balance_pence, wallet_low_balance_pence, ' +
      'wallet_auto_recharge, wallet_recharge_amount_pence, ' +
      'stripe_customer_id, stripe_default_pm_id'
    )
    .eq('id', orgId)
    .single();

  if (orgError || !orgRow) {
    log.error('WalletRecharge', 'Failed to fetch org config', {
      orgId,
      error: orgError?.message,
    });
    throw new Error(`Org not found: ${orgId}`);
  }

  const org = orgRow as any;

  // 2. Guard: skip if auto-recharge disabled
  if (!org.wallet_auto_recharge) {
    log.info('WalletRecharge', 'Auto-recharge disabled, skipping', { orgId });
    return;
  }

  // 3. Guard: skip if balance already sufficient (manual top-up happened)
  if (org.wallet_balance_pence > org.wallet_low_balance_pence) {
    log.info('WalletRecharge', 'Balance already above threshold, skipping', {
      orgId,
      balance: org.wallet_balance_pence,
      threshold: org.wallet_low_balance_pence,
    });
    return;
  }

  // 4. Guard: must have Stripe customer and payment method
  if (!org.stripe_customer_id) {
    log.error('WalletRecharge', 'No Stripe customer ID', { orgId });
    throw new Error('No Stripe customer ID configured');
  }

  if (!org.stripe_default_pm_id) {
    log.error('WalletRecharge', 'No payment method on file', { orgId });
    await sendSlackAlert('⚠️ Auto-Recharge Failed: No Payment Method', {
      orgId,
      balance: `${org.wallet_balance_pence}p`,
    }).catch(() => {});
    throw new Error('No payment method configured');
  }

  const rechargeAmount = org.wallet_recharge_amount_pence || 5000; // Default £50

  // 5. Create Stripe PaymentIntent (off-session, auto-confirm)
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe client not initialized');
  }

  log.info('WalletRecharge', 'Creating Stripe PaymentIntent', {
    orgId,
    amountPence: rechargeAmount,
    customerId: org.stripe_customer_id,
  });

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: rechargeAmount,
      currency: 'gbp',
      customer: org.stripe_customer_id,
      payment_method: org.stripe_default_pm_id,
      off_session: true,
      confirm: true,
      metadata: {
        type: 'wallet_auto_recharge',
        org_id: orgId,
        amount_pence: String(rechargeAmount),
      },
    },
    {
      idempotencyKey: `recharge-${orgId}-${job.id}`,
    }
  );

  if (paymentIntent.status !== 'succeeded') {
    log.error('WalletRecharge', 'PaymentIntent did not succeed', {
      orgId,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    });
    throw new Error(`PaymentIntent status: ${paymentIntent.status}`);
  }

  // 6. Credit the wallet
  const creditResult = await addCredits(
    orgId,
    rechargeAmount,
    'topup',
    paymentIntent.id,
    paymentIntent.latest_charge as string | undefined,
    `Auto-recharge: ${rechargeAmount}p`,
    'system:auto-recharge'
  );

  if (!creditResult.success) {
    // Payment succeeded but credit failed — alert immediately
    log.error('WalletRecharge', 'CRITICAL: Payment succeeded but credit failed', {
      orgId,
      paymentIntentId: paymentIntent.id,
      amountPence: rechargeAmount,
      error: creditResult.error,
    });

    await sendSlackAlert('🔴 CRITICAL: Auto-Recharge Payment Succeeded But Credit Failed', {
      orgId,
      paymentIntentId: paymentIntent.id,
      amountPence: String(rechargeAmount),
      error: creditResult.error || 'unknown',
    }).catch(() => {});

    throw new Error(`Credit failed after payment: ${creditResult.error}`);
  }

  log.info('WalletRecharge', 'Auto-recharge completed', {
    orgId,
    amountPence: rechargeAmount,
    paymentIntentId: paymentIntent.id,
    balanceBefore: creditResult.balanceBefore,
    balanceAfter: creditResult.balanceAfter,
  });
}
