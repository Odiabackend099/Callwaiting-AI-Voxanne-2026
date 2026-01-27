/**
 * Verify Provider Fallback Protocol - Compliance Audit Tool
 *
 * Purpose: Audit all assistants across all organizations to verify 100% fallback compliance
 *
 * This script:
 * 1. Iterates through all organizations with Vapi credentials
 * 2. Lists all assistants for each organization
 * 3. Checks if each assistant has proper fallback configuration
 * 4. Generates compliance report with overall percentage
 * 5. Lists any non-compliant assistants for manual review
 *
 * Usage:
 *   # Verify all organizations
 *   npx ts-node backend/src/scripts/verify-provider-fallbacks.ts
 *
 *   # Verify single organization
 *   npx ts-node backend/src/scripts/verify-provider-fallbacks.ts --org-id=YOUR_ORG_ID
 *
 * Output: Compliance report with organization-level and global statistics
 */

import { createClient } from '@supabase/supabase-js';
import { VapiClient } from '../services/vapi-client';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { hasProperFallbacks, getMissingFallbackConfigs } from '../config/vapi-fallbacks';

// Load environment variables
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });

// ========================================
// Configuration & Argument Parsing
// ========================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Parse CLI arguments
const orgIdArg = process.argv.find(arg => arg.startsWith('--org-id='))?.split('=')[1];

// ========================================
// Statistics Tracking
// ========================================

interface OrgComplianceStats {
  orgId: string;
  totalAssistants: number;
  compliantAssistants: number;
  nonCompliantAssistants: number;
  compliancePercentage: number;
  nonCompliantDetails: Array<{
    assistantId: string;
    assistantName: string;
    missing: string[];
  }>;
}

interface GlobalComplianceStats {
  totalOrgs: number;
  totalAssistants: number;
  compliantAssistants: number;
  nonCompliantAssistants: number;
  globalCompliancePercentage: number;
  orgs: OrgComplianceStats[];
}

// ========================================
// Main Verification Function
// ========================================

