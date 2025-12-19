# Outbound Agent Configuration Verification

## Issue Summary
1. **Outbound config save**: Need to verify if the system prompt was saved successfully to Supabase
2. **Save button dormant**: Save button becomes inactive until both inbound AND outbound are edited (this is a separate issue in `/dashboard/agent-config`)

## Verification Steps

### Step 1: Check Backend Logs for Save Success
Look for these log messages:
```
[INFO] [OutboundAgentConfig] POST / Config created
[INFO] [OutboundAgentConfig] POST / Config updated
```

### Step 2: Verify Database via Backend API
Run this curl command to fetch the saved outbound config:
```bash
curl -X GET http://localhost:3001/api/founder-console/outbound-agent-config \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

Expected response:
```json
{
  "id": "uuid",
  "org_id": "your-org-id",
  "system_prompt": "You are a professional sales development representative...",
  "first_message": "Hi [Name], this is [Your Name] with Call Waiting AI...",
  "voice_id": "Paige",
  "language": "en-US",
  "max_call_duration": 600,
  "is_active": true,
  "vapi_api_key": "••••••••••••••••••••••••••••••••",
  "vapi_assistant_id": "assistant_xxx",
  "created_at": "2025-12-19T...",
  "updated_at": "2025-12-19T..."
}
```

### Step 3: Check Outbound Config Page Behavior
The `/dashboard/outbound-agent-config` page:
- ✅ Should allow editing ONLY outbound fields
- ✅ Save button should be enabled (only disabled during saving)
- ✅ Should NOT require inbound changes
- ✅ Should validate only required fields (system_prompt, first_message)

### Step 4: Identify the "Dormant Button" Issue
The dormant button issue is in `/dashboard/agent-config` (NOT `/dashboard/outbound-agent-config`):
- This page manages BOTH inbound and outbound together
- Line 218: `if (!payload.inbound && !payload.outbound)` prevents save if only one is changed
- This is a SEPARATE page from the standalone outbound config page

## Root Cause Analysis

### Outbound Config Save (✅ Should Work)
File: `/src/app/dashboard/outbound-agent-config/page.tsx`
- Independent page for outbound agent only
- Save button: `disabled={isSaving}` (only disabled during save)
- Validation: Only validates system_prompt, first_message, max_call_duration
- No dependency on inbound config
- **Status**: Should work correctly

### Agent Config Page (❌ Has the Dormant Button Issue)
File: `/src/app/dashboard/agent-config/page.tsx`
- Manages BOTH inbound and outbound together
- Line 166: `return inboundChanged || outboundChanged;` (checks if either changed)
- Line 218: `if (!payload.inbound && !payload.outbound)` (prevents save if only one changed)
- **Status**: This is the problematic page - requires BOTH to be edited

## Solution

### For Outbound Config Save (Already Fixed)
The `/dashboard/outbound-agent-config` page should work correctly:
1. Edit system prompt ✅
2. Click Save ✅
3. Config saves to database ✅

### For Dormant Button Issue
Need to fix `/src/app/dashboard/agent-config/page.tsx`:
- Remove the requirement to edit both inbound and outbound
- Allow saving changes to either one independently
- Only validate fields that are being changed

## Next Steps
1. Verify outbound config was saved (check backend logs)
2. Test outbound call with saved config
3. Fix the agent-config page to allow independent saves (if needed)

