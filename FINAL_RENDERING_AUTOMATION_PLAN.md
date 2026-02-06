# Final Rendering Verification & 100% Automation Plan

**Date:** 2026-02-04
**Status:** PLANNING PHASE
**Principle:** 3-Step Coding Discipline

---

## Problem Statement

**Current State:**
- ✅ Automated coordinate extraction system implemented
- ✅ 8 scene files updated with semantic element names
- ✅ Manifest loader and type system operational
- ⏳ **PENDING:** Final rendering verification
- ⏳ **PENDING:** Fully automated end-to-end workflow

**Goal:**
1. Verify that Remotion renders videos correctly with the new manifest-based coordinate system
2. Create a 100% automated workflow: `npm run video:production` → complete video rendered with zero manual steps

---

## Implementation Phases

### **Phase 1: Final Rendering Verification** (Manual Testing)

**Duration:** 30-45 minutes
**Objective:** Verify the manifest system works in production Remotion rendering

**Tasks:**
1. Start dev server (`npm run dev`)
2. Capture missing screenshots with Playwright
3. Generate manifests for 8 new screenshots
4. Start Remotion Studio (`npm run start` in remotion-videos/)
5. Manually test render 3 sample scenes (Scene2, Scene5, Scene9)
6. Verify coordinate accuracy frame-by-frame
7. Document any misalignments or errors

**Success Criteria:**
- [ ] Remotion Studio opens without errors
- [ ] All 8 updated scenes render without crashes
- [ ] HighlightBox overlays align with UI elements
- [ ] ClickSimulation cursors move to correct targets
- [ ] FormFillSimulation overlays match input fields
- [ ] Console shows manifest loading (no "not found" errors)
- [ ] Video exports successfully to MP4

**Failure Scenarios:**
- Manifest not found errors → Check file paths and naming
- Coordinates misaligned → Adjust selector or re-capture screenshot
- Component crashes → Check prop validation logic
- TypeScript errors → Verify type imports

---

### **Phase 2: Create Missing Manifests** (Automated)

**Duration:** 15-20 minutes
**Objective:** Generate the 8 missing manifest files by capturing real screenshots

**Prerequisites:**
- Dev server running at `http://localhost:3000`
- User logged in as `voxanne@demo.com`

**Tasks:**
1. Update Playwright script with selectors for 8 new screenshots:
   - `01_dashboard_home.png` (hot-leads-card, recent-calls-card)
   - `02_agent_config_inbound.png` (system-prompt-textarea)
   - `03_knowledge_base.png` (upload-file-button)
   - `04_telephony_credentials.png` (4 form inputs + 1 button)
   - `05_ai_forwarding_wizard_step1.png` (forwarding-wizard-next)
   - `07_test_browser_idle.png` (start-test-button)
   - `09_test_live_call_form.png` (test-phone-input, call-now-button)
   - `11_call_logs_dashboard.png` (3 table cells)

2. Run Playwright script: `npx playwright test tests/e2e/capture-website-screenshots.spec.ts`

3. Verify all 8 manifest JSON files created

4. Validate manifest schema and coordinates

**Success Criteria:**
- [ ] 8 new manifest files created in `/remotion-videos/public/manifests/`
- [ ] Each manifest contains correct element names
- [ ] Coordinates are reasonable (within 1920x1080 bounds)
- [ ] All required elements present (15 total across 8 manifests)

**Technical Requirements:**
- Add 8 new selector mapping objects to Playwright script
- Add 8 new `captureWithCoordinates()` calls
- Update Playwright test to navigate to correct pages

---

### **Phase 3: 100% Automation - Master Script** (Automation Infrastructure)

**Duration:** 60-90 minutes
**Objective:** Create a single-command workflow that produces a complete video

**Master Script:** `scripts/video-production-workflow.sh`

