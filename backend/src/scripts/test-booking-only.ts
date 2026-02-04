/**
 * Direct Booking Endpoint Test
 *
 * Bypasses availability check to test the booking endpoint directly.
 * This helps isolate whether the issue is specific to availability or broader.
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const TEST_PHONE = '+2348141995397';
const APPOINTMENT_DATE = '2026-02-06';
const APPOINTMENT_TIME = '15:00';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testBookingEndpoint() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           DIRECT BOOKING ENDPOINT TEST                         ║
╚════════════════════════════════════════════════════════════════╝
Backend URL: ${BACKEND_URL}
Org ID: ${ORG_ID}
Test Phone: ${TEST_PHONE}
Target Date/Time: ${APPOINTMENT_DATE} @ ${APPOINTMENT_TIME}
Starting...
`);

  try {
    // Test 1: Direct booking call (bypassing availability check)
    console.log('\n1. TESTING BOOKING ENDPOINT\n');

    const bookingPayload = {
      message: {
        toolCalls: [{
          function: {
            name: 'bookClinicAppointment',
            arguments: JSON.stringify({
              patientName: 'Austyn DirectTest',
              phone: TEST_PHONE,
              serviceType: 'Botox',
              appointmentDate: APPOINTMENT_DATE,
              appointmentTime: APPOINTMENT_TIME,
              duration: 60,
              email: 'austyn.test@example.com'
            })
          }
        }],
        call: {
          id: `test-booking-${Date.now()}`,
          metadata: { org_id: ORG_ID },
          customer: { number: TEST_PHONE }
        }
      }
    };

    console.log('Sending booking request...');
    const bookingStart = Date.now();

    const bookingResponse = await axios.post(
      `${BACKEND_URL}/api/vapi/tools/bookClinicAppointment`,
      bookingPayload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const bookingDuration = Date.now() - bookingStart;

    console.log(`✅ Booking endpoint responded (${bookingDuration}ms)`);
    console.log('\nResponse:', JSON.stringify(bookingResponse.data, null, 2));

    // Check if booking was successful
    if (bookingResponse.data?.result?.success) {
      const appointmentId = bookingResponse.data.result.appointmentId;
      console.log(`\n✅ BOOKING SUCCESSFUL`);
      console.log(`   Appointment ID: ${appointmentId}`);

      // Test 2: Verify in database
      console.log('\n2. VERIFYING IN DATABASE\n');

      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .select('id, scheduled_at, status, contact_id')
        .eq('id', appointmentId)
        .eq('org_id', ORG_ID)
        .single();

      if (appointment) {
        console.log(`✅ Appointment found in database`);
        console.log(`   Status: ${appointment.status}`);
        console.log(`   Scheduled: ${appointment.scheduled_at}`);
        console.log(`   Contact ID: ${appointment.contact_id}`);
      } else {
        console.log(`❌ Appointment NOT found in database`);
        if (aptError) {
          console.log(`   Error: ${aptError.message}`);
        }
      }

      // Test 3: Check contact
      console.log('\n3. VERIFYING CONTACT LINKAGE\n');

      if (appointment?.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, phone')
          .eq('id', appointment.contact_id)
          .single();

        if (contact) {
          console.log(`✅ Contact linked to appointment`);
          console.log(`   Name: ${contact.first_name} ${contact.last_name || ''}`);
          console.log(`   Phone: ${contact.phone}`);
        }
      }

      console.log(`\n════════════════════════════════════════════════════════════════`);
      console.log(`✅ DIRECT BOOKING TEST PASSED`);
      console.log(`════════════════════════════════════════════════════════════════`);
      process.exit(0);
    } else {
      // Booking failed - analyze response
      console.log(`\n❌ BOOKING FAILED`);
      console.log(`   Error: ${bookingResponse.data?.result?.error || 'Unknown error'}`);

      // This tells us the endpoint is working but rejecting the request
      // Could be due to: slot already booked, time in past, service not found, etc.
      console.log(`\n════════════════════════════════════════════════════════════════`);
      console.log(`⚠️  BOOKING ENDPOINT RESPONDS BUT REJECTS REQUEST`);
      console.log(`════════════════════════════════════════════════════════════════`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`\n❌ ERROR`);

    if (error.code === 'ECONNREFUSED') {
      console.error(`   Backend not running at ${BACKEND_URL}`);
      console.error(`   Start backend: cd backend && npm run dev`);
    } else if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }

    console.log(`\n════════════════════════════════════════════════════════════════`);
    console.log(`❌ DIRECT BOOKING TEST FAILED`);
    console.log(`════════════════════════════════════════════════════════════════`);
    process.exit(1);
  }
}

testBookingEndpoint();
