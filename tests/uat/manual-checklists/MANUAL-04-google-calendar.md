# MANUAL-04: Google Calendar OAuth Integration

**Tier:** 2 (Should Pass — Beta Launch)
**Requires:** Google account with Calendar, agent configured
**Time:** ~5 minutes
**Tester:** ____________________
**Date:** ____________________
**Result:** PASS / FAIL

---

## Pre-Conditions

- [ ] Demo account logged in
- [ ] Google account available for OAuth consent
- [ ] Agent configuration page accessible

**Google Account Used:** ____________________

---

## Test Steps

### 1. Connect Google Calendar

- [ ] **1.1** Navigate to `/dashboard/agent-config` or Settings
- [ ] **1.2** Find "Connect Google Calendar" or "Calendar Integration" section
- [ ] **1.3** Click "Connect" button
- [ ] **1.4** Google OAuth consent screen appears
- [ ] **1.5** Grant calendar permissions (read + write)
- [ ] **1.6** Redirected back to Voxanne
- [ ] **1.7** "Connected" status shown (green indicator or checkmark)

### 2. Verify Calendar Sync

- [ ] **2.1** Create a test event in Google Calendar for tomorrow at 10:00 AM
  - Event title: "UAT Test Block"
  - Duration: 1 hour
- [ ] **2.2** Wait 30 seconds for sync
- [ ] **2.3** Check availability for tomorrow at 10:00 AM
  - Via API: `GET /api/vapi-tools/check-availability?date=YYYY-MM-DD`
  - 10:00 AM slot should NOT be in available slots
- [ ] **2.4** Check availability for tomorrow at 2:00 PM (should be available)
  - 2:00 PM slot IS in available slots? YES / NO

### 3. Disconnect & Reconnect

- [ ] **3.1** Find "Disconnect" button for Google Calendar
- [ ] **3.2** Click disconnect
- [ ] **3.3** Status changes to "Not Connected"
- [ ] **3.4** Reconnect following steps 1.3–1.7

---

## Pass Criteria

Calendar sync accurately reflects real Google Calendar events (blocked slots not shown as available).

## Cleanup

- [ ] Delete "UAT Test Block" event from Google Calendar
- [ ] Optionally disconnect calendar after testing

## Notes / Issues Found

```
(Record any issues, unexpected behavior, or UX concerns here)


```
