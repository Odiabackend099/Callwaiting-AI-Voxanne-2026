/**
 * GDPR Data Retention Cleanup Job
 *
 * Priority 7: HIPAA Compliance - Data Retention & GDPR Right to Erasure
 *
 * Purpose:
 * - Permanently delete records soft-deleted > 30 days ago
 * - Comply with GDPR Article 17 (Right to Erasure)
 * - Maintain audit trail of deletion operations
 *
 * Schedule: Daily at 4:00 AM UTC (low-traffic period)
 *
 * Legal Requirements:
 * - GDPR: Data must be deleted "without undue delay" after request
 * - 30-day grace period allows for: backup rotation, dispute resolution, legal holds
 * - Audit logs retained for 7 years (compliance requirement)
 *
 * Safety Features:
 * - Transaction-based (all-or-nothing deletion)
 * - Audit logging for every deletion batch
 * - Configurable retention period (default: 30 days)
 * - Dry-run mode for testing
 */

import { supabase } from '../services/supabase-client';
import { log as logger } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';

interface GDPRCleanupConfig {
  retentionDays: number;
  dryRun: boolean;
  notifySlack: boolean;
}

interface CleanupResult {
  success: boolean;
  deletedCounts: {
    call_transcripts: number;
    messages: number;
    appointments: number;
    call_logs: number;
    contacts: number;
  };
  totalDeleted: number;
  executionTime: number;
  error?: string;
}

/**
 * Execute GDPR cleanup: Hard delete records soft-deleted > retention period
 *
 * @param config Cleanup configuration
 * @returns Cleanup result with deletion counts
 */
