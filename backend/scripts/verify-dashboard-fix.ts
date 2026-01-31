import { supabase } from '../src/services/supabase-client';

async function verifyDashboardFix() {
  console.log('🔍 Verifying dashboard fix...\n');

  // Check database
  const { data, error } = await supabase
    .from('call_logs')
    .select('vapi_call_id, org_id, from_number, recording_url, recording_storage_path, call_type, created_at')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.log('❌ Database error:', error.message);
    return;
  }

  console.log('📋 Recent calls for org 46cf2995-2bee-44e3-838b-24151486fe4e:\n');

  data?.forEach((call, i) => {
    const hasRecordingUrl = !!call.recording_url;
    const hasStoragePath = !!call.recording_storage_path;
    const shouldShow = hasRecordingUrl || hasStoragePath;

    console.log(`${i + 1}. Call ID: ${call.vapi_call_id}`);
    console.log(`   From: ${call.from_number}`);
    console.log(`   Type: ${call.call_type}`);
    console.log(`   recording_url: ${hasRecordingUrl ? '✅ YES' : '❌ NO'}`);
    console.log(`   recording_storage_path: ${hasStoragePath ? '✅ YES' : '❌ NO'}`);
    console.log(`   Should show in dashboard: ${shouldShow ? '✅ YES' : '❌ NO'}`);
    console.log(`   Created: ${call.created_at}`);
    console.log('');
  });

  console.log(`\n✅ Total calls found: ${data?.length || 0}`);

  if (data && data.length > 0) {
    const testCall = data.find(c => c.vapi_call_id === '019c1238-85f2-7887-a7ab-fbca50b1b79e');
    if (testCall) {
      console.log('\n🎯 Test call found!');
      console.log(`   - Has recording_url: ${!!testCall.recording_url}`);
      console.log(`   - Has recording_storage_path: ${!!testCall.recording_storage_path}`);
      console.log(`   - Will show in dashboard: ${!!(testCall.recording_url || testCall.recording_storage_path)}`);
    } else {
      console.log('\n⚠️  Test call 019c1238-85f2-7887-a7ab-fbca50b1b79e not in recent 3 calls');
    }
  }
}

verifyDashboardFix()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
