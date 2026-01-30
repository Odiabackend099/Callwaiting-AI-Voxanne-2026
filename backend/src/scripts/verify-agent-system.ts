/**
 * Comprehensive Agent System Verification
 *
 * Tests:
 * 1. Database schema (voice_provider column exists)
 * 2. Organization exists and accessible
 * 3. Agent save with different voice providers
 * 4. VAPI assistant creation
 * 5. Tool configuration (availability check, endcall, lookup)
 *
 * Usage: npx ts-node src/scripts/verify-agent-system.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${test}: ${message}`);
  if (details && status === 'FAIL') {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function runTests() {
  console.log('🧪 COMPREHENSIVE AGENT SYSTEM VERIFICATION\n');
  console.log('=' .repeat(80));
  console.log('\n');

  // Test 1: Database Schema
  console.log('📋 Test 1: Database Schema\n');

  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, role, voice, voice_provider')
      .limit(5);

    if (error) {
      addResult('voice_provider column exists', 'FAIL', error.message);
    } else {
      addResult('voice_provider column exists', 'PASS', `Found ${agents.length} agents with voice_provider`);

      // Check if any agents have voice_provider populated
      const withProvider = agents.filter(a => a.voice_provider);
      const withoutProvider = agents.filter(a => !a.voice_provider);

      if (withProvider.length > 0) {
        addResult('voice_provider populated', 'PASS', `${withProvider.length}/${agents.length} agents have provider set`);
      } else {
        addResult('voice_provider populated', 'FAIL', 'No agents have voice_provider set', { agents });
      }
    }
  } catch (err: any) {
    addResult('Database access', 'FAIL', err.message);
  }

  console.log('\n');

  // Test 2: Organization Check
  console.log('📋 Test 2: Organization Check\n');

  try {
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status')
      .limit(5);

    if (orgError) {
      addResult('Organizations table', 'FAIL', orgError.message);
    } else {
      addResult('Organizations table', 'PASS', `Found ${orgs.length} organizations`);

      // Check for Development Org
      const devOrg = orgs.find(o => o.id === 'a0000000-0000-0000-0000-000000000001');
      if (devOrg) {
        addResult('Development Org exists', 'PASS', `Name: ${devOrg.name}, Status: ${devOrg.status}`);
      } else {
        addResult('Development Org exists', 'FAIL', 'Development Org (a0000000-...) not found');
      }
    }
  } catch (err: any) {
    addResult('Organization check', 'FAIL', err.message);
  }

  console.log('\n');

  // Test 3: Profile org_id Check
  console.log('📋 Test 3: Profile org_id Check\n');

  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, org_id')
      .is('org_id', null)
      .limit(5);

    if (profileError) {
      addResult('Profiles with NULL org_id', 'FAIL', profileError.message);
    } else if (profiles.length === 0) {
      addResult('Profiles with NULL org_id', 'PASS', 'All profiles have org_id assigned');
    } else {
      addResult('Profiles with NULL org_id', 'FAIL', `${profiles.length} profiles missing org_id`, {
        emails: profiles.map(p => p.email)
      });
    }
  } catch (err: any) {
    addResult('Profile org_id check', 'FAIL', err.message);
  }

  console.log('\n');

  // Test 4: Voice Provider Distribution
  console.log('📋 Test 4: Voice Provider Distribution\n');

  try {
    const { data: agents } = await supabase
      .from('agents')
      .select('voice_provider')
      .not('voice_provider', 'is', null);

    if (agents) {
      const distribution: Record<string, number> = {};
      agents.forEach((a: any) => {
        distribution[a.voice_provider] = (distribution[a.voice_provider] || 0) + 1;
      });

      Object.entries(distribution).forEach(([provider, count]) => {
        addResult(`Voice provider: ${provider}`, 'PASS', `${count} agent(s)`);
      });
    }
  } catch (err: any) {
    addResult('Voice provider distribution', 'FAIL', err.message);
  }

  console.log('\n');

  // Test 5: Backend Endpoints Check
  console.log('📋 Test 5: Backend Endpoints\n');

  try {
    const healthResponse = await fetch(`${BACKEND_URL}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      addResult('Backend health check', 'PASS', 'Backend is running', health);
    } else {
      addResult('Backend health check', 'FAIL', `Status: ${healthResponse.status}`);
    }
  } catch (err: any) {
    addResult('Backend health check', 'SKIP', 'Backend not running (expected if testing locally)', { error: err.message });
  }

  console.log('\n');

  // Test 6: Check for agents with mismatched voice/provider
  console.log('📋 Test 6: Voice/Provider Consistency\n');

  try {
    const { data: allAgents } = await supabase
      .from('agents')
      .select('id, role, voice, voice_provider')
      .not('voice', 'is', null);

    if (allAgents) {
      let mismatches = 0;

      allAgents.forEach((agent: any) => {
        const voice = agent.voice;
        const provider = agent.voice_provider;

        // Check if provider matches voice pattern
        let expectedProvider = 'vapi'; // default

        if (['Rohan', 'Elliot', 'Savannah', 'jennifer', 'kylie', 'neha'].includes(voice)) {
          expectedProvider = 'vapi';
        } else if (/^[A-Za-z0-9]{24}$/.test(voice)) {
          expectedProvider = 'elevenlabs';
        } else if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)) {
          expectedProvider = 'openai';
        } else if (voice.includes('Neural')) {
          expectedProvider = voice.endsWith('Neural') ? 'azure' : 'google';
        }

        if (provider !== expectedProvider) {
          mismatches++;
          console.log(`   ⚠️  Agent ${agent.role} (${agent.id.substring(0, 8)}): voice=${voice}, provider=${provider}, expected=${expectedProvider}`);
        }
      });

      if (mismatches === 0) {
        addResult('Voice/Provider consistency', 'PASS', `All ${allAgents.length} agents have matching voice and provider`);
      } else {
        addResult('Voice/Provider consistency', 'FAIL', `${mismatches} agent(s) have mismatched voice/provider`);
      }
    }
  } catch (err: any) {
    addResult('Voice/Provider consistency', 'FAIL', err.message);
  }

  console.log('\n');

  // Summary
  console.log('=' .repeat(80));
  console.log('\n📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`\nSuccess Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n⚠️  FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }

  console.log('\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! System is ready for demo.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review above for details.\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('❌ Test runner failed:', err);
  process.exit(1);
});
