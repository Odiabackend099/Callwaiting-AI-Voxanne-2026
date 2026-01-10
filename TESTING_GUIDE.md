# Testing Guide: SMS Verification & Status Callbacks

**Date:** 2026-01-10  
**Purpose:** Step-by-step testing of implemented features

---

## Prerequisites

1. ✅ Backend server running: `cd backend && npm run dev`
2. ✅ Twilio credentials in `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
3. ✅ Environment variable: `BACKEND_URL=http://localhost:3001` (for status callbacks)

---

## Step 1: Verify Phone Number (Manual)

### Current Status
Your phone number `+18777804236` is **NOT verified** yet.

### Verification Steps

1. **Open Twilio Console:**
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
   - Or run: `npx ts-node backend/scripts/verify-phone-number.ts +18777804236`

2. **Add Verification:**
   - Click "Add a new Caller ID"
   - Enter phone: `+18777804236`
   - Enter friendly name: "Test Number" (optional)
   - Click "Verify"

3. **Complete Verification:**
   - Twilio will **CALL** you at `+18777804236`
   - Answer the call
   - Enter the verification code when prompted
   - Number will be verified automatically

4. **Verify Completion:**
   ```bash
   cd backend
   npx ts-node scripts/check-verification-status.ts +18777804236
   ```
   Expected output: `✅ VERIFIED`

---

## Step 2: Test SMS Sending with Status Callbacks

### 2.1: Ensure Backend is Running

```bash
cd backend
npm run dev
```

Verify server is running and webhook endpoint is accessible:
- Server should show: `Server running on http://localhost:3001`
- Check logs for: No errors during startup

### 2.2: Verify Environment Variables

```bash
cd backend
grep -E "BACKEND_URL|TWILIO" .env
```

Should show:
```
BACKEND_URL=http://localhost:3001
TWILIO_ACCOUNT_SID=AC0a90c92cbd17b575fde9ec6e817b71af
TWILIO_AUTH_TOKEN=11c1e5e1069e38f99a2f8c35b8baaef8
TWILIO_PHONE_NUMBER=+19523338443
```

**⚠️ IMPORTANT:** If `BACKEND_URL` is not set, status callbacks won't work!

### 2.3: Run SMS Test Suite

```bash
cd backend
npx ts-node scripts/test-twilio-sms.ts +18777804236
```

**Expected Output:**
```
✅ Account Verification
✅ Phone Number Validation
✅ Test phone +18777804236 is verified  ← Should show this!
✅ Send Test SMS
✅ Send Hot Lead SMS

Total: 4 passed, 0 failed
```

**If verification warning appears:**
- Go back to Step 1 and complete verification
- Then re-run this test

---

## Step 3: Monitor Status Callback Webhook

### 3.1: Watch Backend Logs

In the terminal where `npm run dev` is running, you should see logs like:

```
[SMSStatusWebhook] Status update received {
  messageSid: 'SM...',
  status: 'queued',
  to: '+18777804236',
  from: '+19523338443'
}

[SMSStatusWebhook] SMS sent to carrier {
  messageSid: 'SM...',
  to: '+18777804236'
}

[SMSStatusWebhook] SMS delivered successfully {
  messageSid: 'SM...',
  to: '+18777804236'
}
```

### 3.2: Check Webhook Endpoint Directly

