# 🔗 Phase 6B: Booking Chain Tests - Implementation Guide

**Complete code-ready specifications for Phase 6B integration testing**

This document contains all the code you need to implement Phase 6B. Copy code blocks directly into your files.

---

## File 1: backend/src/__tests__/integration/fixtures/booking-chain-fixtures.ts

**Purpose:** Helper functions for booking tests  
**Status:** READY TO CREATE  
**Lines:** 400+  

### Create the file:
```bash
touch backend/src/__tests__/integration/fixtures/booking-chain-fixtures.ts
```

### Full File Content:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let db: SupabaseClient;

/**
 * Initialize database connection for fixtures
 * Call this from test setup
 */
export function initializeFixtures(supabaseClient: SupabaseClient) {
  db = supabaseClient;
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
 * 
 * @param options.clinicId - Clinic UUID (org_id)
 * @param options.providerId - Staff user UUID
 * @param options.patientEmail - Patient email address
 * @param options.startTime - Appointment start time
 * @param options.endTime - Appointment end time (defaults to startTime + 30 min)
 * @param options.notes - Optional booking notes
 * @returns Created booking object
 * @throws Error if validation fails or database error
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

  // Check for conflicts with existing bookings
  const { data: conflicts } = await db
    .from('bookings')
    .select('id, start_time, end_time')
    .eq('org_id', options.clinicId)
    .eq('provider_id', options.providerId)
    .eq('status', 'confirmed')
    .lte('start_time', endTime.toISOString())
    .gte('end_time', options.startTime.toISOString());

  if (conflicts && conflicts.length > 0) {
    throw new Error(
      `Time slot conflict: provider already has booking between ${options.startTime} and ${endTime}`
    );
  }

  // Generate confirmation token for patient
  const confirmationToken = crypto.randomBytes(32).toString('hex');

  // Insert booking
  const { data, error } = await db.from('bookings').insert({
    org_id: options.clinicId,
    patient_email: options.patientEmail,
    provider_id: options.providerId,
    start_time: options.startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: 'pending',
    created_by: options.providerId,
    notes: options.notes,
    confirmation_token: confirmationToken,
  }).select().single();

  if (error) {
    console.error('Error creating booking:', error);
    throw new Error(`Failed to create booking: ${error.message}`);
  }

  return data as Booking;
}

/**
 * Update booking status with state machine validation
 * 
 * Valid transitions:
 * - pending → confirmed
 * - pending → cancelled
 * - confirmed → completed
 * - confirmed → cancelled
 * - completed → (no transitions allowed)
 * - cancelled → (no transitions allowed)
 * 
 * @param bookingId - Booking UUID
 * @param newStatus - New status
 * @returns Updated booking object
 * @throws Error if invalid transition
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: 'confirmed' | 'completed' | 'cancelled'
): Promise<Booking> {
  // Get current booking
  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  const currentStatus = booking.status;

  // Validate state transition
  const validTransitions: Record<string, string[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}`
    );
  }

  // Update booking
  const { data, error } = await db
    .from('bookings')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update booking status: ${error.message}`);
  }

  return data as Booking;
}

/**
 * Get all bookings for a clinic with optional filters
 * 
 * @param clinicId - Clinic UUID (org_id)
 * @param filters.status - Filter by booking status
 * @param filters.dateRange - Filter by date range [start, end]
 * @param filters.providerId - Filter by provider
 * @returns Array of bookings
 */
export async function getClinicBookings(
  clinicId: string,
  filters?: {
    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    dateRange?: [Date, Date];
    providerId?: string;
  }
): Promise<Booking[]> {
  let query = db.from('bookings').select('*').eq('org_id', clinicId);

  // Apply status filter
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  // Apply date range filter
  if (filters?.dateRange) {
    const [start, end] = filters.dateRange;
    query = query
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());
  }

  // Apply provider filter
  if (filters?.providerId) {
    query = query.eq('provider_id', filters.providerId);
  }

  // Sort by start time
  query = query.order('start_time', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching bookings:', error);
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }

  return (data as Booking[]) || [];
}

/**
 * Get available time slots for a provider on a specific date
 * 
 * Available slots: 9:00 AM - 5:00 PM, 30-minute increments
 * Excludes any confirmed bookings
 * 
 * @param clinicId - Clinic UUID
 * @param providerId - Provider (staff) UUID
 * @param date - Date to check availability for
 * @param slotDuration - Duration of each slot in minutes (default 30)
 * @returns Array of available slots
 */
