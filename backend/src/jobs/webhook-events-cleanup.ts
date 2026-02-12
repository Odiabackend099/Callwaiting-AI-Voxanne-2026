/**
 * Webhook Events Cleanup Job
 * Deletes processed_webhook_events older than 7 days
 * Runs daily at 4 AM UTC
 */

import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import * as schedule from 'node-schedule';

/**
 * Execute cleanup of old webhook events
 * Returns number of records deleted
 */
export async function cleanupOldWebhookEvents(): Promise<number> {
  try {
    log.info('WebhookCleanup', 'Starting cleanup of old webhook events');

    const { data, error } = await supabase
      .rpc('cleanup_old_processed_webhook_events');

    if (error) {
      log.error('WebhookCleanup', 'Cleanup failed', { error: error.message });
      return 0;
    }

    const deletedCount = data || 0;
    log.info('WebhookCleanup', 'Cleanup completed', {
      deletedCount,
      retention: '7 days'
    });

    return deletedCount;
  } catch (err: any) {
    log.error('WebhookCleanup', 'Cleanup error', { error: err.message });
    return 0;
  }
}

/**
 * Schedule cleanup job to run daily at 4 AM UTC
 */
export function scheduleWebhookEventsCleanup(): void {
  // Schedule: Daily at 4:00 AM UTC (cron: 0 4 * * *)
  const job = schedule.scheduleJob('0 4 * * *', async () => {
    log.info('WebhookCleanup', 'Scheduled cleanup triggered');
    await cleanupOldWebhookEvents();
  });

  log.info('WebhookCleanup', 'Cleanup job scheduled', {
    schedule: 'Daily at 4:00 AM UTC',
    nextRun: job.nextInvocation()?.toISOString()
  });
}
