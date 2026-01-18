#!/usr/bin/env npx ts-node

/**
 * Phase 6: Migration Script for Existing Organizations
 *
 * This script registers tools for all existing organizations that have
 * Vapi assistants but no registered tools in the org_tools table.
 *
 * Usage:
 *   npx ts-node backend/scripts/migrate-existing-tools.ts [--dry-run] [--org-id <uuid>]
 *
 * Examples:
 *   # Dry run (show what would happen)
 *   npx ts-node backend/scripts/migrate-existing-tools.ts --dry-run
 *
 *   # Migrate specific organization
 *   npx ts-node backend/scripts/migrate-existing-tools.ts --org-id 46cf2995-2bee-44e3-838b-24151486fe4e
 *
 *   # Migrate all organizations
 *   npx ts-node backend/scripts/migrate-existing-tools.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ToolSyncService } from '../src/services/tool-sync-service';
import { log } from '../src/services/logger';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

interface MigrationResult {
  orgId: string;
  orgName: string;
  assistants: {
    role: string;
    assistantId: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    toolsRegistered?: number;
  }[];
}

async function migrateExistingTools() {
  // Filter args to only include actual arguments (skip node and script path)
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const orgIdIndex = args.findIndex(arg => arg.startsWith('--org-id'));
  const orgIdArg = args[orgIdIndex]?.split('=')[1] || (orgIdIndex >= 0 ? args[orgIdIndex + 1] : undefined);

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 6: Migrate Existing Organizations - Tool Registration  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE: No changes will be made\n');
  }

  try {
    // Step 1: Get organizations
    console.log('📊 [1/5] Fetching organizations...\n');

    let orgQuery = supabase.from('organizations').select('id, name');
    if (orgIdArg) {
      orgQuery = orgQuery.eq('id', orgIdArg);
    }

    const { data: orgs, error: orgsError } = await orgQuery;

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      console.log('ℹ️  No organizations found to migrate\n');
      process.exit(0);
    }

    console.log(`✅ Found ${orgs.length} organization(s) to process\n`);

    // Step 2: For each org, find agents with vapi_assistant_id
    console.log('🔍 [2/5] Finding agents with Vapi assistants...\n');

    const results: MigrationResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const org of orgs) {
      console.log(`📍 Organization: ${org.name} (${org.id.substring(0, 8)}...)`);

      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('id, role, vapi_assistant_id, name')
        .eq('org_id', org.id)
        .not('vapi_assistant_id', 'is', null);

      if (agentsError) {
        console.log(`   ⚠️  Error fetching agents: ${agentsError.message}\n`);
        continue;
      }

      if (!agents || agents.length === 0) {
        console.log(`   ℹ️  No agents with Vapi assistant ID\n`);
        continue;
      }

      console.log(`   Found ${agents.length} agent(s)\n`);

      const orgResult: MigrationResult = {
        orgId: org.id,
        orgName: org.name,
        assistants: []
      };

      // Step 3: For each agent, sync tools
      console.log('🔄 [3/5] Syncing tools for agents...\n');

      for (const agent of agents) {
        const agentLabel = `   • ${agent.role} (${agent.vapi_assistant_id?.substring(0, 8)}...)`;

        try {
          if (dryRun) {
            console.log(`${agentLabel} [DRY RUN] Would sync tools`);
            totalSkipped++;
            orgResult.assistants.push({
              role: agent.role,
              assistantId: agent.vapi_assistant_id!,
              status: 'skipped'
            });
          } else {
            console.log(`${agentLabel} Syncing...`);

            const syncResult = await ToolSyncService.syncAllToolsForAssistant({
              orgId: org.id,
              assistantId: agent.vapi_assistant_id!,
              skipIfExists: true  // Don't re-register if already exists
            });

            console.log(`${agentLabel} ✅ Success (${syncResult.toolsRegistered} tools)\n`);

            totalSuccess++;
            orgResult.assistants.push({
              role: agent.role,
              assistantId: agent.vapi_assistant_id!,
              status: 'success',
              toolsRegistered: syncResult.toolsRegistered
            });
          }
        } catch (err: any) {
          console.log(`${agentLabel} ❌ Failed: ${err.message}\n`);

          totalFailed++;
          orgResult.assistants.push({
            role: agent.role,
            assistantId: agent.vapi_assistant_id!,
            status: 'failed',
            error: err.message
          });
        }
      }

      results.push(orgResult);
    }

    // Step 4: Verify results
    console.log('\n📊 [4/5] Migration Summary\n');
    console.log('────────────────────────────────────────────────────────────────');

    for (const result of results) {
      console.log(`\n${result.orgName}:`);

      for (const assistant of result.assistants) {
        const statusIcon = assistant.status === 'success' ? '✅' : assistant.status === 'failed' ? '❌' : 'ℹ️ ';
        const details = assistant.toolsRegistered ? ` (${assistant.toolsRegistered} tools)` : assistant.error ? ` - ${assistant.error}` : '';
        console.log(`  ${statusIcon} ${assistant.role}${details}`);
      }
    }

    console.log('\n────────────────────────────────────────────────────────────────');

    // Step 5: Final report
    console.log('\n📋 [5/5] Final Report\n');

    console.log(`Organizations processed: ${results.length}`);
    console.log(`Total agents migrated: ${results.reduce((sum, r) => sum + r.assistants.length, 0)}`);
    console.log(`✅ Successful: ${totalSuccess}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`ℹ️  Skipped (dry-run): ${totalSkipped}\n`);

    if (dryRun) {
      console.log('🔍 This was a DRY RUN - no changes were made');
      console.log('Run without --dry-run to execute the migration\n');
      process.exit(0);
    }

    if (totalFailed === 0) {
      console.log('✅ PHASE 6: MIGRATION COMPLETE - All organizations migrated successfully!\n');
      process.exit(0);
    } else {
      console.log(`⚠️  PHASE 6: MIGRATION PARTIAL - ${totalFailed} organization(s) had errors`);
      console.log('Please review the errors above and try again for failed organizations.\n');
      process.exit(1);
    }

  } catch (err: any) {
    console.error('\n❌ Migration failed:');
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

// Run migration
migrateExistingTools();
