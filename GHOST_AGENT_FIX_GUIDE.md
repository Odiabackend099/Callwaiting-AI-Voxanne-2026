# 🔧 GHOST AGENT FIX GUIDE

**Problem:** Test call connects to the WRONG agent (not the one you configured for voxanne@demo.com)

**Root Cause:** Likely a database integrity issue or JWT configuration problem

---

## ⚡ QUICK FIX (3 Steps)

### Step 1: Run Diagnostic Script

```bash
cd backend
npx ts-node src/scripts/diagnose-agent-issue.ts voxanne@demo.com
```

**This will output:**
- ✅ Organization details
- 📊 Agent configuration status
- ⚠️ Any data integrity issues
- 🔧 Recommended fixes

### Step 2: If Duplicates Found → Run Cleanup

If diagnostic says "FOUND X OUTBOUND AGENTS (DATA CORRUPTION)", run:

```bash
cd backend

# First: Check what will be deleted (DRY RUN)
npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id 46cf2995-2bee-44e3-838b-24151486fe4e --dry-run

# Then: Actually delete stale agents
npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id 46cf2995-2bee-44e3-838b-24151486fe4e --execute
```

**Note:** Replace `46cf2995-2bee-44e3-838b-24151486fe4e` with the org_id from diagnostic output

### Step 3: Verify Fix

1. Go to `/dashboard/test` (Phone tab)
2. Enter your phone number
3. Click "Start Call"
4. **Expected:** Call comes in to your phone from the CORRECT agent

---

## 📋 What Was Fixed

### New Diagnostic Scripts Created

1. **`backend/src/scripts/diagnose-agent-issue.ts`**
   - Identifies root cause of agent configuration issue
   - Detects duplicate agents, missing IDs, etc.
   - Provides actionable recommendations

2. **`backend/src/scripts/cleanup-duplicate-agents.ts`**
   - Safely removes duplicate/stale agents
   - Keeps only the most recent configuration
   - Supports dry-run mode before actual deletion

### Backend Hardening Added

File: `backend/src/routes/founder-console-v2.ts`

**3 New Diagnostic Checks:**

1. **Agent Lookup Logging**
   - Logs which organization and agent were found
   - Helps verify correct org_id in JWT token
   - Shows missing assistant/phone IDs

2. **Duplicate Detection**
   - Warns if multiple outbound agents exist for same org
   - Flags data corruption issues
   - Continues with first match (but alerts)

3. **Assistant Validation**
   - Verifies assistant ID exists in Vapi
   - Logs assistant name for confirmation
   - Prevents cross-organization agent usage

---

## 🔍 Understanding the Root Causes

### Most Likely: JWT has Wrong org_id

**Symptom:** Diagnostic shows different outbound agent than expected

**Cause:**
- User logged in as `voxanne@demo.com`
- But JWT contains org_id from different organization
- Backend queries wrong org's agent

**Fix:**
1. Log out completely
2. Log in again as `voxanne@demo.com`
3. Verify JWT token has correct org_id

### Likely: Duplicate Agents

**Symptom:** Diagnostic shows "FOUND 2+ OUTBOUND AGENTS"

**Cause:**
- Multiple agent configurations created for same role
- Backend uses first match (might be stale)
- Test calls wrong agent

**Fix:**
1. Run cleanup script (see Step 2 above)
2. Script removes stale agents, keeps most recent

### Less Likely: Agent Not Saved

**Symptom:** Diagnostic shows "No outbound agent configured"

**Cause:**
- Agent save button didn't work
- Configuration didn't persist to database

**Fix:**
1. Go to Agent Configuration page
2. Make a small change (e.g., edit system prompt)
3. Click "Save Outbound Agent"
4. Wait for success message

---

## 📊 Diagnostic Output Examples

### Example 1: Everything is OK ✅

```
✅ Found org: voxanne@demo.com
   Org ID: 46cf2995-2bee-44e3-838b-24151486fe4e

✅ Found 1 total agents

🎯 Analyzing OUTBOUND agents...
✅ Found 1 outbound agent (GOOD)

✅ DIAGNOSTIC SUMMARY
Organization: voxanne@demo.com
Outbound Agents: 1
Inbound Agents: 1

✅ NO ISSUES DETECTED
Database state looks correct.
```

