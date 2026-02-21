# Nigerian Number Verification Fix - Planning Document

## Problem Summary

**Issue:** Verification call to +2348141995397 failed with Twilio Error Code 13227
**Root Cause:** Geo Permissions for Nigeria (NG) are disabled on the Twilio account
**Impact:** User cannot verify Nigerian phone numbers for caller ID

---

## Root Cause Analysis

### What Happened
1. Backend initiated Twilio validation call via `twilioClient.validationRequests.create()`
2. Twilio attempted to place call from +14157234000 (US) to +2348141995397 (Nigeria)
3. Twilio rejected the call with SIP 403 response code
4. Error: "No International Permission for NG"
5. Call failed immediately (0 seconds duration)
6. User's phone never rang

### Why It Happened
- Twilio has Geo Permissions that control which countries can be called
- By default, many countries (including Nigeria) are blocked even on paid accounts
- This is separate from trial account restrictions
- User's account IS fully registered (confirmed by provisioned numbers)
- But Nigeria-specific permission was never enabled

### Evidence
- Call SID: CAf31728e58e45094405db0fcc281d92a6
- Twilio Error Code: 13227
- SIP Response Code: 403 (Forbidden)
- Twilio Documentation: https://www.twilio.com/docs/errors/13227
- Fix URL: https://www.twilio.com/console/voice/calls/geo-permissions/low-risk?countryIsoCode=NG

---

## Solution Design

### Phase 1: Enable Geo Permissions (Manual - User Action Required)

**Who:** User must do this themselves (requires Twilio console access)
**When:** Before any Nigerian number verification can work
**How:**
1. Navigate to: https://www.twilio.com/console/voice/calls/geo-permissions
2. Click "Low Risk" tab (Nigeria is classified as Low Risk)
3. Find "Nigeria (NG)" in the country list
4. Toggle the switch to "Enabled"
5. Confirm the change
6. Wait 5-10 minutes for changes to propagate

**Expected Result:** Twilio will allow outbound calls to Nigerian numbers

---

### Phase 2: Improve Error Handling (Backend Code Changes)

**Goal:** Give users clear guidance when Geo Permissions are missing

#### Changes Required

**File 1: `backend/src/services/telephony-service.ts`**
- Location: Lines 189-200 (Twilio error handling)
- Current: Generic error message for trial accounts
- Improvement: Add specific handling for Error Code 13227

**Before:**
```typescript
if (errorMessage.includes('trial') || errorMessage.includes('not supported on trial account')) {
  throw new Error(
    `Twilio trial account limitation: ${errorMessage}\n\n` +
    `To use caller ID verification, upgrade your Twilio account at https://console.twilio.com/billing/upgrade`
  );
}
```

**After:**
```typescript
if (errorMessage.includes('trial') || errorMessage.includes('not supported on trial account')) {
  throw new Error(
    `Twilio trial account limitation: ${errorMessage}\n\n` +
    `To use caller ID verification, upgrade your Twilio account at https://console.twilio.com/billing/upgrade`
  );
}

