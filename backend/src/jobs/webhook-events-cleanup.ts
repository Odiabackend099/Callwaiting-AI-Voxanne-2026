/**
 * Webhook Events Cleanup Job
 * Runs daily to clean up old processed webhook event records
 *
 * Cleans up:
 * 1. processed_webhook_events older than 24 hours
 * 2. webhook_delivery_log older than 7 days
 *
 * This prevents database bloat from idempotency tracking tables.
 */

import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';

const logger = createLogger('WebhookEventsCleanup');

// Configuration
const PROCESSED_EVENTS_RETENTION_HOURS = 24;
const DELIVERY_LOG_RETENTION_DAYS = 7;

/**
 * Main cleanup job
 * Cleans both processed_webhook_events and webhook_delivery_log tables
 */
export async function runWebhookEventsCleanup(): Promise<void> {
  const startTime = Date.now();
  logger.info('Starting webhook events cleanup job');

  let processedEventsDeleted = 0;
  let deliveryLogDeleted = 0;
  let errors: string[] = [];

  try {
    // 1. Clean processed_webhook_events older than 24 hours
    const processedEventsCutoff = new Date(
      Date.now() - PROCESSED_EVENTS_RETENTION_HOURS * 60 * 60 * 1000
    ).toISOString();

    logger.info('Cleaning processed_webhook_events', {
      cutoff: processedEventsCutoff,
      retentionHours: PROCESSED_EVENTS_RETENTION_HOURS
    });

    // Count rows to be deleted first
    const { count: eventsCount, error: countError } = await supabase
      .from('processed_webhook_events')
      .select('*', { count: 'exact', head: true })
      .lt('received_at', processedEventsCutoff);

    if (countError) {
      logger.error('Failed to count processed_webhook_events', {
        error: countError.message
      });
      errors.push(`processed_webhook_events count: ${countError.message}`);
    } else {
      // Delete the old records
      const { error: deleteError } = await supabase
        .from('processed_webhook_events')
        .delete()
        .lt('received_at', processedEventsCutoff);

      if (deleteError) {
        logger.error('Failed to delete processed_webhook_events', {
          error: deleteError.message
        });
        errors.push(`processed_webhook_events delete: ${deleteError.message}`);
      } else {
        processedEventsDeleted = eventsCount || 0;
        logger.info('Cleaned processed_webhook_events', {
          deletedCount: processedEventsDeleted
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Exception cleaning processed_webhook_events', { error: errorMessage });
    errors.push(`processed_webhook_events exception: ${errorMessage}`);
  }

  try {
    // 2. Clean webhook_delivery_log older than 7 days
    const deliveryLogCutoff = new Date(
      Date.now() - DELIVERY_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    logger.info('Cleaning webhook_delivery_log', {
      cutoff: deliveryLogCutoff,
      retentionDays: DELIVERY_LOG_RETENTION_DAYS
    });

    // Count rows to be deleted first
    const { count: deliveryCount, error: countError } = await supabase
      .from('webhook_delivery_log')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', deliveryLogCutoff);

    if (countError) {
      logger.error('Failed to count webhook_delivery_log', {
        error: countError.message
      });
      errors.push(`webhook_delivery_log count: ${countError.message}`);
    } else {
      // Delete the old records
      const { error: deleteError } = await supabase
        .from('webhook_delivery_log')
        .delete()
        .lt('created_at', deliveryLogCutoff);

      if (deleteError) {
        logger.error('Failed to delete webhook_delivery_log', {
          error: deleteError.message
        });
        errors.push(`webhook_delivery_log delete: ${deleteError.message}`);
      } else {
        deliveryLogDeleted = deliveryCount || 0;
        logger.info('Cleaned webhook_delivery_log', {
          deletedCount: deliveryLogDeleted
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Exception cleaning webhook_delivery_log', { error: errorMessage });
    errors.push(`webhook_delivery_log exception: ${errorMessage}`);
  }

  // Summary
  const duration = Date.now() - startTime;
  logger.info('Webhook events cleanup completed', {
    processedEventsDeleted,
    deliveryLogDeleted,
    totalDeleted: processedEventsDeleted + deliveryLogDeleted,
    durationMs: duration,
    errors: errors.length > 0 ? errors : undefined
  });

  // Warn if errors occurred
  if (errors.length > 0) {
    logger.warn('Webhook events cleanup had errors', {
      errorCount: errors.length,
      errors
    });
  }
}

/**
 * Schedule cleanup job to run daily at 4 AM UTC
 * Runs 1 hour after telephony verification cleanup to stagger load
 */
export function scheduleWebhookEventsCleanup(): void {
  // Calculate time until next 4 AM UTC
  const now = new Date();
  const next4AM = new Date(now);
  next4AM.setUTCHours(4, 0, 0, 0);

  if (next4AM <= now) {
    next4AM.setUTCDate(next4AM.getUTCDate() + 1);
  }

  const timeUntilNext = next4AM.getTime() - now.getTime();

  logger.info('Scheduling webhook events cleanup', {
    nextRun: next4AM.toISOString()
  });

  // Schedule first run
  setTimeout(() => {
    runWebhookEventsCleanup();
    // Then run daily
    setInterval(() => {
      runWebhookEventsCleanup();
    }, 24 * 60 * 60 * 1000);
  }, timeUntilNext);
}
