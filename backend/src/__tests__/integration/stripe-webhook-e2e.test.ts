/**
 * Stripe Webhook E2E Test
 * 
 * Full end-to-end test of the complete billing flow:
 * Webhook → Signature Validation → Balance Update → Transaction Log
 */

import { generateWebhookSignature, sendTestWebhook } from '../../scripts/test-stripe-webhook-delivery';
import { supabaseAdmin } from '../../config/supabase';
import * as crypto from 'crypto';

const TEST_ORG_ID = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';

describe('Stripe Webhook E2E Tests', () => {
  
  it('should process checkout.session.completed webhook and credit wallet', async () => {
    const balanceBefore = await getWalletBalance(TEST_ORG_ID);
    
    const event = {
      type: 'checkout.session.completed',
      id: `evt_test_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_abc123',
          client_reference_id: TEST_ORG_ID,
          amount_total: 5000,
          currency: 'gbp'
        }
      }
    };
    
    const response = await sendTestWebhook(event);
    expect(response.status).toBe(200);
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const balanceAfter = await getWalletBalance(TEST_ORG_ID);
    expect(balanceAfter).toBe(balanceBefore + 5000);
  });
  
  it('should handle duplicate webhooks (idempotency)', async () => {
    const event = {
      type: 'checkout.session.completed',
      id: `evt_test_duplicate_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_dup',
          client_reference_id: TEST_ORG_ID,
          amount_total: 3000,
          currency: 'gbp'
        }
      }
    };
    
    const balanceBefore = await getWalletBalance(TEST_ORG_ID);
    
    // Send same event twice
    const response1 = await sendTestWebhook(event);
    expect(response1.status).toBe(200);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const balanceAfterFirst = await getWalletBalance(TEST_ORG_ID);
    expect(balanceAfterFirst).toBe(balanceBefore + 3000);
    
    // Send duplicate
    const response2 = await sendTestWebhook(event);
    expect(response2.status).toBe(200);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const balanceAfterSecond = await getWalletBalance(TEST_ORG_ID);
    // Should be same as after first (no double credit)
    expect(balanceAfterSecond).toBe(balanceAfterFirst);
  });
  
  it('should reject webhook with invalid signature', async () => {
    const event = {
      type: 'checkout.session.completed',
      id: `evt_test_invalid_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_invalid',
          client_reference_id: TEST_ORG_ID,
          amount_total: 2000,
          currency: 'gbp'
        }
      }
    };
    
    const payload = JSON.stringify(event);
    const invalidSignature = 't=invalid,v1=invalidsignature';
    
    const response = await fetch('http://localhost:3001/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': invalidSignature
      },
      body: payload
    });
    
    expect(response.status).toBe(401);
  });
  
  it('should log transaction when webhook processed', async () => {
    const event = {
      type: 'checkout.session.completed',
      id: `evt_test_tx_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_tx',
          client_reference_id: TEST_ORG_ID,
          amount_total: 7500,
          currency: 'gbp'
        }
      }
    };
    
    const response = await sendTestWebhook(event);
    expect(response.status).toBe(200);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check transaction was logged
    const { data: transactions } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('org_id', TEST_ORG_ID)
      .eq('stripe_session_id', 'cs_test_tx')
      .order('created_at', { ascending: false })
      .limit(1);
    
    expect(transactions).toBeDefined();
    expect(transactions!.length).toBeGreaterThan(0);
    expect(transactions![0].amount_pence).toBe(7500);
    expect(transactions![0].transaction_type).toBe('topup');
  });
});

async function getWalletBalance(orgId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('wallet_balance_pence')
    .eq('id', orgId)
    .maybeSingle();
  
  return data?.wallet_balance_pence || 0;
}
