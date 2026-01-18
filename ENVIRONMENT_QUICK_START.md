# Quick Start: Backend Environment Variables

> **TL;DR**: All configuration comes from `src/config/index.ts`. Use it, not `process.env`.

---

## 🚀 5-Minute Setup

### 1. Copy Template
```bash
cd backend
cp .env.example .env
```

### 2. Fill Required Fields
```bash
# Get these from your deployment platform (Render, AWS, etc.)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VAPI_API_KEY=your-key
OPENAI_API_KEY=sk-proj-...
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 3. Start Server
```bash
npm run dev
# Should see: ✓ Configuration validation passed
```

---

## 💡 Using Config in Your Code

### Import
```typescript
import { config } from '../config';
```

### Access Variables
```typescript
// Application settings
console.log(config.PORT);           // 3001
console.log(config.NODE_ENV);       // production
console.log(config.isProduction()); // true/false

// URLs
console.log(config.BACKEND_URL);
console.log(config.FRONTEND_URL);

// Secrets
const vapi = new Vapi(config.VAPI_API_KEY);
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// CORS
const corsOpts = config.getCorsOptions();
```

---

## 🔑 What Goes Where

### ✅ In `.env` (Platform Secrets)
- `VAPI_API_KEY` (your voice AI master key)
- `OPENAI_API_KEY` (your RAG search key)
- `SUPABASE_SERVICE_ROLE_KEY` (database admin key)
- `ENCRYPTION_KEY` (credential encryption key)
- `BACKEND_URL`, `FRONTEND_URL` (URLs)
- `NODE_ENV`, `PORT`, `LOG_LEVEL` (core config)

### ❌ NOT in `.env` (Tenant Secrets - from Database)
- `TWILIO_ACCOUNT_SID` → Fetch from `integrations` table
- `TWILIO_AUTH_TOKEN` → Fetch from `integrations` table
- `GOOGLE_OAUTH_CREDENTIALS` → Fetch from `integrations` table
- `CLINIC_NAME` → Fetch from `clinics` table

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| `Missing required environment variable: ENCRYPTION_KEY` | Run: `openssl rand -hex 32` and add to `.env` |
| `Cannot find module '../config'` | Make sure path is relative to your file |
| `Server crashes on startup` | Check error message - look in `.env.example` for that variable |
| `config.X is undefined` | Make sure `X` is exported in `src/config/index.ts` |
| `Twilio SMS fails` | Fetch from database, not `.env` - use `IntegrationSettingsService` |

---

## 📖 Full Reference

See `ENV_VARIABLES_ARCHITECTURE.md` for complete documentation.
