# 🧪 Phase 5 Testing - Command Reference Card

Copy these commands to run tests:

---

## ⚡ Quick Start

```bash
# Install test dependencies (first time only)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom msw @vitest/ui

cd backend
npm install --save-dev vitest @vitest/coverage-v8
cd ..
```

---

## 🏃 Run All Tests

```bash
# Frontend + Backend (from root)
npm run test:frontend && cd backend && npm run test:backend

# Or separately:
# Frontend only
npm run test:frontend

# Backend only
cd backend && npm run test:backend
```

---

## 📊 With Coverage Report

```bash
# Frontend coverage
npm run test:frontend -- --coverage

# Backend coverage
cd backend && npm run test:backend -- --coverage

# View HTML coverage report
open coverage/index.html
```

---

## 👁️ Watch Mode (Continuous)

```bash
# Frontend - re-runs on file changes
npm run test:frontend -- --watch

# Backend
cd backend && npm run test:backend -- --watch
```

---

## 🎯 Run Specific Test File

```bash
# Frontend hook test
npm run test:frontend -- src/__tests__/hooks/useOrgValidation.test.ts

# Backend auth middleware test
cd backend && npm run test:backend -- src/__tests__/middleware/auth.test.ts

# Backend calendar booking test
cd backend && npm run test:backend -- src/__tests__/services/calendar-booking.test.ts

# Frontend API route test
npm run test:frontend -- src/__tests__/api/orgs-route.test.ts
```

---

## 🔍 Search for Specific Tests

```bash
# Frontend - tests matching pattern
npm run test:frontend -- --grep "should return 401"

# Backend - tests with "locking" in name
cd backend && npm run test:backend -- --grep "lock"
```

---

## 🐛 Debug Mode

```bash
# Frontend with debugger
npm run test:frontend -- --inspect-brk

# Backend with debugger
cd backend && npm run test:backend -- --inspect-brk
```

---

## 📈 UI Dashboard

```bash
# Frontend - opens interactive test UI
npm run test:frontend -- --ui

# Backend - opens interactive test UI
cd backend && npm run test:backend -- --ui
```

---

## 🧹 Clean & Reset

```bash
# Clear Vitest cache
rm -rf node_modules/.vitest
cd backend && rm -rf node_modules/.vitest && cd ..

# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
cd backend && npm install && cd ..
```

---

## 📋 Test Suite Breakdown

**53 Total Tests:**

| Component | Tests | File |
|-----------|-------|------|
| **Frontend** | 29 | - |
| useOrgValidation Hook | 10 | `src/__tests__/hooks/useOrgValidation.test.ts` |
| API Routes (GET/PUT) | 19 | `src/__tests__/api/orgs-route.test.ts` |
| **Backend** | 24 | - |
| Auth Middleware | 12 | `backend/src/__tests__/middleware/auth.test.ts` |
| Calendar Booking Locks | 12 | `backend/src/__tests__/services/calendar-booking.test.ts` |

---

## ✅ What Each Test Validates

### Auth Middleware (12 tests)
```bash
npm run test:frontend -- src/__tests__/middleware/auth.test.ts
```
- ✅ Valid org_id passes through
- ✅ Missing org_id returns 401
- ✅ Invalid UUID format returns 400
- ✅ No fallback to "first organization"

### useOrgValidation Hook (10 tests)
```bash
npm run test:frontend -- src/__tests__/hooks/useOrgValidation.test.ts
```
- ✅ Validates UUID before API call
- ✅ 401 triggers login redirect
- ✅ 404 sets error state
- ✅ Loading state management

### API Routes (19 tests)
```bash
npm run test:frontend -- src/__tests__/api/orgs-route.test.ts
```
- ✅ GET returns 200 with data (authenticated)
- ✅ GET returns 401 (unauthenticated)
- ✅ GET returns 403 (cross-org access)
- ✅ PUT admin-only enforcement
- ✅ PUT status field read-only
- ✅ PUT input validation (name required, max 100)

### Calendar Booking Locks (12 tests)
```bash
cd backend && npm run test:backend -- src/__tests__/services/calendar-booking.test.ts
```
- ✅ Prevents concurrent double-bookings
- ✅ Allows concurrent different slots
- ✅ Auto-releases locks on timeout
- ✅ Handles race conditions correctly

---

## 💡 Common Scenarios

**"I want to see all failing tests"**
```bash
npm run test:frontend
# Scroll to bottom for summary
```

**"I want to debug a specific test"**
```bash
npm run test:frontend -- --grep "should return 401" --inspect-brk
# Open chrome://inspect in browser
```

**"I want to watch only one test file"**
```bash
npm run test:frontend -- src/__tests__/api/orgs-route.test.ts --watch
```

**"I want to see test UI"**
```bash
npm run test:frontend -- --ui
# Opens browser UI
```

**"Tests are slow, clear cache"**
```bash
rm -rf node_modules/.vitest
npm run test:frontend
```

---

## 📚 Documentation Files

1. **[PHASE_5_TESTING_PLAN.md](PHASE_5_TESTING_PLAN.md)** - Master blueprint (350+ lines)
2. **[TESTING_QUICK_START.md](TESTING_QUICK_START.md)** - Quick reference guide (400+ lines)
3. **[PHASE_5_TESTING_COMPLETE.md](PHASE_5_TESTING_COMPLETE.md)** - Implementation summary
4. **[COMMAND_REFERENCE.md](COMMAND_REFERENCE.md)** - This file

---

## 🎓 Learning Resources

**In each test file:**
- Top comment explains the principle
- Table shows all test cases
- Each test has descriptive name
- Comments explain arrangement
- Clear assertions show expectations

**Example test structure:**
```typescript
describe('Component', () => {
  it('should do one specific thing', () => {
    // ARRANGE: Set up test data
    const input = 'test';
    
    // ACT: Call the function
    const result = myFunction(input);
    
    // ASSERT: Check the result
    expect(result).toBe('expected');
  });
});
```

---

## 🚀 CI/CD Integration

**For GitHub Actions:**
```yaml
- name: Run tests
  run: |
    npm run test:frontend -- --coverage
    cd backend && npm run test:backend -- --coverage
```

---

## ✨ Best Practices

- ✅ Run tests before committing: `npm run test:frontend`
- ✅ Use watch mode during development: `npm run test:frontend -- --watch`
- ✅ Check coverage regularly: `npm run test:frontend -- --coverage`
- ✅ Keep tests isolated (no dependencies between tests)
- ✅ Use clear test names (describe the behavior)
- ✅ Mock external dependencies (no real API/DB calls)

---

**Ready to test!** Pick a command above and run it. 🎉
