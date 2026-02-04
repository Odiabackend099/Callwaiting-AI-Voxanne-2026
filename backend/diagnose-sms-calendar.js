/**
 * DIAGNOSTIC SCRIPT: Check SMS & Calendar Credentials Health
 *
 * Investigates why SMS failed and Calendar health check is failing
 * for organization: 46cf2995-2bee-44e3-838b-24151486fe4e
 */

const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

console.log('🔍 PHASE 1: SMS AUTOPSY - WHY DID IT FAIL?\n');
console.log('=' .repeat(70));

// Step 1: Check if Twilio credentials exist for this org
console.log('\n[1/4] Checking if Twilio credentials exist in database...\n');

const twilioQuery = `
  SELECT
    id,
    org_id,
    provider,
    is_active,
    last_verified_at,
    verification_error,
    metadata
  FROM integrations
  WHERE org_id = '${ORG_ID}' AND provider = 'twilio';
`;

function runQuery(sql, description) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

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
          console.log(`${description} Result:\n`);
          if (Array.isArray(result) && result.length === 0) {
            console.log('  ❌ NO ROWS FOUND\n');
          } else if (Array.isArray(result)) {
            result.forEach((row, idx) => {
              console.log(`  Row ${idx + 1}:`);
              Object.entries(row).forEach(([key, value]) => {
                console.log(`    ${key}: ${JSON.stringify(value)}`);
              });
              console.log('');
            });
          } else {
            console.log('  Response:', JSON.stringify(result, null, 2));
            console.log('');
          }
          resolve(result);
        } catch (e) {
          console.log('  Raw response:', body);
          console.log('  Parse error:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('  ❌ Request failed:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    // Check Twilio credentials
    const twilioResult = await runQuery(twilioQuery, '[Twilio Credentials]');

    // Step 2: Check Google Calendar credentials
    console.log('\n[2/4] Checking if Google Calendar credentials exist...\n');

    const calendarQuery = `
      SELECT
        id,
        org_id,
        provider,
        is_active,
        last_verified_at,
        verification_error,
        metadata
      FROM integrations
      WHERE org_id = '${ORG_ID}' AND provider = 'google_calendar';
    `;

    const calendarResult = await runQuery(calendarQuery, '[Google Calendar Credentials]');

    // Step 3: Check if encrypted_config column exists and has data
    console.log('\n[3/4] Checking if credentials are encrypted in integrations table...\n');

    const encryptedCheck = `
      SELECT
        provider,
        encrypted_config IS NOT NULL as has_encrypted_config,
        length(encrypted_config::text) as encrypted_length
      FROM integrations
      WHERE org_id = '${ORG_ID}'
        AND provider IN ('twilio', 'google_calendar');
    `;

    await runQuery(encryptedCheck, '[Encryption Check]');

    // Step 4: Check audit_logs for recent SMS errors
    console.log('\n[4/4] Checking audit logs for recent SMS errors...\n');

    const auditQuery = `
      SELECT
        created_at,
        event_type,
        metadata
      FROM audit_logs
      WHERE org_id = '${ORG_ID}'
        AND event_type LIKE '%sms%'
      ORDER BY created_at DESC
      LIMIT 5;
    `;

    await runQuery(auditQuery, '[Recent SMS Audit Logs]');

    // Analysis
    console.log('\n' + '='.repeat(70));
    console.log('📊 DIAGNOSIS:\n');

    if (Array.isArray(twilioResult) && twilioResult.length === 0) {
      console.log('❌ ROOT CAUSE #1: NO TWILIO CREDENTIALS FOUND');
      console.log('   Fix: Add Twilio credentials via Agent Configuration UI');
      console.log('   Required fields: accountSid, authToken, phoneNumber');
      console.log('');
    } else if (Array.isArray(twilioResult) && twilioResult.length > 0) {
      const cred = twilioResult[0];
      if (!cred.is_active) {
        console.log('❌ ROOT CAUSE #1: TWILIO CREDENTIALS INACTIVE');
        console.log('   Fix: Verify credentials in Agent Configuration UI');
      } else if (cred.verification_error) {
        console.log('❌ ROOT CAUSE #1: TWILIO CREDENTIALS INVALID');
        console.log(`   Error: ${cred.verification_error}`);
        console.log('   Fix: Update credentials in Agent Configuration UI');
      } else {
        console.log('✅ Twilio credentials exist and are active');
        console.log('⚠️  SMS failure might be due to:');
        console.log('   - Twilio account balance ($0 remaining)');
        console.log('   - Phone number not verified in Twilio');
        console.log('   - Messaging Service SID not configured for international SMS');
      }
      console.log('');
    }

    if (Array.isArray(calendarResult) && calendarResult.length === 0) {
      console.log('❌ ROOT CAUSE #2: NO GOOGLE CALENDAR CREDENTIALS FOUND');
      console.log('   Fix: Connect Google Calendar via Agent Configuration UI');
      console.log('');
    } else if (Array.isArray(calendarResult) && calendarResult.length > 0) {
      const cred = calendarResult[0];
      if (!cred.is_active) {
        console.log('❌ ROOT CAUSE #2: GOOGLE CALENDAR CREDENTIALS INACTIVE');
      } else if (cred.verification_error) {
        console.log('❌ ROOT CAUSE #2: GOOGLE CALENDAR TOKEN EXPIRED');
        console.log(`   Error: ${cred.verification_error}`);
        console.log('   Fix: Token refresh logic needs to be implemented');
        console.log('   See: backend/src/services/integration-decryptor.ts line 789-846');
      } else {
        console.log('✅ Google Calendar credentials exist and are active');
        console.log('⚠️  Health check failure might be due to:');
        console.log('   - Access token expired (needs refresh)');
        console.log('   - Insufficient permissions (needs "calendar" scope)');
        console.log('   - Token refresh logic not implemented');
      }
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('\n✅ DIAGNOSTIC COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
})();
