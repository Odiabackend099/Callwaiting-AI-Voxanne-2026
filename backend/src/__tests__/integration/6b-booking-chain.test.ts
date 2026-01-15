jest.setTimeout(30000); // 30 second timeout for integration tests

import crypto from 'crypto';
import {
  db,
  seedClinic,
  seedUser,
} from './fixtures/clinic-auth-fixtures';
import {
  initializeFixtures,
  createBooking,
  updateBookingStatus,
  getClinicBookings,
  getAvailableSlots,
  confirmBooking,
  verifyClinicIsolation,
} from './fixtures/booking-chain-fixtures';

// Initialize fixtures with db before any tests
let fixturesInitialized = false;

describe('Phase 6B: Booking Chain Flow', () => {
  let testId: string;

  beforeAll(async () => {
    if (!fixturesInitialized) {
      await initializeFixtures(db);
      fixturesInitialized = true;
    }
  });

  beforeEach(() => {
    testId = crypto.randomUUID().substr(0, 8);
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
      startTime: new Date(baseTime.getTime() + 60 * 60 * 1000),
    });

    await createBooking({
      clinicId: clinicA.id,
      providerId: staffA.id,
      patientEmail: `patient-a3-${testId}@example.com`,
      startTime: new Date(baseTime.getTime() + 120 * 60 * 1000),
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
      startTime,
      endTime,
    }).catch(err => err);

    expect(overlappingError.message).toContain('conflict');

    // Verify first booking still exists and intact
    const bookings = await getClinicBookings(clinic.id);
    expect(bookings.length).toBe(1);
    expect(bookings[0].id).toBe(booking1.id);

    // Test adjacent bookings ARE allowed
    const adjacent = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-3-${testId}@example.com`,
      startTime: endTime,
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

    // Valid: pending → confirmed
    const confirmed = await updateBookingStatus(booking.id, 'confirmed');
    expect(confirmed.status).toBe('confirmed');

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

    // Staff creates booking in "pending" state
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
    expect(confirmed.confirmation_token).toBeNull();

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

    // Initially should have full day available
    const emptySlots = await getAvailableSlots(clinic.id, staff.id, testDate);
    expect(emptySlots.length).toBeGreaterThan(0);

    // Book 9:00-9:30
    const booking1 = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `patient-1-${testId}@example.com`,
      startTime: new Date('2026-01-20T09:00:00Z'),
      endTime: new Date('2026-01-20T09:30:00Z'),
    });

    // Update to confirmed so it affects availability
    await updateBookingStatus(booking1.id, 'confirmed');

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
    expect(hasNineAM).toBe(false);

    const hasTenThirty = filledSlots.some(
      s => s.start.getHours() === 10 && s.start.getMinutes() === 30
    );
    expect(hasTenThirty).toBe(true);
  });
});
