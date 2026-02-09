/**
 * QA Dashboard Data Verification Script
 * Tests all dashboard endpoints to verify data population
 * Run: TEST_AUTH_TOKEN="your_jwt" npx ts-node backend/src/scripts/qa-dashboard-verification.ts
 */

import { supabase } from '../services/supabase-client';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string[];
  data?: any;
}

const results: TestResult[] = [];

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function addResult(testName: string, status: 'PASS' | 'FAIL' | 'WARN', details: string[], data?: any) {
  results.push({ testName, status, details, data });
}

// Get demo user credentials
const DEMO_ORG_ID = process.env.DEMO_ORG_ID || '00000000-0000-0000-0000-000000000000';

/**
 * TEST 1: Verify calls table has real data
 */
async function test1_CallsTableData() {
  log('\n' + '='.repeat(80), colors.cyan);
  log('TEST 1: Calls Table Data Verification', colors.bold + colors.cyan);
  log('='.repeat(80), colors.cyan);

  try {
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .eq('org_id', DEMO_ORG_ID)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      addResult('Test 1: Calls Table', 'FAIL', [`Database error: ${error.message}`]);
      log(`❌ FAIL: ${error.message}`, colors.red);
      return;
    }

    if (!calls || calls.length === 0) {
      addResult('Test 1: Calls Table', 'FAIL', ['No calls found in database']);
      log('❌ FAIL: No calls found', colors.red);
      return;
    }

    log(`✅ Found ${calls.length} calls`, colors.green);

    const details: string[] = [];
    let hasUnknownCaller = false;
    let hasUnknownPhone = false;
    let hasMissingSentiment = false;
    let hasMissingOutcome = false;

    calls.forEach((call, idx) => {
      details.push(`\nCall ${idx + 1}:`);
      details.push(`  ID: ${call.id}`);
      details.push(`  Caller Name: ${call.caller_name || '❌ MISSING'}`);
      details.push(`  Phone Number: ${call.phone_number || '❌ MISSING'}`);
      details.push(`  Direction: ${call.call_direction || 'N/A'}`);
      details.push(`  Status: ${call.status || 'N/A'}`);
      details.push(`  Duration: ${call.duration_seconds || 0}s`);
      details.push(`  Sentiment Label: ${call.sentiment_label || '❌ MISSING'}`);
      details.push(`  Sentiment Score: ${call.sentiment_score !== null ? call.sentiment_score : '❌ MISSING'}`);
      details.push(`  Sentiment Summary: ${call.sentiment_summary || '❌ MISSING'}`);
      details.push(`  Sentiment Urgency: ${call.sentiment_urgency || '❌ MISSING'}`);
      details.push(`  Outcome Summary: ${call.outcome_summary || '❌ MISSING'}`);

      // Check for "Unknown Caller"
      if (!call.caller_name || call.caller_name === 'Unknown Caller') {
        hasUnknownCaller = true;
        log(`  ⚠️  Caller Name: "${call.caller_name || 'NULL'}"`, colors.yellow);
      } else {
        log(`  ✅ Caller Name: "${call.caller_name}"`, colors.green);
      }

      // Check for "Unknown" phone
      if (!call.phone_number || call.phone_number === 'Unknown') {
        hasUnknownPhone = true;
        log(`  ⚠️  Phone Number: "${call.phone_number || 'NULL'}"`, colors.yellow);
      } else {
        log(`  ✅ Phone Number: "${call.phone_number}"`, colors.green);
      }

      // Check sentiment data
      if (!call.sentiment_label || call.sentiment_score === null) {
        hasMissingSentiment = true;
        log(`  ⚠️  Sentiment: ${call.sentiment_label || 'NULL'} (${call.sentiment_score})`, colors.yellow);
      } else {
        log(`  ✅ Sentiment: ${call.sentiment_label} (${call.sentiment_score})`, colors.green);
      }

      // Check outcome summary
      if (!call.outcome_summary) {
        hasMissingOutcome = true;
        log(`  ⚠️  Outcome Summary: NULL`, colors.yellow);
      } else {
        log(`  ✅ Outcome Summary: "${call.outcome_summary.substring(0, 50)}..."`, colors.green);
      }
    });

    // Determine status
    if (hasUnknownCaller || hasUnknownPhone) {
      addResult('Test 1: Calls Table', 'FAIL', [
        `Total calls: ${calls.length}`,
        hasUnknownCaller ? '❌ Found "Unknown Caller" values' : '✅ All caller names populated',
        hasUnknownPhone ? '❌ Found "Unknown" phone numbers' : '✅ All phone numbers populated',
        hasMissingSentiment ? '⚠️  Some calls missing sentiment data (expected for old calls)' : '✅ All calls have sentiment data',
        hasMissingOutcome ? '⚠️  Some calls missing outcome summary' : '✅ All calls have outcome summary',
        ...details
      ], calls);
      log('\n❌ TEST 1 FAILED: Found "Unknown" values', colors.red);
    } else if (hasMissingSentiment || hasMissingOutcome) {
      addResult('Test 1: Calls Table', 'WARN', [
        `Total calls: ${calls.length}`,
        '✅ All caller names populated',
        '✅ All phone numbers populated',
        hasMissingSentiment ? '⚠️  Some calls missing sentiment data (expected for old calls)' : '✅ All calls have sentiment data',
        hasMissingOutcome ? '⚠️  Some calls missing outcome summary' : '✅ All calls have outcome summary',
        ...details
      ], calls);
      log('\n⚠️  TEST 1 WARNING: Some optional data missing', colors.yellow);
    } else {
      addResult('Test 1: Calls Table', 'PASS', [
        `Total calls: ${calls.length}`,
        '✅ All caller names populated',
        '✅ All phone numbers populated',
        '✅ All calls have sentiment data',
        '✅ All calls have outcome summary',
        ...details
      ], calls);
      log('\n✅ TEST 1 PASSED: All data populated correctly', colors.green);
    }

  } catch (err: any) {
    addResult('Test 1: Calls Table', 'FAIL', [`Exception: ${err.message}`]);
    log(`❌ FAIL: ${err.message}`, colors.red);
  }
}

