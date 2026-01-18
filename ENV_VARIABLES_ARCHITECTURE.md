# Environment Variables Architecture - Single Source of Truth
**Status: FINALIZED** | **Date: January 17, 2026** | **Created by: Claude Lead Engineer**

---

## 🎯 THE PROBLEM (What the previous dev broke)

Your backend had **62 unique environment variables scattered across 25+ files**, with multiple code paths reading `process.env` directly. This caused:

- **❌ Duplicate logic** - URL fallback chains in 15 different files
- **❌ Security leaks** - Hardcoded credentials mixed with dynamic config
- **❌ Tenant confusion** - TWILIO_ACCOUNT_SID in .env (should be per-clinic in DB)
- **❌ No validation** - Missing required keys only discovered at runtime
- **❌ Maintenance nightmare** - Impossible to onboard new developers

---

## ✅ THE SOLUTION (What you now have)

### Architecture: Hybrid Credential Model

```
┌──────────────────────────────────────────────────────────┐
│ YOU (Platform Provider) - .env Only                       │
├──────────────────────────────────────────────────────────┤
│ PLATFORM SECRETS:                                         │
│  ✓ VAPI_API_KEY (voice AI master key)                    │
│  ✓ OPENAI_API_KEY (RAG search)                           │
│  ✓ SUPABASE_SERVICE_ROLE_KEY (database admin)            │
│  ✓ ENCRYPTION_KEY (credential encryption)                │
│                                                           │
│ CONFIGURATION:                                            │
│  ✓ NODE_ENV, PORT, LOG_LEVEL                             │
│  ✓ BACKEND_URL, FRONTEND_URL, CORS_ORIGIN               │
│  ✓ All URL bases and timeouts                            │
└──────────────────────────────────────────────────────────┘
                         ↓
            [Your Backend Server]
                         ↓
┌──────────────────────────────────────────────────────────┐
│ CLINICS (Tenants) - Database Only                        │
├──────────────────────────────────────────────────────────┤
│ TENANT SECRETS (stored in `integrations` table):         │
│  ✓ TWILIO_ACCOUNT_SID (clinic's SMS account)             │
│  ✓ TWILIO_AUTH_TOKEN (clinic's SMS auth)                 │
│  ✓ TWILIO_PHONE_NUMBER (clinic's phone number)           │
│  ✓ GOOGLE_OAUTH_CREDENTIALS (clinic's calendar access)   │
│                                                           │
│ TENANT CONFIGURATION (in `clinics` table):               │
│  ✓ CLINIC_NAME                                           │
│  ✓ COMPANY_NAME                                          │
│  ✓ TIMEZONE                                              │
│  ✓ Custom branding                                       │
└──────────────────────────────────────────────────────────┘
```

---

## 📋 REQUIRED BACKEND ENVIRONMENT VARIABLES

These **MUST exist** in your `.env` file for the backend to start:

### 1. Core Application
```bash
NODE_ENV=production                  # or development/test
PORT=3001
LOG_LEVEL=info                       # or debug/warn/error
```

