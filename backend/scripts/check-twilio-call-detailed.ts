import twilio from 'twilio';
import { IntegrationDecryptor } from '../src/services/integration-decryptor';

async function checkTwilioCallDetailed() {
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

    console.log('\n========== FULL CALL OBJECT ==========');
    console.log(JSON.stringify(call, null, 2));

  } catch (error: any) {
    console.error('\n❌ Error fetching call from Twilio:', error.message);
  }
}

checkTwilioCallDetailed();
