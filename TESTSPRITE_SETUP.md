# TestSprite Setup & Execution Guide

## Overview

This guide walks you through setting up and running the TestSprite E2E test suite for Voxanne AI. TestSprite provides comprehensive testing across:

- ✅ **Authentication** - Signup, login, multi-tenant isolation
- ✅ **Booking System** - Calendar integration, race conditions, double booking prevention
- ✅ **Billing** - Stripe checkout, credit deduction, kill switch
- ✅ **Dashboard** - UI rendering, analytics, call logs
- ✅ **Security** - XSS prevention, SQL injection, PHI redaction
- ✅ **Performance** - Load times, concurrent users, API response times
- ✅ **Visual Regression** - Screenshot comparisons, component changes

---

## Prerequisites

**Before starting, ensure you have:**

- [ ] TestSprite account created
- [ ] API key obtained: `sk-user-X3_mgC-wz8zEpLNciWCq_r062aH2Z30xHiKJ3lUF3cwUtJ9dtju9eP5uYx85UMMgAxtCbBXxrezjJiFjnU4jBkLQ2xtf35Hw6izE6ZZ3pjBtTeMvueKTgn2JQtiuzbpfg90`
- [ ] Test account verified: `test@demo.com` / `demo123`
- [ ] Production URLs accessible: `https://voxanne.ai`, `https://voxanneai.onrender.com`
- [ ] Database access for verification queries (Supabase)
- [ ] Node.js v18+ installed

---

## Step 1: Add TestSprite MCP Server

**Command:**
```bash
claude mcp add TestSprite \
  --env API_KEY=sk-user-X3_mgC-wz8zEpLNciWCq_r062aH2Z30xHiKJ3lUF3cwUtJ9dtju9eP5uYx85UMMgAxtCbBXxrezjJiFjnU4jBkLQ2xtf35Hw6izE6ZZ3pjBtTeMvueKTgn2JQtiuzbpfg90 \
  -- npx @testsprite/testsprite-mcp@latest
```

**Verification:**
```bash
# Check MCP server status
claude mcp list

# Expected output:
# ✓ TestSprite (running)
```

---

## Step 2: Install Dependencies

**Root Directory:**
```bash
npm install --save-dev @testsprite/cli @testsprite/core @testsprite/assertions
```

**Backend Directory:**
```bash
cd backend
npm install --save-dev ts-node dotenv
```

---

## Step 3: Configure Environment Variables

Create `.env.testsprite` in the root directory:

```bash
# TestSprite Configuration
TESTSPRITE_API_KEY=sk-user-X3_mgC-wz8zEpLNciWCq_r062aH2Z30xHiKJ3lUF3cwUtJ9dtju9eP5uYx85UMMgAxtCbBXxrezjJiFjnU4jBkLQ2xtf35Hw6izE6ZZ3pjBtTeMvueKTgn2JQtiuzbpfg90

# Test Account
TEST_ACCOUNT_EMAIL=test@demo.com
TEST_ACCOUNT_PASSWORD=demo123

# Supabase Database (for assertions)
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Vapi Private Key (for API testing)
VAPI_PRIVATE_KEY=<your_vapi_private_key>

# Optional: Slack Notifications
SLACK_WEBHOOK_URL=<your_slack_webhook>
```

**Security Note:** Never commit `.env.testsprite` to git. It's already excluded in `.gitignore`.

---

## Step 4: Retrieve Test Organization ID

**Run the helper script:**
```bash
cd backend
npx ts-node src/scripts/get-test-org-id.ts
```

**Expected Output:**
```
✅ Test Account Found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:        test@demo.com
Name:         (not set)
Org ID:       xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Org Name:     Test Demo Organization
Org Email:    test@demo.com
Created:      2/20/2026, 12:00:00 PM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Export for TestSprite:
export TEST_ORG_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

📊 Test Data Summary:
  Contacts:     12
  Calls:        8
  Appointments: 0
  Agents:       1
```

**Save the `TEST_ORG_ID` to your `.env.testsprite` file.**

---

## Step 5: Run Your First Test

**Quick Smoke Test:**
```bash
npx testsprite run \
  --config testsprite.config.yml \
  --suite smoke \
  --browser chrome \
  --env production
```

**Expected Output:**
```
TestSprite v2.0.0

Running smoke test suite...
✓ auth.login (1.2s)
✓ dashboard.load (0.8s)
✓ api.health (0.3s)

Tests: 3 passed, 0 failed, 3 total
Time:  2.5s

Screenshots: ./test-results/screenshots
Videos:      (none - all tests passed)
```

