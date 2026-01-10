/**
 * Recording Upload Queue Worker
 * Processes pending recording uploads from the recording_upload_queue table
 * Runs every 30 seconds to check for new items
 */

import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';
import { uploadCallRecording } from '../services/call-recording-storage';

const logger = createLogger('RecordingQueueWorker');

// Configuration
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
const BATCH_SIZE = 5; // Process 5 items at a time
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes lock timeout

interface QueueItem {
  id: string;
  call_id: string;
  vapi_call_id?: string;
  org_id?: string;
  recording_url: string;
  call_type: 'inbound' | 'outbound';
  priority: 'high' | 'normal' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  attempt_count: number;
  max_attempts: number;
  created_at: string;
  processing_started_at?: string;
  completed_at?: string;
}

/**
 * Process a single queue item
 */
async function processQueueItem(item: QueueItem): Promise<boolean> {
  try {
    logger.info('Processing recording upload', {
      queueId: item.id,
      callId: item.call_id,
      callType: item.call_type,
      attemptCount: item.attempt_count
    });

    // Update status to processing
    const { error: updateError } = await supabase
      .from('recording_upload_queue')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', item.id);

    if (updateError) {
      logger.error('Failed to update status to processing', {
        queueId: item.id,
        error: updateError.message
      });
      return false;
    }

    // Upload the recording
    const uploadResult = await uploadCallRecording({
      orgId: item.org_id || 'default',
      callId: item.call_id,
      callType: item.call_type,
      recordingUrl: item.recording_url,
      vapiCallId: item.vapi_call_id || item.call_id
    });

    if (uploadResult.success) {
      // Mark as completed
      const { error: completeError } = await supabase
        .from('recording_upload_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (completeError) {
        logger.error('Failed to mark item as completed', {
          queueId: item.id,
          error: completeError.message
        });
        return false;
      }

      logger.info('Recording upload completed successfully', {
        queueId: item.id,
        callId: item.call_id,
        storagePath: uploadResult.storagePath
      });

      return true;
    } else {
      // Handle failure with retry logic
      const newAttemptCount = item.attempt_count + 1;
      const shouldRetry = newAttemptCount < item.max_attempts;

      logger.warn('Recording upload failed', {
        queueId: item.id,
        callId: item.call_id,
        attemptCount: newAttemptCount,
        maxAttempts: item.max_attempts,
        shouldRetry,
        error: uploadResult.error
      });

      if (shouldRetry) {
        // Update for retry
        const { error: retryError } = await supabase
          .from('recording_upload_queue')
          .update({
            status: 'pending',
            error_message: uploadResult.error?.substring(0, 500),
            attempt_count: newAttemptCount,
            last_error_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (retryError) {
          logger.error('Failed to update item for retry', {
            queueId: item.id,
            error: retryError.message
          });
        }
      } else {
        // Mark as failed (max retries exceeded)
        const { error: failError } = await supabase
          .from('recording_upload_queue')
          .update({
            status: 'failed',
            error_message: `Upload failed after ${item.max_attempts} attempts: ${uploadResult.error}`.substring(0, 500),
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (failError) {
          logger.error('Failed to mark item as failed', {
            queueId: item.id,
            error: failError.message
          });
        }

        logger.error('Recording upload failed after max retries', {
          queueId: item.id,
          callId: item.call_id,
          maxAttempts: item.max_attempts
        });
      }

      return false;
    }
  } catch (error: any) {
    logger.error('Error processing queue item', {
      queueId: item.id,
      callId: item.call_id,
      error: error?.message
    });

    // Attempt to update item with error status
    try {
      const newAttemptCount = item.attempt_count + 1;
      const shouldRetry = newAttemptCount < item.max_attempts;

      if (shouldRetry) {
        await supabase
          .from('recording_upload_queue')
          .update({
            status: 'pending',
            error_message: error.message?.substring(0, 500),
            attempt_count: newAttemptCount,
            last_error_at: new Date().toISOString()
          })
          .eq('id', item.id);
      } else {
        await supabase
          .from('recording_upload_queue')
          .update({
            status: 'failed',
            error_message: `Fatal error: ${error.message}`.substring(0, 500),
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    } catch (updateError: any) {
      logger.error('Failed to update error status', {
        queueId: item.id,
        error: updateError?.message
      });
    }

    return false;
  }
}

/**
 * Process pending queue items for a specific org
 * CRITICAL SSOT FIX: Process per-org to maintain tenant isolation
 */
async function processQueueForOrg(orgId: string): Promise<{ successCount: number; failureCount: number }> {
  try {
    // Get pending items for this org, prioritized by: priority, then created_at
    const { data: queueItems, error: fetchError } = await supabase
      .from('recording_upload_queue')
      .select('*')
      .eq('org_id', orgId)  // CRITICAL: Filter by org_id for tenant isolation
      .eq('status', 'pending')
      .order('priority', { ascending: false }) // high first
      .order('created_at', { ascending: true }) // oldest first
      .limit(BATCH_SIZE);

    if (fetchError) {
      logger.error('Failed to fetch queue items for org', {
        orgId,
        error: fetchError.message
      });
      return { successCount: 0, failureCount: 0 };
    }

    if (!queueItems || queueItems.length === 0) {
      logger.debug('No pending items in queue for org', { orgId });
      return { successCount: 0, failureCount: 0 };
    }

    logger.info('Found pending items for org', {
      orgId,
      count: queueItems.length
    });

    // Process items sequentially with concurrency of 2-3 to avoid overload
    let successCount = 0;
    let failureCount = 0;

    for (const item of queueItems as QueueItem[]) {
      const success = await processQueueItem(item);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add small delay between items to prevent database overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Queue processing batch completed for org', {
      orgId,
      totalProcessed: queueItems.length,
      successCount,
      failureCount
    });

    return { successCount, failureCount };
  } catch (error: any) {
    logger.error('Error during queue processing for org', {
      orgId,
      error: error?.message
    });
    return { successCount: 0, failureCount: 0 };
  }
}

/**
 * Process pending queue items
 * CRITICAL SSOT FIX: Process per-org in isolated batches for tenant isolation
 */
export async function processRecordingQueue(): Promise<void> {
  try {
    logger.info('Starting queue processing');

    // Get all active organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('status', 'active');  // Only process active orgs

    if (orgError) {
      logger.error('Failed to fetch organizations', {
        error: orgError.message
      });
      return;
    }

    if (!orgs || orgs.length === 0) {
      logger.debug('No active organizations found');
      return;
    }

    logger.info('Processing queue for organizations', {
      orgCount: orgs.length
    });

    // Process each org separately (tenant isolation)
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    for (const org of orgs) {
      const { successCount, failureCount } = await processQueueForOrg(org.id);
      totalSuccessCount += successCount;
      totalFailureCount += failureCount;
    }

    logger.info('Queue processing completed', {
      totalSuccessCount,
      totalFailureCount,
      orgCount: orgs.length
    });
  } catch (error: any) {
    logger.error('Error during queue processing', {
      error: error?.message
    });
  }
}

/**
 * Clean up stale processing items (stuck in processing state) for a specific org
 * CRITICAL SSOT FIX: Process per-org to maintain tenant isolation
 */
async function cleanupStaleProcessingForOrg(orgId: string): Promise<void> {
  try {
    const lockTimeoutMinutes = Math.ceil(LOCK_TIMEOUT_MS / 1000 / 60);
    const cutoffTime = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();

    const { error } = await supabase
      .from('recording_upload_queue')
      .update({
        status: 'pending',
        error_message: `Reset from processing state after ${lockTimeoutMinutes} minute timeout`
      })
      .eq('org_id', orgId)  // CRITICAL FIX: Filter by org_id for tenant isolation
      .eq('status', 'processing')
      .lt('processing_started_at', cutoffTime);

    if (error) {
      logger.warn('Failed to cleanup stale items for org', {
        orgId,
        error: error.message
      });
    } else {
      logger.debug('Cleaned up stale processing items for org', { orgId });
    }
  } catch (error: any) {
    logger.error('Error during stale cleanup for org', {
      orgId,
      error: error?.message
    });
  }
}

/**
 * Clean up stale processing items across all orgs
 * CRITICAL SSOT FIX: Process per-org in isolated batches for tenant isolation
 */
async function cleanupStaleProcessing(): Promise<void> {
  try {
    // Get all active organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('status', 'active');  // Only process active orgs

    if (orgError) {
      logger.error('Failed to fetch organizations for stale cleanup', {
        error: orgError.message
      });
      return;
    }

    if (!orgs || orgs.length === 0) {
      logger.debug('No active organizations found for stale cleanup');
      return;
    }

    // Process each org separately (tenant isolation)
    for (const org of orgs) {
      await cleanupStaleProcessingForOrg(org.id);
    }

    logger.info('Stale cleanup completed for all orgs', { orgCount: orgs.length });
  } catch (error: any) {
    logger.error('Error during stale cleanup', {
      error: error?.message
    });
  }
}

/**
 * Schedule recording queue worker to run periodically
 */
export function scheduleRecordingQueueWorker(): void {
  logger.info('Scheduling recording queue worker', {
    pollIntervalMs: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE
  });

  // Run immediately on startup
  processRecordingQueue().catch((error) => {
    logger.error('Initial processing failed', {
      error: error?.message
    });
  });

  // Schedule recurring processing
  setInterval(() => {
    processRecordingQueue().catch((error) => {
      logger.error('Scheduled processing failed', {
        error: error?.message
      });
    });
  }, POLL_INTERVAL_MS);

  // Run stale cleanup every 5 minutes
  setInterval(() => {
    cleanupStaleProcessing().catch((error) => {
      logger.error('Stale cleanup failed', {
        error: error?.message
      });
    });
  }, 5 * 60 * 1000);

  logger.info('Recording queue worker scheduled');
}