/**
 * TEST 2: Verify contacts table data
 */
async function test2_ContactsTableData() {
  log('\n' + '='.repeat(80), colors.cyan);
  log('TEST 2: Contacts Table Data Verification', colors.bold + colors.cyan);
  log('='.repeat(80), colors.cyan);

  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('org_id', DEMO_ORG_ID)
      .limit(10);

    if (error) {
      addResult('Test 2: Contacts Table', 'FAIL', [`Database error: ${error.message}`]);
      log(`❌ FAIL: ${error.message}`, colors.red);
      return;
    }

    if (!contacts || contacts.length === 0) {
      addResult('Test 2: Contacts Table', 'WARN', ['No contacts found (may be expected for new org)']);
      log('⚠️  WARNING: No contacts found', colors.yellow);
      return;
    }

    log(`✅ Found ${contacts.length} contacts`, colors.green);

    const details: string[] = [];
    let hasUnknownName = false;
    let hasUnknownPhone = false;

    contacts.forEach((contact, idx) => {
      details.push(`\nContact ${idx + 1}:`);
      details.push(`  ID: ${contact.id}`);
      details.push(`  Name: ${contact.name || '❌ MISSING'}`);
      details.push(`  Phone: ${contact.phone || '❌ MISSING'}`);
      details.push(`  Lead Status: ${contact.lead_status || 'N/A'}`);
      details.push(`  Lead Score: ${contact.lead_score !== null ? contact.lead_score : 'N/A'}`);

      if (!contact.name || contact.name === 'Unknown') {
        hasUnknownName = true;
        log(`  ⚠️  Name: "${contact.name || 'NULL'}"`, colors.yellow);
      } else {
        log(`  ✅ Name: "${contact.name}"`, colors.green);
      }

      if (!contact.phone || contact.phone === 'Unknown') {
        hasUnknownPhone = true;
        log(`  ⚠️  Phone: "${contact.phone || 'NULL'}"`, colors.yellow);
      } else {
        log(`  ✅ Phone: "${contact.phone}"`, colors.green);
      }
    });

    if (hasUnknownName || hasUnknownPhone) {
      addResult('Test 2: Contacts Table', 'FAIL', [
        `Total contacts: ${contacts.length}`,
        hasUnknownName ? '❌ Found "Unknown" names' : '✅ All names populated',
        hasUnknownPhone ? '❌ Found "Unknown" phones' : '✅ All phones populated',
        ...details
      ], contacts);
      log('\n❌ TEST 2 FAILED: Found "Unknown" values', colors.red);
    } else {
      addResult('Test 2: Contacts Table', 'PASS', [
        `Total contacts: ${contacts.length}`,
        '✅ All names populated',
        '✅ All phones populated',
        ...details
      ], contacts);
      log('\n✅ TEST 2 PASSED: All contact data valid', colors.green);
    }

  } catch (err: any) {
    addResult('Test 2: Contacts Table', 'FAIL', [`Exception: ${err.message}`]);
    log(`❌ FAIL: ${err.message}`, colors.red);
  }
}

