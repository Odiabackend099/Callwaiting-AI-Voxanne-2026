import { Request, Response, NextFunction } from 'express';
import { getStripeClient } from '../config/stripe';
import { log } from '../services/logger';

// Augment Express Request with rawBody (declared in server.ts, re-declared here for module scope)
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

/**
 * Express middleware to verify Stripe webhook signatures.
 * Uses stripe.webhooks.constructEvent() which handles HMAC verification.
 * The parsed Stripe event is attached to req.stripeEvent.
 *
 * Requires req.rawBody (captured by Express JSON middleware in server.ts:196-198).
 */
export function verifyStripeSignature() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const stripe = getStripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    // Skip in development if no secret is set
    if (process.env.NODE_ENV === 'development' && !secret) {
      log.warn('StripeSignature', 'Skipping signature verification in development mode (no secret set)');
      // In dev mode, parse body as-is
      (req as any).stripeEvent = req.body;
      return next();
    }

    if (!stripe) {
      log.error('StripeSignature', 'Stripe client not initialized');
      return res.status(500).json({ error: 'Billing not configured' });
    }

    if (!secret) {
      log.error('StripeSignature', 'STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      log.warn('StripeSignature', 'Missing stripe-signature header');
      return res.status(401).json({ error: 'Missing Stripe signature' });
    }

    if (!req.rawBody) {
      log.error('StripeSignature', 'req.rawBody not available');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      const event = stripe.webhooks.constructEvent(req.rawBody, signature, secret);
      (req as any).stripeEvent = event;
      log.info('StripeSignature', 'Signature verified', { eventType: event.type });
      next();
    } catch (err: any) {
      log.warn('StripeSignature', 'Signature verification failed', { error: err.message });
      return res.status(401).json({ error: 'Invalid signature' });
    }
  };
}
