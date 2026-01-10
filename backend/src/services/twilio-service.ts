/**
 * Twilio Service
 * Handles SMS and WhatsApp messaging via Twilio
 */

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155552671'; // Twilio sandbox by default

if (!accountSid || !authToken || !fromPhoneNumber) {
  console.warn(
    '[Twilio Service] Missing Twilio credentials. SMS/WhatsApp will not work.'
  );
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

interface SendSmsOptions {
  to: string;
  message: string;
  from?: string;
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
 * Send SMS via Twilio
 */
export async function sendSmsTwilio(
  options: SendSmsOptions
): Promise<TwilioResult> {
  if (!client) {
    return {
      success: false,
      error: 'Twilio not configured'
    };
  }

  try {
    // Add status callback for real delivery tracking
    const statusCallbackUrl = process.env.BACKEND_URL 
      ? `${process.env.BACKEND_URL}/api/webhooks/sms-status`
      : undefined;

    const message = await client.messages.create({
      body: options.message,
      from: options.from || fromPhoneNumber,
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
  options: SendWhatsAppOptions
): Promise<TwilioResult> {
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
      from: whatsappNumber,
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
  demo_url: string
): Promise<TwilioResult> {
  const message = `Hi! 👋 Watch your Call Waiting AI AI demo for ${clinic_name}: ${demo_url} - See how we answer 100% of calls 24/7! 📞✨`;

  return sendSmsTwilio({
    to,
    message
  });
}

/**
 * Send templated demo WhatsApp message
 */
export async function sendDemoWhatsAppTemplate(
  to: string,
  clinic_name: string,
  demo_url: string
): Promise<TwilioResult> {
  const message = `Hi! 👋\n\nHere's your personalized Call Waiting AI AI demo for ${clinic_name}:\n\n${demo_url}\n\nSee how we answer 100% of calls 24/7! 📞✨\n\nQuestions? Just reply here!`;

  return sendWhatsAppTwilio({
    to,
    message
  });
}

export default {
  sendSmsTwilio,
  sendWhatsAppTwilio,
  sendDemoSmSTemplate,
  sendDemoWhatsAppTemplate
};
