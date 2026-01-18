# Inbound Assistant Verification Report

**Date:** January 17, 2026 19:19 UTC
**Status:** ✅ ASSISTANT CREATED | ⚠️ TOOLS NOT REGISTERED

---

## What Was Accomplished

### ✅ Assistant Created Successfully
- **ID:** `1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada`
- **Name:** CallWaiting AI Inbound
- **Voice:** Kylie
- **Language:** en-US
- **Model:** GPT-4
- **Location:** Vapi Dashboard (verified)
- **Database:** Saved to agents table (verified)

### Agent Details in Database
```
ID:                 20bac455-7b1e-4d93-88bc-18dac0fdcc21
Role:               inbound
Vapi Assistant ID:  1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada
Voice:              Kylie
Language:           en-US
```

### ⚠️ Tools NOT Registered
- **Status:** 0 tools
- **Expected:** 7 tools (bookClinicAppointment, check_availability, reserve_atomic, send_otp_code, verify_otp, send_confirmation_sms, send_sms_reminder)
- **Reason:** Vapi API limitation

---

## Vapi API Limitation Discovered

### The Problem
Vapi's PATCH `/assistant/:id` endpoint **does not accept custom server tools for existing assistants**.

When attempting to update an existing assistant with tools:
```
POST /api/vapi.ai/assistant/{id}
{"tools": [...]}

Response: 400 Bad Request
{
  "message": ["property tools should not exist"],
  "error": "Bad Request"
}
```

### The Root Cause
Custom server-type tools can only be embedded in an assistant **at creation time**, not added afterward. The Vapi API design requires:
1. **Creation:** Tools embedded in POST `/assistant` (initial create)
2. **Updates:** Only model, voice, serverUrl, etc. can be PATCH'd
3. **Limitation:** Custom server tools locked at creation

### Vapi API Reference
- Creation: `POST /assistant` - Accepts `tools` array ✓
- Updates: `PATCH /assistant/:id` - Rejects `tools` array ✗
- Tool endpoint: `POST /tool` - Only accepts pre-defined tool types (not custom server types)

---

## What This Means

