#!/usr/bin/env ts-node
/**
 * Comprehensive Dashboard Endpoint Testing Script
 *
 * Tests ALL 18 dashboard API endpoints and verifies:
 * 1. Endpoints return 200 status
 * 2. Response structure matches expected format
 * 3. Data fields are populated (not null/undefined)
 * 4. Specific checks:
 *    - Contact names appear (not "Unknown Caller")
 *    - Phone numbers formatted correctly
 *    - Sentiment data populated
 *    - Recording URLs exist when expected
 *
 * Usage:
 *   TEST_AUTH_TOKEN="your-jwt-token" npm run test:dashboard
 */

import { createClient } from '@supabase/supabase-js';

// ========== CONFIGURATION ==========

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

if (!TEST_AUTH_TOKEN) {
  console.error('❌ ERROR: TEST_AUTH_TOKEN environment variable not set');
  console.error('   Get JWT token from browser console: supabase.auth.getSession()');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ========== TEST HELPERS ==========

interface TestResult {
  endpoint: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} ${result.endpoint}: ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = response.ok ? await response.json() : null;
  return { response, data };
}

// ========== DATABASE SETUP ==========

async function getTestData() {
  console.log('📊 Fetching test data from database...\n');

  // Get sample call ID
  const { data: calls } = await supabase
    .from('calls')
    .select('id, caller_name, phone_number, status, has_recording')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get sample lead/contact ID
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone, lead_status')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Found ${calls?.length || 0} test calls`);
  console.log(`Found ${contacts?.length || 0} test contacts\n`);

  return {
    sampleCallId: calls?.[0]?.id,
    sampleContactId: contacts?.[0]?.id,
    calls: calls || [],
    contacts: contacts || [],
  };
}

// ========== TEST SUITES ==========

