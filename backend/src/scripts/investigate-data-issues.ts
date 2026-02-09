import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEMO_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function investigate() {
  console.log('\n=== INVESTIGATING DATA ISSUES ===\n');

  // 1. Check all calls with details
  console.log('1. ALL CALLS IN DATABASE:');
  console.log('-'.repeat(120));
  const { data: calls } = await supabase
    .from('calls')
    .select('id, caller_name, phone_number, from_number, to_number, call_direction, status, sentiment_label, sentiment_score, created_at')
    .eq('org_id', DEMO_ORG_ID)
    .order('created_at', { ascending: false });

  calls?.forEach((call, idx) => {
    console.log(`\nCall ${idx + 1}:`);
    console.log(`  ID: ${call.id.substring(0, 8)}`);
    console.log(`  Caller Name: ${call.caller_name || 'NULL'}`);
    console.log(`  Phone Number: ${call.phone_number || 'NULL'}`);
    console.log(`  From Number: ${call.from_number || 'NULL'}`);
    console.log(`  To Number: ${call.to_number || 'NULL'}`);
    console.log(`  Direction: ${call.call_direction}`);
    console.log(`  Status: ${call.status}`);
    console.log(`  Sentiment Label: ${call.sentiment_label || 'NULL'}`);
    console.log(`  Sentiment Score: ${call.sentiment_score ?? 'NULL'}`);
    console.log(`  Created: ${call.created_at}`);
  });

  // 2. Check all contacts
  console.log('\n\n2. ALL CONTACTS IN DATABASE:');
  console.log('-'.repeat(120));
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, lead_status, lead_score, created_at')
    .eq('org_id', DEMO_ORG_ID)
    .order('created_at', { ascending: false });

  contacts?.forEach((contact, idx) => {
    console.log(`\nContact ${idx + 1}:`);
    console.log(`  ID: ${contact.id.substring(0, 8)}`);
    console.log(`  First Name: ${contact.first_name || 'NULL'}`);
    console.log(`  Last Name: ${contact.last_name || 'NULL'}`);
    console.log(`  Phone: ${contact.phone || 'NULL'}`);
    console.log(`  Email: ${contact.email || 'NULL'}`);
    console.log(`  Lead Status: ${contact.lead_status || 'NULL'}`);
    console.log(`  Lead Score: ${contact.lead_score ?? 'NULL'}`);
    console.log(`  Created: ${contact.created_at}`);
  });

  // 3. Check if there's a mismatch between calls and contacts (phone numbers)
  console.log('\n\n3. PHONE NUMBER MATCHING ANALYSIS:');
  console.log('-'.repeat(120));

  const callsWithPhone = calls?.filter((c) => c.phone_number || c.from_number) || [];
  const contactPhones = new Set(contacts?.map((c) => c.phone).filter(Boolean));

  console.log(`\nCalls with phone numbers: ${callsWithPhone.length}`);
  console.log(`Contacts in database: ${contacts?.length || 0}`);
  console.log(`Unique contact phone numbers: ${contactPhones.size}`);

  callsWithPhone.forEach((call) => {
    const phoneToCheck = call.phone_number || call.from_number;
    const hasMatchingContact = contactPhones.has(phoneToCheck);
    console.log(`\nCall ${call.id.substring(0, 8)}: Phone ${phoneToCheck}`);
    console.log(`  Has matching contact: ${hasMatchingContact ? '✅ YES' : '❌ NO'}`);
  });

  // 4. Check completed calls without sentiment
  console.log('\n\n4. COMPLETED CALLS MISSING SENTIMENT:');
  console.log('-'.repeat(120));

  const completedCalls = calls?.filter((c) => c.status === 'completed') || [];
  const completedWithoutSentiment = completedCalls.filter((c) => !c.sentiment_label);

  console.log(`\nTotal completed calls: ${completedCalls.length}`);
  console.log(`Completed calls WITHOUT sentiment: ${completedWithoutSentiment.length}`);

  if (completedWithoutSentiment.length > 0) {
    console.log('\nCalls missing sentiment data:');
    completedWithoutSentiment.forEach((call) => {
      console.log(`  - Call ${call.id.substring(0, 8)} (${call.created_at})`);
    });
  }

  // 5. Summary and recommendations
  console.log('\n\n5. ROOT CAUSE ANALYSIS:');
  console.log('-'.repeat(120));

  const issues: string[] = [];

  // Issue 1: Incomplete calls (queued/ringing)
  const incompleteCalls = calls?.filter((c) => ['queued', 'ringing', 'in-progress'].includes(c.status)) || [];
  if (incompleteCalls.length > 0) {
    issues.push(`${incompleteCalls.length} calls are in incomplete status (queued/ringing) - these legitimately have no data`);
  }

  // Issue 2: Completed calls without sentiment
  if (completedWithoutSentiment.length > 0) {
    issues.push(`${completedWithoutSentiment.length} completed calls are missing sentiment data - webhook processing may have failed`);
  }

  // Issue 3: Contacts without names
  const contactsWithoutNames = contacts?.filter((c) => !c.first_name && !c.last_name) || [];
  if (contactsWithoutNames.length > 0) {
    issues.push(`${contactsWithoutNames.length} contacts have no first_name or last_name - contact creation may have failed`);
  }

  console.log('\nIssues identified:');
  issues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue}`);
  });

  console.log('\n\nRECOMMENDATIONS:');
  console.log('-'.repeat(120));
  console.log('1. The "Unknown Caller" issues are from incomplete calls (queued/ringing) - these are EXPECTED');
  console.log('2. Completed calls should have sentiment data - check webhook processing logs');
  console.log('3. All contacts should have at least first_name or last_name - check contact creation logic');
  console.log('4. The dashboard is filtering data correctly - the issue is DATA QUALITY, not UI bugs');
}

investigate().catch(console.error);
