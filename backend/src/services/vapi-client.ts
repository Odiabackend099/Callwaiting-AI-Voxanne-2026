import axios, { AxiosInstance, AxiosError } from 'axios';

// ========== CIRCUIT BREAKER ==========

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 failures
const CIRCUIT_BREAKER_RESET_MS = 60000; // Reset after 1 minute

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false
};

function checkCircuitBreaker(): void {
  // Reset circuit if enough time has passed
  if (circuitBreaker.isOpen && Date.now() - circuitBreaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    console.log('[VapiClient] Circuit breaker reset - attempting to reconnect');
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
  }

  if (circuitBreaker.isOpen) {
    throw new Error('Vapi API circuit breaker is open. Service temporarily unavailable. Please try again later.');
  }
}

function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.error(`[VapiClient] Circuit breaker opened after ${circuitBreaker.failures} failures`);
    circuitBreaker.isOpen = true;
  }
}

function recordSuccess(): void {
  // Reset failures on success
  if (circuitBreaker.failures > 0) {
    circuitBreaker.failures = 0;
  }
}

export function getCircuitBreakerStatus(): { isOpen: boolean; failures: number; lastFailure: number } {
  return { ...circuitBreaker };
}

// ========== INTERFACES ==========

export interface AssistantConfig {
  name: string;
  systemPrompt: string;
  voiceProvider?: string;
  voiceId?: string;
  language?: string;
  firstMessage?: string;
  maxDurationSeconds?: number;
  modelProvider?: string;
  modelName?: string;
  serverUrl?: string;
  transcriber?: {
    provider: string;
    model?: string;
    language?: string;
  };
  functions?: any[];
}

export interface CreateCallParams {
  assistantId: string;
  phoneNumberId: string;
  customer: {
    number: string;
    name?: string;
  };
  assistantOverrides?: {
    variableValues?: Record<string, string>;  // For {{variable}} substitution in prompts
    metadata?: Record<string, any>;           // For tracking in webhooks/tools
    firstMessage?: string;                    // Override first message with personalized greeting
  };
  idempotencyKey?: string;                    // For deduplication on retries
}

export interface ImportTwilioParams {
  phoneNumber: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  name?: string;
}