**Workflow Steps:**
```bash
#!/bin/bash
# Master Video Production Workflow
# Usage: npm run video:production

set -e  # Exit on error

echo "🎬 VOXANNE AI VIDEO PRODUCTION WORKFLOW"
echo "========================================"

# STEP 1: Start dev server in background
echo "1️⃣ Starting dev server..."
npm run dev &
DEV_PID=$!
sleep 10  # Wait for server to start

# STEP 2: Capture screenshots with Playwright
echo "2️⃣ Capturing screenshots and extracting coordinates..."
npx playwright test tests/e2e/capture-website-screenshots.spec.ts
if [ $? -ne 0 ]; then
  kill $DEV_PID
  echo "❌ Screenshot capture failed"
  exit 1
fi

# STEP 3: Verify manifests created
echo "3️⃣ Verifying manifest files..."
MANIFEST_COUNT=$(ls remotion-videos/public/manifests/*.json 2>/dev/null | wc -l)
echo "   Found $MANIFEST_COUNT manifest files"
if [ $MANIFEST_COUNT -lt 12 ]; then
  echo "⚠️  Warning: Expected 12+ manifests, found $MANIFEST_COUNT"
fi

# STEP 4: Stop dev server
echo "4️⃣ Stopping dev server..."
kill $DEV_PID

# STEP 5: Generate voiceovers with ElevenLabs
echo "5️⃣ Generating voiceovers..."
cd remotion-videos
npm run generate:voiceovers
if [ $? -ne 0 ]; then
  echo "⚠️  Voiceover generation failed (continuing anyway)"
fi

# STEP 6: Render scene-by-scene
echo "6️⃣ Rendering scenes (scene-by-scene workflow)..."
npm run render:scene
if [ $? -ne 0 ]; then
  echo "❌ Scene rendering failed"
  exit 1
fi

# STEP 7: Merge scenes into final video
echo "7️⃣ Merging scenes into final video..."
npm run merge:scenes
if [ $? -ne 0 ]; then
  echo "❌ Video merge failed"
  exit 1
fi

# STEP 8: Final verification
echo "8️⃣ Verifying final video..."
if [ -f "out/voxanne-demo-final.mp4" ]; then
  FILE_SIZE=$(du -h out/voxanne-demo-final.mp4 | cut -f1)
  echo "✅ SUCCESS! Final video created: $FILE_SIZE"
  echo "   📺 Location: remotion-videos/out/voxanne-demo-final.mp4"
else
  echo "❌ Final video not found"
  exit 1
fi

echo ""
echo "🎉 VIDEO PRODUCTION COMPLETE!"
echo "   Duration: 90 seconds (2700 frames @ 30fps)"
echo "   Screenshots: 12+ captured"
echo "   Manifests: $MANIFEST_COUNT generated"
echo "   Scenes: 13 rendered and merged"
```

**npm Script Addition (package.json):**
```json
{
  "scripts": {
    "video:production": "bash scripts/video-production-workflow.sh"
  }
}
```

**Success Criteria:**
- [ ] Single command execution: `npm run video:production`
- [ ] Dev server starts automatically
- [ ] Screenshots captured without manual intervention
- [ ] Manifests generated automatically
- [ ] Voiceovers created (if ElevenLabs key configured)
- [ ] All 13 scenes render successfully
- [ ] Final 90-second video exported to `out/voxanne-demo-final.mp4`
- [ ] Process completes without manual approval steps

**Error Handling:**
- Exit on any step failure
- Clean up dev server process on error
- Clear error messages for debugging
- Restore state if interrupted

---

### **Phase 4: Non-Interactive Scene Rendering** (Remove Approval Checkpoints)

**Duration:** 30 minutes
**Objective:** Modify scene-by-scene renderer to run without user approval

**Current Behavior:**
- `npm run render:scene` pauses after each scene
- User must press ENTER to approve and continue
- Manual intervention required for 13 scenes

**New Behavior:**
- Automatic rendering of all scenes
- No user approval checkpoints
- Progress reporting only

**File to Modify:** `remotion-videos/scripts/render-scene-by-scene.ts`

