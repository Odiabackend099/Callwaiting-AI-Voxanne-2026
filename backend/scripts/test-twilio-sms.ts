/**
 * PHASE 0: Test SMS with Temi's Twilio Credentials
 *
 * This script validates that Twilio SMS integration works end-to-end
 * before we refactor to multi-tenant BYOC architecture.
 *
 * Usage:
 * npx ts-node backend/scripts/test-twilio-sms.ts
 *
 * Environment variables required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */

import 'dotenv/config';

// Validate environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromPhone) {
  console.error('❌ Missing Twilio credentials in .env');
  console.error('   TWILIO_ACCOUNT_SID:', accountSid ? '✓' : '✗');
  console.error('   TWILIO_AUTH_TOKEN:', authToken ? '✓' : '✗');
  console.error('   TWILIO_PHONE_NUMBER:', fromPhone ? '✓' : '✗');
  process.exit(1);
}

// Import Twilio
const twilio = require('twilio');

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

  if (digits.length > 10) {
    return '+' + digits;
  }

  throw new Error(`Invalid phone number format: ${phone}`);
}

/**
 * Validate phone
 */
function validatePhone(phone: string): boolean {
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phone.replace(/\D/g, ''));
}

/**
 * Test 1: Verify Twilio Account
 */
async function testTwilioAccount(): Promise<boolean> {
  console.log('\n📝 Test 1: Verify Twilio Account Access');
  console.log('━'.repeat(50));

  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();

    console.log('✅ Account verified');
    console.log(`   Account SID: ${account.sid}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Friendly Name: ${account.friendlyName}`);
    console.log(`   Created: ${account.dateCreated}`);

    if (account.status !== 'active') {
      console.error(`⚠️  Account status is ${account.status}, not active`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('❌ Failed to verify account');
    console.error(`   Error: ${error?.message || error?.toString()}`);
    return false;
  }
}

/**
 * Test 2: Validate Twilio Phone Number and Check Verification
 */
async function testTwilioPhoneNumber(): Promise<boolean> {
  console.log('\n📝 Test 2: Validate Twilio Phone Number');
  console.log('━'.repeat(50));

  try {
    if (!validatePhone(fromPhone)) {
      console.error(`❌ Invalid phone format: ${fromPhone}`);
      return false;
    }

    console.log(`✅ Phone number is valid: ${fromPhone}`);

    const client = twilio(accountSid, authToken);
    
    // Check if phone is in account (incoming numbers)
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 10 });
    const matchingPhone = phoneNumbers.find((pn: any) =>
      pn.phoneNumber === fromPhone || pn.friendlyName?.includes(fromPhone)
    );

    if (matchingPhone) {
      console.log(`✅ Phone number found in account`);
      console.log(`   Friendly Name: ${matchingPhone.friendlyName}`);
      console.log(`   Phone: ${matchingPhone.phoneNumber}`);
    } else {
      console.warn(`⚠️  Phone number not found in incoming numbers (may be trial account)`);
    }

    // Check verified caller IDs (for SMS destination verification)
    try {
      const verifiedNumbers = await client.outgoingCallerIds.list({ limit: 100 });
      console.log(`\n📋 Verified Numbers (for SMS destinations):`);
      if (verifiedNumbers.length === 0) {
        console.log(`   ⚠️  No verified numbers found`);
        console.log(`   💡 Trial accounts can only send SMS to verified numbers`);
        console.log(`   💡 Verify numbers at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified`);
      } else {
        verifiedNumbers.forEach((cid: any) => {
          console.log(`   ✅ ${cid.phoneNumber}${cid.friendlyName ? ` (${cid.friendlyName})` : ''}`);
        });
      }
    } catch (err: any) {
      console.warn(`⚠️  Could not check verified numbers: ${err.message}`);
    }

    return true;
  } catch (error: any) {
    console.error('❌ Failed to validate phone number');
    console.error(`   Error: ${error?.message || error?.toString()}`);
    return false;
  }
}

/**
 * Test 3: Send Test SMS (requires valid test phone)
 */
