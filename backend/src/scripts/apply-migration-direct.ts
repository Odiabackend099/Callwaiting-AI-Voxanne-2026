/**
 * Direct Migration Application via Supabase Client
 * Applies voice_provider column migration using SQL RPC
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function applyMigrationDirect() {
  console.log('🔧 Applying voice_provider migration directly...\n');

  try {
    // Step 1: Check if column already exists (skip ALTER TABLE - must be done manually)
    console.log('Step 1: Checking if voice_provider column exists...');
    const { data: columnExists } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'agents')
      .eq('column_name', 'voice_provider')
      .maybeSingle();

    if (!columnExists) {
      console.error('   ❌ Column does not exist');
      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('   Go to: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql/new');
      console.log('   Run this SQL:\n');
      console.log('   ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_provider TEXT;');
      console.log('   CREATE INDEX IF NOT EXISTS idx_agents_voice_provider ON agents(voice_provider);');
      console.log('\n   Then re-run this script to backfill data.\n');
      process.exit(1);
    }

    console.log('   ✅ Column exists');

    // Step 2: Verify column exists
    console.log('\nStep 2: Verifying column...');
    const { data: columnCheck } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'agents')
      .eq('column_name', 'voice_provider')
      .maybeSingle();

    if (!columnCheck) {
      console.error('❌ Column was not created');
      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('   Go to: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql/new');
      console.log('   Run this SQL:\n');
      console.log('   ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_provider TEXT;');
      process.exit(1);
    }

    console.log('✅ Column exists:', columnCheck.column_name, `(${columnCheck.data_type})`);

    // Step 3: Backfill existing agents
    console.log('\nStep 3: Backfilling existing agents...');

    // Get all agents without voice_provider
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('id, voice, voice_provider')
      .is('voice_provider', null)
      .not('voice', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching agents:', fetchError.message);
      process.exit(1);
    }

    if (!agents || agents.length === 0) {
      console.log('✅ No agents need backfilling');
    } else {
      console.log(`   Found ${agents.length} agent(s) to backfill...`);

      let updated = 0;
      for (const agent of agents) {
        // Determine provider from voice ID
        let provider = 'vapi';
        const voice = agent.voice;

        if (['Rohan', 'Elliot', 'Savannah', 'jennifer', 'kylie', 'neha', 'rohan', 'elliot', 'savannah'].includes(voice)) {
          provider = 'vapi';
        } else if (/^[A-Za-z0-9]{24}$/.test(voice)) {
          provider = 'elevenlabs';
        } else if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)) {
          provider = 'openai';
        } else if (voice.includes('Neural') && (voice.startsWith('en-US') || voice.startsWith('en-GB'))) {
          provider = 'google';
        } else if (voice.endsWith('Neural')) {
          provider = 'azure';
        } else if (['jennifer', 'marcus'].includes(voice) && !['Rohan', 'Elliot', 'Savannah'].includes(voice)) {
          provider = 'playht';
        }

        const { error: updateError } = await supabase
          .from('agents')
          .update({ voice_provider: provider })
          .eq('id', agent.id);

        if (updateError) {
          console.error(`   ❌ Failed to update agent ${agent.id}:`, updateError.message);
        } else {
          updated++;
        }
      }

      console.log(`   ✅ Updated ${updated}/${agents.length} agent(s)`);
    }

    // Step 4: Create index (via SQL if possible)
    console.log('\nStep 4: Creating index...');
    console.log('   ℹ️  Index creation requires manual SQL execution');
    console.log('   Run in SQL editor: CREATE INDEX IF NOT EXISTS idx_agents_voice_provider ON agents(voice_provider);');

    // Step 5: Show distribution
    console.log('\nStep 5: Voice provider distribution:');
    const { data: distribution } = await supabase
      .from('agents')
      .select('voice_provider')
      .not('voice_provider', 'is', null);

    if (distribution && distribution.length > 0) {
      const counts: Record<string, number> = {};
      distribution.forEach((a: any) => {
        counts[a.voice_provider] = (counts[a.voice_provider] || 0) + 1;
      });

      Object.entries(counts).forEach(([provider, count]) => {
        console.log(`   ${provider}: ${count} agent(s)`);
      });
    } else {
      console.log('   No agents with voice_provider set');
    }

    console.log('\n========================================');
    console.log('✅ Migration applied successfully!\n');
    console.log('⚠️  FINAL STEP: Create index manually via SQL editor:');
    console.log('   CREATE INDEX IF NOT EXISTS idx_agents_voice_provider ON agents(voice_provider);');
    console.log('   COMMENT ON COLUMN agents.voice_provider IS \'Voice provider: vapi, elevenlabs, openai, google, azure, playht, rime.\';');
    console.log('\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

applyMigrationDirect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
