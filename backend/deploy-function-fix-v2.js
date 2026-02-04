/**
 * Deploy the FULLY FIXED book_appointment_with_lock RPC function
 * Fixes:
 * 1. c.name instead of c.first_name || c.last_name
 * 2. service_type instead of service_id (matching actual table schema)
 * 3. Removed notes and metadata from INSERT (columns don't exist)
 */

const fs = require('fs');
const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';

// Read the fully fixed SQL
const sql = fs.readFileSync('./deploy-fix-v2.sql', 'utf8');

console.log('🚀 Deploying FULLY FIXED book_appointment_with_lock RPC function...\n');
console.log('📄 Fixes Applied:');
console.log('   1. Line 39: SELECT a.id, a.scheduled_at, c.name');
console.log('      (Fixed from: c.first_name || \' \' || c.last_name)');
console.log('   2. Lines 56-65: INSERT uses service_type (not service_id)');
console.log('   3. Removed notes and metadata from INSERT (columns don\'t exist)');
console.log('');

// Prepare the request
const data = JSON.stringify({
  query: sql
});

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

// Execute deployment
const req = https.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log('📥 Response:');
    try {
      const parsed = JSON.parse(responseBody);
      console.log(JSON.stringify(parsed, null, 2));

      // Check for errors
      if (parsed.message && parsed.message.toLowerCase().includes('error')) {
        console.log('\n❌ DEPLOYMENT FAILED');
        console.log('Error:', parsed.message);
        process.exit(1);
      }

      console.log('\n✅ DEPLOYMENT SUCCESSFUL\n');

      // Verify the fix
      verifyFix();
    } catch (e) {
      console.log(responseBody);
      if (responseBody.toLowerCase().includes('error')) {
        console.log('\n❌ DEPLOYMENT FAILED');
        process.exit(1);
      }
      console.log('\n✅ DEPLOYMENT SUCCESSFUL (empty response is OK)\n');
      verifyFix();
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
  process.exit(1);
});

req.write(data);
req.end();

// Verification function
function verifyFix() {
  console.log('🔍 Verifying function contains all fixes...\n');

  const verifyData = JSON.stringify({
    query: "SELECT pg_get_functiondef(oid) as function_def FROM pg_proc WHERE proname = 'book_appointment_with_lock' LIMIT 1;"
  });

  const verifyOptions = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': verifyData.length
    }
  };

  const verifyReq = https.request(verifyOptions, (res) => {
    let body = '';

    res.on('data', (chunk) => { body += chunk; });

    res.on('end', () => {
      try {
        const result = JSON.parse(body);
        const functionDef = result[0]?.function_def || '';

        let allFixesApplied = true;

        // Check Fix 1: c.name instead of c.first_name
        if (functionDef.includes('c.name') && !functionDef.includes('c.first_name')) {
          console.log('✅ Fix 1: c.name (not c.first_name) - VERIFIED');
        } else {
          console.log('❌ Fix 1: c.name - FAILED');
          allFixesApplied = false;
        }

        // Check Fix 2: service_type in INSERT
        if (functionDef.includes('service_type,') && !functionDef.includes('service_id,')) {
          console.log('✅ Fix 2: service_type (not service_id) - VERIFIED');
        } else {
          console.log('❌ Fix 2: service_type - FAILED');
          allFixesApplied = false;
        }

        // Check Fix 3: No notes/metadata in INSERT
        const insertMatch = functionDef.match(/INSERT INTO appointments.*?\)/s);
        if (insertMatch && !insertMatch[0].includes('notes') && !insertMatch[0].includes('metadata')) {
          console.log('✅ Fix 3: No notes/metadata columns - VERIFIED');
        } else {
          console.log('❌ Fix 3: notes/metadata removed - FAILED');
          allFixesApplied = false;
        }

        console.log('');

        if (allFixesApplied) {
          console.log('✅ ALL FIXES VERIFIED - Function ready for testing');
        } else {
          console.log('❌ SOME FIXES MISSING - Function may still have issues');
          process.exit(1);
        }

      } catch (e) {
        console.log('⚠️  Could not parse verification response');
        console.log('Error:', e.message);
      }
    });
  });

  verifyReq.on('error', (error) => {
    console.error('⚠️  Verification request failed:', error);
  });

  verifyReq.write(verifyData);
  verifyReq.end();
}
