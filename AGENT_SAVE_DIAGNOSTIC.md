# 🔍 AGENT SAVE FLOW AUDIT & DIAGNOSTIC REPORT
**Voxanne AI - January 19, 2026**

## Issue Summary

**User Reports:**
- Click "Save Agent" for MedSpa Aesthetics
- Backend logs show "Agent Saved"
- Agent does NOT appear in Vapi dashboard
- Agent likely not showing in Voxanne dashboard either

## Root Cause Analysis

### The Agent Save Flow (What Should Happen)

When you click "Save Agent" on the dashboard:

**Step 1: Frontend Request**
```
POST /api/founder-console/agent/behavior
Body: {
  inbound: { systemPrompt, voice, language, maxCallDuration },
  outbound: { systemPrompt, voice, language, maxCallDuration }
}
```

**Step 2: Backend Authentication & Org Resolution**
- Location: `backend/src/routes/founder-console-v2.ts` line 1734
- Validates JWT token
- Extracts `orgId` from JWT `app_metadata`
- Rejects request if not authenticated

**Step 3: Agent Creation/Finding**
- Location: lines 1877-1933
- Queries database for existing agents with `role='inbound'` and `role='outbound'`
- If agents don't exist: Creates them with default system prompts
- If agents exist: Proceeds to update

**Step 4: Agent Configuration Update**
- Location: lines 1972-1999
- Updates the agent records with new:
  - `system_prompt`
  - `voice`
  - `language`
  - `max_call_duration`
  - `first_message`
- **At this point, "Agent Saved" message would appear in logs**

**Step 5: CRITICAL - Vapi Sync**
- Location: lines 2001-2050
- Gets `vapi_assistant_id` from agent record
- **If `vapi_assistant_id` is NULL:**
  - Calls `ensureAssistantSynced(agentId, vapiApiKey)`
  - Creates NEW assistant in Vapi (POST /assistant)
  - Saves returned assistant ID to database
- **If `vapi_assistant_id` is NOT NULL:**
  - Validates assistant still exists in Vapi (GET /assistant/:id)
  - Updates existing assistant (PATCH /assistant/:id)
  - Preserves existing tool IDs

**Step 6: Tool Synchronization (Async)**
- Location: lines 819-851
- Calls `ToolSyncService.syncAllToolsForAssistant()` as **fire-and-forget** (async)
- Registers tools globally
- Links tools to assistant
- Does NOT block response (completes in background)

**Step 7: Response**
- Lines 2052-2066: Returns success with details

### Why It's Not Showing in Vapi

#### Scenario A: `vapi_assistant_id` IS NULL
**Diagnosis:** `ensureAssistantSynced()` failed silently
- Assistant was never created in Vapi
- No ID was saved to database
- **Look for errors in logs** at lines 698-757 (ensureAssistantSynced function)

**Possible causes:**
1. `VAPI_PRIVATE_KEY` is missing from `.env`
2. `VAPI_PRIVATE_KEY` is invalid/expired
3. Vapi API returned an error (rate limited, account issue, etc.)
4. Network issue reaching Vapi API

#### Scenario B: `vapi_assistant_id` IS SET
**Diagnosis:** Agent was created but not visible
- Assistant ID exists in database
- Assistant might be in Vapi but not showing
- **Check Vapi dashboard directly** at https://dashboard.vapi.ai/assistants

**Possible causes:**
1. You're logged into wrong Vapi account (if multiple accounts)
2. Filter is hiding the assistant (check filters)
3. Assistant was created but with wrong name
4. Vapi API key has changed since assistant was created

## How to Diagnose (Step-by-Step)

### Step 1: Find the Organization
```sql
-- Connect to Supabase
-- Run in SQL editor or psql

SELECT id, name 
FROM organizations 
WHERE name ILIKE '%medspa%' 
LIMIT 5;
```

Expected output: You should see "MedSpa Aesthetics" or similar

### Step 2: Find Agents for That Org
```sql
SELECT 
  id,
  role,
  name,
  system_prompt,
  voice,
  vapi_assistant_id,
  created_at,
  updated_at
FROM agents
WHERE org_id = '<ORG_ID_FROM_STEP_1>'
ORDER BY updated_at DESC;
```

**Critical Check:**
- `vapi_assistant_id` is NULL? → Assistant never created in Vapi
- `vapi_assistant_id` has a value? → Assistant was created, check Vapi

### Step 3: Check Backend Logs for Errors
```bash
# If backend is running, check terminal output
# Look for patterns:
grep -i "syncing agents to vapi" backend_startup.log
grep -i "vapi assistant creation failed" backend_startup.log
grep -i "failed to sync" backend_startup.log

# Full search with context
grep -i "agent\|vapi\|sync" backend_startup.log | tail -50 | grep -i "error\|failed"
```

### Step 4: Verify Vapi API Key
```bash
# Test if VAPI_PRIVATE_KEY is valid
curl -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
     https://api.vapi.ai/assistant?limit=1

# Should return a list of assistants, not 401 Unauthorized
```

### Step 5: Check Vapi Dashboard
- Go to https://dashboard.vapi.ai/assistants
- Verify you're logged into correct account
- Sort by "Created Date" - should see recently created assistants
- Look for "MedSpa" or "VoxAnne" in assistant names

## Common Causes & Fixes

### Cause 1: Missing or Invalid VAPI_PRIVATE_KEY

