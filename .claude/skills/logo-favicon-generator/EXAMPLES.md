# Logo & Favicon Generator - Practical Examples

**Version:** 1.0.0
**Date:** 2026-01-29
**Purpose:** Real-world examples and reference code for logo extraction and icon generation

---

## Example 1: Quick Icon Regeneration (Most Common)

**Scenario:** Branding team updated the logo file, need to regenerate all web icons immediately.

**Steps:**
```bash
# 1. Verify new logo file is in place
ls -lh public/Brand/5.png

# 2. Regenerate all icons (30 seconds)
npm run generate-icons

# 3. Verify generation succeeded
ls -lh public/favicon.ico
ls -lh public/apple-touch-icon.png
ls -lh public/icons/ | wc -l  # Should show 8 icon files

# 4. Commit and push
git add public/favicon.ico public/apple-touch-icon.png public/icons/
git commit -m "chore: regenerate icons from updated logo (Brand/5.png)"
git push origin main
```

**Output:**
```
🎨 Generating PWA icons from Brand/5.png...

✅ Generated: public/favicon.ico (32x32)
✅ Generated: public/apple-touch-icon.png (180x180)
✅ Generated: public/icons/icon-72x72.png
✅ Generated: public/icons/icon-96x96.png
✅ Generated: public/icons/icon-128x128.png
✅ Generated: public/icons/icon-144x144.png
✅ Generated: public/icons/icon-152x152.png
✅ Generated: public/icons/icon-192x192.png
✅ Generated: public/icons/icon-384x384.png
✅ Generated: public/icons/icon-512x512.png

✅ PWA Icon generation complete! (Total: 10 files, 120KB)
```

**Time Required:** 30-45 seconds
**Difficulty:** Easy
**Risk Level:** None (icons are auto-regenerated)

---

## Example 2: Custom Logo Path for New Product

**Scenario:** Launching a new product with a different logo, don't want to overwrite existing Voxanne logo.

**Setup:**
```bash
# 1. Create product-specific directory
mkdir -p public/Brand/new-product

# 2. Add product logo
cp ~/Downloads/new-product-logo.png public/Brand/new-product/icon.png

# 3. Verify file
ls -lh public/Brand/new-product/icon.png
# Expected: -rw-r--r-- 1 user group 256K new-product-logo.png
```

**Update Generation Script:**
```bash
# Option 1: Edit script directly
nano scripts/generate-pwa-icons.mjs
# Line 21: Change const sourceImage = path.join(projectRoot, 'public', 'Brand', 'new-product', 'icon.png');
# Line 29: Change console.log('🎨 Generating PWA icons from Brand/new-product/icon.png...\n');
# Line 22: Change const iconDir = path.join(projectRoot, 'public', 'icons', 'new-product');

# Option 2: Pass as environment variable (better practice)
SOURCE_LOGO_PATH=public/Brand/new-product/icon.png npm run generate-icons
```

**Alternative: Create Dedicated Script**
```bash
# scripts/generate-new-product-icons.mjs
#!/usr/bin/env node

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const sourceImage = path.join(projectRoot, 'public', 'Brand', 'new-product', 'icon.png');
const iconDir = path.join(projectRoot, 'public', 'icons', 'new-product');
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateNewProductIcons() {
  console.log('🎨 Generating New Product icons from new-product/icon.png...\n');

  if (!existsSync(sourceImage)) {
    console.error(`❌ Source image not found: ${sourceImage}`);
    process.exit(1);
  }

  // Create icons directory
  if (!existsSync(iconDir)) {
    await mkdir(iconDir, { recursive: true });
    console.log(`📁 Created directory: ${iconDir}`);
  }

  // Generate all icon sizes
  for (const size of iconSizes) {
    await sharp(sourceImage)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(`${iconDir}/icon-${size}x${size}.png`);

    console.log(`✅ Generated: icon-${size}x${size}.png`);
  }

  console.log(`\n✅ New Product icon generation complete!`);
}

generateNewProductIcons().catch(console.error);
```

