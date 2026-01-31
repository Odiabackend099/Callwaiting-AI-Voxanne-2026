const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Brand colors
const BRAND_COLORS = {
  obsidian: '#020412',
  surgical600: '#1D4ED8',
  surgical500: '#3B82F6',
  white: '#FFFFFF'
};

// Icon sizes needed
const APP_ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SHORTCUT_SIZE = 96;

// Paths
const SOURCE_LOGO = path.join(__dirname, '..', 'public', 'callwaiting-ai-logo.png');
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function generateAppIcons() {
  console.log('🎨 Generating app icons...');
  
  // Read source logo
  const sourceLogo = sharp(SOURCE_LOGO);
  const metadata = await sourceLogo.metadata();
  
  // Determine crop to make square (center crop)
  const minDimension = Math.min(metadata.width, metadata.height);
  const left = Math.floor((metadata.width - minDimension) / 2);
  const top = Math.floor((metadata.height - minDimension) / 2);
  
  // Generate icons for each size
  for (const size of APP_ICON_SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    
    await sharp(SOURCE_LOGO)
      .extract({
        left,
        top,
        width: minDimension,
        height: minDimension
      })
      .resize(size, size, {
        fit: 'contain',
        background: BRAND_COLORS.obsidian
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(outputPath);
    
    console.log(`  ✅ Generated ${size}x${size} icon`);
  }
}

async function generateShortcutIcon(name, emoji, bgColor) {
  const size = SHORTCUT_SIZE;
  const outputPath = path.join(ICONS_DIR, `shortcut-${name}.png`);
  
  // Create SVG with emoji/icon
  const svgIcon = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${bgColor}"/>
      <text x="50%" y="50%" font-size="${size * 0.6}" text-anchor="middle" 
            dominant-baseline="middle" fill="${BRAND_COLORS.white}">${emoji}</text>
    </svg>
  `;
  
  await sharp(Buffer.from(svgIcon))
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(outputPath);
  
  console.log(`  ✅ Generated ${name} shortcut icon`);
}

async function generateShortcutIcons() {
  console.log('🎨 Generating shortcut icons...');
  
  // Dashboard shortcut (chart icon)
  await generateShortcutIcon('dashboard', '📊', BRAND_COLORS.surgical600);
  
  // Calls shortcut (phone icon)
  await generateShortcutIcon('calls', '📞', BRAND_COLORS.surgical600);
  
  // Agent shortcut (robot icon)
  await generateShortcutIcon('agent', '🤖', BRAND_COLORS.surgical600);
}

async function main() {
  console.log('🚀 Starting PWA icon generation...\n');
  
  try {
    await generateAppIcons();
    console.log('');
    await generateShortcutIcons();
    console.log('\n✅ All icons generated successfully!');
    console.log(`📁 Icons saved to: ${ICONS_DIR}`);
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

main();
