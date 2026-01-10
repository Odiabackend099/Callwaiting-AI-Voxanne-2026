/**
 * SMS Status Webhook
 * 
 * Receives delivery status updates from Twilio for SMS messages.
 * Status "delivered" in Twilio API doesn't mean actual receipt - this webhook
 * provides real delivery status from carriers.
 * 
 * Based on Perplexity research: Use statusCallback to track real delivery status.
 */

import express, { Request, Response } from 'express';
import { log } from '../services/logger';
import { supabase } from '../services/supabase-client';
import { validateRequest } from 'twilio';

const router = express.Router();

/**
 * POST /api/webhooks/sms-status
 * 
 * Twilio sends status updates here for SMS messages.
 * 
 * Twilio POST parameters:
 * - MessageSid: Unique message identifier
 * - MessageStatus: queued | sending | sent | delivered | undelivered | failed
 * - ErrorCode: Error code if status is failed/undelivered (e.g., 30004, 30007)
 * - ErrorMessage: Human-readable error message
 * - To: Recipient phone number
 * - From: Sender phone number
 */
router.post('/sms-status', async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Verify Twilio webhook signature to prevent spoofing
    // Twilio signs all webhook requests with your Auth Token
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (authToken && twilioSignature) {
      // Validate using Twilio's signature validation
      // Note: Twilio sends form-encoded data, so we need to parse it correctly
      const protocol = req.protocol || (req.secure ? 'https' : 'http');
      const host = req.get('host') || 'localhost:3001';
      const url = `${protocol}://${host}${req.originalUrl || req.url}`;
      
      // validateRequest checks the signature against the auth token
      // It handles both form-encoded and JSON bodies
      const isValid = validateRequest(authToken, twilioSignature, url, req.body);
      
      if (!isValid) {
        log.error('SMSStatusWebhook', 'Invalid Twilio signature - possible spoofing attempt', {
          url,
          hasSignature: !!twilioSignature,
          hasAuthToken: !!authToken
        });
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }
    } else {
      // In development, allow bypassing signature check if auth token not set
      // This allows local testing without exposing auth tokens
      if (process.env.NODE_ENV === 'production') {
        log.error('SMSStatusWebhook', 'Missing signature or auth token in production', {
          hasSignature: !!twilioSignature,
          hasAuthToken: !!authToken
        });
        res.status(403).json({ error: 'Authentication required' });
        return;
      } else {
        log.warn('SMSStatusWebhook', 'Skipping signature verification (development mode)', {
          reason: !authToken ? 'No auth token set' : 'No signature header'
        });
      }
    }

    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
      To,
      From
    } = req.body;

    // Validate required fields
    if (!MessageSid || !MessageStatus) {
      log.warn('SMSStatusWebhook', 'Missing required fields', { 
        messageSid: MessageSid ? 'present' : 'missing',
        messageStatus: MessageStatus ? 'present' : 'missing'
      });
      res.status(400).json({ error: 'Missing MessageSid or MessageStatus' });
      return;
    }

    // Mask phone numbers in logs for privacy
    const maskPhone = (phone: string | undefined): string | null => {
      if (!phone) return null;
      if (phone.length <= 4) return '****';
      return `${phone.slice(0, -4)}****`;
    };

    // Log the status update (with masked phone numbers)
    log.info('SMSStatusWebhook', 'Status update received', {
      messageSid: MessageSid,
      status: MessageStatus,
      to: maskPhone(To),
      from: maskPhone(From),
      errorCode: ErrorCode || null,
      errorMessage: ErrorMessage || null
    });

    // Store in database for tracking (optional but recommended)
    try {
      // Try to find existing record by message_sid
      const { data: existing } = await supabase
        .from('sms_message_tracking')
        .select('id')
        .eq('message_sid', MessageSid)
        .maybeSingle();

      const trackingData = {
        message_sid: MessageSid,
        to_phone: To || null,
        from_phone: From || null,
        status: MessageStatus,
        error_code: ErrorCode || null,
        error_message: ErrorMessage || null,
        updated_at: new Date().toISOString()
      };

      // Use UPSERT to handle both insert and update in one query (prevents race conditions)
      const { error: upsertError } = await supabase
        .from('sms_message_tracking')
        .upsert(
          {
            ...trackingData,
            created_at: existing?.id ? undefined : new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'message_sid' }
        );

      if (upsertError) {
        // Table might not exist yet, log but don't fail webhook
        log.warn('SMSStatusWebhook', 'Failed to upsert tracking (table may not exist)', {
          error: upsertError.message,
          messageSid: MessageSid
        });
      }
    } catch (dbError: any) {
      // Don't fail webhook if database tracking fails
      log.warn('SMSStatusWebhook', 'Database tracking error (non-critical)', {
        error: dbError?.message,
        messageSid: MessageSid
      });
    }

    // Handle different status types
    switch (MessageStatus) {
      case 'delivered':
        log.info('SMSStatusWebhook', 'SMS delivered successfully', {
          messageSid: MessageSid,
          to: maskPhone(To)
        });
        // SMS reached the carrier and was delivered to device
        break;

      case 'sent':
        log.info('SMSStatusWebhook', 'SMS sent to carrier', {
          messageSid: MessageSid,
          to: maskPhone(To)
        });
        // SMS sent to carrier but delivery status pending
        break;

      case 'failed':
      case 'undelivered':
        log.error('SMSStatusWebhook', 'SMS delivery failed', {
          messageSid: MessageSid,
          status: MessageStatus,
          errorCode: ErrorCode,
          errorMessage: ErrorMessage,
          to: maskPhone(To)
        });
        // Handle failure - could trigger retry queue, alert, etc.
        break;

      case 'queued':
        log.debug('SMSStatusWebhook', 'SMS queued', {
          messageSid: MessageSid,
          to: To
        });
        break;

      default:
        log.info('SMSStatusWebhook', 'SMS status update', {
          messageSid: MessageSid,
          status: MessageStatus,
          to: maskPhone(To)
        });
    }

    // CRITICAL: Always return 200 to Twilio
    // Twilio will retry webhooks that return non-2xx status codes
    // We don't want infinite retries for our internal errors
    // Log the error and return success to acknowledge receipt
    res.status(200).json({ received: true });

  } catch (error: any) {
    log.error('SMSStatusWebhook', 'Error processing status webhook', {
      error: error?.message,
      stack: error?.stack
    });
    
    // Still return 200 to prevent Twilio retries
    res.status(200).json({ received: true, error: 'Internal processing error' });
  }
});

export default router;
