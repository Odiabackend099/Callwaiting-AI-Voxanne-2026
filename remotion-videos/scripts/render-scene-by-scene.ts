#!/usr/bin/env ts-node

/**
 * Scene-by-Scene Video Rendering Workflow
 *
 * This script renders Remotion scenes one at a time, allowing user review
 * and approval after each scene before proceeding to the next.
 *
 * Usage:
 *   ts-node scripts/render-scene-by-scene.ts
 *
 * Workflow:
 *   1. Generate voiceover for scene (if not cached)
 *   2. Render video with audio
 *   3. Pause for user review
 *   4. User approves (ENTER), redoes scene ('redo'), or aborts ('abort')
 *   5. Repeat for all 13 scenes
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { statSync, existsSync } from 'fs';
import * as readline from 'readline';
import path from 'path';
import { SCENE_VOICEOVERS } from '../src/config/voiceover-config';
import { execSync } from 'child_process';

// Scene metadata (mapped from voiceover config)
interface SceneMetadata {
  id: string;
  name: string;
  duration: number;
  composition: string;
}

// Map scene IDs to composition names
const SCENES: SceneMetadata[] = [
  { id: 'scene-0a', name: 'Homepage Scroll', duration: 300, composition: 'Scene0A' },
  { id: 'scene-0b', name: 'Sign In', duration: 300, composition: 'Scene0B' },
  { id: 'scene-2', name: 'Dashboard Overview', duration: 180, composition: 'Scene2' },
  { id: 'scene-3', name: 'Configure Agent', duration: 240, composition: 'Scene3' },
  { id: 'scene-4', name: 'Upload Knowledge', duration: 150, composition: 'Scene4' },
  { id: 'scene-5', name: 'Connect Telephony', duration: 210, composition: 'Scene5' },
  { id: 'scene-6', name: 'AI Forwarding', duration: 240, composition: 'Scene6' },
  { id: 'scene-7', name: 'Browser Test', duration: 240, composition: 'Scene7' },
  { id: 'scene-8', name: 'Live Phone Test', duration: 240, composition: 'Scene8' },
  { id: 'scene-9', name: 'Call Logs', duration: 180, composition: 'Scene9' },
  { id: 'scene-10', name: 'Hot Leads', duration: 180, composition: 'Scene10' },
  { id: 'scene-11', name: 'Appointments Booked', duration: 180, composition: 'Scene11' },
  { id: 'scene-12', name: 'CTA', duration: 480, composition: 'Scene12' },
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Prompt user for input with readline
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Generate voiceover for a single scene
 */
