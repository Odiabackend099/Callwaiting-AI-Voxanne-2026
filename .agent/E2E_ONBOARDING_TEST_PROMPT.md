# Voxanne AI: End-to-End Client Onboarding Test Script

**For:** Front-end AI Testing Agent (Browser MCP)
**Date:** 2026-02-18
**Test Account:** `CEO@demo.com` / `demo123`
**Environment:** Local development (`http://localhost:3000`) or Production (`https://voxanne.ai`)
**Backend:** `http://localhost:3001` (local) or `https://voxanneai.onrender.com` (production)

---

## Overview

You are testing the complete 9-step client onboarding journey for Voxanne AI, a multi-tenant Voice-as-a-Service platform for healthcare businesses. A new client (clinic owner) must be able to complete all 9 steps without errors to start using the AI phone system.

**The 9 Onboarding Steps:**
1. Login (email + password)
2. Top up wallet (£25+ via Stripe)
3. Buy an AI phone number (managed telephony)
4. Configure inbound + outbound agents
5. Assign phone number to agents
6. Upload knowledge base documents
7. Test inbound agent (browser voice call)
8. Test outbound agent (phone call)
9. Verify tools are synced to Vapi

---

## Pre-Test Checklist

Before starting, verify:
- [ ] Frontend is running at `http://localhost:3000` (or production URL)
- [ ] Backend is running at `http://localhost:3001` (or production URL)
- [ ] You have browser microphone permissions ready (for Step 7)
- [ ] You have a real phone number to receive a test outbound call (for Step 8)

---

## STEP 1: LOGIN

### Route: `/login`

### Actions:
1. Navigate to `http://localhost:3000/login`
2. Wait for the page to fully load (look for "Welcome Back" heading)
3. Locate the email input field (labeled "Email address")
4. Type: `CEO@demo.com`
5. Locate the password input field (labeled "Password")
6. Type: `demo123`
7. Click the "Sign In" button (blue button, full width)
8. Wait for redirect to `/dashboard`

### Expected Results:
- **SUCCESS:** Redirected to `/dashboard` — you should see the dashboard with a left sidebar containing navigation items (Dashboard, Call Logs, Appointments, Wallet, Agent Configuration, etc.)
- **The sidebar should show:**
  - The Voxanne logo at the top
  - Navigation sections: OPERATIONS, VOICE AGENT, INTEGRATIONS, QUICK ACCESS
  - A balance card at the bottom showing `£X.XX` with a colored ring
  - The user email (`CEO@demo.com`) displayed near the bottom
  - A "Logout" button

### Failure Indicators:
- Error banner: "Invalid login credentials" → Wrong email/password
- Error banner: "Your account does not have an organization assigned" → Account not set up in Supabase
- Page stays on `/login` with no redirect → Auth failure
- Redirected to `/login?error=no_org` → Missing `app_metadata.org_id` in JWT

### Screenshot Checkpoint: Take a screenshot of the dashboard after successful login.

---

## STEP 2: TOP UP WALLET

### Route: `/dashboard/wallet`

### Actions:
1. In the left sidebar, click "Wallet" (under OPERATIONS section)
2. Wait for the wallet page to load (look for "Wallet" heading and "Current Balance" card)
3. **CHECK CURRENT BALANCE:**
   - Look at the top gradient card — it shows "Current Balance" with a large `£X.XX` value
   - Note the current balance value
   - If balance is already `£25.00` or more, you may skip the top-up (but still verify the UI)
4. **VERIFY CURRENCY:**
   - The balance card should show a badge reading `£0.56/minute`
   - All amounts should use `£` (GBP), NOT `$` (USD)
   - The auto-recharge section (right column) should show `£` symbols in input fields
5. **INITIATE TOP-UP:**
   - Click the "Top Up" button (white button with Plus icon in the gradient card)
   - A modal should appear titled "Top Up Credits"
6. **SELECT AMOUNT:**
   - You should see 4 preset buttons: `£25`, `£50`, `£100`, `£200`
   - Click `£25` (minimum required)
   - The selected button should get a blue border highlight
   - Below, you should see: "You'll be charged: £25.00 GBP via Stripe"
7. **PROCEED TO PAYMENT:**
   - Click "Proceed to Payment" button
   - You will be redirected to Stripe Checkout (external page)

