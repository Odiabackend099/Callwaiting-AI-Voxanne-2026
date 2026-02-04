/**
 * Backfill caller names for historical calls
 * Enriches calls.caller_name from contacts.name
 *
 * Run: cd backend && npx ts-node src/scripts/backfill-caller-names.ts
 */
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

async function backfillCallerNames() {
  console.log('🔄 Starting caller name backfill...\n');

  // Get all calls with NULL caller_name
  const { data: callsToEnrich, error: queryError } = await supabase
    .from('calls')
    .select('id, phone_number, org_id, call_direction, created_at')
    .or('caller_name.is.null,caller_name.eq.Unknown Caller');

  if (queryError) {
    console.error('❌ Query failed:', queryError.message);
    return;
  }

  console.log(`📊 Found ${callsToEnrich?.length || 0} calls needing enrichment\n`);

  if (!callsToEnrich || callsToEnrich.length === 0) {
    console.log('✅ No calls need enrichment. All done!');
    return;
  }

  let enrichedCount = 0;
  let notFoundCount = 0;
  let skipCount = 0;

  for (const call of callsToEnrich) {
    if (!call.phone_number) {
      skipCount++;
      console.log(`⏩ Skipping call ${call.id} (no phone number)`);
      continue;
    }

    // Look up contact by phone number
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('name')
      .eq('org_id', call.org_id)
      .eq('phone', call.phone_number)
      .maybeSingle();

    if (contactError) {
      console.error(`❌ Contact lookup failed for call ${call.id}:`, contactError.message);
      continue;
    }

    if (contact?.name && contact.name !== 'Unknown Caller') {
      // Update call with enriched name
      const { error: updateError } = await supabase
        .from('calls')
        .update({ caller_name: contact.name })
        .eq('id', call.id);

      if (updateError) {
        console.error(`❌ Update failed for call ${call.id}:`, updateError.message);
      } else {
        enrichedCount++;
        console.log(`✅ Enriched call ${call.id.substring(0, 8)}...: ${call.phone_number} → ${contact.name}`);
      }
    } else {
      // Set default name to avoid future lookups
      const { error: updateError } = await supabase
        .from('calls')
        .update({ caller_name: 'Unknown Caller' })
        .eq('id', call.id);

      if (updateError) {
        console.error(`❌ Update failed for call ${call.id}:`, updateError.message);
      } else {
        notFoundCount++;
        console.log(`⚠️  No contact found for call ${call.id.substring(0, 8)}...: ${call.phone_number} → Unknown Caller`);
      }
    }

    // Add a small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📈 Backfill Summary:');
  console.log(`   Total processed: ${callsToEnrich.length}`);
  console.log(`   Successfully enriched: ${enrichedCount}`);
  console.log(`   Not found (set to Unknown Caller): ${notFoundCount}`);
  console.log(`   Skipped (no phone number): ${skipCount}`);
  console.log('\n✅ Backfill complete!\n');

  // Show enrichment rate
  const totalValid = callsToEnrich.length - skipCount;
  if (totalValid > 0) {
    const enrichmentRate = (enrichedCount / totalValid) * 100;
    console.log(`📊 Enrichment rate: ${enrichmentRate.toFixed(1)}% (${enrichedCount}/${totalValid})\n`);
  }
}

backfillCallerNames().catch((error) => {
  console.error('❌ Backfill script failed:', error);
  process.exit(1);
});
