/**
 * DIAGNOSTIC SCRIPT v2: Check SMS & Calendar Credentials Health
 * FIXED: Uses actual integrations table schema
 */

const https = require('https');

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

console.log('🔍 PHASE 1: SMS AUTOPSY - WHY DID IT FAIL?\n');
console.log('='.repeat(70));

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
                if (key === 'encrypted_config') {
                  console.log(`    ${key}: [ENCRYPTED] (length: ${value ? value.length : 0})`);
                } else {
                  console.log(`    ${key}: ${JSON.stringify(value)}`);
                }
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
    console.log('\n[1/5] Checking if Twilio credentials exist...\n');

    const twilioQuery = `
      SELECT
        id,
        org_id,
        provider,
        connected,
        encrypted,
        last_checked_at,
        config,
        encrypted_config IS NOT NULL as has_encrypted_config,
        length(encrypted_config) as encrypted_length
      FROM integrations
      WHERE org_id = '${ORG_ID}' AND provider = 'twilio';
    `;

    const twilioResult = await runQuery(twilioQuery, '[Twilio Credentials]');

    // Check Google Calendar credentials
    console.log('\n[2/5] Checking if Google Calendar credentials exist...\n');

    const calendarQuery = `
      SELECT
        id,
        org_id,
        provider,
        connected,
        encrypted,
        last_checked_at,
        config,
        encrypted_config IS NOT NULL as has_encrypted_config,
        length(encrypted_config) as encrypted_length
      FROM integrations
      WHERE org_id = '${ORG_ID}' AND provider = 'google_calendar';
    `;

    const calendarResult = await runQuery(calendarQuery, '[Google Calendar Credentials]');

    // Check all integrations for this org
    console.log('\n[3/5] Listing ALL integrations for this org...\n');

    const allIntegrationsQuery = `
      SELECT
        provider,
        connected,
        encrypted,
        last_checked_at,
        encrypted_config IS NOT NULL as has_credentials
      FROM integrations
      WHERE org_id = '${ORG_ID}'
      ORDER BY provider;
    `;

    await runQuery(allIntegrationsQuery, '[All Integrations]');

    // Check organization details
    console.log('\n[4/5] Checking organization details...\n');

    const orgQuery = `
      SELECT
        id,
        email,
        name,
        created_at,
        phone_number
      FROM organizations
      WHERE id = '${ORG_ID}';
    `;

    const orgResult = await runQuery(orgQuery, '[Organization]');

    // Check recent appointments (to see if booking succeeded)
    console.log('\n[5/5] Checking recent appointments...\n');

    const appointmentsQuery = `
      SELECT
        id,
        org_id,
        contact_id,
        scheduled_at,
        status,
        service_type,
        created_at
      FROM appointments
      WHERE org_id = '${ORG_ID}'
      ORDER BY created_at DESC
      LIMIT 3;
    `;

    await runQuery(appointmentsQuery, '[Recent Appointments]');

    // Analysis
    console.log('\n' + '='.repeat(70));
    console.log('📊 DIAGNOSIS:\n');

    let twilioExists = false;
    let twilioConnected = false;
    let calendarExists = false;
    let calendarConnected = false;

    if (Array.isArray(twilioResult) && twilioResult.length > 0) {
      twilioExists = true;
      twilioConnected = twilioResult[0].connected;
      console.log('✅ Twilio credentials FOUND in database');
      console.log(`   Connected: ${twilioConnected}`);
      console.log(`   Encrypted: ${twilioResult[0].encrypted}`);
      console.log(`   Has encrypted_config: ${twilioResult[0].has_encrypted_config}`);
      console.log(`   Encrypted length: ${twilioResult[0].encrypted_length} chars`);
      console.log('');
    } else {
      console.log('❌ ROOT CAUSE #1: NO TWILIO CREDENTIALS');
      console.log('   SMS cannot be sent without Twilio credentials');
      console.log('   Fix: Add Twilio credentials via Agent Configuration UI');
      console.log('   Required: accountSid, authToken, phoneNumber');
      console.log('');
    }

    if (Array.isArray(calendarResult) && calendarResult.length > 0) {
      calendarExists = true;
      calendarConnected = calendarResult[0].connected;
      console.log('✅ Google Calendar credentials FOUND in database');
      console.log(`   Connected: ${calendarConnected}`);
      console.log(`   Encrypted: ${calendarResult[0].encrypted}`);
      console.log(`   Has encrypted_config: ${calendarResult[0].has_encrypted_config}`);
      console.log(`   Encrypted length: ${calendarResult[0].encrypted_length} chars`);
      console.log('');

      if (!calendarConnected) {
        console.log('⚠️  PROBLEM: Calendar credentials exist but connected=false');
        console.log('   This could mean:');
        console.log('   - OAuth token expired');
        console.log('   - Token refresh failed');
        console.log('   - Last health check failed');
        console.log('');
      }
    } else {
      console.log('⚠️  Google Calendar credentials NOT FOUND');
      console.log('   However, PRD says calendar IS configured');
      console.log('   This is inconsistent - needs investigation');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('\n🎯 ACTION ITEMS:\n');

    if (!twilioExists) {
      console.log('1. Add Twilio credentials to integrations table');
      console.log('   INSERT INTO integrations (org_id, provider, encrypted_config, connected, encrypted)');
      console.log(`   VALUES ('${ORG_ID}', 'twilio', '<encrypted>', true, true);`);
      console.log('');
    } else if (!twilioConnected) {
      console.log('1. Fix Twilio connection status');
      console.log('   - Verify credentials are valid');
      console.log('   - Run health check to update connected=true');
      console.log('');
    } else {
      console.log('1. Test SMS sending manually with existing credentials');
      console.log('   - Create test-sms-direct.js script');
      console.log('   - Decrypt credentials and attempt SMS');
      console.log('   - Check Twilio error code (21608, 20003, etc.)');
      console.log('');
    }

    if (!calendarExists) {
      console.log('2. Investigate missing calendar credentials');
      console.log('   - PRD says calendar IS configured');
      console.log('   - Event ID hvfi32jlj9hnafmn0bai83b39s exists');
      console.log('   - Credentials might be in different table?');
      console.log('');
    } else if (!calendarConnected) {
      console.log('2. Fix Google Calendar token refresh');
      console.log('   - Implement refresh logic in integration-decryptor.ts');
      console.log('   - Catch 401 errors and refresh access token');
      console.log('   - Update integrations table with new token');
      console.log('');
    } else {
      console.log('2. Calendar credentials look good');
      console.log('   - Health check might still fail due to API call issue');
      console.log('   - Check validateGoogleCalendarHealth() logs');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('\n✅ DIAGNOSTIC COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
})();
