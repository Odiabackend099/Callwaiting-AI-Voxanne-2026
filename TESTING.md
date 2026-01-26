# Testing Guide - Hybrid Telephony Feature

This document explains how to run the comprehensive test suite for the Hybrid Telephony feature.

## Overview

The test suite is organized into three levels:

1. **Frontend Unit Tests** (`vitest`) - Component logic and utility functions
2. **E2E Tests** (`Playwright`) - Full application workflows and accessibility
3. **Nuclear Integration Tests** (`Playwright + Mock Server`) - Full stack verification without real API calls

## Quick Start

### Run All Tests

```bash
npm run test:all
```

### Run Only Nuclear Telephony Tests

```bash
# Standard run
npm run test:nuclear

# Interactive UI mode
npm run test:nuclear:ui

# Debug mode with step-through
npm run test:nuclear:debug
```

## Test Setup

### Prerequisites

1. **Node.js** 18+ installed
2. **npm** or **yarn** package manager
3. **Playwright** browsers (installed via `npm install`)

### Environment Configuration

1. Copy the test environment file:

```bash
cp .env.test.example .env.test
```

2. Update values if needed (most defaults work for local testing)

## Nuclear Test Suite Architecture

### What are "Nuclear Tests"?

Nuclear tests are comprehensive integration tests that verify the entire Hybrid Telephony feature stack:

- **Database** - In-memory mock (no real database access)
- **Backend API** - Mock server running locally (no Twilio calls)
- **Frontend UI** - Real browser automation (Chromium, Firefox, WebKit)
- **Network** - Simulated latency (configurable)
- **Edge Cases** - Rate limiting, validation, error handling

### Test Structure

Located at: `tests/telephony-nuclear.test.ts`

The test suite has **21 test cases** organized into 6 phases:

#### Phase 1: Backend API Integration (8 tests)
- Phone number verification initiation
- Verification confirmation
- GSM code generation for different carriers
- Verified number listing and deletion
- Forwarding config creation
- Setup confirmation

**Key Validations:**
- E.164 phone number format validation
- HTTP status codes (200, 400, 404, 429)
- Response structure and data types
- RequestId generation and tracing

#### Phase 2: Type Safety & Error Handling (3 tests)
- Invalid phone format rejection
- Missing required fields handling
- Proper error messages

#### Phase 3: Security Tests (3 tests)
- Rate limiting enforcement (3 attempts/hour per phone)
- Verification code expiration (10 minutes)
- Cross-organization access blocking (403)

**Critical Test:**
```javascript
test('Security: Enforce Rate Limiting (3 attempts per hour)', async () => {
  // Makes 4 requests, expects 4th to fail with 429 Too Many Requests
})
```

#### Phase 4: Edge Cases (3 tests)
- Already verified phone number handling
- Duplicate forwarding config prevention
- Carrier-specific code variations

#### Phase 5: Data Consistency (2 tests)
- Verified numbers persist across requests
- Forwarding configs maintain state

#### Phase 6: Performance Tests (2 tests)
- API response time < 100ms
- Mock server initialization < 5 seconds

### Mock Server Details

Located at: `tests/mocks/mock-server.ts`

**Port:** 3001 (configurable via `MOCK_SERVER_PORT` env var)

**Features:**
- In-memory data stores (Map-based)
- Rate limiting per phone number
- GSM code generation for all carriers
- Simulated network latency (default 50ms)
- Request logging with timestamps
- Health check endpoint

**Endpoints:**
```
POST   /health (health check)
POST   /api/telephony/verify-caller-id/initiate
POST   /api/telephony/verify-caller-id/confirm
GET    /api/telephony/verified-numbers
DELETE /api/telephony/verified-numbers/:id
POST   /api/telephony/forwarding-config
GET    /api/telephony/forwarding-config
POST   /api/telephony/forwarding-config/confirm
```

## Running Tests

### Option 1: Full Automated Test (Recommended)

```bash
npm run test:nuclear
```

This command:
1. Starts the mock server on port 3001
2. Starts the Next.js dev server on port 3000
3. Runs all 21 tests in Chromium, Firefox, and WebKit
4. Generates HTML report at `playwright-report/index.html`
5. Generates JSON report at `test-results/results.json`
6. Generates JUnit XML at `test-results/junit.xml`

