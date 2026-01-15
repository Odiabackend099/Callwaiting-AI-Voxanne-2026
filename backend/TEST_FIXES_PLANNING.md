# Test Suite Fixes - Implementation Plan

**Scope:** Fix 18 failing test suites, 52 failed tests  
**Timeline:** 3 phases  
**Success Criteria:** All tests passing, >80% coverage, zero compilation errors

---

## Phase 1: Fix TypeScript Compilation Errors (CRITICAL)

### Issue 1.1: Jest Mock Type Safety (TS2345 errors)

**Problem:**
```typescript
// WRONG - No generic type parameter
jest.fn().mockResolvedValue({ data: null, error: null })
// Error: Argument of type '...' is not assignable to parameter of type 'never'
```

**Solution:**
- Add explicit `<T>` generic to all jest mock functions
- Use `jest.fn<ReturnType>()` syntax

**Files to Fix:**
- `backend/src/tests/utils/test-helpers.ts` (lines 24, 38, 43, 48, 53, 54, 64, 69)
- `src/__tests__/integration/partial-sync.test.ts` (lines 25, 99, 106, 113, 127, 162, 163)

**Implementation:**
```typescript
// CORRECT
jest.fn<Promise<{ data: null; error: null }>>().mockResolvedValue({ data: null, error: null })
jest.fn<Promise<VapiAssistant>>().mockResolvedValue({ id: 'mock', name: 'mock', model: 'gpt-4' })
```

**Testing:** Compilation should pass without TS2345 errors

---

### Issue 1.2: Module Resolution Errors (TS2307)

**Problem:**
```typescript
import { MOCK_PII_TEXT_SAMPLES } from '../utils/mock-data';
// Error: Cannot find module '../utils/mock-data'

import founderConsoleRouter from '../routes/founder-console-v2';
// Error: Cannot find module '../routes/founder-console-v2'
```

**Solution:**
- Verify file paths match directory structure
- Use correct relative paths from test file location

**Files to Check:**
- `backend/src/services/__tests__/redaction-service.test.ts` - Import from correct path
- `backend/src/__tests__/integration/partial-sync.test.ts` - Fix all 3 import paths

**Testing:** All imports resolve without TS2307 errors

---

## Phase 2: Fix Test Logic & Timeout Issues (HIGH PRIORITY)

### Issue 2.1: Integration Test Timeouts

**Problem:**
- credential-flow.test.ts: 18 tests timeout at 10s default
- Tests are making real HTTP requests to unstarted server

**Solution:**
- Increase timeout to 30s (for integration tests that need actual server)
- OR mock HTTP layer instead of real requests
- Add explicit `jest.setTimeout(30000)` at test suite level

**Files to Fix:**
- `src/__tests__/integration/credential-flow.integration.test.ts` (all describe blocks)
- `tests/api-cross-tenant-isolation.test.ts`

**Implementation:**
```typescript
describe('Credential Flow Integration Tests', () => {
  jest.setTimeout(30000);  // Add this
  
  describe('Credential Store and Retrieve', () => {
    // tests...
  });
});
```

**Testing:** Integration tests should not timeout

---

### Issue 2.2: Health Check Logic Bug

**Problem:**
```typescript
// Test expects: degraded status + 503 when services fail
// Actual: returns "healthy" + 200 even when services fail
```

**Root Cause:** Health check endpoint always returns healthy status

**Solution:**
- Fix `/health` endpoint logic to check service responses
- Return 503 + "degraded" if ANY service health check fails
- Validate database responses are not null

**Files to Fix:**
- `src/routes/health.ts` - Logic implementation

**Implementation:**
```typescript
// Pseudo-code for fix
const healthCheck = async (req, res) => {
  const checks = {
    database: false,
    openai: false,
  };
  
  try {
    // Check database
    const dbResult = await supabase.rpc('health_check');
    checks.database = dbResult.data !== null && !dbResult.error;
  } catch {
    checks.database = false;
  }
  
  // ... similar for OpenAI
  
  const isHealthy = Object.values(checks).every(v => v);
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    checks,
  });
};
```

**Testing:** 
- Health check returns 503 when services fail
- Status field shows "degraded"

---

### Issue 2.3: RAG Document Chunking Logic

**Problem:**
```typescript
// Test expects: long documents split into multiple chunks
// Actual: 50,000 char document still returns 1 chunk
```

**Root Cause:** Chunk size threshold not being applied correctly

**Solution:**
- Fix `chunkDocumentWithMetadata()` to respect chunk size limit
- Default chunk size: 1000 tokens (~4000 chars)
- Ensure long docs split with overlap

**Files to Fix:**
- `src/services/embeddings.ts` - `chunkDocumentWithMetadata()` function

**Testing:**
- 50,000 char document → 13+ chunks
- Chunks maintain content overlap

---

## Phase 3: Fix Database Response Handling (MEDIUM PRIORITY)

### Issue 3.1: Null Response Validation

**Problem:**
```typescript
// Test: health check returns 503 when database returns null
// Actual: returns 200 (treats null as valid response)
```

**Solution:**
- Add explicit null/undefined checks before using responses
- Treat null responses as service failures

**Files to Fix:**
- `src/routes/health.ts`
- Any service that queries database without validation

**Implementation:**
```typescript
const dbResponse = await db.query();
if (!dbResponse || !dbResponse.data) {
  return { error: 'Database unavailable' };
}
```

**Testing:** Null responses properly trigger error states

---

### Issue 3.2: Test Database Setup

**Problem:**
- Integration tests fail because database/API not available
- Tests expect real Supabase/HTTP connections

**Solution:**
- Decide: Mock HTTP layer OR ensure test database available
- Recommended: Mock external services, use real DB for integration tests
- Update test setup to verify prerequisites

**Files to Fix:**
- `tests/api-cross-tenant-isolation.test.ts` - Check Supabase availability
- `src/__tests__/integration/credential-flow.integration.test.ts` - Add setup validation

**Testing:**
- Tests pass with real services available
- Tests skip gracefully if services unavailable

---

## Success Metrics

### Phase 1 (TypeScript Compilation)
- [x] 0 TS2345 errors
- [x] 0 TS2307 errors  
- [x] Full project compilation without warnings

### Phase 2 (Logic Fixes)
- [x] No integration test timeouts (>30s support)
- [x] Health check returns correct status + HTTP code
- [x] Document chunking splits long documents
- [x] Null responses handled correctly

### Phase 3 (Database Handling)
- [x] All null checks implemented
- [x] Test database setup validated
- [x] 92 tests → 92+ passing (all)

### Overall Success Criteria
- ✅ Test Suites: 20 passing (0 failed)
- ✅ Tests: 92+ passing (0 failed)
- ✅ Coverage: >80% lines, functions, statements
- ✅ Zero compilation errors
- ✅ No flaky tests (pass 10x consecutively)

---

## Rollback Plan

If fixes break existing functionality:
1. Revert individual file changes
2. Keep test timeout increases (safe)
3. Re-validate with original logic

---

## Execution Order

1. **Phase 1 First** - Fix compilation, allows other phases to run
2. **Phase 2 Second** - Fix logic bugs and timeouts  
3. **Phase 3 Third** - Fine-tune edge cases

