# Phase 2: Logic Bug Fixes & Test Infrastructure Optimization

**Status:** Planning Phase (3-Step Coding Principle: Steps 1 & 2)  
**Previous:** Phase 1 (TypeScript Compilation) ✅ COMPLETE  
**Target:** Resolve remaining test logic issues & optimize Jest memory usage  

---

## 📋 Phase 2 Overview

### What Problems We're Solving
1. **Jest Memory Exhaustion:** ts-jest compilation overhead prevents full test suite execution
2. **Health Check Edge Cases:** Verify endpoint handles null responses and service failures correctly
3. **RAG Document Chunking:** Ensure large documents split into appropriate token-sized chunks
4. **Test Database Setup:** Validate cross-tenant isolation in integration tests
5. **Integration Test Reliability:** Ensure consistent setup/teardown and proper mocking

### Success Criteria
- ✅ Small test files run independently without memory issues
- ✅ Health check returns 503 for degraded services
- ✅ RAG chunking properly splits documents with overlap
- ✅ Cross-tenant isolation verified in integration tests
- ✅ Jest configuration optimized for large codebase
- ✅ All 92+ tests passing OR memory issue documented with workarounds

---

## 🔍 Senior Engineer Code Review Findings

### Critical Issues Identified

| Issue | Location | Severity | Root Cause | Impact |
|-------|----------|----------|-----------|--------|
| Jest OOM | Jest config | HIGH | ts-jest compiles entire codebase each run | Can't run full test suite |
| Health check edge case | health.test.ts | MEDIUM | Test assumes OpenAI mock returns truthy value | May not detect OpenAI failures |
| RAG chunking logic | document-chunker.ts | MEDIUM | Algorithm may not enforce size limits on final chunks | Long documents may not split properly |
| Test isolation | partial-sync.test.ts | LOW | Import paths were incorrect (now fixed) | ✅ RESOLVED in Phase 1 |

### Recommendations (Senior Engineer Standards)

**1. Performance Optimization (ts-jest memory)**
   - **Issue:** Default ts-jest config transpiles entire codebase for each test
   - **Solution:** Implement isolatedModules flag to compile incrementally
   - **Expected Impact:** 40-60% memory reduction
   - **Risk:** None - ts-jest officially supports isolatedModules mode

**2. Health Check Logic (Edge Cases)**
   - **Issue:** Mock returns null instead of OpenAI instance; code checks `openai.apiKey !== undefined`
   - **Fix Required:** Mock should return object with apiKey property
   - **Testing:** Add explicit null/undefined validation tests
   - **Priority:** MEDIUM (Current logic handles null, but edge case validation needed)

**3. RAG Chunking Algorithm (Token Limit Enforcement)**
   - **Issue:** splitText() returns early when separator is found, may not enforce final chunk size
   - **Fix Required:** Ensure recursive splitting applies size limit to all chunks including final ones
   - **Testing:** Test with 50K+ character document, verify max chunk size respected
   - **Priority:** MEDIUM (Logic appears sound but needs validation)

**4. Test Database Setup (Cross-Tenant Isolation)**
   - **Issue:** Integration tests may not properly seed test data
   - **Fix Required:** Verify Supabase mock returns proper RLS-filtered data
   - **Testing:** Test that org_1 cannot access org_2 data
   - **Priority:** LOW (RLS enforced at database level)

---

## 📅 Implementation Phases

### Phase 2A: Jest Configuration Optimization (High Impact)
**Goal:** Reduce Jest memory footprint to enable full test suite execution

**Tasks:**
1. ✅ Review jest.config.js current settings
2. [ ] Update tsconfig for ts-jest isolatedModules
3. [ ] Test with reduced test subset
4. [ ] Measure memory impact
5. [ ] Document workaround if needed

**Success Metric:** Run at least 3 test files concurrently without OOM

---

### Phase 2B: Health Check Logic Validation (Medium Impact)
**Goal:** Verify health endpoint properly detects service failures

**Tasks:**
1. [ ] Review health.test.ts edge case tests
2. [ ] Verify OpenAI mock returns proper object with apiKey
3. [ ] Test null/undefined database responses
4. [ ] Test API error responses (non-null error field)
5. [ ] Verify 503 status code when degraded

**Success Metric:** All health.test.ts tests passing (10+ assertions)

---

### Phase 2C: RAG Document Chunking Validation (Medium Impact)
**Goal:** Ensure document chunking respects token size limits

**Tasks:**
1. [ ] Review document-chunker.ts splitText() logic
2. [ ] Test with 50,000 character document
3. [ ] Verify chunk count > 1 for oversized input
4. [ ] Verify overlap between chunks
5. [ ] Verify max chunk size respected

**Success Metric:** rag-integration.test.ts passing (5+ assertions)

---

### Phase 2D: Test Database Setup & Isolation (Low Impact)
**Goal:** Verify multi-tenant isolation in integration tests

**Tasks:**
1. [ ] Review test database setup in credential-flow.integration.test.ts
2. [ ] Verify org_id filtering in mocks
3. [ ] Test cross-tenant access denial
4. [ ] Verify call log table setup

**Success Metric:** api-cross-tenant-isolation.test.ts passing

---

## 🛠️ Technical Requirements

### Dependencies
- ts-jest (already installed)
- jest (already installed)
- supertest for integration tests
- Supabase mock client (test-helpers.ts)

### Configuration Changes
```typescript
// jest.config.js - Add isolatedModules
transform: {
  ...tsJestTransformCfg,
  globals: {
    'ts-jest': {
      isolatedModules: true  // NEW: Faster compilation, less memory
    }
  }
}
```

### Testing Strategy
- **Unit Tests:** health.test.ts (10 tests)
- **Integration Tests:** credential-flow.integration.test.ts (18 tests)
- **RAG Tests:** rag-integration.test.ts (5 tests)
- **Isolation Tests:** api-cross-tenant-isolation.test.ts (4 tests)
- **Smoke Test:** smoke.test.ts (2 tests - baseline)

---

## 📊 Rollback Plan

If memory issues persist:
1. Keep Phase 1 fixes (they work and are verified)
2. Document Jest limitation with ts-jest
3. Provide workaround: Run tests in separate Node processes
4. Alternative: Migrate to esbuild-jest for faster compilation

---

## ⏱️ Execution Order

**Phase 2A (Jest Config)** → **2B (Health Check)** → **2C (RAG Chunking)** → **2D (DB Setup)**

Each phase is independent and can be validated before proceeding to next.

---

## 📝 Notes for Phase 2 Execution

- All Phase 1 fixes are in place and verified
- Test files compile successfully (0 TypeScript errors)
- smoke.test.ts validates basic test infrastructure works
- Memory issue is ts-jest specific, not code related
- Jest isolatedModules flag should resolve OOM without breaking tests

