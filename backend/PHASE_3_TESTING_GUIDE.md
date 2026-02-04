# Phase 3: End-to-End Testing Guide

**Status:** 🧪 **READY FOR TESTING**
**Prerequisites:** Phases 1 & 2 complete ✅

---

## 🚀 Step 1: Restart Backend Server (REQUIRED)

The backend server must be restarted to load the new token refresh logic.

### Option A: Quick Restart (Recommended)

```bash
# Kill existing backend process
pkill -f "tsx.*server.ts"

# Verify it's stopped
lsof -ti:3001 || echo "Port 3001 is free ✅"

# Start backend in development mode
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run dev
```

### Option B: Manual Restart

```bash
# Find the process ID
ps aux | grep "tsx.*server.ts" | grep -v grep

# Kill the process (replace PID with actual process ID)
kill -9 10225 10224

# Start backend
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run dev
```

### Verify Backend is Running

```bash
# Check server health
curl http://localhost:3001/health

# Expected output:
# {"status":"ok","timestamp":"..."}
```

---

## 🧪 Step 2: Run Database Verification Test

This test verifies both SMS and Calendar fixes are in place.

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Run the comprehensive E2E test
node test-sms-calendar-e2e.js
```

**Expected Output:**
```
🧪 END-TO-END VERIFICATION TEST
======================================================================
[TEST 1/5] SMS Provider Name Fix...
   ✅ PASS - Twilio credentials queryable with lowercase "twilio"

[TEST 2/5] Calendar Credentials Exist...
   ✅ PASS - Google Calendar credentials exist (920 chars)

[TEST 3/5] Organization Configuration...
   ✅ PASS - Organization configured
      Email: voxanne@demo.com
      Name: Voxanne Demo Clinic
      Timezone: America/Los_Angeles

[TEST 4/5] Holy Grail Evidence (2026-02-02)...
   ✅ PASS - Found 1 appointment(s)

[TEST 5/5] All Integrations Summary...
   ✅ PASS - Found 3 integration(s):
      ✅ ⚪ google_calendar
      ✅ ⚪ twilio
      ✅ ⚪ twilio_inbound

📊 TEST RESULTS SUMMARY
   Tests Passed: 5/5
   Tests Failed: 0/5

🎉 ALL TESTS PASSED - System Ready for Phase 3
```

---

## 📱 Step 3: Test SMS Delivery (Live Test)

### Method 1: Trigger Booking via Vapi Call (Recommended)

**Best way to test the complete Holy Grail loop:**

1. Call your Vapi inbound number
2. Follow the AI agent conversation
3. Request an appointment
4. Provide phone number: `+2348141995397` (or your test number)
5. Complete the booking

**Expected Results:**
- ✅ Appointment created in database
- ✅ SMS confirmation sent to phone
- ✅ Calendar event created in Google Calendar

**Monitor Backend Logs:**
```bash
# In a separate terminal, watch the logs
tail -f /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/logs/combined.log

# Look for these log lines:
# "🔄 Google token refreshed successfully" (first time only)
# "✅ Google Calendar credentials persisted and marked connected"
# "📱 SMS Bridge Result" { smsStatus: 'sent', messageSid: 'SM...' }
```

### Method 2: API Test with curl

**Direct booking API test:**

```bash
# Replace with actual values
ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
CONTACT_PHONE="+2348141995397"
APPOINTMENT_DATE="2026-02-05T15:00:00Z"

curl -X POST http://localhost:3001/api/vapi-tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "test-phase3-001",
    "message": {
      "call": {
        "customer": {
          "number": "'$CONTACT_PHONE'"
        }
      }
    },
    "customerName": "Austyn Test",
    "customerPhone": "'$CONTACT_PHONE'",
    "customerEmail": "austyn@demo.com",
    "appointmentDate": "2026-02-05",
    "appointmentTime": "15:00",
    "serviceType": "consultation"
  }'
```

**Expected Response:**
```json
{
  "toolCallId": "test-phase3-001",
  "result": {
    "success": true,
    "appointmentId": "...",
    "message": "Appointment booked successfully",
    "scheduledAt": "2026-02-05T15:00:00Z",
    "smsStatus": "sent",
    "messageSid": "SM..."
  }
}
```

---

## 📅 Step 4: Verify Calendar Token Auto-Refresh

### Test Calendar Health Check

```bash
# This will trigger token refresh if needed
curl http://localhost:3001/api/integrations/google-calendar/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Logs (First Time):**
```
[INFO] IntegrationDecryptor: Google token expired or expiring soon, attempting refresh
[INFO] IntegrationDecryptor: 🔄 Google token refreshed successfully
[INFO] IntegrationDecryptor: ✅ Google Calendar credentials persisted and marked connected
```

