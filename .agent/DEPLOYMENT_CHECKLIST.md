# Production Deployment Checklist - Voxanne AI

**Last Updated:** 2026-01-28
**Status:** Ready for Production Deployment
**Architecture:** Multi-tenant with BYOC (Bring Your Own Credentials)

---

## Pre-Deployment Verification

### ✅ Code Quality

- [x] Operation Lean Ship completed - 287 non-essential files archived
- [x] Frontend build successful
- [x] No broken imports from archived files
- [x] `.gitignore` includes `_ARCHIVE_2026/`
- [x] All source code intact

### ✅ Production Features Implemented

**Phase 1-5: Core Fixes** (Completed)
- [x] Vapi tool registration automation (7 phases)
- [x] Dashboard API field fixes
- [x] 4 new dashboard action endpoints
- [x] Message audit trail table

**Phase 2: Security Audit** (Completed 2026-01-27)
- [x] 11 database tables secured with RLS
- [x] 100% multi-tenant data isolation
- [x] PHI/PII protection for call transcripts
- [x] 28+ org_isolation policies active

**Phase 3: Fortress Protocol** (Completed 2026-01-28)
- [x] Centralized, type-safe credential architecture
- [x] `CredentialService` single source of truth
- [x] Fixed credential query bugs
- [x] Developer guidelines in CONTRIBUTING.md

**Phase 4: Dashboard UX Optimization** (Completed 2026-01-28)
- [x] SWR caching with 10-minute TTL
- [x] Instant navigation (no loaders between pages)
- [x] Tab-switch fix (revalidateOnFocus: false)
- [x] Fixed hardcoded org_id in voice agent
- [x] Session storage persistence

---

## Required Environment Variables

### Backend `.env` (ONLY these are needed)

```bash
# === VAPI CONFIGURATION ===
# Backend is the SOLE Vapi provider for all organizations
# Organizations do NOT have individual Vapi keys
VAPI_PRIVATE_KEY=<your-vapi-private-api-key>     # For tool registration
VAPI_PUBLIC_KEY=<your-vapi-public-key>           # For assistant reference

# === BACKEND CONFIGURATION ===
BACKEND_URL=https://voxanne-backend.onrender.com  # Production URL after Render deployment
NODE_ENV=production

# === DATABASE (SUPABASE) ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>     # For RLS bypass in server functions

# === AUTHENTICATION ===
JWT_SECRET=<your-jwt-secret>                      # For signing JWT tokens

# === ENCRYPTION ===
ENCRYPTION_KEY=<your-encryption-key>              # For encrypting org_credentials
```

### Frontend `.env.local` (ONLY these are needed)

```bash
# === API ENDPOINTS ===
NEXT_PUBLIC_BACKEND_URL=https://voxanne-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>         # Public anon key for client-side auth

# === ENVIRONMENT ===
NEXT_PUBLIC_ENVIRONMENT=production
```

### What's NOT Needed

❌ `TWILIO_ACCOUNT_SID` - Not in backend `.env`
❌ `TWILIO_AUTH_TOKEN` - Not in backend `.env`
❌ `GOOGLE_CLIENT_SECRET` - Not in backend `.env`

**Why?** These are BYOC credentials:
- Each organization provides them via dashboard
- Stored encrypted in `org_credentials` table
- Synced to Vapi automatically on org save
- Backend never stores provider API keys

---

## Deployment Steps

### Phase 1: Deploy Backend to Render

**1. Connect Repository**
```bash
# In Render dashboard:
# - Click "New" → "Web Service"
# - Connect GitHub repository
# - Choose "voxanne" repository
```

**2. Configure Build**
```
Build Command: cd backend && npm install && npm run build
Start Command: cd backend && npm start
Region: US West (Oregon)
```

**3. Add Environment Variables (Only the ones listed above)**
```
VAPI_PRIVATE_KEY=...
VAPI_PUBLIC_KEY=...
BACKEND_URL=https://voxanne-backend.onrender.com (Render will provide this)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
ENCRYPTION_KEY=...
NODE_ENV=production
```

**4. Deploy**
- Click "Create Web Service"
- Wait for deployment to complete
- Note the provided URL (e.g., `https://voxanne-backend.onrender.com`)

