# Test Execution Guide - Final Hardening Sprint

**Date:** 2026-02-01  
**Status:** Ready for local execution  
**Environment:** macOS with npm/Node.js

---

## Quick Start (Copy & Paste)

```bash
# Navigate to backend
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# 1. Install dependencies (if needed)
npm install

# 2. Run unit tests (PHI redaction verification)
npm run test:unit

# 3. Run integration tests (Mariah Protocol + new alternative slots test)
npm run test:integration -- mariah-protocol

# 4. Verify TypeScript compilation
npx tsc --noEmit

# 5. Optional: Run all tests
npm test
```

---

## Test Suite Details

### 1. Unit Tests (PHI Redaction)

**Command:**
```bash
npm run test:unit
```

**What It Tests:**
- PHI (Protected Health Information) redaction
- Credential encryption/decryption
- Data masking in logs
- Sensitive field handling

**Expected Output:**
```
PASS  src/__tests__/unit/phi-redaction.test.ts
PASS  src/__tests__/unit/credential-encryption.test.ts
...
Test Suites: X passed, X total
Tests:       47 passed, 47 total
```

**Success Criteria:**
- ✅ 47/47 tests passing
- ✅ No new failures
- ✅ All existing tests unchanged

**Why No Risk:**
- We didn't modify any PHI redaction logic
- No changes to credential encryption
- No changes to data masking

---

### 2. Integration Tests (Mariah Protocol)

**Command:**
```bash
npm run test:integration -- mariah-protocol
```

**What It Tests:**
- End-to-end call flow (11 steps)
- Contact creation and lookup
- Availability checking
- Atomic booking with advisory locks
- SMS delivery logging
- Google Calendar integration
- Call logging and dashboard population
- **NEW:** Alternative slots when requested slot is busy

**Test Cases (34 total):**
```
Step 1-2: Call Initiation & Contact Lookup (2 tests)
Step 3-4: Knowledge Base Query (2 tests)
Step 5-6: Availability Check (3 tests) ← includes new alternative slots test
Step 7-8: Atomic Appointment Booking (2 tests)
Step 9: SMS OTP Verification (3 tests)
Step 10: Google Calendar Integration (2 tests)
Step 11: Call Logging & Dashboard (5 tests)
Post-Call Verification: 12-point checklist (12 tests)
Error Handling & Graceful Degradation (3 tests)
```

**Expected Output:**
```
PASS  src/__tests__/integration/mariah-protocol.test.ts
  Step 5-6: Availability Check
    ✓ should check if time slot is available
    ✓ should detect existing appointments (occupied slots)
    ✓ should return 3 alternative slots when requested slot is busy (NEW)
...
Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
```

**Success Criteria:**
- ✅ 34/34 tests passing (33 existing + 1 new)
- ✅ New alternative slots test passes
- ✅ No flaky tests
- ✅ All existing tests unchanged

**Why No Risk:**
- New test is isolated (creates/deletes own data)
- Uses existing Supabase client
- Follows existing test patterns
- Proper cleanup (no orphaned data)

---

### 3. TypeScript Compilation

**Command:**
```bash
npx tsc --noEmit
```

**What It Checks:**
- Type safety of all code
- Import/export validity
- Function signatures
- No implicit `any` types
- No circular dependencies

**Expected Output:**
```
(No output = success)
```

**Success Criteria:**
- ✅ 0 new errors
- ✅ Existing errors (if any) unchanged
- ✅ All imports valid
- ✅ All types correct

**Why No Risk:**
- `deleteCalendarEvent` properly typed
- All parameters typed (orgId: string, eventId: string)
- Uses existing types (CalendarEvent, etc.)
- No type casting or `any` types

---

## Detailed Test Execution

### Full Test Suite

**Command:**
```bash
npm test
```

**What It Runs:**
- All unit tests
- All integration tests
- All e2e tests (if configured)

**Expected Output:**
```
Test Suites: X passed, X total
Tests:       Y passed, Y total
Snapshots:   Z total
Time:        XXs
```

---

## Troubleshooting

### Issue: npm command not found

**Solution 1: Check Node.js installation**
```bash
which node
node --version
npm --version
```

**Solution 2: Use nvm (Node Version Manager)**
```bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# List installed versions
nvm list

# Use specific version
nvm use 18  # or your preferred version

# Then run tests
npm run test:unit
```

**Solution 3: Use Homebrew to install Node.js**
```bash
brew install node
npm install -g npm@latest
```

---

### Issue: Tests fail with database connection error

**Solution:**
```bash
# Ensure Supabase environment variables are set
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Then run tests
npm run test:integration -- mariah-protocol
```

---

### Issue: TypeScript compilation errors

**Solution:**
```bash
# Regenerate types from Supabase
npx supabase gen types typescript --project-id lbjymlodxprzqgtyqtcq > src/types/database.types.ts

# Then compile
npx tsc --noEmit
```

---

## Test Output Interpretation

### ✅ All Tests Passing
```
Test Suites: 3 passed, 3 total
Tests:       81 passed, 81 total
Time:        45s
```
**Status:** Ready for deployment ✅

### ⚠️ Some Tests Failing
```
Test Suites: 2 passed, 3 total
Tests:       75 passed, 81 total (6 failed)
```
**Status:** Investigate failures before deployment ❌

### ❌ TypeScript Errors
```
src/services/calendar-integration.ts:298:5 - error TS2322: Type 'string | null' is not assignable to type 'string'
```
**Status:** Fix type errors before deployment ❌

---

## Performance Expectations

| Test Suite | Expected Time | Notes |
|------------|---------------|-------|
| Unit Tests | 10-15s | Fast, no I/O |
| Integration Tests | 30-45s | Requires Supabase connection |
| TypeScript | 5-10s | No execution, type checking only |
| All Tests | 60-90s | Total time |

---

## Continuous Integration (CI/CD)

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        working-directory: ./backend
      
      - name: Run unit tests
        run: npm run test:unit
        working-directory: ./backend
      
      - name: Run integration tests
        run: npm run test:integration -- mariah-protocol
        working-directory: ./backend
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      
      - name: TypeScript compilation
        run: npx tsc --noEmit
        working-directory: ./backend
```

---

## Pre-Demo Checklist

Before Friday's demo, run:

```bash
# 1. Navigate to backend
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# 2. Install latest dependencies
npm install

# 3. Run all tests
npm test

# 4. Verify TypeScript
npx tsc --noEmit

# 5. Build for production
npm run build

# 6. Verify no console errors
npm run dev  # Start dev server and test manually
```

**Expected Result:** All tests pass, zero TypeScript errors, dev server starts cleanly ✅

---

## Test Results Recording

### Unit Tests
```
Date: 2026-02-01
Command: npm run test:unit
Result: [ ] PASS [ ] FAIL
Tests Passed: __/47
Notes: _______________
```

### Integration Tests
```
Date: 2026-02-01
Command: npm run test:integration -- mariah-protocol
Result: [ ] PASS [ ] FAIL
Tests Passed: __/34
Notes: _______________
```

### TypeScript
```
Date: 2026-02-01
Command: npx tsc --noEmit
Result: [ ] PASS (0 errors) [ ] FAIL
Errors: __
Notes: _______________
```

---

## Next Steps

1. ✅ Run the test commands above in your local environment
2. ✅ Record results in the checklist above
3. ✅ If all pass: Ready for Friday demo
4. ✅ If any fail: Investigate and report issues
5. ✅ Deploy to staging/production when ready

---

**Generated:** 2026-02-01 13:48 UTC+01:00  
**Status:** Ready for execution in local environment