// NEW: Handle Geo Permissions error
if (errorMessage.includes('International Permission') || errorMessage.includes('geo-permissions')) {
  // Extract country code from phone number (e.g., +234 -> NG)
  const countryCode = phoneNumber.substring(1, 4); // +234 -> 234
  throw new Error(
    `Twilio Geo Permissions required: ${errorMessage}\n\n` +
    `To call this country, enable Geo Permissions at:\n` +
    `https://www.twilio.com/console/voice/calls/geo-permissions`
  );
}
```

**File 2: NEW - `backend/src/scripts/check-geo-permissions.ts`**
- Purpose: Diagnostic script to check Twilio Geo Permissions
- Usage: `npm run check-geo`
- Output: List of enabled/disabled countries

---

### Phase 3: Retry Verification After Permission Enabled

**Pre-requisites:**
- Phase 1 complete (Geo Permissions enabled for Nigeria)
- Wait 5-10 minutes for Twilio changes to propagate

**Steps:**
1. Delete failed verification record from database
2. Re-initiate verification call: `POST /api/telephony/verify-caller-id/initiate`
3. User answers call and enters 6-digit code
4. Confirm verification: `POST /api/telephony/verify-caller-id/confirm`
5. Test forwarding config creation

---

## Implementation Phases

### Phase 1: Manual Fix (USER ACTION REQUIRED - 5 minutes)
- [ ] User logs into Twilio console
- [ ] User navigates to Geo Permissions
- [ ] User enables Nigeria (NG) under Low Risk countries
- [ ] Wait 5-10 minutes for propagation

### Phase 2: Backend Error Handling (15 minutes)
- [ ] Update telephony-service.ts error handling
- [ ] Add Geo Permissions detection
- [ ] Create diagnostic script
- [ ] Test with mock Twilio errors

### Phase 3: Verification Testing (10 minutes)
- [ ] Delete failed verification record
- [ ] Retry verification call
- [ ] Verify user receives call
- [ ] User enters code
- [ ] Confirm verification succeeds
- [ ] Test forwarding config

---

## Testing Criteria

### Unit Tests
- [ ] telephony-service.ts handles Error Code 13227 correctly
- [ ] Error message includes Geo Permissions link
- [ ] Country code extraction works for all E.164 formats

### Integration Tests
- [ ] Verification call succeeds after Geo Permissions enabled
- [ ] User receives call on +2348141995397
- [ ] 6-digit code entry works
- [ ] Verification confirmation endpoint returns success
- [ ] verified_caller_ids table updated with verified status

### Acceptance Criteria
- [ ] User receives Twilio call on their Nigerian number
- [ ] Call plays verification code clearly
- [ ] User can enter code via phone keypad
- [ ] Backend receives confirmation and marks as verified
- [ ] Forwarding config can be created with verified number

---

## Risk Assessment

### Risks
1. **Twilio propagation delay:** Geo Permission changes may take 5-10 minutes
   - Mitigation: Wait before retrying
2. **Nigerian carrier compatibility:** Some carriers may block international calls
   - Mitigation: User can test with different carrier if needed
3. **Call quality:** International calls may have audio quality issues
   - Mitigation: Twilio uses premium routes for validation calls

### Dependencies
- User has Twilio console access (to enable Geo Permissions)
- User has admin permissions on Twilio account
- Nigerian carrier supports international calls
- Phone number is active and can receive calls

---

## Success Metrics

**Before Fix:**
- Verification calls to Nigeria: 0% success rate
- Error rate: 100% (Error Code 13227)

**After Fix:**
- Verification calls to Nigeria: Expected 95%+ success rate
- Error rate: <5% (carrier-specific issues only)

---

## Rollback Procedure

If Geo Permissions cause issues (e.g., unwanted charges):
1. Navigate to Twilio Geo Permissions
2. Disable Nigeria (NG)
3. Users will see clear error message about Geo Permissions
4. No code changes to rollback

---

## Documentation Updates

### Files to Update
- [ ] README.md - Add Geo Permissions setup instructions
- [ ] TROUBLESHOOTING.md - Add Error Code 13227 section
- [ ] API_ERRORS.md - Document Geo Permissions errors

---

## Timeline

**Total Time:** 30 minutes (user action + code changes + testing)

1. **Phase 1 (User Action):** 5 minutes + 10 minutes wait = 15 minutes
2. **Phase 2 (Code):** 15 minutes
3. **Phase 3 (Testing):** 10 minutes

---

## Next Steps

1. **IMMEDIATE (User):** Enable Geo Permissions for Nigeria in Twilio console
2. **THEN (Backend):** Improve error handling for Geo Permissions errors
3. **FINALLY (Test):** Retry verification call and complete verification flow

---

**Created:** 2026-02-15
**Status:** READY FOR IMPLEMENTATION
**Priority:** CRITICAL (Blocks Nigerian number verification)