### Stripe Checkout (External):
- **NOTE FOR TESTING:** If using Stripe test mode, use card number `4242 4242 4242 4242`, any future expiry, any CVC
- Complete the Stripe payment form
- After payment, Stripe redirects back to `/dashboard/wallet?topup=success`

### Expected Results:
- **SUCCESS:** Back on wallet page with a green toast notification: "Credits added successfully!"
- Balance card now shows updated balance (previous + £25.00)
- Transaction history table shows a new "Top-Up" entry with `+£25.00`
- Sidebar balance card (bottom-left) updates to show new balance

### Failure Indicators:
- Stripe redirect fails → Check backend webhook configuration
- Balance doesn't update after redirect → Webhook processing delay (wait 5-10 seconds, refresh)
- `$` symbols visible anywhere → Currency bug (should all be `£`)
- "Proceed to Payment" button disabled → No amount selected

### Verification Queries:
- Check that the sidebar balance indicator (bottom of left sidebar) shows the correct updated balance
- Check that the ring color around the wallet icon is:
  - Red if balance < £0.79
  - Amber if balance < £5.00
  - Blue if balance >= £5.00

### Screenshot Checkpoint: Take a screenshot of the wallet page showing updated balance and transaction history.

---

## STEP 3: BUY AN AI PHONE NUMBER

### Route: `/dashboard/phone-settings`

### Actions:
1. In the left sidebar, click "Phone Settings" (under INTEGRATIONS section)
2. Wait for the phone settings page to load
3. **CHECK FOR EXISTING NUMBER:**
   - Look for a "Managed Phone Numbers" section
   - If a number is already provisioned (shows as `+1XXXXXXXXXX` with "Active" status), skip to Step 4
   - If no number: you should see a "Buy Number" button or similar prompt
4. **OPEN BUY NUMBER MODAL:**
   - Click "Buy Number" button (or "Get a Phone Number" or similar)
   - The BuyNumberModal should appear

### BuyNumberModal Flow:

**Step 3a: Select Country**
5. You should see a country selector with:
   - `🇺🇸 United States` (regulatoryReady: true)
   - `🇬🇧 United Kingdom` (regulatoryReady: true — recently fixed!)
   - `🇨🇦 Canada`
6. Select `🇺🇸 United States` (recommended for first test)
7. **BALANCE PRE-CHECK:** The modal should NOT show "Insufficient balance" if you have £10+ in your wallet
   - If you see "Insufficient balance" despite having funds → Bug (the wallet balance path fix may not be deployed)

**Step 3b: Search for Numbers**
8. Optionally enter an area code (e.g., `415` for San Francisco, or leave blank)
9. Select number type: "Local" (default)
10. Click "Search" button
11. Wait for available numbers to load (may take 2-5 seconds)

**Step 3c: Select a Number**
12. A list of available phone numbers should appear
13. Click on one to select it (it should get a highlight border)

**Step 3d: Confirm Purchase**
14. Click "Confirm Purchase" or "Provision Number" button
15. **CRITICAL:** This button should be ENABLED (not grayed out) for both US and UK numbers
    - Previously, non-US numbers had the confirm button disabled — this has been fixed
16. Wait for provisioning (5-15 seconds, shows a spinner)

### Expected Results:
- **SUCCESS:** Modal shows success message with your new phone number (e.g., `+14155551234`)
- Phone settings page now shows the provisioned number under "Managed Phone Numbers"
- The number shows "Active" status
- Your wallet balance decreased by £15.00 (1500 pence — the number cost)

### Failure Indicators:
- "Insufficient balance" shown despite having £10+ → Balance property path bug (`wallet?.balance?.balancePence` instead of `wallet?.balance_pence`)
- Search button disabled for UK → `regulatoryReady: false` not fixed
- Confirm button disabled for non-US country → `country !== 'US'` guard not removed
- Provisioning fails with error → Check backend logs, Twilio subaccount may have issues
- "You already have an active phone number" → One-per-org enforcement working correctly (delete existing first)

### UK Number Note:
If testing with UK numbers (🇬🇧), be aware:
- The Twilio master account must have UK geo permissions enabled
- A Regulatory Compliance Bundle may need to be submitted (takes 2-3 business days)
- For immediate testing, use US numbers first

### Screenshot Checkpoint: Take a screenshot showing the provisioned phone number on the phone settings page.

---

## STEP 4: CONFIGURE INBOUND AGENT

### Route: `/dashboard/agent-config?agent=inbound`