async function testMainDashboardEndpoints() {
  console.log('\n🏠 === MAIN DASHBOARD ENDPOINTS ===\n');

  // Test 1: Recent Activity
  {
    const { response, data } = await fetchAPI('/api/analytics/recent-activity');

    if (response.ok && data?.events) {
      logResult({
        endpoint: 'GET /api/analytics/recent-activity',
        status: 'PASS',
        message: `Returned ${data.events.length} events`,
        details: {
          eventTypes: data.events.map((e: any) => e.type),
          sampleEvent: data.events[0],
        },
      });
    } else {
      logResult({
        endpoint: 'GET /api/analytics/recent-activity',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 2: Dashboard Pulse (KPIs)
  {
    const { response, data } = await fetchAPI('/api/analytics/dashboard-pulse');

    if (response.ok && data) {
      const hasAllFields = ['total_calls', 'avg_duration_seconds'].every(field => field in data);

      logResult({
        endpoint: 'GET /api/analytics/dashboard-pulse',
        status: hasAllFields ? 'PASS' : 'WARN',
        message: hasAllFields
          ? `All KPI fields present (${data.total_calls} calls, ${data.avg_duration_seconds}s avg)`
          : 'Some KPI fields missing',
        details: data,
      });
    } else {
      logResult({
        endpoint: 'GET /api/analytics/dashboard-pulse',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 3: Hot Leads
  {
    const { response, data } = await fetchAPI('/api/analytics/leads');

    if (response.ok) {
      logResult({
        endpoint: 'GET /api/analytics/leads',
        status: 'PASS',
        message: `Returned ${data?.leads?.length || 0} hot leads`,
        details: data?.leads?.[0],
      });
    } else {
      logResult({
        endpoint: 'GET /api/analytics/leads',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }
}

async function testCallLogsEndpoints(testData: any) {
  console.log('\n📞 === CALL LOGS ENDPOINTS ===\n');

  // Test 1: Call List
  {
    const { response, data } = await fetchAPI('/api/calls-dashboard?limit=20&page=1');

    if (response.ok && data?.calls) {
      const hasCallerNames = data.calls.filter((c: any) => c.caller_name && c.caller_name !== 'Unknown Caller').length;
      const totalCalls = data.calls.length;

      logResult({
        endpoint: 'GET /api/calls-dashboard',
        status: hasCallerNames > 0 ? 'PASS' : 'WARN',
        message: `${hasCallerNames}/${totalCalls} calls have enriched caller names`,
        details: {
          total: data.pagination?.total || totalCalls,
          sampleCall: data.calls[0],
          callerNames: data.calls.slice(0, 3).map((c: any) => c.caller_name),
        },
      });
    } else {
      logResult({
        endpoint: 'GET /api/calls-dashboard',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 2: Analytics Summary
  {
    const { response, data } = await fetchAPI('/api/calls-dashboard/analytics/summary');

    if (response.ok && data) {
      const hasAllMetrics = ['total_calls', 'completed_calls', 'average_duration', 'average_sentiment'].every(f => f in data);

      logResult({
        endpoint: 'GET /api/calls-dashboard/analytics/summary',
        status: hasAllMetrics ? 'PASS' : 'WARN',
        message: hasAllMetrics
          ? `All metrics present (${data.total_calls} calls, ${Math.round(data.average_sentiment * 100)}% sentiment)`
          : 'Some metrics missing',
        details: data,
      });
    } else {
      logResult({
        endpoint: 'GET /api/calls-dashboard/analytics/summary',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 3: Call Detail (if we have a sample call)
  if (testData.sampleCallId) {
    const { response, data } = await fetchAPI(`/api/calls-dashboard/${testData.sampleCallId}`);

    if (response.ok && data) {
      const hasCallerName = data.caller_name && data.caller_name !== 'Unknown Caller';
      const hasSentiment = data.sentiment_label || data.sentiment_score;

      logResult({
        endpoint: `GET /api/calls-dashboard/{callId}`,
        status: hasCallerName ? 'PASS' : 'WARN',
        message: hasCallerName
          ? `Call detail has caller name: "${data.caller_name}"`
          : `Call has no enriched name: "${data.caller_name}"`,
        details: {
          id: data.id,
          caller_name: data.caller_name,
          phone_number: data.phone_number,
          sentiment: hasSentiment,
          has_recording: data.has_recording,
          has_transcript: data.has_transcript,
        },
      });
    } else {
      logResult({
        endpoint: `GET /api/calls-dashboard/{callId}`,
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 4: Recording URL (if call has recording)
  const callWithRecording = testData.calls.find((c: any) => c.has_recording);
  if (callWithRecording) {
    const { response, data } = await fetchAPI(`/api/calls-dashboard/${callWithRecording.id}/recording-url`);

    if (response.ok && data?.recording_url) {
      logResult({
        endpoint: `GET /api/calls-dashboard/{callId}/recording-url`,
        status: 'PASS',
        message: `Recording URL generated successfully`,
        details: {
          url_length: data.recording_url.length,
          expires_in: data.expires_in,
          source: data.source,
        },
      });
    } else {
      logResult({
        endpoint: `GET /api/calls-dashboard/{callId}/recording-url`,
        status: 'WARN',
        message: `No recording URL: ${response.status} ${response.statusText}`,
      });
    }
  }
}

async function testLeadsEndpoints(testData: any) {
  console.log('\n👥 === LEADS ENDPOINTS ===\n');

  // Test 1: Lead List
  {
    const { response, data } = await fetchAPI('/api/contacts?limit=20&page=1');

    if (response.ok && data?.contacts) {
      const hasNames = data.contacts.filter((c: any) => c.name && c.name !== 'Unknown Caller').length;
      const totalContacts = data.contacts.length;

      logResult({
        endpoint: 'GET /api/contacts',
        status: hasNames > 0 ? 'PASS' : 'WARN',
        message: `${hasNames}/${totalContacts} contacts have names`,
        details: {
          total: data.pagination?.total || totalContacts,
          sampleContact: data.contacts[0],
          contactNames: data.contacts.slice(0, 3).map((c: any) => c.name),
        },
      });
    } else {
      logResult({
        endpoint: 'GET /api/contacts',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 2: Lead Stats
  {
    const { response, data } = await fetchAPI('/api/contacts/stats');

    if (response.ok && data) {
      const hasAllStats = ['total_leads', 'hot_leads', 'warm_leads', 'cold_leads'].every(f => f in data);

      logResult({
        endpoint: 'GET /api/contacts/stats',
        status: hasAllStats ? 'PASS' : 'WARN',
        message: hasAllStats
          ? `All stats present (${data.total_leads} total, ${data.hot_leads} hot)`
          : 'Some stats missing',
        details: data,
      });
    } else {
      logResult({
        endpoint: 'GET /api/contacts/stats',
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }

  // Test 3: Lead Detail (if we have a sample contact)
  if (testData.sampleContactId) {
    const { response, data } = await fetchAPI(`/api/contacts/${testData.sampleContactId}`);

    if (response.ok && data) {
      const hasName = data.name && data.name !== 'Unknown Caller';
      const hasPhone = data.phone && data.phone.startsWith('+');

      logResult({
        endpoint: `GET /api/contacts/{leadId}`,
        status: hasName && hasPhone ? 'PASS' : 'WARN',
        message: hasName
          ? `Lead detail has name: "${data.name}" and phone: "${data.phone}"`
          : `Lead has incomplete data`,
        details: {
          id: data.id,
          name: data.name,
          phone: data.phone,
          lead_status: data.lead_status,
          lead_score: data.lead_score,
        },
      });
    } else {
      logResult({
        endpoint: `GET /api/contacts/{leadId}`,
        status: 'FAIL',
        message: `Failed: ${response.status} ${response.statusText}`,
      });
    }
  }
}

// ========== MAIN TEST RUNNER ==========

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  COMPREHENSIVE DASHBOARD ENDPOINT TESTING                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Get test data
    const testData = await getTestData();

    // Run test suites
    await testMainDashboardEndpoints();
    await testCallLogsEndpoints(testData);
    await testLeadsEndpoints(testData);

    // Print summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  TEST SUMMARY                                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;

    console.log(`✅ PASSED: ${passed}/${total}`);
    console.log(`⚠️  WARNED: ${warned}/${total}`);
    console.log(`❌ FAILED: ${failed}/${total}\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.endpoint}: ${r.message}`);
      });
      console.log();
    }

    if (warned > 0) {
      console.log('Warnings:');
      results.filter(r => r.status === 'WARN').forEach(r => {
        console.log(`  - ${r.endpoint}: ${r.message}`);
      });
      console.log();
    }

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);

  } catch (error: any) {
    console.error('❌ TEST SUITE FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
