# End-to-End Browser MCP Testing Prompt for Voxanne AI
**Purpose:** Comprehensive E2E test of complete user workflow from login to live call handling
**Test Scope:** Agent provisioning, knowledge base sync, inbound/outbound calls, caller ID verification
**Setup:** Fresh organization creation for clean test environment
**Date:** February 24, 2026

---

## AID Prompt: Complete E2E User Flow Testing

```
You are an expert QA engineer testing the Voxanne AI platform using browser MCP capabilities.
Your goal is to perform a comprehensive end-to-end test covering the complete user workflow.

TEST SCOPE:
1. Create fresh test organization (clean environment)
2. Login to platform
3. Provision inbound phone number
4. Provision outbound phone number
5. Configure inbound agent
6. Configure outbound agent
7. Upload and sync knowledge base
8. Execute inbound call test (browser-based)
9. Execute outbound call test (AI forwarding)
10. Verify caller ID and all system responses

INSTRUCTIONS:

### PHASE 1: Organization & Login Setup

1. **Navigate to Platform**
   - Go to: https://voxanne.ai
   - Verify: Page loads, login form visible
   - Screenshot: capture login page

2. **Login Process**
   - Email: test-org-owner@voxanne-e2e-test.com
   - Password: [Use secure test password]
   - Verify: Successfully authenticated
   - Check: Dashboard loads, no errors in console
   - Screenshot: capture dashboard after login

3. **Verify Fresh Organization**
   - Check: Organization created automatically on first login
   - Org Name: "E2E Test Org - {timestamp}"
   - Verify: Empty state (no agents yet)
   - Screenshot: capture empty dashboard

### PHASE 2: Phone Number Provisioning

4. **Provision Inbound Number**
   - Navigate: Dashboard → Phone Settings → Inbound Numbers
   - Click: "Buy Inbound Number"
   - Country: United States
   - Area Code: 415 (San Francisco - for testing)
   - Verify: Number selection shown
   - Select: First available number
   - Screenshot: capture number selection
   - Click: "Purchase Number"
   - Wait: 3-5 seconds for provisioning
   - Verify: Success message appears
   - Check: Inbound number now displays in Phone Settings
   - Screenshot: capture confirmation with number

5. **Provision Outbound Number**
   - Navigate: Dashboard → Phone Settings → Outbound Caller ID
   - Click: "Configure Outbound Number"
   - Enter: Business Name: "E2E Test Org"
   - Enter: Caller ID Number: (same as or different inbound number)
   - Click: "Save Outbound Configuration"
   - Wait: 2-3 seconds for configuration
   - Verify: Outbound caller ID now active
   - Screenshot: capture outbound number confirmation

### PHASE 3: Agent Configuration

6. **Create Inbound Agent**
   - Navigate: Agent Config → Inbound Tab
   - Fill Form:
     * Agent Name: "E2E Inbound Agent"
     * Voice: Select "ElevenLabs - Aria (Female)"
     * Language: English (US)
     * System Prompt: "You are a helpful customer service representative for E2E Test Org. Answer customer questions accurately and professionally."
     * First Message: "Hello! Thank you for calling E2E Test Org. How can I help you today?"
   - Click: Test Voice Preview
   - Wait: Voice preview plays (verify audio in browser)
   - Screenshot: capture agent config form
   - Click: Save Agent
   - Wait: 2-3 seconds for API response
   - Verify: Success notification appears
   - Check: Agent appears in Agent Config list
   - Screenshot: capture saved agent

7. **Create Outbound Agent**
   - Navigate: Agent Config → Outbound Tab
   - Fill Form:
     * Agent Name: "E2E Outbound Agent"
     * Voice: Select "ElevenLabs - Liam (Male)"
     * Language: English (US)
     * System Prompt: "You are an AI sales representative for E2E Test Org. Your goal is to schedule appointments and collect customer information professionally."
     * First Message: "Hi! This is an automated call from E2E Test Org. Do you have a minute to discuss our services?"
   - Click: Test Voice Preview
   - Wait: Voice preview plays
   - Screenshot: capture outbound agent config
   - Click: Save Agent
   - Verify: Success notification
   - Screenshot: capture saved outbound agent

### PHASE 4: Knowledge Base Sync

8. **Upload Knowledge Base**
   - Navigate: Agent Config → Knowledge Base
   - Click: "Upload Knowledge Base"
   - Prepare Test Content:
     * Create simple text file with sample Q&A:
       - Q: "What are your business hours?"
       - A: "We're open Monday-Friday, 9 AM - 6 PM EST"
       - Q: "What is your pricing?"
       - A: "Enterprise plans start at $1,000/month with custom features"
   - Upload: Knowledge base file
   - Wait: 3-5 seconds for processing
   - Verify: Upload success message
   - Check: Knowledge base appears in agent config
   - Screenshot: capture knowledge base status

9. **Sync Knowledge Base to Agents**
   - Navigate: Agent Config → Sync Settings
   - Select: Both Inbound and Outbound agents
   - Click: "Sync Knowledge Base"
   - Wait: 2-3 seconds for sync
   - Verify: Success message "Knowledge base synced to 2 agents"
   - Check: Agents now have access to KB
   - Screenshot: capture sync confirmation

### PHASE 5: Inbound Call Test

10. **Trigger Inbound Call Test**
    - Navigate: Agent Config → Inbound Agent
    - Click: "Test in Browser"
    - Wait: Inbound call interface loads
    - Verify: Phone widget appears
    - Screenshot: capture phone widget

11. **Execute Inbound Call Interaction**
    - Speak: "What are your business hours?"
    - Wait: AI processes and responds
    - Verify: Agent retrieves answer from knowledge base
    - Expected Response: "We're open Monday-Friday, 9 AM - 6 PM EST"
    - Screenshot: capture AI response in browser
    - Speak: "Can you schedule an appointment?"
    - Wait: AI responds
    - Expected: Agent provides appointment scheduling options
    - Screenshot: capture conversation

12. **Verify Inbound Call Logging**
    - Navigate: Dashboard → Call Logs
    - Verify: Inbound test call appears in logs
    - Check: Call details:
      * Direction: Inbound
      * Duration: [should show actual duration]
      * Participant: Test Org Phone Number
      * Transcript: Contains your test questions
    - Screenshot: capture call log entry

### PHASE 6: Outbound Call Test (AI Forwarding)

13. **Trigger Outbound Call Test**
    - Navigate: Agent Config → Outbound Agent
    - Verify: "Test Call" button available
    - Note: Requires valid test number to call
    - For E2E: Use test phone number or your own number
    - Click: "Test Call"
    - Enter: Recipient Phone: [Use test number: +1-555-TEST-1234 or real number]
    - Click: "Initiate Call"
    - Wait: 5-10 seconds for connection
    - Screenshot: capture call initiation

14. **Execute Outbound Call Interaction**
    - Verify: Call connects successfully
    - Listen: First message plays: "Hi! This is an automated call from E2E Test Org..."
    - Speak: "Tell me about your pricing"
    - Wait: AI retrieves from knowledge base
    - Expected Response: "Enterprise plans start at $1,000/month with custom features"
    - Screenshot: capture call interface
    - Speak: "I'm interested, schedule me for a demo"
    - Wait: AI responds with scheduling
    - Speak: "Goodbye"
    - Verify: Call ends gracefully
    - Screenshot: capture call end confirmation

15. **Verify Outbound Call Logging**
    - Navigate: Dashboard → Call Logs
    - Verify: Outbound test call appears
    - Check: Call details:
      * Direction: Outbound
      * Caller ID: Matches configured outbound number
      * Duration: [Actual duration shown]
      * Status: Completed
      * Transcript: Contains conversation
    - Screenshot: capture call log entry

### PHASE 7: Caller ID Verification

16. **Verify Caller ID for Inbound**
    - Navigate: Phone Settings → Inbound Numbers
    - Verify: Inbound number displays correctly
    - Check: Number format: E.164 (+1-415-XXXX-XXXX)
    - Screenshot: capture inbound number

17. **Verify Caller ID for Outbound**
    - Navigate: Phone Settings → Outbound Caller ID
    - Verify: Outbound caller ID displays as set
    - Check: Matches configuration from earlier
    - Screenshot: capture outbound caller ID

18. **Verify in Call Logs**
    - Navigate: Dashboard → Call Logs
    - For Inbound Call: Verify "from" shows caller ID
    - For Outbound Call: Verify "from" shows configured outbound number
    - Screenshot: capture both call logs side-by-side

### PHASE 8: System Verification

19. **Dashboard Metrics Verification**
    - Navigate: Dashboard → Analytics
    - Verify: Total calls shows 2 (1 inbound, 1 outbound)
    - Check: Call duration reflects actual durations
    - Check: Success rate shows 100% (both completed)
    - Check: Average handling time calculated correctly
    - Screenshot: capture dashboard analytics

20. **Agent Status Verification**
    - Navigate: Agent Config
    - Verify: Both agents show "Active" status
    - Check: Last activity timestamp is recent
    - Check: Configuration saved indicators present
    - Screenshot: capture agent status

21. **Console & Error Verification**
    - Open: Browser DevTools (F12)
    - Navigate: Console tab
    - Verify: No critical errors
    - Check: No red error messages
    - Check: Only warnings are acceptable
    - Screenshot: capture clean console

22. **Network Activity Verification**
    - Navigate: Network tab in DevTools
    - Filter: XHR requests only
    - Verify: All API calls return 200-201 status
    - Check: No 4xx or 5xx errors
    - Check: Response times reasonable (<1000ms)
    - Screenshot: capture network requests

### PHASE 9: Final Validation

23. **Complete End-to-End Checklist**
    Verify the following were successful:
    - [ ] Organization created (fresh, clean state)
    - [ ] Login successful (authenticated)
    - [ ] Inbound number provisioned (displays in settings)
    - [ ] Outbound number provisioned (caller ID configured)
    - [ ] Inbound agent created (name, voice, prompts saved)
    - [ ] Outbound agent created (name, voice, prompts saved)
    - [ ] Knowledge base uploaded (file processed)
    - [ ] Knowledge base synced to agents (both agents updated)
    - [ ] Inbound call test executed (AI responded correctly)
    - [ ] Inbound call logged (appears in call logs with transcript)
    - [ ] Outbound call test initiated (connected successfully)
    - [ ] Outbound call executed (AI responded, caller ID correct)
    - [ ] Outbound call logged (appears in call logs)
    - [ ] Caller ID verified for inbound (correct in logs)
    - [ ] Caller ID verified for outbound (correct in logs)
    - [ ] Dashboard metrics updated (2 calls, 100% success)
    - [ ] No console errors (DevTools clean)
    - [ ] No network errors (all 200/201 responses)
    - [ ] Agent status shows Active (both agents)
    - [ ] All screenshots captured

24. **Generate Test Report**
    Create summary with:
    - Test Start Time: [timestamp]
    - Test End Time: [timestamp]
    - Total Duration: [calculated]
    - Tests Passed: 20/20 (or actual count)
    - Tests Failed: 0 (or actual count)
    - Critical Issues: None (or list)
    - Warnings: None (or list)
    - Screenshots: [list locations]
    - Recommendation: PASS / CONDITIONAL / FAIL

### PHASE 10: Cleanup & Documentation

25. **Document Results**
    - File: E2E_TEST_RESULTS_{timestamp}.md
    - Include: All screenshots
    - Include: Test timings
    - Include: Any issues encountered
    - Include: Recommendations

26. **Export Test Data (Optional)**
    - Export: Call logs as CSV
    - Export: Agent configuration as JSON
    - Archive: All test artifacts

EXPECTED BEHAVIOR:

✅ All workflows should complete without errors
✅ AI should correctly answer knowledge base questions
✅ Caller ID should display correctly in all logs
✅ Call quality should be clear (if using real numbers)
✅ Performance should be responsive (<1s for most operations)
✅ No console errors or warnings (unless documented)
✅ All API responses should be successful (200-201)

FAILURE SCENARIOS TO CHECK:

❌ If agent fails to respond: Check knowledge base sync status
❌ If caller ID is wrong: Verify phone provisioning settings
❌ If call won't connect: Check Vapi integration and credentials
❌ If API errors occur: Check network tab for 4xx/5xx responses
❌ If console has errors: Screenshot and document error details

TOOLS & RESOURCES:

- Browser: Chrome/Firefox with DevTools
- Phone Test Numbers: +1-555-TEST-1234 (dummy) or real test number
- Knowledge Base Template: [Sample Q&A file provided]
- Screenshots: Save to /tmp/e2e-test-results/

TIMING EXPECTATIONS:

- Total Test Duration: 30-45 minutes
- Each Phase: 3-5 minutes
- Wait Times: Included in timings (API processing 2-5 seconds)

PASS CRITERIA:

✅ All 26 steps completed successfully
✅ No critical errors encountered
✅ Both inbound and outbound calls successful
✅ Caller ID verified in all logs
✅ Knowledge base questions answered correctly
✅ Dashboard metrics accurate
✅ Clean console (no errors)
✅ All API responses successful

REPORT TEMPLATE:

---
## E2E Test Report: {timestamp}

**Organization:** E2E Test Org - {org_id}
**Tester:** [Your Name]
**Duration:** [Time in minutes]

### Summary
- Tests Executed: 26
- Tests Passed: [count]
- Tests Failed: [count]
- Success Rate: [percentage]

### Phase Results
- Phase 1 (Setup): ✅ PASS
- Phase 2 (Phones): ✅ PASS
- Phase 3 (Agents): ✅ PASS
- Phase 4 (KB): ✅ PASS
- Phase 5 (Inbound): ✅ PASS
- Phase 6 (Outbound): ✅ PASS
- Phase 7 (Caller ID): ✅ PASS
- Phase 8 (System): ✅ PASS
- Phase 9 (Validation): ✅ PASS

### Issues Found
[List any issues, or "None"]

### Recommendations
[Deployment recommendation or fixes needed]

### Sign-Off
Date: {timestamp}
Status: READY FOR PRODUCTION (or conditional notes)
---

PROCEED WITH COMPREHENSIVE E2E TESTING USING BROWSER MCP.
CAPTURE SCREENSHOTS AT EACH MAJOR STEP.
DOCUMENT ANY DEVIATIONS OR ISSUES.
PROVIDE DETAILED REPORT UPON COMPLETION.
```

