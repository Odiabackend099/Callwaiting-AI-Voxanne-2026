/**
 * VAPI Simulator - HTTP Client for Simulating Vapi Tool Calls
 *
 * This client simulates the exact HTTP requests that Vapi sends during real calls.
 * It's used for end-to-end testing without requiring live Vapi calls.
 *
 * Usage:
 * ```typescript
 * const simulator = new VapiSimulator('http://localhost:3001', orgId);
 * const result = await simulator.callTool('bookClinicAppointment', {
 *   patientName: 'John Doe',
 *   phone: '+1234567890',
 *   appointmentDate: '2026-02-06',
 *   appointmentTime: '15:00'
 * });
 * ```
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface VapiToolCallArgs {
  [key: string]: any;
}

export interface VapiToolResponse {
  toolCallId?: string;
  result?: {
    success: boolean;
    appointmentId?: string;
    message?: string;
    error?: string;
    [key: string]: any;
  };
  toolResult?: {
    content: string;
  };
  speech?: string;
  endCall?: boolean;
  transfer?: {
    destination: any;
    message?: string;
  };
  [key: string]: any;
}

export interface CallTiming {
  startTime: number;
  endTime: number;
  duration: number;
}

export class VapiSimulator {
  private client: AxiosInstance;
  private baseUrl: string;
  private orgId: string;
  private callId: string;
  private timings: Map<string, CallTiming> = new Map();

  constructor(baseUrl: string, orgId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.orgId = orgId;
    this.callId = `sim-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VapiSimulator/1.0'
      },
      validateStatus: () => true // Don't throw on any status code
    });
  }

  /**
   * Call a Vapi tool with the exact payload format Vapi uses
   *
   * @param toolName - Name of the tool to call (e.g., 'bookClinicAppointment')
   * @param args - Arguments to pass to the tool
   * @param options - Optional configuration
   * @returns VapiToolResponse from the backend
   */
  async callTool(
    toolName: string,
    args: VapiToolCallArgs,
    options?: { ignoreErrors?: boolean }
  ): Promise<VapiToolResponse> {
    const startTime = Date.now();

    try {
      // Construct Vapi payload exactly as real Vapi does
      const payload = this._constructVapiPayload(toolName, args);

      // Determine endpoint based on tool name
      const endpoint = this._getEndpoint(toolName);

      // Log request
      console.log(`\n📤 Calling: ${endpoint}`);
      console.log(`   Arguments: ${JSON.stringify(args).substring(0, 100)}...`);

      // Make the request
      const response = await this.client.post(endpoint, payload);

      const endTime = Date.now();
      const duration = endTime - startTime;
      this.timings.set(toolName, { startTime, endTime, duration });

      // Check for errors
      if (response.status >= 400) {
        const error = new Error(
          `HTTP ${response.status}: ${response.data?.error || response.statusText}`
        );
        if (!options?.ignoreErrors) throw error;
        return { result: { success: false, error: error.message } };
      }

      console.log(`   ✅ Response: ${response.status} (${duration}ms)`);

      return response.data || {};
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.timings.set(toolName, { startTime, endTime, duration });

      const errorMsg = error?.response?.data?.error ||
                       error?.message ||
                       'Unknown error';

      console.error(`   ❌ Error: ${errorMsg}`);

      if (!options?.ignoreErrors) throw error;

      return {
        result: {
          success: false,
          error: errorMsg
        }
      };
    }
  }

  /**
   * Get timing information for a tool call
   */
  getTiming(toolName: string): CallTiming | undefined {
    return this.timings.get(toolName);
  }

  /**
   * Format timing as human-readable string
   */
  formatTiming(toolName: string): string {
    const timing = this.timings.get(toolName);
    if (!timing) return 'N/A';
    return `${timing.duration}ms`;
  }

  /**
   * Get the call ID for this simulation
   */
  getCallId(): string {
    return this.callId;
  }

  /**
   * Get the org ID being used
   */
  getOrgId(): string {
    return this.orgId;
  }

  /**
   * Reset the call ID for a new call sequence
   */
  resetCallId(): void {
    this.callId = `sim-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timings.clear();
  }

  /**
   * Get all collected timings
   */
  getAllTimings(): Record<string, CallTiming> {
    const result: Record<string, CallTiming> = {};
    this.timings.forEach((timing, toolName) => {
      result[toolName] = timing;
    });
    return result;
  }

  /**
   * Get total duration across all calls
   */
  getTotalDuration(): number {
    let total = 0;
    this.timings.forEach((timing) => {
      total += timing.duration;
    });
    return total;
  }

  /**
   * Construct the exact Vapi payload format
   */
  private _constructVapiPayload(toolName: string, args: VapiToolCallArgs): Record<string, any> {
    return {
      message: {
        toolCalls: [{
          function: {
            name: toolName,
            arguments: JSON.stringify(args)
          }
        }],
        call: {
          id: this.callId,
          metadata: {
            org_id: this.orgId
          },
          customer: {
            number: args.phone || args.patientPhone || '+unknown'
          }
        }
      },
      customer: {
        metadata: {
          org_id: this.orgId
        }
      }
    };
  }

  /**
   * Map tool name to backend endpoint
   */
  private _getEndpoint(toolName: string): string {
    const toolMap: Record<string, string> = {
      'checkAvailability': '/api/vapi/tools/calendar/check',
      'calendar/check': '/api/vapi/tools/calendar/check',
      'bookClinicAppointment': '/api/vapi/tools/bookClinicAppointment',
      'lookupCaller': '/api/vapi/tools/lookupCaller',
      'lookupContact': '/api/vapi/tools/lookupCaller',
      'transferCall': '/api/vapi/tools/transferCall',
      'endCall': '/api/vapi/tools/endCall',
      'knowledge-base': '/api/vapi/tools/knowledge-base',
      'getKnowledgeBase': '/api/vapi/tools/knowledge-base',
      'reserve_slot': '/api/vapi/tools/calendar/reserve',
      'send_sms': '/api/vapi/tools/sms/send',
      'send_sms_reminder': '/api/vapi/tools/sms/send'
    };

    return toolMap[toolName] || `/api/vapi/tools/${toolName}`;
  }
}

/**
 * Helper function to create a simulator instance with defaults
 */
export function createSimulator(
  baseUrl: string = process.env.BACKEND_URL || 'http://localhost:3001',
  orgId: string = process.env.TEST_ORG_ID || '46cf2995-2bee-44e3-838b-24151486fe4e'
): VapiSimulator {
  return new VapiSimulator(baseUrl, orgId);
}
