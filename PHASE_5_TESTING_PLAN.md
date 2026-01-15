# 📋 Phase 5: Unit Testing Implementation Plan

**Objective**: Test individual components in isolation to ensure each backend and frontend piece behaves exactly as expected.

**Testing Principle**: "Does this one thing work?" — each test verifies a single behavior without external dependencies.

**Target Coverage**: Auth Middleware, useOrgValidation Hook, API Route Protection, Calendar Booking Logic

---

## 1. Testing Architecture Overview

### Directory Structure

```
voxanne-frontend/
├── src/
│   ├── __tests__/
│   │   ├── hooks/
│   │   │   ├── useOrgValidation.test.ts
│   │   │   ├── useOrg.test.ts
│   │   │   └── __mocks__/
│   │   │       └── useOrgValidation.ts
│   │   ├── api/
│   │   │   ├── orgs-route.test.ts
│   │   │   └── __mocks__/
│   │   │       └── supabase.ts
│   │   ├── components/
│   │   │   ├── OrgErrorBoundary.test.tsx
│   │   │   └── OrgSettings.test.tsx
│   │   └── utils/
│   │       └── __mocks__/
│   │           └── fetch.ts
│   └── vitest.config.ts

voxanne-backend/
├── src/
│   ├── __tests__/
│   │   ├── middleware/
│   │   │   ├── auth.test.ts
│   │   │   └── __mocks__/
│   │   │       └── jwt.ts
│   │   ├── services/
│   │   │   ├── org-validation.test.ts
│   │   │   ├── calendar-booking.test.ts
│   │   │   └── __mocks__/
│   │   │       ├── supabase.ts
│   │   │       └── vapi.ts
│   │   └── utils/
│   │       └── test-helpers.ts
│   └── vitest.config.ts
```

### Tool Selection: Vitest + MSW (Mock Service Worker)

- **Vitest**: Fast, Vite-native test runner (perfect for TypeScript)
- **Vitest Mocking**: Built-in spying, mocking, and stubbing
- **MSW**: Intercepts HTTP requests for realistic API testing
- **@testing-library**: Frontend component testing

---

## 2. Component-by-Component Test Plan

### **Component 1: Auth Middleware (`backend/src/middleware/auth.ts`)**

**What It Should Do:**
- Extract `org_id` from JWT `app_metadata`
- Reject requests with missing `org_id` (return 401)
- Reject requests with invalid `org_id` format (return 400)
- Pass valid requests to next middleware
- Never fall back to "first organization"

**Test Cases:**

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Valid org_id | JWT with app_metadata.org_id = valid UUID | Pass to next, org_id available |
| Missing org_id | JWT without app_metadata.org_id | 401 Unauthorized |
| Invalid UUID format | JWT with app_metadata.org_id = "invalid" | 400 Bad Request |
| Malformed JWT | Header with invalid signature | 401 Unauthorized |
| Expired JWT | JWT with exp < now | 401 Unauthorized |

**Acceptance Criteria:**
- ✅ Valid org_id passes through
- ✅ Missing org_id returns 401
- ✅ Invalid format returns 400
- ✅ No fallback to "first org"
- ✅ Middleware does NOT query the database (isolation)

---

### **Component 2: Organization Validation Hook (`src/hooks/useOrgValidation.ts`)**

**What It Should Do:**
- Extract org_id from JWT `app_metadata`
- Validate UUID format before API call
- Call `/api/orgs/validate/{orgId}` endpoint
- Return loading, error, and valid org states
- Automatically redirect to login on failure

**Test Cases:**

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Valid org_id | JWT app_metadata with valid UUID | loading → orgValid = true |
| Invalid UUID | JWT app_metadata with "invalid-uuid" | Returns error immediately (no API call) |
| API returns 401 | User not authenticated | Redirects to login, error state |
| API returns 404 | Org doesn't exist | Sets orgError, orgValid = false |
| API returns 200 | Org exists and user has access | orgValid = true, orgId set |
| Network error | Fetch fails | Sets error, retry possible |

**Acceptance Criteria:**
- ✅ Valid UUIDs call API
- ✅ Invalid formats rejected without API call
- ✅ 401 triggers redirect to login
- ✅ 404 sets error state
- ✅ Loading state updates during API call
- ✅ Hook mocks API calls (no real HTTP)

---

### **Component 3: API Route Protection (`src/app/api/orgs/[orgId]/route.ts`)**

