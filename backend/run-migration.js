const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = `
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS vapi_assistant_id_outbound TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id_outbound 
ON agents(vapi_assistant_id_outbound);
`;

async function runMigration() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runMigration();
