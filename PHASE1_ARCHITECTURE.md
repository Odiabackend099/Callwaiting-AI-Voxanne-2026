# 🏗️ PHASE 1: ARCHITECTURE & SYSTEM DESIGN

**Purpose**: Explain how the appointment booking system works end-to-end

---

## 📊 SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PATIENT / CALLER                              │
│                  (Calls Agent on Vapi Phone)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ "I want to book an appointment"
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VAPI VOICE AGENT                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ System Prompt (from system-prompts.ts)                       │   │
│  │ ─────────────────────────────────────────────────────────── │   │
│  │ "You MUST use tools in this order:                          │   │
│  │  1. check_availability(tenantId, date)                      │   │
│  │  2. reserve_slot(tenantId, slotId, phone)                   │   │
│  │  3. send_sms_reminder(tenantId, phoneNumber)"              │   │
│  │                                                              │   │
│  │ Current Date: Jan 12, 2026 (injected dynamically)           │   │
│  │ Timezone: America/New_York                                  │   │
│  │ Business Hours: 9 AM - 6 PM                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                         │
│  "Let me check availability..."                                      │
│  [Agent prepares tool call]                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
          Tool Call #1: check_availability
          {"tenantId": "...", "date": "2026-01-13", "serviceType": "consultation"}
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              WEBHOOK HANDLER (vapi-tools-routes.ts)                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ POST /api/vapi/tools/calendar/check                          │   │
│  │                                                              │   │
│  │ 1. Extract: tenantId, date from request                     │   │
│  │ 2. Query: Calendar service for available slots              │   │
│  │ 3. Return: Structured response for GPT-4o                   │   │
│  │                                                              │   │
│  │ Response Format (CRITICAL):                                 │   │
│  │ {                                                            │   │
│  │   "toolResult": {                                            │   │
│  │     "content": JSON.stringify({                             │   │
│  │       success: true,                                        │   │
│  │       availableSlots: ["2pm", "3pm", "4pm"],               │   │
│  │       slotCount: 3                                          │   │
│  │     })                                                       │   │
│  │   },                                                         │   │
│  │   "speech": "I found 3 available times on Jan 13..."        │   │
│  │ }                                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
    GPT-4o receives toolResult.content in next context turn
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VAPI VOICE AGENT (continued)                    │
│                                                                      │
│  Agent reads: availableSlots = ["2pm", "3pm", "4pm"]               │
│  Agent speaks: "I have availability at 2pm, 3pm, and 4pm.          │
│               Which time works best for you?"                       │
│                                                                      │
│  Patient: "3pm please"                                              │
│  Agent: "Perfect! Let me hold that for you..."                      │
│  [Agent prepares Tool Call #2]                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
          Tool Call #2: reserve_slot
          {"tenantId": "...", "slotId": "3pm", "patientPhone": "+1..."}
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              WEBHOOK HANDLER (continued)                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ POST /api/vapi/tools/calendar/reserve                        │   │
│  │                                                              │   │
│  │ 1. Lock slot in database (5-minute hold)                    │   │
│  │ 2. Create temporary hold entry                              │   │
│  │ 3. Return: Success or "slot taken"                          │   │
│  │                                                              │   │
│  │ Response:                                                    │   │
│  │ {                                                            │   │
│  │   "toolResult": {                                            │   │
│  │     "content": JSON.stringify({                             │   │
│  │       success: true,                                        │   │
│  │       slotId: "3pm",                                        │   │
│  │       holdExpiresIn: "5 minutes"                            │   │
│  │     })                                                       │   │
│  │   },                                                         │   │
│  │   "speech": "Perfect! I've held that appointment for you."  │   │
│  │ }                                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
    GPT-4o reads: success = true
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VAPI VOICE AGENT (continued)                    │
│                                                                      │
│  Agent speaks: "I've held that appointment. Let me send you         │
│               a confirmation text with all the details."            │
│                                                                      │
│  [Agent prepares Tool Call #3]                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
       Tool Call #3: send_sms_reminder
       {"tenantId": "...", "phoneNumber": "+1...", "messageType": "confirmation"}
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              WEBHOOK HANDLER (final)                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ POST /api/vapi/tools/sms/send                                │   │
│  │                                                              │   │
│  │ 1. Build compliant SMS message (with STOP language)         │   │
│  │ 2. Send via Twilio (BYOC-integrated)                        │   │
│  │ 3. Return: Delivery confirmation                            │   │
│  │                                                              │   │
│  │ Response:                                                    │   │
│  │ {                                                            │   │
│  │   "toolResult": {                                            │   │
│  │     "content": JSON.stringify({                             │   │
│  │       success: true,                                        │   │
│  │       phoneNumber: "+1...",                                 │   │
│  │       deliveryStatus: "sent"                                │   │
│  │     })                                                       │   │
│  │   },                                                         │   │
│  │   "speech": "Perfect! Check your phone for the confirmation"│   │
│  │ }                                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
    GPT-4o reads: success = true, phoneNumber confirmed
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      VAPI VOICE AGENT (final)                        │
│                                                                      │
│  Agent speaks: "All set! Your appointment is confirmed for          │
│               January 13th at 3pm. See you then!"                   │
│                                                                      │
│  Patient: "Great, thanks!"                                          │
│  [Call ends]                                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE UPDATES (Supabase)                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ appointments table:                                          │   │
│  │ ┌────────────────────────────────────────────────────────┐   │   │
│  │ │ id: uuid                                               │   │   │
│  │ │ org_id: "f3dc48bd-b83e-461a..."                        │   │   │
│  │ │ scheduled_at: 2026-01-13 15:00:00 (3pm)               │   │   │
│  │ │ status: "confirmed"                                    │   │   │
│  │ │ confirmation_sent: true                                │   │   │
│  │ │ created_at: 2026-01-12 ...                             │   │   │
│  │ └────────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │ call_states table (if Phase 2 complete):                   │   │
│  │ ┌────────────────────────────────────────────────────────┐   │   │
│  │ │ call_sid: "vapi_call_xyz"                              │   │   │
│  │ │ tenant_id: "f3dc48bd-b83e-461a..."                     │   │   │
│  │ │ step: "booked"                                         │   │   │
│  │ │ slot_id: "2026-01-13T15:00:00Z"                        │   │   │
│  │ │ patient_data: { name, phone, email }                   │   │   │
│  │ │ updated_at: 2026-01-12 ... (5 min after start)         │   │   │
│  │ └────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 DATA FLOW SEQUENCE

### Request → Tool Call → Response Cycle

```
Time | Caller Action           | Agent Action                  | Backend Action
────────────────────────────────────────────────────────────────────────────────
 0s  | "Book appointment"      | Greet, ask for date           | -
     |                         |                               |
 5s  | "Tomorrow at 2pm"       | Prepare tool call #1          | -
     |                         |                               |
 6s  | [listening]             | Send: check_availability()    | →
     |                         |                               |
 7s  | [listening]             |                               | ← Process calendar
     |                         |                               |   Return: slots
     |                         |                               |
 8s  | [listening]             | Receive slots from tool       | -
     |                         | Speak: "Available at..."      |
     |                         |                               |
12s  | "2pm is perfect"        | Prepare tool call #2          | -
     |                         |                               |
13s  | [listening]             | Send: reserve_slot()          | →
     |                         |                               |
14s  | [listening]             |                               | ← Lock slot
     |                         |                               |   Return: success
     |                         |                               |
15s  | [listening]             | Prepare tool call #3          | -
     |                         |                               |
16s  | [listening]             | Send: send_sms_reminder()     | →
     |                         |                               |
17s  | [listening]             |                               | ← Send SMS via Twilio
     |                         |                               |   Return: delivered
     |                         |                               |
18s  | [listening]             | Speak: "SMS sent,all set!"    | Create appointment
     |                         |                               |
22s  | "Great, thanks!"        | End call gracefully           | ← Update DB state
────────────────────────────────────────────────────────────────────────────────

Total call time: ~22 seconds (3 tool calls, all <2s each)
```

---

## 📁 FILE STRUCTURE

```
backend/
├── src/
│   ├── config/
│   │   └── system-prompts.ts          ← BOOKING PROMPT TEMPLATES
│   │       ├── APPOINTMENT_BOOKING_PROMPT(context)
│   │       ├── generatePromptContext(org)
│   │       └── [Exports for dependency injection]
│   │
│   ├── services/
│   │   ├── vapi-client.ts             ← VAPI CLIENT WITH TOOLS
│   │   │   ├── getAppointmentBookingTools()  [NEW]
│   │   │   ├── syncAgentTools()              [NEW]
│   │   │   └── updateAssistant()            [MODIFIED]
│   │   │
│   │   ├── booking-agent-setup.ts     ← SETUP ORCHESTRATION [NEW]
│   │   │   ├── setupBookingAgent()
│   │   │   ├── syncToolsToAgent()
│   │   │   ├── updateAgentPrompt()
│   │   │   └── getBookingAgentStatus()
│   │   │
│   │   ├── calendar-slot-service.ts
│   │   │   ├── checkAvailability()     [Existing]
│   │   │   ├── reserveSlot()           [Existing]
│   │   │   └── [Will add atomic locking in Phase 2]
│   │   │
│   │   └── sms-compliance-service.ts
│   │       └── sendCompliantSMS()      [Existing]
│   │
│   ├── routes/
│   │   ├── assistants.ts               ← SETUP ENDPOINTS [MODIFIED]
│   │   │   ├── POST /api/assistants/:id/setup-booking         [NEW]
│   │   │   ├── GET /api/assistants/:id/booking-status         [NEW]
│   │   │   └── [Existing agent management]
│   │   │
│   │   └── vapi-tools-routes.ts        ← WEBHOOK HANDLERS [MODIFIED]
│   │       ├── POST /api/vapi/tools/calendar/check            [UPDATED]
│   │       ├── POST /api/vapi/tools/calendar/reserve          [UPDATED]
│   │       └── POST /api/vapi/tools/sms/send                  [UPDATED]
│   │
│   └── [Other existing files unchanged]
│
└── [Database migrations pending in Phase 2]
```

---

## 🔑 KEY CONCEPTS

### 1. **System Prompt Injection**
The system prompt is dynamically generated with:
- **Temporal Context**: Current date, time, timezone, business hours
- **Tool Instructions**: Exact order and parameters
- **Conversational Rules**: How to speak, what to say, edge cases

```typescript
// Example context injection:
const prompt = APPOINTMENT_BOOKING_PROMPT({
  tenantId: "f3dc48...",
  clinicName: "Wellness Partners",
  currentDate: "January 12, 2026",
  currentTime: "2:30 PM",
  tenantTimezone: "America/New_York",
  businessHours: "9 AM - 6 PM"
});
```

### 2. **Tool Invocation Order**
The prompt forces a specific order to prevent:
- Booking without checking availability (would fail)
- Reserving without patient confirmation (bad UX)
- Skipping SMS confirmation (no patient record)

```
✅ Correct: check → reserve → SMS → speak naturally
❌ Wrong: reserve → check → SMS (patient might get wrong slot)
❌ Wrong: check → speak → reserve (no confirmation)
```

### 3. **Structured Tool Responses**
Webhook responses use `toolResult.content` (JSON string) so GPT-4o can parse:

```typescript
// Vapi webhook response format:
{
  toolResult: {
    content: JSON.stringify({
      success: true,
      availableSlots: ["2pm", "3pm"],
      slotCount: 2
    })
  },
  speech: "Optional natural voice"  // Vapi can speak this
}
```

**Why JSON string?** GPT-4o requires text it can parse, not Vapi objects.

### 4. **Multi-Tenant Routing**
Each clinic has:
- Unique `tenantId` / `org_id`
- Own calendar (Google Calendar OAuth)
- Own Twilio credentials (BYOC)
- Own system prompt context

Tools receive `tenantId` → route to correct clinic.

### 5. **Error Recovery**
If a tool fails:
- Agent receives error in `toolResult.content`
- Agent offers alternative (re-check, try different date, etc.)
- No silent failures or double-bookings

---

## ⚡ LATENCY TARGETS (Phase 1 vs Phase 3)

| Operation | Phase 1 | Phase 3 (Optimized) | Improvement |
|-----------|---------|-------------------|-------------|
| Check availability | 1.8s (Google Calendar) | 50ms (Redis) | 36x faster |
| Reserve slot | 200ms (DB) | 50ms (Atomic lock) | 4x faster |
| Send SMS | 300ms (Twilio) | 300ms (no change) | - |
| Total per tool call | ~2.5s | ~0.5s | 5x faster |
| **Total booking flow** | ~7.5s | ~1.5s | 5x faster |

**Goal**: Keep all tool calls <2s so Vapi doesn't timeout (30s limit).

---

## 🛡️ SAFETY MECHANISMS (Roadmap)

**Phase 1** ✅ (Current):
- Single order enforcement (prompt-level)
- JSON schema validation (webhook-level)
- Error messages in tool responses

**Phase 2** 🔜:
- State machine tracking (prevents out-of-order calls)
- Atomic slot locking (prevents double-booking)
- Redis fast-fail (5-minute holds)

**Phase 3** 🔜:
- Cache with invalidation
- Concurrent booking tests
- Load testing (10+ calls simultaneously)

**Phase 4** 🔜:
- End-to-end test automation
- Fallback calendars (if Google down)
- Rate limiting (prevent abuse)

---

## 📞 EXAMPLE: FULL CONVERSATION TRACE

```
[00:00] VAPI CONNECT
Agent: "Hi! Thank you for calling Wellness Partners. This is Voxanne. How can I help you?"

[00:03] CALLER REQUEST
Caller: "I want to book an appointment for tomorrow at 2 PM"

[00:05] AGENT PROCESSING
Agent: "Let me check our availability for tomorrow..."

[00:06] TOOL CALL #1: check_availability
Request:  { tenantId: "f3dc48...", date: "2026-01-13", serviceType: "consultation" }
Response: { success: true, availableSlots: ["2:00 PM", "2:30 PM", "3:00 PM"] }

[00:08] AGENT SPEAKING (using tool response)
Agent: "Great! I have availability at 2:00 PM, 2:30 PM, and 3:00 PM. Which works best for you?"

[00:10] CALLER CONFIRMATION
Caller: "2:00 PM is perfect"

[00:11] AGENT PROCESSING
Agent: "Perfect! Let me hold that for you..."

[00:12] TOOL CALL #2: reserve_slot
Request:  { tenantId: "f3dc48...", slotId: "2026-01-13T14:00:00Z", patientPhone: "+12015551234" }
Response: { success: true, holdExpiresIn: "5 minutes" }

[00:13] TOOL CALL #3: send_sms_reminder
Request:  { tenantId: "f3dc48...", phoneNumber: "+12015551234", messageType: "confirmation" }
Response: { success: true, deliveryStatus: "sent" }

[00:15] FINAL AGENT RESPONSE
Agent: "All set! I've reserved your appointment for tomorrow at 2:00 PM, and I've sent a confirmation text to your phone. See you then!"

[00:17] CALL ENDS
Caller: "Thanks, goodbye"
Agent: "Have a great day!"

[~POST-CALL] DATABASE UPDATES
- appointments table: Create new record (status: "confirmed")
- call_states table: Update step to "booked"
- SMS delivery log: Record sent + confirmation
```

---

## 🎓 LEARNING: Why This Architecture?

**Problem**: Voice AI agents often fail at transactions because:
1. ❌ No explicit tool order → agent hallucinates results
2. ❌ No structured responses → agent misinterprets tool output
3. ❌ No temporal context → agent books past dates
4. ❌ No state tracking → agent repeats steps or skips confirmation

**Solution (Phase 1)**:
- ✅ Explicit prompt instructions on tool order
- ✅ JSON responses agent can parse reliably
- ✅ Injected temporal context (date, timezone, hours)
- ✅ (Phase 2) State machine for progression tracking

**Result**: Agent can reliably book 100s of appointments/day without human intervention.

---

**Next**: See [PHASE1_QUICK_START.md](PHASE1_QUICK_START.md) for testing guide.

