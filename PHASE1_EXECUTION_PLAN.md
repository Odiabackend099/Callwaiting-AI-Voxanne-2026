# 🎯 Appointment Booking - Phase 1 Execution Plan

**Status**: Ready for Implementation  
**Current Date**: January 13, 2026  
**Estimated Duration**: 2-3 hours  
**Target Completion**: January 13 EOD  

---

## 📋 PHASE 1 OVERVIEW

**Objective**: Wire Vapi tools to agents + inject system prompt with temporal context  
**Outcome**: AI can invoke booking tools and receive structured responses  
**Risk Level**: 🟢 LOW (no database changes in Phase 1)

---

## 📝 STEP 1: PLAN FIRST (This Document)

### What We're Building
1. **System Prompt Template** - Instructions for AI to use booking tools
2. **Tool Syncing Function** - Inject tools into Vapi agent config
3. **Webhook Handler** - Process tool calls from Vapi → return responses
4. **Manual Test** - Verify end-to-end flow

### Success Criteria (Go/No-Go)
- [ ] Agent config includes 3 booking tools (check_availability, reserve_slot, send_sms_reminder)
- [ ] System prompt includes booking instructions + temporal context variables
- [ ] Webhook handler successfully processes tool calls
- [ ] Manual test: AI mentions available slots after tool invocation

---

## 🗂️ STEP 2: FILE STRUCTURE

### Files to Create
```
backend/config/system-prompts.ts              [NEW] System prompt templates
backend/migrations/20260113_create_call_states_table.sql [NEW] State tracking table
```

### Files to Modify
```
backend/src/services/vapi-client.ts           [MODIFY] Add syncAgentTools() function
backend/src/routes/vapi-tools.ts              [MODIFY] Extend webhook handler
backend/assistants_list.json                  [MODIFY] Add system prompt
```

### Files to Reference (No Changes)
```
vapi-tool-definitions.json                    [READ] Tool definitions (webhook URLs, params)
.env                                          [READ] Environment variables
```

---

## 🔧 STEP 3: TECHNICAL REQUIREMENTS

### Environment Variables (Check .env)
```
VAPI_API_KEY=<should exist>
REDIS_URL=redis://localhost:6379 <or similar>
SUPABASE_URL=<should exist>
SUPABASE_SERVICE_ROLE_KEY=<should exist>
```

### Dependencies (Should already exist)
```
@supabase/supabase-js
redis
@vapi-ai/sdk
```

### Database (Already exists)
```
- organizations table
- agents table (for storing config)
- calls table (for tracking calls)
```

---

## 📚 STEP 4: DEPENDENCIES & CONSTRAINTS

### What This Phase Depends On
- ✅ Backend server running
- ✅ Vapi account + API key configured
- ✅ At least one agent created in Vapi

### What Blocks This Phase
- ❌ Database migration (Phase 2)
- ❌ Redis availability (but graceful fallback)
- ❌ Google Calendar sync (will add in Phase 3)

### What This Phase Blocks
- Phase 2 (state machine) - depends on Phase 1 working
- Phase 3 (optimization) - depends on Phase 1 working
- Phase 4 (E2E tests) - depends on all phases

---

## 🎯 STEP 5: ACCEPTANCE CRITERIA

### Must-Have (Blocking Go/No-Go)
1. ✅ System prompt loads without errors
2. ✅ Agent config includes booking tools array
3. ✅ Webhook handler processes tool calls from Vapi
4. ✅ Responses are structured JSON (not plain text)
5. ✅ Manual test: Call Vapi agent → "check availability" → agent responds with slots

### Nice-to-Have (Desirable but not blocking)
1. 🟡 Response times logged (<500ms for tool invocation)
2. 🟡 Temporal context variables injected correctly
3. 🟡 Error messages are user-friendly

### Not in Scope (Phase 2+)
1. ❌ Database state tracking (Phase 2)
2. ❌ Double-booking prevention (Phase 2)
3. ❌ Performance optimization (Phase 3)

---

## 🚀 STEP 6: EXECUTION CHECKLIST

### Pre-Implementation
- [ ] Review current `vapi-tools.ts` structure
- [ ] Review current agent config in `assistants_list.json`
- [ ] Check `vapi-tool-definitions.json` exists and is valid
- [ ] Verify Vapi agent has webhook URLs configured

### Implementation Order (Sequential)
1. Create `backend/config/system-prompts.ts` (5 mins)
2. Create system prompt template (10 mins)
3. Create `syncAgentTools()` function (15 mins)
4. Extend webhook handler in `vapi-tools.ts` (20 mins)
5. Update agent config to include system prompt (10 mins)
6. Manual testing (30 mins)

### Post-Implementation
- [ ] All tool responses logged to backend console
- [ ] No compilation errors
- [ ] Agent config updated in Vapi dashboard
- [ ] Webhook URLs responding correctly

---

## 📊 TIMELINE

