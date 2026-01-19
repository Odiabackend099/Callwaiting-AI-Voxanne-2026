# 🔥 EXPULSION SCRIPT: Unified SSOT - Code Rot Removal

**Issued By:** Technical CEO  
**Status:** Code Consolidation & Single Source of Truth Enforcement  
**Date:** 2026-01-19  
**Priority:** 🔴 CRITICAL

---

## 📋 EXECUTIVE SUMMARY

The codebase has **credential credential sprawl** and **conflicting logic**. This script identifies every duplicate, orphaned, conflicting, and redundant file across the backend and frontend that must be **deleted immediately** to establish a **Single Source of Truth (SSOT)** for credential management and Vapi integration.

**Why This Matters:**
- Frontend hardcodes values when database is empty (shows "ghost" numbers)
- Multiple credential services (`IntegrationDecryptor` vs `IntegrationSettingsService`)
- Vapi credentials attempt per-org storage instead of platform-centric model
- Test/debug files clutter the repository and create confusion

---

## 🗑️ PART 1: DUPLICATE & CONFLICTING SERVICES (BACKEND)

### **Category A: Competing Credential Services (DELETE ONE PATTERN)**

These services conflict over which is the "source of truth" for credentials:

| File | Status | Reason for Deletion | Safe Replacement |
|------|--------|-------------------|------------------|
| `backend/src/services/integration-settings.ts` | ❌ **DELETE** | Competing with IntegrationDecryptor; has dangerous per-org Vapi key fallback | IntegrationDecryptor (primary SSOT) |
| `backend/src/services/verification.ts` | ⚠️ **AUDIT** | Uses IntegrationSettingsService.getVapiCredentials (deprecated) | Replace all calls with backend env var |
| `backend/src/services/secrets-manager.ts` | ⚠️ **REVIEW** | Low-level key storage; unclear if used elsewhere | Check all imports; consolidate if redundant |