Test if webhook is accessible (should return error since it's GET, but confirms endpoint exists):

```bash
curl http://localhost:3001/api/webhooks/sms-status
```

**Expected:** Error 404 or 405 (Method Not Allowed) - confirms endpoint exists

### 3.3: Simulate Webhook Call (Manual Test)

```bash
curl -X POST http://localhost:3001/api/webhooks/sms-status \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SMtest123&MessageStatus=sent&To=%2B18777804236&From=%2B19523338443"
```

**Expected Response:**
```json
{"received": true}
```

**Check Backend Logs:** Should show status update logged

---

## Step 4: Verify Delivery Tracking

### 4.1: Check Database (if table exists)

The webhook attempts to store status in `sms_message_tracking` table. If the table doesn't exist yet, it will log a warning but continue working.

**To verify tracking works:**
1. Check backend logs for database errors
2. If table exists, query it:
   ```sql
   SELECT * FROM sms_message_tracking 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### 4.2: Monitor Status Progression

After sending SMS, watch for status updates in this order:
1. `queued` - Message queued by Twilio
2. `sending` - Being sent to carrier
3. `sent` - Sent to carrier
4. `delivered` - Delivered to device (final status)
5. `failed` or `undelivered` - Delivery failed (if errors occur)

**Timeline:** Status updates should arrive within 1-5 seconds of each other.

---

## Step 5: Verify SMS Received on Phone

### 5.1: Check Your Phone

After running the test suite, check phone `+18777804236` for:
1. **Test SMS:** "🔥 Test SMS from Voxanne AI Receptionist..."
2. **Hot Lead SMS:** "🔥 HOT LEAD ALERT!..." with lead details

### 5.2: Verify Delivery Time

- SMS should arrive within 5-10 seconds of "sent" status
- If not received but status shows "delivered", check:
  - Phone is on and has signal
  - Number is correct
  - Carrier blocking (some carriers block trial account SMS)

---

## Troubleshooting

### Issue: "Test phone +18777804236 is NOT verified"

**Solution:**
1. Complete manual verification (Step 1)
2. Re-run: `npx ts-node scripts/check-verification-status.ts +18777804236`
3. Verify it shows `✅ VERIFIED`

### Issue: No status callback logs in backend

**Check:**
1. `BACKEND_URL` is set in `.env`
2. Backend server is running
3. Webhook endpoint is accessible: `curl http://localhost:3001/api/webhooks/sms-status`

**Fix:**
- Set `BACKEND_URL=http://localhost:3001` in `.env`
- Restart backend server
- For production, use public URL (ngrok or deployed URL)

### Issue: SMS shows "delivered" but not received on phone

**Possible Causes:**
1. **Carrier filtering** - Some carriers block trial account SMS
2. **DND enabled** - Do Not Disturb or blocking enabled
3. **Phone off/roaming** - Phone not receiving messages

**Check:**
- Status callback logs for error codes
- Twilio Console → Messaging → Logs for details
- Try sending to different verified number

### Issue: Database tracking errors

**If `sms_message_tracking` table doesn't exist:**
- This is **OK** - webhook still works
- Status updates are logged to console
- Table creation is optional (for production, create it)

**To create table (optional):**
```sql
CREATE TABLE sms_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  message_sid TEXT UNIQUE NOT NULL,
  to_phone TEXT NOT NULL,
  from_phone TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Success Criteria

✅ **Step 1 Complete When:**
- Phone number shows as verified: `✅ VERIFIED`

✅ **Step 2 Complete When:**
- Test suite shows all 4 tests passing
- No verification warnings

✅ **Step 3 Complete When:**
- Backend logs show status callback updates
- Webhook endpoint responds correctly

✅ **Step 4 Complete When:**
- Status progression visible in logs (queued → sent → delivered)
- No database errors (or graceful handling if table missing)

✅ **Step 5 Complete When:**
- SMS received on phone `+18777804236`
- Message content is correct

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Phone verification working
2. ✅ SMS sending working
3. ✅ Status callbacks receiving updates
4. ✅ SMS delivery confirmed

**Proceed to:** Phase 3 - Google Calendar OAuth Integration

---

## Quick Test Checklist

- [ ] Phone number verified: `npx ts-node scripts/check-verification-status.ts +18777804236`
- [ ] Backend running: `npm run dev` (in backend directory)
- [ ] BACKEND_URL set in `.env`
- [ ] Test suite passes: `npx ts-node scripts/test-twilio-sms.ts +18777804236`
- [ ] Status callbacks logged in backend console
- [ ] SMS received on phone
- [ ] Status progression: queued → sent → delivered

**All checked?** ✅ Ready for Phase 3!
