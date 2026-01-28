/**
 * Voice Registry Integration Tests
 *
 * Tests the centralized voice registry which serves as the single source of truth
 * for all 100+ voices across 7 providers (Vapi, ElevenLabs, OpenAI, Google, Azure, PlayHT, Rime)
 */

import {
  getActiveVoices,
  getVoicesByProvider,
  getVoiceById,
  isValidVoice,
  filterVoices,
  VOICE_REGISTRY,
  VAPI_NATIVE_VOICES,
  OPENAI_VOICES
} from '../../config/voice-registry';

describe('Voice Registry', () => {
  describe('getActiveVoices()', () => {
    it('should return only active voices (exclude deprecated)', () => {
      const voices = getActiveVoices();

      expect(voices.length).toBeGreaterThan(10);
      expect(voices.every(v => v.status === 'active')).toBe(true);
      expect(voices.every(v => v.status !== 'deprecated')).toBe(true);
    });

    it('should include Vapi native voices', () => {
      const voices = getActiveVoices();
      const vapiVoices = voices.filter(v => v.provider === 'vapi');

      expect(vapiVoices.length).toBe(3);
      expect(vapiVoices.map(v => v.id)).toEqual(
        expect.arrayContaining(['Rohan', 'Elliot', 'Savannah'])
      );
    });

    it('should include OpenAI voices', () => {
      const voices = getActiveVoices();
      const openaiVoices = voices.filter(v => v.provider === 'openai');

      expect(openaiVoices.length).toBe(6);
      expect(openaiVoices.map(v => v.id)).toEqual(
        expect.arrayContaining(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])
      );
    });
  });

  describe('getVoicesByProvider()', () => {
    it('should filter voices by provider', () => {
      const vapiVoices = getVoicesByProvider('vapi');

      expect(vapiVoices.length).toBe(3);
      expect(vapiVoices.every(v => v.provider === 'vapi')).toBe(true);
      expect(vapiVoices.every(v => v.status === 'active')).toBe(true);
    });

    it('should return OpenAI TTS voices', () => {
      const openaiVoices = getVoicesByProvider('openai');

      expect(openaiVoices.length).toBe(6);
      expect(openaiVoices.every(v => v.provider === 'openai')).toBe(true);
    });

    it('should return ElevenLabs voices', () => {
      const elevenLabsVoices = getVoicesByProvider('elevenlabs');

      expect(elevenLabsVoices.length).toBeGreaterThan(0);
      expect(elevenLabsVoices.every(v => v.provider === 'elevenlabs')).toBe(true);
    });

    it('should only include active voices (SSOT)', () => {
      const voices = getVoicesByProvider('vapi');

      expect(voices.every(v => v.status === 'active')).toBe(true);
    });
  });

  describe('getVoiceById()', () => {
    it('should find voice by exact ID match', () => {
      const voice = getVoiceById('Rohan');

      expect(voice).toBeDefined();
      expect(voice?.id).toBe('Rohan');
      expect(voice?.provider).toBe('vapi');
    });

    it('should find voice by case-insensitive match', () => {
      const voice = getVoiceById('rohan');

      expect(voice).toBeDefined();
      expect(voice?.id).toBe('Rohan');
    });

    it('should find OpenAI voice by ID', () => {
      const voice = getVoiceById('alloy');

      expect(voice).toBeDefined();
      expect(voice?.id).toBe('alloy');
      expect(voice?.provider).toBe('openai');
    });

    it('should find voice by deprecated alias', () => {
      const voice = getVoiceById('neha');

      expect(voice).toBeDefined();
    });

    it('should return undefined for non-existent voice', () => {
      const voice = getVoiceById('non-existent-voice-xyz');

      expect(voice).toBeUndefined();
    });
  });

  describe('isValidVoice()', () => {
    it('should validate Rohan as Vapi voice', () => {
      const valid = isValidVoice('Rohan', 'vapi');

      expect(valid).toBe(true);
    });

    it('should validate alloy as OpenAI voice', () => {
      const valid = isValidVoice('alloy', 'openai');

      expect(valid).toBe(true);
    });

    it('should reject invalid voice ID', () => {
      const valid = isValidVoice('invalid-voice-xyz', 'vapi');

      expect(valid).toBe(false);
    });

    it('should reject correct voice with wrong provider', () => {
      const valid = isValidVoice('Rohan', 'openai');

      expect(valid).toBe(false);
    });

    it('should reject voice not in SSOT', () => {
      const valid = isValidVoice('unknown-legacy-voice', 'vapi');

      expect(valid).toBe(false); // Not in voice registry SSOT
    });

    it('should be case-sensitive for voice ID matching', () => {
      const valid = isValidVoice('rohan', 'vapi');

      expect(valid).toBe(false); // Case mismatch
    });
  });

  describe('filterVoices()', () => {
    it('should filter by provider', () => {
      const voices = filterVoices({ provider: 'openai' });

      expect(voices.length).toBe(6);
      expect(voices.every(v => v.provider === 'openai')).toBe(true);
    });

    it('should filter by gender', () => {
      const voices = filterVoices({ gender: 'female' });

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.every(v => v.gender === 'female')).toBe(true);
    });

    it('should filter by language', () => {
      const voices = filterVoices({ language: 'en-US' });

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.every(v => v.language === 'en-US')).toBe(true);
    });

    it('should filter by use case', () => {
      const voices = filterVoices({ use_case: 'customer_service' });

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.every(v => v.use_cases.includes('customer_service'))).toBe(true);
    });

    it('should filter by search term (name)', () => {
      const voices = filterVoices({ search: 'rohan' });

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.some(v => v.name.toLowerCase().includes('rohan'))).toBe(true);
    });

    it('should filter by search term (characteristics)', () => {
      const voices = filterVoices({ search: 'professional' });

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.every(v =>
        v.name.toLowerCase().includes('professional') ||
        v.characteristics.some(c => c.toLowerCase().includes('professional'))
      )).toBe(true);
    });

    it('should combine multiple filters', () => {
      const voices = filterVoices({ provider: 'vapi', gender: 'female' });

      expect(voices.length).toBeGreaterThan(0);
      expect(voices.every(v => v.provider === 'vapi' && v.gender === 'female')).toBe(true);
    });

    it('should return all active voices when no filter provided', () => {
      const voices = filterVoices({});
      const allActive = getActiveVoices();

      expect(voices.length).toBe(allActive.length);
    });
  });

  describe('Voice Metadata Completeness', () => {
    it('should have all required fields for each voice', () => {
      const requiredFields = ['id', 'name', 'provider', 'gender', 'language', 'characteristics', 'use_cases', 'latency', 'quality', 'status'];

      getActiveVoices().forEach(voice => {
        requiredFields.forEach(field => {
          expect(voice).toHaveProperty(field);
          expect(voice[field as keyof typeof voice]).toBeDefined();
        });
      });
    });

    it('should have valid provider values', () => {
      const validProviders = ['vapi', 'elevenlabs', 'openai', 'google', 'azure', 'playht', 'rime'];

      getActiveVoices().forEach(voice => {
        expect(validProviders).toContain(voice.provider);
      });
    });

    it('should have valid gender values', () => {
      const validGenders = ['male', 'female', 'neutral'];

      getActiveVoices().forEach(voice => {
        expect(validGenders).toContain(voice.gender);
      });
    });

    it('should have valid latency values', () => {
      const validLatencies = ['low', 'medium'];

      getActiveVoices().forEach(voice => {
        expect(validLatencies).toContain(voice.latency);
      });
    });

    it('should have valid quality values', () => {
      const validQualities = ['standard', 'premium', 'neural'];

      getActiveVoices().forEach(voice => {
        expect(validQualities).toContain(voice.quality);
      });
    });

    it('should have non-empty characteristics array', () => {
      getActiveVoices().forEach(voice => {
        expect(Array.isArray(voice.characteristics)).toBe(true);
        expect(voice.characteristics.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty use_cases array', () => {
      getActiveVoices().forEach(voice => {
        expect(Array.isArray(voice.use_cases)).toBe(true);
        expect(voice.use_cases.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain deprecated voices in registry for reference', () => {
      expect(DEPRECATED_VOICES.length).toBeGreaterThan(0);
      expect(DEPRECATED_VOICES.every(v => v.status === 'deprecated')).toBe(true);
    });

    it('should map all deprecated voices to active equivalents', () => {
      const deprecatedIds = DEPRECATED_VOICES.map(v => v.id.toLowerCase());

      deprecatedIds.forEach(voiceId => {
        const result = normalizeLegacyVoice(voiceId);
        const activeVoice = getVoiceById(result.voice);

        expect(activeVoice).toBeDefined();
        expect(activeVoice?.status).toBe('active');
      });
    });
  });

  describe('Performance', () => {
    it('should quickly find voice by ID', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        getVoiceById('Rohan');
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should quickly validate voice', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        isValidVoice('Rohan', 'vapi');
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should quickly filter voices', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        filterVoices({ provider: 'openai', gender: 'female' });
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });
});