### Actions:
1. In the left sidebar, click "Agent Configuration" (under VOICE AGENT section)
2. Wait for the page to load (look for "Agent Configuration" heading)
3. Ensure you are on the **"Inbound Agent"** tab (first tab, should be default)
   - If not, click the "Inbound Agent" tab

**Configure Agent Identity:**
4. In the left column, find "Agent Name" input
5. Type: `Clinic Receptionist` (or any descriptive name)

**Configure Voice (Optional):**
6. Find the "Voice Settings" card
7. Select a voice (e.g., the default or a natural-sounding option)
8. Select language: `en-US` or `en-GB`

**Configure System Prompt:**
9. In the right column, find the "System Prompt" textarea (labeled "Core Personality")
10. You can either:
    - Click a "Quick Start Template" to auto-populate, OR
    - Type a custom prompt, for example:
    ```
    You are a friendly and professional AI receptionist for Voxanne Medical Clinic.
    You help callers with:
    - Booking appointments
    - Answering questions about our services
    - Providing clinic hours (Monday-Friday, 9 AM to 5 PM)
    - Transferring to a human if needed

    Always be polite, concise, and helpful. If you don't know something, offer to transfer the caller to a staff member.
    ```

**Configure First Message:**
11. Find the "First Message" textarea
12. Type: `Hello! Thank you for calling Voxanne Medical Clinic. How can I help you today?`

**Save the Agent:**
13. Click the "Save Changes" button (blue button in the top-right header area)
14. Wait for save to complete
15. The button should briefly change to "Saved" (green) for ~3 seconds

### Expected Results:
- **SUCCESS:** Save button shows "Saved" (green) then returns to "Save Changes"
- No error banners appear
- **TOOL SYNC CHECK:** After save, if you see a warning message about "tools failed to sync" → Note this but it's non-fatal
  - This warning was recently added (C6 fix) — it means Vapi tool registration had an issue
  - The agent is still saved, but tools like appointment booking may not work until re-saved

### Failure Indicators:
- "Save Changes" button stays disabled → No changes detected (make sure you typed something)
- Red error banner after save → Backend error (check network tab for 4xx/5xx response)
- Page shows loading spinner indefinitely → Backend not responding

### Screenshot Checkpoint: Take a screenshot of the configured inbound agent.

---

## STEP 5: ASSIGN PHONE NUMBER TO INBOUND AGENT

### Route: `/dashboard/agent-config?agent=inbound` (same page)

### Actions:
1. Stay on the Agent Configuration page, Inbound Agent tab
2. Find the "Phone Number" card in the left column
3. Look for a dropdown labeled "Assign New Number" or similar
4. Click the dropdown — it should show your provisioned phone number from Step 3
5. Select the phone number (e.g., `+14155551234`)
6. Click the assign/check button (checkmark icon next to dropdown)
7. Click "Save Changes" to persist the assignment

### Expected Results:
- **SUCCESS:** The phone number card now shows "Current Number: +14155551234" (or your number)
- After save, the inbound agent is linked to this phone number
- When someone calls this number, the inbound agent will answer

### Failure Indicators:
- Dropdown is empty → Phone numbers not loading from `/api/integrations/vapi/numbers`
- "Not Assigned" persists after save → Assignment didn't persist (check network tab)

---

## STEP 4b: CONFIGURE OUTBOUND AGENT

### Route: `/dashboard/agent-config?agent=outbound`

### Actions:
1. Click the "Outbound Agent" tab (second tab)
2. Configure the outbound agent similarly to inbound:

**Agent Identity:**
3. Set agent name: `Outbound Sales Agent` (or similar)

**Outbound Caller ID:**
4. In the left column, find "Outbound Caller ID" or "Choose Caller ID Number"
5. Select the same phone number from the dropdown
6. Click the assign button

**System Prompt:**
7. Type a system prompt, for example:
```
You are an outbound calling agent for Voxanne Medical Clinic.
You call patients to:
- Confirm upcoming appointments
- Follow up after visits
- Schedule new appointments for patients who haven't been in recently

Be professional, warm, and respectful of the patient's time.
```

**First Message:**
8. Type: `Hi, this is the AI assistant from Voxanne Medical Clinic. I'm calling to follow up with you. Do you have a moment?`

**Save:**
9. Click "Save Changes"
10. Wait for "Saved" confirmation

### Expected Results:
- **SUCCESS:** Outbound agent configured with phone number assigned
- Both inbound and outbound agents now have phone numbers
- Tool sync warning (if shown) is informational, not blocking

