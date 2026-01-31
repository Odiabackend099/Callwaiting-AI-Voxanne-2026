import { supabase } from '../src/services/supabase-client';

async function checkAgentLookup() {
  const assistantId = '24058b42-9498-4516-b8b0-d95f2fc65e93';

  console.log('Checking for agent with vapi_assistant_id:', assistantId);
  console.log('');

  const { data, error } = await supabase
    .from('agents')
    .select('id, org_id, vapi_assistant_id, name')
    .eq('vapi_assistant_id', assistantId)
    .maybeSingle();

  if (error) {
    console.log('❌ Database error:', error.message);
    return;
  }

  if (!data) {
    console.log('❌ No agent found with vapi_assistant_id:', assistantId);
    console.log('');
    console.log('Checking all agents to find the issue...');

    const { data: allAgents } = await supabase
      .from('agents')
      .select('id, org_id, vapi_assistant_id, name')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allAgents && allAgents.length > 0) {
      console.log('\nFound', allAgents.length, 'agents in database:');
      allAgents.forEach((agent, idx) => {
        console.log(`\n${idx + 1}. ${agent.name || 'Unnamed'}`);
        console.log('   vapi_assistant_id:', agent.vapi_assistant_id || '(null)');
        console.log('   org_id:', agent.org_id);
      });
    } else {
      console.log('No agents found in database at all!');
    }
    return;
  }

  console.log('✅ Agent found:');
  console.log('  id:', data.id);
  console.log('  org_id:', data.org_id);
  console.log('  vapi_assistant_id:', data.vapi_assistant_id);
  console.log('  name:', data.name);
}

checkAgentLookup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
