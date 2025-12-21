# RENDER ENVIRONMENT SETUP - CRITICAL ACTIONS
## Required Manual Configuration in Render Dashboard

**Status:** Awaiting manual configuration
**Priority:** 🔴 CRITICAL - Must be done before deployment

---

## ACTION 1: Set NODE_ENV (Critical Security Fix)

**Location:** Render Dashboard → Voxanne Backend Service → Environment Variables

**Current Status:** ❌ Likely not set (defaults to 'development')
**Required:** ✅ Set to `production`

**Step-by-Step:**
1. Go to Render.com dashboard
2. Select "Voxanne Backend" service
3. Click "Environment" tab
4. Find `NODE_ENV` variable
5. Change value from (empty or 'development') to `production`
6. Click "Save Changes"
7. Render will auto-redeploy

**Verification:**
```bash
curl https://voxanne-backend.onrender.com/health
# Should respond with 200 OK and database: true
```

---

## ACTION 2: Verify OpenAI API Key

**Location:** Render Dashboard → Voxanne Backend Service → Environment Variables

**Current Status:** ❌ Need to verify it's set
**Required:** ✅ OPENAI_API_KEY must be present

**Step-by-Step:**
1. Go to Render.com dashboard
2. Select "Voxanne Backend" service
3. Click "Environment" tab
4. Look for `OPENAI_API_KEY`
5. If missing, add it with your OpenAI API key
6. Click "Save Changes"

**Verification:**
```bash
# After deployment, KB should work
# Try uploading a document to knowledge base
```

---

## ACTION 3: Disable Dev WebSocket Bypass

**Location:** Render Dashboard → Voxanne Backend Service → Environment Variables

**Current Status:** ❌ May be set to 'true'
**Required:** ✅ Remove or set to 'false'

**Step-by-Step:**
1. Go to Render.com dashboard
2. Select "Voxanne Backend" service
3. Click "Environment" tab
4. Find `ALLOW_DEV_WS_BYPASS`
5. Delete the variable OR change value to `false`
6. Click "Save Changes"

---

## ACTION 4: Setup Sentry (Recommended)

**Location:** Sentry.io (create account) → Render Dashboard

**Step-by-Step:**

### Part A: Create Sentry Account
1. Go to sentry.io
2. Sign up (free tier available)
3. Create project: "Voxanne Backend"
4. Select platform: Node.js
5. Copy DSN (looks like: `https://xxx@yyyy.ingest.sentry.io/zzz`)

### Part B: Add to Render
1. Go to Render.com dashboard
2. Select "Voxanne Backend" service
3. Click "Environment" tab
4. Add variable: `SENTRY_DSN` = (paste DSN from Sentry)
5. Click "Save Changes"
6. Render will auto-redeploy

**Verification:**
```bash
# After deployment, errors should appear in Sentry dashboard
# Visit sentry.io → Voxanne Backend project → Events
```

---

## ENVIRONMENT VARIABLES CHECKLIST

Before deploying, ensure these are set in Render:

- [ ] `NODE_ENV` = `production` (CRITICAL)
- [ ] `OPENAI_API_KEY` = (your key)
- [ ] `SUPABASE_URL` = (existing)
- [ ] `SUPABASE_SERVICE_KEY` = (existing)
- [ ] `VAPI_API_KEY` = (existing)
- [ ] `TWILIO_ACCOUNT_SID` = (existing)
- [ ] `TWILIO_AUTH_TOKEN` = (existing)
- [ ] `SENTRY_DSN` = (from sentry.io) [RECOMMENDED]
- [ ] `ALLOW_DEV_WS_BYPASS` = removed or 'false'

---

## DEPLOYMENT STEPS

**Once above is configured:**

1. All code fixes are committed to main branch
2. Push to GitHub
3. Render auto-deploys (monitor deployment logs)
4. Verify deployment: `curl https://voxanne-backend.onrender.com/health`
5. Expected response:
```json
{
  "status": "ok",
  "services": {
    "database": true,
    "supabase": true,
    "backgroundJobs": true
  },
  "timestamp": "2025-12-20T...",
  "uptime": 123.456
}
```

---

## TESTING AFTER DEPLOYMENT

### Test 1: Auth Bypass is Fixed
```bash
# This should return 401 (not 200)
curl -H "Authorization: Bearer invalid-token-xyz" \
  https://voxanne-backend.onrender.com/api/calls
# Expected: 401 Unauthorized ✅
# NOT expected: 200 OK ❌
```

### Test 2: Health Check Works
```bash
curl https://voxanne-backend.onrender.com/health
# Expected: 200 OK with database: true ✅
```

### Test 3: Valid Token Works
```bash
# Use a real JWT token from Supabase Auth
curl -H "Authorization: Bearer <REAL_JWT_TOKEN>" \
  https://voxanne-backend.onrender.com/api/calls
# Expected: 200 OK (or auth error if org not found) ✅
```

---

## CRITICAL NOTES

⚠️ **IMPORTANT:** Changes take effect on Render re-deployment
- If you add/update environment variables, Render will auto-deploy
- Wait 2-3 minutes for deployment to complete
- Check "Deployments" tab in Render dashboard for status
- Monitor logs for any errors during startup

⚠️ **NODE_ENV is the most critical variable**
- Changing from 'development' to 'production' ENABLES security fixes
- Without this, auth bypass vulnerabilities remain active
- This is a MUST-DO before taking customers

⚠️ **Sentry is optional but recommended**
- Without it, you won't see errors in production
- Free tier allows 5,000 events/month (plenty for MVP)
- Can be added anytime, doesn't require code changes

---

## WHO NEEDS TO DO THIS?

**This requires someone with access to Render dashboard:**
- CTO
- DevOps engineer
- Someone with render.com account admin access

**Estimated time:** 5-10 minutes

---

## WHAT HAPPENS WHEN DEPLOYED?

After these changes are deployed to production:

✅ **Security:**
- Auth cannot be bypassed with invalid tokens
- Dev mode completely disabled in production
- WebSocket requires valid JWT

✅ **Reliability:**
- Health check verifies database connectivity
- Sentry captures all errors in real-time
- Health check returns 503 if database is down

✅ **Stability:**
- Errors are logged and monitored
- Database issues are detected immediately
- Background jobs are verified

---

**Status:** Waiting for manual Render configuration
**Next Step:** Execute the 4 actions above, then redeploy
**Timeline:** ~5 minutes to configure, ~2 minutes to deploy

🔥
