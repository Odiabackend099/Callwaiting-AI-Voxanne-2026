/**
 * PHASE 0: Complete Phone Number Verification in Twilio
 *
 * This script completes phone number verification after receiving the SMS code.
 *
 * Usage:
 * npx ts-node backend/scripts/complete-phone-verification.ts +18777804236 123456
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
const verificationCode = process.argv[3];

if (!phoneNumber || !verificationCode) {
  console.error('❌ Phone number and verification code required');
  console.error('   Usage: npx ts-node scripts/complete-phone-verification.ts +18777804236 123456');
  process.exit(1);
}

/**
 * Format phone to E.164
 */
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

/**
 * Main completion function
 */
async function completeVerification() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  Complete Phone Number Verification                ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  const formattedPhone = formatPhoneToE164(phoneNumber);
  console.log(`\n📞 Phone number: ${formattedPhone}`);
  console.log(`🔢 Verification code: ${verificationCode}`);
  
  try {
    // Find the verification request
    console.log('\n🔍 Finding verification request...');
    const callerIds = await client.outgoingCallerIds.list({ limit: 100 });
    const verification = callerIds.find((cid: any) => cid.phoneNumber === formattedPhone);
    
    if (!verification) {
      console.error('❌ Verification request not found');
      console.error('   Please initiate verification first:');
      console.error(`   npx ts-node scripts/verify-phone-number.ts ${formattedPhone}`);
      process.exit(1);
    }
    
    if (verification.status === 'verified') {
      console.log('\n✅ Phone number is already verified!');
      console.log(`   Verified on: ${verification.dateCreated}`);
      process.exit(0);
    }
    
    // Complete verification
    console.log('\n📤 Completing verification...');
    const updated = await client.outgoingCallerIds(verification.sid).update({
      verificationCode: verificationCode
    });
    
    if (updated.status === 'verified') {
      console.log('\n🎉 Verification successful!');
      console.log(`   Phone Number: ${updated.phoneNumber}`);
      console.log(`   Friendly Name: ${updated.friendlyName || updated.phoneNumber}`);
      console.log(`   Status: ${updated.status}`);
      console.log(`   Verified Date: ${updated.dateCreated}`);
      
      console.log('\n✅ You can now send SMS to this number from your Twilio trial account!');
      console.log('\n📝 Test SMS sending:');
      console.log(`   npx ts-node scripts/test-twilio-sms.ts ${formattedPhone}`);
    } else {
      console.log('\n⚠️  Verification status: ' + updated.status);
      console.log('   The code may have been incorrect or expired.');
      console.log('   Please try again with a new verification request.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Failed to complete verification');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 21211) {
      console.error('\n💡 Invalid verification code.');
      console.error('   Please check the code and try again.');
      console.error('   Note: Codes expire after 10 minutes.');
    } else if (error.code === 21408) {
      console.error('\n💡 Verification request not found or expired.');
      console.error('   Please initiate a new verification:');
      console.error(`   npx ts-node scripts/verify-phone-number.ts ${formattedPhone}`);
    }
    
    process.exit(1);
  }
}

completeVerification().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
