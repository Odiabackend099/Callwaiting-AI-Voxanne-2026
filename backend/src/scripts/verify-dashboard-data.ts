/**
 * Dashboard Data Verification Script
 *
 * Comprehensive check of all dashboard data quality
 * - Caller names enrichment
 * - Contact names
 * - Sentiment data
 * - Hot lead alerts
 * - Phone number formatting
 * - Recording URLs
 * - Sample data verification
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function logResult(check: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
  results.push({ check, status, message, details });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ ';
  console.log(`${emoji} ${status}: ${check} - ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Check 1: Caller Names
async function checkCallerNames() {
  const query = `
    SELECT
      COUNT(*) as total_calls,
      COUNT(CASE WHEN caller_name IS NOT NULL AND caller_name != 'Unknown Caller' THEN 1 END) as calls_with_names,
      COUNT(CASE WHEN caller_name = 'Unknown Caller' OR caller_name IS NULL THEN 1 END) as unknown_callers
    FROM calls
    WHERE created_at > NOW() - INTERVAL '7 days'
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });

  if (error) {
    // Try direct query
    const { data: callsData, error: callsError } = await supabase
      .from('calls')
      .select('caller_name')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (callsError) {
      await logResult('Caller Names', 'FAIL', `Database query failed: ${callsError.message}`);
      return;
    }

    const totalCalls = callsData.length;
    const callsWithNames = callsData.filter(c => c.caller_name && c.caller_name !== 'Unknown Caller').length;
    const unknownCallers = totalCalls - callsWithNames;

    const details = { total_calls: totalCalls, calls_with_names: callsWithNames, unknown_callers: unknownCallers };

    if (totalCalls === 0) {
      await logResult('Caller Names', 'WARN', 'No calls in the last 7 days', details);
    } else if (callsWithNames === 0) {
      await logResult('Caller Names', 'FAIL', 'ALL calls are "Unknown Caller" - enrichment broken', details);
    } else if (callsWithNames / totalCalls < 0.5) {
      await logResult('Caller Names', 'WARN', `Low enrichment rate: ${Math.round(callsWithNames / totalCalls * 100)}%`, details);
    } else {
      await logResult('Caller Names', 'PASS', `${callsWithNames}/${totalCalls} calls have enriched names`, details);
    }
  }
}

// Check 2: Contact Names
async function checkContactNames() {
  const { data: contactsData, error } = await supabase
    .from('contacts')
    .select('name')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Contact Names', 'FAIL', `Database query failed: ${error.message}`);
    return;
  }

  const totalContacts = contactsData.length;
  const contactsWithNames = contactsData.filter(c => c.name && c.name !== 'Unknown Caller').length;

  const details = { total_contacts: totalContacts, contacts_with_names: contactsWithNames };

  if (totalContacts === 0) {
    await logResult('Contact Names', 'WARN', 'No contacts in the last 7 days', details);
  } else if (contactsWithNames === 0) {
    await logResult('Contact Names', 'FAIL', 'ALL contacts have no names', details);
  } else {
    await logResult('Contact Names', 'PASS', `${contactsWithNames}/${totalContacts} contacts have names`, details);
  }
}

// Check 3: Sentiment Data
async function checkSentimentData() {
  const { data: callsData, error } = await supabase
    .from('calls')
    .select('sentiment_label, sentiment_score')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Sentiment Data', 'FAIL', `Database query failed: ${error.message}`);
    return;
  }

  const totalCalls = callsData.length;
  const callsWithSentimentLabel = callsData.filter(c => c.sentiment_label).length;
  const callsWithSentimentScore = callsData.filter(c => c.sentiment_score !== null && c.sentiment_score !== undefined).length;

  const scores = callsData.filter(c => c.sentiment_score !== null).map(c => c.sentiment_score);
  const avgSentimentScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const details = {
    total_calls: totalCalls,
    calls_with_sentiment_label: callsWithSentimentLabel,
    calls_with_sentiment_score: callsWithSentimentScore,
    avg_sentiment_score: avgSentimentScore.toFixed(2),
  };

  if (totalCalls === 0) {
    await logResult('Sentiment Data', 'WARN', 'No calls in the last 7 days', details);
  } else if (avgSentimentScore === 0 && totalCalls > 0) {
    await logResult('Sentiment Data', 'FAIL', 'Average sentiment is 0% - sentiment analysis BROKEN', details);
  } else if (callsWithSentimentScore === 0) {
    await logResult('Sentiment Data', 'FAIL', 'No calls have sentiment scores', details);
  } else {
    await logResult('Sentiment Data', 'PASS', `Avg sentiment: ${(avgSentimentScore * 100).toFixed(1)}%, ${callsWithSentimentScore}/${totalCalls} calls scored`, details);
  }
}

// Check 4: Hot Lead Alerts
async function checkHotLeadAlerts() {
  const { data: alertsData, error } = await supabase
    .from('hot_lead_alerts')
    .select('lead_score')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Hot Lead Alerts', 'FAIL', `Database query failed: ${error.message}`);
    return;
  }

  const totalAlerts = alertsData.length;
  const alertsAboveThreshold = alertsData.filter(a => a.lead_score >= 60).length;

  const details = { total_alerts: totalAlerts, alerts_above_threshold: alertsAboveThreshold };

  if (totalAlerts === 0) {
    await logResult('Hot Lead Alerts', 'WARN', 'No hot lead alerts in the last 7 days', details);
  } else {
    await logResult('Hot Lead Alerts', 'PASS', `${totalAlerts} alerts found (${alertsAboveThreshold} above threshold)`, details);
  }
}

// Check 5: Phone Numbers
async function checkPhoneNumbers() {
  const { data: callsData, error } = await supabase
    .from('calls')
    .select('phone_number')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Phone Numbers', 'FAIL', `Database query failed: ${error.message}`);
    return;
  }

  const total = callsData.length;
  const e164Format = callsData.filter(c => c.phone_number && c.phone_number.startsWith('+')).length;

  const details = { total, e164_format: e164Format };

  if (total === 0) {
    await logResult('Phone Numbers', 'WARN', 'No calls in the last 7 days', details);
  } else if (e164Format !== total) {
    await logResult('Phone Numbers', 'FAIL', `${total - e164Format}/${total} phone numbers NOT in E.164 format`, details);
  } else {
    await logResult('Phone Numbers', 'PASS', `All ${total} phone numbers in E.164 format`, details);
  }
}

// Check 6: Recording URLs
async function checkRecordingUrls() {
  const { data: callsData, error } = await supabase
    .from('calls')
    .select('recording_url, recording_storage_path, status')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .eq('status', 'completed');

  if (error) {
    await logResult('Recording URLs', 'FAIL', `Database query failed: ${error.message}`);
    return;
  }

  const total = callsData.length;
  const withRecordingUrl = callsData.filter(c => c.recording_url).length;
  const withStoragePath = callsData.filter(c => c.recording_storage_path).length;

  const details = { total, with_recording_url: withRecordingUrl, with_storage_path: withStoragePath };

  if (total === 0) {
    await logResult('Recording URLs', 'WARN', 'No completed calls in the last 7 days', details);
  } else if (withRecordingUrl === 0 && withStoragePath === 0) {
    await logResult('Recording URLs', 'WARN', 'No recordings found (may be expected)', details);
  } else {
    await logResult('Recording URLs', 'PASS', `${withRecordingUrl} URLs, ${withStoragePath} storage paths`, details);
  }
}

// Check 7: Sample Data
async function checkSampleData() {
  const { data: sampleData, error } = await supabase
    .from('calls')
    .select('id, caller_name, phone_number, sentiment_label, sentiment_score, call_direction, status')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    await logResult('Sample Data', 'FAIL', `Database query failed: ${error.message}`);
    return;
  }

  if (!sampleData || sampleData.length === 0) {
    await logResult('Sample Data', 'WARN', 'No calls found in database', {});
  } else {
    await logResult('Sample Data', 'PASS', `Retrieved ${sampleData.length} recent calls`, sampleData);
  }
}

// Check 8: Database Connectivity
async function checkDatabaseConnectivity() {
  const { data, error } = await supabase
    .from('calls')
    .select('count')
    .limit(1);

  if (error) {
    await logResult('Database Connectivity', 'FAIL', `Cannot connect to database: ${error.message}`);
  } else {
    await logResult('Database Connectivity', 'PASS', 'Successfully connected to Supabase');
  }
}

// Check 9: Calls Table Structure
async function checkCallsTableStructure() {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .limit(1);

  if (error) {
    await logResult('Calls Table Structure', 'FAIL', `Cannot query calls table: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Calls Table Structure', 'WARN', 'Calls table exists but is empty', {});
  } else {
    const columns = Object.keys(data[0]);
    const criticalColumns = ['caller_name', 'sentiment_label', 'sentiment_score', 'phone_number', 'recording_url'];
    const missingColumns = criticalColumns.filter(col => !columns.includes(col));

    if (missingColumns.length > 0) {
      await logResult('Calls Table Structure', 'FAIL', `Missing critical columns: ${missingColumns.join(', ')}`, { columns });
    } else {
      await logResult('Calls Table Structure', 'PASS', `All critical columns present`, { columns });
    }
  }
}

// Check 10: Contacts Table Structure
async function checkContactsTableStructure() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);

  if (error) {
    await logResult('Contacts Table Structure', 'FAIL', `Cannot query contacts table: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Contacts Table Structure', 'WARN', 'Contacts table exists but is empty', {});
  } else {
    const columns = Object.keys(data[0]);
    await logResult('Contacts Table Structure', 'PASS', `Contacts table accessible`, { columns });
  }
}

// Check 11: Hot Lead Alerts Table
async function checkHotLeadAlertsTable() {
  const { data, error } = await supabase
    .from('hot_lead_alerts')
    .select('*')
    .limit(1);

  if (error) {
    await logResult('Hot Lead Alerts Table', 'FAIL', `Cannot query hot_lead_alerts table: ${error.message}`);
  } else {
    await logResult('Hot Lead Alerts Table', 'PASS', 'Hot lead alerts table accessible');
  }
}

// Check 12: Total Call Volume
async function checkTotalCallVolume() {
  const { count, error } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true });

  if (error) {
    await logResult('Total Call Volume', 'FAIL', `Cannot count calls: ${error.message}`);
  } else {
    await logResult('Total Call Volume', 'PASS', `Total calls in database: ${count}`, { count });
  }
}

// Check 13: Call Status Distribution
async function checkCallStatusDistribution() {
  const { data, error } = await supabase
    .from('calls')
    .select('status')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Call Status Distribution', 'FAIL', `Cannot query call statuses: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Call Status Distribution', 'WARN', 'No calls in the last 7 days', {});
  } else {
    const statusCounts: Record<string, number> = {};
    data.forEach(call => {
      const status = call.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    await logResult('Call Status Distribution', 'PASS', `Call statuses in last 7 days`, statusCounts);
  }
}

// Check 14: Call Direction Distribution
async function checkCallDirectionDistribution() {
  const { data, error } = await supabase
    .from('calls')
    .select('call_direction')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Call Direction Distribution', 'FAIL', `Cannot query call directions: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Call Direction Distribution', 'WARN', 'No calls in the last 7 days', {});
  } else {
    const directionCounts: Record<string, number> = {};
    data.forEach(call => {
      const direction = call.call_direction || 'unknown';
      directionCounts[direction] = (directionCounts[direction] || 0) + 1;
    });

    await logResult('Call Direction Distribution', 'PASS', `Call directions in last 7 days`, directionCounts);
  }
}

// Check 15: Recent Call Activity
async function checkRecentCallActivity() {
  const { data, error } = await supabase
    .from('calls')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    await logResult('Recent Call Activity', 'FAIL', `Cannot query recent calls: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Recent Call Activity', 'WARN', 'No calls found in database', {});
  } else {
    const latestCall = new Date(data[0].created_at);
    const hoursSinceLastCall = (Date.now() - latestCall.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastCall > 24) {
      await logResult('Recent Call Activity', 'WARN', `Last call was ${Math.round(hoursSinceLastCall)} hours ago`, { latest_call: latestCall.toISOString() });
    } else {
      await logResult('Recent Call Activity', 'PASS', `Last call was ${Math.round(hoursSinceLastCall)} hours ago`, { latest_call: latestCall.toISOString() });
    }
  }
}

// Check 16: Sentiment Label Distribution
async function checkSentimentLabelDistribution() {
  const { data, error } = await supabase
    .from('calls')
    .select('sentiment_label')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Sentiment Label Distribution', 'FAIL', `Cannot query sentiment labels: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Sentiment Label Distribution', 'WARN', 'No calls in the last 7 days', {});
  } else {
    const labelCounts: Record<string, number> = {};
    data.forEach(call => {
      const label = call.sentiment_label || 'unknown';
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });

    await logResult('Sentiment Label Distribution', 'PASS', `Sentiment labels in last 7 days`, labelCounts);
  }
}

// Check 17: Lead Score Distribution
async function checkLeadScoreDistribution() {
  const { data, error } = await supabase
    .from('hot_lead_alerts')
    .select('lead_score')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    await logResult('Lead Score Distribution', 'FAIL', `Cannot query lead scores: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    await logResult('Lead Score Distribution', 'WARN', 'No hot lead alerts in the last 7 days', {});
  } else {
    const scores = data.map(a => a.lead_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    await logResult('Lead Score Distribution', 'PASS', `Lead scores: avg=${avgScore.toFixed(1)}, max=${maxScore}, min=${minScore}`, { count: scores.length });
  }
}

// Check 18: Organizations Data
async function checkOrganizationsData() {
  const { count, error } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    await logResult('Organizations Data', 'FAIL', `Cannot query organizations: ${error.message}`);
  } else {
    await logResult('Organizations Data', 'PASS', `Total organizations: ${count}`, { count });
  }
}

// Main execution
async function main() {
  console.log('========================================');
  console.log('DASHBOARD DATA VERIFICATION');
  console.log('========================================\n');

  console.log('Starting comprehensive verification...\n');

  // Run all checks
  await checkDatabaseConnectivity();
  await checkCallsTableStructure();
  await checkContactsTableStructure();
  await checkHotLeadAlertsTable();
  await checkOrganizationsData();
  await checkTotalCallVolume();
  await checkRecentCallActivity();
  await checkCallerNames();
  await checkContactNames();
  await checkSentimentData();
  await checkSentimentLabelDistribution();
  await checkHotLeadAlerts();
  await checkLeadScoreDistribution();
  await checkPhoneNumbers();
  await checkRecordingUrls();
  await checkCallStatusDistribution();
  await checkCallDirectionDistribution();
  await checkSampleData();

  // Summary
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  console.log(`✅ Passed: ${passed}/${results.length} checks`);
  console.log(`❌ Failed: ${failed}/${results.length} checks`);
  console.log(`⚠️  Warnings: ${warnings}/${results.length} checks\n`);

  if (failed > 0) {
    console.log('CRITICAL ISSUES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.check}: ${r.message}`);
    });
    console.log('');
  }

  if (warnings > 0) {
    console.log('WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  ⚠️  ${r.check}: ${r.message}`);
    });
    console.log('');
  }

  // Sample data display
  const sampleResult = results.find(r => r.check === 'Sample Data');
  if (sampleResult && sampleResult.details && Array.isArray(sampleResult.details)) {
    console.log('SAMPLE DATA (5 most recent calls):');
    console.table(sampleResult.details);
  }

  console.log('\n========================================');
  console.log('VERIFICATION COMPLETE');
  console.log('========================================\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ FATAL ERROR:', error.message);
  console.error(error);
  process.exit(1);
});
