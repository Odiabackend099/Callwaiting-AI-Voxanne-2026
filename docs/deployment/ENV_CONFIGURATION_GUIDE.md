# Environment Configuration Guide - SINGLE SOURCE OF TRUTH

**Last Updated:** January 10, 2026
**Status:** Active & Verified

---

## Overview

This guide documents the **single source of truth** for all environment variables in the Callwaiting-AI-Voxanne project.

### Key Principles

1. **One Template File:** All variables are documented in `/.env.template`
2. **Centralized Backend Config:** `backend/src/config/index.ts` loads and validates all variables
3. **No Duplicate Loading:** Environment variables are loaded once at startup
4. **Clear Separation:** Frontend (`.env.local`) and Backend (`backend/.env`) configs are separate
5. **Public vs. Private:** Frontend variables use `NEXT_PUBLIC_` prefix (only for public data)

---

## File Structure

### Root Level

```
/.env.template                    # SINGLE SOURCE OF TRUTH (all variables documented here)
/.env.example                     # Frontend variables template
/.gitignore                       # Ensures .env.local is never committed
```

### Backend Level

```
backend/.env.example              # Backend variables template
backend/.env                      # Actual backend secrets (NEVER commit)
backend/src/config/index.ts       # Centralized config loading & validation
backend/src/services/supabase-client.ts  # Uses config, not direct process.env
backend/src/server.ts             # Imports config first, then all other modules
```

### Frontend Level

```
.env.local                        # Frontend secrets (NEVER commit)
src/lib/supabase.ts              # Uses NEXT_PUBLIC_ variables
next.config.mjs                  # Uses NEXT_PUBLIC_BACKEND_URL for rewrites
```

---

## Quick Setup

### For Frontend Development

```bash
# 1. Copy template to local env file
cp .env.example .env.local

# 2. Verify these variables are set:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_BACKEND_URL
# NEXT_PUBLIC_APP_URL

# 3. Start frontend
npm install
npm run dev
```

### For Backend Development

```bash
# 1. Copy template to backend env file
cp backend/.env.example backend/.env

# 2. Fill in all required variables (marked with ⚠️ in template)
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# TWILIO_ACCOUNT_SID (use approved credentials)
# TWILIO_AUTH_TOKEN (use approved credentials)
# TWILIO_PHONE_NUMBER (use approved: +18782178263)
# VAPI_API_KEY (use approved credentials)
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# GOOGLE_ENCRYPTION_KEY
# GOOGLE_REDIRECT_URI

# 3. Start backend
cd backend
npm install
npm run build
npm start
```

---

## Approved Production Credentials (January 10, 2026)

These are the **CURRENT & VERIFIED** credentials that should be used:

### Twilio SMS Service

```
TWILIO_ACCOUNT_SID=AC...[REDACTED]...
TWILIO_AUTH_TOKEN=...[REDACTED]...
TWILIO_PHONE_NUMBER=+18782178263
```

### Vapi Voice AI Service

```
VAPI_API_KEY=...[REDACTED]...
```

### Google OAuth (Calendar Integration)

```
GOOGLE_CLIENT_ID=750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...[REDACTED]...
GOOGLE_ENCRYPTION_KEY=...[REDACTED]...
```

### Supabase Database

```
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDk1MzEsImV4cCI6MjA3ODkyNTUzMX0.m9k-Id03Kt1scFWvIuK354EHjiO0Y-d8mbO53QqSMRU
```

---

## Centralized Backend Configuration Module

### Location

`backend/src/config/index.ts`

### Purpose

- **Single loading point** for all environment variables
- **Automatic validation** of required variables at startup
- **Type-safe** access to all configuration
- **Prevents duplicates** - config is loaded once, not in each service

### Usage in Backend Code

