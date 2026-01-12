import { supabase } from './supabase-client';
import { generateOTP } from '../utils/otp-utils';
import { sendSmsTwilio } from './twilio-service';

export interface AtomicBookingResult {
  success: boolean;
  holdId?: string;
  error?: string;
  action?: 'OFFER_ALTERNATIVES' | 'RETRY' | 'ESCALATE';
}

export interface OTPVerificationResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
  remainingAttempts?: number;
}

export class AtomicBookingService {
  /**
   * Claims a slot atomically using PostgreSQL advisory locks
   * Prevents double-booking with microsecond-level precision
   */
  static async claimSlotAtomic(
    orgId: string,
    calendarId: string,
    slotTime: Date,
    callSid: string,
    patientName?: string,
    patientPhone?: string
  ): Promise<AtomicBookingResult> {
    try {
      const { data, error } = await supabase.rpc('claim_slot_atomic', {
        p_org_id: orgId,
        p_calendar_id: calendarId,
        p_slot_time: slotTime.toISOString(),
        p_call_sid: callSid,
        p_patient_name: patientName || null,
        p_patient_phone: patientPhone || null,
        p_hold_duration_minutes: 10,
      });

      if (error) {
        console.error('[AtomicBooking] claim_slot_atomic RPC error:', error);
        return {
          success: false,
          error: error.message || 'Failed to claim slot',
          action: 'ESCALATE',
        };
      }

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || 'Slot not available',
          action: data?.action || 'OFFER_ALTERNATIVES',
        };
      }

