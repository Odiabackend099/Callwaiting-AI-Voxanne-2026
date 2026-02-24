# Quick Start: E2E Testing with Browser MCP

**Ready-to-use guide for testing Voxanne AI with Claude browser capabilities**

---

## 🚀 How to Run E2E Tests

### Option 1: Use Claude Code with Browser MCP

**Step 1: Open Claude Code**
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
```

**Step 2: Start Browser Session**
```
/browse https://voxanne.ai
```

**Step 3: Paste the Complete E2E Prompt**

Open `E2E_TEST_BROWSER_MCP_PROMPT.md` and copy the prompt starting with:
```
You are an expert QA engineer testing the Voxanne AI platform using browser MCP capabilities...
```

**Step 4: Tell Claude to Execute**
```
Please execute this comprehensive E2E test of the Voxanne AI platform.
Follow each step in order, capture screenshots at major checkpoints,
and document any issues you encounter.
```

**Step 5: Monitor Progress**
- Claude will navigate through each phase
- Screenshots will be captured automatically
- Status updates provided after each phase
- Issues flagged immediately

---

### Option 2: Use ChatGPT/Claude with Web Browsing

1. **Enable Web Browsing** (if available)
2. **Paste the full E2E prompt**
3. **Add:** "Please test this platform and provide a detailed report"
4. **Let Claude navigate** through the workflow
5. **Review screenshot links** and findings

---

### Option 3: Manual Step-by-Step with AI Guidance

**Approach:**
```
Step 1: Go to https://voxanne.ai
Step 2: I'll guide you through login → provisioning → testing
Step 3: At each step, describe what you see
Step 4: I'll tell you next action based on your feedback
```

---

## 📋 Test Checklist Quick Reference

```
PHASE 1: Setup (5 min)
  [ ] Navigate to https://voxanne.ai
  [ ] Login with test account
  [ ] Verify dashboard loads
  [ ] Confirm fresh organization

PHASE 2: Phone Provisioning (5 min)
  [ ] Provision inbound number (415 area code)
  [ ] Provision outbound caller ID
  [ ] Verify both numbers display

PHASE 3: Agent Configuration (5 min)
  [ ] Create inbound agent (Aria voice)
  [ ] Create outbound agent (Liam voice)
  [ ] Test voice preview on both
  [ ] Save both agents

PHASE 4: Knowledge Base (3 min)
  [ ] Upload KB file (sample Q&A)
  [ ] Sync to both agents
  [ ] Verify sync success

PHASE 5: Inbound Call Test (5 min)
  [ ] Click "Test in Browser" on inbound agent
  [ ] Ask: "What are your business hours?"
  [ ] Verify KB answer returned
  [ ] Check call logged

PHASE 6: Outbound Call Test (10 min)
  [ ] Click "Test Call" on outbound agent
  [ ] Enter test phone number
  [ ] Listen to first message
  [ ] Ask question to AI
  [ ] Verify KB answer returned
  [ ] End call gracefully
  [ ] Check call logged

PHASE 7: Verification (5 min)
  [ ] Verify caller ID in logs
  [ ] Check dashboard metrics (2 calls)
  [ ] Verify no console errors
  [ ] Check all API responses 200-201

TOTAL TIME: ~38 minutes
```

---

## 🎯 Test Credentials Setup

**Test Email:**
```
email: test-org-owner-e2e-{timestamp}@voxanne.ai
```

**Fresh Organization:**
```
Organization Name: E2E Test Org - {timestamp}
Created: Automatically on first login
Status: Clean, no agents
```

**Test Knowledge Base (Sample):**
```
Q: What are your business hours?
A: We're open Monday-Friday, 9 AM - 6 PM EST

Q: What is your pricing?
A: Enterprise plans start at $1,000/month with custom features