---

### Phase 2: Update Backend Configuration

**1. Update `backend/.env`**
```bash
BACKEND_URL=https://voxanne-backend.onrender.com
NODE_ENV=production
```

**2. Verify Webhook Health**
```bash
curl https://voxanne-backend.onrender.com/api/webhook/health
# Expected response:
# {
#   "status": "ok",
#   "backend_url": "https://voxanne-backend.onrender.com",
#   "version": "1.0.0",
#   "environment": "production"
# }
```

---

### Phase 3: Deploy Frontend to Vercel

**1. Connect Repository**
```bash
# In Vercel dashboard:
# - Click "Add New" → "Project"
# - Connect GitHub repository
# - Select "voxanne" repository
```

**2. Configure Frontend**
```
Framework: Next.js
Root Directory: ./ (root of monorepo, not subfolder)
```

**3. Add Environment Variables**
```
NEXT_PUBLIC_BACKEND_URL=https://voxanne-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_ENVIRONMENT=production
```

**4. Deploy**
- Click "Deploy"
- Wait for deployment to complete
- Note the provided URL (e.g., `https://voxanne.vercel.app`)

---

### Phase 4: Update Vapi Assistants Webhook URLs

**1. Prepare Backend**
```bash
# Update BACKEND_URL to production:
export BACKEND_URL=https://voxanne-backend.onrender.com
```

**2. Run Webhook Update Script**
```bash
cd backend
npx ts-node src/scripts/update-all-assistants-webhook.ts
```

**Expected Output:**
```
✅ Found X active assistant(s)
✅ Updated assistant XXXX (role)
✅ All assistants updated with new webhook URL
```

**3. Verify Webhook Configuration**
```bash
# Each assistant should have:
serverUrl: https://voxanne-backend.onrender.com/api/vapi/webhook
```

---

### Phase 5: Run Production Verification Tests

**1. Webhook Health Check**
```bash
npm run test:full-scope

# Expected: Test 0 (Webhook Health Check) passes
# Should show: ✅ Webhook endpoint reachable
```

**2. Contract Verification (PhD-Level Test)**
```bash
npm run test:contract

# Expected: All 4 contract tests pass
# - checkAvailability
# - bookClinicAppointment
# - lookupCaller
# - transferCall
```

**3. Manual Live Call Test**
```bash
# Call the Vapi number and:
# 1. Book an appointment
# 2. Verify AI uses production calendar
# 3. Confirm appointment created in database
```

---

## Post-Deployment Tasks

### Immediate (Within 1 hour)

- [ ] Monitor Render logs for errors: `render.com/d/services > voxanne-backend > Logs`
- [ ] Monitor Vercel logs for errors: `vercel.com > voxanne > Deployments`
- [ ] Test login flow: Dashboard loads, no "Validating access..." loaders
- [ ] Test navigation: Instant page transitions (no loaders)
- [ ] Test tab switch: Return to dashboard, no re-validation

### Within 24 Hours

