/**
 * SMS Notifications Service
 * Handles Twilio SMS notifications for leads, appointments, and reminders
 * Uses environment-configured Twilio credentials
 */

import { log } from './logger';

// Twilio client (lazy-loaded to avoid initialization errors if not configured)
let twilioClient: any = null;

/**
 * Initialize Twilio client
 */
function getTwilioClient() {
  if (!twilioClient) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
      }

      // Import Twilio dynamically
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      twilioClient = twilio(accountSid, authToken);
    } catch (error: any) {
      log.error('SMSNotifications', 'Failed to initialize Twilio client', { error: error?.message });
      throw error;
    }
  }

  return twilioClient;
}

/**
 * Get status callback URL for SMS delivery tracking
 * 
 * Note: Twilio requires a publicly accessible URL (not localhost)
 * For local development, use ngrok or skip status callbacks
 */
function getStatusCallbackUrl(): string | undefined {
  const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
  if (!backendUrl) {
    return undefined;
  }
  
  // Twilio cannot reach localhost URLs - skip callback if localhost
  if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    // In production, this should never happen
    // For local dev, status callbacks won't work (use ngrok for testing)
    return undefined;
  }
  
  // Ensure URL doesn't have trailing slash and uses HTTPS
  const baseUrl = backendUrl.replace(/\/$/, '');
  // Ensure HTTPS for production (Twilio requires HTTPS for callbacks)
  const url = baseUrl.startsWith('http://') && baseUrl.includes('localhost') === false
    ? baseUrl.replace('http://', 'https://')
    : baseUrl;
    
  return `${url}/api/webhooks/sms-status`;
}

/**
 * Create message options with status callback
 */
function createMessageOptions(options: {
  body: string;
  from: string;
  to: string;
}): any {
  const statusCallbackUrl = getStatusCallbackUrl();
  
  return {
    body: options.body,
    from: options.from,
    to: options.to,
    ...(statusCallbackUrl && {
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST'
    })
  };
}

/**
 * Validate E.164 phone number format
 */
function validatePhone(phone: string): boolean {
  // E.164 format: +[country code][area code][phone number]
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phone.replace(/\D/g, ''));
}

/**
 * Format phone to E.164 if needed (assumes US/EU country codes)
 */
function formatPhoneToE164(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If starts with +, assume already formatted
  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }

  // If 10 digits, assume US number
  if (digits.length === 10) {
    return '+1' + digits;
  }

  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits[0] === '1') {
    return '+' + digits;
  }

  // For other lengths, try to detect country code
  // Common pattern: assume + and add reasonable country code
  if (digits.length > 10) {
    return '+' + digits;
  }

  throw new Error(`Invalid phone number format: ${phone}`);
}

interface LeadData {
  name: string;
  phone: string;
  service: string;
  summary: string;
}

interface AppointmentData {
  serviceType: string;
  scheduledAt: Date;
  confirmationUrl?: string;
}

/**
 * Send SMS to clinic manager about a hot lead
 * @param clinicManagerPhone - Clinic manager's phone number
 * @param leadData - Lead information to include in SMS
 * @returns Message ID for tracking/logging
 * @throws Error if phone invalid or Twilio fails
 */
export async function sendHotLeadSMS(
  clinicManagerPhone: string,
  leadData: LeadData
): Promise<string> {
  try {
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!fromPhone) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    // Format and validate phone
    if (!validatePhone(clinicManagerPhone)) {
      throw new Error(`Invalid phone number: ${clinicManagerPhone}`);
    }

    const toPhone = formatPhoneToE164(clinicManagerPhone);

    // Build message
    const message = `🔥 HOT LEAD ALERT!\n\n${leadData.name}\n📞 ${leadData.phone}\n💄 Service: ${leadData.service}\n\nSummary: ${leadData.summary.substring(0, 80)}...`;

    const client = getTwilioClient();

    const result = await client.messages.create(
      createMessageOptions({
      body: message,
      from: fromPhone,
      to: toPhone
      })
    );

    log.info('SMSNotifications', 'Hot lead SMS sent', {
      messageId: result.sid,
      to: toPhone,
      leadName: leadData.name,
      service: leadData.service
    });

    return result.sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send hot lead SMS', {
      phone: clinicManagerPhone,
      error: error?.message || error?.toString()
    });
    throw error;
  }
}

