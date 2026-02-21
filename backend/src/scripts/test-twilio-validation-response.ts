/**
 * Test what Twilio validationRequests.create() actually returns
 */

import twilio from 'twilio';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testTwilioResponse() {
  // These are placeholder credentials - replace with actual ones from env
  const accountSid = process.env.TWILIO_ACCOUNT_SID || 'test';
  const authToken = process.env.TWILIO_AUTH_TOKEN || 'test';

  const client = twilio(accountSid, authToken);

  try {
    console.log('Creating validation request...\n');

    const validation = await client.validationRequests.create({
      phoneNumber: '+2348141995397',
      friendlyName: 'Test Verification'
    });

    console.log('✅ Full Twilio Response:');
    console.log(JSON.stringify(validation, null, 2));

    console.log('\n📋 Available Fields:');
    console.log('- validation.accountSid:', validation.accountSid);
    console.log('- validation.phoneNumber:', validation.phoneNumber);
    console.log('- validation.friendlyName:', validation.friendlyName);
    console.log('- validation.validationCode:', validation.validationCode);
    console.log('- validation.callSid:', validation.callSid);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testTwilioResponse();
