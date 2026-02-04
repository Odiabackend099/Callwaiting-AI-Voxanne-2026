# 🤖 FRESH AI IMPLEMENTATION PROMPT - Voxanne Voiceover Fix

**Use this prompt with a brand new AI assistant in a fresh terminal/conversation.**

---

## CONTEXT

You are implementing a professional voiceover system for a Remotion-based product demo video. The previous implementation was rated **1/10** by the user because the voiceover used generic marketing language instead of explaining the specific actions happening on screen.

### Project Details:
- **Platform:** Remotion 4.0+ (React-based video generation framework)
- **Video Duration:** 90 seconds (13 scenes, 2700 frames at 30fps)
- **Resolution:** 1920×1080
- **TTS Provider:** ElevenLabs API (model: `eleven_turbo_v2_5`, voice: Rachel)
- **API Key:** `sk_d82a6528a55b45e25112c107fcbecf0bcafd70f9c325a09e`
- **Project Path:** `/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/`

---

## CRITICAL REQUIREMENT ⚠️

**MUST IMPLEMENT ACTION-DRIVEN NARRATION**

The voiceover must explain **EVERY visible interaction**:
- Cursor movements ("I'll click the Save button...")
- Form fills ("Watch as I type the system prompt...")
- Button clicks ("Now I'll click Generate Code...")
- Progress indicators ("See the upload progress bar filling...")
- Success indicators ("The green checkmark confirms success...")
- Specific data ("Sarah's lead score is 85—marked HOT...")

