import twilio from 'twilio';
import { IntegrationDecryptor } from '../src/services/integration-decryptor';

async function checkTwilioEvents() {
  const orgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
  const callSid = 'CAf31728e58e45094405db0fcc281d92a6';

  console.log('Getting Twilio credentials for org...');
  const credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);

  if (!credentials) {
    console.error('No Twilio credentials found');
    return;
  }

  console.log('Using Account SID:', credentials.accountSid);
  console.log('\nQuerying Twilio Events API for call SID:', callSid);

  const twilioClient = twilio(credentials.accountSid, credentials.authToken);

  try {
    // Get call events
    const events = await twilioClient.calls(callSid).events.list();

    console.log('\n========== CALL EVENTS ==========');
    console.log('Found', events.length, 'events');

    events.forEach((event, index) => {
      console.log(`\n--- Event ${index + 1} ---`);
      console.log('Event Name:', event.name);
      console.log('Timestamp:', event.timestamp);
      console.log('Event Data:', JSON.stringify(event, null, 2));
    });

    // Also check notifications (error details)
    console.log('\n========== CALL NOTIFICATIONS ==========');
    const notifications = await twilioClient.calls(callSid).notifications.list();

    if (notifications.length === 0) {
      console.log('No notifications found');
    } else {
      notifications.forEach((notification, index) => {
        console.log(`\n--- Notification ${index + 1} ---`);
        console.log('Error Code:', notification.errorCode);
        console.log('Message:', notification.messageText);
        console.log('Log Level:', notification.logLevel);
        console.log('Full notification:', JSON.stringify(notification, null, 2));
      });
    }

  } catch (error: any) {
    console.error('\n❌ Error fetching events from Twilio:', error.message);
  }
}

checkTwilioEvents();
