/**
 * Phase 2: Credit Reservation Pattern Unit Tests
 * Tests: reserveCallCredits() and commitReservedCredits() in wallet-service.ts
 */

jest.mock('../../services/supabase-client', () => ({
    supabase: {
        rpc: jest.fn(),
        from: jest.fn(),
    },
}));

jest.mock('../../services/logger', () => ({
    log: {
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    },
}));

import { reserveCallCredits, commitReservedCredits } from '../../services/wallet-service';
import { supabase } from '../../services/supabase-client';

const mocks = {
    rpc: supabase.rpc as jest.Mock,
    from: supabase.from as jest.Mock,
};

describe('reserveCallCredits (Phase 2)', () => {
    const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
    const CALL_ID = 'call-test-001';
    const VAPI_CALL_ID = 'vapi-call-001';

    beforeEach(() => jest.clearAllMocks());

    it('should reserve credits successfully', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: true, duplicate: false,
                reservation_id: 'res-uuid-001',
                reserved_pence: 245, // 5 min * 49p
                balance_pence: 5000,
                effective_balance_pence: 4755,
                active_reservations_pence: 245,
            },
            error: null,
        });

        const result = await reserveCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 5);
        expect(result.success).toBe(true);
        expect(result.reservedPence).toBe(245);
        expect(result.effectiveBalancePence).toBe(4755);
    });

    it('should reject reservation when effective balance is zero', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: false, error: 'insufficient_balance',
                balance_pence: 200, active_reservations_pence: 200,
                effective_balance_pence: 0, required_pence: 245,
            },
            error: null,
        });

        const result = await reserveCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 5);
        expect(result.success).toBe(false);
        expect(result.error).toBe('insufficient_balance');
        expect(result.effectiveBalancePence).toBe(0);
    });

    it('should detect duplicate reservation', async () => {
        mocks.rpc.mockResolvedValue({
            data: { success: true, duplicate: true, reservation_id: 'res-existing' },
            error: null,
        });

        const result = await reserveCallCredits(ORG_ID, CALL_ID, VAPI_CALL_ID, 5);
        expect(result.success).toBe(true);
        expect(result.duplicate).toBe(true);
    });
});

describe('commitReservedCredits (Phase 2)', () => {
    const CALL_ID = 'call-test-001';

    beforeEach(() => jest.clearAllMocks());

    it('should commit actual usage and release unused credits', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: true, duplicate: false,
                transaction_id: 'txn-uuid-002',
                reserved_pence: 245,
                actual_cost_pence: 98, // 2 minutes * 49p
                released_pence: 147,  // 245 - 98
                balance_before_pence: 5000,
                balance_after_pence: 4902,
                actual_minutes: 2,
                duration_seconds: 90,
            },
            error: null,
        });

        const result = await commitReservedCredits(CALL_ID, 90);
        expect(result.success).toBe(true);
        expect(result.actualCostPence).toBe(98);
        expect(result.releasedPence).toBe(147);
        expect(result.balanceAfter).toBe(4902);
    });

    it('should fall back to direct billing when no reservation exists', async () => {
        mocks.rpc.mockResolvedValue({
            data: {
                success: false,
                error: 'no_active_reservation',
                call_id: CALL_ID,
                fallback_to_direct_billing: true,
            },
            error: null,
        });

        const result = await commitReservedCredits(CALL_ID, 90);
        expect(result.success).toBe(false);
        expect(result.fallbackToDirectBilling).toBe(true);
    });

    it('should handle duplicate commit idempotently', async () => {
        mocks.rpc.mockResolvedValue({
            data: { success: true, duplicate: true },
            error: null,
        });

        const result = await commitReservedCredits(CALL_ID, 90);
        expect(result.success).toBe(true);
        expect(result.duplicate).toBe(true);
    });
});
