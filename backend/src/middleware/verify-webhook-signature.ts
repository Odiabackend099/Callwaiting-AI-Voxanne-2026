import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { log } from '../services/logger';

export function verifyWebhookSignature(options?: {
  secretKey?: string;
  orgId?: string;
  maxAgeSeconds?: number; // Default: 300 (5 minutes)
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const secretKey = options?.secretKey || process.env.VAPI_WEBHOOK_SECRET;
    const maxAgeSeconds = options?.maxAgeSeconds || 300;

    // Skip in development if no secret is set
    if (process.env.NODE_ENV === 'development' && !secretKey) {
      log.warn('WebhookSignature', 'Skipping signature verification in development mode (no secret set)');
      return next();
    }

    if (!secretKey) {
      log.error('WebhookSignature', 'Webhook secret not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const signature = req.headers['x-vapi-signature'] as string;
    const timestamp = req.headers['x-vapi-timestamp'] as string;

    if (!signature || !timestamp) {
      log.warn('WebhookSignature', 'Missing signature or timestamp headers');
      return res.status(401).json({ error: 'Missing signature or timestamp' });
    }

    // Check timestamp is within allowed window
    const now = Date.now();
    const timestampMs = parseInt(timestamp, 10) * 1000;
    const age = now - timestampMs;

    if (age > maxAgeSeconds * 1000) {
      log.warn('WebhookSignature', 'Timestamp outside allowed window', {
        timestamp,
        now,
        age,
        maxAgeSeconds
      });
      return res.status(401).json({ error: 'Timestamp outside allowed window' });
    }

    // Verify signature
    const payload = `${timestamp}.${req.rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const isEqual = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isEqual) {
      log.warn('WebhookSignature', 'Signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    log.info('WebhookSignature', 'Signature verified');
    next();
  };
}