async function testSendSMS(toPhone: string): Promise<boolean> {
  console.log('\n📝 Test 3: Send Test SMS');
  console.log('━'.repeat(50));

  try {
    if (!validatePhone(toPhone)) {
      console.error(`❌ Invalid recipient phone: ${toPhone}`);
      return false;
    }

    const formattedPhone = formatPhoneToE164(toPhone);
    const client = twilio(accountSid, authToken);

    console.log(`📤 Sending SMS...`);
    console.log(`   From: ${fromPhone}`);
    console.log(`   To: ${formattedPhone}`);

    const message = await client.messages.create({
      body: '🔥 Test SMS from Voxanne AI Receptionist. If you received this, SMS integration is working!',
      from: fromPhone,
      to: formattedPhone
    });

    console.log(`✅ SMS sent successfully`);
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   Date Sent: ${message.dateSent}`);

    return true;
  } catch (error: any) {
    console.error('❌ Failed to send SMS');
    console.error(`   Error: ${error?.message || error?.toString()}`);
    if (error?.code === 21212) {
      console.error('   💡 Note: Invalid phone number. For trial accounts, use verified numbers only.');
    }
    return false;
  }
}

/**
 * Test 4: Simulate Hot Lead SMS
 */
async function testHotLeadSMS(toPhone: string): Promise<boolean> {
  console.log('\n📝 Test 4: Simulate Hot Lead SMS');
  console.log('━'.repeat(50));

  try {
    if (!validatePhone(toPhone)) {
      console.error(`❌ Invalid recipient phone: ${toPhone}`);
      return false;
    }

    const formattedPhone = formatPhoneToE164(toPhone);
    const client = twilio(accountSid, authToken);

    // Keep message under 160 chars for trial accounts (avoid error 30044)
    // Trial accounts have strict message length limits - split long messages
    const message = `🔥 HOT LEAD!\nSarah J\n📞 +14155551234\n💄 Botox+Filler\nReady to book!`;

    console.log(`📤 Sending hot lead SMS...`);
    console.log(`   From: ${fromPhone}`);
    console.log(`   To: ${formattedPhone}`);
    console.log(`   Message length: ${message.length} chars (max 160 for trial)`);

    const result = await client.messages.create({
      body: message,
      from: fromPhone,
      to: formattedPhone
    });

    console.log(`✅ Hot lead SMS sent successfully`);
    console.log(`   Message SID: ${result.sid}`);
    console.log(`   Status: ${result.status}`);

    return true;
  } catch (error: any) {
    console.error('❌ Failed to send hot lead SMS');
    console.error(`   Error: ${error?.message || error?.toString()}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  PHASE 0: Temi Twilio SMS Integration Test Suite  ║');
  console.log('╚════════════════════════════════════════════════════╝');

  const results: Record<string, boolean> = {};

  // Test 1: Account verification
  results['Account Verification'] = await testTwilioAccount();

  // Test 2: Phone number validation
  results['Phone Number Validation'] = await testTwilioPhoneNumber();

  // Get test phone from CLI args or use default
  const testPhone = process.argv[2] || '+14155552671'; // Default Twilio test number
  console.log(`\n💬 Using test phone: ${testPhone}`);

  // Check if test phone is verified (trial account requirement)
  try {
    const client = twilio(accountSid, authToken);
    const verifiedNumbers = await client.outgoingCallerIds.list({ limit: 100 });
    const isVerified = verifiedNumbers.some((cid: any) => cid.phoneNumber === testPhone);
    
    if (!isVerified) {
      console.warn(`\n⚠️  WARNING: ${testPhone} is NOT verified in your Twilio account!`);
      console.warn(`   Trial accounts can only send SMS to verified numbers.`);
      console.warn(`   Verification may fail or messages may not be delivered.`);
      console.warn(`   Verify at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified`);
      console.warn(`   Or run: npx ts-node scripts/verify-phone-number.ts ${testPhone}\n`);
    } else {
      console.log(`✅ Test phone ${testPhone} is verified\n`);
    }
  } catch (err: any) {
    console.warn(`⚠️  Could not check verification status: ${err.message}\n`);
  }

  // Test 3: Send generic SMS
  try {
    results['Send Test SMS'] = await testSendSMS(testPhone);
  } catch (e) {
    results['Send Test SMS'] = false;
  }

  // Test 4: Send hot lead SMS
  try {
    results['Send Hot Lead SMS'] = await testHotLeadSMS(testPhone);
  } catch (e) {
    results['Send Hot Lead SMS'] = false;
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('━'.repeat(50));

  let passed = 0;
  let failed = 0;

  Object.entries(results).forEach(([test, result]) => {
    if (result) {
      console.log(`✅ ${test}`);
      passed++;
    } else {
      console.log(`❌ ${test}`);
      failed++;
    }
  });

  console.log('━'.repeat(50));
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Twilio SMS integration is working.');
    console.log('   Ready to proceed with Phase 1: Database Schema');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
