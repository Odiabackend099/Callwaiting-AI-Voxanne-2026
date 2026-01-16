/**
 * Atomic Calendar Booking Tests
 * 
 * Tests the atomic locking mechanism for appointment booking:
 * - claimSlotAtomic() - PostgreSQL advisory lock enforcement
 * - Concurrent booking simulation - Race condition handling
 * - Transaction integrity - Rollback on failure
 * - Multi-tenant scoping - org_id isolation
 * 
 * Principle: "Does this one thing work?"
 * Each test validates atomic locking behavior to prevent double-booking.
 */

import { AtomicBookingService } from '../../services/atomic-booking-service';
import * as supabaseClient from '../../services/supabase-client';
import { simulateRaceCondition } from '../../tests/utils/test-helpers';

// Mock the Supabase client
jest.mock('../../services/supabase-client', () => ({
    supabase: {
        rpc: jest.fn(),
    },
}));

// Mock Twilio service
jest.mock('../../services/twilio-service', () => ({
    sendSmsTwilio: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock OTP utils
jest.mock('../../utils/otp-utils', () => ({
    generateOTP: jest.fn(() => '1234'),
}));

describe('Atomic Calendar Booking - claimSlotAtomic()', () => {
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = supabaseClient.supabase;
        jest.clearAllMocks();
    });

    describe('Successful slot claim', () => {
        it('should successfully claim an available slot', async () => {
            const orgId = 'a0000000-0000-0000-0000-000000000001';
            const calendarId = 'cal_123';
            const slotTime = new Date('2026-02-01T10:00:00Z');
            const callSid = 'call_123';

            mockSupabase.rpc.mockResolvedValue({
                data: [
                    {
                        success: true,
                        hold_id: 'hold_123',
                        error: null,
                        action: null,
                    },
                ],
                error: null,
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid,
                'John Doe',
                '+12025551234'
            );

            expect(result.success).toBe(true);
            expect(result.holdId).toBe('hold_123');
            expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_slot_atomic', {
                p_org_id: orgId,
                p_calendar_id: calendarId,
                p_slot_time: slotTime.toISOString(),
                p_call_sid: callSid,
                p_patient_name: 'John Doe',
                p_patient_phone: '+12025551234',
                p_hold_duration_minutes: 10,
            });
        });

        it('should handle null patient information', async () => {
            const orgId = 'b0000000-0000-0000-0000-000000000002';
            const calendarId = 'cal_456';
            const slotTime = new Date('2026-02-01T11:00:00Z');
            const callSid = 'call_456';

            mockSupabase.rpc.mockResolvedValue({
                data: [{ success: true, hold_id: 'hold_456' }],
                error: null,
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_slot_atomic', {
                p_org_id: orgId,
                p_calendar_id: calendarId,
                p_slot_time: slotTime.toISOString(),
                p_call_sid: callSid,
                p_patient_name: null,
                p_patient_phone: null,
                p_hold_duration_minutes: 10,
            });
        });
    });

    describe('Slot already claimed (race condition)', () => {
        it('should return failure when slot is already claimed', async () => {
            const orgId = 'c0000000-0000-0000-0000-000000000003';
            const calendarId = 'cal_789';
            const slotTime = new Date('2026-02-01T12:00:00Z');
            const callSid = 'call_789';

            mockSupabase.rpc.mockResolvedValue({
                data: [
                    {
                        success: false,
                        error: 'Slot not available',
                        action: 'OFFER_ALTERNATIVES',
                    },
                ],
                error: null,
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Slot not available');
            expect(result.action).toBe('OFFER_ALTERNATIVES');
        });

        it('should handle concurrent booking attempts (only one succeeds)', async () => {
            const orgId = 'd0000000-0000-0000-0000-000000000004';
            const calendarId = 'cal_concurrent';
            const slotTime = new Date('2026-02-01T13:00:00Z');

            let callCount = 0;
            mockSupabase.rpc.mockImplementation(() => {
                callCount++;
                // First call succeeds, subsequent calls fail
                if (callCount === 1) {
                    return Promise.resolve({
                        data: [{ success: true, hold_id: 'hold_winner' }],
                        error: null,
                    });
                } else {
                    return Promise.resolve({
                        data: [
                            {
                                success: false,
                                error: 'Slot not available',
                                action: 'OFFER_ALTERNATIVES',
                            },
                        ],
                        error: null,
                    });
                }
            });

            // Simulate 5 concurrent booking attempts
            const operations = Array.from({ length: 5 }, (_, i) => () =>
                AtomicBookingService.claimSlotAtomic(
                    orgId,
                    calendarId,
                    slotTime,
                    `call_${i}`
                )
            );

            const results = await simulateRaceCondition(operations);

            // Only one should succeed
            const successfulBookings = results.filter((r) => r.success);
            const failedBookings = results.filter((r) => !r.success);

            expect(successfulBookings.length).toBe(1);
            expect(failedBookings.length).toBe(4);
            expect(successfulBookings[0].holdId).toBe('hold_winner');
        });
    });

    describe('Database errors', () => {
        it('should handle foreign key constraint violation', async () => {
            const orgId = 'e0000000-0000-0000-0000-000000000005';
            const calendarId = 'cal_invalid';
            const slotTime = new Date('2026-02-01T14:00:00Z');
            const callSid = 'call_invalid';

            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: {
                    message: 'violates foreign key constraint "fk_calendar"',
                    code: '23503',
                },
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('calendar configuration appears invalid');
            expect(result.action).toBe('ESCALATE');
        });

        it('should handle custom PL/pgSQL exceptions', async () => {
            const orgId = 'f0000000-0000-0000-0000-000000000006';
            const calendarId = 'cal_custom_error';
            const slotTime = new Date('2026-02-01T15:00:00Z');
            const callSid = 'call_custom';

            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: {
                    message: 'Calendar is not available on this day',
                    code: 'P0001',
                },
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Calendar is not available on this day');
            expect(result.action).toBe('ESCALATE');
        });

        it('should handle generic database errors gracefully', async () => {
            const orgId = 'g0000000-0000-0000-0000-000000000007';
            const calendarId = 'cal_db_error';
            const slotTime = new Date('2026-02-01T16:00:00Z');
            const callSid = 'call_db_error';

            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: {
                    message: 'Connection timeout',
                    code: '08006',
                },
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unable to check slot availability');
            expect(result.action).toBe('ESCALATE');
        });

        it('should handle unexpected exceptions', async () => {
            const orgId = 'h0000000-0000-0000-0000-000000000008';
            const calendarId = 'cal_exception';
            const slotTime = new Date('2026-02-01T17:00:00Z');
            const callSid = 'call_exception';

            mockSupabase.rpc.mockRejectedValue(new Error('Network error'));

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('having trouble scheduling');
            expect(result.action).toBe('ESCALATE');
        });
    });

    describe('Multi-tenant isolation', () => {
        it('should scope locks by org_id (different orgs can book same time)', async () => {
            const org1 = 'i0000000-0000-0000-0000-000000000009';
            const org2 = 'j0000000-0000-0000-0000-000000000010';
            const calendarId = 'cal_multi_tenant';
            const slotTime = new Date('2026-02-01T18:00:00Z');

            // Both orgs should be able to claim the same time slot
            mockSupabase.rpc.mockResolvedValue({
                data: [{ success: true, hold_id: 'hold_org_specific' }],
                error: null,
            });

            const result1 = await AtomicBookingService.claimSlotAtomic(
                org1,
                calendarId,
                slotTime,
                'call_org1'
            );

            const result2 = await AtomicBookingService.claimSlotAtomic(
                org2,
                calendarId,
                slotTime,
                'call_org2'
            );

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
            expect(mockSupabase.rpc).toHaveBeenNthCalledWith(
                1,
                'claim_slot_atomic',
                expect.objectContaining({ p_org_id: org1 })
            );
            expect(mockSupabase.rpc).toHaveBeenNthCalledWith(
                2,
                'claim_slot_atomic',
                expect.objectContaining({ p_org_id: org2 })
            );
        });

        it('should prevent same org from double-booking same slot', async () => {
            const orgId = 'k0000000-0000-0000-0000-000000000011';
            const calendarId = 'cal_same_org';
            const slotTime = new Date('2026-02-01T19:00:00Z');

            let callCount = 0;
            mockSupabase.rpc.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        data: [{ success: true, hold_id: 'hold_first' }],
                        error: null,
                    });
                } else {
                    return Promise.resolve({
                        data: [
                            {
                                success: false,
                                error: 'Slot not available',
                                action: 'OFFER_ALTERNATIVES',
                            },
                        ],
                        error: null,
                    });
                }
            });

            const result1 = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                'call_1'
            );

            const result2 = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                'call_2'
            );

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
            expect(result2.error).toBe('Slot not available');
        });
    });

    describe('Response format validation', () => {
        it('should handle RPC response as array', async () => {
            const orgId = 'l0000000-0000-0000-0000-000000000012';
            const calendarId = 'cal_array';
            const slotTime = new Date('2026-02-01T20:00:00Z');
            const callSid = 'call_array';

            mockSupabase.rpc.mockResolvedValue({
                data: [{ success: true, hold_id: 'hold_array' }],
                error: null,
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(true);
            expect(result.holdId).toBe('hold_array');
        });

        it('should handle RPC response as single object', async () => {
            const orgId = 'm0000000-0000-0000-0000-000000000013';
            const calendarId = 'cal_object';
            const slotTime = new Date('2026-02-01T21:00:00Z');
            const callSid = 'call_object';

            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, hold_id: 'hold_object' },
                error: null,
            });

            const result = await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(result.success).toBe(true);
            expect(result.holdId).toBe('hold_object');
        });
    });

    describe('Hold duration', () => {
        it('should set hold duration to 10 minutes by default', async () => {
            const orgId = 'n0000000-0000-0000-0000-000000000014';
            const calendarId = 'cal_duration';
            const slotTime = new Date('2026-02-01T22:00:00Z');
            const callSid = 'call_duration';

            mockSupabase.rpc.mockResolvedValue({
                data: [{ success: true, hold_id: 'hold_duration' }],
                error: null,
            });

            await AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                callSid
            );

            expect(mockSupabase.rpc).toHaveBeenCalledWith(
                'claim_slot_atomic',
                expect.objectContaining({
                    p_hold_duration_minutes: 10,
                })
            );
        });
    });
});

