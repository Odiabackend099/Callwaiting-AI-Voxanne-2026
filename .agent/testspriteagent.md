# TestSprite MCP Execution Agent

## Purpose
This guide enables any AI developer to execute TestSprite MCP tests on the Voxanne AI project. TestSprite runs comprehensive E2E tests on cloud infrastructure and generates detailed test reports with visual test execution recordings.

---

## Prerequisites Check

Before executing TestSprite, verify:

1. **Servers Running:**
   ```bash
   # Frontend should respond on port 3000
   curl -I http://localhost:3000
   # Expected: HTTP/1.1 200 OK

   # Backend should respond on port 3001
   curl -s http://localhost:3001/health | head -5
   # Expected: {"status":"ok",...}
   ```

2. **TestSprite MCP Package Installed:**
   ```bash
   ls /Users/mac/.npm/_npx/8ddf6bea01b2519d/node_modules/@testsprite/testsprite-mcp/dist/index.js
   # Expected: File exists
   ```

3. **Test Configuration Exists:**
   ```bash
   ls testsprite_tests/testsprite_frontend_test_plan.json
   # Expected: File exists (64 test cases)
   ```

---

## Step 1: Get Fresh API Key

**User Action Required:**
1. Go to: https://www.testsprite.com/dashboard/settings/apikey
2. Click "Create New API Key"
3. Copy the full key (starts with `sk-user-`)
4. Provide it to the AI developer

**AI Developer:** Wait for the user to provide the API key before proceeding.

---

## Step 2: Execute TestSprite Tests

Once the user provides the API key, execute this command:

```bash
# Replace YOUR_API_KEY_HERE with the actual key provided by the user
API_KEY="YOUR_API_KEY_HERE" \
/usr/local/Cellar/node/25.5.0/bin/node \
/Users/mac/.npm/_npx/8ddf6bea01b2519d/node_modules/@testsprite/testsprite-mcp/dist/index.js \
generateCodeAndExecute \
2>&1 | tee /tmp/testsprite-execution-$(date +%Y%m%d-%H%M%S).log
```

**Example with actual API key:**
```bash
API_KEY="sk-user-yIcs5HUcLkpFxdgWvKKQIA22vbDE7kl_Kzm89BZ-_bv9JLmNocFWPP67d7BmtnepwooHdpRQ3bSNNrBqgWaQt-4r1fWm7mlagMrAIz9Xc41ftbLZt83xrdZjh3DJ8vdpNq4" \
/usr/local/Cellar/node/25.5.0/bin/node \
/Users/mac/.npm/_npx/8ddf6bea01b2519d/node_modules/@testsprite/testsprite-mcp/dist/index.js \
generateCodeAndExecute \
2>&1 | tee /tmp/testsprite-execution-$(date +%Y%m%d-%H%M%S).log
```

---

## Step 3: Monitor Execution

**Expected Output (Immediate):**
```
🚀 Starting test execution...
Proxy port: [random port number]
Tunnel started successfully! Proxy URL: http://[uuid]:[token]@tun.testsprite.com:8080
⚡ Running tests...
This process may take anywhere from several minutes up to 15 minutes to complete.

✅ Please ensure:
  • Your local servers are running and reachable
  • Your internet connection remains stable throughout the process
```

**Key Indicators:**
- ✅ **"Tunnel started successfully"** - Connection established
- ✅ **"Running tests..."** - Tests executing on cloud
- ❌ **"401 Unauthorized"** - API key invalid (get a new one)
- ❌ **"Your local application is not running"** - Check servers

**Execution Time:**
- Minimum: 5 minutes
- Maximum: 15 minutes
- Average: 8-12 minutes

---

## Step 4: Wait for Completion

**What Happens During Execution:**
1. TestSprite cloud spins up browser instances
2. Connects to your localhost via secure tunnel
3. Executes all 64 test cases sequentially
4. Captures screenshots and videos for failures
5. Generates comprehensive test report

**Completion Indicators:**
```
Test execution completed.
HTTP Proxy has been closed.
Tunnel has been closed.
Execution lock released.

Server will remain active for 1 hour. Press Ctrl+C to exit early.
```

---

## Step 5: Retrieve Test Results

After successful completion, check for generated reports:

```bash
# Check if raw report exists
ls -lh testsprite_tests/tmp/raw_report.md
# Expected: File exists (~30KB)

# Check if test results JSON exists
ls -lh testsprite_tests/tmp/test_results.json
# Expected: File exists (~100KB)

# View report summary
head -100 testsprite_tests/tmp/raw_report.md
```

