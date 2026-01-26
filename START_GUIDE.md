# 🚀 Voxanne AI - Development Startup Guide

**Last Updated:** 2026-01-27
**PRD Version:** 2026.4
**Status:** Production Ready

---

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 18+ installed
- ✅ `ngrok` installed globally (`npm install -g ngrok`)
- ✅ Backend `.env` configured (see below)
- ✅ Frontend `.env.local` configured
- ✅ Supabase project set up
- ✅ Vapi account with API keys

---

## Quick Start (3 Terminal Workflow)

The recommended development workflow uses **3 terminal windows** running simultaneously:

### Terminal 1: Backend
```bash
cd backend
npm run dev
# Expected: "Backend running on http://localhost:3001"
```

### Terminal 2: Frontend
```bash
npm run dev
# Expected: "Next.js running on http://localhost:3000"
```

### Terminal 3: Ngrok Tunnel
```bash
ngrok http 3001
# Copy the HTTPS URL: https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

**Important:** After starting ngrok, update these URLs:
1. **Vapi Dashboard** → Update webhook URL to `https://your-ngrok-url.ngrok-free.app/api/vapi/webhook`
2. **Backend .env** → Update `BACKEND_URL=https://your-ngrok-url.ngrok-free.app`

---

## Environment Variables

### Backend `.env` (CRITICAL)

```bash
# ==================================================
# VAPI - Master Account (Backend is Sole Provider)
# ==================================================
VAPI_PRIVATE_KEY=your-vapi-private-key-here     # For tool registration
VAPI_PUBLIC_KEY=your-vapi-public-key-here       # For assistant reference
VAPI_WEBHOOK_SECRET=your-vapi-webhook-secret    # For HMAC verification

# ==================================================
# Backend Configuration
# ==================================================
BACKEND_URL=https://your-ngrok-url.ngrok-free.app   # UPDATE after ngrok starts
PORT=3001

# ==================================================
# Supabase Database
# ==================================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key    # Service role for RLS bypass
SUPABASE_ANON_KEY=your-anon-key                    # Anon key for client auth

# ==================================================
# JWT & Security
# ==================================================
JWT_SECRET=your-jwt-secret-here

# ==================================================
# Optional: Twilio (for phone number setup)
# ==================================================
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# ==================================================
# Optional: Google OAuth (for calendar integration)
# ==================================================
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend `.env.local`

```bash
# ==================================================
# Backend API
# ==================================================
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# ==================================================
# Supabase (Client-side)
# ==================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ==================================================
# Optional: Vapi (for frontend testing)
# ==================================================
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-vapi-public-key
```

---

## 🎯 Best Practices Workflow

### 1. Start Backend First
```bash
cd backend
npm install  # First time only
npm run dev
```

**Wait for:** `✅ Backend running on http://localhost:3001`

### 2. Start Ngrok Tunnel
```bash
ngrok http 3001 --domain=your-reserved-domain.ngrok-free.app  # If you have a reserved domain
# OR
ngrok http 3001  # For free ephemeral domain
```

**Copy the HTTPS URL** from ngrok output:
```
Forwarding  https://abcd-123-456-789.ngrok-free.app -> http://localhost:3001
```

### 3. Update Backend URL
```bash
# In backend/.env
BACKEND_URL=https://abcd-123-456-789.ngrok-free.app
```

**Restart backend** to apply the new URL:
```bash
# In Terminal 1 (backend)
# Press Ctrl+C, then:
npm run dev
```

### 4. Update Vapi Webhook
Go to https://dashboard.vapi.ai → Your Assistant → Server URL:
```
https://abcd-123-456-789.ngrok-free.app/api/vapi/webhook
```

### 5. Start Frontend
```bash
# Terminal 2
npm install  # First time only
npm run dev
```

**Wait for:** `✅ Next.js running on http://localhost:3000`

### 6. Test the Stack
Open browser to `http://localhost:3000` and verify:
- ✅ Login page loads
- ✅ Can sign in with test account
- ✅ Dashboard loads without errors
- ✅ Backend API calls work (check Network tab)

---

## 🧪 Testing Webhooks

### Test Vapi Webhook Integration
```bash
# From project root
npx ts-node backend/src/scripts/nuclear-vapi-cleanup.ts
```

**Expected Output:**
```
🎉 SYSTEM IS CLEAN - LIVE CALLS WILL WORK!
```

### Test Live Call Flow
1. Go to `/dashboard/test` page
2. Click "Start Test Call"
3. Speak to the AI: "I want to book an appointment for Botox"
4. Verify:
   - ✅ AI responds correctly
   - ✅ Appointment gets created in database
   - ✅ Dashboard shows the new call

