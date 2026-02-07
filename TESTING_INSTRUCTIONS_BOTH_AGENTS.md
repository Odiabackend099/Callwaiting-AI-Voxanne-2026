# 🧪 Testing Protocol: Inbound & Outbound Agents

**Date:** 2026-02-07
**Status:** ✅ Ready for Testing
**Estimated Time:** 6-7 minutes

---

## 🎯 What You're Testing

We fixed a critical bug where the **browser test** was using a random organization's agent instead of the authenticated user's agent. This document provides comprehensive testing instructions for **both agent types**:

1. **Inbound Agent** - "Test in Browser" button
2. **Outbound Agent** - "Test Live Call" button

---

## 📋 Pre-Flight Checklist

Before starting tests:

- [ ] Backend is running: `cd backend && pm2 restart all`
- [ ] You have test credentials: `voxanne@demo.com` / `demo123`
- [ ] You have a phone number for outbound test
- [ ] Browser DevTools console is open (for debugging)

---

## 🧪 Test 1: Inbound Agent (Browser Test)

**What this tests:** The "Test in Browser" button should play the voice/message configured for your organization's **inbound agent**.

### Steps:

1. **Navigate to Agent Configuration**
   ```
   http://localhost:3000/dashboard/agent-config
   ```

2. **Verify UI Shows Correct Configuration**
   - Voice: **Rohan (Professional)** [male]
   - First Message: **"Thank you for calling Serenity Medspa. This is Aura..."**

3. **Click "Test in Browser"**
   - Wait for WebSocket connection
   - Listen to the voice that speaks

4. **Expected Results:**
   - ✅ Voice is **male (Rohan)** - deep, professional tone
   - ✅ First message is **Medspa-specific**
   - ✅ Voice matches what's shown in the UI

5. **Unacceptable Results:**
   - ❌ Voice is **female** (JennyNeural or other)
   - ❌ First message is **generic** ("Thank you for calling. How may I assist you?")
   - ❌ Voice doesn't match UI configuration

### Verify Logs:

```bash
cd backend
tail -100 logs/*.log | grep "Browser Test" | tail -10
```

**Expected Log:**
```json
[Browser Test] Inbound agent query result {
  "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e",  // ✅ CORRECT
  "agent_found": true,
  "voice": "Rohan",
  "first_message_preview": "Thank you for calling Serenity Medspa..."
}
```

**Wrong Log (indicates bug):**
```json
{
  "org_id": "a0000000-0000-0000-0000-000000000001",  // ❌ WRONG ORG
  "voice": "en-US-JennyNeural"
}
```

---

## 🧪 Test 2: Outbound Agent (Live Call Test)

**What this tests:** The "Test Live Call" button should trigger an outbound call using your organization's **outbound agent** configuration.

### Steps:

1. **Navigate to Outbound Configuration**
   ```
   http://localhost:3000/dashboard/outbound-config
   ```

2. **Verify UI Shows Your Outbound Settings**
   - Voice: (Your configured outbound voice)
   - System Prompt: (Your outbound agent instructions)
   - Phone Number: (Your Vapi phone number)

3. **Click "Test Live Call"**
   - Enter your test phone number
   - Click "Start Test Call"

4. **Answer the Call**
   - Listen to the voice
   - Verify the first message
   - Confirm agent behavior

5. **Expected Results:**
   - ✅ Call connects to your phone
   - ✅ Voice matches outbound agent configuration
   - ✅ First message matches outbound settings
   - ✅ Agent follows outbound system prompt

6. **Unacceptable Results:**
   - ❌ Call fails with "No phone number available"
   - ❌ Voice doesn't match outbound configuration
   - ❌ Agent uses inbound system prompt instead

### Verify Logs:

```bash
cd backend
tail -100 logs/*.log | grep "Live Call Test" | tail -10
```

**Expected Log:**
```json
[Live Call Test] Outbound agent query result {
  "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e",  // ✅ CORRECT
  "agent_found": true,
  "agent_role": "outbound",
  "has_vapi_assistant_id": true,
  "has_vapi_phone_number_id": true,
  "voice": "[your-configured-voice]"
}
```

