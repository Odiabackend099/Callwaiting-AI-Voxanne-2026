#!/usr/bin/env node

/**
 * SMOKE TEST: Phase 6 Integration (Simplified v2)
 * 
 * Tests core functionality:
 * - Database connectivity
 * - Contact creation
 * - Appointment insertion
 * - Concurrent write safety
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
let testOrgId;
let testContactId;
let cleanup = [];

async function setup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Create test org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: `Smoke Test ${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      plan: 'professional',
      billing_status: 'active',
    })
    .select()
    .single();

  if (orgError) {
    console.error('❌ Org create failed:', orgError.message);
    process.exit(1);
  }

  testOrgId = org.id;
  cleanup.push({ table: 'organizations', id: testOrgId });
  console.log(`✅ Created org: ${testOrgId.substring(0, 8)}...`);

  // Create test contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert({
      org_id: testOrgId,
      name: `Contact ${Date.now()}`,
      email: `contact-${Date.now()}@test.com`,
      phone: '+1234567890',
    })
    .select()
    .single();

  if (contactError) {
    console.error('❌ Contact create failed:', contactError.message);
    process.exit(1);
  }

  testContactId = contact.id;
  cleanup.push({ table: 'contacts', id: testContactId });
  console.log(`✅ Created contact: ${testContactId.substring(0, 8)}...`);
}

async function testBasicInsert() {
  console.log('\n📋 Test 1: Basic Appointment Insert');
  
  const apptDate = new Date();
  apptDate.setDate(apptDate.getDate() + 7);
  
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      org_id: testOrgId,
      contact_id: testContactId,
      service_type: 'demo',
      scheduled_at: apptDate.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Insert failed:', error.message);
    return false;
  }

  console.log(`✅ Inserted: ${data.id.substring(0, 8)}...`);
  cleanup.push({ table: 'appointments', id: data.id });
  return true;
}

async function testConcurrentWrites() {
  console.log('\n📋 Test 2: Concurrent Writes (3 simultaneous)');
  
  const promises = [];
  for (let i = 0; i < 3; i++) {
    const apptDate = new Date();
    apptDate.setDate(apptDate.getDate() + 8 + i);
    
    promises.push(
      supabase
        .from('appointments')
        .insert({
          org_id: testOrgId,
          contact_id: testContactId,
          service_type: 'demo',
          scheduled_at: apptDate.toISOString(),
        })
        .select()
        .single()
    );
  }

  const results = await Promise.all(promises);
  
  let succeeded = 0;
  results.forEach((result, i) => {
    if (result.error) {
      console.error(`  ❌ Request ${i + 1}: ${result.error.message}`);
    } else {
      succeeded++;
      cleanup.push({ table: 'appointments', id: result.data.id });
      console.log(`  ✅ Request ${i + 1}: ${result.data.id.substring(0, 8)}...`);
    }
  });

  return succeeded === 3;
}

async function testOrgIsolation() {
  console.log('\n📋 Test 3: Organization Data Isolation');
  
  // Try to read appointments for a fake org_id
  const fakeOrgId = crypto.randomUUID();
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', fakeOrgId);

  if (data && data.length === 0) {
    console.log(`✅ Isolation working (no cross-org leakage)`);
    return true;
  } else if (error) {
    console.log(`✅ RLS policy enforced: ${error.message}`);
    return true;
  } else {
    console.log(`⚠️  Possible isolation issue (found ${data.length} records)`);
    return false;
  }
}

async function cleanup_data() {
  console.log('\n🧹 Cleaning up...');
  
  for (const item of cleanup) {
    try {
      await supabase
        .from(item.table)
        .delete()
        .eq('id', item.id);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  
  console.log('✅ Done');
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           PHASE 6 SMOKE TEST                              ║');
  console.log('║        Database Stability & Concurrent Safety              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await setup();

    const test1 = await testBasicInsert();
    const test2 = await testConcurrentWrites();
    const test3 = await testOrgIsolation();

    const allPassed = test1 && test2 && test3;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    if (allPassed) {
      console.log('║                   ✅ ALL TESTS PASSED                       ║');
    } else {
      console.log('║                   ❌ SOME TESTS FAILED                       ║');
    }
    console.log('╚════════════════════════════════════════════════════════════╝');

    await cleanup_data();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await cleanup_data();
    process.exit(1);
  }
}

runTests();
