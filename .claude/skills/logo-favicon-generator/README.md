# Logo & Favicon Generator Skill

**🎨 Extract logos and generate professional favicon + PWA icon sets automatically**

---

## Quick Summary

This AI skill automates logo extraction and favicon generation for web applications. It transforms a single logo image into:

✅ **favicon.ico** (32x32) - Browser tab icon
✅ **apple-touch-icon.png** (180x180) - iOS home screen
✅ **PWA Icons** (8 sizes: 72-512px) - App stores & browsers

**Usage:** `npm run generate-icons` → Done in 30 seconds

---

## What's Included

📄 **SKILL.md** (Production-Ready Guide)
- Complete documentation with best practices
- Troubleshooting and FAQ
- Configuration options and advanced usage
- 1,500+ lines of comprehensive guidance

📋 **EXAMPLES.md** (Real-World Scenarios)
- 8 practical examples (quick start to advanced)
- Copy-paste code snippets
- Component examples
- Integration templates

📖 **README.md** (This File)
- Quick reference and navigation

---

## Getting Started (2 Minutes)

### Step 1: Verify Your Logo
```bash
ls -lh public/Brand/5.png
# Should exist and be ≥256x256 pixels
```

### Step 2: Generate Icons
```bash
npm run generate-icons
```

### Step 3: Commit & Deploy
```bash
git add public/favicon.ico public/apple-touch-icon.png public/icons/
git commit -m "chore: regenerate icons from updated logo"
git push
```

**Done!** Favicon appears in browser tab, PWA icons in manifest.

---

## Common Tasks

| Task | Command | Time |
|------|---------|------|
| Regenerate icons | `npm run generate-icons` | 30s |
| Verify quality | `npm run test:icons` | 2s |
| View generated files | `ls -la public/icons/` | 1s |
| Update source logo | `cp new-logo.png public/Brand/5.png` | 1s |

---

## File Structure

```
.claude/skills/logo-favicon-generator/
├── README.md              ← You are here
├── SKILL.md              ← Complete documentation (1,500+ lines)
├── EXAMPLES.md           ← 8 practical examples with code
└── assets/
    └── (optional: screenshots, diagrams)

Related Files:
├── scripts/generate-pwa-icons.mjs  ← Icon generation script
├── public/Brand/5.png              ← Source logo
├── public/favicon.ico              ← Generated favicon
├── public/apple-touch-icon.png     ← Generated Apple icon
└── public/icons/                   ← Generated PWA icons
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-192x192.png
    └── ... (8 sizes total)
```

---

## Documentation Map

### For Quick Start
→ See **EXAMPLES.md** § Example 1 (Quick Icon Regeneration)

### For Complete Guide
→ See **SKILL.md** § Overview + Quick Start

### For Troubleshooting
→ See **SKILL.md** § Troubleshooting

### For Advanced Usage
→ See **EXAMPLES.md** § Examples 3-8 (Advanced Scenarios)

### For FAQ
→ See **SKILL.md** § FAQ

---

## Key Features

✅ **Automated** - Single command generates all icons
✅ **Flexible** - Supports custom logo paths and multiple brands
✅ **Optimized** - Proper PNG compression and file sizes
✅ **Tested** - Includes quality verification script
✅ **CI/CD Ready** - Integrates with GitHub Actions, git hooks
✅ **Well-Documented** - 1,500+ lines of comprehensive guides

---

## When to Use This Skill

✅ **Use when:**
- Creating favicons from logo source images
- Generating PWA icon sets
- Updating app icons for branding consistency
- Automating logo asset generation for CI/CD pipelines
- Managing multiple brands with different logos

❌ **Don't use when:**
- Doing manual image editing (use Figma/Photoshop)
- Creating logos from scratch (hire a designer)
- Needing complex image transformations (use ImageMagick)

---

## Example Workflow

**Scenario: Brand Updated Logo**

```bash
# 1. Designer sends new logo
# 2. Save it to the brand directory
cp ~/Downloads/new-logo.png public/Brand/5.png

# 3. Regenerate all icons (30 seconds)
npm run generate-icons

# 4. Verify they look good (2 seconds)
npm run test:icons
# Output: ✅ All icons verified successfully!

# 5. Commit and push
git add public/
git commit -m "chore: regenerate icons with updated brand logo"
git push origin main

# 6. Deploy (automatic with prebuild script)
# Icons are regenerated as part of CI/CD pipeline
```

**Time Total:** ~2 minutes
**Difficulty:** Easy
**Risk:** None (fully reversible)

---

## Production Readiness

✅ **Version:** 1.0.0 (Production Ready)
✅ **Created:** 2026-01-29
✅ **Dependencies:** Sharp (image processing)
✅ **Tested:** Yes (verification script included)
✅ **Documented:** Yes (1,500+ lines)
✅ **Automated:** Yes (CI/CD integration)

---

## Next Steps

1. **Read SKILL.md** - Understand the full capabilities (10 min read)
2. **Try Example 1** - Regenerate icons from existing logo (2 min)
3. **Try Example 2** - Use custom logo path if needed (5 min)
4. **Set up automation** - Add to CI/CD pipeline (5 min)

---

## Support & Resources

📚 **Documentation:**
- [SKILL.md](./SKILL.md) - Complete reference guide
- [EXAMPLES.md](./EXAMPLES.md) - Practical code examples
- [PWA Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)

🔧 **Tools:**
- [Favicon Generator](https://realfavicongenerator.net/)
- [Manifest Validator](https://manifest-validator.appspot.com/)
- [PWA Builder](https://www.pwabuilder.com/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-29 | Initial release - Logo extraction, PWA icon generation, complete documentation |

---

## Quick Reference

**Configuration File:** `scripts/generate-pwa-icons.mjs`
- Line 21: Source logo path
- Line 26: Icon sizes to generate
- Line 29: Log message

**Brand Assets Directory:** `public/Brand/`
- **5.png** (Recommended) - White icon, transparent background
- 1.png, 3.png - Alternative variants

**Generated Assets:**
- `public/favicon.ico` - 32x32 browser tab icon
- `public/apple-touch-icon.png` - 180x180 iOS home screen
- `public/icons/icon-{size}x{size}.png` - 8 PWA icon sizes

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-01-29
**Maintained By:** Claude Code

For detailed documentation, see [SKILL.md](./SKILL.md)