/**
 * Send appointment confirmation SMS to customer
 * @param customerPhone - Customer's phone number
 * @param appointmentData - Appointment details
 * @returns Message ID for tracking
 * @throws Error if phone invalid or Twilio fails
 */
export async function sendAppointmentConfirmationSMS(
  customerPhone: string,
  appointmentData: AppointmentData
): Promise<string> {
  try {
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const clinicName = process.env.CLINIC_NAME || 'Our Clinic';

    if (!fromPhone) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    if (!validatePhone(customerPhone)) {
      throw new Error(`Invalid phone number: ${customerPhone}`);
    }

    const toPhone = formatPhoneToE164(customerPhone);
    const appointmentTime = appointmentData.scheduledAt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      meridiem: 'short'
    });

    let message = `📅 Appointment Confirmed!\n\n${clinicName}\n${appointmentData.serviceType}\nWhen: ${appointmentTime}`;

    if (appointmentData.confirmationUrl) {
      message += `\n\nDetails: ${appointmentData.confirmationUrl}`;
    }

    message += '\n\nReply STOP to unsubscribe';

    const client = getTwilioClient();

    const result = await client.messages.create(
      createMessageOptions({
      body: message,
      from: fromPhone,
      to: toPhone
      })
    );

    log.info('SMSNotifications', 'Appointment confirmation SMS sent', {
      messageId: result.sid,
      to: toPhone,
      service: appointmentData.serviceType
    });

    return result.sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send appointment confirmation SMS', {
      phone: customerPhone,
      error: error?.message || error?.toString()
    });
    throw error;
  }
}

/**
 * Send appointment reminder SMS to customer
 * @param customerPhone - Customer's phone number
 * @param appointmentData - Appointment details
 * @returns Message ID for tracking
 * @throws Error if phone invalid or Twilio fails
 */
export async function sendAppointmentReminderSMS(
  customerPhone: string,
  appointmentData: AppointmentData
): Promise<string> {
  try {
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const clinicName = process.env.CLINIC_NAME || 'Our Clinic';

    if (!fromPhone) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    if (!validatePhone(customerPhone)) {
      throw new Error(`Invalid phone number: ${customerPhone}`);
    }

    const toPhone = formatPhoneToE164(customerPhone);

    // Calculate time until appointment
    const now = new Date();
    const timeUntil = appointmentData.scheduledAt.getTime() - now.getTime();
    const hoursUntil = Math.round(timeUntil / (1000 * 60 * 60));

    const appointmentTime = appointmentData.scheduledAt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      meridiem: 'short'
    });

    const message = `⏰ Reminder: Your appointment is in ${hoursUntil} hours!\n\n${clinicName}\n${appointmentData.serviceType}\nTime: ${appointmentTime}\n\nSee you soon!`;

    const client = getTwilioClient();

    const result = await client.messages.create(
      createMessageOptions({
      body: message,
      from: fromPhone,
      to: toPhone
      })
    );

    log.info('SMSNotifications', 'Appointment reminder SMS sent', {
      messageId: result.sid,
      to: toPhone,
      hoursUntil
    });

    return result.sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send appointment reminder SMS', {
      phone: customerPhone,
      error: error?.message || error?.toString()
    });
    throw error;
  }
}

/**
 * Send generic SMS message
 * @param toPhone - Recipient phone number
 * @param messageBody - Message text (max 160 characters recommended)
 * @returns Message ID
 * @throws Error if phone invalid or Twilio fails
 */
export async function sendGenericSMS(toPhone: string, messageBody: string): Promise<string> {
  try {
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!fromPhone) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    if (!validatePhone(toPhone)) {
      throw new Error(`Invalid phone number: ${toPhone}`);
    }

    if (messageBody.length > 160) {
      log.warn('SMSNotifications', 'Message exceeds SMS limit', {
        length: messageBody.length
      });
    }

    const formattedPhone = formatPhoneToE164(toPhone);
    const client = getTwilioClient();

    const result = await client.messages.create({
      body: messageBody,
      from: fromPhone,
      to: formattedPhone
    });

    log.info('SMSNotifications', 'Generic SMS sent', {
      messageId: result.sid,
      to: formattedPhone
    });

    return result.sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send generic SMS', {
      phone: toPhone,
      error: error?.message || error?.toString()
    });
    throw error;
  }
}
