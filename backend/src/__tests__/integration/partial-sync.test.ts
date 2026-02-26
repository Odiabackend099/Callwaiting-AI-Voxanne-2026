import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies BEFORE importing the router
jest.mock('../../services/supabase-client', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
        auth: { getUser: jest.fn() }
    }
}));

jest.mock('../../services/vapi-client', () => {
    return {
        VapiClient: jest.fn().mockImplementation(() => ({
            updateAssistant: jest.fn(),
            createAssistant: jest.fn()
        }))
    };
});

jest.mock('../../services/secrets-manager', () => ({
    storeApiKey: jest.fn(),
    getApiKey: jest.fn().mockResolvedValue('test-api-key')
}));

jest.mock('../../middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user', orgId: 'test-org' };
        next();
    },
    requireAuthOrDev: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user', orgId: 'test-org' };
        next();
    }
}));

jest.mock('../../services/logger', () => ({
    createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
    log: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

jest.mock('../../middleware/rate-limit', () => ({
    agentConfigLimiter: (req: any, res: any, next: any) => next(),
    configRateLimiter: (req: any, res: any, next: any) => next(),
    callCreationLimiter: (req: any, res: any, next: any) => next(),
    voicePreviewLimiter: (req: any, res: any, next: any) => next()
}));

jest.mock('../../services/web-voice-bridge', () => ({
    createWebVoiceSession: jest.fn(),
    endWebVoiceSession: jest.fn()
}));

jest.mock('../../services/csv-import-service', () => ({
    validateCsv: jest.fn(),
    importCsvLeads: jest.fn(),
    getImportStatus: jest.fn(),
    getImportErrors: jest.fn(),
    listImports: jest.fn(),
    generateErrorCsv: jest.fn()
}));

jest.mock('../../routes/founder-console-settings', () => ({
    getIntegrationSettings: jest.fn()
}));

jest.mock('../../routes/phone-numbers', () => ({
    phoneNumbersRouter: (req: any, res: any, next: any) => next()
}));

// Import router after mocks
import founderConsoleRouter from '../../routes/founder-console-v2';
import { supabase } from '../../services/supabase-client';
import { VapiClient } from '../../services/vapi-client';

const app = express();
app.use(express.json());
// Add a middleware to inject requestId since the router expects it
app.use((req: any, res, next) => {
    req.requestId = 'test-request-id';
    next();
});
app.use('/api/founder-console', founderConsoleRouter);

describe('Partial Sync Failure Handling', () => {
    const mockSupabase = supabase as any;
    const MockVapiClient = VapiClient as unknown as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        // Default Supabase Mock
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'agents') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [
                            { id: 'inbound-agent-id', role: 'inbound', vapi_assistant_id: 'vapi-inbound' },
                            { id: 'outbound-agent-id', role: 'outbound', vapi_assistant_id: 'vapi-outbound' }
                        ],
                        error: null
                    }),
                    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
                    update: jest.fn().mockReturnThis()
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: {}, error: null })
            };
        });
    });

    it('should fail with 500 if ANY agent fails to sync', async () => {
        // Setup VapiClient to fail for outbound agent
        MockVapiClient.mockImplementation(() => ({
            updateAssistant: jest.fn().mockImplementation(((id: string) => {
                if (id === 'vapi-outbound') {
                    return Promise.reject(new Error('Simulated Vapi Error'));
                }
                return Promise.resolve({ id });
            }) as any),
            createAssistant: jest.fn().mockResolvedValue({ id: 'new-id' } as any)
        }));

        const response = await request(app)
            .post('/api/founder-console/agent/behavior')
            .send({
                inbound: {
                    systemPrompt: 'System Prompt Inbound',
                    firstMessage: 'Hello',
                    voice: 'alloy',
                    language: 'en-US',
                    maxDuration: 600
                },
                outbound: {
                    systemPrompt: 'System Prompt Outbound',
                    firstMessage: 'Hi there',
                    voice: 'echo',
                    language: 'en-US',
                    maxDuration: 600
                }
            });

        // Expect 500 Internal Server Error (Verified Fix)
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Failed to sync 1 agent(s) to Vapi');
        expect(response.body.details).toBeDefined();
        expect(response.body.details.failed).toHaveLength(1);
        expect(response.body.details.failed[0].error).toContain('Simulated Vapi Error');
        expect(response.body.details.succeeded).toHaveLength(1);
    });

    it('should succeed with 200 if ALL agents sync successfully', async () => {
        // Setup VapiClient to succeed
        MockVapiClient.mockImplementation(() => ({
            updateAssistant: jest.fn().mockResolvedValue({ id: 'synced-id' } as any),
            createAssistant: jest.fn().mockResolvedValue({ id: 'created-id' } as any)
        }));

        const response = await request(app)
            .post('/api/founder-console/agent/behavior')
            .send({
                inbound: {
                    systemPrompt: 'Inbound',
                    firstMessage: 'Hi',
                    voice: 'alloy',
                    language: 'en-US',
                    maxDuration: 600
                },
                outbound: {
                    systemPrompt: 'Outbound',
                    firstMessage: 'Hello',
                    voice: 'echo',
                    language: 'en-US',
                    maxDuration: 600
                }
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