async function generateVoiceover(sceneId: string): Promise<void> {
  const voiceoverPath = path.join(__dirname, '../public/audio/voiceovers', `${sceneId}.mp3`);

  if (existsSync(voiceoverPath)) {
    console.log(`${colors.green}✅ Voiceover cached: ${sceneId}.mp3${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}🎤 Generating voiceover: ${sceneId}.mp3...${colors.reset}`);

  try {
    // Run the generate-voiceovers script (which handles ElevenLabs API calls and caching)
    execSync(`cd ${__dirname} && ts-node generate-voiceovers.ts --scene ${sceneId}`, {
      stdio: 'inherit',
    });
    console.log(`${colors.green}✅ Voiceover generated${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Voiceover generation failed${colors.reset}`);
    throw error;
  }
}

/**
 * Render a single scene to video
 */
async function renderScene(scene: SceneMetadata, bundledPath: string): Promise<string> {
  const outputPath = path.join(__dirname, '../out', `${scene.id}.mp4`);

  console.log(`${colors.cyan}📹 Rendering video (${scene.duration} frames @ 30fps)...${colors.reset}`);

  try {
    // Select composition
    const composition = await selectComposition({
      serveUrl: bundledPath,
      id: scene.composition,
      inputProps: {},
    });

    // Render video
    await renderMedia({
      composition,
      serveUrl: bundledPath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {},
      onProgress: ({ progress }) => {
        process.stdout.write(`\r   ${colors.blue}Progress: ${(progress * 100).toFixed(1)}%${colors.reset}`);
      },
    });

    console.log(''); // New line after progress
    return outputPath;
  } catch (error) {
    console.error(`${colors.red}❌ Rendering failed${colors.reset}`);
    throw error;
  }
}

/**
 * Main scene-by-scene rendering workflow
 */
async function renderSceneByScene() {
  console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🎬  SCENE-BY-SCENE VIDEO PRODUCTION WORKFLOW  🎬          ║
║                                                               ║
║     Total Scenes: ${SCENES.length}                                           ║
║     Expected Duration: 90 seconds                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}\n`);

  // Bundle Remotion project once (reuse for all scenes)
  console.log(`${colors.yellow}🔧 Bundling Remotion project...${colors.reset}`);
  const bundled = await bundle(require.resolve('../src/index.ts'));
  console.log(`${colors.green}✅ Bundle created${colors.reset}\n`);

  // Render scenes one by one
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];

    console.log(`${colors.bright}${colors.magenta}
═══════════════════════════════════════════════════════════════
🎬  Scene ${i + 1}/${SCENES.length}: ${scene.name}
═══════════════════════════════════════════════════════════════
${colors.reset}`);

    // Step 1: Generate voiceover (if needed)
    console.log(`${colors.yellow}1️⃣  Generating voiceover: ${scene.id}.mp3...${colors.reset}`);
    try {
      await generateVoiceover(scene.id);
    } catch (error) {
      console.error(`${colors.red}❌ Failed to generate voiceover. Aborting.${colors.reset}`);
      process.exit(1);
    }

    // Step 2: Render video
    console.log(`\n${colors.yellow}2️⃣  Rendering video...${colors.reset}`);
    let outputPath: string;
    try {
      outputPath = await renderScene(scene, bundled);
    } catch (error) {
      console.error(`${colors.red}❌ Failed to render scene. Aborting.${colors.reset}`);
      process.exit(1);
    }

    // Step 3: Show file info
    const stats = statSync(outputPath);
    console.log(`${colors.green}✅ Video saved: ${outputPath}${colors.reset}`);
    console.log(`   ${colors.cyan}File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB${colors.reset}`);
    console.log(`   ${colors.cyan}Duration: ${(scene.duration / 30).toFixed(1)} seconds${colors.reset}`);

    // Step 4: Pause for user review
    console.log(`\n${colors.bright}${colors.yellow}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     📺  REVIEW REQUIRED                                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`${colors.cyan}Watch the video:${colors.reset} ${outputPath}`);
    console.log(`\n${colors.yellow}Options:${colors.reset}`);
    console.log(`  ${colors.green}→ Press ENTER to approve and continue${colors.reset}`);
    console.log(`  ${colors.blue}→ Type 'redo' to regenerate this scene${colors.reset}`);
    console.log(`  ${colors.red}→ Type 'abort' to stop the workflow${colors.reset}\n`);

    const answer = await promptUser(`${colors.bright}Your choice: ${colors.reset}`);

    if (answer.toLowerCase() === 'abort') {
      console.log(`\n${colors.red}❌ Workflow aborted at Scene ${i + 1}/${SCENES.length}${colors.reset}`);
      console.log(`\n${colors.yellow}📝 Progress saved:${colors.reset}`);
      console.log(`   Scenes 1-${i}: Completed and saved in 'out/' directory`);
      console.log(`   Scene ${i + 1}: Rendered but not approved`);
      console.log(`   Scenes ${i + 2}-${SCENES.length}: Not started`);
      process.exit(0);
    } else if (answer.toLowerCase() === 'redo') {
      console.log(`\n${colors.blue}🔄 Redoing Scene ${i + 1}/${SCENES.length}...${colors.reset}\n`);
      i--; // Go back one scene
      continue;
    } else {
      console.log(`\n${colors.green}✅ Scene ${i + 1}/${SCENES.length} approved! Moving to next scene...${colors.reset}\n`);
    }
  }

  // All scenes complete!
  console.log(`${colors.bright}${colors.green}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🎉  ALL ${SCENES.length} SCENES COMPLETED AND APPROVED! 🎉      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}\n`);

  console.log(`${colors.cyan}📂 Scene videos saved in:${colors.reset} ${path.join(__dirname, '../out')}`);
  console.log(`${colors.yellow}
➡️  Next Step: Merge all scenes into final video${colors.reset}
    Run: ${colors.bright}npm run merge:scenes${colors.reset}
    Or:  ${colors.bright}bash scripts/merge-scenes.sh${colors.reset}\n`);
}

// Run the workflow
renderSceneByScene().catch((err) => {
  console.error(`${colors.red}❌ Fatal error:${colors.reset}`, err);
  process.exit(1);
});
