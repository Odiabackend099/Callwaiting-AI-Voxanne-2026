# Voxanne AI - Tool Architecture Documentation

**Version:** 1.0
**Last Updated:** 2026-02-08
**Status:** ✅ Production-Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Tool Naming Convention](#tool-naming-convention)
3. [Active Tools (Synced to Assistants)](#active-tools-synced-to-assistants)
4. [Tool Synchronization Flow](#tool-synchronization-flow)
5. [Backend Endpoints](#backend-endpoints)
6. [System Prompt Integration](#system-prompt-integration)
7. [SMS Sending Behavior](#sms-sending-behavior)
8. [File Structure](#file-structure)
9. [Adding New Tools](#adding-new-tools)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Voxanne AI uses **server-side webhook tools** to enable AI voice agents to:
- Check calendar availability
- Book appointments automatically
- Transfer calls to humans
- Look up existing customers
- End calls gracefully

**Key Principle:** All tools use **camelCase naming** (e.g., `checkAvailability`) and are registered via the `ToolSyncService`.

---

## Tool Naming Convention

### ✅ Correct (Active Naming Convention)

Tools synced to VAPI assistants use **camelCase**:

```typescript
checkAvailability
bookClinicAppointment
transferCall
lookupCaller
endCall
```

### ❌ Legacy (Deprecated)

The file `backend/src/config/vapi-tools.ts` contains **snake_case** tools that are **NOT synced**:

```typescript
check_availability    // ❌ NOT SYNCED - Do not use
book_appointment      // ❌ NOT SYNCED - Do not use
notify_hot_lead       // ❌ NOT SYNCED - Do not use
```

**Rule:** Always use tools from `phase1-tools.ts` or `unified-booking-tool.ts`, never from `vapi-tools.ts`.

---

## Active Tools (Synced to Assistants)

### 1. checkAvailability

**Purpose:** Check available appointment slots before booking

**Definition:** `backend/src/config/phase1-tools.ts:120-146`
**Endpoint:** `POST /api/vapi/tools/calendar/check`
**Parameters:**
- `date` (required): YYYY-MM-DD format (e.g., "2026-02-08")
- `serviceType` (optional): consultation | checkup | follow_up | teeth_whitening | botox | generic
- `timezone` (optional): IANA timezone string (defaults to org timezone)

**Response:**
```json
{
  "success": true,
  "requestedDate": "2026-02-08",
  "availableSlots": ["09:00", "10:00", "14:00"],
  "slotCount": 3,
  "alternatives": [],
  "message": "Found 3 available times on 2026-02-08"
}
```

**AI Behavior:** Always calls this BEFORE suggesting appointment times to customers.

---

### 2. bookClinicAppointment

**Purpose:** Book an appointment atomically with SMS confirmation

**Definition:** `backend/src/config/unified-booking-tool.ts:11-59`
**Endpoint:** `POST /api/vapi/tools/bookClinicAppointment`
**Parameters:**
- `appointmentDate` (required): YYYY-MM-DD format
- `appointmentTime` (required): HH:MM 24-hour format (e.g., "14:30")
- `patientName` (required): Full name
- `patientEmail` (required): Email address
- `patientPhone` (optional but recommended): Phone number for SMS
- `serviceType` (optional): Type of service (default: consultation)
- `duration` (optional): Duration in minutes (default: 30)

**Response:**
```json
{
  "success": true,
  "appointment_id": "uuid-here",
  "smsStatus": "sent",
  "message": "Appointment booked successfully"
}
```

**Key Behavior:**
- ✅ **SMS is sent automatically** within this endpoint (no separate tool call needed)
- Uses `BookingConfirmationService.sendConfirmationSMS()` internally
- Returns `smsStatus: 'sent' | 'failed_but_booked' | 'error_but_booked'`

**AI Behavior:** Only calls after customer explicitly confirms date, time, and details.

---

### 3. transferCall

**Purpose:** Transfer caller to a human agent

**Definition:** `backend/src/config/phase1-tools.ts:12-34`
**Endpoint:** `POST /api/vapi/tools/transferCall`
**Parameters:**
- `summary` (required): 1-sentence summary of caller's issue
- `department` (required): general | billing | medical

**AI Behavior:** Calls immediately when:
- Customer explicitly requests a human
- Customer is frustrated/angry
- Request is too complex for AI
- After 3 failed booking attempts
- Calendar/booking system is offline

---

### 4. lookupCaller

**Purpose:** Search for existing customer in database

**Definition:** `backend/src/config/phase1-tools.ts:36-57`
**Endpoint:** `POST /api/vapi/tools/lookupCaller`
**Parameters:**
- `searchKey` (required): Phone number, email, or full name
- `searchType` (required): phone | name | email

**Response:**
```json
{
  "success": true,
  "found": true,
  "customerData": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "+15551234567",
    "email": "john@example.com",
    "lastVisit": "2026-01-15"
  }
}
```

**AI Behavior:** Calls when customer says:
- "I've been there before"
- "I'm a returning customer"
- "You should have my information"

---

### 5. endCall

**Purpose:** Gracefully end the current call

**Definition:** `backend/src/config/phase1-tools.ts:59-81`
**Endpoint:** `POST /api/vapi/tools/endCall`
**Parameters:**
- `reason` (required): completed | time_limit | patient_request | transfer_needed
- `summary` (optional): 1-sentence summary of call outcome

**AI Behavior:** Calls when:
- Customer says goodbye ("bye", "goodbye", "that's all")
- Booking is confirmed AND customer acknowledges
- Call duration exceeds 9.5 minutes (590 seconds)
- After successful transfer to human

---

## Tool Synchronization Flow

### How Tools Are Registered

```
1. ToolSyncService.syncAllToolsForAssistant()
   └─> getSystemToolsBlueprint() returns 5 tools
       └─> [checkAvailability, bookClinicAppointment, transferCall, lookupCaller, endCall]

2. For each tool:
   └─> Resolve tool definition
       ├─> checkAvailability    → phase1-tools.ts
       ├─> bookClinicAppointment → unified-booking-tool.ts
       ├─> transferCall          → phase1-tools.ts
       ├─> lookupCaller          → phase1-tools.ts
       └─> endCall               → phase1-tools.ts

3. Create or update tool in VAPI
   └─> POST https://api.vapi.ai/tool (create)
   └─> PATCH https://api.vapi.ai/tool/:id (update)

4. Link tools to assistant
   └─> Update assistant's model.toolIds array
```

**Key File:** `backend/src/services/tool-sync-service.ts:45-542`

---

## Backend Endpoints

| Tool Name | HTTP Method | Endpoint | Handler File | Line |
|-----------|-------------|----------|--------------|------|
| checkAvailability | POST | `/api/vapi/tools/calendar/check` | vapi-tools-routes.ts | 111-236 |
| bookClinicAppointment | POST | `/api/vapi/tools/bookClinicAppointment` | vapi-tools-routes.ts | 748-1257 |
| transferCall | POST | `/api/vapi/tools/transferCall` | vapi-tools-routes.ts | 1259-1349 |
| lookupCaller | POST | `/api/vapi/tools/lookupCaller` | vapi-tools-routes.ts | 1351-1502 |
| endCall | POST | `/api/vapi/tools/endCall` | vapi-tools-routes.ts | 1504-1604 |

**All endpoints:**
- Accept POST requests with JSON body
- Extract arguments using `extractArgs()` middleware
- Resolve `orgId` from `tenantId` or `inboundPhoneNumber`
- Return JSON response with `toolResult` and optional `speech` fields

---

## System Prompt Integration

### Super System Prompt Structure

File: `backend/src/services/super-system-prompt.ts`

```
┌─────────────────────────────────────────┐
│ SYSTEM AUTHORITY (Immutable Rules)     │
│ - Check availability before booking     │
│ - Booking SMS is automatic              │
│ - EndCall timing rules                  │
│ - TransferCall escalation scenarios     │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ USER TEMPLATE (Customizable)           │
│ - Clinic personality                    │
│ - Greeting style                        │
│ - Service-specific language             │
└─────────────────────────────────────────┘
```

**Key Rules Enforced:**

1. **Line 107-114:** MANDATORY TOOL INVOCATION ORDER
   - MUST call checkAvailability before bookClinicAppointment

2. **Line 116-121:** BOOKING ONLY AFTER CONFIRMATION
   - Customer must confirm specific date/time
   - AI must repeat back details for confirmation

3. **Line 146-165:** END CALL CRITERIA
   - Customer says goodbye → call endCall() immediately
   - Booking complete + customer acknowledges → call endCall()
   - Call duration > 590s → call endCall(reason='time_limit')

4. **Line 174-215:** TRANSFER CALL SCENARIOS
   - 6 escalation scenarios defined
   - Customer requests human → immediate transfer
   - Frustrated customer → immediate transfer
   - Calendar offline → collect info, then transfer

---

## SMS Sending Behavior

### ✅ SMS is AUTOMATIC after booking

**Key Point:** The AI does NOT need to call a separate SMS tool.

**Implementation:** `backend/src/routes/vapi-tools-routes.ts:1122-1139`

```typescript
// Inside bookClinicAppointment endpoint
if (bookingResult.success) {
    // ⚡ SMS BRIDGE: Automatic SMS sending
    const smsResult = await BookingConfirmationService.sendConfirmationSMS(
        orgId,
        bookingResult.appointment_id,
        bookingResult.lead_id,
        phone
    );

    // Response includes SMS status
    return {
        success: true,
        appointment_id: bookingResult.appointment_id,
        smsStatus: smsResult.success ? 'sent' : 'failed_but_booked'
    };
}
```

**SMS Content:** Includes appointment details, clinic info, and opt-out language (10DLC compliant).

---

## File Structure

### Source of Truth Files

```
backend/src/config/
├── phase1-tools.ts              ✅ SOURCE OF TRUTH (camelCase tools)
│   ├── transferCall
│   ├── lookupCaller
│   ├── endCall
│   └── checkAvailability
│
├── unified-booking-tool.ts      ✅ SOURCE OF TRUTH (booking tool)
│   └── bookClinicAppointment
│
└── vapi-tools.ts                ❌ DEPRECATED (snake_case tools - DO NOT USE)
    ├── check_availability       ❌ Not synced
    ├── book_appointment         ❌ Not synced
    └── notify_hot_lead          ❌ Not synced (no endpoint)
```

### Service Files

```
backend/src/services/
├── tool-sync-service.ts         Tool registration with VAPI
├── super-system-prompt.ts       AI instruction wrapper
└── vapi-client.ts               VAPI API client
```

### Route Files

```
backend/src/routes/
├── vapi-tools-routes.ts         Tool webhook handlers (1847 lines)
└── vapi-tools.ts                Backup handlers (deprecated)
```

---

## Adding New Tools

### Step-by-Step Guide

**1. Define Tool in phase1-tools.ts**

```typescript
export const MY_NEW_TOOL = {
  type: 'function',
  function: {
    name: 'myNewTool',  // ✅ camelCase
    description: 'What this tool does...',
    parameters: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'Parameter description'
        }
      },
      required: ['param1']
    }
  },
  async: true
};

export function getMyNewTool(backendUrl: string) {
  return {
    ...MY_NEW_TOOL,
    server: {
      url: `${backendUrl}/api/vapi/tools/myNewTool`
    }
  };
}
```

**2. Add to ToolSyncService Blueprint**

File: `backend/src/services/tool-sync-service.ts`

```typescript
// Line ~500: Add to getSystemToolsBlueprint()
{
  name: 'myNewTool',
  description: 'What this tool does',
  isSystem: true,
  tags: ['system', 'v1'],
  metadata: { creator: 'system' }
}

// Line ~240: Add to tool resolver switch
case 'myNewTool':
  toolDef = getMyNewTool(backendUrl);
  break;
```

**3. Create Backend Endpoint**

File: `backend/src/routes/vapi-tools-routes.ts`

```typescript
router.post('/tools/myNewTool', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, param1 } = args;

        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !param1) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Tool logic here
        const result = await doSomething(resolvedTenantId, param1);

        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: true,
                    data: result
                })
            },
            speech: 'Human-readable response for AI to say'
        });
    } catch (error: any) {
        log.error('VapiTools', 'Error in myNewTool', { error: error.message });
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: error.message
                })
            },
            speech: 'Something went wrong, let me try again.'
        });
    }
});
```

**4. Update Super System Prompt (Optional)**

File: `backend/src/services/super-system-prompt.ts`

```typescript
// Add section explaining when AI should use this tool
[MY NEW TOOL - WHEN TO USE]
Use myNewTool when customer asks about X or wants to do Y.
Parameters: param1 should be extracted from customer's request.
```

**5. Deploy & Verify**

```bash
# Compile TypeScript
cd backend && npm run build

# Verify tool syncs
npm run test:tool-sync

# Check tool appears in VAPI dashboard
# Visit: https://dashboard.vapi.ai/tools

# Test tool call
curl http://localhost:3001/api/vapi/tools/myNewTool \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"org-id-here","param1":"test-value"}'
```

---

## Troubleshooting

### Tool Not Appearing in VAPI Dashboard

**Symptom:** Tool defined but not synced to assistant

**Diagnosis:**
```bash
# Check ToolSyncService logs
grep "Tool sync" backend/logs/*.log

# Verify tool in blueprint
ts-node -e "
  const { ToolSyncService } = require('./backend/src/services/tool-sync-service');
  const blueprint = ToolSyncService.getSystemToolsBlueprint();
  console.log(blueprint.map(t => t.name));
"
```

**Solutions:**
1. Verify tool added to `getSystemToolsBlueprint()` method
2. Check tool resolver switch has case for your tool
3. Ensure function name is camelCase
4. Restart backend server
5. Manually trigger tool sync via agent save endpoint

---

### AI Not Calling Tool

**Symptom:** Tool exists but AI never calls it

**Diagnosis:**
1. Check super-system-prompt.ts mentions the tool
2. Verify tool description is clear and specific
3. Check tool is linked to assistant in VAPI dashboard
4. Review call logs for tool invocation attempts

**Solutions:**
1. Make tool description more explicit about when to use
2. Add example usage in system prompt
3. Reduce required parameters (AI may skip if too complex)
4. Test with direct Vapi API call to verify endpoint works

---

### Tool Endpoint Returns 400/500 Error

**Symptom:** Tool called but backend returns error

**Diagnosis:**
```bash
# Check backend logs
tail -f backend/logs/vapi-tools-routes.log

# Test endpoint directly
curl -X POST http://localhost:3001/api/vapi/tools/yourTool \
  -H "Content-Type: application/json" \
  -d '{"toolCall":{"arguments":{"param":"value"}}}'
```

**Common Causes:**
1. Missing required parameters
2. Parameter type mismatch (string vs number)
3. Org ID resolution failure (tenantId not provided)
4. Database connection error
5. External API (Twilio, Google Calendar) timeout

**Solutions:**
1. Add input validation with clear error messages
2. Log all incoming parameters for debugging
3. Test orgId resolution separately
4. Add circuit breakers for external API calls
5. Return user-friendly error messages in `speech` field

---

### SMS Not Sending After Booking

**Symptom:** Booking succeeds but no SMS sent

**Diagnosis:**
```bash
# Check BookingConfirmationService logs
grep "sendConfirmationSMS" backend/logs/*.log

# Verify Twilio credentials
curl http://localhost:3001/api/health/twilio \
  -H "Authorization: Bearer $TOKEN"
```

**Common Causes:**
1. Twilio credentials not configured
2. Phone number not in E.164 format
3. SMS service circuit breaker open
4. 10DLC campaign not approved
5. Rate limit exceeded

**Solutions:**
1. Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` env vars
2. Normalize phone number to E.164 before SMS send
3. Check circuit breaker status: `/api/circuit-breaker/status`
4. Verify 10DLC campaign approved in Twilio dashboard
5. Implement SMS queue with retry logic

---

## Additional Resources

- **VAPI API Documentation:** https://docs.vapi.ai
- **Tool Webhook Spec:** https://docs.vapi.ai/server-url
- **Circuit Breaker Pattern:** See `backend/src/services/safe-call.ts`
- **Advisory Locks:** See `backend/src/services/atomic-booking-service.ts`

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-08 | 1.0 | Initial documentation - 5 active tools, SMS behavior clarified, deprecation notices added |

---

**Questions?** Check existing implementation in the files referenced above, or review call logs for real-world examples.
