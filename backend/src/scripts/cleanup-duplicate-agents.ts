/**
 * Cleanup Script: Remove duplicate/stale agents
 *
 * Usage:
 *   npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id <org-id> --dry-run
 *   npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id <org-id> --execute
 *
 * Removes duplicate agents for the same role, keeping only the most recent one
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateAgents() {
  // Parse arguments
  const args = process.argv.slice(2);
  let orgId: string | null = null;
  let dryRun = false;
  let execute = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--org-id' && args[i + 1]) {
      orgId = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--execute') {
      execute = true;
    }
  }

  if (!orgId) {
    console.error('Usage: npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id <org-id> [--dry-run|--execute]');
    console.error('Example: npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id 46cf2995-2bee-44e3-838b-24151486fe4e --dry-run');
    process.exit(1);
  }

  if (!dryRun && !execute) {
    console.log('ℹ️  Note: Use --dry-run to see what would be deleted, or --execute to actually delete');
    dryRun = true;
  }

  console.log(`\n🧹 CLEANUP DUPLICATE AGENTS\n`);
  console.log(`Org ID: ${orgId}`);
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}\n`);

  try {
    // Fetch all agents for this org
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('id, role, name, created_at')
      .eq('org_id', orgId)
      .order('role', { ascending: true })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Database error:', fetchError);
      process.exit(1);
    }

    if (!agents || agents.length === 0) {
      console.log(`⚠️  No agents found for org ${orgId}`);
      return;
    }

    console.log(`✅ Found ${agents.length} total agents\n`);

    // Group by role and find duplicates
    const agentsByRole: Record<string, any[]> = {};
    agents.forEach(agent => {
      if (!agentsByRole[agent.role]) {
        agentsByRole[agent.role] = [];
      }
      agentsByRole[agent.role].push(agent);
    });

    // Identify stale agents to delete
    const toDelete: any[] = [];
    const toKeep: any[] = [];

    console.log('📊 Analyzing agents by role:\n');

    for (const [role, roleAgents] of Object.entries(agentsByRole)) {
      console.log(`  ${role}: ${roleAgents.length} agent(s)`);

      if (roleAgents.length > 1) {
        console.log(`    ⚠️  DUPLICATE DETECTED - Should keep only 1\n`);

        // Keep the most recent one (already sorted by created_at DESC)
        const mostRecent = roleAgents[0];
        toKeep.push(mostRecent);

        console.log(`    📌 KEEP: ${mostRecent.name || '(unnamed)'} - ID: ${mostRecent.id.slice(0, 8)}...`);
        console.log(`             Created: ${new Date(mostRecent.created_at).toLocaleString()}\n`);

        // Mark others for deletion
        for (let i = 1; i < roleAgents.length; i++) {
          const stale = roleAgents[i];
          toDelete.push(stale);

          console.log(`    🗑️  DELETE: ${stale.name || '(unnamed)'} - ID: ${stale.id.slice(0, 8)}...`);
          console.log(`             Created: ${new Date(stale.created_at).toLocaleString()}\n`);
        }
      } else {
        toKeep.push(roleAgents[0]);
        console.log(`    ✅ KEEP: ${roleAgents[0].name || '(unnamed)'} - ID: ${roleAgents[0].id.slice(0, 8)}...\n`);
      }
    }

    if (toDelete.length === 0) {
      console.log('✅ No duplicates found. Database is clean.\n');
      return;
    }

    console.log(`\n📋 SUMMARY\n`);
    console.log(`  Agents to keep: ${toKeep.length}`);
    console.log(`  Agents to delete: ${toDelete.length}`);

    if (dryRun) {
      console.log(`\n✅ DRY RUN COMPLETE - No changes made\n`);
      console.log('To actually delete, run:');
      console.log(`npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id ${orgId} --execute\n`);
      return;
    }

    // Execute deletion
    if (execute) {
      console.log(`\n⏳ Deleting ${toDelete.length} agent(s)...\n`);

      for (const agent of toDelete) {
        const { error: deleteError } = await supabase
          .from('agents')
          .delete()
          .eq('id', agent.id);

        if (deleteError) {
          console.error(`❌ Failed to delete agent ${agent.id}:`, deleteError);
        } else {
          console.log(`✅ Deleted: ${agent.name || '(unnamed)'} - ID: ${agent.id.slice(0, 8)}...`);
        }
      }

      console.log(`\n✅ CLEANUP COMPLETE\n`);
      console.log(`Deleted ${toDelete.length} duplicate agent(s)\n`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

cleanupDuplicateAgents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
