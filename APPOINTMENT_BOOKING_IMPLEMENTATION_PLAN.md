# 📋 APPOINTMENT BOOKING IMPLEMENTATION PLAN

**Status**: Ready for Phase 1 Execution  
**Start Date**: January 12, 2026  
**Target Go-Live**: January 15, 2026  
**Architecture**: Vapi + PostgreSQL Optimistic Locking + Redis Cache

---

## 🎯 IMPLEMENTATION PHASES

### **PHASE 1: Vapi Tool Wiring & System Prompt (EST: 2-3 hours)**
**Goal**: Wire existing tools to agents and inject system prompt instructions  
**Outcome**: AI can invoke tools and receive responses

#### Phase 1.1: Update Vapi System Prompt Template
- **File**: `backend/assistants_list.json` / new `backend/config/system-prompts.ts`
- **What**: Add explicit tool invocation instructions + temporal context
- **Changes**:
  ```typescript
  const bookingSystemPrompt = `
  You are Voxanne, a professional AI assistant for wellness clinics.
  
  ## APPOINTMENT BOOKING INSTRUCTIONS (MANDATORY)
  You MUST use these tools in order:
  1. FIRST: check_availability(tenantId="{{tenantId}}", date="YYYY-MM-DD")
     - Returns 3-5 available time slots
     - Always ask patient for preferred date first
  2. PATIENT SELECTS SLOT → reserve_slot(tenantId="{{tenantId}}", slotId="slot_123")
     - Slot is held for 5 minutes
  3. CONFIRMATION → send_sms_reminder(phone="{{patientPhone}}", appointmentDetails)
     - SMS confirms appointment details
  
  Available tool parameters: tenantId, date, slotId, phone, appointmentDetails
  
  ## TEMPORAL CONTEXT (CRITICAL FOR ACCURACY)
  Current date: {{currentDate}}
  Current time: {{currentTime}}
  Tenant timezone: {{tenantTimezone}}
  Business hours: {{businessHours}}
  
  If current time is after business hours: "I can book you for {{nextBusinessDay}}."
  Always confirm appointment date with patient: "That's {{confirmDate}}, correct?"
  
  ## RESPONSE FORMAT
  After each tool call, speak naturally to the patient about the result.
  Always use ISO format (YYYY-MM-DD) when calling tools.
  `;
  ```

#### Phase 1.2: Sync Tools to Agent Config
- **File**: `backend/src/services/vapi-client.ts` → new function `syncAgentTools()`
- **What**: Read `vapi-tool-definitions.json` and inject into agent's `tools` array
- **Changes**:
  ```typescript
  async function syncAgentTools(assistantId: string, tenantId: string) {
    // 1. Read tools from JSON
    const toolDefinitions = await readVapiToolDefinitions();
    
    // 2. Inject tenantId into webhook URLs
    const toolsWithContext = toolDefinitions.map(tool => ({
      ...tool,
      server: {
        ...tool.server,
        url: `${tool.server.url}?tenantId=${tenantId}`
      }
    }));
    
    // 3. Update agent
    const response = await vapi.updateAssistant(assistantId, {
      model: { messages: [systemPrompt] },
      tools: toolsWithContext
    });
    
    return response;
  }
  ```

#### Phase 1.3: Implement Vapi Webhook Handler
- **File**: `backend/src/routes/vapi-tools.ts` (existing file, extend)
- **What**: Handle tool calls from Vapi, return structured responses
- **Changes**:
  ```typescript
  router.post('/tools/booking-handler', async (req, res) => {
    const { toolCall, callContext } = req.body;
    const { tenantId } = callContext;
    
    try {
      let result;
      
      if (toolCall.name === 'check_availability') {
        result = await checkAvailability(tenantId, toolCall.arguments.date);
      } else if (toolCall.name === 'reserve_slot') {
        result = await reserveSlotOptimistic(callContext.callSid, toolCall.arguments.slotId, tenantId);
      } else if (toolCall.name === 'send_sms_reminder') {
        result = await sendSmsConfirmation(tenantId, toolCall.arguments);
      }
      
      // Return structured response for GPT-4o
      res.json({
        toolResult: {
          content: JSON.stringify(result),
          summary: `Booking step completed: ${toolCall.name}`
        },
        speech: generateNaturalResponse(toolCall.name, result)
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  ```

