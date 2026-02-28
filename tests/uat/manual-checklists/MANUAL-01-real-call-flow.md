# MANUAL-01: Real End-to-End Call Flow

**Tier:** 1 (Must Pass — Blocks Release)
**Requires:** Real phone, Vapi number assigned, wallet funded (>£1)
**Time:** ~5 minutes
**Tester:** ____________________
**Date:** ____________________
**Result:** PASS / FAIL

---

## Pre-Conditions

- [ ] Demo account (`voxanne@demo.com`) logged in on desktop browser
- [ ] Wallet balance > £1.00 (check `/dashboard/wallet`)
- [ ] AI agent configured with knowledge base (check `/dashboard/agent-config`)
- [ ] Vapi phone number assigned (note from `/dashboard/phone-settings`)

**Vapi Phone Number:** ____________________

**Wallet Balance Before:** £____________________

---

## Test Steps

### 1. Place the Call

- [ ] **1.1** Note the Vapi phone number from Phone Settings page
- [ ] **1.2** Call the number from a real mobile phone
- [ ] **1.3** AI answers within 3 rings (< 15 seconds)
  - Actual ring count: ____
  - Actual wait time: ____ seconds

### 2. AI Conversation Quality

- [ ] **2.1** AI greets with correct clinic name (not generic)
  - Greeting heard: ___________________________
- [ ] **2.2** Ask: "What are your opening hours?" — AI responds with KB content
  - Response accurate? YES / NO
- [ ] **2.3** Ask: "Can I book an appointment?" — AI attempts calendar check
  - AI offered time slots? YES / NO / N/A
- [ ] **2.4** End the call naturally ("Thank you, goodbye")

### 3. Dashboard Verification (within 2 minutes of call end)

- [ ] **3.1** Refresh `/dashboard/calls` — new call row appears
  - Time until visible: ____ seconds
- [ ] **3.2** Call detail shows correct duration (± 5 seconds)
  - Expected: ~____ seconds | Displayed: ____ seconds
- [ ] **3.3** Sentiment is populated (positive / neutral / negative)
  - Sentiment shown: ____________________
- [ ] **3.4** Transcript has 2+ speaker turns (not empty)
  - Turn count: ____
- [ ] **3.5** Call cost is displayed in £ format
  - Cost shown: £____________________

### 4. Financial Verification

- [ ] **4.1** Wallet balance deducted by call cost
  - Balance after: £____________________
  - Deduction matches displayed cost? YES / NO

### 5. Lead & Notification (if applicable)

- [ ] **5.1** If caller expressed interest (score > 60), hot lead alert appears in `/dashboard/notifications`
  - Alert visible? YES / NO / N/A

---

## Pass Criteria

All items 1.1–4.1 checked within 2 minutes of call end.

## Notes / Issues Found

```
(Record any issues, unexpected behavior, or UX concerns here)


```

## Screenshots

Attach screenshots of:
1. Call detail modal (showing duration, sentiment, transcript)
2. Wallet balance before and after
3. Any error messages encountered
