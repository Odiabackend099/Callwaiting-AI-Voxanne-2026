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
        patientEmail: {
          type: 'string',
          description: 'The patient\'s email address for confirmation.'
        },
        patientPhone: {
          type: 'string',
          description: 'The patient\'s phone number for SMS reminders (optional, but recommended).'
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
      required: ['appointmentDate', 'appointmentTime', 'patientName', 'patientEmail']
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
  if (!data.patientEmail) return { valid: false, error: 'patientEmail required' };

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.appointmentDate)) {
    return { valid: false, error: 'appointmentDate must be YYYY-MM-DD format' };
  }

  // Validate time format
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.appointmentTime)) {
    return { valid: false, error: 'appointmentTime must be HH:MM format' };
  }

  return { valid: true };
}
