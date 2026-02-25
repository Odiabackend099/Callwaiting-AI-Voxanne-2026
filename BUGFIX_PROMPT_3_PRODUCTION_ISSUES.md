# Production Bug Fix Prompt — 3 Critical Issues
**Date:** February 24, 2026
**Priority:** CRITICAL — Production bugs blocking E2E testing
**Methodology:** Follow `.agent/3 step coding principle.md` (Plan → Document → Execute)

---

## INSTRUCTIONS FOR AI AGENT

You are a senior full-stack engineer fixing 3 critical production bugs in the Voxanne AI platform. Before writing ANY code, you MUST:

1. **Read these files first** (mandatory — do NOT skip):
   - `.agent/3 step coding principle.md` — Your working methodology
   - `testsprite_tests/tmp/prd_files/prd.md` — Master PRD (product requirements)
   - `DATABASE_SSOT_VERIFICATION.md` — Database schema single source of truth
   - `.claude/CLAUDE.md` — Critical invariants section (NEVER BREAK THESE)

2. **Follow the 3-step coding principle**:
   - **Step 1:** Plan — Break down each bug, ask clarifying questions, summarize
   - **Step 2:** Create `planning.md` — Document implementation phases
   - **Step 3:** Execute phase by phase — One fix at a time, test each before advancing

3. **Deploy agent teams** — Use parallel agents where bugs are independent:
   - Agent 1: CSRF Token Fix (Bug 1)
   - Agent 2: Phone Provisioning Fixes (Bug 2 + Bug 3 — interconnected)

4. **Do NOT hallucinate** — Read existing code before modifying. Understand the infrastructure.

---

## BUG 1: CSRF Token Missing on Voice Preview

### Symptoms
- User clicks "Preview Voice" on Agent Config page (`/dashboard/agent-config`)
- Two red error banners appear: "CSRF token missing"
- Voice preview audio does not play

### Root Cause Analysis

The voice preview endpoint is `POST /api/founder-console/agent/voice-preview` (file: `backend/src/routes/founder-console-v2.ts` line 1292).

The CSRF middleware (`backend/src/middleware/csrf-protection.ts`) validates tokens on ALL POST/PUT/PATCH/DELETE requests in production (`backend/src/server.ts` lines 286-288):

```typescript
// server.ts lines 286-288
if (process.env.NODE_ENV !== 'development') {
  app.use(validateCsrfToken); // Validate on state-changing requests (production only)
}
```

The `validateCsrfToken` middleware (line 62-73 of csrf-protection.ts) has a `skipPaths` array:
```typescript
const skipPaths = [
  '/health',
  '/health/check',
  '/api/webhooks',
  '/api/vapi/tools',
  '/api/assistants/sync',
  '/api/chat-widget',
];
```

**The voice preview endpoint `/api/founder-console/agent/voice-preview` is NOT in the skip list.**

The frontend (`src/lib/authed-backend-fetch.ts` lines 87-116) DOES fetch a CSRF token via `GET /api/csrf-token` and includes it in `X-CSRF-Token` header for POST requests. However, the issue is one of:

1. **The CSRF token fetch is failing** — The `getCsrfToken()` function (line 87) silently catches errors and returns `null`. If the CSRF token endpoint fails or returns unexpected data, the token is never cached and the POST proceeds without it.

2. **The voice preview uses a different fetch path** — Check if the voice preview call in `src/app/dashboard/agent-config/page.tsx` uses `authedBackendFetch` or a raw `fetch()`. If it uses raw `fetch()`, it won't include the CSRF token.

### Files to Investigate
- `src/app/dashboard/agent-config/page.tsx` — Search for `voice-preview` to find how the preview request is made
- `src/lib/authed-backend-fetch.ts` — Lines 83-116, CSRF token fetching logic
- `backend/src/middleware/csrf-protection.ts` — Lines 54-95, validation logic
- `backend/src/server.ts` — Lines 282-291, CSRF middleware mounting

### Fix Options (choose ONE)

**Option A (Recommended): Add voice-preview to CSRF skip list**

