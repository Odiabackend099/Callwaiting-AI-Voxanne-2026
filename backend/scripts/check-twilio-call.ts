import twilio from 'twilio';
import { IntegrationDecryptor } from '../src/services/integration-decryptor';

async function checkTwilioCall() {
  const orgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
  const callSid = 'CAf31728e58e45094405db0fcc281d92a6';

  console.log('Getting Twilio credentials for org...');
  const credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);

  if (!credentials) {
    console.error('No Twilio credentials found');
    return;
  }

  console.log('Using Account SID:', credentials.accountSid);
  console.log('\nQuerying Twilio API for call SID:', callSid);

  const twilioClient = twilio(credentials.accountSid, credentials.authToken);

  try {
    const call = await twilioClient.calls(callSid).fetch();

    console.log('\n========== TWILIO CALL DETAILS ==========');
    console.log('Call SID:', call.sid);
    console.log('Status:', call.status);
    console.log('From:', call.from);
    console.log('To:', call.to);
    console.log('Direction:', call.direction);
    console.log('Price:', call.price || 'N/A', call.priceUnit || '');
    console.log('Duration:', call.duration, 'seconds');
    console.log('Start Time:', call.startTime);
    console.log('End Time:', call.endTime);
    console.log('Answered By:', call.answeredBy || 'N/A');

    if (call.errorCode) {
      console.log('\n⚠️  ERROR DETECTED ⚠️');
      console.log('Error Code:', call.errorCode);
      console.log('Error Message:', call.errorMessage);
    }

    console.log('\n========== INTERPRETATION ==========');
    if (call.status === 'completed' && call.duration > 0) {
      console.log('✅ Call was answered and connected for', call.duration, 'seconds');
    } else if (call.status === 'no-answer') {
      console.log('📞 Call rang but was not answered');
    } else if (call.status === 'busy') {
      console.log('📞 Line was busy');
    } else if (call.status === 'failed') {
      console.log('❌ Call failed - see error code above');
    } else if (call.status === 'canceled') {
      console.log('🚫 Call was canceled');
    } else {
      console.log('Status:', call.status);
    }

    // Check for Twilio Geo Permissions issues
    if (call.errorCode === '21217') {
      console.log('\n⚠️  GEO PERMISSIONS ISSUE DETECTED');
      console.log('Your Twilio account does not have permission to call Nigeria (+234)');
      console.log('To fix: https://console.twilio.com/us1/develop/voice/settings/geo-permissions');
    }

  } catch (error: any) {
    console.error('\n❌ Error fetching call from Twilio:', error.message);
    if (error.code === 20404) {
      console.error('Call SID not found - this should not happen if the call was initiated');
    }
  }
}

checkTwilioCall();
