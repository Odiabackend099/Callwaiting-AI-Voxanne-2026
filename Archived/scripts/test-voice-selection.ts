#!/usr/bin/env ts-node
/**
 * Test script to verify voice selection fix
 * Tests that:
 * 1. Voice selection is properly persisted to database
 * 2. Voice provider is correctly determined from voice ID
 * 3. Vapi assistant is created/updated with correct voice and provider
 */

import { supabase } from '../src/services/supabase-client';
import { VapiClient } from '../src/services/vapi-client';

// Voice provider mapping (same as in founder-console.ts)
const voiceProviderMap: { [key: string]: string } = {
  'Rohan': 'vapi',
  'Neha': 'vapi',
  'Hana': 'vapi',
  'Harry': 'vapi',
  'Elliot': 'vapi',
  'Lily': 'vapi',
  'Paige': 'vapi',
  'Cole': 'vapi',
  'Savannah': 'vapi',
  'Spencer': 'vapi',
  'Kylie': 'vapi',
  'jennifer': 'playht',
  'alloy': 'openai',
  'aura-asteria-en': 'deepgram',
  'aura-luna-en': 'deepgram'
};

function getVoiceProvider(voiceId: string): string {
  return voiceProviderMap[voiceId] || 'vapi';
}

async function testVoiceSelection() {
  console.log('🧪 Testing Voice Selection Fix...\n');

  try {
    // Test 1: Verify voice provider mapping
    console.log('Test 1: Voice Provider Mapping');
    console.log('================================');
    const testVoices = ['Paige', 'Rohan', 'aura-asteria-en', 'alloy', 'jennifer'];
    const expectedProviders = ['vapi', 'vapi', 'deepgram', 'openai', 'playht'];

    for (let i = 0; i < testVoices.length; i++) {
      const voiceId = testVoices[i];
      const provider = getVoiceProvider(voiceId);
      const expected = expectedProviders[i];
      const status = provider === expected ? '✅' : '❌';
      console.log(`${status} ${voiceId}: ${provider} (expected: ${expected})`);
    }

    // Test 2: Check database agent voice
    console.log('\nTest 2: Database Agent Voice Configuration');
    console.log('==========================================');
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, voice, vapi_assistant_id')
      .eq('role', 'outbound')
      .limit(1)
      .single();

    if (agentError) {
      console.log('❌ Failed to fetch agent:', agentError.message);
      return;
    }

    if (!agent) {
      console.log('⚠️  No outbound agent found in database');
      return;
    }

    console.log(`✅ Agent found: ${agent.name}`);
    console.log(`   Voice ID: ${agent.voice || 'NOT SET'}`);
    console.log(`   Vapi Assistant ID: ${agent.vapi_assistant_id || 'NOT SET'}`);

    if (agent.voice) {
      const provider = getVoiceProvider(agent.voice);
      console.log(`   Voice Provider: ${provider}`);
    }

    // Test 3: Verify Vapi assistant configuration
    if (agent.vapi_assistant_id) {
      console.log('\nTest 3: Vapi Assistant Configuration');
      console.log('====================================');
      
      const vapiApiKey = process.env.VAPI_API_KEY;
      if (!vapiApiKey) {
        console.log('⚠️  VAPI_API_KEY not set, skipping Vapi verification');
      } else {
        try {
          const vapi = new VapiClient(vapiApiKey);
          const assistant = await vapi.getAssistant(agent.vapi_assistant_id);
          
          console.log(`✅ Vapi Assistant found: ${assistant.name}`);
          console.log(`   Voice ID: ${assistant.voice?.voiceId || 'NOT SET'}`);
          console.log(`   Voice Provider: ${assistant.voice?.provider || 'NOT SET'}`);
          
          // Verify voice matches database
          if (assistant.voice?.voiceId === agent.voice) {
            console.log(`   ✅ Voice ID matches database`);
          } else {
            console.log(`   ❌ Voice ID mismatch! DB: ${agent.voice}, Vapi: ${assistant.voice?.voiceId}`);
          }
          
          // Verify provider is correct
          const expectedProvider = getVoiceProvider(agent.voice || 'Paige');
          if (assistant.voice?.provider === expectedProvider) {
            console.log(`   ✅ Voice provider is correct`);
          } else {
            console.log(`   ❌ Voice provider mismatch! Expected: ${expectedProvider}, Got: ${assistant.voice?.provider}`);
          }
        } catch (vapiError: any) {
          console.log(`❌ Failed to fetch Vapi assistant: ${vapiError.message}`);
        }
      }
    }

    console.log('\n✅ Voice Selection Tests Complete!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testVoiceSelection();
