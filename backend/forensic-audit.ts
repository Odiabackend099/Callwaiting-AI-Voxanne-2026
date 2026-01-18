import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function audit() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 FORENSIC AUDIT: Contact/Appointment Link');
  console.log('='.repeat(80));

  // Query 1: Does Samuel or Austin exist in contacts?
  console.log('\n📋 QUERY 1: Searching for Samuel/Austin in contacts table...\n');

  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('id, name, email, created_at')
    .eq('org_id', orgId);

  if (contactError) {
    console.error('❌ Error querying contacts:', contactError.message);
  } else if (!contacts || contacts.length === 0) {
    console.log('❌ NO contacts found in entire org');
  } else {
    console.log(`✅ Total contacts in org: ${contacts.length}\n`);

    const matching = contacts.filter((c: any) =>
      c.name?.toLowerCase().includes('samuel') ||
      c.name?.toLowerCase().includes('austin') ||
      c.email?.toLowerCase().includes('samuel') ||
      c.email?.toLowerCase().includes('austin')
    );

    if (matching.length === 0) {
      console.log('❌ CRITICAL: NO Samuel or Austin found\n');
    } else {
      console.log(`✅ Found ${matching.length} matching:\n`);
      matching.forEach((c: any, i: number) => {
        console.log(`[${i + 1}] Name: ${c.name}`);
        console.log(`    Email: ${c.email}`);
        console.log(`    ID: ${c.id}`);
        console.log(`    Created: ${c.created_at}`);
        console.log('');
      });
    }
  }

  // Query 2: Are there orphaned appointments?
  console.log('\n📋 QUERY 2: Checking for orphaned appointments (contact_id IS NULL)...\n');

  const { data: orphaned, error: orphanError } = await supabase
    .from('appointments')
    .select('id, created_at, contact_id, service_type, scheduled_at')
    .eq('org_id', orgId)
    .is('contact_id', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (orphanError) {
    console.error('❌ Error:', orphanError.message);
  } else if (!orphaned || orphaned.length === 0) {
    console.log('✅ No orphaned appointments - all have contact_id set\n');
  } else {
    console.log(`⚠️ CRITICAL: Found ${orphaned.length} ORPHANED appointments:\n`);
    orphaned.forEach((apt: any, i: number) => {
      console.log(`[${i + 1}] Service: ${apt.service_type}`);
      console.log(`    Scheduled: ${apt.scheduled_at}`);
      console.log(`    Created: ${apt.created_at}`);
      console.log(`    Contact ID: ${apt.contact_id}`);
      console.log('');
    });
  }

  // Query 3: What does a normal linked appointment look like?
  console.log('\n📋 QUERY 3: Sample of properly linked appointment...\n');

  const { data: linked, error: linkedError } = await supabase
    .from('appointments')
    .select('id, contact_id, service_type, created_at')
    .eq('org_id', orgId)
    .not('contact_id', 'is', null)
    .limit(1);

  if (linkedError) {
    console.error('Error:', linkedError.message);
  } else if (linked && linked.length > 0) {
    const apt = linked[0];
    console.log(`✅ Sample of properly linked appointment:`);
    console.log(`   ID: ${apt.id}`);
    console.log(`   Service: ${apt.service_type}`);
    console.log(`   Contact ID: ${apt.contact_id}`);
    console.log(`   Created: ${apt.created_at}\n`);
  }

  console.log('='.repeat(80));
  console.log('\n🎯 CONCLUSION:\n');

  const hasContact = contacts && contacts.some((c: any) =>
    c.name?.toLowerCase().includes('samuel') ||
    c.name?.toLowerCase().includes('austin')
  );

  if (!hasContact) {
    console.log('❌ CONFIRMED: Samuel/Austin contact was NEVER created');
    console.log('   The booking tool is NOT creating contacts before appointments');
    console.log('   This is why Sarah says "technical issue"\n');
  }

  if (orphaned && orphaned.length > 0) {
    console.log(`⚠️ There are ${orphaned.length} orphaned appointments`);
    console.log('   These are appointments without a linked contact\n');
  }
}

audit().catch(console.error);
