/**
 * Vapi Webhook Payload Types
 * Official types for end-of-call-report webhooks from Vapi
 * Created: 2026-01-29
 *
 * These types provide strict TypeScript interfaces for all Vapi webhook payloads,
 * ensuring compile-time type safety and preventing runtime errors from field mismatches.
 */

/**
 * Main Vapi webhook payload structure for end-of-call-report events
 */
export interface VapiWebhookPayload {
  message: {
    /**
     * Event type - typically "end-of-call-report", "call.started", "call.ended", etc.
     */
    type: "end-of-call-report" | "call.started" | "call.ended" | "call.transcribed" | "function-call" | string;

    /**
     * Call information extracted from the Vapi platform
     */
    call: {
      /** Unique identifier for this call from Vapi */
      id: string;

      /** Assistant ID that handled the call */
      assistantId: string;

      /** Current status of the call */
      status?: string;

      /** Duration of the call in seconds */
      duration?: number;

      /** Cost of the call in dollars */
      cost?: number;

      /** ISO 8601 timestamp when the call started */
      startedAt?: string;

      /** ISO 8601 timestamp when the call ended */
      endedAt?: string;

      /** Array of tool calls made during the conversation */
      toolCalls?: Array<{
        function?: {
          name: string;
        };
        name?: string;
        status?: string;
      }>;

      /** Any custom metadata associated with the call */
      metadata?: Record<string, any>;
    };

    /**
     * Artifacts generated during the call (recording, transcript, etc.)
     */
    artifact?: {
      /** Full conversation transcript */
      transcript?: string;

      /** Recording URL or recording object with metadata */
      recording?: string | {
        url?: string;
        [key: string]: any;
      };
    };

    /**
     * AI analysis of the call (sentiment, summary, success evaluation)
     */
    analysis?: {
      /** Summary of the call conversation */
      summary?: string;

      /** Sentiment of the conversation: positive, neutral, or negative */
      sentiment?: "positive" | "neutral" | "negative";

      /** Whether the call was successful according to goals */
      successEvaluation?: string;
    };

    /**
     * Information about the customer who called
     */
    customer?: {
      /** Phone number of the caller */
      number?: string;

      /** Name of the caller if available */
      name?: string;
    };
  };
}

/**
 * Headers sent with Vapi webhook requests
 * Used for security verification (signature, timestamp)
 */
export interface VapiWebhookHeaders {
  /** HMAC SHA-256 signature for verifying webhook authenticity */
  "x-vapi-signature"?: string;

  /** Unix timestamp when the webhook was sent */
  "x-vapi-timestamp"?: string;

  /** Custom header for additional secret verification (optional) */
  "x-vapi-secret"?: string;
}

/**
 * Typed representation of an end-of-call-report event
 * This is the primary event type used by the webhook handler
 */
export interface EndOfCallReportEvent {
  type: "end-of-call-report";
  call: VapiWebhookPayload["message"]["call"];
  artifact?: VapiWebhookPayload["message"]["artifact"];
  analysis?: VapiWebhookPayload["message"]["analysis"];
  customer?: VapiWebhookPayload["message"]["customer"];
}

/**
 * Database mapping of Vapi assistant to organization
 * Used to resolve which organization owns a particular call
 */
export interface AssistantOrgMapping {
  assistantId: string;
  orgId: string;
  orgName?: string;
}

/**
 * Call log entry after processing a webhook
 * Mirrors the database schema in call_logs table
 */
export interface ProcessedCallLog {
  id: string;
  org_id: string;
  vapi_call_id: string;
  recording_url?: string | null;
  recording_storage_path?: string | null;
  recording_status?: "pending" | "processing" | "completed" | "failed";
  transcript?: string | null;
  sentiment_score?: number | null;
  sentiment_label?: string | null;
  sentiment_summary?: string | null;
  sentiment_urgency?: string | null;
  cost?: number | null;
  duration_seconds?: number | null;
  outcome?: string;
  metadata?: Record<string, any>;
}
