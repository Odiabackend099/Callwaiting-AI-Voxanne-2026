/**
 * Call Recording Storage Service
 * Handles uploading call recordings to Supabase Storage and generating signed URLs
 * Supports both inbound and outbound call recordings
 */

import { supabase } from './supabase-client';
import { createLogger } from './logger';
import axios from 'axios';
import path from 'path';

const logger = createLogger('CallRecordingStorage');

// Configuration constants
const RECORDING_CONFIG = {
  SIGNED_URL_EXPIRY_SECONDS: parseInt(process.env.RECORDING_URL_EXPIRY_SECONDS || '3600'), // 1 hour default (was 15 min)
  MAX_DOWNLOAD_RETRIES: 3,
  RETRY_DELAYS_MS: [1000, 2000, 4000],
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024, // 500MB
  DOWNLOAD_TIMEOUT_MS: parseInt(process.env.RECORDING_DOWNLOAD_TIMEOUT_MS || '60000') // 60 sec default
} as const;

interface UploadRecordingParams {
  orgId: string;
  callId: string;
  callType: 'inbound' | 'outbound';
  recordingUrl: string;
  vapiCallId: string;
}

interface RecordingUploadResult {
  success: boolean;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
}

/**
 * Download recording from Vapi/Twilio and upload to Supabase Storage
 * @param params - Upload parameters
 * @returns Upload result with storage path and signed URL
 */
export async function uploadCallRecording(
  params: UploadRecordingParams
): Promise<RecordingUploadResult> {
  const { orgId, callId, callType, recordingUrl, vapiCallId } = params;

  try {
    if (!recordingUrl) {
      logger.warn('No recording URL provided', {
        callId,
        vapiCallId
      });
      return { success: false, error: 'No recording URL provided' };
    }

    logger.info('Starting download', {
      callId,
      callType,
      urlLength: recordingUrl.length,
      timeout: RECORDING_CONFIG.DOWNLOAD_TIMEOUT_MS
    });

    // Download recording from Vapi/Twilio with retry logic
    let recordingBuffer: Buffer | null = null;

    for (let attempt = 0; attempt < RECORDING_CONFIG.MAX_DOWNLOAD_RETRIES; attempt++) {
      try {
        const response = await axios.get(recordingUrl, {
          responseType: 'arraybuffer',
          timeout: RECORDING_CONFIG.DOWNLOAD_TIMEOUT_MS,
          maxContentLength: RECORDING_CONFIG.MAX_FILE_SIZE_BYTES,
          maxBodyLength: RECORDING_CONFIG.MAX_FILE_SIZE_BYTES
        });

        recordingBuffer = Buffer.from(response.data);

        // Validate recording size
        if (recordingBuffer.length < 1024) {
          logger.warn('Recording too small (possibly incomplete)', {
            callId,
            size: recordingBuffer.length
          });
          throw new Error(`Recording too small: ${recordingBuffer.length} bytes`);
        }

        logger.info('Download successful', {
          callId,
          size: recordingBuffer.length,
          attempt: attempt + 1
        });
        break;
      } catch (downloadError: any) {
        const isTimeout = downloadError.code === 'ECONNABORTED';
        const isNotFound = downloadError.response?.status === 404;
        const isUnreachable = downloadError.code === 'ENOTFOUND';

        logger.warn(`Download attempt ${attempt + 1} failed`, {
          callId,
          error: downloadError.message,
          code: downloadError.code,
          isTimeout,
          isNotFound,
          isUnreachable,
          attempt: attempt + 1,
          maxRetries: RECORDING_CONFIG.MAX_DOWNLOAD_RETRIES
        });

        if (attempt < RECORDING_CONFIG.MAX_DOWNLOAD_RETRIES - 1) {
          const delayMs = RECORDING_CONFIG.RETRY_DELAYS_MS[attempt];
          logger.info(`Retrying in ${delayMs}ms`, { callId });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          // All retries exhausted
          if (isTimeout) {
            throw new Error(`Recording download timeout after ${RECORDING_CONFIG.DOWNLOAD_TIMEOUT_MS}ms`);
          } else if (isNotFound) {
            throw new Error('Recording not found at URL (404)');
          } else if (isUnreachable) {
            throw new Error('Recording URL unreachable');
          } else {
            throw new Error(`Failed to download recording: ${downloadError.message}`);
          }
        }
      }
    }

    if (!recordingBuffer) {
      throw new Error('Failed to download recording after all retries');
    }

    // Generate storage path: calls/{org_id}/{call_type}/{call_id}/{timestamp}.wav
    const timestamp = Date.now();
    const storagePath = `calls/${orgId}/${callType}/${callId}/${timestamp}.wav`;

    logger.info('Uploading to Supabase Storage', {
      callId,
      storagePath,
      size: recordingBuffer.length
    });

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(storagePath, recordingBuffer, {
        contentType: 'audio/wav',
        upsert: false // Prevent overwriting
      });

    if (uploadError) {
      logger.error('Upload failed', {
        callId,
        error: uploadError.message
      });
      return { success: false, error: uploadError.message };
    }

    logger.info('Upload successful', {
      callId,
      storagePath
    });

    // Generate signed URL with configurable expiry
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, RECORDING_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError) {
      logger.error('Failed to generate signed URL', {
        callId,
        error: signedUrlError.message
      });
      return {
        success: true,
        storagePath,
        error: 'Signed URL generation failed'
      };
    }

    logger.info('Recording stored successfully', {
      callId,
      callType,
      storagePath
    });

    return {
      success: true,
      storagePath,
      signedUrl: signedUrlData.signedUrl
    };
  } catch (error: any) {
    logger.error('Error', {
      callId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Get signed URL for a stored recording
 * @param storagePath - Path in Supabase Storage
 * @returns Signed URL with configurable expiry (default 15 minutes)
 */
export async function getSignedRecordingUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, RECORDING_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      logger.error('Failed to generate signed URL', {
        storagePath,
        error: error.message
      });
      return null;
    }

    return data.signedUrl;
  } catch (error: any) {
    logger.error('Error', {
      storagePath,
      error: error.message
    });
    return null;
  }
}

/**
 * Delete a recording from storage
 * @param storagePath - Path in Supabase Storage
 */
export async function deleteRecording(storagePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('call-recordings')
      .remove([storagePath]);

    if (error) {
      logger.error('Failed to delete', {
        storagePath,
        error: error.message
      });
      return false;
    }

    logger.info('Recording deleted', { storagePath });
    return true;
  } catch (error: any) {
    logger.error('Error', {
      storagePath,
      error: error.message
    });
    return false;
  }
}
