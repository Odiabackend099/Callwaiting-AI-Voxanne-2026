/**
 * Twilio Service
 * Handles SMS and WhatsApp messaging via Twilio
 * Supports multi-tenant credential injection
 */

import twilio from 'twilio';

// Interface for dynamic credentials
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  whatsappNumber?: string;
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
    // Add status callback for real delivery tracking
    // Note: Callbacks need a publicly accessible URL
    const statusCallbackUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/webhooks/sms-status`
      : undefined;

    const message = await client.messages.create({
      body: options.message,
      from: fromNumber,
      to: options.to,
      ...(statusCallbackUrl && {
        statusCallback: statusCallbackUrl,
        statusCallbackMethod: 'POST'
      })
    });

    console.log(`[Twilio SMS] Message sent to ${options.to}`);
    console.log(`[Twilio SMS] SID: ${message.sid}`);

    return {
      success: true,
      message_sid: message.sid
    };
  } catch (error: any) {
    console.error('[Twilio SMS] Error sending SMS:', error);

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

    const message = await client.messages.create({
      body: options.message,
      from: fromNumber,
      to: toNumber
    });

    console.log(`[Twilio WhatsApp] Message sent to ${options.to}`);
    console.log(`[Twilio WhatsApp] SID: ${message.sid}`);

    return {
      success: true,
      message_sid: message.sid
    };
  } catch (error: any) {
    console.error('[Twilio WhatsApp] Error sending WhatsApp:', error);

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
