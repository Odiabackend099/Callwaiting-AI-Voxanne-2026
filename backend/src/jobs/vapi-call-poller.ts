/**
 * Vapi Call Poller
 * Fallback mechanism to fetch completed calls from Vapi API
 * Runs every 30 seconds to check for new completed calls with recordings
 */

import { supabase } from '../services/supabase-client';
import { config } from '../config/index';
import { log as logger } from '../services/logger';
import axios from 'axios';

// CRITICAL: API key must be provided via environment variable
const VAPI_PRIVATE_KEY = config.VAPI_PRIVATE_KEY;
if (!VAPI_PRIVATE_KEY) {
  throw new Error('VAPI_PRIVATE_KEY environment variable is required. Please set it in your .env file.');
}

interface VapiCall {
  id: string;
  assistantId: string;
  phoneNumberId: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  artifact?: {
    recording?: string;
    transcript?: string;
  };
}

/**
 * Poll Vapi for completed calls and create call_logs entries
 */
export async function pollVapiCalls(): Promise<void> {
  try {
    logger.info('backend', 'Starting Vapi call poll');

    // Fetch completed calls from Vapi - try multiple endpoints
    let calls: VapiCall[] = [];
    
    try {
      // Try the main calls endpoint
      const response = await axios.get(
        'https://api.vapi.ai/call',
        {
          headers: {
            'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
            'Content-Type': 'application/json'
          },
          params: {
            limit: 20
          },
          timeout: 10000
        }
      );

      calls = response.data.calls || response.data || [];
      logger.info('VapiPoller', `Fetched calls from /call endpoint`, {
        count: calls.length,
        responseType: typeof response.data
      });
    } catch (error: any) {
      logger.warn('backend', 'Failed to fetch from /call endpoint');
    }

    logger.info('VapiPoller', `Found ${calls.length} completed calls`, {
      count: calls.length
    });

    // Process each call
    for (const call of calls) {
      try {
        // Fetch complete call details from Vapi API to get recording URL
        let completeCall = call;
        try {
          const detailResponse = await axios.get(
            `https://api.vapi.ai/call/${call.id}`,
            {
              headers: {
                'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );
          completeCall = detailResponse.data;
          logger.info('backend', 'Fetched complete call details');
        } catch (detailError: any) {
          logger.warn('backend', 'Failed to fetch call details (using list data)');
        }

        // Check if call already exists for this Vapi call ID
        const { data: existing } = await supabase
          .from('calls')
          .select('id, recording_storage_path')
          .eq('vapi_call_id', call.id)
          .maybeSingle();

        let callLogId = existing?.id;

        if (!existing) {
          // Create call entry
          const { data: callLog, error: insertError } = await supabase
            .from('calls')
            .insert({
              vapi_call_id: call.id,
              call_sid: `vapi-${call.id}`, // Generate a synthetic call_sid for Vapi calls
              call_type: 'inbound',
              status: 'completed',
              duration_seconds: Math.round(completeCall.duration / 1000) || 0,
              created_at: new Date(completeCall.startedAt).toISOString(),
              started_at: new Date(completeCall.startedAt).toISOString(),
              ended_at: new Date(completeCall.endedAt).toISOString()
            })
            .select('id')
            .single();

          if (insertError) {
            logger.error('backend', 'Failed to create call_log');
            continue;
          }

          callLogId = callLog?.id;
          logger.info('backend', 'Created call_log entry');
        }

        // Upload recording if available and not already uploaded
        if (completeCall.artifact?.recording && !existing?.recording_storage_path) {
          try {
            // Handle both string URLs and object responses
            let recordingUrl: string | null = null;
            const recording = completeCall.artifact.recording as any;
            
            if (typeof recording === 'string') {
              recordingUrl = recording;
            } else if (typeof recording === 'object' && recording !== null) {
              // Vapi returns recording as object with stereoUrl and mono properties
              recordingUrl = (recording as any).stereoUrl || (recording as any).url || (recording as any).recordingUrl || null;
            }
            
            if (recordingUrl) {
              logger.info('backend', 'Recording URL found');
              
              if (recordingUrl.startsWith('http')) {
                await uploadRecordingFromVapi(call.id, recordingUrl, callLogId);
              } else {
                logger.warn('backend', 'Invalid recording URL format');
              }
            } else {
              logger.warn('backend', 'Could not extract recording URL');
            }
          } catch (recordingError: any) {
            logger.warn('backend', 'Failed to upload recording (non-blocking)');
          }
        } else if (!completeCall.artifact?.recording) {
          logger.warn('backend', 'No recording available for call');
        }
      } catch (callError: any) {
        logger.error('backend', 'Error processing call');
      }
    }

    logger.info('backend', 'Vapi call poll completed');
  } catch (error: any) {
    logger.error('backend', 'Vapi call poll failed');
  }
}

/**
 * Upload recording from Vapi to Supabase
 */
async function uploadRecordingFromVapi(
  vapiCallId: string,
  recordingUrl: string,
  callLogId?: string
): Promise<void> {
  try {
    logger.info('backend', 'Starting recording upload');

    // Download recording from Vapi
    const recordingResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const recordingBuffer = Buffer.from(recordingResponse.data);
    logger.info('backend', 'Recording downloaded');

    // Upload to Supabase Storage
    const storagePath = `calls/inbound/${vapiCallId}/${Date.now()}.wav`;
    logger.info('backend', 'Uploading to Supabase Storage');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(storagePath, recordingBuffer, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (uploadError) {
      logger.error('backend', 'Failed to upload recording to storage');
      return;
    }

    logger.info('backend', 'Recording uploaded to storage');

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError) {
      logger.error('backend', 'Failed to generate signed URL');
      return;
    }

    // Update call with recording metadata
    if (callLogId) {
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          recording_storage_path: storagePath,
          recording_signed_url: signedUrlData?.signedUrl,
          recording_signed_url_expires_at: new Date(Date.now() + 3600000).toISOString(),
          recording_size_bytes: recordingBuffer.length,
          recording_uploaded_at: new Date().toISOString()
        })
        .eq('id', callLogId);

      if (updateError) {
        logger.error('backend', 'Failed to update call_log with recording');
      } else {
        logger.info('backend', 'Recording metadata saved to call_log');
      }
    }
  } catch (error: any) {
    logger.error('backend', 'Recording download/upload failed');
  }
}

/**
 * Schedule Vapi call poller to run every 30 seconds
 */
export function scheduleVapiCallPoller(): void {
  logger.info('backend', 'Scheduling Vapi call poller (every 30 seconds)');

  // Run immediately
  pollVapiCalls().catch((error) => {
    logger.error('backend', 'Initial poll failed');
  });

  // Schedule recurring polls
  setInterval(() => {
    pollVapiCalls().catch((error) => {
      logger.error('backend', 'Poll failed');
    });
  }, 30 * 1000); // 30 seconds

  logger.info('backend', 'Vapi call poller scheduled');
}
