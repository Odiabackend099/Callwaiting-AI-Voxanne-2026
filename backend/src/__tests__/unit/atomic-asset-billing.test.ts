/**
 * Phase 1: Atomic Asset Billing Unit Tests
 * Tests: deductAssetCost() function in wallet-service.ts
 *
 * Verifies:
 * 1. Successful atomic deduction returns correct result
 * 2. Insufficient balance is rejected (zero-debt for assets)
 * 3. Duplicate idempotency key returns duplicate flag
 * 4. Supabase RPC errors are handled gracefully
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        rpc: vi.fn(),
    };
});

// Mock supabase client
vi.mock('../../services/supabase-client', () => ({
    supabase: {
        rpc: mocks.rpc,
    },
}));

// Mock logger
vi.mock('../../services/logger', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Import after mocks
import { deductAssetCost } from '../../services/wallet-service';

describe('deductAssetCost (Phase 1 - Atomic Asset Billing)', () => {
    const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
    const COST = 1000; // $10.00
    const ASSET_TYPE = 'phone_number' as const;
    const DESCRIPTION = 'Phone provisioning: GB mobile any';
    const IDEMPOTENCY_KEY = 'provision-550e8400-1707868800-abc123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should deduct successfully when balance is sufficient', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: true,
                transaction_id: 'txn-uuid-001',
                balance_before_pence: 5000,
                balance_after_pence: 4000,
            },
            error: null,
        });

        const result = await deductAssetCost(ORG_ID, COST, ASSET_TYPE, DESCRIPTION, IDEMPOTENCY_KEY);

        expect(result.success).toBe(true);
        expect(result.duplicate).toBe(false);
        expect(result.balanceBefore).toBe(5000);
        expect(result.balanceAfter).toBe(4000);
        expect(result.transactionId).toBe('txn-uuid-001');

        expect(mocks.rpc).toHaveBeenCalledWith('check_balance_and_deduct_asset_cost', {
            p_org_id: ORG_ID,
            p_cost_pence: COST,
            p_asset_type: ASSET_TYPE,
            p_description: DESCRIPTION,
            p_idempotency_key: IDEMPOTENCY_KEY,
        });
    });

    it('should reject deduction when balance is insufficient (zero-debt)', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: false,
                error: 'insufficient_balance',
                balance_pence: 500,
                required_pence: 1000,
                shortfall_pence: 500,
            },
            error: null,
        });

        const result = await deductAssetCost(ORG_ID, COST, ASSET_TYPE, DESCRIPTION, IDEMPOTENCY_KEY);

        expect(result.success).toBe(false);
        expect(result.duplicate).toBe(false);
        expect(result.error).toBe('insufficient_balance');
        expect(result.shortfallPence).toBe(500);
    });

    it('should detect duplicate idempotency key and return duplicate flag', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: false,
                error: 'duplicate_request',
                idempotency_key: IDEMPOTENCY_KEY,
            },
            error: null,
        });

        const result = await deductAssetCost(ORG_ID, COST, ASSET_TYPE, DESCRIPTION, IDEMPOTENCY_KEY);

        expect(result.success).toBe(false);
        expect(result.duplicate).toBe(true);
        expect(result.error).toBe('duplicate_request');
    });

    it('should handle Supabase RPC errors gracefully', async () => {
        mocks.rpc.mockResolvedValue({
            data: null,
            error: { message: 'connection refused' },
        });

        const result = await deductAssetCost(ORG_ID, COST, ASSET_TYPE, DESCRIPTION, IDEMPOTENCY_KEY);

        expect(result.success).toBe(false);
        expect(result.duplicate).toBe(false);
        expect(result.error).toBe('connection refused');
    });

    it('should handle organization not found', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: false,
                error: 'organization_not_found',
            },
            error: null,
        });

        const result = await deductAssetCost(ORG_ID, COST, ASSET_TYPE, DESCRIPTION, IDEMPOTENCY_KEY);

        expect(result.success).toBe(false);
        expect(result.error).toBe('organization_not_found');
    });
});
