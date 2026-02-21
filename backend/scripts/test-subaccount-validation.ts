import twilio from 'twilio';
import { EncryptionService } from '../src/services/encryption';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testSubaccountValidation() {
  const orgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
  const phoneNumber = '+2348141995397';

  // Get subaccount credentials
  const { data: subData } = await supabase
    .from('twilio_subaccounts')
    .select('twilio_account_sid, twilio_auth_token_encrypted')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .single();

  if (!subData) {
    console.error('No subaccount found');
    return;
  }

  const authToken = EncryptionService.decrypt(subData.twilio_auth_token_encrypted);
  const subClient = twilio(subData.twilio_account_sid, authToken);

  console.log('=== SUBACCOUNT VALIDATION TEST ===');
  console.log('Sub SID:', subData.twilio_account_sid);
  console.log('');

  // Check inheritance and Nigeria permissions
  const settings = await subClient.voice.v1.dialingPermissions.settings().fetch();
  console.log('Inheritance enabled:', settings.dialingPermissionsInheritance);

  const ng = await subClient.voice.v1.dialingPermissions.countries('NG').fetch();
  console.log('Nigeria Low Risk:', ng.lowRiskNumbersEnabled);
  console.log('Nigeria High Risk Special:', ng.highRiskSpecialNumbersEnabled);
  console.log('');

  // Initiate validation call
  console.log('Initiating validation call to', phoneNumber, '...');
  console.log('');

  try {
    const validation = await subClient.validationRequests.create({
      phoneNumber,
      friendlyName: 'Austin Nigeria'
    });

    console.log('Validation Code:', validation.validationCode);
    console.log('Call SID:', validation.callSid);
    console.log('');
    console.log('ANSWER YOUR PHONE and enter the code when prompted.');
    console.log('');
    console.log('Waiting 20 seconds to check call status...');

    await new Promise(resolve => setTimeout(resolve, 20000));

    if (validation.callSid) {
      const call = await subClient.calls(validation.callSid).fetch();
      console.log('');
      console.log('=== CALL STATUS ===');
      console.log('Status:', call.status);
      console.log('Duration:', call.duration, 'seconds');
      console.log('From:', call.from);
      console.log('To:', call.to);

      // Check for errors
      const notifications = await subClient.calls(validation.callSid).notifications.list({ limit: 5 });
      if (notifications.length > 0) {
        console.log('');
        console.log('Error Notifications:');
        for (let i = 0; i < notifications.length; i++) {
          const n = notifications[i];
          console.log('  [' + i + '] Code:', n.errorCode);
          console.log('  [' + i + '] Msg:', decodeURIComponent(n.messageText || '').substring(0, 200));
        }
      } else {
        console.log('');
        console.log('No error notifications (this is good)');
      }

      if (call.status === 'completed' && parseInt(call.duration || '0') > 0) {
        console.log('');
        console.log('=== CALL COMPLETED WITH DURATION ===');
        console.log('The phone rang and was answered.');
      } else if (call.status === 'ringing' || call.status === 'in-progress') {
        console.log('');
        console.log('=== CALL IS STILL ACTIVE ===');
        console.log('The phone should be ringing or connected right now!');
      } else if (call.status === 'no-answer') {
        console.log('');
        console.log('=== NO ANSWER ===');
        console.log('The call was placed but nobody answered.');
        console.log('Check if the phone actually rang.');
      } else if (call.status === 'busy') {
        console.log('');
        console.log('=== BUSY ===');
        console.log('The carrier returned a busy signal.');
      } else if (call.status === 'failed') {
        console.log('');
        console.log('=== CALL FAILED ===');
        console.log('Check error notifications above.');
      }
    }
  } catch (err: any) {
    console.error('Validation Error:', err.message);
    console.error('Error Code:', err.code);
  }
}

testSubaccountValidation().catch(console.error);
