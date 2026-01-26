#!/usr/bin/env ts-node
/**
 * Setup Phase 1 Test Data
 *
 * This script creates test data for Phase 1 features:
 * 1. Test contact with known phone number (for identity injection)
 * 2. Transfer configuration in integration_settings
 * 3. Verifies tables exist
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Load environment variables
config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🚀 Phase 1 Test Data Setup\n');
  console.log('This script will create test data for:');
  console.log('  1. Identity Injection (test contact)');
  console.log('  2. Warm Handoff (transfer configuration)');
  console.log('  3. Caller Lookup (additional contacts)\n');

  // Step 1: Get organization ID
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(10);

  if (orgsError || !orgs || orgs.length === 0) {
    console.error('❌ Error fetching organizations:', orgsError?.message);
    process.exit(1);
  }

  console.log('📋 Available Organizations:');
  orgs.forEach((org, idx) => {
    console.log(`  ${idx + 1}. ${org.name} (${org.id.substring(0, 8)}...)`);
  });

  const orgChoice = await question('\nSelect organization number (or press Enter for first): ');
  const selectedOrg = orgs[parseInt(orgChoice || '1') - 1] || orgs[0];
  console.log(`✅ Selected: ${selectedOrg.name}\n`);

  // Step 2: Create test contact for identity injection
  console.log('📞 Creating test contact for Identity Injection...');

  const testPhone = await question('Enter test phone number (E.164 format, e.g., +15551234567): ');
  const testName = await question('Enter test contact name (e.g., John Smith): ');
  const testEmail = await question('Enter test email (optional, press Enter to skip): ');

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .upsert({
      org_id: selectedOrg.id,
      phone: testPhone,
      name: testName,
      email: testEmail || null,
      lead_status: 'contacted',
      lead_score: 75,
      service_interests: ['botox', 'consultation'],
      notes: 'Test contact for Phase 1 identity injection',
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

  const transferPhone = await question('Enter default transfer phone number (E.164): ');
  const billingPhone = await question('Enter billing department phone (or press Enter to skip): ');
  const medicalPhone = await question('Enter medical department phone (or press Enter to skip): ');

  const transferDepartments = {
    general: transferPhone,
    billing: billingPhone || transferPhone,
    medical: medicalPhone || transferPhone
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
      lead_status: 'qualified',
      notes: 'Test contact for caller lookup by name'
    },
    {
      name: 'Michael Chen',
      phone: '+15553334444',
      email: 'michael.chen@example.com',
      lead_status: 'new',
      notes: 'Test contact for caller lookup by email'
    }
  ];

  for (const contactData of additionalContacts) {
    const { error } = await supabase
      .from('contacts')
      .upsert({
        org_id: selectedOrg.id,
        ...contactData,
        lead_score: 60,
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

  // Step 5: Verify Phase 1 tables exist
  console.log('\n🔍 Verifying Phase 1 setup...');

  // Check integration_settings columns
  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'integration_settings'
        AND column_name LIKE 'transfer%'
      `
    } as any);

  if (!colError && columns) {
    console.log('✅ Transfer columns exist in integration_settings');
  }

  // Summary
  console.log('\n📊 Setup Summary:');
  console.log(`  Organization: ${selectedOrg.name}`);
  console.log(`  Test Contact: ${testName} (${testPhone})`);
  console.log(`  Transfer Number: ${transferPhone}`);
  console.log(`  Additional Contacts: ${additionalContacts.length}`);

  console.log('\n🧪 Next Steps:');
  console.log('  1. Restart backend: npm run dev');
  console.log('  2. Make a test call from: ' + testPhone);
  console.log('  3. AI should greet you: "Hi ' + testName.split(' ')[0] + '!"');
  console.log('  4. Say "I want to speak to a human" to test transfer');
  console.log('  5. Say "I\'m Sarah Johnson" to test caller lookup\n');

  rl.close();
}

main().catch(console.error);
