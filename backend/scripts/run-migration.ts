import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('\n🔧 Running migration: Make contact_id nullable...\n');

    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;`
    }).select();

    if (error) {
      console.error('\n❌ Migration failed:');
      console.error('  Message:', error.message);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('   contact_id is now nullable in appointments table\n');

    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

runMigration();