---

## Step 6: Run Full Test Suites

**Authentication Tests:**
```bash
npx testsprite run \
  --tests tests/testsprite/auth/auth.spec.ts \
  --browser chrome \
  --env production
```

**Booking Flow Tests:**
```bash
npx testsprite run \
  --tests tests/testsprite/booking/booking.spec.ts \
  --browser chrome \
  --env production
```

**Billing Tests:**
```bash
npx testsprite run \
  --tests tests/testsprite/billing/billing.spec.ts \
  --browser chrome \
  --env production
```

**All Tests (Full Regression):**
```bash
npx testsprite run \
  --config testsprite.config.yml \
  --suite full_regression \
  --browsers chrome,firefox,safari \
  --parallel \
  --env production
```

---

## Step 7: View Test Results

**Test Results Directory:**
```
test-results/
├── screenshots/          # Screenshots of test execution
├── videos/              # Videos of failed tests
├── reports/             # JUnit/HTML reports
└── logs/                # Detailed execution logs
```

**View HTML Report:**
```bash
npx testsprite report \
  --format html \
  --output ./test-results/report.html

# Open in browser
open ./test-results/report.html
```

**View JUnit XML (for CI/CD):**
```bash
npx testsprite report \
  --format junit \
  --output ./test-results/junit.xml
```

---

## Step 8: Continuous Integration (Optional)

The project includes a GitHub Actions workflow for automated testing:

**File:** `.github/workflows/testsprite.yml`

**Triggers:**
- Every pull request to `main` or `develop`
- Daily at 2 AM UTC (scheduled)
- Manual workflow dispatch

**Configuration:**

1. Add secrets to GitHub repository:
   - `TESTSPRITE_API_KEY`
   - `TEST_ACCOUNT_PASSWORD`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VAPI_PRIVATE_KEY`
   - `SLACK_WEBHOOK_URL` (optional)

2. Push to repository:
```bash
git add .
git commit -m "feat: Add TestSprite E2E testing"
git push origin main
```

3. Verify workflow runs:
   - Go to GitHub → Actions tab
   - Check "TestSprite E2E Tests" workflow

---

## Test Scenarios Covered

### Authentication (10 tests)
- ✅ User signup with auto-organization creation
- ✅ Login with valid credentials
- ✅ Reject invalid credentials
- ✅ Rate limiting on failed attempts
- ✅ Multi-tenant data isolation (User A ≠ User B)
- ✅ Session persistence across page refreshes
- ✅ Session expiration and redirect
- ✅ Logout functionality
- ✅ JWT org_id extraction
- ✅ Invalid JWT rejection

### Booking (12 tests)
- ✅ Google Calendar OAuth connection
- ✅ OAuth cancellation handling
- ✅ Full booking lifecycle (contact → availability → booking → dashboard)
- ✅ Booking conflict detection
- ✅ Race condition prevention (1000 concurrent attempts → 1 success)
- ✅ Concurrent bookings for different time slots
- ✅ Calendar event creation
- ✅ Calendar event update on reschedule
- ✅ Advisory lock verification
- ✅ Double booking prevention
- ✅ Timezone handling
- ✅ Multi-day booking support

### Billing (15 tests)
- ✅ Stripe Checkout completion
- ✅ Minimum top-up enforcement (£25)
- ✅ Checkout cancellation handling
- ✅ Automatic credit deduction after calls
- ✅ Duplicate billing prevention (idempotency)
- ✅ Kill switch at zero balance
- ✅ Low balance warning
- ✅ Credit reservation on call start
- ✅ Credit commitment on call end
- ✅ Unused credit release
- ✅ Transaction audit trail
- ✅ Balance calculation verification
- ✅ Rate accuracy (56 pence/min)
- ✅ Reservation expiration cleanup
- ✅ Concurrent reservation handling

---

## Performance Benchmarks

**Expected Metrics:**

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Dashboard Load (TTI) | <3s | TBD | ⏳ |
| API Response Time | <500ms | TBD | ⏳ |
| First Contentful Paint | <1.5s | TBD | ⏳ |
| Concurrent Users (50) | 100% success | TBD | ⏳ |
| Double Booking (1000) | 0 failures | TBD | ⏳ |

**Run Performance Tests:**
```bash
npx testsprite run \
  --suite performance \
  --browser chrome \
  --env production \
  --report-metrics