---

## Usage Instructions for AID/Claude

1. **Copy the prompt above** (the section starting with "You are an expert QA engineer...")

2. **In Claude Code or Claude Chat:**
   - Paste the complete prompt
   - Add context: "I have a fresh Voxanne AI deployment. Please execute this comprehensive E2E test."
   - Enable browser MCP if available
   - Request step-by-step screenshots

3. **Alternative: Use with Browser MCP Directly**
   ```
   /browse https://voxanne.ai
   [Paste E2E testing prompt]
   [Follow AI instructions step-by-step]
   ```

4. **Document Results:**
   - Collect all screenshots
   - Save test report
   - Note any issues or deviations
   - Archive for future reference

---

## Key Testing Areas Covered

✅ **Organization Setup** - Fresh org creation
✅ **Authentication** - Login flow
✅ **Phone Provisioning** - Inbound & outbound numbers
✅ **Agent Configuration** - Both agent types
✅ **Voice Selection** - Multiple voice options
✅ **Knowledge Base** - Upload and sync
✅ **Inbound Calls** - Browser-based test
✅ **Outbound Calls** - AI forwarding test
✅ **Caller ID** - Verification in logs
✅ **Call Logging** - Complete transcripts
✅ **Dashboard Analytics** - Metrics accuracy
✅ **System Health** - Console & network verification

