# Phone Number Deletion Fix - Implementation Plan

**Date:** 2026-02-12
**Issue:** Deleting managed phone breaks SSOT integrity
**Severity:** HIGH (data consistency issue)

---

## Phase 1: Backend Deletion Endpoint Fix

### Implementation
1. **Find:** `backend/src/routes/managed-telephony.ts` - DELETE endpoint (around line 250-350)
2. **Check Current Behavior:**
   - Deletes from `managed_phone_numbers` only
   - Does NOT clean up `org_credentials`
   - Does NOT unlink agents

3. **Required Changes:**
   - Add transaction wrapper for atomic deletion
   - Delete from `managed_phone_numbers` first
   - Delete from `org_credentials` (SSOT cleanup)
   - Unlink agents: SET `vapi_phone_number_id = NULL` WHERE phone matches
   - Add comprehensive error handling
   - Add audit logging

4. **Code Pattern:**
```typescript
// Atomic deletion transaction
const { error: deleteError } = await supabaseAdmin.rpc('delete_managed_phone_atomic', {
  p_org_id: orgId,
  p_phone_number: phoneNumber
});

// Falls back to manual deletion if RPC not available
if (deleteError) {
  // Delete from managed_phone_numbers
  // Delete from org_credentials
  // Update agents table
  // Handle partial failures
}
```

### Testing Criteria
- ✅ Phone deleted from `managed_phone_numbers`
- ✅ Phone deleted from `org_credentials`
- ✅ Agents unlinked (vapi_phone_number_id set to NULL)
- ✅ Agent dropdown no longer shows deleted phone
- ✅ Concurrent deletions don't cause race conditions
- ✅ Error cases handled gracefully

---

## Phase 2: Database Migration (Optional but Recommended)

### Implementation
1. **Create RPC Function:** `delete_managed_phone_atomic(p_org_id, p_phone_number)`
2. **Function Logic:**
   - Use advisory locks for concurrency safety
   - Validate ownership (org_id match)
   - Delete from managed_phone_numbers
   - Delete from org_credentials
   - Update agents table
   - Log audit event
   - Return success/error status

### Testing Criteria
- ✅ RPC function exists and is callable
- ✅ Handles orphaned records gracefully
- ✅ Concurrent calls don't deadlock

---

## Phase 3: Frontend Confirmation Dialog

### Implementation
1. **Find:** `src/app/dashboard/telephony/components/DeletePhoneDialog.tsx` (or similar)
2. **Add Confirmation Warning:**
   - "Deleting this number will remove it from:"
     - Phone number management
     - Agent configurations (agents will be unlinked)
     - Agent dropdown selector
3. **Show Affected Agents:** List any agents using this phone

### Testing Criteria
- ✅ User sees clear warning about deletion side effects
- ✅ Affected agents are listed
- ✅ Deletion can be cancelled

---

## Phase 4: Verification Tests

### Test Case 1: Basic Deletion
```
GIVEN: Managed phone number exists
WHEN: User deletes the phone
THEN:
  - Phone removed from managed_phone_numbers ✅
  - Phone removed from org_credentials ✅
  - Agent dropdown no longer shows phone ✅
```

### Test Case 2: Agent Unlinking
```
GIVEN: Agent is configured with managed phone
WHEN: Phone is deleted
THEN:
  - Agent.vapi_phone_number_id is set to NULL ✅
  - Agent still exists (not deleted) ✅
  - Agent configuration page shows "No phone selected" ✅
```

### Test Case 3: Concurrent Deletions
```
GIVEN: Two concurrent deletion requests for same phone
WHEN: Both requests execute simultaneously
THEN:
  - First succeeds ✅
  - Second fails gracefully with 404 ✅
  - No database corruption ✅
```

### Test Case 4: SSOT Verification
```
GIVEN: Phone deleted
WHEN: Query org_credentials for that phone
THEN:
  - No row exists ✅
  - No orphaned entries ✅
  - Database is clean ✅
```

---

## Critical Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `backend/src/routes/managed-telephony.ts` | DELETE endpoint (line ~280) | Core fix |
| `backend/supabase/migrations/` | Add RPC function (optional) | Performance |
| `src/app/dashboard/telephony/` | Add delete confirmation | UX |

---

## Success Criteria

✅ All 4 test cases pass
✅ SSOT integrity maintained
✅ No orphaned org_credentials entries
✅ Agents properly unlinked
✅ Zero data loss
✅ Concurrent deletes handled safely

---

## Rollout Plan

1. Phase 1: Fix backend endpoint (Critical)
2. Phase 2: Optional RPC migration (Performance)
3. Phase 3: Add frontend confirmation (UX)
4. Phase 4: Run comprehensive tests
5. Deploy with monitoring

---
