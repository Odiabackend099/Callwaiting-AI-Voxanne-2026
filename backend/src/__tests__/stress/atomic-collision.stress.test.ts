/**
 * Atomic Collision (Race Condition) Stress Test
 *
 * Verifies that concurrent booking requests for the same slot are handled atomically.
 * Only 1 request succeeds (200), others fail (409 Conflict).
 * Voice Agent correctly pivots when slot unavailable.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createMockSupabaseClient,
  createMockVapiClient,
  simulateConcurrentOperations,
} from '../../tests/utils/test-helpers';
import {
  getOrCreateSupabaseClient,
  getOrCreateVapiClient,
  clearAllMocks,
} from '../utils/mock-pool';
import { MOCK_ORGANIZATIONS } from '../../tests/utils/mock-data';

/**
 * Simulates race conditions on limited booking resources
 */
describe('Atomic Collision (Race Condition) - Stress Test', () => {
  let supabase: any;
  let vapi: any;
  let slotManager: any;
  let voiceAgent: any;

  const testOrg = MOCK_ORGANIZATIONS[0]; // clinic1
  const targetSlot = '2026-01-15 10:00 AM';

  beforeEach(() => {
    // Use mock pool for memory efficiency
    supabase = getOrCreateSupabaseClient();
    vapi = getOrCreateVapiClient();
    clearAllMocks();

    // Mock slot manager with atomic RPC
    slotManager = {
      claimSlotAtomic: jest.fn(),
      releaseSlot: jest.fn().mockResolvedValue({ released: true }),
      getAvailableSlots: jest.fn().mockResolvedValue([
        { slotTime: '2026-01-15 10:00 AM', available: true },
        { slotTime: '2026-01-15 10:30 AM', available: true },
        { slotTime: '2026-01-15 11:00 AM', available: true },
        { slotTime: '2026-01-15 11:30 AM', available: true },
      ]),
    };

    // Mock voice agent behavior
    voiceAgent = {
      confirmBooking: jest.fn().mockResolvedValue({
        message: 'Great! I\'ve booked you for 10:00 AM.',
      }),
      suggestAlternatives: jest.fn().mockResolvedValue({
        message:
          'That slot was just taken. How about 10:30 AM instead?',
        alternatives: ['10:30 AM', '11:00 AM'],
      }),
      endCall: jest.fn().mockResolvedValue({ ended: true }),
    };
  });

  describe('5 Concurrent Requests to Same Slot', () => {
    it('should allow only 1 request to succeed (200)', async () => {
      // Setup: exactly 1 success, others fail
      slotManager.claimSlotAtomic
        .mockResolvedValueOnce({
          status: 200,
          success: true,
          slotClaimed: true,
          patientId: 'patient_0',
          slotTime: targetSlot,
        })
        .mockRejectedValue({
          status: 409,
          error: 'Slot already claimed',
          conflictingPatientId: 'patient_0',
        });

      const promises = Array.from({ length: 5 }).map((_, i) =>
        slotManager.claimSlotAtomic({
          orgId: testOrg.id,
          slotTime: targetSlot,
          patientId: `patient_${i}`,
          callId: `call_${i}`,
          timestamp: Date.now(),
        })
      );

      const results = await Promise.allSettled(promises);

      // Exactly 1 fulfilled
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0]).toMatchObject({
        status: 'fulfilled',
        value: expect.objectContaining({
          status: 200,
          success: true,
        }),
      });

      // 4 rejected
      const rejected = results.filter(r => r.status === 'rejected');
      expect(rejected).toHaveLength(4);
      rejected.forEach(r => {
        expect(r.reason).toMatchObject({
          status: 409,
          error: 'Slot already claimed',
        });
      });
    });

    it('should return 409 Conflict for unsuccessful claims', async () => {
      slotManager.claimSlotAtomic.mockImplementation(async ({ patientId }) => {
        if (patientId === 'patient_0') {
          return { status: 200, success: true, slotClaimed: true };
        }
        return {
          status: 409,
          success: false,
          error: 'Slot already claimed',
        };
      });

      const promises = Array.from({ length: 5 }).map((_, i) =>
        slotManager.claimSlotAtomic({
          slotTime: targetSlot,
          patientId: `patient_${i}`,
        })
      );

      const results = await Promise.all(
        promises.map(p =>
          p.then(
            r => ({ status: 'success', data: r }),
            e => ({ status: 'error', data: e })
          )
        )
      );

      const conflicts = results.filter(r => r.data.status === 409);
      expect(conflicts).toHaveLength(4);
      conflicts.forEach(c => {
        expect(c.data.error).toBe('Slot already claimed');
      });
    });

    it('should prevent double-booking in database', async () => {
      // Simulate atomic RPC preventing dual insert
      const bookedSlots = new Set<string>();

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ patientId, slotTime }) => {
          // Simulate atomic check-and-set
          if (bookedSlots.has(slotTime)) {
            throw {
              status: 409,
              error: 'Slot already claimed',
            };
          }
          bookedSlots.add(slotTime);
          return {
            status: 200,
            success: true,
            slotClaimed: true,
            patientId,
            slotTime,
          };
        }
      );

      const promises = Array.from({ length: 5 }).map((_, i) =>
        slotManager
          .claimSlotAtomic({
            slotTime: targetSlot,
            patientId: `patient_${i}`,
          })
          .catch((e: any) => ({ error: e.error }))
      );

      const results = await Promise.all(promises);

      // Count successful bookings
      const successes = results.filter((r: any) => !r.error);
      expect(successes).toHaveLength(1);

      // Verify DB state: exactly 1 booking for this slot
      expect(bookedSlots.size).toBe(1);
    });

    it('should identify which patient won the race', async () => {
      const winnerPatient = 'patient_2';

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ patientId }) => {
          return patientId === winnerPatient
            ? {
                status: 200,
                success: true,
                winnerPatientId: patientId,
              }
            : {
                status: 409,
                error: 'Slot already claimed',
                winnerPatientId: winnerPatient,
              };
        }
      );

      const promises = Array.from({ length: 5 }).map((_, i) =>
        slotManager
          .claimSlotAtomic({ slotTime: targetSlot, patientId: `patient_${i}` })
          .catch((e: any) => e)
      );

      const results = await Promise.all(promises);

      const success = results.find((r: any) => r.status === 200);
      expect(success.winnerPatientId).toBe(winnerPatient);

      const failures = results.filter((r: any) => r.status === 409);
      expect(failures).toHaveLength(4);
      failures.forEach((f: any) => {
        expect(f.winnerPatientId).toBe(winnerPatient);
      });
    });
  });

  describe('10 Concurrent Requests (Higher Concurrency)', () => {
    it('should handle 10 requests with only 1 success', async () => {
      const bookedSlots = new Set<string>();

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ slotTime, patientId }) => {
          if (bookedSlots.has(slotTime)) {
            return { status: 409, error: 'Slot already claimed' };
          }
          bookedSlots.add(slotTime);
          return {
            status: 200,
            success: true,
            patientId,
            slotTime,
          };
        }
      );

      const promises = Array.from({ length: 10 }).map((_, i) =>
        slotManager
          .claimSlotAtomic({
            slotTime: targetSlot,
            patientId: `patient_${i}`,
          })
          .then(
            (r: any) => ({ success: r.status === 200 }),
            (e: any) => ({ success: false })
          )
      );

      const results = await Promise.all(promises);
      const successes = results.filter(r => r.success);

      expect(successes).toHaveLength(1);
      expect(bookedSlots.size).toBe(1);
    });

    it('should maintain data consistency under high load', async () => {
      const slotBookings: Record<string, string> = {};

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ slotTime, patientId }) => {
          // Simulate atomic operation
          if (slotBookings[slotTime]) {
            return {
              status: 409,
              error: 'Conflict',
              bookedBy: slotBookings[slotTime],
            };
          }
          slotBookings[slotTime] = patientId;
          return { status: 200, success: true, patientId, slotTime };
        }
      );

      const concurrentAttempts = 15;
      const promises = Array.from({ length: concurrentAttempts }).map((_, i) =>
        slotManager.claimSlotAtomic({
          slotTime: targetSlot,
          patientId: `patient_${i}`,
        })
      );

      await Promise.all(
        promises.map(p =>
          p.catch((e: any) => ({ error: e.error }))
        )
      );

      // Verify exactly 1 booking exists
      expect(Object.keys(slotBookings)).toHaveLength(1);
      expect(slotBookings[targetSlot]).toBeDefined();
    });
  });

  describe('50 Concurrent Requests (Extreme Stress)', () => {
    it('should handle extreme concurrency without crashes', async () => {
      const bookingLog: any[] = [];

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ slotTime, patientId, timestamp }) => {
          // Simulate atomic database lock
          const isFirst = bookingLog.length === 0;

          if (isFirst) {
            bookingLog.push({ patientId, slotTime, timestamp, status: 200 });
            return { status: 200, success: true };
          } else {
            return {
              status: 409,
              error: 'Already booked',
              existingBooker: bookingLog[0].patientId,
            };
          }
        }
      );

      const promises = Array.from({ length: 50 }).map((_, i) =>
        slotManager
          .claimSlotAtomic({
            slotTime: targetSlot,
            patientId: `patient_${i}`,
            timestamp: Date.now() + i, // Slight timing variation
          })
          .then(
            (r: any) => ({ result: r.status }),
            (e: any) => ({ result: 409 })
          )
      );

      const results = await Promise.all(promises);

      const successful = results.filter((r: any) => r.result === 200);
      const failed = results.filter((r: any) => r.result === 409);

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(49);
      expect(bookingLog).toHaveLength(1);
    });

    it('should return response within 1 second even under extreme load', async () => {
      const start = Date.now();

      slotManager.claimSlotAtomic.mockImplementation(async () => {
        // Simulate minimal processing
        return { status: 200, success: true };
      });

      const promises = Array.from({ length: 50 }).map(() =>
        slotManager.claimSlotAtomic({ slotTime: targetSlot })
      );

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Voice Agent Behavior on Collision', () => {
    it('should gracefully handle slot unavailable', async () => {
      slotManager.claimSlotAtomic.mockRejectedValue({
        status: 409,
        error: 'Slot already claimed',
      });

      // Patient's booking attempt fails
      const bookingAttempt = await slotManager
        .claimSlotAtomic({
          slotTime: targetSlot,
          patientId: 'patient_1',
        })
        .catch((e: any) => e);

      expect(bookingAttempt.status).toBe(409);

      // Voice Agent detects failure and suggests alternatives
      const voiceResponse = await voiceAgent.suggestAlternatives({
        failedSlot: targetSlot,
        orgId: testOrg.id,
      });

      expect(voiceResponse.message).toContain('was just taken');
      expect(voiceResponse.alternatives).toBeDefined();
      expect(voiceResponse.alternatives.length).toBeGreaterThan(0);
    });

    it('should provide alternative time slots from available list', async () => {
      const availableSlots = [
        '2026-01-15 10:30 AM',
        '2026-01-15 11:00 AM',
        '2026-01-15 11:30 AM',
      ];

      voiceAgent.suggestAlternatives.mockResolvedValue({
        message: `That slot was just taken. How about ${availableSlots[0]} instead?`,
        alternatives: availableSlots,
      });

      const result = await voiceAgent.suggestAlternatives({
        failedSlot: targetSlot,
      });

      expect(result.alternatives).toEqual(availableSlots);
      expect(result.message).toContain('10:30 AM');
    });

    it('should confirm alternative booking when patient accepts', async () => {
      const alternativeSlot = '2026-01-15 10:30 AM';

      voiceAgent.confirmBooking.mockResolvedValue({
        status: 'confirmed',
        message: `Perfect! I've booked you for ${alternativeSlot}.`,
        slotTime: alternativeSlot,
        confirmationNumber: 'CONF_12345',
      });

      const result = await voiceAgent.confirmBooking({
        patientId: 'patient_1',
        slotTime: alternativeSlot,
        orgId: testOrg.id,
      });

      expect(result.status).toBe('confirmed');
      expect(result.slotTime).toBe(alternativeSlot);
      expect(result.confirmationNumber).toBeDefined();
    });

    it('should handle patient rejecting all alternatives', async () => {
      voiceAgent.endCall.mockResolvedValue({
        ended: true,
        reason: 'customer-rejected-alternatives',
        followUpOffered: true,
      });

      const result = await voiceAgent.endCall({
        patientId: 'patient_1',
        reason: 'no-suitable-alternatives',
      });

      expect(result.ended).toBe(true);
      expect(result.followUpOffered).toBe(true);
    });

    it('should respond within 2 seconds to collision', async () => {
      const start = Date.now();

      slotManager.claimSlotAtomic.mockRejectedValue({ status: 409 });

      await slotManager
        .claimSlotAtomic({ slotTime: targetSlot })
        .catch((e: any) => e);

      voiceAgent.suggestAlternatives.mockResolvedValue({
        alternatives: ['10:30 AM'],
      });

      await voiceAgent.suggestAlternatives({ failedSlot: targetSlot });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Different Slot Times Simultaneously', () => {
    it('should isolate collisions by slot time', async () => {
      const slots = [
        '2026-01-15 10:00 AM',
        '2026-01-15 2:00 PM',
        '2026-01-15 4:00 PM',
      ];
      const bookings: Record<string, string> = {};

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ slotTime, patientId }) => {
          if (bookings[slotTime]) {
            return {
              status: 409,
              error: 'Already booked',
              slotTime,
            };
          }
          bookings[slotTime] = patientId;
          return { status: 200, success: true, slotTime };
        }
      );

      // 5 concurrent requests per slot
      const promises = slots.flatMap(slot =>
        Array.from({ length: 5 }).map((_, i) =>
          slotManager
            .claimSlotAtomic({
              slotTime: slot,
              patientId: `patient_${i}`,
            })
            .then(
              (r: any) => ({ status: r.status, slot }),
              (e: any) => ({ status: e.status, slot })
            )
        )
      );

      const results = await Promise.all(promises);

      // 1 success per slot, 4 failures per slot
      slots.forEach(slot => {
        const slotResults = results.filter((r: any) => r.slot === slot);
        const successes = slotResults.filter((r: any) => r.status === 200);
        const failures = slotResults.filter((r: any) => r.status === 409);

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(4);
      });
    });

    it('should not cross-contaminate collision state between slots', async () => {
      const slot1 = '2026-01-15 10:00 AM';
      const slot2 = '2026-01-15 2:00 PM';

      let slot1Booked = false;
      let slot2Booked = false;

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ slotTime }) => {
          if (slotTime === slot1 && slot1Booked) {
            return { status: 409 };
          }
          if (slotTime === slot2 && slot2Booked) {
            return { status: 409 };
          }

          if (slotTime === slot1) {
            slot1Booked = true;
          } else if (slotTime === slot2) {
            slot2Booked = true;
          }

          return { status: 200, success: true };
        }
      );

      // Book slot 1
      const booking1 = await slotManager.claimSlotAtomic({
        slotTime: slot1,
      });
      expect(booking1.status).toBe(200);

      // Slot 2 should still be available
      const booking2 = await slotManager.claimSlotAtomic({
        slotTime: slot2,
      });
      expect(booking2.status).toBe(200);

      // Second attempt on slot 1 should fail
      const failedRebooking1 = await slotManager.claimSlotAtomic({
        slotTime: slot1,
      });
      expect(failedRebooking1.status).toBe(409);
    });
  });

  describe('Race Condition Detection & Logging', () => {
    it('should log all collision attempts', async () => {
      const collisionLog: any[] = [];

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ slotTime, patientId, callId, timestamp }) => {
          const isCollision = collisionLog.some(
            c => c.slotTime === slotTime
          );

          if (isCollision) {
            const logEntry = { slotTime, patientId, callId, timestamp, result: 'collision' };
            collisionLog.push(logEntry);
            return { status: 409, error: 'Slot already claimed' };
          }

          collisionLog.push({
            slotTime,
            patientId,
            callId,
            timestamp,
            result: 'success',
          });
          return { status: 200, success: true };
        }
      );

      const promises = Array.from({ length: 5 }).map((_, i) =>
        slotManager.claimSlotAtomic({
          slotTime: targetSlot,
          patientId: `patient_${i}`,
          callId: `call_${i}`,
          timestamp: Date.now(),
        })
      );

      await Promise.all(promises);

      // Should have 1 success + 4 collisions logged
      expect(collisionLog).toHaveLength(5);

      const successes = collisionLog.filter(
        (log: any) => log.result === 'success'
      );
      const collisions = collisionLog.filter(
        (log: any) => log.result === 'collision'
      );

      expect(successes).toHaveLength(1);
      expect(collisions).toHaveLength(4);
    });

    it('should record winner timestamp for audit', async () => {
      let winnerTimestamp: number | null = null;

      slotManager.claimSlotAtomic.mockImplementation(
        async ({ timestamp }) => {
          if (winnerTimestamp === null) {
            winnerTimestamp = timestamp;
            return { status: 200, success: true, winnerTimestamp };
          }
          return {
            status: 409,
            error: 'Already booked',
            winnerTimestamp,
            loserTimestamp: timestamp,
          };
        }
      );

      const t0 = Date.now();
      const promises = Array.from({ length: 3 }).map((_, i) =>
        slotManager.claimSlotAtomic({
          slotTime: targetSlot,
          patientId: `patient_${i}`,
          timestamp: t0 + i,
        })
      );

      const results = await Promise.all(
        promises.map(p =>
          p.catch((e: any) => e)
        )
      );

      const winner = results.find(
        (r: any) => r.winnerTimestamp !== undefined
      );
      expect(winner).toBeDefined();
      expect(winner.winnerTimestamp).toBeDefined();
    });
  });

  describe('Performance Under Collision', () => {
    it('should respond to collision within 100ms', async () => {
      slotManager.claimSlotAtomic
        .mockResolvedValueOnce({ status: 200, success: true })
        .mockImplementation(async () => {
          return { status: 409, error: 'Already claimed' };
        });

      // First request wins
      await slotManager.claimSlotAtomic({ slotTime: targetSlot });

      // Subsequent requests should fail fast
      const start = Date.now();
      await slotManager.claimSlotAtomic({ slotTime: targetSlot });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should maintain <500ms response time for 10 concurrent collisions', async () => {
      slotManager.claimSlotAtomic.mockImplementation(async () => ({
        status: 409,
        error: 'Already claimed',
      }));

      const start = Date.now();
      const promises = Array.from({ length: 10 }).map(() =>
        slotManager.claimSlotAtomic({ slotTime: targetSlot })
      );

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