**What It Should Do:**
- GET: Return 401 if not authenticated, 403 if no access, 404 if org not found, 200 + data if valid
- PUT: Admin-only, validate input, update org name only, return 200 + updated data
- Enforce org_id matching between JWT and route parameter
- Use RLS policies (mocked) for data isolation

**Test Cases:**

| Test Case | Method | Input | Expected Output |
|-----------|--------|-------|-----------------|
| Unauthenticated GET | GET | No auth header | 401 Unauthorized |
| Valid GET | GET | Valid JWT + org_id | 200 + org data |
| Cross-org GET | GET | JWT org_id ≠ route org_id | 403 Forbidden |
| Non-existent org GET | GET | Valid JWT + invalid org UUID | 404 Not Found |
| Unauthenticated PUT | PUT | No auth header | 401 Unauthorized |
| Non-admin PUT | PUT | Valid JWT, role = user | 403 Forbidden |
| Admin PUT with valid name | PUT | Valid JWT, admin, name = "Clinic X" | 200 + updated org |
| Admin PUT without name | PUT | Valid JWT, admin, no name field | 400 Bad Request |
| Admin PUT with long name | PUT | Valid JWT, admin, name > 100 chars | 400 Bad Request |
| Status field update attempt | PUT | Valid JWT, admin, status = "inactive" | 200 (ignores status, only updates name) |

**Acceptance Criteria:**
- ✅ Unauthenticated requests return 401
- ✅ Cross-org requests return 403
- ✅ Non-existent orgs return 404
- ✅ Non-admin PUT attempts return 403
- ✅ Status field is always read-only (even if provided in request)
- ✅ All responses use mocked database (no real Supabase calls)

---

### **Component 4: Calendar Booking Logic (Atomic Locking)**

**What It Should Do:**
- Lock a time slot using `SELECT FOR UPDATE`
- Prevent two concurrent calls from booking the same slot
- Release lock after booking completes
- Mock Vapi tool-call requests
- Return meaningful errors on conflict

**Test Cases:**

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Single booking request | Vapi tool-call with slot "2:00 PM Jan 15" | Lock acquired, booking saved, 200 OK |
| Concurrent bookings (same slot) | Two simultaneous requests for same slot | First wins, second gets 409 Conflict |
| Concurrent bookings (different slots) | Two requests for different time slots | Both succeed, 200 OK |
| Lock timeout | Request holds lock > 5 seconds | Transaction rolled back, 408 Request Timeout |
| Invalid slot format | Vapi call with malformed time | 400 Bad Request (validation error) |
| Calendar integration fails | Upstream Google Calendar API error | 502 Bad Gateway (calendar unavailable) |

**Acceptance Criteria:**
- ✅ Single concurrent booking succeeds
- ✅ Duplicate concurrent bookings prevented
- ✅ Different slots can be booked simultaneously
- ✅ Lock is released after transaction
- ✅ Vapi tool-calls are mocked (no real Vapi integration)
- ✅ Database queries use mocked transaction logic

---

## 3. Testing Technologies & Configuration

### Frontend (Next.js)

**Dependencies:**
```json
{
  "vitest": "^1.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.1.0",
  "msw": "^1.3.0",
  "@vitest/ui": "^1.0.0"
}
```

**Config** (`vitest.config.ts`):
- Test environment: `jsdom` (browser simulation)
- Setup files: MSW handlers, global mocks
- Coverage: Min 80% for critical paths
- Watch mode for development

### Backend (Node.js)

**Dependencies:**
```json
{
  "vitest": "^1.0.0",
  "@vitest/coverage-v8": "^1.0.0",
  "mock-jwt": "^1.0.0"
}
```

**Config** (`vitest.config.ts`):
- Test environment: `node`
- Setup files: Mock database, JWT fixtures
- Coverage: Min 85% for auth, validation, locking
- Watch mode for development

---

## 4. Mock Strategy

### Frontend Mocks

**API Mocking** (MSW handlers):
```typescript
// src/__tests__/__mocks__/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Org validation endpoint
  rest.get('/api/orgs/validate/:orgId', (req, res, ctx) => {
    const { orgId } = req.params;
    
    // Test valid org
    if (orgId === 'valid-uuid-1234') {
      return res(ctx.status(200), ctx.json({ orgId, valid: true }));
    }
    
    // Test non-existent org
    if (orgId === 'nonexistent-uuid') {
      return res(ctx.status(404), ctx.json({ error: 'Org not found' }));
    }
    
    // Test invalid format
    return res(ctx.status(400), ctx.json({ error: 'Invalid UUID' }));
  }),
];
```