- [ ] Set up uptime monitoring (UptimeRobot or Render's built-in)
- [ ] Monitor first live calls for webhook timeouts
- [ ] Verify all new dashboards load data correctly
- [ ] Test action buttons: Share, Export, Send Follow-up SMS

### Within 1 Week

- [ ] Create incident runbook for credential expiration
- [ ] Set up alerting for webhook failures
- [ ] Document production troubleshooting guide
- [ ] Schedule weekly test calls to verify system health

---

## Critical Files for Production

### Must Be Present

✅ **Backend Source**
- `backend/src/routes/` - All API endpoints
- `backend/src/services/` - Business logic (CredentialService, ToolSyncService, etc.)
- `backend/src/models/` - Data models
- `backend/migrations/` - Database migrations (RLS policies, etc.)

✅ **Frontend Source**
- `src/components/` - React components
- `src/hooks/` - Custom hooks (useOrgValidation with SWR caching)
- `src/contexts/` - AuthContext with router ref pattern
- `src/lib/` - Utility functions

✅ **Critical Scripts**
- `backend/src/scripts/update-all-assistants-webhook.ts` - Post-deployment webhook sync
- `backend/src/scripts/vapi-integration-contract-test.ts` - Production verification

✅ **Configuration**
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `.env.example` - Template (not actual secrets)
- `render.yaml` - Render deployment config
- `vercel.json` - Vercel deployment config

✅ **Documentation**
- `README.md` - Project overview
- `CONTRIBUTING.md` - Developer guidelines
- `.agent/prd.md` - Product requirements
- `.agent/testing-strategy.md` - Testing guide

### Must NOT Be Present

❌ Archived files in `_ARCHIVE_2026/` (untracked, won't deploy)
❌ Test scripts from `backend/src/scripts/*test*.ts` (archived)
❌ Verification scripts from `backend/src/scripts/*verify*.ts` (archived)
❌ Root-level `.sh` scripts (archived)
❌ 203+ markdown documentation files (archived)

---

## Troubleshooting

### Issue: "Webhook health check FAILED"

**Cause:** Backend URL not reachable or not configured correctly
**Fix:**
1. Verify `BACKEND_URL` in Render environment variables
2. Run webhook health check: `curl https://voxanne-backend.onrender.com/api/webhook/health`
3. Check Render logs for startup errors

### Issue: "Failed to update assistants"

**Cause:** Vapi API key invalid or assistants don't exist
**Fix:**
1. Verify `VAPI_PRIVATE_KEY` in environment
2. Check Vapi dashboard for active assistants
3. Run update script again with verbose logging

### Issue: "Dashboard shows 'Validating access...' on navigation"

**Cause:** Cache cleared or session expired
**Fix:**
1. This is expected on first visit (cold start)
2. On subsequent navigation, should be instant (SWR cache)
3. Check browser DevTools > Application > Session Storage for `voxanne_org_validation`

### Issue: "Live calls timeout on tool execution"

**Cause:** Webhook URL in Vapi assistant not updated
**Fix:**
1. Run: `npx ts-node backend/src/scripts/update-all-assistants-webhook.ts`
2. Verify in Vapi dashboard: Assistant > Settings > Webhook URL = production URL
3. Re-run contract test: `npm run test:contract`

---

## Rollback Plan

If production deployment fails:

**1. Revert Webhook URLs**
```bash
export BACKEND_URL=http://localhost:3001  # or ngrok URL
npx ts-node backend/src/scripts/update-all-assistants-webhook.ts
```

**2. Revert Frontend Deployment**
```bash
# In Vercel: Click "Deployments" > Select previous working deployment > "Promote to Production"
```

**3. Investigate in Staging**
- Keep Render deployment running but don't route traffic
- Debug logs in Render dashboard
- Test contract verification: `npm run test:contract`

---

## Security Checklist

- [x] No hardcoded secrets in code
- [x] All org_credentials encrypted in database
- [x] RLS policies enforced on all tables
- [x] JWT validation on all backend routes
- [x] Vapi webhook signature verification active
- [x] CSRF protection configured
- [x] BYOC credentials never logged in plaintext
- [x] Environment variables different per stage (dev/prod)

---

## Success Criteria

✅ **Backend**
- Renders deploys successfully
- Webhook health check returns 200 OK
- All migrations applied (RLS policies active)
- Test contract verifies 4/4 endpoints

✅ **Frontend**
- Vercel deploys successfully
- Login flow works
- Dashboard loads without loaders
- Navigation is instant (< 100ms between pages)
- Tab switches don't trigger re-validation

✅ **Integration**
- Live calls reach backend
- Appointments create successfully
- Twilio BYOC calling works
- All org_credentials encrypted and synced

---

## Post-Launch Monitoring

**Daily for 1 Week:**
- Check Render error rate (target: < 0.1%)
- Check Vercel error rate (target: < 0.1%)
- Monitor webhook response times (target: < 2s)
- Review first live call recordings for quality

**Weekly:**
- Audit RLS policies still enforced
- Verify credential encryption still working
- Test Twilio BYOC with sample calls
- Review error logs for patterns

**Monthly:**
- Full security audit
- Performance review and optimization
- Credential expiration analysis
- Plan next feature phase

---

**Status:** Ready to deploy! 🚀

All 287 non-essential files have been archived. Repository is lean and production-ready. Only deploy with the environment variables listed above - everything else comes from BYOC or is already in the codebase.