### Screenshot Checkpoint: Take a screenshot of the configured outbound agent.

---

## STEP 6: UPLOAD KNOWLEDGE BASE

### Route: `/dashboard/knowledge-base`

### Actions:
1. In the left sidebar, click "Knowledge Base" (under VOICE AGENT section)
2. Wait for the page to load (look for "Knowledge Base" heading)

**Option A: Load Sample KB (Quick)**
3. Click the "Load Sample KB" button (first quick action button, with Sparkles icon)
4. Sample documents will be created automatically
5. Skip to step 9

**Option B: Create Custom Document (Recommended for Testing)**
3. In the right column, find the "Add New Document" card
4. Click "Upload File" OR manually fill in:
   - **Document Name:** `clinic-services.md`
   - **Category:** Select "Products & Services" from dropdown
   - **Content:** Type or paste:
   ```
   # Voxanne Medical Clinic Services

   ## Consultations
   - General Consultation: £80 (30 minutes)
   - Specialist Referral: £120 (45 minutes)
   - Follow-up Visit: £50 (15 minutes)

   ## Treatments
   - Botox Treatment: £400 per session
   - Chemical Peel: £250 per session
   - Dermal Fillers: £350 per session

   ## Clinic Hours
   - Monday to Friday: 9:00 AM - 5:00 PM
   - Saturday: 10:00 AM - 2:00 PM
   - Sunday: Closed

   ## Contact
   - Phone: Available 24/7 via AI receptionist
   - Email: info@voxanneclinic.com
   - Address: 123 Medical Drive, London, UK
   ```
   - **Active:** Ensure the "Active (AI can use this)" checkbox is checked
5. Click "Create" button

**Sync to AI:**
6. After document is created, it should appear in the left column document list
7. Click the "Sync to AI" button (second quick action button, with CloudUpload icon)
8. Wait for sync to complete (may take 2-5 seconds)
9. You should see a success message (blue banner): "Knowledge base synced to assistants"

### Expected Results:
- **SUCCESS:** Document appears in the left column list with name, category, and version
- Sync completes without errors
- The AI agent can now answer questions about clinic services, pricing, hours, etc.

### Failure Indicators:
- "Sync to AI" button disabled → No documents in knowledge base
- Sync fails with error → Backend KB sync endpoint issue
- File upload fails → Check file size (max 5MB) and format (TXT/MD only)

### Screenshot Checkpoint: Take a screenshot of the knowledge base page with documents listed and sync status.

---

## STEP 7: TEST INBOUND AGENT (Browser Voice Call)

### Route: `/dashboard/test?tab=web`

### Actions:
1. In the left sidebar, click "Test Agents" (under VOICE AGENT section)
2. Wait for the page to load
3. Ensure you are on the **"Web Test"** tab (first tab with Globe icon)
4. **BROWSER PERMISSIONS:** Your browser will request microphone access — ALLOW it

**Pre-flight Checks:**
5. Before starting, the page should verify:
   - An inbound agent is configured ✅
   - Wallet balance is sufficient (£0.79+ required) ✅
   - If either fails, you'll see an error message instead of the call button

**Start Test Call:**
6. Click the "Start Call" button (or similar)
7. Wait for the WebSocket connection to establish
8. You should see a connection indicator change to "Connected"

**Test Conversation:**
9. Speak into your microphone: "Hello, what services do you offer?"
10. The AI should respond using information from your knowledge base (Step 6)
11. The transcript should appear in real-time showing both "You" and "Voxanne" messages
12. Try asking: "How much does a Botox treatment cost?"
13. The AI should answer: something like "A Botox treatment costs £400 per session"

**End Test Call:**
14. Click the "Stop Call" or "End Call" button
15. The call should disconnect gracefully

### Expected Results:
- **SUCCESS:** Two-way voice conversation works
- Real-time transcript shows accurate transcription
- AI responds with knowledge base content
- Call connects and disconnects cleanly
- Wallet balance decreases slightly after the call (charged at £0.56/minute)

### Failure Indicators:
- "Please configure an inbound agent in Agent Configuration before testing" → Inbound agent not set up (go back to Step 4)
- "Insufficient balance" → Wallet below £0.79 (go back to Step 2)
- WebSocket connection fails → Backend WebSocket not running
- No audio / microphone not working → Browser permissions issue
- AI doesn't reference knowledge base → KB sync didn't complete (go back to Step 6)

