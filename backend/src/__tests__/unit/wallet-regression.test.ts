/**
 * Wallet Service Regression Tests
 *
 * Covers the three critical billing race-condition / idempotency paths
 * that have caused (or could cause) real revenue loss:
 *
 *   1. Zero-duration calls must not touch the DB
 *   2. Duplicate asset deduction (same idempotency key) must be a no-op
 *   3. Insufficient-balance rejection fires a Slack alert
 *   4. Debt-limit exceeded fires a Slack alert + enqueues auto-recharge
 *
 * All external dependencies (Supabase, Slack, BullMQ) are mocked so these
 * tests run without any network access.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock external modules before importing the module under test
// ---------------------------------------------------------------------------

const mockRpc = jest.fn();
// A chainable builder that returns itself for all query methods,
// ending with .single() / .maybeSingle() returning null data by default.
function makeQueryChain(overrides: Record<string, any> = {}) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  // Make each method return the same chain object (fluent)
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

const mockFrom = jest.fn(() => makeQueryChain());

jest.mock('../../services/supabase-client', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

const mockSendSlackAlert = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/slack-alerts', () => ({
  sendSlackAlert: mockSendSlackAlert,
}));

const mockEnqueueAutoRechargeJob = jest.fn().mockResolvedValue(undefined);
jest.mock('../../config/wallet-queue', () => ({
  enqueueAutoRechargeJob: mockEnqueueAutoRechargeJob,
}));

jest.mock('../../config', () => ({
  config: {
    RATE_PER_MINUTE_USD_CENTS: 70,
    USD_TO_GBP_RATE: '0.79',
    WALLET_LOW_BALANCE_WARNING_CENTS: 500,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up
// ---------------------------------------------------------------------------

import { deductCallCredits, deductAssetCost } from '../../services/wallet-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'test-org-uuid';
const CALL_ID = 'test-call-uuid';
const VAPI_CALL_ID = 'test-vapi-uuid';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Zero-duration calls
// ---------------------------------------------------------------------------

describe('deductCallCredits — zero duration', () => {
  it('returns success immediately without calling the DB RPC', async () => {
    const result = await deductCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 0, 0, null);

    expect(result.success).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns success for negative duration without calling the DB RPC', async () => {
    const result = await deductCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, -5, 0, null);

    expect(result.success).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. deductAssetCost — idempotency (duplicate_request)
// ---------------------------------------------------------------------------

describe('deductAssetCost — duplicate idempotency key', () => {
  it('returns duplicate:true and does NOT fire a Slack alert', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'duplicate_request' },
      error: null,
    });

    const result = await deductAssetCost(
      ORG_ID,
      1000,
      'phone_number',
      'Phone number purchase',
      'idem-key-123'
    );

    expect(result.success).toBe(false);
    expect(result.duplicate).toBe(true);
    // No Slack alert for idempotent duplicates
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. deductAssetCost — insufficient balance fires Slack alert
// ---------------------------------------------------------------------------

describe('deductAssetCost — insufficient balance', () => {
  it('returns success:false and fires Slack alert when org cannot afford asset', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'insufficient_balance',
        balance_pence: 250,
        required_pence: 1000,
        shortfall_pence: 750,
      },
      error: null,
    });

    const result = await deductAssetCost(
      ORG_ID,
      1000,
      'phone_number',
      'Phone number purchase',
      'idem-key-456'
    );

    expect(result.success).toBe(false);
    expect(result.duplicate).toBe(false);
    expect(result.shortfallPence).toBe(750);

    // Slack alert must fire — billing team needs to know
    expect(mockSendSlackAlert).toHaveBeenCalledTimes(1);
    const [title, details] = mockSendSlackAlert.mock.calls[0] as [string, any];
    expect(title).toMatch(/Asset Purchase Rejected/i);
    expect(details.orgId).toBe(ORG_ID);
    expect(details.assetType).toBe('phone_number');
  });

  it('does NOT fire Slack alert when RPC itself errors (system error, not balance issue)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection timeout' },
    });

    const result = await deductAssetCost(
      ORG_ID,
      1000,
      'phone_number',
      'Phone number purchase',
      'idem-key-789'
    );

    expect(result.success).toBe(false);
    // RPC error is a system problem, not a billing event — no Slack for that path
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. deductCallCredits — debt limit exceeded fires Slack + enqueues recharge
// ---------------------------------------------------------------------------

describe('deductCallCredits — debt limit exceeded', () => {
  it('fires Slack alert when debt limit is exceeded', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'debt_limit_exceeded',
        current_balance: -200,
        debt_limit: -100,
        attempted_deduction: 55,
        new_balance_would_be: -255,
        amount_over_limit: 155,
        message: 'Debt limit exceeded',
      },
      error: null,
    });

    // checkBalance call (auto-recharge trigger) — return no auto-recharge enabled
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        single: jest.fn().mockResolvedValue({
          data: {
            wallet_balance_pence: -200,
            wallet_low_balance_pence: 500,
            wallet_auto_recharge: false,
            stripe_default_pm_id: null,
          },
          error: null,
        }),
      })
    );

    const result = await deductCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 60, 0.7, null);

    expect(result.success).toBe(false);
    expect(result.needsRecharge).toBe(true);

    // Slack alert must fire
    expect(mockSendSlackAlert).toHaveBeenCalledTimes(1);
    const [title, details] = mockSendSlackAlert.mock.calls[0] as [string, any];
    expect(title).toMatch(/Debt Limit Exceeded/i);
    expect(details.orgId).toBe(ORG_ID);
  });

  it('enqueues auto-recharge when debt limit exceeded AND auto-recharge is enabled', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'debt_limit_exceeded',
        current_balance: -200,
        debt_limit: -100,
        attempted_deduction: 55,
        new_balance_would_be: -255,
        amount_over_limit: 155,
        message: 'Debt limit exceeded',
      },
      error: null,
    });

    // checkBalance returns auto-recharge enabled + payment method
    mockFrom.mockReturnValueOnce(
      makeQueryChain({
        single: jest.fn().mockResolvedValue({
          data: {
            wallet_balance_pence: -200,
            wallet_low_balance_pence: 500,
            wallet_auto_recharge: true,
            stripe_default_pm_id: 'pm_test_123',
          },
          error: null,
        }),
      })
    );

    await deductCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 60, 0.7, null);

    // Auto-recharge must be enqueued
    expect(mockEnqueueAutoRechargeJob).toHaveBeenCalledWith({ orgId: ORG_ID });
  });
});

// ---------------------------------------------------------------------------
// 5. deductCallCredits — successful deduction (happy path sanity check)
// ---------------------------------------------------------------------------

describe('deductCallCredits — successful deduction', () => {
  it('returns the balance values from the RPC on success', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        transaction_id: 'tx-uuid',
        balance_before: 5000,
        balance_after: 4945,
        client_charged_pence: 55,
        provider_cost_pence: 39,
        gross_profit_pence: 16,
        needs_recharge: false,
      },
      error: null,
    });

    const result = await deductCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 60, 0.7, null);

    expect(result.success).toBe(true);
    expect(result.balanceBefore).toBe(5000);
    expect(result.balanceAfter).toBe(4945);
    expect(result.clientChargedPence).toBe(55);
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
    expect(mockEnqueueAutoRechargeJob).not.toHaveBeenCalled();
  });

  it('handles idempotent duplicate gracefully', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { duplicate: true, success: true },
      error: null,
    });

    const result = await deductCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 60, 0.7, null);

    expect(result.success).toBe(true);
    expect((result as any).duplicate).toBe(true);
    expect(mockSendSlackAlert).not.toHaveBeenCalled();
  });
});
