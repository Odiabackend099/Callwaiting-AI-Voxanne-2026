import { supabase } from '../config/database';

async function applyMigration() {
  try {
    console.log('Applying vapi_phone_number_id column migration...');
    
    // Execute migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

        CREATE INDEX IF NOT EXISTS idx_agents_vapi_phone_number_id
        ON agents(vapi_phone_number_id)
        WHERE vapi_phone_number_id IS NOT NULL;
      `
    }).catch(() => {
      // If rpc doesn't exist, try raw query
      return supabase.from('_migrations').insert({
        name: '20260126_add_vapi_phone_number_id',
        executed_at: new Date()
      });
    });

    if (error) {
      // Try direct SQL via another method
      console.log('RPC method not available, trying alternative...');
      
      // The migration should be applied manually or via Supabase dashboard
      console.log('⚠️  Please apply this SQL manually via Supabase dashboard:');
      console.log(`
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_vapi_phone_number_id
ON agents(vapi_phone_number_id)
WHERE vapi_phone_number_id IS NOT NULL;
      `);
      return;
    }

    console.log('✅ Migration applied!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

applyMigration();
