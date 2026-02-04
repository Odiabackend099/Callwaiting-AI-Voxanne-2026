# Vercel Environment Variable Setup - URGENT

**Issue:** Chat widget still getting 500 error
**Root Cause:** `NEXT_PUBLIC_BACKEND_URL` not configured in Vercel
**Status:** ⚠️ **ACTION REQUIRED**

---

## The Problem

Our proxy code is deployed, but it doesn't know where to send requests:

```typescript
// src/app/api/chat-widget/route.ts (line 4-6)
function getBackendUrl(): string {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    // ↑ This is undefined in Vercel, falls back to localhost (doesn't work in production)
}
```

**Current behavior:**
```
Frontend → Next.js API → http://localhost:3001 ✗ (doesn't exist in Vercel)
                                ↓
                           500 error
```

**Expected behavior:**
```
Frontend → Next.js API → https://callwaitingai-backend-sjbi.onrender.com ✓
                                ↓
                           Backend → Groq → Success
```

---

## The Solution

### Option 1: Set via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project: `callwaiting-ai-voxanne-2026` (or similar)

2. **Navigate to Settings:**
   - Click "Settings" tab
   - Click "Environment Variables" in left sidebar

3. **Add Variable:**
   - **Key:** `NEXT_PUBLIC_BACKEND_URL`
   - **Value:** `https://callwaitingai-backend-sjbi.onrender.com`
   - **Environments:** Check all: Production, Preview, Development
   - Click "Save"

4. **Redeploy:**
   - Go to "Deployments" tab
   - Click "..." menu on latest deployment
   - Click "Redeploy"
   - Wait ~2 minutes for build

---

### Option 2: Set via Vercel CLI (Alternative)

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variable
vercel env add NEXT_PUBLIC_BACKEND_URL production
# When prompted, paste: https://callwaitingai-backend-sjbi.onrender.com

# Also set for preview and development
vercel env add NEXT_PUBLIC_BACKEND_URL preview
vercel env add NEXT_PUBLIC_BACKEND_URL development

# Trigger redeployment
vercel --prod
```

---

## Verification

After redeployment completes (~2-3 minutes):

### Test 1: Check Environment Variable
```bash
# Open browser console on https://voxanne.ai
console.log(process.env.NEXT_PUBLIC_BACKEND_URL)
# Should show: undefined (client-side doesn't see it, but server-side does)

# Check in Next.js server logs (Vercel dashboard → Functions → Logs)
# Should show requests to: https://callwaitingai-backend-sjbi.onrender.com/api/chat-widget
```

### Test 2: Chat Widget
1. Open https://voxanne.ai
2. Click chat widget
3. Send "Hello"
4. **Expected:** AI responds (not 500 error)
5. **Verify:** Browser console shows 200 OK

---

## Why This Happened

**Local development:**
- Uses `.env.local` file → `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` ✓

**Vercel production:**
- `.env.local` not committed to git (in .gitignore) ✓ (correct for security)
- `.env.production` exists but Vercel doesn't read it automatically
- Must set environment variables in Vercel dashboard

---

## Quick Check: Is Variable Set?

**Vercel Dashboard → Settings → Environment Variables:**

If you see `NEXT_PUBLIC_BACKEND_URL` listed:
- ✅ **Good** - Just redeploy
- ❌ **Missing** - Add it now (see Option 1 above)

---

## Alternative: Hardcode Backend URL (Not Recommended)

If you can't access Vercel dashboard right now, you can temporarily hardcode:

```typescript
// src/app/api/chat-widget/route.ts
function getBackendUrl(): string {
    // Temporary hardcode (replace with env var later)
    if (process.env.NODE_ENV === 'production') {
        return 'https://callwaitingai-backend-sjbi.onrender.com';
    }
    return 'http://localhost:3001';
}
```

Then:
```bash
git add src/app/api/chat-widget/route.ts
git commit -m "temp: hardcode backend URL for production"
git push origin main
# Vercel auto-deploys in ~2 minutes
```

**But this is a temporary workaround!** Still set the env var properly.

---

## Expected Timeline

**Option 1 (Vercel Dashboard):**
1. Set environment variable: 1 minute
2. Trigger redeploy: 1 click
3. Build completes: ~2 minutes
4. Test chat widget: 30 seconds
**Total: ~3-4 minutes**

**Option 2 (Hardcode):**
1. Edit file: 1 minute
2. Commit and push: 30 seconds
3. Vercel auto-deploy: ~2 minutes
4. Test chat widget: 30 seconds
**Total: ~4 minutes**

---

## Success Criteria

- ✅ Chat widget responds with AI messages (not errors)
- ✅ Browser console shows: `POST /api/chat-widget 200 OK`
- ✅ Vercel logs show requests to backend URL
- ✅ Backend logs show incoming requests from Next.js proxy

---

**Status after fix:** Chat widget fully operational ✅

---

**Prepared by:** Claude (Senior Engineer Agent)
**Date:** 2026-02-04
**Priority:** 🚨 **URGENT** - Blocks chat widget functionality
