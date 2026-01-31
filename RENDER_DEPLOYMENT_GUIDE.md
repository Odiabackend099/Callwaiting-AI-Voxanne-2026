# Render Backend Deployment Guide

**Date:** 2026-01-31
**Project:** Voxanne AI Backend
**Repository:** https://github.com/Odiabackend099/Callwaiting-AI-Voxanne-2026

---

## Part 1: Create Render Backend Service

### Step 1: Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect account"** → Select **GitHub**
4. Authorize Render to access your GitHub repositories
5. Select repository: **`Callwaiting-AI-Voxanne-2026`**

### Step 2: Configure Service Settings

**Basic Settings:**
- **Name**: `voxanne-backend`
- **Region**: `Oregon (US West)` or `Ohio (US East)` *(choose closest to your Supabase region)*
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`

**Advanced Settings:**
- **Health Check Path**: `/health`
- **Plan**: `Starter` ($7/month) or `Standard` ($25/month)
- **Auto-Deploy**: ✅ **Enabled** (deploys on git push)

**⚠️ IMPORTANT**: Click **"Advanced"** and set these **BEFORE** clicking "Create Web Service"

---

## Part 2: Environment Variables Configuration

### Critical Environment Variables (Set in Render Dashboard)

Navigate to: **Service → Environment → Add Environment Variable**

```bash
# ═══════════════════════════════════════════════════════════
# CORE SETTINGS (REQUIRED)
# ═══════════════════════════════════════════════════════════

NODE_ENV=production
PORT=3001

# ═══════════════════════════════════════════════════════════
# SUPABASE DATABASE (REQUIRED)
# ═══════════════════════════════════════════════════════════
# Get these from: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/settings/api

SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co

SUPABASE_SERVICE_ROLE_KEY=<PASTE YOUR SUPABASE SERVICE ROLE KEY>
# ⚠️ CRITICAL: This key bypasses RLS. Get from Supabase Dashboard → Settings → API → service_role key

SUPABASE_ANON_KEY=<PASTE YOUR SUPABASE ANON KEY>
# Get from Supabase Dashboard → Settings → API → anon public key

# ═══════════════════════════════════════════════════════════
# VAPI VOICE AI (REQUIRED)
# ═══════════════════════════════════════════════════════════
# Get from: https://dashboard.vapi.ai/settings/api-keys

VAPI_PRIVATE_KEY=<PASTE YOUR VAPI PRIVATE KEY>
# ⚠️ CRITICAL: Master API key for all Vapi operations. NEVER expose to frontend.

# ═══════════════════════════════════════════════════════════
# ENCRYPTION (REQUIRED)
# ═══════════════════════════════════════════════════════════
# Generate with: openssl rand -hex 32 (must be exactly 64 hex characters)

ENCRYPTION_KEY=<PASTE YOUR 64-CHARACTER HEX STRING>
# ⚠️ CRITICAL: Used to encrypt tenant credentials in database. NEVER change after production.

# ═══════════════════════════════════════════════════════════
# GOOGLE OAUTH (REQUIRED FOR CALENDAR INTEGRATION)
# ═══════════════════════════════════════════════════════════
# Get from: https://console.cloud.google.com/apis/credentials

GOOGLE_CLIENT_ID=<PASTE YOUR GOOGLE CLIENT ID>
# Format: xxxxx.apps.googleusercontent.com

GOOGLE_CLIENT_SECRET=<PASTE YOUR GOOGLE CLIENT SECRET>

# ⚠️ UPDATE AFTER CUSTOM DOMAIN CONFIGURED
GOOGLE_REDIRECT_URI=https://voxanne-backend.onrender.com/api/auth/google/callback
# Will update to: https://api.voxanne.ai/api/auth/google/callback after custom domain setup

# ═══════════════════════════════════════════════════════════
# APPLICATION URLS
# ═══════════════════════════════════════════════════════════

# ⚠️ UPDATE AFTER CUSTOM DOMAIN CONFIGURED
BACKEND_URL=https://voxanne-backend.onrender.com
# Will update to: https://api.voxanne.ai

FRONTEND_URL=https://voxanne.ai
# Vercel deployment URL (already configured)

CORS_ORIGIN=https://voxanne.ai
# Restrict CORS to production domain only

# ═══════════════════════════════════════════════════════════
# REDIS (REQUIRED FOR WEBHOOK QUEUE)
# ═══════════════════════════════════════════════════════════

REDIS_URL=<WILL BE AUTO-POPULATED AFTER REDIS SETUP>
# Leave empty for now - will add after creating Redis instance in Step 3

# ═══════════════════════════════════════════════════════════
# OPTIONAL: MONITORING & ALERTS
# ═══════════════════════════════════════════════════════════

