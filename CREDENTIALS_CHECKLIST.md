# Credentials Checklist - What You Need to Gather

**Use this checklist to collect all credentials needed for production deployment.**

---

## 🔐 Supabase (Database)

**Where to get**: https://app.supabase.com/project/YOUR_PROJECT/settings/api

- [ ] **SUPABASE_URL**
  - Format: `https://your-project-id.supabase.co`
  - Location: API Settings → Project URL
  - Example: `https://lbjymlodxprzqgtyqtcq.supabase.co`

- [ ] **SUPABASE_SERVICE_ROLE_KEY**
  - **⚠️ KEEP EXTREMELY SECURE** - This bypasses Row Level Security
  - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Location: API Settings → Service Role Secret
  - **NEVER** share, commit, or expose in logs

---

## 🎙️ Vapi (Voice AI)

**Where to get**: https://dashboard.vapi.ai/settings/api-keys

- [ ] **VAPI_API_KEY**
  - **⚠️ KEEP SECURE** - Your voice AI master key
  - Format: UUID like `c08c442b-cc56-4a05-8bfa-34d46a5efccd` or token
  - Location: Dashboard → Settings → API Keys
  - This enables all voice calling functionality

- [ ] **VAPI_WEBHOOK_SECRET** (Optional)
  - Format: Any string you choose
  - Used to validate incoming webhook requests from Vapi
  - Location: Dashboard → Settings → Webhooks

---

## 🤖 OpenAI (AI Search & Embeddings)

**Where to get**: https://platform.openai.com/api-keys

- [ ] **OPENAI_API_KEY**
  - **⚠️ KEEP SECURE** - Your OpenAI API key
  - Format: `sk-proj-...` or `sk-...`
  - Location: Platform → API Keys
  - Used for RAG search, embeddings, and knowledge base queries
  - **Optional** but strongly recommended for knowledge base features

---

## 🔑 Encryption Key (CRITICAL)

**How to generate**: Run this command

```bash
openssl rand -hex 32
```

Output example:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

- [ ] **ENCRYPTION_KEY**
  - **⚠️ EXTREMELY CRITICAL** - Encrypts all tenant credentials in database
  - Must be exactly 64 hex characters
  - **NEVER CHANGE** after data is encrypted (or all credentials become unreadable)
  - Store safely in your password manager
  - Different key per environment (dev ≠ production)

---

## 📧 Email Service (Optional)

Choose ONE:

### Option A: Resend
**Where to get**: https://resend.com/api-keys

- [ ] **RESEND_API_KEY**
  - Format: `re_...`
  - Location: API Keys page
  - Easier setup, good for production

### Option B: SMTP
**Where to get**: Your email provider (Gmail, SendGrid, etc.)

- [ ] **SMTP_HOST** (e.g., `smtp.gmail.com`)
- [ ] **SMTP_PORT** (e.g., `587`)
- [ ] **SMTP_USER** (e.g., `your-email@gmail.com`)
- [ ] **SMTP_PASSWORD** (e.g., app-specific password for Gmail)

---

## 🔗 Google OAuth (For Calendar Integration)

**Where to get**: https://console.cloud.google.com/apis/credentials

These are platform-level (for OAuth flow setup):

- [ ] **GOOGLE_CLIENT_ID**
  - Format: `YOUR_CLIENT_ID.apps.googleusercontent.com`
  - Location: Google Cloud Console → Credentials → OAuth 2.0 Client IDs
  - Used to validate OAuth flows

- [ ] **GOOGLE_CLIENT_SECRET**
  - **⚠️ KEEP SECURE**
  - Format: Long alphanumeric string
  - Location: Same as above
  - Used to exchange authorization codes for tokens

- [ ] **GOOGLE_REDIRECT_URI**
  - Format: `https://your-backend.com/api/auth/google/callback`
  - Must match exactly what's configured in Google Cloud Console
  - Local dev: `http://localhost:3001/api/auth/google/callback`

**Note**: Each **clinic** also provides their own Google credentials via the UI (for their calendar). These platform credentials are just for the OAuth flow.

---

## 📱 Twilio (SMS) - Optional in `.env`

**Where to get**: https://console.twilio.com/

**Important**: In production, clinic Twilio credentials should come from the database (clinic-provided), not `.env`. Only use `.env` for fallback/testing.

- [ ] **TWILIO_ACCOUNT_SID** (Optional - for development/fallback)
  - Format: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Location: Twilio Console → Account Info → SID
  - **Deprecated in multi-tenant mode** (use database instead)

- [ ] **TWILIO_AUTH_TOKEN** (Optional - for development/fallback)
  - **⚠️ KEEP SECURE**
  - Format: Long alphanumeric string
  - Location: Twilio Console → Account Info → Auth Token
  - **Deprecated in multi-tenant mode** (use database instead)

