# MANUAL-03: SMS Delivery

**Tier:** 2 (Should Pass — Beta Launch)
**Requires:** Real phone, Twilio configured, completed call in system
**Time:** ~3 minutes
**Tester:** ____________________
**Date:** ____________________
**Result:** PASS / FAIL

---

## Pre-Conditions

- [ ] Demo account logged in
- [ ] At least 1 completed call visible in `/dashboard/calls`
- [ ] Twilio SMS credentials configured in backend
- [ ] Real phone available to receive SMS

**Real Phone Number:** ____________________

---

## Test Steps

### 1. Open Call Detail

- [ ] **1.1** Navigate to `/dashboard/calls`
- [ ] **1.2** Click on a completed call to open detail modal
- [ ] **1.3** Verify call detail is visible (duration, transcript, etc.)

### 2. Send Follow-Up SMS

- [ ] **2.1** Click "Send Follow-up" or SMS button in call detail
- [ ] **2.2** SMS input / compose area appears
- [ ] **2.3** Enter real phone number in recipient field
- [ ] **2.4** Type message: "Thank you for calling. Your appointment is confirmed."
- [ ] **2.5** Click "Send"
- [ ] **2.6** UI shows success toast / confirmation
  - Success message: ____________________

### 3. Verify SMS Receipt

- [ ] **3.1** SMS received on real phone within 60 seconds
  - Time to receive: ____ seconds
- [ ] **3.2** Message content matches what was sent
  - Content accurate? YES / NO
- [ ] **3.3** Sender number is the Voxanne/Twilio number (not personal)

---

## Pass Criteria

SMS received on real phone within 60 seconds with correct content.

## Notes / Issues Found

```
(Record any issues, unexpected behavior, or UX concerns here)


```
