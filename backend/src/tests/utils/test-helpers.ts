/**
 * Test Helpers - Shared utilities for unit and integration tests
 * Provides factory functions and assertion helpers for consistent test setup
 */

import { jest } from '@jest/globals';

/**
 * Creates a mocked Supabase client with configurable responses
 */
export function createMockSupabaseClient() {
  return {
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    })),
    // @ts-ignore - jest.fn strict mode typing issue
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  };
}

/**
 * Creates a mocked VAPI client with all necessary methods
 */
export function createMockVapiClient() {
  return {
    assistants: {
      // @ts-ignore - jest.fn strict mode typing issue
      create: jest.fn().mockResolvedValue({
        id: 'asst_mock_123',
        name: 'Test Assistant',
        model: 'gpt-4',
      }),
      // @ts-ignore - jest.fn strict mode typing issue
      get: jest.fn().mockResolvedValue({
        id: 'asst_mock_123',
        name: 'Test Assistant',
        model: 'gpt-4',
      }),
      // @ts-ignore - jest.fn strict mode typing issue
      update: jest.fn().mockResolvedValue({
        id: 'asst_mock_123',
        name: 'Test Assistant Updated',
        model: 'gpt-4',
      }),
      // @ts-ignore - jest.fn strict mode typing issue
      delete: jest.fn().mockResolvedValue({ success: true }),
      // @ts-ignore - jest.fn strict mode typing issue
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'asst_mock_123',
            name: 'Test Assistant',
          },
        ],
      }),
    },
    calls: {
      // @ts-ignore - jest.fn strict mode typing issue
      get: jest.fn().mockResolvedValue({
        id: 'call_mock_123',
        status: 'ended',
        duration: 45,
      }),
      // @ts-ignore - jest.fn strict mode typing issue
      list: jest.fn().mockResolvedValue({
        data: [],
      }),
    },
  };
}

/**
 * Creates a realistic mock call payload for testing analytics
 */
export function createMockCallPayload(overrides = {}) {
  return {
    call: {
      id: 'call_mock_' + Math.random().toString(36).slice(2, 9),
      orgId: 'org_mock_123',
      assistantId: 'asst_mock_123',
      customerId: 'cust_mock_123',
      status: 'ended',
      durationSeconds: 120,
      startedAt: new Date(Date.now() - 600000).toISOString(),
      endedAt: new Date().toISOString(),
    },
    transcript: 'Customer: Hi, I am interested in a facelift. Assistant: Great! We have excellent facelift services.',
    summary: 'Customer inquired about facelift procedures and pricing.',
    recordingUrl: 'https://recordings.vapi.ai/call_mock_123.wav',
    analysis: {
      sentiment: 'positive',
      summary: 'Positive inquiry about facelift',
    },
    toolCalls: [
      {
        function: {
          name: 'checkSlotAvailability',
          arguments: { date: '2026-02-01' },
        },
        result: { available: true },
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock organization object
 */
export function createMockOrganization(overrides = {}) {
  return {
    id: 'org_mock_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Clinic',
    slug: 'test-clinic',
    type: 'medical_practice',
    status: 'active',
    plan: 'professional',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    settings: {
      timezone: 'GMT',
      language: 'en',
    },
    ...overrides,
  };
}

/**
 * Creates mock VAPI credentials
 */
export function createMockVapiCredentials(overrides = {}) {
  return {
    apiKey: 'sk_test_vapi_' + Math.random().toString(36).slice(2, 9),
    webhookSecret: 'whs_test_' + Math.random().toString(36).slice(2, 9),
    publicKey: 'pk_test_vapi_' + Math.random().toString(36).slice(2, 9),
    ...overrides,
  };
}

/**
 * Creates mock Twilio credentials
 */
export function createMockTwilioCredentials(overrides = {}) {
  return {
    accountSid: 'ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p',
    authToken: 'authtoken1234567890abcdefghijklmn',
    phoneNumber: '+12025551234',
    ...overrides,
  };
}

/**
 * Helper to wait for async operations in tests
 */
export async function waitForAsync(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to simulate race conditions by executing multiple promises concurrently
 */
export async function simulateConcurrentOperations<T>(
  operation: (index: number) => Promise<T>,
  count: number
): Promise<T[]> {
  const promises = Array.from({ length: count }, (_, i) => operation(i));
  return Promise.all(promises);
}

/**
 * Creates a mock webhook signature for testing webhook validation
 */
export function createMockWebhookSignature(payload: string, secret: string): string {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Helper to clear all mock call history and implementation
 */
export function clearAllMocks(): void {
  jest.clearAllMocks();
  jest.resetAllMocks();
}

/**
 * Helper to assert that a mock was called with specific arguments
 */
export function expectMockCalledWith(mockFn: jest.Mock, args: any[]): void {
  expect(mockFn).toHaveBeenCalledWith(...args);
}

/**
 * Creates a mock RedactionService for testing
 */
export function createMockRedactionService() {
  return {
    redact: jest.fn((text: string) => {
      // Simple mock: replace email addresses
      return text.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[REDACTED_EMAIL]');
    }),
    redactPhoneNumber: jest.fn((phone: string) => '[REDACTED_PHONE]'),
    redactAddress: jest.fn((address: string) => '[REDACTED_ADDRESS]'),
  };
}

/**
 * Creates a mock IntegrationDecryptor for testing
 */
export function createMockIntegrationDecryptor() {
  const mockVapiCreds = createMockVapiCredentials();
  const mockTwilioCreds = createMockTwilioCredentials();
  return {
    // @ts-ignore - jest.fn strict mode typing issue
    getVapiCredentials: jest.fn().mockResolvedValue(mockVapiCreds),
    // @ts-ignore - jest.fn strict mode typing issue
    getTwilioCredentials: jest.fn().mockResolvedValue(mockTwilioCreds),
    // @ts-ignore - jest.fn strict mode typing issue
    registerAssistantMapping: jest.fn().mockResolvedValue(true),
    // @ts-ignore - jest.fn strict mode typing issue
    resolveOrgFromAssistant: jest.fn().mockResolvedValue('org_mock_123'),
  };
}

/**
 * Helper to verify multi-tenant isolation
 */
export function assertMultiTenantIsolation(data: any, expectedOrgId: string): void {
  expect(data).toHaveProperty('org_id', expectedOrgId);
  expect(data.org_id).toBe(expectedOrgId);
}

/**
 * Helper to verify no sensitive data in output
 */
export function assertNoPIIInOutput(output: string): void {
  const piiPatterns = [
    /[\w\.-]+@[\w\.-]+\.\w+/, // emails
    /\+?1?\d{9,15}/, // phone numbers
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  ];

  piiPatterns.forEach((pattern) => {
    expect(output).not.toMatch(pattern);
  });
}

/**
 * Helper to create a mock logger for testing
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}
