# Managed Telephony Credential Storage Verification

**Date:** 2026-02-07
**Status:** ✅ **VERIFIED - CREDENTIALS STORED CORRECTLY**

---

## Question 1: Where are managed telephony credentials stored?

### Answer: SAME LOCATION AS BYOC

**Table:** `org_credentials`
**Provider:** `'twilio'`
**Enforcement:** UPSERT with `onConflict: 'org_id,provider'` (Single-Slot Policy)

### Verification Evidence:

**File:** `backend/src/services/integration-decryptor.ts` (lines 1006-1101)

```typescript
static async saveTwilioCredential(
  orgId: string,
  creds: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    source: 'byoc' | 'managed';  // <-- Both sources use same method
  }
): Promise<{ vapiCredentialId: string | null }> {
  // 1. Encrypt credentials
  const encryptedConfig = EncryptionService.encryptObject({
    accountSid,
    authToken,
    phoneNumber,
  });

  // 2. UPSERT into org_credentials (SAME TABLE FOR BOTH BYOC AND MANAGED)
  const { error: upsertError } = await supabase
    .from('org_credentials')  // <-- SAME TABLE
    .upsert(
      {
        org_id: orgId,
        provider: 'twilio' as const,  // <-- SAME PROVIDER
        is_active: true,
        encrypted_config: encryptedConfig,
        metadata: { accountSid, phoneNumber },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,provider' }  // <-- SINGLE-SLOT ENFORCEMENT
    );
```

### Key Points:

1. ✅ **Same Table:** Both BYOC and managed use `org_credentials` table
2. ✅ **Same Provider:** Both use `provider = 'twilio'`
3. ✅ **Single-Slot Enforced:** UPSERT with `onConflict` ensures only ONE credential per org
4. ✅ **Encrypted:** Credentials encrypted via `EncryptionService.encryptObject()`
5. ✅ **Vapi Synced:** Credentials synced to Vapi via `syncVapiCredential()` (line 1084)
6. ✅ **Credential ID Stored:** Vapi credential UUID stored in `organizations.vapi_credential_id` (lines 1087-1091)

---

## Question 2: Does delete release number from Vapi?

### Answer: YES ✅

**Endpoint:** `DELETE /api/managed-telephony/numbers/:phoneNumber`
**Service Method:** `ManagedTelephonyService.releaseManagedNumber()`
**File:** `backend/src/services/managed-telephony-service.ts` (lines 390-459)

### 4-Step Delete Process:

```typescript
static async releaseManagedNumber(orgId: string, phoneNumber: string) {
  // Step 1: Remove from Vapi ✅
  if (mnRecord.vapi_phone_id) {
    const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);
    await vapiClient.deletePhoneNumber(mnRecord.vapi_phone_id);
    // Line 423: Deletes from Vapi API
  }

  // Step 2: Release from Twilio subaccount ✅
  const subClient = twilio(...);
  await subClient.incomingPhoneNumbers(mnRecord.twilio_phone_sid).remove();
  // Line 438: Releases from Twilio

  // Step 3: Update DB status ✅
  await supabaseAdmin
    .from('managed_phone_numbers')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('id', mnRecord.id);
  // Line 450: Marks as released

  // Step 4: Remove from phone_number_mapping ✅
  await supabaseAdmin
    .from('phone_number_mapping')
    .delete()
    .eq('org_id', orgId)
    .eq('inbound_phone_number', phoneNumber);
  // Line 456: Removes routing mapping
}
```

### Verification:

1. ✅ **Vapi Release:** Line 423 - `vapiClient.deletePhoneNumber(vapiPhoneId)`
2. ✅ **Twilio Release:** Line 438 - `subClient.incomingPhoneNumbers().remove()`
3. ✅ **Database Update:** Line 450 - Status set to `'released'`
4. ✅ **Routing Cleanup:** Line 456 - Removes from `phone_number_mapping`

### Error Handling:

- Both Vapi and Twilio errors are caught and logged as warnings (non-fatal)
- If number already deleted externally, function continues gracefully
- Database operations always execute regardless of external API failures

---

## What's Missing: UI Delete Button

### Current State:

- ❌ No delete button on telephony page
- ❌ No way for user to release managed numbers from UI
- ✅ Backend endpoint fully functional

### Required Implementation:

Add delete button to `/dashboard/telephony` page:

1. Fetch active managed numbers on page load
2. Display list of active numbers with delete button
3. Clicking delete button calls `DELETE /api/managed-telephony/numbers/:phoneNumber`
4. Show confirmation dialog before deletion
5. Refresh page after successful deletion

---

## Implementation Plan: Delete Button UI

### File to Modify:
`src/app/dashboard/telephony/page.tsx`

### Changes Needed:

1. **Add State for Managed Numbers:**
   ```typescript
   const [managedNumbers, setManagedNumbers] = useState<Array<{
     phoneNumber: string;
     status: string;
     vapiPhoneId: string | null;
   }>>([]);
   ```

2. **Fetch Managed Numbers on Mount:**
   ```typescript
   useEffect(() => {
     fetchManagedNumbers();
   }, []);

   const fetchManagedNumbers = async () => {
     const data = await authedBackendFetch('/api/managed-telephony/status');
     setManagedNumbers(data.numbers || []);
   };
   ```

3. **Add Delete Handler:**
   ```typescript
   const handleDeleteNumber = async (phoneNumber: string) => {
     if (!confirm(`Delete ${phoneNumber}? This cannot be undone.`)) return;

     await authedBackendFetch(`/api/managed-telephony/numbers/${encodeURIComponent(phoneNumber)}`, {
       method: 'DELETE',
     });

     // Refresh list
     await fetchManagedNumbers();
   };
   ```

4. **Add UI Section:**
   ```tsx
   {managedNumbers.length > 0 && (
     <div className="bg-white border border-surgical-200 rounded-xl p-6">
       <h3 className="text-lg font-semibold text-obsidian mb-4">Active Managed Numbers</h3>
       {managedNumbers.map(num => (
         <div key={num.phoneNumber} className="flex items-center justify-between p-3 border-b">
           <span>{num.phoneNumber}</span>
           <button
             onClick={() => handleDeleteNumber(num.phoneNumber)}
             className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
           >
             Delete
           </button>
         </div>
       ))}
     </div>
   )}
   ```

---

## Summary

### ✅ Verified:
1. Managed telephony credentials stored in `org_credentials` (same as BYOC)
2. Single-slot policy enforced via UPSERT
3. Delete endpoint releases from both Vapi AND Twilio
4. Database cleanup removes from all relevant tables

### ⏳ Remaining Work:
1. Add delete button UI to telephony page
2. Fetch and display active managed numbers
3. Add confirmation dialog before deletion

---

**Status:** Backend 100% verified, Frontend UI implementation needed
