/**
 * TestSprite Test Suite: Billing & Wallet System
 *
 * Tests:
 * - Stripe Checkout flow
 * - Wallet top-up functionality
 * - Prepaid credit deduction after calls
 * - Kill switch (automatic call termination on zero balance)
 * - Credit reservation system
 * - Billing transaction audit trail
 *
 * Test Account: test@demo.com / demo123
 * Test Rate: 56 pence/minute GBP
 */

import { describe, it, beforeEach, afterEach } from '@testsprite/core';
import { expect } from '@testsprite/assertions';
import { TestContext, BrowserContext } from '@testsprite/types';

describe('Billing & Wallet System', () => {
  let context: TestContext;
  let browser: BrowserContext;
  let testOrgId: string;

  beforeEach(async () => {
    context = await TestSprite.createContext();
    browser = await context.newBrowser();
    testOrgId = await context.getTestOrgId();
  });

  afterEach(async () => {
    await browser.close();
    await context.cleanup();
  });

  describe('Stripe Checkout Flow', () => {
    it('should complete wallet top-up via Stripe', async () => {
      const page = await browser.newPage();

      // Login
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to wallet page
      await page.goto('/dashboard/wallet');
      await page.waitForSelector('.wallet-balance', { timeout: 5000 });

      // Get current balance
      const balanceBefore = await page.textContent('.wallet-balance');
      const balanceBeforePence = parseInt(balanceBefore!.replace(/[£,]/g, '')) * 100;

      // Click £25 top-up button
      await page.click('button[data-amount="2500"]');

      // Handle Stripe Checkout
      await context.handleStripeCheckout({
        cardNumber: '4242424242424242',
        expiry: '12/30',
        cvc: '123',
        postalCode: 'SW1A 1AA'
      });

      // Wait for redirect back to wallet page
      await page.waitForNavigation({ timeout: 20000 });
      expect(page.url()).toContain('/dashboard/wallet');

      // Wait for balance to update (webhook processing)
      await page.waitForTimeout(5000);

      // Reload to get latest balance
      await page.reload();
      await page.waitForSelector('.wallet-balance', { timeout: 5000 });

      // Verify balance increased by £25 (2500 pence)
      const balanceAfter = await page.textContent('.wallet-balance');
      const balanceAfterPence = parseInt(balanceAfter!.replace(/[£,]/g, '')) * 100;

      expect(balanceAfterPence).toBe(balanceBeforePence + 2500);

      // Verify transaction in database
      const txResult = await context.database.query({
        sql: `SELECT amount_pence, type, balance_after_pence
              FROM credit_transactions
              WHERE org_id = $1 AND type = 'topup'
              ORDER BY created_at DESC LIMIT 1`,
        params: [testOrgId]
      });

      expect(txResult.rows).toHaveLength(1);
      expect(txResult.rows[0].amount_pence).toBe(2500);
      expect(txResult.rows[0].balance_after_pence).toBe(balanceAfterPence);

      // Take screenshot
      await page.screenshot({
        path: './test-results/screenshots/wallet-topup-success.png'
      });
    });

    it('should enforce minimum top-up amount (£25)', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      await page.goto('/dashboard/wallet');

      // Verify no button for amounts < £25
      const buttons = await page.$$('button[data-amount]');
      const amounts = await Promise.all(
        buttons.map(btn => btn.getAttribute('data-amount'))
      );

      // All amounts should be >= 2500 pence
      amounts.forEach(amount => {
        expect(parseInt(amount!)).toBeGreaterThanOrEqual(2500);
      });
    });

    it('should handle Stripe checkout cancellation', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      await page.goto('/dashboard/wallet');

      const balanceBefore = await page.textContent('.wallet-balance');

      // Click top-up
      await page.click('button[data-amount="2500"]');

      // Cancel Stripe checkout
      await context.handleStripeCheckout({
        cancel: true
      });

      // Should return to wallet page
      await page.waitForNavigation({ timeout: 10000 });

      // Balance should be unchanged
      const balanceAfter = await page.textContent('.wallet-balance');
      expect(balanceAfter).toBe(balanceBefore);
    });
  });

  describe('Prepaid Credit Deduction', () => {
    beforeEach(async () => {
      // Add 500 pence (£5.00) to test account
      await context.database.execute({
        sql: `UPDATE organizations
              SET wallet_balance_pence = 500
              WHERE id = $1`,
        params: [testOrgId]
      });
    });

    it('should deduct credits automatically after call ends', async () => {
      const callId = `call_test_${Date.now()}`;
      const durationSeconds = 120; // 2 minutes
      const expectedCost = 112; // 2 min × 56 pence/min = 112 pence

      // Simulate Vapi webhook: call.ended
      const webhookResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/webhooks/vapi',
        headers: {
          'x-vapi-signature': context.generateVapiSignature({
            type: 'call.ended',
            callId: callId
          })
        },
        body: {
          type: 'call.ended',
          call: {
            id: callId,
            orgId: testOrgId,
            duration: durationSeconds,
            status: 'completed',
            endedReason: 'assistant-ended-call'
          },
          cost: {
            costInMinutes: 2.0,
            costInCents: expectedCost
          }
        }
      });

      expect(webhookResponse.status).toBe(200);

      // Wait for processing
      await context.waitFor(2000);

      // Verify balance deducted
      const balanceResult = await context.database.query({
        sql: `SELECT wallet_balance_pence FROM organizations WHERE id = $1`,
        params: [testOrgId]
      });

      const newBalance = balanceResult.rows[0].wallet_balance_pence;
      expect(newBalance).toBe(500 - expectedCost); // 500 - 112 = 388 pence

      // Verify transaction logged
      const txResult = await context.database.query({
        sql: `SELECT amount_pence, type, call_id, vapi_call_id
              FROM credit_transactions
              WHERE org_id = $1 AND call_id = $2`,
        params: [testOrgId, callId]
      });

      expect(txResult.rows).toHaveLength(1);
      expect(txResult.rows[0].amount_pence).toBe(-expectedCost);
      expect(txResult.rows[0].type).toBe('call_deduction');
      expect(txResult.rows[0].call_id).toBe(callId);

      // Verify in dashboard
      const page = await browser.newPage();
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      await page.goto('/dashboard/wallet');
      await page.waitForSelector('.wallet-balance', { timeout: 5000 });

      const displayedBalance = await page.textContent('.wallet-balance');
      expect(displayedBalance).toBe('£3.88'); // 388 pence = £3.88
    });

    it('should prevent duplicate billing via idempotency', async () => {
      const callId = `call_idempotency_${Date.now()}`;

      // Send webhook twice with same call_id
      const webhook1 = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/webhooks/vapi',
        headers: {
          'x-vapi-signature': context.generateVapiSignature({
            type: 'call.ended',
            callId: callId
          })
        },
        body: {
          type: 'call.ended',
          call: {
            id: callId,
            orgId: testOrgId,
            duration: 60,
            status: 'completed'
          },
          cost: {
            costInCents: 56 // 1 min × 56 pence
          }
        }
      });

      expect(webhook1.status).toBe(200);

      // Wait a bit
      await context.waitFor(1000);

      // Send again
      const webhook2 = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/webhooks/vapi',
        headers: {
          'x-vapi-signature': context.generateVapiSignature({
            type: 'call.ended',
            callId: callId
          })
        },
        body: {
          type: 'call.ended',
          call: {
            id: callId,
            orgId: testOrgId,
            duration: 60,
            status: 'completed'
          },
          cost: {
            costInCents: 56
          }
        }
      });

      expect(webhook2.status).toBe(200);

      // Verify only 1 transaction created
      const txResult = await context.database.query({
        sql: `SELECT COUNT(*) as count
              FROM credit_transactions
              WHERE org_id = $1 AND call_id = $2`,
        params: [testOrgId, callId]
      });

      expect(txResult.rows[0].count).toBe(1);

      // Verify balance deducted only once
      const balanceResult = await context.database.query({
        sql: `SELECT wallet_balance_pence FROM organizations WHERE id = $1`,
        params: [testOrgId]
      });

      expect(balanceResult.rows[0].wallet_balance_pence).toBe(500 - 56); // 444 pence
    });
  });

  describe('Kill Switch (Zero Balance Protection)', () => {
    beforeEach(async () => {
      // Set low balance (50 pence)
      await context.database.execute({
        sql: `UPDATE organizations
              SET wallet_balance_pence = 50
              WHERE id = $1`,
        params: [testOrgId]
      });
    });

    it('should terminate call when balance reaches zero', async () => {
      const callId = `call_killswitch_${Date.now()}`;

      // Simulate Vapi status check during active call (30 seconds elapsed)
      const statusResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi/webhook/status-check',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          call: {
            id: callId,
            orgId: testOrgId,
            duration: 30, // 30 seconds
            status: 'in-progress'
          }
        }
      });

      expect(statusResponse.status).toBe(200);

      // With 50 pence balance and 56 pence/min rate:
      // 50 pence = 0.89 minutes = 53.5 seconds of talk time
      // After 30 seconds, ~20 seconds remaining
      // Kill switch should NOT trigger yet
      expect(statusResponse.body.endCall).toBe(false);

      // Simulate status check after 60 seconds (cost = 56 pence)
      const statusResponse2 = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi/webhook/status-check',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          call: {
            id: callId,
            orgId: testOrgId,
            duration: 60, // 60 seconds
            status: 'in-progress'
          }
        }
      });

      // Kill switch SHOULD trigger (60 sec = 56 pence, exceeds 50 pence balance)
      expect(statusResponse2.status).toBe(200);
      expect(statusResponse2.body.endCall).toBe(true);
      expect(statusResponse2.body.message).toMatch(/insufficient credits|low balance/i);
    });

    it('should send warning before termination', async () => {
      const callId = `call_warning_${Date.now()}`;

      // Set balance to exactly 1 minute worth (56 pence)
      await context.database.execute({
        sql: `UPDATE organizations
              SET wallet_balance_pence = 56
              WHERE id = $1`,
        params: [testOrgId]
      });

      // Status check at 45 seconds (close to limit)
      const statusResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi/webhook/status-check',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          call: {
            id: callId,
            orgId: testOrgId,
            duration: 45,
            status: 'in-progress'
          }
        }
      });

      // Should send warning but not end call yet
      expect(statusResponse.body.endCall).toBe(false);
      expect(statusResponse.body.warning).toBeTruthy();
      expect(statusResponse.body.warning.message).toMatch(/running low|top up soon/i);
      expect(statusResponse.body.warning.remainingMinutes).toBeLessThan(1);
    });
  });

  describe('Credit Reservation System', () => {
    beforeEach(async () => {
      // Set balance to 500 pence
      await context.database.execute({
        sql: `UPDATE organizations
              SET wallet_balance_pence = 500
              WHERE id = $1`,
        params: [testOrgId]
      });
    });

    it('should reserve credits when call starts', async () => {
      const callId = `call_reservation_${Date.now()}`;

      // Simulate call.started webhook
      const webhookResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/webhooks/vapi',
        headers: {
          'x-vapi-signature': context.generateVapiSignature({
            type: 'call.started',
            callId: callId
          })
        },
        body: {
          type: 'call.started',
          call: {
            id: callId,
            orgId: testOrgId,
            status: 'in-progress'
          }
        }
      });

      expect(webhookResponse.status).toBe(200);

      // Wait for processing
      await context.waitFor(1000);

      // Verify reservation created (5 min default = 280 pence)
      const reservationResult = await context.database.query({
        sql: `SELECT reserved_pence, status
              FROM credit_reservations
              WHERE org_id = $1 AND call_id = $2`,
        params: [testOrgId, callId]
      });

      expect(reservationResult.rows).toHaveLength(1);
      expect(reservationResult.rows[0].reserved_pence).toBe(280); // 5 min × 56 pence
      expect(reservationResult.rows[0].status).toBe('active');

      // Verify effective balance reduced
      const effectiveBalance = await context.database.query({
        sql: `SELECT
                o.wallet_balance_pence - COALESCE(SUM(r.reserved_pence), 0) as effective_balance
              FROM organizations o
              LEFT JOIN credit_reservations r
                ON r.org_id = o.id AND r.status = 'active'
              WHERE o.id = $1
              GROUP BY o.id, o.wallet_balance_pence`,
        params: [testOrgId]
      });

      expect(effectiveBalance.rows[0].effective_balance).toBe(500 - 280); // 220 pence
    });

    it('should commit reservation and release unused credits when call ends', async () => {
      const callId = `call_commit_${Date.now()}`;

      // Create reservation (5 min = 280 pence)
      await context.database.execute({
        sql: `INSERT INTO credit_reservations
              (org_id, call_id, reserved_pence, status, expires_at)
              VALUES ($1, $2, 280, 'active', NOW() + INTERVAL '5 minutes')`,
        params: [testOrgId, callId]
      });

      // Simulate call.ended webhook (actual duration: 2 min = 112 pence)
      const webhookResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/webhooks/vapi',
        headers: {
          'x-vapi-signature': context.generateVapiSignature({
            type: 'call.ended',
            callId: callId
          })
        },
        body: {
          type: 'call.ended',
          call: {
            id: callId,
            orgId: testOrgId,
            duration: 120, // 2 minutes
            status: 'completed'
          },
          cost: {
            costInCents: 112
          }
        }
      });

      expect(webhookResponse.status).toBe(200);

      await context.waitFor(2000);

      // Verify reservation committed
      const reservationResult = await context.database.query({
        sql: `SELECT status, committed_pence
              FROM credit_reservations
              WHERE org_id = $1 AND call_id = $2`,
        params: [testOrgId, callId]
      });

      expect(reservationResult.rows[0].status).toBe('committed');
      expect(reservationResult.rows[0].committed_pence).toBe(112);

      // Verify balance deducted correctly (500 - 112 = 388)
      const balanceResult = await context.database.query({
        sql: `SELECT wallet_balance_pence FROM organizations WHERE id = $1`,
        params: [testOrgId]
      });

      expect(balanceResult.rows[0].wallet_balance_pence).toBe(388);

      // Verify transaction created
      const txResult = await context.database.query({
        sql: `SELECT amount_pence, type
              FROM credit_transactions
              WHERE org_id = $1 AND call_id = $2`,
        params: [testOrgId, callId]
      });

      expect(txResult.rows).toHaveLength(1);
      expect(txResult.rows[0].amount_pence).toBe(-112);
      expect(txResult.rows[0].type).toBe('call_deduction');
    });
  });

  describe('Billing Audit Trail', () => {
    it('should maintain complete transaction history', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      await page.goto('/dashboard/wallet');
      await page.waitForSelector('.transaction-history', { timeout: 5000 });

      // Verify transaction table exists
      await expect(page).toHaveElement('table.transactions-table');

      // Verify columns
      const headers = await page.$$eval('thead th', (ths) =>
        ths.map(th => th.textContent)
      );

      expect(headers).toContain('Date');
      expect(headers).toContain('Type');
      expect(headers).toContain('Amount');
      expect(headers).toContain('Balance');

      // Verify transactions displayed
      const rows = await page.$$('tbody tr');
      expect(rows.length).toBeGreaterThan(0);

      // Take screenshot
      await page.screenshot({
        path: './test-results/screenshots/transaction-history.png',
        fullPage: true
      });
    });

    it('should show correct balance calculations', async () => {
      // Query all transactions
      const txResult = await context.database.query({
        sql: `SELECT amount_pence, balance_after_pence
              FROM credit_transactions
              WHERE org_id = $1
              ORDER BY created_at ASC`,
        params: [testOrgId]
      });

      // Verify balance_after calculations are correct
      let runningBalance = 0;

      txResult.rows.forEach((tx: any) => {
        runningBalance += tx.amount_pence;
        expect(tx.balance_after_pence).toBe(runningBalance);
      });

      // Verify final balance matches organization table
      const orgResult = await context.database.query({
        sql: `SELECT wallet_balance_pence FROM organizations WHERE id = $1`,
        params: [testOrgId]
      });

      expect(orgResult.rows[0].wallet_balance_pence).toBe(runningBalance);
    });
  });
});
