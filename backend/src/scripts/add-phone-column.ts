/**
 * Add vapi_phone_number_id column to agents table
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function addColumn() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    console.log('📝 Adding vapi_phone_number_id column to agents table...\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      db: { schema: 'public' }
    });

    // Check if column already exists by trying to select it
    console.log('🔍 Checking if column exists...');
    const { error: checkError } = await supabase
      .from('agents')
      .select('vapi_phone_number_id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Column already exists!');
      return;
    }

    if (checkError && !checkError.message.includes('column') && !checkError.message.includes('schema cache')) {
      throw new Error(`Unexpected error checking column: ${checkError.message}`);
    }

    console.log('📝 Column does not exist, adding it now...\n');

    // Since we can't execute DDL directly via Supabase JS client,
    // we need to use the SQL editor in Supabase dashboard
    console.log('⚠️ Please run the following SQL in your Supabase SQL Editor:\n');
    console.log('─'.repeat(70));
    console.log(`
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_vapi_phone_number_id
ON agents(vapi_phone_number_id)
WHERE vapi_phone_number_id IS NOT NULL;

COMMENT ON COLUMN agents.vapi_phone_number_id IS 'VAPI phone number ID used as caller ID for outbound calls';
    `.trim());
    console.log('─'.repeat(70));
    console.log('\n📍 Go to: https://supabase.com/dashboard/project/[your-project]/sql/new');
    console.log('\n💡 Or use the migration file at: backend/migrations/20260126_add_vapi_phone_number_id_to_agents.sql');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

addColumn();
