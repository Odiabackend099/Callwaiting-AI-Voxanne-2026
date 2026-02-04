/**
 * Get full function definition to debug verification issue
 */

const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';

const data = JSON.stringify({
  query: "SELECT pg_get_functiondef(oid) as function_def FROM pg_proc WHERE proname = 'book_appointment_with_lock' LIMIT 1;"
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
      const functionDef = result[0]?.function_def || '';

      console.log('Full Function Definition:\n');
      console.log('='.repeat(80));
      console.log(functionDef);
      console.log('='.repeat(80));

      // Search for specific lines
      console.log('\n\nKey Lines Search:\n');

      const lines = functionDef.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('SELECT a.id')) {
          console.log(`Line ${index + 1}: ${line.trim()}`);
          if (lines[index + 1]) {
            console.log(`Line ${index + 2}: ${lines[index + 1].trim()}`);
          }
        }
        if (line.includes('INSERT INTO appointments')) {
          console.log(`Line ${index + 1}: ${line.trim()}`);
          for (let i = 1; i <= 10; i++) {
            if (lines[index + i]) {
              console.log(`Line ${index + i + 1}: ${lines[index + i].trim()}`);
            }
          }
        }
      });

    } catch (e) {
      console.log('Response:', body);
      console.error('Error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error);
});

req.write(data);
req.end();
