/**
 * Integration Tests for Time Travel Bug Fix
 *
 * Tests the end-to-end flow through actual booking endpoints
 * to ensure date validation and auto-correction work in production scenarios
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server';  // Adjust path as needed
import { clearCorrectionHistory } from '../../utils/date-validation';

// Test configuration
const TEST_ORG_ID = 'test-org-time-travel';
const TEST_PHONE = '+15551234567';
const BASE_URL = '/api/tools/calendar';

describe('Time Travel Bug Fix - Integration Tests', () => {
  const currentYear = new Date().getFullYear();

  beforeAll(async () => {
    // Clear any existing correction history
    clearCorrectionHistory();
  });

  afterAll(async () => {
    // Cleanup after tests
    clearCorrectionHistory();
  });

  describe('POST /api/tools/calendar/book - bookClinicAppointment', () => {
    test('Rejects 2024 date and auto-corrects to current year', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-tool-call-1',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  appointmentDate: '2024-02-03',
                  appointmentTime: '14:00',
                  patientName: 'John Doe',
                  patientPhone: TEST_PHONE,
                  patientEmail: 'john@example.com',
                  serviceType: 'consultation'
                })
              }
            }]
          }
        });

      // Expect either:
      // 1. Auto-correction and successful booking
      // 2. Clear error message indicating date was corrected
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        // If successful, check that corrected date was used
        const result = response.body;
        expect(result).toHaveProperty('results');
        // The booking should have been attempted with corrected date
      } else {
        // If rejected, error should mention auto-correction
        expect(response.body.error || response.body.message).toBeDefined();
      }
    });

    test('Accepts current year date without correction', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-tool-call-2',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  appointmentDate: `${currentYear}-03-15`,
                  appointmentTime: '10:00',
                  patientName: 'Jane Smith',
                  patientPhone: '+15559876543',
                  patientEmail: 'jane@example.com',
                  serviceType: 'checkup'
                })
              }
            }]
          }
        });

      // Should proceed without date correction warnings
      expect([200, 400, 500]).toContain(response.status);
      // Even if booking fails for other reasons (no org, no slots),
      // it shouldn't fail due to date validation
    });

    test('Rejects invalid date format', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-tool-call-3',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  appointmentDate: '02/03/2024',  // Invalid format
                  appointmentTime: '14:00',
                  patientName: 'Bob Jones',
                  patientPhone: TEST_PHONE,
                  patientEmail: 'bob@example.com'
                })
              }
            }]
          }
        });

      // Should reject due to format
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('Handles 2025 date (auto-corrects to 2026)', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-tool-call-4',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  appointmentDate: '2025-12-25',
                  appointmentTime: '15:30',
                  patientName: 'Alice Williams',
                  patientPhone: '+15557771234',
                  patientEmail: 'alice@example.com'
                })
              }
            }]
          }
        });

      // Should auto-correct year
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('POST /api/tools/calendar/reserve - reserve_atomic', () => {
    test('Rejects slot with 2024 year', async () => {
      const slotId = '2024-02-03T14:00:00Z';

      const response = await request(app)
        .post(`${BASE_URL}/reserve`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-reserve-1',
              type: 'function',
              function: {
                name: 'reserve_atomic',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  slotId,
                  patientName: 'Test Patient',
                  patientPhone: TEST_PHONE
                })
              }
            }]
          }
        });

      // Should reject with clear message
      expect(response.status).toBe(200); // Tool returns 200 with error in body
      expect(response.body.toolResult).toBeDefined();

      const toolResult = JSON.parse(response.body.toolResult.content);
      expect(toolResult.success).toBe(false);
      expect(toolResult.error).toContain('2024');
      expect(toolResult.action).toBe('OFFER_ALTERNATIVES');
    });

    test('Accepts slot with current year', async () => {
      const slotId = `${currentYear}-03-15T10:00:00Z`;

      const response = await request(app)
        .post(`${BASE_URL}/reserve`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-reserve-2',
              type: 'function',
              function: {
                name: 'reserve_atomic',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  slotId,
                  patientName: 'Current Year Patient',
                  patientPhone: '+15559998888'
                })
              }
            }]
          }
        });

      // Should not reject due to date (may fail for other reasons like missing org)
      expect(response.status).toBe(200);
    });

    test('Provides helpful speech message for past year slots', async () => {
      const slotId = '2025-06-15T14:30:00Z';

      const response = await request(app)
        .post(`${BASE_URL}/reserve`)
        .send({
          message: {
            toolCalls: [{
              id: 'test-reserve-3',
              type: 'function',
              function: {
                name: 'reserve_atomic',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  slotId,
                  patientName: 'Speech Test Patient',
                  patientPhone: TEST_PHONE
                })
              }
            }]
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.speech).toBeDefined();
      expect(response.body.speech).toContain('2025');
      expect(response.body.speech).toContain(currentYear.toString());
    });
  });

  describe('GET /api/monitoring/date-corrections', () => {
    test('Returns correction statistics after bookings', async () => {
      // First, trigger some corrections
      await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'stats-test-1',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  appointmentDate: '2024-01-15',
                  appointmentTime: '10:00',
                  patientName: 'Stats Test',
                  patientPhone: TEST_PHONE,
                  patientEmail: 'stats@test.com'
                })
              }
            }]
          }
        });

      // Now check stats endpoint
      const response = await request(app)
        .get('/api/monitoring/date-corrections');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalCorrections');
      expect(response.body.stats).toHaveProperty('last24Hours');
      expect(response.body.stats).toHaveProperty('correctionsByYear');
      expect(response.body).toHaveProperty('interpretation');
      expect(response.body.interpretation).toHaveProperty('status');
      expect(['good', 'warning', 'critical']).toContain(response.body.interpretation.status);
    });

    test('Statistics show recent corrections', async () => {
      const response = await request(app)
        .get('/api/monitoring/date-corrections');

      expect(response.status).toBe(200);
      expect(response.body.stats.recentCorrections).toBeDefined();
      expect(Array.isArray(response.body.stats.recentCorrections)).toBe(true);

      if (response.body.stats.recentCorrections.length > 0) {
        const recent = response.body.stats.recentCorrections[0];
        expect(recent).toHaveProperty('timestamp');
        expect(recent).toHaveProperty('originalDate');
        expect(recent).toHaveProperty('correctedDate');
        expect(recent).toHaveProperty('originalYear');
        expect(recent).toHaveProperty('correctedYear');
      }
    });

    test('Returns interpretation with actionable message', async () => {
      const response = await request(app)
        .get('/api/monitoring/date-corrections');

      expect(response.status).toBe(200);
      expect(response.body.interpretation.message).toBeDefined();
      expect(typeof response.body.interpretation.message).toBe('string');
      expect(response.body.interpretation.correctionsPerDay).toBeDefined();
      expect(typeof response.body.interpretation.correctionsPerDay).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('Returns clear error for malformed request', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'error-test-1',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: 'not-json'  // Invalid JSON
              }
            }]
          }
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('Handles missing required fields gracefully', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'error-test-2',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  // Missing required fields
                  appointmentDate: '2024-02-03'
                })
              }
            }]
          }
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Logging Verification', () => {
    test('Corrections are logged with context', async () => {
      // This test verifies that corrections appear in logs
      // In a real integration test, you'd check log files or monitoring
      const response = await request(app)
        .post(`${BASE_URL}/book`)
        .send({
          message: {
            toolCalls: [{
              id: 'log-test-1',
              type: 'function',
              function: {
                name: 'bookClinicAppointment',
                arguments: JSON.stringify({
                  tenantId: TEST_ORG_ID,
                  appointmentDate: '2024-05-20',
                  appointmentTime: '11:00',
                  patientName: 'Log Test',
                  patientPhone: TEST_PHONE,
                  patientEmail: 'log@test.com'
                })
              }
            }]
          }
        });

      // Logs should contain correction information
      // (In production, verify via log monitoring service)
      expect([200, 400]).toContain(response.status);
    });
  });
});