#### Phase 1.4: Test Tool Invocation
- **Test**: Simulate Vapi call → trigger tool → verify response parsing
- **Method**: Manual call to agent with booking request
- **Success Criteria**:
  - ✅ Agent receives "check_availability" tool call
  - ✅ Webhook returns structured response
  - ✅ Agent mentions available slots in next turn
  - ✅ No tool invocation errors in logs

---

### **PHASE 2: Booking State Machine & Double-Booking Prevention (EST: 4-6 hours)**
**Goal**: Track booking progression + prevent concurrent slot conflicts  
**Outcome**: Safe multi-concurrent booking with state audit trail

#### Phase 2.1: Create `call_states` Table
- **File**: `backend/migrations/20260112_create_call_states_table.sql`
- **What**: Supabase table for call-level state tracking
- **Schema**:
  ```sql
  CREATE TABLE call_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_sid TEXT UNIQUE NOT NULL, -- Vapi call ID
    org_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id UUID NOT NULL,
    step TEXT NOT NULL CHECK (step IN ('greeting', 'check_avail', 'reserve', 'confirm_sms', 'booked', 'failed')),
    slot_id TEXT,
    patient_data JSONB, -- { phone, name, email }
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX idx_call_states_org_id ON call_states(org_id);
  CREATE INDEX idx_call_states_call_sid ON call_states(call_sid);
  CREATE INDEX idx_call_states_expires_at ON call_states(expires_at);
  
  -- RLS: org_id scoped
  ALTER TABLE call_states ENABLE ROW LEVEL SECURITY;
  CREATE POLICY call_states_org_isolation ON call_states
    USING (org_id = auth.uid()::uuid);
  ```

#### Phase 2.2: Create Atomic Slot Reservation RPC
- **File**: `backend/migrations/20260112_create_claim_slot_atomic.sql`
- **What**: PostgreSQL function for optimistic locking
- **Function**:
  ```sql
  CREATE FUNCTION claim_slot_atomic(
    p_tenant_id UUID,
    p_slot_id TEXT,
    p_call_sid TEXT,
    p_version UUID
  ) RETURNS JSONB AS $$
  DECLARE
    v_result JSONB;
  BEGIN
    UPDATE available_slots 
    SET status = 'reserved', 
        version = gen_random_uuid(), 
        reserved_by = p_call_sid,
        reserved_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND slot_id = p_slot_id 
      AND status = 'available' 
      AND version = p_version
    RETURNING jsonb_build_object('success', true, 'slot_id', slot_id) INTO v_result;
    
    IF v_result IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot already reserved');
    END IF;
    
    RETURN v_result;
  END;
  $$ LANGUAGE plpgsql;
  ```

#### Phase 2.3: Implement Redis + Optimistic Lock
- **File**: `backend/src/services/booking-service.ts`
- **What**: Redis for fast locking, PostgreSQL for durable state
- **Implementation**:
  ```typescript
  export async function reserveSlotOptimistic(
    callSid: string,
    slotId: string,
    tenantId: string,
    version: string
  ): Promise<{ success: boolean; error?: string }> {
    // Step 1: Redis fast lock (100ms)
    const redisKey = `slot:${tenantId}:${slotId}`;
    const acquired = await redis.set(redisKey, callSid, 'NX', 'EX', 300);
    
    if (!acquired) {
      return { success: false, error: 'Slot taken by another call' };
    }
    
    try {
      // Step 2: PostgreSQL atomic claim (50ms)
      const { data, error } = await supabase.rpc('claim_slot_atomic', {
        p_tenant_id: tenantId,
        p_slot_id: slotId,
        p_call_sid: callSid,
        p_version: version
      });
      
      if (error || !data?.success) {
        await redis.del(redisKey); // Release lock
        return { success: false, error: 'Slot version mismatch (claimed by another call)' };
      }
      
      // Step 3: Update call state
      await supabase.from('call_states')
        .update({ step: 'reserve', slot_id: slotId, expires_at: new Date(Date.now() + 5 * 60000) })
        .eq('call_sid', callSid);
      
      return { success: true };
    } catch (err) {
      await redis.del(redisKey);
      throw err;
    }
  }
  ```