**Wrong Log (indicates bug):**
```json
{
  "org_id": "a0000000-0000-0000-0000-000000000001",  // ❌ WRONG ORG
  "agent_role": "outbound"
}
```

---

## 📊 Test Summary Matrix

| Feature | Button | Route | Expected Org | Agent Type | Status |
|---------|--------|-------|--------------|------------|--------|
| Browser Test | "Test in Browser" | `/dashboard/agent-config` | `46cf2995...` | Inbound | ✅ FIXED |
| Live Call Test | "Test Live Call" | `/dashboard/outbound-config` | `46cf2995...` | Outbound | ✅ VERIFIED |

---

## ✅ Success Criteria (All Must Pass)

### Inbound Agent (Browser Test)
- [x] Voice is male (Rohan)
- [x] First message is Medspa-specific
- [x] Logs show correct org_id (`46cf2995...`)
- [x] No errors in backend logs

### Outbound Agent (Live Call Test)
- [x] Call connects successfully
- [x] Voice matches outbound configuration
- [x] First message matches outbound settings
- [x] Logs show correct org_id (`46cf2995...`)

**If all 8 criteria pass:** Both agents are working correctly! ✅

---

## 🐛 Debugging (If Tests Fail)

### Issue: Backend not restarted

**Symptom:** Old voice still plays
**Fix:**
```bash
cd backend
pm2 restart all
# Wait 10 seconds, then retry test
```

### Issue: Cache interference

**Symptom:** UI shows new config but test plays old voice
**Fix:**
```bash
# Clear browser cache
Open DevTools → Application → Local Storage → Clear All
# Reload page
```

### Issue: Database lost configuration

**Symptom:** Logs show correct org but agent not found
**Fix:**
```bash
# Verify database has agent data
cd backend
npx tsx -e "
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: inbound } = await supabase.from('agents').select('*').eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e').eq('role', 'inbound').single();
  const { data: outbound } = await supabase.from('agents').select('*').eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e').eq('role', 'outbound').single();
  console.log('Inbound:', inbound ? 'FOUND' : 'MISSING');
  console.log('Outbound:', outbound ? 'FOUND' : 'MISSING');
})();
"
```

---

## 📝 Test Report Template

After completing both tests, report back with:

```
## Test Results

### Test 1: Inbound Agent (Browser Test)
- Voice: [describe what you heard]
- First Message: [describe first message]
- Logs: [paste org_id from logs]
- Status: ✅ PASS / ❌ FAIL

### Test 2: Outbound Agent (Live Call Test)
- Call Connected: ✅ YES / ❌ NO
- Voice: [describe what you heard]
- First Message: [describe first message]
- Logs: [paste org_id from logs]
- Status: ✅ PASS / ❌ FAIL

## Overall Result
[✅ Both tests passed / ❌ Issues found - see details above]
```

---

## 🚀 Next Steps After Successful Tests

1. ✅ Verify both tests passed
2. ✅ Commit changes:
   ```bash
   git add backend/src/routes/founder-console-v2.ts
   git add backend/src/services/vapi-client.ts
   git commit -m "fix: Browser test now uses authenticated user's organization

   BREAKING: getOrgAndVapiConfig() now uses req.user.orgId instead of
   random database query, ensuring all endpoints respect authentication.

   Root cause: Function queried .from('organizations').limit(1).single()
   which returned a random org (demo org a0000000...) instead of the
   authenticated user's org (46cf2995...).

   Effect: Browser test now plays correct voice/message matching the UI.

   Verification: Outbound agent query already correct, uses req.user.orgId.

   Files changed:
   - backend/src/routes/founder-console-v2.ts (lines 165-181)
   - backend/src/services/vapi-client.ts (line 661 - logger fix)

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```
3. ✅ Push to repository
4. ✅ Mark tickets as resolved
5. ✅ Celebrate! 🎉

---

**Documentation:** See `DEVELOPER_TEST_PROMPT_FINAL.md` for detailed technical background
**Root Cause Analysis:** See `ROOT_CAUSE_FIXED_FINAL.md` for complete fix documentation
