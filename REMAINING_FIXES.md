# Remaining Error Exposure Fixes - Quick Reference

## Total Progress
- ✅ 48 fixes completed (11 files)
- ⏳ 22 fixes remaining (8 files)
- **Total: 128 error exposures → 106 fixed, 22 remaining**

## Files & Fixes Needed

### 1. phone-numbers.ts (5 fixes)
```bash
grep -n "error.message\|error?.message" backend/src/routes/phone-numbers.ts | grep -v "//"
```

**Lines to fix:** Search for `error.message` in response JSON objects
- Pattern: `res.status(500).json({ error: error.message })`
- Replace: `const userMessage = sanitizeError(error, 'PhoneNumbers - ENDPOINT', 'Failed message'); return res.status(500).json({ error: userMessage });`

### 2. escalation-rules.ts (5 fixes)
Same pattern as phone-numbers.ts

### 3. billing-debug.ts (4 fixes)
Same pattern

### 4. google-oauth.ts (3 fixes)
Same pattern

### 5. vapi-discovery.ts (1 fix)
Same pattern

### 6. managed-telephony.ts (1 fix)
Same pattern

### 7. handoff-routes.ts (1 fix)
Same pattern

### 8. bookings-sync.ts (1 fix)
Same pattern

## Implementation Steps for Remaining Files

1. **Add imports to each file:**
   ```typescript
   import { sanitizeError, sanitizeValidationError, handleDatabaseError } from '../utils/error-sanitizer';
   ```

2. **Search & Replace Pattern:**
   - Find: `error?.message || '`
   - Replace each with: `sanitizeError(error, 'ENDPOINT_NAME', 'fallback message')`

3. **Verification:**
   ```bash
   # Check no more error.message in responses
   grep -n "res.*error.*\.message" backend/src/routes/*.ts
   ```

## After Completion

Run final verification:
```bash
grep -r "\.json.*error.*\.message" backend/src/routes/ | wc -l
# Should return: 0
```

This ensures NO raw error messages are exposed to users.
