/**
 * FIX #1: Change provider name from 'TWILIO' to 'twilio' for case-sensitive match
 */

const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

console.log('🔧 FIX #1: Fixing SMS provider name case mismatch\n');
console.log('='.repeat(70));

const fixQuery = `
UPDATE integrations
SET provider = 'twilio'
WHERE org_id = '${ORG_ID}'
  AND provider = 'TWILIO';
`;

const data = JSON.stringify({ query: fixQuery });

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
      console.log('Update Result:\n');
      console.log(JSON.stringify(result, null, 2));
      console.log('');

      if (result && !result.message?.includes('error')) {
        console.log('✅ SUCCESS: Provider name fixed from TWILIO → twilio\n');
        console.log('Verifying fix...\n');

        // Verify the fix
        const verifyQuery = `
          SELECT provider, connected, encrypted_config IS NOT NULL as has_creds
          FROM integrations
          WHERE org_id = '${ORG_ID}' AND provider = 'twilio';
        `;

        const verifyData = JSON.stringify({ query: verifyQuery });
        const verifyReq = https.request({...options, headers: {...options.headers, 'Content-Length': verifyData.length}}, (verifyRes) => {
          let verifyBody = '';
          verifyRes.on('data', (chunk) => { verifyBody += chunk; });
          verifyRes.on('end', () => {
            try {
              const verifyResult = JSON.parse(verifyBody);
              console.log('Verification Result:\n');
              console.log(JSON.stringify(verifyResult, null, 2));
              console.log('');

              if (Array.isArray(verifyResult) && verifyResult.length > 0) {
                console.log('✅ VERIFIED: Twilio credentials now queryable with lowercase "twilio"\n');
                console.log('='.repeat(70));
                console.log('\n🎉 Fix #1 COMPLETE - SMS should now work!\n');
              } else {
                console.log('⚠️  WARNING: Verification query returned 0 rows\n');
              }
            } catch (e) {
              console.log('Verify response:', verifyBody);
            }
          });
        });
        verifyReq.write(verifyData);
        verifyReq.end();

      } else {
        console.log('❌ FAILED: Error updating provider name\n');
        process.exit(1);
      }
    } catch (e) {
      console.log('Raw response:', body);
      console.log('Parse error:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
  process.exit(1);
});

req.write(data);
req.end();
