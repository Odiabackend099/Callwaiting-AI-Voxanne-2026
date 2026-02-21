import { createClient } from '@supabase/supabase-js';
import { IntegrationDecryptor } from '../src/services/integration-decryptor';
import twilio from 'twilio';
import bcrypt from 'bcrypt';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA'
);

function generateOTP(length: number): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return otp;
}

async function retryVerification() {
  const orgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
  const phoneNumber = '+2348141995397';
  const friendlyName = 'Austin Nigeria';

  console.log('🔄 Starting verification retry for', phoneNumber);
  console.log('');

  // Step 1: Delete old failed verification record
  console.log('📋 Step 1: Cleaning up old failed verification...');
  const { error: deleteError } = await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('org_id', orgId)
    .eq('phone_number', phoneNumber)
    .eq('status', 'pending');

  if (deleteError) {
    console.log('⚠️  Warning: Could not delete old record:', deleteError.message);
  } else {
    console.log('✅ Old failed verification deleted');
  }
  console.log('');

  // Step 2: Get Twilio credentials
  console.log('📋 Step 2: Getting Twilio credentials...');
  const twilioCredentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);

  if (!twilioCredentials) {
    console.error('❌ Failed to get Twilio credentials');
    return;
  }

  console.log('✅ Using Account SID:', twilioCredentials.accountSid);
  console.log('');

  // Step 3: Generate verification code
  console.log('📋 Step 3: Generating verification code...');
  const verificationCode = generateOTP(6);
  const codeHash = await bcrypt.hash(verificationCode, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  console.log('✅ Code generated (you will hear this on the call)');
  console.log('');

  // Step 4: Initiate Twilio validation call
  console.log('📋 Step 4: Initiating Twilio validation call...');
  console.log('⏳ This will place a call to your Nigerian number...');
  console.log('');

  const twilioClient = twilio(twilioCredentials.accountSid, twilioCredentials.authToken);

  let validationRequest;
  try {
    const startTime = Date.now();

    validationRequest = await twilioClient.validationRequests.create({
      phoneNumber,
      friendlyName
    });

    const duration = Date.now() - startTime;

    console.log('✅ VALIDATION CALL INITIATED!');
    console.log('');
    console.log('========================================');
    console.log('🎉 SUCCESS - YOUR PHONE SHOULD BE RINGING!');
    console.log('========================================');
    console.log('');
    console.log('📞 Call Details:');
    console.log('   - Validation Code:', validationRequest.validationCode);
    console.log('   - Call SID:', validationRequest.callSid || 'N/A');
    console.log('   - Duration:', duration, 'ms');
    console.log('');
    console.log('📱 What to do:');
    console.log('   1. Answer your phone (+2348141995397)');
    console.log('   2. Listen for the 6-digit code');
    console.log('   3. The system will verify automatically');
    console.log('');
    console.log('⏰ Code expires at:', expiresAt.toLocaleString());
    console.log('');

  } catch (twilioError) {
    const errorMessage = twilioError instanceof Error ? twilioError.message : 'Unknown error';
    const errorCode = (twilioError as any)?.code || null;

    console.error('❌ TWILIO ERROR');
    console.error('');
    console.error('Error Code:', errorCode);
    console.error('Error Message:', errorMessage);
    console.error('');

    if (errorCode === 13227) {
      console.error('⚠️  Geo Permissions still not propagated');
      console.error('   Please wait a few more minutes and try again');
    }

    return;
  }

  // Step 5: Store verification record
  console.log('📋 Step 5: Storing verification record...');
  const { data: verification, error: insertError } = await supabase
    .from('verified_caller_ids')
    .insert({
      org_id: orgId,
      phone_number: phoneNumber,
      friendly_name: friendlyName,
      twilio_call_sid: validationRequest.callSid,
      status: 'pending',
      verification_code_hash: codeHash,
      verification_code_expires_at: expiresAt.toISOString(),
      verification_attempts: 0
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Failed to store verification:', insertError.message);
    return;
  }

  console.log('✅ Verification record created');
  console.log('');
  console.log('Verification ID:', verification.id);
  console.log('');
  console.log('========================================');
  console.log('✅ ALL DONE - WAIT FOR YOUR PHONE TO RING!');
  console.log('========================================');
}

retryVerification().catch(console.error);