export class VapiClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    // CRITICAL: Sanitize API key to prevent "Invalid character in header content" errors
    // Remove all control characters, newlines, carriage returns, and whitespace
    const sanitizedKey = (apiKey || '')
      .trim()
      .replace(/[\r\n\t\x00-\x1F\x7F]/g, ''); // Remove all control characters

    if (!sanitizedKey) {
      throw new Error('VapiClient: API key is required and cannot be empty');
    }

    this.apiKey = sanitizedKey;

    this.client = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${sanitizedKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Retry logic with exponential backoff for 5xx errors
    this.client.interceptors.response.use(
      response => response,
      async error => {
        // If config is missing, we can't retry, so just reject
        if (!error.config) {
          return Promise.reject(error);
        }

        const config = error.config as any;

        if (config.retry === undefined) {
          config.retry = 0;
        }

        // Retry on 5xx server errors AND network errors, max 3 attempts
        const isRetryableError =
          (error.response?.status && error.response.status >= 500) ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNABORTED';

        if (config.retry < 3 && isRetryableError) {
          config.retry += 1;
          const delay = Math.pow(2, config.retry) * 1000; // 2s, 4s, 8s
          console.log(`[VapiClient] Retrying request (attempt ${config.retry}/3) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  // ========== ASSISTANTS ==========

  async createAssistant(config: AssistantConfig) {
    checkCircuitBreaker();
    try {
      const payload: any = {
        name: config.name,
        serverUrl: config.serverUrl,
        model: {
          provider: config.modelProvider || 'openai',
          model: config.modelName || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: config.systemPrompt
            }
          ]
        },
        voice: {
          provider: config.voiceProvider || 'vapi',
          voiceId: config.voiceId || 'Paige'
        },
        transcriber: config.transcriber || {
          provider: 'deepgram',
          model: 'nova-2',
          language: config.language || 'en'  // Use stored language
        },
        firstMessage: config.firstMessage || 'Hello! How can I help you today?',
        functions: config.functions || this.getDefaultDemoFunctions()
      };

      // Add maxDurationSeconds if provided
      if (config.maxDurationSeconds) {
        payload.maxDurationSeconds = config.maxDurationSeconds;
      }

      const response = await this.client.post('/assistant', payload);
      recordSuccess();
      return response.data;
    } catch (error) {
      recordFailure();
      console.error('[VapiClient] Failed to create assistant:', error);
      throw error;
    }
  }

  async updateAssistant(assistantId: string, updates: any) {
    checkCircuitBreaker();
    try {
      const response = await this.client.patch(`/assistant/${assistantId}`, updates);
      recordSuccess();
      return response.data;
    } catch (error) {
      recordFailure();
      console.error('[VapiClient] Failed to update assistant:', error);
      throw error;
    }
  }

  async getAssistant(assistantId: string) {
    checkCircuitBreaker();
    try {
      const response = await this.client.get(`/assistant/${assistantId}`);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to get assistant:', error);
      throw error;
    }
  }

  async listAssistants() {
    checkCircuitBreaker();
    try {
      const response = await this.client.get('/assistant');
      recordSuccess();
      return response.data;
    } catch (error) {
      recordFailure();
      console.error('[VapiClient] Failed to list assistants:', error);
      throw error;
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // We try to list assistants with limit 1 as a lightweight check
      await this.client.get('/assistant', { params: { limit: 1 } });
      return true;
    } catch (error) {
      return false;
    }
  }

  async listVoices() {
    try {
      // VAPI doesn't have a public endpoint documented for listing voices in the same way
      // but we can try to hit /voice if it exists, or return our hardcoded list
      // as fallback if the API call fails or is not implemented.
      // Based on research, VAPI integrates with providers.
      // For now, we will try the /voice endpoint as per plan, but catch if it fails.
      const response = await this.client.get('/voice');
      return response.data;
    } catch (error) {
      console.warn('[VapiClient] Failed to list voices from API, might not be supported:', error);
      // Return empty or throw, the caller should handle fallback to hardcoded list
      return [];
    }
  }

  // ========== CALLS ==========

  async createOutboundCall(params: CreateCallParams) {
    checkCircuitBreaker();
    try {
      const payload: any = {
        assistantId: params.assistantId,
        phoneNumberId: params.phoneNumberId,
        customer: {
          number: params.customer.number,
          name: params.customer.name
        }
      };

      // NOTE: idempotencyKey was removed - Vapi API rejects this field with:
      // "property idempotencyKey should not exist"

      // Add assistantOverrides for lead personalization (variableValues + metadata + firstMessage)
      if (params.assistantOverrides) {
        payload.assistantOverrides = {};
        if (params.assistantOverrides.variableValues) {
          payload.assistantOverrides.variableValues = params.assistantOverrides.variableValues;
        }
        if (params.assistantOverrides.metadata) {
          payload.assistantOverrides.metadata = params.assistantOverrides.metadata;
        }
        if (params.assistantOverrides.firstMessage) {
          payload.assistantOverrides.firstMessage = params.assistantOverrides.firstMessage;
        }
      }

      const response = await this.client.post('/call/phone', payload);
      recordSuccess();
      return response.data;
    } catch (error) {
      recordFailure();
      console.error('[VapiClient] Failed to create outbound call:', error);
      throw error;
    }
  }

  async getCall(callId: string) {
    try {
      const response = await this.client.get(`/call/${callId}`);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to get call:', error);
      throw error;
    }
  }

  async createWebSocketCall(params: {
    assistantId: string;
    audioFormat: {
      format: 'pcm_s16le' | 'mulaw';
      container: 'raw';
      sampleRate: number;
    };
  }) {
    checkCircuitBreaker();
    try {
      const payload = {
        assistantId: params.assistantId,
        transport: {
          provider: 'vapi.websocket',
          audioFormat: params.audioFormat
        }
      };

      const response = await this.client.post('/call', payload);
      recordSuccess();
      return response.data;
    } catch (error) {
      recordFailure();
      console.error('[VapiClient] Failed to create WebSocket call:', error);
      throw error;
    }
  }

  async endCall(callId: string) {
    try {
      const response = await this.client.delete(`/call/${callId}`);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to end call:', error);
      throw error;
    }
  }

  async listCalls(limit: number = 50) {
    try {
      const response = await this.client.get('/call', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to list calls:', error);
      throw error;
    }
  }

  // ========== PHONE NUMBERS ==========

  async createVapiPhoneNumber(name: string = 'Default Outbound Number') {
    try {
      const payload = {
        provider: 'vapi',
        name: name
      };

      const response = await this.client.post('/phone-number', payload);
      console.log('[VapiClient] Created Vapi phone number:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to create Vapi phone number:', error);
      throw error;
    }
  }

  async importTwilioNumber(params: ImportTwilioParams) {
    try {
      const payload = {
        provider: 'twilio',
        number: params.phoneNumber,
        twilioAccountSid: params.twilioAccountSid,
        twilioAuthToken: params.twilioAuthToken
      };

      const response = await this.client.post('/phone-number', payload);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to import Twilio number:', error);
      throw error;
    }
  }

  async getPhoneNumber(phoneNumberId: string) {
    try {
      const response = await this.client.get(`/phone-number/${phoneNumberId}`);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to get phone number:', error);
      throw error;
    }
  }

  async listPhoneNumbers() {
    try {
      const response = await this.client.get('/phone-number');
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to list phone numbers:', error);
      throw error;
    }
  }

  async updatePhoneNumber(phoneNumberId: string, updates: any) {
    try {
      const response = await this.client.patch(`/phone-number/${phoneNumberId}`, updates);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to update phone number:', error);
      throw error;
    }
  }

  async deletePhoneNumber(phoneNumberId: string) {
    try {
      const response = await this.client.delete(`/phone-number/${phoneNumberId}`);
      return response.data;
    } catch (error) {
      console.error('[VapiClient] Failed to delete phone number:', error);
      throw error;
    }
  }

  // Get default demo delivery function definitions
  public getDefaultDemoFunctions() {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:3000';

    return [
      {
        name: 'send_demo_email',
        description: 'Send a demo video via email to a prospect',
        parameters: {
          type: 'object',
          properties: {
            prospect_name: {
              type: 'string',
              description: 'The prospect\'s full name'
            },
            prospect_email: {
              type: 'string',
              description: 'The prospect\'s email address'
            },
            clinic_name: {
              type: 'string',
              description: 'The name of their clinic or practice'
            },
            demo_type: {
              type: 'string',
              enum: ['outbound_intro', 'inbound_intro', 'feature_overview'],
              description: 'Type of demo to send'
            },
            agent_id: {
              type: 'string',
              description: 'The ID of the calling agent'
            },
            call_id: {
              type: 'string',
              description: 'The current call ID (optional)'
            }
          },
          required: ['prospect_name', 'prospect_email', 'clinic_name', 'demo_type', 'agent_id']
        },
        // server: {
        //   url: `${baseUrl}/api/demo/send-email`,
        //   method: 'POST'
        // }
      },
      {
        name: 'send_demo_whatsapp',
        description: 'Send a demo video via WhatsApp to a prospect',
        parameters: {
          type: 'object',
          properties: {
            prospect_name: {
              type: 'string',
              description: 'The prospect\'s full name'
            },
            prospect_phone: {
              type: 'string',
              description: 'The prospect\'s phone number with country code'
            },
            clinic_name: {
              type: 'string',
              description: 'The name of their clinic or practice'
            },
            demo_type: {
              type: 'string',
              enum: ['outbound_intro', 'inbound_intro', 'feature_overview'],
              description: 'Type of demo to send'
            },
            agent_id: {
              type: 'string',
              description: 'The ID of the calling agent'
            },
            call_id: {
              type: 'string',
              description: 'The current call ID (optional)'
            }
          },
          required: ['prospect_name', 'prospect_phone', 'clinic_name', 'demo_type', 'agent_id']
        },
        // server: {
        //   url: `${baseUrl}/api/demo/send-whatsapp`,
        //   method: 'POST'
        // }
      },
      {
        name: 'send_demo_sms',
        description: 'Send a demo video via SMS to a prospect',
        parameters: {
          type: 'object',
          properties: {
            prospect_name: {
              type: 'string',
              description: 'The prospect\'s full name'
            },
            prospect_phone: {
              type: 'string',
              description: 'The prospect\'s phone number with country code'
            },
            clinic_name: {
              type: 'string',
              description: 'The name of their clinic or practice'
            },
            demo_type: {
              type: 'string',
              enum: ['outbound_intro', 'inbound_intro', 'feature_overview'],
              description: 'Type of demo to send'
            },
            agent_id: {
              type: 'string',
              description: 'The ID of the calling agent'
            },
            call_id: {
              type: 'string',
              description: 'The current call ID (optional)'
            }
          },
          required: ['prospect_name', 'prospect_phone', 'clinic_name', 'demo_type', 'agent_id']
        },
        // server: {
        //   url: `${baseUrl}/api/demo/send-sms`,
        //   method: 'POST'
        // }
      }
    ];
  }
}

export default VapiClient;
