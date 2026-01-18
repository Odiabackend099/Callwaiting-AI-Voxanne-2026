# 🔍 BOOKING FLOW DIAGNOSTIC - VOXANNE

## Issue Summary
Sarah collects booking info correctly but fails with "It seems there was an issue with confirming your appointment"

## Root Cause Hypothesis
The booking request is being routed to the wrong endpoint or the response format is incorrect.

---

## 📋 Quick Diagnosis Checklist

### Step 1: Verify Vapi Assistant Configuration
**Location:** https://dashboard.vapi.ai

1. Open your inbound assistant (Sarah)
2. Go to **"Tools"** section
3. Find **"bookClinicAppointment"** tool
4. Check the **webhook URL**:
   - ✅ Should be: `https://your-ngrok-url/api/vapi/tools/bookClinicAppointment`
   - ❌ NOT: `https://your-ngrok-url/api/vapi/webhook`
   - ❌ NOT: `https://your-ngrok-url/api/vapi/tools`

**Your Current Config:**
- ngrok URL: `https://sobriquetical-zofia-abysmally.ngrok-free.dev`
- org_id (in metadata): `46cf2995-2bee-44e3-838b-24151486fe4e`

---

### Step 2: Verify Backend is Running
```bash
# Check if backend is on
curl -s https://sobriquetical-zofia-abysmally.ngrok-free.dev/health | jq .

# Expected response:
# { "status": "ok" }
```

---

### Step 3: Test the Booking Endpoint Directly
```bash
curl -X POST "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "metadata": {
        "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
      }
    },
    "message": {
      "toolCall": {
        "function": {
          "name": "bookClinicAppointment",
          "arguments": {
            "appointmentDate": "2026-01-20",
            "appointmentTime": "18:00",
            "patientEmail": "test@example.com",
            "patientName": "Test Patient",
            "serviceType": "consultation"
          }
        }
      }
    }
  }'
```

**Expected Response (HTTP 200):**
```json
{
  "toolResult": {
    "content": "{\"success\":true,...}"
  },
  "speech": "Perfect! I've scheduled your appointment..."
}
```

---

### Step 4: Check Backend Logs
```bash
# If running locally
tail -f backend/vapi-debug.log

# Or check for errors
grep -i "error\|failed\|CONTACT_CREATION" backend/vapi-debug.log | tail -20
```

---

## 🔧 Known Issues to Check

### Issue #1: Wrong Endpoint Registered
- **File:** [backend/src/routes/vapi-tools-routes.ts:702](../../backend/src/routes/vapi-tools-routes.ts#L702)
- **Fix:** Ensure Vapi dashboard points to `/api/vapi/tools/bookClinicAppointment`

### Issue #2: Missing org_id in Customer Metadata
- **File:** [backend/src/routes/vapi-tools-routes.ts:720-723](../../backend/src/routes/vapi-tools-routes.ts#L720-L723)
- **Expected:** `customer.metadata.org_id = "46cf2995-2bee-44e3-838b-24151486fe4e"`
- **Error Message:** "Missing required fields: org_id (in metadata)"

### Issue #3: Missing Contact Creation
- **File:** [backend/src/routes/vapi-tools-routes.ts:858-915](../../backend/src/routes/vapi-tools-routes.ts#L858-L915)
- **Fix:** Ensure database allows contact creation

### Issue #4: Google Calendar Not Configured (Non-Fatal)
- **File:** [backend/src/routes/vapi-tools-routes.ts:1020-1025](../../backend/src/routes/vapi-tools-routes.ts#L1020-L1025)
- **Note:** Calendar sync is optional - booking should still succeed

---

## ✅ Correct Response Format (CRITICAL)

Vapi requires **exact** response format:

```typescript
{
  toolResult: {
    content: string  // ⚠️ MUST BE A STRING (not object)
  },
  speech: string    // ⚠️ MUST BE PRESENT
}
```

**WRONG:**
```json
{
  "toolResult": {
    "content": { "success": true }  // ❌ Object, not string
  }
}
```

**CORRECT:**
```json
{
  "toolResult": {
    "content": "{\"success\":true}"  // ✅ String
  },
  "speech": "Perfect! I've scheduled your appointment"  // ✅ Present
}
```

---

## 🚀 Debugging Commands

### See what Vapi is sending
```bash
# Backend writes requests to vapi-debug.log
tail -f backend/vapi-debug.log
```

### Check if endpoint is accessible
```bash
curl -I https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment
# Should return: HTTP/2 405 (no body, but endpoint exists)
```

### Test with simplified payload
```bash
curl -X POST "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"metadata": {"org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"}},
    "message": {"toolCall": {"function": {"name": "bookClinicAppointment", "arguments": {"appointmentDate": "2026-01-20", "appointmentTime": "18:00", "patientEmail": "sam@test.com", "patientName": "Sam"}}}}
  }' -v
```

---

## 📞 Next Steps

1. **Check Vapi Dashboard** - Verify webhook URL
2. **Test Endpoint** - Run curl command above
3. **Check Logs** - Look for error messages
4. **Call Sarah Again** - After fixing, test end-to-end
5. **Report Results** - Share curl output and logs

---

## Contact IDs

| Type | ID | Note |
|------|----|----|
| **Org ID** | `46cf2995-2bee-44e3-838b-24151486fe4e` | Your clinic |
| **System Contact** | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | (Old - not used) |

---

**Last Updated:** Jan 18, 2026
**Status:** 🔴 Booking fails - diagnosing