### 2. Database (Supabase)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...    # ⚠️ KEEP SECURE
```

### 3. Voice AI (Vapi) - YOUR PROVIDER KEY
```bash
VAPI_API_KEY=YOUR_VAPI_API_KEY_HERE              # ⚠️ KEEP SECURE
```

### 4. AI/Search (OpenAI) - YOUR PROVIDER KEY
```bash
OPENAI_API_KEY=sk-proj-your-key-here             # ⚠️ KEEP SECURE (Optional but recommended)
```

### 5. Encryption (CRITICAL)
```bash
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# Generate with: openssl rand -hex 32 (MUST be 64 hex characters)
# ⚠️ CRITICAL: Never change this after data is encrypted!
```

---

## 🚫 DO NOT PUT IN .env (Fetch from Database Instead)

These belong in your database, keyed by `org_id`:

| Variable | Should Be | Where | Why |
|----------|-----------|-------|-----|
| `TWILIO_ACCOUNT_SID` | ❌ .env | ✓ `integrations.credentials` | Clinic-specific SMS account |
| `TWILIO_AUTH_TOKEN` | ❌ .env | ✓ `integrations.credentials` | Clinic-specific SMS auth |
| `TWILIO_PHONE_NUMBER` | ❌ .env | ✓ `integrations.credentials` | Clinic's phone number |
| `GOOGLE_CLIENT_ID` | ❌ .env | ✓ `integrations.credentials` | Clinic's OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | ❌ .env | ✓ `integrations.credentials` | Clinic's OAuth credentials |
| `CLINIC_NAME` | ❌ .env | ✓ `clinics.name` | Per-clinic branding |
| `COMPANY_NAME` | ❌ .env | ✓ `clinics.company_name` | Per-clinic branding |
| `FOUNDER_NAME` | ❌ .env | ✓ `clinics.founder_name` | Per-clinic branding |

---

## 📝 CODE USAGE RULE

This is **NON-NEGOTIABLE**. Any developer violating this rule is creating technical debt:

### ✅ CORRECT WAY
```typescript
// In your file:
import { config } from '../config';

// Use config object:
const apiKey = config.VAPI_API_KEY;
const port = config.PORT;
const cors = config.getCorsOptions();
```

### ❌ WRONG WAY (Will cause issues)
```typescript
// Direct process.env access - BREAKS the single source of truth
const apiKey = process.env.VAPI_API_KEY;

// Duplicate config loading - BREAKS validation
const port = process.env.PORT || 3001;

// Hardcoded fallbacks - BREAKS centralization
const url = process.env.BACKEND_URL || 'http://localhost:3001';
```

---

## 🔧 How to Migrate Existing Code

If you find any file using `process.env` directly, follow this pattern:

### Before
```typescript
// ❌ OLD: Scattered
import * as dotenv from 'dotenv';
dotenv.config();

export async function sendSms() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid) throw new Error('Missing TWILIO_ACCOUNT_SID');
  // ... validation code repeated everywhere
}
```

### After
```typescript
// ✅ NEW: Centralized
import { config } from '../config';

export async function sendSms() {
  // Config is already loaded and validated on startup
  const accountSid = config.TWILIO_ACCOUNT_SID;
  const authToken = config.TWILIO_AUTH_TOKEN;
  const fromNumber = config.TWILIO_PHONE_NUMBER;

  // These are optional since clinics provide via database
  if (!accountSid) {
    // Fetch from database instead
    const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);
    return sendViaCreds(creds);
  }
}
```

---

## 🔒 Security Best Practices

### 1. **Never Commit Real Credentials**
```bash
# ❌ BAD - in git history forever
VAPI_API_KEY=c08c442b-cc56-4a05-8bfa-34d46a5efccd

# ✅ GOOD - use placeholder
VAPI_API_KEY=YOUR_VAPI_API_KEY_HERE
```

### 2. **Use Deployment Platform Secrets**

#### For Render.com (Recommended)
```bash
# In Render dashboard: Environment tab
Dashboard → Your Service → Environment

Set these secrets (never expose):
- VAPI_API_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- ENCRYPTION_KEY
```

#### For Production
```bash
# Use your platform's secret manager
AWS Secrets Manager / Google Secret Manager / etc.

Then in your deployment:
docker run -e VAPI_API_KEY=$VAPI_API_KEY ...
```

### 3. **Local Development**
```bash
# Create a local .env file (NEVER committed)
cp .env.example .env

# Fill in values:
VAPI_API_KEY=your-test-key
OPENAI_API_KEY=your-test-key
ENCRYPTION_KEY=$(openssl rand -hex 32)

# .env is in .gitignore (already configured)
```

### 4. **Encryption Key Handling**
```bash
# Generate a new encryption key:
openssl rand -hex 32

