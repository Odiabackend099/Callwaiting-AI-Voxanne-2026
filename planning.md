# � Implementation Plan: Vapi Configuration Verification & Fix

**Status**: ✅ IN PROGRESS  
**Date**: January 18, 2026  
**Owner**: AI Assistant  
**Duration**: ~30 minutes total

---

## 📋 Overview

The live booking test exposed 3 critical Vapi configuration issues:
1. **Server URLs pointing to localhost** (unreachable from Vapi cloud)
2. **patientPhone not in required parameters** (Sarah never asks for it)
3. **Incorrect endpoint path** in tool configuration

This plan verifies the fixes and validates end-to-end booking flow.

---

## 🎯 Implementation Phases

### Phase 1: Verify Assistant & Tool Configurations
**Objective**: Confirm Sarah and Test Assistant are correctly configured in Vapi.

**Tasks**:
- [ ] Query Vapi API for "CallWaiting AI Inbound" (Sarah) assistant
  - Verify `serverUrl` = `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/webhook`
  - Confirm tool ID `c8617e87-be85-45b9-ba53-1fed059cb5e9` is attached
- [ ] Query booking tool from Vapi API
  - Verify `server.url` = `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment`
  - Confirm `required` = `["patientName", "patientPhone", "appointmentDate", "appointmentTime"]`
  - Confirm properties include `patientPhone` with description mentioning REQUIRED
- [ ] Query Test Assistant
  - Verify inline booking tool has correct required parameters
  - Confirm server URL is ngrok, not localhost

**Acceptance Criteria**:
- [ ] Sarah assistant serverUrl = ngrok URL ✓
- [ ] Booking tool server URL = ngrok URL ✓
- [ ] patientPhone is in required array ✓
- [ ] Tool parameters match backend schema ✓

**Evidence**: API responses showing correct configuration

---

### Phase 2: Test Endpoint Connectivity
**Objective**: Verify ngrok tunnel and backend endpoint are working.

**Tasks**:
- [ ] Confirm ngrok tunnel is active
  - Check `curl http://localhost:4040/api/tunnels` returns active tunnel
  - Extract ngrok public URL
- [ ] Test backend bookClinicAppointment endpoint directly
  - Make POST request with correct payload format
  - Use correct org_id from database (46cf2995-2bee-44e3-838b-24151486fe4e)
  - Include patientName, patientPhone, appointmentDate, appointmentTime
  - Verify response contains `success: true` and `appointmentId`

**Acceptance Criteria**:
- [ ] ngrok tunnel is active and forwarding ✓
- [ ] Backend endpoint responds with 200 OK ✓
- [ ] Appointment record created with correct org_id ✓
- [ ] Response includes appointmentId and scheduledAt ✓

**Evidence**: Successful booking response with appointment ID

---

### Phase 3: Live Call Verification
**Objective**: Execute live Vapi call and verify complete booking flow.

**Tasks**:
- [ ] User performs live test call with Sarah assistant
  - Say: "I'd like to book an appointment"
  - Provide: name, email, date, time
  - **IMPORTANT**: Sarah MUST ask for phone number
  - Verify: Sarah confirms booking without errors
- [ ] Check database for appointment record
  - Query appointments for test contact
  - Verify all fields populated correctly
  - Check contact record created/updated
- [ ] Monitor backend logs
  - Confirm webhook received Vapi tool call
  - Verify no errors in booking logic
  - Check SMS compliance checks passed

**Acceptance Criteria**:
- [ ] Sarah asks for phone number during call ✓
- [ ] Booking completes without "technical difficulty" error ✓
- [ ] Appointment appears in database ✓
- [ ] Contact record contains phone number ✓
- [ ] Backend logs show successful booking ✓

**Evidence**: Appointment in database + backend logs + no errors in call

---

## 🔧 Technical Requirements

### API Endpoints Used
```
GET  https://api.vapi.ai/assistant/{id}           # Query assistant config
PATCH https://api.vapi.ai/assistant/{id}          # Update assistant (already done)
GET  https://api.vapi.ai/tool/{id}                # Query tool config
PATCH https://api.vapi.ai/tool/{id}               # Update tool (already done)

POST https://[NGROK_URL]/api/vapi/tools/bookClinicAppointment  # Test endpoint
GET  http://localhost:4040/api/tunnels            # Check ngrok tunnel
```

