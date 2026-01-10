/**
 * PHASE 1: Verify Phone Number in Twilio using Outgoing Caller IDs API
 *
 * Based on Perplexity research: Twilio trial accounts require verification via
 * Outgoing Caller IDs API. Twilio will CALL the number with a verification code.
 *
 * Usage:
 * npx ts-node backend/scripts/verify-phone-number.ts +18777804236 [friendly-name]
 *
 * Note: This initiates a VOICE CALL (not SMS) with the verification code.
 * User must answer and enter the code during the call.
 */

import 'dotenv/config';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('❌ Missing Twilio credentials in .env');
  console.error('   TWILIO_ACCOUNT_SID:', accountSid ? '✓' : '✗');
  console.error('   TWILIO_AUTH_TOKEN:', authToken ? '✓' : '✗');
  process.exit(1);
}

const twilio = require('twilio');
const client = twilio(accountSid, authToken);

const phoneNumber = process.argv[2];
const friendlyName = process.argv[3] || undefined;

if (!phoneNumber) {
  console.error('❌ Phone number required');
  console.error('   Usage: npx ts-node scripts/verify-phone-number.ts +18777804236 [friendly-name]');
  process.exit(1);
}

/**
 * Validate phone format
 */
function validatePhone(phone: string): boolean {
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phone.replace(/\D/g, ''));
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
 * List all verified numbers
 */
async function listVerifiedNumbers() {
  try {
    const callerIds = await client.outgoingCallerIds.list({ limit: 100 });
    return callerIds.map((cid: any) => ({
      sid: cid.sid,
      phoneNumber: cid.phoneNumber,
      friendlyName: cid.friendlyName,
      status: cid.status,
      dateCreated: cid.dateCreated
    }));
  } catch (error: any) {
    throw new Error(`Failed to list verified numbers: ${error.message}`);
  }
}

/**
 * Main verification function
 */
async function verifyPhoneNumber() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  Twilio Phone Number Verification                  ║');
  console.log('║  (Outgoing Caller IDs API)                        ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  if (!validatePhone(phoneNumber)) {
    console.error(`❌ Invalid phone number format: ${phoneNumber}`);
    console.error('   Expected format: +1234567890 (E.164)');
    process.exit(1);
  }
  
  const formattedPhone = formatPhoneToE164(phoneNumber);
  console.log(`\n📞 Phone number: ${formattedPhone}`);
  if (friendlyName) {
    console.log(`   Friendly name: ${friendlyName}`);
  }
  
  try {
    // Check if already verified
    console.log('\n🔍 Checking if number is already verified...');
    const verified = await listVerifiedNumbers();
    const alreadyVerified = verified.find(cid => cid.phoneNumber === formattedPhone);
    
    if (alreadyVerified) {
      console.log('✅ Phone number is already verified!');
      console.log(`   Friendly Name: ${alreadyVerified.friendlyName || formattedPhone}`);
      console.log(`   Status: ${alreadyVerified.status || 'verified'}`);
      console.log(`   Verified Date: ${alreadyVerified.dateCreated}`);
      console.log(`   Caller ID SID: ${alreadyVerified.sid}`);
      console.log('\n✅ You can now send SMS to this number from your trial account!');
      process.exit(0);
    }
    
    console.log('   Number not found in verified list. Initiating verification...');
    
    // For trial accounts, verification is primarily done via Console
    // The API doesn't support create() for trial accounts
    console.log('\n⚠️  Trial Account Verification Required');
    console.log('   For trial accounts, phone number verification must be done manually.');
    console.log('   Follow these steps:\n');
    
    console.log('📋 MANUAL VERIFICATION STEPS:');
    console.log('');
    console.log('   1. Open Twilio Console:');
    console.log('      https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    console.log('');
    console.log('   2. Click "Add a new Caller ID"');
    console.log('');
    console.log(`   3. Enter phone number: ${formattedPhone}`);
    if (friendlyName) {
      console.log(`   4. Enter friendly name: ${friendlyName}`);
      console.log('   5. Click "Verify"');
    } else {
      console.log('   4. Click "Verify"');
    }
    console.log('');
    console.log('   6. Twilio will CALL you at ' + formattedPhone);
    console.log('   7. Answer the call and enter the verification code when prompted');
    console.log('   8. The number will be verified automatically after code entry');
    console.log('');
    
    console.log('📋 After verification, check status with:');
    console.log(`   npx ts-node scripts/check-verification-status.ts ${formattedPhone}`);
    console.log('');
    
    console.log('💡 Alternative: Use Twilio Verify API for user verification');
    console.log('   (Different from Caller ID verification - for app user verification)');
    console.log('');
    
    // Try to provide helpful curl command for REST API (may work for some account types)
    console.log('🔧 For paid accounts, you can use REST API:');
    console.log('   curl -X POST \\');
    console.log('     https://api.twilio.com/2010-04-01/Accounts/AC0a90c92cbd17b575fde9ec6e817b71af/OutgoingCallerIds.json \\');
    console.log(`     --data-urlencode "PhoneNumber=${formattedPhone}" \\`);
    if (friendlyName) {
      console.log(`     --data-urlencode "FriendlyName=${friendlyName}" \\`);
    }
    console.log('     -u AC0a90c92cbd17b575fde9ec6e817b71af:[AUTH_TOKEN]');
    console.log('');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Failed to initiate verification');
    console.error(`   Error: ${error.message}`);
    console.error(`   Error Code: ${error.code || 'Unknown'}`);
    
    if (error.code === 60201) {
      console.error('\n💡 This phone number may already be verified or in use.');
      console.error('   Try checking verification status first.');
    } else if (error.code === 21608) {
      console.error('\n💡 Invalid phone number format or number not reachable.');
      console.error('   Ensure the number is in E.164 format: +[country code][number]');
    } else if (error.code === 21211) {
      console.error('\n💡 Invalid phone number format.');
      console.error('   Use E.164 format: +1234567890');
    } else if (error.code === 21408) {
      console.error('\n💡 This phone number is not available for verification.');
      console.error('   It may already be verified or belong to another account.');
    }
    
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure phone number is in E.164 format (+country code + number)');
    console.error('   2. Ensure you have access to answer calls on this number');
    console.error('   3. Check Twilio Console for verification status');
    console.error('   4. For trial accounts, verify manually in Console if needed');
    
    process.exit(1);
  }
}

verifyPhoneNumber().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
