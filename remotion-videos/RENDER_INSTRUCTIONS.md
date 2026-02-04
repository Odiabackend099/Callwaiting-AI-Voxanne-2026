# 🎬 How to Render Your Video - Step by Step

## Quick Render (Recommended)

### Option 1: Using the Render Script (Easiest)

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
chmod +x RENDER_VIDEO.sh
./RENDER_VIDEO.sh
```

This script will:
- ✅ Verify all files are in place
- ✅ Check for node_modules
- ✅ Run the render command
- ✅ Verify the output
- ✅ Show file size and next steps

### Option 2: Direct Command (Manual)

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
npm run build
```

This runs the configured npm build script which executes:
```
remotion render src/index.ts VoxanneDemo out/voxanne-demo.mp4
```

---

## What Happens During Render

### Phase 1: Initialization (30 seconds)
- Remotion loads the TypeScript configuration
- Webpack bundles all React components and animations
- Reads all 15 screenshot files
- Compiles Tailwind CSS classes

### Phase 2: Frame Rendering (4-6 minutes)
- Renders each frame (2700 total) as an image
- For each scene:
  - Scene 1: 180 frames
  - Scene 2: 180 frames
  - ... (continuing through Scene 12)
- Progress bar shows: `Frame 450/2700 (16.7%)`
- CPU usage: ~80-95% (normal)
- RAM usage: ~1-2 GB (normal)

### Phase 3: Video Encoding (1-2 minutes)
- Combines rendered frames into MP4 video
- Applies H.264 codec
- Optimizes for web playback
- Creates final `out/voxanne-demo.mp4`

### Expected Output
```
Rendering frames...
Frame 150/2700 (5.6%)
Frame 300/2700 (11.1%)
...
Frame 2700/2700 (100%)
Encoding video...
Done! Rendered to: out/voxanne-demo.mp4
```

---

## Troubleshooting

### Issue: "npm: command not found"
**Solution:**
1. Check Node.js is installed: `node -v`
2. If not installed, download from https://nodejs.org/
3. Install Node.js LTS version
4. Restart your terminal
5. Try render again

### Issue: "Module not found: @remotion/tailwind"
**Solution:**
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
npm install
npm run build
```

### Issue: Screenshots not found
**Solution:**
1. Verify folder exists:
   ```bash
   ls -la public/screenshots/ | wc -l
   # Should show: 15 (15 screenshot files)
   ```
2. Check screenshot names match the scene files
3. All files should be PNG format

### Issue: Render runs but output is black
**Solution:**
1. Verify `remotion.config.ts` has Tailwind enabled:
   ```typescript
   import { enableTailwind } from '@remotion/tailwind';
   Config.overrideWebpackConfig((cfg) => enableTailwind(cfg));
   ```
2. Reinstall dependencies: `npm install`
3. Try render again

### Issue: Render is too slow
**Solution:**
1. Close other applications to free up CPU
2. Reduce concurrent rendering in `remotion.config.ts`:
   ```typescript
   Config.setConcurrency(1); // Instead of 2
   ```
3. Ensure you have 2GB+ free RAM

### Issue: Out of memory (OOM) error
**Solution:**
```bash
# Reduce to single-threaded rendering
# Edit remotion.config.ts:
Config.setConcurrency(1);

# Try render again
npm run build
```

---

## After Rendering

### Step 1: Verify the Output
```bash
# Check file was created
ls -lh out/voxanne-demo.mp4
# Expected output: -rw-r--r-- ... 15M ... out/voxanne-demo.mp4

# Play the video
open out/voxanne-demo.mp4
# Should open in QuickTime (macOS) or VLC
```

### Step 2: Verify Duration
```bash
# Check video is exactly 90 seconds
# In QuickTime:
# - Play the video
# - Check that duration shows 1:30 (90 seconds)
```

### Step 3: Verify Quality
Checklist:
- ✅ All 12 scenes play in sequence
- ✅ No black frames
- ✅ No rendering artifacts
- ✅ All text is readable
- ✅ All colors match brand palette (#F0F9FF, #020412, #1D4ED8)
- ✅ All animations are smooth (no jank)
- ✅ Duration is exactly 90 seconds

---

## Next: Add Phone Call Audio

### Your Task
1. Call your Voxanne AI demo number
2. Have a conversation (ask about services, request appointment)
3. Screen record the call:
   - **iPhone:** Control Center → Screen Recording (record for ~10 seconds)
   - **Mac:** QuickTime Player → File → New Screen Recording
4. Save the recording as `my-phone-call.mov`

### Option 1: iMovie (Easiest)
```
1. Open iMovie
2. File → New Movie
3. Import: out/voxanne-demo.mp4 (drag to timeline)
4. Import: my-phone-call.mov (drag below video)
5. Trim phone call audio to 10 seconds (74s-84s mark)
6. Export → Best (1920×1080, 30fps, H.264)
7. Save as: voxanne-final-demo.mp4
```

### Option 2: Final Cut Pro (Professional)
```
1. New project: 1920×1080, 30fps
2. Import: out/voxanne-demo.mp4 → V1 (video track)
3. Import: my-phone-call.mov → A1 (audio track)
4. Trim phone audio from 74s to 84s (10 seconds)
5. Export → Master File
6. Output: voxanne-final-demo.mp4
```

---

## Deployment Options

### Option A: Homepage Hero Section
```bash
# Copy to Next.js public folder
cp out/voxanne-demo.mp4 ../public/videos/product-tour.mp4

