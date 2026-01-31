# PWA Assets Generation Guide

## Overview

This guide provides step-by-step instructions for generating all PWA icons and screenshots required for Voxanne AI's Progressive Web App implementation.

## Phase 2A.5: PWA Icons & Screenshots

### Required Assets

#### 1. App Icons (8 sizes)

**Location:** `/public/icons/`

| Filename | Size | Purpose | Format |
|----------|------|---------|--------|
| `icon-72x72.png` | 72×72px | iOS Safari, older devices | PNG |
| `icon-96x96.png` | 96×96px | Android Chrome, shortcuts | PNG |
| `icon-128x128.png` | 128×128px | Chrome Web Store | PNG |
| `icon-144x144.png` | 144×144px | Windows Metro tiles | PNG |
| `icon-152x152.png` | 152×152px | iOS Safari (iPad) | PNG |
| `icon-192x192.png` | 192×192px | Android (required, maskable) | PNG |
| `icon-384x384.png` | 384×384px | Android (larger devices) | PNG |
| `icon-512x512.png` | 512×512px | Android (required, maskable) | PNG |

**Design Requirements:**
- Use Voxanne AI brand colors (#020412 obsidian, #1D4ED8 surgical-600)
- Icon should be recognizable at all sizes
- Include 10-20% safe zone for maskable icons (192×192, 512×512)
- Ensure icon works on light and dark backgrounds
- Use vector source (SVG) for consistency

**Recommended Tools:**
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Figma](https://www.figma.com/) for design
- [ImageOptim](https://imageoptim.com/) for compression

**Quick Generation Command:**
```bash
npx pwa-asset-generator logo.svg public/icons/ \
  --icon-only \
  --padding "10%" \
  --background "#020412" \
  --index public/manifest.json \
  --manifest public/manifest.json
```

#### 2. App Shortcut Icons (3 icons)

**Location:** `/public/icons/`

| Filename | Size | Purpose | Icon Design |
|----------|------|---------|-------------|
| `shortcut-dashboard.png` | 96×96px | Dashboard shortcut | Bar chart/graph icon |
| `shortcut-calls.png` | 96×96px | Call logs shortcut | Phone/call icon |
| `shortcut-agent.png` | 96×96px | Agent config shortcut | Bot/AI icon |

**Design Requirements:**
- Match Voxanne AI brand colors
- Simple, recognizable icons
- Solid background color (#1D4ED8 surgical-600)
- White icon/glyph
- 10px padding around icon

**Icon Suggestions:**
- Dashboard: `BarChart3`, `TrendingUp`, or `Activity` from lucide-react
- Calls: `Phone`, `PhoneCall`, or `PhoneIncoming` from lucide-react
- Agent: `Bot`, `Cpu`, or `Settings` from lucide-react

**Generation Steps:**
1. Create 96×96px artboard in Figma/Sketch
2. Add background rectangle: 96×96px, fill #1D4ED8
3. Add icon glyph: 56×56px (centered), fill #FFFFFF
4. Export as PNG, optimize with ImageOptim
5. Save to `/public/icons/`

#### 3. App Screenshots (2 screenshots)

**Location:** `/public/screenshots/`

| Filename | Size | Form Factor | Content |
|----------|------|-------------|---------|
| `desktop-dashboard.png` | 1920×1080px | Wide (desktop) | Dashboard overview with analytics |
| `mobile-dashboard.png` | 750×1334px | Narrow (mobile) | Mobile dashboard view |

**Desktop Screenshot Requirements:**
- **Size:** 1920×1080px (16:9 aspect ratio)
- **Content:** Dashboard overview showing:
  - Top navigation bar
  - Left sidebar (if visible)
  - Main dashboard content (call stats, analytics charts)
  - Recent call logs or activity
  - Visual proof of functionality
- **Quality:** High-resolution, no pixelation
- **Format:** PNG (best quality) or JPEG (smaller file size)

**Mobile Screenshot Requirements:**
- **Size:** 750×1334px (iPhone 6/7/8 portrait)
- **Content:** Mobile-optimized dashboard showing:
  - Mobile navigation (hamburger menu if present)
  - Key metrics/stats (condensed for mobile)
  - Touch-friendly UI elements
  - Bottom navigation (if present)
- **Quality:** High-resolution, crisp UI elements
- **Format:** PNG or JPEG

**Generation Methods:**

**Option 1: Live Screenshots (Recommended)**
```bash
# 1. Build and run the app in production mode
npm run build
npm run start

# 2. Open in browser
# Desktop: http://localhost:3000/dashboard (full screen, 1920×1080 resolution)
# Mobile: Use Chrome DevTools device toolbar (iPhone 6/7/8)

# 3. Take screenshots
# macOS: Cmd + Shift + 4, then Space (full window)
# Windows: Win + Shift + S
# Linux: Screenshot tool

# 4. Crop to exact dimensions if needed
# Use Preview (macOS), Paint (Windows), or GIMP (Linux)

# 5. Optimize
# ImageOptim, TinyPNG, or Squoosh
```

**Option 2: Automated Screenshots (Playwright)**
```bash
# Install Playwright
npm install -D @playwright/test

# Create screenshot script
cat > scripts/generate-screenshots.js << 'EOF'
const { chromium } = require('playwright');

async function generateScreenshots() {
  const browser = await chromium.launch();
  
  // Desktop screenshot
  const desktopPage = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });
  await desktopPage.goto('http://localhost:3000/dashboard');
  await desktopPage.waitForTimeout(2000); // Wait for animations
  await desktopPage.screenshot({
    path: 'public/screenshots/desktop-dashboard.png',
    fullPage: false
  });
  
  // Mobile screenshot
  const mobilePage = await browser.newPage({
    viewport: { width: 750, height: 1334 }
  });
  await mobilePage.goto('http://localhost:3000/dashboard');
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({
    path: 'public/screenshots/mobile-dashboard.png',
    fullPage: false
  });
  
  await browser.close();
  console.log('✅ Screenshots generated!');
}

generateScreenshots();
EOF

# Run script
node scripts/generate-screenshots.js
```

**Option 3: Design Mockups (if app not ready)**
- Create mockups in Figma/Sketch matching exact dimensions
- Export at 2x resolution for retina displays
- Compress with ImageOptim/TinyPNG

## Quality Checklist

### Icons
- [ ] All 8 app icons generated (72, 96, 128, 144, 152, 192, 384, 512)
- [ ] All 3 shortcut icons generated (dashboard, calls, agent)
- [ ] Icons use Voxanne AI brand colors
- [ ] Maskable icons (192×192, 512×512) have safe zone
- [ ] Icons optimized with ImageOptim (file size < 50KB each)
- [ ] Icons tested on multiple backgrounds (light/dark)

### Screenshots
- [ ] Desktop screenshot (1920×1080) generated
- [ ] Mobile screenshot (750×1334) generated
- [ ] Screenshots show actual dashboard (not placeholder)
- [ ] Screenshots are high-quality (no blur/pixelation)
- [ ] Screenshots optimized (file size < 500KB each)
- [ ] Screenshots include realistic data (not Lorem Ipsum)

## Validation

### Manifest Validation
```bash
# Check manifest is valid JSON
cat public/manifest.json | jq

# Validate manifest with Chrome DevTools
# 1. Open https://localhost:3000 in Chrome
# 2. DevTools → Application → Manifest
# 3. Check for errors
```

### Icon Validation
```bash
# Check all icons exist
for size in 72 96 128 144 152 192 384 512; do
  if [ -f "public/icons/icon-${size}x${size}.png" ]; then
    echo "✅ ${size}x${size} icon exists"
  else
    echo "❌ ${size}x${size} icon missing"
  fi
done

# Check shortcut icons
for icon in dashboard calls agent; do
  if [ -f "public/icons/shortcut-${icon}.png" ]; then
    echo "✅ shortcut-${icon}.png exists"
  else
    echo "❌ shortcut-${icon}.png missing"
  fi
done
```

### Screenshot Validation
```bash
# Check screenshots exist
for screenshot in desktop-dashboard mobile-dashboard; do
  if [ -f "public/screenshots/${screenshot}.png" ]; then
    echo "✅ ${screenshot}.png exists"
  else
    echo "❌ ${screenshot}.png missing"
  fi
done

# Check dimensions
sips -g pixelWidth -g pixelHeight public/screenshots/desktop-dashboard.png
# Expected: pixelWidth: 1920, pixelHeight: 1080

sips -g pixelWidth -g pixelHeight public/screenshots/mobile-dashboard.png
# Expected: pixelWidth: 750, pixelHeight: 1334
```

## Best Practices

### Icon Design
1. **Simplicity:** Icons should be simple and recognizable at small sizes
2. **Contrast:** Ensure good contrast between icon and background
3. **Consistency:** Use consistent design language across all sizes
4. **Branding:** Incorporate Voxanne AI brand elements (colors, typography)
5. **Testing:** Test on multiple devices and backgrounds

### Screenshot Quality
1. **Realism:** Use real data, not placeholder text
2. **Cleanliness:** Remove any debug elements, banners, or warnings
3. **Branding:** Ensure brand colors and logos are visible
4. **Context:** Show key features and value propositions
5. **Optimization:** Compress without losing quality (aim for < 500KB)

## Next Steps

After generating all assets:

1. **Verify Installation:**
   ```bash
   npm run build
   npm run start
   # Open http://localhost:3000 in Chrome
   # DevTools → Application → Manifest
   # Check all icons and screenshots are loaded
   ```

2. **Test PWA Installation:**
   - Desktop: Look for install button in address bar
   - Mobile: Add to Home Screen
   - Verify shortcuts appear when right-clicking app icon

3. **Run Lighthouse Audit:**
   ```bash
   npx lighthouse http://localhost:3000 --view
   # Check PWA score (should be 100/100)
   ```

4. **Update TODO:**
   - Mark "Generate PWA icons and screenshots" as complete
   - Move to Week 2 tasks (Install prompt, network status, etc.)

## Resources

**Icon Design:**
- [PWA Icon Guidelines](https://web.dev/add-manifest/#icons)
- [Maskable.app](https://maskable.app/) - Test maskable icons
- [Lucide Icons](https://lucide.dev/) - Icon library for shortcuts

**Screenshot Tools:**
- [Playwright](https://playwright.dev/) - Automated screenshots
- [Figma](https://www.figma.com/) - Design mockups
- [ImageOptim](https://imageoptim.com/) - Image compression

**Validation:**
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [PWA Builder](https://www.pwabuilder.com/manifest)
- Chrome DevTools → Application → Manifest

---

**Last Updated:** 2026-01-31  
**Status:** Ready for asset generation  
**Estimated Time:** 2-3 hours
