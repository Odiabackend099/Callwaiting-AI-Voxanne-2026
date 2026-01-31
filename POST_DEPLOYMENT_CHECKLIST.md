# Post-Deployment Configuration Checklist

**Date:** 2026-01-31
**Project:** Voxanne AI Production Deployment
**Domain:** voxanne.ai

---

## Quick Reference URLs

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | https://voxanne.ai | ✅ Deployed to Vercel |
| **Backend API** | https://api.voxanne.ai | ⏳ Deploying to Render |
| **Supabase Dashboard** | https://app.supabase.com/project/lbjymlodxprzqgtyqtcq | ✅ Active |
| **Vapi Dashboard** | https://dashboard.vapi.ai | ✅ Active |
| **Render Dashboard** | https://dashboard.render.com | ⏳ Setup in progress |
| **Vercel Dashboard** | https://vercel.com/dashboard | ✅ Deployed |

---

## Phase 1: Vercel Frontend (✅ IN PROGRESS)

### Deployment Status
- ✅ Code pushed to GitHub
- ✅ Domain configuration updated (callwaitingai.dev → voxanne.ai)
- ⏳ Vercel deployment running (check status below)

### Verify Vercel Deployment

```bash
# Check deployment status
vercel ls voxanne-ai-frontend --token aF8XCJ7H06Xr6gA7lcfXJ4Az

# Once deployed, test frontend
curl -I https://voxanne.ai
# Expected: HTTP/2 200 OK

# Test that www redirects to apex domain
curl -I https://www.voxanne.ai
# Expected: HTTP/2 301 or 308 (redirect to https://voxanne.ai)
```

### Environment Variables Set in Vercel

✅ **Already Configured** (via Vercel Dashboard):
- `NODE_ENV=production`
- `NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
- `NEXT_PUBLIC_BACKEND_URL=https://api.voxanne.ai` *(update after Render deployment)*
- `NEXT_PUBLIC_APP_URL=https://voxanne.ai`

**⚠️ ACTION REQUIRED**: After Render backend is live, verify `NEXT_PUBLIC_BACKEND_URL` points to `https://api.voxanne.ai`

---

## Phase 2: Render Backend (⏳ YOUR ACTION REQUIRED)

### Follow the Comprehensive Guide

📖 **See:** `RENDER_DEPLOYMENT_GUIDE.md` (just created)

### Quick Setup Checklist

- [ ] **Create Render Web Service**
  - Name: `voxanne-backend`
  - Region: Oregon or Ohio
  - Root Directory: `backend`
  - Build: `npm install && npm run build`
  - Start: `npm run start`

- [ ] **Configure Environment Variables** (20+ variables)
  - See RENDER_DEPLOYMENT_GUIDE.md Part 2 for complete list
  - ⚠️ Critical: `SUPABASE_SERVICE_ROLE_KEY`, `VAPI_PRIVATE_KEY`, `ENCRYPTION_KEY`

- [ ] **Create Redis Instance**
  - Name: `voxanne-redis`
  - Plan: Starter (256MB)
  - Link to backend via `REDIS_URL`

- [ ] **Initial Deployment**
  - Wait for: `✅ Deployment successful` in Render logs
  - Verify health: `curl https://voxanne-backend.onrender.com/health`

