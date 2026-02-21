# Phone Settings Verification - Complete Testing Instructions

**Date:** 2026-02-15
**Tester:** AR Developer (with Browser MCP)
**Objective:** Verify the Phone Settings page works correctly for international caller ID verification

---

## Testing Credentials

**Login URL:** http://localhost:3000 (or production URL if deployed)

**Test Account:**
- Email: `test@demo.com`
- Password: `demo123`
- Organization: Should be in "managed" telephony mode

---

## What Was Changed

We fixed 7 critical issues with the Phone Settings page:

### Backend Fixes (verified-caller-id.ts)
1. ✅ Fixed credential resolution for managed orgs (`getEffectiveTwilioCredentials`)
2. ✅ Added automatic Geo Permissions fix for Error 13227 (international calling)
3. ✅ Rewrote confirm endpoint to check Twilio API (not broken code verification)

### Frontend Fixes (phone-settings/page.tsx)
4. ✅ Auto-detect country code from phone number prefix (not hardcoded 'US')
5. ✅ Updated verification UX to match how Twilio actually works (phone-based, not web form)
6. ✅ Improved copy following AI industry standards (ChatGPT/Claude/Gemini UX patterns)

### Cleanup
7. ✅ Deleted old `/dashboard/telephony/` page (10 files)

---

## Test Scenario 1: UI/UX Verification (Visual Check)

**Purpose:** Verify the new user-friendly copy is clear and easy to understand

### Steps:

1. **Login to the application**
   - Navigate to login page
   - Enter email: `test@demo.com`
   - Enter password: `demo123`
   - Click "Sign In"

2. **Navigate to Phone Settings**
   - URL: `/dashboard/phone-settings`
   - Look for "Phone Settings" in the sidebar/navigation
   - Click to open the page

3. **Visual Check - Step 1 (Input Screen)**

   **Expected UI Elements:**
   - ✅ Clear headline explaining what this does:
     > "When your AI calls customers, they'll see this number on their caller ID."

   - ✅ "Why this matters" box with 3 benefits:
     - Customers recognize YOUR number (not "Unknown")
     - Higher answer rates (people trust known numbers)
     - Professional appearance

   - ✅ "How it works (takes 2 minutes)" section with 3 numbered steps:
     - ① Enter your business phone number below
     - ② You'll get a verification call in ~30 seconds
     - ③ Click "I'm Done" and you're all set!

   - ✅ Input field labeled "Your Business Phone Number"
   - ✅ Helper text: "Must include country code: +1 (US), +234 (Nigeria), +44 (UK), +91 (India), etc."
   - ✅ Button says "Start Verification" (NOT "Send Verification Call")

   **Screenshot Required:** Yes - take screenshot of Step 1 input screen

4. **Enter Test Phone Number**
   - Enter: `+2348141995397` (Nigerian number for testing)
   - Verify the input accepts the number
   - Click "Start Verification"

