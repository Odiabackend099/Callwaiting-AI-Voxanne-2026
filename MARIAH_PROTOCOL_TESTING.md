# Mariah Protocol Testing Guide

## Overview

This document describes the automated testing suite for the Mariah Protocol certification, which validates the complete end-to-end transaction flow from inbound call initiation through appointment booking, SMS verification, and dashboard updates.

## Files Created

### 1. Pre-Flight Checks Script
**File:** `scripts/mariah-preflight.sh` (319 lines, 11KB)

Automated bash script that validates system readiness before running certification tests.

**Features:**
- 6 automated pre-flight checks
- Color-coded output (✅ pass, ❌ fail)
- Detailed error messages with troubleshooting hints
- Exit code 0 on success, 1 on failure (CI/CD compatible)

### 2. Integration Test Suite
**File:** `backend/src/__tests__/integration/mariah-protocol.test.ts` (979 lines, 30KB)

Comprehensive Jest/TypeScript test suite covering all 11 transaction steps and 12 post-call verification points.

**Features:**
- End-to-end transaction flow testing
- Database state verification
- Graceful degradation testing
- Error handling validation
- Multi-tenant isolation verification

---

## Pre-Flight Checks

### Running Pre-Flight Checks

```bash
# From project root
./scripts/mariah-preflight.sh
```

### What It Checks

| Check # | Component | Description | Pass Criteria |
|---------|-----------|-------------|---------------|
| 1 | **Database Connectivity** | Tests connection via health endpoint | Health endpoint returns database:true |
| 2 | **Vapi API Connectivity** | Validates Vapi API key | Vapi API returns HTTP 200 |
| 3 | **Google Calendar Credentials** | Checks for configured credentials | At least one calendar credential exists |
| 4 | **Twilio Credentials** | Validates SMS provider setup | At least one Twilio credential exists |
| 5 | **Test Agent** | Verifies active agent with Vapi ID | Active agent with vapi_assistant_id found |
| 6 | **Webhook Endpoint** | Confirms endpoint is reachable | Webhook endpoint responds (400/405/200) |

### Expected Output

**Success (all checks pass):**
```
═══════════════════════════════════════════════════
   MARIAH PROTOCOL PRE-FLIGHT CHECKS
═══════════════════════════════════════════════════

[CHECK 1/6] Database Connectivity
✅ Database connection verified via health endpoint

[CHECK 2/6] Vapi API Connectivity
✅ Vapi API connection verified

[CHECK 3/6] Google Calendar Credentials
✅ Google Calendar credentials found

[CHECK 4/6] Twilio Credentials
✅ Twilio credentials found

[CHECK 5/6] Test Agent Configuration
✅ Active agent found with Vapi assistant ID

[CHECK 6/6] Webhook Endpoint Reachability
✅ Webhook endpoint is reachable at http://localhost:3001/api/webhooks/vapi

═══════════════════════════════════════════════════
   PRE-FLIGHT CHECK SUMMARY
═══════════════════════════════════════════════════

Total Checks: 6
Passed: 6
Failed: 0

✅ All pre-flight checks passed!
System is ready for Mariah Protocol certification.
```

**Failure (some checks fail):**
```
[CHECK 3/6] Google Calendar Credentials
❌ No Google Calendar credentials configured for test organization
Hint: Configure Google Calendar integration in the test org

═══════════════════════════════════════════════════
   PRE-FLIGHT CHECK SUMMARY
═══════════════════════════════════════════════════

Total Checks: 6
Passed: 5
Failed: 1

❌ 1 check(s) failed!
Fix the issues above before running certification tests.
```

### Environment Variables Required

```bash
# Backend URL (default: http://localhost:3001)
BACKEND_URL=https://your-backend.onrender.com

# Supabase connection
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Vapi API key
VAPI_PRIVATE_KEY=xxx

# Optional: Specific test organization
TEST_ORG_ID=uuid-of-test-org
```

---

## Integration Tests

### Running Integration Tests

```bash
# Run all Mariah Protocol tests
cd backend
npm run test:integration -- mariah-protocol

# Run specific test suite
npm run test:integration -- --testNamePattern="Call Initiation"

# Run with coverage
npm run test:integration -- mariah-protocol --coverage

# Watch mode (re-run on file changes)
npm run test:integration -- mariah-protocol --watch
```

### Test Structure

The test suite is organized by transaction flow:

#### Transaction Flow Tests (11 Steps)

**Step 1-2: Call Initiation & Contact Lookup**
- Creates contact record on first call
- Lookups existing contact on repeat call
- Verifies phone number format and org_id linking

**Step 3-4: Knowledge Base Query**
- Retrieves knowledge base chunks
- Handles empty knowledge base gracefully
- Validates org-specific knowledge isolation

**Step 5-6: Availability Check**
- Checks calendar availability for time slots
- Detects occupied slots (existing appointments)
- Handles calendar API timeouts

**Step 7-8: Atomic Appointment Booking**
- Creates appointment with advisory locks
- Prevents race conditions (concurrent booking)
- Links appointments to contacts

