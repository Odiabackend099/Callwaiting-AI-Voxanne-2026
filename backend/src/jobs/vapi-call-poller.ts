/**
 * Vapi Call Poller
 * Fallback mechanism to fetch completed calls from Vapi API
 * Runs every 30 seconds to check for new completed calls with recordings
 */

import { supabase } from '../services/supabase-client';
import { log as logger } from '../services/logger';
import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY || '623b9f25-cda2-4de0-8e6e-5291eac94e32';

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
    logger.info('VapiPoller', 'Starting Vapi call poll');

    // Fetch completed calls from Vapi - try multiple endpoints
    let calls: VapiCall[] = [];
    
    try {
      // Try the main calls endpoint
      const response = await axios.get(
        'https://api.vapi.ai/call',
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
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
      logger.warn('VapiPoller', 'Failed to fetch from /call endpoint', {
        error: error?.message,
        status: error?.response?.status
      });
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
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );
          completeCall = detailResponse.data;
          logger.info('VapiPoller', 'Fetched complete call details', {
            vapiCallId: call.id,
            hasRecording: !!completeCall.artifact?.recording
          });
        } catch (detailError: any) {
          logger.warn('VapiPoller', 'Failed to fetch call details (using list data)', {
            vapiCallId: call.id,
            error: detailError?.message
          });
        }

        // Check if call_log already exists for this Vapi call ID
        const { data: existing } = await supabase
          .from('call_logs')
          .select('id, recording_storage_path')
          .eq('vapi_call_id', call.id)
          .maybeSingle();

        let callLogId = existing?.id;

        if (!existing) {
          // Create call_log entry
          const { data: callLog, error: insertError } = await supabase
            .from('call_logs')
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
            logger.error('VapiPoller', 'Failed to create call_log', {
              vapiCallId: call.id,
              error: insertError.message
            });
            continue;
          }

          callLogId = callLog?.id;
          logger.info('VapiPoller', 'Created call_log entry', {
            vapiCallId: call.id,
            callLogId
          });
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
              recordingUrl = recording.url || recording.recordingUrl || null;
            }
            
            if (recordingUrl) {
              logger.info('VapiPoller', 'Recording URL found', {
                vapiCallId: call.id,
                recordingUrl: recordingUrl.substring(0, 100),
                recordingType: typeof recording
              });
              
              if (recordingUrl.startsWith('http')) {
                await uploadRecordingFromVapi(call.id, recordingUrl, callLogId);
              } else {
                logger.warn('VapiPoller', 'Invalid recording URL format', {
                  vapiCallId: call.id,
                  recordingUrl: recordingUrl.substring(0, 100)
                });
              }
            } else {
              logger.warn('VapiPoller', 'Could not extract recording URL', {
                vapiCallId: call.id,
                recordingType: typeof recording,
                recordingKeys: typeof recording === 'object' ? Object.keys(recording) : 'n/a',
                recordingValue: typeof recording === 'object' ? JSON.stringify(recording).substring(0, 200) : recording
              });
            }
          } catch (recordingError: any) {
            logger.warn('VapiPoller', 'Failed to upload recording (non-blocking)', {
              vapiCallId: call.id,
              error: recordingError?.message
            });
          }
        } else if (!completeCall.artifact?.recording) {
          logger.warn('VapiPoller', 'No recording available for call', {
            vapiCallId: call.id,
            hasArtifact: !!completeCall.artifact
          });
        }
      } catch (callError: any) {
        logger.error('VapiPoller', 'Error processing call', {
          vapiCallId: call.id,
          error: callError?.message
        });
      }
    }

    logger.info('VapiPoller', 'Vapi call poll completed', { processedCount: calls.length });
  } catch (error: any) {
    logger.error('VapiPoller', 'Vapi call poll failed', {
      error: error?.message
    });
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
    logger.info('VapiPoller', 'Downloading recording from Vapi', { vapiCallId });

    // Download recording from Vapi
    const recordingResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const recordingBuffer = Buffer.from(recordingResponse.data);
    logger.info('VapiPoller', 'Recording downloaded', {
      vapiCallId,
      size: recordingBuffer.length
    });

    // Upload to Supabase Storage
    const storagePath = `calls/inbound/${vapiCallId}/${Date.now()}.wav`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(storagePath, recordingBuffer, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (uploadError) {
      logger.error('VapiPoller', 'Failed to upload recording to storage', {
        vapiCallId,
        error: uploadError.message
      });
      return;
    }

    logger.info('VapiPoller', 'Recording uploaded to storage', {
      vapiCallId,
      storagePath
    });

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError) {
      logger.error('VapiPoller', 'Failed to generate signed URL', {
        vapiCallId,
        error: signedUrlError.message
      });
      return;
    }

    // Update call_log with recording metadata
    if (callLogId) {
      const { error: updateError } = await supabase
        .from('call_logs')
        .update({
          recording_storage_path: storagePath,
          recording_signed_url: signedUrlData?.signedUrl,
          recording_signed_url_expires_at: new Date(Date.now() + 3600000).toISOString(),
          recording_size_bytes: recordingBuffer.length,
          recording_uploaded_at: new Date().toISOString()
        })
        .eq('id', callLogId);

      if (updateError) {
        logger.error('VapiPoller', 'Failed to update call_log with recording', {
          callLogId,
          error: updateError.message
        });
      } else {
        logger.info('VapiPoller', 'Recording metadata saved to call_log', {
          callLogId,
          storagePath
        });
      }
    }
  } catch (error: any) {
    logger.error('VapiPoller', 'Recording download/upload failed', {
      vapiCallId,
      error: error?.message
    });
  }
}

/**
 * Schedule Vapi call poller to run every 30 seconds
 */
export function scheduleVapiCallPoller(): void {
  logger.info('VapiPoller', 'Scheduling Vapi call poller (every 30 seconds)');

  // Run immediately
  pollVapiCalls().catch((error) => {
    logger.error('VapiPoller', 'Initial poll failed', { error: error?.message });
  });

  // Schedule recurring polls
  setInterval(() => {
    pollVapiCalls().catch((error) => {
      logger.error('VapiPoller', 'Poll failed', { error: error?.message });
    });
  }, 30 * 1000); // 30 seconds

  logger.info('VapiPoller', 'Vapi call poller scheduled');
}
