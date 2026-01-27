/**
 * VAPI Provider Fallback Configuration - Single Source of Truth
 *
 * Implements 3-tier fallback cascades for maximum reliability (99.9%+ availability).
 * If primary transcriber/voice provider fails, automatically falls back to backups.
 *
 * Deployment: Applied automatically on all new assistants
 *             Applied to existing assistants via enforce-provider-fallbacks.ts script
 *
 * Business Value: Eliminates single point of failure. Provider outage ≠ call failure.
 */

// ========================================
// TRANSCRIBER FALLBACK CONFIGURATION
// ========================================

/**
 * Gold standard 3-tier transcriber fallback cascade
 *
 * Tier 1 (Primary): Deepgram Nova-2
 *   - Best accuracy for medical/specialized terminology
 *   - Industry-standard reliability
 *
 * Tier 2 (Backup 1): Deepgram Nova-2 General
 *   - Broader vocabulary, slightly lower accuracy for jargon
 *   - Same provider ensures consistency, different model for diversity
 *
 * Tier 3 (Backup 2): Talkscriber Whisper
 *   - OpenAI-based transcription, completely different infrastructure
 *   - Lower accuracy but different technology stack = truly redundant
 */
export const TRANSCRIBER_FALLBACKS = [
  {
    provider: "deepgram",
    model: "nova-2-general",
    language: "en"
  },
  {
    provider: "talkscriber",
    model: "whisper",
    language: "en"
  }
];

/**
 * Transcriber configuration by language
 * Maps language codes to appropriate fallback providers
 *
 * NOTE: For now, all languages use English fallbacks.
 * Can be extended to include Spanish, French, etc. as needed.
 */
const TRANSCRIBER_FALLBACKS_BY_LANGUAGE: Record<string, typeof TRANSCRIBER_FALLBACKS> = {
  en: TRANSCRIBER_FALLBACKS,
  "en-US": TRANSCRIBER_FALLBACKS,
  "en-GB": TRANSCRIBER_FALLBACKS,
  es: TRANSCRIBER_FALLBACKS,
  "es-ES": TRANSCRIBER_FALLBACKS,
  "es-MX": TRANSCRIBER_FALLBACKS,
  fr: TRANSCRIBER_FALLBACKS,
  de: TRANSCRIBER_FALLBACKS,
  pt: TRANSCRIBER_FALLBACKS,
};

// ========================================
// VOICE FALLBACK CONFIGURATION
// ========================================

/**
 * Voice fallback mapping by primary provider
 *
 * If user selects a voice from Provider A, we add fallbacks from other providers
 * to ensure maximum availability across different infrastructure.
 *
 * Example:
 *   Primary: OpenAI/Alloy (user's selection)
 *   Backup 1: OpenAI/Nova (different voice, same provider for consistency)
 *   Backup 2: Azure/Andrew (completely different provider & infrastructure)
 */

interface VoiceFallback {
  provider: "vapi" | "elevenlabs" | "openai" | "google" | "azure" | "playht" | "rime";
  voiceId: string;
  fallbackPriority: number;
}

/**
 * Recommended fallback voices when primary is from each provider
 */
