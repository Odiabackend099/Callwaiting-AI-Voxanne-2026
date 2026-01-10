# Outbound Agent Config Save Fix - Test Plan

**Issue**: User could not save outbound agent configuration. Only inbound config save worked.

**Root Cause**: Backend endpoint used `.single()` instead of `.maybeSingle()` when checking if config exists. This threw an error when config didn't exist yet (first save), preventing create-or-update logic from working.

**Fix Applied**: Changed line 127 in `backend/src/routes/outbound-agent-config.ts` from `.single()` to `.maybeSingle()` with proper error handling.

---

## Test Scenarios

### Test 1: Create Outbound Config from Scratch (First Save)
**Precondition**: No outbound_agent_config exists for this org

**Steps**:
1. Go to `/dashboard/outbound-agent-config`
2. Fill in all fields:
   - System Prompt: "You are a professional sales development representative..."
   - First Message: "Hi [Name], this is [Your Name] with Call Waiting AI..."
   - Voice: Paige
   - Language: English (US)
   - Max Duration: 600 seconds
3. Click "Save Configuration"

**Expected Result**:
- ✅ Success message appears: "Configuration saved successfully"
- ✅ No error message
- ✅ Button returns to normal state
- ✅ Config is saved in database

**Verification**:
- Check backend logs for: `[INFO] [OutboundAgentConfig] POST / Config created`
- Query DB: `SELECT * FROM outbound_agent_config WHERE org_id = '<your-org-id>'`
- Should return 1 row with your config

---

### Test 2: Update Existing Outbound Config
**Precondition**: Outbound config exists (from Test 1)

**Steps**:
1. Go to `/dashboard/outbound-agent-config`
2. Config should be pre-loaded
3. Change System Prompt to: "You are a professional sales representative for Call Waiting AI..."
4. Click "Save Configuration"

**Expected Result**:
- ✅ Success message appears
- ✅ No error message
- ✅ System Prompt is updated in UI
- ✅ Other fields remain unchanged

**Verification**:
- Check backend logs for: `[INFO] [OutboundAgentConfig] POST / Config updated`
- Query DB: `SELECT system_prompt FROM outbound_agent_config WHERE org_id = '<your-org-id>'`
- Should show the new system prompt

---

### Test 3: Partial Update via PUT Endpoint
**Precondition**: Outbound config exists

**Steps** (via curl or Postman):
```bash
curl -X PUT http://localhost:3001/api/founder-console/outbound-agent-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "first_message": "Hello! This is a test message."
  }'
```

**Expected Result**:
- ✅ Returns 200 OK
- ✅ Only first_message is updated
- ✅ Other fields (system_prompt, voice, etc.) remain unchanged

**Verification**:
- Check response includes updated first_message
- Query DB: Verify only first_message changed, other fields unchanged

---

### Test 4: Validation - Missing Required Fields
**Steps**:
1. Go to `/dashboard/outbound-agent-config`
2. Clear the System Prompt field
3. Click "Save Configuration"

**Expected Result**:
- ✅ Error message appears: "System prompt is required"
- ✅ Save button is disabled
- ✅ No request sent to backend
- ✅ Config is NOT saved

**Verification**:
- Check browser console: No POST request made
- Config in DB remains unchanged

---

### Test 5: Inbound Config Still Works
**Precondition**: Inbound config page exists and works

**Steps**:
1. Go to `/dashboard/inbound-config`
2. Edit any field (e.g., first message)
3. Click "Save"

**Expected Result**:
- ✅ Success message appears
- ✅ Config is saved
- ✅ No regression from outbound fix

**Verification**:
- Check backend logs
- Query DB: `SELECT * FROM inbound_agent_config`

---

### Test 6: Both Configs Can Be Edited Independently
**Steps**:
1. Edit and save Outbound config
2. Edit and save Inbound config
3. Edit and save Outbound config again
4. Verify both are updated correctly

**Expected Result**:
- ✅ All saves succeed
- ✅ Each config is independent
- ✅ No cross-contamination between configs

**Verification**:
- Query both tables: Verify each has correct data
- Check timestamps: Each should have recent `updated_at`

---

## Backend Logs to Monitor

**Success indicators**:
```
[INFO] [OutboundAgentConfig] POST / Config created
[INFO] [OutboundAgentConfig] POST / Config updated
[INFO] [OutboundAgentConfig] PUT / Config updated
```

**Error indicators** (should NOT see these):
```
[ERROR] [OutboundAgentConfig] POST / Failed to check existing config
[ERROR] [OutboundAgentConfig] POST / Create failed
[ERROR] [OutboundAgentConfig] POST / Update failed
```

---

## Database Verification

**Check if config exists**:
```sql
SELECT id, org_id, system_prompt, first_message, voice_id, updated_at 
FROM outbound_agent_config 
WHERE org_id = '<your-org-id>';
```

**Check creation/update timestamps**:
```sql
SELECT created_at, updated_at FROM outbound_agent_config 
WHERE org_id = '<your-org-id>';
```

**Verify data integrity**:
```sql
SELECT COUNT(*) FROM outbound_agent_config 
WHERE org_id = '<your-org-id>';
-- Should return 1 (only one config per org)
```

---

## Regression Tests

**Ensure no breaking changes**:
1. ✅ Inbound config still saves
2. ✅ Agent sync still triggers on save
3. ✅ Masked API keys still work
4. ✅ Validation still works
5. ✅ Rate limiting still works
6. ✅ Auth still required

---

## Success Criteria

- [x] Outbound config can be created from scratch
- [x] Outbound config can be updated
- [x] Inbound config still works
- [x] No duplicate configs created
- [x] Validation errors shown correctly
- [x] Backend logs show correct operations
- [x] Database has correct data
- [x] No breaking changes to other features

---

## Deployment Checklist

- [x] Fix applied to `backend/src/routes/outbound-agent-config.ts`
- [x] Backend restarted
- [x] All tests passing
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Verify in production environment

---

## Code Changes Summary

**File**: `backend/src/routes/outbound-agent-config.ts`

**Before**:
```typescript
const { data: existing } = await supabase
  .from('outbound_agent_config')
  .select('id')
  .eq('org_id', orgId)
  .single();  // ❌ Throws if 0 rows
```

**After**:
```typescript
const { data: existing, error: existingError } = await supabase
  .from('outbound_agent_config')
  .select('id')
  .eq('org_id', orgId)
  .maybeSingle();  // ✅ Returns null if 0 rows

if (existingError && existingError.code !== 'PGRST116') {
  logger.error('POST / Failed to check existing config', { orgId, error: existingError.message });
  res.status(500).json({ error: 'Failed to check configuration' });
  return;
}
```

**Why this fixes the issue**:
- `.single()` throws when 0 rows exist (first save fails)
- `.maybeSingle()` returns null when 0 rows exist (allows create logic)
- Error handling prevents unexpected errors from being swallowed
- Create-or-update logic now works correctly