**NEVER use generic benefit statements** like:
- ❌ "Configure your AI in seconds" (doesn't explain what's being clicked)
- ❌ "Upload your knowledge base" (doesn't explain the upload process)
- ❌ "Test your AI" (doesn't explain the conversation shown)

**ALWAYS use tutorial-style narration** like:
- ✅ "I'll click the system prompt field and type: 'You are a friendly receptionist...'"
- ✅ "Watch the progress bar fill as the PDF uploads... and there's the checkmark"
- ✅ "The patient asks about Botox. Our AI responds with available times. Appointment booked."

---

## COMPLETE VOICEOVER SCRIPTS (USE THESE EXACT SCRIPTS)

### Scene 0A: Homepage Scroll (10s, 300 frames)
```
Your clinic missed 47 calls last week. That's $18,800 in lost revenue. What if AI answered every single one?
```
**Status:** ✅ Keep as-is (problem hook appropriate for opening)

---

### Scene 0B: Sign In (10s, 300 frames)
```
Meet Voxanne AI. The voice receptionist that never sleeps, never misses a call, and books appointments automatically.
```
**Status:** ✅ Keep as-is (product intro appropriate)

---

### Scene 2: Dashboard Overview (6s, 180 frames)
```
This is your AI command center. On the left, you see today's call volume. The center panel shows your hottest leads with scores. And on the right, appointments booked automatically by your AI. All updating in real-time.
```
**Why this works:** References specific dashboard panels (left/center/right) and explains what each metric means.

---

### Scene 3: Configure Agent (8s, 240 frames) 🔴 CRITICAL
```
I'll click the system prompt field to configure how your AI greets callers. Watch as I type: 'You are a friendly receptionist for Valley Dermatology. Help callers schedule appointments.' The AI learns this instruction instantly. See the success indicator? Your agent is now configured and ready to answer calls.
```
**Why this works:** Explains cursor click, quotes exact text shown, references success indicator.

**Frame Breakdown:**
- Frame 0-30: Explaining cursor click
- Frame 60-120: Narrating typing action
- Frame 130-180: Confirming success

---

### Scene 4: Upload Knowledge (5s, 150 frames) 🔴 CRITICAL
```
Now I'll click the upload area to add knowledge. I'm selecting our services and pricing PDF. Watch the progress bar fill as it uploads... Perfect. The checkmark confirms the file is uploaded. Your AI now knows all your services and prices.
```
**Why this works:** Explains click, specifies file type, narrates progress bar, references checkmark.

**Frame Breakdown:**
- Frame 0-40: Explaining click and file selection
- Frame 50-90: Narrating upload progress
- Frame 100-150: Confirming completion

---

### Scene 5: Connect Telephony (7s, 210 frames) 🔴 CRITICAL
```
Now for telephony setup. I'm completing the connection wizard with your provider details. The system generates a unique forwarding code—here it is: star 72, plus your AI number. Simply dial this code from your office phone, and all incoming calls route to your AI agent.
```
**Why this works:** Explains multi-step wizard, references code generation, reads code aloud, explains activation.

**Frame Breakdown:**
- Frame 0-80: Explaining wizard steps
- Frame 120-160: Reading forwarding code
- Frame 180-210: Explaining activation

---

### Scene 6: AI Forwarding (8s, 240 frames)
```
Once you dial the forwarding code, every incoming call routes directly to your AI agent. You can see the code displayed here for easy reference. This one-time setup takes 30 seconds, and your AI starts answering calls immediately.
```
**Why this works:** Explains activation, references visual, sets time expectation.

---

### Scene 7: Browser Test (8s, 240 frames) 🔴 CRITICAL
```
Let me click Start Call to test this live. Watch the conversation. The patient says: 'I'd like to schedule a Botox consultation.' Our AI instantly responds: 'I'd love to help! We have openings Tuesday at 2 PM or Wednesday at 10 AM.' Patient chooses Tuesday. And just like that—appointment booked. No human intervention needed.
```
**Why this works:** Explains button click, quotes patient dialogue, quotes AI response, narrates flow.

**Frame Breakdown:**
- Frame 0-40: Explaining button click
- Frame 80-110: Quoting patient request
- Frame 120-160: Quoting AI response
- Frame 170-240: Confirming appointment booked

---

### Scene 8: Live Phone Test (8s, 240 frames) 🔴 CRITICAL
```
Now for a real phone test. I'll enter my number and click 'Call Me.' Watch... the call comes in immediately. You can see the live timer counting up. And here's the real-time transcript showing everything the AI is saying. It's asking the patient about their scheduling needs... and watch... it books a follow-up appointment for Wednesday at 3 PM. All automated.
```
**Why this works:** Explains form fill, button click, references timer, references transcript, narrates conversation.

**Frame Breakdown:**
- Frame 0-60: Explaining form fill and click
- Frame 120-140: Referencing timer
- Frame 150-180: Referencing transcript
- Frame 190-240: Narrating booking outcome

---

### Scene 9: Call Logs (6s, 180 frames)
```
Every call gets logged automatically. You can see the AI sentiment score here—whether the caller was satisfied or upset. Click 'View Transcript' to read the entire conversation. Call duration shows how long each interaction took. All this data helps you understand what's working.
```
**Why this works:** References specific metrics, explains what they mean, provides context.

---

### Scene 10: Hot Leads (6s, 180 frames)
```
The AI automatically scores every lead. Here's Sarah with a score of 85—marked HOT, meaning she's ready for immediate callback. Michael scores 78, also hot. Emily scores 72, so she's marked WARM—follow up in a few days. One click on any name calls them back instantly.
```
**Why this works:** References specific data shown (scores, names), explains badge system (HOT/WARM).

---

### Scene 11: Appointments Booked (6s, 180 frames)
```
Here's the results dashboard. Three appointments booked this week—entirely by AI. These are calls that came in after hours or when your team was busy. Without the AI, these would have been missed calls. Instead, they're confirmed appointments adding to your schedule automatically.
```
**Why this works:** Identifies dashboard, quantifies result, provides context, shows value.

---

### Scene 12: Call to Action (16s, 480 frames)
```
Start your free 14-day trial. No credit card. No setup fees. Visit voxanne.ai to never miss a patient again.
```
**Status:** ✅ Keep as-is (clear CTA)

---

## IMPLEMENTATION STEPS

### Step 1: Update Voiceover Configuration

**File:** `remotion-videos/src/config/voiceover-config.ts`

Replace the entire `SCENE_VOICEOVERS` array with:

```typescript
export const SCENE_VOICEOVERS: SceneVoiceover[] = [
  {
    sceneId: 'scene-0a',
    sceneName: 'Homepage Scroll',
    durationSeconds: 10,
    script: "Your clinic missed 47 calls last week. That's $18,800 in lost revenue. What if AI answered every single one?",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 132,
  },
  {
    sceneId: 'scene-0b',
    sceneName: 'Sign In',
    durationSeconds: 10,
    script: "Meet Voxanne AI. The voice receptionist that never sleeps, never misses a call, and books appointments automatically.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 108,
  },
  {
    sceneId: 'scene-2',
    sceneName: 'Dashboard Overview',
    durationSeconds: 6,
    script: "This is your AI command center. On the left, you see today's call volume. The center panel shows your hottest leads with scores. And on the right, appointments booked automatically by your AI. All updating in real-time.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-3',
    sceneName: 'Configure Agent',
    durationSeconds: 8,
    script: "I'll click the system prompt field to configure how your AI greets callers. Watch as I type: 'You are a friendly receptionist for Valley Dermatology. Help callers schedule appointments.' The AI learns this instruction instantly. See the success indicator? Your agent is now configured and ready to answer calls.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 200,
  },
  {
    sceneId: 'scene-4',
    sceneName: 'Upload Knowledge',
    durationSeconds: 5,
    script: "Now I'll click the upload area to add knowledge. I'm selecting our services and pricing PDF. Watch the progress bar fill as it uploads... Perfect. The checkmark confirms the file is uploaded. Your AI now knows all your services and prices.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 210,
  },
  {
    sceneId: 'scene-5',
    sceneName: 'Connect Telephony',
    durationSeconds: 7,
    script: "Now for telephony setup. I'm completing the connection wizard with your provider details. The system generates a unique forwarding code—here it is: star 72, plus your AI number. Simply dial this code from your office phone, and all incoming calls route to your AI agent.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-6',
    sceneName: 'AI Forwarding',
    durationSeconds: 8,
    script: "Once you dial the forwarding code, every incoming call routes directly to your AI agent. You can see the code displayed here for easy reference. This one-time setup takes 30 seconds, and your AI starts answering calls immediately.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 150,
  },
  {
    sceneId: 'scene-7',
    sceneName: 'Browser Test',
    durationSeconds: 8,
    script: "Let me click Start Call to test this live. Watch the conversation. The patient says: 'I'd like to schedule a Botox consultation.' Our AI instantly responds: 'I'd love to help! We have openings Tuesday at 2 PM or Wednesday at 10 AM.' Patient chooses Tuesday. And just like that—appointment booked. No human intervention needed.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 210,
  },
  {
    sceneId: 'scene-8',
    sceneName: 'Live Phone Test',
    durationSeconds: 8,
    script: "Now for a real phone test. I'll enter my number and click 'Call Me.' Watch... the call comes in immediately. You can see the live timer counting up. And here's the real-time transcript showing everything the AI is saying. It's asking the patient about their scheduling needs... and watch... it books a follow-up appointment for Wednesday at 3 PM. All automated.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 230,
  },
  {
    sceneId: 'scene-9',
    sceneName: 'Call Logs',
    durationSeconds: 6,
    script: "Every call gets logged automatically. You can see the AI sentiment score here—whether the caller was satisfied or upset. Click 'View Transcript' to read the entire conversation. Call duration shows how long each interaction took. All this data helps you understand what's working.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 170,
  },
  {
    sceneId: 'scene-10',
    sceneName: 'Hot Leads',
    durationSeconds: 6,
    script: "The AI automatically scores every lead. Here's Sarah with a score of 85—marked HOT, meaning she's ready for immediate callback. Michael scores 78, also hot. Emily scores 72, so she's marked WARM—follow up in a few days. One click on any name calls them back instantly.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-11',
    sceneName: 'Appointments Booked',
    durationSeconds: 6,
    script: "Here's the results dashboard. Three appointments booked this week—entirely by AI. These are calls that came in after hours or when your team was busy. Without the AI, these would have been missed calls. Instead, they're confirmed appointments adding to your schedule automatically.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-12',
    sceneName: 'Call to Action',
    durationSeconds: 16,
    script: "Start your free 14-day trial. No credit card. No setup fees. Visit voxanne.ai to never miss a patient again.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 83,
  },
];
```

### Step 2: Clean Up Old Voiceovers

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
rm -rf public/audio/voiceovers/*.mp3
```

### Step 3: Regenerate All Voiceovers

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
npx ts-node scripts/generate-voiceovers.ts
```

**Expected Output:**
```
🎙️ Generating voiceovers for all scenes...

[1/13] Generating scene-0a...
✅ scene-0a.mp3 created (cached or new)

[2/13] Generating scene-0b...
✅ scene-0b.mp3 created

...

[13/13] Generating scene-12...
✅ scene-12.mp3 created

🎉 All 13 voiceovers generated successfully!
```

### Step 4: Verify Audio Files

```bash
ls -lh public/audio/voiceovers/
```

**Expected:** 13 MP3 files, total size ~1.5-2 MB

### Step 5: Re-render Video

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos
/usr/local/Cellar/node/25.5.0/bin/node node_modules/@remotion/cli/remotion-cli.js render src/index.ts VoxanneDemo out/voxanne-demo-v6-FIXED.mp4 --concurrency=4
```

**Expected:** Rendering completes successfully, output file ~30 MB

---

## VERIFICATION CHECKLIST

Watch the rendered video and verify:

### Scene 2 (20-26s):
- [ ] Voiceover mentions "left panel" for call volume
- [ ] Voiceover mentions "center panel" for leads
- [ ] Voiceover mentions "right panel" for appointments

### Scene 3 (26-34s):
- [ ] Voiceover says "I'll click the system prompt field"
- [ ] Voiceover says "Watch as I type" before typing animation
- [ ] Voiceover quotes exact text: "You are a friendly receptionist for Valley Dermatology"
- [ ] Voiceover says "See the success indicator?" when checkmark appears

### Scene 4 (34-39s):
- [ ] Voiceover says "I'll click the upload area"
- [ ] Voiceover mentions "services and pricing PDF"
- [ ] Voiceover says "Watch the progress bar fill" during upload
- [ ] Voiceover says "The checkmark confirms" when success appears

### Scene 5 (39-46s):
- [ ] Voiceover mentions "connection wizard"
- [ ] Voiceover reads the forwarding code aloud ("star 72, plus your AI number")
- [ ] Voiceover explains activation ("dial this code from your office phone")

### Scene 7 (54-62s):
- [ ] Voiceover says "Let me click Start Call"
- [ ] Voiceover quotes patient: "I'd like to schedule a Botox consultation"
- [ ] Voiceover quotes AI: "We have openings Tuesday at 2 PM or Wednesday at 10 AM"
- [ ] Voiceover confirms "appointment booked"

### Scene 8 (62-70s):
- [ ] Voiceover says "I'll enter my number and click 'Call Me'"
- [ ] Voiceover references "live timer counting up"
- [ ] Voiceover references "real-time transcript"
- [ ] Voiceover mentions specific booking: "Wednesday at 3 PM"

### Scene 10 (76-82s):
- [ ] Voiceover mentions "Sarah with a score of 85"
- [ ] Voiceover explains "marked HOT"
- [ ] Voiceover mentions "Michael scores 78"
- [ ] Voiceover mentions "Emily scores 72, so she's marked WARM"

---

## SUCCESS CRITERIA

**Before (1/10):** Generic benefit statements, no explanation of actions
**After (10/10):** Every click, form fill, and interaction explained with specific details

**Target Rating:** 9-10/10
- Voiceover explains every visible action
- Voiceover references specific data shown
- Voiceover timing matches visual actions
- Tutorial-style narration (not marketing ad)

---

## TROUBLESHOOTING

**Issue:** ElevenLabs API error "model_deprecated_free_tier"
**Fix:** Ensure using `eleven_turbo_v2_5` model (not `eleven_monolingual_v1`)

**Issue:** "Module cycle detected" error when running generate-voiceovers.ts
**Fix:** Use bash script with curl instead:
```bash
bash /tmp/generate-voiceovers.sh
```

**Issue:** Video render fails with "Audio file not found"
**Fix:** Ensure all 13 MP3 files exist in `public/audio/voiceovers/` before rendering

**Issue:** Voiceover too fast or too slow for scene duration
**Fix:** Adjust `wpmTarget` in voiceover-config.ts (higher = faster speech)

---

## ADDITIONAL REQUIREMENTS

### Background Music (Optional)

The code already includes background music integration. To add:

1. Download corporate ambient music (90-100s) from Pixabay
2. Save as `public/audio/music/background-corporate.mp3`
3. Re-render video

### Sound Effects (Optional)

The code already includes 13 sound effect triggers. To add:

1. Download UI sounds from Mixkit (click, success, whoosh, etc.)
2. Save to `public/audio/sfx/`
3. Re-render video

---

## FILES ALREADY CREATED (DO NOT RECREATE)

These services already exist and work correctly:
- `backend/src/services/elevenlabs-client.ts` (ElevenLabs API client)
- `backend/src/services/tts-cache-service.ts` (3-tier caching)
- `remotion-videos/scripts/generate-voiceovers.ts` (batch generation)
- `remotion-videos/src/VoxanneDemo.tsx` (video composition with audio)

**Only modify:** `remotion-videos/src/config/voiceover-config.ts` (scene scripts)

---

## FINAL NOTES

The previous implementation failed because it used **benefit-driven marketing language** instead of **action-driven tutorial narration**. This fresh implementation uses tutorial-style scripts that explain every interaction, quote specific dialogue, and reference exact data shown on screen.

**Key principle:** If something happens visually (click, type, progress bar, success indicator), the voiceover MUST explain it.

Good luck with the implementation! 🚀