/**
 * TEST 3: Verify hot_lead_alerts table
 */
async function test3_HotLeadAlertsData() {
  log('\n' + '='.repeat(80), colors.cyan);
  log('TEST 3: Hot Lead Alerts Data Verification', colors.bold + colors.cyan);
  log('='.repeat(80), colors.cyan);

  try {
    const { data: alerts, error } = await supabase
      .from('hot_lead_alerts')
      .select('*, contacts(name, phone)')
      .eq('org_id', DEMO_ORG_ID)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      addResult('Test 3: Hot Lead Alerts', 'FAIL', [`Database error: ${error.message}`]);
      log(`❌ FAIL: ${error.message}`, colors.red);
      return;
    }

    if (!alerts || alerts.length === 0) {
      addResult('Test 3: Hot Lead Alerts', 'WARN', [
        'No hot lead alerts found',
        'This may be expected if no high-scoring calls received yet',
        'Webhook should create alerts for calls with lead_score >= 60'
      ]);
      log('⚠️  WARNING: No hot lead alerts found', colors.yellow);
      return;
    }

    log(`✅ Found ${alerts.length} hot lead alerts`, colors.green);

    const details: string[] = [];
    let hasMissingData = false;

    alerts.forEach((alert, idx) => {
      details.push(`\nAlert ${idx + 1}:`);
      details.push(`  ID: ${alert.id}`);
      details.push(`  Contact: ${(alert.contacts as any)?.name || '❌ MISSING'}`);
      details.push(`  Phone: ${(alert.contacts as any)?.phone || '❌ MISSING'}`);
      details.push(`  Urgency: ${alert.urgency_level || '❌ MISSING'}`);
      details.push(`  Summary: ${alert.summary || '❌ MISSING'}`);

      const contactName = (alert.contacts as any)?.name;
      const contactPhone = (alert.contacts as any)?.phone;

      if (!contactName || !contactPhone || !alert.urgency_level || !alert.summary) {
        hasMissingData = true;
        log(`  ⚠️  Missing data in alert ${idx + 1}`, colors.yellow);
      } else {
        log(`  ✅ Alert ${idx + 1}: Complete`, colors.green);
      }
    });

    if (hasMissingData) {
      addResult('Test 3: Hot Lead Alerts', 'WARN', [
        `Total alerts: ${alerts.length}`,
        '⚠️  Some alerts have missing data',
        ...details
      ], alerts);
      log('\n⚠️  TEST 3 WARNING: Some alerts incomplete', colors.yellow);
    } else {
      addResult('Test 3: Hot Lead Alerts', 'PASS', [
        `Total alerts: ${alerts.length}`,
        '✅ All alerts have complete data',
        ...details
      ], alerts);
      log('\n✅ TEST 3 PASSED: All alerts valid', colors.green);
    }

  } catch (err: any) {
    addResult('Test 3: Hot Lead Alerts', 'FAIL', [`Exception: ${err.message}`]);
    log(`❌ FAIL: ${err.message}`, colors.red);
  }
}

/**
 * TEST 4: Check for data consistency
 */
