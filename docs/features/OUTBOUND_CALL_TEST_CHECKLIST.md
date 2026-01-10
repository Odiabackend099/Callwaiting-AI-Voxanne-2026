# Outbound Call Test - Battle-Tested Implementation Checklist

**Objective**: CEO Peter Ntaji can call any phone number and the outbound agent will call that number back with the configured system prompt and first message.

**Status**: ✅ READY FOR TESTING

---

## End-to-End Flow

```
Dashboard: Enter phone number (e.g., +1234567890)
    ↓
Click "Test Call" button
    ↓
Frontend validates E.164 format
    ↓
POST /api/founder-console/agent/web-test-outbound
    ↓
Backend loads outbound_agent_config (dashboard source of truth)
    ↓
Backend loads inbound phone number (Vapi phone number ID)
    ↓
Backend creates Vapi outbound call
    ↓
Frontend connects to /ws/live-calls WebSocket
    ↓
Receives transcripts in real-time
    ↓
Call ends, summary displayed
```

---

## Implementation Checklist

### ✅ Backend Endpoint (Already Implemented)
**File**: `backend/src/routes/founder-console-v2.ts` (lines 2456-2768)

**What it does**:
1. Validates phone number (E.164 format)
2. Loads outbound_agent_config from dashboard (source of truth)
3. Loads inbound phone number mapping
4. Creates Vapi outbound call with correct parameters
5. Returns trackingId for WebSocket subscription

**Key parameters**:
- `phoneNumber`: Phone number to call (required, E.164 format)
- `assistantId`: From outbound_agent_config
- `phoneNumberId`: Vapi phone number ID (from inbound mapping)
- `customer.number`: The phone number being called

### ✅ Frontend Dashboard UI (Needs Verification)
**File**: `src/app/dashboard/test/page.tsx` (lines 99-287)

**Current implementation**:
- Phone number input field (line 100)
- E.164 validation (line 242-253)
- Confirmation dialog (line 255-258)
- Call initiation (line 260-287)

**What needs to be verified**:
- Phone input field accepts any E.164 number
- "Test Call" button passes phoneNumber to backend
- Error messages are clear and actionable

### ✅ WebSocket Connection (Already Implemented)
**File**: `src/app/dashboard/test/page.tsx` (lines 310-380)

**What it does**:
1. Connects to `/ws/live-calls` WebSocket
2. Subscribes with auth token
3. Filters transcripts by trackingId
4. Displays agent and user transcripts in real-time

---

## Pre-Test Checklist

### Backend Setup
- [ ] Backend running: `npm run dev` in `/backend`
- [ ] Vapi API key saved in dashboard
- [ ] Twilio credentials saved in dashboard
- [ ] Inbound agent configured (system prompt, first message, voice)
- [ ] Outbound agent configured (system prompt, first message, voice)
- [ ] Inbound phone number provisioned (via Inbound Config page)

### Frontend Setup
- [ ] Frontend running: `npm run dev` in root
- [ ] Logged in to dashboard
- [ ] Can navigate to `/dashboard/test?tab=phone`
- [ ] Phone input field visible and accepts text

---

## Test Procedure

### Test 1: Basic Outbound Call
**Steps**:
1. Go to `/dashboard/test?tab=phone`
2. Enter phone number: `+1234567890` (or your test number)
3. Click "Test Call"
4. Confirm the call

**Expected Results**:
- Call initiates (button shows "Calling...")
- WebSocket connects (status shows "connected")
- Agent calls the number
- Agent speaks first message
- Transcripts appear in real-time
- User can speak and agent responds

**If it fails**:
- Check backend logs for error message
- Verify outbound_agent_config is populated
- Verify inbound phone number is provisioned
- Check Vapi API key is valid

### Test 2: Phone Number Validation
**Steps**:
1. Go to `/dashboard/test?tab=phone`
2. Enter invalid number: `123456` (not E.164)
3. Click "Test Call"

**Expected Results**:
- Error message: "Phone number must be in E.164 format (e.g., +1234567890)"
- Call does not initiate

### Test 3: Missing Configuration
**Steps**:
1. Clear outbound agent configuration
2. Go to `/dashboard/test?tab=phone`
3. Enter valid phone number
4. Click "Test Call"

**Expected Results**:
- Error message: "Outbound agent configuration incomplete. Missing: [fields]. Please save the Outbound Configuration in the dashboard first."
- Call does not initiate

### Test 4: Call End & Summary
**Steps**:
1. Initiate a call (Test 1)
2. Wait for agent to speak
3. Click "End Call"
4. Wait for summary to load

**Expected Results**:
- Call ends cleanly
- Summary displays (duration, transcript, etc.)
- No errors in console

---

## Key Code Paths

### Phone Number Validation
**File**: `src/app/dashboard/test/page.tsx:242-253`
```typescript
const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) {
        setPhoneValidationError('Phone number is required');
        return false;
    }
    if (!E164_REGEX.test(phone)) {
        setPhoneValidationError('Phone number must be in E.164 format (e.g., +1234567890)');
        return false;
    }
    setPhoneValidationError(null);
    return true;
};
```

