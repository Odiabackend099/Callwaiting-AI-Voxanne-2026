/**
 * Dashboard Data Cleanup Script
 *
 * Purpose: Delete historical data that doesn't follow Single Source of Truth (SSOT)
 * - Deletes calls without sentiment data
 * - Deletes incomplete calls (ringing, queued, in-progress older than 1 hour)
 * - Deletes orphaned hot_lead_alerts
 *
 * Usage: npx ts-node src/scripts/cleanup-dashboard-data.ts <org_id>
 * Example: npx ts-node src/scripts/cleanup-dashboard-data.ts 46cf2995-2bee-44e3-838b-24151486fe4e
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CleanupStats {
  callsWithoutSentiment: number;
  incompleteCalls: number;
  orphanedAlerts: number;
  remainingCalls: number;
  remainingAlerts: number;
}

async function cleanupDashboardData(orgId: string): Promise<CleanupStats> {
  const stats: CleanupStats = {
    callsWithoutSentiment: 0,
    incompleteCalls: 0,
    orphanedAlerts: 0,
    remainingCalls: 0,
    remainingAlerts: 0
  };

  console.log('\n🧹 Dashboard Data Cleanup Script');
  console.log('=================================\n');
  console.log(`Organization ID: ${orgId}\n`);

  try {
    // 1. Delete calls without sentiment data (SSOT violation)
    console.log('Step 1: Deleting calls without sentiment data...');
    const { data: callsToDelete, error: selectError } = await supabase
      .from('calls')
      .select('id')
      .eq('org_id', orgId)
      .is('sentiment_score', null);

    if (selectError) {
      console.error('❌ Error selecting calls:', selectError.message);
    } else {
      stats.callsWithoutSentiment = callsToDelete?.length || 0;
      console.log(`   Found ${stats.callsWithoutSentiment} calls without sentiment`);

      if (stats.callsWithoutSentiment > 0) {
        const { error: deleteError } = await supabase
          .from('calls')
          .delete()
          .eq('org_id', orgId)
          .is('sentiment_score', null);

        if (deleteError) {
          console.error('❌ Error deleting calls:', deleteError.message);
        } else {
          console.log(`   ✅ Deleted ${stats.callsWithoutSentiment} calls`);
        }
      }
    }

    // 2. Delete incomplete calls (ringing, queued, in-progress older than 1 hour)
    console.log('\nStep 2: Deleting incomplete calls...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: incompleteToDelete, error: selectIncompleteError } = await supabase
      .from('calls')
      .select('id')
      .eq('org_id', orgId)
      .in('status', ['ringing', 'queued', 'in-progress', 'Ringing', 'Queued'])
      .lt('created_at', oneHourAgo);

    if (selectIncompleteError) {
      console.error('❌ Error selecting incomplete calls:', selectIncompleteError.message);
    } else {
      stats.incompleteCalls = incompleteToDelete?.length || 0;
      console.log(`   Found ${stats.incompleteCalls} incomplete calls older than 1 hour`);

      if (stats.incompleteCalls > 0) {
        const { error: deleteIncompleteError } = await supabase
          .from('calls')
          .delete()
          .eq('org_id', orgId)
          .in('status', ['ringing', 'queued', 'in-progress', 'Ringing', 'Queued'])
          .lt('created_at', oneHourAgo);

        if (deleteIncompleteError) {
          console.error('❌ Error deleting incomplete calls:', deleteIncompleteError.message);
        } else {
          console.log(`   ✅ Deleted ${stats.incompleteCalls} incomplete calls`);
        }
      }
    }

    // 3. Delete orphaned hot_lead_alerts (alerts where call no longer exists)
    console.log('\nStep 3: Deleting orphaned hot_lead_alerts...');

    // Get all call IDs for this org
    const { data: validCalls, error: validCallsError } = await supabase
      .from('calls')
      .select('id')
      .eq('org_id', orgId);

    if (validCallsError) {
      console.error('❌ Error fetching valid calls:', validCallsError.message);
    } else {
      const validCallIds = validCalls?.map(c => c.id) || [];

      // Get alerts for this org
      const { data: allAlerts, error: alertsError } = await supabase
        .from('hot_lead_alerts')
        .select('id, call_id')
        .eq('org_id', orgId);

      if (alertsError) {
        console.error('❌ Error fetching alerts:', alertsError.message);
      } else {
        // Find orphaned alerts
        const orphanedAlertIds = allAlerts
          ?.filter(alert => !validCallIds.includes(alert.call_id))
          .map(alert => alert.id) || [];

        stats.orphanedAlerts = orphanedAlertIds.length;
        console.log(`   Found ${stats.orphanedAlerts} orphaned alerts`);

        if (stats.orphanedAlerts > 0) {
          const { error: deleteAlertsError } = await supabase
            .from('hot_lead_alerts')
            .delete()
            .in('id', orphanedAlertIds);

          if (deleteAlertsError) {
            console.error('❌ Error deleting orphaned alerts:', deleteAlertsError.message);
          } else {
            console.log(`   ✅ Deleted ${stats.orphanedAlerts} orphaned alerts`);
          }
        }
      }
    }

    // 4. Count remaining calls and alerts
    console.log('\nStep 4: Verifying cleanup...');

    const { count: callCount, error: countError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (countError) {
      console.error('❌ Error counting calls:', countError.message);
    } else {
      stats.remainingCalls = callCount || 0;
      console.log(`   Remaining calls: ${stats.remainingCalls}`);
    }

    const { count: alertCount, error: alertCountError } = await supabase
      .from('hot_lead_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (alertCountError) {
      console.error('❌ Error counting alerts:', alertCountError.message);
    } else {
      stats.remainingAlerts = alertCount || 0;
      console.log(`   Remaining alerts: ${stats.remainingAlerts}`);
    }

    console.log('\n✅ Cleanup complete!\n');
    console.log('Summary:');
    console.log('--------');
    console.log(`Calls without sentiment deleted: ${stats.callsWithoutSentiment}`);
    console.log(`Incomplete calls deleted: ${stats.incompleteCalls}`);
    console.log(`Orphaned alerts deleted: ${stats.orphanedAlerts}`);
    console.log(`Remaining calls: ${stats.remainingCalls}`);
    console.log(`Remaining alerts: ${stats.remainingAlerts}`);

    return stats;

  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    throw error;
  }
}

// Main execution
const orgId = process.argv[2];

if (!orgId) {
  console.error('Usage: npx ts-node src/scripts/cleanup-dashboard-data.ts <org_id>');
  console.error('Example: npx ts-node src/scripts/cleanup-dashboard-data.ts 46cf2995-2bee-44e3-838b-24151486fe4e');
  process.exit(1);
}

cleanupDashboardData(orgId)
  .then(stats => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