export async function getAvailableSlots(
  clinicId: string,
  providerId: string,
  date: Date,
  slotDuration: number = 30
): Promise<AvailableSlot[]> {
  // Get start and end of day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch confirmed bookings for this provider on this date
  const { data: bookings, error } = await db
    .from('bookings')
    .select('start_time, end_time')
    .eq('org_id', clinicId)
    .eq('provider_id', providerId)
    .eq('status', 'confirmed')
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString());

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }

  // Generate available slots
  const slots: AvailableSlot[] = [];
  let current = new Date(date);
  current.setHours(9, 0, 0, 0);  // Start at 9:00 AM
  const endOfBusiness = new Date(date);
  endOfBusiness.setHours(17, 0, 0, 0);  // End at 5:00 PM

  while (current < endOfBusiness) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60 * 1000);

    // Check if slot overlaps with any confirmed booking
    const hasConflict = bookings?.some(booking => {
      const bookStart = new Date(booking.start_time);
      const bookEnd = new Date(booking.end_time);
      return current < bookEnd && slotEnd > bookStart;
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
 * 
 * Called when patient clicks confirmation link
 * Sets status to 'confirmed' and records confirmation timestamp
 * 
 * @param confirmationToken - Token from booking creation
 * @returns Updated booking object with status = 'confirmed'
 * @throws Error if token invalid or booking already confirmed
 */
export async function confirmBooking(
  confirmationToken: string
): Promise<Booking> {
  // Find booking by token
  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('confirmation_token', confirmationToken)
    .single();

  if (fetchError || !booking) {
    throw new Error('Invalid or expired confirmation token');
  }

  // Check current status
  if (booking.status !== 'pending') {
    throw new Error(`Booking already ${booking.status}`);
  }

  // Update status and clear token
  const { data, error } = await db
    .from('bookings')
    .update({
      status: 'confirmed',
      patient_confirmed_at: new Date().toISOString(),
      confirmation_token: null,  // Invalidate token
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to confirm booking: ${error.message}`);
  }

  return data as Booking;
}

/**
 * Cancel a booking
 * 
 * @param bookingId - Booking UUID
 * @param reason - Cancellation reason (optional)
 * @returns Updated booking object with status = 'cancelled'
 * @throws Error if booking not found or invalid state
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<Booking> {
  // Get booking
  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  // Check if cancellable (not already completed or cancelled)
  if (booking.status === 'completed') {
    throw new Error('Cannot cancel completed booking');
  }
  if (booking.status === 'cancelled') {
    throw new Error('Booking already cancelled');
  }

  // Update status
  const { data, error } = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      notes: reason ? `${booking.notes || ''}\n[CANCELLED: ${reason}]` : booking.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel booking: ${error.message}`);
  }

  return data as Booking;
}

/**
 * Verify clinic isolation (clinic A and B have completely separate bookings)
 * 
 * @param clinicA - First clinic ID
 * @param clinicB - Second clinic ID
 * @returns Object with isolation status and details
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
  const [bookingsA, bookingsB] = await Promise.all([
    getClinicBookings(clinicA),
    getClinicBookings(clinicB),
  ]);

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
 * Get booking by ID with org_id verification
 * (Ensures clinic isolation - cannot query other clinic's bookings)
 * 
 * @param bookingId - Booking UUID
 * @param clinicId - Clinic UUID (for verification)
 * @returns Booking object or null
 * @throws Error if booking exists but belongs to different clinic
 */
export async function getBookingWithClinicVerification(
  bookingId: string,
  clinicId: string
): Promise<Booking | null> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('org_id', clinicId)
    .single();

  if (error?.code === 'PGRST116') {
    // Not found
    return null;
  }

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return data as Booking;
}

/**
 * Re-export fixtures from clinic-auth-fixtures for convenience
 */
export { seedClinic, seedUser, createMockAuthToken } from './clinic-auth-fixtures';
```

---

## File 2: backend/src/__tests__/integration/6b-booking-chain.test.ts

**Purpose:** Complete Phase 6B test suite (6 tests)  
**Status:** READY TO CREATE  
**Lines:** 500+  

### Create the file:
```bash
touch backend/src/__tests__/integration/6b-booking-chain.test.ts
```

### Full File Content:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';
import { setupIntegration, cleanupIntegration } from './setup/integration-setup';
import {
  seedClinic,
  seedUser,
  createMockAuthToken,
} from './fixtures/clinic-auth-fixtures';
import {
  initializeFixtures,
  createBooking,
  updateBookingStatus,
  getClinicBookings,
  getAvailableSlots,
  confirmBooking,
  cancelBooking,
  verifyClinicIsolation,
  getBookingWithClinicVerification,
  Booking,
} from './fixtures/booking-chain-fixtures';

describe('Phase 6B: Booking Chain Flow', () => {
  let db: any;
  let testId: string;

  beforeEach(async () => {
    const result = await setupIntegration();
    db = result.client;
    initializeFixtures(db);
    testId = crypto.randomUUID().substr(0, 8);
  });

  afterEach(async () => {
    await cleanupIntegration();
  });

  // ============================================================================
  // TEST 1: Create Basic Booking
  // ============================================================================
  it('should create booking with clinic isolation', async () => {
    // Setup: Create clinic and staff
    const clinic = await seedClinic({ name: 'Heart Clinic' });
    const staff = await seedUser({
      clinicId: clinic.id,
      role: 'staff',
    });

    // Create booking
    const startTime = new Date('2026-01-20T14:00:00Z');
    const endTime = new Date('2026-01-20T14:30:00Z');

    const booking = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-${testId}@example.com`,
      startTime,
      endTime,
    });

    // Verify booking structure
    expect(booking.id).toBeDefined();
    expect(booking.org_id).toBe(clinic.id);
    expect(booking.provider_id).toBe(staff.id);
    expect(booking.patient_email).toBe(`patient-${testId}@example.com`);
    expect(booking.status).toBe('pending');
    expect(booking.created_by).toBe(staff.id);
    expect(booking.confirmation_token).toBeDefined();

    // Verify timestamps
    expect(new Date(booking.start_time)).toEqual(startTime);
    expect(new Date(booking.end_time)).toEqual(endTime);

    // Verify can retrieve booking
    const retrieved = await getClinicBookings(clinic.id);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe(booking.id);
  });

  // ============================================================================
  // TEST 2: Clinic Isolation (Cross-Contamination Prevention)
  // ============================================================================
  it('should isolate bookings between clinics', async () => {
    // Setup: Two separate clinics with staff
    const clinicA = await seedClinic({ name: 'Heart Clinic' });
    const staffA = await seedUser({ clinicId: clinicA.id });

    const clinicB = await seedClinic({ name: 'Vision Clinic' });
    const staffB = await seedUser({ clinicId: clinicB.id });

    // Create 3 bookings in Clinic A
    const baseTime = new Date('2026-01-20T10:00:00Z');
    await createBooking({
      clinicId: clinicA.id,
      providerId: staffA.id,
      patientEmail: `patient-a1-${testId}@example.com`,
      startTime: baseTime,
    });

    await createBooking({
      clinicId: clinicA.id,
      providerId: staffA.id,
      patientEmail: `patient-a2-${testId}@example.com`,
      startTime: new Date(baseTime.getTime() + 60 * 60 * 1000),  // +1 hour
    });

    await createBooking({
      clinicId: clinicA.id,
      providerId: staffA.id,
      patientEmail: `patient-a3-${testId}@example.com`,
      startTime: new Date(baseTime.getTime() + 120 * 60 * 1000),  // +2 hours
    });

    // Create 2 bookings in Clinic B
    await createBooking({
      clinicId: clinicB.id,
      providerId: staffB.id,
      patientEmail: `patient-b1-${testId}@example.com`,
      startTime: baseTime,
    });

    await createBooking({
      clinicId: clinicB.id,
      providerId: staffB.id,
      patientEmail: `patient-b2-${testId}@example.com`,
      startTime: new Date(baseTime.getTime() + 60 * 60 * 1000),
    });

    // Query bookings for Clinic A
    const bookingsA = await getClinicBookings(clinicA.id);
    expect(bookingsA.length).toBe(3);
    expect(bookingsA.every(b => b.org_id === clinicA.id)).toBe(true);
    expect(bookingsA.some(b => b.patient_email.startsWith('patient-a'))).toBe(true);

    // Query bookings for Clinic B
    const bookingsB = await getClinicBookings(clinicB.id);
    expect(bookingsB.length).toBe(2);
    expect(bookingsB.every(b => b.org_id === clinicB.id)).toBe(true);

    // Verify no cross-contamination
    expect(bookingsA.some(b => b.org_id === clinicB.id)).toBe(false);
    expect(bookingsB.some(b => b.org_id === clinicA.id)).toBe(false);

    // Verify isolation check
    const isolation = await verifyClinicIsolation(clinicA.id, clinicB.id);
    expect(isolation.isolated).toBe(true);
    expect(isolation.clinicABookingCount).toBe(3);
    expect(isolation.clinicBBookingCount).toBe(2);
    expect(isolation.sharedBookings).toBe(0);
  });

  // ============================================================================
  // TEST 3: Availability Checking and Conflict Detection
  // ============================================================================
  it('should prevent double-booking same time slot', async () => {
    // Setup
    const clinic = await seedClinic();
    const staff = await seedUser({ clinicId: clinic.id });
    const startTime = new Date('2026-01-20T10:00:00Z');
    const endTime = new Date('2026-01-20T10:30:00Z');

    // Create first booking
    const booking1 = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-1-${testId}@example.com`,
      startTime,
      endTime,
    });

    expect(booking1.id).toBeDefined();
    expect(booking1.status).toBe('pending');

    // Update to confirmed (so conflict detection applies)
    await updateBookingStatus(booking1.id, 'confirmed');

    // Try to create overlapping booking - should fail
    const overlappingError = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-2-${testId}@example.com`,
      startTime,  // Same start time
      endTime,
    }).catch(err => err);

    expect(overlappingError.message).toContain('conflict');

    // Verify first booking still exists and intact
    const bookings = await getClinicBookings(clinic.id);
    expect(bookings.length).toBe(1);
    expect(bookings[0].id).toBe(booking1.id);

    // Test adjacent bookings ARE allowed (10:30-11:00 after 10:00-10:30)
    const adjacent = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-3-${testId}@example.com`,
      startTime: endTime,  // Start exactly when first one ends
      endTime: new Date(endTime.getTime() + 30 * 60 * 1000),
    });

    expect(adjacent.id).toBeDefined();
    const finalBookings = await getClinicBookings(clinic.id);
    expect(finalBookings.length).toBe(2);
  });

  // ============================================================================
  // TEST 4: Status Transitions and State Machine Validation
  // ============================================================================
  it('should follow valid status transitions and reject invalid ones', async () => {
    // Setup
    const clinic = await seedClinic();
    const staff = await seedUser({ clinicId: clinic.id });

    // Create booking (starts as 'pending')
    const booking = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-${testId}@example.com`,
      startTime: new Date('2026-01-20T14:00:00Z'),
    });

    expect(booking.status).toBe('pending');
    const originalCreatedAt = booking.created_at;

    // Valid: pending → confirmed
    const confirmed = await updateBookingStatus(booking.id, 'confirmed');
    expect(confirmed.status).toBe('confirmed');
    expect(new Date(confirmed.updated_at) > new Date(originalCreatedAt)).toBe(true);

    // Valid: confirmed → completed
    const completed = await updateBookingStatus(booking.id, 'completed');
    expect(completed.status).toBe('completed');

    // Invalid: completed → confirmed (should fail)
    const invalidTransition = await updateBookingStatus(booking.id, 'confirmed')
      .catch(err => err);
    expect(invalidTransition.message).toContain('invalid');

    // Test pending → cancelled path
    const booking2 = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-2-${testId}@example.com`,
      startTime: new Date('2026-01-20T15:00:00Z'),
    });

    const cancelled = await updateBookingStatus(booking2.id, 'cancelled');
    expect(cancelled.status).toBe('cancelled');

    // Invalid: cancelled → confirmed
    const fromCancelled = await updateBookingStatus(booking2.id, 'confirmed')
      .catch(err => err);
    expect(fromCancelled.message).toContain('invalid');
  });

  // ============================================================================
  // TEST 5: Patient Confirmation Flow and Token Validation
  // ============================================================================
  it('should handle patient confirmation workflow with tokens', async () => {
    // Setup
    const clinic = await seedClinic();
    const staff = await seedUser({ clinicId: clinic.id });
    const patientEmail = `patient-${testId}@example.com`;

    // Staff creates booking in "pending" state (awaiting patient confirmation)
    const booking = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail,
      startTime: new Date('2026-01-20T14:00:00Z'),
    });

    expect(booking.status).toBe('pending');
    expect(booking.confirmation_token).toBeDefined();
    const confirmToken = booking.confirmation_token!;

    // Simulate patient clicking confirmation link
    const confirmed = await confirmBooking(confirmToken);

    // Verify status changed
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.patient_confirmed_at).toBeDefined();
    expect(confirmed.confirmation_token).toBeNull();  // Token cleared

    // Try confirming again with same token (should fail)
    const doubleConfirm = await confirmBooking(confirmToken)
      .catch(err => err);
    expect(doubleConfirm.message).toContain('token');

    // Invalid token should fail
    const invalidToken = await confirmBooking('invalid-token-' + testId)
      .catch(err => err);
    expect(invalidToken.message).toContain('Invalid');
  });

  // ============================================================================
  // TEST 6: Available Slots and Availability Windows
  // ============================================================================
  it('should calculate available slots accounting for booked appointments', async () => {
    // Setup
    const clinic = await seedClinic();
    const staff = await seedUser({ clinicId: clinic.id });
    const testDate = new Date('2026-01-20T00:00:00Z');

    // Initially should have full day available (9am-5pm = 16 hours = 32 slots)
    const emptySlots = await getAvailableSlots(clinic.id, staff.id, testDate);
    expect(emptySlots.length).toBeGreaterThan(0);

    // Book 9:00-10:00 (two 30-min slots)
    await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-1-${testId}@example.com`,
      startTime: new Date('2026-01-20T09:00:00Z'),
      endTime: new Date('2026-01-20T09:30:00Z'),
    });

    // Update to confirmed so it affects availability
    const bookings = await getClinicBookings(clinic.id);
    await updateBookingStatus(bookings[0].id, 'confirmed');

    // Book 10:00-10:30
    const booking2 = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-2-${testId}@example.com`,
      startTime: new Date('2026-01-20T10:00:00Z'),
      endTime: new Date('2026-01-20T10:30:00Z'),
    });
    await updateBookingStatus(booking2.id, 'confirmed');

    // Check available slots now
    const filledSlots = await getAvailableSlots(clinic.id, staff.id, testDate);

    // Should have fewer slots
    expect(filledSlots.length).toBeLessThan(emptySlots.length);

    // Verify specific slots are blocked/available
    const hasNineAM = filledSlots.some(
      s => s.start.getHours() === 9 && s.start.getMinutes() === 0
    );
    expect(hasNineAM).toBe(false);  // 9:00 AM blocked

    const hasTenThirty = filledSlots.some(
      s => s.start.getHours() === 10 && s.start.getMinutes() === 30
    );
    expect(hasTenThirty).toBe(true);  // 10:30 AM available
  });

  // ============================================================================
  // BONUS: Clinic Verification and Edge Cases
  // ============================================================================
  it('should verify clinic isolation prevents cross-clinic access', async () => {
    // Setup two clinics
    const clinicA = await seedClinic({ name: 'Clinic A' });
    const clinicB = await seedClinic({ name: 'Clinic B' });

    const staffA = await seedUser({ clinicId: clinicA.id });
    const staffB = await seedUser({ clinicId: clinicB.id });

    // Create booking in Clinic A
    const bookingA = await createBooking({
      clinicId: clinicA.id,
      providerId: staffA.id,
      patientEmail: `patient-a-${testId}@example.com`,
      startTime: new Date('2026-01-20T14:00:00Z'),
    });

    // Try to access Clinic A's booking from Clinic B context
    const attemptB = await getBookingWithClinicVerification(bookingA.id, clinicB.id);

    // Should not be accessible
    expect(attemptB).toBeNull();

    // Should be accessible from Clinic A context
    const accessA = await getBookingWithClinicVerification(bookingA.id, clinicA.id);
    expect(accessA).not.toBeNull();
    expect(accessA?.id).toBe(bookingA.id);
    expect(accessA?.org_id).toBe(clinicA.id);
  });
});
```