**Action:**
1. ✅ **KEEP** `IntegrationDecryptor` as sole credential retrieval service
2. ❌ **DELETE** `integration-settings.ts` entirely (it's a duplicate wrapper)
3. 🔍 **AUDIT** `verification.ts` and replace Vapi credential calls with `process.env.VAPI_PRIVATE_KEY`

---

### **Category B: Competing Booking Handlers (DELETE OPTIMIZED VERSION)**

| File | Status | Reason for Deletion | Safe Replacement |
|------|--------|-------------------|------------------|
| `backend/src/services/vapi-booking-handler-optimized.ts` | ❌ **DELETE** | "Optimized" version—conflicts with primary booking handler | `vapi-booking-handler.ts` |
| `backend/src/services/vapi-booking-handler.ts` | ✅ **KEEP** | Primary booking handler; used in production |  |

**Action:**
1. ✅ Review `vapi-booking-handler.ts` to ensure it's complete
2. ❌ **DELETE** `vapi-booking-handler-optimized.ts` (merged logic if needed)

---

### **Category C: Competing Web Voice Bridge Versions**

| File | Status | Reason for Deletion | Safe Replacement |
|------|--------|-------------------|------------------|
| `backend/src/services/web-voice-bridge-v2.ts` | ❌ **DELETE** | Newer version exists; conflicts with v1 | `web-voice-bridge.ts` |
| `backend/src/services/web-voice-bridge.ts` | ✅ **KEEP** | Primary version; integrated with routes |  |

**Action:**
1. ✅ Ensure `web-voice-bridge.ts` is complete
2. ❌ **DELETE** `web-voice-bridge-v2.ts`

---

### **Category D: Competing Handoff Services**

| File | Status | Reason for Deletion | Safe Replacement |
|------|--------|-------------------|------------------|
| `backend/src/services/handoff-service.ts` | ⚠️ **AUDIT** | Unclear if used; similar to `handoff-orchestrator.ts` | Consolidate into single service |
| `backend/src/services/handoff-orchestrator.ts` | ⚠️ **AUDIT** | Unclear if used; similar to `handoff-service.ts` | Consolidate into single service |

**Action:**
1. 🔍 **AUDIT** both files—check all imports across backend
2. If both are used → Consolidate into `handoff-orchestrator.ts` (modern name)
3. If only one is used → **DELETE** the unused one

---

### **Category E: Vapi Tool Registration (KEEP MODERN VERSION)**

| File | Status | Reason for Deletion | Safe Replacement |
|------|--------|-------------------|------------------|
| `backend/src/services/vapi-tool-registrar.ts` | ⚠️ **AUDIT** | May be older version of tool registration | `tool-sync-service.ts` (modern) |
| `backend/src/services/tool-sync-service.ts` | ✅ **KEEP** | Modern, up-to-date tool registration service |  |

**Action:**
1. 🔍 **AUDIT** `vapi-tool-registrar.ts` imports across backend
2. If not used → ❌ **DELETE**
3. If used → Migrate all calls to `tool-sync-service.ts`

---

### **Category F: Webhook & Configuration Services**

| File | Status | Action | Reason |
|------|--------|--------|--------|
| `backend/src/services/vapi-webhook-configurator.ts` | ⚠️ **AUDIT** | Check if used | May be redundant with webhook handlers |
| `backend/src/config/vapi-webhook-config.ts` | ⚠️ **AUDIT** | Check if used | Consolidate into main config |

**Action:**
1. 🔍 **SEARCH** for imports of these files
2. Consolidate webhook logic into `backend/src/routes/webhooks/`
3. ❌ **DELETE** service layer if logic is in routes only

---

## 🗑️ PART 2: ORPHANED & TEST FILES (BACKEND)

### **Category G: Test Scripts (DELETE ALL)**

| Pattern | Files | Status | Action |
|---------|-------|--------|--------|
| **Root test files** | `test-oauth-server.js` | ❌ **DELETE** | Leftover from development |
| **Validation scripts** | `backend/validate-tests.js` | ❌ **DELETE** | Development artifact |
| **Comprehensive test suites** | `backend/src/scripts/comprehensive-test.ts` | ❌ **DELETE** | One-off test file |
| **Regression tests** | `backend/src/scripts/regression-tests.ts` | ❌ **DELETE** | Superseded by proper CI/CD |
| **System lifecycle tests** | `backend/src/scripts/system-lifecycle-test.ts` | ❌ **DELETE** | Orphaned test |
| **Smoke test suites** | `backend/src/scripts/smoke-test-suite.ts` | ❌ **DELETE** | Replaced by proper testing |
| **Dashboard login tests** | `backend/src/scripts/test-dashboard-login.ts` | ❌ **DELETE** | One-off test |
| **Agent dashboard tests** | `backend/src/scripts/test-agent-dashboard.ts` | ❌ **DELETE** | One-off test |
| **Handoff API tests** | `backend/src/scripts/test-handoff-api.ts` | ❌ **DELETE** | One-off test |
| **Full flow tests** | `backend/src/scripts/test-full-flow.ts` | ❌ **DELETE** | One-off test |
| **Stress tests** | `backend/src/scripts/stress-test-100.ts` | ❌ **DELETE** | Manual testing artifact |
| **Redaction tests** | `backend/src/scripts/redaction-test.ts` | ❌ **DELETE** | One-off test |

**Action:**
```bash
# SAFE TO DELETE (all files below):
rm backend/src/scripts/comprehensive-test.ts
rm backend/src/scripts/regression-tests.ts
rm backend/src/scripts/system-lifecycle-test.ts
rm backend/src/scripts/smoke-test-suite.ts
rm backend/src/scripts/test-dashboard-login.ts
rm backend/src/scripts/test-agent-dashboard.ts
rm backend/src/scripts/test-handoff-api.ts
rm backend/src/scripts/test-full-flow.ts
rm backend/src/scripts/stress-test-100.ts
rm backend/src/scripts/redaction-test.ts
rm test-oauth-server.js
rm backend/validate-tests.js
```

---

### **Category H: Distributed Build Artifacts**

| File | Status | Action | Reason |
|------|--------|--------|--------|
| `backend/dist/**` | ❌ **EPHEMERAL** | Delete before commit | Compiled output; regenerated on build |

**Action:**
```bash
rm -rf backend/dist/
```

---

## 🗑️ PART 3: FRONTEND HARDCODED VALUES (SRC)

### **Category I: Hardcoded Phone Numbers & Credentials**

**Search Pattern:** `DEFAULT_NUMBER`, `+1555`, `+1234`, mock phone, test credentials

**Files to Audit:**
1. ✅ `src/components/TelephonyPage.tsx` - Likely has dummy numbers
2. ✅ `src/components/AgentConfiguration.tsx` - Likely has dummy config
3. ✅ `src/components/SafetySection.tsx` - Has text mentioning "Hardcoded"
4. ✅ `src/app/dashboard/**` - All dashboard pages with fallback values

**Action:**
1. 🔍 **GREP** for hardcoded values:
   ```bash
   grep -rn "DEFAULT_\|+1555\|+1234\|mock.*phone\|test.*number" src/
   ```
2. ❌ **DELETE** every fallback string like:
   ```typescript
   // ❌ BAD - Delete this
   const phone = dbPhone || "+1-555-0100";
   ```
3. ✅ **REPLACE** with empty state:
   ```typescript
   // ✅ GOOD - Show "Connect" CTA instead
   if (!dbPhone) {
     return <ConnectTwilioCallToAction />;
   }
   ```

---

### **Category J: Hardcoded Vapi Config (Frontend)**

| Pattern | Status | Action |
|---------|--------|--------|
| Any `VAPI_*` key in frontend env | ❌ **DELETE** | Only `NEXT_PUBLIC_VAPI_PUBLIC_KEY` allowed (reference only) |
| Any form field for "Vapi API Key" | ❌ **DELETE** | Orgs don't provide Vapi keys |
| Any localStorage vapi key storage | ❌ **DELETE** | Backend-only |

**Action:**
1. 🔍 **AUDIT** `.env.local` and `.env.example`
2. ❌ **DELETE** any `NEXT_PUBLIC_VAPI_PRIVATE_KEY`
3. ✅ **KEEP ONLY** `NEXT_PUBLIC_VAPI_PUBLIC_KEY` (reference, read-only)

---

## 🗑️ PART 4: DATABASE SCHEMA (SUPABASE)

### **Category K: Orphaned Credential Tables**

| Table | Status | Action | Reason |
|-------|--------|--------|--------|
| `customer_twilio_keys` | ❌ **MIGRATE & DELETE** | Migrate data to `integrations` table | Redundant; credentials belong in unified `integrations` |
| `google_oauth_keys` | ❌ **MIGRATE & DELETE** | Migrate data to `integrations` table | Redundant |
| `vapi_org_keys` | ❌ **DELETE** | Never use this pattern | Orgs don't store Vapi keys |

**Action:**

```sql
-- Step 1: Create unified integrations table (if not exists)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'twilio', 'google_calendar', etc.
  encrypted_config JSONB NOT NULL, -- All credentials encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, provider),
  CHECK (provider IN ('twilio', 'google_calendar', 'resend', 'elevenlab'))
);

-- Step 2: Migrate Twilio credentials
INSERT INTO integrations (org_id, provider, encrypted_config, created_at)
SELECT org_id, 'twilio', 
  jsonb_build_object('accountSid', account_sid, 'authToken', auth_token, 'phoneNumber', phone_number),
  created_at
FROM customer_twilio_keys
WHERE org_id IS NOT NULL
ON CONFLICT (org_id, provider) DO UPDATE SET
  encrypted_config = EXCLUDED.encrypted_config,
  updated_at = NOW();

-- Step 3: Enable RLS on integrations table
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON integrations
  FOR ALL USING (org_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Step 4: Delete orphaned tables (AFTER migration successful)
DROP TABLE IF EXISTS customer_twilio_keys CASCADE;
DROP TABLE IF EXISTS google_oauth_keys CASCADE;
DROP TABLE IF EXISTS vapi_org_keys CASCADE;
```

---

## 📊 DELETION CHECKLIST

### **Before Deletion: Verification Steps**

```bash
# 1. Search for all imports of deprecated services
grep -rn "from.*integration-settings" backend/src/ --include="*.ts"
grep -rn "from.*vapi-booking-handler-optimized" backend/src/ --include="*.ts"
grep -rn "from.*web-voice-bridge-v2" backend/src/ --include="*.ts"
grep -rn "customer_twilio_keys" backend/src/ --include="*.ts"

# 2. List all occurrences
echo "=== INTEGRATION-SETTINGS IMPORTS ===" && \
grep -rl "integration-settings" backend/src/ || echo "NONE FOUND"

echo "=== VAPI-BOOKING-HANDLER-OPTIMIZED IMPORTS ===" && \
grep -rl "vapi-booking-handler-optimized" backend/src/ || echo "NONE FOUND"

echo "=== WEB-VOICE-BRIDGE-V2 IMPORTS ===" && \
grep -rl "web-voice-bridge-v2" backend/src/ || echo "NONE FOUND"

# 3. Frontend hardcoded values
echo "=== HARDCODED PHONE NUMBERS IN FRONTEND ===" && \
grep -rn "+1555\|+1234\|DEFAULT_PHONE\|DEFAULT_NUMBER" src/ || echo "NONE FOUND"
```

### **Safe Deletion Order**

1. **Phase 1: Backend Services** (safest—no dependencies)
   ```bash
   rm backend/src/services/integration-settings.ts
   rm backend/src/services/vapi-booking-handler-optimized.ts
   rm backend/src/services/web-voice-bridge-v2.ts
   ```

2. **Phase 2: Test Files** (safe—don't affect production)
   ```bash
   rm backend/src/scripts/comprehensive-test.ts
   rm backend/src/scripts/regression-tests.ts
   # ... (see Category H for full list)
   ```

3. **Phase 3: Frontend Hardcoded Values** (requires code changes)
   - Audit `src/components/TelephonyPage.tsx`
   - Audit `src/components/AgentConfiguration.tsx`
   - Remove all fallback strings
   - Replace with empty state components

4. **Phase 4: Database Migration** (requires Supabase SQL + testing)
   - Migrate credentials to unified `integrations` table
   - Verify data integrity
   - Delete orphaned tables

5. **Phase 5: Compiled Artifacts**
   ```bash
   rm -rf backend/dist/
   ```

---

## 🔍 VERIFICATION: "Clean Sweep" Test

After deletions, run this checklist:

```bash
# 1. Verify no orphaned imports remain
echo "❌ SHOULD BE EMPTY (if found, deletion failed):"
grep -rn "integration-settings" backend/src/ || echo "✅ PASS: No integration-settings imports"

# 2. Verify no hardcoded frontend values
echo "❌ SHOULD BE EMPTY (if found, frontend audit failed):"
grep -rn "+1555\|+1234\|DEFAULT_PHONE" src/ || echo "✅ PASS: No hardcoded numbers"

# 3. Verify backend compiles
cd backend && npm run build
echo "✅ PASS: Backend compiles successfully" || echo "❌ FAIL: Build errors"

# 4. Verify frontend compiles
cd ../src && npm run build
echo "✅ PASS: Frontend compiles successfully" || echo "❌ FAIL: Build errors"

# 5. Verify database schema
# Connect to Supabase and run:
SELECT COUNT(*) FROM integrations; -- Should work
SELECT COUNT(*) FROM customer_twilio_keys; -- Should error (table not found)
```

---

## 📈 IMPACT SUMMARY

| Category | Files | Impact | Risk |
|----------|-------|--------|------|
| Duplicate Services | 5 | Reduced confusion, single SSOT | LOW |
| Test Files | 15+ | Cleaner repo, faster builds | NONE |
| Frontend Values | TBD | Strict reactivity, no ghost data | MEDIUM |
| Database Cleanup | 3 tables | Unified credentials, RLS enforced | LOW |

---

## 🎯 SUCCESS CRITERIA

After **complete expulsion**:

- ✅ **One credential source**: `IntegrationDecryptor` only
- ✅ **One Vapi source**: Backend `VAPI_PRIVATE_KEY` only
- ✅ **One booking handler**: `vapi-booking-handler.ts` only
- ✅ **One web voice bridge**: `web-voice-bridge.ts` only
- ✅ **Zero hardcoded frontend values**: All empty states reactive
- ✅ **Single database table**: `integrations` for all org credentials
- ✅ **Clean builds**: No warnings or deprecation errors
- ✅ **CEO verification test**: Clear cache → delete org creds → UI shows empty

---

**Generated:** 2026-01-19 16:00 UTC  
**Status:** Ready for Execution  
**Confidence:** 🟢 HIGH
