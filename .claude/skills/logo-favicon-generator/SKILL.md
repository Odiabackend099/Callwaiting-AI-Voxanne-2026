# 🎨 Logo & Favicon Generator Skill

**Skill Name:** logo-favicon-generator
**Version:** 1.0.0
**Status:** Production Ready
**Created:** 2026-01-29
**Category:** Image Processing & Asset Generation

---

## Overview

This skill extracts logos from images and generates professional favicon and PWA icon sets automatically. Perfect for brand updates, new product launches, or integrating logos into web projects.

## When to Use This Skill

✅ **Use this skill when:**
- Creating favicons from logo source images
- Generating PWA icon sets (72px through 512px)
- Updating app icons for branding consistency
- Building icon libraries from design files
- Automating logo asset generation
- Converting designer logos to web-ready formats

❌ **Don't use this skill for:**
- Manual image editing (use design tools like Figma)
- Complex image transformations (use ImageMagick)
- Logo design from scratch (use a designer)
- Non-image assets (use appropriate tools)

---

## Quick Start (5 Minutes)

### Step 1: Locate Your Logo
```bash
# Logo should be in public/Brand/ directory
ls -la public/Brand/
# Expected output:
# 1.png - Horizontal light (full logo with text)
# 2.png - Horizontal dark
# 3.png - Icon only blue
# 4.png - Icon only navy
# 5.png - Icon only white ✅ RECOMMENDED
# 6.png - Text only light
# 7.png - Text only dark
# 9.png - Color palette reference
```

### Step 2: Run Icon Generation
```bash
# Generate all icons from default source (Brand/5.png)
npm run generate-icons

# Or using Node directly:
node scripts/generate-pwa-icons.mjs
```

### Step 3: Verify Generated Icons
```bash
# Check favicon
ls -lh public/favicon.ico
# Expected: 32x32 ICO file (~15KB)

# Check PWA icons
ls -lh public/icons/
# Expected: 8 PNG files (72x72 through 512x512)

# Check Apple touch icon
ls -lh public/apple-touch-icon.png
# Expected: 180x180 PNG (~50KB)
```

### Step 4: Test in Browser
```bash
# Start development server
npm run dev

# Visit http://localhost:3000
# Check browser tab - favicon should appear
# Check DevTools > Application > Manifest - PWA icons listed
```

**Total Time:** ~2 minutes
**Success Indicator:** Favicon visible in browser tab, no console errors

---

## Complete Guide

### Understanding Logo Variants

**Best Practices by Use Case:**

| Logo Variant | Best For | Size | Transparency |
|--------------|----------|------|--------------|
| Brand/1.png (Horizontal Light) | Large displays, headers | 1000x500+ | Usually opaque |
| Brand/3.png (Icon Blue) | Navigation bars, nav buttons | 512x512 | Transparent background ✅ |
| Brand/5.png (Icon White) | App icons, favicons, dark backgrounds | 512x512 | Transparent background ✅ |

**Recommendation:** Use **Brand/5.png (Icon White)** for PWA icon generation because:
- ✅ Transparent background scales cleanly at all sizes
- ✅ White icon visible on any background (light or dark)
- ✅ Maintains legibility at small sizes (16px favicon)
- ✅ Professional appearance in app stores
- ✅ Consistent with modern design standards

### Configuration Options

**File:** `scripts/generate-pwa-icons.mjs`

**Customizable Settings:**

```javascript
// Line 21: Change source image
const sourceImage = path.join(projectRoot, 'public', 'Brand', '5.png');
// Options: '1.png', '3.png', '5.png', or custom path

// Line 26: Change icon sizes
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
// Add/remove sizes as needed (must be square dimensions)

// Line 29: Update log message (optional)
console.log('🎨 Generating PWA icons from Brand/5.png...\n');
```

**Common Size Scenarios:**

```javascript
// Minimal PWA (mobile-focused)
const iconSizes = [192, 512];

// Full PWA suite (all devices)
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Enhanced with extra sizes (tablets + desktops)
const iconSizes = [48, 64, 72, 96, 128, 144, 152, 192, 256, 384, 512];
```

### Generated Assets Explained

**1. Favicon (favicon.ico)**
- **Size:** 32x32 pixels
- **Format:** ICO (Windows icon format)
- **Location:** `public/favicon.ico`
- **Purpose:** Displayed in browser tab, address bar, bookmarks
- **Compatibility:** All browsers, all devices
- **Optimization:** Automatically optimized for web

**2. Apple Touch Icon (apple-touch-icon.png)**
- **Size:** 180x180 pixels
- **Format:** PNG (transparent)
- **Location:** `public/apple-touch-icon.png`
- **Purpose:** Shown when user saves app to iPhone home screen
- **Compatibility:** iOS Safari, iPadOS
- **Optimization:** High quality for retina displays

