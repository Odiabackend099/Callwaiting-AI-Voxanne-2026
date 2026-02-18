/**
 * Stripe Webhook Configuration
 *
 * ⚠️ IMPORTANT: Production webhook URL must be configured manually in Stripe Dashboard
 * This function is for reference only - DO NOT rely on automatic webhook creation
 *
 * PRODUCTION CONFIGURATION (2026-02-16):
 * - Frontend: Vercel at voxanne.ai
 * - Backend: Render at voxanneai.onrender.com
 * - Stripe Webhook URL: https://voxanneai.onrender.com/api/webhooks/stripe
 * - Webhook Secret: Stored in Render environment variable STRIPE_WEBHOOK_SECRET
 *
 * IMPORTANT: DO NOT use api.voxanne.ai - this domain does not exist!
 */

export function getWebhookUrlForEnvironment(): string {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Local development with ngrok
  if (nodeEnv === 'development') {
    const ngrokUrl = process.env.NGROK_TUNNEL_URL || 'sobriquetical-zofia-abysmally.ngrok-free.dev';
    return `https://${ngrokUrl}/api/webhooks/stripe`;
  }

  // Staging environment
  if (nodeEnv === 'staging') {
    const stagingDomain = process.env.STAGING_DOMAIN || 'staging-api.voxanne.ai';
    return `https://${stagingDomain}/api/webhooks/stripe`;
  }

  // Production environment
  // CRITICAL: Updated 2026-02-16 to correct production URL
  // Old incorrect default was: 'api.voxanne.ai' (domain doesn't exist)
  const productionDomain = process.env.PRODUCTION_DOMAIN || 'voxanneai.onrender.com';
  return `https://${productionDomain}/api/webhooks/stripe`;
}

export const WEBHOOK_EVENTS = [
  'checkout.session.completed',      // Critical: wallet top-up
  'payment_intent.succeeded',        // Redundant but safe
  'customer.created'                 // Future: customer lifecycle
] as const;

export const STRIPE_WEBHOOK_CONFIG = {
  apiVersion: '2023-10-16',
  maxRetries: 3,
  timeout: 30000 // 30 seconds
};
