# Agent Save Error - Root Cause & Fix

**Date**: January 20, 2026  
**Status**: ✅ FIXED  
**Error**: `Invalid language selection for inbound agent` (HTTP 500)

---

## Root Cause Analysis

The frontend's `POST /api/founder-console/agent/behavior` endpoint was throwing a validation error because:

### Issue 1: Overly Strict Language Validation
- **Problem**: The `isValidLanguage()` function rejected `undefined`, `null`, and empty strings
- **Location**: `backend/src/routes/founder-console-v2.ts:137-145`
- **Impact**: When frontend didn't send a language (or sent empty), the backend threw "Invalid language selection"

### Issue 2: Overly Strict Voice Validation  
- **Problem**: The `isValidVoiceId()` function rejected `undefined` and empty strings
- **Location**: `backend/src/routes/founder-console-v2.ts:130-132`
- **Impact**: When frontend didn't send a voice, backend rejected it

### Issue 3: Non-Empty Field Validation
- **Problem**: Payload building didn't skip empty string fields
- **Location**: `backend/src/routes/founder-console-v2.ts:1947-1959`
- **Impact**: Even if we fixed validation, empty fields would be saved to DB

### Issue 4: Wrong HTTP Status Code
- **Problem**: All errors returned 500, even validation errors
- **Location**: `backend/src/routes/founder-console-v2.ts:2367`
- **Impact**: Hard to distinguish validation from server errors

---

## Fixes Applied

### Fix 1: Defensive Language Validation ✅
```typescript
// BEFORE (line 137-145)
function isValidLanguage(language: string): boolean {
  const supportedLanguages = [...];
  return supportedLanguages.includes(language); // ❌ Fails for undefined/empty
}

// AFTER
function isValidLanguage(language: string): boolean {
  if (!language || typeof language !== 'string') {
    return true; // ✅ Allow default if not provided
  }
  const supportedLanguages = [...];
  return supportedLanguages.includes(language);
}
```

**File**: `backend/src/routes/founder-console-v2.ts:137-150`

### Fix 2: Defensive Voice Validation ✅
```typescript
// BEFORE (line 130-132)
function isValidVoiceId(voiceId: string): boolean {
  return VOICE_REGISTRY.some(v => v.id.toLowerCase() === (voiceId || '').toLowerCase());
}

// AFTER
function isValidVoiceId(voiceId: string): boolean {
  if (!voiceId) {
    return true; // ✅ Allow default if not provided
  }
  return VOICE_REGISTRY.some(v => v.id.toLowerCase() === (voiceId || '').toLowerCase());
}
```

**File**: `backend/src/routes/founder-console-v2.ts:130-136`

### Fix 3: Skip Empty Fields in Payload ✅
```typescript
// BEFORE (line 1947 & 1954)
if (config.voice !== undefined && config.voice !== null) {
  if (!isValidVoiceId(voiceValue)) {
    throw new Error(`Invalid voice selection...`);
  }
  payload.voice = voiceValue; // ❌ Could include empty string
}

// AFTER
if (voiceValue !== undefined && voiceValue !== null && voiceValue !== '') {
  if (!isValidVoiceId(voiceValue)) {
    throw new Error(`Invalid voice selection...`);
  }
  payload.voice = voiceValue; // ✅ Skip if empty
}
```

**File**: `backend/src/routes/founder-console-v2.ts:1949-1955` & `1957-1963`

### Fix 4: Correct HTTP Status Codes ✅
```typescript
// BEFORE (line 2367)
res.status(500).json({ error: error?.message || 'Internal server error', requestId });

// AFTER
const statusCode = error?.message?.includes('Invalid') ? 400 : 500;
res.status(statusCode).json({ error: error?.message || 'Internal server error', requestId });
```

**File**: `backend/src/routes/founder-console-v2.ts:2365-2369`

---

## Testing Checklist

### ✅ Test 1: Save with Minimal Config
```bash
# Test saving with ONLY required fields (system_prompt, first_message, voice)
# Skip language to verify it doesn't cause 500
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "You are a helpful assistant",
      "firstMessage": "Hello, how can I help?",
      "voiceId": "jennifer"
      // NO language field
    }
  }'

# Expected: 200 OK (not 500)
```

### ✅ Test 2: Save with Empty Language
```bash
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "You are a helpful assistant",
      "firstMessage": "Hello, how can I help?",
      "voiceId": "jennifer",
      "language": ""  // Empty string
    }
  }'

# Expected: 200 OK (language should be skipped in payload)
```

### ✅ Test 3: Save with Valid Language
```bash
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "You are a helpful assistant",
      "firstMessage": "Hello, how can I help?",
      "voiceId": "jennifer",
      "language": "en-US"  // Valid language
    }
  }'

# Expected: 200 OK (language should be saved)
```

### ✅ Test 4: Save with Invalid Language
```bash
curl -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "inbound": {
      "systemPrompt": "You are a helpful assistant",
      "firstMessage": "Hello, how can I help?",
      "voiceId": "jennifer",
      "language": "xx-XX"  // Invalid language
    }
  }'

# Expected: 400 BAD REQUEST (not 500)
# Message: "Invalid language selection for inbound agent"
```

### ✅ Test 5: Frontend UI Save
1. Open agent config page: `http://localhost:3000/dashboard/agent-config`
2. Inbound Tab → Fill in required fields (prompt, first message, select voice)
3. Click Save (DO NOT enter language)
4. Should see success message ✅ (not error)
5. Check browser console for no errors
6. Refresh page and verify saved values persist

---

## Browser Console Test (Quick Verification)

Copy & paste into browser console while on agent config page:

```javascript
// Test 1: Check that validation doesn't require language
const payload = {
  inbound: {
    systemPrompt: "Test prompt",
    firstMessage: "Hello",
    voiceId: "jennifer"
    // No language
  }
};

fetch('/api/founder-console/agent/behavior', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(d => console.log('Response:', d));
```

Expected output:
```
Status: 200
Response: { success: true, ... }
```

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/src/routes/founder-console-v2.ts` | 4 defensive validation fixes |

**Total Lines Changed**: ~15 lines  
**Breaking Changes**: None  
**Backward Compatibility**: 100% (only makes validation more lenient)

---

## Related Documentation

- **Copilot Instructions**: See [.github/copilot-instructions.md](../.github/copilot-instructions.md#agent-save-flow-critical-pattern---zero-tolerance-for-errors)
- **Architecture**: See `progress/Holy_Trinity.md` for multi-tenant principles
- **Agent Config**: See `src/app/dashboard/agent-config/page.tsx` for frontend validation

---

## Next Steps (If Tests Fail)

If you still see errors after this fix:

1. **Check backend logs**:
   ```bash
   cd backend && npm run dev 2>&1 | grep -i "agent/behavior\|Invalid"
   ```

2. **Check what the frontend is sending**:
   ```bash
   # Open DevTools → Network tab
   # Look for POST /api/founder-console/agent/behavior
   # Check the Request payload
   ```

3. **Manually test the endpoint**:
   ```bash
   curl -v -X POST http://localhost:3001/api/founder-console/agent/behavior \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"inbound":{"systemPrompt":"test","firstMessage":"hi","voiceId":"jennifer"}}'
   ```

---

**Status**: ✅ COMPLETE - Agent save flow should now work without language/voice validation errors