**3. PWA Icons (icon-{size}x{size}.png)**
- **Sizes:** 72, 96, 128, 144, 152, 192, 384, 512 pixels
- **Format:** PNG (transparent)
- **Location:** `public/icons/icon-{size}x{size}.png`
- **Purpose:** App manifest references, Android app store
- **Compatibility:** All modern browsers, Android, PWA stores
- **Optimization:** Progressive enhancement (use larger versions where possible)

**File Size Reference:**
```
favicon.ico              ~15 KB
apple-touch-icon.png    ~40-50 KB
icon-72x72.png          ~2-3 KB
icon-192x192.png        ~8-10 KB
icon-512x512.png        ~20-25 KB
Total Package           ~95-110 KB (cached, loaded once)
```

### Integration with Web App

**Step 1: Update Head Metadata**

File: `src/app/layout.tsx`

```typescript
export const metadata: Metadata = {
  // ... existing metadata ...
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};
```

**Step 2: Update PWA Manifest**

File: `public/manifest.json`

```json
{
  "name": "Voxanne AI",
  "short_name": "Voxanne",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "theme_color": "#1D4ED8",
  "background_color": "#FFFFFF",
  "display": "standalone",
  "start_url": "/"
}
```

**Step 3: Verify Implementation**

```bash
# Check manifest is valid JSON
npm run build

# Test PWA installation (Chrome DevTools)
# 1. F12 to open DevTools
# 2. Application > Manifest
# 3. Verify icons listed correctly
# 4. Click "Add to Home Screen" to test

# Test favicon in multiple contexts
# 1. Tab (upper left icon)
# 2. Bookmark bar (if bookmarked)
# 3. Browser history
# 4. Tab menu (right-click on tab)
```

---

## Advanced Usage

### Custom Logo Path

If your logo is stored outside `public/Brand/`:

```javascript
// scripts/generate-pwa-icons.mjs - Line 21

// Option 1: Absolute path
const sourceImage = '/path/to/custom/logo.png';

// Option 2: Relative to project
const sourceImage = path.join(projectRoot, 'designs', 'logos', 'v2.png');

// Option 3: URL (requires download first)
const downloadLogo = async (url) => {
  const response = await fetch(url);
  const buffer = await response.buffer();
  await fs.promises.writeFile(sourceImage, buffer);
};
```

### Batch Processing Multiple Logos

Create multiple icon sets for different brands/products:

```javascript
// scripts/generate-multi-brand-icons.mjs

const logos = [
  { name: 'voxanne', path: 'public/Brand/5.png', outDir: 'public/icons/voxanne' },
  { name: 'partner-a', path: 'public/logos/partner-a.png', outDir: 'public/icons/partner-a' },
  { name: 'partner-b', path: 'public/logos/partner-b.png', outDir: 'public/icons/partner-b' }
];

for (const logo of logos) {
  await generatePWAIcons(logo.path, logo.outDir);
  console.log(`✅ Generated icons for ${logo.name}`);
}
```

### Automated Icon Updates

Add to package.json scripts:

```json
{
  "scripts": {
    "generate-icons": "node scripts/generate-pwa-icons.mjs",
    "generate-icons:watch": "nodemon --watch public/Brand/5.png --exec 'npm run generate-icons'",
    "prebuild": "npm run generate-icons",
    "predeploy": "npm run generate-icons && npm run build"
  }
}
```

Now icons automatically regenerate before every deploy:
```bash
npm run deploy  # Regenerates icons → builds → deploys
```

### Image Quality Optimization

The generation script uses Sharp library with sensible defaults:

```javascript
// Current settings (good balance of quality + size)
sharp(sourceImage)
  .resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent fill
  })
  .png({
    quality: 80,        // 0-100 (80 = good quality, smaller file)
    compressionLevel: 9 // 0-9 (9 = maximum compression)
  })
  .toFile(`${outputPath}`);
```

**To increase quality** (larger files):
```javascript
quality: 95,           // Higher quality
compressionLevel: 6    // Faster processing
```

**To decrease file size** (lower quality):
```javascript
quality: 60,           // Lower quality
compressionLevel: 9    // Maximum compression
```

---

## Troubleshooting

### Issue: Icons Appear Blurry at Small Sizes

**Symptoms:** favicon looks pixelated or fuzzy in browser tab

**Causes:**
1. Source image too small (<256x256)
2. Quality setting too low
3. Browser caching old icons

**Solutions:**
```bash
# Step 1: Check source image dimensions
file public/Brand/5.png
# Should be at least 512x512 pixels

# Step 2: Update quality in script
# Change quality from 80 to 95 in generate-pwa-icons.mjs

# Step 3: Clear browser cache
# Chrome: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
# Select "All time" and "Cookies and cached images"

# Step 4: Hard refresh
# Ctrl+F5 (or Cmd+Shift+R on Mac)
```