**How to fix:**
1. Get new key from https://vapi.ai/dashboard/settings
2. Update `backend/.env`:
   ```
   VAPI_PRIVATE_KEY='your-new-key-here'
   ```
3. Restart backend: `cd backend && npm run dev`
4. Try saving agent again

### Cause 2: Browser-Only Mode (No Vapi Key)

**How to detect:**
- Response from agent save says `"mode": "browser-only"`
- Backend logs say `"Agent configuration saved in browser-only mode"`
- Agent saves locally but not to Vapi

**How to fix:**
1. Ensure `VAPI_PRIVATE_KEY` is set in `backend/.env`
2. Verify it's not blank or just a comment
3. Restart backend
4. Try saving agent again

### Cause 3: Race Condition

**How to detect:**
- Logs show "Race condition: another request already saved assistant ID"
- Multiple save attempts happening simultaneously

**How to fix:**
- This is usually harmless - just try saving again
- Database will keep the assistant ID that's already saved

### Cause 4: Network/API Error from Vapi

**How to detect:**
- Logs show `Vapi assistant creation failed (status 429)` or similar
- Agent database update succeeds but Vapi sync fails

**How to fix:**
1. Check Vapi API status: https://status.vapi.ai/
2. Wait a few seconds and try again
3. Verify API key hasn't been rate limited
4. Check Vapi account quotas

## Manual Fix (If Needed)

If database is out of sync with Vapi:

### Scenario A: Agent in database but not in Vapi
```sql
-- Find agents needing Vapi sync
SELECT id, org_id, role, vapi_assistant_id
FROM agents
WHERE vapi_assistant_id IS NULL
AND org_id = '<ORG_ID>';

-- Solution: Manually create assistants in Vapi and update database
UPDATE agents
SET vapi_assistant_id = '<VAPI_ASSISTANT_ID>'
WHERE id = '<AGENT_ID>';
```

### Scenario B: Agent in Vapi but not in database
1. Find the assistant ID in Vapi dashboard
2. Update database:
   ```sql
   UPDATE agents
   SET vapi_assistant_id = '<VAPI_ID>'
   WHERE org_id = '<ORG_ID>' AND role = 'inbound';
   ```

## Testing the Flow End-to-End

### Test 1: Local API Test
```bash
# Start backend if not running
cd backend && npm run dev

# In another terminal, test agent save endpoint
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "Test prompt",
      "voice": "Sage",
      "language": "en"
    }
  }'
```

### Test 2: Check Database After Save
```sql
-- Immediately after clicking save
SELECT id, role, vapi_assistant_id, updated_at
FROM agents
WHERE org_id = '<ORG_ID>'
ORDER BY updated_at DESC
LIMIT 2;

-- Check if vapi_assistant_id was populated
```

### Test 3: Check Vapi Assistant
```bash
# If vapi_assistant_id is set to (e.g.) "abc-123-def"
curl -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
     https://api.vapi.ai/assistant/abc-123-def | jq '.'

# Should return full assistant details
# If 404: Assistant was deleted from Vapi
```

## Code Flow Reference

| File | Function | Line | Purpose |
|------|----------|------|---------|
| `founder-console-v2.ts` | `/agent/behavior` route | 1734 | Entry point for agent save |
| `founder-console-v2.ts` | Agent creation | 1877 | Find/create agents |
| `founder-console-v2.ts` | Agent update | 1972 | Update with new config |
| `founder-console-v2.ts` | Vapi sync loop | 2001 | Call ensureAssistantSynced |
| `founder-console-v2.ts` | `ensureAssistantSynced()` | 630 | Main sync function |
| `founder-console-v2.ts` | UPDATE vs CREATE logic | 650 | Check if should update or create |
| `founder-console-v2.ts` | Vapi API call | 710 | POST /assistant or PATCH |
| `founder-console-v2.ts` | Database save | 730 | Save assistant ID to agents table |
| `founder-console-v2.ts` | Tool sync trigger | 819 | Fire-and-forget tool sync |
| `tool-sync-service.ts` | `syncAllToolsForAssistant()` | 60 | Async tool registration |

## Questions to Answer

Before reporting as a bug, answer these:

1. **Is `VAPI_PRIVATE_KEY` set in `.env`?**
   - Check: `grep VAPI_PRIVATE_KEY backend/.env`
   - Should NOT be blank or commented out

2. **Is the agent in the database with `vapi_assistant_id = NULL`?**
   - Check Step 2 above
   - If NULL, Vapi sync never completed

3. **Do you see any ERROR messages in backend logs?**
   - Check Step 3 above
   - Look for "failed", "error", "Vapi", etc.

4. **Is the Vapi API key for the same account you're checking?**
   - Different accounts have different assistants
   - Verify in Vapi dashboard settings

5. **Were there recent changes to VAPI_PRIVATE_KEY?**
   - API keys can be rotated
   - Old key would cause 401 errors

## Next Steps

1. **Immediate:** Check database query from Step 2 above
2. **If vapi_assistant_id is NULL:** Backend is not syncing to Vapi
   - Check VAPI_PRIVATE_KEY environment variable
   - Restart backend
   - Try saving agent again
3. **If vapi_assistant_id is SET:** Check Vapi dashboard directly
   - May be displaying correctly but filtered out
   - Check Vapi account login

---

**Report Generated:** January 19, 2026  
**For:** voxanne@demo.com  
**Issue:** Agent not syncing to Vapi after save
