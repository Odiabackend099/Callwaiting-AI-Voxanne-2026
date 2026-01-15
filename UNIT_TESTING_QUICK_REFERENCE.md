# Unit Testing Quick Reference

**Last Updated:** 14 January 2026  
**Status:** ✅ Ready to Test

## Quick Start

### Run All Tests
```bash
cd backend
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- vapi-assistant-manager.test.ts
npm test -- analytics-service.test.ts
npm test -- lead-scoring.test.ts
npm test -- route-handlers.test.ts
```

### Run with Verbose Output
```bash
npm test -- --verbose
npm test -- --verbose --no-coverage
```

### Run with Debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## Test Files Overview

| File | Tests | Focus |
|------|-------|-------|
| `vapi-assistant-manager.test.ts` | 25 | VAPI assistant creation, updates, deletion |
| `analytics-service.test.ts` | 45 | Intent detection, sentiment, lead scoring, analytics |
| `lead-scoring.test.ts` | 40+ | Lead classification, financial values |
| `route-handlers.test.ts` | 16 | Health endpoint, VAPI webhook |

**Total: 180+ test cases**

---

## Expected Results

### All Tests Should Pass ✅
```
PASS src/services/__tests__/vapi-assistant-manager.test.ts
PASS src/services/__tests__/analytics-service.test.ts
PASS src/services/__tests__/lead-scoring.test.ts
PASS src/routes/__tests__/route-handlers.test.ts
PASS src/__tests__/integration/credential-flow.integration.test.ts
...
Test Suites: 9 passed, 9 total
Tests: 180+ passed, 180+ total
```

### Coverage Should Meet Thresholds ✅
```
Statements   : 80% (4000/5000)
Branches     : 75% (3000/4000)
Functions    : 80% (400/500)
Lines        : 80% (4000/5000)
```

### Execution Time ⚡
```
Test Suites: 9 passed (9) in 25s
Tests: 180+ passed (180+) in 24s
```

---

## Troubleshooting

### Issue: "Cannot find module '@/...'"

**Cause:** Jest path mapping not configured  
**Solution:** Verify `jest.config.js` has:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### Issue: "Cannot find module 'vitest'"

**Cause:** Test file still importing from vitest  
**Solution:** Remove vitest imports - they're auto-available in Jest:
```typescript
// ❌ DELETE THIS:
import { describe, it, expect } from 'vitest';

// ✅ Jest provides globally - no import needed
describe('...', () => {
  it('...', () => {
    expect(...).toBe(...);
  });
});
```

### Issue: Timeout errors

**Cause:** Async tests taking >10 seconds  
**Solution:** Increase timeout in jest.config.js:
```javascript
testTimeout: 15000  // 15 seconds
```

Or per-test:
```typescript
it('should do something', async () => {
  // ... test code ...
}, 15000);  // 15 second timeout
```

### Issue: "Jest has detected the following 1 open handle"

**Cause:** Async operations not cleaned up in tests  
**Solution:** Add proper cleanup in afterEach:
```typescript
afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});
```

### Issue: Tests failing with "Cannot find jest"

**Cause:** Jest not installed  
**Solution:** Install dependencies:
```bash
npm install
```

---

## Common Test Patterns

### Testing Async Functions
```typescript
it('should do something async', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});
```

### Testing Error Cases
```typescript
it('should throw error', async () => {
  await expect(functionThatThrows()).rejects.toThrow();
});
```

### Mocking External Services
```typescript
jest.mock('@/services/supabase-client');

it('should call mocked service', async () => {
  mockSupabase.from().select().mockResolvedValue({ data: [...] });
  const result = await testFunction();
  expect(mockSupabase.from).toHaveBeenCalledWith('table_name');
});
```

### Testing Database Updates
```typescript
it('should update database', async () => {
  mockSupabase.from().update().mockResolvedValue({ data: {...} });
  await updateFunction();
  expect(mockSupabase.from().update).toHaveBeenCalledWith(
    expect.objectContaining({ org_id: expectedOrgId })
  );
});
```

### Testing Multi-Tenant Isolation
```typescript
it('should enforce org isolation', async () => {
  const result = await getDataForOrg(orgId1);
  expect(result.org_id).toBe(orgId1);
  expect(result).not.toContainEqual(
    expect.objectContaining({ org_id: orgId2 })
  );
});
```

---

## Viewing Coverage Reports

After running `npm run test:coverage`, open the HTML report:

```bash
# On macOS
open coverage/lcov-report/index.html

# On Linux
xdg-open coverage/lcov-report/index.html

# On Windows
start coverage/lcov-report/index.html
```

The report shows:
- **Line Coverage**: % of lines executed
- **Branch Coverage**: % of if/else branches covered
- **Function Coverage**: % of functions called
- **Statement Coverage**: % of statements executed

---

## Debugging Tests

### Using console.log
```typescript
it('should debug something', () => {
  const value = someFunction();
  console.log('DEBUG:', value);  // Will print to console
  expect(value).toBe(expected);
});
```

Run with:
```bash
npm test -- --verbose
```

### Using Node Debugger
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome DevTools.

### Print All Calls to Mock
```typescript
it('should track all calls', () => {
  mockFunction.mockReturnValue(42);
  mockFunction(1);
  mockFunction(2);
  
  console.log(mockFunction.mock.calls);
  // Output: [[1], [2]]
});
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Tests
  run: |
    cd backend
    npm install
    npm test -- --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./backend/coverage/lcov.info
```

---

## Performance Tips

### Run Tests in Parallel (Default)
Tests run in parallel by default. To run serially:
```bash
npm test -- --runInBand
```

### Run Only Changed Tests
```bash
npm test -- --onlyChanged
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="intent"
```

---

## Best Practices

1. **Keep tests focused** - One assertion per test ideally
2. **Use descriptive names** - `should_return_hot_for_high_value_unbooked` not `test1`
3. **Mock external services** - Don't call real APIs in tests
4. **Test edge cases** - Empty strings, null values, errors
5. **Test behavior, not implementation** - Mock internals, test outputs
6. **Keep tests fast** - <5s for all unit tests
7. **Run tests locally before pushing** - `npm test` before git commit
8. **Check coverage reports** - Aim for 80%+ coverage
9. **Document complex tests** - Use comments for non-obvious assertions
10. **Cleanup after tests** - Clear mocks and timers in afterEach

---

## Quick Checklist Before Committing

- [ ] All tests pass: `npm test`
- [ ] Coverage is 80%+: `npm run test:coverage`
- [ ] No console errors: Check test output
- [ ] No skipped tests: Search for `.skip`
- [ ] No debugging code: Remove `console.log`, `debugger`
- [ ] Mocks are cleaned: `afterEach` clears them
- [ ] Tests are deterministic: Run 5 times, always pass
- [ ] Tests are focused: Clear single purpose

---

**Happy Testing! 🚀**