**Add to package.json:**
```json
{
  "scripts": {
    "generate-icons": "node scripts/generate-pwa-icons.mjs",
    "generate-icons:new-product": "node scripts/generate-new-product-icons.mjs"
  }
}
```

**Usage:**
```bash
npm run generate-icons:new-product
```

**Time Required:** 2-3 minutes (mostly setup)
**Difficulty:** Intermediate
**Risk Level:** None (separate icon directory)

---

## Example 3: Automated Icon Generation on Deploy

**Scenario:** Want icons to regenerate automatically before every production deployment.

**Setup: GitHub Actions**

```yaml
# .github/workflows/deploy-production.yml

name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Generate icons
        run: npm run generate-icons

      - name: Build application
        run: npm run build

      - name: Deploy to Vercel
        run: npx vercel --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

**Setup: Local Git Hook**

```bash
# .git/hooks/pre-push (executable)
#!/bin/bash

# Regenerate icons before pushing to main
if [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then
  echo "Generating icons before push..."
  npm run generate-icons

  if [ $? -ne 0 ]; then
    echo "❌ Icon generation failed"
    exit 1
  fi

  git add public/favicon.ico public/apple-touch-icon.png public/icons/
  echo "✅ Icons regenerated and staged"
fi
```

**Make Hook Executable:**
```bash
chmod +x .git/hooks/pre-push
```

**Setup: package.json Scripts**

```json
{
  "scripts": {
    "prebuild": "npm run generate-icons",
    "build": "next build",
    "predeploy": "npm run generate-icons && npm run build",
    "deploy": "vercel --prod"
  }
}
```

**Usage:**
```bash
npm run deploy  # Automatically:
                # 1. Generates icons
                # 2. Builds Next.js app
                # 3. Deploys to Vercel
```

**Time Required:** 5 minutes (setup)
**Difficulty:** Advanced
**Risk Level:** Low (fully automated, can be rolled back)

---

## Example 4: Batch Processing Multiple Logos

**Scenario:** Managing multiple brands/products with different logos, each needs icon sets.

**Script: generate-all-brands.mjs**

```javascript
#!/usr/bin/env node

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Define all brands
const brands = [
  {
    name: 'Voxanne AI',
    id: 'voxanne',
    logoPath: 'public/Brand/5.png',
    outputDir: 'public/icons/voxanne'
  },
  {
    name: 'Partner A',
    id: 'partner-a',
    logoPath: 'public/logos/partner-a.png',
    outputDir: 'public/icons/partner-a'
  },
  {
    name: 'Partner B',
    id: 'partner-b',
    logoPath: 'public/logos/partner-b.png',
    outputDir: 'public/icons/partner-b'
  }
];

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateBrandIcons(brand) {
  const sourceImage = path.join(projectRoot, brand.logoPath);
  const iconDir = path.join(projectRoot, brand.outputDir);

  console.log(`\n🎨 Generating icons for ${brand.name}...`);

  if (!existsSync(sourceImage)) {
    console.error(`❌ Source not found: ${sourceImage}`);
    return false;
  }

  if (!existsSync(iconDir)) {
    await mkdir(iconDir, { recursive: true });
  }

  // Generate all sizes
  for (const size of iconSizes) {
    await sharp(sourceImage)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(`${iconDir}/icon-${size}x${size}.png`);

    console.log(`  ✅ ${size}x${size}`);
  }

  return true;
}

async function generateAllBrands() {
  console.log('🚀 Batch Icon Generation Started\n');
  console.log(`Processing ${brands.length} brands...`);

  let successCount = 0;

  for (const brand of brands) {
    const success = await generateBrandIcons(brand);
    if (success) successCount++;
  }

  console.log(`\n✅ Complete: ${successCount}/${brands.length} brands processed`);
  console.log(`\n📊 Summary:`);
  brands.forEach(brand => {
    console.log(`  ${brand.name}: ${brand.outputDir}`);
  });
}

generateAllBrands().catch(console.error);
```

**Add to package.json:**
```json
{
  "scripts": {
    "generate-icons": "node scripts/generate-pwa-icons.mjs",
    "generate-icons:all": "node scripts/generate-all-brands.mjs"
  }
}
```

**Usage:**
```bash
npm run generate-icons:all

# Output:
# 🚀 Batch Icon Generation Started
#
# Processing 3 brands...
#
# 🎨 Generating icons for Voxanne AI...
#   ✅ 72x72
#   ✅ 96x96
#   ... (all sizes)
#
# 🎨 Generating icons for Partner A...
#   ✅ 72x72
#   ... (all sizes)
#
# 🎨 Generating icons for Partner B...
#   ... (all sizes)
#
# ✅ Complete: 3/3 brands processed
```

**Directory Structure Created:**
```
public/
├── icons/
│   ├── voxanne/
│   │   ├── icon-72x72.png
│   │   ├── icon-96x96.png
│   │   └── ... (8 sizes)
│   ├── partner-a/
│   │   └── ... (8 sizes)
│   └── partner-b/
│       └── ... (8 sizes)
```

**Time Required:** 10-15 seconds
**Difficulty:** Advanced
**Risk Level:** None (separate directories)

---

## Example 5: Testing Icon Quality

**Scenario:** Verify icons are high quality, transparent, and properly sized before deployment.

**Test Script: verify-icons.mjs**

```javascript
#!/usr/bin/env node

import sharp from 'sharp';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const iconDir = 'public/icons';
const expectedSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function verifyIcon(filePath) {
  const image = sharp(filePath);
  const metadata = await image.metadata();

  return {
    file: path.basename(filePath),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    hasAlpha: metadata.hasAlpha,
    size: statSync(filePath).size
  };
}

async function verifyAllIcons() {
  console.log('🔍 Verifying Icon Quality...\n');

  const files = readdirSync(iconDir)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (files.length === 0) {
    console.error('❌ No PNG files found in public/icons/');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(iconDir, file);
    const info = await verifyIcon(filePath);

    // Extract size from filename (e.g., "icon-192x192.png" → 192)
    const sizeMatch = file.match(/icon-(\d+)x\d+\.png/);
    const expectedSize = sizeMatch ? parseInt(sizeMatch[1]) : null;

    const isValid =
      info.width === info.height &&
      info.width === expectedSize &&
      info.format === 'png' &&
      info.hasAlpha === true &&
      info.size > 100; // At least 100 bytes

    if (isValid) {
      console.log(`✅ ${file} (${info.width}x${info.height}, ${info.size}B)`);
      passed++;
    } else {
      console.log(`❌ ${file}`);
      if (info.width !== info.height) console.log(`   - Not square: ${info.width}x${info.height}`);
      if (info.width !== expectedSize) console.log(`   - Wrong size: expected ${expectedSize}x${expectedSize}`);
      if (info.format !== 'png') console.log(`   - Wrong format: ${info.format}`);
      if (!info.hasAlpha) console.log(`   - No transparency`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n❌ Icon verification failed');
    process.exit(1);
  }

  console.log('\n✅ All icons verified successfully!');
}

verifyAllIcons().catch(console.error);
```

**Add to package.json:**
```json
{
  "scripts": {
    "test:icons": "node scripts/verify-icons.mjs",
    "postgenerate-icons": "npm run test:icons"
  }
}
```

**Usage:**
```bash
npm run test:icons

# Output:
# 🔍 Verifying Icon Quality...
#
# ✅ icon-72x72.png (72x72, 2,145B)
# ✅ icon-96x96.png (96x96, 3,421B)
# ✅ icon-128x128.png (128x128, 5,234B)
# ✅ icon-144x144.png (144x144, 6,789B)
# ✅ icon-152x152.png (152x152, 7,234B)
# ✅ icon-192x192.png (192x192, 9,876B)
# ✅ icon-384x384.png (384x384, 24,567B)
# ✅ icon-512x512.png (512x512, 42,123B)
#
# 📊 Results: 8 passed, 0 failed
#
# ✅ All icons verified successfully!
```

**Time Required:** 1-2 seconds
**Difficulty:** Intermediate
**Risk Level:** None (read-only verification)

---

## Example 6: Icon Integration in Component

**Scenario:** Using generated icons in React components with proper Next.js Image optimization.

**Component: BrandIcon.tsx**

```typescript
'use client';

import Image from 'next/image';
import { HTMLAttributes } from 'react';

type BrandVariant = 'voxanne' | 'partner-a' | 'partner-b';
type IconSize = 72 | 96 | 128 | 144 | 152 | 192 | 384 | 512;

interface BrandIconProps extends HTMLAttributes<div> {
  variant?: BrandVariant;
  size?: IconSize;
  priority?: boolean;
}

export function BrandIcon({
  variant = 'voxanne',
  size = 192,
  priority = false,
  className,
  ...props
}: BrandIconProps) {
  const iconPath = `/icons/${variant}/icon-${size}x${size}.png`;

  return (
    <div
      className={`inline-block bg-contain bg-no-repeat ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`
      }}
      {...props}
    >
      <Image
        src={iconPath}
        alt={`${variant} brand icon`}
        width={size}
        height={size}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  );
}

// Usage Examples:

// Simple usage
<BrandIcon />

// Custom size
<BrandIcon size={128} />

// Different brand
<BrandIcon variant="partner-a" size={96} />

// In navbar (priority load)
<BrandIcon variant="voxanne" size={48} priority className="hover:opacity-80" />

// Responsive sizes
<BrandIcon
  size={96}
  className="md:w-128 lg:w-192"
/>
```

**Component: Logo with Fallback**

```typescript
import Image from 'next/image';
import { useState } from 'react';

interface LogoProps {
  brand?: string;
  size?: number;
}

export function Logo({ brand = 'voxanne', size = 192 }: LogoProps) {
  const [error, setError] = useState(false);

  if (error) {
    // Fallback to text logo if image fails
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.floor(size * 0.3)}px`,
          fontWeight: 'bold',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px'
        }}
      >
        {brand.toUpperCase().substring(0, 1)}
      </div>
    );
  }

  return (
    <Image
      src={`/icons/${brand}/icon-${size}x${size}.png`}
      alt={`${brand} logo`}
      width={size}
      height={size}
      onError={() => setError(true)}
    />
  );
}
```

**Time Required:** 5 minutes
**Difficulty:** Beginner
**Risk Level:** None (component-only)

---

## Example 7: Email Signature with Embedded Icons

**Scenario:** Create professional email signature with logo icon.

**Template: email-signature.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .signature { display: table; margin-top: 16px; }
    .logo { display: table-cell; vertical-align: top; padding-right: 12px; }
    .logo img { width: 48px; height: 48px; display: block; }
    .info { display: table-cell; vertical-align: top; font-size: 13px; color: #333; }
    .name { font-weight: 600; color: #000; margin-bottom: 4px; }
    .title { color: #666; margin-bottom: 8px; }
    .divider { height: 1px; background: #ddd; margin: 8px 0; }
    .contact { color: #0066cc; text-decoration: none; }
  </style>
</head>
<body>

<div class="signature">
  <div class="logo">
    <img src="https://voxanne.ai/icons/voxanne/icon-192x192.png"
         alt="Voxanne AI"
         width="48"
         height="48">
  </div>
  <div class="info">
    <div class="name">Your Name</div>
    <div class="title">Product Manager, Voxanne AI</div>
    <div class="divider"></div>
    <div>
      <a href="mailto:your.email@voxanne.ai" class="contact">your.email@voxanne.ai</a><br>
      <a href="tel:+15551234567" class="contact">+1 (555) 123-4567</a><br>
      <a href="https://voxanne.ai" class="contact">voxanne.ai</a>
    </div>
  </div>
</div>

</body>
</html>
```

**For Outlook:**
```xml
<!-- outlook-safe-signature.xml -->
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  <table>
    <tr>
      <td width="60" valign="top">
        <img src="https://voxanne.ai/icons/voxanne/icon-192x192.png"
             alt="Voxanne"
             width="48"
             height="48"
             style="display:block; outline:none; border:none;">
      </td>
      <td valign="top" style="font-family:Arial,sans-serif; font-size:13px; color:#333;">
        <b style="color:#000;">Your Name</b><br>
        <span style="color:#666;">Product Manager</span><br>
        <hr style="border:none; border-top:1px solid #ddd; margin:8px 0; width:100%;">
        <a href="mailto:email@voxanne.ai" style="color:#0066cc; text-decoration:none;">email@voxanne.ai</a><br>
        <a href="https://voxanne.ai" style="color:#0066cc; text-decoration:none;">voxanne.ai</a>
      </td>
    </tr>
  </table>
</body>
</html>
```

**Time Required:** 5 minutes
**Difficulty:** Beginner
**Risk Level:** None (template only)

---

## Example 8: Social Media Meta Tags

**Scenario:** Prepare icons and metadata for social media sharing.

**File: app/layout.tsx**

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Voxanne AI | The #1 AI Receptionist',
  description: 'AI voice assistant for healthcare practices',

  // Favicon and app icons
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: '/icons/voxanne/icon-192x192.png'
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/icons/voxanne/icon-512x512.png'
      }
    ]
  },

  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    title: 'Voxanne AI | The #1 AI Receptionist',
    description: 'Deploy a digital employee that handles patient calls 24/7.',
    url: 'https://voxanne.ai',
    type: 'website',
    images: [
      {
        url: 'https://voxanne.ai/icons/voxanne/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Voxanne AI Logo'
      }
    ]
  },

  // Twitter/X
  twitter: {
    card: 'summary_large_image',
    title: 'Voxanne AI | The #1 AI Receptionist',
    description: 'Deploy a digital employee that handles patient calls 24/7.',
    images: ['https://voxanne.ai/icons/voxanne/icon-512x512.png'],
    creator: '@VoxanneAI'
  }
};

export const viewport = {
  themeColor: '#1D4ED8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // PWA support
  colorScheme: 'light'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Manifest for PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* Mobile specific */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Voxanne" />

        {/* Android specific */}
        <meta name="theme-color" content="#1D4ED8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**File: public/manifest.json**

```json
{
  "name": "Voxanne AI - AI Receptionist",
  "short_name": "Voxanne",
  "description": "The #1 AI Receptionist for healthcare practices",
  "start_url": "/",
  "display": "standalone",
  "scope": "/",
  "theme_color": "#1D4ED8",
  "background_color": "#FFFFFF",
  "orientation": "portrait-primary",

  "icons": [
    {
      "src": "/icons/voxanne/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/voxanne/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],

  "screenshots": [
    {
      "src": "/screenshots/mobile.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],

  "categories": ["productivity", "business"],
  "prefer_related_applications": false
}
```

**Time Required:** 10 minutes
**Difficulty:** Beginner
**Risk Level:** None (metadata only)

---

## Quick Reference Table

| Scenario | Command | Time | Difficulty |
|----------|---------|------|------------|
| Regenerate all icons | `npm run generate-icons` | 30s | Easy |
| Custom logo path | Edit `SKILL.md` + `npm run generate-icons` | 2m | Intermediate |
| Auto-deploy with icons | Setup GitHub Actions | 5m | Advanced |
| Batch process brands | `npm run generate-icons:all` | 15s | Advanced |
| Verify icon quality | `npm run test:icons` | 2s | Intermediate |
| Use in React component | Import `BrandIcon` component | 2m | Beginner |
| Social media tags | Add to `layout.tsx` | 10m | Beginner |

---

## Troubleshooting Reference

| Problem | Solution | File |
|---------|----------|------|
| Icons blurry | Check source is ≥512x512, update quality setting | SKILL.md § Troubleshooting |
| Favicon not updating | Hard refresh browser, clear cache | SKILL.md § Troubleshooting |
| PWA not installing | Check manifest.json, enable HTTPS | SKILL.md § Troubleshooting |
| Transparent BG fails | Use PNG not JPG, verify source alpha | SKILL.md § Troubleshooting |
| Generation fails | Verify Sharp installed: `npm ls sharp` | SKILL.md § Requirements |

---

**Last Updated:** 2026-01-29
**For detailed information, see:** `.claude/skills/logo-favicon-generator/SKILL.md`
