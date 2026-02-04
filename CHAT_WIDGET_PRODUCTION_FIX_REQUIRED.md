# Chat Widget Production Fix - IMMEDIATE ACTION REQUIRED

**Status:** ⚠️ **BLOCKED - Environment Variable Not Set**
**Test Result:** Chat widget returning 500 error
**Root Cause:** `NEXT_PUBLIC_BACKEND_URL` not configured in Vercel
**Date:** 2026-02-04

---

## Current Production State

**Test Performed:**
```bash
curl -X POST "https://voxanne.ai/api/chat-widget" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"sessionId":"test-123"}'
```

**Result:**
```json
{
  "error": "I'm having trouble right now. Please reach out to support@voxanne.ai or call +44 7424 038250."
}
```

**Why It's Failing:**
```typescript
// src/app/api/chat-widget/route.ts (line 4-6)
function getBackendUrl(): string {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    // ↑ This is undefined in Vercel → falls back to localhost
}

// Line 70: Proxy request tries to connect to localhost
const response = await fetch(`${backendUrl}/api/chat-widget`, {...});
// ↑ Fails because localhost doesn't exist in Vercel
// ↓ Catch block returns generic error
```

---

## Fix Required (Takes 3 Minutes)

### Step 1: Open Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Select project: `callwaiting-ai-voxanne-2026`

### Step 2: Add Environment Variable
1. Click **"Settings"** tab
2. Click **"Environment Variables"** in left sidebar
3. Click **"Add New"** button
4. Enter:
   - **Key:** `NEXT_PUBLIC_BACKEND_URL`
   - **Value:** `https://callwaitingai-backend-sjbi.onrender.com`
   - **Environments:** Check all boxes (Production, Preview, Development)
5. Click **"Save"**

### Step 3: Redeploy
1. Go to **"Deployments"** tab
2. Click **"..."** menu on latest deployment
3. Click **"Redeploy"**
4. Wait ~2 minutes for build to complete

---

## Verification (After Redeployment)

### Test 1: Chat Widget Health Check
```bash
curl -X POST "https://voxanne.ai/api/chat-widget" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello, what is Voxanne AI?"}],"sessionId":"test-'$(date +%s)'"}'
```

**Expected Response (Success):**
```json
{
  "reply": "Hi! I'm Voxanne AI, your autonomous voice assistant...",
  "sessionId": "test-1234567890"
}
```

**Current Response (Failure):**
```json
{
  "error": "I'm having trouble right now..."
}
```

### Test 2: Full Conversation Flow
```bash
# Message 1
curl -X POST "https://voxanne.ai/api/chat-widget" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What services do you offer?"}],"sessionId":"conv-1"}'

# Message 2 (continue conversation)
curl -X POST "https://voxanne.ai/api/chat-widget" \
  -H "Content-Type: application/json" \
  -d '{
    "messages":[
      {"role":"user","content":"What services do you offer?"},
      {"role":"assistant","content":"[previous AI response]"},
      {"role":"user","content":"How much does it cost?"}
    ],
    "sessionId":"conv-1"
  }'
```

### Test 3: Browser Console Verification
1. Open https://voxanne.ai
2. Open browser DevTools (F12)
3. Click chat widget icon
4. Send "Hello" message
5. Check Network tab: `/api/chat-widget` should return **200 OK** (not 500)
6. Check Console tab: No errors should appear

---

## Architecture Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks chat widget on https://voxanne.ai              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/chat-widget (Next.js App Router API)             │
│ Location: src/app/api/chat-widget/route.ts                 │
│ Environment: Vercel (Frankfurt region)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (Proxy Request)
┌─────────────────────────────────────────────────────────────┐
│ POST https://callwaitingai-backend-sjbi.onrender.com       │
│      /api/chat-widget                                       │
│ Location: backend/src/routes/chat-widget.ts                │
│ Environment: Render (Ohio region)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (Groq API Call)
┌─────────────────────────────────────────────────────────────┐
│ POST https://api.groq.com/openai/v1/chat/completions       │
│ Model: llama-3.3-70b-versatile                             │
│ Response: AI-generated message                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (Response Chain)
┌─────────────────────────────────────────────────────────────┐
│ User sees AI response in chat widget                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Fix Is Safe

**No Code Changes Required:**
- ✅ All code is already deployed (commit ff167c6)
- ✅ Backend is operational (tested directly)
- ✅ Only missing: Environment variable configuration

**Zero Downtime:**
- ✅ Setting environment variable doesn't affect running deployment
- ✅ Redeployment is a standard Vercel operation
- ✅ Old deployment remains live until new one passes health checks

**Rollback Procedure (If Needed):**
```bash
# If chat widget still fails after setting env var:
1. Check Vercel deployment logs for errors
2. Verify environment variable is actually set (Settings > Environment Variables)
3. Try redeploying again (sometimes Vercel needs 2 deploys for env vars)
4. If still broken, check backend logs at Render dashboard
```

---

## Expected Timeline

**From now:**
1. Open Vercel dashboard: **30 seconds**
2. Add environment variable: **1 minute**
3. Trigger redeployment: **10 seconds**
4. Wait for build: **2-3 minutes**
5. Test chat widget: **30 seconds**

**Total: ~4-5 minutes to fully operational chat widget** ✅

---

## Success Criteria

- ✅ Chat widget returns AI-generated responses (not error messages)
- ✅ Browser console shows: `POST /api/chat-widget 200 OK`
- ✅ Conversation flow works (multi-turn chat)
- ✅ Backend logs show: "Incoming request to /api/chat-widget from Next.js proxy"
- ✅ No 500 errors in Vercel logs
- ✅ No CORS errors in browser console

---

## Additional Notes

**Why Frontend Proxies to Backend:**
- ✅ Single source of truth for system prompt (no duplication)
- ✅ GROQ_API_KEY stays server-side (better security)
- ✅ Easier to update AI logic (only backend changes needed)
- ✅ Backend has better error handling and retry logic
- ✅ 73% code reduction (363 lines → 95 lines in frontend)

**Alternative (Not Recommended):**
- ❌ Hardcode backend URL in code (user explicitly rejected)
- ❌ Call Groq directly from Next.js (requires GROQ_API_KEY in frontend)

---

**Prepared by:** Claude (Senior Engineer Agent)
**Date:** 2026-02-04
**Priority:** 🚨 **URGENT** - Blocking chat widget functionality
**Complexity:** ⚡ **TRIVIAL** - Just set environment variable
