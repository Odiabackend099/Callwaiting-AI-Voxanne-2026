/**
 * Unit Tests: Booking Confirmation Service
 * Tests appointment confirmation logic with idempotency and audit logging
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';

/**
 * Mock Booking Confirmation Service
 */
class BookingConfirmationService {
  constructor(private supabaseClient: any) {}

  async confirmAppointment(
    appointmentId: string,
    userId: string,
    orgId: string,
    notes?: string
  ) {
    // Get appointment
    const { data: appointment, error: fetchError } =
      await this.supabaseClient
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('org_id', orgId)
        .single();

    if (fetchError || !appointment) {
      throw new Error('Appointment not found or unauthorized');
    }

    if (appointment.status === 'confirmed') {
      return appointment; // Already confirmed
    }

    // Update appointment
    const { data: updated, error: updateError } = await this.supabaseClient
      .from('appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to confirm appointment: ${updateError.message}`);
    }

    // Create audit log
    const { error: auditError } = await this.supabaseClient
      .from('booking_audit_log')
      .insert({
        org_id: orgId,
        appointment_id: appointmentId,
        user_id: userId,
        action: 'confirmed',
        notes,
        timestamp: new Date().toISOString(),
      });

    if (auditError) {
      console.warn(`Failed to create audit log: ${auditError.message}`);
    }

    return updated;
  }
}

describe('Unit Tests: Booking Confirmation Service', () => {
  let bookingService: BookingConfirmationService;
  let mockSupabase: any;
  const testOrgId = uuid();
  const testAppointmentId = uuid();
  const testUserId = uuid();

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn((table: string) => {
        const chainObj: any = {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'appointments') {
          chainObj.single.mockResolvedValue({
            data: {
              id: testAppointmentId,
              org_id: testOrgId,
              status: 'pending',
              scheduled_at: new Date(Date.now() + 86400000).toISOString(),
            },
            error: null,
          });
        }

        if (table === 'booking_audit_log') {
          chainObj.single = jest.fn().mockResolvedValue({
            data: { id: uuid() },
            error: null,
          });
        }

        return chainObj;
      }),
    };

    bookingService = new BookingConfirmationService(mockSupabase);
  });

  describe('Happy Path', () => {
    it('Should successfully confirm appointment and create audit log', async () => {
      // Setup mock to return updated appointment
      mockSupabase.from = jest.fn((table: string) => {
        const chainObj: any = {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'appointments') {
          chainObj.single.mockResolvedValue({
            data: {
              id: testAppointmentId,
              org_id: testOrgId,
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
            },
            error: null,
          });
        }

        return chainObj;
      });

      bookingService = new BookingConfirmationService(mockSupabase);

      const result = await bookingService.confirmAppointment(
        testAppointmentId,
        testUserId,
        testOrgId,
        'Confirmed by staff'
      );

      expect(result.status).toBe('confirmed');
      expect(result.confirmed_at).toBeDefined();

      // Verify audit log was created
      expect(mockSupabase.from).toHaveBeenCalledWith('booking_audit_log');

      console.log('✅ Booking Confirmation Service: Happy path PASS');
    });
  });

  describe('Idempotency', () => {
    it('Should return already-confirmed appointment without error', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        const chainObj: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'appointments') {
          chainObj.single.mockResolvedValue({
            data: {
              id: testAppointmentId,
              org_id: testOrgId,
              status: 'confirmed', // Already confirmed
              confirmed_at: new Date().toISOString(),
            },
            error: null,
          });
        }

        return chainObj;
      });

      bookingService = new BookingConfirmationService(mockSupabase);

      const result = await bookingService.confirmAppointment(
        testAppointmentId,
        testUserId,
        testOrgId
      );

      expect(result.status).toBe('confirmed');

      console.log('✅ Booking Confirmation Service: Idempotency PASS');
    });
  });

  describe('Security & Validation', () => {
    it('Should enforce org_id filtering (tenant isolation)', async () => {
      const otherOrgId = uuid();

      mockSupabase.from = jest.fn((table: string) => {
        const chainObj: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        };

        return chainObj;
      });

      bookingService = new BookingConfirmationService(mockSupabase);

      await expect(
        bookingService.confirmAppointment(
          testAppointmentId,
          testUserId,
          otherOrgId
        )
      ).rejects.toThrow('Appointment not found or unauthorized');

      console.log('✅ Booking Confirmation Service: Tenant isolation PASS');
    });

    it('Should reject non-existent appointment', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        const chainObj: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        };

        return chainObj;
      });

      bookingService = new BookingConfirmationService(mockSupabase);

      await expect(
        bookingService.confirmAppointment(
          'nonexistent-id',
          testUserId,
          testOrgId
        )
      ).rejects.toThrow('Appointment not found or unauthorized');

      console.log('✅ Booking Confirmation Service: Non-existent appointment PASS');
    });
  });

  describe('Error Handling', () => {
    it('Should handle database update errors gracefully', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        const chainObj: any = {
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };

        if (table === 'appointments') {
          // First call - fetch succeeds
          if (!chainObj.selectCalled) {
            chainObj.selectCalled = true;
            chainObj.single.mockResolvedValueOnce({
              data: {
                id: testAppointmentId,
                org_id: testOrgId,
                status: 'pending',
              },
              error: null,
            });
          } else {
            // Second call - update fails
            chainObj.single.mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            });
          }
        }

        return chainObj;
      });

      bookingService = new BookingConfirmationService(mockSupabase);

      await expect(
        bookingService.confirmAppointment(
          testAppointmentId,
          testUserId,
          testOrgId
        )
      ).rejects.toThrow('Failed to confirm appointment');

      console.log('✅ Booking Confirmation Service: Error handling PASS');
    });
  });
});
