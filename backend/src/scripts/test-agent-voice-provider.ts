/**
 * Automated Test Script: Agent Voice Provider Functionality
 * Tests all 7 voice providers with 2 voices each (14 total tests)
 *
 * Verifies:
 * - Database save success
 * - voice_provider persisted correctly
 * - VAPI assistant sync success
 *
 * Usage:
 *   export TEST_AUTH_TOKEN="your-jwt-token"
 *   npx ts-node src/scripts/test-agent-voice-provider.ts
 */

import { createClient } from '@supabase/supabase-js';
import { getVoiceById, getVoicesByProvider } from '../config/voice-registry';
import fetch from 'node-fetch';

const PROVIDERS = ['vapi', 'elevenlabs', 'openai', 'google', 'azure', 'playht', 'rime'];
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

interface TestResult {
    provider: string;
    voiceId: string;
    voiceName: string;
    dbSaveSuccess: boolean;
    dbVoiceProvider: string | null;
    vapiSyncSuccess: boolean;
    vapiAssistantId: string | null;
    error: string | null;
}

async function testVoiceProvider(
    provider: string,
    voiceId: string,
    orgId: string,
    authToken: string
): Promise<TestResult> {
    const voice = getVoiceById(voiceId);
    const result: TestResult = {
        provider,
        voiceId,
        voiceName: voice?.name || 'Unknown',
        dbSaveSuccess: false,
        dbVoiceProvider: null,
        vapiSyncSuccess: false,
        vapiAssistantId: null,
        error: null
    };

    try {
        // Step 1: Save agent with specific voice and provider
        const saveResponse = await fetch(`${BACKEND_URL}/api/founder-console/agent/behavior`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inbound: {
                    name: `Test Agent - ${provider}/${voiceId}`,
                    systemPrompt: 'You are a helpful test agent for voice provider testing.',
                    firstMessage: 'Hello! This is a test of the voice provider system.',
                    voice: voiceId,
                    voiceProvider: provider,
                    language: 'en-US',
                    maxDurationSeconds: 300
                }
            })
        });

        if (!saveResponse.ok) {
            const errorText = await saveResponse.text();
            result.error = `Save failed (${saveResponse.status}): ${errorText.substring(0, 100)}`;
            return result;
        }

        const saveData = await saveResponse.json();
        if (!saveData.success) {
            result.error = `Save returned success=false: ${saveData.error || 'Unknown error'}`;
            return result;
        }

        result.dbSaveSuccess = true;

        // Step 2: Verify database has correct voice_provider
        const { data: agent, error: dbError } = await supabase
            .from('agents')
            .select('id, voice, voice_provider, vapi_assistant_id')
            .eq('role', 'inbound')
            .eq('org_id', orgId)
            .maybeSingle();

        if (dbError) {
            result.error = `DB query failed: ${dbError.message}`;
            return result;
        }

        if (!agent) {
            result.error = 'Agent not found in database after save';
            return result;
        }

        result.dbVoiceProvider = agent.voice_provider;

        if (agent.voice_provider !== provider) {
            result.error = `Voice provider mismatch: expected '${provider}', got '${agent.voice_provider}'`;
            // Don't return - continue to check VAPI sync
        }

        // Step 3: Check VAPI assistant was created
        if (agent.vapi_assistant_id) {
            result.vapiSyncSuccess = true;
            result.vapiAssistantId = agent.vapi_assistant_id;
        } else {
            if (!result.error) {
                result.error = 'VAPI assistant ID not saved to database';
            }
        }

    } catch (err: any) {
        result.error = err.message || String(err);
    }

    return result;
}

async function runTests() {
    console.log('🧪 Starting Agent Voice Provider Tests\n');
    console.log('Testing all 7 providers with 2 voices each (14 total tests)\n');

    // Get first org for testing
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle();

    if (orgError || !org) {
        console.error('❌ No organization found for testing');
        console.error('Error:', orgError?.message);
        process.exit(1);
    }

    const orgId = org.id;
    console.log(`✅ Using organization: ${orgId}\n`);

    const authToken = process.env.TEST_AUTH_TOKEN || '';
    if (!authToken) {
        console.error('❌ TEST_AUTH_TOKEN environment variable not set');
        console.error('   Generate a token from your browser (localStorage.getItem(\'sb-token\'))');
        process.exit(1);
    }

    const results: TestResult[] = [];
    let testNumber = 0;

    // Test 2 voices per provider
    for (const provider of PROVIDERS) {
        const providerVoices = getVoicesByProvider(provider as any);
        const testVoices = providerVoices.slice(0, 2); // Take first 2 voices

        if (testVoices.length === 0) {
            console.log(`⚠️  No voices found for provider: ${provider}`);
            continue;
        }

        console.log(`\n📋 Testing Provider: ${provider.toUpperCase()}`);
        console.log(`   Available voices: ${providerVoices.length}, Testing: ${testVoices.length}`);

        for (const voice of testVoices) {
            testNumber++;
            console.log(`\n   [${testNumber}/14] Testing: ${voice.name} (${voice.id})`);

            const result = await testVoiceProvider(provider, voice.id, orgId, authToken);
            results.push(result);

            // Display result immediately
            if (result.error) {
                console.log(`   ❌ FAILED: ${result.error}`);
            } else if (result.dbVoiceProvider !== provider) {
                console.log(`   ⚠️  WARNING: DB has '${result.dbVoiceProvider}' but expected '${provider}'`);
            } else if (!result.vapiSyncSuccess) {
                console.log(`   ⚠️  WARNING: VAPI sync failed (no assistant ID)`);
            } else {
                console.log(`   ✅ PASSED`);
                console.log(`      DB Voice Provider: ${result.dbVoiceProvider}`);
                console.log(`      VAPI Assistant ID: ${result.vapiAssistantId?.substring(0, 12)}...`);
            }

            // Rate limiting: Wait 1 second between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Print comprehensive summary
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(100));
    console.log('\nProvider     | Voice                          | DB Save | VP Match | VAPI Sync | Status');
    console.log('-------------|--------------------------------|---------|----------|-----------|' + '-'.repeat(30));

    for (const r of results) {
        const dbSave = r.dbSaveSuccess ? '✅' : '❌';
        const vpMatch = r.dbVoiceProvider === r.provider ? '✅' : '❌';
        const vapiSync = r.vapiSyncSuccess ? '✅' : '❌';
        const status = r.error ? `❌ ${r.error.substring(0, 25)}...` : '✅ PASS';

        const providerPadded = r.provider.padEnd(12);
        const namePadded = r.voiceName.substring(0, 30).padEnd(30);

        console.log(
            `${providerPadded} | ${namePadded} | ${dbSave}      | ${vpMatch}       | ${vapiSync}        | ${status}`
        );
    }

    // Calculate statistics
    const totalTests = results.length;
    const passedTests = results.filter(r =>
        !r.error &&
        r.dbSaveSuccess &&
        r.dbVoiceProvider === r.provider &&
        r.vapiSyncSuccess
    ).length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log('\n' + '='.repeat(100));
    console.log(`\n✅ Passed: ${passedTests}/${totalTests} tests (${successRate}%)`);

    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Voice provider system is working correctly.\n');
        process.exit(0);
    } else {
        const failedTests = totalTests - passedTests;
        console.log(`❌ Failed: ${failedTests}/${totalTests} tests`);
        console.log('⚠️  Some tests failed. Review errors above.\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(err => {
    console.error('❌ Test runner failed:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
});