#### Phase 2.4: Create `available_slots` Table
- **File**: `backend/migrations/20260112_create_available_slots_table.sql`
- **What**: Pre-computed slots with version tracking for optimistic locking
- **Schema**:
  ```sql
  CREATE TABLE available_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    slot_id TEXT NOT NULL, -- "2026-01-15T14:00:00Z"
    status TEXT CHECK (status IN ('available', 'reserved', 'booked', 'blocked')),
    version UUID NOT NULL DEFAULT gen_random_uuid(), -- For optimistic locking
    reserved_by TEXT, -- call_sid
    reserved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slot_id)
  );
  
  CREATE INDEX idx_available_slots_tenant_status ON available_slots(tenant_id, status);
  ```

#### Phase 2.5: Test State Tracking
- **Test**: Simulate 2 concurrent calls picking same slot
- **Method**: Run both calls, verify only 1 succeeds
- **Success Criteria**:
  - ✅ Redis lock acquired on first call
  - ✅ Second call gets "Slot taken" error
  - ✅ `call_states` table shows state transitions
  - ✅ No double-bookings in appointments table

---

### **PHASE 3: Temporal Awareness & Latency Optimization (EST: 3-4 hours)**
**Goal**: Inject dynamic time context + optimize to <2s response  
**Outcome**: AI knows what "today" means, tools respond in <200ms

#### Phase 3.1: Dynamic Prompt Context Injection
- **File**: `backend/src/services/vapi-context-service.ts`
- **What**: Generate context vars for each call
- **Implementation**:
  ```typescript
  export async function generateVapiContext(tenantId: string): Promise<Record<string, string>> {
    const org = await supabase.from('organizations').select('*').eq('id', tenantId).single();
    const now = new Date();
    const tz = org.data.timezone || 'America/New_York';
    
    return {
      currentDate: new Intl.DateTimeFormat('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', timeZone: tz 
      }).format(now),
      currentTime: new Intl.DateTimeFormat('en-US', { 
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz 
      }).format(now),
      tenantTimezone: tz,
      businessHours: org.data.business_hours || '9 AM - 6 PM',
      tenantId: tenantId
    };
  }
  
  // In Vapi webhook:
  const context = await generateVapiContext(tenantId);
  const promptWithContext = interpolateSystemPrompt(basePrompt, context);
  ```

#### Phase 3.2: Implement Redis Slot Cache
- **File**: `backend/src/services/calendar-cache-service.ts`
- **What**: Cache Google Calendar slots in Redis (hourly sync)
- **Implementation**:
  ```typescript
  // Hourly cron job
  export async function syncSlotsToRedis(tenantId: string) {
    const slots = await getCalendarSlots(tenantId);
    await redis.json.set(`slots:${tenantId}`, '$', slots, 'EX', 3600);
  }
  
  // Tool: Redis first, fallback to Calendar
  export async function checkAvailabilityFast(tenantId: string, date: string): Promise<string[]> {
    const cached = await redis.json.get(`slots:${tenantId}`, { path: `$.${date}` });
    if (cached) return cached; // 50ms response
    
    const fresh = await getCalendarSlots(tenantId, date); // ~1s from Google
    await redis.json.set(`slots:${tenantId}`, `$.${date}`, fresh, 'EX', 3600);
    return fresh;
  }
  ```

#### Phase 3.3: Optimize Database Queries
- **File**: `backend/src/services/booking-service.ts`
- **What**: Parallel queries + connection pooling
- **Changes**:
  - Add composite indexes: `(tenant_id, status, date)`
  - Use `Promise.all()` for parallel calls
  - Pre-fetch org settings on call start

#### Phase 3.4: Performance Testing
- **Test**: Measure latency of each tool call
- **Targets**:
  - `check_availability`: <200ms (Redis) or <2s (Calendar fallback)
  - `reserve_slot`: <100ms
  - `send_sms_reminder`: <300ms
- **Success Criteria**:
  - ✅ 95th percentile <2s per tool call
  - ✅ <1.5s total time for full booking flow

---

### **PHASE 4: End-to-End Integration Test (EST: 2-3 hours)**
**Goal**: Validate entire booking flow in realistic scenario  
**Outcome**: Production-ready, tested booking system