Voice preview is a READ operation (fetching an audio file) despite being POST. It doesn't modify state. Add it to the skip list:

```typescript
// backend/src/middleware/csrf-protection.ts, line 62
const skipPaths = [
  '/health',
  '/health/check',
  '/api/webhooks',
  '/api/vapi/tools',
  '/api/assistants/sync',
  '/api/chat-widget',
  '/api/founder-console/agent/voice-preview', // READ-only: serves static audio samples
];
```

**Option B: Fix CSRF token propagation in frontend**

If the CSRF token fetch is failing silently, fix the `getCsrfToken()` function to retry or handle errors properly. But this is less targeted — Option A is safer.

**Option C: Convert voice-preview to GET**

Since it serves static audio files, it could be a GET endpoint. But this requires changing both backend route and all frontend callers.

### Verification
After fix:
1. Deploy backend
2. Navigate to `/dashboard/agent-config`
3. Click "Preview Voice" on any voice
4. Verify: No CSRF error, audio plays
5. Verify: Other POST endpoints still validate CSRF (test agent save)

---

## BUG 2: UK Phone Numbers Require AddressSid

### Symptoms
- User tries to buy UK number `+441313810603`
- Error: "Purchase Failed - Failed to purchase number: Phone Number Requires an Address but the 'AddressSid' parameter was empty."
- US numbers sometimes work (e.g., `+12525080967` succeeded)

### Root Cause

Twilio regulatory compliance requires an Address resource for certain countries (UK, many EU countries). The UK's Ofcom regulation mandates a physical address be associated with any purchased phone number.

The current provisioning code in `backend/src/services/managed-telephony-service.ts` (line 427-429) purchases numbers without an AddressSid:

```typescript
// Line 427-429 — MISSING AddressSid
purchasedNumber = await subClient.incomingPhoneNumbers.create({
  phoneNumber: selectedNumber,
});
```

### Files to Modify
- `backend/src/services/managed-telephony-service.ts` — Lines 424-439 (purchase step)
- `backend/src/routes/managed-telephony.ts` — May need to accept address info from frontend
- `src/components/dashboard/BuyNumberModal.tsx` — May need UI for address input (future)

### Fix Strategy

**Phase 1 (Immediate): Create a Twilio Address resource automatically**

Before purchasing a non-US number, create a Twilio Address resource using the organization's name and a default business address. This unblocks purchasing for UK numbers:

```typescript
// In managed-telephony-service.ts, before the purchase step (line 424):

// Step 4.5: For countries requiring regulatory compliance (UK, etc.),
// create or reuse a Twilio Address resource
let addressSid: string | undefined;
const countriesRequiringAddress = ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'AU'];

if (countriesRequiringAddress.includes(country)) {
  try {
    // Check if org already has a Twilio address
    const existingAddresses = await subClient.addresses.list({ limit: 1 });

    if (existingAddresses.length > 0) {
      addressSid = existingAddresses[0].sid;
    } else {
      // Create address using org info
      // NOTE: In a future phase, collect real address from the user via UI
      const address = await subClient.addresses.create({
        customerName: org.name || 'Business',
        street: 'Address Required', // Placeholder — user should update
        city: 'London',
        region: 'England',
        postalCode: 'EC1A 1BB',
        isoCountry: country,
        friendlyName: `${org.name} - Managed Number Address`,
      });
      addressSid = address.sid;
    }

    log.info('ManagedTelephony', 'Address resource ready', { orgId, addressSid, country });
  } catch (addrErr: any) {
    log.error('ManagedTelephony', 'Failed to create address', { orgId, error: addrErr.message });
    return {
      success: false,
      error: `Address creation required for ${country} numbers: ${addrErr.message}`,
      failedStep: 'purchase',
      canRetry: true,
      userMessage: `Phone numbers in ${country} require a registered business address. Please contact support to set up your address before purchasing.`
    };
  }
}

// Then modify the purchase call:
purchasedNumber = await subClient.incomingPhoneNumbers.create({
  phoneNumber: selectedNumber,
  ...(addressSid ? { addressSid } : {}),
});
```

**Phase 2 (Future): Add address collection UI**

