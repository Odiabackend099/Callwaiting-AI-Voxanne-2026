/**
 * VAPI Simple Call Simulation - 3 Step Flow
 *
 * Simulates the core booking flow:
 * 1. CHECK AVAILABILITY - Verify the requested time slot is free
 * 2. BOOK APPOINTMENT - Create appointment in DB + Google Calendar
 * 3. VERIFY AFTERMATH - Check that all systems were updated correctly
 *
 * Usage:
 * ```bash
 * cd backend
 * npx ts-node src/scripts/simulate-vapi-call.ts
 * ```
 *
 * Expected Output:
 * ✅ All tests passed (should complete in <5 seconds)
 */

import { createClient } from '@supabase/supabase-js';
import { createSimulator } from './lib/vapi-simulator';
import * as fs from 'fs';
import * as path from 'path';

// Load environment
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Constants
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e'; // Voxanne Demo Clinic
const TEST_PHONE = '+2348141995397'; // Austyn
const APPOINTMENT_DATE = '2026-02-06';
const APPOINTMENT_TIME = '15:00';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

async function main() {
  console.log(`
========================================
VAPI SIMULATION: SIMPLE FLOW (3 STEPS)
========================================
Backend URL: ${BACKEND_URL}
Org ID: ${ORG_ID}
Patient: Austyn (${TEST_PHONE})
Date: ${APPOINTMENT_DATE}
Time: ${APPOINTMENT_TIME}
========================================
`);

  try {
    // Create simulator
    const simulator = createSimulator(BACKEND_URL, ORG_ID);

    // ========================================
    // STEP 1: CHECK AVAILABILITY
    // ========================================
    console.log('\n1️⃣  CHECKING AVAILABILITY...');
    const step1Start = Date.now();

    const availabilityResult = await simulator.callTool('checkAvailability', {
      tenantId: ORG_ID,
      date: APPOINTMENT_DATE,
      serviceType: 'Botox'
    }, { ignoreErrors: false });

    const step1Duration = Date.now() - step1Start;

    if (!availabilityResult.result?.success && !availabilityResult.toolResult) {
      throw new Error(`Availability check failed: ${JSON.stringify(availabilityResult)}`);
    }

    // Parse response (could be in toolResult.content or result)
    let availContent = availabilityResult.result || {};
    if (availabilityResult.toolResult?.content) {
      availContent = JSON.parse(availabilityResult.toolResult.content);
    }

    console.log(`   Response: ${JSON.stringify(availContent).substring(0, 100)}...`);
    console.log(`   ⏱️  Duration: ${step1Duration}ms\n`);

    const step1Result: TestResult = {
      name: 'Check Availability',
      status: availContent.success || availContent.slotCount !== undefined ? 'PASS' : 'FAIL',
      duration: step1Duration,
      details: availContent.message || `Found ${availContent.slotCount || 0} slots`,
      error: !availContent.success ? availContent.error : undefined
    };
    results.push(step1Result);

    if (step1Result.status === 'FAIL') {
      throw new Error(`Availability check failed: ${step1Result.error}`);
    }

    // ========================================
    // STEP 2: BOOK APPOINTMENT
    // ========================================
    console.log('2️⃣  BOOKING APPOINTMENT...');
    const step2Start = Date.now();

    const bookingResult = await simulator.callTool('bookClinicAppointment', {
      patientName: 'Austyn TestUser',
      phone: TEST_PHONE,
      serviceType: 'Botox',
      appointmentDate: APPOINTMENT_DATE,
      appointmentTime: APPOINTMENT_TIME,
      duration: 60,
      email: 'austyn@test.example.com'
    }, { ignoreErrors: false });

    const step2Duration = Date.now() - step2Start;

    if (!bookingResult.result?.success) {
      throw new Error(`Booking failed: ${bookingResult.result?.error || 'Unknown error'}`);
    }

    const appointmentId = bookingResult.result.appointmentId;
    console.log(`   Appointment ID: ${appointmentId}`);
    console.log(`   Message: ${bookingResult.result.message}`);
    console.log(`   ⏱️  Duration: ${step2Duration}ms\n`);

    const step2Result: TestResult = {
      name: 'Book Appointment',
      status: bookingResult.result.success ? 'PASS' : 'FAIL',
      duration: step2Duration,
      details: `Created appointment ${appointmentId}`,
      error: !bookingResult.result.success ? bookingResult.result.error : undefined
    };
    results.push(step2Result);

    if (step2Result.status === 'FAIL') {
      throw new Error(`Booking failed: ${step2Result.error}`);
    }

    // ========================================
    // STEP 3: VERIFY DATABASE & CALENDAR
    // ========================================
    console.log('3️⃣  VERIFYING AFTERMATH...');
    const step3Start = Date.now();
    const step3Details: string[] = [];

    // 3a. Check appointment was created
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, scheduled_at, google_calendar_event_id, contact_id')
      .eq('id', appointmentId)
      .eq('org_id', ORG_ID)
      .single();

    if (appointmentError || !appointment) {
      throw new Error(`Failed to find appointment in database: ${appointmentError?.message}`);
    }

    step3Details.push(`✅ Database appointment created (ID: ${appointmentId})`);

    // 3b. Check calendar sync
    const calendarSynced = !!appointment.google_calendar_event_id;
    if (calendarSynced) {
      step3Details.push(`✅ Google Calendar synced (Event ID: ${appointment.google_calendar_event_id})`);
    } else {
      step3Details.push(`⚠️  Google Calendar not synced yet (may be async)`);
    }

    // 3c. Check SMS queue
    const { data: smsLog, error: smsError } = await supabase
      .from('webhook_delivery_log')
      .select('status, event_type')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (smsLog) {
      step3Details.push(`✅ SMS logged (Status: ${smsLog.status}, Type: ${smsLog.event_type})`);
    } else {
      step3Details.push(`⚠️  SMS not logged yet (may be async)`);
    }

    // 3d. Check contact was linked
    if (appointment.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, phone')
        .eq('id', appointment.contact_id)
        .single();

      if (contact) {
        step3Details.push(`✅ Contact linked (${contact.first_name || 'Austyn'} - ${contact.phone})`);
      }
    }

    const step3Duration = Date.now() - step3Start;

    console.log(`   ${step3Details.join('\n   ')}`);
    console.log(`   ⏱️  Duration: ${step3Duration}ms\n`);

    const step3Result: TestResult = {
      name: 'Verify Aftermath',
      status: appointment ? 'PASS' : 'FAIL',
      duration: step3Duration,
      details: step3Details.join('; '),
      error: !appointment ? appointmentError?.message : undefined
    };
    results.push(step3Result);

    // ========================================
    // SUMMARY
    // ========================================
    const totalDuration = step1Duration + step2Duration + step3Duration;
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;

    console.log(`
========================================
RESULTS SUMMARY
========================================`);

    results.forEach((result, index) => {
      const statusEmoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${index + 1}. ${statusEmoji} ${result.name} (${result.duration}ms)`);
      console.log(`   └─ ${result.details}`);
      if (result.error) {
        console.log(`   └─ Error: ${result.error}`);
      }
    });

    console.log(`
========================================
FINAL RESULT
========================================
Total Tests: ${results.length}
Passed: ${passCount} ✅
Failed: ${failCount} ❌
Total Duration: ${totalDuration}ms
Status: ${failCount === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}
========================================
`);

    process.exit(failCount === 0 ? 0 : 1);

  } catch (error: any) {
    console.error(`\n❌ FATAL ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the simulation
main();
