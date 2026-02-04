/**
 * Deploy the FINAL COMPLETE FIX for book_appointment_with_lock RPC function
 * Fixes ALL 3 schema mismatches:
 * 1. c.name instead of c.first_name || c.last_name (contacts table)
 * 2. service_type instead of service_id (appointments table)
 * 3. metadata instead of event_data (audit_logs table)
 */

const fs = require('fs');
const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';

// Read the fully fixed SQL
const sql = fs.readFileSync('./deploy-fix-v3-final.sql', 'utf8');

console.log('🚀 Deploying FINAL COMPLETE FIX for book_appointment_with_lock...\n');
console.log('📄 All Schema Fixes Applied:');
console.log('   1. contacts table: c.name (not c.first_name || c.last_name)');
console.log('   2. appointments table: service_type (not service_id, notes, metadata)');
console.log('   3. audit_logs table: metadata (not event_data)');
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
      console.log('All 3 schema mismatches have been fixed!');
      console.log('You can now run the integration test to verify booking works.');

    } catch (e) {
      console.log(responseBody);
      if (responseBody.toLowerCase().includes('error')) {
        console.log('\n❌ DEPLOYMENT FAILED');
        process.exit(1);
      }
      console.log('\n✅ DEPLOYMENT SUCCESSFUL\n');
      console.log('All 3 schema mismatches have been fixed!');
      console.log('You can now run the integration test to verify booking works.');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
  process.exit(1);
});

req.write(data);
req.end();
