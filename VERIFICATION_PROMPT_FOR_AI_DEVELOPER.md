# 🔍 Frontend Verification Prompt for AI Developer (Browser MCP)

**Date:** 2026-02-11
**Organization:** voxanne@demo.com
**Managed Phone Number:** +14158497226
**Vapi Phone ID:** 55976957-887d-44a4-8c79-6a02d4c91aa1

---

## 📋 Objective

Verify that the managed phone number provisioned for voxanne@demo.com:
1. ✅ Appears in the Inbound Agent phone number dropdown
2. ✅ Appears in the Outbound Agent phone number dropdown
3. ✅ Can be synced to both Inbound and Outbound agents
4. ✅ Uses managed credentials when triggering outbound calls

---

## 🎯 Verification Tasks

### Task 1: Login to Dashboard

**Instructions:**
1. Navigate to: `https://app.voxanne.ai/login` (or your deployed frontend URL)
2. Login with credentials:
   - **Email:** voxanne@demo.com
   - **Password:** [Use the actual password for this test account]
3. Wait for dashboard to load
4. Verify you see the main dashboard page

**Expected Result:** Successfully logged in as voxanne@demo.com organization

---

### Task 2: Navigate to Agent Configuration

**Instructions:**
1. From the dashboard, locate the left sidebar
2. Click on **"Agent Configuration"** (or navigate to `/dashboard/agent-config`)
3. Wait for the Agent Configuration page to load
4. Verify you see two tabs: **Inbound** and **Outbound**

**Expected Result:** Agent Configuration page displays with both agent tabs

---

### Task 3: Verify Inbound Agent Phone Number Dropdown

**Instructions:**
1. Ensure you're on the **Inbound** tab
2. Scroll down to the **"Phone Number Assignment"** section
3. Locate the dropdown labeled **"Assign New Number"** or **"Select Phone Number"**
4. Click on the dropdown to expand it
5. **Verify the following:**
   - ✅ Dropdown contains at least one phone number
   - ✅ Phone number **+14158497226** is present
   - ✅ Phone number has a badge/label: **(Managed)** or **(Your Twilio)**
   - ✅ If badge says **(Managed)**, this confirms it's using managed telephony

**Expected Result:**
```
Dropdown contents:
  +14158497226 (Managed) ✅
```

**Screenshot:** Take a screenshot showing the dropdown expanded with +14158497226 visible

**If Number NOT Visible:**
- ❌ Report: "SSOT VIOLATION DETECTED - Managed number missing from Inbound dropdown"
- Check browser console for API errors
- Check Network tab for `/api/integrations/vapi/numbers` response

---

### Task 4: Verify Outbound Agent Phone Number Dropdown

**Instructions:**
1. Click on the **Outbound** tab at the top of the page
2. Scroll down to the **"Outbound Caller ID"** or **"Phone Number"** section
3. Locate the dropdown labeled **"Choose Caller ID Number"** or **"Select Phone Number"**
4. Click on the dropdown to expand it
5. **Verify the following:**
   - ✅ Dropdown contains at least one phone number
   - ✅ Phone number **+14158497226** is present
   - ✅ Phone number has a badge/label: **(Managed)**

**Expected Result:**
```
Dropdown contents:
  +14158497226 (Managed) ✅
```

**Screenshot:** Take a screenshot showing the dropdown expanded with +14158497226 visible

**If Number NOT Visible:**
- ❌ Report: "SSOT VIOLATION DETECTED - Managed number missing from Outbound dropdown"

---

### Task 5: Sync Managed Number to Inbound Agent

**Instructions:**
1. Return to the **Inbound** tab
2. In the phone number dropdown, select **+14158497226 (Managed)**
3. Click the **"Assign"** or **"Sync"** button next to the dropdown
4. Wait for confirmation message (e.g., "Agent successfully assigned to phone number!")
5. **Verify:**
   - ✅ Success message appears
   - ✅ Current assigned number updates to show +14158497226
   - ✅ No error messages in browser console

**Expected Result:**
```
✅ Success: "Agent successfully assigned to phone number!"
Current Number: +14158497226
```

**API Call to Monitor:**
- Endpoint: `POST /api/integrations/vapi/assign-number`
- Payload should include: `vapiPhoneId: "55976957-887d-44a4-8c79-6a02d4c91aa1"`