### Screenshot Checkpoint: Take a screenshot of the test call in progress showing the transcript.

---

## STEP 8: TEST OUTBOUND AGENT (Phone Call)

### Route: `/dashboard/test?tab=phone`

### Actions:
1. Click the "Phone Test" tab (second tab with Phone icon)
2. Find the phone number input field
3. Type a REAL phone number that you can answer (e.g., your mobile number in E.164 format: `+44XXXXXXXXXX` or `+1XXXXXXXXXX`)
4. The input should validate the number format and show the detected country

**Pre-flight Checks:**
5. The page verifies:
   - Outbound agent configured ✅
   - System prompt exists ✅
   - Phone number assigned ✅
   - Balance sufficient ✅

**Start Outbound Test:**
6. Click "Call" or "Start Test Call" button
7. A confirmation dialog may appear — confirm to proceed
8. Wait for the call to connect (your phone should ring within 5-15 seconds)

**Answer the Call:**
9. Answer the call on your phone
10. You should hear the AI's first message: "Hi, this is the AI assistant from Voxanne Medical Clinic..."
11. Have a brief conversation to test the AI's responses
12. The dashboard should show real-time transcript

**End the Call:**
13. Either hang up on your phone, or click "End Call" on the dashboard
14. The call status should change to "Disconnected" or "Completed"

### Expected Results:
- **SUCCESS:** Your phone rings, AI speaks the first message, two-way conversation works
- Dashboard shows real-time transcript
- Call appears in Call Logs (`/dashboard/calls`) after completion

### Failure Indicators:
- "Outbound agent not configured" → Go back to Step 4b
- "No phone number available" → Phone number not assigned to outbound agent (Step 5)
- Phone doesn't ring → Twilio/Vapi connection issue, check backend logs
- "Insufficient balance" → Top up wallet (Step 2)
- Call connects but no audio → Vapi assistant sync issue

### Screenshot Checkpoint: Take a screenshot of the outbound test page with transcript.

---

## STEP 9: VERIFY TOOL SYNC & CALL LOGS

### Route: `/dashboard/calls`

### Actions:
1. In the left sidebar, click "Call Logs" (under OPERATIONS section)
2. Wait for the call logs page to load

**Verify Test Calls Appear:**
3. You should see at least 2 recent calls:
   - One inbound (browser test from Step 7)
   - One outbound (phone test from Step 8)
4. Each call should show:
   - Date/time
   - Phone number
   - Caller name (may be "Unknown Caller" for test calls)
   - Duration
   - Status: "Completed"
   - Sentiment score (if available)

**Verify Call Details:**
5. Click on one of the test calls to expand details
6. You should see:
   - Full transcript of the conversation
   - Recording player (if recording was enabled)
   - Sentiment analysis (if available)

**Verify Tool Registration (Indirect):**
7. During the test calls, if the AI was able to:
   - Answer questions from knowledge base → `queryKnowledgeBase` tool is working
   - Offer to book appointments → `checkAvailability` / `bookClinicAppointment` tools are registered
   - Look up caller information → `lookupCaller` tool is working
   Then tools are properly synced with Vapi.

### Expected Results:
- **SUCCESS:** Test calls visible in call logs with correct details
- Transcripts are accurate and complete
- AI used knowledge base content during calls (proving tool sync works)
- No "tools failed to sync" warnings on agent save (or if warning appeared, tools still function)

### Screenshot Checkpoint: Take a screenshot of the call logs showing test calls.

---

## STEP 10 (BONUS): CALL FORWARDING SETUP

### Route: `/dashboard/phone-settings`

This step configures the client's existing business phone to forward calls to the AI number.

### Actions:
1. Navigate to `/dashboard/phone-settings`
2. Find the "Call Forwarding" or "AI Forwarding" section
3. Look for carrier-specific forwarding instructions:
   - Select the client's carrier (e.g., "O2", "Three", "AT&T", "Verizon")
   - The page should show:
     - Activation code (e.g., `*21*+14155551234#`)
     - Deactivation code (e.g., `##21#`)
     - Step-by-step instructions

### Expected Results:
- **SUCCESS:** Clear forwarding instructions displayed for the selected carrier
- The activation code includes the provisioned AI phone number
- Instructions are accurate for the carrier

### Note: Actual call forwarding activation happens on the client's phone, not in the dashboard.

---