### Database Query
```sql
SELECT * FROM appointments 
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;

SELECT * FROM contacts
WHERE phone = '+1[test_phone]'
LIMIT 1;
```

### Payload Format (Vapi to Backend)
```json
{
  "toolCallId": "unique-id",
  "tool": {
    "arguments": {
      "patientName": "string",
      "patientPhone": "+1234567890",
      "patientEmail": "email@example.com",
      "appointmentDate": "YYYY-MM-DD",
      "appointmentTime": "HH:MM"
    }
  },
  "customer": {
    "metadata": {
      "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
    }
  }
}
```

### Configuration Status (Pre-Fix vs Post-Fix)

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| Sarah serverUrl | ❌ localhost | ✅ ngrok | Fixed |
| Tool server URL | ❌ /api/vapi-tools/ | ✅ /api/vapi/tools/ | Fixed |
| Required params | ❌ No phone | ✅ Has phone | Fixed |
| System prompt | ❌ No phone mention | ✅ Phone required | Fixed |

---

## 📊 Testing Criteria

### Unit/Integration Tests
- [x] Booking endpoint accepts correct payload ✓ (verified Jan 18)
- [x] Endpoint returns success with appointmentId ✓ (verified Jan 18)
- [x] Database record created with org_id isolation ✓ (verified Jan 18)

### E2E/Live Tests (Pending)
- [ ] Sarah assistant requests phone number
- [ ] Vapi can reach endpoint via ngrok (no timeout)
- [ ] Booking completes without error
- [ ] Appointment record visible in database
- [ ] Contact record includes phone number

### Validation Checklist
- [ ] No "technical difficulty" error in call transcript
- [ ] All required info collected: name, phone, email, date, time
- [ ] Backend logs show successful execution
- [ ] Appointment scheduledAt matches user's requested date/time
- [ ] SMS compliance checks passed (if SMS enabled)

---

## 🚀 Execution Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: API Verification | 5 min | Ready to execute |
| Phase 2: Endpoint Testing | 5 min | Ready to execute |
| Phase 3: Live Call | 10 min | Pending user action |
| **Total** | **20 min** | In Progress |

---

## 📝 Notes & Assumptions