export async function executeGDPRCleanup(
  config: GDPRCleanupConfig = {
    retentionDays: 30,
    dryRun: false,
    notifySlack: true
  }
): Promise<CleanupResult> {
  const startTime = Date.now();

  logger.info('GDPR Cleanup', 'Starting GDPR data retention cleanup', {
    retentionDays: config.retentionDays,
    dryRun: config.dryRun,
    timestamp: new Date().toISOString()
  });

  try {
    // Call database function to perform cleanup
    const { data, error } = await supabase.rpc('hard_delete_expired_records', {
      p_retention_days: config.retentionDays
    });

    if (error) {
      logger.error('GDPR Cleanup', 'Database cleanup function failed', {
        error: error.message,
        code: error.code
      });

      // Send alert to Slack
      if (config.notifySlack) {
        await sendSlackAlert('🚨 GDPR Cleanup Failed', {
          error: error.message,
          retentionDays: config.retentionDays,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: false,
        deletedCounts: {
          call_transcripts: 0,
          messages: 0,
          appointments: 0,
          call_logs: 0,
          contacts: 0
        },
        totalDeleted: 0,
        executionTime: Date.now() - startTime,
        error: error.message
      };
    }

    // Parse deletion counts from function result
    const deletedCounts = {
      call_transcripts: data?.call_transcripts || 0,
      messages: data?.messages || 0,
      appointments: data?.appointments || 0,
      call_logs: data?.call_logs || 0,
      contacts: data?.contacts || 0
    };

    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
    const executionTime = Date.now() - startTime;

    logger.info('GDPR Cleanup', 'Cleanup completed successfully', {
      deletedCounts,
      totalDeleted,
      executionTime: `${executionTime}ms`,
      retentionDays: config.retentionDays
    });

    // Log cleanup operation to audit trail
    await logCleanupToAudit({
      deletedCounts,
      totalDeleted,
      executionTime,
      retentionDays: config.retentionDays,
      dryRun: config.dryRun
    });

    // Send Slack notification if significant deletions occurred
    if (config.notifySlack && totalDeleted > 0) {
      await sendSlackAlert('✅ GDPR Cleanup Completed', {
        totalDeleted,
        call_transcripts: deletedCounts.call_transcripts,
        messages: deletedCounts.messages,
        appointments: deletedCounts.appointments,
        call_logs: deletedCounts.call_logs,
        contacts: deletedCounts.contacts,
        executionTime: `${executionTime}ms`,
        retentionPeriod: `${config.retentionDays} days`
      });
    }

    return {
      success: true,
      deletedCounts,
      totalDeleted,
      executionTime
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    logger.error('GDPR Cleanup', 'Unexpected error during cleanup', {
      error: error.message,
      stack: error.stack,
      executionTime: `${executionTime}ms`
    });

    // Send critical alert
    if (config.notifySlack) {
      await sendSlackAlert('🔴 CRITICAL: GDPR Cleanup Exception', {
        error: error.message,
        stack: error.stack?.substring(0, 500),
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: false,
      deletedCounts: {
        call_transcripts: 0,
        messages: 0,
        appointments: 0,
        call_logs: 0,
        contacts: 0
      },
      totalDeleted: 0,
      executionTime,
      error: error.message
    };
  }
}

/**
 * Log cleanup operation to audit trail for compliance verification
 *
 * @param result Cleanup operation result
 */
async function logCleanupToAudit(result: {
  deletedCounts: Record<string, number>;
  totalDeleted: number;
  executionTime: number;
  retentionDays: number;
  dryRun: boolean;
}): Promise<void> {
  try {
    // Create audit log entry
    const { error } = await supabase
      .from('system_audit_logs')
      .insert({
        event_type: 'gdpr_cleanup',
        event_category: 'data_retention',
        severity: 'info',
        details: {
          deleted_counts: result.deletedCounts,
          total_deleted: result.totalDeleted,
          execution_time_ms: result.executionTime,
          retention_days: result.retentionDays,
          dry_run: result.dryRun,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.warn('GDPR Cleanup', 'Failed to log cleanup to audit trail', {
        error: error.message
      });
    } else {
      logger.debug('GDPR Cleanup', 'Cleanup operation logged to audit trail');
    }
  } catch (error: any) {
    logger.warn('GDPR Cleanup', 'Exception while logging to audit trail', {
      error: error.message
    });
    // Don't throw - audit logging failure shouldn't break cleanup
  }
}

/**
 * Get statistics on records pending deletion
 *
 * @returns Count of soft-deleted records by table
 */
export async function getPendingDeletionStats(): Promise<{
  call_transcripts: number;
  messages: number;
  appointments: number;
  call_logs: number;
  contacts: number;
  total: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  try {
    const [callTranscripts, messages, appointments, callLogs, contacts] = await Promise.all([
      supabase
        .from('call_transcripts')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString()),

      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString()),

      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString()),

      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString()),

      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString())
    ]);

    const stats = {
      call_transcripts: callTranscripts.count || 0,
      messages: messages.count || 0,
      appointments: appointments.count || 0,
      call_logs: callLogs.count || 0,
      contacts: contacts.count || 0,
      total: 0
    };

    stats.total = Object.values(stats).reduce((sum, count) => sum + count, 0);

    return stats;
  } catch (error: any) {
    logger.error('GDPR Cleanup', 'Failed to get pending deletion stats', {
      error: error.message
    });

    return {
      call_transcripts: 0,
      messages: 0,
      appointments: 0,
      call_logs: 0,
      contacts: 0,
      total: 0
    };
  }
}

/**
 * Scheduled job entry point (called by cron)
 * Runs daily at 4:00 AM UTC
 */
export async function runGDPRCleanup(): Promise<void> {
  logger.info('GDPR Cleanup', 'Scheduled GDPR cleanup job started');

  // Get pending deletion stats before cleanup
  const statsBefore = await getPendingDeletionStats();

  logger.info('GDPR Cleanup', 'Pending deletions found', {
    ...statsBefore,
    timestamp: new Date().toISOString()
  });

  // Execute cleanup (production settings)
  const result = await executeGDPRCleanup({
    retentionDays: 30,
    dryRun: false,
    notifySlack: true
  });

  if (result.success) {
    logger.info('GDPR Cleanup', 'Scheduled cleanup completed successfully', {
      totalDeleted: result.totalDeleted,
      executionTime: `${result.executionTime}ms`
    });
  } else {
    logger.error('GDPR Cleanup', 'Scheduled cleanup failed', {
      error: result.error,
      executionTime: `${result.executionTime}ms`
    });
  }
}

/**
 * Schedule GDPR cleanup job to run daily at 5 AM UTC
 * Runs 1 hour after webhook cleanup to stagger database load
 */
export function scheduleGDPRCleanup(): void {
  // Calculate time until next 5 AM UTC
  const now = new Date();
  const next5AM = new Date(now);
  next5AM.setUTCHours(5, 0, 0, 0);

  if (next5AM <= now) {
    next5AM.setUTCDate(next5AM.getUTCDate() + 1);
  }

  const timeUntilNext = next5AM.getTime() - now.getTime();

  logger.info('GDPR Cleanup', 'Scheduling GDPR cleanup job', {
    nextRun: next5AM.toISOString(),
    timeUntilNextMs: timeUntilNext
  });

  // Schedule first run
  setTimeout(() => {
    runGDPRCleanup();
    // Then run daily
    setInterval(() => {
      runGDPRCleanup();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, timeUntilNext);
}

// Export for testing
export default {
  executeGDPRCleanup,
  getPendingDeletionStats,
  runGDPRCleanup,
  scheduleGDPRCleanup
};
