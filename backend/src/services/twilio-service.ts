/**
 * Twilio Service
 * Handles SMS and WhatsApp messaging via Twilio
 * Supports multi-tenant credential injection
 *
 * 2026 Update: Circuit breaker pattern via safeCall for resilience
 */

import twilio from 'twilio';
import { safeCall } from './safe-call';

// Interface for dynamic credentials
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  whatsappNumber?: string;
  messagingServiceSid?: string; // For international delivery
  senderId?: string; // Alphanumeric Sender ID (e.g., "VOXANNE")
}

// Basic message options
interface SendSmsOptions {
  to: string;
  message: string;
  from?: string; // Optional override
}

interface SendWhatsAppOptions {
  to: string;
  message: string;
}

interface TwilioResult {
  success: boolean;
  message_sid?: string;
  error?: string;
}

// Type for Twilio message response
interface TwilioMessageResponse {
  sid: string;
  status: string;
  errorCode?: number;
  errorMessage?: string;
}

export type { TwilioResult };

/**
 * Get a Twilio client instance
 * REQUIRES credentials - no fallback to environment variables
 * This ensures BYOC (Bring Your Own Credentials) model
 */
function getClient(creds: TwilioCredentials): any {
  if (!creds || !creds.accountSid || !creds.authToken) {
    throw new Error('Twilio credentials required: accountSid and authToken must be provided');
  }
  return twilio(creds.accountSid, creds.authToken);
}

/**
 * Get sender number from credentials
 * REQUIRES credentials - no fallback to environment variables
 */
function getFromNumber(creds: TwilioCredentials): string {
  if (!creds || !creds.phoneNumber) {
    throw new Error('Twilio credentials required: phoneNumber must be provided');
  }
  return creds.phoneNumber;
}

/**
 * Get WhatsApp number from credentials or use default Twilio sandbox
 */
function getWhatsappNumber(creds: TwilioCredentials): string {
  if (creds?.whatsappNumber) {
    return creds.whatsappNumber;
  }
  // Use Twilio's sandbox number as fallback (not a process.env)
  return 'whatsapp:+14155552671';
}

/**
 * Send SMS via Twilio
 * REQUIRES credentials - will throw error if not provided
 */
export async function sendSmsTwilio(
  options: SendSmsOptions,
  credentials: TwilioCredentials
): Promise<TwilioResult> {
  if (!credentials) {
    throw new Error('Twilio credentials are required to send SMS');
  }

  let client: any;
  let fromNumber: string;

  try {
    client = getClient(credentials);
    fromNumber = options.from || getFromNumber(credentials);
  } catch (error: any) {
    console.error('[Twilio SMS] Invalid credentials:', error.message);
    throw error;
  }

  try {
    // FIRE-AND-FORGET STRATEGY: Only use statusCallback if BACKEND_URL is valid and not ngrok
    // This prevents 11200 errors from broken webhook URLs
    const backendUrl = process.env.BACKEND_URL;
    const isValidBackendUrl = backendUrl &&
      !backendUrl.includes('ngrok') &&
      !backendUrl.includes('localhost') &&
      backendUrl.startsWith('http');

    const statusCallbackUrl = isValidBackendUrl
      ? `${backendUrl}/api/webhooks/sms-status`
      : undefined;

    if (!statusCallbackUrl) {
      console.log('[Twilio SMS] ⚠️ StatusCallback disabled (no valid BACKEND_URL). Using Fire-and-Forget mode.');
    }

    // SMART SENDER SELECTION: Prioritize Messaging Service for international numbers
    const isInternational = !options.to.startsWith('+1');
    const messageParams: any = {
      body: options.message,
      to: options.to,
      ...(statusCallbackUrl && {
        statusCallback: statusCallbackUrl,
        statusCallbackMethod: 'POST'
      })
    };

    // Priority 1: Use Messaging Service SID if available (best for international)
    if (credentials.messagingServiceSid) {
      messageParams.messagingServiceSid = credentials.messagingServiceSid;
      console.log('[Twilio SMS] Using Messaging Service SID for delivery');
    }
    // Priority 2: Use Alphanumeric Sender ID for international (if supported)
    else if (isInternational && credentials.senderId) {
      messageParams.from = credentials.senderId;
      console.log(`[Twilio SMS] Using Alphanumeric Sender ID: ${credentials.senderId} for international delivery`);
    }
    // Priority 3: Fallback to phone number
    else {
      messageParams.from = options.from || getFromNumber(credentials);
      if (isInternational) {
        console.log('[Twilio SMS] ⚠️ Using US Long Code for international SMS. May be filtered by carrier.');
        console.log('[Twilio SMS] 💡 Consider adding messagingServiceSid or senderId to integrations table.');
      }
    }

    // Use safeCall for circuit breaker protection
    const result = await safeCall(
      'twilio_sms',
      () => client.messages.create(messageParams),
      { retries: 3, backoffMs: 1000, timeoutMs: 15000 }
    );

    if (!result.success) {
      console.error('[Twilio SMS] Error sending SMS:', result.error?.message || result.userMessage);
      if (result.circuitOpen) {
        console.error('[Twilio SMS] Circuit breaker is OPEN - Twilio service temporarily unavailable');
      }
      return {
        success: false,
        error: result.userMessage || result.error?.message || 'Failed to send SMS'
      };
    }

    const message = result.data as TwilioMessageResponse;
    console.log(`[Twilio SMS] Message sent to ${options.to}`);
    console.log(`[Twilio SMS] SID: ${message.sid}`);
    console.log(`[Twilio SMS] Initial Status: ${message.status}`);
    console.log(`[Twilio SMS] Error Code: ${message.errorCode || 'none'}`);
    console.log(`[Twilio SMS] Error Message: ${message.errorMessage || 'none'}`);

    // CRITICAL: Log if message is queued but may fail delivery
    if (message.status === 'queued' || message.status === 'accepted') {
      console.log(`[Twilio SMS] Message ${message.sid} accepted by Twilio but delivery not yet confirmed`);
      console.log(`[Twilio SMS] Check Twilio Console for delivery status: https://console.twilio.com/us1/monitor/logs/sms`);
    }

    if (message.status === 'failed' || message.status === 'undelivered') {
      console.error(`[Twilio SMS] Message ${message.sid} failed immediately`);
      console.error(`[Twilio SMS] Error Code: ${message.errorCode}`);
      console.error(`[Twilio SMS] Error Message: ${message.errorMessage}`);
    }

    return {
      success: true,
      message_sid: message.sid
    };
  } catch (error: any) {
    console.error('[Twilio SMS] Unexpected error sending SMS:', error);

    return {
      success: false,
      error: error.message || 'Failed to send SMS'
    };
  }
}

