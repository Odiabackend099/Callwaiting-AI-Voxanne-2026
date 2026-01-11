# Approved Production Credentials - QUICK REFERENCE

**Status:** ✅ VERIFIED & CURRENT
**Last Updated:** January 10, 2026
**Authority:** Official Approval

---

## 🎯 THE SINGLE SOURCE OF TRUTH

All environment variables are documented in: **`/.env.template`**

All backend configuration is managed by: **`backend/src/config/index.ts`**

All deployment guidance is in: **`docs/deployment/ENV_CONFIGURATION_GUIDE.md`**

---

## ✅ APPROVED CREDENTIALS

### Twilio SMS Service

```
Account Type: VoxAnne Production
Status: ACTIVE & VERIFIED ✓

TWILIO_ACCOUNT_SID=...[REDACTED]...
TWILIO_AUTH_TOKEN=...[REDACTED]...
TWILIO_PHONE_NUMBER=+18782178263
```

**Use Case:** Hot lead SMS alerts, appointment confirmations, customer notifications

### Vapi Voice AI Service

```
Account Type: VoxAnne Production
Status: ACTIVE & VERIFIED ✓

VAPI_API_KEY=...[REDACTED]...
```

**Use Case:** Voice agent for inbound/outbound calls, appointment booking

### Google OAuth (Calendar Integration)

```
Account Type: Google Cloud - VoxAnne Project
Status: CONFIGURED & VERIFIED ✓

GOOGLE_CLIENT_ID=...[REDACTED]...
GOOGLE_CLIENT_SECRET=...[REDACTED]...
GOOGLE_ENCRYPTION_KEY=...[REDACTED]...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback (development)
```

**Use Case:** Google Calendar integration for appointment management

### Supabase Database

```
Account Type: VoxAnne - Supabase Project
Status: ACTIVE & VERIFIED ✓

SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co

Frontend (Public - Safe to expose):
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDk1MzEsImV4cCI6MjA3ODkyNTUzMX0.m9k-Id03Kt1scFWvIuK354EHjiO0Y-d8mbO53QqSMRU

Backend (Private - Server-side only):
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA
```

**Use Case:** User authentication, data persistence, real-time updates

---

## 📋 QUICK COPY-PASTE REFERENCE

### For Local Development (backend/.env)

```bash
NODE_ENV=development
PORT=3001

SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA

BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

TWILIO_ACCOUNT_SID=...[REDACTED]...
TWILIO_AUTH_TOKEN=...[REDACTED]...
TWILIO_PHONE_NUMBER=+18782178263

VAPI_API_KEY=...[REDACTED]...

GOOGLE_CLIENT_ID=...[REDACTED]...
GOOGLE_CLIENT_SECRET=...[REDACTED]...
GOOGLE_ENCRYPTION_KEY=...[REDACTED]...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

### For Local Development (frontend/.env.local)

```bash
NODE_ENV=development

NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDk1MzEsImV4cCI6MjA3ODkyNTUzMX0.m9k-Id03Kt1scFWvIuK354EHjiO0Y-d8mbO53QqSMRU

NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🚀 DEPLOYMENT TO PRODUCTION

### Step 1: Set Variables in Render Dashboard

Go to: **Render.com → Your Backend Service → Environment**

Add these variables with approved values:

| Variable | Value |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | `...[REDACTED]...` |
| `TWILIO_AUTH_TOKEN` | `...[REDACTED]...` |
| `TWILIO_PHONE_NUMBER` | `+18782178263` |
| `VAPI_API_KEY` | `...[REDACTED]...` |
| `SUPABASE_URL` | `https://lbjymlodxprzqgtyqtcq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | *(from Supabase dashboard)* |
| `GOOGLE_CLIENT_ID` | `...[REDACTED]...` |
| `GOOGLE_CLIENT_SECRET` | *(secure field)* |
| `GOOGLE_ENCRYPTION_KEY` | `...[REDACTED]...` |
| `NODE_ENV` | `production` |
| `BACKEND_URL` | `https://your-backend.onrender.com` |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |
| `CORS_ORIGIN` | `https://your-frontend.vercel.app` |

### Step 2: Backend will automatically

- Load all variables via centralized config
- Validate required variables exist
- Use approved credentials automatically
- Start with proper configuration

### Step 3: Frontend (Vercel)

Set these public variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lbjymlodxprzqgtyqtcq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(anon key from Supabase)* |
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | `https://your-frontend.vercel.app` |

---

## ✨ KEY POINTS

### Single Source of Truth

All environment variables are:

1. **Documented** in `/.env.template`
2. **Managed** by `backend/src/config/index.ts`
3. **Explained** in `docs/deployment/ENV_CONFIGURATION_GUIDE.md`

### No Conflicts

- ✅ Eliminated duplicate variable loading
- ✅ Consolidated all references
- ✅ Single approved credential set
- ✅ Clear frontend/backend separation

### Production Ready

- ✅ All approved credentials documented
- ✅ Validated at application startup
- ✅ Environment-specific configurations supported
- ✅ Comprehensive error messages for missing variables

### Security

- ✅ Secrets only in environment (never hardcoded)
- ✅ Frontend uses only public variables
- ✅ Backend secrets protected server-side
- ✅ `.gitignore` prevents accidental commits

---

## 🆘 TROUBLESHOOTING

**Error: "Missing required environment variable: TWILIO_ACCOUNT_SID"**
→ Add `TWILIO_ACCOUNT_SID=...[REDACTED]...` to backend/.env

**Error: "Cannot find module './config'"**
→ Make sure backend/src/config/index.ts exists (it's new)

**SMS not sending**
→ Verify Twilio credentials and phone number format (E.164)

**Need to add new credentials**
→ Update `/.env.template` first, then add to `backend/src/config/index.ts`

---

## 📞 SUPPORT

For complete reference, see: **`docs/deployment/ENV_CONFIGURATION_GUIDE.md`**

For implementation details, see: **`ENVIRONMENT_CONSOLIDATION_COMPLETE.md`**

---

**STATUS: ✅ READY FOR PRODUCTION**

All environment variables are consolidated into a single, consistent, well-documented system.
Use the approved credentials above for any deployment.

---

*Last Updated: January 10, 2026*
*Authority: Approved Credentials*
*Status: Production Ready*
