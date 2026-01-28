import { Job } from 'bullmq';
import { log } from './logger';
import { supabase } from '../services/supabase-client';
import {
  processCallStarted,
  processCallEnded,
  processTranscript,
  processEndOfCallReport,
  processFunctionCall
} from './vapi-webhook-handlers';

export async function processWebhookJob(job: Job): Promise<any> {
  const data = job.data;
  const { eventType, event, orgId, assistantId } = data;

  log.info('WebhookProcessor', `Processing ${eventType} for org ${orgId}`);

  try {
    switch (eventType) {
      case 'call.started':
        await processCallStarted(event, orgId, assistantId);
        break;
      case 'call.ended':
        await processCallEnded(event, orgId);
        break;
      case 'call.transcribed':
        await processTranscript(event, orgId);
        break;
      case 'end-of-call-report':
        await processEndOfCallReport(event, orgId);
        break;
      case 'function-call':
        await processFunctionCall(event, orgId);
        break;
      default:
        log.warn('WebhookProcessor', `Unknown event type: ${eventType}`);
    }

    // Update delivery log to completed
    await supabase
      .from('webhook_delivery_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        attempts: job.attemptsMade + 1
      })
      .eq('job_id', job.id);

    return { success: true };
  } catch (error) {
    log.error('WebhookProcessor', `Failed to process ${eventType}`, {
      error: (error as Error).message,
      jobId: job.id
    });

    // Update delivery log with error
    await supabase
      .from('webhook_delivery_log')
      .update({
        status: job.attemptsMade === job.opts.attempts ? 'dead_letter' : 'failed',
        last_attempt_at: new Date().toISOString(),
        attempts: job.attemptsMade + 1,
        error_message: (error as Error).message
      })
      .eq('job_id', job.id);

    throw error;
  }
}
