/**
 * Unified Booking Tool Definition
 *
 * Single source of truth for the bookClinicAppointment tool.
 * Used by Vapi assistant to book appointments.
 *
 * Schema matches exactly what backend endpoint expects at:
 * POST /api/vapi/tools/bookClinicAppointment
 */

export const UNIFIED_BOOKING_TOOL = {
  type: 'function',
  function: {
    name: 'bookClinicAppointment',
    description: 'Book a confirmed appointment for a patient. Syncs with Google Calendar and sends confirmation.',
    parameters: {
      type: 'object',
      properties: {
        appointmentDate: {
          type: 'string',
          description: 'The date of the appointment in YYYY-MM-DD format (e.g., 2026-01-20). Always convert relative dates like "next Tuesday" to this format.',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        appointmentTime: {
          type: 'string',
          description: 'The time of the appointment in 24-hour HH:MM format (e.g., 14:30 for 2:30 PM).',
          pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
        },
        patientName: {
          type: 'string',
          description: 'The full name of the patient.'
        },
        patientPhone: {
          type: 'string',
          description: 'The patient\'s mobile phone number in E.164 format (e.g., +14155551234). REQUIRED for SMS appointment confirmation.',
          pattern: '^\\+[1-9]\\d{1,14}$'
        },
        patientEmail: {
          type: 'string',
          description: 'The patient\'s email address (optional). Only collect if the patient volunteers it.',
          format: 'email'
        },
        serviceType: {
          type: 'string',
          description: 'The type of service being booked.',
          enum: ['consultation', 'checkup', 'follow_up', 'teeth_whitening', 'botox', 'generic'],
          default: 'consultation'
        },
        duration: {
          type: 'number',
          description: 'Duration of the appointment in minutes. Default is 30.',
          default: 30,
          minimum: 15,
          maximum: 240
        }
      },
      required: ['appointmentDate', 'appointmentTime', 'patientName', 'patientPhone']
    }
  },
  async: true
};

/**
 * Get the unified booking tool with webhook server URL
 * @param backendUrl - Base URL of backend (e.g., http://localhost:3001 or https://api.example.com)
 * @returns Complete tool definition with server endpoint
 */
export function getUnifiedBookingTool(backendUrl: string) {
  return {
    ...UNIFIED_BOOKING_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/bookClinicAppointment`
    }
  };
}

/**
 * Validation helper - ensure appointment request has all required fields
 */
export function validateBookingRequest(data: any): { valid: boolean; error?: string } {
  if (!data.appointmentDate) return { valid: false, error: 'appointmentDate required' };
  if (!data.appointmentTime) return { valid: false, error: 'appointmentTime required' };
  if (!data.patientName) return { valid: false, error: 'patientName required' };
  if (!data.patientPhone) return { valid: false, error: 'patientPhone required' };

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.appointmentDate)) {
    return { valid: false, error: 'appointmentDate must be YYYY-MM-DD format' };
  }

  // Validate time format (HH:MM 24-hour)
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.appointmentTime)) {
    return { valid: false, error: 'appointmentTime must be HH:MM format' };
  }

  // Validate phone format (E.164)
  if (!/^\+[1-9]\d{1,14}$/.test(data.patientPhone)) {
    return { valid: false, error: 'patientPhone must be E.164 format (e.g., +14155551234)' };
  }

  // Validate email format if provided (optional)
  if (data.patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.patientEmail)) {
    return { valid: false, error: 'patientEmail must be valid email format' };
  }

  return { valid: true };
}