      console.log('[AtomicBooking] Slot claimed:', data.hold_id);
      return {
        success: true,
        holdId: data.hold_id,
      };
    } catch (error) {
      console.error('[AtomicBooking] Unexpected error in claimSlotAtomic:', error);
      return {
        success: false,
        error: 'Unexpected system error',
        action: 'ESCALATE',
      };
    }
  }

  /**
   * Sends OTP code to patient phone for verification
   */
  static async sendOTPCode(
    holdId: string,
    patientPhone: string,
    patientName: string,
    twilioCredentials?: any
  ): Promise<{ success: boolean; error?: string; otpCode?: string }> {
    try {
      // Generate 4-digit OTP
      const otpCode = generateOTP(4);

      // Store OTP in appointment_holds
      const { data: holdData, error: fetchError } = await supabase
        .from('appointment_holds')
        .update({
          otp_code: otpCode,
          otp_sent_at: new Date().toISOString(),
        })
        .eq('id', holdId)
        .select()
        .single();

      if (fetchError) {
        console.error('[AtomicBooking] Failed to update hold with OTP:', fetchError);
        return {
          success: false,
          error: 'Failed to generate OTP',
        };
      }

      // Get Twilio credentials if not provided
      let credentials = twilioCredentials;
      if (!credentials) {
        // Fetch from database using org_id from holdData
        const { data: credData, error: credError } = await supabase
          .from('org_credentials')
          .select('decrypted_auth_config')
          .eq('org_id', holdData.org_id)
          .eq('integration_type', 'twilio_byoc')
          .single();

        if (credError || !credData) {
          console.error('[AtomicBooking] Failed to get Twilio credentials');
          return {
            success: false,
            error: 'SMS service not configured',
          };
        }

        credentials = credData.decrypted_auth_config;
      }

      // Send SMS to patient
      const smsResult = await sendSmsTwilio(
        {
          to: patientPhone,
          message: `Hi ${patientName}! Your verification code is: ${otpCode}. Please say this number to confirm your appointment.`,
          from: credentials.phoneNumber
        },
        credentials
      );

      if (!smsResult.success) {
        console.error('[AtomicBooking] Failed to send SMS:', smsResult.error);
        return {
          success: false,
          error: 'Failed to send verification code via SMS',
        };
      }

      console.log('[AtomicBooking] OTP sent to', patientPhone);
      return {
        success: true,
        otpCode, // Return for testing purposes
      };
    } catch (error) {
      console.error('[AtomicBooking] Unexpected error in sendOTPCode:', error);
      return {
        success: false,
        error: 'Failed to send verification code',
      };
    }
  }

  /**
   * Verifies OTP and converts hold to confirmed appointment
   */
  static async verifyOTPAndConfirm(
    holdId: string,
    orgId: string,
    contactId: string,
    providedOTP: string,
    serviceType: string = 'consultation'
  ): Promise<OTPVerificationResult> {
    try {
      // Fetch the hold with OTP
      const { data: holdData, error: fetchError } = await supabase
        .from('appointment_holds')
        .select('*')
        .eq('id', holdId)
        .eq('org_id', orgId)
        .eq('status', 'held')
        .single();

      if (fetchError || !holdData) {
        console.error('[AtomicBooking] Hold not found:', fetchError);
        return {
          success: false,
          error: 'Booking hold expired or not found',
          remainingAttempts: 0,
        };
      }

      // Check if OTP matches
      if (holdData.otp_code !== providedOTP) {
        const newAttempts = (holdData.verification_attempts || 0) + 1;

        // Update verification attempts
        await supabase
          .from('appointment_holds')
          .update({
            verification_attempts: newAttempts,
          })
          .eq('id', holdId);

        const remainingAttempts = Math.max(0, 3 - newAttempts);

        // Release hold if 3 attempts failed
        if (newAttempts >= 3) {
          await supabase
            .from('appointment_holds')
            .update({ status: 'requires_manual_followup' })
            .eq('id', holdId);

          return {
            success: false,
            error: 'Incorrect verification code. Too many attempts. A specialist will contact you shortly.',
            remainingAttempts: 0,
          };
        }

        return {
          success: false,
          error: 'Incorrect verification code. Please try again.',
          remainingAttempts,
        };
      }

      // OTP matches - confirm the appointment
      const { data: appointmentData, error: confirmError } = await supabase.rpc(
        'confirm_held_slot',
        {
          p_hold_id: holdId,
          p_org_id: orgId,
          p_contact_id: contactId,
          p_service_type: serviceType,
        }
      );

      if (confirmError) {
        console.error('[AtomicBooking] Failed to confirm appointment:', confirmError);
        return {
          success: false,
          error: 'Failed to confirm appointment',
        };
      }

      console.log('[AtomicBooking] Appointment confirmed:', appointmentData.appointment_id);
      return {
        success: true,
        appointmentId: appointmentData.appointment_id,
      };
    } catch (error) {
      console.error('[AtomicBooking] Unexpected error in verifyOTPAndConfirm:', error);
      return {
        success: false,
        error: 'System error during verification',
      };
    }
  }

  /**
   * Releases a hold (called when patient hangs up or session ends)
   */
  static async releaseHold(holdId: string, orgId: string): Promise<{ success: boolean }> {
    try {
      const { data, error } = await supabase.rpc('release_hold', {
        p_hold_id: holdId,
        p_org_id: orgId,
      });

      if (error) {
        console.error('[AtomicBooking] Failed to release hold:', error);
        return { success: false };
      }

      console.log('[AtomicBooking] Hold released:', holdId);
      return { success: true };
    } catch (error) {
      console.error('[AtomicBooking] Unexpected error in releaseHold:', error);
      return { success: false };
    }
  }

  /**
   * Gets the current status of a hold
   */
  static async getHoldStatus(
    holdId: string,
    orgId: string
  ): Promise<{
    status: string;
    expiresAt: Date | null;
    appointmentId?: string;
    error?: string;
  }> {
    try {
      const { data: holdData, error } = await supabase
        .from('appointment_holds')
        .select('status, expires_at, appointment_id')
        .eq('id', holdId)
        .eq('org_id', orgId)
        .single();

      if (error) {
        return {
          status: 'not_found',
          expiresAt: null,
          error: error.message,
        };
      }

      return {
        status: holdData.status,
        expiresAt: holdData.expires_at ? new Date(holdData.expires_at) : null,
        appointmentId: holdData.appointment_id,
      };
    } catch (error) {
      console.error('[AtomicBooking] Error getting hold status:', error);
      return {
        status: 'error',
        expiresAt: null,
        error: 'Failed to get status',
      };
    }
  }

  /**
   * Cleans up expired holds (can be called as a scheduled task)
   */
  static async cleanupExpiredHolds(): Promise<{ success: boolean; deleted: number }> {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_holds');

      if (error) {
        console.error('[AtomicBooking] Failed to cleanup holds:', error);
        return { success: false, deleted: 0 };
      }

      console.log('[AtomicBooking] Cleanup completed');
      return { success: true, deleted: 0 };
    } catch (error) {
      console.error('[AtomicBooking] Error in cleanupExpiredHolds:', error);
      return { success: false, deleted: 0 };
    }
  }
}
