/**
 * Diagnostic Script: Golden Record SSOT Data Verification
 *
 * Purpose: Check if recent calls were saved to database with Golden Record fields populated
 * Run: npm run diagnose:golden-record
 */

import { supabase } from '../services/supabase-client';
import { log as logger } from '../services/logger';

async function diagnoseMissingData() {
  console.log('\n🔍 GOLDEN RECORD DIAGNOSTIC REPORT\n');
  console.log('═'.repeat(60));

  try {
    // 1. Check database connection
    console.log('\n📡 Step 1: Database Connection Test');
    const { data: healthCheck, error: healthError } = await supabase
      .from('calls')
      .select('id')
      .limit(1);

    if (healthError) {
      console.error('❌ Database connection failed:', healthError.message);
      return;
    }
    console.log('✅ Database connection: OK');

    // 2. Check total calls count
    console.log('\n📊 Step 2: Call Count Statistics');
    const { count: totalCalls, error: countError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Failed to count calls:', countError.message);
    } else {
      console.log(`✅ Total calls in database: ${totalCalls}`);
    }

    // 3. Check most recent calls
    console.log('\n🔔 Step 3: Recent Calls (Last 5)');
    const { data: recentCalls, error: recentError } = await supabase
      .from('calls')
      .select(`
        id,
        vapi_call_id,
        created_at,
        call_direction,
        org_id,
        cost_cents,
        tools_used,
        appointment_id,
        ended_reason,
        status
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Failed to fetch recent calls:', recentError.message);
    } else if (!recentCalls || recentCalls.length === 0) {
      console.log('⚠️  No calls found in database');
    } else {
      console.log(`Found ${recentCalls.length} recent calls:\n`);
      recentCalls.forEach((call, index) => {
        console.log(`${index + 1}. Call ID: ${call.vapi_call_id}`);
        console.log(`   Created: ${new Date(call.created_at).toLocaleString()}`);
        console.log(`   Direction: ${call.call_direction}`);
        console.log(`   Status: ${call.status}`);
        console.log(`   Org ID: ${call.org_id}`);
        console.log(`   Cost (cents): ${call.cost_cents}`);
        // Show raw value and parsed value for tools_used
        console.log(`   Tools Used (raw): ${JSON.stringify(call.tools_used)}`);
        console.log(`   Tools Used (display): ${Array.isArray(call.tools_used) && call.tools_used.length > 0 ? call.tools_used.join(', ') : '(none)'}`);
        console.log(`   Appointment ID: ${call.appointment_id || '(not linked)'}`);
        console.log(`   Ended Reason: ${call.ended_reason || '(none)'}`);
        console.log('');
      });
    }

    // 4. Check Golden Record field population
    console.log('\n📈 Step 4: Golden Record Field Statistics');

    // Get total call count
    const { count: totalCallCount, error: totalError } = await supabase
      .from('calls')
      .select('id', { count: 'exact', head: true });

    if (totalError || !totalCallCount) {
      console.error('❌ Failed to get total call count:', totalError?.message);
    } else {
      // Get count for each Golden Record field
      const { count: costCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .gt('cost_cents', 0);

      const { count: toolsCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .not('tools_used', 'is', null);

      const { count: appointmentCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .not('appointment_id', 'is', null);

      const { count: reasonCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .not('ended_reason', 'is', null);

      console.log(`Total calls: ${totalCallCount}`);
      console.log(`  • With cost_cents populated: ${costCount || 0} (${Math.round(((costCount || 0) / totalCallCount) * 100)}%)`);
      console.log(`  • With tools_used populated: ${toolsCount || 0} (${Math.round(((toolsCount || 0) / totalCallCount) * 100)}%)`);
      console.log(`  • With appointment_id linked: ${appointmentCount || 0} (${Math.round(((appointmentCount || 0) / totalCallCount) * 100)}%)`);
      console.log(`  • With ended_reason populated: ${reasonCount || 0} (${Math.round(((reasonCount || 0) / totalCallCount) * 100)}%)`);
    }

    // 5. Check for any errors in recent webhook processing
    console.log('\n⚠️  Step 5: Recent Webhook Processing Issues');
    const { data: recentLogs, error: logsError } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsError) {
      console.log('ℹ️  Webhook delivery log not available (not critical)');
    } else if (!recentLogs || recentLogs.length === 0) {
      console.log('✅ No recent webhook failures detected');
    } else {
      console.log(`⚠️  Found ${recentLogs.length} failed webhooks:`);
      recentLogs.forEach((log) => {
        console.log(`  • Event: ${log.event_type}`);
        console.log(`    Error: ${log.error_message}`);
      });
    }

    // 6. Diagnose the issue
    console.log('\n🔧 DIAGNOSIS:');
    console.log('═'.repeat(60));

    if (!recentCalls || recentCalls.length === 0) {
      console.log(`
❌ ISSUE: No calls are being saved to the database.

POSSIBLE CAUSES:
1. Webhook not being triggered (Vapi not calling the endpoint)
2. Webhook endpoint not reachable (firewall/routing issue)
3. Webhook validation failing (Vapi signature verification)
4. Database upsert silently failing
5. Backend not running on the correct port

ACTION ITEMS:
1. Verify backend is running: curl http://localhost:3001/health
2. Check Vapi webhook configuration is pointing to correct URL
3. Review backend server logs for webhook processing errors
4. Verify database connection credentials in .env
5. Test webhook manually with cURL or Postman
      `);
    } else {
      const latestCall = recentCalls[0];
      const hasAllFields =
        latestCall.cost_cents &&
        latestCall.tools_used &&
        latestCall.appointment_id &&
        latestCall.ended_reason;

      if (hasAllFields) {
        console.log(`
✅ SUCCESS: Calls are being saved with all Golden Record fields!

The most recent call (ID: ${latestCall.vapi_call_id.substring(0, 8)}...) has:
  ✓ cost_cents: ${latestCall.cost_cents} cents
  ✓ tools_used: ${latestCall.tools_used.join(', ')}
  ✓ appointment_id: ${latestCall.appointment_id}
  ✓ ended_reason: ${latestCall.ended_reason}

Dashboard should display this data correctly.
        `);
      } else {
        console.log(`
⚠️  WARNING: Calls are saved but some Golden Record fields are empty!

Latest call (ID: ${latestCall.vapi_call_id.substring(0, 8)}...):
  ${latestCall.cost_cents ? '✓' : '✗'} cost_cents: ${latestCall.cost_cents || '(EMPTY)'}
  ${latestCall.tools_used?.length ? '✓' : '✗'} tools_used: ${latestCall.tools_used?.join(', ') || '(EMPTY)'}
  ${latestCall.appointment_id ? '✓' : '✗'} appointment_id: ${latestCall.appointment_id || '(NOT LINKED)'}
  ${latestCall.ended_reason ? '✓' : '✗'} ended_reason: ${latestCall.ended_reason || '(EMPTY)'}

POSSIBLE CAUSES:
1. Webhook handler not extracting/storing these fields
2. Vapi payload missing the required data (cost, messages, etc.)
3. Database columns not created by migration
4. Backend code changes not deployed/reloaded

ACTION ITEMS:
1. Check vapi-webhook.ts lines 772-778 for extraction logic
2. Verify migration 20260213_golden_record_schema.sql was applied
3. Check Vapi webhook payload structure
4. Restart backend server to reload code
        `);
      }
    }

    console.log('\n═'.repeat(60));
    console.log('Report generated:', new Date().toISOString());
    console.log('═'.repeat(60) + '\n');

  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error.message);
    console.error(error);
  }
}

// Run the diagnostic
diagnoseMissingData().catch(console.error);

// Export for reuse
export { diagnoseMissingData };