# Output example:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# This MUST:
# 1. Be 64 hex characters
# 2. Never be changed (will break all encrypted data)
# 3. Be kept completely secret
# 4. Be unique per environment (dev != production)
```

---

## 🧪 Frontend Configuration (Separate)

Your frontend gets a **different** set of environment variables. These go in `.env.local` in the frontend directory:

```bash
# Frontend/.env.local (NEXT_PUBLIC_* are sent to browser)

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_BACKEND_URL=https://your-backend.com
NEXT_PUBLIC_APP_NAME=Voxanne
```

**KEY DIFFERENCE**: Frontend uses **ANON KEY** (safe for browser), backend uses **SERVICE ROLE KEY** (admin).

---

## 📊 Configuration Validation

The backend automatically validates on startup:

```typescript
// In src/config/index.ts - runs when app starts
export const config = {
  validate(): void {
    const critical = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'VAPI_API_KEY',
      'ENCRYPTION_KEY'  // Required for tenant credential encryption
    ];

    const missing = critical.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error(`Missing critical environment variables: ${missing.join(', ')}`);
      process.exit(1);  // Fail fast
    }
  }
};

// Automatic validation on module load
config.validate();  // If fails, server won't start
```

**Result**: No silent failures. Missing credentials = server fails immediately.

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All credentials in `.env` are from your deployment platform's secret manager
- [ ] `.env` file is in `.gitignore` (never committed)
- [ ] `ENCRYPTION_KEY` is set and documented in your password manager
- [ ] All code imports `config` from `src/config/index.ts` (not `process.env`)
- [ ] No hardcoded URLs (use `config.BACKEND_URL`, etc.)
- [ ] Frontend and backend use different Supabase keys
- [ ] `NODE_ENV=production` is set in deployment platform
- [ ] `LOG_LEVEL=info` or `warn` for production (not `debug`)

---

## 🔍 Audit: Finding Violations

If you inherit code from another developer, look for these patterns:

### Red Flags (Find and Fix)
```bash
# Find all direct process.env usage in backend code:
grep -r "process\.env\." backend/src --include="*.ts" | grep -v config

# Find hardcoded URLs:
grep -r "http://localhost\|https://.*\.com" backend/src --include="*.ts" | grep -v ".env"

# Find unvalidated env vars:
grep -r "getOptional\|getRequired" backend/src --include="*.ts" | grep -v config/index.ts
```

### Fix These
- Replace `process.env.X` with `config.X`
- Move hardcoded fallbacks to `config/index.ts`
- Add validation to `config.validate()`

---

## 📞 Support Reference

If you (or another developer) has questions:

1. **Where is a variable defined?** → Check `backend/.env.example`
2. **How do I add a new variable?** → Add to `.env.example`, then `config/index.ts`
3. **How do I use it in code?** → `import { config } from '../config'; config.YOUR_VAR`
4. **Where do tenant credentials go?** → Database (`integrations` table), not `.env`
5. **What if a variable is missing?** → Server fails on startup with clear error message

---

## 🎓 Historical Context

**Why this matters**: The previous developer scattered variables across 25+ files because they didn't have centralized config. This created:

- **Maintenance hell**: Every file had its own validation and fallback logic
- **Security risk**: Credentials could leak through multiple code paths
- **Onboarding friction**: New developers had to hunt for where variables were used
- **Testing nightmare**: Hard to mock or override config

By centralizing in `src/config/index.ts`, you now have:

- **Single point of truth**: All config in one place
- **Validation on startup**: No silent failures
- **Security by design**: Centralized credential handling
- **Easy onboarding**: New devs just import `config`

---

## ✅ Verification

Run this to verify your setup is correct:

```bash
# Backend validation (will fail if config is wrong)
npm run dev

# Check that server starts with:
# ✓ Configuration validation passed
# ✓ Server running on port 3001

# If you see error messages about missing variables:
# 1. Add them to .env
# 2. Reference backend/.env.example
# 3. Get values from your deployment platform
```

---

**This document is the LAW. Keep it in your README. Reference it in code reviews. Make sure every developer follows it.**