# Sentry (Error Tracking)
SENTRY_DSN=<OPTIONAL - from https://sentry.io>

# Slack (Alerts)
SLACK_WEBHOOK_URL=<OPTIONAL - from Slack workspace integrations>

# ═══════════════════════════════════════════════════════════
# OPTIONAL: TWILIO (FALLBACK CREDENTIALS)
# ═══════════════════════════════════════════════════════════
# Note: Most orgs provide their own Twilio credentials via database
# These are fallback credentials only for testing

# TWILIO_ACCOUNT_SID=<OPTIONAL>
# TWILIO_AUTH_TOKEN=<OPTIONAL>

# ═══════════════════════════════════════════════════════════
# OPTIONAL: JWT SECRET
# ═══════════════════════════════════════════════════════════
# JWT_SECRET=<OPTIONAL - generate with: openssl rand -hex 32>
```

### How to Add Environment Variables in Render

1. Go to **Service → Environment** tab
2. Click **"Add Environment Variable"**
3. For each variable:
   - **Key**: Variable name (e.g., `SUPABASE_URL`)
   - **Value**: Paste the actual value
4. Click **"Save Changes"**

**⚠️ DO NOT DEPLOY YET** - Set up Redis first (Step 3)

---

## Part 3: Create Render Redis Instance

### Why Redis is Required
- **Webhook Queue**: BullMQ processes Vapi webhooks asynchronously
- **Caching Layer**: Improves performance (80%+ cache hit rate)
- **Rate Limiting**: Distributed rate limit counters

### Create Redis Service

1. In Render Dashboard, click **"New +"** → **"Redis"**
2. **Name**: `voxanne-redis`
3. **Region**: `Same as backend` (e.g., Oregon)
4. **Plan**: `Starter` (256MB - $10/month)
5. **Max Memory Policy**: `allkeys-lru` (recommended)
6. Click **"Create Redis"**

### Link Redis to Backend

After Redis is created:

1. Go to **voxanne-redis** → **"Connect"** tab
2. Copy the **Internal Redis URL** (starts with `redis://`)
3. Go back to **voxanne-backend** → **"Environment"** tab
4. Update `REDIS_URL` variable with the copied URL
5. Click **"Save Changes"**

**✅ NOW YOU CAN DEPLOY**

---

## Part 4: Initial Deployment

### Deploy Backend Service

1. After all environment variables are set (including `REDIS_URL`)
2. Render will **automatically trigger a deployment**
3. Monitor deployment progress in the **"Logs"** tab
4. Wait for: `✅ Deployment successful` (typically 3-5 minutes)

### Verify Deployment

Once deployed, test the health endpoint:

```bash
# Replace with your actual Render URL
curl https://voxanne-backend.onrender.com/health

# Expected response:
{"status":"ok","timestamp":"2026-01-31T...","environment":"production"}
```

If you see the above response, **backend deployment is successful!** ✅

---

## Part 5: Custom Domain Setup (api.voxanne.ai)

### Step 1: Add Custom Domain in Render

1. Go to **voxanne-backend** → **"Settings"** → **"Custom Domains"**
2. Click **"Add Custom Domain"**
3. Enter: `api.voxanne.ai`
4. Click **"Add"**
5. **Copy the CNAME value** shown (e.g., `voxanne-backend.onrender.com`)

### Step 2: Configure DNS in Vercel

**⚠️ YOU WILL DO THIS STEP** (you have Vercel DNS access)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Domains** → **voxanne.ai** → **DNS Records**
3. Click **"Add Record"**
4. Configure:
   - **Type**: `CNAME`
   - **Name**: `api`
   - **Value**: `voxanne-backend.onrender.com` (from Render)
   - **TTL**: `Auto`
5. Click **"Save"**

### Step 3: Wait for DNS Propagation

- **Time**: 5-30 minutes
- **Verify**: Use https://dnschecker.org → Enter `api.voxanne.ai`
- **Check HTTPS**: Once propagated, Render auto-issues SSL certificate

### Step 4: Verify Custom Domain

```bash
# Test custom domain health endpoint
curl https://api.voxanne.ai/health

# Expected: Same response as before
{"status":"ok","timestamp":"...","environment":"production"}
```

**✅ If successful, custom domain is live!**

### Step 5: Update Environment Variables to Use Custom Domain

After custom domain is verified:

1. Go to **voxanne-backend** → **"Environment"** tab
2. Update these variables:
   ```bash
   BACKEND_URL=https://api.voxanne.ai
   GOOGLE_REDIRECT_URI=https://api.voxanne.ai/api/auth/google/callback
   ```
