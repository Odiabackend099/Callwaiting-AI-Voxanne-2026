#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function insertTestCall() {
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e'; // Voxanne Demo Clinic
  const testCallId = `test-dashboard-${Date.now()}`;

  console.log('🧪 Inserting test call for dashboard verification...\n');
  console.log(`   Org ID: ${orgId}`);
  console.log(`   Vapi Call ID: ${testCallId}\n`);

  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 120000);

  const { data, error } = await supabase
    .from('call_logs')
    .insert({
      org_id: orgId,
      vapi_call_id: testCallId,
      from_number: '+15551234567',
      to_number: '+12345678901',
      start_time: twoMinutesAgo.toISOString(),
      end_time: now.toISOString(),
      started_at: twoMinutesAgo.toISOString(),
      ended_at: now.toISOString(),
      duration_seconds: 120,
      status: 'completed',
      call_type: 'inbound',
      sentiment: 'positive',
      transcript: 'AI: Hello! How can I help you today? | Patient: Hi, do you offer Botox treatments? | AI: Yes, we do! Our Botox treatments are very popular. How can I assist you with that? | Patient: I would like to know the prices.',
      transcript_text: 'AI: Hello! How can I help you today? | Patient: Hi, do you offer Botox treatments? | AI: Yes, we do! Our Botox treatments are very popular. How can I assist you with that? | Patient: I would like to know the prices.',
      intent: 'inquiry',
      booking_created: false,
      recording_url: null,
      recording_status: 'pending',
      agent_name: 'test-agent',
      outcome: 'inquiry',
      metadata: {
        test_record: true,
        created_by: 'debug-script',
        purpose: 'dashboard-verification-test'
      }
    })
    .select();

  if (error) {
    console.error('❌ Error inserting test call:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }

  console.log('✅ Test call inserted successfully!\n');
  console.log('📊 Test Call Details:');
  console.log(`   From: +15551234567`);
  console.log(`   Duration: 120 seconds`);
  console.log(`   Sentiment: positive`);
  console.log(`   Status: completed`);
  console.log(`   Intent: inquiry\n`);

  console.log('🎯 NEXT STEP:');
  console.log('   1. Open your dashboard: http://localhost:3000/dashboard/calls');
  console.log('   2. The test call should appear at the top!');
  console.log('   3. Check if sentiment, duration, and transcript display correctly\n');

  console.log('✨ If the call appears, the webhook fix is working!');
  console.log('   Then deploy your webhook changes and test with a real call.\n');
}

insertTestCall().catch(console.error);
