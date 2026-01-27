/**
 * Unit Test: Reliability Protocol Implementation
 *
 * Tests core fallback functionality without requiring Vapi API calls
 *
 * Usage:
 *   npx ts-node backend/src/scripts/test-reliability-protocol-unit.ts
 *
 * Tests:
 * 1. mergeFallbacksIntoPayload() function ✅
 * 2. buildTranscriberWithFallbacks() function ✅
 * 3. buildVoiceWithFallbacks() function ✅
 * 4. hasProperFallbacks() validation ✅
 * 5. getMissingFallbackConfigs() detection ✅
 * 6. Fallback structure validation ✅
 * 7. Multi-language support ✅
 * 8. Edge case handling ✅
 */

import {
  mergeFallbacksIntoPayload,
  hasProperFallbacks,
  getMissingFallbackConfigs,
  buildTranscriberWithFallbacks,
  buildVoiceWithFallbacks
} from '../config/vapi-fallbacks';

// ========================================
// Statistics Tracking
// ========================================

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function addTestResult(name: string, status: 'PASS' | 'FAIL', details?: string, error?: string) {
  results.push({ name, status, details, error });
  const icon = status === 'PASS' ? '✅' : '❌';
  const message = `${icon} ${name}`;
  if (details) {
    console.log(`${message}\n   ${details}`);
  } else {
    console.log(message);
  }
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// ========================================
// Test Suite
// ========================================

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 RELIABILITY PROTOCOL UNIT TEST SUITE                              ║');
  console.log('║     Testing fallback configuration without Vapi API calls            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // ========== TEST 1: mergeFallbacksIntoPayload ==========
  console.log('📝 Test 1: mergeFallbacksIntoPayload() - Payload transformation\n');

  try {
    const payload = {
      name: 'Test Agent',
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
      voice: { provider: 'vapi', voiceId: 'Rohan' }
    };

    const merged = mergeFallbacksIntoPayload(payload);

    // Verify transcriber fallbacks
    assert(merged.transcriber.fallbacks, 'Transcriber should have fallbacks');
    assert(Array.isArray(merged.transcriber.fallbacks), 'Fallbacks should be array');
    assert(merged.transcriber.fallbacks.length >= 2, 'Should have at least 2 fallbacks');
    assert(merged.transcriber.provider === 'deepgram', 'Should preserve provider');
    assert(merged.transcriber.model === 'nova-2', 'Should preserve model');

    // Verify voice fallbacks
    assert(merged.voice.fallbacks, 'Voice should have fallbacks');
    assert(Array.isArray(merged.voice.fallbacks), 'Voice fallbacks should be array');
    assert(merged.voice.fallbacks.length >= 1, 'Voice should have fallback');
    assert(merged.voice.provider === 'vapi', 'Should preserve voice provider');
    assert(merged.voice.voiceId === 'Rohan', 'Should preserve voice ID');

    addTestResult('Basic payload merge', 'PASS',
      `Transcriber: ${merged.transcriber.fallbacks.length} fallbacks (${merged.transcriber.fallbacks.map(f => f.provider).join(', ')}), Voice: ${merged.voice.fallbacks.length} fallbacks`);

  } catch (err: any) {
    addTestResult('Basic payload merge', 'FAIL', undefined, err.message);
  }

  // ========== TEST 2: mergeFallbacksIntoPayload - Payload without transcriber ==========
  console.log('\n🎯 Test 2: mergeFallbacksIntoPayload() - Payload without transcriber\n');

  try {
    const payload = {
      name: 'Test Agent',
      voice: { provider: 'openai', voiceId: 'alloy' }
    };

    const merged = mergeFallbacksIntoPayload(payload);

    // Should only have voice fallbacks, no transcriber
    assert(!merged.transcriber, 'Should not add transcriber if not present');
    assert(merged.voice.fallbacks, 'Should have voice fallbacks');
    assert(merged.voice.fallbacks.length >= 1, 'Should have fallback');

    addTestResult('Payload without transcriber', 'PASS',
      'Correctly skipped transcriber, added voice fallbacks');

  } catch (err: any) {
    addTestResult('Payload without transcriber', 'FAIL', undefined, err.message);
  }

  // ========== TEST 3: buildTranscriberWithFallbacks ==========
  console.log('\n🎤 Test 3: buildTranscriberWithFallbacks() - Config generation\n');

  try {
    const config = buildTranscriberWithFallbacks('en');

    assert(config.provider === 'deepgram', 'Provider should be deepgram');
    assert(config.model === 'nova-2', 'Model should be nova-2');
    assert(config.language === 'en', 'Language should be en');
    assert(config.fallbacks, 'Should have fallbacks');
    assert(config.fallbacks.length === 2, 'Should have exactly 2 fallbacks');
    assert(config.fallbacks[0].provider === 'deepgram', 'First fallback should be deepgram');
    assert(config.fallbacks[1].provider === 'talkscriber', 'Second fallback should be talkscriber');

    addTestResult('Transcriber config generation', 'PASS',
      `Primary: ${config.provider}/${config.model}, Fallbacks: ${config.fallbacks.map(f => f.provider).join(', ')}`);

  } catch (err: any) {
    addTestResult('Transcriber config generation', 'FAIL', undefined, err.message);
  }

  // ========== TEST 4: buildTranscriberWithFallbacks - Multi-language ==========
  console.log('\n🌍 Test 4: buildTranscriberWithFallbacks() - Multi-language support\n');

  try {
    const languages = ['en', 'es', 'fr', 'de'];
    let allValid = true;

    for (const lang of languages) {
      const config = buildTranscriberWithFallbacks(lang);
      if (!config.language === lang || !config.fallbacks || config.fallbacks.length < 2) {
        allValid = false;
        break;
      }
    }

    assert(allValid, 'All languages should be supported');
    addTestResult('Multi-language transcriber support', 'PASS',
      `Supports: ${languages.join(', ')}`);

  } catch (err: any) {
    addTestResult('Multi-language transcriber support', 'FAIL', undefined, err.message);
  }

  // ========== TEST 5: buildVoiceWithFallbacks ==========
  console.log('\n🔊 Test 5: buildVoiceWithFallbacks() - Config generation\n');

  try {
    const config = buildVoiceWithFallbacks('openai', 'alloy');

    assert(config.provider === 'openai', 'Provider should be openai');
    assert(config.voiceId === 'alloy', 'Voice ID should be alloy');
    assert(config.fallbacks, 'Should have fallbacks');
    assert(config.fallbacks.length >= 1, 'Should have at least 1 fallback');
    assert(config.fallbacks.every(f => f.provider !== 'openai' || f.voiceId !== 'alloy'),
      'Should not duplicate primary voice');

    addTestResult('Voice config generation', 'PASS',
      `Primary: ${config.provider}/${config.voiceId}, Fallbacks: ${config.fallbacks.length}`);

  } catch (err: any) {
    addTestResult('Voice config generation', 'FAIL', undefined, err.message);
  }

  // ========== TEST 6: buildVoiceWithFallbacks - All providers ==========
  console.log('\n📊 Test 6: buildVoiceWithFallbacks() - All provider support\n');

  try {
    const providers = ['vapi', 'openai', 'elevenlabs', 'google', 'azure', 'playht', 'rime'];
    let successCount = 0;

    for (const provider of providers) {
      const config = buildVoiceWithFallbacks(provider, `voice_${provider}`);
      if (config.provider === provider && config.fallbacks && config.fallbacks.length >= 1) {
        successCount++;
      }
    }

    assert(successCount === providers.length, `All ${providers.length} providers should be supported`);
    addTestResult('All provider support', 'PASS',
      `Supports: ${providers.join(', ')}`);

  } catch (err: any) {
    addTestResult('All provider support', 'FAIL', undefined, err.message);
  }

  // ========== TEST 7: hasProperFallbacks ==========
  console.log('\n✓ Test 7: hasProperFallbacks() - Validation function\n');

  try {
    // Create proper assistant mock
    const properAssistant = {
      id: 'test123',
      name: 'Test',
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        fallbacks: [
          { provider: 'deepgram', model: 'nova-2-general' },
          { provider: 'talkscriber', model: 'whisper' }
        ]
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy',
        fallbacks: [
          { provider: 'azure', voiceId: 'Andrew' },
          { provider: 'elevenlabs', voiceId: '21m00Tcm4TlvDq8ikWAM' }
        ]
      }
    };

    assert(hasProperFallbacks(properAssistant), 'Should return true for proper assistant');
    addTestResult('Proper assistant detection', 'PASS',
      'Correctly identified proper fallback configuration');

  } catch (err: any) {
    addTestResult('Proper assistant detection', 'FAIL', undefined, err.message);
  }

  // ========== TEST 8: hasProperFallbacks - Missing fallbacks ==========
  console.log('\n⚠️  Test 8: hasProperFallbacks() - Missing fallback detection\n');

  try {
    // Create assistant with missing fallbacks
    const imprperAssistant = {
      id: 'test123',
      name: 'Test',
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2'
        // Missing fallbacks
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy'
        // Missing fallbacks
      }
    };

    assert(!hasProperFallbacks(imprperAssistant), 'Should return false for improper assistant');
    addTestResult('Missing fallback detection', 'PASS',
      'Correctly detected missing fallbacks');

  } catch (err: any) {
    addTestResult('Missing fallback detection', 'FAIL', undefined, err.message);
  }

  // ========== TEST 9: getMissingFallbackConfigs ==========
  console.log('\n🔍 Test 9: getMissingFallbackConfigs() - Missing config detection\n');

  try {
    const assistant = {
      id: 'test123',
      transcriber: { provider: 'deepgram', model: 'nova-2' },
      voice: { provider: 'openai', voiceId: 'alloy' }
    };

    const missing = getMissingFallbackConfigs(assistant);

    assert(Array.isArray(missing), 'Should return array');
    assert(missing.length === 2, 'Should detect 2 missing configs');
    assert(missing.includes('transcriber'), 'Should include transcriber');
    assert(missing.includes('voice'), 'Should include voice');

    addTestResult('Missing config detection', 'PASS',
      `Detected missing: ${missing.join(', ')}`);

  } catch (err: any) {
    addTestResult('Missing config detection', 'FAIL', undefined, err.message);
  }

  // ========== TEST 10: Edge case - Duplicate primary voice ==========
  console.log('\n🛡️  Test 10: Edge case - Duplicate primary voice prevention\n');

  try {
    // Test that OpenAI fallbacks don't duplicate Alloy
    const config = buildVoiceWithFallbacks('openai', 'alloy');

    const hasDuplicate = config.fallbacks.some(f => f.provider === 'openai' && f.voiceId === 'alloy');
    assert(!hasDuplicate, 'Should not duplicate primary voice in fallbacks');

    addTestResult('Duplicate prevention', 'PASS',
      'Correctly avoids duplicating primary voice');

  } catch (err: any) {
    addTestResult('Duplicate prevention', 'FAIL', undefined, err.message);
  }

  // ========== TEST 11: Edge case - Empty payload ==========
  console.log('\n📦 Test 11: Edge case - Empty/minimal payload\n');

  try {
    const emptyPayload = { name: 'Minimal Agent' };
    const merged = mergeFallbacksIntoPayload(emptyPayload);

    assert(merged.name === 'Minimal Agent', 'Should preserve name');
    assert(!merged.transcriber || !merged.transcriber.fallbacks, 'Should not add transcriber if none present');
    assert(!merged.voice || !merged.voice.fallbacks, 'Should not add voice if none present');

    addTestResult('Minimal payload handling', 'PASS',
      'Correctly handled empty payload');

  } catch (err: any) {
    addTestResult('Minimal payload handling', 'FAIL', undefined, err.message);
  }

  // ========== TEST 12: Edge case - Idempotency ==========
  console.log('\n🔄 Test 12: Edge case - Idempotency (re-apply fallbacks)\n');

  try {
    const payload1 = {
      transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
      voice: { provider: 'openai', voiceId: 'alloy' }
    };

    // Apply fallbacks once
    const merged1 = mergeFallbacksIntoPayload(payload1);

    // Apply fallbacks again (idempotent)
    const merged2 = mergeFallbacksIntoPayload(merged1);

    assert(merged1.transcriber.fallbacks.length === merged2.transcriber.fallbacks.length,
      'Should not duplicate fallbacks on re-apply');
    assert(merged1.voice.fallbacks.length === merged2.voice.fallbacks.length,
      'Should not duplicate voice fallbacks on re-apply');

    addTestResult('Idempotency verification', 'PASS',
      'Re-applying fallbacks does not duplicate');

  } catch (err: any) {
    addTestResult('Idempotency verification', 'FAIL', undefined, err.message);
  }

  // ========== PRINT SUMMARY ==========
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ 📊 TEST SUMMARY                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const totalCount = results.length;
  const passPercentage = Math.round((passCount / totalCount) * 100);

  console.log('Test Results:');
  console.log(`  ✅ Passed: ${passCount}/${totalCount}`);
  console.log(`  ❌ Failed: ${failCount}/${totalCount}`);
  console.log(`  📈 Success Rate: ${passPercentage}%\n`);

  console.log('Detailed Results:');
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${result.name}`);
    if (result.details) {
      console.log(`     ${result.details}`);
    }
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  }

  // Final verdict
  console.log('\n' + '═'.repeat(72));
  if (failCount === 0) {
    console.log('✅ ALL UNIT TESTS PASSED - RELIABILITY PROTOCOL LOGIC IS CORRECT');
    console.log('═'.repeat(72) + '\n');
    console.log('All fallback configuration functions are working correctly!\n');
    console.log('Next Steps:\n');
    console.log('  1. Test with real Vapi API (if API key available)');
    console.log('  2. Deploy to production');
    console.log('  3. Run enforcement script: enforce-provider-fallbacks.ts');
    console.log('  4. Verify compliance: verify-provider-fallbacks.ts\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failCount} TEST(S) FAILED - REVIEW ERRORS ABOVE`);
    console.log('═'.repeat(72) + '\n');
    process.exit(1);
  }
}

// ========================================
// Execute Tests
// ========================================

runTests()
  .then(() => {
    console.log('✨ Test suite completed\n');
  })
  .catch((err) => {
    console.error('\n❌ Test suite failed:', err.message);
    process.exit(1);
  });
