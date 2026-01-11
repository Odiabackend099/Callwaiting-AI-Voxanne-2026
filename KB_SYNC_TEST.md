# Knowledge Base Sync & System Prompt Fix - Test Procedure

## Overview
This document describes how to test the critical fixes for KB query tool syncing and system prompt persistence in Vapi assistants.

## Critical Fixes Implemented

### Fix 1: VapiClient.getTool() Method
**File**: `backend/src/services/vapi-client.ts:273-275`
**Change**: Added `getTool(toolId: string)` method to fetch tool details from Vapi API
**Purpose**: Required to fetch newly created KB query tools before attaching to assistants

### Fix 2: attachToolToAssistant() - Modern Tools Array Merge
**File**: `backend/src/routes/knowledge-base.ts:149-167`
**Changes**:
- Fetch existing tools from assistant
- Filter for query-type tools (KB tools)
- Check if tool already attached (idempotency)
- Fetch the new tool using `getTool()`
- Merge tools array and update assistant with `tools` field (not legacy `toolIds`)

**Purpose**: Ensures KB query tools are properly attached using modern Vapi API structure

### Fix 3: ensureAssistantSynced() - Preserve KB Tools on Update
**File**: `backend/src/routes/founder-console-v2.ts:626-653`
**Changes**:
- Fetch existing assistant when updating
- Extract query-type tools (KB tools)
- Log tool preservation for debugging
- Include preserved tools in update payload

**Purpose**: Prevents KB query tools from being lost when system prompt or voice is updated

### Fix 4: syncAssistantPromptInBackground() - Preserve Tools on Prompt Sync
**File**: `backend/src/routes/founder-console-v2.ts:1085-1107`
**Changes**:
- Fetch existing assistant before updating system prompt
- Extract existing tools
- Include tools in update payload when syncing prompt

**Purpose**: Ensures KB query tools persist when system prompt is synced in background

## Test Procedure

### Step 1: Upload Knowledge Base Document
```bash
curl -X POST http://localhost:3000/api/knowledge-base \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-kb.txt",
    "content": "Our company provides AI voice solutions. We specialize in outbound calling, inbound IVR, and knowledge base integration.",
    "category": "general",
    "active": true
  }'
```

**Expected Response**:
```json
{
  "item": {
    "id": "kb_doc_id",
    "org_id": "org_id",
    "filename": "test-kb.txt",
    "content": "...",
    "is_chunked": true,
    "chunk_count": 1,
    "embedding_status": "completed"
  }
}
```

**Verify**: 
- Document created in `knowledge_base` table
- Chunks created in `knowledge_base_chunks` table
- Embeddings generated

### Step 2: Sync Knowledge Base to Agents
```bash
curl -X POST http://localhost:3000/api/knowledge-base/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "knowledge-search",
    "assistantRoles": ["inbound", "outbound"]
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "toolId": "tool_abc123",
  "assistantsUpdated": [
    {
      "role": "inbound",
      "assistantId": "assistant_id_1"
    },
    {
      "role": "outbound",
      "assistantId": "assistant_id_2"
    }
  ]
}
```

**Verify in Logs**:
- "Query tool already attached" or successful attachment
- "Attaching KB tool to agents" with agent count
- No errors during tool attachment

**Verify in Vapi Dashboard**:
1. Go to Vapi dashboard
2. Select the inbound assistant
3. Check "Tools" section
4. Verify `query_kb` tool is present with:
   - Type: `query`
   - Knowledge bases configured
   - File IDs populated

### Step 3: Update System Prompt
```bash
curl -X POST http://localhost:3000/api/founder-console/agent/behavior \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "You are a helpful customer service representative. Use the knowledge base to answer questions about our services."
    },
    "outbound": {
      "systemPrompt": "You are a sales representative calling to discuss our AI solutions. Reference the knowledge base when relevant."
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "syncedAgentIds": ["assistant_id_1", "assistant_id_2"],
  "message": "Agent configuration saved and synced to Vapi. 2 assistant(s) updated.",
  "voiceSynced": true,
  "knowledgeBaseSynced": true
}
```

**Verify in Logs**:
- "Preserving KB tools during assistant update"
- "Synced agents to Vapi" with agent count
- No tool-related errors

**Verify in Vapi Dashboard**:
1. Go to inbound assistant
2. Check "System Prompt" section
3. Verify custom prompt is present
4. Check "Tools" section
5. Verify `query_kb` tool is STILL present (not lost)

### Step 4: Make Test Call and Verify KB Usage
```bash
curl -X POST http://localhost:3000/api/founder-console/agent/test-call \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testDestinationNumber": "+1234567890"
  }'
```

**During Call**:
1. Ask the agent: "What services do you provide?"
2. Listen for KB context in response
3. Agent should reference knowledge base content

**Verify in Call Logs**:
- Call initiated successfully
- Agent responds with KB information
- No tool errors in logs

### Step 5: Verify KB Tool Persistence Across Multiple Syncs
```bash
# Update voice
curl -X POST http://localhost:3000/api/founder-console/agent/behavior \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "voiceId": "Hana"
    }
  }'

# Then check Vapi dashboard again
```

**Verify**:
- Voice updated to "Hana"
- `query_kb` tool STILL present in Tools section
- No tools lost during voice update

## Expected Behavior After Fixes

### Before Fixes
- ❌ System prompt not syncing to Vapi (using template instead)
- ❌ KB query tool lost when updating system prompt
- ❌ KB query tool lost when updating voice
- ❌ Agent doesn't use KB in responses

### After Fixes
- ✅ Custom system prompt syncs to Vapi
- ✅ KB query tool persists across all updates
- ✅ Agent can query KB during calls
- ✅ Agent uses KB context in responses

## Debugging Commands

### Check Agent Configuration
```bash
curl -X GET http://localhost:3000/api/founder-console/agent \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check KB Documents
```bash
curl -X GET http://localhost:3000/api/knowledge-base \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check KB Chunks
```bash
curl -X GET http://localhost:3000/api/knowledge-base/{doc_id}/chunks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Search KB
```bash
curl -X POST http://localhost:3000/api/knowledge-base/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What services do you provide?",
    "limit": 5
  }'
```

## Success Criteria

✅ All tests pass when:
1. KB document uploads and chunks are created
2. KB sync attaches query tool to both agents
3. System prompt updates preserve KB query tool
4. Voice updates preserve KB query tool
5. Test call agent responds with KB information
6. Vapi dashboard shows query_kb tool in Tools section
7. No errors in backend logs related to tool attachment

## Rollback Plan

If issues occur:
1. Revert the 4 files modified:
   - `backend/src/services/vapi-client.ts`
   - `backend/src/routes/knowledge-base.ts`
   - `backend/src/routes/founder-console-v2.ts` (2 locations)
2. Restart backend server
3. Test again with original code

## Notes

- All fixes are backward compatible
- No database schema changes required
- No breaking changes to API contracts
- Tools array merge is idempotent (safe to retry)
- KB query tools are identified by `type: 'query'`