**Expected Output:**
```
✓ Phase 1: Backend API Integration
  ✓ API: Verify Phone Number - Happy Path
  ✓ API: Verify Phone Number - Invalid Format
  ✓ API: Confirm Verification
  ✓ API: List Verified Numbers
  ✓ API: Delete Verified Number
  ✓ API: Generate GSM Codes - T-Mobile Total AI
  ✓ API: Generate GSM Codes - AT&T Safety Net
  ✓ API: Generate GSM Codes - Verizon Total AI

✓ Phase 2: Type Safety & Error Handling
  ✓ Security: Invalid Phone Format Rejected
  ✓ Security: Missing Required Fields Rejected
  ✓ Error Handling: Proper Error Messages

✓ Phase 3: Security Tests
  ✓ Security: Enforce Rate Limiting
  ✓ Security: Verification Code Expiration
  ✓ Security: Cross-Organization Access Blocked

✓ Phase 4: Edge Cases
  ✓ Edge Case: Already Verified Number
  ✓ Edge Case: Duplicate Forwarding Config
  ✓ Edge Case: Carrier Variations

✓ Phase 5: Data Consistency
  ✓ Data: Verified Numbers Persist
  ✓ Data: Forwarding Configs Maintain State

✓ Phase 6: Performance
  ✓ Performance: API Response Time
  ✓ Performance: Mock Server Initialization

✓ 21 passed (15s)
```

### Option 2: Interactive UI Mode

```bash
npm run test:nuclear:ui
```

This opens a browser-based test runner where you can:
- Watch tests run in real-time
- Step through individual test cases
- See screenshots/videos on failure
- Inspect DOM states

### Option 3: Debug Mode

```bash
npm run test:nuclear:debug
```

This opens Playwright Inspector for step-by-step debugging.

### Option 4: Manual Server + Test Separation

If you want to debug servers separately:

**Terminal 1 - Start Mock Server:**
```bash
npm run mock:server
```

**Terminal 2 - Run Tests:**
```bash
npx playwright test tests/telephony-nuclear.test.ts --headed
```

## Test Reports

After running tests, reports are available:

### HTML Report
```bash
npm run test:e2e:ui
# Opens browser with detailed test results, screenshots, and videos
```

Report location: `playwright-report/index.html`

### JSON Report
Location: `test-results/results.json`

Contains detailed test data for CI/CD integration.

### JUnit XML Report
Location: `test-results/junit.xml`

Standard format for CI/CD systems (GitHub Actions, Jenkins, etc.).

## Troubleshooting

### Port Already in Use

If you see "Port 3000 or 3001 already in use":

```bash
# Kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 3001
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Playwright Browsers Not Installed

```bash
npx playwright install
```

### Tests Timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60000, // 60 seconds instead of 30
```

### Mock Server Not Starting

1. Check Node.js version: `node --version` (should be 18+)
2. Check TypeScript: `npx ts-node --version`
3. View server logs: `npm run mock:server` (verbose output)

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test - Hybrid Telephony

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:nuclear

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Environment Variables

Key variables for testing:

| Variable | Purpose | Default |
|----------|---------|---------|
| `MOCK_SERVER_PORT` | Mock server port | 3001 |
| `MOCK_LATENCY` | Simulated network delay (ms) | 50 |
| `MOCK_SERVER_URL` | Mock server base URL | http://localhost:3001 |
| `TEST_JWT` | JWT token for auth | test_token (see .env.test.example) |
| `NODE_ENV` | Environment mode | test |

## Performance Benchmarks

Expected performance metrics:

- **Mock Server Startup:** < 5 seconds
- **API Response Time:** < 100ms
- **Full Test Suite:** < 30 seconds (all browsers)
- **Single Test:** < 5 seconds
- **Memory Usage:** < 500MB

## Adding New Tests

To add new test cases to the nuclear suite:

1. Open `tests/telephony-nuclear.test.ts`
2. Find the appropriate phase section
3. Add new test case:

```typescript
test('Feature: Description of what is tested', async () => {
  // Arrange
  const testData = { /* setup */ };

  // Act
  const { status, data } = await apiCall('POST', '/api/endpoint', testData);

  // Assert
  expect(status).toBe(200);
  expect(data.success).toBe(true);
});
```

## Test Data Constants

Key test phone numbers defined in nuclear test:

```typescript
const TEST_PHONES = {
  valid: '+15550009999',
  invalid: '+15550000000',
  rateLimited: '+15559999999',
  verizon: '+15550001111',
  att: '+15550002222',
  tmobile: '+15550003333',
};
```

## Questions?

For issues or questions:

1. Check test output for error messages
2. Review `playwright-report/index.html` for screenshots
3. Enable detailed logging: `DEBUG=pw:api npm run test:nuclear`
4. Check mock server logs in terminal

## Related Documentation

- [Hybrid Telephony Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [Playwright Documentation](https://playwright.dev)
- [Jest Testing Framework](https://jestjs.io)
- [GSM MMI Code Reference](https://en.wikipedia.org/wiki/Telephone_number_formats)