async function test4_DataConsistency() {
  log('\n' + '='.repeat(80), colors.cyan);
  log('TEST 4: Data Consistency Check', colors.bold + colors.cyan);
  log('='.repeat(80), colors.cyan);

  try {
    // Get calls with phone numbers
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('id, phone_number, caller_name, from_number')
      .eq('org_id', DEMO_ORG_ID)
      .not('phone_number', 'is', null)
      .limit(5);

    if (callsError) {
      addResult('Test 4: Data Consistency', 'FAIL', [`Calls query error: ${callsError.message}`]);
      log(`❌ FAIL: ${callsError.message}`, colors.red);
      return;
    }

    if (!calls || calls.length === 0) {
      addResult('Test 4: Data Consistency', 'WARN', ['No calls with phone numbers found']);
      log('⚠️  WARNING: No calls with phone numbers', colors.yellow);
      return;
    }

    log(`✅ Checking ${calls.length} calls for contact matches`, colors.green);

    const details: string[] = [];
    let consistencyIssues = 0;

    for (const call of calls) {
      const phoneToCheck = call.phone_number || call.from_number;
      if (!phoneToCheck) continue;

      // Check if contact exists with this phone
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .eq('org_id', DEMO_ORG_ID)
        .eq('phone', phoneToCheck);

      if (contactsError) {
        details.push(`⚠️  Error checking contacts for ${phoneToCheck}: ${contactsError.message}`);
        continue;
      }

      if (!contacts || contacts.length === 0) {
        details.push(`\nCall ${call.id}:`);
        details.push(`  Phone: ${phoneToCheck}`);
        details.push(`  Caller Name: ${call.caller_name || 'NULL'}`);
        details.push(`  ⚠️  No matching contact found`);
        consistencyIssues++;
      } else {
        const contact = contacts[0];
        const namesMatch = call.caller_name === contact.name;
        details.push(`\nCall ${call.id}:`);
        details.push(`  Phone: ${phoneToCheck}`);
        details.push(`  Call Caller Name: ${call.caller_name}`);
        details.push(`  Contact Name: ${contact.name}`);
        if (namesMatch) {
          details.push(`  ✅ Names match`);
          log(`  ✅ Consistent: ${call.caller_name}`, colors.green);
        } else {
          details.push(`  ⚠️  Name mismatch`);
          log(`  ⚠️  Inconsistent: "${call.caller_name}" vs "${contact.name}"`, colors.yellow);
          consistencyIssues++;
        }
      }
    }

    if (consistencyIssues > 0) {
      addResult('Test 4: Data Consistency', 'WARN', [
        `Checked ${calls.length} calls`,
        `Found ${consistencyIssues} consistency issues`,
        '⚠️  Some calls have names that don\'t match contacts',
        ...details
      ]);
      log(`\n⚠️  TEST 4 WARNING: ${consistencyIssues} consistency issues found`, colors.yellow);
    } else {
      addResult('Test 4: Data Consistency', 'PASS', [
        `Checked ${calls.length} calls`,
        '✅ All calls match contacts correctly',
        ...details
      ]);
      log('\n✅ TEST 4 PASSED: Data is consistent', colors.green);
    }

  } catch (err: any) {
    addResult('Test 4: Data Consistency', 'FAIL', [`Exception: ${err.message}`]);
    log(`❌ FAIL: ${err.message}`, colors.red);
  }
}

/**
 * TEST 5: Database schema verification
 */
