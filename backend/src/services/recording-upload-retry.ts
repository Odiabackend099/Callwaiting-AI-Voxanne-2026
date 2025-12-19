/**
 * Recording Upload Retry Service
 * Handles retrying failed recording uploads with exponential backoff
 */

import { supabase } from './supabase-client';
import { uploadCallRecording } from './call-recording-storage';
import { createLogger } from './logger';

const logger = createLogger('RecordingUploadRetry');

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
      logger.error('RecordingUploadRetry', 'Failed to find call log for failed upload', {
        callId: params.callId,
        error: callError?.message
      });
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
      logger.error('RecordingUploadRetry', 'Failed to log failed upload', {
        callId: params.callId,
        error: insertError.message
      });
    } else {
      logger.info('RecordingUploadRetry', 'Failed upload logged for retry', {
        callId: params.callId,
        nextRetryAt
      });
    }
  } catch (error: any) {
    logger.error('RecordingUploadRetry', 'Error logging failed upload', {
      error: error.message
    });
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
    logger.error('RecordingUploadRetry', 'Failed to fetch failed uploads', {
      error: error.message
    });
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
      logger.error('RecordingUploadRetry', 'Failed to find call log for retry', {
        failedUploadId: failedUpload.id,
        error: callError?.message
      });
      return false;
    }

    // Detect call type from call_logs
    const { data: callDetails } = await supabase
      .from('calls')
      .select('call_type')
      .eq('vapi_call_id', callLog.vapi_call_id)
      .maybeSingle();

    const callType = (callDetails?.call_type || 'outbound') as 'inbound' | 'outbound';

    logger.info('RecordingUploadRetry', 'Retrying failed upload', {
      failedUploadId: failedUpload.id,
      callId: callLog.vapi_call_id,
      retryCount: failedUpload.retry_count + 1
    });

    // Attempt upload
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
        logger.warn('RecordingUploadRetry', 'Failed to mark upload as resolved', {
          failedUploadId: failedUpload.id,
          error: updateError.message
        });
      } else {
        logger.info('RecordingUploadRetry', 'Failed upload retry succeeded', {
          failedUploadId: failedUpload.id,
          callId: callLog.vapi_call_id
        });
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
        .eq('id', failedUpload.id);

      if (updateError) {
        logger.error('RecordingUploadRetry', 'Failed to update retry count', {
          failedUploadId: failedUpload.id,
          error: updateError.message
        });
      } else {
        logger.warn('RecordingUploadRetry', 'Failed upload retry failed, scheduled next retry', {
          failedUploadId: failedUpload.id,
          retryCount: nextRetryCount,
          nextRetryAt,
          error: uploadResult.error
        });
      }

      return false;
    }
  } catch (error: any) {
    logger.error('RecordingUploadRetry', 'Error retrying failed upload', {
      failedUploadId: failedUpload.id,
      error: error.message
    });
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
    logger.info('RecordingUploadRetry', 'Found failed uploads ready for retry', {
      count: failedUploads.length
    });

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
    logger.info('RecordingUploadRetry', 'Recording upload retry job completed', {
      totalFailed: failedUploads.length,
      successCount,
      failureCount,
      duration
    });

    // Alert if too many failures
    if (failureCount > 0) {
      logger.warn('RecordingUploadRetry', 'Some recording upload retries failed', {
        failureCount,
        totalFailed: failedUploads.length
      });
    }
  } catch (error: any) {
    logger.error('RecordingUploadRetry', 'Recording upload retry job failed', {
      error: error.message
    });
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
