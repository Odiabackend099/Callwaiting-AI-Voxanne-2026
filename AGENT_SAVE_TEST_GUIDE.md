# Agent Save Fix - Testing Guide

## ✅ Status: Servers Running
- Backend: http://localhost:3001 (PID 51126)
- Frontend: http://localhost:3000 (PID 51153)

---

## Option 1: UI Testing (Recommended)

### Steps:
1. **Open Dashboard:**
   ```bash
   open http://localhost:3000/dashboard/agent-config
   ```

2. **Login:**
   - Email: `voxanne@demo.com`
   - Password: [your password]

3. **Test Outbound Agent Save:**
   - Switch to **Outbound** tab
   - Update any field:
     - **Name:** "Sales Agent Robin"
     - **Voice:** Select from dropdown
     - **System Prompt:** "You are a helpful sales assistant"
     - **First Message:** "Hello! How can I help?"
   - Click **"Save Changes"**

4. **Expected Result:**
   - ✅ Success message: "Agent configuration saved successfully"
   - ❌ NOT: "No agents were updated" error

5. **Check Backend Logs:**
   - Look for `=== AGENT SAVE DEBUG ===` section
   - Should show what was received and built
   - If payload is null, will show warning with reasons

---

## Option 2: Automated Test Script

### Prerequisites:
You need a valid JWT token from the dashboard.

### Get JWT Token:
1. Login to http://localhost:3000 as voxanne@demo.com
2. Open browser DevTools (F12)
3. Go to: **Application** → **Local Storage** → **http://localhost:3000**
4. Find Supabase auth token
5. Copy the `access_token` value

### Run Test:
```bash
cd backend

# Set JWT token
export TEST_JWT="YOUR_TOKEN_HERE"

# Run test script
npx ts-node src/scripts/test-agent-save.ts
```

### Expected Output:
```
╔════════════════════════════════════════════════════════════════════════════╗
║                    Agent Save Endpoint Test Suite                          ║
╚════════════════════════════════════════════════════════════════════════════╝

================================================================================
  Test: Valid Outbound Agent Save
================================================================================

Request Payload:
{
  "outbound": {
    "name": "Test Sales Agent",
    "systemPrompt": "You are a helpful sales assistant...",
    ...
  }
}

Response Status: 200
Response Body:
{
  "success": true,
  ...
}

✅ TEST PASSED

[... more tests ...]

================================================================================
  Test Summary
================================================================================

Total Tests: 5
✅ Passed: 5
❌ Failed: 0
Success Rate: 100%

🎉 All tests passed! The fix is working correctly.
```

---

## Option 3: Manual cURL Test

### Get JWT Token (same as Option 2)

### Test Save Endpoint:
```bash
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "outbound": {
      "name": "Test Agent",
      "systemPrompt": "You are helpful",
      "firstMessage": "Hello",
      "voiceId": "en-US-JennyNeural",
      "voiceProvider": "azure",
      "language": "en",
      "maxDurationSeconds": 600
    }
  }'
```

### Expected Response:
```json
{
  "success": true,
  "message": "Agent configuration updated",
  "inbound": { ... },
  "outbound": { ... }
}
```

---

## What Changed (Technical Details)

### 1. Added VapiAssistantManager Import
**File:** `backend/src/routes/founder-console-v2.ts` (line 13)
- Enables deletion functionality

### 2. Graceful Empty Payload Handling
**File:** `backend/src/routes/founder-console-v2.ts` (lines 2354-2379)
- Returns 200 "No changes to save" instead of 400 error
- Provides diagnostic info when real errors occur

### 3. Enhanced Validation Logging
**File:** `backend/src/routes/founder-console-v2.ts` (lines 2068-2097)
- Shows WHY payloads are rejected
- Lists possible reasons (invalid voice, empty fields, etc.)

### 4. Voice Registry Debug Info
**File:** `backend/src/routes/founder-console-v2.ts` (lines 2016-2023)
- Shows available voices when validation fails

### 5. Added getInboundAgentConfig Helper
**File:** `src/lib/supabaseHelpers.ts` (lines 139-147)
- Fixes Hero component import errors

---

## Troubleshooting

### "No agents were updated" Error Still Appears:

**Check backend logs for:**
```
=== AGENT SAVE DEBUG ===
Outbound received: { ... }
Outbound payload built: null
⚠️ WARNING: Outbound config provided but payload is NULL
```

**Common causes:**
1. **Invalid voice ID:** Voice not in registry
2. **Empty fields:** All fields are null/undefined
3. **Invalid language:** Language not in allowed list

**Solution:** Check the specific warning in server logs

### Backend Not Responding:

```bash
# Check if backend is running
lsof -i :3001

# If not, start it
cd backend
npm run dev
```

### Frontend Not Loading:

```bash
# Check if frontend is running
lsof -i :3000

# If not, start it
npm run dev
```

---

## Success Criteria

✅ Agent saves without "No agents were updated" error
✅ Deletion works (removes from database AND Vapi)
✅ Server logs show detailed debug info
✅ Hero components load without import errors
✅ Invalid voice shows helpful error with available options

---

## Next Steps After Testing

If all tests pass:
1. ✅ Mark the fix as verified
2. 🎯 Test in production environment
3. 📊 Monitor server logs for any issues
4. 🚀 Deploy to production when ready

If tests fail:
1. 📋 Share backend console output
2. 🔍 Check `=== AGENT SAVE DEBUG ===` section
3. 💬 Report specific error message
