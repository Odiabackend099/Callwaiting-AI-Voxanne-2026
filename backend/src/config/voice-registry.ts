/**
 * Voice Registry - Single Source of Truth for All 2026 VAPI Voices
 *
 * This file centralizes all voice definitions across all supported providers.
 * Last updated: 2026-01-29
 * Sources: Perplexity AI, VAPI Docs, provider documentation
 *
 * Providers supported:
 * - Vapi Native (3 voices)
 * - ElevenLabs (100+ voices)
 * - OpenAI TTS (6 voices)
 * - Google Cloud TTS (40+ voices)
 * - Azure Speech (50+ voices)
 * - PlayHT (custom voice library)
 * - Rime AI (accent-controlled voices)
 */

export interface VoiceMetadata {
  id: string; // Voice ID for API calls (e.g., 'Rohan', 'alloy', '21m00Tcm4TlvDq8ikWAM')
  name: string; // Human-readable name (e.g., 'Rohan (Professional)')
  provider:
    | "vapi"
    | "elevenlabs"
    | "openai"
    | "google"
    | "azure"
    | "playht"
    | "rime";
  gender: "male" | "female" | "neutral";
  language: string; // Primary language (e.g., 'en-US', 'es-ES')
  characteristics: string[]; // Array of descriptors (e.g., ['professional', 'warm', 'energetic'])
  accent?: string; // Optional accent (e.g., 'Southern American', 'British', 'Indian')
  use_cases: string[]; // Best for (e.g., ['customer_service', 'healthcare', 'sales'])
  latency: "low" | "medium"; // Response time category
  quality: "standard" | "premium" | "neural";
  status: "active" | "deprecated";
  multilingual?: boolean; // Supports multiple languages with single voice
  requires_api_key?: boolean; // Needs third-party API key configuration
}

// ========================================
// VAPI NATIVE VOICES (Active 2026)
// ========================================
export const VAPI_NATIVE_VOICES: VoiceMetadata[] = [
  {
    id: "Rohan",
    name: "Rohan (Professional)",
    provider: "vapi",
    gender: "male",
    language: "en-US",
    characteristics: ["bright", "optimistic", "cheerful", "energetic"],
    accent: "Indian American",
    use_cases: ["customer_service", "sales", "healthcare"],
    latency: "low",
    quality: "standard",
    status: "active",
  },
  {
    id: "Elliot",
    name: "Elliot (Calm)",
    provider: "vapi",
    gender: "male",
    language: "en-US",
    characteristics: ["soothing", "friendly", "professional", "calm"],
    accent: "Canadian",
    use_cases: ["customer_service", "healthcare", "technical_support"],
    latency: "low",
    quality: "standard",
    status: "active",
  },
  {
    id: "Savannah",
    name: "Savannah (Friendly)",
    provider: "vapi",
    gender: "female",
    language: "en-US",
    characteristics: ["warm", "friendly", "approachable"],
    accent: "Southern American",
    use_cases: ["customer_service", "healthcare", "narration"],
    latency: "low",
    quality: "standard",
    status: "active",
  },
];

// ========================================
// ELEVENLABS VOICES (Premium, Multilingual)
// ========================================
export const ELEVENLABS_VOICES: VoiceMetadata[] = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel (Premium)",
    provider: "elevenlabs",
    gender: "female",
    language: "en-US",
    characteristics: ["friendly", "professional", "versatile"],
    use_cases: ["customer_service", "narration", "sales"],
    latency: "low",
    quality: "premium",
    status: "active",
    multilingual: true,
    requires_api_key: true,
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella (Warm)",
    provider: "elevenlabs",
    gender: "female",
    language: "en-US",
    characteristics: ["warm", "bright", "personable"],
    use_cases: ["customer_service", "sales"],
    latency: "low",
    quality: "premium",
    status: "active",
    multilingual: true,
    requires_api_key: true,
  },
  {
    id: "TxGEqnHWrfWFTLV8z9QN",
    name: "Chris (Conversational)",
    provider: "elevenlabs",
    gender: "male",
    language: "en-US",
    characteristics: ["conversational", "friendly", "natural"],
    use_cases: ["customer_service", "technical_support"],
    latency: "low",
    quality: "premium",
    status: "active",
    multilingual: true,
    requires_api_key: true,
  },
  // Note: ElevenLabs has 100+ voices available via API
  // Add more as needed from their voice catalog
];

