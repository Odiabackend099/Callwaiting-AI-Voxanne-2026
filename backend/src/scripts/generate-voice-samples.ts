/**
 * Generate Voice Preview Samples (One-Time Dev Script)
 *
 * Generates MP3 sample files for all 22 voices in the voice registry.
 * Uses OpenAI TTS API (dev-time only) to create the samples.
 * Samples are committed to the repo — no API keys needed at runtime.
 *
 * Vapi already includes all voice providers as part of its subscription.
 * This script only runs once during development to create the static files.
 *
 * Usage:  cd backend && npx ts-node src/scripts/generate-voice-samples.ts
 * Requires: OPENAI_API_KEY in .env (dev-time only)
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { VOICE_REGISTRY } from '../config/voice-registry';

const SAMPLE_TEXT = 'Hello, thank you for calling. How can I assist you today? I\'m here to help with scheduling, questions, and anything else you need.';
const OUTPUT_DIR = path.join(process.cwd(), '..', 'public', 'voice-samples');

const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 10000; // 10s, 20s, 40s, 80s

// Map each voice ID to an OpenAI TTS voice for sample generation.
// OpenAI voices are used ONLY for one-time sample generation — not at runtime.
// We pick different OpenAI voices to give variety across the samples.
const OPENAI_VOICE_FOR_SAMPLE: Record<string, string> = {
  // Vapi native (3) — varied OpenAI voices
  'Rohan': 'echo',      // male
  'Elliot': 'onyx',     // male, calm
  'Savannah': 'nova',   // female, warm

  // ElevenLabs (3) — varied OpenAI voices
  '21m00Tcm4TlvDq8ikWAM': 'nova',     // Rachel - female
  'EXAVITQu4vr4xnSDxMaL': 'shimmer',  // Bella - female, warm
  'TxGEqnHWrfWFTLV8z9QN': 'echo',     // Chris - male, conversational

  // OpenAI (6) — use actual OpenAI voice (native match)
  'alloy': 'alloy',
  'echo': 'echo',
  'fable': 'fable',
  'onyx': 'onyx',
  'nova': 'nova',
  'shimmer': 'shimmer',

  // Google Cloud (3)
  'en-US-Neural2-A': 'onyx',    // male
  'en-US-Neural2-C': 'nova',    // female
  'en-US-Neural2-E': 'shimmer', // female, warm

  // Azure (3)
  'en-US-AmberNeural': 'shimmer',  // female, warm
  'en-US-JennyNeural': 'nova',    // female, professional
  'en-US-GuyNeural': 'onyx',      // male, authoritative

  // PlayHT (2)
  'jennifer': 'nova',   // female
  'marcus': 'onyx',     // male

  // Rime (2)
  'deterministic_1': 'echo',    // male
  'deterministic_2': 'shimmer', // female
};

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateSample(openaiVoice: string, text: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in .env');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        { model: 'tts-1', voice: openaiVoice, input: text },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 30000,
        },
      );
      return Buffer.from(response.data);
    } catch (error: any) {
      const status = error?.response?.status;
      if ((status === 429 || status === 500 || status === 503) && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`     ⏳ API ${status}, retrying in ${delay / 1000}s (attempt ${attempt + 2}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const voices = VOICE_REGISTRY.filter(v => v.status === 'active');
  console.log(`\n🎤 Generating voice samples for ${voices.length} voices...\n`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Method: OpenAI TTS API (one-time dev-time generation)\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const voice of voices) {
    const outPath = path.join(OUTPUT_DIR, `${voice.id}.mp3`);

    // Skip if sample already exists and is valid
    try {
      const stat = await fs.stat(outPath);
      if (stat.size > 1024) {
        console.log(`  ⏭  ${voice.name} — already exists (${Math.round(stat.size / 1024)} KB)`);
        skipped++;
        continue;
      }
    } catch {
      // File doesn't exist, proceed
    }

    const openaiVoice = OPENAI_VOICE_FOR_SAMPLE[voice.id] || 'alloy';
    const isNativeMatch = voice.provider === 'openai';
    const label = isNativeMatch ? 'native TTS' : `via OpenAI "${openaiVoice}"`;

    console.log(`  🔊 ${voice.name} (${voice.provider}) — ${label}...`);

    try {
      const buffer = await generateSample(openaiVoice, SAMPLE_TEXT);
      await fs.writeFile(outPath, buffer);
      const sizeKB = Math.round(buffer.length / 1024);
      console.log(`     ✅ ${voice.id}.mp3 (${sizeKB} KB)`);
      generated++;

      // Pause 3s between API calls to avoid rate limits
      await sleep(3000);
    } catch (error: any) {
      console.error(`     ❌ FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Failed:    ${failed}`);
  console.log(`   Total:     ${voices.length}\n`);

  if (failed > 0) {
    console.log(`⚠️  ${failed} samples failed. Re-run the script to retry (it skips existing files).\n`);
    process.exit(1);
  }

  console.log(`✅ All ${generated + skipped} voice samples ready in public/voice-samples/\n`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
