/**
 * Webhook Processing Verification API
 *
 * Provides endpoints to verify that Stripe webhooks have been processed
 * and wallet credits have been applied. Prevents silent failures where
 * customer is charged but wallet not credited.
 *
 * Created: 2026-02-11 (Priority Fix #3)
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import { log } from '../services/logger';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/webhook-verification/payment/:paymentIntentId
 *
 * Verifies that a Stripe payment has been processed and wallet credited.
 * Used after successful Stripe checkout to confirm credits were applied.
 *
 * Returns:
 * - processed: true/false (webhook received and processed)
 * - wallet_credited: true/false (credits added to wallet)
 * - amount_pence: number (amount credited)
 * - transaction_id: string (credit transaction ID)
 * - processing_time_ms: number (webhook → credit delay)
 */
router.get(
  '/payment/:paymentIntentId',
  requireAuth,
  async (req: Request, res: Response) => {
    const { paymentIntentId } = req.params;
    const orgId = (req as any).user?.orgId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return res.status(400).json({ error: 'Invalid payment intent ID' });
    }

    try {
      // Step 1: Check if webhook was received and processed
      const { data: webhookEvent, error: webhookError } = await supabase
        .from('processed_webhook_events')
        .select('id, event_id, event_type, processed_at')
        .eq('event_type', 'checkout.session.completed')
        .like('event_data->>payment_intent', `%${paymentIntentId}%`)
        .single();

      if (webhookError && webhookError.code !== 'PGRST116') {
        // PGRST116 = no rows, which is expected if webhook not yet processed
        log.error('WebhookVerification', 'Database error checking webhook', {
          error: webhookError.message,
          paymentIntentId,
        });
      }

      // Step 2: Check if credits were added to wallet
      const { data: creditTransaction, error: creditError } = await supabase
        .from('credit_transactions')
        .select(
          'id, amount_pence, created_at, stripe_payment_intent_id, balance_after_pence'
        )
        .eq('org_id', orgId)
        .eq('stripe_payment_intent_id', paymentIntentId)
        .eq('type', 'topup')
        .single();

      if (creditError && creditError.code !== 'PGRST116') {
        log.error('WebhookVerification', 'Database error checking credits', {
          error: creditError.message,
          paymentIntentId,
        });
      }

      // Step 3: Calculate processing time (webhook → credit)
      let processingTimeMs: number | null = null;
      if (webhookEvent && creditTransaction) {
        const webhookTime = new Date(webhookEvent.processed_at).getTime();
        const creditTime = new Date(creditTransaction.created_at).getTime();
        processingTimeMs = creditTime - webhookTime;
      }

      // Step 4: Build response
      const processed = !!webhookEvent;
      const walletCredited = !!creditTransaction;

      const response = {
        processed,
        wallet_credited: walletCredited,
        payment_intent_id: paymentIntentId,
        amount_pence: creditTransaction?.amount_pence || null,
        transaction_id: creditTransaction?.id || null,
        balance_after_pence: creditTransaction?.balance_after_pence || null,
        processing_time_ms: processingTimeMs,
        webhook_received_at: webhookEvent?.processed_at || null,
        credits_applied_at: creditTransaction?.created_at || null,
        status:
          processed && walletCredited
            ? 'complete'
            : processed && !walletCredited
            ? 'processing'
            : !processed && !walletCredited
            ? 'pending'
            : 'unknown',
      };

      log.info('WebhookVerification', 'Payment verification result', {
        paymentIntentId,
        orgId,
        status: response.status,
        processingTimeMs,
      });

      res.json(response);
    } catch (error: any) {
      log.error('WebhookVerification', 'Error verifying payment', {
        error: error.message,
        paymentIntentId,
      });
      res.status(500).json({ error: 'Failed to verify payment processing' });
    }
  }
);

/**
 * GET /api/webhook-verification/recent-transactions
 *
 * Returns recent credit transactions for the authenticated organization.
 * Used to verify that top-ups are being processed correctly.
 *
 * Query params:
 * - limit: number (default: 10, max: 50)
 */
router.get(
  '/recent-transactions',
  requireAuth,
  async (req: Request, res: Response) => {
    const orgId = (req as any).user?.orgId;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { data: transactions, error } = await supabase
        .from('credit_transactions')
        .select(
          'id, amount_pence, type, description, stripe_payment_intent_id, created_at, balance_before_pence, balance_after_pence'
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        log.error('WebhookVerification', 'Error fetching transactions', {
          error: error.message,
          orgId,
        });
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }

      res.json({
        transactions: transactions || [],
        count: transactions?.length || 0,
      });
    } catch (error: any) {
      log.error('WebhookVerification', 'Error in recent-transactions', {
        error: error.message,
        orgId,
      });
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

/**
 * GET /api/webhook-verification/health
 *
 * Health check for webhook processing system.
 * Returns metrics about webhook processing performance.
 */
router.get('/health', requireAuth, async (req: Request, res: Response) => {
  try {
    // Count webhooks processed in last 24 hours
    const { count: webhooksCount, error: webhooksError } = await supabase
      .from('processed_webhook_events')
      .select('*', { count: 'exact', head: true })
      .gte('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Count credits added in last 24 hours
    const { count: creditsCount, error: creditsError } = await supabase
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'topup')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (webhooksError || creditsError) {
      log.error('WebhookVerification', 'Error in health check', {
        webhooksError: webhooksError?.message,
        creditsError: creditsError?.message,
      });
    }

    res.json({
      status: 'healthy',
      metrics: {
        webhooks_processed_24h: webhooksCount || 0,
        credits_added_24h: creditsCount || 0,
        webhook_credit_ratio:
          webhooksCount && creditsCount ? creditsCount / webhooksCount : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('WebhookVerification', 'Error in health check', {
      error: error.message,
    });
    res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;
