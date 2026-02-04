/**
 * PhD-Level Integration Test: Vapi ↔ Backend Booking Flow
 *
 * Simulates EXACTLY what happens during a live call:
 * 1. AI calls checkAvailability
 * 2. AI calls bookClinicAppointment
 * 3. Verifies database state
 * 4. Tests double-booking prevention
 *
 * Test Details:
 * - Organization: voxanne@demo.com
 * - Caller: Austyn (+2348141995397, austyn@demo.com)
 * - Date: February 5th, 2026 (2026-02-05)
 * - Time: 3 PM (15:00)
 */

import axios from 'axios';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_ORG_EMAIL = 'voxanne@demo.com';
const TEST_DATE = '2026-02-05';
const TEST_TIME = '15:00';
const TEST_PHONE = '+2348141995397';
const TEST_PHONE_2 = '+15559876543';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function logTest(step: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ step, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${step}: ${details}`);
}

async function runIntegrationTest() {
  console.log('\n🎓 PhD-Level Integration Test: Vapi ↔ Backend Booking Flow');
  console.log('='.repeat(70));
  console.log('Simulating REAL conversation between Vapi AI and Backend\n');

  let orgId: string;
  let appointmentId: string;

  try {
    // STEP 1: Fetch organization
    console.log('[1/8] Fetching organization from database...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, timezone, business_hours')
      .eq('email', TEST_ORG_EMAIL)
      .maybeSingle();

    if (orgError) {
      logTest('Organization fetch', 'FAIL', `Database error: ${orgError.message}`);
      throw new Error(orgError.message);
    }

    if (!org) {
      // Create test organization if it doesn't exist
      console.log('   Organization not found, creating test org...');
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          email: TEST_ORG_EMAIL,
          name: 'Voxanne Demo Clinic',
          timezone: 'America/Los_Angeles',
          business_hours: '9 AM - 6 PM'
        })
        .select()
        .single();

      if (createError) {
        logTest('Organization creation', 'FAIL', createError.message);
        throw new Error(createError.message);
      }

      orgId = newOrg.id;
      logTest('Organization setup', 'PASS', `Created test org: ${newOrg.name} (${newOrg.id})`);
    } else {
      orgId = org.id;
      logTest('Organization fetch', 'PASS', `Found: ${org.name} (timezone: ${org.timezone})`);
    }

    // STEP 2: Simulate AI calling checkAvailability
    console.log('\n[2/8] 🤖 AI: "Let me check the schedule for February 5th..."');
    console.log('   Backend receives: POST /api/vapi-tools/checkAvailability');

    const checkResponse = await axios.post(`${BACKEND_URL}/api/vapi-tools/checkAvailability`, {
      toolCallId: 'integration-test-check-001',
      orgId: orgId,
      args: {
        date: TEST_DATE,
        serviceType: 'consultation'
      }
    });

    if (!checkResponse.data.result?.success) {
      logTest('checkAvailability call', 'FAIL', 'Tool returned error or no success flag');
      throw new Error('checkAvailability failed');
    }

    const slots = checkResponse.data.result.availableSlots || [];
    if (!slots.includes(TEST_TIME)) {
      logTest('checkAvailability call', 'FAIL', `3 PM not available. Slots: ${slots.join(', ')}`);
      throw new Error('Target time slot not available');
    }

    logTest('checkAvailability call', 'PASS', `Available slots returned: ${slots.length} slots including 15:00`);

    // STEP 3: Clean up any existing test data
    console.log('\n[3/8] Cleaning up existing test data...');
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .in('phone', [TEST_PHONE, TEST_PHONE_2]);

    if (deleteError) {
      console.log(`   ⚠️  Warning: Cleanup failed (${deleteError.message})`);
    } else {
      console.log('   Test data cleaned');
    }

    // STEP 4: Simulate AI calling bookClinicAppointment
    console.log('\n[4/8] 🤖 AI: "Excellent! Let me book that for you..."');
    console.log('   Backend receives: POST /api/vapi-tools/bookClinicAppointment');
    console.log(`   Args: name=Austyn, phone=${TEST_PHONE}, date=${TEST_DATE}, time=${TEST_TIME}`);

    const bookResponse = await axios.post(`${BACKEND_URL}/api/vapi-tools/bookClinicAppointment`, {
      toolCallId: 'integration-test-book-001',
      orgId: orgId,
      args: {
        customerName: 'Austyn',
        customerPhone: TEST_PHONE,
        customerEmail: 'austyn@demo.com',
        appointmentDate: TEST_DATE,
        appointmentTime: TEST_TIME,
        serviceType: 'consultation'
      }
    });

    if (!bookResponse.data.result?.success) {
      logTest('bookClinicAppointment call', 'FAIL', `Booking failed: ${JSON.stringify(bookResponse.data.result)}`);
      throw new Error('Booking failed');
    }

    appointmentId = bookResponse.data.result.appointmentId;
    if (!appointmentId) {
      logTest('bookClinicAppointment call', 'FAIL', 'No appointment ID returned');
      throw new Error('No appointment ID');
    }

    logTest('bookClinicAppointment call', 'PASS', `Booking succeeded: ${appointmentId}`);

    // STEP 5: Verify contact was created in database
    console.log('\n[5/8] Verifying contact creation in database...');
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email, created_at')
      .eq('phone', TEST_PHONE)
      .maybeSingle();

    if (contactError || !contact) {
      logTest('Contact creation', 'FAIL', 'Contact not found in database');
      throw new Error('Contact not created');
    }

    logTest('Contact creation', 'PASS', `Contact created: ${contact.first_name} (${contact.phone})`);

    // STEP 6: Verify appointment was created in database
    console.log('\n[6/8] Verifying appointment in database...');
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status, contact_id')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appointmentError || !appointment) {
      logTest('Appointment creation', 'FAIL', 'Appointment not found in database');
      throw new Error('Appointment not created');
    }

    if (appointment.status !== 'confirmed') {
      logTest('Appointment status', 'FAIL', `Status is '${appointment.status}', expected 'confirmed'`);
      throw new Error('Appointment not confirmed');
    }

    const expectedTimestamp = `${TEST_DATE}T${TEST_TIME}:00`;
    if (!appointment.scheduled_at.includes(TEST_DATE) || !appointment.scheduled_at.includes('15:00')) {
      logTest('Appointment timestamp', 'FAIL', `Wrong time: ${appointment.scheduled_at}`);
      throw new Error('Wrong appointment time');
    }

    logTest('Appointment creation', 'PASS', `Appointment confirmed at ${appointment.scheduled_at}`);

    // STEP 7: Test double-booking prevention (CRITICAL)
    console.log('\n[7/8] 🚨 CRITICAL TEST: Double-booking prevention...');
    console.log('   Attempting to book THE SAME slot with different customer...');

    const doubleBookResponse = await axios.post(`${BACKEND_URL}/api/vapi-tools/bookClinicAppointment`, {
      toolCallId: 'integration-test-double-001',
      orgId: orgId,
      args: {
        customerName: 'Test Patient 2',
        customerPhone: TEST_PHONE_2,
        customerEmail: 'test2@example.com',
        appointmentDate: TEST_DATE,
        appointmentTime: TEST_TIME,
        serviceType: 'consultation'
      }
    });

    if (doubleBookResponse.data.result.success) {
      logTest('Double-booking prevention', 'FAIL', 'Advisory lock FAILED - slot was double-booked!');
      throw new Error('CRITICAL: Advisory locks not working - double-booking occurred');
    }

    if (doubleBookResponse.data.result.error !== 'SLOT_UNAVAILABLE') {
      logTest('Double-booking prevention', 'FAIL', `Wrong error: ${doubleBookResponse.data.result.error}`);
      throw new Error('Expected SLOT_UNAVAILABLE error');
    }

    const expectedMessage = 'That time was just booked by another caller';
    if (!doubleBookResponse.data.result.message?.includes('just booked')) {
      logTest('Error message', 'FAIL', `Wrong message: ${doubleBookResponse.data.result.message}`);
      throw new Error('Expected user-friendly error message');
    }

    logTest('Double-booking prevention', 'PASS', 'Advisory lock working - second booking rejected with SLOT_UNAVAILABLE');

    // STEP 8: Verify database integrity (no double-bookings)
    console.log('\n[8/8] Verifying database integrity...');
    const { data: duplicates, error: dupError } = await supabase
      .from('appointments')
      .select('id, contact_id')
      .eq('scheduled_at', `${TEST_DATE}T${TEST_TIME}:00`)
      .in('status', ['confirmed', 'pending']);

    if (dupError) {
      logTest('Database integrity', 'FAIL', `Query error: ${dupError.message}`);
      throw new Error(dupError.message);
    }

    if (!duplicates || duplicates.length !== 1) {
      logTest('Database integrity', 'FAIL', `Found ${duplicates?.length || 0} appointments, expected 1`);
      throw new Error('Database integrity violated - multiple bookings for same slot');
    }

    logTest('Database integrity', 'PASS', 'Only 1 appointment exists for the slot (no double-bookings)');

    // SUCCESS
    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL 8 TESTS PASSED - INTEGRATION VERIFIED!');
    console.log('='.repeat(70));
    console.log('\nSummary:');
    console.log('  ✅ AI tool invocation flow works correctly');
    console.log('  ✅ Contact find-or-create pattern working');
    console.log('  ✅ Appointment booking with advisory locks working');
    console.log('  ✅ Double-booking prevention verified');
    console.log('  ✅ Database integrity maintained');
    console.log('\n🚀 Production flow validated - Ready for real calls!');

    // Cleanup
    console.log('\n[Cleanup] Deleting test data...');
    await supabase.from('appointments').delete().eq('id', appointmentId);
    await supabase.from('contacts').delete().in('phone', [TEST_PHONE, TEST_PHONE_2]);
    console.log('   Test data cleaned up\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ INTEGRATION TEST FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${error.message}\n`);

    // Print results summary
    console.log('Test Results:');
    results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${icon} ${result.step}: ${result.details}`);
    });

    // Cleanup on failure
    try {
      console.log('\n[Cleanup] Attempting to delete test data...');
      await supabase.from('contacts').delete().in('phone', [TEST_PHONE, TEST_PHONE_2]);
      console.log('   Cleanup completed\n');
    } catch (cleanupError) {
      console.log('   ⚠️  Cleanup failed (manual cleanup may be required)\n');
    }

    process.exit(1);
  }
}

// Run the integration test
console.log('\n🎓 Starting PhD-Level Integration Test...');
console.log('This simulates a REAL Vapi ↔ Backend conversation flow\n');
runIntegrationTest();
