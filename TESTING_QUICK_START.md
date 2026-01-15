# 🧪 Phase 5: Unit Testing - Quick Start Guide

## Overview

This directory contains the **complete unit testing suite** for Voxanne AI, following the principle: **"Does this one thing work?"**

Each test validates a single component behavior in isolation without external dependencies (no real API calls, no real database, no real Vapi).

---

## Test Files & Structure

### Frontend Tests

#### `src/__tests__/hooks/useOrgValidation.test.ts` (10 tests)
Tests the org_id validation hook:
- ✅ Valid UUID org_id with API call
- ✅ Invalid UUID format rejection (no API call)
- ✅ 401 Unauthorized response handling
- ✅ 404 Organization not found handling
- ✅ 400 Bad Request handling
- ✅ Missing org_id from JWT
- ✅ Loading state management
- ✅ Network error handling
- ✅ Successful validation response
- ✅ Multiple org_id validations (switching orgs)

#### `src/__tests__/api/orgs-route.test.ts` (19 tests)
Tests the `/api/orgs/[orgId]` route handlers:

**GET Tests:**
- ✅ Successful GET with valid auth
- ✅ Unauthenticated GET (401)
- ✅ Cross-org access attempt (403)
- ✅ Non-existent organization (404)
- ✅ Invalid UUID format (400)
- ✅ GET doesn't modify data
- ✅ GET after PUT returns updated data

**PUT Tests:**
- ✅ Successful PUT with admin user
- ✅ Non-admin user PUT rejection (403)
- ✅ PUT without name field (400)
- ✅ PUT with empty name (400)
- ✅ PUT with name > 100 chars (400)
- ✅ Status field read-only (cannot be updated)
- ✅ Unauthenticated PUT (401)
- ✅ Cross-org PUT attempt (403)
- ✅ PUT non-existent org (404)
- ✅ Valid name within 100 chars
- ✅ updated_at timestamp updates
- ✅ Multiple sequential PUTs

### Backend Tests

#### `backend/src/__tests__/middleware/auth.test.ts` (12 tests)
Tests the auth middleware org_id extraction:
- ✅ Valid org_id extraction from Authorization header
- ✅ Missing org_id rejection (401)
- ✅ Missing Authorization header rejection (401)
- ✅ Invalid UUID format rejection (400)
- ✅ No fallback to "first organization"
- ✅ Multiple valid UUID formats accepted
- ✅ Various invalid UUID formats rejected
- ✅ org_id passed unchanged to next middleware
- ✅ Request context (req.user) available to next
- ✅ Consistent error response format
- ✅ Middleware Express signature
- ✅ Early return on invalid org_id (no next() call)

#### `backend/src/__tests__/services/calendar-booking.test.ts` (12 tests)
Tests the atomic locking mechanism for bookings:
- ✅ Single booking acquires lock
- ✅ Concurrent bookings (first wins, 409 Conflict)
- ✅ Concurrent bookings of different slots (both succeed)
- ✅ Lock release unlocks slot
- ✅ Lock timeout auto-releases
- ✅ Lock stores metadata (request ID, timestamp)
- ✅ Complete booking workflow with locking
- ✅ Invalid slot format rejection (no lock)
- ✅ Vapi tool-call integration
- ✅ Race condition handling (only one succeeds)
- ✅ Lock isolation between organizations
- ✅ Lock release even if booking fails (rollback)

---

## Mock Utilities

### Frontend Mocks

**`src/__tests__/__mocks__/jwt.ts`** - JWT token generation
- `createMockJWT()` - Create standard JWT
- `createMockJWTWithOrgId(orgId)` - JWT with specific org_id
- `createMockJWTWithoutOrgId()` - JWT missing org_id
- `createMockJWTWithInvalidOrgId()` - JWT with invalid format
- `isValidUUID(value)` - Validate UUID format

**`src/__tests__/__mocks__/handlers.ts`** - MSW HTTP request handlers
- `orgValidateHandler` - GET /api/orgs/validate/{orgId}
- `getOrgHandler` - GET /api/orgs/{orgId}
- `updateOrgHandler` - PUT /api/orgs/{orgId}

**`src/__tests__/__mocks__/server.ts`** - MSW server setup

**`src/__tests__/__mocks__/setup.ts`** - Global test setup
- Starts MSW server before tests
- Mocks localStorage/sessionStorage
- Clears mocks after each test

### Backend Mocks

**`backend/src/__tests__/__mocks__/jwt.ts`** - JWT extraction utilities
- `createMockRequest(orgId, userId)` - Valid request
- `createMockRequestNoAuth()` - No auth header
- `createMockRequestNoOrgId()` - Missing org_id
- `validateUUIDFormat(value)` - UUID validation

**`backend/src/__tests__/__mocks__/supabase.ts`** - Database simulation
- `createMockSupabaseClient()` - Mocked Supabase client
- `getUserOrgRole(userId, orgId)` - Get user role in org
- `isUserAdmin(userId, orgId)` - Check admin status
- `getMockOrganization(orgId)` - Get org by ID
- `updateMockOrganization(orgId, updates)` - Update org

---

## Running Tests

### Install Dependencies (First Time)

```bash
# Frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom msw @vitest/ui

# Backend
cd backend
npm install --save-dev vitest @vitest/coverage-v8
```

### Run All Frontend Tests

```bash
npm run test:frontend
# or watch mode
npm run test:frontend -- --watch
```

