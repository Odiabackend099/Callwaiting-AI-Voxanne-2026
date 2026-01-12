import { supabase } from './supabase-client';
import { sendSmsTwilio } from './twilio-service';
import { getOrgCredentials } from './credential-manager';
import { log } from './logger';

export interface ConfirmationSMSResult {
  success: boolean;
  messageSent: boolean;
  messageId?: string;
  content?: string;
  error?: string;
}

/**
 * Sends appointment confirmation SMS to patient after OTP verification
 * This is the final step of the atomic booking flow
 * 
 * SUCCESS PATH:
 * 1. reserve_atomic() → holdId
 * 2. send_otp_sms() → code sent
 * 3. verify_otp(holdId, code) → appointmentId
 * 4. send_confirmation_sms(appointmentId) → SMS sent [THIS FUNCTION]
 */
export class BookingConfirmationService {
  /**
   * Sends appointment confirmation SMS with all booking details
   * Called by Vapi tool: /api/vapi/tools/booking/send-confirmation
   * 
   * @param orgId Organization/tenant ID
   * @param appointmentId UUID of confirmed appointment
   * @param contactId UUID of patient contact
   * @param patientPhone Patient's phone number (E.164 format)
   * @returns Confirmation with message ID and SMS content
   */
  static async sendConfirmationSMS(
    orgId: string,
    appointmentId: string,
    contactId: string,
    patientPhone: string
  ): Promise<ConfirmationSMSResult> {
    try {
      // Fetch appointment with contact details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select(
          `
          id,
          scheduled_at,
          status,
          service_type,
          duration_minutes,
          contacts:contact_id (
            name,
            phone
          )
        `
        )
        .eq('id', appointmentId)
        .eq('org_id', orgId)
        .single();

      if (appointmentError || !appointment) {
        log.error('[BookingConfirmation] Failed to fetch appointment:', appointmentError);
        return {
          success: false,
          messageSent: false,
          error: 'Appointment not found',
        };
      }

      // Fetch organization details for SMS
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('name, phone_number')
        .eq('id', orgId)
        .single();

      if (orgError || !org) {
        log.error('[BookingConfirmation] Failed to fetch organization:', orgError);
        return {
          success: false,
          messageSent: false,
          error: 'Organization not found',
        };
      }

      // Format appointment date/time
      const appointmentDate = new Date(appointment.scheduled_at);
      const dateStr = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = appointmentDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      // Build SMS content
      const messageContent = `Your appointment confirmed!\n\n📅 ${dateStr} at ${timeStr}\n💼 ${org.name}\n📞 Call ${org.phone_number} to reschedule\n\nReply STOP to unsubscribe.`;

      // Get Twilio credentials for org
      const { accountSid, authToken, twilioPhoneNumber } = await getOrgCredentials(
        orgId
      );

      if (!accountSid || !authToken || !twilioPhoneNumber) {
        log.error('[BookingConfirmation] Missing Twilio credentials for org:', orgId);
        return {
          success: false,
          messageSent: false,
          error: 'SMS credentials not configured',
        };
      }

      // Send SMS via Twilio
      const { messageId, error: smsError } = await sendSmsTwilio(
        patientPhone,
        messageContent,
        accountSid,
        authToken,
        twilioPhoneNumber
      );

      if (smsError) {
        log.error('[BookingConfirmation] Failed to send SMS:', smsError);
        return {
          success: false,
          messageSent: false,
          error: smsError,
        };
      }

      // Update appointment with confirmation tracking
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          confirmation_sms_sent: true,
          confirmation_sms_id: messageId,
          confirmation_sms_sent_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .eq('org_id', orgId);

      if (updateError) {
        log.warn('[BookingConfirmation] Failed to update appointment record:', updateError);
        // Don't fail the entire operation if DB update fails - SMS was sent
      }

      log.info('[BookingConfirmation] SMS confirmation sent', {
        appointmentId,
        messageId,
        patientPhone,
      });

      return {
        success: true,
        messageSent: true,
        messageId,
        content: messageContent,
      };
    } catch (error) {
      log.error('[BookingConfirmation] Unexpected error:', error);
      return {
        success: false,
        messageSent: false,
        error: 'Unexpected system error',
      };
    }
  }

  /**
   * Sends appointment reminder SMS (24 hours before appointment)
   * Called by scheduled job, not from Vapi
   */
  static async sendReminderSMS(
    orgId: string,
    appointmentId: string,
    patientPhone: string
  ): Promise<ConfirmationSMSResult> {
    try {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('id, scheduled_at')
        .eq('id', appointmentId)
        .eq('org_id', orgId)
        .single();

      if (appointmentError || !appointment) {
        return {
          success: false,
          messageSent: false,
          error: 'Appointment not found',
        };
      }

      const appointmentDate = new Date(appointment.scheduled_at);
      const timeStr = appointmentDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      const messageContent = `Reminder: Your appointment at ${org?.name} is tomorrow at ${timeStr}\n\nReply STOP to unsubscribe.`;

      const { accountSid, authToken, twilioPhoneNumber } = await getOrgCredentials(
        orgId
      );

      const { messageId, error: smsError } = await sendSmsTwilio(
        patientPhone,
        messageContent,
        accountSid,
        authToken,
        twilioPhoneNumber
      );

      if (smsError) {
        return {
          success: false,
          messageSent: false,
          error: smsError,
        };
      }

      return {
        success: true,
        messageSent: true,
        messageId,
      };
    } catch (error) {
      log.error('[BookingReminder] Unexpected error:', error);
      return {
        success: false,
        messageSent: false,
        error: 'Unexpected system error',
      };
    }
  }
}
