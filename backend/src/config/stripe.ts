import Stripe from 'stripe';
import { log } from '../services/logger';

let stripeClient: Stripe | null = null;

export function initializeStripe(): void {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    log.warn('Stripe', 'STRIPE_SECRET_KEY not set, billing features disabled');
    return;
  }

  try {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as any,
      typescript: true,
    });

    log.info('Stripe', 'Stripe client initialized');
  } catch (error) {
    log.error('Stripe', 'Failed to initialize Stripe', { error: (error as Error).message });
  }
}

export function getStripeClient(): Stripe | null {
  return stripeClient;
}
