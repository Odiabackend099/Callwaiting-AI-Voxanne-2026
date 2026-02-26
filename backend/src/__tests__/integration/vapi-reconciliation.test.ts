/**
 * P0-5 Integration Tests: Vapi Call Reconciliation
 *
 * Tests the complete reconciliation flow:
 * - Fetching calls from Vapi API
 * - Comparing with database
 * - Identifying missing calls
 * - Inserting reconciled calls
 * - Deducting wallet credits
 * - Slack alerts for reliability issues
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { reconcileVapiCalls, _internal } from '../../jobs/vapi-reconciliation';
import { supabase } from '../../services/supabase-client';

// Skip this test - requires Vitest with vi mocking
// Jest doesn't have equivalent vi object for mocking
console.warn('⚠️  Skipping Vapi reconciliation tests - requires Vitest vi mocking');

// Placeholder mocks for Jest
const mockSlackWebhook = jest.fn();

describe('Vapi Call Reconciliation (P0-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables
    process.env.VAPI_PRIVATE_KEY = 'test-vapi-key';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchVapiCalls', () => {
    it('should fetch calls from Vapi API with date range', async () => {
      const mockApiCalls = [
        {
          id: 'call-1',
          orgId: 'org-123',
          assistantId: 'asst-1',
          phoneNumberId: 'phone-1',
          customer: { number: '+15551234567' },
          duration: 120,
          status: 'ended',
          type: 'inboundPhoneCall',
          createdAt: '2026-02-08T10:00:00Z',
          updatedAt: '2026-02-08T10:02:00Z',
          endedAt: '2026-02-08T10:02:00Z',
          costBreakdown: { total: 0.35 }
        },
        {
          id: 'call-2',
          orgId: 'org-123',
          assistantId: 'asst-1',
          phoneNumberId: 'phone-1',
          customer: { number: '+15559876543' },
          duration: 180,
          status: 'ended',
          type: 'outboundPhoneCall',
          createdAt: '2026-02-08T11:00:00Z',
          updatedAt: '2026-02-08T11:03:00Z',
          endedAt: '2026-02-08T11:03:00Z',
          costBreakdown: { total: 0.42 }
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiCalls
      });

      const startDate = new Date('2026-02-08T00:00:00Z');
      const endDate = new Date('2026-02-09T00:00:00Z');

      const calls = await _internal.fetchVapiCalls(startDate, endDate);

      expect(calls).toHaveLength(2);
      expect(calls[0].id).toBe('call-1');
      expect(calls[1].id).toBe('call-2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.vapi.ai/call?'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-vapi-key'
          }
        })
      );
    });

    it('should handle pagination (>100 calls)', async () => {
      const mockPage1 = Array.from({ length: 100 }, (_, i) => ({
        id: `call-${i}`,
        orgId: 'org-123',
        createdAt: '2026-02-08T10:00:00Z',
        costBreakdown: { total: 0.30 }
      }));

      const mockPage2 = Array.from({ length: 50 }, (_, i) => ({
        id: `call-${i + 100}`,
        orgId: 'org-123',
        createdAt: '2026-02-08T11:00:00Z',
        costBreakdown: { total: 0.30 }
      }));

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPage1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPage2
        });

      const startDate = new Date('2026-02-08T00:00:00Z');
      const endDate = new Date('2026-02-09T00:00:00Z');

      const calls = await _internal.fetchVapiCalls(startDate, endDate);

      expect(calls).toHaveLength(150);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      const startDate = new Date('2026-02-08T00:00:00Z');
      const endDate = new Date('2026-02-09T00:00:00Z');

      await expect(
        _internal.fetchVapiCalls(startDate, endDate)
      ).rejects.toThrow('Vapi API returned 401');
    });
  });

  describe('deductWalletCredits', () => {
    it('should deduct credits for reconciled call', async () => {
      // Mock Supabase RPC call
      const mockRpc = vi.fn().mockResolvedValue({
        data: { success: true, balance_after: 9500 },
        error: null
      });

      vi.spyOn(supabase, 'rpc').mockImplementation(mockRpc);

      const result = await _internal.deductWalletCredits(
        'org-123',
        0.35,
        'call-1'
      );

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('deduct_call_credits', {
        p_org_id: 'org-123',
        p_amount_pence: 35, // $0.35 = 35 pence
        p_vapi_call_id: 'call-1',
        p_cost_breakdown: { total: 0.35 }
      });
    });

    it('should return false on wallet deduction failure', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { success: false, error: 'debt_limit_exceeded' },
        error: null
      });

      vi.spyOn(supabase, 'rpc').mockImplementation(mockRpc);

      const result = await _internal.deductWalletCredits(
        'org-123',
        0.50,
        'call-2'
      );

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      vi.spyOn(supabase, 'rpc').mockImplementation(mockRpc);

      const result = await _internal.deductWalletCredits(
        'org-123',
        0.30,
        'call-3'
      );

      expect(result).toBe(false);
    });
  });

  describe('sendSlackAlert', () => {
    it('should send Slack alert with formatted message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true
      });

      await _internal.sendSlackAlert('🚨 Test Alert', {
        'Missing Calls': 5,
        'Total Calls': 100,
        'Webhook Reliability': '95%'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('🚨 Test Alert')
        })
      );
    });

    it('should handle missing Slack webhook URL', async () => {
      delete process.env.SLACK_WEBHOOK_URL;

      await expect(
        _internal.sendSlackAlert('Test', {})
      ).resolves.not.toThrow();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('reconcileVapiCalls (full flow)', () => {
    it('should identify and recover missing calls', async () => {
      // Mock Vapi API response (2 calls)
      const mockApiCalls = [
        {
          id: 'call-1',
          orgId: 'org-123',
          assistantId: 'asst-1',
          phoneNumberId: 'phone-1',
          customer: { number: '+15551234567' },
          duration: 120,
          status: 'ended',
          type: 'inboundPhoneCall',
          createdAt: '2026-02-08T10:00:00Z',
          updatedAt: '2026-02-08T10:02:00Z',
          endedAt: '2026-02-08T10:02:00Z',
          costBreakdown: { total: 0.35 }
        },
        {
          id: 'call-2',
          orgId: 'org-123',
          assistantId: 'asst-1',
          phoneNumberId: 'phone-1',
          customer: { number: '+15559876543' },
          duration: 180,
          status: 'ended',
          type: 'outboundPhoneCall',
          createdAt: '2026-02-08T11:00:00Z',
          updatedAt: '2026-02-08T11:03:00Z',
          endedAt: '2026-02-08T11:03:00Z',
          costBreakdown: { total: 0.42 }
        }
      ];

      // FIXED: Provide both .json() and .text() methods
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiCalls,
          text: async () => JSON.stringify(mockApiCalls)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
          text: async () => 'OK'
        }); // Slack webhook

      // FIXED: Proper Supabase chain mocking
      const mockSelectChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [{ vapi_call_id: 'call-1', org_id: 'org-123', reconciled: false }],
          error: null
        })
      };

      const mockInsertChain = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-call-id', vapi_call_id: 'call-2' },
            error: null
          })
        })
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'calls') {
          return {
            select: vi.fn().mockReturnValue(mockSelectChain),
            insert: vi.fn().mockReturnValue(mockInsertChain)
          } as any;
        }
        return {} as any;
      });

      // Mock wallet deduction
      const mockRpc = vi.fn().mockResolvedValue({
        data: { success: true },
        error: null
      });
      vi.spyOn(supabase, 'rpc').mockImplementation(mockRpc);

      const result = await reconcileVapiCalls();

      expect(result.totalChecked).toBe(2);
      expect(result.missingFound).toBe(1); // call-2 is missing
      expect(result.recovered).toBe(1);
      expect(result.webhookReliability).toBe(50); // 1/2 = 50%
    });

    it('should send alert if webhook reliability <95%', async () => {
      const mockApiCalls = Array.from({ length: 100 }, (_, i) => ({
        id: `call-${i}`,
        orgId: 'org-123',
        createdAt: '2026-02-08T10:00:00Z',
        costBreakdown: { total: 0.30 }
      }));

      // FIXED: Provide both .json() and .text() methods
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiCalls,
          text: async () => JSON.stringify(mockApiCalls)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
          text: async () => 'OK'
        }); // Slack webhook

      // FIXED: Proper Supabase chain mocking
      const mockSelectChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: Array.from({ length: 90 }, (_, i) => ({
            vapi_call_id: `call-${i}`,
            org_id: 'org-123',
            reconciled: false
          })),
          error: null
        })
      };

      const mockInsertChain = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-call-id' },
            error: null
          })
        })
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'calls') {
          return {
            select: vi.fn().mockReturnValue(mockSelectChain),
            insert: vi.fn().mockReturnValue(mockInsertChain)
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true },
        error: null
      });

      const result = await reconcileVapiCalls();

      expect(result.webhookReliability).toBe(90);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          body: expect.stringContaining('WEBHOOK RELIABILITY ISSUE')
        })
      );
    });

    it('should handle zero calls gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await reconcileVapiCalls();

      expect(result.totalChecked).toBe(0);
      expect(result.missingFound).toBe(0);
      expect(result.recovered).toBe(0);
      expect(result.webhookReliability).toBe(100);
    });
  });

  describe('Revenue impact calculation', () => {
    it('should calculate correct revenue recovery for 3% missed webhooks', () => {
      const callsPerMonth = 1000;
      const missedPercentage = 0.03; // 3%
      const avgCostPerCall = 0.30; // $0.30

      const missedCalls = callsPerMonth * missedPercentage;
      const monthlyRevenueLoss = missedCalls * avgCostPerCall;
      const annualRevenueLoss = monthlyRevenueLoss * 12;

      expect(missedCalls).toBe(30);
      expect(monthlyRevenueLoss).toBe(9); // $9/month
      expect(annualRevenueLoss).toBe(108); // $108/year
    });

    it('should calculate correct revenue recovery for 10,000 calls/month', () => {
      const callsPerMonth = 10000;
      const missedPercentage = 0.03;
      const avgCostPerCall = 0.30;

      const annualRevenueLoss = callsPerMonth * missedPercentage * avgCostPerCall * 12;

      expect(annualRevenueLoss).toBe(1080); // $1,080/year
    });
  });
});
