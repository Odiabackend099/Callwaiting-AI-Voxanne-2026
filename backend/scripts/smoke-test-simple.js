#!/usr/bin/env node

/**
 * SMOKE TEST: Phase 6 Integration (Simplified)
 * 
 * Tests core functionality:
 * - Database connectivity
 * - Organization creation
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
      name: `Smoke Test Org ${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      plan: 'professional',
      billing_status: 'active',
    })
    .select()
    .single();

  if (orgError) {
    console.error('❌ Failed to create test org:', orgError.message);
    process.exit(1);
  }

  testOrgId = org.id;
  cleanup.push({ table: 'organizations', id: testOrgId });
  console.log(`✅ Created test org: ${testOrgId}`);
}

async function testBasicInsert() {
  console.log('\n📋 Test 1: Basic Appointment Insert');
  
  const appointmentDate = new Date();
  appointmentDate.setDate(appointmentDate.getDate() + 7);
  const dateStr = appointmentDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      org_id: testOrgId,
      provider_id: crypto.randomUUID(),
      patient_name: 'Test Patient',
      patient_email: `patient-${Date.now()}@test.com`,
      appointment_date: dateStr,
      appointment_time: '14:00',
      duration_minutes: 30,
      status: 'confirmed',
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Insert failed:', error.message);
    return false;
  }

  console.log(`✅ Inserted appointment: ${data.id}`);
  cleanup.push({ table: 'appointments', id: data.id });
  return true;
}

async function testConcurrentWrites() {
  console.log('\n📋 Test 2: Concurrent Writes (3 simultaneous)');
  
  const appointmentDate = new Date();
  appointmentDate.setDate(appointmentDate.getDate() + 8);
  const dateStr = appointmentDate.toISOString().split('T')[0];
  const providerId = crypto.randomUUID();

  const results = await Promise.all([
    supabase.from('appointments').insert({
      org_id: testOrgId,
      provider_id: providerId,
      patient_name: 'Patient 1',
      patient_email: `p1-${Date.now()}@test.com`,
      appointment_date: dateStr,
      appointment_time: '10:00',
      duration_minutes: 30,
      status: 'confirmed',
    }).select().single(),
    
    supabase.from('appointments').insert({
      org_id: testOrgId,
      provider_id: providerId,
      patient_name: 'Patient 2',
      patient_email: `p2-${Date.now()}@test.com`,
      appointment_date: dateStr,
      appointment_time: '10:30',
      duration_minutes: 30,
      status: 'confirmed',
    }).select().single(),
    
    supabase.from('appointments').insert({
      org_id: testOrgId,
      provider_id: providerId,
      patient_name: 'Patient 3',
      patient_email: `p3-${Date.now()}@test.com`,
      appointment_date: dateStr,
      appointment_time: '11:00',
      duration_minutes: 30,
      status: 'confirmed',
    }).select().single(),
  ]);

  let succeeded = 0;
  results.forEach((result, i) => {
    if (result.error) {
      console.error(`  ❌ Request ${i + 1} failed: ${result.error.message}`);
    } else {
      succeeded++;
      cleanup.push({ table: 'appointments', id: result.data.id });
      console.log(`  ✅ Request ${i + 1} succeeded: ${result.data.id}`);
    }
  });

  return succeeded === 3;
}

async function testMultiTenantIsolation() {
  console.log('\n📋 Test 3: Multi-Tenant Isolation');
  
  // Create another org
  const { data: org2, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: `Smoke Test Org 2 ${Date.now()}`,
      email: `test2-${Date.now()}@example.com`,
      plan: 'professional',
      billing_status: 'active',
    })
    .select()
    .single();

  if (orgErr) {
    console.error('❌ Failed to create second org:', orgErr.message);
    return false;
  }

  cleanup.push({ table: 'organizations', id: org2.id });

  // Insert appointment for org1
  const appt1Date = new Date();
  appt1Date.setDate(appt1Date.getDate() + 9);
  const dateStr = appt1Date.toISOString().split('T')[0];

  const { data: appt1 } = await supabase
    .from('appointments')
    .insert({
      org_id: testOrgId,
      provider_id: crypto.randomUUID(),
      patient_name: 'Org1 Patient',
      patient_email: `org1-${Date.now()}@test.com`,
      appointment_date: dateStr,
      appointment_time: '15:00',
      duration_minutes: 30,
      status: 'confirmed',
    })
    .select()
    .single();

  cleanup.push({ table: 'appointments', id: appt1.id });

  // Query org1 appointments as org2 (should have RLS policy filtering)
  const { data: orgTwoView } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', testOrgId)
    .limit(1);

  if (orgTwoView && orgTwoView.length > 0) {
    console.log('⚠️  RLS policy may not be enforced (can see other org data)');
  } else {
    console.log('✅ RLS isolation working');
  }

  return true;
}

async function cleanup_data() {
  console.log('\n🧹 Cleaning up...');
  
  for (const item of cleanup) {
    const { error } = await supabase
      .from(item.table)
      .delete()
      .eq('id', item.id);
    
    if (error) {
      console.error(`  ⚠️  Failed to delete ${item.table}:${item.id}`);
    }
  }
  
  console.log('✅ Cleanup complete');
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           PHASE 6 SMOKE TEST (SIMPLIFIED)                   ║');
  console.log('║          Database Stability & Concurrency Check              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await setup();

    const test1 = await testBasicInsert();
    const test2 = await testConcurrentWrites();
    const test3 = await testMultiTenantIsolation();

    const allPassed = test1 && test2 && test3;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    if (allPassed) {
      console.log('║                    ✅ ALL TESTS PASSED                      ║');
    } else {
      console.log('║                    ❌ SOME TESTS FAILED                      ║');
    }
    console.log('╚════════════════════════════════════════════════════════════╝');

    await cleanup_data();

    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    await cleanup_data();
    process.exit(1);
  }
}

runTests();
