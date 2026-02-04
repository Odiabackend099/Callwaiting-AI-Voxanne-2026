/**
 * Check audit_logs table schema
 */

const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';

console.log('🔍 Checking audit_logs table schema...\n');

const data = JSON.stringify({
  query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position;"
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

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    try {
      const result = JSON.parse(body);

      if (result.length === 0) {
        console.log('❌ audit_logs table does NOT exist\n');
        console.log('The RPC function tries to INSERT into audit_logs but the table doesn\'t exist.');
        console.log('This can be fixed by either:');
        console.log('  1. Creating the audit_logs table');
        console.log('  2. Removing the audit_logs INSERT from the RPC function');
        return;
      }

      console.log('Audit_logs table columns:\n');
      result.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.column_name} (${row.data_type})`);
      });

      console.log('\n');

      // Check for specific columns
      const columnNames = result.map(r => r.column_name);
      const requiredColumns = ['event_data', 'event_type'];

      console.log('RPC function expects these columns:');
      requiredColumns.forEach(col => {
        if (columnNames.includes(col)) {
          console.log(`  ✅ ${col} - EXISTS`);
        } else {
          console.log(`  ❌ ${col} - MISSING`);
        }
      });

    } catch (e) {
      console.log('Response:', body);
      console.error('Error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(data);
req.end();
