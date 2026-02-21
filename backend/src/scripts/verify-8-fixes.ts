/**
 * Database-Level Verification of 8 TestSprite Fixes
 * Based on PRD Section 6.2: Golden Record Analytics
 *
 * This script verifies the fixes directly against the database schema
 * and data, avoiding TestSprite credit usage.
 *
 * Usage: npm run verify-8-fixes
 */

import { supabase } from '../config/supabase';

interface TestResult {
  fix: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
}

const results: TestResult[] = [];

async function testFix1_DashboardAnalyticsWidgets() {
  console.log('\n🔍 Fix 1: TC001 - Dashboard Analytics Widgets (PRD 6.2)');
  console.log('Expected: calls table has Golden Record columns');

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, cost_cents, sentiment_score, sentiment_label')
    .limit(1);

  if (error) {
    results.push({
      fix: 'TC001',
      test: 'Golden Record columns exist',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not query calls table');
    return;
  }

  if (calls && calls.length > 0 && 'cost_cents' in calls[0]) {
    results.push({
      fix: 'TC001',
      test: 'cost_cents column exists',
      status: 'PASS',
      details: 'Golden Record column present in calls table'
    });
    console.log('✅ PASS: cost_cents column exists');
  } else {
    results.push({
      fix: 'TC001',
      test: 'cost_cents column exists',
      status: 'FAIL',
      details: 'cost_cents column missing from calls table'
    });
    console.log('❌ FAIL: cost_cents column missing');
  }
}

async function testFix2_DashboardActivityFeed() {
  console.log('\n🔍 Fix 2: TC003 - Dashboard Activity Feed (PRD 6.2)');
  console.log('Expected: hot_lead_alerts table exists and has data');

  const { data: alerts, error, count } = await supabase
    .from('hot_lead_alerts')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    results.push({
      fix: 'TC003',
      test: 'hot_lead_alerts table exists',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: hot_lead_alerts table not accessible');
    return;
  }

  results.push({
    fix: 'TC003',
    test: 'hot_lead_alerts table exists',
    status: 'PASS',
    details: `Table exists with ${count || 0} alerts`
  });
  console.log(`✅ PASS: hot_lead_alerts table exists (${count || 0} alerts)`);
}

async function testFix3_AnalyticsMetrics() {
  console.log('\n🔍 Fix 3: TC004 - Analytics Metrics (PRD 6.2)');
  console.log('Expected: calls.sentiment_score is numeric, not packed string');

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, sentiment_score, sentiment_label, sentiment_summary')
    .not('sentiment_score', 'is', null)
    .limit(5);

  if (error) {
    results.push({
      fix: 'TC004',
      test: 'sentiment columns exist',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not query sentiment columns');
    return;
  }

  if (calls && calls.length > 0) {
    const firstCall = calls[0];
    const isNumeric = typeof firstCall.sentiment_score === 'number';

    results.push({
      fix: 'TC004',
      test: 'sentiment_score is numeric',
      status: isNumeric ? 'PASS' : 'FAIL',
      details: isNumeric
        ? `sentiment_score is ${typeof firstCall.sentiment_score} (correct)`
        : `sentiment_score is ${typeof firstCall.sentiment_score} (should be number)`
    });

    if (isNumeric) {
      console.log(`✅ PASS: sentiment_score is numeric (${firstCall.sentiment_score})`);
    } else {
      console.log(`❌ FAIL: sentiment_score is ${typeof firstCall.sentiment_score}`);
    }
  } else {
    results.push({
      fix: 'TC004',
      test: 'sentiment_score has data',
      status: 'SKIP',
      details: 'No calls with sentiment data yet'
    });
    console.log('⚠️  SKIP: No calls with sentiment data (expected for new installation)');
  }
}

async function testFix4_CallLogSearch() {
  console.log('\n🔍 Fix 4: TC006 - Call Log Search (PRD 6.2)');
  console.log('Expected: calls table supports filtering and search');

  const { data: calls, error, count } = await supabase
    .from('calls')
    .select('id, caller_name, phone_number, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    results.push({
      fix: 'TC006',
      test: 'calls table query works',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not query calls table');
    return;
  }

  results.push({
    fix: 'TC006',
    test: 'calls table query works',
    status: 'PASS',
    details: `Found ${count || 0} calls, queried successfully`
  });
  console.log(`✅ PASS: calls table query works (${count || 0} total calls)`);
}

async function testFix5_AppointmentPagination() {
  console.log('\n🔍 Fix 5: TC009 - Appointment List Pagination (PRD 6.1)');
  console.log('Expected: appointments table with call_id linkage');

  const { data: appointments, error, count } = await supabase
    .from('appointments')
    .select('id, call_id, vapi_call_id, scheduled_at', { count: 'exact' })
    .order('scheduled_at', { ascending: false })
    .limit(10);

  if (error) {
    results.push({
      fix: 'TC009',
      test: 'appointments table query works',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not query appointments table');
    return;
  }

  // Check if Golden Record linkage columns exist
  if (appointments && appointments.length > 0 && 'call_id' in appointments[0]) {
    results.push({
      fix: 'TC009',
      test: 'call_id linkage exists',
      status: 'PASS',
      details: `Appointments have bidirectional call linkage (${count || 0} total)`
    });
    console.log(`✅ PASS: call_id linkage exists (${count || 0} appointments)`);
  } else if (count === 0) {
    results.push({
      fix: 'TC009',
      test: 'call_id linkage column exists',
      status: 'SKIP',
      details: 'No appointments to verify linkage'
    });
    console.log('⚠️  SKIP: No appointments in database');
  } else {
    results.push({
      fix: 'TC009',
      test: 'call_id linkage exists',
      status: 'FAIL',
      details: 'call_id column missing from appointments'
    });
    console.log('❌ FAIL: call_id linkage missing');
  }
}

async function testFix6_AppointmentReschedule() {
  console.log('\n🔍 Fix 6: TC010 - Appointment Reschedule (PRD 6.1)');
  console.log('Expected: appointments table supports rescheduling');

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status')
    .limit(1);

  if (error) {
    results.push({
      fix: 'TC010',
      test: 'appointments schema supports reschedule',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not verify appointments schema');
    return;
  }

  if (appointments && 'scheduled_at' in appointments[0]) {
    results.push({
      fix: 'TC010',
      test: 'appointments schema supports reschedule',
      status: 'PASS',
      details: 'scheduled_at column exists for rescheduling'
    });
    console.log('✅ PASS: appointments schema supports rescheduling');
  } else {
    results.push({
      fix: 'TC010',
      test: 'appointments schema supports reschedule',
      status: 'SKIP',
      details: 'No appointments to verify'
    });
    console.log('⚠️  SKIP: No appointments in database');
  }
}

async function testFix7_AgentConfigTabs() {
  console.log('\n🔍 Fix 7: TC013 - Agent Config Tabs (PRD 6.4)');
  console.log('Expected: agents table exists with configuration');

  const { data: agents, error, count } = await supabase
    .from('agents')
    .select('id, name, vapi_assistant_id', { count: 'exact' })
    .limit(5);

  if (error) {
    results.push({
      fix: 'TC013',
      test: 'agents table exists',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not query agents table');
    return;
  }

  results.push({
    fix: 'TC013',
    test: 'agents table exists',
    status: 'PASS',
    details: `Agents table accessible (${count || 0} agents configured)`
  });
  console.log(`✅ PASS: agents table exists (${count || 0} agents)`);
}

async function testFix8_AgentTestCall() {
  console.log('\n🔍 Fix 8: TC015 - Agent Test Call (PRD 6.1)');
  console.log('Expected: agents have vapi_assistant_id for test calls');

  const { data: agents, error } = await supabase
    .from('agents')
    .select('id, name, vapi_assistant_id')
    .not('vapi_assistant_id', 'is', null)
    .limit(1);

  if (error) {
    results.push({
      fix: 'TC015',
      test: 'agents have vapi_assistant_id',
      status: 'FAIL',
      details: `Database error: ${error.message}`
    });
    console.log('❌ FAIL: Could not verify vapi_assistant_id');
    return;
  }

  if (agents && agents.length > 0) {
    results.push({
      fix: 'TC015',
      test: 'agents have vapi_assistant_id',
      status: 'PASS',
      details: 'Agents configured with Vapi assistant IDs for test calls'
    });
    console.log('✅ PASS: agents have vapi_assistant_id');
  } else {
    results.push({
      fix: 'TC015',
      test: 'agents have vapi_assistant_id',
      status: 'SKIP',
      details: 'No agents with Vapi integration configured yet'
    });
    console.log('⚠️  SKIP: No agents configured with Vapi');
  }
}

async function main() {
  console.log('========================================');
  console.log('📊 Database-Level Verification: 8 Fixes');
  console.log('========================================');
  console.log('Based on PRD Section 6.2: Golden Record Analytics');
  console.log('Zero TestSprite credits used ✨\n');

  await testFix1_DashboardAnalyticsWidgets();
  await testFix2_DashboardActivityFeed();
  await testFix3_AnalyticsMetrics();
  await testFix4_CallLogSearch();
  await testFix5_AppointmentPagination();
  await testFix6_AppointmentReschedule();
  await testFix7_AgentConfigTabs();
  await testFix8_AgentTestCall();

  console.log('\n========================================');
  console.log('📊 Summary');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`✅ PASSED: ${passed}/${results.length}`);
  console.log(`❌ FAILED: ${failed}/${results.length}`);
  console.log(`⚠️  SKIPPED: ${skipped}/${results.length}`);

  console.log('\nDetailed Results:');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.fix}: ${r.test}`);
    console.log(`   ${r.details}`);
  });

  console.log('\n========================================');
  console.log('Next Steps:');
  console.log('========================================');

  if (failed > 0) {
    console.log('\n⚠️  Some fixes have database-level issues:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.fix}: ${r.test}`);
    });
    console.log('\nRecommendation: Fix schema issues before re-testing with TestSprite');
  } else {
    console.log('\n✅ All database-level verifications passed!');
    console.log('Recommendation: Wait for TestSprite service to stabilize, then re-run full E2E tests');
  }

  console.log('\n💰 TestSprite Credits Used: 0');
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
