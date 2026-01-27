/**
 * Enforce Provider Fallback Protocol - One-Time Batch Script
 *
 * Purpose: Apply provider fallbacks to ALL existing assistants across ALL organizations
 *
 * This script enforces the Reliability Protocol by:
 * 1. Iterating through all organizations with Vapi credentials
 * 2. Listing all assistants for each organization
 * 3. Checking if fallbacks are already configured
 * 4. Adding fallbacks to assistants that are missing them
 * 5. Reporting success/skip/failure statistics
 *
 * Usage:
 *   # Dry run (preview changes without applying)
 *   npx ts-node backend/src/scripts/enforce-provider-fallbacks.ts --dry-run
 *
 *   # Apply to all organizations
 *   npx ts-node backend/src/scripts/enforce-provider-fallbacks.ts
 *
 *   # Apply to single organization (for testing)
 *   npx ts-node backend/src/scripts/enforce-provider-fallbacks.ts --org-id=YOUR_ORG_ID
 *
 * Output: Detailed logs showing each organization and assistant processed
 */

import { createClient } from '@supabase/supabase-js';
import { VapiClient } from '../services/vapi-client';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import {
  buildTranscriberWithFallbacks,
  buildVoiceWithFallbacks,
  getMissingFallbackConfigs,
  hasProperFallbacks
} from '../config/vapi-fallbacks';

// Load environment variables
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });

// ========================================
// Configuration & Argument Parsing
// ========================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Parse CLI arguments
const isDryRun = process.argv.includes('--dry-run');
const orgIdArg = process.argv.find(arg => arg.startsWith('--org-id='))?.split('=')[1];

// ========================================
// Statistics Tracking
// ========================================

interface EnforcementStats {
  totalOrgs: number;
  orgsProcessed: number;
  orgsWithErrors: number;
  totalAssistants: number;
  assistantsFixed: number;
  assistantsSkipped: number;
  assistantsFailed: number;
  errors: Array<{ org: string; assistant: string; error: string }>;
}

const stats: EnforcementStats = {
  totalOrgs: 0,
  orgsProcessed: 0,
  orgsWithErrors: 0,
  totalAssistants: 0,
  assistantsFixed: 0,
  assistantsSkipped: 0,
  assistantsFailed: 0,
  errors: []
};

// ========================================
// Main Enforcement Function
// ========================================

