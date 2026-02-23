import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('VoicePreviewService');

// ========== INTERFACES ==========

export interface PreviewParams {
  voiceId: string;
  provider: string;
}

export interface PreviewResult {
  audioBuffer: Buffer;
  contentType: string;
}

// ========== VOICE PREVIEW SERVICE ==========

/**
 * Voice preview service — serves pre-generated static MP3 samples.
 *
 * All 22 voices have a pre-generated sample in public/voice-samples/{voiceId}.mp3.
 * No external API keys are required at runtime — Vapi already includes access to
 * all voice providers (ElevenLabs, OpenAI, Google, Azure, PlayHT, Rime) as part
 * of the Vapi subscription. Voice preview doesn't double-pay for provider APIs.
 *
 * Samples are generated once at development time and committed to the repo.
 */
export class VoicePreviewService {
  private samplesDir: string;

  constructor() {
    // Samples live in the project root's public/ directory (Next.js public folder).
    // The backend runs from backend/, so resolve one level up.
    this.samplesDir = path.resolve(process.cwd(), '..', 'public', 'voice-samples');
  }

  /**
   * Retrieve a pre-generated voice preview sample.
   */
  async generatePreview(params: PreviewParams): Promise<PreviewResult> {
    const { voiceId, provider } = params;

    logger.info('[PREVIEW] Serving sample', { voiceId, provider });

    const filePath = path.join(this.samplesDir, `${voiceId}.mp3`);

    try {
      const audioBuffer = await fs.readFile(filePath);

      if (audioBuffer.length < 1024) {
        throw new Error(`Sample file too small: ${audioBuffer.length} bytes`);
      }

      logger.info('[PREVIEW] Sample served', {
        voiceId,
        provider,
        bytes: audioBuffer.length,
      });

      return {
        audioBuffer,
        contentType: 'audio/mpeg',
      };
    } catch (error: any) {
      logger.error('[PREVIEW] Sample not found', { voiceId, provider, path: filePath });
      throw new Error(
        `Voice sample not found for "${voiceId}" (${provider}). ` +
        'Run: npx ts-node src/scripts/generate-voice-samples.ts'
      );
    }
  }
}

// Singleton instance
let _instance: VoicePreviewService | null = null;

export function getVoicePreviewService(): VoicePreviewService {
  if (!_instance) {
    _instance = new VoicePreviewService();
  }
  return _instance;
}