| Task | Duration | Start | End | Status |
|------|----------|-------|-----|--------|
| **Plan Phase 1** | 30 min | 13:00 | 13:30 | ✅ |
| **Create system-prompts.ts** | 15 min | 13:30 | 13:45 | 🔴 |
| **Create syncAgentTools()** | 20 min | 13:45 | 14:05 | 🔴 |
| **Extend webhook handler** | 25 min | 14:05 | 14:30 | 🔴 |
| **Manual testing** | 30 min | 14:30 | 15:00 | 🔴 |
| **Buffer/Fixes** | 30 min | 15:00 | 15:30 | 🔴 |
| **Total Phase 1** | ~2.5 hours | 13:00 | 15:30 | 🔴 |

---

## 🔍 DETAILED STEPS

### Step 1: Create System Prompts Module
**File**: `backend/config/system-prompts.ts`

**Purpose**: Centralized management of system prompts with variable injection

**Creates**:
- `bookingSystemPrompt` - Base prompt for booking agent
- `interpolatePrompt()` - Function to inject context variables

**Time**: 15 minutes

---

### Step 2: Create syncAgentTools Function
**File**: `backend/src/services/vapi-client.ts`

**Purpose**: Sync tool definitions from JSON into Vapi agent config

**Creates**:
- `syncAgentTools(assistantId, tenantId)` function
- Reads `vapi-tool-definitions.json`
- Injects tenantId into webhook URLs
- Updates agent via Vapi API

**Time**: 20 minutes

---

### Step 3: Extend Webhook Handler
**File**: `backend/src/routes/vapi-tools.ts`

**Purpose**: Handle tool calls from Vapi, return structured responses

**Modifies**:
- Adds `/tools/booking-handler` POST endpoint
- Processes `toolCall.name` (check_availability, reserve_slot, send_sms_reminder)
- Returns structured JSON response with speech

**Time**: 25 minutes

---

### Step 4: Update Agent Configuration
**File**: `backend/assistants_list.json`

**Modifies**:
- Adds `model.messages[].content` with booking system prompt
- Adds `tools` array with 3 tools
- Saves updated config back to file

**Time**: 10 minutes

---

### Step 5: Manual Testing
**Method**: Call Vapi agent manually, trigger tool

**Scenarios**:
1. ✅ Agent picks up call
2. ✅ Agent asks for date
3. ✅ AI calls `check_availability` tool
4. ✅ Webhook returns available slots
5. ✅ Agent mentions slots in response
6. ✅ No errors in backend logs

**Time**: 30 minutes

---

## ⚠️ RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Vapi API key missing | 🔴 Blocking | Check `.env` file first |
| Tool definitions malformed | 🔴 Blocking | Validate JSON structure |
| Webhook URL incorrect | 🟠 High | Use ngrok URL + verify |
| System prompt too long | 🟡 Medium | Truncate to essentials only |
| Tool call format unexpected | 🟡 Medium | Log raw `req.body` to debug |

---

## 🧪 TESTING STRATEGY

### Unit Tests (Not required for Phase 1)
- ✖️ Skip - focus on E2E manual test

### Manual E2E Test
- **Tool**: Phone call to Vapi agent
- **Verification**: Backend logs show tool invocation
- **Success**: Agent responds with available slots

### Logging
```typescript
// In webhook handler:
console.log('Tool call received:', JSON.stringify(toolCall, null, 2));
console.log('Response sent:', JSON.stringify(response, null, 2));
```

---

## 📝 TODO LIST (For Tracking)

- [ ] **1.1** Review current code structure (5 min)
- [ ] **1.2** Create `backend/config/system-prompts.ts` (15 min)
- [ ] **1.3** Implement `syncAgentTools()` function (20 min)
- [ ] **1.4** Extend webhook handler in `vapi-tools.ts` (25 min)
- [ ] **1.5** Update `assistants_list.json` with tools + prompt (10 min)
- [ ] **1.6** Manual test - verify tool invocation (30 min)
- [ ] **1.7** Review logs for any errors or issues (10 min)
- [ ] **1.8** Document results and blockers (5 min)

---

## 🎯 SUCCESS DEFINITION

### Phase 1 is COMPLETE when:
1. ✅ System prompt template is created and used by agent
2. ✅ Tool definitions are synced to Vapi agent config
3. ✅ Webhook handler processes tool calls without errors
4. ✅ Manual test shows AI invoking tools and getting responses
5. ✅ No compile errors in TypeScript
6. ✅ Backend logs show successful tool processing

### Phase 1 is FAILED if:
1. ❌ System prompt not being used by agent
2. ❌ Tools not appearing in agent config
3. ❌ Webhook returns errors
4. ❌ Manual test shows no tool invocation
5. ❌ TypeScript compilation errors
6. ❌ Repeated tool call failures in logs

---

## 📞 NEXT ACTION

**Ready to begin Step 3 (Implementation)?**

I will start by:
1. Reading current `vapi-tools.ts` to understand structure
2. Reading `assistants_list.json` to see current config
3. Creating `backend/config/system-prompts.ts` with templates
4. Implementing the 4 core changes
5. Running manual tests

**Proceed? (Yes/No)**

---

**Created**: January 13, 2026  
**Phase**: 1 of 4  
**Status**: Ready for Implementation
