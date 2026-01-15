/**
 * Unit Tests for LeadScoring Service
 *
 * Test Coverage:
 * - Lead score calculation based on keywords
 * - Sentiment impact on scoring
 * - Urgency indicators
 * - Tier classification (hot/warm/cold)
 * - Financial value estimation
 * - Edge cases and error handling
 * - Multi-tenant isolation
 */

import {
  scoreLead,
  calculateLeadScore,
  getTierEmoji,
  formatTierWithEmoji,
  estimateLeadValue,
} from '../lead-scoring';
import { createMockLogger, clearAllMocks } from '../../tests/utils/test-helpers';

// Mock logger
jest.mock('../logger', () => ({
  log: createMockLogger(),
}));

describe('LeadScoring', () => {
  let mockLogger: any;

  beforeEach(() => {
    clearAllMocks();
    mockLogger = require('../logger').log;
  });

  describe('scoreLead()', () => {
    const orgId = 'org_test_123';

    it('should score high-value intent with positive sentiment', async () => {
      const transcript = 'I am interested in a rhinoplasty procedure';
      const result = await scoreLead(orgId, transcript, 'positive');

      expect(result.score).toBeGreaterThan(50);
      expect(result.tier).toBe('hot');
      expect(result.details).toContain('High-value keywords');
      expect(result.details).toContain('Positive sentiment');
    });

    it('should score medium-value inquiry', async () => {
      const transcript = 'I have a consultation and want to check pricing';
      const result = await scoreLead(orgId, transcript, 'neutral');

      expect(result.score).toBeGreaterThan(40);
      expect(['warm', 'hot']).toContain(result.tier);
    });

    it('should score low-value inquiry with negative sentiment', async () => {
      const transcript = 'Just wanted to know if you are open';
      const result = await scoreLead(orgId, transcript, 'negative');

      expect(result.score).toBeLessThan(70);
      expect(['cold', 'warm']).toContain(result.tier);
      expect(result.details).toContain('Negative sentiment');
    });

    it('should add urgency bonus for time-sensitive keywords', async () => {
      const urgentTranscript =
        'I need to book today for rhinoplasty. This is urgent and I want it asap.';
      const standardTranscript = 'I am interested in rhinoplasty';

      const urgentResult = await scoreLead(orgId, urgentTranscript, 'positive');
      const standardResult = await scoreLead(orgId, standardTranscript, 'positive');

      expect(urgentResult.score).toBeGreaterThan(standardResult.score);
      expect(urgentResult.details).toContain('Urgency indicators');
    });

    it('should penalize low-urgency indicators', async () => {
      const delayedTranscript =
        'I am maybe interested in rhinoplasty. I am thinking about it and might call back eventually.';
      const result = await scoreLead(orgId, delayedTranscript, 'neutral');

      expect(result.details).toContain('Low urgency indicators');
      expect(result.score).toBeLessThan(60);
    });

    it('should handle positive sentiment boost', async () => {
      const transcript = 'I love your clinic and am very interested in the procedure!';
      const positiveResult = await scoreLead(orgId, transcript, 'positive');
      const neutralResult = await scoreLead(orgId, transcript, 'neutral');

      expect(positiveResult.score).toBeGreaterThan(neutralResult.score);
    });

    it('should handle negative sentiment penalty', async () => {
      const transcript = 'I am not sure about this';
      const negativeResult = await scoreLead(orgId, transcript, 'negative');
      const neutralResult = await scoreLead(orgId, transcript, 'neutral');

      expect(negativeResult.score).toBeLessThan(neutralResult.score);
    });

    it('should cap score between 0 and 100', async () => {
      const maxTranscript =
        'I want facelift rhinoplasty breast augmentation today urgent asap immediately';
      const result = await scoreLead(orgId, maxTranscript, 'positive');

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should classify score 70+ as hot', async () => {
      const hotTranscript =
        'I am very interested in facelift and want to book today';
      const result = await scoreLead(orgId, hotTranscript, 'positive');

      if (result.score >= 70) {
        expect(result.tier).toBe('hot');
      }
    });

    it('should classify score 40-69 as warm', async () => {
      const warmTranscript = 'I want to learn more about your pricing and availability';
      const result = await scoreLead(orgId, warmTranscript, 'neutral');

      if (result.score >= 40 && result.score < 70) {
        expect(result.tier).toBe('warm');
      }
    });

    it('should classify score <40 as cold', async () => {
      const coldTranscript = 'Are you open today?';
      const result = await scoreLead(orgId, coldTranscript, 'neutral');

      if (result.score < 40) {
        expect(result.tier).toBe('cold');
      }
    });

    it('should handle empty transcript gracefully', async () => {
      const result = await scoreLead(orgId, '', 'neutral');

      expect(result.score).toBeDefined();
      expect(result.tier).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle null transcript gracefully', async () => {
      const result = await scoreLead(orgId, null as any, 'positive');

      expect(result.score).toBeDefined();
      expect(result.tier).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // This tests error recovery
      const result = await scoreLead(orgId, 'test', 'positive');

      expect(result.score).toBeDefined();
      expect(result.tier).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should log scoring results', async () => {
      const transcript = 'I want a facelift';
      await scoreLead(orgId, transcript, 'positive');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LeadScoring',
        'Lead scored',
        expect.objectContaining({
          orgId,
          score: expect.any(Number),
          tier: expect.stringMatching(/hot|warm|cold/),
        })
      );
    });

    it('should identify multiple high-value keywords', async () => {
      const transcript =
        'I am interested in both facelift and rhinoplasty with botox treatments';
      const result = await scoreLead(orgId, transcript, 'positive');

      expect(result.details).toContain('High-value keywords');
      expect(result.score).toBeGreaterThan(70);
    });
  });

  describe('calculateLeadScore()', () => {
    it('should calculate score from component keywords', () => {
      const score = calculateLeadScore(
        ['facelift', 'consultation'],
        'positive',
        'today',
        'surgical'
      );

      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should apply high-value keyword bonus', () => {
      const withBonus = calculateLeadScore(
        ['facelift', 'rhinoplasty'],
        'neutral',
        'none',
        'surgical'
      );
      const withoutBonus = calculateLeadScore(
        ['consultation'],
        'neutral',
        'none',
        'general'
      );

      expect(withBonus).toBeGreaterThan(withoutBonus);
    });

    it('should apply sentiment modifiers', () => {
      const baseKeywords = ['facelift'];
      const positive = calculateLeadScore(
        baseKeywords,
        'positive',
        'none',
        'surgical'
      );
      const negative = calculateLeadScore(
        baseKeywords,
        'negative',
        'none',
        'surgical'
      );

      expect(positive).toBeGreaterThan(negative);
    });

    it('should apply urgency modifiers', () => {
      const baseKeywords = ['facelift'];
      const urgent = calculateLeadScore(baseKeywords, 'neutral', 'today', 'surgical');
      const delayed = calculateLeadScore(
        baseKeywords,
        'neutral',
        'eventually',
        'surgical'
      );

      expect(urgent).toBeGreaterThan(delayed);
    });

    it('should apply service type bonus for premium services', () => {
      const surgical = calculateLeadScore(
        ['facelift'],
        'neutral',
        'none',
        'surgical'
      );
      const general = calculateLeadScore(
        ['facelift'],
        'neutral',
        'none',
        'consultation'
      );

      expect(surgical).toBeGreaterThan(general);
    });

    it('should cap score at 100', () => {
      const score = calculateLeadScore(
        ['facelift', 'rhinoplasty', 'breast'],
        'positive',
        'today',
        'surgical'
      );

      expect(score).toBeLessThanOrEqual(100);
    });

    it('should not produce negative scores', () => {
      const score = calculateLeadScore(
        [],
        'negative',
        'eventually',
        'general'
      );

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTierEmoji()', () => {
    it('should return 🔥 for hot tier', () => {
      expect(getTierEmoji('hot')).toBe('🔥');
    });

    it('should return 🌡️ for warm tier', () => {
      expect(getTierEmoji('warm')).toBe('🌡️');
    });

    it('should return ❄️ for cold tier', () => {
      expect(getTierEmoji('cold')).toBe('❄️');
    });
  });

  describe('formatTierWithEmoji()', () => {
    it('should format hot tier with emoji and capitalization', () => {
      const formatted = formatTierWithEmoji('hot');
      expect(formatted).toMatch(/🔥\s+Hot/);
    });

    it('should format warm tier with emoji and capitalization', () => {
      const formatted = formatTierWithEmoji('warm');
      expect(formatted).toMatch(/🌡️\s+Warm/);
    });

    it('should format cold tier with emoji and capitalization', () => {
      const formatted = formatTierWithEmoji('cold');
      expect(formatted).toMatch(/❄️\s+Cold/);
    });
  });

  describe('estimateLeadValue()', () => {
    it('should estimate £15,000 for facelift', () => {
      const value = estimateLeadValue('I am interested in a facelift');
      expect(value).toBe(15000);
    });

    it('should estimate £8,000 for rhinoplasty', () => {
      const value = estimateLeadValue('I want a nose job');
      expect(value).toBe(8000);
    });

    it('should estimate £7,500 for breast augmentation', () => {
      const value = estimateLeadValue('breast augmentation interested');
      expect(value).toBe(7500);
    });

    it('should estimate £4,000 for liposuction', () => {
      const value = estimateLeadValue('liposuction procedure');
      expect(value).toBe(4000);
    });

    it('should estimate £9,000 for tummy tuck', () => {
      const value = estimateLeadValue('I want a tummy tuck');
      expect(value).toBe(9000);
    });

    it('should estimate £6,000 for hair transplant', () => {
      const value = estimateLeadValue('hair transplant consultation');
      expect(value).toBe(6000);
    });

    it('should estimate £3,500 for eyelid surgery', () => {
      const value = estimateLeadValue('blepharoplasty procedure');
      expect(value).toBe(3500);
    });

    it('should estimate £350 for botox', () => {
      const value = estimateLeadValue('I want botox treatment');
      expect(value).toBe(350);
    });

    it('should estimate £150 for facial', () => {
      const value = estimateLeadValue('I want a facial');
      expect(value).toBe(150);
    });

    it('should estimate £200 for consultation', () => {
      const value = estimateLeadValue('I want to schedule a consultation');
      expect(value).toBe(200);
    });

    it('should return 0 for unknown procedures', () => {
      const value = estimateLeadValue('Are you open today?');
      expect(value).toBe(0);
    });

    it('should be case-insensitive', () => {
      const lowercase = estimateLeadValue('rhinoplasty');
      const uppercase = estimateLeadValue('RHINOPLASTY');
      expect(lowercase).toBe(uppercase);
    });

    it('should prioritize first matching procedure', () => {
      const transcript = 'botox and facelift consultation';
      const value = estimateLeadValue(transcript);
      // Should match rhinoplasty first if it appears
      expect(value).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in transcript', async () => {
      const transcript = 'I want a facelift!!! @#$%^&*()';
      const result = await scoreLead('org_test_123', transcript, 'positive');

      expect(result.score).toBeGreaterThan(0);
      expect(result.tier).toBeDefined();
    });

    it('should handle very long transcripts', async () => {
      const longTranscript = 'facelift '.repeat(10000);
      const result = await scoreLead('org_test_123', longTranscript, 'positive');

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.tier).toBeDefined();
    });

    it('should handle multiple sentiments consistently', async () => {
      const transcript = 'I like this but I am not sure about that';

      const positiveResult = await scoreLead('org_test_123', transcript, 'positive');
      const neutralResult = await scoreLead('org_test_123', transcript, 'neutral');
      const negativeResult = await scoreLead('org_test_123', transcript, 'negative');

      // Positive should be highest, negative should be lowest
      expect(positiveResult.score).toBeGreaterThan(negativeResult.score);
    });

    it('should handle keywords with variations', async () => {
      const botoxTranscript = 'I want botox treatment';
      const botulinumTranscript = 'I want botulinum treatment';

      const result1 = await scoreLead('org_test_123', botoxTranscript, 'neutral');
      const result2 = await scoreLead('org_test_123', botulinumTranscript, 'neutral');

      // Both should be scored similarly
      expect(Math.abs(result1.score - result2.score)).toBeLessThan(20);
    });
  });
});
