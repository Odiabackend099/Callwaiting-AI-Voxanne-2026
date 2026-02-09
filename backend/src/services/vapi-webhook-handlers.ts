import { log } from './logger';
import { supabase } from '../services/supabase-client';

export async function processCallStarted(event: any, orgId: string, assistantId: string): Promise<void> {
  log.info('VapiWebhookHandlers', `Processing call started for org ${orgId}`);
  
  // TODO: Implement call started logic
  // - Create call record in database
  // - Update call status
  // - Send notifications if needed
  
  try {
    // Example implementation
    await supabase
      .from('calls')
      .insert({
        id: event.call?.id,
        org_id: orgId,
        assistant_id: assistantId,
        status: 'started',
        started_at: event.call?.startedAt,
        metadata: event
      });
      
    log.info('VapiWebhookHandlers', `Call ${event.call?.id} started successfully`);
  } catch (error) {
    log.error('VapiWebhookHandlers', `Failed to process call started: ${error}`);
    throw error;
  }
}

export async function processCallEnded(event: any, orgId: string): Promise<void> {
  log.info('VapiWebhookHandlers', `Processing call ended for org ${orgId}`);
  
  // TODO: Implement call ended logic
  // - Update call record with end time
  // - Calculate duration
  // - Process final transcript
  // - Update analytics
  
  try {
    // Example implementation
    await supabase
      .from('calls')
      .update({
        status: 'ended',
        ended_at: event.call?.endedAt,
        duration: event.call?.duration,
        metadata: event
      })
      .eq('id', event.call?.id)
      .eq('org_id', orgId);
      
    log.info('VapiWebhookHandlers', `Call ${event.call?.id} ended successfully`);
  } catch (error) {
    log.error('VapiWebhookHandlers', `Failed to process call ended: ${error}`);
    throw error;
  }
}

export async function processTranscript(event: any, orgId: string): Promise<void> {
  log.info('VapiWebhookHandlers', `Processing transcript for org ${orgId}`);
  
  // TODO: Implement transcript processing
  // - Store transcript segments
  // - Update call record with transcript
  // - Trigger sentiment analysis if needed
  
  try {
    // Example implementation
    await supabase
      .from('call_transcripts')
      .insert({
        call_id: event.call?.id,
        org_id: orgId,
        transcript: event.transcript,
        timestamp: event.timestamp,
        metadata: event
      });
      
    log.info('VapiWebhookHandlers', `Transcript for call ${event.call?.id} processed successfully`);
  } catch (error) {
    log.error('VapiWebhookHandlers', `Failed to process transcript: ${error}`);
    throw error;
  }
}

export async function processEndOfCallReport(event: any, orgId: string): Promise<void> {
  log.info('VapiWebhookHandlers', `Processing end-of-call report for org ${orgId}`);

  try {
    const callId = event.call?.id;
    if (!callId) {
      log.error('VapiWebhookHandlers', 'Missing call ID in end-of-call report');
      return;
    }

    // Extract call metadata
    const phoneNumber = event.call?.customer?.number || null;
    const callerName = event.call?.customer?.name || null;
    const startedAt = event.call?.startedAt ? new Date(event.call.startedAt) : new Date();
    const endedAt = event.call?.endedAt ? new Date(event.call.endedAt) : new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    const recordingUrl = event.call?.artifact?.recordingUrl || null;
    const transcript = event.transcript || event.analysis?.transcript || '';

    // Extract sentiment analysis if available
    const sentimentLabel = event.analysis?.sentiment?.label || 'neutral';
    const sentimentScore = event.analysis?.sentiment?.score || 0.5;
    const sentimentSummary = event.analysis?.sentiment?.summary || '';
    const sentimentUrgency = event.analysis?.sentiment?.urgency || 'normal';

    // Determine call status based on end reason
    let status = 'completed';
    if (event.call?.endedReason === 'max-duration-reached') {
      status = 'completed';
    } else if (event.call?.endedReason === 'transfer') {
      status = 'transferred';
    } else if (event.call?.endedReason === 'customer-hangup' || event.call?.endedReason === 'assistant-hangup') {
      status = 'completed';
    }

    // Legacy call_logs write — disabled by default.
    // The canonical write now happens in vapi-webhook.ts → calls table.
    // Set ENABLE_LEGACY_CALL_LOGS=true to re-enable for rollback safety.
    if (process.env.ENABLE_LEGACY_CALL_LOGS === 'true') {
      const { data: callLogData, error: callLogError } = await supabase
        .from('call_logs')
        .upsert({
          id: callId,
          org_id: orgId,
          vapi_call_id: callId,
          phone_number: phoneNumber,
          caller_name: callerName,
          duration_seconds: durationSeconds,
          status: status,
          transcript: transcript,
          recording_storage_path: recordingUrl,
          sentiment_label: sentimentLabel,
          sentiment_score: sentimentScore,
          sentiment_summary: sentimentSummary,
          sentiment_urgency: sentimentUrgency,
          call_type: 'inbound',
          created_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          metadata: {
            vapi_end_reason: event.call?.endedReason,
            vapi_cost: event.call?.cost,
            vapi_customer: event.call?.customer,
            analysis: event.analysis
          }
        }, {
          onConflict: 'vapi_call_id'
        });

      if (callLogError) {
        log.error('VapiWebhookHandlers', `Failed to insert call_logs: ${callLogError.message}`, { callId, orgId });
      } else {
        log.info('VapiWebhookHandlers', `Call log created/updated for call ${callId}`);
      }
    }

    // Also store detailed report in call_reports table if it exists
    try {
      await supabase
        .from('call_reports')
        .upsert({
          call_id: callId,
          org_id: orgId,
          summary: event.analysis?.summary || transcript.substring(0, 500),
          analysis: event.analysis || {},
          cost: event.call?.cost || 0,
          metadata: event
        }, {
          onConflict: 'call_id'
        })
        .catch(() => {
          // Table might not exist, continue anyway
        });
    } catch (reportError) {
      log.warn('VapiWebhookHandlers', 'call_reports table may not exist, skipping detailed report');
    }

    log.info('VapiWebhookHandlers', `End-of-call report for call ${callId} processed successfully`);
  } catch (error) {
    log.error('VapiWebhookHandlers', `Failed to process end-of-call report: ${error}`);
    throw error;
  }
}

export async function processFunctionCall(event: any, orgId: string): Promise<void> {
  log.info('VapiWebhookHandlers', `Processing function call for org ${orgId}`);
  
  // TODO: Implement function call processing
  // - Execute the function
  // - Store function call results
  // - Handle errors appropriately
  
  try {
    // Example implementation
    await supabase
      .from('function_calls')
      .insert({
        call_id: event.call?.id,
        org_id: orgId,
        function_name: event.function,
        parameters: event.parameters,
        result: event.result,
        timestamp: event.timestamp,
        metadata: event
      });
      
    log.info('VapiWebhookHandlers', `Function call ${event.function} for call ${event.call?.id} processed successfully`);
  } catch (error) {
    log.error('VapiWebhookHandlers', `Failed to process function call: ${error}`);
    throw error;
  }
}
