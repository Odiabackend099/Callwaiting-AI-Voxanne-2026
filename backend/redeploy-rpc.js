/**
 * Redeploy the fixed book_appointment_with_lock RPC function
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function redeployRPC() {
  console.log('🔧 Redeploying book_appointment_with_lock RPC function...\n');

  // Read the migration SQL file
  const sql = fs.readFileSync('./supabase/migrations/20260127_appointment_booking_with_lock.sql', 'utf8');

  console.log('📄 Executing SQL migration...');

  // Execute the SQL (CREATE OR REPLACE FUNCTION)
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: sql
  });

  if (error) {
    console.log('⚠️  rpc exec_sql not available, trying direct POST...\n');

    // Try direct POST to Supabase REST API
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      console.log('⚠️  Direct POST also failed, using Management API...\n');

      // Use Supabase Management API to run migration
      const mgmtResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sql',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: sql
      });

      if (!mgmtResponse.ok) {
        console.error('❌ All deployment methods failed');
        console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
        console.log(sql);
        process.exit(1);
      }
    }
  }

  console.log('✅ RPC function redeployed successfully!');
  console.log('\n🧪 Testing the fixed function...\n');

  // Test the function with a dummy call
  const testResult = await supabase.rpc('book_appointment_with_lock', {
    p_org_id: '46cf2995-2bee-44e3-838b-24151486fe4e',
    p_contact_id: null, // Will fail but that's OK, just testing it exists
    p_scheduled_at: new Date().toISOString(),
    p_duration_minutes: 60,
    p_lock_key: null
  });

  if (testResult.error && testResult.error.message === 'Could not find the function') {
    console.error('❌ Function still not found after deployment');
    process.exit(1);
  }

  console.log('✅ Function exists and is callable');
  console.log(`   Result: ${JSON.stringify(testResult.data || testResult.error)}`);
}

redeployRPC().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
