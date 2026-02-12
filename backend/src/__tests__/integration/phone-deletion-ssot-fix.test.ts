/**
 * PHONE DELETION SSOT FIX - Integration Test
 *
 * Verifies that deleting a managed phone number:
 * 1. Removes from managed_phone_numbers (✅ already worked)
 * 2. Removes from org_credentials (✅ FIX adds this)
 * 3. Unlinks agents (✅ FIX adds this)
 * 4. Phone no longer appears in agent dropdown (✅ result)
 */

import { supabaseAdmin } from '../../config/supabase';
import { ManagedTelephonyService } from '../../services/managed-telephony-service';

describe('Phone Deletion SSOT Fix', () => {
  const TEST_ORG_ID = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
  const TEST_PHONE = '+16504595418';
  const TEST_VAPI_PHONE_ID = 'b14a686f-13c0-4d4f-bf84-6c2f8b8b491f';

  it('PHASE 1: Deletes phone and cleans up SSOT (all 4 cleanup steps)', async () => {
    console.log('\n🧪 TEST: Phone Deletion SSOT Cleanup\n');

    // BEFORE: Verify phone exists in both tables
    console.log('📋 BEFORE STATE:');
    const { data: managed_before } = await supabaseAdmin
      .from('managed_phone_numbers')
      .select('*')
      .eq('org_id', TEST_ORG_ID)
      .eq('phone_number', TEST_PHONE)
      .maybeSingle();

    const { data: ssot_before } = await supabaseAdmin
      .from('org_credentials')
      .select('*')
      .eq('org_id', TEST_ORG_ID)
      .eq('provider', 'twilio')
      .eq('is_managed', true)
      .maybeSingle();

    console.log(`✅ Phone in managed_phone_numbers: ${managed_before ? 'YES' : 'NO'}`);
    console.log(`✅ Phone in org_credentials: ${ssot_before ? 'YES' : 'NO'}`);

    if (!managed_before || !ssot_before) {
      console.log('⚠️  Phone not found in one or both tables - skipping deletion test');
      return;
    }

    // DURING: Call the delete method
    console.log('\n🔄 EXECUTING DELETION:');
    const result = await ManagedTelephonyService.releaseManagedNumber(TEST_ORG_ID, TEST_PHONE);
    console.log(`Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    // AFTER: Verify cleanup (all 4 steps)
    console.log('\n📋 AFTER STATE (Verification):');

    // Test 1: managed_phone_numbers should be updated to "released" (soft delete)
    const { data: managed_after } = await supabaseAdmin
      .from('managed_phone_numbers')
      .select('status')
      .eq('org_id', TEST_ORG_ID)
      .eq('phone_number', TEST_PHONE)
      .maybeSingle();

    const test1 = managed_after?.status === 'released';
    console.log(`✅ [1] managed_phone_numbers status updated: ${test1 ? 'PASS' : 'FAIL'}`);

    // Test 2: org_credentials should be deleted (CRITICAL FIX)
    const { data: ssot_after } = await supabaseAdmin
      .from('org_credentials')
      .select('*')
      .eq('org_id', TEST_ORG_ID)
      .eq('provider', 'twilio')
      .eq('is_managed', true)
      .maybeSingle();

    const test2 = !ssot_after;
    console.log(`✅ [2] org_credentials deleted (SSOT): ${test2 ? 'PASS' : 'FAIL'} ${ssot_after ? '(❌ STILL EXISTS - BUG!)' : ''}`);

    // Test 3: agents should be unlinked (vapi_phone_number_id set to NULL)
    const { data: agents_after } = await supabaseAdmin
      .from('agents')
      .select('vapi_phone_number_id')
      .eq('org_id', TEST_ORG_ID);

    const allAgentsUnlinked = (agents_after || []).every(a => a.vapi_phone_number_id !== TEST_VAPI_PHONE_ID);
    console.log(`✅ [3] Agents unlinked from phone: ${allAgentsUnlinked ? 'PASS' : 'FAIL'}`);

    // Test 4: Agent dropdown should not include this phone
    const { data: dropdown_numbers } = await supabaseAdmin
      .from('org_credentials')
      .select('encrypted_config')
      .eq('org_id', TEST_ORG_ID)
      .eq('provider', 'twilio');

    const phoneInDropdown = (dropdown_numbers || []).some(
      cred => cred.encrypted_config && typeof cred.encrypted_config === 'string' && cred.encrypted_config.includes(TEST_PHONE)
    );
    const test4 = !phoneInDropdown;
    console.log(`✅ [4] Phone removed from agent dropdown: ${test4 ? 'PASS' : 'FAIL'}`);

    // SUMMARY
    console.log('\n📊 TEST SUMMARY:');
    const allPass = test1 && test2 && test3 && test4;
    console.log(`[1] managed_phone_numbers updated: ${test1 ? '✅' : '❌'}`);
    console.log(`[2] org_credentials deleted (CRITICAL): ${test2 ? '✅' : '❌'}`);
    console.log(`[3] Agents unlinked: ${test3 ? '✅' : '❌'}`);
    console.log(`[4] Dropdown cleaned: ${test4 ? '✅' : '❌'}`);
    console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

    expect(test1).toBe(true);
    expect(test2).toBe(true);
    expect(allAgentsUnlinked).toBe(true);
    expect(test4).toBe(true);
  });
});
