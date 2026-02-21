import twilio from 'twilio';
import { IntegrationDecryptor } from '../src/services/integration-decryptor';
import dotenv from 'dotenv';

dotenv.config();

async function checkGeoPermissions() {
  const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID!;
  const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN!;

  console.log('=== MASTER ACCOUNT ===');
  console.log('Master SID:', masterSid);
  console.log('');

  const masterClient = twilio(masterSid, masterToken);

  try {
    const masterNG = await masterClient.voice.v1.dialingPermissions
      .countries('NG')
      .fetch();

    console.log('MASTER - Nigeria Geo Permissions:');
    console.log('  Low Risk Enabled:', masterNG.lowRiskNumbersEnabled);
    console.log('  High Risk Special:', masterNG.highRiskSpecialNumbersEnabled);
    console.log('  High Risk Tollfraud:', masterNG.highRiskTollfraudNumbersEnabled);
  } catch (err: any) {
    console.log('MASTER - Error:', err.message);
  }

  console.log('');
  console.log('=== SUBACCOUNT ===');

  const creds = await IntegrationDecryptor.getEffectiveTwilioCredentials('ad9306a9-4d8a-4685-a667-cbeb7eb01a07');
  if (!creds) {
    console.error('No credentials found');
    return;
  }

  console.log('Sub SID:', creds.accountSid);
  console.log('');

  const subClient = twilio(creds.accountSid, creds.authToken);

  try {
    const subNG = await subClient.voice.v1.dialingPermissions
      .countries('NG')
      .fetch();

    console.log('SUBACCOUNT - Nigeria Geo Permissions:');
    console.log('  Low Risk Enabled:', subNG.lowRiskNumbersEnabled);
    console.log('  High Risk Special:', subNG.highRiskSpecialNumbersEnabled);
    console.log('  High Risk Tollfraud:', subNG.highRiskTollfraudNumbersEnabled);
  } catch (err: any) {
    console.log('SUBACCOUNT - Error:', err.message);
  }

  // Also check the SECOND call status
  console.log('');
  console.log('=== SECOND CALL STATUS (after you enabled Geo Perms) ===');
  const callSid = 'CAbbcc3f4dab7e78de83277c9ec96620ea';

  try {
    const call = await subClient.calls(callSid).fetch();
    console.log('Call SID:', call.sid);
    console.log('Status:', call.status);
    console.log('Duration:', call.duration, 'seconds');
    console.log('From:', call.from);
    console.log('To:', call.to);

    // Check events/notifications for error details
    const notifications = await subClient.calls(callSid).notifications.list({ limit: 5 });
    if (notifications.length > 0) {
      console.log('');
      console.log('Notifications:');
      notifications.forEach((n, i) => {
        console.log(`  [${i}] Error Code: ${n.errorCode}`);
        console.log(`  [${i}] Message: ${decodeURIComponent(n.messageText || '').substring(0, 200)}`);
      });
    } else {
      console.log('No error notifications found');
    }

    // Check events
    const events = await subClient.calls(callSid).events.list({ limit: 5 });
    if (events.length > 0) {
      console.log('');
      console.log('Events:');
      events.forEach((e, i) => {
        const params = (e as any).request?.parameters || {};
        console.log(`  [${i}] Status: ${params.call_status}`);
        console.log(`  [${i}] Duration: ${params.duration}`);
        if (params.error_code) {
          console.log(`  [${i}] Error: ${params.error_code} - ${params.error_message}`);
        }
      });
    }
  } catch (err: any) {
    console.log('Call fetch error:', err.message);
  }
}

checkGeoPermissions();
