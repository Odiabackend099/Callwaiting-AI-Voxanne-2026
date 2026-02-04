/**
 * Debug Availability Check Endpoint
 *
 * Investigates why checkAvailability is failing despite working booking endpoint.
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const APPOINTMENT_DATE = '2026-02-06';
const APPOINTMENT_TIME = '15:00';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function debugAvailabilityCheck() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         DEBUG AVAILABILITY CHECK ENDPOINT                      ║
╚════════════════════════════════════════════════════════════════╝
Backend URL: ${BACKEND_URL}
Org ID: ${ORG_ID}
Date: ${APPOINTMENT_DATE}
Service: Botox
Starting...
`);

  try {
    // Step 1: Check org configuration
    console.log('\n1. CHECKING ORG CONFIGURATION\n');

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, vapi_assistant_id, vapi_phone_number_id, created_at')
      .eq('id', ORG_ID)
      .single();

    if (org) {
      console.log(`✅ Org found: ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Vapi Assistant ID: ${org.vapi_assistant_id || 'NULL'}`);
      console.log(`   Vapi Phone Number ID: ${org.vapi_phone_number_id || 'NULL'}`);
    } else {
      console.log(`❌ Org not found: ${orgError?.message}`);
      process.exit(1);
    }

    // Step 2: Check agents
    console.log('\n2. CHECKING AGENTS\n');

    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, vapi_assistant_id, is_test_agent')
      .eq('org_id', ORG_ID)
      .limit(5);

    if (agents && agents.length > 0) {
      console.log(`✅ Found ${agents.length} agents`);
      agents.forEach((agent, i) => {
        console.log(`   [${i + 1}] ${agent.name} (Test: ${agent.is_test_agent})`);
        console.log(`       Assistant ID: ${agent.vapi_assistant_id || 'NULL'}`);
      });
    } else {
      console.log(`⚠️  No agents found for this org`);
    }

    // Step 3: Check Google Calendar credentials
    console.log('\n3. CHECKING GOOGLE CALENDAR CREDENTIALS\n');

    // Try multiple table names in case schema varies
    const credentialTableNames = [
      'integration_credentials',
      'integration_tokens',
      'google_calendar_tokens',
      'oauth_credentials',
      'provider_credentials'
    ];

    let credentialsFound = false;

    for (const tableName of credentialTableNames) {
      try {
        const { data: creds, error: credsError } = await supabase
          .from(tableName)
          .select('*')
          .eq('org_id', ORG_ID)
          .limit(1);

        if (!credsError && creds && creds.length > 0) {
          console.log(`✅ Found credentials in table: ${tableName}`);
          const cred = creds[0];
          console.log(`   Type: ${cred.provider_type || cred.type || 'unknown'}`);
          console.log(`   Keys: ${Object.keys(cred).join(', ')}`);
          credentialsFound = true;
          break;
        }
      } catch (e) {
        // Table doesn't exist or query failed, try next
      }
    }

    if (!credentialsFound) {
      console.log(`❌ No Google Calendar credentials found`);
      console.log(`   Checked tables: ${credentialTableNames.join(', ')}`);
    }

    // Step 4: Check services/specialties
    console.log('\n4. CHECKING SERVICES\n');

    const { data: services } = await supabase
      .from('services')
      .select('id, name, description, price')
      .eq('org_id', ORG_ID)
      .limit(10);

    if (services && services.length > 0) {
      console.log(`✅ Found ${services.length} services`);
      services.forEach((svc, i) => {
        console.log(`   [${i + 1}] ${svc.name} - $${svc.price}`);
      });

      // Check if Botox is available
      const hasBotox = services.some(s => s.name.toLowerCase().includes('botox'));
      console.log(`   Botox service: ${hasBotox ? '✅ FOUND' : '❌ NOT FOUND'}`);
    } else {
      console.log(`❌ No services found`);
    }

    // Step 5: Check availability/slots table
    console.log('\n5. CHECKING AVAILABILITY SLOTS\n');

    const slotTableNames = [
      'availability_slots',
      'appointment_slots',
      'clinic_hours',
      'clinic_schedules'
    ];

    let slotsFound = false;

    for (const tableName of slotTableNames) {
      try {
        const { data: slots, error: slotsError } = await supabase
          .from(tableName)
          .select('*')
          .eq('org_id', ORG_ID)
          .limit(1);

        if (!slotsError && slots && slots.length > 0) {
          console.log(`✅ Found slots in table: ${tableName}`);
          console.log(`   Total records: ${slots.length}`);
          slotsFound = true;
          break;
        }
      } catch (e) {
        // Try next table
      }
    }

    if (!slotsFound) {
      console.log(`⚠️  No availability slots table found`);
      console.log(`   Note: System may calculate availability dynamically from appointments`);
    }

    // Step 6: Test availability check endpoint with different payloads
    console.log('\n6. TESTING AVAILABILITY CHECK ENDPOINT\n');

    // Payload 1: With tenantId
    console.log('Attempt 1: checkAvailability with tenantId');
    const payload1 = {
      message: {
        toolCalls: [{
          function: {
            name: 'checkAvailability',
            arguments: JSON.stringify({
              tenantId: ORG_ID,
              date: APPOINTMENT_DATE,
              serviceType: 'Botox'
            })
          }
        }],
        call: {
          id: `debug-${Date.now()}-1`,
          metadata: { org_id: ORG_ID }
        }
      }
    };

    try {
      const resp1 = await axios.post(
        `${BACKEND_URL}/api/vapi/tools/checkAvailability`,
        payload1,
        { timeout: 10000 }
      );

      console.log(`   Status: ${resp1.status}`);
      console.log(`   Response: ${JSON.stringify(resp1.data?.result || resp1.data, null, 2)}`);
    } catch (e: any) {
      console.log(`   Error: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
    }

    // Payload 2: Different field names
    console.log('\nAttempt 2: checkAvailability with different field names');
    const payload2 = {
      message: {
        toolCalls: [{
          function: {
            name: 'checkAvailability',
            arguments: JSON.stringify({
              org_id: ORG_ID,
              date: APPOINTMENT_DATE,
              service: 'Botox'
            })
          }
        }],
        call: {
          id: `debug-${Date.now()}-2`,
          metadata: { org_id: ORG_ID }
        }
      }
    };

    try {
      const resp2 = await axios.post(
        `${BACKEND_URL}/api/vapi/tools/checkAvailability`,
        payload2,
        { timeout: 10000 }
      );

      console.log(`   Status: ${resp2.status}`);
      console.log(`   Response: ${JSON.stringify(resp2.data?.result || resp2.data, null, 2)}`);
    } catch (e: any) {
      console.log(`   Error: ${e.response?.status} - ${e.response?.data?.error || e.message}`);
    }

    // Step 7: Summary
    console.log(`\n════════════════════════════════════════════════════════════════`);
    console.log(`SUMMARY:`);
    console.log(`- Org exists: ✅`);
    console.log(`- Agents exist: ${agents && agents.length > 0 ? '✅' : '❌'}`);
    console.log(`- Calendar credentials: ${credentialsFound ? '✅' : '❌'}`);
    console.log(`- Services configured: ${services && services.length > 0 ? '✅' : '❌'}`);
    console.log(`════════════════════════════════════════════════════════════════`);

  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

debugAvailabilityCheck();