Q: Do you offer discounts?
A: Yes, volume discounts available for 5+ licenses
```

**Test Phone Numbers:**
```
Inbound: Auto-provisioned (will vary)
Outbound Caller ID: Same or configured separately
Test Call Recipient: +1-555-TEST-1234 (dummy) or your real number
```

---

## 📸 Screenshots to Capture

**Critical Screenshots (Minimum):**

1. ✅ Login page (before)
2. ✅ Dashboard (after login)
3. ✅ Provisioned inbound number
4. ✅ Provisioned outbound caller ID
5. ✅ Inbound agent configuration
6. ✅ Outbound agent configuration
7. ✅ Knowledge base uploaded
8. ✅ Inbound call interface (browser test)
9. ✅ Inbound call response from AI
10. ✅ Inbound call in logs
11. ✅ Outbound call interface
12. ✅ Outbound call response
13. ✅ Outbound call in logs
14. ✅ Dashboard analytics (2 calls)
15. ✅ Browser console (clean, no errors)
16. ✅ Network tab (200-201 responses)

**Total Screenshots:** 16 minimum, more if issues found

---

## 🔍 Verification Points

**After Each Phase:**

### Phase 1: Setup
```
✓ Page loads without errors
✓ Login successful
✓ Dashboard displays
✓ Fresh org created
```

### Phase 2: Phones
```
✓ Inbound number provisioned
✓ Number displays in settings
✓ Outbound caller ID configured
✓ Both show in Phone Settings
```

### Phase 3: Agents
```
✓ Inbound agent created and saved
✓ Outbound agent created and saved
✓ Voice previews work
✓ Agents show in Agent Config list
```

### Phase 4: Knowledge Base
```
✓ KB file uploaded successfully
✓ Sync message appears
✓ Both agents updated
```

### Phase 5: Inbound Call
```
✓ Browser test interface loads
✓ AI processes question
✓ KB answer returned correctly
✓ Call appears in logs
✓ Transcript captured
```

### Phase 6: Outbound Call
```
✓ Call connects (or at least initiates)
✓ AI plays first message
✓ AI responds to question
✓ KB answer retrieved
✓ Call ends properly
✓ Call appears in logs
✓ Caller ID shows correctly
```

### Phase 7: Final Verification
```
✓ Caller IDs match configuration
✓ Dashboard shows 2 calls
✓ Success rate 100%
✓ No console errors
✓ All API responses successful
```

---

## ⚠️ Common Issues & Fixes

### Issue: Login fails
**Fix:**
- Verify email is correct
- Check password
- Try incognito/private window
- Check if account already exists

### Issue: Phone provisioning takes too long
**Fix:**
- Wait 10-15 seconds
- Refresh page
- Check if number was actually provisioned (look in settings)

### Issue: Agent won't save
**Fix:**
- All required fields filled?
- Check browser console for errors
- Verify API responded 200
- Try saving again

### Issue: Knowledge base won't sync
**Fix:**
- Verify file uploaded successfully
- Check file format (text/markdown)
- Retry sync button
- Check browser console for errors

### Issue: Inbound/Outbound call won't connect
**Fix:**
- Verify Vapi integration (backend health check)
- Check phone numbers configured
- Try refreshing page
- Check backend logs

### Issue: Caller ID doesn't match
**Fix:**
- Verify configuration in Phone Settings
- Check call log for actual number shown
- Verify phone was provisioned correctly

### Issue: AI doesn't answer from KB
**Fix:**
- Verify KB synced to agent
- Check question matches KB content
- Verify agent has "Active" status
- Check backend logs for KB retrieval

---

## 📊 Expected Results

### Successful Test Indicators
✅ All 26 steps completed without blocking errors
✅ Both inbound and outbound calls executed
✅ AI correctly answered knowledge base questions
✅ Caller ID displayed correctly in all logs
✅ Dashboard metrics show 2 successful calls
✅ Console has no critical errors
✅ All API responses 200-201
✅ Call transcripts captured

### Test Duration Breakdown
- Setup & Login: 5 minutes
- Phone Provisioning: 5 minutes
- Agent Configuration: 5 minutes
- Knowledge Base: 3 minutes
- Inbound Call Test: 5 minutes
- Outbound Call Test: 10 minutes
- Verification: 5 minutes
- **Total: 38 minutes**

---

## 📝 Test Report Template

**Copy this template after testing:**

```markdown
# E2E Test Report: {date & time}

