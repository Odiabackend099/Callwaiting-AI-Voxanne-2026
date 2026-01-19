# 🚨 CRITICAL FINDINGS: Agent Save → Vapi Sync Issue

**Generated:** January 19, 2026 | **For:** voxanne@demo.com

---

## Executive Summary

You're experiencing a **database vs. Vapi synchronization gap** where:
- ✅ Agent configuration saves to database
- ❌ Agent is NOT created in Vapi
- ❌ Agent doesn't appear in Vapi dashboard
- ✅ Backend logs show "Agent Saved" (misleading)

**Root Cause:** The `ensureAssistantSynced()` function is either:
1. **Not being called** (missing VAPI_PRIVATE_KEY)
2. **Failing silently** (error not propagated)
3. **Returning success but not creating in Vapi** (Vapi API error)

---

## The Agent Save Architecture

### What SHOULD Happen (Correct Flow)

```
Dashboard (Save Agent)
    ↓
POST /api/founder-console/agent/behavior
    ↓
[1] Validate JWT + Extract orgId
    ↓
[2] Find/Create agents (inbound + outbound)
    ↓
[3] Update agent config (system_prompt, voice, language)
    ↓
[4] ✅ "Agent Saved" logged (database update succeeded)
    ↓
[5] Call ensureAssistantSynced(agentId, vapiApiKey)
    ├─ If vapi_assistant_id is NULL:
    │  └─ Create NEW assistant in Vapi (POST /assistant)
    └─ If vapi_assistant_id is SET:
       └─ Update existing (PATCH /assistant)
    ↓
[6] Save returned vapi_assistant_id to database
    ↓
[7] Async: Register + link tools (ToolSyncService)
    ↓
Response: { success: true, vapiSynced: true }
    ↓
User sees agent in Vapi dashboard ✅
```

### What's ACTUALLY Happening (Your Issue)

```
Dashboard (Save Agent)
    ↓
POST /api/founder-console/agent/behavior
    ↓
[1] Validate JWT + Extract orgId ✅
    ↓
[2] Find/Create agents ✅
    ↓
[3] Update agent config ✅
    ↓
[4] ✅ "Agent Saved" logged (database update succeeded)
    ↓
[5] Call ensureAssistantSynced(agentId, vapiApiKey)
    ├─ vapiApiKey is MISSING/NULL/INVALID ❌
    ├─ OR Vapi API returns error (4xx/5xx) ❌
    ├─ OR network failure ❌
    └─ Result: vapi_assistant_id remains NULL
    ↓
[6] vapi_assistant_id NOT saved to database (or already NULL)
    ↓
[7] Agent exists in database but NOT in Vapi
    ↓
Response: May say "browser-only mode" or error
    ↓
Agent NOT visible in Vapi dashboard ❌
```

---

## Critical Code Sections

### Where "Agent Saved" Log Appears
**File:** `backend/src/routes/founder-console-v2.ts`  
**Lines:** 1950-1999

```typescript
// This is where agents are SAVED TO DATABASE
const { error: updateError } = await supabase
  .from('agents')
  .update(inboundPayload)
  .eq('id', inboundAgentId);

if (updateError) {
  logger.error('Failed to update inbound agent', { ... });
} else {
  logger.info('Inbound agent updated', { ... }); // ← "Agent Saved" message
}
```

**This does NOT mean Vapi sync succeeded!**

### Where Vapi Sync Happens
**File:** `backend/src/routes/founder-console-v2.ts`  
**Lines:** 2001-2050

```typescript
if (vapiApiKey) {
  const syncPromises = agentIdsToSync.map(async (id) => {
    try {
      const assistantId = await ensureAssistantSynced(id, vapiApiKey!);
      return { agentId: id, assistantId, success: true };
    } catch (error: any) {
      return { agentId: id, success: false, error: error.message };
    }
  });

  const syncResults = await Promise.all(syncPromises);
  
  if (failedSyncs.length > 0) {
    res.status(500).json({
      success: false,
      error: `Failed to sync ${failedSyncs.length} agent(s) to Vapi: ${errorMessage}`
    });
    return;  // ← Returns error response
  }
} else {
  // Browser-only mode: vapiApiKey was NULL
  logger.info('Agent configuration saved in browser-only mode');
  res.status(200).json({ mode: 'browser-only', vapiSynced: false });
}
```

**Key Issue:** If `vapiApiKey` is NULL or empty, sync is SKIPPED and agent remains unsynced!

### The ensureAssistantSynced Function
**File:** `backend/src/routes/founder-console-v2.ts`  
**Lines:** 630-830

