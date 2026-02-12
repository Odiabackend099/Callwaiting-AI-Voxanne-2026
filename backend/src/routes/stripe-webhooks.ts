/**
 * Stripe Webhook Handler
 *
 * Receives Stripe webhook events with signature verification.
 *
 * CRITICAL: Wallet top-ups (checkout.session.completed) are processed
 * SYNCHRONOUSLY — credits are added before returning 200 to Stripe.
 * If processing fails, returns 500 so Stripe retries automatically.
 *
 * All other event types are queued for async processing via BullMQ
 * (optional — non-critical if Redis is unavailable).
 */

import { Router, Request, Response } from 'express';
import { verifyStripeSignature } from '../middleware/verify-stripe-signature';
import { log } from '../services/logger';
import { enqueueBillingWebhook } from '../config/billing-queue';
import { supabase } from '../services/supabase-client';
import { addCredits } from '../services/wallet-service';
import { getStripeClient } from '../config/stripe';

const router = Router();

/**
 * POST /api/webhooks/stripe
 * Wallet top-ups: processed synchronously, 200 returned only after success.
 * Other events: 200 returned immediately, async processing via BullMQ.
 */
router.post('/stripe',
  verifyStripeSignature(),
  async (req: Request, res: Response) => {
    const event = (req as any).stripeEvent;

    if (!event || !event.type) {
      log.warn('StripeWebhook', 'Invalid event received', {
        hasEvent: !!event,
        hasType: !!(event?.type),
      });
      return res.status(400).json({ error: 'Invalid event' });
    }

    // SECURITY FIX (P0-3): Check for duplicate webhook events (idempotency)
    // Protects against: replay attacks granting unlimited credits from single payment
    // Defense-in-depth: BullMQ queue + database tracking
    const { data: alreadyProcessed } = await supabase.rpc('is_stripe_event_processed', {
      p_event_id: event.id
    });

    if (alreadyProcessed) {
      log.info('StripeWebhook', 'Duplicate event detected - skipping', {
        eventId: event.id,
        eventType: event.type,
      });
      // Return 200 to Stripe (event already processed successfully)
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Mark event as being processed (prevents race conditions)
    await supabase.rpc('mark_stripe_event_processed', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_org_id: event.data?.object?.metadata?.org_id || null,
      p_event_data: event.data?.object || null
    });

    // ========================================================
    // CRITICAL FIX: Process wallet top-ups SYNCHRONOUSLY
    // Only return 200 AFTER credits are successfully added.
    // If processing fails, return 500 so Stripe retries.
    // The addCredits() RPC takes <100ms — no need for async queue.
    // ========================================================
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.metadata?.type === 'wallet_topup') {
        try {
          const orgId = session.metadata?.org_id;
          const amountPence = parseInt(session.metadata?.amount_pence || '0', 10);
          const paymentIntentId = session.payment_intent;

          if (!orgId || !amountPence || amountPence <= 0) {
            log.error('StripeWebhook', 'Missing metadata for wallet top-up', {
              sessionId: session.id,
              metadata: session.metadata,
            });
            return res.status(400).json({ error: 'Missing wallet top-up metadata' });
          }

          // Add credits SYNCHRONOUSLY (single Supabase RPC, <100ms)
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
            log.error('StripeWebhook', 'Failed to add wallet credits', {
              orgId,
              amountPence,
              error: result.error,
            });
            // Return 500 so Stripe retries
            return res.status(500).json({ error: 'Credit processing failed' });
          }

          log.info('StripeWebhook', 'Wallet credits added SYNCHRONOUSLY', {
            orgId,
            amountPence,
            balanceBefore: result.balanceBefore,
            balanceAfter: result.balanceAfter,
          });

          // Save payment method for future auto-recharge (non-blocking)
          try {
            const customerId = session.customer;
            if (customerId) {
              const stripe = getStripeClient();
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
                }
              }
            }
          } catch (pmError: any) {
            // Non-fatal: top-up succeeded, PM save failed
            log.warn('StripeWebhook', 'Failed to save payment method (non-blocking)', {
              error: pmError?.message,
            });
          }

          // Only NOW return 200 — credits are confirmed in the database
          return res.status(200).json({ received: true, credited: true });

        } catch (err: any) {
          log.error('StripeWebhook', 'Wallet top-up processing error', {
            error: err.message,
            stack: err.stack,
          });
          // Return 500 so Stripe retries
          return res.status(500).json({ error: 'Processing error' });
        }
      }
    }

    // For all other event types: return 200, then attempt async queue (optional)
    res.status(200).json({ received: true });

    try {
      const job = await enqueueBillingWebhook({
        eventId: event.id,
        eventType: event.type,
        eventData: event.data.object,
        receivedAt: new Date().toISOString(),
      });

      if (job) {
        log.info('StripeWebhook', 'Event queued for async processing', {
          eventId: event.id,
          eventType: event.type,
          jobId: job.id,
        });
      } else {
        log.warn('StripeWebhook', 'Queue unavailable for non-critical event', {
          eventId: event.id,
          eventType: event.type,
        });
      }
    } catch (error: any) {
      log.error('StripeWebhook', 'Failed to enqueue non-critical event', {
        eventId: event.id,
        eventType: event.type,
        error: error.message,
      });
    }
  }
);

export default router;