```typescript
// In any backend file, import config:
import { config } from '../config';

// Access variables:
console.log(config.TWILIO_PHONE_NUMBER);  // +18782178263
console.log(config.VAPI_API_KEY);         // ...[REDACTED]...
console.log(config.PORT);                 // 3001

// Use utility methods:
if (config.isProduction()) {
  // Production-specific code
}

const corsOptions = config.getCorsOptions();
```

### Why This Approach?

**Before (Problematic):**

- `supabase-client.ts` loads dotenv
- `server.ts` loads dotenv
- Multiple services access `process.env` directly
- **Result:** Inconsistency, hard to track variables, duplicate loading

**After (Current):**

- `config/index.ts` loads dotenv ONCE
- All services import from `config`
- Single validation point
- **Result:** Consistency, easy to audit, no duplicates

---

## Environment Variable Categories

### Required (Must Have)

These must always be set or the application won't start:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
VAPI_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_ENCRYPTION_KEY
GOOGLE_REDIRECT_URI
```

### Optional (Nice to Have)

These have sensible defaults but can be customized:

```
NODE_ENV (default: development)
PORT (default: 3001)
LOG_LEVEL (default: info)
BACKEND_URL (default: http://localhost:3001)
FRONTEND_URL (default: http://localhost:3000)
CORS_ORIGIN (default: http://localhost:3000)
```

### Development Only (NEVER in Production)

These are for local development and testing:

```
DEV_JWT_TOKEN
DEV_USER_ID
DEV_USER_EMAIL
DEBUG_VAPI
DEBUG_WEBSOCKET
ALLOW_DEV_WS_BYPASS
```

---

## Frontend Variables (NEXT_PUBLIC_)

These are exposed to the browser - **only for public data**:

```bash
# Public Supabase credentials (anon key is limited by RLS)
NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Application URLs
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:** Never put secrets with `NEXT_PUBLIC_` prefix. The browser can see all these variables.

---

## Backend Variables (NO prefix)

These are server-side only and never exposed to the client:

```bash
# Private Supabase credentials (service role bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# SMS Service (sensitive)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Voice AI (sensitive)
VAPI_API_KEY=...

# OAuth Secrets (sensitive)
GOOGLE_CLIENT_SECRET=...
```

**Security Rule:** If it's not prefixed with `NEXT_PUBLIC_`, it will never be exposed to the browser.

---

## Managing Variables Across Environments

### Development (Local)

```bash
# Use .env.local and backend/.env files
# Values can be test/development credentials
# NOT committed to git
```

### Staging (Render.com)

```bash
# Set variables in Render Dashboard > Environment
# Use staging credentials where applicable
# Access via process.env like production
```

### Production (Render.com)

```bash
# Set variables in Render Dashboard > Environment
# Use approved production credentials ONLY
# Double-check all URLs point to production
```

### Render Configuration

File: `backend/config/render.yaml`

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: TWILIO_ACCOUNT_SID
    sync: false
  - key: VAPI_API_KEY
    sync: false
  - key: SUPABASE_URL
    sync: false
  - key: SUPABASE_SERVICE_KEY  # Note: Render uses SERVICE_KEY
    sync: false
```

---

## Troubleshooting

### Error: "Missing required environment variable: TWILIO_ACCOUNT_SID"

**Solution:**

1. Check `backend/.env` exists
2. Verify `TWILIO_ACCOUNT_SID` is set
3. Use approved value: ...[REDACTED]...
4. Restart backend: `npm start`

### Error: "Missing NEXT_PUBLIC_SUPABASE_URL"

**Solution:**

1. Check `.env.local` exists in root directory
2. Verify `NEXT_PUBLIC_SUPABASE_URL` is set
3. Restart frontend: `npm run dev`

### Frontend can't reach backend

**Solution:**

1. Verify `NEXT_PUBLIC_BACKEND_URL` points to backend server
2. Check backend is running on the specified port
3. Ensure CORS is configured: `CORS_ORIGIN` matches frontend URL

### SMS not sending

**Solution:**

1. Verify Twilio credentials in `backend/.env`:
   - `TWILIO_ACCOUNT_SID=...`
   - `TWILIO_AUTH_TOKEN=...`
   - `TWILIO_PHONE_NUMBER=+18782178263`
2. Check Twilio account is active
3. Verify phone numbers are in E.164 format

### Vapi integration not working

**Solution:**

1. Verify `VAPI_API_KEY=...` in `backend/.env`
2. Check Vapi webhook is configured in dashboard
3. Verify `WEBHOOK_URL` points to your backend

---

## Adding New Environment Variables

### Step 1: Document in `.env.template`

Add your new variable with clear description:

```bash
# ======== NEW FEATURE ========
# Description of what this variable does
NEW_FEATURE_API_KEY=your-value-here
```

### Step 2: Add to Backend Config (`backend/src/config/index.ts`)

```typescript
export const config = {
  // ... existing vars
  NEW_FEATURE_API_KEY: getRequired('NEW_FEATURE_API_KEY'),
  // ... or
  NEW_FEATURE_URL: getOptional('NEW_FEATURE_URL', 'default-value'),
};
```

### Step 3: Update Templates

- `backend/.env.example`: Add commented example
- `.env.example`: If frontend needs it, add with `NEXT_PUBLIC_` prefix

### Step 4: Use in Code

```typescript
import { config } from '../config';

// Use it
const apiKey = config.NEW_FEATURE_API_KEY;
```

### Step 5: Document

Add note in this file explaining the new variable's purpose and any security considerations.

---

## Security Best Practices

### ✅ DO

- [x] Store all secrets in environment variables
- [x] Use `.gitignore` to prevent `.env` files from being committed
- [x] Use different credentials for dev/staging/production
- [x] Validate all required variables at startup
- [x] Use `NEXT_PUBLIC_` prefix ONLY for public data
- [x] Reference `.env.template` for complete list

### ❌ DON'T

- [ ] Hardcode credentials in source code
- [ ] Commit `.env` files to git
- [ ] Use same credentials across environments
- [ ] Put secrets in `NEXT_PUBLIC_` variables
- [ ] Store credentials in comments (even if commented out)
- [ ] Expose backend URLs to frontend (use API proxy)

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All required variables are set
- [ ] Using approved production credentials:
  - [ ] Twilio: ...[REDACTED]...
  - [ ] Vapi: ...[REDACTED]...
- [ ] Backend URLs point to production server
- [ ] Frontend URLs point to production domain
- [ ] CORS_ORIGIN is set correctly
- [ ] SSL/TLS is enabled (HTTPS)
- [ ] All external services are verified:
  - [ ] Twilio account active
  - [ ] Vapi account active
  - [ ] Google OAuth configured
  - [ ] Supabase running
- [ ] Secrets are stored in platform's secret manager (not in code)
- [ ] Log level is set appropriately (not DEBUG in production)

---

## Quick Reference

| Variable | Approved Value | Type | Environment |
|----------|---|---|---|
| TWILIO_ACCOUNT_SID | ... | Secret | All |
| TWILIO_AUTH_TOKEN | ... | Secret | All |
| TWILIO_PHONE_NUMBER | +18782178263 | Config | All |
| VAPI_API_KEY | ... | Secret | All |
| NODE_ENV | development/production | Config | All |
| PORT | 3001 | Config | Backend |
| BACKEND_URL | <http://localhost:3001> | Config | All |
| FRONTEND_URL | <http://localhost:3000> | Config | Backend |

---

## Support

For issues or questions about environment configuration:

1. Reference `/.env.template` for complete documentation
2. Check `backend/src/config/index.ts` for available variables
3. See troubleshooting section above
4. Review recent git commits for recent changes

---

**This is the SINGLE SOURCE OF TRUTH for environment configuration.**
All environment variables across the project should reference these documented values.