**Changes:**
1. Remove `promptUser()` function calls
2. Replace approval checkpoint with automatic continuation
3. Add `--non-interactive` flag support
4. Keep progress logging (Scene X/13 complete)

**Code Changes:**
```typescript
// BEFORE
const answer = await promptUser('Your choice: ');
if (answer.toLowerCase() === 'abort') {
  process.exit(0);
} else if (answer.toLowerCase() === 'redo') {
  i--;
  continue;
}

// AFTER
if (process.env.NON_INTERACTIVE === 'true') {
  console.log(`✅ Scene ${i+1} complete! Auto-continuing...\n`);
} else {
  const answer = await promptUser('Your choice: ');
  if (answer.toLowerCase() === 'abort') {
    process.exit(0);
  } else if (answer.toLowerCase() === 'redo') {
    i--;
    continue;
  }
}
```

**Success Criteria:**
- [ ] `NON_INTERACTIVE=true npm run render:scene` runs without pauses
- [ ] All 13 scenes render automatically
- [ ] Progress logged to console
- [ ] Errors reported but don't stop workflow
- [ ] Compatible with existing interactive mode

---

### **Phase 5: Comprehensive Testing** (Validation)

**Duration:** 30-45 minutes
**Objective:** Verify the entire automated workflow end-to-end

**Test Cases:**

**Test 1: Fresh Environment**
```bash
# Clean all outputs
npm run clean  # (in remotion-videos/)

# Run automated workflow
npm run video:production

# Expected: Complete video in 15-20 minutes
```

**Test 2: Incremental Updates**
```bash
# Update one scene file
# Re-run workflow
npm run video:production

# Expected: Only changed scenes re-render (caching works)
```

**Test 3: Error Recovery**
```bash
# Simulate ElevenLabs API failure
export ELEVENLABS_API_KEY="invalid"
npm run video:production

# Expected: Warning logged, continues with cached voiceovers
```

**Test 4: Missing Manifests**
```bash
# Delete one manifest
rm remotion-videos/public/manifests/02_agent_config_inbound.json

# Re-run workflow
npm run video:production

# Expected: Manifest regenerated automatically
```

**Success Criteria:**
- [ ] All 4 test cases pass
- [ ] No manual intervention required
- [ ] Clear error messages on failure
- [ ] Graceful degradation (e.g., missing voiceover = silent video)
- [ ] Final video quality matches manual process

---

## Technical Requirements

### **Dependencies**

**Runtime:**
- Node.js >= 20.0.0
- npm or yarn
- Chromium (Playwright browser)

**NPM Packages:**
- @playwright/test (screenshot capture)
- remotion (video rendering)
- ts-node (TypeScript execution)
- @elevenlabs/api (voiceover generation)

**Environment Variables:**
```bash
# Required
ELEVENLABS_API_KEY=sk_...  # For voiceover generation

# Optional
NON_INTERACTIVE=true       # Skip approval checkpoints
PLAYWRIGHT_HEADLESS=true   # Run Playwright in headless mode
REMOTION_CONCURRENCY=2     # Parallel scene rendering
```

### **File Structure**

```
project-root/
├── scripts/
│   └── video-production-workflow.sh       # NEW: Master automation script
├── tests/e2e/
│   └── capture-website-screenshots.spec.ts # MODIFIED: Add 8 new screenshots
├── remotion-videos/
│   ├── public/
│   │   ├── manifests/                     # 12+ JSON manifest files
│   │   ├── screenshots/                   # 12+ PNG screenshot files
│   │   └── audio/voiceovers/              # 13 MP3 voiceover files
│   ├── scripts/
│   │   ├── render-scene-by-scene.ts       # MODIFIED: Add non-interactive mode
│   │   └── generate-voiceovers.ts         # EXISTING: ElevenLabs integration
│   └── out/
│       ├── scene-*.mp4                    # Individual scene videos
│       └── voxanne-demo-final.mp4         # Final merged video
└── package.json                            # MODIFIED: Add video:production script
```