### Example 2: Duplicate Agents Found ❌

```
❌ FOUND 2 OUTBOUND AGENTS (DATA CORRUPTION!)

   Agent 1:
     ID: 12345678...
     Created: Feb 5, 2026
     Assistant: asst_abc123 ← MOST RECENT (KEEP THIS)

   Agent 2:
     ID: 87654321...
     Created: Feb 4, 2026
     Assistant: asst_xyz789 ← STALE (DELETE THIS)

📋 DIAGNOSTIC SUMMARY
Outbound Agents: 2

⚠️ ISSUES DETECTED:
1. ❌ 2 outbound agents found (should be 1)
   FIX: npx ts-node src/scripts/cleanup-duplicate-agents.ts ...
```

### Example 3: Missing Assistant ID ⚠️

```
❌ 1 agent(s) have NULL vapi_assistant_id
   - outbound agent will use legacy ensureAssistantSynced() fallback

📋 DIAGNOSTIC SUMMARY

⚠️ ISSUES DETECTED:
2. ❌ 1 agent(s) have NULL vapi_assistant_id
   FIX: Save agent config again in dashboard
```

---

## 🔍 Backend Logs (After Fix)

When you make a test call, check backend logs:

```
[INFO] Outbound agent found - verifying configuration
  orgId: 46cf2995-2bee-44e3-838b-24151486fe4e
  agentId: 12345678-1234-1234-1234-123456789abc
  hasAssistantId: true
  hasPhoneId: true

[INFO] Using Vapi assistant - verified
  assistantId: t_abc123
  assistantName: Call Waiting AI Outbound Agent (Test)
  orgId: 46cf2995-2bee-44e3-838b-24151486fe4e
```

✅ If you see these logs with correct org_id → **Fix is working!**

---

## ❌ If Problem Persists

After running diagnostic and cleanup, if issue still exists:

### Check 1: JWT Token

```javascript
// Open browser console and run:
const session = await supabase.auth.getSession();
console.log('org_id:', session.data.session?.user?.app_metadata?.org_id);
console.log('email:', session.data.session?.user?.email);
```

Expected output:
```
org_id: 46cf2995-2bee-44e3-838b-24151486fe4e
email: voxanne@demo.com
```

If org_id doesn't match → **Re-login required**

### Check 2: Database Query

```sql
-- Run in Supabase SQL editor
SELECT
  org.id,
  org.email,
  COUNT(CASE WHEN agents.role = 'outbound' THEN 1 END) as outbound_count,
  agents.id,
  agents.vapi_assistant_id
FROM organizations org
LEFT JOIN agents ON agents.org_id = org.id
WHERE org.email = 'voxanne@demo.com'
GROUP BY org.id, org.email, agents.id, agents.vapi_assistant_id;
```

Look for:
- ✅ Exactly 1 row with role='outbound'
- ✅ vapi_assistant_id is NOT NULL

### Check 3: Logs

In your backend, look for these error logs:

```
[ERROR] No outbound agent found for org
[WARN] Multiple outbound agents found for org
[WARN] Failed to fetch assistant details
```

These indicate specific problems to investigate.

---

## 🎯 Final Verification

Once fix is applied:

1. **Backend deployed** → New diagnostic logging active
2. **Test call made** → Backend logs show correct org_id and agent_id
3. **Call received** → Correct agent answers (not the ghost agent)
4. **Success!** → Database is now the single source of truth ✅

---

## 📞 Still Need Help?

If diagnostic script identifies the problem but you're unsure how to fix:

1. **Diagnostic shows duplicates?** → Run cleanup script (Step 2)
2. **Diagnostic shows no agents?** → Save agent config again in dashboard
3. **Diagnostic shows NULL IDs?** → Select phone number and save again
4. **Still wrong agent?** → Check JWT token org_id (Check 1 above)

**Backend logs** will show exactly which org_id and agent_id are being used → **Compare with your dashboard configuration**

---

## 🚀 Prevention Going Forward

The new diagnostic checks will automatically:
- ✅ Log which agent is being used
- ✅ Detect duplicate agents
- ✅ Warn about missing IDs
- ✅ Validate assistant exists

**These logs help catch issues BEFORE they affect users!**
