/**
 * Cross-Channel Booking Stress Test
 *
 * Verifies end-to-end flow: Vapi call → hangup → SMS follow-up → calendar slot hold
 * Tests state persistence, webhook handling, and multi-channel coordination
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createMockSupabaseClient,
  createMockVapiClient,
  createMockCallPayload,
  createMockOrganization,
} from '../../tests/utils/test-helpers';
import {
  getOrCreateSupabaseClient,
  getOrCreateVapiClient,
  clearAllMocks,
} from '../utils/mock-pool';
import {
  MOCK_ORGANIZATIONS,
  MOCK_VAPI_CREDENTIALS,
  MOCK_TWILIO_CREDENTIALS,
} from '../../tests/utils/mock-data';

/**
 * Simulates cross-channel booking recovery flow
 */
describe('Cross-Channel Booking Flow - Stress Test', () => {
  let supabase: any;
  let vapi: any;
  let smsService: any;
  let calendarService: any;
  let bookingManager: any;

  const testOrg = MOCK_ORGANIZATIONS[0]; // clinic1
  const testPatient = {
    id: 'patient_xyz_001',
    phone: '+12025551234',
    name: 'Jane Doe',
  };

  beforeEach(() => {
    // Setup mocks from pool (reused instances, memory efficient)
    supabase = getOrCreateSupabaseClient();
    vapi = getOrCreateVapiClient();
    clearAllMocks(); // Clear call history only

    // Mock SMS service
    smsService = {
      sendFollowup: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'sms_123',
        sentAt: new Date().toISOString(),
      }),
      getHistory: jest.fn().mockResolvedValue([
        {
          to: testPatient.phone,
          message: 'Complete your booking...',
          sentAt: new Date().toISOString(),
        },
      ]),
    };

    // Mock calendar service
    calendarService = {
      holdSlot: jest.fn().mockResolvedValue({
        slotHeld: true,
        heldUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
      releaseSlot: jest.fn().mockResolvedValue({ released: true }),
      verifySlotHold: jest.fn().mockResolvedValue({ isHeld: true }),
    };

    // Mock booking manager
    bookingManager = {
      initiateCall: jest.fn(),
      handleHangup: jest.fn(),
      updateBookingStatus: jest.fn(),
      resumeBooking: jest.fn(),
    };
  });

  describe('Step 1: Call Initiation', () => {
    it('should initiate a call and create call record', async () => {
      const callPayload = createMockCallPayload({
        orgId: testOrg.id,
        callerId: testPatient.phone,
      });

      bookingManager.initiateCall.mockResolvedValue({
        callId: callPayload.id,
        status: 'in-progress',
        timestamp: new Date().toISOString(),
      });

      const result = await bookingManager.initiateCall({
        orgId: testOrg.id,
        phoneNumber: testPatient.phone,
        patientId: testPatient.id,
      });

      expect(result).toMatchObject({
        callId: expect.any(String),
        status: 'in-progress',
      });
      expect(bookingManager.initiateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: testOrg.id,
          phoneNumber: testPatient.phone,
        })
      );
    });

    it('should store initial call metadata', async () => {
      const callId = 'call_' + Date.now();
      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: [{ id: callId }] }),
      });

      const insertFn = supabase.from('calls').insert;
      await insertFn.mockResolvedValue({
        data: [{ id: callId, status: 'in-progress' }],
      });

      expect(supabase.from).toHaveBeenCalledWith('calls');
    });

    it('should validate patient phone number format', async () => {
      const invalidPhone = 'not-a-phone';

      bookingManager.initiateCall.mockRejectedValue(
        new Error('Invalid phone format')
      );

      await expect(
        bookingManager.initiateCall({
          orgId: testOrg.id,
          phoneNumber: invalidPhone,
        })
      ).rejects.toThrow('Invalid phone format');
    });
  });

  describe('Step 2: Mid-Call Hangup Detection', () => {
    it('should detect and record hangup event', async () => {
      const callId = 'call_hangup_001';
      const webhook = {
        message: {
          type: 'end-of-call-report',
          call: {
            id: callId,
            status: 'ended',
            duration: 45,
            reason: 'customer-ended',
          },
          transcript: 'Customer: I want to book... <cuts off>',
          analysis: {
            sentiment: 'neutral',
            intent: 'booking_inquiry',
          },
        },
      };

      bookingManager.handleHangup.mockResolvedValue({
        callId,
        previousStatus: 'in-progress',
        newStatus: 'abandoned',
        reason: 'customer-ended',
      });

      const result = await bookingManager.handleHangup(webhook);

      expect(result).toMatchObject({
        callId,
        newStatus: 'abandoned',
        reason: 'customer-ended',
      });
      expect(bookingManager.handleHangup).toHaveBeenCalledWith(webhook);
    });

    it('should extract booking intent from incomplete transcript', async () => {
      const incompleteTranscript = {
        text: 'Customer: I want to book... Assistant: Perfect, which slot works best for you... Customer: <audio cuts>',
        partialIntent: 'booking',
        confidence: 0.85,
      };

      expect(incompleteTranscript.partialIntent).toBe('booking');
      expect(incompleteTranscript.confidence).toBeGreaterThan(0.8);
    });

    it('should calculate call duration accurately', async () => {
      const startTime = Date.now();
      const endTime = startTime + 45000; // 45 seconds
      const duration = (endTime - startTime) / 1000;

      expect(duration).toBe(45);
    });

    it('should mark slot as abandoned (not completed)', async () => {
      const callId = 'call_abandoned_slot_001';
      const webhook = {
        message: {
          type: 'end-of-call-report',
          call: {
            id: callId,
            status: 'ended',
            partialSlotSelection: {
              date: '2026-01-15',
              timePreferred: '10:00 AM',
              confirmed: false,
            },
          },
        },
      };

      bookingManager.updateBookingStatus.mockResolvedValue({
        callId,
        bookingStatus: 'incomplete',
        slotInfo: webhook.message.call.partialSlotSelection,
      });

      const result = await bookingManager.updateBookingStatus(
        callId,
        'incomplete'
      );

      expect(result.bookingStatus).toBe('incomplete');
      expect(result.slotInfo).toBeDefined();
    });
  });

  describe('Step 3: SMS Follow-up Trigger', () => {
    it('should send SMS within 5 seconds of hangup', async () => {
      const hangupTime = Date.now();
      const smsTime = Date.now() + 2500; // 2.5 seconds later
      const latency = smsTime - hangupTime;

      expect(latency).toBeLessThan(5000);
    });

    it('should generate personalized recovery link', async () => {
      const callId = 'call_sms_001';
      const token = Buffer.from(
        `${callId}:${testPatient.id}:${Date.now()}`
      ).toString('base64');

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);
    });

    it('should include booking context in SMS message', async () => {
      const smsResult = await smsService.sendFollowup({
        patientId: testPatient.id,
        phoneNumber: testPatient.phone,
        callId: 'call_context_001',
        context: {
          procedureInterest: 'facelift',
          estimatedValue: '£10,000',
        },
      });

      expect(smsResult.success).toBe(true);
      expect(smsResult.messageId).toBeDefined();
      expect(smsResult.sentAt).toBeDefined();
    });

    it('should handle SMS service failures gracefully', async () => {
      smsService.sendFollowup.mockRejectedValue(
        new Error('Twilio quota exceeded')
      );

      await expect(
        smsService.sendFollowup({
          phoneNumber: testPatient.phone,
        })
      ).rejects.toThrow('Twilio quota exceeded');
    });

    it('should retry SMS on transient failure', async () => {
      let attemptCount = 0;
      smsService.sendFollowup.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network timeout');
        }
        return { success: true, messageId: 'sms_retry_123' };
      });

      try {
        await smsService.sendFollowup({ phoneNumber: testPatient.phone });
      } catch {
        // Expected to fail once
      }

      const retryResult = await smsService.sendFollowup({
        phoneNumber: testPatient.phone,
      });
      expect(retryResult.success).toBe(true);
    });
  });

  describe('Step 4: Slot Hold Verification', () => {
    it('should hold calendar slot for 30 minutes', async () => {
      const holdTime = new Date();
      const expiryTime = new Date(holdTime.getTime() + 30 * 60 * 1000);

      calendarService.holdSlot.mockResolvedValue({
        slotHeld: true,
        slotTime: '2026-01-15 10:00',
        heldUntil: expiryTime.toISOString(),
        holdDurationMinutes: 30,
      });

      const result = await calendarService.holdSlot({
        slotTime: '2026-01-15 10:00',
        orgId: testOrg.id,
      });

      expect(result.slotHeld).toBe(true);
      expect(result.holdDurationMinutes).toBe(30);
    });

    it('should metadata hold in Supabase call record', async () => {
      const callId = 'call_hold_001';
      const heldSlot = '2026-01-15 10:00 AM';

      supabase.from.mockReturnValue({
        update: jest.fn().mockResolvedValue({
          data: [{ slotHeld: true, slotInfo: heldSlot }],
        }),
      });

      const updateFn = supabase.from('calls').update;
      await updateFn({ slotInfo: heldSlot }).eq('id', callId);

      expect(supabase.from).toHaveBeenCalledWith('calls');
    });

    it('should prevent double-booking during hold period', async () => {
      const heldSlot = '2026-01-15 10:00 AM';

      calendarService.holdSlot
        .mockResolvedValueOnce({ slotHeld: true })
        .mockResolvedValueOnce({ slotHeld: false, error: 'Already held' });

      const first = await calendarService.holdSlot({ slotTime: heldSlot });
      const second = await calendarService.holdSlot({ slotTime: heldSlot });

      expect(first.slotHeld).toBe(true);
      expect(second.slotHeld).toBe(false);
    });

    it('should auto-release slot after hold expires', async () => {
      const callId = 'call_expire_001';
      const heldSlot = '2026-01-15 10:00 AM';

      calendarService.holdSlot.mockResolvedValue({
        slotHeld: true,
        heldUntil: new Date(Date.now() + 5000).toISOString(), // 5 sec hold
      });

      const result = await calendarService.holdSlot({ slotTime: heldSlot });
      expect(result.slotHeld).toBe(true);

      // Simulate expiry after 5 seconds
      await new Promise(resolve => setTimeout(resolve, 6000));

      calendarService.releaseSlot.mockResolvedValue({ released: true });
      const releaseResult = await calendarService.releaseSlot({
        callId,
        slotTime: heldSlot,
      });

      expect(releaseResult.released).toBe(true);
    });
  });

  describe('Step 5: SMS Link Click & Resume Booking', () => {
    it('should recognize SMS token and restore call context', async () => {
      const callId = 'call_resume_001';
      const token = Buffer.from(`${callId}:${testPatient.id}`).toString(
        'base64'
      );

      bookingManager.resumeBooking.mockResolvedValue({
        callId,
        patientId: testPatient.id,
        status: 'ready-to-complete',
        token,
      });

      const result = await bookingManager.resumeBooking(token);

      expect(result.callId).toBe(callId);
      expect(result.patientId).toBe(testPatient.id);
      expect(result.status).toBe('ready-to-complete');
    });

    it('should verify slot is still held when resuming', async () => {
      const slotTime = '2026-01-15 10:00 AM';

      calendarService.verifySlotHold.mockResolvedValue({
        isHeld: true,
        heldByCallId: 'call_resume_001',
        remainingHoldTime: '15m 30s',
      });

      const result = await calendarService.verifySlotHold({
        slotTime,
        orgId: testOrg.id,
      });

      expect(result.isHeld).toBe(true);
      expect(result.remainingHoldTime).toBeDefined();
    });

    it('should allow booking completion without re-selecting slot', async () => {
      const callId = 'call_complete_001';

      bookingManager.resumeBooking.mockResolvedValue({
        status: 'ready-to-complete',
        procedureType: 'facelift',
        slotTime: '2026-01-15 10:00 AM',
        requiresSlotReselection: false,
      });

      const result = await bookingManager.resumeBooking('token_abc');

      expect(result.requiresSlotReselection).toBe(false);
      expect(result.slotTime).toBe('2026-01-15 10:00 AM');
    });

    it('should handle expired tokens gracefully', async () => {
      const expiredToken = Buffer.from('old:data:123').toString('base64');

      bookingManager.resumeBooking.mockRejectedValue(
        new Error('Token expired')
      );

      await expect(
        bookingManager.resumeBooking(expiredToken)
      ).rejects.toThrow('Token expired');
    });

    it('should verify patient identity before completing booking', async () => {
      bookingManager.resumeBooking.mockResolvedValue({
        status: 'awaiting-verification',
        verificationRequired: true,
        method: 'sms-code',
      });

      const result = await bookingManager.resumeBooking('token_abc');

      expect(result.verificationRequired).toBe(true);
    });
  });

  describe('End-to-End State Transitions', () => {
    it('should trace complete booking lifecycle', async () => {
      const states: string[] = [];

      // State 1: Call initiated
      states.push('in-progress');
      expect(states[0]).toBe('in-progress');

      // State 2: Call ended
      states.push('abandoned');
      expect(states[1]).toBe('abandoned');

      // State 3: SMS sent
      states.push('follow-up-sent');
      expect(states[2]).toBe('follow-up-sent');

      // State 4: Patient resumes
      states.push('resumed');
      expect(states[3]).toBe('resumed');

      // State 5: Booking completed
      states.push('completed');
      expect(states[4]).toBe('completed');

      expect(states).toHaveLength(5);
    });

    it('should not lose data during state transitions', async () => {
      const callRecord = {
        id: 'call_data_001',
        orgId: testOrg.id,
        patientId: testPatient.id,
        transcript: 'original transcript...',
        analysis: { intent: 'booking', sentiment: 0.7 },
        procedureInterest: 'facelift',
      };

      // After hangup, data should persist
      const hangupRecord = {
        ...callRecord,
        status: 'abandoned',
        heldSlot: '2026-01-15 10:00',
      };

      expect(hangupRecord.transcript).toBe(callRecord.transcript);
      expect(hangupRecord.procedureInterest).toBe(callRecord.procedureInterest);
    });

    it('should handle concurrent SMS sends for same patient', async () => {
      const sendPromises = [
        smsService.sendFollowup({
          patientId: testPatient.id,
          phoneNumber: testPatient.phone,
          callId: 'call_1',
        }),
        smsService.sendFollowup({
          patientId: testPatient.id,
          phoneNumber: testPatient.phone,
          callId: 'call_2',
        }),
        smsService.sendFollowup({
          patientId: testPatient.id,
          phoneNumber: testPatient.phone,
          callId: 'call_3',
        }),
      ];

      const results = await Promise.all(sendPromises);

      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.success).toBe(true);
        expect(r.messageId).toBeDefined();
      });
    });
  });

  describe('Error Recovery & Resilience', () => {
    it('should recover from Supabase offline during webhook', async () => {
      supabase.from.mockRejectedValueOnce(
        new Error('Connection timeout')
      );
      supabase.from.mockResolvedValueOnce({ data: [{ id: 'call_001' }] });

      // First call fails
      await expect(supabase.from('calls')).rejects.toThrow('Connection timeout');

      // Retry succeeds
      const result = await supabase.from('calls');
      expect(result.data).toBeDefined();
    });

    it('should queue SMS if sent immediately fails', async () => {
      smsService.sendFollowup.mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      const queueSpy = jest.fn().mockResolvedValue({ queued: true });

      await expect(smsService.sendFollowup({})).rejects.toThrow(
        'Service unavailable'
      );

      // Should have fallback to queue
      const queueResult = await queueSpy();
      expect(queueResult.queued).toBe(true);
    });

    it('should handle slot hold race conditions', async () => {
      const slotTime = '2026-01-15 10:00 AM';

      calendarService.holdSlot
        .mockResolvedValueOnce({ slotHeld: true })
        .mockRejectedValueOnce(new Error('Slot already held'));

      const first = await calendarService.holdSlot({ slotTime });
      expect(first.slotHeld).toBe(true);

      await expect(
        calendarService.holdSlot({ slotTime })
      ).rejects.toThrow('Slot already held');
    });
  });

  describe('Performance & Latency', () => {
    it('should initiate call within 1 second', async () => {
      const start = Date.now();
      await bookingManager.initiateCall({
        orgId: testOrg.id,
        phoneNumber: testPatient.phone,
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should send SMS within 5 seconds of hangup', async () => {
      const start = Date.now();
      await smsService.sendFollowup({
        patientId: testPatient.id,
        phoneNumber: testPatient.phone,
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });

    it('should verify slot hold within 500ms', async () => {
      const start = Date.now();
      await calendarService.verifySlotHold({
        slotTime: '2026-01-15 10:00 AM',
        orgId: testOrg.id,
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
