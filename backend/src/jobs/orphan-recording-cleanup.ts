/**
 * Orphan Recording Cleanup Job
 * Runs daily to detect and clean up orphaned recordings in Supabase Storage
 * 
 * An orphaned recording is one where:
 * 1. Recording exists in Supabase Storage (recording_storage_path is set)
 * 2. But call_logs entry has no recording_url (upload failed to complete)
 * 3. Recording is older than 7 days (grace period for retries)
 */

import { supabase } from '../services/supabase-client';
import { deleteRecording } from '../services/call-recording-storage';
import { log as logger } from '../services/logger';

interface OrphanedRecording {
  id: string;
  recording_storage_path: string | null;
  recording_uploaded_at: string | null;
  created_at: string;
}

/**
 * Detect orphaned recordings (older than 7 days) for a specific org
 * CRITICAL SSOT FIX: Process per-org to maintain tenant isolation
 */
async function detectOrphanedRecordingsForOrg(orgId: string): Promise<OrphanedRecording[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orphans, error } = await supabase
    .from('call_logs')
    .select('id, recording_storage_path, recording_uploaded_at, created_at, org_id')
    .eq('org_id', orgId)  // CRITICAL: Filter by org_id for tenant isolation
    .not('recording_storage_path', 'is', null)  // Has storage path
    .is('recording_url', null)                    // But no signed URL
    .lt('recording_uploaded_at', sevenDaysAgo);   // Older than 7 days

  if (error) {
    logger.error('OrphanCleanup', `Failed to detect orphaned recordings for org ${orgId}: ${error.message}`);
    return [];
  }

  return orphans || [];
}

/**
 * Delete orphaned recording from storage
 */
async function deleteOrphanedRecording(storagePath: string): Promise<boolean> {
  try {
    const success = await deleteRecording(storagePath);
    if (success) {
      logger.info('OrphanCleanup', `Deleted orphaned recording: ${storagePath}`);
    }
    return success;
  } catch (error: any) {
    logger.error('OrphanCleanup', `Failed to delete orphaned recording: ${error.message}`);
    return false;
  }
}

/**
 * Mark orphaned recording as detected in database
 */
async function markOrphanDetected(callLogId: string, storagePath: string): Promise<void> {
  const { error } = await supabase
    .from('orphaned_recordings')
    .insert({
      storage_path: storagePath,
      detected_at: new Date().toISOString(),
      size_bytes: 0  // Will be updated if we can get file size
    });

  if (error) {
    logger.warn('OrphanCleanup', `Failed to record orphan detection: ${error.message}`);
  }
}

/**
 * Mark orphan as deleted
 */
async function markOrphanDeleted(storagePath: string): Promise<void> {
  const { error } = await supabase
    .from('orphaned_recordings')
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq('storage_path', storagePath);

  if (error) {
    logger.warn('OrphanCleanup', `Failed to mark orphan as deleted: ${error.message}`);
  }
}

/**
 * Main cleanup job
 * CRITICAL SSOT FIX: Process per-org in isolated batches for tenant isolation
 */
export async function runOrphanCleanupJob(): Promise<void> {
  const startTime = Date.now();
  logger.info('OrphanCleanup', 'Starting orphan recording cleanup job');

  try {
    // 1. Get all active organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('status', 'active');  // Only process active orgs

    if (orgError) {
      logger.error('OrphanCleanup', `Failed to fetch organizations: ${orgError.message}`);
      return;
    }

    if (!orgs || orgs.length === 0) {
      logger.info('OrphanCleanup', 'No active organizations found');
      return;
    }

    logger.info('OrphanCleanup', `Processing ${orgs.length} organizations`);

    // 2. Process each org separately (tenant isolation)
    let totalDeletedCount = 0;
    let totalFailedCount = 0;

    for (const org of orgs) {
      try {
        // Detect orphaned recordings for this org
        const orphans = await detectOrphanedRecordingsForOrg(org.id);
        
        if (orphans.length === 0) {
          logger.debug('OrphanCleanup', `No orphaned recordings found for org ${org.id}`);
          continue;
        }

        logger.info('OrphanCleanup', `Detected ${orphans.length} orphaned recordings for org ${org.id}`);

        // Process each orphan for this org
        let orgDeletedCount = 0;
        let orgFailedCount = 0;

        for (const orphan of orphans) {
          try {
            // Mark as detected
            if (orphan.recording_storage_path) {
              await markOrphanDetected(orphan.id, orphan.recording_storage_path);

              // Delete from storage
              const deleted = await deleteOrphanedRecording(orphan.recording_storage_path);

              if (deleted) {
                // Mark as deleted in database
                await markOrphanDeleted(orphan.recording_storage_path);
                orgDeletedCount++;
                totalDeletedCount++;
              } else {
                orgFailedCount++;
                totalFailedCount++;
              }
            }
          } catch (error: any) {
            logger.error('OrphanCleanup', `Error processing orphan ${orphan.id} for org ${org.id}: ${error.message}`);
            orgFailedCount++;
            totalFailedCount++;
          }
        }

        logger.info('OrphanCleanup', `Org ${org.id} cleanup: ${orgDeletedCount} deleted, ${orgFailedCount} failed`);
      } catch (error: any) {
        logger.error('OrphanCleanup', `Error processing org ${org.id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('OrphanCleanup', `Orphan cleanup completed: ${totalDeletedCount} deleted, ${totalFailedCount} failed across ${orgs.length} orgs in ${duration}ms`);

    // Alert if too many failures
    if (totalFailedCount > 0) {
      logger.warn('OrphanCleanup', `${totalFailedCount} orphaned recordings failed to delete`);
    }
  } catch (error: any) {
    logger.error('OrphanCleanup', `Orphan cleanup job failed: ${error.message}`);
  }
}

/**
 * Schedule cleanup job to run daily at 2 AM UTC
 */
export function scheduleOrphanCleanup(): void {
  // Calculate time until next 2 AM UTC
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setUTCHours(2, 0, 0, 0);

  if (next2AM <= now) {
    next2AM.setUTCDate(next2AM.getUTCDate() + 1);
  }

  const timeUntilNext = next2AM.getTime() - now.getTime();

  logger.info('OrphanCleanup', `Scheduling orphan cleanup job for ${next2AM.toISOString()}`);

  // Schedule first run
  setTimeout(() => {
    runOrphanCleanupJob();
    // Then run daily
    setInterval(() => {
      runOrphanCleanupJob();
    }, 24 * 60 * 60 * 1000);
  }, timeUntilNext);
}