const VOICE_FALLBACK_MAPPINGS: Record<string, VoiceFallback[]> = {
  // OpenAI fallbacks
  openai: [
    {
      provider: "azure",
      voiceId: "Andrew",
      fallbackPriority: 1
    },
    {
      provider: "elevenlabs",
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
      fallbackPriority: 2
    }
  ],

  // Vapi fallbacks
  vapi: [
    {
      provider: "openai",
      voiceId: "alloy",
      fallbackPriority: 1
    },
    {
      provider: "azure",
      voiceId: "Andrew",
      fallbackPriority: 2
    }
  ],

  // ElevenLabs fallbacks
  elevenlabs: [
    {
      provider: "openai",
      voiceId: "alloy",
      fallbackPriority: 1
    },
    {
      provider: "azure",
      voiceId: "Andrew",
      fallbackPriority: 2
    }
  ],

  // Google fallbacks
  google: [
    {
      provider: "azure",
      voiceId: "Andrew",
      fallbackPriority: 1
    },
    {
      provider: "openai",
      voiceId: "alloy",
      fallbackPriority: 2
    }
  ],

  // Azure fallbacks
  azure: [
    {
      provider: "openai",
      voiceId: "alloy",
      fallbackPriority: 1
    },
    {
      provider: "elevenlabs",
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
      fallbackPriority: 2
    }
  ],

  // PlayHT fallbacks
  playht: [
    {
      provider: "openai",
      voiceId: "alloy",
      fallbackPriority: 1
    },
    {
      provider: "azure",
      voiceId: "Andrew",
      fallbackPriority: 2
    }
  ],

  // Rime AI fallbacks
  rime: [
    {
      provider: "azure",
      voiceId: "Andrew",
      fallbackPriority: 1
    },
    {
      provider: "openai",
      voiceId: "alloy",
      fallbackPriority: 2
    }
  ]
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Build transcriber configuration with fallbacks
 *
 * @param language - Language code (e.g., 'en', 'es', 'fr')
 * @returns Vapi-compatible transcriber object with fallbacks array
 *
 * Example output:
 * {
 *   provider: 'deepgram',
 *   model: 'nova-2',
 *   language: 'en',
 *   fallbacks: [
 *     { provider: 'deepgram', model: 'nova-2-general', language: 'en' },
 *     { provider: 'talkscriber', model: 'whisper', language: 'en' }
 *   ]
 * }
 */
export function buildTranscriberWithFallbacks(language: string = 'en') {
  const fallbacks = TRANSCRIBER_FALLBACKS_BY_LANGUAGE[language] || TRANSCRIBER_FALLBACKS;

  return {
    provider: 'deepgram' as const,
    model: 'nova-2',
    language,
    fallbacks
  };
}

/**
 * Build voice configuration with fallbacks
 *
 * Automatically selects appropriate fallback providers based on primary provider.
 * Avoids duplicating the primary voice ID.
 *
 * @param primaryProvider - Provider of primary voice (e.g., 'openai')
 * @param primaryVoiceId - Voice ID of primary voice (e.g., 'alloy')
 * @returns Vapi-compatible voice object with fallbacks array
 *
 * Example output:
 * {
 *   provider: 'openai',
 *   voiceId: 'alloy',
 *   fallbacks: [
 *     { provider: 'azure', voiceId: 'Andrew' },
 *     { provider: 'elevenlabs', voiceId: '21m00Tcm4TlvDq8ikWAM' }
 *   ]
 * }
 */
export function buildVoiceWithFallbacks(
  primaryProvider: string,
  primaryVoiceId: string
): any {
  const fallbackCandidates = VOICE_FALLBACK_MAPPINGS[primaryProvider] ||
                             VOICE_FALLBACK_MAPPINGS['openai'];

  // Remove any fallbacks that duplicate the primary provider/voiceId
  const fallbacks = fallbackCandidates
    .filter(f => !(f.provider === primaryProvider && f.voiceId === primaryVoiceId))
    .slice(0, 2); // Keep max 2 fallbacks

  return {
    provider: primaryProvider,
    voiceId: primaryVoiceId,
    fallbacks
  };
}

/**
 * Merge fallbacks into a complete assistant payload
 *
 * Takes an existing payload and adds fallback configurations.
 * Safe to call multiple times - only adds fallbacks if missing.
 * Respects existing fallback configurations (doesn't overwrite if already present).
 *
 * @param payload - Assistant create/update payload
 * @returns Same payload with fallbacks added to transcriber and voice
 *
 * Example:
 * Input:
 *   {
 *     name: 'Inbound Agent',
 *     transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
 *     voice: { provider: 'openai', voiceId: 'alloy' }
 *   }
 *
 * Output:
 *   {
 *     name: 'Inbound Agent',
 *     transcriber: {
 *       provider: 'deepgram',
 *       model: 'nova-2',
 *       language: 'en',
 *       fallbacks: [{ provider: 'deepgram', model: 'nova-2-general' }, ...]
 *     },
 *     voice: {
 *       provider: 'openai',
 *       voiceId: 'alloy',
 *       fallbacks: [{ provider: 'azure', voiceId: 'Andrew' }, ...]
 *     }
 *   }
 */
export function mergeFallbacksIntoPayload(payload: any): any {
  const updated = { ...payload };

  // Add transcriber fallbacks if transcriber exists
  if (updated.transcriber && !updated.transcriber.fallbacks) {
    const language = updated.transcriber.language || 'en';
    const fallbacks = TRANSCRIBER_FALLBACKS_BY_LANGUAGE[language] || TRANSCRIBER_FALLBACKS;

    updated.transcriber = {
      ...updated.transcriber,
      fallbacks
    };
  }

  // Add voice fallbacks if voice exists
  if (updated.voice && !updated.voice.fallbacks) {
    const provider = updated.voice.provider || 'vapi';
    const voiceId = updated.voice.voiceId || updated.voice.voiceCode || '';

    const fallbacks = VOICE_FALLBACK_MAPPINGS[provider] || VOICE_FALLBACK_MAPPINGS['openai'];
    const filteredFallbacks = fallbacks
      .filter(f => !(f.provider === provider && f.voiceId === voiceId))
      .slice(0, 2);

    updated.voice = {
      ...updated.voice,
      fallbacks: filteredFallbacks
    };
  }

  return updated;
}

/**
 * Validate that an assistant has proper fallback configuration
 *
 * @param assistant - Vapi assistant object
 * @returns true if has 2+ fallbacks for both transcriber and voice
 */
export function hasProperFallbacks(assistant: any): boolean {
  const hasTranscriberFallbacks =
    assistant.transcriber?.fallbacks &&
    Array.isArray(assistant.transcriber.fallbacks) &&
    assistant.transcriber.fallbacks.length >= 2;

  const hasVoiceFallbacks =
    assistant.voice?.fallbacks &&
    Array.isArray(assistant.voice.fallbacks) &&
    assistant.voice.fallbacks.length >= 2;

  return hasTranscriberFallbacks && hasVoiceFallbacks;
}

/**
 * Check if assistant is missing fallback configuration
 *
 * @param assistant - Vapi assistant object
 * @returns Array of missing configurations (empty = fully configured)
 */
export function getMissingFallbackConfigs(assistant: any): string[] {
  const missing: string[] = [];

  if (!assistant.transcriber?.fallbacks || assistant.transcriber.fallbacks.length < 2) {
    missing.push('transcriber');
  }

  if (!assistant.voice?.fallbacks || assistant.voice.fallbacks.length < 2) {
    missing.push('voice');
  }

  return missing;
}

export default {
  buildTranscriberWithFallbacks,
  buildVoiceWithFallbacks,
  mergeFallbacksIntoPayload,
  hasProperFallbacks,
  getMissingFallbackConfigs
};
