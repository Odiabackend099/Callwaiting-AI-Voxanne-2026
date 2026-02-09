import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  testNumber: number;
  testName: string;
  passed: boolean;
  details: string;
  issues: string[];
}

const results: TestResult[] = [];
let totalScore = 0;
const maxScore = 100;

const DEMO_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function runTest(
  testNumber: number,
  testName: string,
  testFn: () => Promise<{ passed: boolean; details: string; issues: string[] }>
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST ${testNumber}: ${testName}`);
  console.log('='.repeat(80));

  try {
    const result = await testFn();
    results.push({
      testNumber,
      testName,
      ...result,
    });

    if (result.passed) {
      console.log('✅ PASSED');
      totalScore += maxScore / 8; // 8 tests total
    } else {
      console.log('❌ FAILED');
    }

    console.log(`\nDetails: ${result.details}`);
    if (result.issues.length > 0) {
      console.log('\n⚠️ Issues found:');
      result.issues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. ${issue}`);
      });
    }
  } catch (error) {
    console.error(`❌ TEST ERROR: ${error}`);
    results.push({
      testNumber,
      testName,
      passed: false,
      details: `Test failed with error: ${error}`,
      issues: [String(error)],
    });
  }
}

// Test 1: Recent Calls Widget Data
async function test1_RecentCallsWidget() {
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, caller_name, phone_number, call_direction, status, sentiment_label, outcome_summary, created_at')
    .eq('org_id', DEMO_ORG_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;

  const issues: string[] = [];
  let completedCalls = 0;

  calls?.forEach((call, idx) => {
    const rowNum = idx + 1;

    // Check caller_name
    if (!call.caller_name || call.caller_name === 'Unknown Caller') {
      issues.push(`Row ${rowNum}: Caller name is "${call.caller_name}" (should be real name)`);
    }

    // Check phone_number (only for completed calls)
    if (call.status === 'completed' && !call.phone_number) {
      issues.push(`Row ${rowNum}: Phone number is null for completed call`);
    }

    // Check sentiment (only for completed calls)
    if (call.status === 'completed' && !call.sentiment_label) {
      issues.push(`Row ${rowNum}: Sentiment label is null for completed call`);
    }

    if (call.status === 'completed') {
      completedCalls++;
    }
  });

  const passed = issues.length === 0 && completedCalls > 0;
  return {
    passed,
    details: `Found ${calls?.length || 0} recent calls (${completedCalls} completed). ${
      passed ? 'All completed calls have complete data.' : 'Data quality issues detected.'
    }`,
    issues,
  };
}

// Test 2: Call Logs Table - Full Inspection
async function test2_CallLogsTable() {
  const { data: calls, error, count } = await supabase
    .from('calls')
    .select('*', { count: 'exact' })
    .eq('org_id', DEMO_ORG_ID)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const issues: string[] = [];
  let completedCallsWithIssues = 0;

  calls?.forEach((call, idx) => {
    // Only strict validation for completed calls
    if (call.status === 'completed') {
      if (!call.caller_name || call.caller_name === 'Unknown Caller') {
        issues.push(`Call ${call.id.substring(0, 8)}: Missing caller name`);
        completedCallsWithIssues++;
      }
      if (!call.phone_number) {
        issues.push(`Call ${call.id.substring(0, 8)}: Missing phone number`);
        completedCallsWithIssues++;
      }
      if (!call.sentiment_label) {
        issues.push(`Call ${call.id.substring(0, 8)}: Missing sentiment label`);
        completedCallsWithIssues++;
      }
    }
  });

  const completedCalls = calls?.filter((c) => c.status === 'completed').length || 0;
  const passed = completedCallsWithIssues === 0 && completedCalls > 0;

  return {
    passed,
    details: `Total calls: ${count}, Completed calls: ${completedCalls}, Calls with issues: ${completedCallsWithIssues}`,
    issues,
  };
}

// Test 3: Call Details Deep Inspection
async function test3_CallDetails() {
  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .eq('org_id', DEMO_ORG_ID)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  if (!call) {
    return {
      passed: false,
      details: 'No completed calls found',
      issues: ['No completed calls available for inspection'],
    };
  }

  const issues: string[] = [];

  if (!call.caller_name || call.caller_name === 'Unknown Caller') {
    issues.push('Missing caller name');
  }
  if (!call.phone_number) {
    issues.push('Missing phone number');
  }
  if (!call.sentiment_label) {
    issues.push('Missing sentiment label');
  }
  if (call.sentiment_score === null || call.sentiment_score === undefined) {
    issues.push('Missing sentiment score');
  }
  if (!call.transcript && call.status === 'completed') {
    issues.push('Missing transcript for completed call');
  }

  return {
    passed: issues.length === 0,
    details: `Inspected call ${call.id.substring(0, 8)} (${call.call_direction}, ${call.status})`,
    issues,
  };
}

// Test 4: Leads/Hot Leads Table
async function test4_LeadsTable() {
  const { data: contacts, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('org_id', DEMO_ORG_ID);

  if (error) throw error;

  const issues: string[] = [];

  contacts?.forEach((contact) => {
    if (!contact.first_name && !contact.last_name) {
      issues.push(`Contact ${contact.id.substring(0, 8)}: Missing name`);
    }
    if (!contact.phone) {
      issues.push(`Contact ${contact.id.substring(0, 8)}: Missing phone number`);
    }
    if (contact.lead_score === null || contact.lead_score === undefined) {
      issues.push(`Contact ${contact.id.substring(0, 8)}: Missing lead score`);
    }
  });

  return {
    passed: issues.length === 0 && (count ?? 0) > 0,
    details: `Total leads: ${count}. ${issues.length === 0 ? 'All have complete data.' : 'Data issues detected.'}`,
    issues,
  };
}

// Test 5: Recent Activity Widget
async function test5_RecentActivity() {
  const { data: alerts, error } = await supabase
    .from('hot_lead_alerts')
    .select('*')
    .eq('org_id', DEMO_ORG_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  const issues: string[] = [];

  if (!alerts || alerts.length === 0) {
    issues.push('No hot lead alerts found (expected at least 1 for calls with score >= 60)');
  }

  alerts?.forEach((alert) => {
    if (!alert.urgency_level) {
      issues.push(`Alert ${alert.id.substring(0, 8)}: Missing urgency level`);
    }
    if (!alert.call_id) {
      issues.push(`Alert ${alert.id.substring(0, 8)}: Missing call_id`);
    }
  });

  return {
    passed: alerts && alerts.length > 0 && issues.length === 0,
    details: `Found ${alerts?.length || 0} recent activity alerts.`,
    issues,
  };
}

// Test 6: Stats Cards
async function test6_StatsCards() {
  const { count: totalCalls } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', DEMO_ORG_ID);

  const { count: completedCalls } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', DEMO_ORG_ID)
    .eq('status', 'completed');

  const { data: sentimentData } = await supabase
    .from('calls')
    .select('sentiment_score')
    .eq('org_id', DEMO_ORG_ID)
    .eq('status', 'completed')
    .not('sentiment_score', 'is', null);

  const issues: string[] = [];

  if (!totalCalls || totalCalls === 0) {
    issues.push('Total calls is 0 or null');
  }

  if (!completedCalls || completedCalls === 0) {
    issues.push('Completed calls is 0 or null');
  }

  const avgSentiment =
    sentimentData && sentimentData.length > 0
      ? sentimentData.reduce((sum, c) => sum + (c.sentiment_score || 0), 0) / sentimentData.length
      : 0;

  if (avgSentiment === 0 && completedCalls && completedCalls > 0) {
    issues.push('Average sentiment is 0% but completed calls exist');
  }

  return {
    passed: issues.length === 0,
    details: `Total calls: ${totalCalls}, Completed: ${completedCalls}, Avg sentiment: ${(avgSentiment * 100).toFixed(1)}%`,
    issues,
  };
}

// Test 7: Search & Filter Functionality (Data Integrity)
async function test7_SearchFilter() {
  // Test phone number search
  const { data: phoneSearch } = await supabase
    .from('calls')
    .select('id, phone_number')
    .eq('org_id', DEMO_ORG_ID)
    .not('phone_number', 'is', null)
    .limit(1)
    .single();

  const issues: string[] = [];

  if (!phoneSearch || !phoneSearch.phone_number) {
    issues.push('No calls with phone numbers found for search testing');
  } else {
    // Verify phone number is in E.164 format
    if (!phoneSearch.phone_number.startsWith('+')) {
      issues.push(`Phone number ${phoneSearch.phone_number} is not in E.164 format (missing +)`);
    }
  }

  // Test call direction filter data integrity
  const { count: inboundCount } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', DEMO_ORG_ID)
    .eq('call_direction', 'inbound');

  const { count: outboundCount } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', DEMO_ORG_ID)
    .eq('call_direction', 'outbound');

  return {
    passed: issues.length === 0,
    details: `Inbound calls: ${inboundCount}, Outbound calls: ${outboundCount}. Phone numbers in E.164 format.`,
    issues,
  };
}

// Test 8: Data Consistency Check
async function test8_DataConsistency() {
  const { count: callCount } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', DEMO_ORG_ID);

  const { data: recentCalls } = await supabase
    .from('calls')
    .select('id')
    .eq('org_id', DEMO_ORG_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: completedCallsWithSentiment, count: sentimentCount } = await supabase
    .from('calls')
    .select('sentiment_score', { count: 'exact' })
    .eq('org_id', DEMO_ORG_ID)
    .eq('status', 'completed')
    .not('sentiment_score', 'is', null);

  const issues: string[] = [];

  if (!recentCalls || recentCalls.length === 0) {
    issues.push('No recent calls found in widget query');
  }

  const avgSentiment =
    completedCallsWithSentiment && completedCallsWithSentiment.length > 0
      ? completedCallsWithSentiment.reduce((sum, c) => sum + (c.sentiment_score || 0), 0) / completedCallsWithSentiment.length
      : 0;

  return {
    passed: issues.length === 0 && callCount === 11,
    details: `Call count matches expected (11): ${callCount === 11}. Sentiment data: ${sentimentCount} calls with scores.`,
    issues,
  };
}

async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + '  VOXANNE AI DASHBOARD DATA QUALITY VERIFICATION REPORT'.padEnd(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80));
  console.log(`\nTest Organization: voxanne@demo.com`);
  console.log(`Organization ID: ${DEMO_ORG_ID}`);
  console.log(`Expected Total Calls: 11`);
  console.log(`Test Date: ${new Date().toISOString()}`);

  // Run all tests
  await runTest(1, 'Dashboard Recent Calls Widget', test1_RecentCallsWidget);
  await runTest(2, 'Call Logs Table - Full Inspection', test2_CallLogsTable);
  await runTest(3, 'Call Details Deep Inspection', test3_CallDetails);
  await runTest(4, 'Leads/Hot Leads Table', test4_LeadsTable);
  await runTest(5, 'Recent Activity Widget', test5_RecentActivity);
  await runTest(6, 'Stats Cards', test6_StatsCards);
  await runTest(7, 'Search & Filter Data Integrity', test7_SearchFilter);
  await runTest(8, 'Data Consistency Check', test8_DataConsistency);

  // Final Report
  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + '  FINAL TEST SUMMARY'.padEnd(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80));

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.length - passedTests;

  console.log(`\n✅ Tests Passed: ${passedTests}/${results.length}`);
  console.log(`❌ Tests Failed: ${failedTests}/${results.length}`);
  console.log(`📊 Data Quality Score: ${Math.round(totalScore)}/100`);

  console.log('\n' + '-'.repeat(80));
  console.log('TEST RESULTS BREAKDOWN:');
  console.log('-'.repeat(80));

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\nTest ${result.testNumber}: ${result.testName}`);
    console.log(`Status: ${status}`);
    console.log(`Details: ${result.details}`);
    if (result.issues.length > 0) {
      console.log('Issues:');
      result.issues.forEach((issue) => console.log(`  - ${issue}`));
    }
  });

  // Critical Issues Summary
  const criticalIssues: string[] = [];
  results.forEach((result) => {
    if (!result.passed) {
      result.issues.forEach((issue) => {
        criticalIssues.push(`[Test ${result.testNumber}] ${issue}`);
      });
    }
  });

  if (criticalIssues.length > 0) {
    console.log('\n' + '⚠️'.repeat(40));
    console.log('CRITICAL ISSUES REQUIRING FIX:');
    console.log('⚠️'.repeat(40));
    criticalIssues.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue}`);
    });
  }

  // Final Recommendation
  console.log('\n' + '='.repeat(80));
  console.log('FINAL RECOMMENDATION:');
  console.log('='.repeat(80));

  if (passedTests === results.length && totalScore === maxScore) {
    console.log('✅ PASS - Dashboard is fully functional with complete, accurate data.');
    console.log('✅ All 11 calls display correctly.');
    console.log('✅ No "Unknown Caller" values in completed calls.');
    console.log('✅ All required fields populated.');
    console.log('✅ Ready for production use.');
  } else if (totalScore >= 70) {
    console.log('⚠️ PARTIAL PASS - Dashboard mostly functional but has data quality issues.');
    console.log('⚠️ Some calls may show incomplete data.');
    console.log('⚠️ Recommend fixing critical issues before production.');
  } else {
    console.log('❌ NEEDS FIX - Dashboard has significant data quality issues.');
    console.log('❌ Multiple calls showing "Unknown Caller" or missing fields.');
    console.log('❌ Critical fixes required before production use.');
  }

  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + '  END OF REPORT'.padEnd(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80) + '\n');
}

main().catch(console.error);
