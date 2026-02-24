# PRD Update: 2026-02-24 — Multi-Number Support & SSOT Reconciliation

**Date:** 2026-02-24
**Version:** 2026.38.0
**Change Type:** CRITICAL DATABASE ARCHITECTURE FIX + SSOT CLARIFICATION
**Status:** ✅ PRODUCTION DEPLOYED - Outbound number provisioning now works

---

## Executive Summary

This update reconciles the Product Requirement Document (PRD) with the Single Source of Truth (SSOT) database documentation. Key changes:

1. **Multi-Number Support Enabled** — Organizations can now hold 1 inbound + 1 outbound phone number (Bug 3 fixed)
2. **SSOT Clarification** — Removed confusing dual-write language, clarified that `org_credentials` is the primary credential SSOT
3. **Removed Conflicting Logic** — Eliminated the "skip for 2nd number" pattern that was blocking outbound number provisioning
4. **Database Schema Finalized** — RPC function now correctly uses `p_routing_direction` parameter

---

## Section 1: Multi-Number Support Architecture

### What Changed

**BEFORE (Bug 3 — BROKEN):**
- Constraint: `UNIQUE(org_id, provider)` on `org_credentials` — blocked ANY second Twilio row
- RPC parameter: `p_type` — mismatched with unique index on `routing_direction` column
- Service logic: Skipped org_credentials write for 2nd number (data corruption)

**AFTER (FIXED):**
- Constraint: `UNIQUE(org_id, provider, type)` on `org_credentials` — allows 1 inbound + 1 outbound
- RPC parameter: `p_routing_direction TEXT` — matches unique index on `routing_direction` column
- Service logic: Always writes org_credentials with direction type

### How to Use Multi-Number Support

**Provisioning Flow (Updated):**

```
User clicks "Buy Outbound Number" in dashboard
  ↓
Frontend validates: `hasOutbound() == false` (doesn't already have outbound)
  ↓
POST /api/managed-telephony/purchase (direction='outbound')
  ↓
Backend calls insert_managed_number_atomic() RPC with p_routing_direction='outbound'
  ↓
RPC inserts to managed_phone_numbers with routing_direction='outbound'
  ↓
RPC SKIPS phone_number_mapping (outbound don't receive inbound calls)
  ↓
RPC updates agents table with vapi_phone_number_id + linked_phone_number_id
  ↓
Service code ALWAYS calls saveTwilioCredential(orgId, { ..., type: 'outbound' })
  ↓
Database saves second org_credentials row with type='outbound' (now allowed!)
  ↓
✅ Both inbound and outbound numbers now available in org
```

### Database Tables Now Support Multi-Direction

**org_credentials Table:**
- **Old:** `UNIQUE(org_id, provider)` ← ONE credential per org per provider (BLOCKED 2ND NUMBER)
- **New:** `UNIQUE(org_id, provider, type)` ← ONE credential per org per provider **per direction**
- **Result:** Can have:
  - 1 row: `(org_id, 'twilio', 'inbound')`
  - 1 row: `(org_id, 'twilio', 'outbound')`
  - → Each direction stores its own vapi phone ID independently

**managed_phone_numbers Table:**
- **Column:** `routing_direction TEXT` (inbound/outbound/unassigned)
- **Index:** `UNIQUE(org_id, routing_direction) WHERE status='active'`
- **Result:** Can have:
  - 1 row: `(org_id, routing_direction='inbound', vapi_phone_id='abc...')`
  - 1 row: `(org_id, routing_direction='outbound', vapi_phone_id='def...')`

---

## Section 2: Critical SSOT Clarification

### The Rule: org_credentials IS the SSOT for Credential Discovery

**CRITICAL PRINCIPLE:**

Agent dropdowns, phone selectors, and integration UIs query `org_credentials` table. If a credential is missing from `org_credentials`, **it will NOT appear in the UI**, even if it exists elsewhere.

**What This Means:**

1. **Provisioning a managed phone number = 2 database writes:**
   - `managed_phone_numbers` ← operational tracking (cost, renewal, status)
   - `org_credentials` ← credential SSOT for UI discovery (REQUIRED)
   - If org_credentials row is missing → phone won't appear in agent dropdown

2. **Deleting a managed phone number = Complete cleanup:**
   - `managed_phone_numbers`: Set `status='released'` (soft delete, preserve history)
   - `org_credentials`: DELETE record (hard delete, clean SSOT)
   - `agents`: Set `vapi_phone_number_id=NULL` (unlink)
   - If org_credentials not deleted → phone still appears in dropdown (CONFUSION)

**How to Verify SSOT Health:**

```sql
-- Check: All managed numbers have credential entries
SELECT
  mpn.id, mpn.phone_number, mpn.routing_direction,
  (SELECT COUNT(*) FROM org_credentials oc
   WHERE oc.org_id = mpn.org_id
     AND oc.provider = 'twilio'
     AND oc.type = mpn.routing_direction
     AND oc.is_managed = true) as has_credential
FROM managed_phone_numbers mpn
WHERE mpn.status = 'active';

-- Expected: every row should have has_credential=1
-- If any row has has_credential=0 → SSOT VIOLATION
```