### **Contracts & Interfaces**

**Manifest Schema (Validated):**
```typescript
interface SceneManifest {
  screenshotName: string;              // "01_dashboard_home.png"
  resolution: { width: 1920; height: 1080 };
  capturedAt: string;                  // ISO timestamp
  elements: ElementCoordinates[];      // Array of UI elements
}

interface ElementCoordinates {
  name: string;                        // "hot-leads-card"
  selector: string;                    // '[data-testid="hot-leads"]'
  x: number; y: number;                // Top-left position
  width: number; height: number;       // Dimensions
  centerX: number; centerY: number;    // Cursor positioning
}
```

**Playwright Selector Mapping:**
```typescript
const dashboardSelectors: Record<string, string> = {
  'hot-leads-card': '[data-testid="hot-leads"]',
  'recent-calls-card': '[data-testid="recent-calls"]',
  // ... 15 total element selectors
};
```

---

## Testing Criteria

### **Unit Tests**

**Test 1: Manifest Loader**
```typescript
describe('Manifest Loader', () => {
  it('should load manifest from public/manifests/', () => {
    const manifest = loadManifest('01_dashboard_home.png');
    expect(manifest).not.toBeNull();
    expect(manifest?.elements.length).toBeGreaterThan(0);
  });

  it('should return cached manifest on second load', () => {
    const first = loadManifest('01_dashboard_home.png');
    const second = loadManifest('01_dashboard_home.png');
    expect(first).toBe(second); // Same object reference (cached)
  });

  it('should return null for missing manifest', () => {
    const manifest = loadManifest('99_nonexistent.png');
    expect(manifest).toBeNull();
  });
});
```

**Test 2: Component Coordinate Resolution**
```typescript
describe('HighlightBox Component', () => {
  it('should load coordinates from manifest', () => {
    const coords = getCoordinates('01_dashboard_home.png', 'hot-leads-card');
    expect(coords).not.toBeNull();
    expect(coords?.x).toBeGreaterThan(0);
    expect(coords?.y).toBeGreaterThan(0);
  });

  it('should fall back to explicit coordinates', () => {
    // Test backward compatibility
    const element = <HighlightBox x={100} y={200} width={300} height={150} />;
    // Render and verify element renders without errors
  });
});
```

### **Integration Tests**

**Test 1: Screenshot Capture → Manifest Generation**
```bash
# Start dev server
npm run dev &

# Run Playwright
npx playwright test tests/e2e/capture-website-screenshots.spec.ts

# Verify manifests created
test -f remotion-videos/public/manifests/01_dashboard_home.json
echo $?  # Should output 0 (success)
```

**Test 2: Manifest → Remotion Rendering**
```bash
# Render a single scene
cd remotion-videos
npx remotion render src/index.ts Scene2_DashboardOverview out/scene2-test.mp4

# Verify video created
test -f out/scene2-test.mp4
echo $?  # Should output 0 (success)
```

**Test 3: Full Workflow Execution**
```bash
# Run master script
npm run video:production

# Verify final video
test -f remotion-videos/out/voxanne-demo-final.mp4
echo $?  # Should output 0 (success)

# Verify video duration (should be ~90 seconds)
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 \
  remotion-videos/out/voxanne-demo-final.mp4
```

### **Acceptance Criteria**

**For Phase 1 (Manual Verification):**
- ✅ All 8 updated scenes render in Remotion Studio
- ✅ HighlightBox overlays align within ±5px tolerance
- ✅ ClickSimulation cursors hit correct UI elements
- ✅ FormFillSimulation overlays match input field dimensions
- ✅ No console errors related to manifest loading
- ✅ Video exports successfully without crashes

**For Phase 3 (100% Automation):**
- ✅ Single command execution (`npm run video:production`)
- ✅ Zero manual approval steps required
- ✅ Complete video rendered in <20 minutes
- ✅ All 13 scenes included in final video
- ✅ Video quality matches manual production
- ✅ Error handling prevents partial failures
- ✅ Clear progress logging throughout workflow

