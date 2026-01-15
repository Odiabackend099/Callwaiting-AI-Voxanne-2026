/**
 * Phase 6B Booking Chain Fixtures
 * 
 * Helper functions for booking/appointment testing.
 * Uses in-memory storage for tests (test_bookings table not yet deployed).
 * Business logic is identical to what production would use.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let db: SupabaseClient;

// In-memory store for test bookings
const bookingsStore: Map<string, Booking> = new Map();

/**
 * Initialize database connection for fixtures
 */
export function initializeFixtures(supabaseClient: SupabaseClient) {
  db = supabaseClient;
  // Clear bookings store
  bookingsStore.clear();
}

/**
 * Type definitions
 */
export interface Booking {
  id: string;
  org_id: string;
  patient_email: string;
  provider_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  calendar_event_id?: string;
  confirmation_token?: string;
  patient_confirmed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
}

/**
 * Create a new booking
 */
export async function createBooking(options: {
  clinicId: string;
  providerId: string;
  patientEmail: string;
  startTime: Date;
  endTime?: Date;
  notes?: string;
}): Promise<Booking> {
  // Validate inputs
  if (!options.clinicId || !options.providerId || !options.patientEmail || !options.startTime) {
    throw new Error('Missing required booking parameters');
  }

  // Calculate end time if not provided (default 30 minutes)
  const endTime = options.endTime || 
    new Date(options.startTime.getTime() + 30 * 60 * 1000);

  // Validate time range
  if (endTime <= options.startTime) {
    throw new Error('End time must be after start time');
  }

  // Check for conflicts with existing confirmed bookings
  const allBookings = Array.from(bookingsStore.values());
  const hasConflict = allBookings.some(booking => {
    // Same clinic, same provider, confirmed status
    if (booking.org_id !== options.clinicId || 
        booking.provider_id !== options.providerId || 
        booking.status !== 'confirmed') {
      return false;
    }

    // Check time overlap
    const bookStart = new Date(booking.start_time);
    const bookEnd = new Date(booking.end_time);
    return !(endTime <= bookStart || options.startTime >= bookEnd);
  });

  if (hasConflict) {
    throw new Error(
      `Time slot conflict: provider already has appointment between ${options.startTime} and ${endTime}`
    );
  }

  // Generate confirmation token for patient
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const bookingId = crypto.randomUUID();
  const now = new Date().toISOString();

  const booking: Booking = {
    id: bookingId,
    org_id: options.clinicId,
    provider_id: options.providerId,
    patient_email: options.patientEmail,
    start_time: options.startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: 'pending',
    confirmation_token: confirmationToken,
    notes: options.notes,
    created_at: now,
    updated_at: now,
    created_by: options.providerId,
  };

  // Store in memory
  bookingsStore.set(bookingId, booking);

  return booking;
}

/**
 * Update booking status with state machine validation
 */
export async function updateBookingStatus(
  appointmentId: string,
  newStatus: 'confirmed' | 'completed' | 'cancelled'
): Promise<Booking> {
  // Get current appointment
  const appointment = bookingsStore.get(appointmentId);

  if (!appointment) {
    throw new Error(`Appointment not found: ${appointmentId}`);
  }

  const currentStatus = appointment.status;

  // Validate state transition
  const validTransitions: Record<string, string[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new Error(
      `invalid status transition: ${currentStatus} → ${newStatus}`
    );
  }

  // Update appointment
  const updated: Booking = {
    ...appointment,
    status: newStatus as any,
    updated_at: new Date().toISOString(),
  };

  bookingsStore.set(appointmentId, updated);

  return updated;
}

/**
 * Get all appointments for a clinic with optional filters
 */
