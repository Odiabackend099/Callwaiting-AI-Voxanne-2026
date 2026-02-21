# Geo Permissions Auto-Inheritance Fix - Planning Document

**Date:** 2026-02-15
**Status:** READY FOR IMPLEMENTATION
**Priority:** CRITICAL (Blocks ALL international number verification for managed orgs)

---

## Problem Summary

**Issue:** Managed telephony subaccounts don't inherit Geo Permissions from the master Twilio account. When a user from ANY non-US country tries to verify their phone number, the call fails silently with Twilio Error Code 13227 ("No International Permission").

**Root Cause:** `ManagedTelephonyService.createSubaccount()` creates a Twilio subaccount but never enables `DialingPermissionsInheritance`. The subaccount starts with default Geo Permissions (only US) regardless of what the master account has enabled.

**Evidence:**
- Master account (ACe1819d2d...): Nigeria Low Risk = **true**
- Subaccount (AC11f5ea81...): Nigeria Low Risk = **false**
- Master account validation call → status: `ringing` (phone rings)
- Subaccount validation call → status: `no-answer` / `busy` (phone never rings due to Error 13227)

**Impact:** Affects ALL managed telephony orgs trying to verify non-US numbers. Nigerian, British, Canadian, Turkish, etc. - any country that isn't in the subaccount's default Geo Permissions will fail.

---

## Research Summary

### Twilio Documentation (Verified)