**For Phase 5 (Testing):**
- ✅ Fresh environment test passes (clean slate → complete video)
- ✅ Incremental update test passes (changed scene re-renders)
- ✅ Error recovery test passes (graceful degradation)
- ✅ Missing manifest test passes (auto-regeneration)

---

## Risk Assessment

### **High Risk**

1. **Dev Server Not Running**
   - Playwright screenshot capture fails
   - **Mitigation:** Master script starts dev server automatically

2. **Missing Selectors**
   - Playwright can't find UI elements
   - **Mitigation:** Verify selectors against live site before automation

3. **Manifest Coordinate Misalignment**
   - HighlightBox overlays don't match UI
   - **Mitigation:** Manual verification in Phase 1 before automation

### **Medium Risk**

1. **ElevenLabs API Quota Exceeded**
   - Voiceover generation fails
   - **Mitigation:** Graceful fallback to silent video or cached voiceovers

2. **Remotion Rendering Out of Memory**
   - Scene rendering crashes
   - **Mitigation:** Reduce concurrency, render one scene at a time

### **Low Risk**

1. **TypeScript Compilation Errors**
   - Scripts won't execute
   - **Mitigation:** Comprehensive type checking before execution

2. **File Permission Issues**
   - Can't write manifests or videos
   - **Mitigation:** Verify directory permissions in setup script

---

## Definition of Done

**Phase 1 Complete When:**
- [ ] All 8 updated scenes tested in Remotion Studio
- [ ] Frame-by-frame verification documented
- [ ] Any coordinate misalignments identified and documented
- [ ] Screenshot quality approved (crisp, no loading states)

**Phase 2 Complete When:**
- [ ] 8 new manifest JSON files created
- [ ] All 15 element names mapped to coordinates
- [ ] Manifest schema validated (no missing fields)
- [ ] Coordinates verified as reasonable (within bounds)

**Phase 3 Complete When:**
- [ ] `video-production-workflow.sh` script created
- [ ] `npm run video:production` command added to package.json
- [ ] Script executes all 8 steps sequentially
- [ ] Final video created without manual intervention

**Phase 4 Complete When:**
- [ ] `render-scene-by-scene.ts` supports `NON_INTERACTIVE=true`
- [ ] All 13 scenes render without approval checkpoints
- [ ] Progress logging maintained
- [ ] Backward compatible with interactive mode

**Phase 5 Complete When:**
- [ ] All 4 test cases pass
- [ ] Automation workflow documented
- [ ] Error recovery verified
- [ ] Final video quality approved

---

## Timeline

**Total Estimated Duration:** 3-4 hours

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Manual Verification | 30-45 min | Dev server running |
| Phase 2: Create Manifests | 15-20 min | Phase 1 complete, selectors verified |
| Phase 3: Master Script | 60-90 min | Phase 2 complete |
| Phase 4: Non-Interactive Mode | 30 min | Phase 3 complete |
| Phase 5: Comprehensive Testing | 30-45 min | All phases complete |

**Critical Path:**
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

**Parallel Work Opportunities:**
- Phase 4 can start while Phase 3 is in progress (different files)
- Test case preparation can happen during Phase 3

---

## Next Actions

**Immediate (Step 2 of 3-Step Principle):**
1. ✅ Review this planning document
2. ⏳ Get user approval to proceed
3. ⏳ Begin Phase 1: Final Rendering Verification

**Pending User Input:**
- Confirm dev server can be started (`npm run dev`)
- Confirm voxanne@demo.com credentials are available
- Confirm ElevenLabs API key is configured (or skip voiceovers)

**Ready to Execute:**
Once approved, I will proceed phase-by-phase following the 3-step coding principle:
- Complete Phase 1 with testing before Phase 2
- Complete Phase 2 with testing before Phase 3
- And so on...

---

**Status:** ✅ PLANNING COMPLETE - AWAITING APPROVAL TO PROCEED