# Update hero component in src/components/Hero.tsx:
<video autoPlay muted loop playsInline>
  <source src="/videos/product-tour.mp4" type="video/mp4" />
</video>
```

### Option B: Google Play Store
```
1. Sign in to Google Play Console
2. Your app → Store presence → Store listing
3. Scroll to "App Preview" section
4. Upload: out/voxanne-demo.mp4
5. Video will be reviewed within 24-48 hours
```

### Option C: YouTube
```
1. Go to https://www.youtube.com/upload
2. Select: out/voxanne-demo.mp4
3. Fill in:
   - Title: "Voxanne AI - Never Miss a Patient Again"
   - Description: "AI voice receptionist for medical practices..."
   - Tags: AI receptionist, medical automation, healthcare AI
   - Visibility: Public or Unlisted
4. Upload (takes 5-10 minutes)
```

### Option D: LinkedIn (B2B)
```
1. Crop video to 16:9 (60 seconds)
2. Go to LinkedIn → Create post
3. Upload video
4. Caption: "Voxanne AI handles 80% of clinic calls without staff 🤖"
5. Post (reaches clinics in your network)
```

---

## Performance Expectations

### Render Time by Machine
| Machine | Duration | Notes |
|---------|----------|-------|
| M1 Mac | 5-7 min | Normal |
| M2 Mac | 3-4 min | Faster CPU |
| M3 Mac | 2-3 min | Fastest |
| Intel Mac | 10-15 min | Older CPU |
| Windows (high-end) | 5-10 min | Depends on CPU |

### Output File Size
| Aspect | Value |
|--------|-------|
| Bitrate | ~8-10 Mbps |
| File Size | 15-20 MB |
| Duration | 90 seconds |
| Format | MP4 H.264 |
| Resolution | 1920×1080 |

---

## Monitoring the Render

### Check Progress
While rendering, you can monitor:
```bash
# In another terminal:
watch 'ls -lh out/voxanne-demo.mp4 2>/dev/null || echo "Not yet created"'
# Shows file size updating in real-time
```

### Monitor System Resources
```bash
# Watch CPU/memory usage
top -n 1 | head -20
# Remotion should use 80-95% CPU (normal)
```

---

## Success Checklist

After rendering completes:

- ✅ File `out/voxanne-demo.mp4` exists
- ✅ File size is 15-20 MB
- ✅ Duration shows 1:30 (90 seconds)
- ✅ Video plays without errors
- ✅ All scenes visible and smooth
- ✅ No black frames
- ✅ No rendering artifacts
- ✅ Ready for deployment

---

## Getting Help

### If Render Fails

1. **Check the error message** - Usually tells you what's wrong
2. **Verify prerequisites:**
   ```bash
   npm -v          # Should show npm version
   node -v         # Should show Node version
   ls -la src/     # Should show files
   ls -la public/screenshots/ | wc -l  # Should show 15
   ```
3. **Try rebuilding:**
   ```bash
   rm -rf node_modules
   npm install
   npm run build
   ```

### Common Solutions

| Problem | Solution |
|---------|----------|
| "Screenshot not found" | Check `public/screenshots/` exists and has 15 files |
| "Cannot find module X" | Run `npm install` to install dependencies |
| "Out of memory" | Close other apps, reduce concurrency to 1 |
| "Black video" | Verify `remotion.config.ts` has Tailwind enabled |
| "Render hangs" | It's normal - M1 takes 5-7 minutes. Wait or check activity monitor |

---

## Documentation References

- **VIDEO_DEMO_COMPLETE.md** - Full technical specification
- **QUICK_START.md** - Quick reference guide
- **VIDEO_STRUCTURE.txt** - Scene timing and animations
- **RENDER_INSTRUCTIONS.md** - This file

---

**You're all set! Ready to render? Run:**

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
npm run build
```

**⏱️ Expected time: 5-7 minutes**

Good luck! 🚀

