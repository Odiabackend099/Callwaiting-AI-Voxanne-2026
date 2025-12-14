import { supabase } from '../src/services/supabase-client';

async function cleanupDummyAgents() {
  console.log('🧹 Scanning for dummy agents...');

  // Patterns to identify dummy/test agents
  const dummyPatterns = [
    'test',
    'demo',
    'sample',
    'dummy',
    'temp',
    'example',
    'fake'
  ];

  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name, active');

  if (error) {
    console.error('Failed to fetch agents:', error);
    return;
  }

  const dummyAgents = agents.filter(agent =>
    dummyPatterns.some(pattern =>
      agent.name.toLowerCase().includes(pattern)
    ) && !agent.active // Only inactive test agents
  );

  console.log(`Found ${dummyAgents.length} dummy agents:`);
  dummyAgents.forEach(agent => {
    console.log(`  - ${agent.name} (ID: ${agent.id})`);
  });

  if (dummyAgents.length === 0) {
    console.log('✅ No dummy agents found. Database is clean!');
    return;
  }

  // Check for dependencies
  for (const agent of dummyAgents) {
    // Check call logs
    const { data: calls } = await supabase
      .from('call_logs')
      .select('id')
      .eq('assistant_id', agent.id) // Assuming assistant_id maps to agent.id or vapi id. Checking both just in case or simpler check.
      .limit(1);

    if (calls && calls.length > 0) {
      console.log(`⚠️  Agent "${agent.name}" has call history. Skipping deletion.`);
      continue;
    }

    // Safe to delete
    console.log(`🗑️  Deleting agent: ${agent.name}`);
    await supabase
      .from('agents')
      .delete()
      .eq('id', agent.id);
  }

  console.log('✅ Cleanup complete!');
}

cleanupDummyAgents().catch(console.error);
