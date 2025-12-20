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
    logger.info('backend', 'Starting Twilio call poll');

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
            logger.error('backend', 'Failed to create call_log');
            continue;
          }

          callLogId = callLog?.id;
          logger.info('backend', 'Created call_log entry');
        }

        // Fetch recordings if not already uploaded
        if (!existing?.recording_storage_path) {
          try {
            await fetchAndUploadRecordingsForCall(call.sid, callLogId);
          } catch (recordingError: any) {
            logger.warn('backend', 'Failed to fetch/upload recordings (non-blocking)');
          }
        }
      } catch (callError: any) {
        logger.error('backend', 'Error processing call');
      }
    }

    logger.info('backend', 'Twilio call poll completed');
  } catch (error: any) {
    logger.error('backend', 'Twilio call poll failed');
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
    logger.info('backend', 'Fetching recordings for call');

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
      logger.warn('backend', 'No recordings found for call');
      return;
    }

    // Process the first recording
    const recording = recordings[0];
    const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '')}.wav`;

    await fetchAndUploadRecording(callSid, recordingUrl, callLogId);
  } catch (error: any) {
    logger.warn('backend', 'Failed to fetch recordings list');
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
    logger.info('backend', 'Fetching recording from Twilio');

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
    logger.info('backend', 'Recording fetched');

    // Upload to Supabase Storage
    const storagePath = `calls/inbound/${callSid}/${Date.now()}.wav`;
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
        logger.error('backend', 'Failed to update call_log with recording');
      } else {
        logger.info('backend', 'Recording metadata saved to call_log');
      }
    }
  } catch (error: any) {
    logger.error('backend', 'Recording fetch/upload failed');
  }
}

/**
 * Schedule Twilio call poller to run every 30 seconds
 */
export function scheduleTwilioCallPoller(): void {
  logger.info('backend', 'Scheduling Twilio call poller (every 30 seconds)');

  // Run immediately
  pollTwilioCalls().catch((error) => {
    logger.error('backend', 'Initial poll failed');
  });

  // Schedule recurring polls
  setInterval(() => {
    pollTwilioCalls().catch((error) => {
      logger.error('backend', 'Poll failed');
    });
  }, 30 * 1000); // 30 seconds

  logger.info('backend', 'Twilio call poller scheduled');
}
