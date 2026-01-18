# Environment Variables - Backend Setup Guide

**START HERE** for backend configuration and environment variable management.

---

## 🚀 Quick Start (2 Minutes)

```bash
# 1. Copy template
cd backend
cp .env.example .env

# 2. Get credentials from your platform (Render, AWS, etc.)
# Edit .env and add:
#   - SUPABASE_SERVICE_ROLE_KEY
#   - VAPI_API_KEY
#   - OPENAI_API_KEY
#   - ENCRYPTION_KEY (generate with: openssl rand -hex 32)

# 3. Start
npm run dev

# ✓ Server should start with: "Configuration validation passed"
```

---

## 📚 Documentation Files

Read these in order based on your role:

### For Developers
1. **[ENVIRONMENT_QUICK_START.md](./ENVIRONMENT_QUICK_START.md)** ← Start here (5 min)
   - How to set up `.env`
   - How to use `config` in your code
   - Common issues and fixes

2. **[ENV_VARIABLES_ARCHITECTURE.md](./ENV_VARIABLES_ARCHITECTURE.md)** ← Deep dive (20 min)
   - Complete architecture explanation
   - Why we separate platform vs tenant secrets
   - Security best practices
   - Migration guide for existing code

### For Code Reviewers
- **[CODE_REVIEW_ENV_CHECKLIST.md](./CODE_REVIEW_ENV_CHECKLIST.md)** ← Use in PRs
  - Checklist for every environment-related change
  - Red flags to reject
  - Examples of good vs bad code

### For DevOps / Deployment
- **[INFRASTRUCTURE_AUDIT_SUMMARY.md](./INFRASTRUCTURE_AUDIT_SUMMARY.md)** ← Overview
  - What was fixed
  - Production deployment steps
  - Security verification checklist

---

## 🔑 Required Environment Variables

**These MUST be set for the backend to start:**

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...    # ⚠️ KEEP SECURE

# Voice AI
VAPI_API_KEY=your-vapi-key                          # ⚠️ KEEP SECURE

# Encryption (critical!)
ENCRYPTION_KEY=0123456789abcdef... (64 hex chars)   # ⚠️ KEEP SECURE, NEVER CHANGE

# Application
NODE_ENV=development (or production)
PORT=3001
```

**Optional but recommended:**
```bash
OPENAI_API_KEY=sk-proj-...                          # For RAG search
LOG_LEVEL=info                                       # or debug/warn
BACKEND_URL=http://localhost:3001                   # Webhook URLs
FRONTEND_URL=http://localhost:3000                  # CORS
```

---

## ✅ In Your Code

### The Right Way
```typescript
// ✅ CORRECT - Use centralized config
import { config } from '../config';

const vapi = new Vapi(config.VAPI_API_KEY);
const port = config.PORT;
```

### The Wrong Way
```typescript
// ❌ WRONG - Do NOT do this
const vapi = new Vapi(process.env.VAPI_API_KEY);
const port = process.env.PORT || 3001;
```

---

## 🧪 Testing Your Setup

### Test 1: Server Starts
```bash
npm run dev
# Should see: ✓ Configuration validation passed
```

### Test 2: Config Loads Correctly
```bash
node -e "const { config } = require('./src/config'); console.log(config.PORT)"
# Should output: 3001
```

### Test 3: Missing Required Variables Are Caught
```bash
# Temporarily remove ENCRYPTION_KEY from .env
npm run dev
# Should fail with: Missing critical environment variables: ENCRYPTION_KEY
# (Good - we want fast failure!)
```

---

## 🔐 Security Rules

1. **Never commit `.env`** to git (it's in `.gitignore`)
2. **Never expose credentials** in `.env.example` (use placeholders)
3. **Never hardcode URLs** like `'http://localhost:3001'` (use `config.BACKEND_URL`)
4. **Never read `process.env` directly** (use `config` instead)
5. **Never store tenant credentials** in `.env` (fetch from database)

---

## 🚀 Deployment to Production

### Step 1: Set Secrets in Platform
**For Render.com:**
- Go to your service → Environment tab
- Add secrets (not regular environment variables):
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VAPI_API_KEY`
  - `OPENAI_API_KEY`
  - `ENCRYPTION_KEY`

### Step 2: Set Configuration
- `NODE_ENV=production`
- `LOG_LEVEL=info` (not `debug`)
- `BACKEND_URL=https://your-backend.onrender.com`

### Step 3: Deploy
```bash
git push  # Render auto-deploys
# Server should start with: ✓ Configuration validation passed
```

---

## 🆘 Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing required environment variable: ENCRYPTION_KEY` | Run `openssl rand -hex 32` and add to `.env` |
| `Cannot find module '../config'` | Make sure path is relative to your file |
| `config.VAPI_API_KEY is undefined` | Check that `VAPI_API_KEY` is in your `.env` file |
| `Server crashes on startup` | Check the error message - variable is missing |
| Server won't start locally | Delete `node_modules`, run `npm install`, try again |

---

## 📖 Architecture Overview

Your backend uses a **Hybrid Credential Model**:

```
┌──────────────────────────┐
│  YOU (Platform Provider) │
│  ├─ VAPI_API_KEY         │
│  ├─ OPENAI_API_KEY       │
│  ├─ ENCRYPTION_KEY       │
│  └─ URLs & Config        │
└─────────────┬────────────┘
              │ .env
              ↓
      ┌───────────────┐
      │ Your Backend  │
      └───────────────┘
              │ DB
              ↓
┌──────────────────────────┐
│  CLINICS (Tenants)       │
│  ├─ Clinic A:            │
│  │  ├─ Twilio SID/Token  │
│  │  └─ Google OAuth      │
│  └─ Clinic B:            │
│     ├─ Twilio SID/Token  │
│     └─ Google OAuth      │
└──────────────────────────┘
```

Platform secrets go in `.env`. Tenant secrets go in the database.

---

## 🎓 Key Concepts

### Config Object
```typescript
import { config } from '../config';

// Access any variable:
config.VAPI_API_KEY
config.PORT
config.NODE_ENV

// Use helper methods:
config.isProduction()          // true/false
config.isDevelopment()         // true/false
config.getCorsOptions()        // { origin, credentials }
```

### Validation
- Happens automatically on server startup
- Fails FAST if required variables missing
- Clear error messages guide you to the fix

### Tenant Secrets
- **Not in `.env`** - they're clinic-specific
- **In database** - fetched per request
- **Encrypted** - using `ENCRYPTION_KEY` from `.env`

---

## 📞 Questions?

- **How do I add a new variable?** → See `ENV_VARIABLES_ARCHITECTURE.md` section "Adding New Variables"
- **Where do clinic secrets go?** → Database `integrations` table
- **What if I find hardcoded URLs?** → Refactor to use `config.BACKEND_URL`
- **Can I use `process.env` directly?** → Only in `src/config/index.ts`

---

## ✅ Verification Checklist

Before starting development:

- [ ] `.env` file created from `.env.example`
- [ ] `SUPABASE_URL` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `VAPI_API_KEY` set
- [ ] `OPENAI_API_KEY` set
- [ ] `ENCRYPTION_KEY` generated (64 hex chars) and set
- [ ] `npm run dev` starts successfully
- [ ] Server logs: "✓ Configuration validation passed"

---

## 🚨 This Is Important

This environment configuration is the **foundation of your backend infrastructure**. Follow the rules in these documents, and you'll have a secure, maintainable system. Break them, and you'll have chaos.

**Key rule**: All configuration comes from `src/config/index.ts`. Everything else is implementation detail.
