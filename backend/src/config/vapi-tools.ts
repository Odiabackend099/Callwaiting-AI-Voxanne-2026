/**
 * ⚠️ DEPRECATION NOTICE ⚠️
 *
 * This file contains LEGACY tool definitions with snake_case naming convention.
 * These tools are NOT actively synced to VAPI assistants.
 *
 * **DO NOT USE THIS FILE FOR NEW TOOLS**
 *
 * Source of Truth: backend/src/config/phase1-tools.ts (camelCase naming)
 *
 * Active Tools (synced via ToolSyncService):
 * - checkAvailability (NOT check_availability)
 * - bookClinicAppointment (NOT book_appointment)
 * - transferCall
 * - lookupCaller
 * - endCall
 *
 * See TOOL_ARCHITECTURE.md for complete documentation.
 *
 * This file is kept for backward compatibility only.
 * Migration plan: Remove after verifying no legacy imports exist.
 *
 * ---
 *
 * VAPI Tool Definitions (LEGACY - DO NOT USE)
 * OpenAPI-compliant function schemas for VAPI AI assistants
 *
 * These tools enable the AI voice agent to:
 * 1. Check appointment availability in real-time
 * 2. Book appointments directly during calls
 * 3. Alert clinic managers about high-value leads
 * 4. Query the clinic knowledge base for specific information
 * 5. Check service health status
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
      description: 'Books an appointment for a customer after confirming all details. Use this only after customer has explicitly confirmed: service type, scheduled time, and provided phone number.',
      parameters: {
        type: 'object',
        properties: {
          // New schema (matches database)
          customer_name: {
            type: 'string',
            description: 'Full name of the customer (e.g., "Sarah Johnson")'
          },
          customer_phone: {
            type: 'string',
            description: 'Customer phone number in E.164 format (e.g., +12345678900 or +44 for UK)',
            pattern: '^\\+[1-9]\\d{1,14}$'
          },
          customer_email: {
            type: 'string',
            description: 'Customer email address (optional)',
            nullable: true
          },
          service_type: {
            type: 'string',
            description: 'Type of service the customer wants to book',
            enum: ['Botox', 'Dermal Filler', 'Laser Treatment', 'Chemical Peel', 'Consultation', 'HydraFacial', 'Other']
          },
          scheduled_at: {
            type: 'string',
            description: 'Appointment time in ISO 8601 format (e.g., 2026-02-01T14:00:00Z)',
            format: 'date-time'
          },
          duration_minutes: {
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
          },
          // Legacy fields (backward compatibility)
          customerName: {
            type: 'string',
            description: '[LEGACY] Full name of the customer',
            nullable: true
          },
          customerPhone: {
            type: 'string',
            description: '[LEGACY] Customer phone number',
            pattern: '^\\+[1-9]\\d{1,14}$',
            nullable: true
          },
          preferredDate: {
            type: 'string',
            description: '[LEGACY] Preferred appointment date in YYYY-MM-DD format',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            nullable: true
          },
          preferredTime: {
            type: 'string',
            description: '[LEGACY] Preferred time in 24-hour HH:MM format',
            pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            nullable: true
          }
        },
        required: ['customer_name', 'customer_phone', 'service_type', 'scheduled_at']
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
  },

  /**
   * Query the clinic knowledge base for specific information
   * Used when customer asks about services, pricing, policies
   */
  query_knowledge_base: {
    type: 'function',
    function: {
      name: 'query_knowledge_base',
      description: 'Searches the clinic knowledge base for specific information like pricing, services offered, policies, or FAQs. Use this when customer asks questions about services, costs, or clinic details that require accurate answers.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The customer question or topic to search for (e.g., "Botox pricing", "clinic hours", "cancellation policy")'
          },
          category: {
            type: 'string',
            enum: ['products_services', 'operations', 'ai_guidelines', 'general'],
            description: 'Category filter (optional - leave empty to search all)',
            nullable: true
          }
        },
        required: ['query']
      }
    }
  },

  /**
   * Check service health status
   * Used when previous operations fail to determine fallback options
   */
  check_service_health: {
    type: 'function',
    function: {
      name: 'check_service_health',
      description: 'Checks if calendar and SMS services are operational. Use this if previous booking or SMS attempts failed, to determine next best action.',
      parameters: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            enum: ['calendar', 'sms', 'all'],
            description: 'Which service to check',
            default: 'all'
          }
        },
        required: ['service']
      }
    }
  }
};

/**
 * Export tool definitions for assistant configuration
 * Usage: Include VAPI_TOOLS.check_availability, etc. when creating/updating VAPI assistants
 */
export function getToolDefinitions() {
  return [VAPI_TOOLS.check_availability, VAPI_TOOLS.book_appointment, VAPI_TOOLS.notify_hot_lead, VAPI_TOOLS.query_knowledge_base, VAPI_TOOLS.check_service_health];
}

/**
 * Export just the function names for easy reference
 */
export const TOOL_NAMES = {
  CHECK_AVAILABILITY: 'check_availability',
  BOOK_APPOINTMENT: 'book_appointment',
  NOTIFY_HOT_LEAD: 'notify_hot_lead',
  QUERY_KNOWLEDGE_BASE: 'query_knowledge_base',
  CHECK_SERVICE_HEALTH: 'check_service_health'
} as const;