## Test Summary
- Organization: E2E Test Org - {org_id}
- Tester: {your name}
- Duration: {actual time}
- Status: PASS / CONDITIONAL / FAIL

## Results by Phase

### Phase 1: Setup & Login
Status: ✅ PASS
- [ ] Navigated to platform
- [ ] Logged in successfully
- [ ] Dashboard loaded
- [ ] Fresh org created

### Phase 2: Phone Provisioning
Status: ✅ PASS
- [ ] Inbound number: {number}
- [ ] Outbound caller ID: {number}
- [ ] Both provisioned successfully

### Phase 3: Agent Configuration
Status: ✅ PASS
- [ ] Inbound agent created: E2E Inbound Agent
- [ ] Outbound agent created: E2E Outbound Agent
- [ ] Voice previews worked
- [ ] Both saved

### Phase 4: Knowledge Base
Status: ✅ PASS
- [ ] KB file uploaded
- [ ] Synced to 2 agents
- [ ] Agents have KB access

### Phase 5: Inbound Call Test
Status: ✅ PASS
- [ ] Browser interface loaded
- [ ] AI responded to query
- [ ] KB answer retrieved: "We're open Monday-Friday..."
- [ ] Call logged successfully

### Phase 6: Outbound Call Test
Status: ✅ PASS
- [ ] Call connected
- [ ] First message played
- [ ] AI responded to question
- [ ] KB answer retrieved: "Enterprise plans start at..."
- [ ] Call ended gracefully
- [ ] Call logged with caller ID

### Phase 7: Verification
Status: ✅ PASS
- [ ] Caller IDs verified in logs
- [ ] Dashboard shows 2 calls, 100% success
- [ ] Console clean (no critical errors)
- [ ] All API responses 200-201

## Issues Encountered
None

## Recommendations
Ready for production deployment. All features working as expected.

## Screenshots
[List location of screenshots or attach]

---
**Signed:** {date}
**Status:** APPROVED FOR DEPLOYMENT
```

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
1. Archive screenshots and test report
2. Document any configuration details
3. Share results with team
4. Deploy to production with confidence
5. Begin user acceptance testing

### If Tests Fail ❌
1. Capture all error details
2. Screenshot console errors
3. Document exact failure point
4. Create bug report with:
   - Step that failed
   - Expected behavior
   - Actual behavior
   - Screenshots & console logs
5. Roll back or debug as needed

### If Tests Are Conditional ⚠️
1. Document what worked vs. what didn't
2. Identify blockers vs. minor issues
3. Prioritize fixes by severity
4. Plan retesting after fixes
5. Consider partial deployment if blockers addressed

---

## 💡 Pro Tips for Testing

1. **Use Incognito/Private Window** - Ensures clean browser state
2. **Disable Browser Extensions** - Prevents conflicts
3. **Have DevTools Open** - Catch errors in real-time
4. **Test on Multiple Browsers** - Chrome + Firefox minimum
5. **Record Session** - Use browser screen recording for documentation
6. **Test on Different Network** - Mobile hotspot vs. wifi
7. **Use Different Phone Numbers** - If possible, test both landline and mobile
8. **Document Timing** - Note how long each phase takes
9. **Check Time Zones** - Ensure business hours question answers correctly
10. **Verify Transcripts** - Read full call transcripts for accuracy

---

## 🚀 Ready to Test?

**Option A: Use Claude with Browser MCP**
```
1. Open Claude Code
2. Run: /browse https://voxanne.ai
3. Copy E2E_TEST_BROWSER_MCP_PROMPT.md content
4. Paste prompt and start testing
```

**Option B: Manual Testing with AI Guidance**
```
1. Go to https://voxanne.ai
2. Share this file with Claude
3. Work through phases one-by-one
4. Claude provides feedback at each step
```

**Option C: Scheduled Automated Testing**
```
1. Set up recurring test (weekly/daily)
2. Use same prompt each time
3. Automate screenshot capture
4. Generate trend reports over time
```

---

**You're ready to perform comprehensive E2E testing of Voxanne AI!**
**Expected completion time: ~40 minutes**
**Expected outcome: 100% pass rate with production deployment approval**

Good luck! 🎉
