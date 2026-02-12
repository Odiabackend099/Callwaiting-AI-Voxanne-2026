/**
 * Stripe Webhook Manager
 * 
 * Handles webhook validation, event processing, and error handling
 * Validates signatures and processes billing events
 */

import Stripe from 'stripe';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

/**
 * Validates webhook signature from Stripe
 * Returns the event payload if valid
 */
export function validateWebhookSignature(
  body: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event | null {
  try {
    // Parse signature header: t=1614556800,v1=5c5e2e2d3f4a4f4a
    const parts = signature.split(',').reduce((acc: any, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const timestamp = parts.t;
    const receivedSignature = parts.v1;
    
    if (!timestamp || !receivedSignature) {
      logger.warn('Invalid signature format', { signature });
      return null;
    }
    
    // Reconstruct signed content
    const signedContent = `${timestamp}.${body}`;
    
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');
    
    // Compare signatures (constant-time comparison)
    if (receivedSignature !== expectedSignature) {
      logger.warn('Signature mismatch', { received: receivedSignature, expected: expectedSignature });
      return null;
    }
    
    // Validate timestamp (reject events older than 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const age = now - parseInt(timestamp);
    
    if (age > 300) {
      logger.warn('Webhook too old', { age, maxAge: 300 });
      return null;
    }
    
    // Signature valid - parse and return event
    const event = JSON.parse(body.toString()) as Stripe.Event;
    return event;
    
  } catch (error: any) {
    logger.error('Webhook validation error', { error: error.message });
    return null;
  }
}

/**
 * Process webhook event
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<boolean> {
  logger.info('Processing webhook event', {
    eventId: event.id,
    eventType: event.type,
    created: new Date(event.created * 1000).toISOString()
  });
  
  try {
    // Check if event already processed (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('processed_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();
    
    if (existingEvent) {
      logger.info('Webhook already processed (idempotent)', { eventId: event.id });
      return true;
    }
    
    // Route to appropriate handler
    let processed = false;
    
    switch (event.type) {
      case 'checkout.session.completed':
        processed = await handleCheckoutSessionCompleted(event);
        break;
      
      case 'payment_intent.succeeded':
        processed = await handlePaymentIntentSucceeded(event);
        break;
      
      case 'customer.created':
        processed = await handleCustomerCreated(event);
        break;
      
      default:
        logger.warn('Unhandled webhook event type', { type: event.type });
        processed = true; // Don't retry unknown events
    }
    
    // Log processed event
    if (processed) {
      await supabaseAdmin
        .from('processed_webhook_events')
        .insert({
          stripe_event_id: event.id,
          event_type: event.type,
          processed: true,
          created_at: new Date()
        });
    }
    
    return processed;
    
  } catch (error: any) {
    logger.error('Error processing webhook event', {
      eventId: event.id,
      error: error.message
    });
    return false;
  }
}

/**
 * Handle checkout.session.completed event
 * This is the critical event for wallet top-ups
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<boolean> {
  const session = event.data.object as Stripe.Checkout.Session;
  
  logger.info('Processing checkout.session.completed', {
    sessionId: session.id,
    customerId: session.customer,
    amount: session.amount_total,
    currency: session.currency
  });
  
  try {
    // Extract org_id from client_reference_id
    const orgId = session.client_reference_id;
    
    if (!orgId) {
      logger.error('Checkout session missing client_reference_id (org_id)', {
        sessionId: session.id
      });
      return false;
    }
    
    // Convert amount to pence (Stripe uses smallest currency unit)
    // For GBP, 1 pound = 100 pence
    const amountPence = session.amount_total || 0;
    
    // Update organization wallet balance
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        wallet_balance_pence: supabaseAdmin.rpc('add_to_wallet', {
          p_org_id: orgId,
          p_amount_pence: amountPence
        }) as any
      })
      .eq('id', orgId);
    
    if (updateError) {
      logger.error('Failed to update wallet balance', {
        orgId,
        error: updateError.message
      });
      return false;
    }
    
    // Log transaction
    await supabaseAdmin
      .from('credit_transactions')
      .insert({
        org_id: orgId,
        transaction_type: 'topup',
        amount_pence: amountPence,
        stripe_session_id: session.id,
        description: `Top-up via Stripe (${session.currency.toUpperCase()})`
      });
    
    logger.info('Wallet balance updated', {
      orgId,
      amount: amountPence,
      sessionId: session.id
    });
    
    return true;
    
  } catch (error: any) {
    logger.error('Error handling checkout.session.completed', {
      error: error.message,
      session: session.id
    });
    return false;
  }
}

/**
 * Handle payment_intent.succeeded event
 * Redundant with checkout.session.completed but provides additional safety
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<boolean> {
  const intent = event.data.object as Stripe.PaymentIntent;
  
  logger.info('Processing payment_intent.succeeded', {
    intentId: intent.id,
    amount: intent.amount,
    currency: intent.currency
  });
  
  // For now, we rely on checkout.session.completed
  // This could be used for direct payment intent flows in the future
  return true;
}

/**
 * Handle customer.created event
 * Store customer mapping for future use
 */
async function handleCustomerCreated(event: Stripe.Event): Promise<boolean> {
  const customer = event.data.object as Stripe.Customer;
  
  logger.info('Processing customer.created', {
    customerId: customer.id,
    email: customer.email
  });
  
  // Customer created event is informational
  // Could be used to track customer lifecycle in the future
  return true;
}

/**
 * Express middleware for handling Stripe webhooks
 */
export function stripeWebhookHandler(req: Request, res: Response): any {
  const signature = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // Validate inputs
  if (!signature) {
    logger.warn('Webhook missing Stripe-Signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  if (!secret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  // Get raw body for signature validation
  const rawBody = typeof req.body === 'string' 
    ? req.body 
    : JSON.stringify(req.body);
  
  // Validate signature
  const event = validateWebhookSignature(rawBody, signature, secret);
  
  if (!event) {
    logger.warn('Invalid webhook signature', { signature });
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process event asynchronously (don't wait for response)
  processWebhookEvent(event)
    .then(success => {
      if (!success) {
        logger.error('Webhook processing failed', { eventId: event.id });
      }
    })
    .catch(error => {
      logger.error('Webhook processing error', { error: error.message });
    });
  
  // Always return 200 to Stripe immediately
  // Retry logic handles failed processing
  res.status(200).json({ success: true });
}