### Issue: Favicon Not Updating in Browser

**Symptoms:** New favicon doesn't appear after regeneration

**Causes:**
1. Browser cached old favicon
2. Favicon path incorrect in HTML head
3. File not actually generated

**Solutions:**
```bash
# Step 1: Verify favicon generated
ls -lh public/favicon.ico
# Should show recent timestamp

# Step 2: Verify manifest reference
grep -n "favicon" src/app/layout.tsx
# Should see: <link rel="icon" href="/favicon.ico" />

# Step 3: Hard refresh in browser
# Chrome: Ctrl+Shift+Delete → Clear all → Hard refresh (Ctrl+F5)

# Step 4: Test with different browser
# If works in Firefox but not Chrome, it's browser cache
```

### Issue: PWA Installation Not Working

**Symptoms:** "Add to Home Screen" option not appearing in Chrome

**Causes:**
1. manifest.json not linked in HTML
2. HTTPS not enabled (required for PWA)
3. Service worker not registered
4. Icons missing from manifest

**Solutions:**
```bash
# Step 1: Check manifest link
grep "manifest" public/index.html
# Should see: <link rel="manifest" href="/manifest.json" />

# Step 2: Verify manifest.json syntax
npm install -g json-lint
json-lint public/manifest.json

# Step 3: Check manifest in DevTools
# Open Chrome DevTools → Application → Manifest
# Should show all icons listed

# Step 4: Enable HTTPS
# Localhost works for testing, but production requires HTTPS
```

### Issue: Transparent Background Not Working

**Symptoms:** Logo has white/black background instead of transparent

**Causes:**
1. Source image is JPG (no transparency support)
2. Source image background not actually transparent
3. Sharp configuration removing transparency

**Solutions:**
```bash
# Step 1: Check source image format
file public/Brand/5.png
# Must be PNG (not JPG)

# Step 2: Verify transparency in source
identify -verbose public/Brand/5.png | grep Alpha
# Should show: Alpha: true

# Step 3: Use correct source image
# Use Brand/5.png (white icon) instead of Brand/1.png (has opaque background)

# Step 4: Regenerate with transparent background
# Script already handles this (transparent fill in resize config)
npm run generate-icons
```

---

## Best Practices

### 1. Source Image Selection

✅ **DO:**
- Use Brand/5.png (icon white) for web icons
- Ensure source is square (512x512 minimum)
- Verify transparent background
- Test at 16px size (favicon) to confirm legibility