- [ ] **Custom Domain Setup**
  - Add `api.voxanne.ai` in Render
  - Configure CNAME in Vercel DNS (you'll do this)
  - Wait for SSL certificate provisioning (automatic)

- [ ] **Update URLs After Custom Domain**
  - Update `BACKEND_URL=https://api.voxanne.ai`
  - Update `GOOGLE_REDIRECT_URI=https://api.voxanne.ai/api/auth/google/callback`
  - Trigger redeploy

---

## Phase 3: DNS Configuration (⏳ YOUR ACTION)

### Vercel DNS Records to Add

**⚠️ YOU NEED TO ADD THESE IN VERCEL DNS**

Navigate to: **Vercel Dashboard → Domains → voxanne.ai → DNS Records**

| Type | Name | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| A | @ | 76.76.21.21 | Auto | Apex domain (voxanne.ai) → Vercel |
| CNAME | www | cname.vercel-dns.com | Auto | www.voxanne.ai → Vercel |
| CNAME | api | voxanne-backend.onrender.com | Auto | api.voxanne.ai → Render backend |

**Notes**:
- `@` and `www` records may already exist (Vercel auto-configures)
- **You must add**: `api` CNAME record pointing to Render backend
- After adding, wait 5-30 minutes for DNS propagation

### Verify DNS Propagation

```bash
# Check apex domain
dig voxanne.ai
# Expected: A record pointing to 76.76.21.21

# Check www subdomain
dig www.voxanne.ai
# Expected: CNAME record pointing to cname.vercel-dns.com

# Check API subdomain
dig api.voxanne.ai
# Expected: CNAME record pointing to voxanne-backend.onrender.com

# Or use online tool
open https://dnschecker.org
# Enter: api.voxanne.ai and check global propagation
```

---

## Phase 4: External Service Configuration

### 4.1 Vapi Dashboard Updates

**⚠️ ACTION REQUIRED AFTER RENDER DEPLOYMENT**

1. Go to [Vapi Dashboard](https://dashboard.vapi.ai/)
2. Navigate to **Assistants** → Select your assistant
3. Update webhook URLs:
   - **Server URL**: `https://api.voxanne.ai/api/webhooks/vapi`
   - **Server URL (Fallback)**: `https://voxanne-backend.onrender.com/api/webhooks/vapi`
4. Verify webhook events enabled:
   - ✅ `call.started`
   - ✅ `call.ended`
   - ✅ `message.sent`
   - ✅ `transcript.received`
5. Click **"Save"**

### 4.2 Google Cloud Console Updates

**⚠️ ACTION REQUIRED AFTER RENDER DEPLOYMENT**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your **OAuth 2.0 Client ID**
3. Under **"Authorized redirect URIs"**, add:
   - `https://api.voxanne.ai/api/auth/google/callback`
   - `https://voxanne.ai/auth/callback`
4. Remove old development URLs (localhost, ngrok)
5. Click **"Save"**

### 4.3 Supabase Dashboard Updates

**⚠️ ACTION REQUIRED AFTER VERCEL + RENDER DEPLOYMENT**

1. Go to [Supabase Dashboard](https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/auth/url-configuration)
2. Update **Site URL**: `https://voxanne.ai`
3. Under **Redirect URLs**, add:
   - `https://voxanne.ai/**`
   - `https://www.voxanne.ai/**`
   - `https://api.voxanne.ai/api/auth/callback`
4. Remove old development URLs
5. Click **"Save"**

### 4.4 Twilio Console (If Applicable)

**⚠️ OPTIONAL - Only if you use Twilio phone numbers directly**

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → Select number
3. Update webhooks:
   - **Voice → A Call Comes In**: `https://api.voxanne.ai/api/twilio/voice`
   - **Messaging → A Message Comes In**: `https://api.voxanne.ai/api/twilio/sms`
4. Click **"Save"**

---

## Phase 5: End-to-End Testing

### 5.1 Frontend Tests

```bash
# Test homepage loads
curl -I https://voxanne.ai
# Expected: HTTP/2 200 OK

# Test www redirect
curl -I https://www.voxanne.ai
# Expected: HTTP/2 301/308 → https://voxanne.ai

# Test login page
curl -I https://voxanne.ai/login
# Expected: HTTP/2 200 OK

# Test dashboard (should redirect to login)
curl -I https://voxanne.ai/dashboard
# Expected: HTTP/2 302/307 → /login
```

### 5.2 Backend API Tests

```bash
# Test health endpoint
curl https://api.voxanne.ai/health
# Expected: {"status":"ok","timestamp":"...","environment":"production"}

# Test webhook endpoint (should require auth)
curl -X POST https://api.voxanne.ai/api/webhooks/vapi
# Expected: 401 Unauthorized or 403 Forbidden

# Test CORS protection
curl -H "Origin: https://evil.com" https://api.voxanne.ai/health
# Expected: No Access-Control-Allow-Origin header (CORS blocked)

# Test rate limiting (rapid requests)
for i in {1..150}; do curl -s https://api.voxanne.ai/health > /dev/null; done
# Expected: 429 Too Many Requests after ~100 requests
```

### 5.3 Manual User Flow Test

**⚠️ CRITICAL - Test these before announcing to users**

1. **Visit Homepage**: https://voxanne.ai
   - [ ] Page loads correctly
   - [ ] Images load
   - [ ] No console errors in browser DevTools

2. **Sign Up / Login**:
   - [ ] Can create new account
   - [ ] Can log in with existing account
   - [ ] Redirects to dashboard after login

3. **Dashboard Access**:
   - [ ] Dashboard loads without errors
   - [ ] Left sidebar renders correctly
   - [ ] Stats cards display data

4. **Agent Configuration**:
   - [ ] Can configure agent settings
   - [ ] Can upload knowledge base files
   - [ ] Can save agent configuration

5. **Test Call**:
   - [ ] "Test Call" button works
   - [ ] Outbound call initiates
   - [ ] Call completes successfully

6. **Recording Playback**:
   - [ ] Can navigate to Calls page
   - [ ] Call recordings appear
   - [ ] Can play audio recordings

7. **Calendar Integration**:
   - [ ] Can connect Google Calendar
   - [ ] OAuth flow completes
   - [ ] Calendar sync works

8. **Appointment Booking**:
   - [ ] Can book test appointment
   - [ ] Appointment appears in calendar
   - [ ] No double-booking errors

9. **Leads Management**:
   - [ ] Can view leads list
   - [ ] Can add new contact
   - [ ] "Call Back" button works

10. **Settings**:
    - [ ] Can update organization settings
    - [ ] Can invite team members
    - [ ] Can view API keys

**If ANY of the above fail**, check:
1. Browser DevTools → Console for JavaScript errors
2. Browser DevTools → Network for failed API calls
3. Render logs for backend errors
4. Vercel logs for frontend errors

---

## Phase 6: Security Validation

### 6.1 SSL/TLS Verification

```bash
# Check frontend SSL
openssl s_client -connect voxanne.ai:443 -servername voxanne.ai < /dev/null 2>/dev/null | grep "subject="
# Expected: subject=CN=voxanne.ai

# Check backend SSL
openssl s_client -connect api.voxanne.ai:443 -servername api.voxanne.ai < /dev/null 2>/dev/null | grep "subject="
# Expected: subject=CN=api.voxanne.ai
```

### 6.2 Security Headers Check

```bash
# Check security headers on frontend
curl -I https://voxanne.ai
# Expected headers:
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Referrer-Policy: strict-origin-when-cross-origin
# - Permissions-Policy: camera=(), microphone=(self), geolocation=()

# Check backend CORS
curl -I -H "Origin: https://evil.com" https://api.voxanne.ai/health
# Expected: No Access-Control-Allow-Origin header (blocked)
```

### 6.3 Sensitive Data Exposure Check

```bash
# Verify no API keys in frontend bundle
curl -s https://voxanne.ai/_next/static/chunks/*.js | grep -i "supabase.*service.*role"
# Expected: No matches (service role key not in frontend)

curl -s https://voxanne.ai/_next/static/chunks/*.js | grep -i "vapi.*private"
# Expected: No matches (Vapi private key not in frontend)

# Verify environment variables
# In browser DevTools → Console:
console.log(process.env)
# Expected: Only NEXT_PUBLIC_* variables visible
```

---

## Phase 7: Performance Monitoring

### 7.1 Baseline Metrics

After 24 hours of deployment, document these baselines:

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| Frontend Load Time (P95) | < 2 seconds | ___ sec | Measure with Lighthouse |
| API Response Time (P95) | < 500ms | ___ ms | Check Render metrics |
| Error Rate | < 0.1% | ____ % | Check Sentry/logs |
| Uptime | 99.9%+ | ____ % | Render dashboard |
| Cache Hit Rate | > 80% | ____ % | Redis logs |
| Database Query Time | < 1 sec | ___ ms | Supabase dashboard |

### 7.2 Monitoring Tools Setup (Optional but Recommended)

**UptimeRobot** (Free tier available):
- Monitor: `https://voxanne.ai` (every 5 minutes)
- Monitor: `https://api.voxanne.ai/health` (every 5 minutes)
- Alert via: Email, Slack, SMS

**Sentry** (Already configured if `SENTRY_DSN` set):
- Error tracking: Real-time alerts for backend errors
- Performance monitoring: Track slow API endpoints
- Release tracking: Monitor each deployment

**Vercel Analytics** (Included with Vercel Pro):
- Core Web Vitals tracking
- Real User Monitoring (RUM)
- Performance insights

---

## Phase 8: Rollback Plan (Emergency Use Only)

### If Frontend Has Critical Bug

```bash
# List recent Vercel deployments
vercel ls voxanne-ai-frontend --token aF8XCJ7H06Xr6gA7lcfXJ4Az

# Rollback to previous deployment
vercel rollback <deployment-url> --token aF8XCJ7H06Xr6gA7lcfXJ4Az
```

### If Backend Has Critical Bug

1. Go to **Render Dashboard** → **voxanne-backend** → **Events**
2. Find last successful deployment
3. Click **"Rollback to this version"**
4. Confirm rollback
5. Monitor logs for successful restart

### Emergency Maintenance Mode

If both services need to go down:

**Render**: Add env var `MAINTENANCE_MODE=true`
**Vercel**: Deploy temporary maintenance page

---

## Master Completion Checklist

### ✅ Deployment Complete When:

- [ ] **GitHub**: All code committed and pushed to `Callwaiting-AI-Voxanne-2026` repo
- [ ] **Vercel**: Frontend deployed at https://voxanne.ai
- [ ] **Render**: Backend deployed at https://api.voxanne.ai
- [ ] **DNS**: All DNS records configured and propagated
- [ ] **SSL**: HTTPS working on all domains (voxanne.ai, www.voxanne.ai, api.voxanne.ai)
- [ ] **Vapi**: Webhook URLs updated to production domains
- [ ] **Google OAuth**: Redirect URIs whitelisted
- [ ] **Supabase**: Auth redirect URLs configured
- [ ] **Redis**: Connected and operational (check Render logs)
- [ ] **Environment Variables**: All secrets set correctly (no placeholders)
- [ ] **Health Checks**: `/health` endpoint returns 200 OK
- [ ] **CORS**: Cross-origin requests blocked for unauthorized domains
- [ ] **Rate Limiting**: 429 errors after exceeding limits
- [ ] **Security Headers**: X-Frame-Options, CSP, etc. present
- [ ] **End-to-End Tests**: All 10 user flows pass
- [ ] **Performance**: Page loads < 2s, API < 500ms
- [ ] **Monitoring**: Error tracking and uptime monitoring active
- [ ] **Documentation**: Deployment guides saved and accessible
- [ ] **Team Notified**: Stakeholders informed of production URLs

---

## Support Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| **Render Issues** | support@render.com | 24 hours |
| **Vercel Issues** | support@vercel.com | 24 hours |
| **Supabase Issues** | support@supabase.com | 24-48 hours |
| **Vapi Issues** | support@vapi.ai | 24 hours |
| **DNS Issues** | Vercel support (DNS managed there) | 24 hours |

---

## Next Steps (Week 1)

1. **Monitor Daily**:
   - [ ] Check Render logs for errors (daily)
   - [ ] Review Sentry error reports (daily)
   - [ ] Test critical user flows (daily)
   - [ ] Monitor uptime (automated)

2. **Optimize**:
   - [ ] Review slow API endpoints (if any P95 > 500ms)
   - [ ] Optimize database queries (run EXPLAIN ANALYZE)
   - [ ] Improve cache hit rate (if < 80%)

3. **Document**:
   - [ ] Create operational runbook for common issues
   - [ ] Document any bugs found and fixes applied
   - [ ] Update README with production URLs

4. **Scale** (if needed):
   - [ ] Upgrade Render plan if CPU/memory > 80%
   - [ ] Add more Redis memory if cache evictions occur
   - [ ] Consider Vercel Pro if bandwidth limits reached

---

**🎉 Congratulations! Your Voxanne AI platform is production-ready.**

**Remember**: Production is never "done" - monitor, iterate, improve continuously!
