/**
 * PHASE 1: Check Phone Number Verification Status
 *
 * Checks if a phone number is verified in Twilio account.
 *
 * Usage:
 * npx ts-node backend/scripts/check-verification-status.ts +18777804236
 */

import 'dotenv/config';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('❌ Missing Twilio credentials in .env');
  process.exit(1);
}

const twilio = require('twilio');
const client = twilio(accountSid, authToken);

const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('❌ Phone number required');
  console.error('   Usage: npx ts-node scripts/check-verification-status.ts +18777804236');
  process.exit(1);
}

function formatPhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }
  
  if (digits.length === 10) {
    return '+1' + digits;
  }
  
  if (digits.length === 11 && digits[0] === '1') {
    return '+' + digits;
  }
  
  return '+' + digits;
}

async function checkStatus() {
  const formattedPhone = formatPhoneToE164(phoneNumber);
  
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  Twilio Verification Status Check                  ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\n📞 Checking: ${formattedPhone}\n`);
  
  try {
    const callerIds = await client.outgoingCallerIds.list({ limit: 100 });
    const verified = callerIds.find((cid: any) => cid.phoneNumber === formattedPhone);
    
    if (verified) {
      console.log('✅ VERIFIED');
      console.log(`   Phone Number: ${verified.phoneNumber}`);
      console.log(`   Friendly Name: ${verified.friendlyName || 'None'}`);
      console.log(`   Status: ${verified.status || 'verified'}`);
      console.log(`   Caller ID SID: ${verified.sid}`);
      console.log(`   Verified Date: ${verified.dateCreated}`);
      console.log('\n✅ You can send SMS to this number from your trial account!');
    } else {
      console.log('❌ NOT VERIFIED');
      console.log(`\n📋 Verified Numbers in Account:`);
      if (callerIds.length === 0) {
        console.log('   (No verified numbers found)');
      } else {
        callerIds.forEach((cid: any) => {
          console.log(`   ✅ ${cid.phoneNumber}${cid.friendlyName ? ` (${cid.friendlyName})` : ''}`);
        });
      }
      console.log(`\n💡 To verify ${formattedPhone}:`);
      console.log(`   npx ts-node scripts/verify-phone-number.ts ${formattedPhone}`);
    }
  } catch (error: any) {
    console.error('❌ Error checking status:', error.message);
    process.exit(1);
  }
}

checkStatus().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
