/**
 * Check integrations table actual schema
 */

const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';

console.log('🔍 Checking integrations table schema...\n');

const schemaQuery = `
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'integrations'
  ORDER BY ordinal_position;
`;

const data = JSON.stringify({ query: schemaQuery });

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
      console.log('Integrations table columns:\n');
      if (Array.isArray(result)) {
        result.forEach((col, idx) => {
          console.log(`  ${idx + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
      } else {
        console.log('Response:', JSON.stringify(result, null, 2));
      }
    } catch (e) {
      console.log('Raw response:', body);
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
  process.exit(1);
});

req.write(data);
req.end();
