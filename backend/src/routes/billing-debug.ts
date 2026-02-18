import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Billing Debug Endpoint
 *
 * GET /api/billing-debug/:callId
 *
 * Returns complete billing state for any call:
 * - Call record details
 * - Credit reservation (if exists)
 * - Credit transaction (if exists)
 * - Organization wallet state
 * - Billing status summary
 */
router.get('/:callId', requireAuth, async (req, res) => {
  try {
    const { callId } = req.params;

    // 1. Get call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .maybeSingle();

    if (callError) {
      return res.status(500).json({ error: 'Failed to fetch call', details: callError.message });
    }

    if (!call) {
      return res.status(404).json({ error: 'Call not found', callId });
    }

    // 2. Get credit reservation (if exists)
    const { data: reservation } = await supabase
      .from('credit_reservations')
      .select('*')
      .eq('call_id', callId)
      .maybeSingle();

    // 3. Get credit transaction (if exists)
    const { data: transaction } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('call_id', callId)
      .maybeSingle();

    // 4. Get org wallet state
    const { data: org } = await supabase
      .from('organizations')
      .select('id, email, wallet_balance_pence, debt_limit_pence')
      .eq('id', call.org_id)
      .maybeSingle();

    // 5. Build response
    return res.json({
      call: {
        id: call.id,
        org_id: call.org_id,
        vapi_call_id: call.vapi_call_id,
        duration_seconds: call.duration_seconds,
        cost_cents: call.cost_cents,
        status: call.status,
        call_direction: call.call_direction,
        created_at: call.created_at,
        ended_at: call.ended_at
      },
      reservation: reservation ? {
        id: reservation.id,
        reserved_pence: reservation.reserved_pence,
        committed_pence: reservation.committed_pence,
        status: reservation.status,
        created_at: reservation.created_at,
        expires_at: reservation.expires_at
      } : null,
      transaction: transaction ? {
        id: transaction.id,
        amount_pence: transaction.amount_pence,
        balance_before: transaction.balance_before_pence,
        balance_after: transaction.balance_after_pence,
        transaction_type: transaction.transaction_type,
        created_at: transaction.created_at
      } : null,
      organization: org ? {
        id: org.id,
        email: org.email,
        current_balance_pence: org.wallet_balance_pence,
        debt_limit_pence: org.debt_limit_pence
      } : null,
      billing_status: {
        reservation_created: !!reservation,
        reservation_committed: reservation?.status === 'committed',
        transaction_recorded: !!transaction,
        credits_deducted: !!transaction && transaction.amount_pence < 0,
        summary: getBillingSummary(call, reservation, transaction)
      }
    });
  } catch (error: any) {
    console.error('Billing debug error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * Get all calls for an organization with billing status
 *
 * GET /api/billing-debug/org/:orgId
 */
router.get('/org/:orgId', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;

    // Enforce org ownership — prevent cross-org data access
    if (req.user?.orgId !== orgId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    // Get recent calls for org
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (callsError) {
      return res.status(500).json({ error: 'Failed to fetch calls', details: callsError.message });
    }

    // Get all reservations for these calls
    const callIds = calls.map(c => c.id);
    const { data: reservations } = await supabase
      .from('credit_reservations')
      .select('*')
      .in('call_id', callIds);

    // Get all transactions for these calls
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .in('call_id', callIds);

    // Build map for quick lookup
    const reservationMap = new Map(reservations?.map(r => [r.call_id, r]) || []);
    const transactionMap = new Map(transactions?.map(t => [t.call_id, t]) || []);

    // Enrich calls with billing status
    const enrichedCalls = calls.map(call => {
      const reservation = reservationMap.get(call.id);
      const transaction = transactionMap.get(call.id);

      return {
        id: call.id,
        vapi_call_id: call.vapi_call_id,
        duration_seconds: call.duration_seconds,
        cost_cents: call.cost_cents,
        status: call.status,
        call_direction: call.call_direction,
        created_at: call.created_at,
        billing_status: {
          reservation_created: !!reservation,
          reservation_committed: reservation?.status === 'committed',
          transaction_recorded: !!transaction,
          credits_deducted: !!transaction && transaction.amount_pence < 0,
          summary: getBillingSummary(call, reservation, transaction)
        }
      };
    });

    return res.json({
      org_id: orgId,
      total_calls: enrichedCalls.length,
      calls: enrichedCalls
    });
  } catch (error: any) {
    console.error('Billing debug org error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

function getBillingSummary(call: any, reservation: any, transaction: any): string {
  if (!call) return 'No call data';

  if (transaction && transaction.amount_pence < 0) {
    return `✅ Credits deducted: ${Math.abs(transaction.amount_pence)}p`;
  }

  if (reservation?.status === 'committed') {
    return `✅ Reservation committed: ${reservation.committed_pence}p`;
  }

  if (reservation?.status === 'pending') {
    return `⏳ Reservation pending: ${reservation.reserved_pence}p`;
  }

  if (reservation?.status === 'released') {
    return `🔄 Reservation released (no charge)`;
  }

  if (call.duration_seconds === 0 || call.duration_seconds === null) {
    return `⚠️ Zero duration - billing likely skipped`;
  }

  return `❌ No billing record found`;
}

export default router;
