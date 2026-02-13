import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkGoldenRecord() {
  // Get test@demo.com organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('email', 'test@demo.com')
    .single();

  if (orgError) {
    console.log('❌ Organization error:', orgError.message);
    return;
  }

  if (!org) {
    console.log('❌ Organization test@demo.com not found');
    return;
  }

  console.log('✅ Found organization:', org.name, '\n');

  // Get all calls
  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select(`
      id,
      vapi_call_id,
      phone_number,
      caller_name,
      call_direction,
      status,
      duration_seconds,
      cost_cents,
      ended_reason,
      tools_used,
      appointment_id,
      created_at
    `)
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (callsError) {
    console.log('❌ Calls error:', callsError.message);
    return;
  }

  const totalCalls = calls?.length || 0;
  console.log(`📊 Total calls for ${org.name}: ${totalCalls}\n`);

  if (totalCalls === 0) {
    console.log('⚠️  No calls found in database');
    return;
  }

  // Show all calls
  calls!.forEach((call: any, index: number) => {
    console.log(`Call ${index + 1}:`);
    console.log(`  Phone: ${call.phone_number}`);
    console.log(`  Caller: ${call.caller_name}`);
    console.log(`  Direction: ${call.call_direction}`);
    console.log(`  Status: ${call.status}`);
    console.log(`  Duration: ${call.duration_seconds}s`);
    console.log(`  💰 Cost (cents): ${call.cost_cents}`);
    console.log(`  🎯 Ended Reason: ${call.ended_reason || '(none)'}`);
    console.log(`  🔧 Tools Used: ${JSON.stringify(call.tools_used || [])}`);
    console.log(`  📅 Appointment ID: ${call.appointment_id || '(none)'}`);
    console.log(`  Created: ${new Date(call.created_at).toLocaleString()}`);
    console.log('---');
  });

  // Summary statistics
  const callsWithCost = calls!.filter((c: any) => c.cost_cents && c.cost_cents > 0).length;
  const callsWithEndedReason = calls!.filter((c: any) => c.ended_reason).length;
  const callsWithTools = calls!.filter((c: any) => c.tools_used && c.tools_used.length > 0).length;
  const callsWithAppointment = calls!.filter((c: any) => c.appointment_id).length;

  console.log('\n📈 Golden Record Population Stats:');
  console.log(`  Cost populated: ${callsWithCost}/${totalCalls} (${((callsWithCost/totalCalls)*100).toFixed(1)}%)`);
  console.log(`  Ended reason populated: ${callsWithEndedReason}/${totalCalls} (${((callsWithEndedReason/totalCalls)*100).toFixed(1)}%)`);
  console.log(`  Tools used populated: ${callsWithTools}/${totalCalls} (${((callsWithTools/totalCalls)*100).toFixed(1)}%)`);
  console.log(`  Appointment linked: ${callsWithAppointment}/${totalCalls} (${((callsWithAppointment/totalCalls)*100).toFixed(1)}%)`);
}

checkGoldenRecord().catch(console.error);
