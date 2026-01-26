/**
 * 🔥 FULL SCOPE PRODUCTION VERIFICATION TEST
 *
 * TRANSACTIONAL: All-or-Nothing verification against REAL organization credentials.
 * If ANY step fails → ABORT IMMEDIATELY (Exit Code 1)
 *
 * This test uses:
 * - Real organization: voxanne@demo.com
 * - Real test phone: +2348141995397
 * - Real backend at: process.env.BACKEND_URL
 * - Real date/time: 2026-02-09 @ 12:00 PM
 *
 * Validates:
 * 1. Database pre-flight checks (credentials exist)
 * 2. Calendar availability checking (Core Tool)
 * 3. Appointment booking (Core Tool)
 * 4. Caller identity lookup (Phase 1 Tool)
 * 5. Call transfer routing (Phase 1 Tool)
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test Data
const TARGET_EMAIL = 'voxanne@demo.com';
const TARGET_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e'; // Voxanne Demo Clinic
const TARGET_PHONE = '+2348141995397';
const TARGET_DATE = '2026-02-09';
const TARGET_TIME = '12:00';
const VAPI_TIMEOUT_MS = 15000;

interface PreFlightResult {
  orgId: string;
  hasGoogleCalendar: boolean;
  hasTwilio: boolean;
}

// ============================================================================
// PRE-FLIGHT CHECK: Verify credentials exist in database
// ============================================================================
async function preFlightCheck(): Promise<PreFlightResult> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  PRE-FLIGHT CHECK: Database Credential Audit               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ FATAL: Supabase credentials missing in environment');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const orgId = TARGET_ORG_ID;

  // Step 1: Verify organization exists
  console.log(`[1/4] Verifying organization exists`);
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    console.error(`❌ FATAL: Organization not found: ${orgId}`);
    process.exit(1);
  }
  console.log(`   ✓ Found organization: ${org.name}`);

  // Step 2: Verify Google Calendar credentials exist
  console.log(`[2/4] Checking Google Calendar credentials`);
  const { data: gcalCreds, error: gcalError } = await supabase
    .from('org_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'google_calendar')
    .maybeSingle();

  if (gcalError) {
    console.error(`❌ FATAL: Database error checking calendar: ${gcalError.message}`);
    process.exit(1);
  }

  const hasGoogleCalendar = !!gcalCreds;
  if (hasGoogleCalendar) {
    console.log(`   ✓ Google Calendar credentials FOUND`);
  } else {
    console.warn(`   ⚠️  Google Calendar NOT configured (optional for this test)`);
  }

  // Step 3: Verify Twilio credentials exist
  console.log(`[3/4] Checking Twilio credentials`);
  const { data: twilioCreds, error: twilioError } = await supabase
    .from('org_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'twilio')
    .maybeSingle();

  if (twilioError) {
    console.error(`❌ FATAL: Database error checking Twilio: ${twilioError.message}`);
    process.exit(1);
  }

  const hasTwilio = !!twilioCreds;
  if (!hasTwilio) {
    console.error(`❌ FATAL: Twilio credentials NOT configured`);
    process.exit(1);
  }
  console.log(`   ✓ Twilio credentials FOUND`);

  // Step 4: Summary
  console.log(`[4/4] Pre-flight validation complete\n`);
  console.log(`   Organization: ${org.name}`);
  console.log(`   Org ID: ${orgId}`);
  console.log(`   Google Calendar: ${hasGoogleCalendar ? '✓' : '✗'}`);
  console.log(`   Twilio: ${hasTwilio ? '✓' : '✗'}`);
  console.log();

  return { orgId, hasGoogleCalendar, hasTwilio };
}

// ============================================================================
// TEST 1: Check Availability
// ============================================================================
async function test1CheckAvailability(orgId: string): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: checkAvailability (Core Tool)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    message: {
      type: 'tool-calls',
      toolCalls: [{
        id: 'test-avail-001',
        type: 'function',
        function: {
          name: 'checkAvailability',
          arguments: { tenantId: orgId, date: TARGET_DATE }
        }
      }],
      call: { id: 'fullscope-001', orgId, metadata: { org_id: orgId } }
    }
  };

  console.log(`[Payload] Date: ${TARGET_DATE}`);

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/vapi/tools/calendar/check`,
      payload,
      { timeout: VAPI_TIMEOUT_MS }
    );

    if (response.status !== 200) {
      console.error(`❌ ABORT: HTTP ${response.status}`);
      process.exit(1);
    }

    const { toolResult } = response.data;
    if (!toolResult?.content) {
      console.error(`❌ ABORT: Missing toolResult.content`);
      process.exit(1);
    }

    let resultData;
    try {
      resultData = JSON.parse(toolResult.content);
    } catch (e: any) {
      console.error(`❌ ABORT: Invalid JSON - ${e.message}`);
      process.exit(1);
    }

    // NO SKIPS: Calendar must work or fail with real error
    if (!resultData.success) {
      console.error(`❌ ABORT: Calendar API failed - ${resultData.error || 'Unknown error'}`);
      process.exit(1);
    }

    if (!resultData.availableSlots || resultData.availableSlots.length === 0) {
      console.error(`❌ ABORT: No available slots found`);
      process.exit(1);
    }

    console.log(`✓ Found ${resultData.availableSlots.length} available slots`);
    console.log(`✓ TEST 1 PASSED\n`);
  } catch (error: any) {
    console.error(`❌ ABORT: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// TEST 2: Book Clinic Appointment
// ============================================================================
async function test2BookClinicAppointment(orgId: string): Promise<string> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: bookClinicAppointment (Core Tool)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    message: {
      type: 'tool-calls',
      toolCalls: [{
        id: 'test-book-001',
        type: 'function',
        function: {
          name: 'bookClinicAppointment',
          arguments: {
            patientPhone: TARGET_PHONE,
            appointmentDate: TARGET_DATE,
            appointmentTime: TARGET_TIME,
            patientName: 'Full Scope Verification',
            serviceType: 'Production Test',
            duration: 30
          }
        }
      }],
      call: {
        id: 'fullscope-002',
        orgId,
        metadata: { org_id: orgId }
      }
    },
    toolCallId: 'test-book-001'
  };

  console.log(`[Payload] Patient: ${payload.message.toolCalls[0].function.arguments.patientName}`);
  console.log(`[Payload] Phone: ${TARGET_PHONE}`);
  console.log(`[Payload] Date/Time: ${TARGET_DATE} @ ${TARGET_TIME}`);

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/vapi/tools/bookClinicAppointment`,
      payload,
      { timeout: VAPI_TIMEOUT_MS }
    );

    if (response.status !== 200) {
      console.error(`❌ ABORT: HTTP ${response.status}`);
      process.exit(1);
    }

    const { result } = response.data;
    if (!result) {
      console.error(`❌ ABORT: Missing result object`);
      process.exit(1);
    }

    if (!result.success) {
      console.error(`❌ ABORT: Booking failed - ${result.error || result.message}`);
      process.exit(1);
    }

    if (!result.appointmentId) {
      console.error(`❌ ABORT: No appointmentId returned`);
      process.exit(1);
    }

    console.log(`✓ Appointment created: ${result.appointmentId}`);
    console.log(`✓ SMS Status: ${result.smsStatus}`);
    console.log(`✓ TEST 2 PASSED\n`);

    return result.appointmentId;
  } catch (error: any) {
    console.error(`❌ ABORT: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// TEST 3: Lookup Caller
// ============================================================================
async function test3LookupCaller(orgId: string): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: lookupCaller (Phase 1 - Identity Injection)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    message: {
      type: 'tool-calls',
      toolCalls: [{
        id: 'test-lookup-001',
        type: 'function',
        function: {
          name: 'lookupCaller',
          arguments: { searchKey: TARGET_PHONE, searchType: 'phone' }
        }
      }],
      call: {
        id: 'fullscope-003',
        orgId,
        metadata: { org_id: orgId }
      }
    }
  };

  console.log(`[Payload] Search: ${TARGET_PHONE} (by phone)`);

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/vapi/tools/lookupCaller`,
      payload,
      { timeout: VAPI_TIMEOUT_MS }
    );

    if (response.status !== 200) {
      console.error(`❌ ABORT: HTTP ${response.status}`);
      process.exit(1);
    }

    const { toolResult } = response.data;
    if (!toolResult?.content) {
      console.error(`❌ ABORT: Missing toolResult.content`);
      process.exit(1);
    }

    let resultData;
    try {
      resultData = JSON.parse(toolResult.content);
    } catch (e: any) {
      console.error(`❌ ABORT: Invalid JSON - ${e.message}`);
      process.exit(1);
    }

    if (!resultData.success) {
      console.error(`❌ ABORT: Lookup failed - ${resultData.error}`);
      process.exit(1);
    }

    // Contact not found is acceptable - it will be created on call
    if (!resultData.found) {
      console.log(`✓ Contact not found (will be created on inbound call)`);
    } else {
      console.log(`✓ Found contact: ${resultData.contact?.name}`);
    }

    console.log(`✓ TEST 3 PASSED\n`);
  } catch (error: any) {
    console.error(`❌ ABORT: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// TEST 4: Transfer Call
// ============================================================================
async function test4TransferCall(orgId: string): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: transferCall (Phase 1 - Warm Transfer)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payload = {
    message: {
      type: 'tool-calls',
      toolCalls: [{
        id: 'test-transfer-001',
        type: 'function',
        function: {
          name: 'transferCall',
          arguments: {
            summary: 'Full scope production verification test',
            department: 'general'
          }
        }
      }],
      call: {
        id: 'fullscope-004',
        orgId,
        metadata: { org_id: orgId }
      }
    }
  };

  console.log(`[Payload] Department: general`);
  console.log(`[Payload] Summary: Full scope production verification test`);

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/vapi/tools/transferCall`,
      payload,
      { timeout: VAPI_TIMEOUT_MS }
    );

    if (response.status !== 200) {
      console.error(`❌ ABORT: HTTP ${response.status}`);
      process.exit(1);
    }

    const { transfer } = response.data;
    if (!transfer?.destination) {
      console.error(`❌ ABORT: Missing transfer.destination`);
      process.exit(1);
    }

    if (!transfer.destination.number && !transfer.destination.sip) {
      console.error(`❌ ABORT: Destination must have number or SIP`);
      process.exit(1);
    }

    const dest = transfer.destination.number || transfer.destination.sip;
    console.log(`✓ Transfer destination: ${dest}`);
    console.log(`✓ TEST 4 PASSED\n`);
  } catch (error: any) {
    console.error(`❌ ABORT: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// MAIN: Execute all tests
// ============================================================================
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔥 FULL SCOPE PRODUCTION VERIFICATION TEST 🔥          ║');
  console.log('║          TRANSACTIONAL: All-or-Nothing Execution           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Pre-flight checks
    const { orgId, hasGoogleCalendar } = await preFlightCheck();

    // Run tests sequentially (transactional)
    await test1CheckAvailability(orgId);
    await test2BookClinicAppointment(orgId);
    await test3LookupCaller(orgId);
    await test4TransferCall(orgId);

    // SUCCESS
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ ALL TESTS PASSED                        ║');
    console.log('║        VOXANNE AI IS PRODUCTION READY FOR LIVE CALLS         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (!hasGoogleCalendar) {
      console.log('⚠️  Note: Calendar integration is not configured (Phase 2 feature)');
      console.log('   Core functionality (booking, lookup, transfer) is working.\n');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║                  ❌ TEST SUITE ABORTED                      ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    console.error(`Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