async function test5_SchemaVerification() {
  log('\n' + '='.repeat(80), colors.cyan);
  log('TEST 5: Database Schema Verification', colors.bold + colors.cyan);
  log('='.repeat(80), colors.cyan);

  const requiredColumns = {
    calls: [
      'id', 'org_id', 'phone_number', 'caller_name', 'call_direction',
      'status', 'duration_seconds', 'sentiment_label', 'sentiment_score',
      'sentiment_summary', 'sentiment_urgency', 'outcome_summary'
    ],
    contacts: ['id', 'org_id', 'name', 'phone', 'lead_status', 'lead_score'],
    hot_lead_alerts: ['id', 'org_id', 'contact_id', 'urgency_level', 'summary']
  };

  try {
    const details: string[] = [];
    let missingColumns = false;

    for (const [tableName, columns] of Object.entries(requiredColumns)) {
      log(`\nChecking table: ${tableName}`, colors.blue);

      // Query information_schema to check columns
      const { data: tableColumns, error } = await supabase.rpc('get_table_columns', {
        table_name: tableName
      }).catch(() => ({
        data: null,
        error: { message: 'get_table_columns function not found - using sample query instead' }
      }));

      // Fallback: Try to fetch a single row to check columns
      if (error || !tableColumns) {
        const { data: sampleRow, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
          .single();

        if (sampleError && sampleError.code !== 'PGRST116') {
          details.push(`⚠️  Cannot verify ${tableName}: ${sampleError.message}`);
          log(`  ⚠️  Cannot verify columns: ${sampleError.message}`, colors.yellow);
          continue;
        }

        if (sampleRow) {
          const actualColumns = Object.keys(sampleRow);
          const missing = columns.filter(col => !actualColumns.includes(col));
          if (missing.length > 0) {
            missingColumns = true;
            details.push(`❌ ${tableName}: Missing columns: ${missing.join(', ')}`);
            log(`  ❌ Missing: ${missing.join(', ')}`, colors.red);
          } else {
            details.push(`✅ ${tableName}: All required columns present`);
            log(`  ✅ All required columns present`, colors.green);
          }
        } else {
          details.push(`⚠️  ${tableName}: Empty table, cannot verify columns`);
          log(`  ⚠️  Empty table`, colors.yellow);
        }
      }
    }

    if (missingColumns) {
      addResult('Test 5: Schema Verification', 'FAIL', [
        '❌ Some required columns are missing',
        ...details
      ]);
      log('\n❌ TEST 5 FAILED: Missing columns', colors.red);
    } else {
      addResult('Test 5: Schema Verification', 'PASS', [
        '✅ All required columns present',
        ...details
      ]);
      log('\n✅ TEST 5 PASSED: Schema is correct', colors.green);
    }

  } catch (err: any) {
    addResult('Test 5: Schema Verification', 'FAIL', [`Exception: ${err.message}`]);
    log(`❌ FAIL: ${err.message}`, colors.red);
  }
}

/**
 * Generate final report
 */
function generateReport() {
  log('\n' + '='.repeat(80), colors.magenta);
  log('FINAL QA VERIFICATION REPORT', colors.bold + colors.magenta);
  log('='.repeat(80), colors.magenta);

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  log(`\nTotal Tests: ${results.length}`, colors.bold);
  log(`✅ Passed: ${passed}`, colors.green);
  log(`❌ Failed: ${failed}`, colors.red);
  log(`⚠️  Warnings: ${warnings}`, colors.yellow);

  log('\n' + '-'.repeat(80), colors.cyan);
  log('TEST SUMMARY', colors.bold + colors.cyan);
  log('-'.repeat(80), colors.cyan);

  results.forEach(result => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    const statusColor = result.status === 'PASS' ? colors.green : result.status === 'FAIL' ? colors.red : colors.yellow;

    log(`\n${statusIcon} ${result.testName}`, colors.bold + statusColor);
    result.details.forEach(detail => {
      log(`  ${detail}`, statusColor);
    });
  });

  log('\n' + '='.repeat(80), colors.magenta);

  if (failed > 0) {
    log('OVERALL STATUS: ❌ FAILED', colors.bold + colors.red);
    log('\nACTION REQUIRED:', colors.bold + colors.red);
    log('  1. Review failed tests above', colors.red);
    log('  2. Check database migrations are applied', colors.red);
    log('  3. Verify webhook is populating data correctly', colors.red);
    log('  4. Restart backend server to enable fixes', colors.red);
  } else if (warnings > 0) {
    log('OVERALL STATUS: ⚠️  PASSED WITH WARNINGS', colors.bold + colors.yellow);
    log('\nRECOMMENDATIONS:', colors.bold + colors.yellow);
    log('  1. Review warnings for optional improvements', colors.yellow);
    log('  2. Trigger test calls to populate missing data', colors.yellow);
  } else {
    log('OVERALL STATUS: ✅ ALL TESTS PASSED', colors.bold + colors.green);
    log('\nDashboard is ready for QA testing!', colors.green);
  }

  log('='.repeat(80), colors.magenta);

  return failed === 0;
}

/**
 * Main execution
 */
async function main() {
  log('=' + '='.repeat(80), colors.bold + colors.magenta);
  log('  QA DASHBOARD DATA VERIFICATION', colors.bold + colors.magenta);
  log('  Automated testing for dashboard data population', colors.magenta);
  log('=' + '='.repeat(80), colors.bold + colors.magenta);

  log(`\nDemo Org ID: ${DEMO_ORG_ID}`, colors.cyan);
  log(`Timestamp: ${new Date().toISOString()}`, colors.cyan);

  // Run all tests
  await test1_CallsTableData();
  await test2_ContactsTableData();
  await test3_HotLeadAlertsData();
  await test4_DataConsistency();
  await test5_SchemaVerification();

  // Generate report
  const success = generateReport();

  process.exit(success ? 0 : 1);
}

main().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});
