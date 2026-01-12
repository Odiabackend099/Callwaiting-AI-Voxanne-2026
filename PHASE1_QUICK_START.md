# 🚀 QUICK START: PHASE 1 TESTING

**Estimated Time**: 15 minutes  
**What You'll Need**:
- Your Vapi Agent ID (from https://vapi.ai/dashboard)
- Your organization ID (tenant ID)
- A phone number to receive SMS

---

## STEP 1: Get Your IDs

### Find Your Agent ID
1. Go to https://vapi.ai/dashboard
2. Click on an assistant/agent
3. Copy the ID from the URL or settings

**Example Agent ID**: `abc123def456ghi789`

### Find Your Tenant ID
1. Log in to your app dashboard
2. Go to Settings → Organization
3. Copy the Organization ID

**Example Tenant ID**: `f3dc48bd-b83e-461a-819d-258019768c5a`

---

## STEP 2: Set Up Booking Agent (1 Command)

```bash
# Replace with your actual IDs
AGENT_ID="abc123def456ghi789"
TENANT_ID="f3dc48bd-b83e-461a-819d-258019768c5a"
BASE_URL="http://localhost:3000"  # or your production URL

curl -X POST $BASE_URL/api/assistants/$AGENT_ID/setup-booking \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_ID\"}"
```

**Expected Response (200 OK)**:
```json
{
  "success": true,
  "assistantId": "abc123def456ghi789",
  "tenantId": "f3dc48bd-b83e-461a-819d-258019768c5a",
  "message": "Appointment booking agent successfully configured",
  "status": {
    "ready": true,
    "toolCount": 3,
    "hasBookingTools": true,
    "hasBookingSystemPrompt": true,
    "tools": [
      { "name": "check_availability", "type": "server", ... },
      { "name": "reserve_slot", "type": "server", ... },
      { "name": "send_sms_reminder", "type": "server", ... }
    ]
  },
  "nextSteps": [
    "✅ System prompt updated with booking instructions",
    "✅ Tools wired: check_availability, reserve_slot, send_sms_reminder",
    "🔧 Test: Call the agent and request an appointment",
    "✅ Expected: Agent will check availability, hold slot, send SMS"
  ]
}
```

**If you see `"ready": true` → ✅ Agent is configured!**

---

## STEP 3: Verify Agent is Ready

```bash
curl -X GET $BASE_URL/api/assistants/$AGENT_ID/booking-status
```

**Expected Response**:
```json
{
  "assistantId": "abc123def456ghi789",
  "ready": true,
  "status": {
    "toolCount": 3,
    "hasBookingTools": true,
    "hasBookingSystemPrompt": true,
    "tools": [
      {
        "name": "check_availability",
        "type": "server",
        "description": "Check available appointment slots for a given date..."
      },
      {
        "name": "reserve_slot",
        "type": "server",
        "description": "Reserve (hold) an appointment slot for 5 minutes..."
      },
      {
        "name": "send_sms_reminder",
        "type": "server",
        "description": "Send appointment confirmation or reminder SMS..."
      }
    ]
  }
}
```

---

## STEP 4: Make a Test Call

### Option A: Outbound Call from Vapi Dashboard
1. Go to https://vapi.ai/dashboard
2. Select the agent you just set up
3. Enter your phone number
4. Click "Call"
5. Answer the phone

### Option B: Make an Inbound Call
1. If you have an inbound phone number set up, just call it
2. It will use the agent you configured

---

## STEP 5: During the Call, Say This

**Caller**: "Hi, I'd like to book an appointment."

**Agent should respond**:
> "Hi! Thank you for calling [Clinic Name]. This is Voxanne. I'd be happy to help you book an appointment. What day would work best for you?"

**Caller**: "Tomorrow at 2pm."

**Agent should respond**:
> "Let me check our availability for tomorrow..."
> (calls check_availability tool)
> "Great! I have availability at 2pm, 3pm, and 4pm. Which time works best for you?"

**Caller**: "2pm is perfect."

**Agent should respond**:
> "Perfect! I've held that appointment for you at 2pm tomorrow. Let me send you a confirmation text."
> (calls reserve_slot tool, then send_sms_reminder tool)
> "Great! I've sent a confirmation text to your phone. You're all set!"

---

## STEP 6: Verify Everything Worked

### Check SMS Received
- You should receive a text from your clinic with appointment details

### Check Database

#### Check Appointments Table
```sql
SELECT id, org_id, scheduled_at, status, confirmation_sent, created_at
FROM appointments
WHERE org_id = 'f3dc48bd-b83e-461a-819d-258019768c5a'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected result**:
| id | org_id | scheduled_at | status | confirmation_sent | created_at |
|---|---|---|---|---|---|
| uuid | f3dc4... | 2026-01-13 14:00:00+00 | confirmed | true | 2026-01-12... |

#### Check Call States Table (if Phase 2 is complete)
```sql
SELECT call_sid, step, slot_id, patient_data, updated_at
FROM call_states
WHERE tenant_id = 'f3dc48bd-b83e-461a-819d-258019768c5a'
ORDER BY updated_at DESC
LIMIT 1;
```

**Expected progression**:
1. `step: 'greeting'` - Call started
2. `step: 'check_avail'` - Agent checked availability
3. `step: 'reserve'` - Agent reserved the slot
4. `step: 'confirm_sms'` - SMS sent
5. `step: 'booked'` - Appointment confirmed

---

## TROUBLESHOOTING

### ❌ Response: `"ready": false`

**Problem**: Tools not wired or system prompt missing

**Solution**:
1. Check that `tenantId` is correct
2. Check agent exists in Vapi dashboard
3. Try again: `curl -X POST ... /setup-booking`

---

### ❌ Agent doesn't mention checking availability

**Problem**: System prompt not updated

**Symptom**: Agent just books without calling tool

**Solution**:
1. Re-run setup endpoint
2. Wait 30 seconds for Vapi to sync
3. Make a new test call

---

### ❌ No SMS received

**Problem**: SMS service not configured or failed

**Check**:
```bash
# Look at backend logs for SMS errors
# Expected: "VapiTools", "Sending SMS", { tenantId, phoneNumber, messageType }
# Error: should show "Failed to send SMS"
```

**Solution**:
- Verify Twilio credentials in Integrations
- Verify phone number format (with country code, e.g., +1234567890)

---

### ❌ "toolResult.content" parse error

**Problem**: Webhook returning wrong format

**Check logs**:
```bash
# Look for: [POST /tools/calendar/check]
# Should see: response with { toolResult: { content: "..." } }
```

**Solution**:
- Check `vapi-tools-routes.ts` file
- Verify JSON is properly stringified in `toolResult.content`

---

## WHAT'S NEXT

✅ **Phase 1 Complete**: Agents can invoke tools  
🔧 **Phase 2 (Tomorrow)**: Double-booking prevention + state machine  
⚡ **Phase 3**: Optimize latency (Redis caching)  
✨ **Phase 4**: E2E testing + load testing

---

## QUICK REFERENCE

| Command | Purpose |
|---------|---------|
| `POST /api/assistants/:id/setup-booking` | Configure agent for booking |
| `GET /api/assistants/:id/booking-status` | Check if agent is ready |
| `POST /api/vapi/tools/calendar/check` | Check available slots |
| `POST /api/vapi/tools/calendar/reserve` | Hold a slot |
| `POST /api/vapi/tools/sms/send` | Send SMS confirmation |

---

**Questions?** Check [PHASE1_BOOKING_COMPLETE.md](PHASE1_BOOKING_COMPLETE.md) for detailed technical info.