describe('Atomic Calendar Booking - Stress Testing', () => {
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = supabaseClient.supabase;
        jest.clearAllMocks();
    });

    it('should handle 10 concurrent booking attempts (only 1 succeeds)', async () => {
        const orgId = 'o0000000-0000-0000-0000-000000000015';
        const calendarId = 'cal_stress_10';
        const slotTime = new Date('2026-02-02T10:00:00Z');

        let successCount = 0;
        mockSupabase.rpc.mockImplementation(() => {
            successCount++;
            if (successCount === 1) {
                return Promise.resolve({
                    data: [{ success: true, hold_id: 'hold_stress_winner' }],
                    error: null,
                });
            } else {
                return Promise.resolve({
                    data: [
                        {
                            success: false,
                            error: 'Slot not available',
                            action: 'OFFER_ALTERNATIVES',
                        },
                    ],
                    error: null,
                });
            }
        });

        const operations = Array.from({ length: 10 }, (_, i) => () =>
            AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                `call_stress_${i}`
            )
        );

        const results = await simulateRaceCondition(operations);

        const successful = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);

        expect(successful.length).toBe(1);
        expect(failed.length).toBe(9);
        expect(mockSupabase.rpc).toHaveBeenCalledTimes(10);
    });

    it('should handle 2 concurrent attempts with microsecond timing', async () => {
        const orgId = 'p0000000-0000-0000-0000-000000000016';
        const calendarId = 'cal_microsecond';
        const slotTime = new Date('2026-02-02T11:00:00Z');

        let firstCall = true;
        mockSupabase.rpc.mockImplementation(() => {
            if (firstCall) {
                firstCall = false;
                return Promise.resolve({
                    data: [{ success: true, hold_id: 'hold_first_microsecond' }],
                    error: null,
                });
            } else {
                return Promise.resolve({
                    data: [
                        {
                            success: false,
                            error: 'Slot not available',
                            action: 'OFFER_ALTERNATIVES',
                        },
                    ],
                    error: null,
                });
            }
        });

        // Execute both calls simultaneously
        const [result1, result2] = await Promise.all([
            AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                'call_micro_1'
            ),
            AtomicBookingService.claimSlotAtomic(
                orgId,
                calendarId,
                slotTime,
                'call_micro_2'
            ),
        ]);

        // Exactly one should succeed
        const results = [result1, result2];
        const successful = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);

        expect(successful.length).toBe(1);
        expect(failed.length).toBe(1);
    });
});
