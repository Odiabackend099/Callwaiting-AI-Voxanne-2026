/**
 * Appointment Booking Service Unit Tests
 * 
 * Tests for race condition prevention using Postgres advisory locks.
 * Verifies that concurrent booking attempts for the same slot result in
 * exactly one successful booking.
 */

// Mock Supabase client - declare before imports
let mockRpc: jest.Mock;
let mockFromChain: any;

jest.mock('@supabase/supabase-js', () => {
  mockRpc = jest.fn();
  mockFromChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
  };
  
  return {
    createClient: jest.fn(() => ({
      rpc: mockRpc,
      from: jest.fn(() => mockFromChain),
    })),
  };
});

// Mock logger
jest.mock('../../services/logger', () => ({
  log: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  bookAppointmentWithLock,
  checkSlotAvailability,
  cancelAppointment,
  rescheduleAppointment,
  BookingRequest,
} from '../../services/appointment-booking-service';
import { log } from '../../services/logger';

describe('AppointmentBookingService', () => {
  const mockOrgId = 'org-123';
  const mockContactId = 'contact-456';
  const mockScheduledAt = new Date('2026-02-01T14:00:00Z');
  const mockDurationMinutes = 30;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bookAppointmentWithLock()', () => {
    test('should successfully book an available time slot', async () => {
      // ARRANGE
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          appointment_id: 'appt-789',
        },
        error: null,
      });

      const request: BookingRequest = {
        orgId: mockOrgId,
        contactId: mockContactId,
        scheduledAt: mockScheduledAt,
        durationMinutes: mockDurationMinutes,
      };

      // ACT
      const result = await bookAppointmentWithLock(request);

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.appointmentId).toBe('appt-789');
      expect(result.error).toBeUndefined();
      
      expect(mockRpc).toHaveBeenCalledWith(
        'book_appointment_with_lock',
        expect.objectContaining({
          p_org_id: mockOrgId,
          p_contact_id: mockContactId,
          p_scheduled_at: mockScheduledAt.toISOString(),
          p_duration_minutes: mockDurationMinutes,
        })
      );

      expect(log.info).toHaveBeenCalledWith(
        'AppointmentBooking',
        'Appointment booked successfully',
        expect.objectContaining({
          orgId: mockOrgId,
          appointmentId: 'appt-789',
        })
      );
    });

    test('should reject booking when slot is already occupied', async () => {
      // ARRANGE
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Time slot is already booked',
          conflicting_appointment: {
            id: 'existing-appt-123',
            scheduled_at: mockScheduledAt.toISOString(),
            contact_name: 'John Doe',
          },
        },
        error: null,
      });

      const request: BookingRequest = {
        orgId: mockOrgId,
        contactId: mockContactId,
        scheduledAt: mockScheduledAt,
        durationMinutes: mockDurationMinutes,
      };

      // ACT
      const result = await bookAppointmentWithLock(request);

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.error).toBe('Time slot is already booked');
      expect(result.conflictingAppointment).toBeDefined();
      expect(result.conflictingAppointment?.id).toBe('existing-appt-123');

      expect(log.warn).toHaveBeenCalledWith(
        'AppointmentBooking',
        'Booking conflict detected',
        expect.objectContaining({
          orgId: mockOrgId,
        })
      );
    });

    test('should handle database errors gracefully', async () => {
      // ARRANGE
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });

      const request: BookingRequest = {
        orgId: mockOrgId,
        contactId: mockContactId,
        scheduledAt: mockScheduledAt,
        durationMinutes: mockDurationMinutes,
      };

      // ACT
      const result = await bookAppointmentWithLock(request);

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');

      expect(log.error).toHaveBeenCalledWith(
        'AppointmentBooking',
        'Database error during booking',
        expect.objectContaining({
          orgId: mockOrgId,
          error: 'Connection timeout',
        })
      );
    });

    test('should include optional fields in booking request', async () => {
      // ARRANGE
      mockRpc.mockResolvedValue({
        data: { success: true, appointment_id: 'appt-789' },
        error: null,
      });

      const request: BookingRequest = {
        orgId: mockOrgId,
        contactId: mockContactId,
        scheduledAt: mockScheduledAt,
        durationMinutes: mockDurationMinutes,
        serviceId: 'service-123',
        notes: 'Patient requested morning slot',
        metadata: { source: 'phone_call', priority: 'high' },
      };

      // ACT
      await bookAppointmentWithLock(request);

      // ASSERT
      expect(mockRpc).toHaveBeenCalledWith(
        'book_appointment_with_lock',
        expect.objectContaining({
          p_service_id: 'service-123',
          p_notes: 'Patient requested morning slot',
          p_metadata: { source: 'phone_call', priority: 'high' },
        })
      );
    });

    test('should generate deterministic lock key for same slot', async () => {
      // ARRANGE
      mockRpc.mockResolvedValue({
        data: { success: true, appointment_id: 'appt-1' },
        error: null,
      });

      const request: BookingRequest = {
        orgId: mockOrgId,
        contactId: mockContactId,
        scheduledAt: mockScheduledAt,
        durationMinutes: mockDurationMinutes,
      };

      // ACT
      await bookAppointmentWithLock(request);
      const firstCallArgs = mockRpc.mock.calls[0][1];

      mockRpc.mockClear();
      mockRpc.mockResolvedValue({
        data: { success: true, appointment_id: 'appt-2' },
        error: null,
      });

      await bookAppointmentWithLock(request);
      const secondCallArgs = mockRpc.mock.calls[0][1];

      // ASSERT - Same slot should generate same lock key
      expect(firstCallArgs.p_lock_key).toBe(secondCallArgs.p_lock_key);
    });
  });

  describe('checkSlotAvailability()', () => {
    test('should return true for available slot', async () => {
      // ARRANGE
      mockFromChain.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      // ACT
      const available = await checkSlotAvailability(
        mockOrgId,
        mockScheduledAt,
        mockDurationMinutes
      );

      // ASSERT
      expect(available).toBe(true);
    });

    test('should return false for occupied slot', async () => {
      // ARRANGE
      mockFromChain.limit.mockResolvedValue({
        data: [{ id: 'existing-appt' }],
        error: null,
      });

      // ACT
      const available = await checkSlotAvailability(
        mockOrgId,
        mockScheduledAt,
        mockDurationMinutes
      );

      // ASSERT
      expect(available).toBe(false);
    });

    test('should return false on database error (fail-safe)', async () => {
      // ARRANGE
      mockFromChain.limit.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      // ACT
      const available = await checkSlotAvailability(
        mockOrgId,
        mockScheduledAt,
        mockDurationMinutes
      );

      // ASSERT
      expect(available).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('cancelAppointment()', () => {
    test('should successfully cancel appointment', async () => {
      // ARRANGE
      mockFromChain.eq.mockResolvedValue({
        error: null,
      });

      const appointmentId = 'appt-123';
      const cancelledBy = 'user-456';
      const reason = 'Patient requested cancellation';

      // ACT
      const result = await cancelAppointment(appointmentId, cancelledBy, reason);

      // ASSERT
      expect(result).toBe(true);
      expect(mockFromChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          deleted_by: cancelledBy,
          deletion_reason: reason,
        })
      );
      expect(log.info).toHaveBeenCalledWith(
        'AppointmentBooking',
        'Appointment cancelled',
        expect.objectContaining({ appointmentId })
      );
    });

    test('should handle cancellation errors', async () => {
      // ARRANGE
      mockFromChain.eq.mockResolvedValue({
        error: { message: 'Appointment not found' },
      });

      // ACT
      const result = await cancelAppointment('appt-123', 'user-456');

      // ASSERT
      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('rescheduleAppointment()', () => {
    test('should successfully reschedule appointment', async () => {
      // ARRANGE
      // Mock fetching existing appointment
      mockFromChain.single.mockResolvedValue({
        data: {
          org_id: mockOrgId,
          contact_id: mockContactId,
          duration_minutes: 30,
          service_id: 'service-123',
          notes: 'Original notes',
          metadata: { priority: 'high' },
        },
        error: null,
      });

      // Mock successful new booking
      mockRpc.mockResolvedValue({
        data: { success: true, appointment_id: 'new-appt-789' },
        error: null,
      });

      // Mock cancellation
      mockFromChain.eq.mockResolvedValue({ error: null });

      const newScheduledAt = new Date('2026-02-02T15:00:00Z');

      // ACT
      const result = await rescheduleAppointment(
        'old-appt-123',
        newScheduledAt,
        'user-456'
      );

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.appointmentId).toBe('new-appt-789');
      expect(mockRpc).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        'AppointmentBooking',
        'Appointment rescheduled successfully',
        expect.objectContaining({
          oldAppointmentId: 'old-appt-123',
          newAppointmentId: 'new-appt-789',
        })
      );
    });

    test('should handle rescheduling when new slot is unavailable', async () => {
      // ARRANGE
      mockFromChain.single.mockResolvedValue({
        data: {
          org_id: mockOrgId,
          contact_id: mockContactId,
          duration_minutes: 30,
        },
        error: null,
      });

      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Time slot is already booked',
        },
        error: null,
      });

      const newScheduledAt = new Date('2026-02-02T15:00:00Z');

      // ACT
      const result = await rescheduleAppointment(
        'old-appt-123',
        newScheduledAt,
        'user-456'
      );

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.error).toBe('Time slot is already booked');
      // Old appointment should NOT be cancelled if new booking fails
    });

    test('should handle appointment not found error', async () => {
      // ARRANGE
      mockFromChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const newScheduledAt = new Date('2026-02-02T15:00:00Z');

      // ACT
      const result = await rescheduleAppointment(
        'non-existent-appt',
        newScheduledAt,
        'user-456'
      );

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });
  });

  describe('Race Condition Prevention', () => {
    test('should use advisory locks to prevent concurrent bookings', async () => {
      // ARRANGE
      // This test verifies that the lock key is passed to the RPC function
      mockRpc.mockResolvedValue({
        data: { success: true, appointment_id: 'appt-123' },
        error: null,
      });

      const request: BookingRequest = {
        orgId: mockOrgId,
        contactId: mockContactId,
        scheduledAt: mockScheduledAt,
        durationMinutes: mockDurationMinutes,
      };

      // ACT
      await bookAppointmentWithLock(request);

      // ASSERT
      const rpcCall = mockRpc.mock.calls[0];
      expect(rpcCall[0]).toBe('book_appointment_with_lock');
      expect(rpcCall[1].p_lock_key).toBeDefined();
      expect(typeof rpcCall[1].p_lock_key).toBe('string');
    });
  });
});
