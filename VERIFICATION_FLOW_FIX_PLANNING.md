# Planning: Fix Verification Flow — Navigate-Away Recovery

## Problem Statement

When a user initiates caller ID verification, receives the Twilio call, enters the code, then **navigates away before clicking "Verify & Complete Setup"**, they lose all progress. The verification step state is held only in React component state (`verificationStep`, `phoneNumber`, `verificationCode`) and is destroyed on unmount.

### Failure Sequence
1. User clicks "Start Verification" → `/verify` creates DB record with `status: 'pending'`
2. Twilio calls user → user enters code on phone → **Twilio marks number as verified server-side**
3. User navigates away → React component unmounts → **all state lost**
4. User returns → component remounts with `verificationStep: 'input'`, `phoneNumber: ''`
5. Status endpoint filters `.eq('status', 'verified')` → pending record invisible → shows empty input wizard
6. User is stuck: the phone number they entered is gone, the code is gone, and they can't complete setup

### Additional Issues
- A `pending` record sits orphaned in the DB forever (no cleanup)
- If user re-enters the same number and Twilio already has it verified, the auto-verify path fires silently — confusing UX
- No indication that a pending verification exists when user returns

---

## Solution Design

### Phase 1: Backend — Return Pending Verification State

**File:** `backend/src/routes/phone-settings.ts`

**Change:** Add a second query in the status endpoint for pending verifications. If no verified number exists but a pending verification does, return it so the frontend can recover.

```typescript
// After the existing verified query (line 50-56), add:
let pendingVerification = null;
if (!hasVerifiedNumber) {
  const { data: pendingRecords } = await supabaseAdmin
    .from('verified_caller_ids')
    .select('id, phone_number, status, created_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (pendingRecords && pendingRecords.length > 0) {
    const pending = pendingRecords[0];
    const ageMs = Date.now() - new Date(pending.created_at).getTime();
    const MAX_PENDING_AGE_MS = 30 * 60 * 1000; // 30 minutes

    if (ageMs < MAX_PENDING_AGE_MS) {
      pendingVerification = {
        phoneNumber: pending.phone_number,
        createdAt: pending.created_at,
        id: pending.id,
      };
    } else {
      // Auto-cleanup stale pending records (older than 30 min)
      await supabaseAdmin
        .from('verified_caller_ids')
        .delete()
        .eq('id', pending.id);
    }
  }
}
```

Add `pendingVerification` to the outbound response:
```typescript
outbound: {
  hasVerifiedNumber,
  verifiedNumber: ...,
  verifiedAt: ...,
  verifiedId: ...,
  vapiLinked: ...,
  pendingVerification, // NEW
},
```

### Phase 2: Frontend — Auto-Recovery on Mount

**File:** `src/app/dashboard/phone-settings/page.tsx`

**Changes:**

1. **Add `pendingVerification` to `PhoneSettingsStatus` interface:**
```typescript
outbound: {
  // ... existing fields
  pendingVerification?: {
    phoneNumber: string;
    createdAt: string;
    id: string;
  } | null;
};
```

2. **On mount, after fetching status, auto-recover pending verification:**
```typescript
// In fetchPhoneSettings(), after setting status:
if (data.outbound.pendingVerification && !data.outbound.hasVerifiedNumber) {
  // Restore the verification step
  setPhoneNumber(data.outbound.pendingVerification.phoneNumber);
  setVerificationStep('verify');

  // Auto-check if Twilio already verified it (user entered code but didn't click confirm)
  try {
    const confirmResult = await authedBackendFetch('/api/verified-caller-id/confirm', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: data.outbound.pendingVerification.phoneNumber })
    });
    // Auto-confirmed! Show success
    setVerificationStep('success');
    showSuccessToast('Your number was verified! Setup completed automatically.', 3000);
    fetchPhoneSettings(); // Refresh to show verified state
  } catch {
    // Not yet verified in Twilio — show the verify step so user can complete
    // (They may not have entered the code yet)
  }
}
```

3. **Prevent double-submission with useRef guard:**
```typescript
const autoRecoveryAttempted = useRef(false);
```
Only attempt auto-recovery once per mount.

### Phase 3: Robust Error Handling

1. **Stale pending cleanup:** Backend auto-deletes pending records older than 30 minutes (handled in Phase 1)
2. **Cancel button cleanup:** When user clicks "Cancel" in the verify step, delete the pending DB record
3. **Navigation warning:** Optional — show a warning if user tries to leave during verification (mild UX guardrail)

---

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `backend/src/routes/phone-settings.ts` | Add pending verification query + stale cleanup |
| 2 | `src/app/dashboard/phone-settings/page.tsx` | Auto-recover pending verification + cancel cleanup |

**No new files. No DB migration. No Vapi changes.**

---

## Testing Criteria

### Happy Path
1. Start verification → receive call → enter code → navigate away → come back
2. Expected: Page auto-detects pending verification → auto-calls `/confirm` → shows verified state

### User Didn't Enter Code
1. Start verification → receive call → DON'T enter code → navigate away → come back
2. Expected: Page shows verify step with "Verify & Complete Setup" button (recovered state)

### Stale Pending Record
1. Start verification → don't complete → wait 30+ minutes → refresh
2. Expected: Stale record auto-deleted, shows fresh input wizard

### Cancel Flow
1. Start verification → click Cancel
2. Expected: Pending record deleted from DB, shows input wizard

### Edge: Multiple Pending Records
1. Should only return the most recent one (ORDER BY created_at DESC LIMIT 1)
