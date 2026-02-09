/**
 * Quick Database Check - Verify dashboard data exists
 * Run: npx ts-node backend/src/scripts/quick-db-check.ts
 */

import { supabase } from '../services/supabase-client';

async function quickCheck() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 QUICK DATABASE CHECK');
  console.log('='.repeat(80) + '\n');

  // Get first org (assuming demo org)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(1);

  if (!orgs || orgs.length === 0) {
    console.log('❌ No organizations found');
    return;
  }

  const orgId = orgs[0].id;
  console.log(`📊 Checking org: ${orgs[0].name} (${orgId})\n`);

  // Check calls
  const { data: calls, count: callsCount } = await supabase
    .from('calls')
    .select('id, caller_name, phone_number, sentiment_label, sentiment_score, outcome_summary', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`📞 CALLS: ${callsCount} total`);
  if (calls && calls.length > 0) {
    calls.forEach((call, idx) => {
      console.log(`\n  Call ${idx + 1}:`);
      console.log(`    Caller: ${call.caller_name || '❌ NULL'}`);
      console.log(`    Phone: ${call.phone_number || '❌ NULL'}`);
      console.log(`    Sentiment: ${call.sentiment_label || '❌ NULL'} (${call.sentiment_score ?? 'NULL'})`);
      console.log(`    Outcome: ${call.outcome_summary ? call.outcome_summary.substring(0, 50) + '...' : '❌ NULL'}`);
    });
  } else {
    console.log('  ⚠️  No calls found');
  }

  // Check contacts
  const { data: contacts, count: contactsCount } = await supabase
    .from('contacts')
    .select('id, name, phone, lead_status, lead_score', { count: 'exact' })
    .eq('org_id', orgId)
    .limit(5);

  console.log(`\n\n👤 CONTACTS: ${contactsCount} total`);
  if (contacts && contacts.length > 0) {
    contacts.forEach((contact, idx) => {
      console.log(`\n  Contact ${idx + 1}:`);
      console.log(`    Name: ${contact.name || '❌ NULL'}`);
      console.log(`    Phone: ${contact.phone || '❌ NULL'}`);
      console.log(`    Status: ${contact.lead_status || 'N/A'}`);
      console.log(`    Score: ${contact.lead_score ?? 'N/A'}`);
    });
  } else {
    console.log('  ⚠️  No contacts found');
  }

  // Check hot lead alerts
  const { data: alerts, count: alertsCount } = await supabase
    .from('hot_lead_alerts')
    .select('id, contact_id, urgency_level, summary', { count: 'exact' })
    .eq('org_id', orgId)
    .limit(5);

  console.log(`\n\n🔥 HOT LEAD ALERTS: ${alertsCount} total`);
  if (alerts && alerts.length > 0) {
    alerts.forEach((alert, idx) => {
      console.log(`\n  Alert ${idx + 1}:`);
      console.log(`    Contact ID: ${alert.contact_id}`);
      console.log(`    Urgency: ${alert.urgency_level || '❌ NULL'}`);
      console.log(`    Summary: ${alert.summary ? alert.summary.substring(0, 50) + '...' : '❌ NULL'}`);
    });
  } else {
    console.log('  ⚠️  No alerts found (trigger test call with lead_score >= 60)');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Quick check complete');
  console.log('='.repeat(80) + '\n');

  // Summary
  console.log('📊 SUMMARY:');
  console.log(`  - Calls: ${callsCount}`);
  console.log(`  - Contacts: ${contactsCount}`);
  console.log(`  - Hot Lead Alerts: ${alertsCount}`);

  // Check for issues
  const issues: string[] = [];

  if (calls && calls.length > 0) {
    const unknownCallers = calls.filter(c => !c.caller_name || c.caller_name === 'Unknown Caller');
    const unknownPhones = calls.filter(c => !c.phone_number || c.phone_number === 'Unknown');
    const missingSentiment = calls.filter(c => !c.sentiment_label || c.sentiment_score === null);
    const missingOutcome = calls.filter(c => !c.outcome_summary);

    if (unknownCallers.length > 0) {
      issues.push(`❌ ${unknownCallers.length} calls with "Unknown Caller" or NULL caller_name`);
    }
    if (unknownPhones.length > 0) {
      issues.push(`❌ ${unknownPhones.length} calls with "Unknown" or NULL phone_number`);
    }
    if (missingSentiment.length > 0) {
      issues.push(`⚠️  ${missingSentiment.length} calls missing sentiment data`);
    }
    if (missingOutcome.length > 0) {
      issues.push(`⚠️  ${missingOutcome.length} calls missing outcome summary`);
    }
  }

  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log('\nACTION REQUIRED:');
    console.log('  1. Check if database migrations applied: backend/supabase/migrations/20260131_fix_unified_calls_schema.sql');
    console.log('  2. Verify webhook is enriching caller names: backend/src/routes/vapi-webhook.ts line 407');
    console.log('  3. Restart backend server to enable fixes');
    console.log('  4. Trigger test call to populate new data');
  } else {
    console.log('\n✅ NO ISSUES FOUND - All data looks good!');
  }

  console.log('\nFor detailed analysis, run:');
  console.log('  DEMO_ORG_ID="' + orgId + '" npx ts-node backend/src/scripts/qa-dashboard-verification.ts');
}

quickCheck().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