```

---

## Visual Regression Testing

**Create Baseline Screenshots:**
```bash
npx testsprite visual baseline \
  --config testsprite.config.yml \
  --pages dashboard,call-logs,analytics,wallet \
  --viewports desktop,tablet,mobile
```

**Compare Against Baseline:**
```bash
npx testsprite visual compare \
  --config testsprite.config.yml \
  --threshold 0.1
```

**Review Differences:**
```bash
npx testsprite visual report \
  --output ./test-results/visual-diff.html

open ./test-results/visual-diff.html
```

---

## Troubleshooting

### Issue: MCP Server Connection Failed

**Symptoms:**
```
Error: Cannot connect to TestSprite MCP server
```

**Resolution:**
1. Verify API key is correct
2. Check network connectivity
3. Restart MCP server:
```bash
claude mcp restart TestSprite
```

---

### Issue: Test Account Login Fails

**Symptoms:**
```
Error: Invalid credentials for test@demo.com
```

**Resolution:**
1. Verify account exists in database:
```bash
cd backend
npx ts-node src/scripts/get-test-org-id.ts
```

2. Check password:
```bash
# Password should be: demo123
```

3. Reset password if needed (via Supabase dashboard)

---

### Issue: Database Assertions Fail

**Symptoms:**
```
Error: Cannot connect to database
```

**Resolution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` in `.env.testsprite`
2. Check Supabase URL is correct
3. Test connection:
```bash
curl -X GET "https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/organizations" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

### Issue: Stripe Checkout Fails

**Symptoms:**
```
Error: Stripe checkout session creation failed
```

**Resolution:**
1. Ensure TestSprite is configured for Stripe test mode
2. Use test card: `4242 4242 4242 4242`
3. Verify `STRIPE_SECRET_KEY` in backend `.env`

---

### Issue: Vapi API Calls Fail

**Symptoms:**
```
Error: Unauthorized - Invalid x-vapi-secret
```

**Resolution:**
1. Verify `VAPI_PRIVATE_KEY` in `.env.testsprite`
2. Check key in Vapi dashboard (Settings → API Keys)
3. Ensure key is not expired

---

## Best Practices

### 1. Test Data Cleanup

**Always clean up test data after tests:**
```typescript
afterEach(async () => {
  // Clean up appointments
  await context.database.execute({
    sql: 'DELETE FROM appointments WHERE org_id = $1',
    params: [testOrgId]
  });

  // Clean up contacts created during test
  await context.database.execute({
    sql: 'DELETE FROM contacts WHERE org_id = $1 AND phone LIKE \'+1555%\'',
    params: [testOrgId]
  });
});
```

### 2. Idempotent Tests

**Design tests to be idempotent (run multiple times):**
```typescript
// Use unique identifiers
const testEmail = `test-${Date.now()}@testsprite.com`;
const callId = `call_test_${Date.now()}`;
```

### 3. Parallel Execution

**Run independent tests in parallel:**
```bash
npx testsprite run \
  --suite critical_path \
  --parallel \
  --max-workers 4
```

### 4. Screenshot on Failure

**Capture evidence of failures:**
```typescript
try {
  await page.click('button[type="submit"]');
} catch (error) {
  await page.screenshot({
    path: `./test-results/screenshots/error-${Date.now()}.png`
  });
  throw error;
}
```

---

## Support & Resources

**TestSprite Documentation:**
- Docs: https://docs.testsprite.com
- API Reference: https://docs.testsprite.com/api
- Examples: https://github.com/testsprite/examples

**Voxanne AI Testing:**
- Test Plan: `/Users/mac/.claude/plans/enchanted-tickling-sparkle.md`
- PRD: `.agent/prd.md`
- Database Schema: `.agent/database-ssot.md`

**Contact:**
- GitHub Issues: https://github.com/your-org/voxanne-ai/issues
- Slack: #testing channel
- Email: testing@voxanne.ai

---

## Next Steps

**After completing setup:**

1. ✅ Run smoke tests to verify configuration
2. ✅ Run full authentication suite
3. ✅ Run booking flow tests
4. ✅ Run billing tests
5. ✅ Create visual regression baselines
6. ✅ Configure CI/CD integration
7. ✅ Schedule daily automated runs
8. ✅ Set up Slack notifications
9. ✅ Review test results weekly
10. ✅ Expand test coverage as needed

**Congratulations! Your TestSprite E2E testing is now configured for Voxanne AI.**
