# Quick Reference: Save Agent Button → Vapi Automation

## The User's Perspective
1. User opens Inbound Setup dashboard
2. Fills in: System Prompt, First Message, Voice, Language
3. Clicks: **"Save & Activate Inbound"** button
4. Sees: ✅ **"Agent saved and syncing tools..."**
5. In background: Tools automatically register and link (2-5 seconds)

## What The Backend Does (Automatic)

```
POST /api/founder-console/agent/behavior

Step 1: Extract orgId from JWT → user.orgId
Step 2: Fetch or create agent record (with org_id)
Step 3: Create assistant in Vapi (uses VAPI_PRIVATE_KEY from .env)
Step 4: Save vapi_assistant_id to database
Step 5: ✅ Return immediately (don't wait for tools)
Step 6: ASYNC: Register and link tools (fire-and-forget)
```

## Architecture Principle: No Hardcoding

❌ **WRONG:**
```typescript
const assistantId = "1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada"; // Hardcoded!
const vapiKey = "dc0ddc43-42ae-493b-a082-6e15cd7d739a"; // Hardcoded!
```

✅ **RIGHT:**
```typescript
const orgId = req.user.orgId;  // From JWT (unique per user's org)
const vapiKey = process.env.VAPI_PRIVATE_KEY;  // From backend .env (shared)
const assistantId = await vapi.createAssistant({...});  // Dynamic UUID
```

## Multi-Tenant Safety: The Golden Rule

**Every database query includes org_id:**

```typescript
// ❌ WRONG - No org filter
await supabase.from('agents').select('*');

// ✅ RIGHT - Always filter by org
await supabase.from('agents')
  .select('*')
  .eq('org_id', user.orgId);
```

## Tool Registration Strategy

### First Organization Saves Agent
```
1. Check global tool registry (org_tools table)
2. Tool not found? → Register with Vapi API
3. Save reference: org_id=ORG1, tool_name=bookClinicAppointment, tool_id=TOOL-UUID
4. Link tool to ORG1's assistant
```

### Second Organization Saves Agent
```
1. Check global tool registry (org_tools table)
2. Tool found (registered by ORG1)? → SKIP registration
3. Reuse same tool_id (TOOL-UUID)
4. Link same tool to ORG2's assistant
```

**Result:** 2 organizations, 2 assistants, 1 tool (shared, efficient)

## Environment Configuration

### Required (Backend/.env)
```bash
# ✅ Single master Vapi API key (used by all orgs)
VAPI_PRIVATE_KEY=dc0ddc43-42ae-493b-a082-6e15cd7d739a

# ✅ Referenced for assistant configuration
VAPI_PUBLIC_KEY=9829e1f5-e367-427c-934d-0de75f8801cf

# ✅ Webhook callback URL (where Vapi sends tool calls)
BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

### NOT Required
```bash
# ❌ Never: Per-org Vapi credentials
VAPI_ORG_123_KEY=...
VAPI_ORG_456_KEY=...

# ❌ Never: Hardcoded assistant IDs
INBOUND_ASSISTANT_ID=1f2c1e48-...
OUTBOUND_ASSISTANT_ID=...
```

## Code Locations

| Task | File | Line | Code |
|------|------|------|------|
| Save Agent | founder-console-v2.ts | 1749 | `POST /agent/behavior` |
| Create Assistant | founder-console-v2.ts | 1950 | `createAssistant()` |
| Async Tool Sync | founder-console-v2.ts | 788 | `ToolSyncService.syncAllToolsForAssistant()` |
| Register Tool | tool-sync-service.ts | 245 | `syncSingleTool()` |
| Link Tools | tool-sync-service.ts | 290 | `linkToolsToAssistant()` |

## Testing: What Happens When You Save

### Backend Logs (in order)
```
1. POST /agent/behavior received
2. Validating organization...
3. Creating Vapi assistant...
4. Assistant created: assistant-id-uuid
5. Saving assistant ID to database...
6. Starting async tool sync for founder console agent
   (⚠️ This runs AFTER response is sent)
7. Found 1 tools in blueprint
8. Registering tool with Vapi API
9. Tool registered with Vapi: tool-id-uuid
10. Saving tool reference to database...
11. Linking tools to assistant...
12. Tools linked to assistant
13. ✅ TOOL SYNC COMPLETE
```

### Frontend Response (Immediate)
```json
{
  "success": true,
  "agentId": "agent-uuid",
  "assistantId": "vapi-assistant-uuid",
  "message": "Agent saved and syncing tools..."
}
```

### User Experience
```
[Click Save]
    ↓
[Frontend shows checkmark: "Agent saved!"]
    ↓
[Behind the scenes (2-5s): Tools auto-register and link]
    ↓
[Agent ready to receive calls]
```

## Common Questions

**Q: Do I need to create assistants manually in Vapi dashboard?**  
A: No. Clicking "Save" in the UI automatically creates assistants. Vapi dashboard is read-only.

**Q: Do I need to register tools manually?**  
A: No. ToolSyncService does it automatically (first org only).

**Q: Do different organizations need different Vapi accounts?**  
A: No. One backend account (VAPI_PRIVATE_KEY) serves all organizations.

**Q: What if tool sync fails?**  
A: Agent is saved regardless. Error logged but doesn't block response. Tools can be manually linked in Vapi dashboard as fallback.

**Q: Can organization A see organization B's assistants?**  
A: No. RLS policies on database enforce org_id isolation. Vapi API calls don't leak data between orgs.

**Q: How many organizations can use the same tool?**  
A: Unlimited. Tools are registered once, linked to unlimited assistants.

## Monitoring

### Check Backend Logs for Tool Sync
```bash
tail -f /tmp/backend.log | grep -i "ToolSyncService"
```

### Expected Success Pattern
```
✅ Tool registered with Vapi
✅ Tool synced
✅ Tools linked to assistant
✅ TOOL SYNC COMPLETE
```

### If Tool Sync Fails
```
❌ Failed to sync tool
Check: VAPI_PRIVATE_KEY configured?
Check: Network connectivity to api.vapi.ai?
Check: Vapi API rate limits?
```

## Architecture Principle in One Sentence

**"Backend is the sole Vapi provider. All orgs share the master API key. Tools register once globally. Each org's assistant links independently. RLS enforces org isolation at the database."**

---

**Last Updated:** 2026-01-19  
**Type:** Quick Reference  
**Status:** Production Ready ✅
