# Quick Start: KB & System Prompt Fixes

## What Changed?
4 critical fixes to enable AI assistant to query knowledge base and sync system prompts to Vapi.

## Files Modified
```
backend/src/services/vapi-client.ts          (1 method added)
backend/src/routes/knowledge-base.ts         (1 function updated)
backend/src/routes/founder-console-v2.ts     (2 functions updated)
```

## Verify Fixes Are Applied

### Check 1: VapiClient has getTool() method
```bash
grep -n "async getTool" backend/src/services/vapi-client.ts
# Should show: 273:  async getTool(toolId: string) {
```

### Check 2: attachToolToAssistant uses modern tools array
```bash
grep -n "const mergedTools = \[...existingTools" backend/src/routes/knowledge-base.ts
# Should show: 164:      const mergedTools = [...existingTools, newTool];
```

### Check 3: ensureAssistantSynced preserves KB tools
```bash
grep -n "Preserving KB tools during assistant update" backend/src/routes/founder-console-v2.ts
# Should show: 636:      logger.info('Preserving KB tools during assistant update', {
```

### Check 4: syncAssistantPromptInBackground preserves tools
```bash
grep -n "Preserve existing tools (especially KB query tools)" backend/src/routes/founder-console-v2.ts
# Should show: 1093:      const existingTools = existingAssistant?.tools || [];
```

## Quick Test (5 minutes)

### 1. Upload KB Document
```bash
curl -X POST http://localhost:3000/api/knowledge-base \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.txt",
    "content": "Our company provides AI solutions.",
    "category": "general"
  }'
```

### 2. Sync KB to Agents
```bash
curl -X POST http://localhost:3000/api/knowledge-base/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "knowledge-search",
    "assistantRoles": ["inbound", "outbound"]
  }'
```

### 3. Check Vapi Dashboard
- Go to Vapi dashboard
- Select inbound assistant
- Look for "Tools" section
- Verify `query_kb` tool is present

### 4. Update System Prompt
```bash
curl -X POST http://localhost:3000/api/founder-console/agent/behavior \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "You are a helpful assistant. Use the knowledge base to answer questions."
    }
  }'
```

### 5. Check Vapi Dashboard Again
- Go to inbound assistant
- Verify system prompt is updated
- **CRITICAL**: Verify `query_kb` tool is STILL present (not lost)

## Expected Behavior

### ✅ System Prompt Syncing
- Custom system prompt from dashboard → Syncs to Vapi
- No longer uses hardcoded template

### ✅ KB Query Tool Persistence
- KB tool created during sync → Stays attached
- Voice update → KB tool preserved
- System prompt update → KB tool preserved
- Any agent update → KB tool preserved

### ✅ Agent KB Usage
- During call, agent can query KB
- Agent includes KB context in responses
- No "tool not found" errors

## Troubleshooting

### KB Tool Not Showing in Vapi Dashboard
1. Check sync endpoint response - should have `toolId`
2. Check logs for "Attaching KB tool to agents"
3. Check logs for "Query tool already attached" (idempotency)
4. Verify agents have `vapi_assistant_id` in database

### System Prompt Not Updating
1. Check logs for "Assistant prompt synced to Vapi"
2. Verify agent has `vapi_assistant_id`
3. Check Vapi API key is valid
4. Check system prompt is not empty

### KB Tool Lost After Update
1. This should NOT happen with fixes applied
2. Check logs for "Preserving KB tools during assistant update"
3. Verify `tools` field is in update payload (not `toolIds`)
4. Check Vapi API response for errors

## Logs to Watch

```bash
# Tool preservation
grep "Preserving KB tools" logs.txt

# Tool attachment
grep "Query tool already attached\|Attaching KB tool" logs.txt

# System prompt sync
grep "Assistant prompt synced" logs.txt

# Vapi sync
grep "Vapi assistant synced" logs.txt

# Errors
grep "ERROR\|WARN" logs.txt | grep -i "tool\|prompt\|kb"
```

## Rollback (if needed)

```bash
git checkout backend/src/services/vapi-client.ts
git checkout backend/src/routes/knowledge-base.ts
git checkout backend/src/routes/founder-console-v2.ts
npm run dev
```

## Key Concepts

### Modern Vapi Tools Array
```typescript
// OLD (legacy, doesn't work well)
model: { toolIds: ['tool_123'] }

// NEW (modern, what we use now)
tools: [{ id: 'tool_123', type: 'query', ... }]
```

### Tool Merge Pattern
```typescript
// 1. Fetch existing
const existing = await getAssistant(id);

// 2. Extract query tools
const queryTools = existing.tools.filter(t => t.type === 'query');

// 3. Merge
const merged = [...queryTools, ...newTools];

// 4. Update
await updateAssistant(id, { tools: merged });
```

## Success Indicators

✅ KB document uploads and chunks are created
✅ KB sync creates query tool
✅ Query tool shows in Vapi dashboard
✅ System prompt updates sync to Vapi
✅ Query tool persists after system prompt update
✅ Query tool persists after voice update
✅ Agent uses KB in call responses
✅ No tool-related errors in logs

## Documentation

- **IMPLEMENTATION_SUMMARY.md** - Complete overview
- **KB_SYSTEM_PROMPT_FIXES.md** - Technical deep-dive
- **KB_SYNC_TEST.md** - Full test procedure with curl commands
- **QUICK_START_KB_FIX.md** - This file

## Support

For issues:
1. Check logs for errors
2. Verify agent has `vapi_assistant_id`
3. Verify KB documents exist and are chunked
4. Run full test procedure from KB_SYNC_TEST.md
5. Check Vapi dashboard for tool presence

## Summary

✅ 4 critical fixes implemented
✅ System prompt now syncs to Vapi
✅ KB query tool persists across updates
✅ AI assistant can query KB during calls
✅ Production ready, backward compatible
✅ No database changes needed