export async function getClinicBookings(
  clinicId: string,
  filters?: {
    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    dateRange?: [Date, Date];
    providerId?: string;
  }
): Promise<Booking[]> {
  // Get all bookings for this clinic
  let results = Array.from(bookingsStore.values())
    .filter(b => b.org_id === clinicId);

  // Apply status filter
  if (filters?.status) {
    results = results.filter(b => b.status === filters.status);
  }

  // Apply date range filter
  if (filters?.dateRange) {
    const [start, end] = filters.dateRange;
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    results = results.filter(b => b.start_time >= startIso && b.start_time <= endIso);
  }

  // Apply provider filter
  if (filters?.providerId) {
    results = results.filter(b => b.provider_id === filters.providerId);
  }

  // Sort by start time
  results.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return results;
}

/**
 * Get available time slots for a provider on a specific date
 */
export async function getAvailableSlots(
  clinicId: string,
  providerId: string,
  date: Date,
  slotDuration: number = 30
): Promise<AvailableSlot[]> {
  // Use date string to handle timezones consistently
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Fetch confirmed appointments for this provider on this date
  const appointments = Array.from(bookingsStore.values())
    .filter(b => {
      if (b.org_id !== clinicId || b.provider_id !== providerId || b.status !== 'confirmed') {
        return false;
      }
      // Check if booking is on this date
      const bookingDate = b.start_time.split('T')[0];
      return bookingDate === dateStr;
    });

  // Generate available slots
  const slots: AvailableSlot[] = [];
  
  // Create slots starting at 9:00 AM, using the provided date
  let current = new Date(`${dateStr}T09:00:00Z`);
  let endOfBusiness = new Date(`${dateStr}T17:00:00Z`);

  while (current < endOfBusiness) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60 * 1000);

    // Check if slot overlaps with any confirmed appointment
    const hasConflict = appointments.some(appt => {
      const apptStart = new Date(appt.start_time);
      const apptEnd = new Date(appt.end_time);
      return current < apptEnd && slotEnd > apptStart;
    });

    if (!hasConflict) {
      slots.push({
        start: new Date(current),
        end: new Date(slotEnd),
      });
    }

    current = new Date(current.getTime() + slotDuration * 60 * 1000);
  }

  return slots;
}

/**
 * Confirm a booking using confirmation token
 */
export async function confirmBooking(
  confirmationToken: string
): Promise<Booking> {
  // Find appointment by token
  const appointment = Array.from(bookingsStore.values())
    .find(b => b.confirmation_token === confirmationToken);

  if (!appointment) {
    throw new Error('Invalid or expired confirmation token');
  }

  // Check current status
  if (appointment.status !== 'pending') {
    throw new Error(`Appointment already ${appointment.status}`);
  }

  // Update status and clear token
  const updated: Booking = {
    ...appointment,
    status: 'confirmed',
    patient_confirmed_at: new Date().toISOString(),
    confirmation_token: null as any,
    updated_at: new Date().toISOString(),
  };

  bookingsStore.set(appointment.id, updated);

  return updated;
}

/**
 * Verify clinic isolation
 */
export async function verifyClinicIsolation(
  clinicA: string,
  clinicB: string
): Promise<{
  isolated: boolean;
  clinicABookingCount: number;
  clinicBBookingCount: number;
  sharedBookings: number;
  reason: string;
}> {
  // Get all bookings for both clinics
  const bookingsA = await getClinicBookings(clinicA);
  const bookingsB = await getClinicBookings(clinicB);

  // Check for shared bookings (should be 0)
  const sharedBookings = bookingsA.filter(bA =>
    bookingsB.some(bB => bB.id === bA.id)
  ).length;

  const isolated = sharedBookings === 0;
  const reason = isolated
    ? 'Clinics fully isolated'
    : `${sharedBookings} bookings shared between clinics`;

  return {
    isolated,
    clinicABookingCount: bookingsA.length,
    clinicBBookingCount: bookingsB.length,
    sharedBookings,
    reason,
  };
}

/**
 * Re-export fixtures from clinic-auth-fixtures for convenience
 */
export { seedClinic, seedUser, createMockAuthToken } from './clinic-auth-fixtures';
