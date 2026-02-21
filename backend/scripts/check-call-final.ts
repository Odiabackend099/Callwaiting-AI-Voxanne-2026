import twilio from 'twilio';
import { EncryptionService } from '../src/services/encryption';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkCallStatus() {
  const callSid = process.argv[2] || 'CAcd74077fb4255f300c82994a4ea62358';

  const { data: subData } = await supabase
    .from('twilio_subaccounts')
    .select('twilio_account_sid, twilio_auth_token_encrypted')
    .eq('org_id', 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07')
    .eq('status', 'active')
    .single();

  if (!subData) { console.error('No subaccount'); return; }

  const authToken = EncryptionService.decrypt(subData.twilio_auth_token_encrypted);
  const subClient = twilio(subData.twilio_account_sid, authToken);

  const call = await subClient.calls(callSid).fetch();
  console.log('Call SID:', callSid);
  console.log('Status:', call.status);
  console.log('Duration:', call.duration, 'seconds');
  console.log('From:', call.from);
  console.log('To:', call.to);

  const notifs = await subClient.calls(callSid).notifications.list({ limit: 5 });
  if (notifs.length > 0) {
    console.log('');
    console.log('Notifications:');
    for (const n of notifs) {
      console.log('  Code:', n.errorCode);
      console.log('  Msg:', decodeURIComponent(n.messageText || '').substring(0, 200));
    }
  } else {
    console.log('No error notifications');
  }

  // Also check if the caller ID was registered
  try {
    const callerIds = await subClient.outgoingCallerIds.list({
      phoneNumber: '+2348141995397',
      limit: 1
    });
    if (callerIds.length > 0) {
      console.log('');
      console.log('CALLER ID VERIFIED!');
      console.log('  SID:', callerIds[0].sid);
      console.log('  Phone:', callerIds[0].phoneNumber);
      console.log('  Friendly Name:', callerIds[0].friendlyName);
    } else {
      console.log('');
      console.log('Caller ID not yet verified (user may not have answered or entered code)');
    }
  } catch (err: any) {
    console.log('Caller ID check error:', err.message);
  }
}

checkCallStatus().catch(console.error);
