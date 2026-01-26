#!/usr/bin/env ts-node
/**
 * Setup Phase 1 Test Data (Automated)
 *
 * Non-interactive version for automated setup
 *
 * Usage:
 *   npx ts-node setup-phase1-test-data-auto.ts [orgId] [testPhone] [testName] [transferPhone]
 *
 * Or run without args to use first org + sensible defaults
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🚀 Phase 1 Test Data Setup (Automated)\n');

  // Get command-line arguments
  const args = process.argv.slice(2);
  const orgIdArg = args[0];
  const testPhone = args[1] || '+15551234567'; // Default test phone
  const testName = args[2] || 'John Smith';     // Default test name
  const transferPhone = args[3] || '+15559876543'; // Default transfer phone

  // Step 1: Get organization ID
  let selectedOrg: any;

  if (orgIdArg) {
    // Use provided org ID
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgIdArg)
      .single();

    if (error || !org) {
      console.error('❌ Organization not found:', orgIdArg);
      process.exit(1);
    }
    selectedOrg = org;
  } else {
    // Use first org
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (orgsError || !orgs) {
      console.error('❌ No organizations found');
      process.exit(1);
    }
    selectedOrg = orgs;
  }

  console.log(`✅ Using Organization: ${selectedOrg.name} (${selectedOrg.id.substring(0, 8)}...)\n`);

  // Step 2: Create test contact for identity injection
  console.log('📞 Creating test contact for Identity Injection...');
  console.log(`   Phone: ${testPhone}`);
  console.log(`   Name: ${testName}`);

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .upsert({
      org_id: selectedOrg.id,
      phone: testPhone,
      name: testName,
      email: testName.toLowerCase().replace(' ', '.') + '@example.com',
      lead_status: 'contacted',  // ENUM: new, contacted, qualified, booked, converted, lost
      lead_score: 'warm',        // ENUM: hot, warm, cold (not numeric)
      service_interests: ['botox', 'consultation'],
      notes: 'Test contact for Phase 1 identity injection - AUTOMATED SETUP',
      last_contact_at: new Date().toISOString()
    }, {
      onConflict: 'org_id,phone'
    })
    .select()
    .single();

  if (contactError) {
    console.error('❌ Error creating contact:', contactError.message);
  } else {
    console.log(`✅ Contact created: ${contact.name} (${contact.phone})\n`);
  }

  // Step 3: Configure transfer settings
  console.log('📞 Configuring Transfer Settings...');
  console.log(`   Default Transfer: ${transferPhone}`);
  console.log(`   Billing Dept: ${transferPhone}`);
  console.log(`   Medical Dept: ${transferPhone}`);

  const transferDepartments = {
    general: transferPhone,
    billing: transferPhone,
    medical: transferPhone
  };

  const { error: settingsError } = await supabase
    .from('integration_settings')
    .upsert({
      org_id: selectedOrg.id,
      transfer_phone_number: transferPhone,
      transfer_departments: transferDepartments,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'org_id'
    });

  if (settingsError) {
    console.error('❌ Error updating transfer settings:', settingsError.message);
  } else {
    console.log('✅ Transfer configuration saved\n');
  }

  // Step 4: Create additional test contacts for lookup
  console.log('👥 Creating additional contacts for Caller Lookup testing...');

  const additionalContacts = [
    {
      name: 'Sarah Johnson',
      phone: '+15551112222',
      email: 'sarah.johnson@example.com',
      lead_status: 'qualified',  // ENUM value
      lead_score: 'warm',        // ENUM value (not numeric)
      notes: 'Test contact for caller lookup by name - AUTOMATED SETUP'
    },
    {
      name: 'Michael Chen',
      phone: '+15553334444',
      email: 'michael.chen@example.com',
      lead_status: 'new',        // ENUM value
      lead_score: 'cold',        // ENUM value
      notes: 'Test contact for caller lookup by email - AUTOMATED SETUP'
    },
    {
      name: 'Emily Rodriguez',
      phone: '+15555556666',
      email: 'emily.rodriguez@example.com',
      lead_status: 'contacted',  // ENUM value
      lead_score: 'warm',        // ENUM value
      notes: 'Test contact for multiple match scenario - AUTOMATED SETUP'
    }
  ];

  for (const contactData of additionalContacts) {
    const { error } = await supabase
      .from('contacts')
      .upsert({
        org_id: selectedOrg.id,
        ...contactData,
        service_interests: ['consultation']
      }, {
        onConflict: 'org_id,phone'
      });

    if (error) {
      console.log(`  ⚠️  Skipped ${contactData.name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${contactData.name}`);
    }
  }

  // Step 5: Verify setup
  console.log('\n🔍 Verifying Phase 1 setup...');

  const { data: verifyContacts, error: verifyError } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('org_id', selectedOrg.id)
    .ilike('notes', '%AUTOMATED SETUP%');

  if (!verifyError && verifyContacts) {
    console.log(`✅ Created ${verifyContacts.length} test contacts`);
  }

  const { data: verifySettings } = await supabase
    .from('integration_settings')
    .select('transfer_phone_number, transfer_departments')
    .eq('org_id', selectedOrg.id)
    .single();

  if (verifySettings?.transfer_phone_number) {
    console.log('✅ Transfer configuration verified');
  }

  // Summary
  console.log('\n📊 Setup Summary:');
  console.log(`  Organization: ${selectedOrg.name}`);
  console.log(`  Org ID: ${selectedOrg.id}`);
  console.log(`  Test Contact: ${testName} (${testPhone})`);
  console.log(`  Transfer Number: ${transferPhone}`);
  console.log(`  Additional Contacts: ${additionalContacts.length}`);

  console.log('\n🧪 Test Instructions:');
  console.log('\n1. IDENTITY INJECTION TEST:');
  console.log(`   - Call from: ${testPhone}`);
  console.log(`   - Expected: AI says "Hi ${testName.split(' ')[0]}, great to hear from you again!"`);
  console.log(`   - Verify: SELECT * FROM contacts WHERE phone = '${testPhone}';`);

  console.log('\n2. WARM HANDOFF TEST:');
  console.log(`   - Say: "I want to speak to a human"`);
  console.log(`   - Expected: Call transfers to ${transferPhone}`);
  console.log(`   - Verify: SELECT transfer_to, transfer_reason FROM call_logs ORDER BY created_at DESC LIMIT 5;`);

  console.log('\n3. CALLER LOOKUP TEST:');
  console.log(`   - Call from unknown number`);
  console.log(`   - Say: "I'm an existing customer, my name is Sarah Johnson"`);
  console.log(`   - Expected: AI finds contact and says "Found you, Sarah!"`);

  console.log('\n📝 Quick Verification SQL:');
  console.log(`   SELECT name, phone, notes FROM contacts WHERE org_id = '${selectedOrg.id}' AND notes LIKE '%AUTOMATED SETUP%';`);

  console.log('\n✅ Phase 1 test data setup complete!\n');
}

main().catch(console.error);