5. **Visual Check - Step 2 (Waiting Screen)**

   **Expected UI Elements:**
   - ✅ Green success banner:
     > "✓ Verification call sent!"
     > "Calling: +2348141995397"

   - ✅ Timeline notice:
     > "📞 Your phone will ring in ~30 seconds"

   - ✅ "What to do next:" with 4 numbered steps:
     - ① Answer the call (it's from our verification system)
     - ② You'll hear a 6-digit code
       - Example: "9-0-2-0-1-1"
     - ③ Enter the code on your phone's keypad
       - (Not on this screen - on your actual phone)
     - ④ Once you've entered it, click the button below

   - ✅ Troubleshooting section:
     > "⏱️ Call not received after 2 minutes?"
     > [Resend Verification Call] button

   - ✅ Two buttons: [Cancel] and [I'm Done - Check Status]

   **Screenshot Required:** Yes - take screenshot of Step 2 waiting screen

6. **Visual Check - No Jargon**
   - ✅ The word "Twilio" should appear ONLY in error messages (if any)
   - ✅ All instructions use plain language ("our verification system" not "Twilio")

---

## Test Scenario 2: Functional Testing (Backend Verification)

**Purpose:** Verify the backend correctly handles international numbers

### Steps:

1. **Monitor Network Requests**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Filter for XHR/Fetch requests

2. **Submit Verification Request**
   - Enter phone number: `+2348141995397`
   - Click "Start Verification"
   - Wait for response

3. **Verify Backend Request**

   **Expected Request:**
   - URL: `/api/verified-caller-id/verify`
   - Method: `POST`
   - Body should include:
     ```json
     {
       "phoneNumber": "+2348141995397",
       "countryCode": "NG"
     }
     ```

   **Key Verification:**
   - ✅ `countryCode` should be "NG" (NOT "US")
   - This proves auto-detection is working

4. **Check Response**

   **Success Response (200):**
   ```json
   {
     "success": true,
     "verified": false,
     "message": "Verification call initiated! You will receive an automated call...",
     "phoneNumber": "+2348141995397",
     "validationSid": "PV...",
     "status": "pending"
   }
   ```

   **Possible Error Response (400) - Geo Permissions:**
   ```json
   {
     "error": "International calling permissions are being configured. Please try again in 1 minute.",
     "code": 13227
   }
   ```

   **If you get the Geo Permissions error:**
   - This is expected on first attempt for some subaccounts
   - Wait 1 minute
   - Click "Resend Verification Call"
   - Should succeed on second attempt (auto-fix kicks in)

5. **Verify Backend Logs (if accessible)**

   Open terminal and check backend logs:
   ```bash
   # If backend is running locally
   tail -f backend/logs/app.log | grep "verified-caller-id"
   ```

   **Expected Log Entries:**
   - "Initiating caller ID verification" with orgId and phoneNumber
   - "Outgoing Caller ID created" with validation SID
   - NO errors about "credentials not configured" (proves Fix 1 worked)

---

## Test Scenario 3: Confirm Endpoint Testing

**Purpose:** Verify the confirm endpoint checks Twilio API correctly

### Steps:

1. **Wait on Step 2 Screen**
   - Do NOT actually answer a phone call (we're testing the UI flow)
   - Just wait 10 seconds

2. **Click "I'm Done - Check Status"**
   - This triggers the confirm endpoint

3. **Check Network Request**

   **Expected Request:**
   - URL: `/api/verified-caller-id/confirm`
   - Method: `POST`
   - Body:
     ```json
     {
       "phoneNumber": "+2348141995397"
     }
     ```

   **Key Verification:**
   - ✅ Body should NOT include a "code" field
   - This proves the old broken code-check was removed

4. **Expected Response (since we didn't actually verify):**
   ```json
   {
     "error": "Verification not yet complete. Please answer the call and enter the code on your phone keypad, then try again.",
     "retryable": true
   }
   ```

   **UI Behavior:**
   - Error message should appear in red box
   - Should stay on Step 2 (waiting screen)
   - User can click "Resend Verification Call" or try "I'm Done - Check Status" again

---

## Test Scenario 4: Error Handling

**Purpose:** Verify all error scenarios display user-friendly messages

### Test Cases:

#### 4.1 Missing Phone Number
- Leave input blank
- Click "Start Verification"
- **Expected:** Button should be disabled (gray, unclickable)

#### 4.2 Invalid Phone Format
- Enter: `1234567890` (no + prefix)
- Click "Start Verification"
- **Expected Error:** "Phone number must be in E.164 format (e.g., +15551234567)"

#### 4.3 Non-Existent Country Code
- Enter: `+999123456789` (fake country code)
- Click "Start Verification"
- **Expected:** Should fallback to countryCode: "US" (default)
- Check network request to verify

---

## Test Scenario 5: Country Code Detection

**Purpose:** Verify auto-detection works for multiple countries

### Test Phone Numbers:

| Phone Number | Expected Country Code | Notes |
|--------------|----------------------|-------|
| `+2348141995397` | `NG` | Nigeria |
| `+14155551234` | `US` | United States |
| `+442071234567` | `GB` | United Kingdom |
| `+905321234567` | `TR` | Turkey |
| `+919876543210` | `IN` | India |
| `+61412345678` | `AU` | Australia |

### Steps:

1. For each phone number above:
   - Enter the number
   - Click "Start Verification"
   - Check Network tab → Request body → `countryCode` field
   - Verify it matches expected value

2. **If ANY phone number returns countryCode: "US" when it shouldn't:**
   - Report this as a bug
   - Include the phone number and what country code it should be

---

## Test Scenario 6: Old Telephony Page Deleted

**Purpose:** Verify the old duplicate page is gone

### Steps:

1. **Try to access old URL directly:**
   - Navigate to: `/dashboard/telephony`
   - **Expected:** Should redirect to `/dashboard/phone-settings` (301 redirect)

2. **Check for broken links:**
   - Search the entire dashboard for any links to `/dashboard/telephony`
   - **Expected:** Should find NONE (all updated to `/dashboard/phone-settings`)

3. **Verify no "AI Forwarding" labels:**
   - Search the page for text "AI Forwarding"
   - **Expected:** Should NOT appear anywhere in Phone Settings
   - (It was renamed to "AI Forwarding" in old code, now removed)

---

## Test Scenario 7: Regression Testing (Make Sure We Didn't Break Anything)

**Purpose:** Verify existing features still work

### 7.1 Inbound Phone Number Display
- On Phone Settings page, check "Your AI Phone Number" section
- **Expected:** Should show existing managed number (if any)
- Should show "Active" status
- Should show carrier forwarding instructions

### 7.2 Buy Number Modal
- Click "Buy New Number" button (if visible)
- **Expected:** Modal should open
- Should show number purchasing flow
- Should NOT reference `/dashboard/telephony` in any text

### 7.3 Navigation
- Check left sidebar
- **Expected:** Should see "Phone Settings" link
- Should NOT see "Telephony" or "AI Forwarding" as separate items

---

## Required Deliverables

Please provide the following in your report:

### 1. Screenshots (6 required)

- ✅ **Screenshot 1:** Step 1 input screen (showing new copy)
- ✅ **Screenshot 2:** Step 2 waiting screen (showing numbered instructions)
- ✅ **Screenshot 3:** Network tab showing `/verify` request body with `countryCode: "NG"`
- ✅ **Screenshot 4:** Network tab showing `/confirm` request body (no "code" field)
- ✅ **Screenshot 5:** Error message display (any error scenario)
- ✅ **Screenshot 6:** Redirect from `/dashboard/telephony` to `/dashboard/phone-settings`

### 2. Pass/Fail Checklist

Copy this checklist and mark each item:

```
UI/UX VERIFICATION:
[ ] Clear value proposition visible ("When your AI calls customers...")
[ ] "Why this matters" box with 3 benefits shown
[ ] "How it works" with 3 numbered steps shown
[ ] Timeline shown ("takes 2 minutes", "~30 seconds")
[ ] Button says "Start Verification" (not "Send Verification Call")
[ ] Step 2 shows 4 numbered instructions
[ ] Example code shown: "9-0-2-0-1-1"
[ ] Clarification shown: "(Not on this screen - on your actual phone)"
[ ] Resend button shown: "Resend Verification Call"
[ ] Button says "I'm Done - Check Status" (not "I've Entered the Code")
[ ] No jargon: "Twilio" replaced with "our verification system"

FUNCTIONAL VERIFICATION:
[ ] Nigerian number (+234...) sends countryCode: "NG" (not "US")
[ ] US number (+1...) sends countryCode: "US"
[ ] UK number (+44...) sends countryCode: "GB"
[ ] Confirm endpoint does NOT send "code" parameter
[ ] Error messages are user-friendly (no stack traces)
[ ] Invalid phone format shows clear error message
[ ] Missing phone number disables button

CLEANUP VERIFICATION:
[ ] /dashboard/telephony redirects to /dashboard/phone-settings
[ ] No "AI Forwarding" labels visible
[ ] No broken links to old telephony page
[ ] Existing features still work (inbound number display, etc.)

BACKEND VERIFICATION (if logs accessible):
[ ] No "credentials not configured" errors
[ ] Geo Permissions auto-fix triggered (if Error 13227 occurs)
[ ] Verification call initiated successfully
[ ] Twilio API responds with validation SID
```

### 3. Bug Report Format (if issues found)

If you find any bugs, report using this format:

```markdown
## Bug Report

**Bug ID:** [Sequential number]
**Severity:** [Critical / High / Medium / Low]
**Component:** [Backend / Frontend / UI]
**Test Scenario:** [Which scenario above]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**


**Actual Behavior:**


**Screenshots/Logs:**
[Attach here]

**Browser Console Errors:**
[Copy any JavaScript errors]

**Network Response:**
[Copy full request/response if relevant]
```

---

## Success Criteria

The implementation is considered **PASS** if:

1. ✅ All 11 UI/UX checklist items pass
2. ✅ All 7 functional verification items pass
3. ✅ All 4 cleanup verification items pass
4. ✅ At least 3 country codes auto-detect correctly
5. ✅ Zero critical bugs found
6. ✅ Zero high-severity bugs found
7. ✅ Medium/low bugs are acceptable if <3 total

---

## Troubleshooting Guide

### Issue: Can't login with test@demo.com
- **Solution:** Check if account exists in database
- **Fallback:** Create new test account via signup flow

### Issue: Phone Settings page not loading
- **Check:** Browser console for JavaScript errors
- **Check:** Network tab for failed API requests
- **Report:** Backend logs if available

### Issue: "Credentials not configured" error
- **Meaning:** Organization is not in "managed" mode or no subaccount exists
- **Check:** Database `organizations` table → `telephony_mode` should be "managed"
- **Check:** Database `twilio_subaccounts` table → should have active subaccount for org

### Issue: Network request shows 404
- **Check:** Backend server is running
- **Check:** Routes are properly mounted
- **Verify:** `/api/verified-caller-id/verify` endpoint exists

### Issue: Geo Permissions error persists after retry
- **Expected:** First attempt may fail, second should succeed
- **If still fails:** Report as bug - auto-fix may not be working

---

## Timeline

**Estimated Testing Time:** 45-60 minutes
**Deadline for Report:** [To be specified]

---

## Contact

If you encounter any blocking issues or need clarification:
1. Document the issue with screenshots
2. Note the exact error message
3. Report back with details

**DO NOT** attempt to fix bugs - just document them. The development team will handle fixes.

---

## Final Notes

This is a **critical user flow** for international customers. Thorough testing is essential.

Pay special attention to:
- Country code auto-detection (Fix 4)
- User-friendly error messages
- Clear instructions at every step
- No technical jargon visible to users

Good luck with testing! 🚀
