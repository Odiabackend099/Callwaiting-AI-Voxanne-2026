#!/usr/bin/env ts-node
import { supabase } from '../services/supabase-client';

async function findOrgAndInsertTestCall() {
  console.log('🔍 Finding your organization...\n');

  // Find all organizations
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, owner_email, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (orgsError) {
    console.error('❌ Error querying organizations:', orgsError.message);
    process.exit(1);
  }

  if (!orgs || orgs.length === 0) {
    console.error('❌ No organizations found in database');
    process.exit(1);
  }

  console.log('📋 Found organizations:');
  orgs.forEach((org, index) => {
    console.log(`\n${index + 1}. ID: ${org.id}`);
    console.log(`   Name: ${org.name || 'N/A'}`);
    console.log(`   Email: ${org.owner_email || 'N/A'}`);
    console.log(`   Created: ${org.created_at}`);
  });

  // Use the first org for test
  const testOrgId = orgs[0].id;
  console.log(`\n✅ Using organization: ${testOrgId}\n`);

  // Check if call_logs table exists and has data
  const { data: existingCalls, error: callsError } = await supabase
    .from('call_logs')
    .select('id, vapi_call_id, phone_number, started_at, status')
    .eq('org_id', testOrgId)
    .order('started_at', { ascending: false })
    .limit(5);

  if (callsError) {
    console.error('❌ Error querying call_logs:', callsError.message);
  } else if (existingCalls && existingCalls.length > 0) {
    console.log('📞 Existing calls in call_logs:');
    existingCalls.forEach((call, index) => {
      console.log(`\n${index + 1}. Vapi ID: ${call.vapi_call_id}`);
      console.log(`   Phone: ${call.phone_number || 'N/A'}`);
      console.log(`   Started: ${call.started_at}`);
      console.log(`   Status: ${call.status}`);
    });
  } else {
    console.log('⚠️  No existing calls found in call_logs table');
  }

  // Insert test call
  console.log('\n🧪 Inserting test call log...\n');

  const testCallId = `test-call-${Date.now()}`;
  const { data: insertedCall, error: insertError } = await supabase
    .from('call_logs')
    .insert({
      org_id: testOrgId,
      vapi_call_id: testCallId,
      phone_number: '+15551234567',
      caller_name: 'Test Patient (Dashboard Debug)',
      started_at: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      ended_at: new Date().toISOString(),
      duration_seconds: 120,
      status: 'completed',
      call_type: 'inbound',
      sentiment_label: 'positive',
      sentiment_score: 0.85,
      sentiment_summary: 'Patient was happy and asked about Botox treatment. Very interested in booking an appointment.',
      transcript: JSON.stringify([
        { speaker: 'AI', text: 'Hello! How can I help you today?', timestamp: 0 },
        { speaker: 'Patient', text: 'Hi, do you offer Botox treatments?', timestamp: 3 },
        { speaker: 'AI', text: 'Yes, we do! Our Botox treatments are very popular.', timestamp: 7 },
        { speaker: 'Patient', text: 'Great! What are your prices?', timestamp: 12 }
      ]),
      metadata: {
        test_record: true,
        created_by: 'debug-script',
        purpose: 'dashboard-verification'
      }
    })
    .select();

  if (insertError) {
    console.error('❌ Error inserting test call:', insertError.message);
    console.error('Full error:', insertError);
    process.exit(1);
  }

  console.log('✅ Test call inserted successfully!\n');
  console.log('📊 Test Call Details:');
  console.log(`   Vapi Call ID: ${testCallId}`);
  console.log(`   Organization ID: ${testOrgId}`);
  console.log(`   Phone: +15551234567`);
  console.log(`   Duration: 120 seconds`);
  console.log(`   Sentiment: positive (0.85)`);
  console.log(`   Status: completed\n`);

  console.log('🎯 NEXT STEP: Open your dashboard and check /dashboard/calls');
  console.log('   The test call should appear at the top of the list!\n');

  // Verify the call can be read back
  const { data: verifyCall, error: verifyError } = await supabase
    .from('call_logs')
    .select('*')
    .eq('vapi_call_id', testCallId)
    .single();

  if (verifyError) {
    console.error('⚠️  Warning: Could not verify call was inserted:', verifyError.message);
  } else if (verifyCall) {
    console.log('✅ Verification: Call can be read from database');
    console.log(`   Record ID: ${verifyCall.id}\n`);
  }

  console.log('🔍 Dashboard URL: http://localhost:3000/dashboard/calls');
  console.log('   OR: https://your-production-domain.com/dashboard/calls\n');
}

findOrgAndInsertTestCall().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
