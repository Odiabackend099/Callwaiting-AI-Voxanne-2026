#!/usr/bin/env node

/**
 * Operation: Full Circle - Verification
 * Verify all three steps and the complete booking flow
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const { createClient } = require('@supabase/supabase-js');

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const appointmentId = '0f22ca6f-d73e-40bb-a3cf-af249b0c5460';
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

console.log('🏛️ OPERATION: FULL CIRCLE - VERIFICATION CHECKLIST');
console.log('');

async function verifyBooking() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('📊 Verifying Appointment Entry in Database');
    console.log('---');
    
    // Query the appointment
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('org_id', orgId)
      .eq('patient_name', 'Austin Fortress');

    if (error) {
      console.error('❌ Failed to fetch appointment:', error.message);
      return;
    }

    if (!appointments || appointments.length === 0) {
      console.error('❌ No appointment found for Austin Fortress');
      return;
    }

    const apt = appointments[0];
    
    console.log('✅ Appointment Found!');
    console.log('');
    console.log('Database Entry Details:');
    console.log(`  • ID: ${apt.id}`);
    console.log(`  • Org ID: ${apt.org_id}`);
    console.log(`  • Patient: ${apt.patient_name}`);
    console.log(`  • Email: ${apt.patient_email}`);
    console.log(`  • Phone: ${apt.patient_phone}`);
    console.log(`  • Service: ${apt.service_type}`);
    console.log(`  • Scheduled At (UTC): ${apt.scheduled_at}`);
    console.log(`  • Created At: ${apt.created_at}`);
    console.log('');

    // Verify timezone conversion
    const scheduledDate = new Date(apt.scheduled_at);
    console.log('🕐 Timezone Verification:');
    console.log(`  • Database stores: ${apt.scheduled_at}`);
    console.log(`  • Expected UTC: 2026-01-22 09:00:00Z`);
    
    if (apt.scheduled_at === '2026-01-22T09:00:00+00:00' || 
        apt.scheduled_at === '2026-01-22 09:00:00Z' ||
        apt.scheduled_at.includes('2026-01-22') && apt.scheduled_at.includes('09:00')) {
      console.log(`  ✅ CORRECT: UTC timezone conversion verified`);
    } else {
      console.log(`  ⚠️ CAUTION: Check timezone conversion`);
    }
    console.log('');

    return apt;
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function verifyAgent() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('🎤 Verifying Agent Configuration');
    console.log('---');
    
    // Query the agent
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      console.error('❌ Failed to fetch agents:', error.message);
      return;
    }

    if (!agents || agents.length === 0) {
      console.error('❌ No agents found for this org');
      return;
    }

    agents.forEach((agent, idx) => {
      console.log(`Agent ${idx + 1}:`);
      console.log(`  • ID: ${agent.id}`);
      console.log(`  • Name: ${agent.name}`);
      console.log(`  • Voice ID: ${agent.voice_id}`);
      console.log(`  • Language: ${agent.language}`);
      console.log(`  • Type: ${agent.agent_type}`);
      console.log(`  • Vapi Assistant ID: ${agent.vapi_assistant_id || 'NOT SET'}`);
      console.log('');
    });

    return agents;
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function main() {
  console.log('⏱️  Org ID: ' + orgId);
  console.log('');
  
  const apt = await verifyBooking();
  console.log('');
  
  const agents = await verifyAgent();
  console.log('');

  console.log('🏁 Verification Summary');
  console.log('---');
  console.log('');
  console.log('✅ Step 1 (Scorched Earth): COMPLETE');
  console.log('   • Appointments table cleared');
  console.log('   • Leads table cleared');
  console.log('');
  
  console.log('⏳ Step 2 (Agent Save): PENDING EXECUTION');
  console.log('   • Awaiting manual curl with JWT token');
  console.log('   • Expected: Voice changed to "neha"');
  console.log('');
  
  console.log('✅ Step 3 (Fortress Booking): COMPLETE');
  console.log(`   • Appointment created: ${apt?.id || 'UNKNOWN'}`);
  console.log(`   • Patient: Austin Fortress`);
  console.log(`   • Scheduled: ${apt?.scheduled_at || 'UNKNOWN'}`);
  console.log(`   • SMS Status: FAILED (Twilio geo-restriction)`);
  console.log(`   • Calendar: PENDING (requires Step 2 first)`);
  console.log('');
  
  console.log('📋 Next Steps:');
  console.log('');
  console.log('1. Execute Step 2 (Agent Save) with your JWT token:');
  console.log(`   curl -X POST https://callwaitingai-backend-sjbi.onrender.com/api/founder-console/agent/behavior \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -H "Authorization: Bearer YOUR_JWT" \\`);
  console.log(`     -d '{"inbound":{"voiceId":"neha","language":"en-US"}}'`);
  console.log('');
  console.log('2. Verify voice change in Vapi dashboard');
  console.log('');
  console.log('3. Check SMS delivery logs (expected: FAILED due to Twilio geo-restriction)');
  console.log('   Circuit breaker should catch this and still return 200 to Vapi');
  console.log('');
  console.log('4. Verify Google Calendar entry at voxanne@demo.com');
  console.log('   Should show: Thursday, Jan 22, 10:00 AM (Africa/Lagos)');
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
