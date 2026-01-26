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
