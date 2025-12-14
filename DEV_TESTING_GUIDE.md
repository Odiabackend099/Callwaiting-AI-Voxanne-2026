# Voxanne Development Testing Guide
## Phase 1 Fixes - Safe Testing Environment

---

## 🎯 What's Set Up

You now have **TWO separate environments**:

### 1. **DEVELOPMENT** (Testing Phase 1 fixes)
- **Test Number:** +1 952 333 8443
- **Port:** 8001
- **Credentials:** `.env.dev`
- **Status:** Phase 1 optimizations ENABLED
- **Purpose:** Test new features without affecting production

### 2. **PRODUCTION** (Current live system)
- **Production Number:** +1 252 645 3035
- **Port:** 3000
- **Credentials:** `.env` (unchanged)
- **Status:** Protected - DO NOT modify until dev testing complete
- **Purpose:** Live customer-facing service

---

## 🚀 Quick Start: Testing Phase 1

### Step 1: Start Development Server

```bash
cd "/Users/mac/Desktop/VOXANNE  ADMIN"
./start-dev.sh
```

**What this does:**
- Loads `.env.dev` credentials
- Starts Voxanne on port 8001
- Uses test Twilio number +1 952 333 8443
- Enables all Phase 1 optimizations:
  - ✅ v3.0 Aura-optimized prompt
  - ✅ Humanizer enabled
  - ✅ Barge-in V2 enabled
  - ✅ 150ms endpointing
  - ✅ 160-byte TTS chunks

### Step 2: Configure Ngrok for Development

Since your production is using ngrok, you'll need to update the ngrok URL in `.env.dev` OR run a second ngrok tunnel:

**Option A: Use existing ngrok (simpler)**
1. Your current ngrok is: `https://sobriquetical-zofia-abysmally.ngrok-free.dev`
2. It should already forward to your local server
3. Just verify it's working

**Option B: Run separate ngrok for dev (cleaner)**
```bash
# In a new terminal
ngrok http 8001
# Copy the new HTTPS URL (e.g., https://xyz.ngrok-free.app)
# Update .env.dev PUBLIC_URL to the new URL
```

### Step 3: Configure Twilio Test Number

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to Phone Numbers → Manage → Active numbers
3. Click on **+1 952 333 8443**
4. Under "Voice Configuration":
   - **A CALL COMES IN:** Webhook
   - **URL:** `https://YOUR_NGROK_URL/twilio/incoming` (HTTP POST)
   - **PRIMARY HANDLER FAILS:** (leave default)
5. Click **Save**

### Step 4: Test the Agent

**Call +1 952 333 8443**

Run through these test scenarios:

#### Test 1: Prosody & Numbers
- **Say:** "What does it cost?"
- **Listen for:**
  - ✅ Numbers as words ("one sixty-nine dollars" NOT "$169")
  - ✅ Short sentences (max 12 words each)
  - ✅ Natural pauses with commas
  - ✅ Contractions ("I'll" not "I will")

#### Test 2: Barge-In (Hard Cancel)
- **Action:** Let Voxanne start speaking
- **Then:** Interrupt by saying "Wait"
- **Expected:** Agent stops within 100ms

#### Test 3: Turn-Taking (Semantic VAD)
- **Say:** "I'm looking for... um..." (pause 1 second) "a demo"
- **Expected:**
  - Agent waits for you to finish
  - Responds within 200ms after "demo"

#### Test 4: Humanization
- **Say:** "Tell me about your service"
- **Listen for:**
  - ✅ Natural fillers ("Um...", "So...")
  - ✅ Thinking phrases ("Let me check that")
  - ✅ No robotic phrases ("I'd be happy to assist you")

---

## 📊 Monitor Metrics

While testing, check the metrics endpoint:

```bash
curl http://localhost:8001/metrics
```

**Key metrics to watch:**
- `avg_turn_latency_ms` - Should be <350ms
- `total_barge_ins` - Confirms barge-in is working
- `avg_turns_per_call` - Natural conversation flow

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to server"
**Solution:** Verify dev server is running on port 8001:
```bash
lsof -i :8001
```

### Issue: "Twilio webhook not responding"
**Solutions:**
1. Check ngrok is forwarding to port 8001
2. Verify PUBLIC_URL in `.env.dev` matches ngrok URL
3. Check Twilio webhook URL is correct

### Issue: "Agent sounds robotic"
**Check:**
1. Verify `.env.dev` has `ENABLE_HUMANIZER=true`
2. Check console output shows:
   ```
   🎭 Humanizer: True
   🚨 Barge-in V2: True
   ⚡ Endpointing: 150ms
   ```

### Issue: "Agent doesn't stop when interrupted"
**Check:**
1. Verify `ENABLE_BARGE_IN_V2=true` in `.env.dev`
2. Check console logs for "🚨 BARGE-IN DETECTED"

---

## ✅ Testing Checklist

Before deploying to production, verify:

- [ ] Numbers spoken as words (not "$169")
- [ ] Barge-in works (<100ms stop time)
- [ ] Turn-taking feels natural (no awkward pauses)
- [ ] Agent uses contractions ("I'll" not "I will")
- [ ] Natural fillers present ("Um...", "So...")
- [ ] No robotic phrases
- [ ] Metrics show <350ms turn latency
- [ ] 5-10 test calls completed successfully

---

## 🚀 Deploying to Production (After Testing)

**ONLY after confirming Phase 1 works in development:**

### Option 1: Update Production .env (Recommended)
```bash
# Backup current production config
cp .env .env.backup

# Copy Phase 1 optimizations from .env.dev
# Add these lines to .env:
echo "ENABLE_HUMANIZER=true" >> .env
echo "ENABLE_BARGE_IN_V2=true" >> .env
echo "ENDPOINT_MS=150" >> .env

# Restart production server
./start-prod.sh
```

### Option 2: Replace .env entirely
```bash
# Backup
cp .env .env.backup

# Update Twilio credentials back to production
sed -i '' 's/AC0a90c92cbd17b575fde9ec6e817b71af/AC1f926e8af4af9a8481f91833e71abd77/' .env.dev
sed -i '' 's/11c1e5e1069e38f99a2f8c35b8baaef8/919da20c675c7e4c5a6d8060863042d8/' .env.dev
sed -i '' 's/+19523338443/+12526453035/' .env.dev
sed -i '' 's/8001/3000/' .env.dev

cp .env.dev .env
./start-prod.sh
```

---

## 📞 Quick Reference

| Environment | Number | Port | Config | Purpose |
|-------------|--------|------|--------|---------|
| **Development** | +1 952 333 8443 | 8001 | `.env.dev` | Testing Phase 1 |
| **Production** | +1 252 645 3035 | 3000 | `.env` | Live customers |

---

## 🎯 Expected Results

### Before Phase 1 (Current Production):
- ❌ Robotic, formal speech
- ❌ Numbers sound wrong ("dollar sign one six nine")
- ❌ Agent talks over you
- ❌ Long wait times

### After Phase 1 (Development Test):
- ✅ Natural, conversational speech
- ✅ Numbers sound human ("one sixty-nine dollars")
- ✅ Agent stops when interrupted
- ✅ Fast, responsive turn-taking
- ✅ 70-80% Vapi/Retell quality

---

## 📝 Notes

- Production remains **untouched** until dev testing is successful
- All Phase 1 code changes are **already in place** (voxanne_v2.py, conversation_manager.py)
- Only configuration (environment variables) differs between dev and prod
- You can run dev and prod simultaneously on different ports

---

**Need help?** Check the main plan file: `/Users/mac/.claude/plans/zippy-jingling-dawn.md`
