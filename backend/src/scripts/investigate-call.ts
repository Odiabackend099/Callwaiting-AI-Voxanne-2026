/**
 * Investigate Call Status
 *
 * Checks VAPI call status and database logs to investigate why call didn't go through
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

const CALL_ID = process.argv[2] || '019bfbd5-c751-7bb-a303-465b8e6cc06a';

async function investigate() {
  try {
    console.log('🔍 Investigating call status...\n');
    console.log(`Call ID: ${CALL_ID}\n`);

    if (!VAPI_PRIVATE_KEY) {
      throw new Error('Missing VAPI_PRIVATE_KEY');
    }

    // ========== Step 1: Check VAPI Call Status ==========
    console.log('📞 Step 1: Checking VAPI call status...');

    const vapiResponse = await fetch(`https://api.vapi.ai/call/${CALL_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error(`❌ Failed to fetch call from VAPI: ${vapiResponse.status}`);
      console.error(`   Error: ${errorText}\n`);
    } else {
      const call = await vapiResponse.json();
      console.log('✅ VAPI Call Details:');
      console.log(JSON.stringify(call, null, 2));
      console.log('');

      // Analyze status
      console.log('📊 Call Analysis:');
      console.log(`   Status: ${call.status}`);
      console.log(`   Type: ${call.type || 'N/A'}`);
      console.log(`   Created At: ${call.createdAt}`);
      console.log(`   Started At: ${call.startedAt || 'Not started'}`);
      console.log(`   Ended At: ${call.endedAt || 'Not ended'}`);

      if (call.customer) {
        console.log(`   Customer Number: ${call.customer.number}`);
      }

      if (call.phoneNumberId) {
        console.log(`   Phone Number ID: ${call.phoneNumberId}`);
      }

      if (call.assistantId) {
        console.log(`   Assistant ID: ${call.assistantId}`);
      }

      if (call.endedReason) {
        console.log(`   Ended Reason: ${call.endedReason}`);
      }

      if (call.error) {
        console.log(`   ❌ ERROR: ${call.error}`);
      }

      if (call.messages && call.messages.length > 0) {
        console.log(`\n   Messages (${call.messages.length}):`);
        call.messages.forEach((msg: any, i: number) => {
          console.log(`      ${i + 1}. [${msg.role}] ${msg.message?.slice(0, 100)}...`);
        });
      }

      console.log('');

      // Check if call failed
      if (call.status === 'ended' && call.endedReason) {
        console.log('⚠️ Call ended. Reason:', call.endedReason);

        if (call.endedReason.includes('error') || call.endedReason.includes('failed')) {
          console.log('❌ Call failed! This is why you did not receive it.\n');
        }
      }

      if (call.status === 'queued') {
        console.log('⏳ Call is still queued and has not been processed yet.\n');
      }
    }

    // ========== Step 2: Check Database Call Logs ==========
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      console.log('🗃️ Step 2: Checking database call logs...');

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Check call_logs table
      const { data: callLogs, error: logError } = await supabase
        .from('call_logs')
        .select('*')
        .eq('vapi_call_id', CALL_ID)
        .order('created_at', { ascending: false });

      if (logError) {
        console.log(`⚠️ Could not fetch call logs: ${logError.message}\n`);
      } else if (!callLogs || callLogs.length === 0) {
        console.log('⚠️ No call logs found in database for this call ID.\n');
        console.log('   This could mean:');
        console.log('   1. Webhook not configured properly');
        console.log('   2. Call never started (still queued)');
        console.log('   3. Call ID mismatch\n');
      } else {
        console.log(`✅ Found ${callLogs.length} call log(s):`);
        callLogs.forEach((log, i) => {
          console.log(`\n   Log ${i + 1}:`);
          console.log(`      ID: ${log.id}`);
          console.log(`      Direction: ${log.direction}`);
          console.log(`      Status: ${log.status}`);
          console.log(`      Customer Phone: ${log.customer_phone_number}`);
          console.log(`      Duration: ${log.call_duration_seconds || 0}s`);
          console.log(`      Created: ${log.created_at}`);

          if (log.call_ended_reason) {
            console.log(`      Ended Reason: ${log.call_ended_reason}`);
          }
        });
        console.log('');
      }

      // Check call_tracking table
      const { data: tracking, error: trackingError } = await supabase
        .from('call_tracking')
        .select('*')
        .eq('vapi_call_id', CALL_ID)
        .order('created_at', { ascending: false });

      if (trackingError) {
        console.log(`⚠️ Could not fetch call tracking: ${trackingError.message}\n`);
      } else if (!tracking || tracking.length === 0) {
        console.log('⚠️ No call tracking found in database.\n');
      } else {
        console.log(`✅ Found ${tracking.length} tracking record(s):`);
        tracking.forEach((t, i) => {
          console.log(`\n   Tracking ${i + 1}:`);
          console.log(`      ID: ${t.id}`);
          console.log(`      Status: ${t.status}`);
          console.log(`      Call Type: ${t.call_type}`);
          console.log(`      Phone Number: ${t.phone_number}`);
          console.log(`      Created: ${t.created_at}`);
        });
        console.log('');
      }
    }

    // ========== Step 3: Check Recent VAPI Calls ==========
    console.log('📋 Step 3: Checking recent VAPI calls...');

    const recentCallsResponse = await fetch('https://api.vapi.ai/call?limit=5', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!recentCallsResponse.ok) {
      console.log(`⚠️ Could not fetch recent calls: ${recentCallsResponse.status}\n`);
    } else {
      const recentCalls = await recentCallsResponse.json();
      console.log(`✅ Last ${recentCalls.length} calls from VAPI:\n`);

      recentCalls.forEach((call: any, i: number) => {
        const isCurrent = call.id === CALL_ID;
        const marker = isCurrent ? '👉' : '  ';

        console.log(`${marker} ${i + 1}. ID: ${call.id.slice(0, 30)}...`);
        console.log(`      Status: ${call.status}`);
        console.log(`      Customer: ${call.customer?.number || 'N/A'}`);
        console.log(`      Created: ${call.createdAt}`);

        if (call.endedReason) {
          console.log(`      Ended: ${call.endedReason}`);
        }

        if (call.error) {
          console.log(`      ❌ Error: ${call.error}`);
        }

        console.log('');
      });
    }

    // ========== Step 4: Check Assistant Configuration ==========
    console.log('🤖 Step 4: Checking assistant configuration...');

    // Get assistant ID from call
    const callData = await vapiResponse.json();
    if (callData.assistantId) {
      const assistantResponse = await fetch(`https://api.vapi.ai/assistant/${callData.assistantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (assistantResponse.ok) {
        const assistant = await assistantResponse.json();
        console.log('✅ Assistant Configuration:');
        console.log(`   Name: ${assistant.name}`);
        console.log(`   ID: ${assistant.id}`);
        console.log(`   First Message: ${assistant.firstMessage?.slice(0, 100) || 'N/A'}`);
        console.log(`   Voice: ${JSON.stringify(assistant.voice)}`);
        console.log(`   Server URL: ${assistant.serverUrl || 'N/A'}`);
        console.log('');
      }
    }

    // ========== Summary ==========
    console.log('═'.repeat(70));
    console.log('📝 INVESTIGATION SUMMARY');
    console.log('═'.repeat(70));
    console.log('');
    console.log('If call status is:');
    console.log('  • "queued" - Call is waiting to be processed (VAPI delay)');
    console.log('  • "ringing" - Call is ringing at the destination');
    console.log('  • "in-progress" - Call is active');
    console.log('  • "ended" - Call completed (check endedReason for why)');
    console.log('');
    console.log('Common issues:');
    console.log('  1. Phone number format incorrect (must be E.164)');
    console.log('  2. VAPI account limits or billing issues');
    console.log('  3. Carrier rejection (number blocked/invalid)');
    console.log('  4. Assistant configuration errors');
    console.log('  5. Webhook configuration preventing call');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error during investigation:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

investigate();