---

## Section 3: Removed Conflicting Logic

### Pattern That Was Removed: "Skip for 2nd Number"

**The Old Code (BROKEN):**

```typescript
// managed-telephony-service.ts (OLD — DELETED)
const { data: existingManagedCred } = await supabase
  .from('org_credentials')
  .select('id')
  .eq('org_id', orgId)
  .eq('provider', 'twilio')
  .eq('is_managed', true)
  .maybeSingle();

if (!existingManagedCred) {
  // First number: write to org_credentials
  await IntegrationDecryptor.saveTwilioCredential(orgId, {...});
} else {
  // Second number: SKIP org_credentials write
  // ❌ THIS CAUSED BUG 3: Credential not in SSOT, phone disappears from UI
}
```

**Why It Was Wrong:**

1. Assumed only ONE managed credential per org
2. Didn't account for direction (inbound vs outbound)
3. Skipped org_credentials write for 2nd number
4. Result: org_credentials became inconsistent with managed_phone_numbers

**The New Code (FIXED):**

```typescript
// managed-telephony-service.ts (NEW — ALWAYS WRITES)
log.info('ManagedTelephony', 'Writing managed creds to org_credentials', {
  orgId, direction, phoneNumber, vapiPhoneId
});

await IntegrationDecryptor.saveTwilioCredential(orgId, {
  accountSid: subaccountSid,
  authToken: subToken,
  phoneNumber: purchasedNumber.phoneNumber,
  source: 'managed',
  vapiPhoneId: vapiPhoneId,
  vapiCredentialId: vapiCredentialId || undefined,
  type: direction as 'inbound' | 'outbound',  // ← NEW: direction-aware write
});

log.info('ManagedTelephony', 'org_credentials write complete', {
  orgId, direction, vapiPhoneId
});
```

**Why It Works:**

1. Direction-aware constraint allows multiple credentials per org
2. Each direction (inbound/outbound) gets its own org_credentials row
3. Each row stores its own vapi_phone_id independently
4. Phone appears in agent dropdown (SSOT consistent)

---

## Section 4: RPC Function Parameter Fix

### What Changed in insert_managed_number_atomic()

**BEFORE (Parameter Mismatch):**

```sql
CREATE FUNCTION insert_managed_number_atomic(
  ...,
  p_type TEXT,              -- ❌ WRONG: called "type"
  ...
) ...
BEGIN
  INSERT INTO managed_phone_numbers (..., type, ...)
  VALUES (..., p_type, ...);  -- ❌ Writes to 'type' column

  IF p_type = 'inbound' THEN   -- ❌ Checks 'type', not 'routing_direction'
    INSERT INTO phone_number_mapping ...;
  END IF;
END;
```

**Problem:** Unique index checked `routing_direction` column but RPC wrote to `type` column → constraint violation on 2nd insert

**AFTER (Fixed):**

```sql
CREATE FUNCTION insert_managed_number_atomic(
  ...,
  p_routing_direction TEXT DEFAULT 'inbound',  -- ✅ CORRECT: called "routing_direction"
  ...
) ...
BEGIN
  INSERT INTO managed_phone_numbers (..., routing_direction, ...)
  VALUES (..., p_routing_direction, ...);  -- ✅ Writes to 'routing_direction' column

  IF p_routing_direction = 'inbound' THEN   -- ✅ Checks correct column
    INSERT INTO phone_number_mapping ...;
  ELSIF p_routing_direction = 'outbound' THEN   -- ✅ Direction-conditional logic
    UPDATE agents SET vapi_phone_number_id = ...
                 AND linked_phone_number_id = ...;
  END IF;
END;
```

---

## Section 5: Updated Production Verification

### Test Case: Buy Outbound Number (Bug 3 Verification)

**Steps:**

1. Login to dashboard as test org
2. Navigate to Phone Numbers section
3. Current state: "Inbound: Active" (from earlier purchase)
4. Click "Buy Outbound Number"
5. Complete Twilio provisioning flow
6. Expected: "Outbound: Active" appears below Inbound

**Database Verification (After Purchase):**

```sql
-- Should show 2 rows (one per direction)
SELECT id, phone_number, routing_direction, vapi_phone_id, status
FROM managed_phone_numbers
WHERE org_id = '<test-org-id>'
ORDER BY routing_direction;
-- Expected:
--  id | phone_number  | routing_direction | vapi_phone_id | status
--  1  | +1234567890   | inbound           | abc-123-uuid  | active
--  2  | +1681271148 6 | outbound          | def-456-uuid  | active

-- Should show 2 rows in org_credentials (one per direction)
SELECT id, provider, type, is_managed, is_active
FROM org_credentials
WHERE org_id = '<test-org-id>'
ORDER BY type;
-- Expected:
--  id | provider | type     | is_managed | is_active
--  1  | twilio   | inbound  | true       | true
--  2  | twilio   | outbound | true       | true
```

**Agent Configuration Verification:**