❌ **DON'T:**
- Use Brand/1.png (has embedded text, won't scale well)
- Use JPG or WebP (no transparency support)
- Use non-square images (creates letterboxing)
- Trust browser's auto-resizing of large images

### 2. Version Control

```bash
# DO commit generated icons to git
git add public/favicon.ico
git add public/icons/
git add public/apple-touch-icon.png

# They're part of your build artifacts and should be in repo
# (Allow icons to be deployed with code)
```

### 3. Performance Optimization

```javascript
// Set Cache-Control headers in deployment
// (Icons are immutable, cache forever)

// vercel.json or .netlify/functions/response-headers.json
{
  "public/favicon.ico": "public, max-age=31536000, immutable",
  "public/icons/**": "public, max-age=31536000, immutable",
  "public/apple-touch-icon.png": "public, max-age=31536000, immutable"
}
```

### 4. Testing Checklist

```markdown
## Icon Deployment Checklist

- [ ] Regenerated icons: `npm run generate-icons`
- [ ] Verified favicon appears in browser tab
- [ ] Tested PWA install on Chrome DevTools
- [ ] Tested Apple touch icon on iOS (visited site → Share → Add to Home Screen)
- [ ] Verified manifest.json is valid JSON
- [ ] Checked icons in multiple browsers (Chrome, Firefox, Safari)
- [ ] Confirmed transparent backgrounds (no white/black borders)
- [ ] Tested zoom to 200% (icons still crisp)
- [ ] Committed icons to git: `git add public/`
- [ ] Deployed to staging and verified
- [ ] Deployed to production and verified
```

---

## Integration Examples

### React Component Using Generated Icons

```typescript
// src/components/BrandIcon.tsx
import Image from 'next/image';

export function BrandIcon({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/icons/icon-192x192.png"
      alt="Voxanne AI"
      width={size}
      height={size}
      priority
    />
  );
}
```

### Email Template Using Favicon

```html
<!-- Email signature -->
<table>
  <tr>
    <td>
      <img
        src="https://voxanne.ai/favicon.ico"
        alt="Voxanne AI"
        style="width: 32px; height: 32px;"
      />
    </td>
    <td>
      <strong>Voxanne AI</strong><br/>
      AI Receptionist Platform
    </td>
  </tr>
</table>
```

### Social Media Meta Tags

```html
<!-- In HTML head -->
<meta property="og:image" content="https://voxanne.ai/icons/icon-512x512.png" />
<meta name="twitter:image" content="https://voxanne.ai/icons/icon-512x512.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Voxanne" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

---

## Requirements

**System Requirements:**
- Node.js 16+
- npm or yarn

**Dependencies:**
```json
{
  "devDependencies": {
    "sharp": "^0.33.0"
  }
}
```

**Installation:**
```bash
npm install --save-dev sharp
```

**Verify Installation:**
```bash
npm ls sharp
# Should show: sharp@0.33.0 or higher
```

---

## Common Scenarios

### Scenario 1: New Product Launch with New Logo

```bash
# 1. Designer provides logo.png
cp ~/Downloads/new-product-logo.png public/Brand/10.png

# 2. Update generation script
# Edit scripts/generate-pwa-icons.mjs
# Change line 21: const sourceImage = path.join(..., '10.png');

# 3. Generate icons
npm run generate-icons

# 4. Update manifest and metadata
# Edit public/manifest.json (update icons path)
# Edit src/app/layout.tsx (if needed)

# 5. Commit and deploy
git add public/
git commit -m "feat: update product logo and icons"
git push
```

### Scenario 2: Brand Refresh (Update Existing Logo)

```bash
# 1. Replace existing logo file
cp ~/Downloads/updated-logo.png public/Brand/5.png

# 2. Regenerate all icons (automatically uses new logo)
npm run generate-icons

# 3. Commit changes
git add public/favicon.ico public/icons/ public/apple-touch-icon.png
git commit -m "feat: update brand logo and favicon icons"
git push origin main

# 4. Deploy
# Icons automatically deployed with next build
```

### Scenario 3: Multi-Brand Application

```bash
# 1. Create separate brand directories
mkdir -p public/Brand/voxanne
mkdir -p public/Brand/partner-a
mkdir -p public/Brand/partner-b

# 2. Place logos in each
cp voxanne-logo.png public/Brand/voxanne/icon.png
cp partner-a-logo.png public/Brand/partner-a/icon.png
cp partner-b-logo.png public/Brand/partner-b/icon.png

# 3. Create batch generation script
# (see Advanced Usage section)
node scripts/generate-multi-brand-icons.mjs

# 4. Use in application
// Component.tsx
const brandLogo = `/icons/${selectedBrand}/icon-192x192.png`;
```

---

## FAQ

**Q: How often should I regenerate icons?**
A: Only when you update the logo. Use `npm run generate-icons` immediately after updating the source image.

**Q: Can I use SVG logos?**
A: Sharp can process SVG, but PNG/JPG is recommended. SVG scaling behavior varies by browser.

**Q: What's the difference between favicon and apple-touch-icon?**
A: Favicon appears in browser tabs and bookmarks (all devices). Apple touch icon appears on iPhone home screen when user saves the page.

**Q: Why multiple icon sizes?**
A: Different devices need different resolutions. PWA manifest allows browser to pick best size for current device.

**Q: Can I use an animated GIF as favicon?**
A: Technically yes, but not recommended. Static favicons load faster and are more compatible.

**Q: How do I test PWA installation locally?**
A: Use Chrome DevTools (F12) → Application → Manifest → "Add to Home Screen" button.

**Q: What if my logo has text in it?**
A: Works fine! Just ensure text is legible at 16x16px (favicon size). Test by zooming to 200% in image viewer.

**Q: Should I commit generated icons to git?**
A: Yes! They're deployment artifacts. Include in .gitignore only if auto-generating during build (not recommended).

**Q: How do I handle dark vs light mode?**
A: Use Brand/5.png (white icon) - it works on any background. Adjust theme-color in manifest.json for browser UI.

---

## Support & Resources

**Documentation:**
- [PWA Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Web App Icons - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)

**Tools:**
- [Favicon Generator](https://realfavicongenerator.net/) - Visual tool for testing
- [Manifest Validator](https://manifest-validator.appspot.com/) - Check manifest.json
- [PWA Builder](https://www.pwabuilder.com/) - Complete PWA testing

**Related Skills:**
- framer-motion-expert: For animated logos
- voxanne-branding-expert: For logo strategy and design

---

## Version History

**v1.0.0 (2026-01-29)** - Initial Release
- ✅ Logo extraction and PWA icon generation
- ✅ Favicon creation (ICO format)
- ✅ Apple touch icon generation
- ✅ Complete configuration guide
- ✅ Troubleshooting documentation
- ✅ Integration examples

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-01-29
**Maintained By:** Claude Code
**Support:** Check `.claude/skills/logo-favicon-generator/` directory for examples