/**
 * Send WhatsApp message via Twilio
 * REQUIRES credentials - will throw error if not provided
 */
export async function sendWhatsAppTwilio(
  options: SendWhatsAppOptions,
  credentials: TwilioCredentials
): Promise<TwilioResult> {
  if (!credentials) {
    throw new Error('Twilio credentials are required to send WhatsApp message');
  }

  let client: any;

  try {
    client = getClient(credentials);
  } catch (error: any) {
    console.error('[Twilio WhatsApp] Invalid credentials:', error.message);
    throw error;
  }

  const fromNumber = getWhatsappNumber(credentials);

  try {
    // Format WhatsApp numbers properly
    const toNumber = options.to.startsWith('whatsapp:')
      ? options.to
      : `whatsapp:${options.to}`;

    // Use safeCall for circuit breaker protection
    const result = await safeCall(
      'twilio_whatsapp',
      () => client.messages.create({
        body: options.message,
        from: fromNumber,
        to: toNumber
      }),
      { retries: 3, backoffMs: 1000, timeoutMs: 15000 }
    );

    if (!result.success) {
      console.error('[Twilio WhatsApp] Error sending WhatsApp:', result.error?.message || result.userMessage);
      if (result.circuitOpen) {
        console.error('[Twilio WhatsApp] Circuit breaker is OPEN - Twilio service temporarily unavailable');
      }
      return {
        success: false,
        error: result.userMessage || result.error?.message || 'Failed to send WhatsApp message'
      };
    }

    const message = result.data as TwilioMessageResponse;
    console.log(`[Twilio WhatsApp] Message sent to ${options.to}`);
    console.log(`[Twilio WhatsApp] SID: ${message.sid}`);

    return {
      success: true,
      message_sid: message.sid
    };
  } catch (error: any) {
    console.error('[Twilio WhatsApp] Unexpected error sending WhatsApp:', error);

    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message'
    };
  }
}

/**
 * Send templated demo SMS
 */
export async function sendDemoSmSTemplate(
  to: string,
  clinic_name: string,
  demo_url: string,
  credentials?: TwilioCredentials
): Promise<TwilioResult> {
  const message = `Hi! 👋 Watch your Call Waiting AI AI demo for ${clinic_name}: ${demo_url} - See how we answer 100% of calls 24/7! 📞✨`;

  return sendSmsTwilio({
    to,
    message
  }, credentials);
}

/**
 * Send templated demo WhatsApp message
 */
export async function sendDemoWhatsAppTemplate(
  to: string,
  clinic_name: string,
  demo_url: string,
  credentials?: TwilioCredentials
): Promise<TwilioResult> {
  const message = `Hi! 👋\n\nHere's your personalized Call Waiting AI AI demo for ${clinic_name}:\n\n${demo_url}\n\nSee how we answer 100% of calls 24/7! 📞✨\n\nQuestions? Just reply here!`;

  return sendWhatsAppTwilio({
    to,
    message
  }, credentials);
}

export default {
  sendSmsTwilio,
  sendWhatsAppTwilio,
  sendDemoSmSTemplate,
  sendDemoWhatsAppTemplate
};
