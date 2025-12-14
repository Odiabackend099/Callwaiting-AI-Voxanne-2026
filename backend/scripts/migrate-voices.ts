import { supabase } from '../src/services/supabase-client';

const voiceMigrationMap: Record<string, string> = {
  'Kylie': 'paige',
  'kylie': 'paige',
  'aura-asteria-en': 'lily',
  'aura-luna-en': 'savannah',
  'aura-stella-en': 'hana',
  'aura-athena-en': 'neha',
  'aura-hera-en': 'neha',
  'aura-orion-en': 'cole',
  'aura-arcas-en': 'elliot',
  'aura-perseus-en': 'spencer'
};

async function migrateVoices() {
  console.log('🎤 Migrating voices to VAPI format...');

  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name, voice');

  if (error) {
    console.error('Failed to fetch agents:', error);
    return;
  }

  let migrated = 0;

  for (const agent of agents) {
    const currentVoice = agent.voice;
    const newVoice = voiceMigrationMap[currentVoice] || voiceMigrationMap[currentVoice?.toLowerCase()];

    if (newVoice && newVoice !== currentVoice) {
      console.log(`Migrating "${agent.name}": ${currentVoice} → ${newVoice}`);

      await supabase
        .from('agents')
        .update({ voice: newVoice })
        .eq('id', agent.id);

      migrated++;
    } else if (currentVoice && currentVoice.startsWith('aura-')) {
       // Fallback for any other aura voices to 'paige' if not in map
       console.log(`Migrating "${agent.name}": ${currentVoice} → paige (fallback)`);
       await supabase
        .from('agents')
        .update({ voice: 'paige' })
        .eq('id', agent.id);
       migrated++;
    }
  }

  console.log(`✅ Migrated ${migrated} agents to VAPI voices`);
}

migrateVoices().catch(console.error);
