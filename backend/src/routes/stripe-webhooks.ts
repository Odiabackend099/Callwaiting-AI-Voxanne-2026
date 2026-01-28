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

export default router;
