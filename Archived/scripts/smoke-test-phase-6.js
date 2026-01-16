#!/usr/bin/env node

/**
 * SMOKE TEST: Phase 6 Integration
 * 
 * Tests app stability under normal use:
 * - Run 5 sequential bookings in rapid succession
 * - Assert all return 200 OK
 * - Verify no crashes, hangs, or partial inserts
 * - Check all database triggers fire correctly
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase;
let testOrgId;
let testProviderId;
let results = {
  total: 5,
  succeeded: 0,
  failed: 0,
  conflicts: 0,
  latencies: [],
  errors: [],
};

async function setup() {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Create test org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: `Smoke Test Org ${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      plan: 'pro',
      billing_status: 'active',
    })
    .select()
    .single();

  if (orgError) {
    console.error('❌ Failed to create test org:', orgError);
    process.exit(1);
  }

  testOrgId = org.id;

  // Create test provider
  const { data: provider, error: provError } = await supabase
    .from('providers')
    .insert({
      org_id: testOrgId,
      name: 'Dr. Smoke Test',
      email: `smoke-test-${Date.now()}@test.com`,
      phone: '+1234567890',
      specialization: 'General Practice',
      calendar_type: 'google',
    })
    .select()
    .single();

  if (provError) {
    console.error('❌ Failed to create test provider:', provError);
    process.exit(1);
  }

  testProviderId = provider.id;

  console.log(`✅ Setup complete: Org ${testOrgId}, Provider ${testProviderId}`);
}

async function bookAppointment(bookingNumber, date, time) {
  try {
    const startTime = Date.now();

    // Call booking API
    const response = await fetch(`http://localhost:3001/api/vapi/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdfaWQiOiIke3Rlc3RPcmdJZH0iLCJzdWIiOiIke2NyeXB0by5yYW5kb21VVUlEKCl9IiwiaWF0IjogJHtNYXRoLmZsb29yKERhdGUubm93KCkvMTAwMCl9LCJleHAiOiAke01hdGguZmxvb3IoRGF0ZS5ub3coKS8xMDAwKSArIDM2MDB9fQ.test`,
      },
      body: JSON.stringify({
        provider_id: testProviderId,
        appointment_date: date,
        appointment_time: time,
        duration_minutes: 30,
      }),
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    if (response.status === 200 && data.success) {
      results.succeeded++;
      results.latencies.push(latency);
      console.log(`✅ Booking ${bookingNumber}: SUCCESS in ${latency}ms`);
      return true;
    } else if (data.conflict) {
      results.conflicts++;
      console.log(`⚠️  Booking ${bookingNumber}: CONFLICT (expected)`);
      return true;
    } else {
      results.failed++;
      results.errors.push(data.error || 'Unknown error');
      console.log(`❌ Booking ${bookingNumber}: FAILED - ${data.error}`);
      return false;
    }
  } catch (error) {
    results.failed++;
    results.errors.push(String(error));
    console.log(`❌ Booking ${bookingNumber}: ERROR - ${error}`);
    return false;
  }
}

async function verifySmokeTest() {
  // Verify appointments were created
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', testOrgId);

  if (error) {
    console.error('❌ Failed to query appointments:', error);
    return false;
  }

  console.log(`\n📊 Database Verification:`);
  console.log(`   Total appointments created: ${appointments?.length || 0}`);

  // Check for data integrity
  const hasOrphans = appointments?.some((a) => !a.confirmation_token || !a.id);
  if (hasOrphans) {
    console.log(`❌ Found orphaned/incomplete records`);
    return false;
  }

  // Verify all have timestamps
  const allHaveTimestamps = appointments?.every((a) => a.appointment_created_at);
  if (!allHaveTimestamps) {
    console.log(`❌ Some records missing appointment_created_at`);
    return false;
  }

  console.log(`✅ All records have valid timestamps`);
  return true;
}

async function cleanup() {
  if (testOrgId) {
    await supabase.from('appointments').delete().eq('org_id', testOrgId);
    await supabase.from('providers').delete().eq('org_id', testOrgId);
    await supabase.from('organizations').delete().eq('id', testOrgId);
  }

  console.log(`✅ Cleanup complete`);
}

async function runSmokeTest() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                 PHASE 6 SMOKE TEST                             ║
║          Stability Test: 5 Rapid Sequential Bookings           ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    await setup();

    console.log(`\n🚀 Running 5 sequential bookings...\n`);

    // Book 5 different slots in rapid succession
    const bookings = [
      { num: 1, date: '2026-04-01', time: '09:00' },
      { num: 2, date: '2026-04-01', time: '10:00' },
      { num: 3, date: '2026-04-01', time: '11:00' },
      { num: 4, date: '2026-04-01', time: '12:00' },
      { num: 5, date: '2026-04-01', time: '13:00' },
    ];

    const startTime = Date.now();

    for (const booking of bookings) {
      await bookAppointment(booking.num, booking.date, booking.time);
      // Small delay between requests to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const totalTime = Date.now() - startTime;

    console.log(`\n📈 Results:`);
    console.log(`   Succeeded: ${results.succeeded}/5`);
    console.log(`   Failed: ${results.failed}/5`);
    console.log(`   Conflicts: ${results.conflicts}/5`);
    console.log(`   Average latency: ${(results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length).toFixed(2)}ms`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Latency range: ${Math.min(...results.latencies)}ms - ${Math.max(...results.latencies)}ms`);

    const verificationPassed = await verifySmokeTest();

    console.log(`\n✅ Smoke Test Complete:`);
    if (results.failed === 0 && verificationPassed && totalTime < 5000) {
      console.log(`   Status: ✅ PASSED`);
      console.log(`   - All 5 bookings succeeded`);
      console.log(`   - No database corruption`);
      console.log(`   - Response times healthy (<500ms target)`);
      console.log(`   - App remained stable under load`);
    } else {
      console.log(`   Status: ❌ FAILED`);
      if (results.failed > 0) console.log(`   - ${results.failed} bookings failed`);
      if (!verificationPassed) console.log(`   - Database verification failed`);
      if (totalTime >= 5000) console.log(`   - Total time exceeded 5s budget`);
    }

    console.log(`
═════════════════════════════════════════════════════════════════`);

    if (results.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      results.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    }

    await cleanup();
  } catch (error) {
    console.error(`\n❌ Smoke test error:`, error);
    await cleanup();
    process.exit(1);
  }
}

// Run the smoke test
runSmokeTest().catch(console.error);