---

## 🔧 Troubleshooting

### Backend Won't Start

**Error:** `Port 3001 already in use`
```bash
# Kill the process using port 3001
lsof -ti:3001 | xargs kill -9
# Then restart
npm run dev
```

**Error:** `VAPI_PRIVATE_KEY not configured`
- Check `backend/.env` exists and has `VAPI_PRIVATE_KEY=...`

### Frontend API Calls Fail

**Error:** `ERR_CONNECTION_REFUSED` or `Failed to fetch`
- Verify backend is running on `localhost:3001`
- Check browser console Network tab for exact URL
- Verify `NEXT_PUBLIC_BACKEND_URL` in `.env.local`

### Ngrok Tunnel Issues

**Error:** `ngrok not found`
```bash
npm install -g ngrok
```

**Error:** `Session Expired` (Free ngrok)
- Restart ngrok (URL will change)
- Update `BACKEND_URL` in backend/.env
- Update Vapi webhook URL
- Restart backend

**Tip:** Use ngrok reserved domain to avoid URL changes:
```bash
ngrok http 3001 --domain=your-static-domain.ngrok-free.app
```

### Vapi Webhooks Not Firing

**Checklist:**
1. ✅ Ngrok tunnel is running and HTTPS
2. ✅ `BACKEND_URL` in backend/.env matches ngrok URL
3. ✅ Vapi dashboard webhook URL is updated
4. ✅ Backend is running and shows no errors
5. ✅ Run `nuclear-vapi-cleanup.ts` script to verify

### Database Connection Issues

**Error:** `Could not connect to Supabase`
- Verify `SUPABASE_URL` is correct (no trailing slash)
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the service role key (not anon key)
- Check Supabase dashboard for API status

---

## 📦 Production Deployment Checklist

Before deploying to production:

### Database
- [ ] All migrations applied: `supabase db push`
- [ ] RLS enabled on all tables
- [ ] Verify RLS policies: `npx ts-node backend/src/scripts/verify-rls-policies.ts`

### Backend
- [ ] Environment variables configured in hosting provider
- [ ] `BACKEND_URL` points to production domain (not ngrok)
- [ ] Database connection pool configured
- [ ] Logging enabled (Datadog, Sentry, etc.)

### Frontend
- [ ] `NEXT_PUBLIC_BACKEND_URL` points to production backend
- [ ] Supabase variables configured
- [ ] Build succeeds: `npm run build`
- [ ] Lighthouse score > 90

### Vapi
- [ ] Webhook URL updated to production backend
- [ ] Phone numbers linked to assistants
- [ ] Tools registered and synced

### Testing
- [ ] Run end-to-end tests
- [ ] Test live call flow
- [ ] Verify multi-tenant isolation (2 different orgs)
- [ ] Check RLS policies block cross-org access

---

## 🚀 Advanced: Reserved Ngrok Domain

For a more stable dev experience, reserve a static ngrok domain:

1. Sign up at https://ngrok.com
2. Reserve a domain (e.g., `voxanne-dev.ngrok-free.app`)
3. Update your startup command:
```bash
ngrok http 3001 --domain=voxanne-dev.ngrok-free.app
```

**Benefits:**
- URL never changes between restarts
- No need to update Vapi webhook URL repeatedly
- Can hardcode `BACKEND_URL` in `.env`

---

## 📚 Additional Resources

- **PRD:** `.agent/prd.md` - Full product specification
- **Architecture:** `.agent/IMPLEMENTATION_SUMMARY.md` - Implementation details
- **Security Audit:** Plan file at `~/.claude/plans/peppy-cuddling-dragon.md`
- **Verification Scripts:**
  - `backend/src/scripts/nuclear-vapi-cleanup.ts` - Webhook test
  - `backend/src/scripts/verify-rls-policies.ts` - RLS check
  - `backend/src/scripts/verify-agent-access.ts` - E2E integration test

---

## 🎯 Daily Development Workflow

1. **Morning Startup:**
   ```bash
   # Terminal 1
   cd backend && npm run dev

   # Terminal 2
   npm run dev

   # Terminal 3
   ngrok http 3001
   ```

2. **Code Changes:**
   - Backend: Hot reload (nodemon)
   - Frontend: Hot reload (Next.js Fast Refresh)
   - Database: Run migrations manually when needed

3. **Before Git Push:**
   - Run tests: `npm test`
   - Check types: `npm run type-check`
   - Verify RLS: `npx ts-node backend/src/scripts/verify-rls-policies.ts`

---

**Happy Coding! 🚀**
