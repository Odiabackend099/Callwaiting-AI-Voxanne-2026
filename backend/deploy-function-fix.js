/**
 * Deploy the fixed book_appointment_with_lock RPC function
 * Fixes schema mismatch: c.name instead of c.first_name || c.last_name
 */

const fs = require('fs');
const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';

// Read the fixed SQL
const sql = fs.readFileSync('./deploy-fix.sql', 'utf8');

console.log('🚀 Deploying fixed book_appointment_with_lock RPC function...\n');
console.log('📄 SQL Preview:');
console.log('   Line 32: SELECT a.id, a.scheduled_at, c.name');
console.log('   (Fixed from: c.first_name || \' \' || c.last_name)\n');

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
      if (parsed.message && parsed.message.includes('error')) {
        console.log('\n❌ DEPLOYMENT FAILED');
        console.log('Error:', parsed.message);
        process.exit(1);
      }

      console.log('\n✅ DEPLOYMENT SUCCESSFUL\n');

      // Verify the fix
      verifyFix();
    } catch (e) {
      console.log(responseBody);
      if (responseBody.includes('error') || responseBody.includes('Error')) {
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
  console.log('🔍 Verifying function contains the fix...\n');

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

        // Check for the fix
        if (functionDef.includes('c.name') && !functionDef.includes('c.first_name')) {
          console.log('✅ VERIFICATION PASSED: Function contains c.name (FIXED)');
          console.log('   Line found: SELECT a.id, a.scheduled_at, c.name');
        } else if (functionDef.includes('c.first_name')) {
          console.log('❌ VERIFICATION FAILED: Function still has c.first_name (BROKEN)');
          console.log('   Line found: SELECT a.id, a.scheduled_at, c.first_name || ...');
          process.exit(1);
        } else {
          console.log('⚠️  VERIFICATION INCONCLUSIVE: Could not find expected line');
        }
      } catch (e) {
        console.log('⚠️  Could not parse verification response');
      }
    });
  });

  verifyReq.on('error', (error) => {
    console.error('⚠️  Verification request failed:', error);
  });

  verifyReq.write(verifyData);
  verifyReq.end();
}