Add an address form in `BuyNumberModal.tsx` that appears when the user selects a country requiring an address (UK, DE, FR, etc.). Store the address in a new `org_addresses` table or on `twilio_subaccounts`.

### Verification
1. Deploy backend
2. Open Phone Settings → Buy Number → Select UK
3. Search for UK numbers
4. Select and purchase a UK number
5. Verify: Number provisions successfully
6. Verify: Number appears in Phone Settings and managed_phone_numbers table

---

## BUG 3: Cannot Buy Second Number for Outbound

### Symptoms
- User already has inbound number `+12525080967`
- Tries to buy outbound number `+13292191166`
- Error: "Your organization already has a managed phone number (+12525080967). Please delete it before provisioning a new one."

### Root Cause Analysis

The error message comes from `backend/src/services/phone-validation-service.ts`. However, the validation service IS direction-aware (see lines 176-246). The `validateCanProvision()` method correctly checks per-direction:

```typescript
// phone-validation-service.ts lines 181-211
if (direction === 'inbound' && directionStatus.hasInbound) {
  // Block only if same direction
}
if (direction === 'outbound' && directionStatus.hasOutbound) {
  // Block only if same direction
}
```

The problem is that the error message shown doesn't match the validation service code. The message "Your organization already has a managed phone number" is a GENERIC message. This means the error is likely coming from a DIFFERENT validation path.

**Key discovery:** Look at `managed-telephony.ts` line 89:
```typescript
const validation = await PhoneValidationService.validateCanProvision(orgId, direction);
```

The `direction` parameter is passed from `req.body.direction` (line 48). But in the frontend `BuyNumberModal.tsx`, the `provisionNumber` function (line 151-153) sends:
```typescript
body: JSON.stringify({ country, numberType, areaCode, direction }),
```

So the `direction` IS being sent. The issue must be in:

1. **The `checkOrgPhoneStatus()` call on line 217 inside `validateCanProvision()`** — For inbound direction only, it also checks BYOC credentials in `org_credentials`. If the FIRST managed number was stored in `org_credentials` (which it is — see managed-telephony-service.ts line 600), this check might falsely detect it as a BYOC number blocking provisioning.

2. **OR the `checkDirectionStatus()` method** — It queries `managed_phone_numbers` table. The first purchased number might have been stored with `routing_direction = 'inbound'` or maybe NULL.

3. **OR the `insert_managed_number_atomic` RPC function** — It might have a unique constraint that prevents two numbers per org.

### Investigation Steps

**CRITICAL: You MUST run these queries to identify the actual blocker:**

```sql
-- Check what's in managed_phone_numbers for the org
SELECT id, phone_number, routing_direction, status, vapi_phone_id
FROM managed_phone_numbers
WHERE org_id = '<ORG_ID>'
ORDER BY created_at DESC;

-- Check what's in org_credentials
SELECT id, provider, is_managed, is_active
FROM org_credentials
WHERE org_id = '<ORG_ID>'
AND provider = 'twilio';

-- Check the insert_managed_number_atomic function for constraints
-- Look for unique constraints or checks that prevent multiple numbers
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'insert_managed_number_atomic';
```

### Most Likely Root Cause

The `insert_managed_number_atomic` RPC function (referenced at managed-telephony-service.ts line 521) likely has a unique constraint or check that only allows ONE managed number per org. This needs to be updated to allow one-per-direction.

### Fix Strategy

**Step 1: Check the `insert_managed_number_atomic` function**

Read the SQL migration that created this function. Look for:
- `UNIQUE (org_id)` constraints on `managed_phone_numbers`
- Checks like `IF EXISTS (SELECT 1 FROM managed_phone_numbers WHERE org_id = p_org_id ...)`
- Any single-number-per-org enforcement

```bash
# Find the migration file
grep -r "insert_managed_number_atomic" backend/supabase/migrations/
```

**Step 2: Update the atomic function to be direction-aware**

The constraint should be `UNIQUE (org_id, routing_direction)` instead of `UNIQUE (org_id)`.

