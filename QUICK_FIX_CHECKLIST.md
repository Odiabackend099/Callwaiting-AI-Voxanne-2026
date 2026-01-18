# 🚀 QUICK FIX CHECKLIST - 15 Minutes to Working Booking

## The Problem
Sarah collects info but fails: "It seems there was an issue with confirming your appointment"

## The Solution
Your backend is working! The issue is likely in Vapi dashboard configuration.

---

## ✅ Checklist (Do This Now)

### [ ] 1. Verify Webhook URL in Vapi (5 min)
```
1. Open: https://dashboard.vapi.ai
2. Click: Assistants
3. Find: "Sarah" (inbound assistant)
4. Click: Edit / Tools
5. Find: "bookClinicAppointment" tool
6. Check URL is EXACTLY:
   https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment
7. NOT localhost or wrong domain
8. Click: Save
```

### [ ] 2. Verify Customer Metadata (3 min)
```
In Vapi assistant settings (same place):
1. Find: "Metadata" or "Custom Metadata" section
2. Ensure org_id is:
   46cf2995-2bee-44e3-838b-24151486fe4e
3. Click: Save
```

### [ ] 3. Check Backend is Running (2 min)
```bash
# Should return 200 OK
curl -s https://sobriquetical-zofia-abysmally.ngrok-free.dev/health
```

### [ ] 4. Test Booking Endpoint (1 min)
```bash
bash test-booking-endpoint.sh
# Should show: "success":true with appointmentId
```

### [ ] 5. Make Test Call to Sarah (5 min)
```
1. Call your clinic phone number
2. Go through booking flow with Sarah:
   - "My name is [Name]"
   - "My email is [email@example.com]"
   - "I want to book [service]"
   - "Next Monday at 2 PM"
3. Wait for confirmation
```

---

## Expected Outcome

✅ Sarah says: "Perfect! I've scheduled your appointment for [date] at [time]..."

✅ You receive confirmation email

✅ Appointment appears in Supabase `appointments` table

---

## If Still Not Working

### Check Vapi Dashboard
1. Go to: https://dashboard.vapi.ai → Call Logs
2. Find your recent call
3. Look for "Tool Call Details" section
4. Is there an error message?

### Check Backend Logs
```bash
tail -f backend/vapi-debug.log
# Look for: ERROR, FAILED, CONTACT_CREATION
```

### Run Detailed Diagnostic
```bash
bash run-booking-diagnostic.sh
```

---

## Key Files

| File | Purpose |
|------|---------|
| `BOOKING_DIAGNOSTIC.md` | Full debugging guide |
| `BOOKING_FIX_REPORT.md` | Detailed test results |
| `run-booking-diagnostic.sh` | Automated tests |
| `test-booking-endpoint.sh` | Direct endpoint test |
| `QUICK_FIX_CHECKLIST.md` | This file |

---

## Support Info

**Backend Endpoint:** `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment`

**Org ID:** `46cf2995-2bee-44e3-838b-24151486fe4e`

**Test Appointment Created:** 2026-01-20 at 18:00

---

## Timeline

- ✅ 0-5 min: Verify Vapi configuration
- ✅ 5-8 min: Verify metadata
- ✅ 8-10 min: Test backend
- ✅ 10-15 min: Make test call

**Expected Fix Time: 15 minutes**

---

**Last Updated:** Jan 18, 2026 | Status: 🟢 Ready to Test