**Report Structure:**
```
testsprite_tests/
├── tmp/
│   ├── raw_report.md          # Detailed test results with assertions
│   ├── test_results.json      # Structured test data (JSON)
│   └── config.json            # Updated configuration with tunnel credentials
└── testsprite_frontend_test_plan.json  # Original test plan (64 cases)
```

---

## Step 6: Analyze Results

### Quick Summary
```bash
# Count passed vs failed tests
grep -E "^- \*\*Status:\*\*" testsprite_tests/tmp/raw_report.md | \
  awk '{print $3}' | sort | uniq -c
```

**Expected Output:**
```
   7 ✅    # Passed tests
  57 ❌    # Failed tests
```

### View Test Details

Each test in the report includes:
- **Test Code:** Python file name (for reference)
- **Test Error:** Detailed failure assertions
- **Test Visualization URL:** Click to view in browser
- **Status:** ✅ Passed or ❌ Failed

**Example Test Entry:**
```markdown
#### Test TC001 View key analytics widgets on the Dashboard
- **Test Code:** [TC001_View_key_analytics_widgets_on_the_Dashboard.py](./TC001_...)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Dashboard page at /dashboard did not render any content after login
- Expected redirect to '/dashboard' was not observable
- Widgets not found on the page

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/[uuid]/[test-id]
- **Status:** ❌ Failed
```

### View Test Visualizations

Click any test visualization URL to see:
- Screenshots of test execution
- Step-by-step browser actions
- Video recording (for failures)
- Network requests
- Console logs

---

## Common Issues & Troubleshooting

### Issue 1: "401 Unauthorized"

**Cause:** API key is invalid or expired

**Solution:**
1. User must create a new API key at https://www.testsprite.com/dashboard/settings/apikey
2. Copy the FULL key (should be ~170 characters)
3. Re-run the command with the new key

---

### Issue 2: "Your local application is not running at http://localhost:3000/"

**Cause:** Tunnel cannot connect to localhost

**Solution:**
```bash
# Verify frontend is running
curl -I http://localhost:3000
# If this fails, start the frontend:
npm run dev

# Verify backend is running
curl http://localhost:3001/health
# If this fails, start the backend:
cd backend && npm run dev
```

---

### Issue 3: Tests timeout after 15 minutes

**Cause:** Backend responses are extremely slow

**What to check:**
1. Database connection (Supabase)
2. External API calls (Vapi, Twilio, Google Calendar)
3. Circuit breakers (may be in open state)
4. Backend logs for errors

**Note:** This is a known issue with ~48 tests. The tests themselves are working correctly - the application backend is responding too slowly.

---

### Issue 4: Tunnel connection fails

**Symptoms:**
```
Error: Failed to set up testing tunnel
```

**Solution:**
1. Check internet connection
2. Check firewall settings (macOS may block the proxy)
3. Try running the command again (tunnel credentials regenerate each run)

---

## Understanding Test Results

### Test Categories (64 total tests)

1. **Dashboard Analytics** (7 tests)
   - Widget display, metrics, activity feed

2. **Call Logs** (7 tests)
   - Search, filter, details, SMS follow-up

3. **Appointments** (8 tests)
   - List, pagination, reschedule, cancel, validation

4. **Agent Configuration** (7 tests)
   - Edit, tabs, phone assignment, test calls

5. **Wallet & Billing** (7 tests)
   - Balance, top-up, Stripe, auto-recharge, transactions

6. **Phone Settings** (8 tests)
   - Buy number, AI forwarding, delete number, validation

7. **Verified Caller ID** (8 tests)
   - Verification flow, status, validation, removal

8. **Test Agent** (3 tests)
   - Text chat, Enter key, validation

9. **Knowledge Base** (2 tests)
   - Manual entry, validation

10. **Onboarding** (7 tests)
    - Intake form, voice selection, validation

### Typical Pass Rate

**Expected Results:**
- **First Run:** 7 passed (11%), 57 failed (89%)
- **After Fixes:** Should improve to 40-50+ passed

**Common Failures:**
- Dashboard not loading after login
- Backend connectivity issues
- 15-minute timeout on complex features
- Missing UI controls (filters, pagination)

---

## Post-Execution Actions

### 1. Share Results with User

Provide this summary:
```
✅ TestSprite Execution Complete

Total Tests: 64
Passed: [X] tests
Failed: [Y] tests

Reports Generated:
- testsprite_tests/tmp/raw_report.md (detailed results)
- testsprite_tests/tmp/test_results.json (structured data)

View full report:
cat testsprite_tests/tmp/raw_report.md

Each test has a visualization URL - open in browser to see:
- Screenshots
- Videos
- Step-by-step execution
- Network logs
```