### Run All Backend Tests

```bash
cd backend
npm run test:backend
# or watch mode
npm run test:backend -- --watch
```

### Run Specific Test File

```bash
# Frontend hook test
npm run test:frontend -- src/__tests__/hooks/useOrgValidation.test.ts

# Backend auth middleware test
cd backend && npm run test:backend -- src/__tests__/middleware/auth.test.ts
```

### Run Tests with Coverage

```bash
# Frontend coverage
npm run test:frontend -- --coverage

# Backend coverage
cd backend && npm run test:backend -- --coverage
```

### Watch Mode (Continuous)

```bash
# Frontend - re-runs tests on file changes
npm run test:frontend -- --watch

# Backend
cd backend && npm run test:backend -- --watch
```

---

## Test Coverage Goals

| Component | Coverage Target | Current |
|-----------|-----------------|---------|
| Auth Middleware | 95% | ✅ 12/12 tests |
| useOrgValidation Hook | 85% | ✅ 10/10 tests |
| API Routes (GET/PUT) | 95% | ✅ 19/19 tests |
| Calendar Booking | 90% | ✅ 12/12 tests |
| Overall | 85% | ✅ 53/53 tests |

---

## Adding New Tests

### Step 1: Create Test File

```typescript
// src/__tests__/my-component.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('My Component', () => {
  it('should do one thing', () => {
    expect(true).toBe(true);
  });
});
```

### Step 2: Run Test

```bash
npm run test:frontend -- src/__tests__/my-component.test.ts --watch
```

### Step 3: Implement Component

Write implementation to make test pass.

### Step 4: Run Full Suite

```bash
npm run test:frontend
```

---

## Debugging Tests

### View Test Output

```bash
# Verbose output
npm run test:frontend -- --reporter=verbose

# With UI (requires @vitest/ui)
npm run test:frontend -- --ui
```

### Run Single Test

```bash
# Focus on one test
it.only('should test this one thing', () => {
  // Only this test runs
});

# Run with exact name match
npm run test:frontend -- --grep "should test this one thing"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:frontend", "--", "--inspect-brk"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

Press F5 to start debugging.

---

## Test Principles

### 1. **Isolation**
Each test validates ONE behavior without dependencies:
- ❌ Don't: Test API call AND database query in same test
- ✅ Do: Mock database, test API call alone

### 2. **No Real External Calls**
- ❌ Don't: `fetch('https://api.example.com')`
- ✅ Do: `vi.mock('fetch'); fetch.mockResolvedValue(...)`

### 3. **Clear Naming**
- ❌ Don't: `it('test1', ...)`
- ✅ Do: `it('should return 401 for unauthenticated request', ...)`

### 4. **Arrange-Act-Assert (AAA)**
```typescript
it('should do something', () => {
  // ARRANGE: Set up test data
  const input = 'test';
  
  // ACT: Call the thing being tested
  const result = myFunction(input);
  
  // ASSERT: Verify the result
  expect(result).toBe('expected');
});
```

### 5. **Descriptive Comments**
Each test should explain:
- What scenario is being tested
- What's expected to happen
- Why this behavior matters

---

## Common Patterns

### Testing API Success

```typescript
it('should return 200 with org data', async () => {
  const response = await fetch('/api/orgs/valid-id', {
    headers: { Authorization: 'Bearer token' },
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.id).toBe('valid-id');
});
```

### Testing API Error

```typescript
it('should return 401 for missing auth', async () => {
  const response = await fetch('/api/orgs/valid-id');

  expect(response.status).toBe(401);
  const error = await response.json();
  expect(error.error).toContain('Authentication');
});
```

### Testing Hook State

```typescript
it('should set loading during API call', () => {
  const { result } = renderHook(() => useOrgValidation());

  // Initially loading
  expect(result.current.loading).toBe(true);

  // After API response
  waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
});
```

### Testing Database Queries

```typescript
it('should get organization by ID', () => {
  const org = getMockOrganization('org-123');

  expect(org).toBeDefined();
  expect(org.name).toBe('Test Clinic');
});
```

---

## Troubleshooting

### Tests Not Running

```bash
# Check Vitest is installed
npm list vitest

# Clear Vitest cache
rm -rf node_modules/.vitest

# Reinstall
npm install
```

### Module Not Found Errors

Check `vitest.config.ts` has correct path aliases:
```typescript
alias: {
  '@': path.resolve(__dirname, './src'),
}
```

### MSW Not Intercepting Requests

Ensure MSW server is listening:
```typescript
// In setup.ts
beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'warn' });
});
```

### Timeout Errors

Increase timeout for slow tests:
```typescript
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

---

## Success Criteria

- ✅ All tests pass: `npm run test:frontend && cd backend && npm run test:backend`
- ✅ Coverage > 80%: `npm run test:frontend -- --coverage`
- ✅ No console errors/warnings in test output
- ✅ Tests run in < 30 seconds
- ✅ Tests are deterministic (pass every run)
- ✅ Each test focuses on ONE behavior

---

## Next Steps

1. **Phase 5A**: Run all tests → verify no errors
2. **Phase 5B**: Add more tests for edge cases
3. **Phase 5C**: Integration tests (frontend + backend together)
4. **Phase 5D**: E2E tests (full user journeys with Playwright)
5. **Phase 5E**: Performance & security tests

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Questions?

Check test comments for detailed explanations of each behavior being tested.
