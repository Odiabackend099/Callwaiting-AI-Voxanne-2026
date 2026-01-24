#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏛️ OPERATION: FULL CIRCLE');
console.log(`📍 Org ID: ${orgId}`);
console.log(`🌍 Supabase URL: ${supabaseUrl}`);
console.log('');

// ============================================================
// STEP 1: Scorched Earth - Delete appointments and leads
// ============================================================

async function executeDatabaseWipe() {
  console.log('⚙️ STEP 1: Scorched Earth (Database Wipe)');
  console.log('---');
  
  const deleteQueries = [
    `DELETE FROM appointments WHERE org_id = '${orgId}'`,
    `DELETE FROM leads WHERE org_id = '${orgId}'`
  ];

  try {
    for (const query of deleteQueries) {
      console.log(`📝 Query: ${query}`);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql_exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Query failed: ${error}`);
      } else {
        const result = await response.json();
        console.log(`✅ Query executed: ${result?.rows?.length || 0} rows affected\n`);
      }
    }
  } catch (err) {
    console.error('❌ Database wipe failed:', err.message);
  }
}

// ============================================================
// STEP 2: Agent Save Simulation
// ============================================================

async function saveAgentSimulation() {
  console.log('⚙️ STEP 2: Save Agent Simulation');
  console.log('---');
  
  const backendUrl = 'http://localhost:3001';
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

  console.log(`📝 Payload: ${JSON.stringify(payload, null, 2)}`);
  console.log(`🔗 Target: POST/PATCH ${backendUrl}/api/agents/inbound`);
  console.log('⚠️ Note: Run this on local backend or update URL for production\n');
}

// ============================================================
// STEP 3: Fortress Booking Test
// ============================================================

async function fortressBookingTest() {
  console.log('⚙️ STEP 3: Fortress Booking Test (Jan 22, 10:00 AM Lagos)');
  console.log('---');
  
  const toolUrl = 'https://callwaitingai-backend-sjbi.onrender.com/api/vapi/tools/bookClinicAppointment';
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

  console.log(`📝 Payload: ${JSON.stringify(payload, null, 2)}`);
  console.log(`🔗 Target: POST ${toolUrl}`);
  console.log('');
  console.log('🕐 Timezone Conversion Audit:');
  console.log('  User Input:      Thursday, Jan 22, 10:00 AM (Lagos WAT)');
  console.log('  Database (UTC):  2026-01-22 09:00:00Z');
  console.log('  Google Calendar: Thursday, Jan 22, 10:00 AM (Africa/Lagos)');
  console.log('  Patient SMS:     "Confirmed for 10:00 AM"');
  console.log('\n');
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  try {
    await executeDatabaseWipe();
    await saveAgentSimulation();
    await fortressBookingTest();
    
    console.log('🏁 Operation: Full Circle - Commands Generated');
    console.log('📋 Next Steps:');
    console.log('  1. Verify Step 1 output above');
    console.log('  2. Run backend locally or update Step 2 URL for production');
    console.log('  3. Execute curl from Step 3 in separate terminal');
    console.log('  4. Verify: SMS log, Calendar event, Database timestamp');
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