If the function checks for existing numbers, it should check:
```sql
-- BEFORE (blocks all provisioning if any number exists):
IF EXISTS (SELECT 1 FROM managed_phone_numbers WHERE org_id = p_org_id AND status = 'active') THEN
  RAISE EXCEPTION 'Organization already has a managed number';
END IF;

-- AFTER (only blocks if same direction exists):
IF EXISTS (SELECT 1 FROM managed_phone_numbers WHERE org_id = p_org_id AND routing_direction = p_routing_direction AND status = 'active') THEN
  RAISE EXCEPTION 'Organization already has a managed % number', p_routing_direction;
END IF;
```

**Step 3: Verify the org_credentials SSOT write**

In `managed-telephony-service.ts` lines 564-618, the code correctly handles the second number case:
- First number: writes to `org_credentials` (line 600)
- Second number: skips `org_credentials` write (line 609-617)

This is correct. The `managed_phone_numbers` table is the SSOT for number-specific data.

**Step 4: Verify outbound functions pick up the outbound number**

Check these files to ensure they read from `managed_phone_numbers` for the outbound number:
- `backend/src/services/phone-number-resolver.ts` — Must resolve outbound number from `managed_phone_numbers WHERE routing_direction = 'outbound'`
- `backend/src/routes/contacts.ts` — The callback endpoint must use the outbound number
- `backend/src/utils/outbound-call-preflight.ts` — Must validate against outbound number

**CRITICAL INVARIANTS (from `.claude/CLAUDE.md`):**
- NEVER remove `vapi_phone_number_id` from agent-sync writes
- NEVER change `.maybeSingle()` back to `.single()` on outbound agent queries
- NEVER pass raw phone strings as Vapi `phoneNumberId` — always use UUIDs
- ALWAYS use `resolveOrgPhoneNumberId()` from phone-number-resolver.ts

### Verification
1. Purchase first number as inbound (should succeed)
2. Purchase second number as outbound (should succeed)
3. Verify both numbers appear in Phone Settings page
4. Verify: `managed_phone_numbers` table has 2 rows (one inbound, one outbound)
5. Verify: `org_credentials` has subaccount creds (from first number only)
6. Verify: Outbound call uses the outbound number's vapiPhoneId
7. Verify: Inbound call routes to the inbound number

---

## CRITICAL FILES REFERENCE

### Backend Files (ordered by importance)

| File | Purpose | Bug |
|------|---------|-----|
| `backend/src/middleware/csrf-protection.ts` | CSRF validation middleware | Bug 1 |
| `backend/src/server.ts` | Middleware mounting, CSRF config | Bug 1 |
| `backend/src/services/managed-telephony-service.ts` | Phone provisioning service (650+ lines) | Bug 2, 3 |
| `backend/src/services/phone-validation-service.ts` | Per-direction validation | Bug 3 |
| `backend/src/routes/managed-telephony.ts` | Provisioning API routes | Bug 2, 3 |
| `backend/src/routes/phone-settings.ts` | Phone status API | Bug 3 |
| `backend/src/routes/founder-console-v2.ts` | Voice preview endpoint (line 1292) | Bug 1 |
| `backend/src/services/phone-number-resolver.ts` | Resolves Vapi phone UUID | Bug 3 |
| `backend/src/utils/outbound-call-preflight.ts` | Outbound call validation | Bug 3 |
| `backend/src/routes/contacts.ts` | Callback endpoint | Bug 3 |

### Frontend Files

| File | Purpose | Bug |
|------|---------|-----|
| `src/lib/authed-backend-fetch.ts` | CSRF token fetch + auth | Bug 1 |
| `src/app/dashboard/agent-config/page.tsx` | Agent config page | Bug 1 |
| `src/components/dashboard/BuyNumberModal.tsx` | Number purchase modal | Bug 2, 3 |
| `src/app/dashboard/phone-settings/page.tsx` | Phone settings page | Bug 3 |

### Database (check via Supabase)