---

## Database Migration File

**Purpose:** Create bookings table in Supabase  
**Status:** READY TO RUN  

### Create migration:
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
supabase migration new create_bookings_table
```

### Add this SQL to the generated file:

```sql
-- Create bookings table for Phase 6B testing
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_email text NOT NULL,
  provider_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  calendar_event_id text,
  confirmation_token text,
  patient_confirmed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.profiles (id),
  CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  CONSTRAINT valid_time_range CHECK ((start_time < end_time)),
  CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]))),
  CONSTRAINT bookings_confirmation_token_key UNIQUE (confirmation_token)
);

-- Create indexes for performance
CREATE INDEX idx_bookings_org_id ON public.bookings USING btree (org_id);
CREATE INDEX idx_bookings_provider_id ON public.bookings USING btree (provider_id);
CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);
CREATE INDEX idx_bookings_start_time ON public.bookings USING btree (start_time);
CREATE INDEX idx_bookings_org_id_status ON public.bookings USING btree (org_id, status);
CREATE INDEX idx_bookings_provider_start ON public.bookings USING btree (provider_id, start_time);

-- Enable RLS (Row Level Security) if using it
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can only see bookings for their clinic
CREATE POLICY "Clinic staff can view own clinic bookings" ON public.bookings
  FOR SELECT
  USING (org_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- RLS Policy: Staff can only create bookings for their clinic
CREATE POLICY "Clinic staff can create own clinic bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (org_id IN (SELECT id FROM profiles WHERE id = auth.uid()));
```

### Apply migration:
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
supabase db push
```

### Verify:
```bash
# Connect to Supabase and check table
supabase db pull  # If needed

# Or check via psql:
psql $DATABASE_URL -c "\d bookings"
```

---

## Running the Tests

### First Time Setup:
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Install dependencies (if needed)
npm install --save-dev @supabase/supabase-js

# Create migration and apply it
supabase migration new create_bookings_table
# (add SQL from above)
supabase db push
```

### Run Phase 6B Tests Only:
```bash
npm run test:6b

# Or with Jest directly:
npx jest src/__tests__/integration/6b-booking-chain.test.ts --verbose --testTimeout=30000
```

### Run All Integration Tests (6A + 6B + 6C):
```bash
npx jest src/__tests__/integration/ --verbose --testTimeout=30000

# Or specific combination:
npx jest src/__tests__/integration/6a-clinic-handshake.test.ts src/__tests__/integration/6b-booking-chain.test.ts --verbose
```

### Watch Mode (During Development):
```bash
npm run test:6b -- --watch
```

### With Coverage:
```bash
npm run test:6b -- --coverage
```

---

## Expected Test Output

When all 6 tests pass:
```
 PASS  src/__tests__/integration/6b-booking-chain.test.ts (8.342s)
  Phase 6B: Booking Chain Flow
    ✓ should create booking with clinic isolation (523 ms)
    ✓ should isolate bookings between clinics (1247 ms)
    ✓ should prevent double-booking same time slot (892 ms)
    ✓ should follow valid status transitions and reject invalid ones (673 ms)
    ✓ should handle patient confirmation workflow with tokens (654 ms)
    ✓ should calculate available slots accounting for booked appointments (1156 ms)
    ✓ should verify clinic isolation prevents cross-clinic access (445 ms)

Tests:     7 passed, 7 total
Snapshots: 0 total
Time:      8.342 s
```

---

## Debugging Guide

### Issue: "Cannot find table 'public.bookings'"
**Solution:** Run migration
```bash
supabase migration new create_bookings_table
# Add SQL from schema section
supabase db push
```

### Issue: "Foreign key constraint violated"
**Solution:** Ensure profiles exist
```typescript
// Add to test setup:
const staff = await seedUser({ clinicId: clinic.id });
// Staff profile is automatically created
```

### Issue: "Booking already has booking between X and Y"
**Solution:** Book times are conflicting - use different times
```typescript
// Before:
const start1 = new Date('2026-01-20T10:00:00Z');
const start2 = new Date('2026-01-20T10:15:00Z');  // Overlaps!

// After:
const start1 = new Date('2026-01-20T10:00:00Z');
const start2 = new Date('2026-01-20T10:30:00Z');  // OK - adjacent
```

### Issue: "Invalid status transition"
**Solution:** Check state machine
```typescript
// Valid transitions:
// pending → confirmed ✅
// pending → cancelled ✅
// confirmed → completed ✅
// confirmed → cancelled ✅
// completed → anything ❌
// cancelled → anything ❌
```

---

## Next Steps

1. **Copy booking-chain-fixtures.ts** file above
2. **Copy 6b-booking-chain.test.ts** file above
3. **Create database migration** with SQL above
4. **Run:** `supabase db push`
5. **Run:** `npm run test:6b`
6. **Debug** until 6/6 tests passing
7. **Verify:** Run all 3 phases: 22/22 tests total

**Estimated time:** 3-4 hours including debugging
