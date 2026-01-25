/**
 * Call Recording Storage Service
 * Handles uploading call recordings to Supabase Storage and generating signed URLs
 * Supports both inbound and outbound call recordings
 */

import { supabase } from './supabase-client';
import { createLogger } from './logger';
import { recordUploadSuccess, recordUploadFailure } from './recording-metrics';
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
 * Validate audio file format by checking magic bytes (file headers)
 * Supports: WAV (RIFF), MP3 (ID3/FF), M4A (ftyp)
 */
function validateAudioFormat(buffer: Buffer, fileName?: string): { valid: boolean; format?: string; error?: string } {
  if (buffer.length < 4) {
    return { valid: false, error: 'File too small to validate' };
  }

  // Check for WAV (RIFF header)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12) {
      const wave = buffer.toString('ascii', 8, 12);
      if (wave === 'WAVE') {
        return { valid: true, format: 'wav' };
      }
    }
  }

  // Check for MP3 (ID3 tag or MPEG frame sync)
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    // ID3 tag
    return { valid: true, format: 'mp3' };
  }

  // Check for MP3 frame sync (FF FB or FF FA)
  if (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa)) {
    return { valid: true, format: 'mp3' };
  }

  // Check for M4A (ftyp atom, typically at offset 4)
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (['mp42', 'isom', 'm4a '].includes(brand)) {
      return { valid: true, format: 'm4a' };
    }
  }

  return { valid: false, error: 'Unrecognized audio format (must be WAV, MP3, or M4A)' };
}

/**
 * Validate recording URL for security (prevent SSRF)
 */
function validateRecordingUrl(url: string): { valid: boolean; error?: string } {
  try {
    const recordingUrl = new URL(url);

    // Whitelist allowed domains
    const allowedDomains = [
      'api.vapi.ai',
      'storage.vapi.ai',
      'vapi.ai',
      'api.twilio.com',
      'twilio.com',
      's3.amazonaws.com',
      '*.s3.amazonaws.com'
    ];

    const isAllowed = allowedDomains.some(domain => {
      if (domain.includes('*')) {
        const pattern = domain.replace('*', '.*');
        return new RegExp(`^${pattern}$`).test(recordingUrl.hostname);
      }
      return recordingUrl.hostname === domain || recordingUrl.hostname.endsWith('.' + domain);
    });

    if (!isAllowed) {
      return { valid: false, error: `Recording URL from untrusted domain: ${recordingUrl.hostname}` };
    }

    // Ensure HTTPS (except for localhost)
    if (!recordingUrl.hostname.includes('localhost') && recordingUrl.protocol !== 'https:') {
      return { valid: false, error: 'Recording URL must use HTTPS' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: `Invalid URL format: ${error.message}` };
  }
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
  const startTime = Date.now();

  try {
    if (!recordingUrl) {
      logger.warn('No recording URL provided', {
        callId,
        vapiCallId
      });
      // Record validation failure metric
      const durationMs = Date.now() - startTime;
      await recordUploadFailure({
        callId,
        callType,
        durationMs,
        errorMessage: 'No recording URL provided'
      });
      return { success: false, error: 'No recording URL provided' };
    }

    // Validate URL security (prevent SSRF)
    const urlValidation = validateRecordingUrl(recordingUrl);
    if (!urlValidation.valid) {
      logger.warn('Invalid recording URL', {
        callId,
        error: urlValidation.error
      });
      // Record validation failure metric
      const durationMs = Date.now() - startTime;
      await recordUploadFailure({
        callId,
        callType,
        durationMs,
        errorMessage: urlValidation.error || 'Invalid recording URL'
      });
      return { success: false, error: urlValidation.error };
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

        // Validate audio format (WAV, MP3, M4A)
        const formatValidation = validateAudioFormat(recordingBuffer);
        if (!formatValidation.valid) {
          logger.warn('Invalid audio format', {
            callId,
            error: formatValidation.error
          });
          throw new Error(formatValidation.error);
        }

        logger.info('Download successful', {
          callId,
          format: formatValidation.format,
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

    // Detect format and use correct extension
    const formatValidation = validateAudioFormat(recordingBuffer);
    const extension = formatValidation.format || 'wav';

    // Generate storage path: calls/{org_id}/{call_type}/{call_id}/{timestamp}.{ext}
    const timestamp = Date.now();
    const storagePath = `calls/${orgId}/${callType}/${callId}/${timestamp}.${extension}`;

    logger.info('Uploading to Supabase Storage', {
      callId,
      storagePath,
      format: extension,
      size: recordingBuffer.length
    });

    // Map detected format to proper MIME type
    const mimeTypes: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4'
    };
    const contentType = mimeTypes[extension] || 'audio/wav';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(storagePath, recordingBuffer, {
        contentType,
        upsert: false // Prevent overwriting
      });

    if (uploadError) {
      logger.error('Upload failed', {
        callId,
        error: uploadError.message
      });
      // Record storage upload failure metric
      const durationMs = Date.now() - startTime;
      await recordUploadFailure({
        callId,
        callType,
        durationMs,
        errorMessage: `Storage upload failed: ${uploadError.message}`
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
      logger.error('Failed to generate signed URL - rolling back upload', {
        callId,
        error: signedUrlError.message,
        storagePath
      });

      // CRITICAL: Delete the uploaded file since it's not accessible without signed URL
      try {
        await deleteRecording(storagePath);
        logger.info('Uploaded file deleted after signed URL failure', { storagePath });
      } catch (deleteError: any) {
        logger.error('Failed to cleanup uploaded file after signed URL failure', {
          storagePath,
          error: deleteError.message
        });
        // Don't throw - we already have an error to report
      }

      // Record signed URL generation failure metric
      const durationMs = Date.now() - startTime;
      await recordUploadFailure({
        callId,
        callType,
        durationMs,
        errorMessage: `Failed to generate signed URL: ${signedUrlError.message}`
      });

      return {
        success: false,
        error: `Failed to generate signed URL: ${signedUrlError.message}`
      };
    }

    logger.info('Recording stored successfully', {
      callId,
      callType,
      storagePath
    });

    // Record success metric
    const durationMs = Date.now() - startTime;
    await recordUploadSuccess({
      callId,
      callType,
      durationMs,
      fileSizeBytes: recordingBuffer.length
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

    // Record failure metric
    const durationMs = Date.now() - startTime;
    await recordUploadFailure({
      callId,
      callType,
      durationMs,
      errorMessage: error.message
    });

    return { success: false, error: error.message };
  }
}

/**
 * Get signed URL for a stored recording
 * @param storagePath - Path in Supabase Storage
 * @returns Signed URL with configurable expiry (default 15 minutes)
 */
/**
 * Check if a recording file exists in storage
 * @param storagePath - Path in Supabase Storage
 * @returns true if file exists, false otherwise
 */
export async function recordingExists(storagePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from('call-recordings')
      .list(storagePath.substring(0, storagePath.lastIndexOf('/') + 1) || '', {
        search: storagePath.substring(storagePath.lastIndexOf('/') + 1)
      });

    if (error) {
      logger.warn('Failed to check file existence', {
        storagePath,
        error: error.message
      });
      return false;
    }

    return data && data.length > 0;
  } catch (error: any) {
    logger.warn('Error checking file existence', {
      storagePath,
      error: error.message
    });
    return false;
  }
}

export async function getSignedRecordingUrl(storagePath: string): Promise<string | null> {
  try {
    // Verify file exists before generating signed URL
    const exists = await recordingExists(storagePath);
    if (!exists) {
      logger.warn('Recording file not found in storage', { storagePath });
      return null;
    }

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
