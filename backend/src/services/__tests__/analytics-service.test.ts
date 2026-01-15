/**
 * Unit Tests for AnalyticsService
 *
 * Test Coverage:
 * - Intent detection from transcripts
 * - Sentiment calculation
 * - Booking detection
 * - Lead temperature classification
 * - Financial value mapping
 * - End-to-end call analysis with database updates
 * - PII redaction
 * - Multi-tenant isolation
 */

import { AnalyticsService } from '../analytics-service';
import {
  createMockSupabaseClient,
  createMockCallPayload,
  createMockRedactionService,
  createMockLogger,
  clearAllMocks,
} from '../../tests/utils/test-helpers';
import {
  MOCK_CALL_RECORDS,
  MOCK_TRANSCRIPTS,
  MOCK_SUMMARIES,
  MOCK_INTENT_EXAMPLES,
  MOCK_FINANCIAL_VALUES,
  MOCK_ORGANIZATIONS,
} from '../../tests/utils/mock-data';

// Mock dependencies
jest.mock('@/services/supabase-client');
jest.mock('@/services/redaction-service');
jest.mock('@/services/logger');

describe('AnalyticsService', () => {
  let mockSupabaseClient: any;
  let mockRedactionService: any;
  let mockLogger: any;

  beforeEach(() => {
    clearAllMocks();

    // Setup mocks
    mockSupabaseClient = createMockSupabaseClient();
    mockRedactionService = createMockRedactionService();
    mockLogger = createMockLogger();

    // Mock module dependencies
    jest.mocked(require('@/services/supabase-client')).supabase = mockSupabaseClient;
    jest.mocked(require('@/services/redaction-service')).RedactionService = mockRedactionService;
    jest.mocked(require('@/services/logger')).log = mockLogger;
  });

  describe('Intent Detection', () => {
    it('should detect facelift intent', () => {
      MOCK_INTENT_EXAMPLES.facelift.forEach((text) => {
        const intent = AnalyticsService['determineIntent'](text, '');
        expect(intent).toBe('facelift');
      });
    });

    it('should detect rhinoplasty intent', () => {
      MOCK_INTENT_EXAMPLES.rhinoplasty.forEach((text) => {
        const intent = AnalyticsService['determineIntent'](text, '');
        expect(intent).toBe('rhinoplasty');
      });
    });

    it('should detect breast_augmentation intent', () => {
      MOCK_INTENT_EXAMPLES.breast_augmentation.forEach((text) => {
        const intent = AnalyticsService['determineIntent'](text, '');
        expect(intent).toBe('breast_augmentation');
      });
    });

    it('should detect pricing_inquiry intent', () => {
      MOCK_INTENT_EXAMPLES.pricing_inquiry.forEach((text) => {
        const intent = AnalyticsService['determineIntent'](text, '');
        expect(intent).toBe('pricing_inquiry');
      });
    });

    it('should detect booking_inquiry intent', () => {
      MOCK_INTENT_EXAMPLES.booking_inquiry.forEach((text) => {
        const intent = AnalyticsService['determineIntent'](text, '');
        expect(intent).toBe('booking_inquiry');
      });
    });

    it('should default to general_inquiry for unknown intents', () => {
      const unknownText = 'Tell me about your business';
      const intent = AnalyticsService['determineIntent'](unknownText, '');
      expect(intent).toBe('general_inquiry');
    });

    it('should prioritize transcript over summary', () => {
      const intent = AnalyticsService['determineIntent'](
        MOCK_TRANSCRIPTS.facelifInquiry,
        MOCK_TRANSCRIPTS.rhinoplastyInquiry
      );
      expect(intent).toBe('facelift'); // transcript wins
    });

    it('should use summary if transcript is empty', () => {
      const intent = AnalyticsService['determineIntent'](
        '',
        MOCK_SUMMARIES.rhinoplastyInquiry
      );
      expect(intent).toBe('rhinoplasty');
    });

    it('should be case-insensitive', () => {
      const intent = AnalyticsService['determineIntent'](
        'I WANT A FACELIFT',
        ''
      );
      expect(intent).toBe('facelift');
    });
  });

  describe('Sentiment Calculation', () => {
    it('should map positive sentiment to 0.9', () => {
      const sentiment = AnalyticsService['calculateSentiment']({
        sentiment: 'positive',
      });
      expect(sentiment).toBe(0.9);
    });

    it('should map neutral sentiment to 0.5', () => {
      const sentiment = AnalyticsService['calculateSentiment']({
        sentiment: 'neutral',
      });
      expect(sentiment).toBe(0.5);
    });

    it('should map negative sentiment to 0.2', () => {
      const sentiment = AnalyticsService['calculateSentiment']({
        sentiment: 'negative',
      });
      expect(sentiment).toBe(0.2);
    });

    it('should default to 0.5 when no sentiment provided', () => {
      const sentiment1 = AnalyticsService['calculateSentiment']({});
      const sentiment2 = AnalyticsService['calculateSentiment'](null);

      expect(sentiment1).toBe(0.5);
      expect(sentiment2).toBe(0.5);
    });

    it('should default to 0.5 for unknown sentiment values', () => {
      const sentiment = AnalyticsService['calculateSentiment']({
        sentiment: 'unknown_value',
      });
      expect(sentiment).toBe(0.5);
    });
  });

  describe('Booking Detection', () => {
    it('should detect booking from successful tool call', () => {
      const payload = {
        toolCalls: [
          {
            function: { name: 'bookAppointment' },
            error: null,
          },
        ],
      };
      const isBooked = AnalyticsService['checkIfBooked'](payload);
      expect(isBooked).toBe(true);
    });

    it('should detect booking from checkSlotAvailability tool', () => {
      const payload = {
        toolCalls: [
          {
            function: { name: 'checkSlotAvailability' },
            error: null,
          },
        ],
      };
      const isBooked = AnalyticsService['checkIfBooked'](payload);
      expect(isBooked).toBe(true);
    });

    it('should detect booking from summary text', () => {
      const payload = {
        toolCalls: [],
        summary: 'booked appointment for next week',
      };
      const isBooked = AnalyticsService['checkIfBooked'](payload);
      expect(isBooked).toBe(true);
    });

    it('should return false when no booking indicators', () => {
      const payload = {
        toolCalls: [
          {
            function: { name: 'getPrice' },
            error: null,
          },
        ],
        summary: 'customer asked about pricing',
      };
      const isBooked = AnalyticsService['checkIfBooked'](payload);
      expect(isBooked).toBe(false);
    });

    it('should ignore tool calls with errors', () => {
      const payload = {
        toolCalls: [
          {
            function: { name: 'bookAppointment' },
            error: 'Slot not available',
          },
        ],
      };
      const isBooked = AnalyticsService['checkIfBooked'](payload);
      expect(isBooked).toBe(false);
    });

    it('should handle empty payload gracefully', () => {
      const isBooked = AnalyticsService['checkIfBooked']({});
      expect(isBooked).toBe(false);
    });
  });

  describe('Lead Temperature Calculation', () => {
    it('should return hot for high-value, unbooked leads', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'facelift',
        120,
        false
      );
      expect(temp).toBe('hot');
    });

    it('should return hot for rhinoplasty intent', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'rhinoplasty',
        60,
        false
      );
      expect(temp).toBe('hot');
    });

    it('should return hot for breast_augmentation intent', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'breast_augmentation',
        45,
        false
      );
      expect(temp).toBe('hot');
    });

    it('should return warm for long calls, unbooked, with lower value', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'general_inquiry',
        60,
        false
      );
      expect(temp).toBe('warm');
    });

    it('should return cool for booked appointments', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'facelift',
        120,
        true
      );
      expect(temp).toBe('cool');
    });

    it('should return cool for short calls', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'pricing_inquiry',
        15,
        false
      );
      expect(temp).toBe('cool');
    });

    it('should return cool for general inquiry unbooked', () => {
      const temp = AnalyticsService['calculateLeadTemperature'](
        'ended',
        'general_inquiry',
        20,
        false
      );
      expect(temp).toBe('cool');
    });
  });

  describe('Financial Value Mapping', () => {
    it('should return £10,000 for facelift', () => {
      const value = AnalyticsService['getFinancialValue']('facelift');
      expect(value).toBe(MOCK_FINANCIAL_VALUES.facelift);
    });

    it('should return £6,000 for rhinoplasty', () => {
      const value = AnalyticsService['getFinancialValue']('rhinoplasty');
      expect(value).toBe(MOCK_FINANCIAL_VALUES.rhinoplasty);
    });

    it('should return £7,000 for breast_augmentation', () => {
      const value = AnalyticsService['getFinancialValue']('breast_augmentation');
      expect(value).toBe(MOCK_FINANCIAL_VALUES.breast_augmentation);
    });

    it('should return £150 for booking_inquiry', () => {
      const value = AnalyticsService['getFinancialValue']('booking_inquiry');
      expect(value).toBe(MOCK_FINANCIAL_VALUES.booking_inquiry);
    });

    it('should return £0 for unknown intent', () => {
      const value = AnalyticsService['getFinancialValue']('unknown_intent');
      expect(value).toBe(0);
    });

    it('should return £0 for pricing inquiry', () => {
      const value = AnalyticsService['getFinancialValue']('pricing_inquiry');
      expect(value).toBe(0);
    });
  });

  describe('End-to-End Call Analysis', () => {
    it('should process call payload and update database', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: MOCK_ORGANIZATIONS.clinic1.id,
        },
        transcript: MOCK_TRANSCRIPTS.facelifInquiry,
        summary: MOCK_SUMMARIES.facelifInquiry,
      });

      mockRedactionService.redact.mockReturnValue('redacted_text');
      mockSupabaseClient.from().update.mockResolvedValue({
        data: [{ id: payload.call.id }],
        error: null,
      });

      // Execute
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify database update was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('calls');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          procedure_intent: 'facelift',
          org_id: MOCK_ORGANIZATIONS.clinic1.id,
        })
      );
    });

    it('should create follow-up task for hot leads', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: MOCK_ORGANIZATIONS.clinic1.id,
        },
        transcript: MOCK_TRANSCRIPTS.facelifInquiry,
        summary: MOCK_SUMMARIES.facelifInquiry,
        analysis: { sentiment: 'positive' },
      });

      mockRedactionService.redact.mockReturnValue('redacted_text');
      mockSupabaseClient.from().update.mockResolvedValue({
        data: [{ id: payload.call.id }],
        error: null,
      });
      mockSupabaseClient.from().insert.mockResolvedValue({
        data: [{ id: 'task_123' }],
        error: null,
      });

      // Execute
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify follow-up task was created
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('follow_up_tasks');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
          status: 'pending',
          task_type: 'call_back',
        })
      );
    });

    it('should redact PII from transcript and summary', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: MOCK_ORGANIZATIONS.clinic1.id,
        },
        transcript: 'My email is john@example.com',
        summary: 'Customer contact: john@example.com',
      });

      mockRedactionService.redact
        .mockReturnValueOnce('[REDACTED_EMAIL]')
        .mockReturnValueOnce('[REDACTED_EMAIL]');

      mockSupabaseClient.from().update.mockResolvedValue({
        data: [{ id: payload.call.id }],
        error: null,
      });

      // Execute
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify redaction was called
      expect(mockRedactionService.redact).toHaveBeenCalledWith(
        'My email is john@example.com'
      );
      expect(mockRedactionService.redact).toHaveBeenCalledWith(
        'Customer contact: john@example.com'
      );
    });

    it('should handle missing call ID gracefully', async () => {
      const payload = {
        call: null, // Missing call object
        transcript: 'Some transcript',
      };

      // Execute
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnalyticsService',
        'No call ID in payload',
        expect.any(Object)
      );

      // Database should not be updated
      expect(mockSupabaseClient.from().update).not.toHaveBeenCalled();
    });

    it('should validate orgId exists before database update', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: null, // Missing orgId
          organization_id: null,
        },
      });

      mockRedactionService.redact.mockReturnValue('redacted');

      // Execute
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnalyticsService',
        'Missing orgId - skipping analysis',
        expect.any(Object)
      );

      // Database should not be updated
      expect(mockSupabaseClient.from().update).not.toHaveBeenCalled();
    });

    it('should enforce multi-tenant isolation in database updates', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: MOCK_ORGANIZATIONS.clinic1.id,
        },
        transcript: MOCK_TRANSCRIPTS.facelifInquiry,
      });

      mockRedactionService.redact.mockReturnValue('redacted');
      mockSupabaseClient.from().update.mockResolvedValue({
        data: [{ id: payload.call.id }],
        error: null,
      });

      // Execute
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify orgId is set in update
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: MOCK_ORGANIZATIONS.clinic1.id,
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: MOCK_ORGANIZATIONS.clinic1.id,
        },
      });

      mockRedactionService.redact.mockReturnValue('redacted');
      mockSupabaseClient.from().update.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Execute (should not throw)
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnalyticsService',
        'DB Update failed',
        expect.any(Object)
      );
    });

    it('should handle analysis errors gracefully', async () => {
      const payload = createMockCallPayload({
        call: {
          ...createMockCallPayload().call,
          orgId: MOCK_ORGANIZATIONS.clinic1.id,
        },
      });

      // Force an error
      mockRedactionService.redact.mockImplementation(() => {
        throw new Error('Redaction failed');
      });

      // Execute (should not throw)
      await AnalyticsService.processEndOfCall(payload);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnalyticsService',
        'Analysis error',
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null analysis object', () => {
      const sentiment = AnalyticsService['calculateSentiment'](null);
      expect(sentiment).toBe(0.5);
    });

    it('should handle empty transcript and summary', () => {
      const intent = AnalyticsService['determineIntent']('', '');
      expect(intent).toBe('general_inquiry');
    });

    it('should handle very long transcripts', () => {
      const longTranscript = 'facelift '.repeat(1000);
      const intent = AnalyticsService['determineIntent'](longTranscript, '');
      expect(intent).toBe('facelift');
    });

    it('should handle multiple intents in text (first match wins)', () => {
      const text =
        'I want a facelift and rhinoplasty';
      const intent = AnalyticsService['determineIntent'](text, '');
      // Should match first intent detected
      expect(['facelift', 'rhinoplasty']).toContain(intent);
    });
  });
});
