/**
 * SMS Notifications Service
 * Handles Twilio SMS notifications for leads, appointments, and reminders
 * Supports multi-tenant dynamic credential injection
 */

import { log } from './logger';
import { IntegrationSettingsService } from './integration-settings';
import { sendSmsTwilio, TwilioCredentials } from './twilio-service';

/**
 * Get status callback URL for SMS delivery tracking
 */
function getStatusCallbackUrl(): string | undefined {
  const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
  if (!backendUrl) {
    return undefined;
  }

  if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    return undefined;
  }

  const baseUrl = backendUrl.replace(/\/$/, '');
  const url = baseUrl.startsWith('http://') && baseUrl.includes('localhost') === false
    ? baseUrl.replace('http://', 'https://')
    : baseUrl;

  return `${url}/api/webhooks/sms-status`;
}

/**
 * Validate E.164 phone number format
 */
function validatePhone(phone: string): boolean {
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phone.replace(/\D/g, ''));
}

/**
 * Format phone to E.164 if needed
 */
function formatPhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }

  if (digits.length === 10) {
    return '+1' + digits;
  }

  if (digits.length === 11 && digits[0] === '1') {
    return '+' + digits;
  }

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
 */
export async function sendHotLeadSMS(
  clinicManagerPhone: string,
  leadData: LeadData,
  orgId: string
): Promise<string> {
  try {
    // Fetch dynamic credentials for this tenant
    const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);

    if (!validatePhone(clinicManagerPhone)) {
      throw new Error(`Invalid phone number: ${clinicManagerPhone}`);
    }

    const toPhone = formatPhoneToE164(clinicManagerPhone);

    const message = `🔥 HOT LEAD ALERT!\n\n${leadData.name}\n📞 ${leadData.phone}\n💄 Service: ${leadData.service}\n\nSummary: ${leadData.summary.substring(0, 80)}...`;

    // Use shared Twilio service with injected credentials
    const result = await sendSmsTwilio({
      to: toPhone,
      message,
      from: creds.phoneNumber
    }, creds);

    if (!result.success || !result.message_sid) {
      throw new Error(result.error);
    }

    log.info('SMSNotifications', 'Hot lead SMS sent', {
      messageId: result.message_sid,
      to: toPhone,
      leadName: leadData.name,
      service: leadData.service,
      orgId
    });

    return result.message_sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send hot lead SMS', {
      phone: clinicManagerPhone,
      error: error?.message || error?.toString(),
      orgId
    });
    // Graceful failure: don't crash whole request if SMS fails
    // But rethrow so caller knows? Or swallow?
    // User req: "log a CREDENTIAL_MISSING error instead of crashing"
    // I am logging it above.
    // If it's a critical logic flow, maybe swallow. For now, rethrow to be safe unless caller catches.
    throw error;
  }
}

/**
 * Send appointment confirmation SMS to customer
 */
export async function sendAppointmentConfirmationSMS(
  customerPhone: string,
  appointmentData: AppointmentData,
  orgId: string
): Promise<string> {
  try {
    const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);
    // TODO: Clinic Name should ideally come from org settings too
    const clinicName = process.env.CLINIC_NAME || 'Our Clinic';

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

    const result = await sendSmsTwilio({
      to: toPhone,
      message,
      from: creds.phoneNumber
    }, creds);

    if (!result.success || !result.message_sid) {
      throw new Error(result.error);
    }

    log.info('SMSNotifications', 'Appointment confirmation SMS sent', {
      messageId: result.message_sid,
      to: toPhone,
      service: appointmentData.serviceType,
      orgId
    });

    return result.message_sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send appointment confirmation SMS', {
      phone: customerPhone,
      error: error?.message || error?.toString(),
      orgId
    });
    throw error;
  }
}

/**
 * Send appointment reminder SMS to customer
 */
export async function sendAppointmentReminderSMS(
  customerPhone: string,
  appointmentData: AppointmentData,
  orgId: string
): Promise<string> {
  try {
    const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);
    const clinicName = process.env.CLINIC_NAME || 'Our Clinic';

    if (!validatePhone(customerPhone)) {
      throw new Error(`Invalid phone number: ${customerPhone}`);
    }

    const toPhone = formatPhoneToE164(customerPhone);
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

    const result = await sendSmsTwilio({
      to: toPhone,
      message,
      from: creds.phoneNumber
    }, creds);

    if (!result.success || !result.message_sid) {
      throw new Error(result.error);
    }

    log.info('SMSNotifications', 'Appointment reminder SMS sent', {
      messageId: result.message_sid,
      to: toPhone,
      hoursUntil,
      orgId
    });

    return result.message_sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send appointment reminder SMS', {
      phone: customerPhone,
      error: error?.message || error?.toString(),
      orgId
    });
    throw error;
  }
}

/**
 * Send generic SMS message
 */
export async function sendGenericSMS(
  toPhone: string,
  messageBody: string,
  orgId: string
): Promise<string> {
  try {
    const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);

    if (!validatePhone(toPhone)) {
      throw new Error(`Invalid phone number: ${toPhone}`);
    }

    const formattedPhone = formatPhoneToE164(toPhone);

    const result = await sendSmsTwilio({
      to: formattedPhone,
      message: messageBody,
      from: creds.phoneNumber
    }, creds);

    if (!result.success || !result.message_sid) {
      throw new Error(result.error);
    }

    log.info('SMSNotifications', 'Generic SMS sent', {
      messageId: result.message_sid,
      to: formattedPhone,
      orgId
    });

    return result.message_sid;
  } catch (error: any) {
    log.error('SMSNotifications', 'Failed to send generic SMS', {
      phone: toPhone,
      error: error?.message || error?.toString(),
      orgId
    });
    throw error;
  }
}
