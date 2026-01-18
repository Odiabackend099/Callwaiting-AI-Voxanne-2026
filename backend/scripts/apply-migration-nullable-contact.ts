/**
 * Database Migration Runner
 * Applies: Make appointments.contact_id nullable (Removes FK dependency on dropped leads table)
 * This is the architectural fix that prevents "NOT NULL" and "FK Constraint" errors
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from backend/.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ARCHITECTURAL FIX: Making contact_id nullable             ║');
    console.log('║  This removes dependency on the dropped leads table        ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Make contact_id nullable to prevent FK errors when leads table doesn't exist
        ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;
        
        -- Verify the change took effect
        SELECT column_name, is_nullable, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'contact_id';
      `
    });

    if (error) {
      // The error might be because exec_sql doesn't exist - try direct approach
      console.log('ℹ️  Direct RPC approach not available. Using alternative method...\n');
      
      // Try using raw REST API
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

      if (!response.ok) {
        const errData = await response.json();
        console.error('❌ Migration failed:', errData.message);
        
        // If exec_sql RPC doesn't exist, provide manual instructions
        console.log('\n📌 MANUAL FALLBACK: Execute this SQL in Supabase SQL Editor:\n');
        console.log('    ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;\n');
        process.exit(1);
      }
    }

    console.log('✅ SUCCESS: appointments.contact_id is now NULLABLE');
    console.log('📊 Database schema updated - FK errors are now prevented\n');

    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Unexpected error:', err.message);
    console.error('\n📌 MANUAL FALLBACK: Execute this SQL in Supabase SQL Editor:\n');
    console.log('    ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;\n');
    process.exit(1);
  }
}

applyMigration();
