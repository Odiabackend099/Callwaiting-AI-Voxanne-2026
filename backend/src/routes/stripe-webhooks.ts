/**
 * Stripe Webhook Handler
 *
 * Handles Stripe billing events:
 * - invoice.payment_succeeded: Reset usage counter on subscription renewal
 * - customer.subscription.deleted: Deactivate billing when subscription canceled
 * - customer.subscription.updated: Handle plan changes
 */

import { Router, Request, Response } from 'express';
import { verifyStripeSignature } from '../middleware/verify-stripe-signature';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import { addCredits } from '../services/wallet-service';
import { sendSlackAlert } from '../services/slack-alerts';

const router = Router();

// Tier configuration for plan changes
const TIER_CONFIG: Record<string, { included_minutes: number; overage_rate_pence: number }> = {
  starter: { included_minutes: 400, overage_rate_pence: 45 },
  professional: { included_minutes: 1200, overage_rate_pence: 40 },
  enterprise: { included_minutes: 2000, overage_rate_pence: 35 },
};

/**
 * POST /api/webhooks/stripe
 * Receives and processes Stripe webhook events.
 * Signature verification handled by middleware.
 */
router.post('/stripe',
  verifyStripeSignature(),
  async (req: Request, res: Response) => {
    const event = (req as any).stripeEvent;

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid event' });
    }

    // Return 200 immediately so Stripe does not retry
    res.status(200).json({ received: true });

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        // ===== WALLET TOP-UP EVENTS =====
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;

        default:
          log.debug('StripeWebhook', `Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      log.error('StripeWebhook', 'Error processing Stripe event', {
        type: event.type,
        error: error.message,
        stack: error.stack,
      });
      // Don't re-throw — we already sent 200 to Stripe
    }
  }
);

/**
 * Handle successful invoice payment.
 * Resets minutes_used to 0 and updates the billing period dates.
 * This fires on each subscription renewal.
 */
async function handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!customerId) {
    log.warn('StripeWebhook', 'invoice.payment_succeeded missing customer ID');
    return;
  }

  // Only reset on subscription invoices (not one-time setup fee invoices)
  if (!subscriptionId) {
    log.info('StripeWebhook', 'Invoice is not subscription-related, skipping reset', {
      invoiceId: invoice.id,
    });
    return;
  }

  // Look up org by stripe_customer_id
  const { data: org, error: findError } = await supabase
    .from('organizations')
    .select('id, billing_plan, minutes_used')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !org) {
    log.error('StripeWebhook', 'Could not find org for Stripe customer', {
      customerId,
      error: findError?.message,
    });
    return;
  }

  // Extract period dates from invoice lines
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  if (invoice.lines?.data?.length > 0) {
    const line = invoice.lines.data[0];
    if (line.period?.start) {
      periodStart = new Date(line.period.start * 1000).toISOString();
    }
    if (line.period?.end) {
      periodEnd = new Date(line.period.end * 1000).toISOString();
    }
  }

  // Reset minutes_used and update period
  const updateData: Record<string, any> = {
    minutes_used: 0,
    updated_at: new Date().toISOString(),
  };

  if (periodStart) updateData.current_period_start = periodStart;
  if (periodEnd) updateData.current_period_end = periodEnd;

  const { error: updateError } = await supabase
    .from('organizations')
    .update(updateData)
    .eq('id', org.id);

  if (updateError) {
    log.error('StripeWebhook', 'Failed to reset usage on renewal', {
      orgId: org.id,
      error: updateError.message,
    });
    return;
  }

  log.info('StripeWebhook', 'Usage reset on subscription renewal', {
    orgId: org.id,
    previousMinutesUsed: org.minutes_used,
    periodStart,
    periodEnd,
    invoiceId: invoice.id,
  });
}

/**
 * Handle subscription cancellation.
 * Sets billing_plan to 'none' and clears billing data.
 */
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const customerId = subscription.customer;

  if (!customerId) {
    log.warn('StripeWebhook', 'subscription.deleted missing customer ID');
    return;
  }

  const { data: org, error: findError } = await supabase
    .from('organizations')
    .select('id, billing_plan')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !org) {
    log.error('StripeWebhook', 'Could not find org for deleted subscription', {
      customerId,
      error: findError?.message,
    });
    return;
  }

  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      billing_plan: 'none',
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      included_minutes: 0,
      minutes_used: 0,
      overage_rate_pence: 0,
      current_period_start: null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (updateError) {
    log.error('StripeWebhook', 'Failed to deactivate billing', {
      orgId: org.id,
      error: updateError.message,
    });
    return;
  }

  log.info('StripeWebhook', 'Subscription canceled, billing deactivated', {
    orgId: org.id,
    previousPlan: org.billing_plan,
  });
}

/**
 * Handle subscription updates (plan changes).
 * Updates billing_plan, included_minutes, and overage_rate_pence.
 */
async function handleSubscriptionUpdated(subscription: any): Promise<void> {
  const customerId = subscription.customer;

  if (!customerId) {
    log.warn('StripeWebhook', 'subscription.updated missing customer ID');
    return;
  }

  const { data: org, error: findError } = await supabase
    .from('organizations')
    .select('id, billing_plan')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !org) {
    log.error('StripeWebhook', 'Could not find org for updated subscription', {
      customerId,
      error: findError?.message,
    });
    return;
  }

  // Detect tier from subscription metadata or items
  const tier = subscription.metadata?.voxanne_tier;
  if (!tier || !TIER_CONFIG[tier]) {
    log.debug('StripeWebhook', 'No voxanne_tier metadata on subscription update', {
      orgId: org.id,
      subscriptionId: subscription.id,
    });
    return;
  }

  const config = TIER_CONFIG[tier];

  // Find the metered subscription item (for usage record reporting)
  let subscriptionItemId: string | null = null;
  if (subscription.items?.data) {
    const meteredItem = subscription.items.data.find(
      (item: any) => item.price?.recurring?.usage_type === 'metered'
    );
    if (meteredItem) {
      subscriptionItemId = meteredItem.id;
    }
  }

  const updateData: Record<string, any> = {
    billing_plan: tier,
    included_minutes: config.included_minutes,
    overage_rate_pence: config.overage_rate_pence,
    stripe_subscription_id: subscription.id,
    updated_at: new Date().toISOString(),
  };

  if (subscriptionItemId) {
    updateData.stripe_subscription_item_id = subscriptionItemId;
  }

  const { error: updateError } = await supabase
    .from('organizations')
    .update(updateData)
    .eq('id', org.id);

  if (updateError) {
    log.error('StripeWebhook', 'Failed to update billing plan', {
      orgId: org.id,
      error: updateError.message,
    });
    return;
  }

  log.info('StripeWebhook', 'Billing plan updated', {
    orgId: org.id,
    previousPlan: org.billing_plan,
    newPlan: tier,
    includedMinutes: config.included_minutes,
    overageRatePence: config.overage_rate_pence,
  });
}

// ============================================
// Wallet Top-Up Handlers
// ============================================

/**
 * Handle checkout.session.completed for wallet top-ups.
 * Fired when a customer completes a Stripe Checkout session
 * (one-time payment for credit purchase).
 */
async function handleCheckoutSessionCompleted(session: any): Promise<void> {
  // Only process wallet top-up sessions
  if (session.metadata?.type !== 'wallet_topup') {
    return;
  }

  const orgId = session.metadata?.org_id;
  const amountPence = parseInt(session.metadata?.amount_pence || '0', 10);
  const paymentIntentId = session.payment_intent;

  if (!orgId || !amountPence || amountPence <= 0) {
    log.error('StripeWebhook', 'checkout.session.completed missing required metadata', {
      sessionId: session.id,
      metadata: session.metadata,
    });
    return;
  }

  log.info('StripeWebhook', 'Processing wallet top-up from checkout', {
    orgId,
    amountPence,
    sessionId: session.id,
    paymentIntentId,
  });

  // Credit the wallet (idempotent via stripe_payment_intent_id unique index)
  const result = await addCredits(
    orgId,
    amountPence,
    'topup',
    paymentIntentId,
    undefined,
    `Checkout top-up: ${amountPence}p`,
    'stripe:checkout'
  );

  if (!result.success) {
    log.error('StripeWebhook', 'Failed to credit wallet from checkout', {
      orgId,
      amountPence,
      error: result.error,
      paymentIntentId,
    });
    return;
  }

  // Save payment method for future auto-recharge
  if (session.setup_intent || session.payment_method_collection === 'always') {
    try {
      const customerId = session.customer;
      if (customerId) {
        // The payment method is attached to the customer via setup_future_usage
        // Save the customer's default PM for auto-recharge
        const { getStripeClient: getStripe } = await import('../config/stripe');
        const stripe = getStripe();
        if (stripe) {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId as string,
            type: 'card',
            limit: 1,
          });

          if (paymentMethods?.data?.length > 0) {
            await supabase
              .from('organizations')
              .update({
                stripe_default_pm_id: paymentMethods.data[0].id,
                stripe_customer_id: customerId,
              })
              .eq('id', orgId);

            log.info('StripeWebhook', 'Saved payment method for auto-recharge', {
              orgId,
              pmId: paymentMethods.data[0].id,
            });
          }
        }
      }
    } catch (pmError: any) {
      // Non-fatal: top-up succeeded, PM save failed
      log.warn('StripeWebhook', 'Failed to save payment method (non-blocking)', {
        orgId,
        error: pmError?.message,
      });
    }
  }

  log.info('StripeWebhook', 'Wallet top-up completed via checkout', {
    orgId,
    amountPence,
    balanceBefore: result.balanceBefore,
    balanceAfter: result.balanceAfter,
  });
}

/**
 * Handle payment_intent.succeeded for auto-recharge payments.
 * This is a safety net — the recharge processor already credits the wallet.
 * This handler ensures credits are applied even if the processor crashes
 * between Stripe charge and wallet credit.
 */
async function handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
  // Only process wallet-related payment intents
  if (paymentIntent.metadata?.type !== 'wallet_auto_recharge' &&
      paymentIntent.metadata?.type !== 'wallet_topup') {
    return;
  }

  const orgId = paymentIntent.metadata?.org_id;
  const amountPence = parseInt(paymentIntent.metadata?.amount_pence || '0', 10);

  if (!orgId || !amountPence || amountPence <= 0) {
    return;
  }

  // Attempt to credit (idempotent — will return success+duplicate if already credited)
  const result = await addCredits(
    orgId,
    amountPence,
    'topup',
    paymentIntent.id,
    paymentIntent.latest_charge,
    `Payment confirmed: ${amountPence}p (${paymentIntent.metadata.type})`,
    'stripe:webhook-safety-net'
  );

  if (result.success) {
    log.info('StripeWebhook', 'payment_intent.succeeded processed', {
      orgId,
      amountPence,
      paymentIntentId: paymentIntent.id,
      balanceAfter: result.balanceAfter,
    });
  }
}

/**
 * Handle payment_intent.payment_failed.
 * Logs the failure and sends a Slack alert.
 */
async function handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
  // Only alert on wallet-related failures
  if (paymentIntent.metadata?.type !== 'wallet_auto_recharge' &&
      paymentIntent.metadata?.type !== 'wallet_topup') {
    return;
  }

  const orgId = paymentIntent.metadata?.org_id;
  const failureMessage = paymentIntent.last_payment_error?.message || 'Unknown error';
  const failureCode = paymentIntent.last_payment_error?.code || 'unknown';

  log.error('StripeWebhook', 'Wallet payment failed', {
    orgId,
    paymentIntentId: paymentIntent.id,
    type: paymentIntent.metadata?.type,
    failureMessage,
    failureCode,
  });

  await sendSlackAlert('🔴 Wallet Payment Failed', {
    orgId: orgId || 'unknown',
    paymentIntentId: paymentIntent.id,
    type: paymentIntent.metadata?.type || 'unknown',
    error: failureMessage,
    code: failureCode,
  }).catch(() => {});
}

export default router;
