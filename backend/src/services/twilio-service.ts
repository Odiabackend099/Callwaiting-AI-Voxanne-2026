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
 * Uses provided credentials or falls back to environment variables
 */
function getClient(creds?: TwilioCredentials) {
  if (creds) {
    return twilio(creds.accountSid, creds.authToken);
  }

  // Fallback to env vars (Legacy/Dev mode)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken) {
    return twilio(accountSid, authToken);
  }

  return null;
}

/**
 * Get sender number
 */
function getFromNumber(creds?: TwilioCredentials): string | undefined {
  if (creds) return creds.phoneNumber;
  return process.env.TWILIO_PHONE_NUMBER;
}

function getWhatsappNumber(creds?: TwilioCredentials): string {
  if (creds?.whatsappNumber) return creds.whatsappNumber;
  return process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155552671';
}

/**
 * Send SMS via Twilio
 */
export async function sendSmsTwilio(
  options: SendSmsOptions,
  credentials?: TwilioCredentials
): Promise<TwilioResult> {
  const client = getClient(credentials);
  const fromNumber = options.from || getFromNumber(credentials);

  if (!client || !fromNumber) {
    console.error('[Twilio SMS] Missing credentials or phone number');
    return {
      success: false,
      error: 'Twilio not configured'
    };
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
 */
export async function sendWhatsAppTwilio(
  options: SendWhatsAppOptions,
  credentials?: TwilioCredentials
): Promise<TwilioResult> {
  const client = getClient(credentials);
  const fromNumber = getWhatsappNumber(credentials);

  if (!client) {
    return {
      success: false,
      error: 'Twilio not configured'
    };
  }

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