3. Click **"Save Changes"**
4. Render will **redeploy automatically** (1-2 minutes)

---

## Part 6: Post-Deployment Configuration

### 6.1 Update Vapi Webhook URLs

**Why**: Vapi needs to send webhook events (call.started, call.ended, etc.) to your backend

**Steps**:
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai/)
2. Navigate to **Assistants** → Select your assistant
3. Update **Server URL**:
   - **Primary**: `https://api.voxanne.ai/api/webhooks/vapi`
   - **Fallback**: `https://voxanne-backend.onrender.com/api/webhooks/vapi`
4. Ensure these webhook events are enabled:
   - ✅ `call.started`
   - ✅ `call.ended`
   - ✅ `message.sent`
   - ✅ `transcript.received`
5. Click **"Save"**

### 6.2 Update Google OAuth Redirect URIs

**Why**: Google needs to whitelist your backend URL for OAuth callbacks

**Steps**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your **OAuth 2.0 Client ID**
3. Under **"Authorized redirect URIs"**, add:
   - `https://api.voxanne.ai/api/auth/google/callback`
   - `https://voxanne.ai/auth/callback` (if frontend OAuth flow exists)
4. Click **"Save"**

### 6.3 Update Supabase Auth Redirect URLs

**Why**: Supabase Auth needs to allow redirects to your production domain

**Steps**:
1. Go to [Supabase Dashboard](https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/auth/url-configuration)
2. Update **Site URL**: `https://voxanne.ai`
3. Add to **Redirect URLs**:
   - `https://voxanne.ai/**`
   - `https://www.voxanne.ai/**`
   - `https://api.voxanne.ai/api/auth/callback`
4. Click **"Save"**

### 6.4 Update Twilio Webhooks (If Applicable)

**Why**: Twilio needs to send SMS/voice webhooks to your backend

**Steps** (only if you use Twilio directly):
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → Select your number
3. Update webhooks:
   - **Voice → A Call Comes In**: `https://api.voxanne.ai/api/twilio/voice`
   - **Messaging → A Message Comes In**: `https://api.voxanne.ai/api/twilio/sms`
4. Click **"Save"**

---

## Part 7: Testing & Verification

### 7.1 Backend Health Checks

```bash
# Test health endpoint
curl https://api.voxanne.ai/health
# Expected: {"status":"ok","timestamp":"..."}

# Test Vapi webhook endpoint (should reject without valid signature)
curl -X POST https://api.voxanne.ai/api/webhooks/vapi
# Expected: 401 Unauthorized or 403 Forbidden

# Check CORS (should block unauthorized origins)
curl -H "Origin: https://evil.com" https://api.voxanne.ai/health
# Expected: CORS error or no Access-Control-Allow-Origin header
```

### 7.2 Check Render Logs

1. Go to **voxanne-backend** → **"Logs"** tab
2. Look for:
   - ✅ `Server listening on port 3001`
   - ✅ `Redis connected successfully`
   - ✅ `Supabase connection established`
   - ❌ **No ERROR or WARN messages**

### 7.3 Monitor Redis Connection

In Render logs, verify:
```
✅ Redis connected: redis://voxanne-redis-xxxxxx.onrender.com:6379
✅ BullMQ webhook queue initialized
✅ Cache service ready (80%+ hit rate expected after warmup)
```

### 7.4 Test Rate Limiting

```bash
# Rapid-fire requests (should hit rate limit after ~100 requests)
for i in {1..150}; do
  curl -s https://api.voxanne.ai/health > /dev/null
done

# Check response (should see 429 after hitting limit)
curl -I https://api.voxanne.ai/health
# Expected: HTTP/1.1 429 Too Many Requests (after exceeding limit)
```

---

## Part 8: Security Checklist

Before going live, verify:

- [ ] All environment variables set correctly (no `<PASTE...>` placeholders)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **SERVICE ROLE key**, not anon key
- [ ] `VAPI_PRIVATE_KEY` is **PRIVATE key**, not public key
- [ ] `ENCRYPTION_KEY` is exactly **64 hex characters** (not 32 or 128)
- [ ] `CORS_ORIGIN` is set to `https://voxanne.ai` (not `*`)
- [ ] HTTPS enforced everywhere (no HTTP URLs in configs)
- [ ] Custom domain `api.voxanne.ai` resolves correctly
- [ ] SSL certificate auto-issued by Render (check browser padlock)
- [ ] Webhook URLs updated in Vapi Dashboard
- [ ] Google OAuth redirect URIs whitelisted
- [ ] Supabase Auth redirect URLs configured
- [ ] Rate limiting active and tested
- [ ] Redis connected and operational
- [ ] No critical errors in Render logs (last 24 hours)

