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
    logger.info('TwilioPoller', 'Starting Twilio call poll');

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
          .select('id')
          .eq('call_sid', call.sid)
          .maybeSingle();

        if (existing) {
          logger.debug('TwilioPoller', 'Call already processed', { callSid: call.sid });
          continue;
        }

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
          logger.error('TwilioPoller', 'Failed to create call_log', {
            callSid: call.sid,
            error: insertError.message
          });
          continue;
        }

        logger.info('TwilioPoller', 'Created call_log entry', {
          callSid: call.sid,
          callLogId: callLog?.id
        });

        // Try to fetch recording from Twilio
        if (call.recording) {
          try {
            await fetchAndUploadRecording(call.sid, call.recording, callLog?.id);
          } catch (recordingError: any) {
            logger.warn('TwilioPoller', 'Failed to fetch/upload recording (non-blocking)', {
              callSid: call.sid,
              error: recordingError?.message
            });
          }
        }
      } catch (callError: any) {
        logger.error('TwilioPoller', 'Error processing call', {
          callSid: call.sid,
          error: callError?.message
        });
      }
    }

    logger.info('TwilioPoller', 'Twilio call poll completed', { processedCount: calls.length });
  } catch (error: any) {
    logger.error('TwilioPoller', 'Twilio call poll failed', {
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
    logger.info('TwilioPoller', 'Fetching recording from Twilio', { callSid });

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
    logger.info('TwilioPoller', 'Recording fetched', {
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
      logger.error('TwilioPoller', 'Failed to upload recording to storage', {
        callSid,
        error: uploadError.message
      });
      return;
    }

    logger.info('TwilioPoller', 'Recording uploaded to storage', {
      callSid,
      storagePath
    });

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError) {
      logger.error('TwilioPoller', 'Failed to generate signed URL', {
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
        logger.error('TwilioPoller', 'Failed to update call_log with recording', {
          callLogId,
          error: updateError.message
        });
      } else {
        logger.info('TwilioPoller', 'Recording metadata saved to call_log', {
          callLogId,
          storagePath
        });
      }
    }
  } catch (error: any) {
    logger.error('TwilioPoller', 'Recording fetch/upload failed', {
      callSid,
      error: error?.message
    });
  }
}

/**
 * Schedule Twilio call poller to run every 30 seconds
 */
export function scheduleTwilioCallPoller(): void {
  logger.info('TwilioPoller', 'Scheduling Twilio call poller (every 30 seconds)');

  // Run immediately
  pollTwilioCalls().catch((error) => {
    logger.error('TwilioPoller', 'Initial poll failed', { error: error?.message });
  });

  // Schedule recurring polls
  setInterval(() => {
    pollTwilioCalls().catch((error) => {
      logger.error('TwilioPoller', 'Poll failed', { error: error?.message });
    });
  }, 30 * 1000); // 30 seconds

  logger.info('TwilioPoller', 'Twilio call poller scheduled');
}