| Table | Purpose | Bug |
|-------|---------|-----|
| `managed_phone_numbers` | SSOT for managed numbers | Bug 2, 3 |
| `org_credentials` | SSOT for org telephony creds | Bug 3 |
| `twilio_subaccounts` | Subaccount tracking | Bug 2 |
| `phone_number_mapping` | Number-to-Vapi mapping | Bug 3 |

### Migration Files (search for these)

```bash
grep -rl "insert_managed_number_atomic" backend/supabase/migrations/
grep -rl "managed_phone_numbers" backend/supabase/migrations/
```

---

## EXECUTION ORDER

### Phase 1: Bug 1 — CSRF Fix (5 minutes)
1. Add `/api/founder-console/agent/voice-preview` to CSRF skip list
2. Test: Voice preview plays without error
3. Commit: `fix: Add voice-preview to CSRF skip list (read-only endpoint)`

### Phase 2: Bug 2 — UK Address Fix (30 minutes)
1. Read `managed-telephony-service.ts` purchase step
2. Add address resource creation for countries requiring it
3. Test: UK number purchase succeeds
4. Commit: `fix: Create Twilio address resource for UK/EU number purchases`

### Phase 3: Bug 3 — Multi-Number Fix (1 hour)
1. Find and read the `insert_managed_number_atomic` migration
2. Identify the unique constraint or check blocking second numbers
3. Update constraint to be per-direction: `UNIQUE (org_id, routing_direction)`
4. Verify phone-number-resolver reads outbound number correctly
5. Test: Can buy inbound + outbound numbers for same org
6. Test: Outbound calls use the outbound number
7. Commit: `fix: Allow one inbound + one outbound managed number per org`

### Phase 4: Verification
1. Run full E2E test (see `E2E_TEST_BROWSER_MCP_PROMPT.md`)
2. Verify all 3 bugs are fixed
3. Verify no regressions (existing inbound calling still works)

---

## AGENT TEAM DEPLOYMENT

Deploy these agents in parallel:

### Agent 1: CSRF + Voice Preview Fix
**Scope:** Bug 1 only
**Files:** `backend/src/middleware/csrf-protection.ts`
**Time:** 5 minutes
**Risk:** Low (adding to skip list)

### Agent 2: Phone Provisioning Fixes
**Scope:** Bug 2 + Bug 3
**Files:** `managed-telephony-service.ts`, `phone-validation-service.ts`, migration files
**Time:** 1-2 hours
**Risk:** Medium (database changes, must not break existing numbers)

### Agent 3: Verification Agent
**Scope:** Test all fixes
**Files:** Read-only verification
**Time:** 30 minutes
**Depends on:** Agents 1 and 2 completing

---

## TESTING CHECKLIST

```
Bug 1 — CSRF:
  [ ] Voice preview plays on Agent Config page
  [ ] No "CSRF token missing" error
  [ ] Agent save still works (CSRF validated for save)
  [ ] Other POST endpoints still protected

Bug 2 — UK Numbers:
  [ ] UK number search returns results
  [ ] UK number purchase succeeds (no AddressSid error)
  [ ] US number purchase still works
  [ ] Address resource created in Twilio subaccount

Bug 3 — Two Numbers:
  [ ] Can buy inbound number (first number)
  [ ] Can buy outbound number (second number)
  [ ] Both numbers appear in Phone Settings
  [ ] managed_phone_numbers has 2 rows (one per direction)
  [ ] Outbound call uses outbound number's vapiPhoneId
  [ ] Inbound call routes to inbound number
  [ ] org_credentials has correct subaccount creds
  [ ] Deleting one number doesn't affect the other
```

---

## DO NOT BREAK THESE (from CLAUDE.md Critical Invariants)

1. **Never remove `vapi_phone_number_id` from agent-sync writes**
2. **Never change `.maybeSingle()` back to `.single()` on outbound agent queries**
3. **Never pass raw phone strings as Vapi `phoneNumberId`** — always use UUIDs
4. **Never remove the phone number auto-resolution fallback in contacts.ts**
5. **Never remove the pre-flight assertion in `createOutboundCall()`**
6. **Never auto-recreate Vapi assistants in error handlers**

---

**END OF PROMPT — Fix all 3 bugs, test thoroughly, deploy to production.**
