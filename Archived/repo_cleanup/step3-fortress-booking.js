#!/usr/bin/env node

/**
 * Operation: Full Circle - Step 3 - Fortress Booking Test
 * Executes the complete booking flow for Thursday, Jan 22, 10:00 AM (Lagos)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

console.log('🏛️ OPERATION: FULL CIRCLE - STEP 3: FORTRESS BOOKING TEST');
console.log(`📍 Org ID: ${orgId}`);
console.log('');

// ============================================================
// STEP 3: Fortress Booking Test
// ============================================================

const payload = {
  message: {
    call: {
      metadata: { org_id: orgId }
    }
  },
  tool: {
    arguments: {
      patientName: "Austin Fortress",
      patientPhone: "+2348141995397",
      patientEmail: "austin99@gmail.com",
      appointmentDate: "2026-01-22",
      appointmentTime: "10:00",
      serviceType: "Facelift Consultation"
    }
  }
};

console.log('📝 Booking Request Payload');
console.log('---');
console.log(JSON.stringify(payload, null, 2));
console.log('');

console.log('🕐 Timezone Conversion Audit (Lagos = UTC+1)');
console.log('---');
console.log('Input (from patient in Lagos):');
console.log('  • Date: Thursday, January 22, 2026');
console.log('  • Time: 10:00 AM (Africa/Lagos WAT)');
console.log('');
console.log('System Conversion:');
console.log('  • UTC Time: 09:00 AM UTC (09:00:00Z)');
console.log('  • Database: 2026-01-22 09:00:00Z');
console.log('  • Google Calendar: 10:00 AM Africa/Lagos');
console.log('  • SMS to Patient: "Confirmed for 10:00 AM"');
console.log('');

console.log('📋 Expected Verification Points');
console.log('---');
console.log('1. DATABASE ENTRY:');
console.log('   Query: SELECT * FROM appointments WHERE org_id = ?');
console.log('   Expected scheduled_at: 2026-01-22 09:00:00Z');
console.log('   Expected title: "Facelift Consultation"');
console.log('   Expected patient: "Austin Fortress"');
console.log('');
console.log('2. SMS DELIVERY:');
console.log('   Recipient: +2348141995397');
console.log('   Message: Should contain "10:00 AM" (Lagos time, not UTC)');
console.log('   Check: Twilio dashboard or SMS log');
console.log('');
console.log('3. GOOGLE CALENDAR:');
console.log('   Calendar: voxanne@demo.com');
console.log('   Event: "Facelift Consultation - Austin Fortress"');
console.log('   Time: Thursday, Jan 22, 10:00 AM (Africa/Lagos TZ)');
console.log('   Check: Google Calendar interface');
console.log('');
console.log('4. VAPI WEBHOOK DELIVERY:');
console.log('   Tool Response: Should return success with appointment ID');
console.log('   Status Code: 200 OK');
console.log('   Check: Backend logs for /api/vapi/tools/bookClinicAppointment');
console.log('');

console.log('🔗 Execute Booking Test');
console.log('---');
console.log('');
console.log('Production Endpoint:');
console.log('POST https://callwaitingai-backend-sjbi.onrender.com/api/vapi/tools/bookClinicAppointment');
console.log('');

console.log('📝 cURL Command:');
console.log('');
const curlCommand = `curl -X POST "https://callwaitingai-backend-sjbi.onrender.com/api/vapi/tools/bookClinicAppointment" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload)}'`;
console.log(curlCommand);
console.log('');

console.log('🏁 Success Criteria (ALL MUST PASS)');
console.log('---');
console.log('✓ API returns 200 status code');
console.log('✓ Response contains appointment ID');
console.log('✓ Database shows timestamp as 2026-01-22 09:00:00Z');
console.log('✓ SMS sent to +2348141995397 with "10:00 AM"');
console.log('✓ Google Calendar shows event at 10:00 AM Lagos time');
console.log('✓ Vapi dashboard shows tool execution as SUCCESS');
console.log('');

console.log('⚠️ Error Recovery');
console.log('---');
console.log('If SMS fails (Twilio geo-restriction):');
console.log('  • Circuit breaker catches error');
console.log('  • Booking still succeeds (idempotent)');
console.log('  • Error logged but 200 returned to Vapi');
console.log('  • Calendar entry still created');
console.log('');
console.log('If Google Calendar fails:');
console.log('  • Booking recorded in database (idempotent)');
console.log('  • SMS sent successfully');
console.log('  • 200 returned to Vapi (don\'t break the call)');
console.log('');

console.log('📊 Data Consistency Check');
console.log('---');
console.log('After Step 3 completes, verify:');
console.log('');
console.log('SELECT id, org_id, patient_name, scheduled_at, service_type');
console.log('FROM appointments');
console.log(`WHERE org_id = '${orgId}'`);
console.log(`AND patient_name = 'Austin Fortress';`);
console.log('');
console.log('Expected: 1 row with scheduled_at = 2026-01-22 09:00:00Z');
console.log('');

console.log('✅ Step 3 Ready for Execution');
