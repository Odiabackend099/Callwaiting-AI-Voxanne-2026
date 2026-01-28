/**
 * Appointment Booking Service with Advisory Locks
 * 
 * Prevents race conditions and double-bookings using Postgres advisory locks.
 * 
 * CRITICAL: This service MUST be used for all appointment booking operations
 * to ensure data integrity under concurrent load.
 */

import { createClient } from '@supabase/supabase-js';
import { log } from './logger';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface BookingRequest {
  orgId: string;
  contactId: string;
  scheduledAt: Date;
  durationMinutes: number;
  serviceId?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface BookingResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
  conflictingAppointment?: {
    id: string;
    scheduledAt: string;
    contactName?: string;
  };
}

/**
 * Convert slot identifier to 64-bit integer for pg_advisory_lock
 * 
 * Advisory locks require a bigint key. We hash the org_id + timestamp
 * to create a deterministic, collision-resistant key.
 */
function hashSlotToInt64(orgId: string, scheduledAt: Date): string {
  const slotKey = `${orgId}_${scheduledAt.toISOString()}`;
  const hash = crypto.createHash('sha256').update(slotKey).digest();
  
  // Read first 8 bytes as signed 64-bit integer
  const lockKey = hash.readBigInt64BE(0);
  
  return lockKey.toString();
}

/**
 * Book an appointment with advisory lock protection
 * 
 * This function uses Postgres advisory locks to prevent race conditions
 * when multiple requests try to book the same time slot simultaneously.
 * 
 * Flow:
 * 1. Begin transaction
 * 2. Acquire advisory lock for the specific time slot
 * 3. Check for conflicts (protected by lock)
 * 4. Insert appointment if no conflicts
 * 5. Commit transaction (releases lock automatically)
 * 
 * @param request - Booking details
 * @returns BookingResult with success status and appointment ID or error
 */