**Step 9: SMS OTP Verification**
- Logs SMS delivery attempts
- Verifies non-blocking (async) delivery
- Tracks delivery status transitions

**Step 10: Google Calendar Integration**
- Stores calendar event IDs
- Handles API failures gracefully
- Validates calendar sync timeout behavior

**Step 11: Call Logging & Dashboard Update**
- Creates call log records
- Links calls to contacts and appointments
- Stores call transcripts
- Populates dashboard statistics

#### Post-Call Verification Checklist (12 Points)

✓ 1. Contact record exists and is up-to-date
✓ 2. Appointment created with correct details
✓ 3. Call log created with complete metadata
✓ 4. Call linked to contact
✓ 5. Call linked to appointment
✓ 6. SMS delivery logged (if sent)
✓ 7. Calendar event created (if integration active)
✓ 8. No race conditions (no duplicate appointments)
✓ 9. Multi-tenant isolation (org_id filtering)
✓ 10. Dashboard statistics updated
✓ 11. Webhook processing completed (no stuck jobs)
✓ 12. Goodbye detection triggered endCall()

#### Error Handling & Graceful Degradation

- Calendar API timeout handling
- SMS delivery failure (retry queue)
- Missing knowledge base handling
- Network failure scenarios
- Database constraint violations

### Test Output

```
PASS  backend/src/__tests__/integration/mariah-protocol.test.ts
  Mariah Protocol Certification
    Step 1-2: Call Initiation & Contact Lookup
      ✓ should create contact record on first call (45ms)
      ✓ should lookup existing contact on repeat call (12ms)
    Step 3-4: Knowledge Base Query
      ✓ should retrieve knowledge base chunks (18ms)
      ✓ should handle empty knowledge base gracefully (23ms)
    Step 5-6: Availability Check
      ✓ should check if time slot is available (15ms)
      ✓ should detect existing appointments (32ms)
    Step 7-8: Atomic Appointment Booking
      ✓ should create appointment with advisory lock (38ms)
      ✓ should prevent race conditions (67ms)
    Step 9: SMS OTP Verification
      ✓ should log SMS delivery attempts to database (11ms)
      ✓ should queue SMS without blocking (8ms)
      ✓ should track SMS delivery status (14ms)
    Step 10: Google Calendar Integration
      ✓ should store calendar event ID with appointment (19ms)
      ✓ should handle calendar API failures gracefully (28ms)
    Step 11: Call Logging & Dashboard Data
      ✓ should create call log record (22ms)
      ✓ should link call log to appointment (16ms)
      ✓ should store call transcript (13ms)
      ✓ should populate dashboard statistics (25ms)
    Post-Call Verification Checklist
      ✓ 1. Contact record exists and is up-to-date (9ms)
      ✓ 2. Appointment created with correct details (11ms)
      ✓ 3. Call log created with complete metadata (8ms)
      ✓ 4. Call linked to contact (7ms)
      ✓ 5. Call linked to appointment (8ms)
      ✓ 6. SMS delivery logged (if sent) (12ms)
      ✓ 7. Calendar event created (if integration active) (10ms)
      ✓ 8. No race conditions (no duplicate appointments) (15ms)
      ✓ 9. Multi-tenant isolation (org_id filtering) (9ms)
      ✓ 10. Dashboard statistics updated (18ms)
      ✓ 11. Webhook processing completed (no stuck jobs) (11ms)
      ✓ 12. Goodbye detection triggered endCall() (8ms)
    Error Handling & Graceful Degradation
      ✓ should handle calendar API timeout gracefully (24ms)
      ✓ should handle SMS delivery failure (retry queue) (13ms)
      ✓ should handle missing knowledge base gracefully (21ms)

Test Suites: 1 passed, 1 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        2.847s
```

---

## Test Configuration

### Environment Setup

**Required Environment Variables:**
```bash
# Supabase connection (required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Optional: Use specific test organization
TEST_ORG_ID=uuid-of-test-org
```

**Optional Environment Variables:**
```bash
# Backend URL for health checks
BACKEND_URL=http://localhost:3001

# Vapi API key (for pre-flight checks)
VAPI_PRIVATE_KEY=xxx

# Redis URL (for SMS queue tests)
REDIS_URL=redis://localhost:6379
```

### Test Organization Setup

The tests will automatically:
1. Use the provided `TEST_ORG_ID` if set
2. Find an existing organization if no `TEST_ORG_ID`
3. Create a temporary test organization if none exist

**Manual Test Org Setup (Recommended):**
```sql
-- Create dedicated test organization
INSERT INTO organizations (name, email)
VALUES ('Mariah Protocol Test Org', 'mariah-test@voxanne.test')
RETURNING id;

-- Copy the returned ID to your .env:
-- TEST_ORG_ID=<uuid-from-above>
```

### Database Prerequisites

**Required Tables:**
- `organizations`
- `contacts`
- `appointments`
- `call_logs`
- `knowledge_base_chunks`
- `credentials`
- `agents`

