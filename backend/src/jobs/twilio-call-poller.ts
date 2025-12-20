/**
 * Twilio Call Poller
 * Fallback mechanism to detect completed calls and trigger recording uploads
 * Runs every 30 seconds to check for new completed calls
 */

import { supabase } from '../services/supabase-client';
import { log as logger } from '../services/logger';
import axios from 'axios';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'ACdf994930f7c27cf2f1a2d74a43966e97';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'a32f20526af74c3d4590fa0e5c097d9b';
const VAPI_API_KEY = process.env.VAPI_API_KEY;

interface TwilioCall {
  sid: string;
  from: string;
  to: string;
  status: string;
  date_created: string;
  duration: string;
  recording?: string;
}

/**
 * Poll Twilio for completed calls and create call_logs entries
 */
export async function pollTwilioCalls(): Promise<void> {
  try {
    logger.info('Starting Twilio call poll');

    // Get last poll time from cache (or use 5 minutes ago)
    const lastPollTime = new Date(Date.now() - 5 * 60 * 1000);

    // Fetch completed calls from Twilio
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?Status=completed&Limit=20`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        },
        timeout: 10000
      }
    );

    const calls: TwilioCall[] = response.data.calls || [];
    logger.info('TwilioPoller', `Found ${calls.length} completed calls`, {
      count: calls.length
    });

    // Process each call
    for (const call of calls) {
      try {
        // Check if call_log already exists for this Twilio call SID
        const { data: existing } = await supabase
          .from('call_logs')
          .select('id, recording_storage_path')
          .eq('call_sid', call.sid)
          .maybeSingle();

        let callLogId = existing?.id;

        if (!existing) {
          // Create call_log entry
          const { data: callLog, error: insertError } = await supabase
            .from('call_logs')
            .insert({
              call_sid: call.sid,
              from_number: call.from,
              to_number: call.to,
              call_type: 'inbound',
              status: 'completed',
              duration_seconds: parseInt(call.duration) || 0,
              created_at: new Date(call.date_created).toISOString(),
              started_at: new Date(call.date_created).toISOString(),
              ended_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (insertError) {
            logger.error('Failed to create call_log', {
              callSid: call.sid,
              error: insertError.message
            });
            continue;
          }

          callLogId = callLog?.id;
          logger.info('Created call_log entry', {
            callSid: call.sid,
            callLogId
          });
        }

        // Fetch recordings if not already uploaded
        if (!existing?.recording_storage_path) {
          try {
            await fetchAndUploadRecordingsForCall(call.sid, callLogId);
          } catch (recordingError: any) {
            logger.warn('Failed to fetch/upload recordings (non-blocking)', {
              callSid: call.sid,
              error: recordingError?.message
            });
          }
        }
      } catch (callError: any) {
        logger.error('Error processing call', {
          callSid: call.sid,
          error: callError?.message
        });
      }
    }

    logger.info('Twilio call poll completed', { processedCount: calls.length });
  } catch (error: any) {
    logger.error('Twilio call poll failed', {
      error: error?.message
    });
  }
}

/**
 * Fetch all recordings for a call from Twilio and upload to Supabase
 */
async function fetchAndUploadRecordingsForCall(
  callSid: string,
  callLogId?: string
): Promise<void> {
  try {
    logger.info('Fetching recordings for call', { callSid });

    // List all recordings for this call
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const recordingsResponse = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}/Recordings.json`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        },
        timeout: 10000
      }
    );

    const recordings = recordingsResponse.data.recordings || [];
    logger.info('TwilioPoller', `Found ${recordings.length} recordings for call`, {
      callSid,
      count: recordings.length
    });

    if (recordings.length === 0) {
      logger.warn('No recordings found for call', { callSid });
      return;
    }

    // Process the first recording
    const recording = recordings[0];
    const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '')}.wav`;

    await fetchAndUploadRecording(callSid, recordingUrl, callLogId);
  } catch (error: any) {
    logger.warn('Failed to fetch recordings list', {
      callSid,
      error: error?.message
    });
  }
}

/**
 * Fetch recording from Twilio and upload to Supabase
 */
async function fetchAndUploadRecording(
  callSid: string,
  recordingUrl: string,
  callLogId?: string
): Promise<void> {
  try {
    logger.info('Fetching recording from Twilio', { callSid });

    // Fetch recording from Twilio
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const recordingResponse = await axios.get(recordingUrl, {
      headers: {
        'Authorization': `Basic ${auth}`
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const recordingBuffer = Buffer.from(recordingResponse.data);
    logger.info('Recording fetched', {
      callSid,
      size: recordingBuffer.length
    });

    // Upload to Supabase Storage
    const storagePath = `calls/inbound/${callSid}/${Date.now()}.wav`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(storagePath, recordingBuffer, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (uploadError) {
      logger.error('Failed to upload recording to storage', {
        callSid,
        error: uploadError.message
      });
      return;
    }

    logger.info('Recording uploaded to storage', {
      callSid,
      storagePath
    });

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError) {
      logger.error('Failed to generate signed URL', {
        callSid,
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
        logger.error('Failed to update call_log with recording', {
          callLogId,
          error: updateError.message
        });
      } else {
        logger.info('Recording metadata saved to call_log', {
          callLogId,
          storagePath
        });
      }
    }
  } catch (error: any) {
    logger.error('Recording fetch/upload failed', {
      callSid,
      error: error?.message
    });
  }
}

/**
 * Schedule Twilio call poller to run every 30 seconds
 */
export function scheduleTwilioCallPoller(): void {
  logger.info('Scheduling Twilio call poller (every 30 seconds)');

  // Run immediately
  pollTwilioCalls().catch((error) => {
    logger.error('Initial poll failed', { error: error?.message });
  });

  // Schedule recurring polls
  setInterval(() => {
    pollTwilioCalls().catch((error) => {
      logger.error('Poll failed', { error: error?.message });
    });
  }, 30 * 1000); // 30 seconds

  logger.info('Twilio call poller scheduled');
}
