/**
 * Dashboard Data Verification Script
 *
 * Comprehensive check of all dashboard data quality
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const results = [];

async function logResult(check, status, message, details) {
  results.push({ check, status, message, details });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ ';
  console.log(`${emoji} ${status}: ${check} - ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

// Check 1: Database Connectivity
async function checkDatabaseConnectivity() {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('count')
      .limit(1);

    if (error) {
      await logResult('Database Connectivity', 'FAIL', `Cannot connect to database: ${error.message}`);
    } else {
      await logResult('Database Connectivity', 'PASS', 'Successfully connected to Supabase');
    }
  } catch (err) {
    await logResult('Database Connectivity', 'FAIL', `Connection error: ${err.message}`);
  }
}

// Check 2: Caller Names
async function checkCallerNames() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: callsData, error } = await supabase
      .from('calls')
      .select('caller_name')
      .gte('created_at', sevenDaysAgo);

    if (error) {
      await logResult('Caller Names', 'FAIL', `Database query failed: ${error.message}`);
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
  } catch (err) {
    await logResult('Caller Names', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 3: Contact Names
async function checkContactNames() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: contactsData, error } = await supabase
      .from('contacts')
      .select('name')
      .gte('created_at', sevenDaysAgo);

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
  } catch (err) {
    await logResult('Contact Names', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 4: Sentiment Data
async function checkSentimentData() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: callsData, error } = await supabase
      .from('calls')
      .select('sentiment_label, sentiment_score')
      .gte('created_at', sevenDaysAgo);

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
  } catch (err) {
    await logResult('Sentiment Data', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 5: Hot Lead Alerts
async function checkHotLeadAlerts() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: alertsData, error } = await supabase
      .from('hot_lead_alerts')
      .select('lead_score')
      .gte('created_at', sevenDaysAgo);

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
  } catch (err) {
    await logResult('Hot Lead Alerts', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 6: Phone Numbers
async function checkPhoneNumbers() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: callsData, error } = await supabase
      .from('calls')
      .select('phone_number')
      .gte('created_at', sevenDaysAgo);

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
  } catch (err) {
    await logResult('Phone Numbers', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 7: Sample Data
async function checkSampleData() {
  try {
    const { data: sampleData, error } = await supabase
      .from('calls')
      .select('id, caller_name, phone_number, sentiment_label, sentiment_score, call_direction, status, created_at')
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
  } catch (err) {
    await logResult('Sample Data', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 8: Total Call Volume
async function checkTotalCallVolume() {
  try {
    const { count, error } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true });

    if (error) {
      await logResult('Total Call Volume', 'FAIL', `Cannot count calls: ${error.message}`);
    } else {
      await logResult('Total Call Volume', 'PASS', `Total calls in database: ${count}`, { count });
    }
  } catch (err) {
    await logResult('Total Call Volume', 'FAIL', `Error: ${err.message}`);
  }
}

// Check 9: Recent Call Activity
async function checkRecentCallActivity() {
  try {
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
  } catch (err) {
    await logResult('Recent Call Activity', 'FAIL', `Error: ${err.message}`);
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
  await checkTotalCallVolume();
  await checkRecentCallActivity();
  await checkCallerNames();
  await checkContactNames();
  await checkSentimentData();
  await checkHotLeadAlerts();
  await checkPhoneNumbers();
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
    console.log('\nSAMPLE DATA (5 most recent calls):');
    console.log('====================================');
    sampleResult.details.forEach((call, idx) => {
      console.log(`\nCall ${idx + 1}:`);
      console.log(`  ID: ${call.id}`);
      console.log(`  Caller: ${call.caller_name || 'N/A'}`);
      console.log(`  Phone: ${call.phone_number || 'N/A'}`);
      console.log(`  Sentiment: ${call.sentiment_label || 'N/A'} (${call.sentiment_score || 0})`);
      console.log(`  Direction: ${call.call_direction || 'N/A'}`);
      console.log(`  Status: ${call.status || 'N/A'}`);
      console.log(`  Created: ${call.created_at || 'N/A'}`);
    });
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