### Call Initiation
**File**: `src/app/dashboard/test/page.tsx:260-287`
```typescript
const handleConfirmCall = async () => {
    setShowConfirmDialog(false);
    if (!phoneNumber) return;

    if (!outboundConfigLoaded) {
        return;
    }

    setIsCallingPhone(true);
    setCallSummary(null);
    try {
        const data = await authedBackendFetch<any>('/api/founder-console/agent/web-test-outbound', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber }),  // <-- Phone number passed here
            timeoutMs: 30000,
            retries: 1,
        });
        if (data.trackingId) {
            setOutboundTrackingId(data.trackingId);
            setPhoneCallId(data.callId);
        }
    } catch (err) {
        console.error('Phone call failed:', err);
        alert((err as any).message || 'Failed to start phone call');
    } finally {
        setIsCallingPhone(false);
    }
};
```

### Backend Phone Number Handling
**File**: `backend/src/routes/founder-console-v2.ts:2468-2484`
```typescript
const { phoneNumber } = req.body;
if (!phoneNumber || typeof phoneNumber !== 'string') {
    res.status(400).json({ error: 'phoneNumber required and must be a string', requestId });
    return;
}

// CRITICAL FIX #5: E.164 phone number validation
const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, ''); // Remove formatting
const e164Regex = /^\+[1-9]\d{6,14}$/; // E.164: must start with +, then 7-15 digits
if (!e164Regex.test(cleanPhone)) {
    res.status(400).json({
        error: 'Invalid phone number. Use E.164 format: +1234567890 (include country code)',
        requestId
    });
    return;
}
```

### Vapi Call Creation
**File**: `backend/src/routes/founder-console-v2.ts:2684-2691`
```typescript
const vapiClient = new VapiClient(vapiApiKey);
call = await vapiClient.createOutboundCall({
    assistantId,
    phoneNumberId,  // Vapi phone number ID (caller ID)
    customer: {
        number: cleanPhone  // Phone number to call
    }
});
```

---

## Troubleshooting

### Issue: "Phone number must be in E.164 format"
**Cause**: Phone number not in correct format
**Solution**: 
- Must start with `+`
- Must have country code (e.g., `+1` for US, `+44` for UK)
- Must be 7-15 digits total
- Example: `+1234567890`

### Issue: "Outbound agent configuration incomplete"
**Cause**: Outbound agent config not saved in dashboard
**Solution**:
1. Go to `/dashboard/outbound-agent-config`
2. Fill in all fields (system prompt, first message, voice, language, duration)
3. Click "Save Configuration"
4. Return to test page and try again

### Issue: "Inbound phone number is not provisioned yet"
**Cause**: Inbound setup not completed
**Solution**:
1. Go to `/dashboard/inbound-config`
2. Enter Twilio credentials
3. Click "Save & Activate Inbound"
4. Return to test page and try again

### Issue: Call initiates but no transcripts appear
**Cause**: WebSocket connection issue
**Solution**:
1. Check browser console for WebSocket errors
2. Verify backend is running
3. Check network tab for `/ws/live-calls` connection
4. Verify auth token is valid

### Issue: Agent doesn't speak or speaks wrong message
**Cause**: Vapi assistant not updated with latest config
**Solution**:
1. Go to `/dashboard/outbound-agent-config`
2. Change first message to something unique
3. Click "Save Configuration"
4. Initiate a new call
5. Agent should speak the new message

---

## Files Involved

**Frontend**:
- `src/app/dashboard/test/page.tsx` - Test page UI
- `src/lib/authed-backend-fetch.ts` - API calls

**Backend**:
- `backend/src/routes/founder-console-v2.ts` - Test call endpoint
- `backend/src/services/vapi-client.ts` - Vapi API client
- `backend/src/routes/webhooks.ts` - WebSocket broadcast

**Database**:
- `outbound_agent_config` - Dashboard config (source of truth)
- `inbound_agent_config` - Inbound config (for phone number)
- `call_tracking` - Call history
- `integrations` - Vapi/Twilio credentials

---

## Success Criteria

✅ CEO can enter any phone number in E.164 format  
✅ Clicking "Test Call" initiates an outbound call  
✅ Agent calls the number with correct first message  
✅ Agent uses correct system prompt and voice  
✅ Transcripts appear in real-time  
✅ Call can be ended cleanly  
✅ Clear error messages if something fails  
✅ No console errors or warnings  

---

## Deployment Steps

### Step 1: Verify Backend Endpoint
```bash
curl -X POST http://localhost:3001/api/founder-console/agent/web-test-outbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "phoneNumber": "+1234567890"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "vapiCallId": "call_xxx",
  "trackingId": "uuid",
  "userId": "user_xxx",
  "requestId": "req_xxx"
}
```

### Step 2: Test via Dashboard
1. Go to `/dashboard/test?tab=phone`
2. Enter phone number
3. Click "Test Call"
4. Verify call initiates and transcripts appear

### Step 3: Verify Call Routing
1. Make an inbound call to Twilio number
2. Verify inbound agent answers
3. Make an outbound test call
4. Verify outbound agent calls the number
5. Verify both use correct system prompts

---

## Notes

- Phone numbers are cleaned of formatting (spaces, dashes, parentheses) before validation
- E.164 regex: `^\+[1-9]\d{6,14}$` (must start with +, 7-15 digits)
- Outbound calls use the inbound phone number as caller ID (single-number policy)
- Transcripts are broadcast via WebSocket, not stored in real-time
- Call summary is fetched after call ends

