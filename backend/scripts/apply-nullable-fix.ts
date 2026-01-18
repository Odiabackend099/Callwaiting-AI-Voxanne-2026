import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    console.log('🔧 Running migration: Make contact_id nullable...\n');

    // Use the SQL execution - connect directly to the Postgres API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;'
      })
    });

    const result = await response.json();
    console.log('Response:', result);

    if (!response.ok) {
      console.error('\n❌ Migration failed:', result.message);
      process.exit(1);
    }

    console.log('\n✅ Migration completed!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();