## COMPLETE TEST SUMMARY CHECKLIST

After completing all steps, verify:

| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 1 | Login with `CEO@demo.com` / `demo123` | ☐ PASS / ☐ FAIL | |
| 2 | Wallet shows £ (GBP) everywhere | ☐ PASS / ☐ FAIL | |
| 2 | Top-up £25 via Stripe | ☐ PASS / ☐ FAIL | |
| 2 | Balance updates after top-up | ☐ PASS / ☐ FAIL | |
| 2 | Sidebar balance indicator correct | ☐ PASS / ☐ FAIL | |
| 3 | BuyNumberModal opens without "Insufficient balance" | ☐ PASS / ☐ FAIL | |
| 3 | US number search works | ☐ PASS / ☐ FAIL | |
| 3 | UK number search works (Search not disabled) | ☐ PASS / ☐ FAIL | |
| 3 | Confirm Purchase enabled for selected country | ☐ PASS / ☐ FAIL | |
| 3 | Number provisioned successfully | ☐ PASS / ☐ FAIL | |
| 4 | Inbound agent saved successfully | ☐ PASS / ☐ FAIL | |
| 4b | Outbound agent saved successfully | ☐ PASS / ☐ FAIL | |
| 5 | Phone number assigned to both agents | ☐ PASS / ☐ FAIL | |
| 6 | Knowledge base document created | ☐ PASS / ☐ FAIL | |
| 6 | KB synced to AI (success message) | ☐ PASS / ☐ FAIL | |
| 7 | Browser test call connects | ☐ PASS / ☐ FAIL | |
| 7 | AI responds with KB content | ☐ PASS / ☐ FAIL | |
| 7 | Real-time transcript works | ☐ PASS / ☐ FAIL | |
| 8 | Outbound call rings phone | ☐ PASS / ☐ FAIL | |
| 8 | AI speaks first message | ☐ PASS / ☐ FAIL | |
| 9 | Test calls appear in Call Logs | ☐ PASS / ☐ FAIL | |
| 9 | Call transcripts are complete | ☐ PASS / ☐ FAIL | |
| 10 | Call forwarding instructions display | ☐ PASS / ☐ FAIL | |

---

## CURRENCY VERIFICATION CHECKLIST

All monetary values on the platform should use `£` (GBP). Check these specific locations:

| Location | Expected | Check |
|----------|----------|-------|
| Wallet balance card | `£X.XX` | ☐ |
| Wallet badge | `£0.56/minute` | ☐ |
| Top-up presets | `£25`, `£50`, `£100`, `£200` | ☐ |
| Top-up modal footer | "via Stripe in GBP (British Pounds)" | ☐ |
| Transaction history amounts | `+£X.XX` or `-£X.XX` | ☐ |
| Auto-recharge threshold | `£` prefix in input | ☐ |
| Auto-recharge amount | `£` prefix in input | ☐ |
| BuyNumberModal price | `£1.50/month + usage` | ☐ |
| Phone settings price | `£1.50/month + usage-based pricing` | ☐ |
| Sidebar balance | `£X.XX` | ☐ |
| Test page balance warning | `£0.79 required` | ☐ |

---

## RECENTLY FIXED BUGS (Verify These Are Resolved)

These bugs were fixed in the current branch. Verify each fix is working:

### B1: Wallet Balance Property Path (CRITICAL)
- **What was broken:** BuyNumberModal always showed "Insufficient balance" regardless of actual balance
- **How to verify:** After topping up £25+, open BuyNumberModal — it should NOT show "Insufficient balance"
- **Root cause was:** Frontend read `wallet?.balance?.balancePence` (nested, wrong) instead of `wallet?.balance_pence` (flat, correct)

### B2: UK Number Purchase Blocked
- **What was broken:** UK (GB) number search button was disabled, Confirm button was disabled for non-US
- **How to verify:** In BuyNumberModal, select 🇬🇧 United Kingdom — Search button should be ENABLED. After selecting a number, Confirm Purchase should be ENABLED.
- **Root cause was:** `regulatoryReady: false` for GB + `country !== 'US'` guard on confirm button

### C1: Currency Symbols
- **What was broken:** `$` shown instead of `£` in 4 locations
- **How to verify:** Check all locations in the Currency Verification Checklist above