### For Voice Calls
- Inbound calls WILL WORK (assistant is configured and can answer)
- Appointment booking WILL NOT WORK (no tools = AI can't call bookClinicAppointment)
- General conversation WILL WORK (assistant has system prompt)

### For Backend Integration
- Webhook callbacks WILL WORK (serverUrl is set)
- Tool invocations WILL NOT WORK (no tools registered)
- Call transcription WILL WORK (transcriber is configured)

---

## Solution Paths

### Option 1: Delete & Recreate (Recommended)
Delete current assistant and create new one WITH tools embedded:
```typescript
// Delete existing
await vapiClient.deleteAssistant('1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada');

// Create fresh with tools
const newAssistant = await vapiClient.createAssistant({
  name: 'CallWaiting AI Inbound',
  systemPrompt: '...',
  voice: 'Kylie',
  tools: getAppointmentBookingTools() // <-- Embedded at creation
});
```

**Pros:**
- Clean state
- All tools registered
- Works with current Vapi API

**Cons:**
- Changes assistant ID
- Any configured phone numbers would need remapping

### Option 2: Manual Vapi Dashboard Setup
1. Go to https://dashboard.vapi.ai/assistants/1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada
2. Click "Tools" tab
3. Add tool definitions manually
4. Test

**Pros:**
- No code changes
- No deletion needed

**Cons:**
- Manual process
- Doesn't solve programmatic registration
- Won't work for future assistants

### Option 3: Update Creation Logic
Modify `founder-console-v2.ts` to pass tools during assistant creation:
```typescript
// When creating assistant via Vapi, include tools
const assistant = await vapiClient.createAssistant({
  name: 'CallWaiting AI Inbound',
  systemPrompt: data.systemPrompt,
  tools: vapiClient.getAppointmentBookingTools() // Add this line
});
```

**Pros:**
- Fixes root cause
- Works for all future assistants
- Automated process

**Cons:**
- Need to delete current assistant first
- Requires code deployment

---

## Current Assistant Configuration

From Vapi API Response:
```json
{
  "id": "1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada",
  "name": "CallWaiting AI Inbound",
  "voice": {
    "voiceId": "Kylie",
    "provider": "vapi"
  },
  "model": {
    "model": "gpt-4",
    "toolIds": [],           // EMPTY - No tools registered
    "provider": "openai"
  },
  "firstMessage": "Thank you for calling The Aesthetic Institute. This is Sarah...",
  "transcriber": {
    "model": "nova-2",
    "language": "en-US",
    "provider": "deepgram"
  },
  "serverUrl": "http://localhost:3000/api/webhooks/vapi",
  "maxDurationSeconds": 300,
  "createdAt": "2026-01-17T18:24:14.813Z",
  "updatedAt": "2026-01-17T19:16:42.391Z"
}
```

---

## Immediate Actions Required

### To Make Voice Calls Work
✅ Already done - Assistant exists and can receive calls

### To Make Booking Work
Choose one approach:

**Approach A: Delete & Recreate (Recommended)**
```bash
# 1. Delete current assistant
DELETE /api/vapi/assistant/1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada

# 2. Save agent again (will create fresh with tools embedded)
POST /api/founder-console/agent/behavior
```

**Approach B: Manual Setup**
1. Open Vapi dashboard
2. Add tools manually
3. Test

**Approach C: Code Fix**
1. Update agent creation to embed tools
2. Delete current assistant
3. Save agent again to recreate with tools

---

## Testing Checklist

- [ ] **Voice Call:** Can call the inbound number and reach the assistant
- [ ] **Greeting:** Assistant answers with first message
- [ ] **General Chat:** Can ask questions and get responses
- [ ] **Booking Request:** Ask to book appointment (will fail without tools)
- [ ] **Transcription:** Check that call is transcribed correctly
- [ ] **Webhooks:** Verify webhook callbacks are received

---

## Vapi API Limitations Reference

| Feature | POST Create | PATCH Update | Notes |
|---------|-------------|--------------|-------|
| Name | ✓ | ✓ | Can change anytime |
| Voice | ✓ | ✓ | Can change anytime |
| System Prompt | ✓ | ✓ | Can change anytime |
| **Custom Server Tools** | ✓ | ✗ | Only at creation |
| First Message | ✓ | ✓ | Can change anytime |
| Model | ✓ | ✓ | Can change anytime |
| Transcriber | ✓ | ✓ | Can change anytime |

---

## Recommendation

**For this session:** The assistant works for voice calls but won't support booking without tools.

**Path Forward:**
1. **Short term:** Delete and recreate assistant WITH tools embedded
2. **Long term:** Update `founder-console-v2.ts` to always embed tools on initial creation
3. **Testing:** Verify booking works end-to-end after recreation

---

## Files Created for Debugging
- `verify-inbound-agent.ts` - Checks assistant in DB and Vapi
- `register-inbound-tools.ts` - Attempted tool registration (failed - API limitation)
- `register-tools-direct.ts` - Alternative registration attempt (failed - API limitation)
- `check-vapi-api-limits.ts` - Fetches current assistant config from Vapi

---

## Next Steps

**To enable booking on inbound calls:**

Option 1 (Quickest):
```bash
# Re-save the agent (will need code fix first to embed tools)
# OR manually add tools in Vapi dashboard
```

Option 2 (Recommended):
```typescript
// Update: backend/src/routes/founder-console-v2.ts

// In the agent creation code, change:
const assistant = await vapiClient.createAssistant({
  name,
  systemPrompt,
  voice,
  // ADD THIS:
  tools: vapiClient.getAppointmentBookingTools(config.BACKEND_URL)
});
```

Then:
```bash
1. Delete current assistant from Vapi dashboard or via API
2. Re-save the agent in frontend
3. New assistant created WITH tools
4. Verify in Vapi dashboard - should show 7 tools
5. Test booking in voice call
```

---

**Status Summary:**
- ✅ Assistant exists and can take voice calls
- ❌ Tools not registered due to Vapi API limitation
- ⚠️ Booking will not work until tools are registered
- 🔧 Easy fix: Delete assistant and recreate with tools embedded

