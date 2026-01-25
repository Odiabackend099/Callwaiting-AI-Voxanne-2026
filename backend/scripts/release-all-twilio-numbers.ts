import { IntegrationDecryptor } from '../src/services/integration-decryptor';
import { supabase } from '../src/services/supabase-client';
import twilio from 'twilio';

async function releaseAllTwilioNumbers() {
  // Step 1: Get all organizations with Twilio credentials
  const { data: orgsWithTwilio, error } = await supabase
    .from('integrations')
    .select('org_id')
    .eq('provider', 'twilio');

  if (error) {
    console.error('Database error:', error);
    process.exit(1);
  }

  if (!orgsWithTwilio || orgsWithTwilio.length === 0) {
    console.log('No organizations with Twilio credentials found');
    return;
  }

  for (const { org_id } of orgsWithTwilio) {
    try {
      // Step 2: Get Twilio credentials
      const creds = await IntegrationDecryptor.getCredentials(org_id, 'twilio');
      if (!creds) {
        console.log(`No Twilio credentials for org ${org_id}`);
        continue;
      }

      const { account_sid, auth_token } = creds;

      // Step 3: Release numbers
      const client = twilio(account_sid, auth_token);
      const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });

      for (const number of numbers) {
        await client.incomingPhoneNumbers(number.sid).remove();
        console.log(`Released number ${number.phoneNumber} for org ${org_id}`);
      }
    } catch (err) {
      console.error(`Error processing org ${org_id}:`, err);
    }
  }
}

releaseAllTwilioNumbers();
