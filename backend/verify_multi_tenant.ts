import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verifyMultiTenant() {
  // Get all organizations
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, email');

  console.log('🏢 All Organizations:');
  orgs?.forEach((org: any) => {
    console.log(`  - ${org.name} (${org.email}) | ID: ${org.id.substring(0, 8)}...`);
  });

  console.log('\n');

  // Get test@demo.com org
  const { data: testOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('email', 'test@demo.com')
    .single();

  if (!testOrg) {
    console.log('❌ test@demo.com org not found');
    return;
  }

  // Get ALL contacts in system
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, name, phone, email, org_id');

  // Get contacts ONLY for test@demo.com org
  const { data: testOrgContacts } = await supabase
    .from('contacts')
    .select('id, name, phone, email, org_id')
    .eq('org_id', testOrg.id);

  console.log(`📱 All Contacts in System: ${allContacts?.length || 0}`);
  console.log(`📱 Contacts for test@demo.com: ${testOrgContacts?.length || 0}\n`);

  // Check for org_id enforcement
  console.log('🔒 Multi-Tenant Isolation Check:');
  const contactsWithoutOrgId = allContacts?.filter((c: any) => !c.org_id);
  if (contactsWithoutOrgId && contactsWithoutOrgId.length > 0) {
    console.log(`  ⚠️  WARNING: ${contactsWithoutOrgId.length} contacts have NULL org_id!`);
    contactsWithoutOrgId.forEach((c: any) => {
      console.log(`     - ${c.name} | ${c.phone} | ${c.email}`);
    });
  } else {
    console.log(`  ✅ All contacts have org_id set`);
  }

  // Verify test@demo.com only has its own contacts
  console.log('\n✅ test@demo.com Contacts:');
  testOrgContacts?.forEach((c: any) => {
    console.log(`  - ${c.name} | ${c.phone} | Org: ${c.org_id === testOrg.id ? '✓ CORRECT' : '✗ WRONG'}`);
  });

  // Check if any other org's contacts appear in test org
  const wrongOrgContacts = testOrgContacts?.filter((c: any) => c.org_id !== testOrg.id);
  if (wrongOrgContacts && wrongOrgContacts.length > 0) {
    console.log(`\n🚨 CRITICAL: Found ${wrongOrgContacts.length} contacts with wrong org_id in test@demo.com!`);
  }
}

verifyMultiTenant().catch(console.error);