export async function bookAppointmentWithLock(
  request: BookingRequest
): Promise<BookingResult> {
  const { orgId, contactId, scheduledAt, durationMinutes, serviceId, notes, metadata } = request;
  
  log.info('AppointmentBooking', 'Attempting to book appointment', {
    orgId,
    contactId,
    scheduledAt: scheduledAt.toISOString(),
    durationMinutes,
  });

  try {
    // Generate lock key for this specific time slot
    const lockKey = hashSlotToInt64(orgId, scheduledAt);
    
    log.debug('AppointmentBooking', 'Acquiring advisory lock', {
      orgId,
      lockKey,
      scheduledAt: scheduledAt.toISOString(),
    });

    // Use Supabase RPC to execute the booking with advisory lock
    // This ensures atomicity and prevents race conditions
    const { data, error } = await supabase.rpc('book_appointment_with_lock', {
      p_org_id: orgId,
      p_contact_id: contactId,
      p_scheduled_at: scheduledAt.toISOString(),
      p_duration_minutes: durationMinutes,
      p_service_id: serviceId || null,
      p_notes: notes || null,
      p_metadata: metadata || null,
      p_lock_key: lockKey,
    });

    if (error) {
      log.error('AppointmentBooking', 'Database error during booking', {
        orgId,
        scheduledAt: scheduledAt.toISOString(),
        error: error.message,
      });
      
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    // Check if booking was successful
    if (data && data.success) {
      log.info('AppointmentBooking', 'Appointment booked successfully', {
        orgId,
        appointmentId: data.appointment_id,
        scheduledAt: scheduledAt.toISOString(),
      });

      return {
        success: true,
        appointmentId: data.appointment_id,
      };
    } else {
      // Slot was already booked (conflict detected)
      log.warn('AppointmentBooking', 'Booking conflict detected', {
        orgId,
        scheduledAt: scheduledAt.toISOString(),
        conflictingAppointment: data?.conflicting_appointment,
      });

      return {
        success: false,
        error: 'Time slot is already booked',
        conflictingAppointment: data?.conflicting_appointment,
      };
    }
  } catch (error: any) {
    log.error('AppointmentBooking', 'Unexpected error during booking', {
      orgId,
      scheduledAt: scheduledAt.toISOString(),
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: `Booking failed: ${error.message}`,
    };
  }
}

/**
 * Check if a time slot is available without booking it
 * 
 * This is useful for pre-flight checks before showing available slots to users.
 * Note: This does NOT use advisory locks, so it's possible for a slot to become
 * unavailable between checking and booking. Always handle booking conflicts gracefully.
 * 
 * @param orgId - Organization ID
 * @param scheduledAt - Desired appointment time
 * @param durationMinutes - Appointment duration
 * @returns true if slot is available, false if occupied
 */
export async function checkSlotAvailability(
  orgId: string,
  scheduledAt: Date,
  durationMinutes: number
): Promise<boolean> {
  try {
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60000);

    // Check for overlapping appointments
    const { data, error } = await supabase
      .from('appointments')
      .select('id')
      .eq('org_id', orgId)
      .in('status', ['confirmed', 'pending'])
      .is('deleted_at', null)
      .or(`and(scheduled_at.lte.${scheduledAt.toISOString()},scheduled_at.gte.${endTime.toISOString()}),and(scheduled_at.gte.${scheduledAt.toISOString()},scheduled_at.lt.${endTime.toISOString()})`)
      .limit(1);

    if (error) {
      log.error('AppointmentBooking', 'Error checking slot availability', {
        orgId,
        scheduledAt: scheduledAt.toISOString(),
        error: error.message,
      });
      return false; // Fail safe: assume slot is unavailable
    }

    return !data || data.length === 0;
  } catch (error: any) {
    log.error('AppointmentBooking', 'Unexpected error checking availability', {
      orgId,
      scheduledAt: scheduledAt.toISOString(),
      error: error.message,
    });
    return false; // Fail safe
  }
}

/**
 * Cancel an appointment
 * 
 * Soft-deletes the appointment by setting status to 'cancelled' and
 * recording the deletion timestamp for GDPR compliance.
 * 
 * @param appointmentId - Appointment UUID
 * @param cancelledBy - User ID who cancelled
 * @param reason - Cancellation reason
 * @returns true if successful, false otherwise
 */
export async function cancelAppointment(
  appointmentId: string,
  cancelledBy: string,
  reason?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        deleted_at: new Date().toISOString(),
        deleted_by: cancelledBy,
        deletion_reason: reason || 'User cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      log.error('AppointmentBooking', 'Error cancelling appointment', {
        appointmentId,
        error: error.message,
      });
      return false;
    }

    log.info('AppointmentBooking', 'Appointment cancelled', {
      appointmentId,
      cancelledBy,
      reason,
    });

    return true;
  } catch (error: any) {
    log.error('AppointmentBooking', 'Unexpected error cancelling appointment', {
      appointmentId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Reschedule an appointment
 * 
 * This is a convenience function that cancels the old appointment and
 * creates a new one. Uses advisory locks to prevent race conditions.
 * 
 * @param appointmentId - Current appointment ID
 * @param newScheduledAt - New appointment time
 * @param rescheduledBy - User ID who rescheduled
 * @returns BookingResult for the new appointment
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newScheduledAt: Date,
  rescheduledBy: string
): Promise<BookingResult> {
  try {
    // Get current appointment details
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('org_id, contact_id, duration_minutes, service_id, notes, metadata')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      log.error('AppointmentBooking', 'Appointment not found for rescheduling', {
        appointmentId,
        error: fetchError?.message,
      });
      return {
        success: false,
        error: 'Appointment not found',
      };
    }

    // Book new appointment with lock
    const bookingResult = await bookAppointmentWithLock({
      orgId: appointment.org_id,
      contactId: appointment.contact_id,
      scheduledAt: newScheduledAt,
      durationMinutes: appointment.duration_minutes,
      serviceId: appointment.service_id,
      notes: appointment.notes,
      metadata: appointment.metadata,
    });

    if (bookingResult.success) {
      // Cancel old appointment
      await cancelAppointment(
        appointmentId,
        rescheduledBy,
        `Rescheduled to ${newScheduledAt.toISOString()}`
      );

      log.info('AppointmentBooking', 'Appointment rescheduled successfully', {
        oldAppointmentId: appointmentId,
        newAppointmentId: bookingResult.appointmentId,
        newScheduledAt: newScheduledAt.toISOString(),
      });
    }

    return bookingResult;
  } catch (error: any) {
    log.error('AppointmentBooking', 'Error rescheduling appointment', {
      appointmentId,
      error: error.message,
    });
    return {
      success: false,
      error: `Rescheduling failed: ${error.message}`,
    };
  }
}
