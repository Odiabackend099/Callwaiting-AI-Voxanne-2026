#!/usr/bin/env ts-node

/**
 * Generate voiceovers for all scenes using ElevenLabs API
 *
 * Usage:
 *   ts-node scripts/generate-voiceovers.ts
 *
 * Environment variables required:
 *   ELEVENLABS_API_KEY - Your ElevenLabs API key
 */

import fs from 'fs/promises';
import path from 'path';
import { createElevenLabsClient } from '../../backend/src/services/elevenlabs-client';
import { createTTSCacheService } from '../../backend/src/services/tts-cache-service';
import {
  SCENE_VOICEOVERS,
  getSummaryStats,
  getTotalCharacterCount,
} from '../src/config/voiceover-config';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

async function main() {
  console.log(`${colors.bright}${colors.blue}
╔═══════════════════════════════════════════════════════════════╗
║  Voxanne AI - Voiceover Generation Script                     ║
║  Generating professional voiceovers for all scenes            ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}\n`);

  // 1. Validate API key
  const apiKey = process.env.ELEVENLABS_API_KEY || 'sk_d82a6528a55b45e25112c107fcbecf0bcafd70f9c325a09e';

  if (!apiKey) {
    console.error(`${colors.red}❌ Error: ELEVENLABS_API_KEY environment variable not set${colors.reset}`);
    process.exit(1);
  }

  // 2. Initialize services
  console.log(`${colors.yellow}🔧 Initializing ElevenLabs client...${colors.reset}`);
  const client = createElevenLabsClient(apiKey);
  const cacheService = createTTSCacheService(client);

  // 3. Show summary statistics
  const stats = getSummaryStats();
  console.log(`\n${colors.bright}📊 Summary Statistics:${colors.reset}`);
  console.log(`   Total scenes: ${stats.sceneCount}`);
  console.log(`   Total words: ${stats.totalWords}`);
  console.log(`   Total characters: ${stats.totalCharacters}`);
  console.log(`   Total duration: ${stats.totalDurationSeconds} seconds`);
  console.log(`   Average WPM: ${stats.averageWPM}`);
  console.log(`   Estimated cost: $${stats.estimatedCostUSD}\n`);

  // 4. Check quota (optional)
  try {
    const quota = await client.getQuota();
    console.log(`${colors.yellow}💳 ElevenLabs Quota:${colors.reset}`);
    console.log(`   Characters used: ${quota.character_count.toLocaleString()}`);
    console.log(`   Character limit: ${quota.character_limit.toLocaleString()}`);
    console.log(
      `   Remaining: ${(quota.character_limit - quota.character_count).toLocaleString()}\n`
    );

    const totalChars = getTotalCharacterCount();
    if (quota.character_count + totalChars > quota.character_limit) {
      console.error(
        `${colors.red}⚠️  Warning: Generating these voiceovers will exceed your quota!${colors.reset}`
      );
      console.error(
        `   Required: ${totalChars} characters, Available: ${
          quota.character_limit - quota.character_count
        } characters\n`
      );
    }
  } catch (error) {
    console.warn(
      `${colors.yellow}⚠️  Could not fetch quota information (continuing anyway)${colors.reset}\n`
    );
  }

  // 5. Create output directory
  const voiceoversDir = path.join(process.cwd(), 'public', 'audio', 'voiceovers');
  await fs.mkdir(voiceoversDir, { recursive: true });

  console.log(`${colors.bright}🎙️  Generating voiceovers for ${SCENE_VOICEOVERS.length} scenes...${colors.reset}\n`);

  // 6. Generate voiceovers for each scene
  const results: Array<{
    sceneId: string;
    success: boolean;
    audioPath?: string;
    error?: string;
    characterCount?: number;
    audioSizeKB?: number;
    source?: 'cache' | 'api';
  }> = [];

  for (let i = 0; i < SCENE_VOICEOVERS.length; i++) {
    const scene = SCENE_VOICEOVERS[i];
    const sceneNum = i + 1;

    console.log(
      `${colors.blue}[${sceneNum}/${SCENE_VOICEOVERS.length}] ${scene.sceneName} (${scene.sceneId})${colors.reset}`
    );
    console.log(`   Script: "${scene.script.substring(0, 80)}..."`);
    console.log(
      `   Characters: ${scene.script.length}, Target WPM: ${scene.wpmTarget}, Duration: ${scene.durationSeconds}s`
    );

    try {
      // Generate or get from cache
      const startTime = Date.now();
      const cached = await cacheService.getOrGenerateVoiceover({
        text: scene.script,
        voiceId: scene.voiceId,
        modelId: scene.modelId,
        stability: 0.75,
        similarityBoost: 0.75,
      });

      const elapsed = Date.now() - startTime;

      // Save to voiceovers directory
      const audioPath = path.join(voiceoversDir, `${scene.sceneId}.mp3`);
      await fs.writeFile(audioPath, cached.audioBuffer);

      const audioSizeKB = Math.round(cached.audioBuffer.length / 1024);
      const source = cached.source === 'cache' ? '💾 Cache' : '🌐 API';

      console.log(
        `   ${colors.green}✅ Generated: ${audioPath} (${audioSizeKB} KB, ${elapsed}ms, ${source})${colors.reset}\n`
      );

      results.push({
        sceneId: scene.sceneId,
        success: true,
        audioPath,
        characterCount: scene.script.length,
        audioSizeKB,
        source: cached.source,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ${colors.red}❌ Error: ${errorMessage}${colors.reset}\n`);

      results.push({
        sceneId: scene.sceneId,
        success: false,
        error: errorMessage,
      });
    }
  }

  // 7. Show results summary
  console.log(`\n${colors.bright}${colors.green}
╔═══════════════════════════════════════════════════════════════╗
║  Generation Complete                                          ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const fromCache = successful.filter((r) => r.source === 'cache');
  const fromAPI = successful.filter((r) => r.source === 'api');

  console.log(`${colors.green}✅ Successful: ${successful.length}/${results.length}${colors.reset}`);
  if (failed.length > 0) {
    console.log(`${colors.red}❌ Failed: ${failed.length}/${results.length}${colors.reset}`);
    failed.forEach((r) => {
      console.log(`   - ${r.sceneId}: ${r.error}`);
    });
  }

  console.log(`\n${colors.yellow}📊 Cache Performance:${colors.reset}`);
  console.log(`   From API: ${fromAPI.length}`);
  console.log(`   From cache: ${fromCache.length}`);
  if (successful.length > 0) {
    const cacheHitRate = (fromCache.length / successful.length) * 100;
    console.log(`   Cache hit rate: ${cacheHitRate.toFixed(1)}%`);
  }

  // Calculate total characters processed
  const totalCharactersProcessed = successful.reduce(
    (sum, r) => sum + (r.characterCount || 0),
    0
  );
  const totalAudioSizeKB = successful.reduce((sum, r) => sum + (r.audioSizeKB || 0), 0);

  console.log(`\n${colors.yellow}📈 Totals:${colors.reset}`);
  console.log(`   Characters processed: ${totalCharactersProcessed.toLocaleString()}`);
  console.log(`   Total audio size: ${totalAudioSizeKB.toLocaleString()} KB`);
  console.log(`   Estimated API cost: $${(fromAPI.length * 0.22).toFixed(2)}`);

  // 8. Show cache stats
  const cacheStats = await cacheService.getCacheStats();
  console.log(`\n${colors.yellow}💾 Cache Statistics:${colors.reset}`);
  console.log(
    `   In-memory: ${cacheStats.inMemory.entries} entries, ${cacheStats.inMemory.sizeMB.toFixed(2)} MB`
  );
  console.log(
    `   Filesystem: ${cacheStats.filesystem.entries} entries, ${cacheStats.filesystem.sizeMB.toFixed(2)} MB`
  );

  // 9. Show next steps
  console.log(`\n${colors.bright}${colors.blue}📝 Next Steps:${colors.reset}`);
  console.log(`   1. Check generated files in: ${voiceoversDir}`);
  console.log(`   2. Listen to audio files to verify quality`);
  console.log(`   3. Run: cd remotion-videos && npm run build`);
  console.log(`   4. Video will render with voiceovers included\n`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error(`\n${colors.red}💥 Fatal error:${colors.reset}`, error);
  process.exit(1);
});
