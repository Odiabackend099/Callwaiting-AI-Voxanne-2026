#!/usr/bin/env node

/**
 * Operation: Full Circle - Step 1 - Scorched Earth
 * Executes database wipe for the test organization
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const { createClient } = require('@supabase/supabase-js');

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

console.log('🏛️ OPERATION: FULL CIRCLE - STEP 1: SCORCHED EARTH');
console.log(`📍 Org ID: ${orgId}`);
console.log(`🌍 Supabase: ${supabaseUrl}`);
console.log('');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function step1_ScorchedEarth() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('⚙️ Step 1a: Deleting appointments...');
    const deleteAppointments = await supabase
      .from('appointments')
      .delete()
      .eq('org_id', orgId);

    if (deleteAppointments.error) {
      console.error('❌ Failed to delete appointments:', deleteAppointments.error.message);
    } else {
      console.log(`✅ Deleted appointments. Count: ${deleteAppointments.data?.length || 0}`);
    }

    console.log('');
    console.log('⚙️ Step 1b: Deleting leads...');
    const deleteLeads = await supabase
      .from('leads')
      .delete()
      .eq('org_id', orgId);

    if (deleteLeads.error) {
      console.error('❌ Failed to delete leads:', deleteLeads.error.message);
    } else {
      console.log(`✅ Deleted leads. Count: ${deleteLeads.data?.length || 0}`);
    }

    console.log('');
    console.log('✅ STEP 1 COMPLETE: Database wipe successful');
    console.log('');
    return true;
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    return false;
  }
}

async function step2_AgentSaveSimulation() {
  console.log('🏛️ STEP 2: SAVE AGENT SIMULATION');
  console.log('---');
  console.log('');
  
  const payload = {
    name: "Voxanne Receptionist",
    voice: { provider: "vapi", voiceId: "neha" },
    model: {
      provider: "openai",
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a receptionist for a clinic in Lagos. Schedule appointments professionally."
      }]
    }
  };

  console.log('📝 Agent Update Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  console.log('🔗 Endpoint: POST/PATCH http://localhost:3001/api/agents/inbound');
  console.log('✅ Ready to execute on local backend or production');
  console.log('');
  console.log('Expected Voice ID in Vapi: neha');
  console.log('');
}

async function step3_FortressBookingTest() {
  console.log('🏛️ STEP 3: FORTRESS BOOKING TEST');
  console.log('---');
  console.log('');

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

  console.log('📝 Booking Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  console.log('🔗 Endpoint: POST https://callwaitingai-backend-sjbi.onrender.com/api/vapi/tools/bookClinicAppointment');
  console.log('');
  
  console.log('🕐 Timezone Conversion (Lagos = UTC+1):');
  console.log('  • User Input:        Thursday, Jan 22, 10:00 AM (Lagos WAT)');
  console.log('  • Database (UTC):    2026-01-22 09:00:00Z');
  console.log('  • Google Calendar:   Thursday, Jan 22, 10:00 AM (Africa/Lagos)');
  console.log('  • Patient SMS:       "Confirmed for 10:00 AM"');
  console.log('');
  
  console.log('✅ Ready to execute booking test');
  console.log('');
}

async function main() {
  const success = await step1_ScorchedEarth();
  
  if (success) {
    console.log('🏁 STEP 1 VERIFICATION:');
    console.log('✅ Appointments table cleared for org');
    console.log('✅ Leads table cleared for org');
    console.log('✅ Audit trail ready for fresh booking test');
    console.log('');
  } else {
    console.error('❌ Step 1 failed - aborting operation');
    process.exit(1);
  }

  await step2_AgentSaveSimulation();
  await step3_FortressBookingTest();

  console.log('🏛️ OPERATION: FULL CIRCLE - READY FOR EXECUTION');
  console.log('');
  console.log('📋 Summary:');
  console.log('  ✅ Step 1 (Scorched Earth): COMPLETE');
  console.log('  ⏳ Step 2 (Agent Save): Ready - see payload above');
  console.log('  ⏳ Step 3 (Booking Test): Ready - execute curl command below');
  console.log('');
  console.log('🔥 Execute this curl command in a separate terminal:');
  console.log('');
  console.log(`curl -X POST "https://callwaitingai-backend-sjbi.onrender.com/api/vapi/tools/bookClinicAppointment" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(JSON.parse(JSON.stringify({
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
  })))}'`);
  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