1. Go to Agent Configuration page
2. "Outbound Phone Number" dropdown should now show the new outbound number
3. Select it → Agent will use outbound number's vapi_phone_id for calls

---

## Section 6: What Stays the Same (No Changes)

### These Components Work Exactly As Documented in SSOT.md:

✅ **Phone Number Resolution** (`phone-number-resolver.ts`)
- Already direction-aware
- Queries outbound first, falls back to any managed
- NO CHANGES NEEDED

✅ **Phone Validation** (`phone-validation-service.ts`)
- Direction-aware validation
- Error messages include direction
- NO CHANGES NEEDED

✅ **Frontend Modal** (`BuyNumberModal.tsx`)
- Direction selector toggle
- Pre-flight checks per direction
- NO CHANGES NEEDED

✅ **Phone Settings API** (`phone-settings.ts`)
- Returns per-direction data
- Already split by `routingDirection`
- NO CHANGES NEEDED

✅ **Outbound Call Pipeline** (`contacts.ts`, `outbound-call-preflight.ts`)
- Agent vapi_phone_number_id set correctly by RPC
- Pre-flight validation in place
- NO CHANGES NEEDED

---

## Section 7: Critical Invariants (From SSOT.md Section 13)

**These MUST be followed. Breaking any causes production failure:**

1. **org_id Isolation** — Every query filters by `org_id = req.user.orgId`
2. **JWT Validation** — Extract org_id from `app_metadata.org_id` ONLY
3. **Wallet Balance Enforcement** — Check BEFORE deducting, deduct ATOMICALLY
4. **Advisory Locks for Bookings** — All appointments use `book_appointment_with_lock()` RPC
5. **Webhook Idempotency** — Check `processed_webhook_events` before processing
6. **vapi_phone_number_id Format** — Must be UUID (no + prefix)
7. **Credential Encryption** — Always encrypt sensitive data (AES-256-GCM)
8. **Immutable Transaction Log** — Never UPDATE/DELETE from `credit_transactions`
9. **Managed Phone Number Dual-Write & Complete Deletion** — Write to BOTH tables, delete from BOTH tables

---

## Section 8: Files Modified (Commit 3a84709)

**Database (Production - Applied via API):**
- RPC `insert_managed_number_atomic` re-deployed with correct `p_routing_direction` parameter
- Constraint `unique_org_provider` dropped
- Constraint `unique_org_provider_type` created
- Index `idx_org_credentials_one_per_org_type` dropped

**Code Changes (Deployed):**
1. `backend/src/services/integration-decryptor.ts:1007-1054`
   - `saveTwilioCredential()` now accepts `type?: 'inbound' | 'outbound'`
   - UPSERT includes `type` in payload
   - `onConflict` changed to `'org_id,provider,type'`

2. `backend/src/services/managed-telephony-service.ts:604-622`
   - Removed 45-line "skip for 2nd number" block
   - Now always writes org_credentials with `type: direction`

3. `backend/src/middleware/csrf-protection.ts`
   - Voice-preview endpoint added to skipPaths (Bug 1 fix)

4. `backend/src/services/vapi-sync.ts` (NEW)
   - Lazy-require proxy to fix circular dependency crash

---

## Section 9: Migration Reference

For developers implementing similar multi-direction patterns:

**Key Learning:** Don't use single constraint for multi-faceted domain. Instead:

```sql
-- ❌ WRONG: Allows only ONE credential per org per provider
CONSTRAINT unique_org_provider UNIQUE(org_id, provider)

-- ✅ CORRECT: Allows multiple credentials per org, differentiated by type/direction
CONSTRAINT unique_org_provider_type UNIQUE(org_id, provider, type)
```

This pattern is now documented in SSOT.md Section 9 (Managed Phone Numbers).

---

## Section 10: Next Steps

### Immediate (Today)
- ✅ Verify outbound number purchase works (test case in Section 5)
- ✅ Confirm agent can select outbound number from dropdown
- ✅ Test outbound call completes successfully

### Short-term (This Week)
- Update customer documentation to mention multi-number support
- Monitor production for any edge cases
- Backfill phone deletion code to handle multi-direction properly (Phase 2)

### Long-term (This Month)
- Extend multi-provider support (non-Twilio providers)
- Add phone number rebalancing UI (let users swap inbound/outbound)
- Implement phone deletion for both directions

---

## Section 11: References

**Database Architecture:** SSOT.md (authoritative)
- Section 9: Managed Phone Numbers (Lifecycle + Dual-Write)
- Section 10: org_credentials (SSOT for Credential Discovery)
- Section 13: Critical Invariants (Invariant 9: Phone Number Handling)

**Code Implementation:**
- RPC Definition: `backend/supabase/migrations/20260222_add_routing_direction.sql` (lines 66-222)
- Migration Files: See Section 8 above

---

**Status:** ✅ DEPLOYED & VERIFIED
**Outbound Test Number:** +16812711486 (purchased 2026-02-24)
**Bug 3 Status:** ✅ FIXED — Multi-number support now fully operational