```typescript
async function ensureAssistantSynced(agentId: string, vapiApiKey: string, ...): Promise<string> {
  // Get agent from database
  const agent = await supabase.from('agents').select(...).eq('id', agentId).single();
  
  // Build Vapi payload
  const assistantCreatePayload = {
    name: agent.name,
    model: { provider: 'openai', model: 'gpt-4', ... },
    voice: { provider: 'vapi', voiceId: agent.voice },
    // ...
  };

  // If assistant already exists, try UPDATE (idempotent)
  if (agent.vapi_assistant_id) {
    try {
      const existingAssistant = await vapiClient.getAssistant(agent.vapi_assistant_id);
      // Update logic...
      return agent.vapi_assistant_id;
    } catch (updateError) {
      // Fall through to CREATE
    }
  }

  // CREATE new assistant
  let assistant;
  try {
    assistant = await withRetry(() => 
      vapiClient.createAssistant(assistantCreatePayload)
    );
  } catch (createErr: any) {
    throw new Error(`Vapi assistant creation failed: ${createErr.message}`);
  }

  // Save assistant ID to database
  const { data: updated, error: updateError } = await supabase
    .from('agents')
    .update({ vapi_assistant_id: assistant.id })
    .eq('id', agentId)
    .eq('vapi_assistant_id', null);

  if (!updated || updated.length === 0) {
    // Race condition or ID already set
    return assistant.id;
  }

  return assistant.id;
}
```

**Where sync can fail:**
1. Line 644: `vapiClient.createAssistant()` throws error
2. Line 733: Database update fails
3. Vapi API returns 4xx/5xx error

---

## How to Diagnose YOUR Issue

### Step 1: Check Environment Variable
```bash
cd backend
cat .env | grep VAPI_PRIVATE_KEY
```

**Expected output:**
```
VAPI_PRIVATE_KEY='dc0ddc43-42ae-493b-a082-6e15cd7d739a'
```

**If output is:**
- Blank / commented out → PROBLEM FOUND
- `VAPI_PRIVATE_KEY=` (empty value) → PROBLEM FOUND
- Shows a valid UUID → Continue to Step 2

### Step 2: Check Database for Agent
```sql
-- Query your Supabase database
SELECT 
  id, 
  role, 
  name, 
  vapi_assistant_id,
  system_prompt,
  updated_at
FROM agents
WHERE org_id = (SELECT id FROM organizations WHERE name ILIKE '%MedSpa%')
ORDER BY updated_at DESC
LIMIT 5;
```

**Interpretation:**
- `vapi_assistant_id` is NULL → Vapi sync never completed
- `vapi_assistant_id` has a UUID → Check Vapi dashboard

### Step 3: Check Backend Logs
```bash
# If backend is running in another terminal
# Look for error patterns

grep -i "failed to sync\|vapi assistant creation failed\|browser-only mode" backend_startup.log | tail -20
```

**Look for patterns:**
- `"mode": "browser-only"` → No Vapi key found
- `"Vapi assistant creation failed"` → API error from Vapi
- `"Failed to save Vapi assistant ID"` → Database error

### Step 4: Test Vapi API Key
```bash
# Validate the API key
curl -s -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
  https://api.vapi.ai/assistant?limit=1 | head -c 100

# Should return JSON with assistants, not 401 Unauthorized
```

### Step 5: Check Vapi Dashboard
1. Go to https://dashboard.vapi.ai
2. Navigate to "Assistants"
3. Look for assistants created around the same time you saved
4. Check assistant names for "MedSpa", "VoxAnne", or "Inbound"

**If you don't see them:**
- Check if you're in correct Vapi account
- Check if there are filters applied
- Check "Recently Deleted" section

---

## The Most Likely Root Cause

Based on the architecture, the MOST LIKELY issue is:

### **VAPI_PRIVATE_KEY is missing or empty in `backend/.env`**

This causes:
1. Line 1862 in founder-console-v2.ts: `vapiApiKey` becomes null
2. Line 1886: Logs "Agent configuration saved in browser-only mode"
3. Sync is completely SKIPPED
4. Agent never reaches Vapi
5. Response says `"mode": "browser-only"` and `"vapiSynced": false`

**How to fix:**
```bash
# 1. Verify VAPI_PRIVATE_KEY is set
echo $VAPI_PRIVATE_KEY

# 2. If empty, get new key from Vapi dashboard
# https://vapi.ai/dashboard/settings

# 3. Update backend/.env
echo "VAPI_PRIVATE_KEY='your-key-here'" >> backend/.env

# 4. Restart backend
cd backend && npm run dev

# 5. Try saving agent again
```

