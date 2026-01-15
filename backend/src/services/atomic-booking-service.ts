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

        // Silent Failure Rule: Never expose DB errors
        let userMessage = 'Unable to check slot availability. Please try again.';
        if (error.message?.includes('violates foreign key constraint')) {
          userMessage = 'This calendar configuration appears invalid. Please contact support.';
        } else if (error.code === 'P0001') {
          userMessage = error.message; // These are custom exceptions raised by our own PL/PGSQL function
        }

        return {
          success: false,
          error: userMessage, // Generic friendly message
          action: 'ESCALATE',
        };
      }

      // Supabase RPC returns array of objects, extract first result
      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        return {
          success: false,
          error: result?.error || 'Slot not available',
          action: result?.action || 'OFFER_ALTERNATIVES',
        };
      }

      console.log('[AtomicBooking] Slot claimed:', result.hold_id);
      return {
        success: true,
        holdId: result.hold_id,
      };
    } catch (error: any) {
      console.error('[AtomicBooking] Unexpected error in claimSlotAtomic:', error);

      // Silent Failure Rule: Sanitize unexpected exceptions
      return {
        success: false,
        error: "I'm having trouble scheduling that right now. Let me find another way to help.",
        action: 'ESCALATE',
      };
    }
  }

  /**
   * Sends OTP code to patient phone for verification
   * CRITICAL FIX: Fetch credentials FIRST (fail early), then store OTP, then send SMS
   * This prevents race condition where OTP is marked in DB but credentials fail to fetch
   */
  static async sendOTPCode(
    holdId: string,
    patientPhone: string,
    patientName: string,
    twilioCredentials?: any
  ): Promise<{ success: boolean; error?: string; otpCode?: string }> {
    try {
      // CRITICAL FIX #1: Fetch credentials FIRST before modifying state
      let credentials = twilioCredentials;
      let orgId: string;
      
      if (!credentials) {
        // Fetch hold to get org_id (from method call - holdId should be from authenticated context)
        // Note: sendOTPCode should ideally be called with orgId parameter from caller context
        // For now, fetch hold to derive org_id, but ensure caller validates org context
        const { data: holdCheck, error: holdCheckError } = await supabase
          .from('appointment_holds')
          .select('org_id')
          .eq('id', holdId)
          .single();
        
        if (holdCheckError || !holdCheck) {
          console.error('[AtomicBooking] Failed to fetch hold for credential lookup:', holdCheckError);
          return {
            success: false,
            error: 'Booking hold not found',
          };
        }
        
        orgId = holdCheck.org_id;
        
        // Fetch from database using org_id - BEFORE changing state
        const { data: credData, error: credError } = await supabase
          .from('org_credentials')
          .select('decrypted_auth_config')
          .eq('org_id', orgId)
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

      // NOW generate OTP and store it
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
        // CRITICAL FIX #2: Rollback OTP if SMS send fails
        console.error('[AtomicBooking] Failed to send SMS:', smsResult.error);
        console.log('[AtomicBooking] Rolling back OTP storage due to SMS failure');
        
        await supabase
          .from('appointment_holds')
          .update({
            otp_code: null,
            otp_sent_at: null,
          })
          .eq('id', holdId);
        
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

      // Supabase RPC returns array of objects
      const confirmResult = Array.isArray(appointmentData) ? appointmentData[0] : appointmentData;

      console.log('[AtomicBooking] Appointment confirmed:', confirmResult.appointment_id);
      return {
        success: true,
        appointmentId: confirmResult.appointment_id,
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

      // Supabase RPC returns array of objects
      const releaseResult = Array.isArray(data) ? data[0] : data;

      console.log('[AtomicBooking] Hold released:', holdId);
      return { success: releaseResult?.success ?? true };
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
