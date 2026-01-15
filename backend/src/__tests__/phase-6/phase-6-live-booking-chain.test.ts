/**
 * PHASE 6: SCENARIO 2 - LIVE BOOKING CHAIN TEST
 * 
 * Tests: Vapi → API → DB → Calendar integration
 * 
 * What's being tested:
 * 1. Vapi tool call reaches /api/vapi/tools
 * 2. Backend validates clinic authorization (JWT org_id matches)
 * 3. Backend performs atomic slot locking (SELECT ... FOR UPDATE)
 * 4. Booking is written to appointments table
 * 5. PostgreSQL trigger creates calendar_events record
 * 6. Google Calendar sync job runs (mock or real)
 * 7. Response time < 500ms
 * 8. Clinic A cannot book slots for Clinic B (RLS blocks)
 * 
 * Success Criteria:
 * ✅ Appointment stored with correct org_id
 * ✅ Conflict detection prevents double-booking
 * ✅ Google Calendar event created
 * ✅ Response time < 500ms
 * ✅ Cross-clinic booking rejected with 403
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  seedClinic,
  seedUser,
  seedProvider,
  createMockJWT,
  cleanupClinic,
  createSetupClient,
  createUserClient,
} from '../setup/phase-6-setup';
import {
  mockVapiBookingCall,
  PerformanceTimer,
  validateAppointmentStructure,
  hasConflict,
  assertClinicIsolation,
  assertJWTOrgMatch,
  validateGoogleCalendarSync,
  MockErrors,
} from '../fixtures/phase-6-fixtures';

// Test configuration
const API_URL = process.env.VAPI_API_URL || 'http://localhost:3000';
const VAPI_ENDPOINT = `${API_URL}/api/vapi/tools`;

// Test data
interface TestContext {
  clinic_a: Awaited<ReturnType<typeof seedClinic>>;
  clinic_b: Awaited<ReturnType<typeof seedClinic>>;
  user_a: Awaited<ReturnType<typeof seedUser>>;
  provider_a: Awaited<ReturnType<typeof seedProvider>>;
  jwt_a: string;
}

let context: TestContext;

describe('Phase 6: Live Booking Chain (Vapi → API → DB → Calendar)', () => {
  beforeAll(async () => {
    /**
     * Setup: Create 2 clinics, users, providers, and JWTs
     * This simulates a real multi-tenant environment
     */
    context = {
      clinic_a: await seedClinic('Test Clinic A'),
      clinic_b: await seedClinic('Test Clinic B'),
    } as TestContext;

    context.user_a = await seedUser(context.clinic_a, 'admin');
    context.provider_a = await seedProvider(context.clinic_a, 'Dr. Smith');

    // Create JWT for user_a (contains org_id from clinic_a)
    context.jwt_a = createMockJWT(context.user_a.id, context.clinic_a.org_id);

    console.log('✅ Phase 6 test setup complete');
    console.log(`  Clinic A: ${context.clinic_a.org_id}`);
    console.log(`  Clinic B: ${context.clinic_b.org_id}`);
    console.log(`  Provider A: ${context.provider_a.id}`);
  });

  afterAll(async () => {
    /**
     * Cleanup: Delete both clinics and cascade all data
     */
    await cleanupClinic(context.clinic_a.org_id);
    await cleanupClinic(context.clinic_b.org_id);
    console.log('✅ Phase 6 test cleanup complete');
  });

  describe('Test 1: Successful Booking Creation (<500ms)', () => {
    it('should book appointment and sync to Google Calendar within 500ms', async () => {
      const timer = new PerformanceTimer();
      timer.start();

      /**
       * Step 1: Create Vapi tool call
       */
      const vapiCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          patient_name: 'John Doe',
          patient_email: 'john.doe@example.com',
          appointment_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          duration_minutes: 30,
        },
      });

      /**
       * Step 2: Send to /api/vapi/tools
       */
      const response = await axios.post(VAPI_ENDPOINT, vapiCall, {
        headers: {
          'Authorization': `Bearer ${context.jwt_a}`,
          'Content-Type': 'application/json',
        },
      });

      timer.stop();

      /**
       * Step 3: Validate response
       */
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('appointment_id');
      expect(response.data).toHaveProperty('google_calendar_event_id');

      /**
       * Step 4: Validate appointment structure
       */
      const appointment = response.data.appointment;
      validateAppointmentStructure(appointment);

      // Verify clinic isolation
      expect(appointment.org_id).toBe(context.clinic_a.org_id);
      expect(appointment.clinic_id).toBe(context.clinic_a.id);
      expect(appointment.provider_id).toBe(context.provider_a.id);

      /**
       * Step 5: Verify Google Calendar sync
       */
      validateGoogleCalendarSync(
        response.data.calendar_sync,
        appointment.id
      );

      /**
       * Step 6: Assert performance
       */
      timer.assertUnder(500, 'Vapi booking chain');

      console.log(`✅ Test 1 passed: Booking completed in ${timer.report()}`);
    });
  });

  describe('Test 2: Conflict Detection (Prevent Double-Booking)', () => {
    it('should reject conflicting appointment at same time slot', async () => {
      /**
       * Setup: Create and book first appointment
       */
      const appointmentTime = new Date(Date.now() + 172800000); // Day after tomorrow
      appointmentTime.setHours(14, 0, 0, 0); // 2 PM

      const firstCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: appointmentTime.toISOString(),
          duration_minutes: 30,
        },
      });

      // Book first appointment
      const firstResponse = await axios.post(VAPI_ENDPOINT, firstCall, {
        headers: { 'Authorization': `Bearer ${context.jwt_a}` },
      });

      expect(firstResponse.status).toBe(200);
      const firstApt = firstResponse.data.appointment;

      /**
       * Step 2: Try to book overlapping appointment (9:15 AM overlaps with 9:00-9:30)
       */
      const conflictingTime = new Date(appointmentTime);
      conflictingTime.setMinutes(15); // 2:15 PM (overlaps with 2:00-2:30)

      const conflictCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: conflictingTime.toISOString(),
          duration_minutes: 30,
        },
      });

      /**
       * Step 3: Expect conflict error
       */
      try {
        await axios.post(VAPI_ENDPOINT, conflictCall, {
          headers: { 'Authorization': `Bearer ${context.jwt_a}` },
        });
        throw new Error('Should have thrown conflict error');
      } catch (error: any) {
        expect(error.response?.status).toBe(409);
        expect(error.response?.data?.code).toBe(MockErrors.CONFLICT.code);
      }

      /**
       * Step 4: Verify first appointment is unchanged
       */
      const db = createSetupClient();
      const { data: checkApt } = await db
        .from('appointments')
        .select('*')
        .eq('id', firstApt.id)
        .single();

      expect(checkApt).toBeDefined();
      expect(checkApt?.status).toBe('booked');

      console.log('✅ Test 2 passed: Conflict detection working');
    });
  });

  describe('Test 3: Adjacent Appointments Allowed', () => {
    it('should allow back-to-back appointments (no overlap)', async () => {
      const appointmentTime = new Date(Date.now() + 259200000); // 3 days from now
      appointmentTime.setHours(10, 0, 0, 0);

      /**
       * Book first appointment: 10:00-10:30
       */
      const firstCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: appointmentTime.toISOString(),
          duration_minutes: 30,
        },
      });

      const firstResponse = await axios.post(VAPI_ENDPOINT, firstCall, {
        headers: { 'Authorization': `Bearer ${context.jwt_a}` },
      });

      expect(firstResponse.status).toBe(200);

      /**
       * Book adjacent appointment: 10:30-11:00 (should succeed)
       */
      const adjacentTime = new Date(appointmentTime);
      adjacentTime.setMinutes(30);

      const adjacentCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: adjacentTime.toISOString(),
          duration_minutes: 30,
        },
      });

      const secondResponse = await axios.post(VAPI_ENDPOINT, adjacentCall, {
        headers: { 'Authorization': `Bearer ${context.jwt_a}` },
      });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.data.appointment.scheduled_at).toBe(adjacentTime.toISOString());

      console.log('✅ Test 3 passed: Adjacent appointments allowed');
    });
  });

  describe('Test 4: Clinic Isolation - Cross-Clinic Booking Rejected', () => {
    it('should reject booking attempt for Clinic B when authenticated as Clinic A', async () => {
      /**
       * User A from Clinic A tries to book for Clinic B
       * JWT contains org_id from Clinic A, but request targets Clinic B
       * Should get 403 Forbidden from RLS
       */
      const clinicB_Provider = await seedProvider(context.clinic_b, 'Dr. Johnson');

      const vapiCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_b.id, // ⚠️ Different clinic
          provider_id: clinicB_Provider.id, // ⚠️ Different provider
          appointment_time: new Date(Date.now() + 345600000).toISOString(),
          duration_minutes: 30,
        },
      });

      /**
       * This should be rejected at API level (org_id mismatch)
       * or at database level (RLS policy blocks insert)
       */
      try {
        await axios.post(VAPI_ENDPOINT, vapiCall, {
          headers: { 'Authorization': `Bearer ${context.jwt_a}` }, // Clinic A's token
        });
        throw new Error('Should have been rejected');
      } catch (error: any) {
        // Expect either 403 (authorization) or 401 (invalid token)
        expect([401, 403]).toContain(error.response?.status);
      }

      console.log('✅ Test 4 passed: Cross-clinic booking blocked');
    });
  });

  describe('Test 5: Atomic Slot Locking (Race Condition Prevention)', () => {
    it('should prevent race condition when two requests try same slot simultaneously', async () => {
      /**
       * This test simulates two concurrent Vapi calls for the same time slot
       * Both should attempt to lock simultaneously
       * Only one should succeed
       */
      const appointmentTime = new Date(Date.now() + 432000000); // 5 days from now
      appointmentTime.setHours(15, 0, 0, 0);

      const call1 = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: appointmentTime.toISOString(),
          duration_minutes: 30,
        },
      });

      const call2 = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: appointmentTime.toISOString(),
          duration_minutes: 30,
        },
      });

      /**
       * Fire both requests concurrently
       */
      const [response1, response2] = await Promise.allSettled([
        axios.post(VAPI_ENDPOINT, call1, {
          headers: { 'Authorization': `Bearer ${context.jwt_a}` },
        }),
        axios.post(VAPI_ENDPOINT, call2, {
          headers: { 'Authorization': `Bearer ${context.jwt_a}` },
        }),
      ]);

      /**
       * Verify: One succeeds, one fails with 409 Conflict
       */
      const successes = [response1, response2].filter((r) => r.status === 'fulfilled');
      const failures = [response1, response2].filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      if (failures[0].status === 'rejected') {
        expect(failures[0].reason.response?.status).toBe(409);
      }

      console.log('✅ Test 5 passed: Atomic locking prevents race conditions');
    });
  });

  describe('Test 6: Invalid Provider ID Rejected', () => {
    it('should return 404 when provider does not exist', async () => {
      const fakeProviderId = uuidv4();

      const vapiCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: fakeProviderId,
          appointment_time: new Date(Date.now() + 518400000).toISOString(),
          duration_minutes: 30,
        },
      });

      try {
        await axios.post(VAPI_ENDPOINT, vapiCall, {
          headers: { 'Authorization': `Bearer ${context.jwt_a}` },
        });
        throw new Error('Should have failed with 404');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        expect(error.response?.data?.code).toBe('NOT_FOUND');
      }

      console.log('✅ Test 6 passed: Invalid provider rejected');
    });
  });

  describe('Test 7: Missing Authorization Header', () => {
    it('should reject request without JWT token', async () => {
      const vapiCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          appointment_time: new Date(Date.now() + 604800000).toISOString(),
          duration_minutes: 30,
        },
      });

      try {
        await axios.post(VAPI_ENDPOINT, vapiCall);
        throw new Error('Should have failed with 401');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }

      console.log('✅ Test 7 passed: Missing auth token rejected');
    });
  });

  describe('Test 8: Appointment Stored with Correct Metadata', () => {
    it('should store appointment with all required fields and metadata', async () => {
      const appointmentTime = new Date(Date.now() + 691200000); // 8 days from now
      appointmentTime.setHours(11, 0, 0, 0);

      const vapiCall = mockVapiBookingCall({
        params: {
          clinic_id: context.clinic_a.id,
          provider_id: context.provider_a.id,
          patient_name: 'Alice Johnson',
          patient_email: 'alice@example.com',
          appointment_time: appointmentTime.toISOString(),
          duration_minutes: 45,
        },
      });

      const response = await axios.post(VAPI_ENDPOINT, vapiCall, {
        headers: { 'Authorization': `Bearer ${context.jwt_a}` },
      });

      expect(response.status).toBe(200);
      const apt = response.data.appointment;

      /**
       * Verify all required fields are present and correct
       */
      expect(apt.id).toBeDefined();
      expect(apt.org_id).toBe(context.clinic_a.org_id);
      expect(apt.clinic_id).toBe(context.clinic_a.id);
      expect(apt.provider_id).toBe(context.provider_a.id);
      expect(apt.patient_name).toBe('Alice Johnson');
      expect(apt.patient_email).toBe('alice@example.com');
      expect(apt.scheduled_at).toBe(appointmentTime.toISOString());
      expect(apt.duration_minutes).toBe(45);
      expect(apt.status).toBe('booked');
      expect(apt.created_at).toBeDefined();

      /**
       * Verify in database
       */
      const db = createSetupClient();
      const { data: dbApt } = await db
        .from('appointments')
        .select('*')
        .eq('id', apt.id)
        .single();

      expect(dbApt).toBeDefined();
      expect(dbApt?.patient_name).toBe('Alice Johnson');
      expect(dbApt?.patient_email).toBe('alice@example.com');

      console.log('✅ Test 8 passed: Appointment stored with correct metadata');
    });
  });
});
