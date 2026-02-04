/**
 * Check recording URLs in database
 * Run: npx ts-node src/scripts/check-recordings.ts
 */
import { supabase } from '../services/supabase-client';

async function checkRecordings() {
  console.log('🔍 Checking recording URLs in database...\n');

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, created_at, caller_name, recording_url, recording_storage_path')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${calls?.length || 0} calls\n`);

  calls?.forEach((call, index) => {
    const hasVapiUrl = !!call.recording_url;
    const hasStoragePath = !!call.recording_storage_path;
    const name = call.caller_name || 'Unknown';

    console.log(`${index + 1}. ${name} (${call.id.substring(0, 8)}...)`);
    console.log(`   Created: ${new Date(call.created_at).toLocaleString()}`);
    console.log(`   Vapi URL: ${hasVapiUrl ? '✅ EXISTS' : '❌ NULL'}`);
    if (hasVapiUrl) {
      console.log(`   URL: ${call.recording_url}`);
    }
    console.log(`   Storage Path: ${hasStoragePath ? '✅ EXISTS' : '❌ NULL'}`);
    console.log('');
  });

  // Summary
  const totalWithVapiUrl = calls?.filter(c => c.recording_url).length || 0;
  const totalWithStoragePath = calls?.filter(c => c.recording_storage_path).length || 0;
  const totalWithEither = calls?.filter(c => c.recording_url || c.recording_storage_path).length || 0;

  console.log('📊 Summary:');
  console.log(`   Calls with Vapi URL: ${totalWithVapiUrl}/${calls?.length || 0}`);
  console.log(`   Calls with Storage Path: ${totalWithStoragePath}/${calls?.length || 0}`);
  console.log(`   Calls with ANY recording: ${totalWithEither}/${calls?.length || 0}`);

  if (totalWithEither === 0) {
    console.log('\n⚠️  No recordings found in database!');
    console.log('   Possible causes:');
    console.log('   1. Webhook not storing recording URLs');
    console.log('   2. Vapi not providing recordings');
    console.log('   3. Recording feature not enabled');
  } else if (totalWithVapiUrl > 0) {
    console.log('\n✅ Vapi URLs exist - recordings should be playable!');
    console.log('   If playback still fails, check:');
    console.log('   1. Browser console for errors');
    console.log('   2. CORS settings on Vapi URLs');
    console.log('   3. Frontend play button handler');
  }
}

checkRecordings().catch(console.error);
