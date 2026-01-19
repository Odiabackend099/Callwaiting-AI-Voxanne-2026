# System Prompt Missing in VAPI - Debug Analysis

## Critical Issue
User saved AI agent from dashboard, but when it appeared in VAPI dashboard, the system prompt was MISSING.

## Complete Data Flow Analysis

### 1. FRONTEND: What is sent from dashboard?
**File**: `src/app/dashboard/agent-config/page.tsx` (Line 345-390)

```typescript
// When user clicks "Save Inbound Agent"
const payload: any = {
  inbound: {
    systemPrompt: inboundConfig.systemPrompt,  // ✅ System prompt IS included
    firstMessage: inboundConfig.firstMessage,
    voiceId: inboundConfig.voice,
    language: inboundConfig.language,
    maxDurationSeconds: inboundConfig.maxDuration
  }
};

// Sent to: POST /api/founder-console/agent/behavior
await authedBackendFetch('/api/founder-console/agent/behavior', {
  method: 'POST',
  body: JSON.stringify(payload),
  ...
});
```

**Conclusion**: ✅ Frontend IS sending `systemPrompt`

---

### 2. BACKEND: What is received?
**File**: `backend/src/routes/founder-console-v2.ts` (Line 1848-1895)

```typescript
router.post('/agent/behavior', ...)
const { inbound, outbound } = req.body;

// Received as: { inbound: { systemPrompt, ... }, outbound: { systemPrompt, ... } }
// Problem: Code checks for BOTH 'system_prompt' AND 'systemPrompt'
const buildUpdatePayload = (config: any, agentRole: string) => {
  if (config.system_prompt !== undefined) {
    payload.system_prompt = config.system_prompt;  // ❌ Checking snake_case
  }
  if (config.systemPrompt !== undefined) {
    payload.system_prompt = config.systemPrompt;   // ✅ Checking camelCase
  }
```

**Conclusion**: ✅ Backend IS receiving `systemPrompt` correctly and mapping to `system_prompt`

---

### 3. DATABASE: Is system prompt saved?
**File**: `backend/src/routes/founder-console-v2.ts` (Line 2003-2018)

```typescript
// Update INBOUND agent if payload exists
if (inboundPayload && agentMap[AGENT_ROLES.INBOUND]) {
  const inboundAgentId = agentMap[AGENT_ROLES.INBOUND];
  const { error: updateError } = await supabase
    .from('agents')
    .update(inboundPayload)  // ✅ Should include system_prompt
    .eq('id', inboundAgentId)
    .eq('org_id', orgId);
```

**Database Update Flow**:
1. Backend creates/finds agent with ID
2. Updates agent with payload containing `system_prompt`
3. Supabase updates `agents` table `system_prompt` column

**Expected**: ✅ System prompt should be saved to DB

---

### 4. VAPI SYNC: How is system prompt sent to VAPI?
**File**: `backend/src/routes/founder-console-v2.ts` (Line 2119-2145)

```typescript
// After DB update, call ensureAssistantSynced()
const assistantId = await ensureAssistantSynced(id, vapiApiKey);
```

**File**: `backend/src/routes/founder-console-v2.ts` (Line 630-700)

```typescript
async function ensureAssistantSynced(agentId: string, vapiApiKey: string) {
  // 1. Fetch agent from database
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, system_prompt, voice, ...')  // ✅ Fetches system_prompt
    .eq('id', agentId);
  
  const agent = agents[0];

  // 2. Build assistant payload with system prompt
  const resolvedSystemPrompt = agent.system_prompt || buildOutboundSystemPrompt(...);
  
  const assistantCreatePayload = {
    name: agent.name,
    model: {
      provider: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'system', content: resolvedSystemPrompt }],  // ✅ System prompt included
      toolIds: []
    },
    voice: { ... },
    transcriber: { ... },
    firstMessage: resolvedFirstMessage,
    ...
  };

  // 3. Send to VAPI
  if (agent.vapi_assistant_id) {
    // UPDATE existing assistant
    await vapiClient.updateAssistant(agent.vapi_assistant_id, updatePayload);
  } else {
    // CREATE new assistant
    const assistant = await vapiClient.createAssistant(assistantCreatePayload);
  }
}
```

**Expected**: ✅ System prompt should be sent to VAPI in model.messages[0].content

---

## Root Cause Analysis - WHERE IS IT BREAKING?

### Hypothesis 1: System prompt not saved to database?
- **Test**: Query agents table directly after save
- **SQL**: `SELECT id, system_prompt FROM agents WHERE role='inbound' ORDER BY updated_at DESC LIMIT 1;`

### Hypothesis 2: System prompt not fetched from database before Vapi sync?
- **Problem**: If `agent.system_prompt` is NULL or empty, uses fallback: `buildOutboundSystemPrompt()`
- **File**: Line 652-653
- **Fix**: Ensure system prompt is actually saved BEFORE sync happens

### Hypothesis 3: System prompt sent but VAPI not updating it?
- **Problem**: When updating existing assistant, must preserve `toolIds`
- **File**: Line 709-727 (UPDATE payload construction)
- **Issue**: If update payload is malformed, VAPI might ignore it

### Hypothesis 4: System prompt sent but stored as different field name in VAPI?
- **VAPI API Contract**: system prompt MUST be in `model.messages[0].content`
- **Verify**: Check VAPI dashboard assistant JSON structure

---

## Investigation Steps

### Step 1: Check if system_prompt reaches database
```sql
SELECT 
  id, 
  role, 
  system_prompt, 
  updated_at,
  vapi_assistant_id
FROM agents
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY updated_at DESC
LIMIT 5;
```

### Step 2: Check what was sent to VAPI
- Add console.log() in ensureAssistantSynced BEFORE vapiClient.updateAssistant()
- Log the full updatePayload
- Look for `model.messages[0].content`

### Step 3: Check VAPI assistant directly
- Go to VAPI dashboard → Assistants
- Click on the assistant that was just saved
- Check "Model" section → "System Prompt" field
- Verify it contains the system prompt you saved

### Step 4: Monitor backend logs in real-time
```bash
tail -f /tmp/backend-debug.log | grep -i "system\|prompt\|sync"
```

---

## Most Likely Root Cause

**The system prompt IS being saved to the database, but may not be:**
1. **Being fetched correctly** - Database query not returning it
2. **Being sent in the correct VAPI format** - Wrong payload structure
3. **Being preserved during updates** - Existing tools/config overwriting it

---

## Action Items

1. Add detailed logging to `ensureAssistantSynced()` function
2. Log the exact payload being sent to VAPI
3. Query database to verify system_prompt is saved
4. Check VAPI API response to see if update succeeded
5. Compare working assistant vs broken assistant in VAPI dashboard