---

## Part 9: Performance Baselines

After deployment, monitor these metrics (first 7 days):

| Metric | Target | How to Check |
|--------|--------|-------------|
| **Uptime** | 99.9%+ | Render Dashboard → Metrics |
| **API Response Time** | P95 < 500ms | Render Logs or Sentry |
| **Error Rate** | < 0.1% | Sentry Dashboard |
| **Cache Hit Rate** | > 80% | Redis logs or monitoring endpoint |
| **Database Queries** | < 1 second | Supabase Dashboard → Database |
| **Memory Usage** | < 80% | Render Dashboard → Metrics |
| **CPU Usage** | < 70% | Render Dashboard → Metrics |

---

## Part 10: Rollback Procedure (If Needed)

If deployment fails or critical bug found:

### Immediate Rollback

1. Go to **voxanne-backend** → **"Events"** tab
2. Find the last successful deployment
3. Click **"Rollback to this version"**
4. Confirm rollback
5. Monitor logs for successful startup

### Emergency Maintenance Mode

Add environment variable:
```bash
MAINTENANCE_MODE=true
```

Backend will return HTTP 503 with maintenance message.

---

## Part 11: Cost Estimate

| Service | Plan | Cost |
|---------|------|------|
| Render Backend | Starter | $7/month |
| Render Redis | Starter (256MB) | $10/month |
| Vercel Frontend | Free (or Pro $20/month) | $0-20/month |
| Supabase Database | Pro | $25/month |
| **Total** | | **$42-62/month** |

**Note**: Render offers free tier for small projects, but production apps should use paid plans for better reliability and no sleep.

---

## Part 12: Next Steps After Deployment

### Week 1: Monitoring
- [ ] Check Render logs daily for errors
- [ ] Monitor error rates in Sentry (if configured)
- [ ] Test all critical user flows (signup, login, agent config, test call)
- [ ] Gather user feedback on performance

### Week 2: Optimization
- [ ] Review slow API endpoints (optimize if P95 > 500ms)
- [ ] Analyze cache hit rates (improve caching strategy if < 80%)
- [ ] Set up automated alerts for downtime (UptimeRobot or Pingdom)
- [ ] Create runbook for common incidents

### Month 1: Scaling
- [ ] Review and optimize database queries (EXPLAIN ANALYZE)
- [ ] Consider upgrading Render plan if CPU/memory > 80%
- [ ] Implement automated backups (Supabase already handles this)
- [ ] Schedule disaster recovery drill
- [ ] Plan feature releases using feature flags

---

## Support & Troubleshooting

### Common Issues

**Issue**: `ECONNREFUSED` errors in logs
- **Cause**: Redis URL not set or incorrect
- **Fix**: Verify `REDIS_URL` in environment variables

**Issue**: `CORS policy` errors from frontend
- **Cause**: `CORS_ORIGIN` not set correctly
- **Fix**: Set `CORS_ORIGIN=https://voxanne.ai`

**Issue**: `Unauthorized` errors on API calls
- **Cause**: Frontend using wrong `NEXT_PUBLIC_BACKEND_URL`
- **Fix**: Update Vercel env vars to point to `https://api.voxanne.ai`

**Issue**: Deployment fails during build
- **Cause**: Missing dependencies or TypeScript errors
- **Fix**: Check Render logs for specific error, fix in code, push to GitHub

**Issue**: Health endpoint returns 404
- **Cause**: Backend not started or crashed
- **Fix**: Check Render logs for startup errors, verify `npm run start` works locally

---

## Documentation Links

- **Render Docs**: https://render.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vapi API Reference**: https://docs.vapi.ai
- **Google OAuth Setup**: https://developers.google.com/identity/protocols/oauth2
- **Deployment Plan**: `/Users/mac/.claude/plans/serene-finding-harbor.md`

---

## Completion Checklist

Mark each step as complete:

- [ ] Part 1: Render backend service created
- [ ] Part 2: All environment variables configured
- [ ] Part 3: Redis instance created and linked
- [ ] Part 4: Initial deployment successful (health endpoint returns 200)
- [ ] Part 5: Custom domain `api.voxanne.ai` configured and verified
- [ ] Part 6: Vapi webhooks, Google OAuth, Supabase redirects updated
- [ ] Part 7: All tests passed (health, CORS, rate limiting)
- [ ] Part 8: Security checklist completed
- [ ] Part 9: Performance baselines documented
- [ ] Part 10: Rollback procedure tested (optional but recommended)

---

**✅ Deployment Complete! Your Voxanne AI backend is production-ready.**

**Next**: Test end-to-end user flows and monitor for 24-48 hours before announcing to users.