---

## Second Most Likely Cause

### **VAPI_PRIVATE_KEY is invalid or was rotated**

This causes:
1. Vapi API returns `401 Unauthorized`
2. `ensureAssistantSynced()` throws error
3. Backend logs show "Vapi assistant creation failed (status 401)"
4. Agent is not created
5. Response returns `success: false` with error message

**How to fix:**
```bash
# 1. Get current key from Vapi
# https://vapi.ai/dashboard/settings/api-keys

# 2. Update backend/.env with NEW key
VAPI_PRIVATE_KEY='new-key-uuid'

# 3. Restart backend
kill %1  # kill previous npm run dev
cd backend && npm run dev

# 4. Try saving agent again
```

---

## How to VERIFY the Fix Works

### Test 1: Agent Saves and Syncs
1. Open Voxanne dashboard
2. Go to Settings / Configure Agent
3. Edit agent config (change system prompt slightly)
4. Click "Save Agent"
5. Check response message:
   - Should say "Agent configuration saved and synced to Vapi"
   - Should have `"vapiSynced": true`
   - Should show `"successCount": 1` or `"successCount": 2`

### Test 2: Agent Appears in Vapi
1. Go to https://dashboard.vapi.ai/assistants
2. Look for newly created assistants
3. Should see "VoxAnne (Inbound)" or "VoxAnne (Outbound)"
4. Created timestamp should match save time

### Test 3: Database is Synced
```sql
SELECT id, role, vapi_assistant_id 
FROM agents 
WHERE org_id = '<your-org-id>'
LIMIT 5;
```
- Both `vapi_assistant_id` columns should have UUIDs
- Not NULL

---

## Next Steps (Priority Order)

1. **IMMEDIATELY:** Check if `VAPI_PRIVATE_KEY` is set in `backend/.env`
   - Run: `grep VAPI_PRIVATE_KEY backend/.env`
   - If empty/missing → Add it and restart backend

2. **If key exists:** Check backend logs for errors
   - Look for "failed to sync" or "Vapi assistant creation failed"
   - Check if response says "browser-only mode"

3. **If still not working:** Verify Vapi API key is valid
   - Run curl command from Step 4 above
   - If 401 Unauthorized → Get new key from Vapi dashboard

4. **If key is valid:** Check Vapi dashboard
   - Assistants may exist but not visible
   - Check filters, pagination, search

5. **Final option:** Check if another process is interfering
   - Are there multiple backend instances running?
   - Are there multiple save requests happening?
   - Is there a race condition?

---

## Reference: File Locations

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/routes/founder-console-v2.ts` | 1734 | POST /agent/behavior entry point |
| `backend/src/routes/founder-console-v2.ts` | 1862 | Vapi key resolution (where it can be NULL) |
| `backend/src/routes/founder-console-v2.ts` | 1877 | Agent creation/finding |
| `backend/src/routes/founder-console-v2.ts` | 1950 | Database agent update ("Agent Saved" happens here) |
| `backend/src/routes/founder-console-v2.ts` | 2001 | Vapi sync loop (where it can fail) |
| `backend/src/routes/founder-console-v2.ts` | 630 | `ensureAssistantSynced()` function |
| `backend/src/routes/founder-console-v2.ts` | 710 | Vapi API POST/PATCH call |
| `backend/src/routes/founder-console-v2.ts` | 730 | Save assistant ID to database |
| `backend/src/services/tool-sync-service.ts` | 60 | Tool sync (async, doesn't block response) |

---

## Questions & Answers

**Q: Why does the log say "Agent Saved" if it's not in Vapi?**  
A: "Agent Saved" refers to database save (line 1950), not Vapi sync (line 2001). These are separate operations.

**Q: Will trying again fix it?**  
A: Only if you fix the underlying cause (VAPI_PRIVATE_KEY, etc.). Retrying without fixing won't help.

**Q: How long does it take to sync?**  
A: Sync happens immediately (<2 seconds). If you wait 5 seconds and don't see it in Vapi, it failed.

**Q: Can I manually create the agent in Vapi?**  
A: Yes, but then you need to manually save the assistant ID to the database so Vapi dashboard can show it.

**Q: Does the agent work even if it's not synced?**  
A: No. The agent needs to be created in Vapi to receive calls. Without Vapi ID, the system can't route calls to it.

---

**Report Complete. Next Step: Check VAPI_PRIVATE_KEY in backend/.env**

For questions, refer to AGENT_SAVE_DIAGNOSTIC.md for detailed troubleshooting steps.