**JWT Mocking**:
```typescript
// src/__tests__/__mocks__/jwt.ts
export const mockJWTWithOrgId = (orgId: string) => ({
  iss: 'supabase',
  aud: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  app_metadata: { org_id: orgId },
  user_metadata: {},
});
```

### Backend Mocks

**Database Mocking**:
```typescript
// backend/src/__tests__/__mocks__/supabase.ts
export const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: mockOrgData }),
  update: vi.fn().mockReturnThis(),
};
```

**Vapi Mocking**:
```typescript
// backend/src/__tests__/__mocks__/vapi.ts
export const mockVapiToolCall = {
  toolName: 'bookAppointment',
  orgId: 'test-org-id',
  slot: '2:00 PM',
  patientId: 'patient-123',
};
```

---

## 5. Test Execution Plan

### Phase 5A: Backend Infrastructure (Auth + Org Validation Service)
- [ ] Configure Vitest for backend
- [ ] Create auth middleware tests (5 tests)
- [ ] Create org-validation service tests (5 tests)
- [ ] Run: `npm run test:backend`
- [ ] Target: 90% coverage on auth/middleware

### Phase 5B: Frontend Hooks (useOrgValidation + useOrg)
- [ ] Configure Vitest + MSW for frontend
- [ ] Create useOrgValidation hook tests (6 tests)
- [ ] Create useOrg wrapper tests (3 tests)
- [ ] Run: `npm run test:frontend`
- [ ] Target: 85% coverage on hooks

### Phase 5C: API Routes (GET/PUT org endpoints)
- [ ] Create route handler tests with mocked database (9 tests)
- [ ] Test cross-org access prevention
- [ ] Test RBAC enforcement (admin vs user)
- [ ] Test input validation
- [ ] Run: `npm run test:api`
- [ ] Target: 95% coverage on critical paths

### Phase 5D: Calendar Booking (Atomic Locking)
- [ ] Create calendar booking service tests (6 tests)
- [ ] Mock SELECT FOR UPDATE behavior
- [ ] Test concurrent request handling
- [ ] Test lock timeout scenarios
- [ ] Run: `npm run test:calendar`
- [ ] Target: 90% coverage on locking

### Phase 5E: Full Integration Test Run
- [ ] Execute all tests: `npm run test`
- [ ] Generate coverage report
- [ ] Document any failures
- [ ] Create test documentation

---

## 6. Success Criteria

✅ **Auth Middleware**: Extracts org_id correctly, rejects invalid/missing claims, no fallbacks
✅ **useOrgValidation Hook**: Validates UUID format, calls API, handles all response codes
✅ **API Routes**: Enforces org_id matching, RBAC, input validation
✅ **Calendar Booking**: Prevents concurrent double-bookings, releases locks correctly
✅ **Coverage**: Min 80% overall, 95% on security-critical paths
✅ **No External Calls**: All tests use mocks (no real API, database, or Vapi calls)
✅ **Isolation**: Each test verifies ONE behavior without depending on others
✅ **Documentation**: README explaining how to run, add, and debug tests

---

## 7. Dependencies to Add

```bash
# Frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom msw @vitest/ui

# Backend  
npm install --save-dev vitest @vitest/coverage-v8
```

---

## 8. Integration with CI/CD

**GitHub Actions** (`.github/workflows/test.yml`):
- Run tests on every PR
- Fail if coverage drops below 80%
- Run tests in parallel (backend + frontend)
- Generate coverage report as artifact

---

## Timeline

- **Phase 5A**: 30 mins (backend infra + auth tests)
- **Phase 5B**: 30 mins (frontend hooks)
- **Phase 5C**: 30 mins (API routes)
- **Phase 5D**: 30 mins (calendar booking)
- **Phase 5E**: 15 mins (full run + documentation)

**Total**: ~2.5 hours for comprehensive unit testing suite

---

## What's Next After Phase 5

1. **Phase 6**: Integration tests (frontend + backend together)
2. **Phase 7**: E2E tests (Playwright: full user journeys)
3. **Phase 8**: Performance tests (response time benchmarks)
4. **Phase 9**: Security audit (OWASP, HIPAA if applicable)
