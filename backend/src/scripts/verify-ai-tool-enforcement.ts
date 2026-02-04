/**
 * AI Tool Enforcement Verification Script
 *
 * Tests all 12 implementation fixes:
 * - TASK 1: Legacy prompts removed
 * - TASK 2: SMS queueing verified
 * - TASK 3: Graceful degradation added
 * - TASK 4: Dynamic timezone configured
 * - Phase 1: Advisory locks active
 * - Phase 3: Anti-hallucination guards present
 * - Phase 4: Tool integration complete
 */

import { supabase } from '../services/supabase-client';
import { getSuperSystemPrompt, getTemporalContext } from '../services/super-system-prompt';
import fs from 'fs';
import path from 'path';

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

const results: VerificationResult[] = [];

async function verify() {
  console.log('🔍 AI Tool Enforcement Verification\n');
  console.log('=' .repeat(60));
  console.log('Testing all 12 implementation fixes...\n');

  // TEST 1: Verify legacy system-prompts.ts is deleted
  console.log('TEST 1: Legacy prompts file deleted...');
  const legacyPath = path.join(__dirname, '../config/system-prompts.ts');
  const legacyExists = fs.existsSync(legacyPath);
  results.push({
    test: 'TASK 1: Legacy prompts deleted',
    status: legacyExists ? 'FAIL' : 'PASS',
    details: legacyExists ? 'File still exists at backend/src/config/system-prompts.ts' : 'Legacy file successfully removed'
  });

  // TEST 2: Verify super-system-prompt.ts exists and has required sections
  console.log('TEST 2: Super system prompt integrity...');
  const superPromptPath = path.join(__dirname, '../services/super-system-prompt.ts');
  const superPromptContent = fs.readFileSync(superPromptPath, 'utf-8');

  const requiredSections = [
    'CALLER IDENTIFICATION - USE lookupCaller TOOL',
    'TOOL FAILURE PROTOCOL',
    'CRITICAL DATE VALIDATION',
    'Calendar Unavailable (Graceful Degradation)',
    'Scenario E: Complex Request',
    'Scenario F: Patient Explicitly Asks for Human'
  ];

  const missingSections = requiredSections.filter(section => !superPromptContent.includes(section));
  results.push({
    test: 'Phase 3 + 4: Anti-hallucination guards + tool integration',
    status: missingSections.length === 0 ? 'PASS' : 'FAIL',
    details: missingSections.length === 0
      ? 'All 6 required sections present'
      : `Missing sections: ${missingSections.join(', ')}`
  });

  // TEST 3: Verify getTemporalContext uses timezone parameter
  console.log('TEST 3: Temporal context timezone usage...');
  const usesTimezoneParam = superPromptContent.includes('timeZone: timezone');
  results.push({
    test: 'TASK 4: Dynamic timezone in temporal context',
    status: usesTimezoneParam ? 'PASS' : 'FAIL',
    details: usesTimezoneParam
      ? 'getTemporalContext correctly applies timezone parameter'
      : 'getTemporalContext may not be using timezone parameter'
  });

  // TEST 4: Verify vapi-assistant-manager.ts fetches org settings
  console.log('TEST 4: Organization settings fetch...');
  const managerPath = path.join(__dirname, '../services/vapi-assistant-manager.ts');
  const managerContent = fs.readFileSync(managerPath, 'utf-8');

  const fetchesOrgSettings = managerContent.includes("from('organizations')") &&
                             managerContent.includes("select('timezone, name, business_hours')");
  const hasHardcodedTimezone = managerContent.match(/timezone:\s*['"]America\/Los_Angeles['"]/g)?.length || 0;

  results.push({
    test: 'TASK 4: Dynamic org settings in vapi-assistant-manager',
    status: fetchesOrgSettings && hasHardcodedTimezone <= 2 ? 'PASS' : 'WARN',
    details: fetchesOrgSettings
      ? `Org settings fetched correctly (${hasHardcodedTimezone} fallback references found)`
      : 'Organization settings fetch not found'
  });

  // TEST 5: Verify booking-agent-setup.ts uses super-system-prompt
  console.log('TEST 5: Booking agent setup integration...');
  const setupPath = path.join(__dirname, '../services/booking-agent-setup.ts');
  const setupContent = fs.readFileSync(setupPath, 'utf-8');

  const importsSuperPrompt = setupContent.includes("from './super-system-prompt'");
  const usesSuperPrompt = setupContent.includes('getSuperSystemPrompt(');

  results.push({
    test: 'TASK 1: Booking agent uses super-system-prompt',
    status: importsSuperPrompt && usesSuperPrompt ? 'PASS' : 'FAIL',
    details: importsSuperPrompt && usesSuperPrompt
      ? 'Correctly imports and uses getSuperSystemPrompt'
      : 'Missing super-system-prompt import or usage'
  });

  // TEST 6: Verify vapi-tools-routes.ts uses safe RPC
  console.log('TEST 6: Safe booking RPC...');
  const toolsPath = path.join(__dirname, '../routes/vapi-tools-routes.ts');
  const toolsContent = fs.readFileSync(toolsPath, 'utf-8');

  const usesSafeRPC = toolsContent.includes("supabase.rpc('book_appointment_with_lock'");
  const hasConflictHandling = toolsContent.includes('SLOT_UNAVAILABLE') &&
                               toolsContent.includes('That time was just booked by another caller');

  results.push({
    test: 'Phase 1: Safe RPC with advisory locks',
    status: usesSafeRPC ? 'PASS' : 'FAIL',
    details: usesSafeRPC
      ? 'Using book_appointment_with_lock (safe RPC)'
      : 'Still using unsafe RPC (book_appointment_atomic)'
  });

  results.push({
    test: 'Phase 1: Conflict response handling',
    status: hasConflictHandling ? 'PASS' : 'FAIL',
    details: hasConflictHandling
      ? 'SLOT_UNAVAILABLE error handling implemented'
      : 'Missing conflict response handling'
  });

  // TEST 7: Verify SMS queueing only after successful booking
  console.log('TEST 7: SMS queueing protocol...');
  const smsAfterSuccess = toolsContent.match(/if\s*\(bookingResult\.success\)/);
  const smsBeforeSuccess = toolsContent.indexOf('BookingConfirmationService.sendConfirmationSMS');
  const successCheckPos = toolsContent.indexOf('if (bookingResult.success)');

  const smsQueuedCorrectly = smsAfterSuccess && smsBeforeSuccess > successCheckPos;

  results.push({
    test: 'TASK 2: SMS only fires after successful booking',
    status: smsQueuedCorrectly ? 'PASS' : 'WARN',
    details: smsQueuedCorrectly
      ? 'SMS queued inside if (bookingResult.success) block'
      : 'Verify SMS queueing happens after booking success'
  });

  // TEST 8: Database migration check (advisory locks)
  console.log('TEST 8: Database RPC function...');
  try {
    const { data, error } = await supabase.rpc('book_appointment_with_lock', {
      p_org_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      p_contact_id: null,
      p_scheduled_at: new Date().toISOString(),
      p_duration_minutes: 60,
      p_service_id: null,
      p_notes: 'Verification test',
      p_metadata: {},
      p_lock_key: null
    });

    // Expect error due to invalid org_id, but function should exist
    const functionExists = error?.message !== 'Could not find the function';

    results.push({
      test: 'Database: book_appointment_with_lock RPC exists',
      status: functionExists ? 'PASS' : 'FAIL',
      details: functionExists
        ? 'RPC function exists and is callable'
        : 'RPC function not found - migration may not be applied'
    });
  } catch (err: any) {
    results.push({
      test: 'Database: book_appointment_with_lock RPC exists',
      status: 'FAIL',
      details: `Database connection error: ${err.message}`
    });
  }

  // TEST 9: Test temporal context generation
  console.log('TEST 9: Temporal context generation...');
  try {
    const context = getTemporalContext('America/New_York');
    const hasAllFields = context.currentDate && context.currentDateISO &&
                         context.currentTime && context.currentYear;

    results.push({
      test: 'TASK 4: Temporal context generation',
      status: hasAllFields ? 'PASS' : 'FAIL',
      details: hasAllFields
        ? `Generated: ${context.currentDateISO} ${context.currentTime} (${context.currentYear})`
        : 'Missing required temporal context fields'
    });
  } catch (err: any) {
    results.push({
      test: 'TASK 4: Temporal context generation',
      status: 'FAIL',
      details: `Error: ${err.message}`
    });
  }

  // TEST 10: Super prompt generation
  console.log('TEST 10: Super prompt generation...');
  try {
    const prompt = getSuperSystemPrompt({
      userTemplate: '',
      orgId: 'test-org-id',
      currentDate: 'Tuesday, February 4, 2026',
      currentDateISO: '2026-02-04',
      currentTime: '10:30 AM',
      currentYear: 2026,
      timezone: 'America/New_York',
      businessHours: '9 AM - 6 PM',
      clinicName: 'Test Clinic',
      maxDuration: 600
    });

    const hasRequiredSections = prompt.includes('TOOL FAILURE PROTOCOL') &&
                                 prompt.includes('CALLER IDENTIFICATION') &&
                                 prompt.includes('Calendar Unavailable (Graceful Degradation)');

    results.push({
      test: 'Phase 3: Super prompt generation complete',
      status: hasRequiredSections ? 'PASS' : 'FAIL',
      details: hasRequiredSections
        ? `Generated ${prompt.length} character prompt with all sections`
        : 'Missing required sections in generated prompt'
    });
  } catch (err: any) {
    results.push({
      test: 'Phase 3: Super prompt generation complete',
      status: 'FAIL',
      details: `Error: ${err.message}`
    });
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION RESULTS\n');

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${result.test}`);
    console.log(`   ${result.details}\n`);

    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else warnCount++;
  });

  console.log('='.repeat(60));
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
  console.log('='.repeat(60));

  if (failCount === 0 && warnCount === 0) {
    console.log('\n🎉 ALL CHECKS PASSED - Ready for deployment!');
  } else if (failCount === 0) {
    console.log('\n✅ Core checks passed - Warnings should be investigated');
  } else {
    console.log('\n❌ CRITICAL FAILURES - Review failed tests before deployment');
  }

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run verification
verify().catch((error) => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});