- [ ] **TWILIO_PHONE_NUMBER** (Optional - for development/fallback)
  - Format: `+1234567890`
  - Location: Twilio Console → Phone Numbers
  - **Deprecated in multi-tenant mode** (use database instead)

---

## 📍 URLs & Configuration

- [ ] **BACKEND_URL**
  - Production: `https://your-backend.onrender.com` (or your domain)
  - Local dev: `http://localhost:3001`
  - Used for webhooks, OAuth redirects, etc.

- [ ] **FRONTEND_URL**
  - Production: `https://your-frontend.com` (or your domain)
  - Local dev: `http://localhost:3000`
  - Used for CORS, redirects

- [ ] **WEBHOOK_URL** (Optional)
  - Custom webhook endpoint if different from standard
  - Format: `https://your-backend.com/api/webhooks`

---

## 📊 Monitoring (Optional)

### Sentry (Error Tracking)
**Where to get**: https://sentry.io/

- [ ] **SENTRY_DSN** (Optional)
  - Format: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`
  - Location: Project Settings → Client Keys (DSN)
  - Used for error tracking in production

---

## 🎯 Gathering Template

**Print this and fill it in:**

```
BACKEND CREDENTIALS CHECKLIST
Date: ___________________

DATABASE:
  SUPABASE_URL: _________________________________
  SUPABASE_SERVICE_ROLE_KEY: _________________
  ⚠️  STORED IN PASSWORD MANAGER? [ ]

VOICE AI:
  VAPI_API_KEY: _________________________________
  ⚠️  STORED IN PASSWORD MANAGER? [ ]

AI/SEARCH:
  OPENAI_API_KEY: _______________________________
  ⚠️  STORED IN PASSWORD MANAGER? [ ]

ENCRYPTION (CRITICAL):
  ENCRYPTION_KEY (64 hex): ______________________
  ⚠️  STORED IN PASSWORD MANAGER? [ ]
  ⚠️  Backup copy saved? [ ]

GOOGLE OAUTH:
  GOOGLE_CLIENT_ID: ____________________________
  GOOGLE_CLIENT_SECRET: ________________________
  ⚠️  STORED IN PASSWORD MANAGER? [ ]

OPTIONAL:
  EMAIL_PROVIDER: [ ] Resend [ ] SMTP
  SENTRY_DSN: __________________________________
  TWILIO (for fallback):
    - Account SID: _____________________________
    - Auth Token: ______________________________
    - Phone Number: ____________________________

VERIFICATION:
  [ ] All credentials gathered
  [ ] Stored securely in password manager
  [ ] Not committed to git
  [ ] Verified with team
  [ ] Ready for production
```

---

## 🚀 Production Deployment Steps

1. **Gather all credentials** using this checklist
2. **Store in password manager** (LastPass, 1Password, Bitwarden, etc.)
3. **Add to deployment platform** (Render, AWS, etc.) as secrets
4. **Never commit** to git
5. **Deploy** → Server starts with validation
6. **Verify** server started: `✓ Configuration validation passed`

---

## ⚠️ Security Reminders

- [ ] Never put credentials in code comments
- [ ] Never share credentials via email or chat
- [ ] Never commit credentials to git
- [ ] Never expose credentials in error messages or logs
- [ ] Never hardcode URLs in code
- [ ] Use deployment platform's secret manager
- [ ] Rotate credentials regularly (especially API keys)
- [ ] Store `ENCRYPTION_KEY` in a safe place (never regenerate)

---

## 🆘 If You're Missing a Credential

| Credential | What to Do |
|-----------|-----------|
| SUPABASE_URL | Go to supabase.com → create project → get URL |
| SUPABASE_SERVICE_ROLE_KEY | Go to Supabase Dashboard → Settings → API |
| VAPI_API_KEY | Go to vapi.ai dashboard → create account → get key |
| OPENAI_API_KEY | Go to openai.com → create account → get key |
| ENCRYPTION_KEY | Run: `openssl rand -hex 32` |
| GOOGLE_CLIENT_ID/SECRET | Go to console.cloud.google.com → create OAuth 2.0 credentials |
| TWILIO (optional) | Only needed if using global SMS fallback |

---

## ✅ Final Checklist

Before going to production:

- [ ] All REQUIRED credentials gathered
- [ ] ENCRYPTION_KEY is 64 hex characters
- [ ] All credentials stored securely (password manager)
- [ ] `.env` created from `.env.example`
- [ ] Credentials NOT in version control
- [ ] Server starts locally: `npm run dev`
- [ ] Configuration validation passes
- [ ] Credentials added to deployment platform
- [ ] Team reviewed security setup
- [ ] Ready to deploy

---

**You now have all the information needed to securely configure your backend. Guard these credentials carefully.**
