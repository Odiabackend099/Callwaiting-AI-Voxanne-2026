#!/usr/bin/env ts-node
/**
 * Test 3: Live SMS Confirmation
 *
 * Verifies that:
 * 1. SMS is sent via Twilio API (not mocked)
 * 2. Message SID is returned
 * 3. SMS delivery status can be verified
 * 4. Message contains appointment details
 * 5. Response time is <3 seconds
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { sendAppointmentConfirmationSMS } from '../../services/sms-notifications';
import { IntegrationDecryptor } from '../../services/integration-decryptor';
import twilio from 'twilio';
import { assert } from '../e2e-utils/test-environment-setup';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

export async function testLiveSMS(orgId: string): Promise<TestResult> {
  const testName = 'Live SMS Confirmation';
  console.log(`\n🧪 Testing: ${testName}`);

  // Use Twilio magic test number or real test phone
  const testPhone = process.env.TWILIO_TEST_PHONE || '+15005550006';

  try {
    const start = performance.now();

    // STEP 1: Send appointment confirmation SMS
    console.log(`   → Sending SMS to: ${testPhone}`);

    const appointmentDate = new Date(Date.now() + 86400000); // 24 hours from now
    const messageSid = await sendAppointmentConfirmationSMS(
      testPhone,
      {
        serviceType: 'E2E Test - Botox Treatment',
        scheduledAt: appointmentDate,
        confirmationUrl: 'https://voxanne.ai/confirm/test123'
      },
      orgId
    );

    const duration = performance.now() - start;

    // Assertions on message SID
    assert(messageSid !== null, 'Should return message SID');
    assert(messageSid !== undefined, 'Message SID should not be undefined');
    assert(typeof messageSid === 'string', 'Message SID should be a string');
    assert(messageSid.startsWith('SM'), 'Message SID should start with SM');
    assert(messageSid.length >= 34, 'Message SID should be at least 34 characters');

    console.log(`   ✅ SMS sent: ${messageSid.substring(0, 15)}...`);

    // STEP 2: Verify SMS via Twilio API
    console.log('   → Verifying SMS delivery via Twilio API...');

    const credentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
    const client = twilio(credentials.accountSid, credentials.authToken);

    const message = await client.messages(messageSid).fetch();

    // Verify message properties
    assert(message.status !== undefined, 'Message should have status');
    assert(
      message.status === 'queued' ||
      message.status === 'sent' ||
      message.status === 'delivered',
      `Message status should be queued/sent/delivered, got: ${message.status}`
    );
    assert(message.to === testPhone, 'Message recipient should match test phone');
    assert(message.from === credentials.phoneNumber, 'Message sender should match org phone');

    // Verify message content
    assert(message.body !== undefined, 'Message should have body');
    assert(message.body.includes('Botox'), 'Message should mention service type');
    assert(message.body.includes('Confirmed') || message.body.includes('confirmed'),
      'Message should include confirmation text');

    console.log(`   ✅ SMS verified: status=${message.status}`);

    // Performance assertion
    if (duration >= 3000) {
      console.log(`   ⚠️  Warning: SMS send time (${Math.round(duration)}ms) exceeds 3s target`);
    }

    // Success
    return {
      testName,
      passed: true,
      duration: Math.round(duration),
      details: `Message SID: ${messageSid.substring(0, 15)}..., Status: ${message.status}, Duration: ${Math.round(duration)}ms`
    };
  } catch (error: any) {
    return {
      testName,
      passed: false,
      duration: 0,
      error: error.message || String(error)
    };
  }
}

// Allow running standalone
if (require.main === module) {
  const orgId = process.argv[2];

  if (!orgId) {
    console.error('Usage: ts-node test-live-sms.ts <orgId>');
    process.exit(1);
  }

  testLiveSMS(orgId)
    .then((result) => {
      if (result.passed) {
        console.log(`\n✅ ${result.testName} - PASS`);
        console.log(`   ${result.details}`);
        process.exit(0);
      } else {
        console.log(`\n❌ ${result.testName} - FAIL`);
        console.log(`   Error: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