---

## Success Criteria

| Criteria | Status | Notes |
|----------|--------|-------|
| Fresh Org Created | ✅ | Clean database state |
| Login Successful | ✅ | Authentication working |
| Phones Provisioned | ✅ | Both inbound & outbound |
| Agents Configured | ✅ | Both with proper settings |
| KB Synced | ✅ | Agents have knowledge access |
| Inbound Call Works | ✅ | AI responds, KB retrieved |
| Outbound Call Works | ✅ | AI initiates, caller ID correct |
| Caller ID Verified | ✅ | Correct in all logs |
| No Errors | ✅ | Console clean, API healthy |
| Metrics Accurate | ✅ | Dashboard shows 2 calls |

---

## Troubleshooting Guide

**If Inbound Call Fails:**
- Check knowledge base sync status
- Verify agent is in "Active" state
- Check browser console for errors
- Try refreshing the test page

**If Outbound Call Fails:**
- Verify phone number is valid
- Check caller ID configuration
- Verify Vapi integration status
- Check network tab for API errors

**If Caller ID is Wrong:**
- Re-verify outbound number configuration
- Check Phone Settings page
- Ensure provisioning completed successfully

**If Knowledge Base Questions Unanswered:**
- Verify knowledge base file uploaded
- Check file format (should be text/markdown)
- Re-sync knowledge base to agents
- Check agent logs for KB retrieval errors

---

This comprehensive prompt can be used with Claude's browser MCP capabilities to execute a complete end-to-end test of the Voxanne AI platform.
