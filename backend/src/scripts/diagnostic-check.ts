/**
 * Diagnostic script to check database state for name enrichment and recordings
 * Run: cd backend && npx ts-node src/scripts/diagnostic-check.ts
 */
import { supabase } from '../services/supabase-client';

async function runDiagnostics() {
  console.log('🔍 Running Diagnostic Checks...\n');
  console.log('=' .repeat(60));

  // TEST 1: Check recent calls for enrichment
  console.log('\n📊 TEST 1: Recent Calls Enrichment Status\n');
  const { data: recentCalls, error: recentError } = await supabase
    .from('calls')
    .select('id, created_at, phone_number, caller_name, call_direction')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('❌ Error fetching recent calls:', recentError.message);
  } else {
    console.log(`Total recent calls: ${recentCalls?.length || 0}`);
    recentCalls?.forEach((call, index) => {
      const nameStatus = call.caller_name && call.caller_name !== 'Unknown Caller' ? '✅' : '❌';
      console.log(`${index + 1}. ${nameStatus} ${call.caller_name || 'NULL'} | ${call.phone_number || 'No phone'} | ${new Date(call.created_at).toLocaleString()}`);
    });
  }

  // TEST 2: Count historical data gap
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 TEST 2: Historical Data Gap Analysis\n');

  const { data: allCalls, error: countError } = await supabase
    .from('calls')
    .select('id, caller_name');

  if (countError) {
    console.error('❌ Error counting calls:', countError.message);
  } else {
    const totalCalls = allCalls?.length || 0;
    const callsWithNames = allCalls?.filter(c => c.caller_name && c.caller_name !== 'Unknown Caller').length || 0;
    const unknownCallers = allCalls?.filter(c => c.caller_name === 'Unknown Caller').length || 0;
    const nullCallers = allCalls?.filter(c => !c.caller_name).length || 0;

    console.log(`Total calls: ${totalCalls}`);
    console.log(`Calls with enriched names: ${callsWithNames} (${((callsWithNames / totalCalls) * 100).toFixed(1)}%)`);
    console.log(`Calls with "Unknown Caller": ${unknownCallers} (${((unknownCallers / totalCalls) * 100).toFixed(1)}%)`);
    console.log(`Calls with NULL caller_name: ${nullCallers} (${((nullCallers / totalCalls) * 100).toFixed(1)}%)`);
    console.log(`\n⚠️  Calls needing backfill: ${unknownCallers + nullCallers}`);
  }

  // TEST 3: Check contacts for enrichment potential
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 TEST 3: Contacts Available for Enrichment\n');

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, name, phone');

  if (contactsError) {
    console.error('❌ Error fetching contacts:', contactsError.message);
  } else {
    console.log(`Total contacts: ${contacts?.length || 0}`);
    const contactsWithPhone = contacts?.filter(c => c.phone).length || 0;
    console.log(`Contacts with phone numbers: ${contactsWithPhone}`);
    console.log('\nSample contacts:');
    contacts?.slice(0, 5).forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.name} | ${contact.phone || 'No phone'}`);
    });
  }

  // TEST 4: Check recording data
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 TEST 4: Recording Data Status\n');

  const { data: callsWithRecordings, error: recordingError } = await supabase
    .from('calls')
    .select('id, created_at, recording_url, recording_storage_path')
    .or('recording_url.not.is.null,recording_storage_path.not.is.null')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recordingError) {
    console.error('❌ Error fetching recordings:', recordingError.message);
  } else {
    console.log(`Calls with recordings: ${callsWithRecordings?.length || 0}`);
    callsWithRecordings?.forEach((call, index) => {
      const hasVapiUrl = !!call.recording_url;
      const hasStoragePath = !!call.recording_storage_path;
      console.log(`${index + 1}. Call ${call.id.substring(0, 8)}... | Vapi: ${hasVapiUrl ? '✅' : '❌'} | Storage: ${hasStoragePath ? '✅' : '❌'} | ${new Date(call.created_at).toLocaleString()}`);
    });

    if (callsWithRecordings?.length === 0) {
      console.log('⚠️  No recordings found in database');
      console.log('   Possible causes:');
      console.log('   - Webhook not storing recording URLs');
      console.log('   - No calls made with recordings enabled');
      console.log('   - Recording worker not processing uploads');
    }
  }

  // TEST 5: Check recording upload queue
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 TEST 5: Recording Upload Queue Status\n');

  const { data: queueData, error: queueError } = await supabase
    .from('recording_upload_queue')
    .select('id, status, attempt_count, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (queueError) {
    console.log('⚠️  recording_upload_queue table not found or error:', queueError.message);
    console.log('   Migration may not be applied yet');
  } else {
    const totalQueued = queueData?.length || 0;
    const pending = queueData?.filter(q => q.status === 'pending').length || 0;
    const completed = queueData?.filter(q => q.status === 'completed').length || 0;
    const failed = queueData?.filter(q => q.status === 'failed').length || 0;

    console.log(`Total queued recordings: ${totalQueued}`);
    console.log(`Pending: ${pending}`);
    console.log(`Completed: ${completed}`);
    console.log(`Failed: ${failed}`);

    if (pending > 0) {
      console.log(`\n⚠️  ${pending} recordings waiting for worker to process`);
      console.log('   Check if backend server is running');
    }
  }

  // SUMMARY
  console.log('\n' + '=' .repeat(60));
  console.log('\n📋 DIAGNOSTIC SUMMARY\n');

  const enrichmentWorking = recentCalls?.some(c => c.caller_name && c.caller_name !== 'Unknown Caller');
  const recordingsExist = (callsWithRecordings?.length || 0) > 0;

  console.log('1. Name Enrichment:');
  if (enrichmentWorking) {
    console.log('   ✅ Webhook enrichment is working (recent calls have names)');
  } else {
    console.log('   ❌ Webhook enrichment may not be working (recent calls show Unknown Caller)');
    console.log('      → Check if backend server is running');
    console.log('      → Check webhook logs for errors');
  }

  console.log('\n2. Historical Data Gap:');
  if (allCalls && allCalls.length > 0) {
    const enrichmentRate = ((allCalls.filter(c => c.caller_name && c.caller_name !== 'Unknown Caller').length / allCalls.length) * 100);
    if (enrichmentRate < 50) {
      console.log(`   ⚠️  Only ${enrichmentRate.toFixed(1)}% of calls have enriched names`);
      console.log('      → Run backfill script to enrich historical data');
    } else {
      console.log(`   ✅ ${enrichmentRate.toFixed(1)}% of calls have enriched names`);
    }
  }

  console.log('\n3. Recording Playback:');
  if (recordingsExist) {
    console.log('   ✅ Recordings exist in database');
    console.log('      → Test playback in frontend');
  } else {
    console.log('   ❌ No recordings found in database');
    console.log('      → Make a test call with recording enabled');
    console.log('      → Check Vapi webhook logs');
  }

  console.log('\n' + '=' .repeat(60));
  console.log('\n✅ Diagnostic check complete!\n');
}

runDiagnostics().catch(console.error);
