/**
 * Stripe Webhook Handler (P0-1: Async Processing)
 *
 * Receives Stripe webhook events and queues them for async processing.
 * Returns 200 immediately to prevent Stripe timeouts, then processes via BullMQ.
 *
 * Event Types Handled:
 * - invoice.payment_succeeded: Reset usage counter on subscription renewal
 * - customer.subscription.deleted: Deactivate billing when subscription canceled
 * - customer.subscription.updated: Handle plan changes
 * - checkout.session.completed: Process wallet top-ups
 * - payment_intent.succeeded: Safety net for wallet credits
 * - payment_intent.payment_failed: Alert on payment failures
 *
 * Implementation Details:
 * - Webhook signature verified by middleware (verifyStripeSignature)
 * - Returns 200 within <1 second (as required by Stripe)
 * - Processing happens asynchronously via BullMQ queue
 * - Worker implementation: backend/src/jobs/stripe-webhook-processor.ts
 * - Queue configuration: backend/src/config/billing-queue.ts
 */

import { Router, Request, Response } from 'express';
import { verifyStripeSignature } from '../middleware/verify-stripe-signature';
import { log } from '../services/logger';
import { enqueueBillingWebhook } from '../config/billing-queue';

const router = Router();

/**
 * POST /api/webhooks/stripe
 * Receives Stripe webhook events and queues them for async processing.
 * Returns 200 immediately (within <1 second) to prevent Stripe timeouts.
 * Signature verification handled by middleware.
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

    // Step 1: Return 200 IMMEDIATELY to Stripe (as recommended by Stripe docs)
    // This prevents timeout and retry loops
    res.status(200).json({ received: true });

    // Step 2: Queue for async processing via BullMQ
    try {
      const job = await enqueueBillingWebhook({
        eventId: event.id,
        eventType: event.type,
        eventData: event.data.object,
        receivedAt: new Date().toISOString(),
      });

      if (!job) {
        log.error('StripeWebhook', 'Failed to enqueue webhook - queue not initialized', {
          eventId: event.id,
          eventType: event.type,
        });
        return;
      }

      log.info('StripeWebhook', 'Webhook queued for processing', {
        eventId: event.id,
        eventType: event.type,
        jobId: job.id,
      });
    } catch (error: any) {
      // Log error but don't re-throw — we already sent 200 to Stripe
      log.error('StripeWebhook', 'Failed to enqueue webhook', {
        eventId: event.id,
        eventType: event.type,
        error: error.message,
        stack: error.stack,
      });
    }
  }
);

export default router;