async function verifyProviderFallbacks() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         📋 RELIABILITY PROTOCOL COMPLIANCE VERIFICATION               ║');
  console.log('║              Checking Provider Fallback Configuration                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // ========== ENVIRONMENT VALIDATION ==========
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: Supabase credentials not configured');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
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

    console.log(`✅ Found ${orgIds.length} organization(s) with Vapi credentials\n`);

    // ========== VERIFY EACH ORGANIZATION ==========
    const globalStats: GlobalComplianceStats = {
      totalOrgs: orgIds.length,
      totalAssistants: 0,
      compliantAssistants: 0,
      nonCompliantAssistants: 0,
      globalCompliancePercentage: 0,
      orgs: []
    };

    for (const orgId of orgIds) {
      console.log(`🏢 Verifying Organization: ${orgId}`);
      const orgStats: OrgComplianceStats = {
        orgId,
        totalAssistants: 0,
        compliantAssistants: 0,
        nonCompliantAssistants: 0,
        compliancePercentage: 0,
        nonCompliantDetails: []
      };

      try {
        // Get Vapi credentials for this organization
        const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
        const vapi = new VapiClient(vapiCreds.apiKey);

        // List all assistants for this organization
        const assistants = await vapi.listAssistants();

        if (!assistants || assistants.length === 0) {
          console.log(`   ℹ️  No assistants found for this organization`);
          globalStats.orgs.push(orgStats);
          continue;
        }

        orgStats.totalAssistants = assistants.length;
        console.log(`   📋 Found ${assistants.length} assistant(s)\n`);

        // ========== VERIFY EACH ASSISTANT ==========
        for (const assistant of assistants) {
          const assistantId = assistant.id;
          const assistantName = assistant.name || 'Unnamed';

          if (hasProperFallbacks(assistant)) {
            console.log(`      ✅ ${assistantName} (${assistantId})`);
            orgStats.compliantAssistants++;
          } else {
            const missing = getMissingFallbackConfigs(assistant);
            console.log(`      ❌ ${assistantName} (${assistantId})`);
            console.log(`         Missing: ${missing.join(', ')}`);

            orgStats.nonCompliantAssistants++;
            orgStats.nonCompliantDetails.push({
              assistantId,
              assistantName,
              missing
            });
          }
        }

        // Calculate organization compliance percentage
        orgStats.compliancePercentage =
          orgStats.totalAssistants > 0
            ? Math.round((orgStats.compliantAssistants / orgStats.totalAssistants) * 100)
            : 0;

        console.log(
          `   📊 Organization Compliance: ${orgStats.compliantAssistants}/${orgStats.totalAssistants} ` +
          `(${orgStats.compliancePercentage}%)\n`
        );

        // Update global stats
        globalStats.totalAssistants += orgStats.totalAssistants;
        globalStats.compliantAssistants += orgStats.compliantAssistants;
        globalStats.nonCompliantAssistants += orgStats.nonCompliantAssistants;

        globalStats.orgs.push(orgStats);

      } catch (err: any) {
        console.log(`   ❌ ERROR: ${err.message}\n`);

        globalStats.orgs.push(orgStats);
      }
    }

    // ========== CALCULATE GLOBAL COMPLIANCE ==========
    globalStats.globalCompliancePercentage =
      globalStats.totalAssistants > 0
        ? Math.round((globalStats.compliantAssistants / globalStats.totalAssistants) * 100)
        : 0;

    // ========== PRINT SUMMARY ==========
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║ 📋 COMPLIANCE REPORT                                                ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    // Organization Summary
    console.log('Organization Summary:');
    console.log(`  Total Organizations: ${globalStats.totalOrgs}`);
    console.log(`  Total Assistants: ${globalStats.totalAssistants}`);
    console.log(`  ✅ Compliant Assistants: ${globalStats.compliantAssistants}`);
    console.log(`  ❌ Non-Compliant Assistants: ${globalStats.nonCompliantAssistants}\n`);

    // Global Compliance
    console.log('Global Compliance Status:');
    const complianceColor =
      globalStats.globalCompliancePercentage === 100 ? '✅' : '⚠️';
    console.log(
      `  ${complianceColor} Overall Compliance: ${globalStats.compliantAssistants}/${globalStats.totalAssistants} ` +
      `(${globalStats.globalCompliancePercentage}%)\n`
    );

    // Organization Breakdown
    if (globalStats.totalOrgs > 1) {
      console.log('Organization Breakdown:');
      for (const org of globalStats.orgs) {
        const status = org.compliancePercentage === 100 ? '✅' : '⚠️';
        console.log(
          `  ${status} ${org.orgId}: ${org.compliantAssistants}/${org.totalAssistants} ` +
          `(${org.compliancePercentage}%)`
        );
      }
      console.log('');
    }

    // Non-Compliant Details
    if (globalStats.nonCompliantAssistants > 0) {
      console.log('Non-Compliant Assistants:');
      for (const org of globalStats.orgs) {
        if (org.nonCompliantDetails.length > 0) {
          for (const detail of org.nonCompliantDetails) {
            console.log(`  • ${org.orgId} / ${detail.assistantName} (${detail.assistantId})`);
            console.log(`    Missing: ${detail.missing.join(', ')}`);
          }
        }
      }
      console.log('');
    }

    // Final Recommendation
    console.log('Recommendation:');
    if (globalStats.globalCompliancePercentage === 100) {
      console.log('  🎉 ALL ASSISTANTS COMPLIANT!');
      console.log('     The Reliability Protocol has been successfully enforced.');
      console.log('     All new assistants will automatically include fallbacks.');
    } else {
      console.log('  ⚠️  SOME ASSISTANTS NON-COMPLIANT');
      console.log('     Run the enforcement script to add missing fallbacks:');
      console.log('     npx ts-node backend/src/scripts/enforce-provider-fallbacks.ts');
    }
    console.log('');

    process.exit(globalStats.globalCompliancePercentage === 100 ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// ========================================
// Execute Script
// ========================================

verifyProviderFallbacks()
  .then(() => {
    // Already handles exit in the function
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