**Assumptions**:
- ngrok tunnel remains active (doesn't expire mid-test)
- org_id `46cf2995-2bee-44e3-838b-24151486fe4e` is correct and active
- Vapi API token is valid (already authenticated in previous queries)
- Backend is running on port 3001 and responding

**Known Limitations**:
- Google Calendar sync will fail (not configured) - this is expected, not a blocker
- SMS won't actually send without Twilio config - this is expected
- Phone format validation is flexible (accepts various formats)

**Rollback Plan** (if needed):
- Old config backed up in Vapi dashboard version history
- Can revert tool/assistant to previous config if booking fails
- No database migrations or code changes, so safe to retry

---

## 🎯 Success Criteria (Overall)

**Project is successful when**:
1. ✅ Phase 1 verification complete - all configs correct
2. ✅ Phase 2 endpoint test successful - backend responds
3. ✅ Phase 3 live call succeeds - appointment booked without error

**User will see**:
- Sarah asks for phone number
- Booking completes with confirmation
- Appointment appears in database
- No errors in transcript or logs

---

**Next Step**: Execute Phase 1 (API Verification) to confirm configuration changes were applied successfully.
- Existing services: VapiClient, VapiAssistantManager, ToolSyncService
- Backend environment variable: `BACKEND_URL` for webhook URLs

### Assumptions
- Vapi API follows modern pattern: `POST /tool` → `PATCH /assistant/:id` with `toolIds`
- org_tools table migration is safe to deploy
- Existing agents have valid `vapi_assistant_id` in database
- Backend is already handling tool webhook requests correctly

---

## Implementation Phases

### Phase 1: Database Migration (30 min)
**Goal**: Deploy `org_tools` table to production database

#### Steps
1. Execute migration file: `/backend/migrations/20260117_create_org_tools_table.sql`
2. Verify table created with correct schema
3. Test Row Level Security (RLS) policies
4. Verify service role can insert/select

#### Files
- `/backend/migrations/20260117_create_org_tools_table.sql`

#### Acceptance Criteria
- [ ] Table `org_tools` exists in production
- [ ] Can insert test row successfully
- [ ] Can query rows with service role
- [ ] RLS policies prevent unauthorized access

---

### Phase 2: Complete ToolSyncService (2 hours)
**Goal**: Implement core tool registration engine

#### Steps
1. Complete `syncSingleTool()` method:
   - Check if tool already registered in `org_tools` table
   - If exists: return cached `vapi_tool_id`
   - If not: Call `POST /tool` on Vapi API
   - Save returned `tool_id` to `org_tools`

2. Complete `linkToolsToAssistant()` method:
   - Collect all tool IDs for the assistant
   - Call `vapi.updateAssistant(assistantId, { model: { toolIds: [...] }})`
   - Handle errors gracefully (log but don't crash)

3. Add retry logic with exponential backoff for Vapi API failures

4. Add comprehensive logging for debugging

#### Files
- `/backend/src/services/tool-sync-service.ts` (lines 50-150)

#### Acceptance Criteria
- [ ] `syncSingleTool()` registers tool with Vapi
- [ ] Tool ID saved to `org_tools` table
- [ ] `linkToolsToAssistant()` updates assistant with `toolIds`
- [ ] Idempotent: running twice doesn't create duplicates
- [ ] Errors logged but don't crash process

---

### Phase 3: Fix VapiAssistantManager (1 hour)
**Goal**: Remove embedded tool definitions, use modern API pattern

#### Steps
1. **Remove embedded tools from createAssistant** (lines 260-299):
   - Delete `model.tools` array
   - Set `model.toolIds: []` (empty initially)

2. **Remove embedded tools from updateAssistant** (lines 143-172):
   - Don't modify `toolIds` during updates
   - Let ToolSyncService handle tool registration

3. **Add post-creation hook**:
   - After creating/updating assistant, fire async tool sync
   - Use fire-and-forget pattern (don't block response)
   - Log errors but don't fail assistant creation

#### Files
- `/backend/src/services/vapi-assistant-manager.ts` (lines 143-172, 260-299)

#### Acceptance Criteria
- [ ] Assistants created WITHOUT embedded tools
- [ ] `model.toolIds` is empty array on creation
- [ ] Tool sync fires automatically after creation
- [ ] Assistant creation still succeeds even if tool sync fails

---

### Phase 4: Trigger Tool Sync on Agent Save (1 hour)
**Goal**: When user clicks "Save Agent", automatically register tools

#### Steps
1. Find where `VapiAssistantManager.ensureAssistant()` is called in founder console (around line 1500)

2. Add async tool sync after assistant creation:
   ```typescript
   const assistantResult = await VapiAssistantManager.ensureAssistant(...);

   // Fire-and-forget tool sync
   (async () => {
     try {
       await ToolSyncService.syncAllToolsForAssistant({
         orgId,
         assistantId: assistantResult.assistantId,
         skipIfExists: false  // Always sync to pick up changes
       });
     } catch (err) {
       logger.error('Tool sync failed (non-blocking)', { error: err.message });
     }
   })();
   ```

3. Add response field indicating sync status:
   ```typescript
   return res.json({
     success: true,
     assistantId: result.assistantId,
     toolSyncTriggered: true,
     message: 'Assistant saved and tools are being synced in background'
   });
   ```

#### Files
- `/backend/src/routes/founder-console-v2.ts` (around line 1500)

#### Acceptance Criteria
- [ ] "Save Agent" returns immediately (non-blocking)
- [ ] Tool sync starts in background within 1 second
- [ ] `org_tools` table populated within 5 seconds
- [ ] Vapi dashboard shows tool linked to assistant
- [ ] UI receives `toolSyncTriggered: true` in response

---

### Phase 5: Standardize Response Formats (2 hours)
**Goal**: All tool endpoints support both old and new Vapi formats

#### Steps
1. Create helper function to detect format:
   ```typescript
   function getVapiResponseFormat(req: Request) {
     const toolCallId = req.body.toolCallId;
     return toolCallId ? 'new' : 'legacy';
   }
   ```

2. Update all tool endpoints to support dual format:
   - Extract `toolCallId` from request
   - If present: return `{toolCallId, result}`
   - If absent: return `{toolResult: {content}, speech}`

3. Update these endpoints:
   - `/tools/calendar/check` (line 108)
   - `/tools/calendar/reserve` (line 190)
   - `/tools/booking/reserve-atomic` (line 371)
   - `/tools/booking/verify-otp` (line 487)
   - `/tools/booking/send-confirmation` (line 573)
   - `/tools/sms/send` (line 274)

#### Files
- `/backend/src/routes/vapi-tools-routes.ts` (multiple locations)

#### Acceptance Criteria
- [ ] All endpoints support new format (with `toolCallId`)
- [ ] All endpoints support legacy format (without `toolCallId`)
- [ ] Tests pass for both formats
- [ ] No breaking changes for existing integrations

---

### Phase 6: Migration Script for Existing Users (1 hour)
**Goal**: Register tools for all existing organizations without downtime

#### Steps
1. Create migration script: `/backend/scripts/migrate-existing-tools.ts`

2. Script logic:
   - Query all organizations
   - For each org, find agents with `vapi_assistant_id`
   - Call `ToolSyncService.syncAllToolsForAssistant()`
   - Log success/failure for each org

3. Add CLI flags:
   - `--dry-run`: Show what would happen without making changes
   - `--org-id`: Migrate specific organization only

4. Generate report:
   - Total organizations processed
   - Success count
   - Failure count
   - Details for each org

#### Files
- `/backend/scripts/migrate-existing-tools.ts` (new file)

#### Acceptance Criteria
- [ ] Dry-run mode shows correct organizations
- [ ] Real run registers tools for all orgs
- [ ] `org_tools` table populated for existing users
- [ ] Report shows 100% success rate (or identifies failures)
- [ ] Existing users can now use booking tools

---

### Phase 7: Tool Versioning & Updates (2 hours)
**Goal**: Detect and re-register tools when definitions change

#### Steps
1. Add `definition_hash` column to `org_tools`:
   ```sql
   ALTER TABLE org_tools ADD COLUMN definition_hash VARCHAR(64);
   ```

2. Implement hash calculation:
   ```typescript
   import crypto from 'crypto';

   function getToolDefinitionHash(toolDef: any): string {
     const content = JSON.stringify(toolDef);
     return crypto.createHash('sha256').update(content).digest('hex');
   }
   ```

3. Update `ToolSyncService.syncSingleTool()`:
   - Calculate current definition hash
   - Compare with saved hash in database
   - If different: re-register tool, update hash

4. Add migration script flag: `--force-update`
   - Re-register all tools even if hash matches
   - Useful for force-updating after breaking changes

#### Files
- `/backend/migrations/add_definition_hash.sql` (new file)
- `/backend/src/services/tool-sync-service.ts` (update syncSingleTool)
- `/backend/scripts/migrate-existing-tools.ts` (add --force-update flag)

#### Acceptance Criteria
- [ ] `definition_hash` column exists in `org_tools`
- [ ] Hash calculated correctly for tool definitions
- [ ] Tool re-registered when definition changes
- [ ] Old tool_id replaced with new tool_id
- [ ] Assistant updated with new tool_id

---

## Technical Requirements

### APIs
- **Vapi REST API**:
  - `POST /tool` - Register new tool
  - `PATCH /assistant/:id` - Update assistant with toolIds
  - `GET /assistant/:id` - Verify assistant exists

### Libraries
- `@supabase/supabase-js` - Database client
- `axios` - HTTP client for Vapi API
- `crypto` (Node.js built-in) - SHA-256 hashing

### Database Schema
```sql
-- org_tools table (already defined in migration)
CREATE TABLE org_tools (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  vapi_tool_id VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  definition_hash VARCHAR(64),  -- Added in Phase 7
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, tool_name)
);

-- Indexes
CREATE INDEX idx_org_tools_org_id ON org_tools(org_id);
CREATE INDEX idx_org_tools_enabled ON org_tools(enabled);
```

### Contracts (Vapi API)

**Request: POST /tool**
```json
{
  "type": "function",
  "function": {
    "name": "bookClinicAppointment",
    "description": "Books a clinic appointment",
    "parameters": {
      "type": "object",
      "properties": {
        "appointmentDate": {"type": "string"},
        "appointmentTime": {"type": "string"},
        "patientEmail": {"type": "string"},
        "patientPhone": {"type": "string"}
      },
      "required": ["appointmentDate", "appointmentTime", "patientEmail"]
    }
  },
  "server": {
    "url": "https://backend.example.com/api/vapi/tools/bookClinicAppointment"
  }
}
```

**Response: POST /tool**
```json
{
  "id": "tool_abc123xyz",
  "type": "function",
  "name": "bookClinicAppointment",
  ...
}
```

**Request: PATCH /assistant/:id**
```json
{
  "model": {
    "toolIds": ["tool_abc123xyz", "tool_def456uvw"]
  }
}
```

**Response from Tool Endpoint (Dual Format)**
```typescript
// New Format (Vapi 3.0)
if (req.body.toolCallId) {
  return res.json({
    toolCallId: "call_xyz123",
    result: {
      success: true,
      appointmentId: "appt_456"
    }
  });
}

// Legacy Format (Backward Compatibility)
return res.json({
  toolResult: {
    content: JSON.stringify({ success: true, appointmentId: "appt_456" })
  },
  speech: "Your appointment is confirmed for January 20 at 2 PM."
});
```

---

## Testing Criteria

### Unit Tests

**ToolSyncService.syncSingleTool()**
- [ ] Registers new tool successfully
- [ ] Returns cached tool_id for existing tool
- [ ] Handles Vapi API errors gracefully
- [ ] Saves tool_id to database
- [ ] Calculates correct definition hash

**ToolSyncService.linkToolsToAssistant()**
- [ ] Updates assistant with toolIds array
- [ ] Handles empty toolIds array
- [ ] Retries on network errors
- [ ] Logs errors without crashing

**Tool Definition Hash**
- [ ] Generates consistent hash for same definition
- [ ] Generates different hash when definition changes
- [ ] Hash is SHA-256 (64 characters hex)

### Integration Tests

**New Organization Flow**
1. Create test organization
2. Create test assistant
3. Verify tool sync fires automatically
4. Verify tool registered in Vapi
5. Verify tool_id saved in org_tools
6. Verify assistant linked to tool
7. Make test call with tool invocation
8. Verify tool endpoint receives request

**Existing Organization Migration**
1. Create test org with existing assistant
2. Run migration script with --dry-run
3. Verify correct org identified
4. Run migration script for real
5. Verify tool registered
6. Verify org_tools populated
7. Make test call to verify tool works

**Tool Definition Update**
1. Register tool with initial definition
2. Change tool definition (add parameter)
3. Calculate new hash
4. Trigger sync
5. Verify tool re-registered
6. Verify new tool_id saved
7. Verify assistant updated with new tool_id

### End-to-End Tests (Acceptance Criteria)

**User Journey: Create New Agent**
1. [ ] User logs into founder console
2. [ ] User navigates to Inbound Agent configuration
3. [ ] User configures system prompt, voice, language
4. [ ] User clicks "Save Agent"
5. [ ] Response returns immediately with `toolSyncTriggered: true`
6. [ ] Within 5 seconds, org_tools table has new row
7. [ ] Vapi dashboard shows tool linked to assistant
8. [ ] User makes test call
9. [ ] AI assistant successfully books appointment
10. [ ] Appointment appears in database and Google Calendar

**Existing User Migration**
1. [ ] Existing org has assistant with no tools registered
2. [ ] Run migration script: `npx ts-node scripts/migrate-existing-tools.ts --dry-run`
3. [ ] Verify org identified in dry-run output
4. [ ] Run migration: `npx ts-node scripts/migrate-existing-tools.ts`
5. [ ] Migration completes successfully (100% success rate)
6. [ ] org_tools table has rows for existing org
7. [ ] Make test call from existing org
8. [ ] Tool call reaches backend successfully
9. [ ] Appointment booked successfully

**Tool Definition Change**
1. [ ] Update `unified-booking-tool.ts` (add new parameter)
2. [ ] Run migration: `npx ts-node scripts/migrate-existing-tools.ts --force-update`
3. [ ] All orgs re-register tools with new definition
4. [ ] definition_hash updated in database
5. [ ] Test calls use new parameter successfully

---

## Execution Timeline

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 1 | Database Migration | 30 min | None |
| 2 | Complete ToolSyncService | 2 hours | Phase 1 |
| 3 | Fix VapiAssistantManager | 1 hour | Phase 2 |
| 4 | Trigger on Agent Save | 1 hour | Phase 3 |
| 5 | Standardize Response Formats | 2 hours | None (parallel) |
| 6 | Migration Script | 1 hour | Phase 2-4 |
| 7 | Tool Versioning | 2 hours | Phase 6 |

**Total Estimated Time: ~10 hours**

---

## Verification Steps (End-to-End)

### After Each Phase

**Phase 1 Verification:**
```bash
# Connect to Supabase
psql $DATABASE_URL

# Verify table exists
\d org_tools

# Test insert
INSERT INTO org_tools (org_id, tool_name, vapi_tool_id)
VALUES ('test-org-id', 'test-tool', 'test-vapi-id');

# Test select
SELECT * FROM org_tools WHERE org_id = 'test-org-id';
```

**Phase 2 Verification:**
```typescript
// In Node.js REPL
const { ToolSyncService } = require('./src/services/tool-sync-service');

await ToolSyncService.syncAllToolsForAssistant({
  orgId: 'test-org-id',
  assistantId: 'test-assistant-id',
  skipIfExists: false
});

// Check logs for success
// Check org_tools table for new row
// Check Vapi dashboard for tool
```

**Phase 3 Verification:**
```bash
# Create new assistant via founder console
# Check logs - should NOT see embedded tools
# Check logs - should see tool sync firing
# Wait 5 seconds
# Check org_tools table - should have row
# Check Vapi dashboard - tool should be linked
```

**Phase 4 Verification:**
```bash
# Open founder console UI
# Create/update agent
# Click "Save Agent"
# Check response JSON - should have toolSyncTriggered: true
# Wait 5 seconds
# Check org_tools table
# Check Vapi dashboard
```

**Phase 5 Verification:**
```bash
# Test with new format
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "call_test123",
    "tool": {
      "arguments": {
        "appointmentDate": "2026-01-20",
        "appointmentTime": "14:00",
        "patientEmail": "test@example.com",
        "patientPhone": "+15555555555"
      }
    }
  }'

# Response should have: { toolCallId: "call_test123", result: {...} }

# Test with legacy format (no toolCallId)
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCall": {
        "arguments": { ... }
      }
    }
  }'

# Response should have: { toolResult: {content: "..."}, speech: "..." }
```

**Phase 6 Verification:**
```bash
# Dry run
npx ts-node backend/scripts/migrate-existing-tools.ts --dry-run

# Real run
npx ts-node backend/scripts/migrate-existing-tools.ts

# Check report
# Verify org_tools table populated for all orgs
# Make test call from existing org
```

**Phase 7 Verification:**
```bash
# Update tool definition
# Calculate hash
# Run sync
# Verify new hash saved
# Verify tool re-registered
# Verify assistant updated
```

---

## Rollback Plan

### If Phase 1 Fails
- Drop table: `DROP TABLE IF EXISTS org_tools CASCADE;`
- No impact to production

### If Phase 2-4 Fail
- Revert code changes via git
- Existing users continue with current behavior
- New users may not have tools registered
- Run migration script later to fix

### If Phase 5 Fails
- Revert code changes
- Tool endpoints fall back to legacy format only
- Some Vapi 3.0 calls may fail
- Re-deploy after fix

### If Phase 6 Fails
- Migration script is safe to re-run (idempotent)
- Fix errors and re-run
- Partial success is OK (some orgs migrated)

### If Phase 7 Fails
- Tool versioning is optional
- Core functionality still works without it
- Can deploy later

---

## Open Questions

Before execution, please confirm:

1. **Should we deploy to staging first or go straight to production?**
   - Recommendation: Test in staging first

2. **Should existing users be migrated automatically or require manual trigger?**
   - Recommendation: Automatic migration script

3. **Do you want email notifications when tool sync fails?**
   - Recommendation: Yes, send to admin email

4. **Should we add a UI indicator showing tool sync status?**
   - Recommendation: Yes, show "Tools syncing..." spinner

---

## Critical Files to Modify

1. `/backend/migrations/20260117_create_org_tools_table.sql` - Database schema
2. `/backend/src/services/tool-sync-service.ts` - Core registration engine
3. `/backend/src/services/vapi-assistant-manager.ts` - Remove embedded tools
4. `/backend/src/routes/founder-console-v2.ts` - Trigger sync on save
5. `/backend/src/routes/vapi-tools-routes.ts` - Response format consistency
6. `/backend/scripts/migrate-existing-tools.ts` - Migration script (new file)

---

## Success Metrics

After full deployment:

- [ ] 100% of new users have tools registered automatically
- [ ] 100% of existing users migrated successfully
- [ ] Tool calls reach backend with <100ms latency
- [ ] Tool sync success rate > 99%
- [ ] Zero breaking changes for existing users
- [ ] All tests passing

---

**Status**: ✅ PLAN COMPLETE - Ready for Phase-by-Phase Execution

**Next Action**: Review plan → Execute Phase 1 (Database Migration)
