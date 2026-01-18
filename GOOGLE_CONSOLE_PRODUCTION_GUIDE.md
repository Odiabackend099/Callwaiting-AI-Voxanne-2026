# 🔐 Google Console: Production Mode 3-Step Guide

## Why This Matters

Your Google Cloud Project is currently in **Testing Mode**:
- ✗ OAuth tokens expire **every 7 days**
- ✗ After 7 days, the calendar sync stops working silently
- ✓ Users get: "Booking confirmed" but calendar stays empty

Switching to **Production Mode**:
- ✅ OAuth tokens last **1 year**
- ✅ No more surprise failures
- ✅ Guaranteed uptime for all users

---

## 3-Step Switch to Production

### Step 1: Open Google Cloud Console

1. Visit: https://console.cloud.google.com
2. In the top-left, select your **CallWaiting AI** project
3. You should see: `Project ID: [your-project]`

If you don't see your project:
- Click the dropdown next to "Google Cloud"
- Find and select the project

---

### Step 2: Navigate to OAuth Consent Screen

1. In the left sidebar, click: **APIs & Services**
2. Click: **OAuth consent screen**
3. You'll see the current status at the top

---

### Step 3: Switch from Testing to Production

**Current State:**
- You see a section labeled: **"User Type: Internal"** or **"User Type: Testing"**
- Status shows: 🟠 "Testing" or 🟡 "Internal"

**What to Do:**

#### Option A: If you see an "EDIT APP" button
1. Click **"EDIT APP"**
2. Scroll down to **"User Type"** section
3. Select: **"External"** (for public use)
4. Click **"SAVE AND CONTINUE"**
5. The app is now in **Production Mode**

#### Option B: If you're on the Consent Screen Editor
1. Look for **"Publishing Status"** section
2. Change from **"In testing"** → **"In production"**
3. Confirm the change

#### Option C: Complete Production Setup (Recommended)
1. Add required scopes (if not already present):
   - Go to: **Scopes**
   - Ensure this scope exists: `https://www.googleapis.com/auth/calendar.events`
   - If not, click **"ADD OR REMOVE SCOPES"** and search for "calendar.events"

2. Add test users (optional, for pre-production):
   - Go to: **Test users**
   - Click **"ADD USERS"**
   - Add your clinic admin email addresses

3. Publish the app:
   - Go back to **OAuth consent screen** main page
   - Click **"PUBLISH APP"** if available
   - Status should now show: 🟢 **"In production"**

---

## ✅ Verification: Confirm Production Mode

After switching, verify:

1. **Check OAuth Consent Screen**
   - Status should show: 🟢 **"In production"**
   - User type should show: **"External"**

2. **Check Credentials**
   - Go to: **APIs & Services → Credentials**
   - Find your OAuth 2.0 Client ID
   - Click it and verify:
     - ✅ Authorized redirect URIs include your callback URL
     - ✅ Application type is: "Web application"

3. **Check Scopes**
   - Go to: **Enabled APIs & services**
   - Find: **"Google Calendar API"**
   - Click it and verify status shows: 🟢 **"Enabled"**

4. **Run Booking Test**
   ```bash
   # After confirming Production mode, test:
   curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
     -H "Content-Type: application/json" \
     -d '{
       "appointmentDate":"2026-03-01",
       "appointmentTime":"10:00",
       "patientName":"Production Test",
       "patientEmail":"test@production.com",
       "patientPhone":"+441234567890",
       "serviceType":"Production Verification",
       "duration":30,
       "customer":{"metadata":{"org_id":"46cf2995-2bee-44e3-838b-24151486fe4e"}}
     }'
   ```

   Expected: `"success": true` with calendar event created

---

## 🚨 Common Issues & Fixes

### Issue: "Still in Testing Mode after clicking PUBLISH"
- **Cause**: Need to add scopes first
- **Fix**: Go to **Scopes** tab, add `calendar.events`, then publish

### Issue: "OAuth consent screen not found"
- **Cause**: Wrong project selected
- **Fix**: Verify correct project in top dropdown

### Issue: "Can't find EDIT APP button"
- **Cause**: Already in Production mode
- **Fix**: Good! You're done. Just verify the status shows 🟢

### Issue: "Still getting 'Token expired' errors"
- **Cause**: Old tokens cached before production switch
- **Fix**: 
  1. Go to: **tenant_integrations** table in Supabase
  2. Delete the old google_access_token for the clinic
  3. Clinic must re-authorize: "Connect Google Calendar" again
  4. New tokens will have 1-year expiry

---

## 🎯 Timeline

| Stage | Time | Action |
|-------|------|--------|
| **Before Switch** | Now | Tokens expire every 7 days |
| **Switch to Production** | 5 min | Follow steps above |
| **Immediate After** | 5-10 min | Clinic re-authorizes Google |
| **After Re-Auth** | ✅ Forever | Tokens last 1 year |

---

## 📊 Status Check

Once complete, you should see:

```
Google Cloud Console:
├─ Project: CallWaiting AI
├─ OAuth Consent Screen: 🟢 In production
├─ Google Calendar API: 🟢 Enabled
└─ Client ID: [Your OAuth 2.0 ID]

Booking System:
├─ Database: ✅ contact_id nullable
├─ Backend: ✅ Token refresh enabled
├─ Google Sync: ✅ Verified handshake
└─ Overall: 🟢 PRODUCTION READY
```

---

## 🆘 Still Having Issues?

1. **Check logs**: 
   ```bash
   tail -100 /tmp/backend.log | grep -E "ERROR|OAuth|token"
   ```

2. **Verify clinic has connected Google**:
   - Check `tenant_integrations` table in Supabase
   - Ensure clinic's `org_id` has a row with `provider: 'google_calendar'`

3. **Test token refresh**:
   - Any booking attempt will trigger token refresh
   - Watch logs for: "Access token expired, refreshing"

4. **Manual token reset**:
   - Delete old tokens from Supabase
   - Clinic clicks "Connect Google Calendar" again
   - New tokens have 1-year expiry

---

## 🎉 You're Done!

Once these steps are complete:
- ✅ Your system is PRODUCTION READY
- ✅ Tokens will last 1 year (not 7 days)
- ✅ Clinic bookings will never fail due to token expiry
- ✅ Appointments sync to Google Calendar automatically

**Result**: The "Empty Calendar" issue is SOLVED. 🚀
