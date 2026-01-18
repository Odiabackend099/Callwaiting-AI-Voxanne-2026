# Code Review Checklist: Environment Variables

**Use this checklist when reviewing ANY pull request that touches configuration, environment variables, or credentials.**

---

## ✅ Pre-Review: Quick Scan

- [ ] No new `.env.example` variables? If yes, review against the canonical list
- [ ] No new hardcoded URLs, keys, or credentials? If yes, require refactor
- [ ] No new `process.env` usage? If yes, require change to use `config`

---

## 🔍 Detailed Checks

### 1. Configuration Import
```typescript
// ✅ GOOD
import { config } from '../config';
const port = config.PORT;

// ❌ BAD - Reject these
import * as dotenv from 'dotenv';
const port = process.env.PORT;
const url = process.env.BACKEND_URL || 'http://localhost:3001';
```

**Action**: If found, request refactor to use centralized `config`.

---

### 2. URL Hardcoding
```typescript
// ✅ GOOD
const webhook = `${config.BACKEND_URL}/webhooks/vapi`;

// ❌ BAD - Reject these
const webhook = 'http://localhost:3001/webhooks/vapi';
const webhook = process.env.BACKEND_URL || 'http://api.example.com';
const webhook = 'https://hardcoded-domain.com/api';
```

**Action**: If found, request use of `config.BACKEND_URL` instead.

---

### 3. Credential Handling
```typescript
// ✅ GOOD - Platform secrets from config
const twilio = new Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
// But ONLY if this is fallback; ideally fetch from DB per clinic

// ✓ BETTER - Tenant secrets from database
const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);
const twilio = new Twilio(creds.accountSid, creds.authToken);

// ❌ BAD - Reject these
const twilio = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const vapi = new Vapi(process.env.VAPI_KEY || 'fallback-key');
```

**Action**: If found, request tenant-specific credential fetching.

---

### 4. Validation Logic
```typescript
// ✅ GOOD - Config validates on startup
import { config } from '../config';
// If any required var is missing, server fails immediately

// ❌ BAD - Scattered validation
if (!process.env.VAPI_KEY) throw new Error('Missing VAPI_KEY');
const port = process.env.PORT || 3001;
const url = process.env.BACKEND_URL || 'http://localhost:3001';
```

**Action**: If found, consolidate validation to `config.validate()`.

---

### 5. New Environment Variables
If adding a new variable, verify:

```typescript
// In src/config/index.ts:
// 1. Added to exported config object
export const config = {
  MY_NEW_VAR: getRequired('MY_NEW_VAR'),  // or getOptional()
  // ...
};

// 2. Validated if required
validate(): void {
  const critical = [
    'MY_NEW_VAR',  // ← Added here if critical
    // ...
  ];
}

// In .env.example:
// 3. Documented with comments
# ================================================================================
# MY NEW FEATURE
# ================================================================================
MY_NEW_VAR=description-and-example-here
```

**Checklist**:
- [ ] Variable defined in `config`
- [ ] Added to `config.validate()` if required
- [ ] Documented in `.env.example`
- [ ] No hardcoded fallback values in code
- [ ] No use of `process.env.MY_NEW_VAR` directly

---

## 🚫 Red Flags

**Immediate rejection triggers**:

1. **Direct `process.env` in any file except `config/index.ts`**
   ```typescript
   // ❌ NEVER
   const key = process.env.VAPI_API_KEY;
   ```

2. **Hardcoded URLs or credentials**
   ```typescript
   // ❌ NEVER
   const url = 'http://localhost:3001';
   const key = 'sk-proj-...';
   ```

3. **Multiple configuration sources**
   ```typescript
   // ❌ NEVER
   const url = process.env.BACKEND_URL || 'http://localhost:3001' || config.BACKEND_URL;
   ```

4. **Validation scattered across files**
   ```typescript
   // ❌ NEVER (validation should be in config/index.ts)
   if (!process.env.VAPI_KEY) throw new Error('Missing key');
   ```

5. **Tenant credentials in `.env`**
   ```typescript
   // ❌ NEVER (should be in database)
   TWILIO_SID=AC123...  // This is clinic-specific!
   GOOGLE_TOKEN=ya29...  // This is clinic-specific!
   ```

---

## ✅ Approve When

```typescript
// ✅ Uses centralized config
import { config } from '../config';
const port = config.PORT;

// ✅ Fetches tenant secrets from database
const creds = await IntegrationSettingsService.getTwilioCredentials(orgId);

// ✅ Uses config methods
const cors = config.getCorsOptions();

// ✅ Validates in config, not in code
// (If required var missing, server fails on startup)

// ✅ New vars properly added to config
// - In src/config/index.ts
// - In .env.example with documentation
// - In config.validate() if critical
```

---

## 📋 Full Checklist Template

```markdown
## Environment Variables Review

- [ ] No new `process.env` usage (except in config/index.ts)
- [ ] All URLs use `config.BACKEND_URL`, `config.FRONTEND_URL`, etc.
- [ ] No hardcoded credentials or API keys
- [ ] No duplicate validation logic (centralized in config)
- [ ] New vars added to both config/index.ts and .env.example
- [ ] New critical vars added to config.validate()
- [ ] Tenant credentials fetched from database, not .env
- [ ] All imports use centralized `config`
- [ ] No fallback chains like `env.X || 'default'` in code
- [ ] ENCRYPTION_KEY handling reviewed if relevant

If any are unchecked, request changes before approval.
```

---

## 🎓 Why This Matters

- **Security**: Centralized credential handling prevents leaks
- **Maintainability**: Single source of truth for all config
- **Reliability**: Early validation prevents runtime surprises
- **Scalability**: Easy to add new variables without breaking things
- **Professionalism**: Shows discipline in codebase management

---

## 🚀 When in Doubt

Ask: **"Is this configuration, credential, or URL?"**

- **Configuration** (NODE_ENV, PORT, LOG_LEVEL) → In `config`
- **Platform Credential** (VAPI_API_KEY, ENCRYPTION_KEY) → In `config`
- **Tenant Credential** (TWILIO_SID, GOOGLE_TOKEN) → In database
- **URL** (BACKEND_URL, WEBHOOK_URL) → In `config`

If it doesn't belong in `.env`, it shouldn't be read from `process.env`.

---

**Keep this checklist visible during code review. Reference it by line number in PRs.**