async function enforceProviderFallbacks() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                  🛡️  RELIABILITY PROTOCOL ENFORCEMENT                 ║');
  console.log('║              Enforcing Provider Fallback Configuration                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // ========== ENVIRONMENT VALIDATION ==========
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: Supabase credentials not configured');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('🔍 DRY-RUN MODE: Changes will NOT be applied\n');
  } else {
    console.log('💾 LIVE MODE: Changes WILL be applied\n');
  }

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ========== FETCH ORGANIZATIONS ==========
    console.log('📊 Fetching organizations with Vapi credentials...\n');

    let query = supabase.from('org_credentials').select('org_id, provider').eq('provider', 'vapi');

    if (orgIdArg) {
      query = query.eq('org_id', orgIdArg);
    }

    const { data: credentials, error: credError } = await query;

    if (credError) {
      console.error('❌ Failed to fetch organizations:', credError.message);
      process.exit(1);
    }

    if (!credentials || credentials.length === 0) {
      console.log('ℹ️  No organizations with Vapi credentials found');
      process.exit(0);
    }

    // Get unique organization IDs
    const orgIds = [...new Set(credentials.map(c => c.org_id))];
    stats.totalOrgs = orgIds.length;

    console.log(`✅ Found ${orgIds.length} organization(s) with Vapi credentials\n`);

    // ========== PROCESS EACH ORGANIZATION ==========
    for (const orgId of orgIds) {
      console.log(`🏢 Processing Organization: ${orgId}`);
      let orgErrors = false;

      try {
        // Get Vapi credentials for this organization
        const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
        const vapi = new VapiClient(vapiCreds.apiKey);

        // List all assistants for this organization
        const assistants = await vapi.listAssistants();

        if (!assistants || assistants.length === 0) {
          console.log(`   ℹ️  No assistants found for this organization`);
          stats.orgsProcessed++;
          continue;
        }

        console.log(`   📋 Found ${assistants.length} assistant(s)`);
        stats.totalAssistants += assistants.length;

        // ========== PROCESS EACH ASSISTANT ==========
        for (const assistant of assistants) {
          const assistantId = assistant.id;
          const assistantName = assistant.name || 'Unnamed';
          const status = `${assistantName} (${assistantId})`;

          try {
            // Check if assistant already has proper fallbacks
            if (hasProperFallbacks(assistant)) {
              console.log(`   ⏭️  SKIP: ${status}`);
              console.log(`       Already has proper fallback configuration`);
              stats.assistantsSkipped++;
              continue;
            }

            // Identify what's missing
            const missing = getMissingFallbackConfigs(assistant);
            console.log(`   🔧 FIXING: ${status}`);
            console.log(`       Missing: ${missing.join(', ')}`);

            // Build update payload with fallbacks
            const updates: any = {};

            if (missing.includes('transcriber') && assistant.transcriber) {
              const language = assistant.transcriber.language || 'en';
              updates.transcriber = buildTranscriberWithFallbacks(language);

              // Preserve original provider and model
              if (assistant.transcriber.provider) {
                updates.transcriber.provider = assistant.transcriber.provider;
              }
              if (assistant.transcriber.model) {
                updates.transcriber.model = assistant.transcriber.model;
              }
            }

            if (missing.includes('voice') && assistant.voice) {
              const provider = assistant.voice.provider || 'vapi';
              const voiceId = assistant.voice.voiceId || 'Rohan';
              const voiceConfig = buildVoiceWithFallbacks(provider, voiceId);

              updates.voice = {
                provider: assistant.voice.provider || provider,
                voiceId: assistant.voice.voiceId || voiceId,
                fallbacks: voiceConfig.fallbacks
              };
            }

            // Apply updates (unless dry-run)
            if (!isDryRun) {
              await vapi.updateAssistant(assistantId, updates);
              console.log(`       ✅ Applied fallback configuration`);
            } else {
              console.log(`       (dry-run: would apply fallback configuration)`);
            }

            stats.assistantsFixed++;

          } catch (err: any) {
            console.log(`   ❌ FAILED: ${status}`);
            console.log(`       Error: ${err.message}`);

            stats.assistantsFailed++;
            stats.errors.push({
              org: orgId,
              assistant: assistantId,
              error: err.message
            });
          }
        }

        stats.orgsProcessed++;
        console.log('');

      } catch (err: any) {
        console.log(`   ❌ ERROR: ${err.message}`);
        console.log('');

        stats.orgsWithErrors++;
        orgErrors = true;

        stats.errors.push({
          org: orgId,
          assistant: 'N/A',
          error: err.message
        });
      }
    }

    // ========== PRINT SUMMARY ==========
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║ 🛡️  ENFORCEMENT SUMMARY                                             ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    console.log('Organization Statistics:');
    console.log(`  Total Organizations: ${stats.totalOrgs}`);
    console.log(`  Processed Successfully: ${stats.orgsProcessed}`);
    console.log(`  With Errors: ${stats.orgsWithErrors}\n`);

    console.log('Assistant Statistics:');
    console.log(`  Total Assistants: ${stats.totalAssistants}`);
    console.log(`  ✅ Fixed (Added Fallbacks): ${stats.assistantsFixed}`);
    console.log(`  ⏭️  Skipped (Already Configured): ${stats.assistantsSkipped}`);
    console.log(`  ❌ Failed: ${stats.assistantsFailed}\n`);

    // Print errors if any
    if (stats.errors.length > 0) {
      console.log('Errors Encountered:');
      for (const err of stats.errors) {
        console.log(`  • ${err.org} / ${err.assistant}: ${err.error}`);
      }
      console.log('');
    }

    // Final status
    const totalProcessed = stats.assistantsFixed + stats.assistantsSkipped + stats.assistantsFailed;
    const isSuccess = stats.assistantsFailed === 0;

    if (isDryRun) {
      console.log('🔍 DRY-RUN COMPLETE');
      console.log(`   Would have fixed: ${stats.assistantsFixed} assistants`);
      console.log(`   Would have skipped: ${stats.assistantsSkipped} assistants\n`);
    } else if (isSuccess) {
      console.log('✅ ENFORCEMENT COMPLETE - ALL ASSISTANTS CONFIGURED');
      console.log(`   Fixed: ${stats.assistantsFixed} assistants with fallbacks`);
      console.log(`   Skipped: ${stats.assistantsSkipped} assistants (already configured)`);
      console.log(`   Total Processed: ${totalProcessed}/${stats.totalAssistants}\n`);
    } else {
      console.log('⚠️  ENFORCEMENT COMPLETE WITH ERRORS');
      console.log(`   Fixed: ${stats.assistantsFixed} assistants`);
      console.log(`   Failed: ${stats.assistantsFailed} assistants`);
      console.log(`   Total Processed: ${totalProcessed}/${stats.totalAssistants}\n`);
    }

    console.log('📋 Next Steps:');
    if (isDryRun) {
      console.log('   1. Review the output above');
      console.log('   2. Run without --dry-run to apply changes:');
      console.log('      npx ts-node backend/src/scripts/enforce-provider-fallbacks.ts');
    } else {
      console.log('   1. Verify in Vapi dashboard: https://dashboard.vapi.ai');
      console.log('   2. Check that all assistants now have fallback providers configured');
      console.log('   3. Run verification script:');
      console.log('      npx ts-node backend/src/scripts/verify-provider-fallbacks.ts');
    }
    console.log('');

    process.exit(isSuccess ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// ========================================
// Execute Script
// ========================================

enforceProviderFallbacks()
  .then(() => {
    // Already handles exit in the function
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
