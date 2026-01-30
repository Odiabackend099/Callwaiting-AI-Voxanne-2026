#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkSchema() {
  console.log('🔍 Checking call_logs table schema...\n');

  // Get one record to see all columns
  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n⚠️  call_logs table might not exist yet');
    }
  }

  if (data) {
    console.log('✅ Found call_logs table with columns:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n📋 Column names:', Object.keys(data).join(', '));
  } else {
    console.log('⚠️  No data in call_logs table. Trying to see table structure...\n');

    // Try inserting minimal data to see what columns are required
    const testOrgId = '46cf2995-2bee-44e3-838b-24151486fe4e'; // Voxanne Demo Clinic
    const { error: insertError } = await supabase
      .from('call_logs')
      .insert({
        org_id: testOrgId,
        vapi_call_id: `test-schema-check-${Date.now()}`
      })
      .select();

    if (insertError) {
      console.log('Insert error reveals required schema:');
      console.log(insertError);
    }
  }
}

checkSchema().catch(console.error);