#### Phase 4.1: Write E2E Test Script
- **File**: `backend/tests/e2e/booking-flow.test.ts`
- **What**: Simulate real Vapi call → booking → SMS
- **Test Scenarios**:
  1. Happy path: Check availability → Pick slot → SMS confirm
  2. Double-book: 2 calls pick same slot (verify 1 fails)
  3. Timeout: Call ends mid-booking (verify state preserved)
  4. Offline calendar: Redis hits, Google down (verify cache works)

#### Phase 4.2: Load Testing
- **Tool**: Artillery or K6
- **Scenario**: 10 concurrent calls, same clinic, same day
- **Verify**: No double-bookings, <2s latency under load

#### Phase 4.3: Audit Trail
- **Verify**: `call_states` table has complete progression
- **Success**: Every booking has state history from greeting → booked

---

## 📅 TIMELINE

| Phase | Tasks | Duration | End Date | Status |
|-------|-------|----------|----------|--------|
| **1** | Tool wiring + prompt | 2-3h | Jan 12 EOD | 🟡 Ready |
| **2** | State machine + locks | 4-6h | Jan 13 EOD | 🔴 Blocked on Phase 1 |
| **3** | Temporal + latency | 3-4h | Jan 14 EOD | 🔴 Blocked on Phase 1 |
| **4** | E2E + load test | 2-3h | Jan 15 EOD | 🔴 Blocked on Phase 1 |
| **LAUNCH** | Production ready | — | Jan 15 EOD | 🔴 |

---

## 🔧 TECHNICAL REQUIREMENTS

### Dependencies
- Redis (already available?)
- Supabase RPC support (enabled)
- Vapi API client (existing)
- Google Calendar API (configured)
- Twilio SMS (configured)

### Environment Variables Needed
```
REDIS_URL=redis://localhost:6379
VAPI_ASSISTANT_ID_BOOKING=<from Vapi dashboard>
GOOGLE_CALENDAR_SYNC_CRON=0 * * * * (hourly)
```

### Database Constraints
- All org-scoped via RLS
- Atomic operations via PostgreSQL RPC
- 5-minute slot hold (no indefinite reserves)

---

## ✅ SUCCESS CRITERIA (Go/No-Go)

**Phase 1 Complete**:
- [ ] Agent config has tools array with 3 appointment tools
- [ ] System prompt includes booking instructions + temporal context
- [ ] Webhook handler returns structured responses
- [ ] Manual test: AI mentions available slots after check_availability

**Phase 2 Complete**:
- [ ] `call_states` & `available_slots` tables created + seeded
- [ ] `claim_slot_atomic` RPC works without race conditions
- [ ] Redis + PostgreSQL locking tested under concurrency
- [ ] 2 concurrent calls → only 1 succeeds in claiming slot

**Phase 3 Complete**:
- [ ] Context vars injected into prompts (date, time, timezone)
- [ ] Redis cache reduces Calendar latency from 1.8s → 50ms
- [ ] Tool responses <2s p95 latency
- [ ] Hourly sync cron is running

**Phase 4 Complete**:
- [ ] E2E test passes: booking flows from start to SMS
- [ ] Load test: 10 concurrent calls, 0 double-bookings
- [ ] Audit trail: `call_states` shows complete progression
- [ ] **GO-LIVE: Production release Jan 15**

---

## 🚨 KNOWN RISKS

| Risk | Mitigation |
|------|------------|
| Redis goes down | Fallback to Calendar API (slower, but works) |
| Double-booking still happens | Version mismatch in optimistic lock catches it |
| Vapi timeout (30s) | <2s tool response time leaves buffer |
| Patient hangs up | `call_states` preserves state for retry |
| SMS delivery fails | Retry logic in Twilio service |

---

## 📞 NEXT STEP

**Ready to proceed with Phase 1?** (2-3 hours, unblocks everything else)

Confirm and I will:
1. ✅ Update `backend/assistants_list.json` with booking system prompt
2. ✅ Create `syncAgentTools()` function in vapi-client.ts
3. ✅ Extend `vapi-tools.ts` webhook handler
4. ✅ Run manual test to verify tool invocation

---

**Created**: Jan 12, 2026 | **Last Updated**: Jan 12, 2026
