/**
 * VOICE_MANIFEST.ts - Single Source of Truth for Voice Identity
 * 
 * Maps Vapi's technical voice IDs to user-friendly labels.
 * ⚠️  VAPI 2026 ACTIVE VOICES ONLY
 * Per https://docs.vapi.ai/providers/voice/vapi-voices (Jan 2026)
 * 
 * CRITICAL: Keys must EXACTLY match Vapi's voice IDs (case-sensitive)
 * Only 3 voices support NEW assistant creation: Rohan, Elliot, Savannah
 * All other voices (Neha, Paige, Harry, etc.) are LEGACY - rejected by Vapi
 */

export const VOICE_MANIFEST = {
  // ✅ ACTIVE Voices - Only these 3 work with new assistants in Vapi 2026
  Rohan: {
    label: 'Rohan (Professional)',
    provider: 'vapi',
    description: 'Energetic, professional, warm - healthcare-approved',
    isDefault: true,
  },
  Elliot: {
    label: 'Elliot (Calm)',
    provider: 'vapi',
    description: 'Measured, calm, professional tone',
  },
  Savannah: {
    label: 'Savannah (Friendly)',
    provider: 'vapi',
    description: 'Warm, approachable, friendly - excellent for patient comfort',
  },
  // 
  // ⚠️  LEGACY VOICES (below) - DO NOT USE FOR NEW ASSISTANTS
  // These are kept for backward compatibility with existing agents only
  // New agents created with these will be rejected by Vapi
  //
  // Neha: { ... },  // DEPRECATED - use Savannah instead
  // Paige: { ... }, // DEPRECATED - use Savannah instead  
  // Hana: { ... },  // DEPRECATED - use Savannah instead
  // Lily: { ... },  // DEPRECATED - use Savannah instead
  // Kylie: { ... }, // DEPRECATED - use Savannah instead
  // Leah: { ... },  // DEPRECATED - use Savannah instead
  // Tara: { ... },  // DEPRECATED - use Savannah instead
  // Jess: { ... },  // DEPRECATED - use Savannah instead
  // Mia: { ... },   // DEPRECATED - use Savannah instead
  // Zoe: { ... },   // DEPRECATED - use Savannah instead
  // Harry: { ... }, // DEPRECATED - use Rohan instead
  // Cole: { ... },  // DEPRECATED - use Rohan instead
  // Spencer: { ... },  // DEPRECATED - use Rohan instead
  // Leo: { ... },   // DEPRECATED - use Rohan instead
  // Dan: { ... },   // DEPRECATED - use Rohan instead
  // Zac: { ... },   // DEPRECATED - use Rohan instead
} as const;

export type VoiceId = keyof typeof VOICE_MANIFEST;

/**
 * Get all available voices for dropdown/UI
 */
export function getAvailableVoices() {
  return Object.entries(VOICE_MANIFEST).map(([id, config]) => ({
    id: id as VoiceId,
    label: config.label,
    description: config.description,
    isDefault: 'isDefault' in config ? config.isDefault : false,
  }));
}

/**
 * Get voice configuration by ID
 */
export function getVoiceConfig(voiceId: string) {
  return VOICE_MANIFEST[voiceId as VoiceId];
}

/**
 * Validate if a voice ID is valid
 */
export function isValidVoiceId(voiceId: string): boolean {
  if (!voiceId) return false;
  return voiceId in VOICE_MANIFEST;
}

/**
 * Get default voice ID (healthcare-focused)
 */
export function getDefaultVoiceId(): VoiceId {
  return 'Rohan';
}