**Screenshot:** Take a screenshot showing the success message

---

### Task 6: Sync Managed Number to Outbound Agent

**Instructions:**
1. Switch to the **Outbound** tab
2. In the phone number dropdown, select **+14158497226 (Managed)**
3. Click the **"Assign"** or **"Save"** button
4. Wait for confirmation message
5. **Verify:**
   - ✅ Success message appears
   - ✅ Selected number updates to show +14158497226
   - ✅ No error messages in browser console

**Expected Result:**
```
✅ Success: "Phone number assigned successfully to outbound agent!"
Selected Number: +14158497226
```

**API Call to Monitor:**
- Endpoint: `POST /api/integrations/vapi/assign-number`
- Payload should include: `phoneNumberId: "55976957-887d-44a4-8c79-6a02d4c91aa1"`
- Payload should include: `role: "outbound"`

**Screenshot:** Take a screenshot showing the success message

---

### Task 7: Navigate to Contacts Page

**Instructions:**
1. From the left sidebar, click on **"Contacts"**
2. Wait for contacts page to load
3. Locate a contact in the list (or create a test contact if needed)
4. Find the **"Call Back"** or **"Trigger Outbound Call"** button for any contact
5. Click the button to initiate an outbound call

**Expected Result:** Outbound call initiated successfully

---

### Task 8: Verify Outbound Call Uses Managed Credentials

**Instructions:**
1. After clicking "Call Back", open **Browser Developer Tools** (F12)
2. Switch to the **Network** tab
3. Filter for the API call (look for `/call-back` or `/contacts` endpoint)
4. Click on the request to view details
5. **Verify in the Request Payload:**
   - ✅ Request includes the contact's phone number
   - ✅ Request is sent to `/api/contacts/:contactId/call-back`

6. **Check the Response:**
   - ✅ Response status: 200 OK
   - ✅ Response body includes: `"success": true`
   - ✅ Response includes: `"vapiCallId"` (confirms call initiated with Vapi)

7. **Verify Backend Logs (if accessible):**
   - Check backend logs for: "Using managed credentials for outbound call"
   - Check for: `vapiPhoneNumberId: "55976957-887d-44a4-8c79-6a02d4c91aa1"`

**Expected Result:**
```json
{
  "success": true,
  "message": "Outbound call initiated",
  "vapiCallId": "..."
}
```

**Screenshot:** Take a screenshot of the Network tab showing the successful API call

---

### Task 9: Check Backend API Response (Advanced)

**Instructions:**
1. Open **Developer Tools → Network** tab
2. Navigate back to **Agent Configuration** page
3. Refresh the page to trigger API calls
4. Find the request to: `GET /api/integrations/vapi/numbers`
5. Click on the request to view **Response** data
6. **Verify the response JSON:**

**Expected Response:**
```json
{
  "success": true,
  "numbers": [
    {
      "id": "55976957-887d-44a4-8c79-6a02d4c91aa1",
      "number": "+14158497226",
      "name": "Managed",
      "type": "managed"
    }
  ]
}
```

7. **Verify:**
   - ✅ `success: true`
   - ✅ Array contains phone number +14158497226
   - ✅ `type: "managed"` (confirms managed credentials)
   - ✅ `id` matches Vapi Phone ID: 55976957-887d-44a4-8c79-6a02d4c91aa1

**Screenshot:** Take a screenshot of the API response

---

### Task 10: Test End-to-End Call Flow (Optional)

**Instructions:**
1. Trigger an outbound call to a test phone number (your own phone)
2. Answer the call
3. **Verify:**
   - ✅ Call connects successfully
   - ✅ AI agent speaks (confirms Vapi integration working)
   - ✅ Caller ID on your phone shows: +14158497226
   - ✅ Call appears in dashboard after completion

**Expected Result:**
- Call connects successfully
- Managed phone number (+14158497226) appears as caller ID

---

## 📊 Verification Checklist

Mark each item as you complete it:

- [ ] **Task 1:** Logged into voxanne@demo.com dashboard
- [ ] **Task 2:** Navigated to Agent Configuration page
- [ ] **Task 3:** ✅ Verified +14158497226 appears in Inbound dropdown with "(Managed)" badge
- [ ] **Task 4:** ✅ Verified +14158497226 appears in Outbound dropdown with "(Managed)" badge
- [ ] **Task 5:** ✅ Successfully synced managed number to Inbound agent
- [ ] **Task 6:** ✅ Successfully synced managed number to Outbound agent
- [ ] **Task 7:** Navigated to Contacts and triggered outbound call
- [ ] **Task 8:** ✅ Verified API call uses managed credentials (vapiPhoneNumberId)
- [ ] **Task 9:** ✅ Verified `/api/integrations/vapi/numbers` returns managed number
- [ ] **Task 10:** (Optional) Confirmed end-to-end call uses +14158497226 as caller ID

---

## 🚨 Troubleshooting

### If Managed Number Does NOT Appear in Dropdown

**Step 1: Check API Response**
```bash
# Open DevTools → Network tab
# Look for: GET /api/integrations/vapi/numbers
# Check response body
```

**Expected:** Array with phone number object
**If Empty Array:** SSOT violation - credentials not in org_credentials table

**Step 2: Check Browser Console**
- Look for JavaScript errors
- Look for API error responses (401, 403, 500)

**Step 3: Check Authentication**
- Verify JWT token is valid
- Verify logged in as correct organization (voxanne@demo.com)
- Check Network tab for 401 Unauthorized errors

**Step 4: Verify Backend Server is Running**
- Check if API endpoint is accessible
- Try accessing: `https://api.voxanne.ai/health` (or your backend URL)

### If Outbound Call Fails

**Possible Issues:**
1. **Vapi Phone ID not set** - Check agent configuration has vapiPhoneNumberId
2. **Managed credentials not found** - Check org_credentials table
3. **Twilio subaccount issue** - Check Twilio API credentials
4. **Insufficient credit** - Check Twilio account balance

**Debugging Commands:**
```bash
# Check agent configuration
SELECT * FROM agents WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';

# Check managed credentials
SELECT * FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'twilio'
  AND is_managed = true;
```

---

## 📝 Report Template

After completing verification, provide this summary:

```
=== VERIFICATION REPORT ===
Date: 2026-02-11
Organization: voxanne@demo.com
Managed Number: +14158497226

✅ PASS / ❌ FAIL: Inbound dropdown visibility
✅ PASS / ❌ FAIL: Outbound dropdown visibility
✅ PASS / ❌ FAIL: Sync to Inbound agent
✅ PASS / ❌ FAIL: Sync to Outbound agent
✅ PASS / ❌ FAIL: Outbound call uses managed credentials
✅ PASS / ❌ FAIL: API response includes managed number

Overall Status: ✅ ALL TESTS PASSED / ⚠️ PARTIAL / ❌ FAILED

Notes:
[Add any observations, issues, or recommendations]

Screenshots:
- Screenshot 1: Inbound dropdown
- Screenshot 2: Outbound dropdown
- Screenshot 3: API response
- Screenshot 4: Outbound call success
```

---

## 🎯 Success Criteria

**All of the following must be TRUE:**

1. ✅ Managed phone number (+14158497226) appears in BOTH Inbound and Outbound dropdowns
2. ✅ Dropdowns show "(Managed)" badge next to the number
3. ✅ Number can be successfully assigned to both agents
4. ✅ API endpoint `/api/integrations/vapi/numbers` returns the managed number
5. ✅ Response includes `type: "managed"` and correct Vapi Phone ID
6. ✅ Outbound calls successfully initiated using managed credentials
7. ✅ No JavaScript errors in browser console
8. ✅ No API errors (401, 403, 500) during the flow

**If ALL criteria met:** 🎉 **SSOT COMPLIANCE VERIFIED**

**If ANY criterion fails:** 🚨 **SSOT VIOLATION - Report immediately**

---

## 🔗 Useful Links

- **Frontend URL:** https://app.voxanne.ai (or your deployed URL)
- **Backend API:** https://api.voxanne.ai (or your backend URL)
- **Agent Config Page:** `/dashboard/agent-config`
- **API Documentation:** See `backend/src/routes/integrations-byoc.ts`
- **Investigation Scripts:** `backend/src/scripts/investigate-ssot-violation.ts`

---

**END OF VERIFICATION PROMPT**
