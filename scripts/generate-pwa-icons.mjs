#!/usr/bin/env node
/**
 * Generate PWA icons from source image
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 *
 * This script generates the following PWA icons from public/Brand/1.png:
 * - Favicon: public/favicon.ico
 * - Apple Touch Icon: public/apple-touch-icon.png
 * - Icons: public/icons/icon-{72,96,128,144,152,192,384,512}x{size}.png
 */

import sharp from 'sharp';
import { mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const sourceImage = path.join(projectRoot, 'public', 'Brand', '5.png');
const iconDir = path.join(projectRoot, 'public', 'icons');
const publicDir = path.join(projectRoot, 'public');

// Icon sizes to generate
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generatePWAIcons() {
  console.log('🎨 Generating PWA icons from Brand/5.png...\n');

  // Verify source image exists
  if (!existsSync(sourceImage)) {
    console.error(`❌ Source image not found: ${sourceImage}`);
    process.exit(1);
  }

  // Create icons directory
  await mkdir(iconDir, { recursive: true });

  try {
    // Load source image
    const sourceData = sharp(sourceImage);
    const metadata = await sourceData.metadata();
    console.log(`✅ Source image loaded: ${metadata.width}x${metadata.height} (${metadata.format})`);

    // Generate favicon.ico (multisize)
    console.log('\n📍 Generating favicon.ico...');
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile(path.join(publicDir, 'favicon.ico'));
    console.log('   ✅ favicon.ico (32x32)');

    // Generate apple-touch-icon.png
    console.log('\n🍎 Generating Apple Touch Icon...');
    await sharp(sourceImage)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('   ✅ apple-touch-icon.png (180x180)');

    // Generate PWA icons
    console.log('\n📱 Generating PWA icons...');
    for (const size of iconSizes) {
      const filename = path.join(iconDir, `icon-${size}x${size}.png`);

      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 2, g: 4, b: 18, alpha: 1 } // Deep Obsidian background
        })
        .png()
        .toFile(filename);

      console.log(`   ✅ icon-${size}x${size}.png`);
    }

    console.log('\n✨ PWA icon generation complete!');
    console.log('\nGenerated files:');
    console.log('  📄 public/favicon.ico');
    console.log('  🍎 public/apple-touch-icon.png');
    console.log('  📁 public/icons/');
    console.log(`     └─ icon-{72,96,128,144,152,192,384,512}x{size}.png (8 files)`);
    console.log('\n📋 Icons configured in manifest.json and ready for PWA deployment');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run the script
generatePWAIcons().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
