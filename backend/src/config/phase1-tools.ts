/**
 * Phase 1 Tools: Operational Core
 *
 * These tools provide essential "Agentic" capabilities:
 * 1. Warm Transfer (transferCall) - Hand off complex calls with context
 * 2. Identity Verification (lookupCaller) - Find customers who aren't auto-detected
 *
 * Following "Split-Brain Rule": All tools are server-side webhooks.
 * Never use Vapi's native tools - ensures multi-tenant safety.
 */

export const TRANSFER_CALL_TOOL = {
  type: 'function',
  function: {
    name: 'transferCall',
    description: 'Transfers the caller to a human agent. Use this ONLY if: 1) The user asks for a human, 2) The user is angry/frustrated, or 3) The request is too complex for you.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A concise 1-sentence summary of the caller\'s issue to tell the human agent (e.g., "Customer is asking about a refund for last week").'
        },
        department: {
          type: 'string',
          enum: ['general', 'billing', 'medical'],
          description: 'The best department to handle this request.'
        }
      },
      required: ['summary', 'department']
    }
  },
  async: true // Allows Vapi to process the transfer logic on your server
};

export const LOOKUP_CALLER_TOOL = {
  type: 'function',
  function: {
    name: 'lookupCaller',
    description: 'Search for an existing patient/customer in the database. Use this if the caller says they are an existing client but you don\'t recognize them.',
    parameters: {
      type: 'object',
      properties: {
        searchKey: {
          type: 'string',
          description: 'The phone number, email, or full name provided by the user.'
        },
        searchType: {
          type: 'string',
          enum: ['phone', 'name', 'email']
        }
      },
      required: ['searchKey', 'searchType']
    }
  },
  async: true // Allows AI to say "Let me look that up..." while the DB query runs
};

export const END_CALL_TOOL = {
  type: 'function',
  function: {
    name: 'endCall',
    description: 'Gracefully end the current call. Use this when: 1) The conversation is complete and patient has no more questions, 2) Call duration limit is reached (>9.5 minutes), or 3) Patient explicitly says "that\'s all" or "goodbye".',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['completed', 'time_limit', 'patient_request', 'transfer_needed'],
          description: 'Why the call is ending: completed (successful outcome), time_limit (max duration reached), patient_request (patient said goodbye), transfer_needed (transferring to human)'
        },
        summary: {
          type: 'string',
          description: 'Brief 1-sentence summary of call outcome (e.g., "Appointment booked for Jan 28 at 2 PM" or "Transferred to billing for refund request")'
        }
      },
      required: ['reason']
    }
  },
  async: false // Synchronous - call ends immediately
};

/**
 * Helper to inject the dynamic backend URL into the tool definition.
 * This ensures the AI knows exactly where to send the webhook (to YOUR server).
 */
export function getTransferCallTool(backendUrl: string) {
  return {
    ...TRANSFER_CALL_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/transferCall`
    }
  };
}

export function getLookupCallerTool(backendUrl: string) {
  return {
    ...LOOKUP_CALLER_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/lookupCaller`
    }
  };
}

export function getEndCallTool(backendUrl: string) {
  return {
    ...END_CALL_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/endCall`
    }
  };
}

/**
 * Check Availability Tool (Phase 1 Critical Addition)
 *
 * MUST be called BEFORE bookClinicAppointment to validate slot availability.
 * Returns available time slots for the requested date.
 */
export const CHECK_AVAILABILITY_TOOL = {
  type: 'function',
  function: {
    name: 'checkAvailability',
    description: 'Check available appointment slots for a given date. ALWAYS call this BEFORE attempting to book. Returns list of available time slots respecting business hours.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'The date to check availability for in YYYY-MM-DD format (e.g., 2026-01-28). Convert relative dates like "next Tuesday" to this format.'
        },
        serviceType: {
          type: 'string',
          enum: ['consultation', 'checkup', 'follow_up', 'teeth_whitening', 'botox', 'generic'],
          description: 'The type of service to check availability for. Defaults to "consultation".'
        },
        timezone: {
          type: 'string',
          description: 'IANA timezone string (e.g., "America/New_York", "America/Los_Angeles", "Africa/Lagos"). Optional - uses org default if not provided.'
        }
      },
      required: ['date']
    }
  },
  async: true // Allows AI to say "Let me check..." while the calendar query runs
};

export function getCheckAvailabilityTool(backendUrl: string) {
  return {
    ...CHECK_AVAILABILITY_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/calendar/check`
    }
  };
}

/**
 * Query Knowledge Base Tool (Phase 2 Addition)
 *
 * MUST be used when patient asks questions about:
 * - Services, pricing, procedures
 * - Business hours, location, policies
 * - Insurance, payment options
 * - Specialist information
 *
 * Returns relevant information from the organization's knowledge base.
 */
export const QUERY_KNOWLEDGE_BASE_TOOL = {
  type: 'function',
  function: {
    name: 'queryKnowledgeBase',
    description: 'Search the organization\'s knowledge base for information about services, pricing, policies, hours, location, insurance, and other business details. Use this BEFORE answering questions about the clinic to ensure accurate information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The question or topic to search for (e.g., "Botox pricing", "business hours", "insurance accepted", "parking information"). Use natural language.'
        },
        category: {
          type: 'string',
          enum: ['services', 'pricing', 'policies', 'hours', 'location', 'insurance', 'general'],
          description: 'The category of information being requested. Helps narrow down search results.'
        }
      },
      required: ['query']
    }
  },
  async: true // Allows AI to say "Let me check our information..." while the search runs
};

export function getQueryKnowledgeBaseTool(backendUrl: string) {
  return {
    ...QUERY_KNOWLEDGE_BASE_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/knowledge-base`
    }
  };
}
