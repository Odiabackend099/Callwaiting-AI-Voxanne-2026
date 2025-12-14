#!/usr/bin/env ts-node
/**
 * Production Readiness Check
 * 
 * Uses specialized sub-agents to verify the entire call flow:
 * 1. Database Agent - Verify leads, agents, integrations
 * 2. API Agent - Test /calls/start endpoint
 * 3. Vapi Agent - Verify Vapi resources exist
 * 4. Risk Agent - Identify production crash risks
 * 
 * Run: npx ts-node scripts/production-readiness-check.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const VAPI_API_KEY = process.env.VAPI_API_KEY!;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID!;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const vapiHeaders = {
  'Authorization': `Bearer ${VAPI_API_KEY}`,
  'Content-Type': 'application/json'
};

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
  data?: any;
}

const results: CheckResult[] = [];

function log(agent: string, msg: string) {
  console.log(`[${agent}] ${msg}`);
}

function addResult(result: CheckResult) {
  results.push(result);
  const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
  console.log(`  ${icon} ${result.name}: ${result.message}`);
  if (result.fix) {
    console.log(`     → Fix: ${result.fix}`);
  }
}

// ========== DATABASE AGENT ==========
async function runDatabaseAgent() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  DATABASE AGENT - Verifying data integrity                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check 1: Organizations exist
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(1);

  if (orgErr || !orgs || orgs.length === 0) {
    addResult({
      name: 'Organizations',
      status: 'fail',
      message: 'No organizations found',
      fix: 'Insert at least one organization into the organizations table'
    });
  } else {
    addResult({
      name: 'Organizations',
      status: 'pass',
      message: `Found org: ${orgs[0].id}`
    });
  }

  // Check 2: Outbound agent exists with vapi_assistant_id
  const { data: agents, error: agentErr } = await supabase
    .from('agents')
    .select('id, name, role, vapi_assistant_id')
    .eq('role', 'outbound')
    .limit(1);

  if (agentErr || !agents || agents.length === 0) {
    addResult({
      name: 'Outbound Agent',
      status: 'fail',
      message: 'No outbound agent found',
      fix: 'Create an agent with role="outbound" in the agents table'
    });
  } else if (!agents[0].vapi_assistant_id) {
    addResult({
      name: 'Outbound Agent',
      status: 'fail',
      message: 'Outbound agent has no vapi_assistant_id',
      fix: 'Run full-vapi-diagnostic.ts to create and wire an assistant'
    });
  } else {
    addResult({
      name: 'Outbound Agent',
      status: 'pass',
      message: `Agent "${agents[0].name}" has assistant ID: ${agents[0].vapi_assistant_id}`
    });
  }

  // Check 3: Leads with valid phone numbers
  const { data: leads, error: leadErr } = await supabase
    .from('leads')
    .select('id, name, contact_name, phone');

  if (leadErr || !leads) {
    addResult({
      name: 'Leads',
      status: 'fail',
      message: 'Could not fetch leads',
      fix: 'Check Supabase connection and leads table'
    });
  } else {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    const validLeads = leads.filter(l => l.phone && e164Regex.test(l.phone));
    const invalidLeads = leads.filter(l => !l.phone || !e164Regex.test(l.phone));

    addResult({
      name: 'Leads Total',
      status: 'pass',
      message: `${leads.length} leads in database`
    });

    if (invalidLeads.length > 0) {
      addResult({
        name: 'Leads Phone Validation',
        status: 'warn',
        message: `${invalidLeads.length} leads have invalid/missing phone numbers`,
        fix: 'Update these leads with E.164 format phones (+1234567890)',
        data: invalidLeads.slice(0, 5).map(l => ({
          id: l.id,
          name: l.name || l.contact_name,
          phone: l.phone || 'MISSING'
        }))
      });
    } else {
      addResult({
        name: 'Leads Phone Validation',
        status: 'pass',
        message: `All ${validLeads.length} leads have valid E.164 phone numbers`
      });
    }
  }

  // Check 4: Integrations have vapi config
  const { data: integrations, error: intErr } = await supabase
    .from('integrations')
    .select('id, provider, config')
    .eq('provider', 'vapi')
    .limit(1);

  if (intErr || !integrations || integrations.length === 0) {
    addResult({
      name: 'Vapi Integration',
      status: 'warn',
      message: 'No vapi integration row found (will use env vars)',
      fix: 'Optional: Create integrations row for vapi to store config in DB'
    });
  } else {
    const config = integrations[0].config as any;
    const hasKey = !!config?.vapi_api_key;
    const hasPhone = !!config?.vapi_phone_number_id;

    addResult({
      name: 'Vapi Integration',
      status: hasKey ? 'pass' : 'warn',
      message: `API key: ${hasKey ? 'set' : 'missing'}, Phone ID: ${hasPhone ? 'set' : 'missing'}`,
      fix: hasKey ? undefined : 'Backend will fall back to VAPI_API_KEY env var'
    });
  }
}

// ========== VAPI AGENT ==========
async function runVapiAgent() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  VAPI AGENT - Verifying Vapi resources                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check 1: API key works
  try {
    const res = await axios.get('https://api.vapi.ai/assistant?limit=1', {
      headers: vapiHeaders,
      timeout: 10000
    });
    addResult({
      name: 'Vapi API Key',
      status: 'pass',
      message: 'API key is valid and working'
    });
  } catch (err: any) {
    addResult({
      name: 'Vapi API Key',
      status: 'fail',
      message: `API key invalid: ${err.response?.data?.message || err.message}`,
      fix: 'Check VAPI_API_KEY in .env is the private key from Vapi dashboard'
    });
    return; // Can't continue without valid key
  }

  // Check 2: Phone number exists
  try {
    const res = await axios.get(`https://api.vapi.ai/phone-number/${VAPI_PHONE_NUMBER_ID}`, {
      headers: vapiHeaders,
      timeout: 10000
    });
    addResult({
      name: 'Vapi Phone Number',
      status: 'pass',
      message: `Phone ${res.data.number} exists (ID: ${VAPI_PHONE_NUMBER_ID})`
    });
  } catch (err: any) {
    addResult({
      name: 'Vapi Phone Number',
      status: 'fail',
      message: `Phone number ID not found: ${err.response?.data?.message || err.message}`,
      fix: 'Run setup-vapi-production.ts to create a phone number'
    });
  }

  // Check 3: Outbound agent's assistant exists in Vapi
  const { data: agents } = await supabase
    .from('agents')
    .select('vapi_assistant_id')
    .eq('role', 'outbound')
    .limit(1);

  if (agents && agents[0]?.vapi_assistant_id) {
    try {
      const res = await axios.get(`https://api.vapi.ai/assistant/${agents[0].vapi_assistant_id}`, {
        headers: vapiHeaders,
        timeout: 10000
      });
      addResult({
        name: 'Vapi Assistant',
        status: 'pass',
        message: `Assistant "${res.data.name}" exists (ID: ${agents[0].vapi_assistant_id})`
      });
    } catch (err: any) {
      addResult({
        name: 'Vapi Assistant',
        status: 'fail',
        message: `Assistant ID in DB does not exist in Vapi!`,
        fix: 'Run full-vapi-diagnostic.ts to create a new assistant and wire it'
      });
    }
  }
}

// ========== API AGENT ==========
async function runApiAgent() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  API AGENT - Testing /calls/start endpoint                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check 1: Backend is running
  try {
    const res = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    addResult({
      name: 'Backend Health',
      status: 'pass',
      message: `Backend is running at ${BACKEND_URL}`
    });
  } catch (err: any) {
    addResult({
      name: 'Backend Health',
      status: 'fail',
      message: `Backend not reachable at ${BACKEND_URL}`,
      fix: 'Start the backend with: cd backend && npm run dev'
    });
    return; // Can't continue
  }

  // Check 2: Test /calls/start with a valid lead (dry run - don't actually call)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, phone')
    .not('phone', 'is', null)
    .limit(1);

  if (!leads || leads.length === 0) {
    addResult({
      name: '/calls/start Endpoint',
      status: 'warn',
      message: 'No leads with phone numbers to test',
      fix: 'Add leads with valid E.164 phone numbers'
    });
    return;
  }

  // We'll test with a fake lead ID to verify the route logic without making a real call
  try {
    const res = await axios.post(`${BACKEND_URL}/api/founder-console/calls/start`, {
      leadId: 'test-invalid-id-12345'
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      validateStatus: () => true // Accept any status
    });

    if (res.status === 404 && res.data?.error?.includes('Lead not found')) {
      addResult({
        name: '/calls/start Endpoint',
        status: 'pass',
        message: 'Endpoint is working (correctly rejected invalid lead)'
      });
    } else if (res.status === 400) {
      addResult({
        name: '/calls/start Endpoint',
        status: 'pass',
        message: `Endpoint is working (returned 400: ${res.data?.error})`
      });
    } else {
      addResult({
        name: '/calls/start Endpoint',
        status: 'warn',
        message: `Unexpected response: ${res.status} - ${JSON.stringify(res.data).substring(0, 100)}`
      });
    }
  } catch (err: any) {
    addResult({
      name: '/calls/start Endpoint',
      status: 'fail',
      message: `Endpoint error: ${err.message}`,
      fix: 'Check backend logs for errors'
    });
  }
}

// ========== RISK AGENT ==========
async function runRiskAgent() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RISK AGENT - Identifying production crash risks           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const risks: { risk: string; severity: 'high' | 'medium' | 'low'; mitigation: string }[] = [];

  // Risk 1: Missing env vars in production
  const requiredEnvVars = ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missingEnv = requiredEnvVars.filter(v => !process.env[v]);
  if (missingEnv.length > 0) {
    risks.push({
      risk: `Missing env vars: ${missingEnv.join(', ')}`,
      severity: 'high',
      mitigation: 'Add these to your production environment (Render, etc.)'
    });
  }

  // Risk 2: Hardcoded localhost URLs
  if (process.env.BASE_URL?.includes('localhost') || process.env.RENDER_EXTERNAL_URL?.includes('localhost')) {
    risks.push({
      risk: 'BASE_URL or RENDER_EXTERNAL_URL contains localhost',
      severity: 'medium',
      mitigation: 'Update to production URL before deploying'
    });
  }

  // Risk 3: No error handling for Vapi rate limits
  risks.push({
    risk: 'Vapi has concurrency limits (currently 10 concurrent calls)',
    severity: 'low',
    mitigation: 'Implement queue/throttling for high-volume calling'
  });

  // Risk 4: Assistant ID mismatch
  const { data: agents } = await supabase
    .from('agents')
    .select('vapi_assistant_id')
    .eq('role', 'outbound')
    .limit(1);

  if (agents && agents[0]?.vapi_assistant_id) {
    try {
      await axios.get(`https://api.vapi.ai/assistant/${agents[0].vapi_assistant_id}`, {
        headers: vapiHeaders,
        timeout: 10000
      });
    } catch {
      risks.push({
        risk: 'Outbound agent vapi_assistant_id does not exist in Vapi',
        severity: 'high',
        mitigation: 'Run full-vapi-diagnostic.ts to create and wire a new assistant'
      });
    }
  }

  // Risk 5: Phone number not in Vapi
  try {
    await axios.get(`https://api.vapi.ai/phone-number/${VAPI_PHONE_NUMBER_ID}`, {
      headers: vapiHeaders,
      timeout: 10000
    });
  } catch {
    risks.push({
      risk: 'VAPI_PHONE_NUMBER_ID does not exist in Vapi',
      severity: 'high',
      mitigation: 'Run setup-vapi-production.ts to create a phone number'
    });
  }

  // Output risks
  if (risks.length === 0) {
    addResult({
      name: 'Production Risks',
      status: 'pass',
      message: 'No critical risks identified'
    });
  } else {
    risks.forEach(r => {
      addResult({
        name: `Risk: ${r.risk.substring(0, 50)}...`,
        status: r.severity === 'high' ? 'fail' : r.severity === 'medium' ? 'warn' : 'pass',
        message: r.risk,
        fix: r.mitigation
      });
    });
  }
}

// ========== MAIN ==========
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       PRODUCTION READINESS CHECK                           ║');
  console.log('║       Using Specialized Sub-Agents                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await runDatabaseAgent();
  await runVapiAgent();
  await runApiAgent();
  await runRiskAgent();

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      SUMMARY                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ⚠️  Warnings: ${warned}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n  ❌ NOT READY FOR PRODUCTION - Fix the failures above');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\n  ⚠️  READY WITH WARNINGS - Review warnings before production');
    process.exit(0);
  } else {
    console.log('\n  ✅ READY FOR PRODUCTION');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