// ========================================
// OPENAI TTS VOICES (6 voices)
// ========================================
export const OPENAI_VOICES: VoiceMetadata[] = [
  {
    id: "alloy",
    name: "Alloy (Smooth)",
    provider: "openai",
    gender: "neutral",
    language: "en-US",
    characteristics: ["smooth", "versatile", "neutral"],
    use_cases: ["customer_service", "narration", "general"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "echo",
    name: "Echo (Calm)",
    provider: "openai",
    gender: "male",
    language: "en-US",
    characteristics: ["calm", "clear", "measured"],
    use_cases: ["technical_support", "narration"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "fable",
    name: "Fable (Expressive)",
    provider: "openai",
    gender: "male",
    language: "en-US",
    characteristics: ["expressive", "narrative", "engaging"],
    use_cases: ["narration", "storytelling"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "onyx",
    name: "Onyx (Authoritative)",
    provider: "openai",
    gender: "male",
    language: "en-US",
    characteristics: ["deep", "authoritative", "professional"],
    use_cases: ["narration", "announcements"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "nova",
    name: "Nova (Modern)",
    provider: "openai",
    gender: "female",
    language: "en-US",
    characteristics: ["crisp", "modern", "professional"],
    use_cases: ["customer_service", "sales"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "shimmer",
    name: "Shimmer (Engaging)",
    provider: "openai",
    gender: "female",
    language: "en-US",
    characteristics: ["bright", "engaging", "energetic"],
    use_cases: ["sales", "customer_service"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
];

// ========================================
// GOOGLE CLOUD TTS VOICES (Sample)
// ========================================
export const GOOGLE_VOICES: VoiceMetadata[] = [
  {
    id: "en-US-Neural2-A",
    name: "Google Neural A (Male)",
    provider: "google",
    gender: "male",
    language: "en-US",
    characteristics: ["professional", "clear", "neutral"],
    use_cases: ["customer_service", "technical_support"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "en-US-Neural2-C",
    name: "Google Neural C (Female)",
    provider: "google",
    gender: "female",
    language: "en-US",
    characteristics: ["professional", "clear", "friendly"],
    use_cases: ["customer_service", "sales"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "en-US-Neural2-E",
    name: "Google Neural E (Female)",
    provider: "google",
    gender: "female",
    language: "en-US",
    characteristics: ["warm", "personable", "friendly"],
    use_cases: ["customer_service", "healthcare"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  // Note: Google Cloud has 40+ voices available
  // Add more as needed from their voice catalog
];

// ========================================
// AZURE VOICES (Sample)
// ========================================
export const AZURE_VOICES: VoiceMetadata[] = [
  {
    id: "en-US-AmberNeural",
    name: "Amber (Friendly)",
    provider: "azure",
    gender: "female",
    language: "en-US",
    characteristics: ["friendly", "approachable", "warm"],
    use_cases: ["customer_service", "healthcare"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "en-US-JennyNeural",
    name: "Jenny (Professional)",
    provider: "azure",
    gender: "female",
    language: "en-US",
    characteristics: ["professional", "clear", "neutral"],
    use_cases: ["customer_service", "sales"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy (Professional)",
    provider: "azure",
    gender: "male",
    language: "en-US",
    characteristics: ["professional", "clear", "authoritative"],
    use_cases: ["customer_service", "technical_support"],
    latency: "medium",
    quality: "neural",
    status: "active",
    requires_api_key: true,
  },
  // Note: Azure has 50+ voices available
  // Add more as needed from their voice catalog
];

// ========================================
// PLAYHT VOICES (Sample)
// ========================================
export const PLAYHT_VOICES: VoiceMetadata[] = [
  {
    id: "jennifer",
    name: "Jennifer (Professional)",
    provider: "playht",
    gender: "female",
    language: "en-US",
    characteristics: ["professional", "clear", "neutral"],
    use_cases: ["customer_service", "sales"],
    latency: "low",
    quality: "premium",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "marcus",
    name: "Marcus (Authoritative)",
    provider: "playht",
    gender: "male",
    language: "en-US",
    characteristics: ["authoritative", "deep", "professional"],
    use_cases: ["announcements", "customer_service"],
    latency: "low",
    quality: "premium",
    status: "active",
    requires_api_key: true,
  },
  // Note: PlayHT has custom voice library
  // Add more as needed
];

// ========================================
// RIME AI VOICES (Sample)
// ========================================
export const RIME_AI_VOICES: VoiceMetadata[] = [
  {
    id: "deterministic_1",
    name: "Rime Voice 1 (Professional)",
    provider: "rime",
    gender: "male",
    language: "en-US",
    characteristics: ["accent-controlled", "professional", "clear"],
    use_cases: ["customer_service", "technical_support"],
    latency: "low",
    quality: "premium",
    status: "active",
    requires_api_key: true,
  },
  {
    id: "deterministic_2",
    name: "Rime Voice 2 (Friendly)",
    provider: "rime",
    gender: "female",
    language: "en-US",
    characteristics: ["accent-controlled", "friendly", "warm"],
    use_cases: ["customer_service", "healthcare"],
    latency: "low",
    quality: "premium",
    status: "active",
    requires_api_key: true,
  },
  // Note: Rime AI specializes in accent-controlled voices
  // Add more as needed
];

// ========================================
// UNIFIED REGISTRY (Single Source of Truth)
// ========================================
export const VOICE_REGISTRY: VoiceMetadata[] = [
  ...VAPI_NATIVE_VOICES,
  ...ELEVENLABS_VOICES,
  ...OPENAI_VOICES,
  ...GOOGLE_VOICES,
  ...AZURE_VOICES,
  ...PLAYHT_VOICES,
  ...RIME_AI_VOICES,
];

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get all active voices (excludes deprecated)
 */
export function getActiveVoices(): VoiceMetadata[] {
  return VOICE_REGISTRY.filter((v) => v.status === "active");
}

/**
 * Get voices by provider
 */
export function getVoicesByProvider(
  provider: VoiceMetadata["provider"]
): VoiceMetadata[] {
  return VOICE_REGISTRY.filter(
    (v) => v.provider === provider && v.status === "active"
  );
}

/**
 * Get voice by ID (case-insensitive)
 */
export function getVoiceById(voiceId: string): VoiceMetadata | undefined {
  return VOICE_REGISTRY.find(
    (v) =>
      v.id.toLowerCase() === voiceId.toLowerCase()
  );
}

/**
 * Filter voices by criteria
 */
export function filterVoices(criteria: {
  provider?: string;
  gender?: string;
  language?: string;
  use_case?: string;
  search?: string;
}): VoiceMetadata[] {
  let voices = getActiveVoices();

  if (criteria.provider) {
    voices = voices.filter((v) => v.provider === criteria.provider);
  }

  if (criteria.gender) {
    voices = voices.filter((v) => v.gender === criteria.gender);
  }

  if (criteria.language) {
    voices = voices.filter((v) => v.language === criteria.language);
  }

  if (criteria.use_case) {
    voices = voices.filter((v) => v.use_cases.includes(criteria.use_case!));
  }

  if (criteria.search) {
    const searchLower = criteria.search.toLowerCase();
    voices = voices.filter(
      (v) =>
        v.name.toLowerCase().includes(searchLower) ||
        v.characteristics.some((c) => c.toLowerCase().includes(searchLower)) ||
        v.accent?.toLowerCase().includes(searchLower)
    );
  }

  return voices;
}

/**
 * Validate voice ID and provider combination
 */
export function isValidVoice(voiceId: string, provider: string): boolean {
  const voice = getVoiceById(voiceId);
  return (
    voice !== undefined && voice.provider === provider && voice.status === "active"
  );
}

// ========================================
// VAPI PROVIDER NAME MAPPING
// ========================================
// Vapi uses different provider identifiers than our internal naming.
// This mapping translates at the API boundary so internal code stays readable.
//
//   Internal name  ->  Vapi API name
//   "elevenlabs"   ->  "11labs"
//
const INTERNAL_TO_VAPI_PROVIDER: Record<string, string> = {
  'elevenlabs': '11labs',
};

/**
 * Translates internal provider names to Vapi API provider strings.
 * Call this when constructing any voice payload sent to Vapi.
 *
 * Example: toVapiProvider('elevenlabs') => '11labs'
 * Example: toVapiProvider('vapi')       => 'vapi' (pass-through)
 */
export function toVapiProvider(internalProvider: string): string {
  return INTERNAL_TO_VAPI_PROVIDER[internalProvider] || internalProvider;
}

/**
 * Complete list of valid internal voice provider names.
 * Use this as the single source of truth when validating provider input — avoids
 * hardcoding provider names in multiple routes.
 */
export const VALID_VOICE_PROVIDERS: readonly string[] = [
  'vapi',
  'elevenlabs',
  'openai',
  'google',
  'azure',
  'playht',
  'rime',
];