**Source:** [Twilio DialingPermissions Settings Resource](https://www.twilio.com/docs/voice/api/dialingpermissions-settings-resource)

1. **Subaccounts CAN inherit from master** via `DialingPermissionsInheritance` property
2. **When `true`:** Subaccount automatically uses master's Geo Permissions
3. **When `false`:** Subaccount has its own isolated Geo Permissions (default for new subaccounts)
4. **API:** `POST /v1/Settings` with `DialingPermissionsInheritance=true`

**Source:** [Twilio Subaccount International Calls](https://support.twilio.com/hc/en-us/articles/223135947)

- "For our partners that build and re-sell Twilio powered solutions using subaccounts, Twilio has provided the ability for a subaccount to inherit the dialing permissions of the Master Project."

**Source:** [Twilio BulkCountryUpdates API](https://www.twilio.com/docs/voice/api/dialing-permissions-resources)

- Alternative: Set permissions per-country via BulkCountryUpdates

### Twilio Node.js SDK (Verified in node_modules)

```typescript
// Settings API (inheritance)
const subClient = twilio(subAccountSid, subAuthToken);
const settings = await subClient.voice.v1.dialingPermissions.settings().fetch();
// settings.dialingPermissionsInheritance → boolean

await subClient.voice.v1.dialingPermissions.settings().update({
  dialingPermissionsInheritance: true
});

// BulkCountryUpdates API (per-country)
await subClient.voice.v1.dialingPermissions.bulkCountryUpdates.create({
  updateRequest: JSON.stringify([
    { iso_code: 'NG', low_risk_numbers_enabled: 'true', ... }
  ])
});
```

---

## Architecture Decision

### Question: Whose credentials should be used for validation requests?

**Answer: The organization's subaccount credentials (current approach is correct)**

**Rationale:**
1. **Multi-tenant isolation** - Each org's calls are billed/tracked under their subaccount
2. **BYOC compatibility** - BYOC orgs use their own credentials, not ours
3. **Caller ID ownership** - Verified caller IDs belong to the subaccount, not master
4. **Audit trail** - Call logs are per-subaccount in Twilio
5. **Security** - Subaccounts can be suspended/closed independently

### Question: How should Geo Permissions be handled?

**Answer: Enable `DialingPermissionsInheritance = true` on every managed subaccount**

**Rationale:**
1. **Automatic** - No need to manually sync permissions per-country
2. **Future-proof** - When master enables a new country, ALL subaccounts get it
3. **Zero user action** - Users never need to touch Twilio Console
4. **Consistent** - All managed orgs get the same calling capabilities
5. **Twilio-recommended** - This is the documented pattern for multi-tenant platforms

**Why NOT per-country BulkCountryUpdates:**
- Requires tracking which countries each org needs
- Requires syncing on every new country addition
- More API calls, more failure points
- Not necessary for our use case (we want ALL managed orgs to call everywhere master can)

---

## Solution Design

### Phase 1: Fix Existing Subaccounts (Immediate)

**What:** Enable `DialingPermissionsInheritance` on ALL existing managed subaccounts.

**Where:** `backend/src/services/managed-telephony-service.ts`

**New method:**
```typescript
static async enableGeoPermissionInheritance(subAccountSid: string, subAuthToken: string): Promise<void> {
  const subClient = twilio(subAccountSid, subAuthToken);

  // Check current state
  const settings = await subClient.voice.v1.dialingPermissions.settings().fetch();

  if (!settings.dialingPermissionsInheritance) {
    // Enable inheritance from master
    await subClient.voice.v1.dialingPermissions.settings().update({
      dialingPermissionsInheritance: true
    });
  }
}
```

### Phase 2: Fix Subaccount Creation Flow (Permanent Fix)

**What:** After creating a new subaccount, immediately enable Geo Permissions inheritance.

**Where:** `backend/src/services/managed-telephony-service.ts` → `createSubaccount()` method

**Change:** Add inheritance enablement right after subaccount creation (line ~131, after `masterClient.api.v2010.accounts.create()`).

```typescript
// After subaccount creation (existing code)
const subaccount = await masterClient.api.v2010.accounts.create({ friendlyName });

// NEW: Enable Geo Permissions inheritance from master
const subClient = twilio(subaccount.sid, subaccount.authToken);
await subClient.voice.v1.dialingPermissions.settings().update({
  dialingPermissionsInheritance: true
});
```

### Phase 3: Fix TelephonyService Error Handling (Better UX)

**What:** When Error 13227 occurs on a managed org, auto-fix by enabling inheritance instead of showing error.

**Where:** `backend/src/services/telephony-service.ts` → `initiateVerification()` catch block

**Change:** Before throwing the Geo Permissions error, try to auto-enable inheritance:

```typescript
if (twilioErrorCode === 13227 || errorMessage.includes('International Permission')) {
  // For managed orgs: try to auto-fix by enabling inheritance
  if (orgTelephonyMode === 'managed') {
    await ManagedTelephonyService.enableGeoPermissionInheritance(
      twilioCredentials.accountSid,
      twilioCredentials.authToken
    );
    // Wait for propagation, then retry once
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Retry the validation request
    validationRequest = await twilioClient.validationRequests.create({ phoneNumber, friendlyName });
    // If retry succeeds, continue normally
  }
  // For BYOC orgs: show the manual fix instructions (existing behavior)
}
```

### Phase 4: Migration Script for Existing Subaccounts

**What:** One-time script to enable inheritance on all existing subaccounts.

**Where:** `backend/scripts/fix-subaccount-geo-permissions.ts`

```typescript
// 1. Query all active subaccounts from twilio_subaccounts table
// 2. For each: decrypt auth token, create Twilio client
// 3. Check settings.dialingPermissionsInheritance
// 4. If false: enable it
// 5. Log results
```

---

## Testing Criteria

### Unit Tests
- [ ] `enableGeoPermissionInheritance()` calls Twilio Settings API correctly
- [ ] `createSubaccount()` enables inheritance after creation
- [ ] Error 13227 auto-retry works for managed orgs
- [ ] Error 13227 shows manual instructions for BYOC orgs

### Integration Tests
- [ ] New subaccount has inheritance enabled
- [ ] Existing subaccount gets inheritance via migration
- [ ] Validation call to +234 number succeeds from subaccount after inheritance enabled
- [ ] Phone actually rings (HUMAN VERIFICATION REQUIRED)

### Acceptance Criteria
- [ ] User's Nigerian phone (+2348141995397) actually rings
- [ ] User hears 6-digit code
- [ ] Verification completes successfully
- [ ] Any country enabled on master works automatically for all managed subaccounts
- [ ] BYOC orgs are unaffected (no regression)

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `backend/src/services/managed-telephony-service.ts` | Add `enableGeoPermissionInheritance()` + call in `createSubaccount()` | ~20 lines |
| `backend/src/services/telephony-service.ts` | Add auto-fix retry for managed orgs on Error 13227 | ~15 lines |
| `backend/scripts/fix-subaccount-geo-permissions.ts` | NEW: Migration script for existing subaccounts | ~60 lines |

**Total:** ~95 lines changed/added

---

## Risk Assessment

**Risk 1:** Inheritance enables ALL master countries on subaccounts
- **Mitigation:** This is intentional. Master account controls which countries are safe.
- **Impact:** Low - master already has only safe countries enabled

**Risk 2:** Twilio propagation delay after enabling inheritance
- **Mitigation:** 5-second wait before retry in auto-fix flow
- **Impact:** Low - one-time delay, subsequent calls work immediately

**Risk 3:** Auto-retry in telephony-service.ts adds latency
- **Mitigation:** Only triggers on Error 13227 (rare), only for managed orgs
- **Impact:** Low - 5-second delay is acceptable for first-time country calls

**Risk 4:** Regression for BYOC orgs
- **Mitigation:** BYOC code path unchanged. Inheritance only enabled for managed orgs.
- **Impact:** None

---

## Implementation Order

1. **Phase 1:** Create `enableGeoPermissionInheritance()` method
2. **Phase 2:** Add it to `createSubaccount()` flow
3. **Phase 3:** Add auto-fix retry in `telephony-service.ts`
4. **Phase 4:** Run migration script for existing subaccounts
5. **Phase 5:** Test with actual Nigerian number verification

---

**Created:** 2026-02-15
**Research Sources:**
- [Twilio DialingPermissions Settings Resource](https://www.twilio.com/docs/voice/api/dialingpermissions-settings-resource)
- [Twilio Subaccount International Calls](https://support.twilio.com/hc/en-us/articles/223135947)
- [Twilio Dialing Permissions Overview](https://www.twilio.com/docs/voice/api/dialing-permissions-resources)
- [Twilio Geo Permissions REST API Blog](https://www.twilio.com/en-us/blog/blog-voice-dialing-geo-permissions-rest-api)
- Twilio Node.js SDK type definitions (verified in `node_modules/twilio`)
