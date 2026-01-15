/**
 * Unit Tests for Health Check Endpoint
 * Tests health check functionality and service status reporting
 */

import request from 'supertest';
import express from 'express';
import { healthRouter } from '../../routes/health';
import { supabase } from '../../services/supabase-client';

// Mock dependencies
jest.mock('../../services/supabase-client');
jest.mock('openai');

describe('Health Check Endpoint', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Express app with health router
        app = express();
        app.use(healthRouter);

        // Mock OpenAI to return instance with apiKey for successful health checks
        const OpenAI = require('openai').OpenAI;
        OpenAI.mockImplementation(() => ({
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
        }));
    });

    describe('GET /health', () => {
        it('should return 200 when all services are healthy', async () => {
            // Mock successful database check
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: [{ id: 'org_123' }],
                        error: null,
                    }),
                }),
            });

            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                status: 'healthy',
                checks: {
                    database: true,
                    openai: true,
                },
            });
            expect(response.body.checks.timestamp).toBeDefined();
            expect(response.body.uptime).toBeGreaterThan(0);
        });

        it('should return 503 when database is unavailable', async () => {
            // Mock database error
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Connection failed' },
                    }),
                }),
            });

            const response = await request(app).get('/health');

            expect(response.status).toBe(503);
            expect(response.body).toMatchObject({
                status: 'degraded',
                checks: {
                    database: false,
                },
            });
        });

        it('should return 503 when OpenAI is unavailable', async () => {
            // Mock successful database
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: [{ id: 'org_123' }],
                        error: null,
                    }),
                }),
            });

            // Mock OpenAI initialization failure
            const OpenAI = require('openai').OpenAI;
            OpenAI.mockImplementation(() => {
                throw new Error('API key invalid');
            });

            const response = await request(app).get('/health');

            expect(response.status).toBe(503);
            expect(response.body).toMatchObject({
                status: 'degraded',
                checks: {
                    database: true,
                    openai: false,
                },
            });
        });

        it('should include uptime in response', async () => {
            // Mock successful checks
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: [{ id: 'org_123' }],
                        error: null,
                    }),
                }),
            });

            const response = await request(app).get('/health');

            expect(response.body.uptime).toBeDefined();
            expect(typeof response.body.uptime).toBe('number');
            expect(response.body.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should include timestamp in checks', async () => {
            // Mock successful checks
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: [{ id: 'org_123' }],
                        error: null,
                    }),
                }),
            });

            const response = await request(app).get('/health');

            expect(response.body.checks.timestamp).toBeDefined();
            expect(new Date(response.body.checks.timestamp).getTime()).toBeGreaterThan(0);
        });

        it('should handle database connection timeout', async () => {
            // Mock database timeout
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockRejectedValue(new Error('Connection timeout')),
                }),
            });

            const response = await request(app).get('/health');

            expect(response.status).toBe(503);
            expect(response.body.checks.database).toBe(false);
        });

        it('should return degraded status when any service fails', async () => {
            // Mock database success, OpenAI failure
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: [{ id: 'org_123' }],
                        error: null,
                    }),
                }),
            });

            const OpenAI = require('openai').OpenAI;
            OpenAI.mockImplementation(() => null);

            const response = await request(app).get('/health');

            expect(response.body.status).toBe('degraded');
            expect(response.status).toBe(503);
        });
    });

    describe('Health Check Performance', () => {
        it('should respond within reasonable time', async () => {
            // Mock successful checks
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: [{ id: 'org_123' }],
                        error: null,
                    }),
                }),
            });

            const startTime = Date.now();
            await request(app).get('/health');
            const duration = Date.now() - startTime;

            // Health check should complete in under 1 second
            expect(duration).toBeLessThan(1000);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null database response', async () => {
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                }),
            });

            const response = await request(app).get('/health');

            expect(response.status).toBe(503);
            expect(response.body.checks.database).toBe(false);
        });

        it('should handle unexpected errors gracefully', async () => {
            (supabase.from as jest.Mock).mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const response = await request(app).get('/health');

            expect(response.status).toBe(503);
            expect(response.body.checks.database).toBe(false);
        });
    });
});
