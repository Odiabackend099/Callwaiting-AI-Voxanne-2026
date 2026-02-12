/**
 * Stripe Webhook Configuration
 * 
 * Automatically detects environment and returns appropriate webhook URL
 * Supports: local (ngrok), staging, production
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
  const productionDomain = process.env.PRODUCTION_DOMAIN || 'api.voxanne.ai';
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
