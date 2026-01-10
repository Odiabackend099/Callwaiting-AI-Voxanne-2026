/**
 * VAPI Tool Definitions
 * OpenAPI-compliant function schemas for VAPI AI assistants
 *
 * These tools enable the AI voice agent to:
 * 1. Check appointment availability in real-time
 * 2. Book appointments directly during calls
 * 3. Alert clinic managers about high-value leads
 *
 * All tools are processed by the webhook handler at /api/webhooks/vapi
 */

export const VAPI_TOOLS = {
  /**
   * Check available appointment slots for a specific date
   * Used before booking to show customer available times
   */
  check_availability: {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Checks calendar availability for a specific date and returns available appointment slots. Always use this BEFORE suggesting times to the customer.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date to check in YYYY-MM-DD format (e.g., 2026-01-15)',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$'
          }
        },
        required: ['date']
      }
    }
  },

  /**
   * Book an appointment for a customer
   * Creates appointment in calendar, database, and sends SMS confirmation
   * Only call after customer has confirmed all details
   */
  book_appointment: {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Books an appointment for a customer after confirming all details. Use this only after customer has explicitly confirmed: service type, preferred date, preferred time, and provided phone number. Always offer the customer to ask questions before booking.',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Full name of the customer (e.g., "Sarah Johnson")'
          },
          customerPhone: {
            type: 'string',
            description: 'Customer phone number in E.164 format (e.g., +12345678900 or +44 for UK)',
            pattern: '^\\+[1-9]\\d{1,14}$'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email address (optional)',
            nullable: true
          },
          serviceType: {
            type: 'string',
            description: 'Type of service the customer wants to book',
            enum: ['Botox', 'Dermal Filler', 'Laser Treatment', 'Chemical Peel', 'Consultation', 'HydraFacial', 'Other']
          },
          preferredDate: {
            type: 'string',
            description: 'Preferred appointment date in YYYY-MM-DD format (e.g., 2026-02-01)',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$'
          },
          preferredTime: {
            type: 'string',
            description: 'Preferred time in 24-hour HH:MM format (e.g., "14:00" for 2 PM, "09:30" for 9:30 AM)',
            pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
          },
          durationMinutes: {
            type: 'integer',
            description: 'Appointment duration in minutes (default: 45). Typical appointments are 30-60 minutes.',
            default: 45,
            minimum: 15,
            maximum: 240
          },
          notes: {
            type: 'string',
            description: 'Any special requests or notes from the customer (e.g., "First time customer", "sensitive skin")',
            nullable: true
          }
        },
        required: ['customerName', 'customerPhone', 'serviceType', 'preferredDate', 'preferredTime']
      }
    }
  },

  /**
   * Alert clinic manager about a high-value lead
   * Sends SMS and creates dashboard notification
   * Used when customer shows strong buying intent during call
   */
  notify_hot_lead: {
    type: 'function',
    function: {
      name: 'notify_hot_lead',
      description: 'Immediately notifies clinic manager about a high-value lead via SMS. Use this when: (1) customer confirms budget, (2) customer wants to book this week, (3) customer shows high urgency/strong interest, or (4) customer requests premium services (Botox, Laser). This ensures the clinic never misses a hot lead.',
      parameters: {
        type: 'object',
        properties: {
          leadName: {
            type: 'string',
            description: 'Customer name'
          },
          leadPhone: {
            type: 'string',
            description: 'Customer phone number in E.164 format',
            pattern: '^\\+[1-9]\\d{1,14}$'
          },
          serviceInterest: {
            type: 'string',
            description: 'Service(s) customer is interested in (e.g., "Botox and Filler")'
          },
          urgency: {
            type: 'string',
            description: 'Urgency level based on customer language and behavior',
            enum: ['high', 'medium'],
            default: 'high'
          },
          summary: {
            type: 'string',
            description: 'Brief summary of why this is a hot lead (e.g., "Wants to book today, budget confirmed, ready to move forward")',
            maxLength: 200
          }
        },
        required: ['leadName', 'leadPhone', 'serviceInterest', 'summary']
      }
    }
  }
};

/**
 * Export tool definitions for assistant configuration
 * Usage: Include VAPI_TOOLS.check_availability, etc. when creating/updating VAPI assistants
 */
export function getToolDefinitions() {
  return [VAPI_TOOLS.check_availability, VAPI_TOOLS.book_appointment, VAPI_TOOLS.notify_hot_lead];
}

/**
 * Export just the function names for easy reference
 */
export const TOOL_NAMES = {
  CHECK_AVAILABILITY: 'check_availability',
  BOOK_APPOINTMENT: 'book_appointment',
  NOTIFY_HOT_LEAD: 'notify_hot_lead'
} as const;
