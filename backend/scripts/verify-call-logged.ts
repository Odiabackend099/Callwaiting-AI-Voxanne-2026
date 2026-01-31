import { supabase } from '../src/services/supabase-client';

async function verifyCallLogged() {
  const vapiCallId = '019c1238-85f2-7887-a7ab-fbca50b1b79e';

  console.log('Verifying call with vapi_call_id:', vapiCallId);
  console.log('');

  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('vapi_call_id', vapiCallId)
    .maybeSingle();

  if (error) {
    console.log('❌ Database query error:', error.message);
    return;
  }

  if (!data) {
    console.log('❌ No call_logs entry found for vapi_call_id:', vapiCallId);
    return;
  }

  console.log('✅✅✅ CALL SUCCESSFULLY LOGGED! ✅✅✅');
  console.log('');
  console.log('Call Details:');
  console.log('  vapi_call_id:', data.vapi_call_id);
  console.log('  call_sid:', data.call_sid);
  console.log('  org_id:', data.org_id);
  console.log('  from_number:', data.from_number);
  console.log('  duration_seconds:', data.duration_seconds);
  console.log('  total_cost:', data.total_cost);
  console.log('  status:', data.status);
  console.log('  outcome:', data.outcome);
  console.log('  call_type:', data.call_type);
  console.log('  sentiment:', data.sentiment);
  console.log('  started_at:', data.started_at);
  console.log('  ended_at:', data.ended_at);
  console.log('  created_at:', data.created_at);
  console.log('');
  console.log('  outcome_summary:', data.outcome_summary?.substring(0, 150) + '...');
  console.log('');
  console.log('  has_transcript:', !!data.transcript);
  console.log('  transcript_length:', data.transcript?.length || 0);
  console.log('');
  console.log('  has_recording_url:', !!data.recording_url);
  console.log('  recording_url:', data.recording_url);
  console.log('');
  console.log('  metadata:', JSON.stringify(data.metadata, null, 2));
}

verifyCallLogged()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