### C5: Inbound Agent Pre-Check on Test Page
- **What was broken:** Browser test showed cryptic WebSocket error if no inbound agent configured
- **How to verify:** (Only if you haven't configured an inbound agent) Go to Test Agents > Web Test — should see clear error: "Please configure an inbound agent in Agent Configuration before testing."

### C6: Tool Sync Warning
- **What was broken:** Tool sync failures were silent — user thought agent was ready but tools weren't registered
- **How to verify:** After saving an agent, if tools fail to sync, you should see a warning message (amber/yellow) about tool sync. If tools sync successfully, no warning appears.

---

## NAVIGATION MAP (Quick Reference)

```
/login                          → Login page
/dashboard                      → Main dashboard (analytics overview)
/dashboard/wallet               → Wallet (balance, top-up, transactions)
/dashboard/calls                → Call Logs (inbound/outbound history)
/dashboard/appointments         → Appointments list
/dashboard/agent-config         → Agent Configuration (inbound/outbound)
/dashboard/knowledge-base       → Knowledge Base (upload, sync)
/dashboard/test                 → Test Agents (web + phone)
/dashboard/phone-settings       → Phone Settings (buy number, caller ID, forwarding)
/dashboard/escalation-rules     → Escalation Rules
/dashboard/api-keys             → API Keys
/dashboard/settings             → Settings
/dashboard/notifications        → Notifications
```

---

## SIDEBAR NAVIGATION ORDER

When clicking through the sidebar, items appear in this order:

**OPERATIONS**
1. Dashboard
2. Call Logs
3. Appointments
4. Wallet

**VOICE AGENT**
5. Agent Configuration
6. Escalation Rules
7. Knowledge Base
8. Test Agents

**INTEGRATIONS**
9. API Keys
10. Phone Settings
11. Settings

**QUICK ACCESS**
12. Notifications

---

## ERROR RECOVERY PROCEDURES

If a step fails, here's how to recover:

| Step | Failure | Recovery |
|------|---------|----------|
| 1 | Login fails | Verify account exists in Supabase Auth, check `app_metadata.org_id` is set |
| 2 | Stripe redirect fails | Refresh wallet page, try again. Check backend Stripe webhook logs |
| 2 | Balance not updating | Wait 10 seconds, refresh page. Check backend webhook processing |
| 3 | "Insufficient balance" | Go to wallet, verify balance >= £10. If display shows balance but modal says insufficient, it's the B1 bug |
| 3 | No numbers found | Try different area code, or try US instead of UK |
| 3 | Provisioning fails | Check backend logs for Twilio errors. May be subaccount issue |
| 4 | Save fails | Check network tab for error response. Verify backend is running |
| 5 | Dropdown empty | Refresh page. Check `/api/integrations/vapi/numbers` endpoint |
| 6 | Sync fails | Refresh and try again. Check backend KB sync endpoint |
| 7 | No audio | Check browser microphone permissions. Try a different browser |
| 8 | Phone doesn't ring | Verify outbound agent has phone number. Check Twilio/Vapi logs |
| 9 | Calls not in logs | Wait 30 seconds after call ends. Refresh call logs page |

---

## KNOWN LIMITATIONS

1. **UK Numbers:** May require Twilio Regulatory Compliance Bundle (2-3 business day approval). Test with US numbers first.
2. **Google Calendar:** If Google OAuth app is in "Testing" mode, refresh tokens expire after 7 days. Not blocking for demo testing but affects production clients.
3. **Voice Test:** Requires browser microphone access. Safari may have compatibility issues — Chrome recommended.
4. **Outbound Calls:** Require a real phone number to ring. Cannot test with fake numbers.
5. **Tool Sync:** Occasionally fails silently on first save. Re-saving the agent usually resolves it.

---

## IMPORTANT NOTES FOR THE TESTING AGENT

1. **Take screenshots at each checkpoint** — these serve as evidence the flow works
2. **Note any £ vs $ discrepancy** — all currency should be GBP (£)
3. **Test with US numbers first** — UK numbers have external dependencies
4. **The wallet minimum for number purchase is £10.00** (1000 pence) — ensure balance is sufficient
5. **The wallet minimum for test calls is £0.79** (79 pence) — one call credit
6. **After each agent save**, watch for tool sync warnings — they're informational but important
7. **The login route is `/login`** — NOT `/sign-in`
8. **After successful login, you land on `/dashboard`** — the main analytics page
9. **Both frontend and backend must be running** for full functionality
10. **Stripe test mode** uses card `4242 4242 4242 4242` with any future date and any CVC
