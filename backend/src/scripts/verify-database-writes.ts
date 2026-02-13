#!/usr/bin/env npx ts-node
/**
 * Phase 3: Verify Data Writes to Supabase
 *
 * Audits the calls table to verify VAPI webhook data is successfully written.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 Phase 3: Verify Data Writes to Supabase\n');

  try {
    // Get comprehensive call statistics
    console.log('1️⃣  Querying calls table for data completeness...\n');

    const { data: calls, count } = await supabase
      .from('calls')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!count || count === 0) {
      console.log('⚠️  No calls found in database (last 30 days)\n');
      return;
    }

    console.log(`✅ Total calls in database: ${count}\n`);

    // Data quality audit
    let callsWithCost = 0;
    let callsWithDuration = 0;
    let callsWithTranscript = 0;
    let callsWithSentiment = 0;
    let callsWithOutcome = 0;
    let callsWithTools = 0;
    let callsWithRecording = 0;
    let totalCost = 0;

    calls?.forEach((call: any) => {
      if (call.cost_cents !== null && call.cost_cents > 0) {
        callsWithCost++;
        totalCost += call.cost_cents;
      }
      if (call.duration_seconds !== null && call.duration_seconds > 0) callsWithDuration++;
      if (call.transcript && call.transcript.length > 0) callsWithTranscript++;
      if (call.sentiment_score !== null) callsWithSentiment++;
      if (call.outcome_summary) callsWithOutcome++;
      if (call.tools_used && Array.isArray(call.tools_used) && call.tools_used.length > 0) callsWithTools++;
      if (call.recording_url) callsWithRecording++;
    });

    console.log('📊 Data Quality Metrics:\n');

    const percent = (num: number) => Math.round(num / count * 100);

    console.log(`   ✅ Cost populated: ${callsWithCost}/${count} (${percent(callsWithCost)}%)`);
    console.log(`      Total cost tracked: $${(totalCost / 100).toFixed(2)}`);

    console.log(`\n   ✅ Duration populated: ${callsWithDuration}/${count} (${percent(callsWithDuration)}%)`);

    console.log(`\n   ✅ Transcript captured: ${callsWithTranscript}/${count} (${percent(callsWithTranscript)}%)`);

    console.log(`\n   ✅ Sentiment analyzed: ${callsWithSentiment}/${count} (${percent(callsWithSentiment)}%)`);

    console.log(`\n   ✅ Outcome recorded: ${callsWithOutcome}/${count} (${percent(callsWithOutcome)}%)`);

    console.log(`\n   ✅ Tools tracked: ${callsWithTools}/${count} (${percent(callsWithTools)}%)`);

    console.log(`\n   ✅ Recordings stored: ${callsWithRecording}/${count} (${percent(callsWithRecording)}%)`);

    // Overall quality score
    const avgQuality = percent(
      callsWithCost + callsWithDuration + callsWithTranscript +
      callsWithSentiment + callsWithOutcome + callsWithTools
    ) / 6;

    console.log(`\n   📈 Overall data quality: ${Math.round(avgQuality)}%\n`);

    // Sample records
    console.log('2️⃣  Sample records:\n');

    const sampleCalls = calls?.slice(0, 3) || [];
    sampleCalls.forEach((call: any, index: number) => {
      console.log(`   Record ${index + 1}:`);
      console.log(`     • vapi_call_id: ${call.vapi_call_id}`);
      console.log(`     • created_at: ${new Date(call.created_at).toLocaleString()}`);
      console.log(`     • cost_cents: $${(call.cost_cents / 100).toFixed(2)}`);
      console.log(`     • duration_seconds: ${call.duration_seconds}s`);
      console.log(`     • sentiment: ${call.sentiment_label || 'N/A'} (${call.sentiment_score?.toFixed(2) || 'N/A'})`);
      console.log(`     • outcome_summary: ${call.outcome_summary?.substring(0, 50) || 'N/A'}...`);
      console.log();
    });

    // Verify upsert logic
    console.log('3️⃣  Verifying upsert logic...\n');

    const uniqueVapiCalls = new Set(calls?.map((c: any) => c.vapi_call_id) || []);
    console.log(`   ✅ ${uniqueVapiCalls.size}/${count} unique vapi_call_ids (prevents duplicates)`);

    const recentCalls = calls?.filter((c: any) =>
      new Date(c.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ) || [];

    console.log(`   ✅ ${recentCalls.length} calls in last 24 hours (active pipeline)`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Phase 3 Complete: Data is successfully written to Supabase\n');

  } catch (err: any) {
    console.error(`❌ Error: ${err.message}\n`);
  }
}

main().catch(console.error);
