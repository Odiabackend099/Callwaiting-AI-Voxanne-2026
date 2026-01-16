#!/usr/bin/env node
/**
 * Reload Supabase PostgREST Schema Cache
 * Fixes: "Could not find table 'public.org_credentials' in the schema cache"
 */

const https = require('https');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function fixSchemaCache() {
  console.log('🔄 Reloading Supabase PostgREST Schema Cache\n');
  
  try {
    // Step 1: Call RPC to reload schema
    console.log('Step 1: Executing SELECT reload_schema_cache()...');
    const rpcRes = await makeRequest('/rest/v1/rpc/reload_schema_cache', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' }
    });
    
    console.log(`  Status: ${rpcRes.status}`);
    console.log(`  Response: ${JSON.stringify(rpcRes.body)}\n`);
    
    if (rpcRes.status === 200 || rpcRes.status === 201) {
      console.log('✅ Schema cache reloaded successfully\n');
    } else {
      console.log('⚠️  Status unclear, but continuing...\n');
    }
    
    // Step 2: Test if table is now accessible
    console.log('Step 2: Testing org_credentials table access...');
    const testRes = await makeRequest('/rest/v1/org_credentials?select=org_id,provider,is_active&limit=1', {
      headers: { 'Prefer': 'count=exact' }
    });
    
    console.log(`  Status: ${testRes.status}`);
    
    if (testRes.status === 200) {
      console.log(`  ✅ Table is now accessible`);
      console.log(`  Data: ${JSON.stringify(testRes.body, null, 2)}\n`);
      console.log('🎉 Schema cache fixed! org_credentials table is now accessible.\n');
    } else if (testRes.body.message && testRes.body.message.includes('schema cache')) {
      console.log(`  ❌ Still getting schema cache error. This may be a Supabase issue.`);
      console.log(`  Message: ${testRes.body.message}\n`);
      console.log('⚠️  Try these steps:');
      console.log('  1. Go to Supabase dashboard: https://app.supabase.com');
      console.log('  2. Open your project');
      console.log('  3. Go to SQL Editor');
      console.log('  4. Run: SELECT reload_schema_cache();');
      console.log('  5. Wait 30 seconds and refresh');
    } else {
      console.log(`  ❌ Error: ${testRes.body.message}\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nManual Fix Instructions:');
    console.error('1. Open Supabase Dashboard: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/editor');
    console.error('2. Click "SQL Editor" in left sidebar');
    console.error('3. Click "New Query"');
    console.error('4. Paste: SELECT reload_schema_cache();');
    console.error('5. Click "RUN"');
    console.error('6. Wait 30 seconds');
    console.error('7. Re-run this script to verify');
  }
}

fixSchemaCache();
