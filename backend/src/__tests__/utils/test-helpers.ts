/**
 * Shared Test Utilities
 * Provides mock factories and helper functions for unit tests
 */

export interface MockSupabaseClient {
    from: jest.Mock;
    rpc: jest.Mock;
}

export interface MockVapiClient {
    getAssistant: jest.Mock;
    createAssistant: jest.Mock;
    updateAssistant: jest.Mock;
}

/**
 * Creates a mocked Supabase client with chainable methods
 */
export function createMockSupabaseClient(): MockSupabaseClient {
    const mockSelect = jest.fn().mockReturnThis();
    const mockInsert = jest.fn().mockReturnThis();
    const mockUpdate = jest.fn().mockReturnThis();
    const mockDelete = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

    const mockFrom = jest.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        eq: mockEq,
        single: mockSingle,
        maybeSingle: mockMaybeSingle,
    });

    const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

    return {
        from: mockFrom,
        rpc: mockRpc,
    };
}

/**
 * Creates a mocked VAPI client
 */
export function createMockVapiClient(): MockVapiClient {
    return {
        getAssistant: jest.fn().mockResolvedValue({ id: 'asst_123', name: 'Test Assistant' }),
        createAssistant: jest.fn().mockResolvedValue({ id: 'asst_new_123', name: 'New Assistant' }),
        updateAssistant: jest.fn().mockResolvedValue({ id: 'asst_123', name: 'Updated Assistant' }),
    };
}

/**
 * Creates a realistic call payload for testing analytics
 */
export function createMockCallPayload(overrides: Partial<any> = {}): any {
    return {
        call: {
            id: 'call_123',
            orgId: 'org_test_clinic',
            status: 'ended',
            durationSeconds: 180,
            customer: {
                id: 'contact_456',
                name: 'John Doe',
                phone: '+447700123456',
            },
            ...overrides.call,
        },
        transcript: overrides.transcript || 'Patient called about rhinoplasty consultation. Discussed pricing and availability.',
        summary: overrides.summary || 'Patient interested in rhinoplasty. Provided contact details.',
        recordingUrl: overrides.recordingUrl || 'https://example.com/recording.mp3',
        analysis: overrides.analysis || {
            sentiment: 'positive',
        },
        toolCalls: overrides.toolCalls || [],
        ...overrides,
    };
}

/**
 * Creates mock organization data
 */
export function createMockOrganization(overrides: Partial<any> = {}) {
    return {
        id: 'org_test_clinic',
        name: 'Test Medical Clinic',
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Creates mock VAPI credentials
 */
export function createMockVapiCredentials(overrides: Partial<any> = {}) {
    return {
        apiKey: 'sk_test_vapi_abc123',
        webhookSecret: 'whs_test_xyz789',
        ...overrides,
    };
}

/**
 * Creates mock Twilio credentials
 */
export function createMockTwilioCredentials(overrides: Partial<any> = {}) {
    return {
        accountSid: 'ACtest123',
        authToken: 'test_token_456',
        phoneNumber: '+442012345678',
        ...overrides,
    };
}

/**
 * Helper to wait for async operations in tests
 */
export async function waitForAsync(ms: number = 100): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock assistant configuration
 */
export function createMockAssistantConfig(overrides: Partial<any> = {}) {
    return {
        name: 'Test Assistant',
        systemPrompt: 'You are a helpful medical receptionist.',
        firstMessage: 'Hello! How can I help you today?',
        voiceId: 'jennifer',
        voiceProvider: 'vapi',
        modelProvider: 'openai',
        modelName: 'gpt-4',
        language: 'en',
        maxDurationSeconds: 600,
        ...overrides,
    };
}