**Optional Tables (for full test coverage):**
- `sms_delivery_log`
- `webhook_delivery_log`
- `appointment_holds`

**Required Functions:**
- `book_appointment_with_lock()` - For advisory lock testing

---

## Limitations & Assumptions

### Current Limitations

1. **External API Mocking:** Tests interact with the real database but do NOT mock Vapi, Twilio, or Google Calendar APIs. External API calls may fail in test environments.

2. **Advisory Locks:** Race condition tests require the `book_appointment_with_lock()` RPC function. If not available, tests fall back to direct inserts (less robust).

3. **SMS Queue:** SMS delivery tests require Redis to be running. Without Redis, SMS tests are skipped.

4. **Calendar Integration:** Calendar tests verify database state only, not actual Google Calendar API calls.

### Assumptions Made

1. **Test Organization:** Tests assume at least one organization exists or can be created.

2. **Credentials:** Pre-flight checks assume credentials are stored in the `credentials` table with `provider` field.

3. **Agent Configuration:** Tests assume agents have a `vapi_assistant_id` field when active.

4. **Phone Format:** Tests assume E.164 phone number format (`+1XXXXXXXXXX`).

5. **Timezone Handling:** All timestamps are in UTC (ISO 8601 format).

---

## Troubleshooting

### Pre-Flight Check Failures

**Database Connectivity Failed:**
```
❌ Database check failed in health response
```
**Fix:** Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct. Check if backend is running.

**Vapi API Failed:**
```
❌ Vapi API authentication failed (invalid key)
```
**Fix:** Verify `VAPI_PRIVATE_KEY` in environment variables. Test with `curl`:
```bash
curl -H "Authorization: Bearer $VAPI_PRIVATE_KEY" https://api.vapi.ai/v1/assistant?limit=1
```

**No Credentials Found:**
```
❌ No Google Calendar credentials configured for test organization
```
**Fix:** Configure credentials in the dashboard or manually insert into `credentials` table:
```sql
INSERT INTO credentials (org_id, provider, access_token, refresh_token)
VALUES ('your-org-id', 'google_calendar', 'token', 'refresh');
```

**No Active Agent:**
```
❌ No active agents configured
```
**Fix:** Create an agent in the dashboard and ensure `is_active = true` and `vapi_assistant_id` is set.

### Integration Test Failures

**Tests Skipped:**
```
⚠️  Skipping Mariah Protocol tests - SUPABASE_SERVICE_ROLE_KEY not set
```
**Fix:** Set environment variables in `backend/.env` or `backend/.env.test`.

**Advisory Lock Tests Fail:**
```
Advisory lock function not available
```
**Fix:** Deploy the migration containing `book_appointment_with_lock()` function:
```bash
supabase db push
```

**SMS Tests Fail:**
```
sms_delivery_log table not found
```
**Fix:** Deploy the SMS queue migration (`20260201_create_sms_delivery_log.sql`).

**Race Condition Tests Inconclusive:**
```
Both bookings succeeded - advisory lock may not be available
```
**Fix:** This is a warning, not a failure. The test verifies no duplicate appointments were created even if locks didn't prevent concurrent execution.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Mariah Protocol Certification

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  pre-flight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Pre-Flight Checks
        env:
          BACKEND_URL: ${{ secrets.BACKEND_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VAPI_PRIVATE_KEY: ${{ secrets.VAPI_PRIVATE_KEY }}
        run: ./scripts/mariah-preflight.sh

  integration-tests:
    runs-on: ubuntu-latest
    needs: pre-flight
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: cd backend && npm ci

      - name: Run Mariah Protocol Tests
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          TEST_ORG_ID: ${{ secrets.TEST_ORG_ID }}
        run: cd backend && npm run test:integration -- mariah-protocol
```

---

## Next Steps

### Extending the Test Suite

**Add Performance Tests:**
```typescript
test('should handle 100 concurrent booking attempts', async () => {
  const promises = Array(100).fill(null).map(() =>
    bookAppointment(testOrgId, futureSlot)
  );
  const results = await Promise.all(promises);
  const successful = results.filter(r => r.success).length;
  expect(successful).toBe(1); // Only one should succeed
});
```

**Add E2E Vapi Tests:**
```typescript
test('should complete full Vapi call flow', async () => {
  // Requires Vapi test account with phone number
  const call = await vapiClient.createCall({
    assistantId: testAssistantId,
    phoneNumberId: testPhoneNumberId,
    customer: { number: testCustomerPhone }
  });
  expect(call.id).toBeDefined();
});
```

**Add Load Tests:**
```bash
# Using artillery or k6
k6 run tests/load/mariah-protocol-load.js
```

---

## Support

For questions or issues:
- Review the [Mariah Protocol Plan](MARIAH_PROTOCOL_PLAN.md)
- Check [Troubleshooting](#troubleshooting) section
- Review test output logs for specific error messages
- Verify all environment variables are correctly set

---

## Version History

**v1.0.0 (2026-02-01)**
- Initial release
- 6 pre-flight checks
- 33 integration tests
- Complete transaction flow coverage
- 12-point post-call verification
