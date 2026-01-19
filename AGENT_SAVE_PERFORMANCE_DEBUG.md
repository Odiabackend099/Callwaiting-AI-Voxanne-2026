# Agent Save Debugging - Performance Instrumentation

## Status
✅ Backend restarted with detailed timing instrumentation
✅ Frontend running on port 3000
✅ Backend running on port 3001
✅ Ngrok tunnel active

## What was added
Added `console.time()` instrumentation to measure:

### Endpoint: POST /api/founder-console/agent/behavior
- **Total endpoint time** - From request received to response sent
- **Vapi sync phase** - Time to sync all agents to Vapi
  
### Function: ensureAssistantSynced()
For each agent synced, measures:
- `db-fetch` - Time to fetch agent from Supabase
- `vapi-get` - Time to GET existing assistant from Vapi (if update)
- `vapi-update` - Time to PATCH assistant on Vapi (if update) ← **KEY BOTTLENECK**
- `vapi-create` - Time to POST new assistant to Vapi (if create) ← **KEY BOTTLENECK**
- `db-save` - Time to save vapi_assistant_id to database
- `db-verify` - Time to verify save was successful

## How to Test

### Option A: Manual Test from Browser
1. Open http://localhost:3000 in browser
2. Navigate to Agent Configuration page (Founder Console)
3. Modify agent settings (system prompt, voice, language, etc.)
4. Click "Save Agent"
5. **Check backend terminal for timing logs** like:
   ```
   POST /agent/behavior - req-id-123
   ensureAssistantSynced-agent-456
     ensureAssistantSynced-agent-456-db-fetch: 45ms
     ensureAssistantSynced-agent-456-vapi-get: 234ms
     ensureAssistantSynced-agent-456-vapi-update: 8234ms ← TOO SLOW!
     ensureAssistantSynced-agent-456-db-save: 12ms
     ensureAssistantSynced-agent-456-db-verify: 38ms
   ensureAssistantSynced-agent-456: 8563ms (total)
   POST /agent/behavior - req-id-123: 8890ms (total endpoint time)
   ```

### Option B: Direct API Test
```bash
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Content-Type: application/json" \
  -H "X-Dev-Mode: true" \
  -d '{
    "inbound": {
      "system_prompt": "Test prompt",
      "voice": "alloy",
      "language": "en",
      "first_message": "Hello"
    },
    "orgId": "<your-test-org>"
  }'
```

## Expected Timeline
If backend is taking >30 seconds (frontend timeout):
- DB operations should be <100ms each (5-50ms typical)
- Vapi API calls might be 200-500ms each
- If seeing >5000ms on vapi-update/vapi-create → Vapi API is slow or hanging

## Next Steps
1. **Run test** from browser or API
2. **Capture timing logs** from backend console
3. **Identify which operation exceeds 30s**
4. **Apply fix**:
   - If Vapi API slow → Parallelize requests
   - If database slow → Check indexes/locks
   - If retries looping → Reduce retry backoff

## Debugging Symbols
Look for these in backend output when testing:
- `[ensureAssistantSynced] Starting sync for agent` - Function entry
- `[ensureAssistantSynced] Completed for agent ... in Xms` - Total duration
- `[/agent/behavior] Request started` - Endpoint entry
- `[/agent/behavior] Request completed successfully` - Success exit
- `[/agent/behavior] Request FAILED` - Error exit

## Temporary Fix (If Needed)
While investigating, increase frontend timeout from 30s to 60s:
- File: `src/lib/authed-backend-fetch.ts`
- Change: `const timeoutMs = options.timeoutMs ?? 30000;` → `60000`
- This buys time while finding root cause

## Performance Target
- Endpoint should complete in <5 seconds
- Each Vapi API call should be <1 second
- Database operations <100ms

If endpoint is taking >30s, we need to either:
1. Optimize Vapi API calls (parallel execution)
2. Implement async response (don't block on sync)
3. Switch to fire-and-forget pattern with webhooks