### 2. Identify Critical Issues

From the report, extract:
- Tests that block multiple features (login, dashboard)
- Tests with "Backend server not reachable" errors
- Tests that timeout (indicate performance issues)

### 3. Recommend Fixes

Prioritize fixes by impact:
1. **Critical:** Fix login/dashboard loading
2. **High:** Fix backend connectivity
3. **Medium:** Fix missing UI controls
4. **Low:** Optimize performance for timeout tests

---

## Configuration Files

### testsprite_tests/tmp/config.json

This file is auto-generated and updated on each run:

```json
{
  "projectPath": "/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026",
  "testAccount": {
    "email": "test@demo.com",
    "password": "demo123",
    "orgId": "ad9306a9-4d8a-4685-a667-cbeb7eb01a07"
  },
  "baseUrl": "http://localhost:3000",
  "apiUrl": "http://localhost:3001",
  "executionArgs": {
    "projectName": "Callwaiting-AI-Voxanne-2026",
    "projectPath": "/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026",
    "testIds": [],
    "additionalInstruction": "Test against local servers. Frontend: http://localhost:3000, Backend: http://localhost:3001. Login: test@demo.com / demo123.",
    "envs": {
      "API_KEY": "[current API key]"
    }
  },
  "serverPort": [random port],
  "proxy": "http://[uuid]:[token]@tun.testsprite.com:8080"
}
```

**Note:** The `serverPort` and `proxy` values change on each execution.

---

## Advanced Usage

### Run Specific Test Cases

To run only specific tests, modify the command:

```bash
# Example: Run only dashboard tests (TC001-TC007)
API_KEY="YOUR_API_KEY" \
/usr/local/Cellar/node/25.5.0/bin/node \
/Users/mac/.npm/_npx/8ddf6bea01b2519d/node_modules/@testsprite/testsprite-mcp/dist/index.js \
generateCodeAndExecute \
--testIds TC001,TC002,TC003,TC004,TC005,TC006,TC007
```

### Re-run Failed Tests

After fixing issues, re-run only failed tests:

```bash
API_KEY="YOUR_API_KEY" \
/usr/local/Cellar/node/25.5.0/bin/node \
/Users/mac/.npm/_npx/8ddf6bea01b2519d/node_modules/@testsprite/testsprite-mcp/dist/index.js \
reRunTests
```

---

## Documentation & Support

**Official TestSprite Documentation:**
- Installation: https://docs.testsprite.com/mcp/getting-started/installation
- Troubleshooting: https://docs.testsprite.com/mcp/troubleshooting/application-detection-issues
- npm Package: https://www.npmjs.com/package/@testsprite/testsprite-mcp

**Voxanne Project Documentation:**
- Test Plan: `testsprite_tests/testsprite_frontend_test_plan.json`
- PRD: `.agent/prd.md`
- Database Schema: `.agent/database-ssot.md`

---

## Quick Command Reference

```bash
# 1. Verify servers are running
curl -I http://localhost:3000 && curl -s http://localhost:3001/health | head -5

# 2. Execute TestSprite (replace API_KEY)
API_KEY="sk-user-..." /usr/local/Cellar/node/25.5.0/bin/node /Users/mac/.npm/_npx/8ddf6bea01b2519d/node_modules/@testsprite/testsprite-mcp/dist/index.js generateCodeAndExecute 2>&1 | tee /tmp/testsprite-$(date +%Y%m%d-%H%M%S).log

# 3. View results summary
grep -E "^- \*\*Status:\*\*" testsprite_tests/tmp/raw_report.md | awk '{print $3}' | sort | uniq -c

# 4. View full report
cat testsprite_tests/tmp/raw_report.md

# 5. Check execution log
tail -100 /tmp/testsprite-*.log
```

---

## Success Checklist

Before marking execution as complete, verify:

- [ ] Tunnel connected successfully (no 401 errors)
- [ ] All 64 test cases executed (check report)
- [ ] Reports generated (raw_report.md + test_results.json)
- [ ] Test summary provided to user
- [ ] Critical issues identified and documented
- [ ] User can access test visualization URLs

---

**Last Updated:** 2026-02-20
**TestSprite MCP Version:** Latest (@testsprite/testsprite-mcp)
**Project:** Voxanne AI (Callwaiting-AI-Voxanne-2026)