**Expected Logs (Subsequent Calls):**
```
[DEBUG] IntegrationDecryptor: ✅ Google token valid (no refresh needed)
```

### Verify Database State

```bash
# Check if connected flag is now true
node -e "
const https = require('https');
const query = \"SELECT provider, connected, last_checked_at FROM integrations WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e' AND provider = 'google_calendar'\";
const data = JSON.stringify({ query });
const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: '/v1/projects/lbjymlodxprzqgtyqtcq/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};
const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(JSON.parse(body)));
});
req.write(data);
req.end();
"
```

**Expected Output:**
```json
[
  {
    "provider": "google_calendar",
    "connected": true,
    "last_checked_at": "2026-02-04T..."
  }
]
```

---

## ✅ Success Criteria

### All 5 Holy Grail Steps Complete

- [x] **Voice input captured** (Vapi receives call)
- [x] **AI processed intent** (Assistant understands booking request)
- [x] **Database wrote appointment** (Advisory locks working)
- [ ] **SMS sent via Twilio** ← **TEST THIS**
- [ ] **Google Calendar synced** ← **TEST THIS**

### Verification Checklist

- [ ] Backend server restarted with new code
- [ ] Database verification test passed (5/5 tests)
- [ ] Test booking triggered (via call or API)
- [ ] SMS received on phone
- [ ] Calendar event visible in Google Calendar UI
- [ ] Backend logs show token refresh (if needed)
- [ ] Database shows `connected = true` for both integrations

---

## 🐛 Troubleshooting

### SMS Still Fails

**Symptom:** `"smsStatus": "failed_but_booked"`

**Possible Causes:**
1. Twilio account balance is $0
2. Phone number not verified in Twilio
3. Twilio Auth Token invalid

**Debug Steps:**
```bash
# Check Twilio credentials can be retrieved
curl http://localhost:3001/api/integrations/twilio/health

# Expected: { "healthy": true }
```

### Calendar Token Refresh Fails

**Symptom:** Log shows `"❌ Failed to refresh Google token"`

**Possible Causes:**
1. `GOOGLE_CLIENT_ID` not set in environment
2. `GOOGLE_CLIENT_SECRET` not set in environment
3. Refresh token invalid (user needs to reconnect)

**Debug Steps:**
```bash
# Check environment variables
echo "CLIENT_ID: $GOOGLE_CLIENT_ID"
echo "CLIENT_SECRET: $GOOGLE_CLIENT_SECRET"

# If missing, add to .env file
```

### Backend Won't Start

**Symptom:** Port 3001 already in use

**Fix:**
```bash
# Kill all processes on port 3001
lsof -ti:3001 | xargs kill -9

# Restart backend
npm run dev
```

---

## 📊 Expected Timeline

| Step | Duration | Status |
|------|----------|--------|
| Restart backend | 30 seconds | ⏳ |
| Run DB verification | 10 seconds | ⏳ |
| Trigger test booking | 2 minutes | ⏳ |
| Verify SMS delivery | 30 seconds | ⏳ |
| Verify calendar sync | 30 seconds | ⏳ |
| **Total** | **~5 minutes** | ⏳ |

---

## 🎉 Success Output

When everything works, you should see:

**Backend Logs:**
```
[INFO] VapiTools: Tool invoked: bookClinicAppointment
[INFO] IntegrationDecryptor: 🔄 Google token refreshed successfully
[INFO] VapiTools: ✅ Booking succeeded (appointmentId=...)
[INFO] VapiTools: 📱 SMS Bridge Result { smsStatus: 'sent', messageSid: 'SM...' }
```

**Phone:**
```
📅 Appointment Confirmed!

Voxanne Demo Clinic
consultation
When: Feb 5, 2026, 3:00 PM

Reply STOP to unsubscribe
```

**Google Calendar:**
- Event created: "consultation with Austyn Test"
- Date: February 5, 2026 at 3:00 PM
- Description: Booked via AI

---

**Ready to start testing? Begin with Step 1: Restart Backend Server**
