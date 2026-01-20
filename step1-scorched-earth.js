#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏛️ OPERATION: FULL CIRCLE - STEP 1: SCORCHED EARTH');
console.log(`📍 Org ID: ${orgId}`);
console.log(`🌍 Supabase URL: ${supabaseUrl}`);
console.log('');

async function executeDatabaseWipe() {
  console.log('⚙️ Executing SQL Deletions...');
  console.log('---');
  
  const sqlQueries = `
-- Delete appointments for org
DELETE FROM appointments WHERE org_id = '${orgId}';

-- Delete leads for org
DELETE FROM leads WHERE org_id = '${orgId}';
  `;

  try {
    console.log('📝 SQL Queries:');
    console.log(sqlQueries);
    console.log('');
    
    // Use the direct REST API POST to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({ query: sqlQueries })
    });

    console.log(`📊 Response Status: ${response.status}`);
    const data = await response.text();
    console.log(`📊 Response Body: ${data}`);

    if (!response.ok) {
      console.error(`❌ SQL execution failed`);
      return false;
    }
    
    console.log(`✅ Database wipe completed successfully\n`);
    return true;
  } catch (err) {
    console.error('❌ Database wipe failed:', err.message);
    return false;
  }
}

executeDatabaseWipe();
