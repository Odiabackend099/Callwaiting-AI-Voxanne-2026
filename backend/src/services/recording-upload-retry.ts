/**
 * Recording Upload Retry Service
 * Handles retrying failed recording uploads with exponential backoff
 */

import { supabase } from './supabase-client';
import { uploadCallRecording } from './call-recording-storage';
import { log as logger } from './logger';

interface FailedUpload {
  id: string;
  call_id: string;
  vapi_recording_url: string | null;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
}

/**
 * Log a failed recording upload for retry
 */
export async function logFailedUpload(params: {
  callId: string;
  vapiRecordingUrl: string;
  errorMessage: string;
}): Promise<void> {
  try {
    // Get call_logs to find org_id
    const { data: callLog, error: callError } = await supabase
      .from('call_logs')
      .select('id, org_id')
      .eq('vapi_call_id', params.callId)
      .maybeSingle();

    if (callError || !callLog) {
      logger.error('RecordingUploadRetry', `Failed to find call log: ${callError?.message || 'Not found'}`);
      return;
    }

    // Calculate next retry time (5 minutes from now)
    const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('failed_recording_uploads')
      .insert({
        call_id: callLog.id,
        vapi_recording_url: params.vapiRecordingUrl,
        error_message: params.errorMessage,
        retry_count: 0,
        next_retry_at: nextRetryAt,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      logger.error('RecordingUploadRetry', `Failed to log failed upload: ${insertError.message}`);
    } else {
      logger.info('RecordingUploadRetry', `Failed upload logged for retry at ${nextRetryAt}`);
    }
  } catch (error: any) {
    logger.error('RecordingUploadRetry', `Error logging failed upload: ${error.message}`);
  }
}

/**
 * Get failed uploads ready for retry
 */
async function getFailedUploadsForRetry(): Promise<FailedUpload[]> {
  const { data: failedUploads, error } = await supabase
    .from('failed_recording_uploads')
    .select('id, call_id, vapi_recording_url, error_message, retry_count, next_retry_at, created_at')
    .is('resolved_at', null)  // Not yet resolved
    .lt('next_retry_at', new Date().toISOString())  // Ready for retry
    .lt('retry_count', 3);  // Less than 3 retries

  if (error) {
    logger.error('RecordingUploadRetry', `Failed to fetch failed uploads: ${error.message}`);
    return [];
  }

  return failedUploads || [];
}

/**
 * Retry a failed recording upload
 */
async function retryFailedUpload(failedUpload: FailedUpload): Promise<boolean> {
  try {
    // Get call_logs to find org_id and call_type
    const { data: callLog, error: callError } = await supabase
      .from('call_logs')
      .select('vapi_call_id, org_id')
      .eq('id', failedUpload.call_id)
      .maybeSingle();

    if (callError || !callLog) {
      logger.error('RecordingUploadRetry', `Failed to find call log for retry: ${callError?.message || 'Not found'}`);
      return false;
    }

    // Detect call type from call_logs
    const { data: callDetails } = await supabase
      .from('calls')
      .select('call_type')
      .eq('vapi_call_id', callLog.vapi_call_id)
      .maybeSingle();

    const callType = (callDetails?.call_type || 'outbound') as 'inbound' | 'outbound';

    logger.info('RecordingUploadRetry', `Retrying failed upload: ${failedUpload.id} (retry ${failedUpload.retry_count + 1})`);

    // Attempt upload
    if (!failedUpload.vapi_recording_url) {
      logger.error('RecordingUploadRetry', `No recording URL for retry: ${failedUpload.id}`);
      return false;
    }

    const uploadResult = await uploadCallRecording({
      orgId: callLog.org_id,
      callId: callLog.vapi_call_id,
      callType,
      recordingUrl: failedUpload.vapi_recording_url,
      vapiCallId: callLog.vapi_call_id
    });

    if (uploadResult.success) {
      // Mark as resolved
      const { error: updateError } = await supabase
        .from('failed_recording_uploads')
        .update({
          resolved_at: new Date().toISOString()
        })
        .eq('id', failedUpload.id);

      if (updateError) {
        logger.warn('RecordingUploadRetry', `Failed to mark upload as resolved: ${updateError.message}`);
      } else {
        logger.info('RecordingUploadRetry', `Failed upload retry succeeded: ${failedUpload.id}`);
      }

      return true;
    } else {
      // Schedule next retry
      const nextRetryCount = failedUpload.retry_count + 1;
      const retryDelayMs = Math.pow(2, nextRetryCount) * 5 * 60 * 1000;  // Exponential backoff: 10, 20, 40 min
      const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();

      const { error: updateError } = await supabase
        .from('failed_recording_uploads')
        .update({
          retry_count: nextRetryCount,
          error_message: uploadResult.error || 'Unknown error',
          next_retry_at: nextRetryAt
        })
        .eq('id', failedUpload.id) as any;

      if (updateError) {
        logger.error('RecordingUploadRetry', `Failed to update retry count: ${updateError.message}`);
      } else {
        logger.warn('RecordingUploadRetry', `Failed upload retry failed, scheduled next retry at ${nextRetryAt}`);
      }

      return false;
    }
  } catch (error: any) {
    logger.error('RecordingUploadRetry', `Error retrying failed upload: ${error.message}`);
    return false;
  }
}

/**
 * Run retry job (should be called every 5 minutes)
 */
export async function runRecordingUploadRetryJob(): Promise<void> {
  const startTime = Date.now();
  logger.info('RecordingUploadRetry', 'Starting recording upload retry job');

  try {
    // Get failed uploads ready for retry
    const failedUploads = await getFailedUploadsForRetry();
    logger.info('RecordingUploadRetry', `Found ${failedUploads.length} failed uploads ready for retry`);

    if (failedUploads.length === 0) {
      return;
    }

    // Process each failed upload
    let successCount = 0;
    let failureCount = 0;

    for (const failedUpload of failedUploads) {
      const success = await retryFailedUpload(failedUpload);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('RecordingUploadRetry', `Job completed: ${successCount} succeeded, ${failureCount} failed in ${duration}ms`);

    // Alert if too many failures
    if (failureCount > 0) {
      logger.warn('RecordingUploadRetry', `${failureCount} of ${failedUploads.length} retries failed`);
    }
  } catch (error: any) {
    logger.error('RecordingUploadRetry', `Recording upload retry job failed: ${error.message}`);
  }
}

/**
 * Schedule retry job to run every 5 minutes
 */
export function scheduleRecordingUploadRetry(): void {
  logger.info('RecordingUploadRetry', 'Scheduling recording upload retry job (every 5 minutes)');

  // Run immediately
  runRecordingUploadRetryJob();

  // Then run every 5 minutes
  setInterval(() => {
    runRecordingUploadRetryJob();
  }, 5 * 60 * 1000);
}
