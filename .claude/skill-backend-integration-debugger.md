---
name: voxanne-backend-integration-debugger
description: Debug and fix issues in the Voxanne backend-frontend integration. Use when encountering errors with settings, API keys, agent configuration, or Vapi/Twilio integrations.
---

# Voxanne Backend Integration Debugger

Systematic debugging skill for the Voxanne backend-frontend integration system.

## Critical Issues Fixed (Dec 14, 2025)

### ✅ FIXED: Hardcoded 'default' agentId
**File**: `src/app/dashboard/settings/page.tsx`
**Issue**: Frontend sent `agentId: 'default'` but backend expected actual UUID
**Fix**: Now stores actual agent ID from `/api/assistants` response in state, uses that ID for all updates

### ✅ FIXED: Field naming inconsistency
**Files**: `src/app/dashboard/settings/page.tsx`, `backend/src/routes/assistants.ts`
**Issue**: Frontend sent camelCase (`systemPrompt`) but database expected snake_case (`system_prompt`)
**Fix**: Backend now transforms camelCase to snake_case before database update

### ✅ FIXED: Backend crashes on missing VAPI_API_KEY
**File**: `backend/src/routes/assistants.ts`
**Issue**: Server threw error on startup if env var missing
**Fix**: Vapi client now optional, checked at runtime per-request

### ✅ FIXED: Empty API key validation
**File**: `src/app/dashboard/settings/page.tsx`
**Issue**: Validated empty strings as valid keys
**Fix**: Added `if (!value.trim())` check before validation

### ✅ FIXED: No network retry logic
**File**: `src/app/dashboard/settings/page.tsx`
**Issue**: Single network failure caused save to fail (Nigeria network reality)
**Fix**: Added `fetchWithRetry()` with exponential backoff (250ms, 500ms, 1000ms)

### ✅ FIXED: Sequential API calls on load
**File**: `src/app/dashboard/settings/page.tsx`
**Issue**: 3 fetches done one-by-one instead of parallel
**Fix**: Now uses `Promise.all()` for parallel fetching

### ✅ FIXED: Memory leak from timeouts
**File**: `src/app/dashboard/settings/page.tsx`
**Issue**: setTimeout not cleared on unmount
**Fix**: Store timeout IDs in useRef, clear in cleanup function

### ✅ FIXED: Race condition in concurrent saves
**File**: `src/app/dashboard/settings/page.tsx`
**Issue**: User could click multiple save buttons simultaneously
**Fix**: Added `globalSaving` state, disables all buttons during any save

### ✅ FIXED: Missing agentId validation
**File**: `backend/src/routes/assistants.ts`
**Issue**: Route didn't validate agentId exists before updating
**Fix**: Added explicit check, returns 404 if agent not found

### ✅ FIXED: Unnecessary context rebuilding
**File**: `backend/src/routes/assistants.ts`
**Issue**: Rebuilt full context even for voice-only updates
**Fix**: Only rebuild context when `systemPrompt` changes

## Remaining Issues to Address

### 🟡 HIGH PRIORITY

1. **No rate limiting on settings endpoint**
   - **File**: `backend/src/routes/founder-console-settings.ts`
   - **Fix**: Add rate limiting middleware (max 5 requests/minute per IP)

2. **API keys logged in console**
   - **Files**: Multiple backend routes
   - **Fix**: Remove or redact sensitive info from logs

3. **No input sanitization**
   - **File**: `src/app/dashboard/settings/page.tsx`
   - **Issue**: System prompt and first message not sanitized
   - **Fix**: Sanitize HTML/script tags before saving

### 🟠 MEDIUM PRIORITY

4. **No JSDoc documentation**
   - **Functions**: `saveApiKeyField()`, `saveAgentField()`, `buildAgentContext()`
   - **Fix**: Add JSDoc comments with param and return types

5. **No success toast notifications**
   - **Issue**: "Saved" indicator disappears after 3s, easy to miss
   - **Fix**: Implement toast notification system

6. **No unsaved changes warning**
   - **Issue**: User can navigate away losing unsaved changes
   - **Fix**: Add `beforeunload` event listener

## Testing Checklist

### Frontend
- [ ] Load settings page - should fetch data in parallel
- [ ] Edit Vapi API key - should validate before save
- [ ] Enter empty value - should show error
- [ ] Simulate network failure - should retry 3 times
- [ ] Click multiple save buttons - should prevent race condition
- [ ] Unmount component - should clear all timeouts

### Backend
- [ ] Start without VAPI_API_KEY - should not crash
- [ ] POST to `/api/assistants/auto-sync` with invalid agentId - should return 404
- [ ] POST with camelCase fields - should transform to snake_case
- [ ] POST with only voice update - should not rebuild context
- [ ] POST with systemPrompt update - should rebuild context

### Integration
- [ ] Change API key - should validate and save
- [ ] Change system prompt - should sync to Vapi
- [ ] Change voice - should sync to Vapi
- [ ] Change multiple fields - should save each independently

## Quick Reference

### Frontend Retry Logic
```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [250, 500, 1000] // ms
};

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  attempt = 0
): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt < RETRY_CONFIG.maxAttempts - 1) {
      const delay = RETRY_CONFIG.delays[attempt];
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry<T>(url, options, attempt + 1);
    }
    throw error;
  }
}
```

### Backend Field Transformation
```typescript
// Transform camelCase to snake_case
const dbUpdates: any = {};
if (updates.systemPrompt !== undefined) dbUpdates.system_prompt = updates.systemPrompt;
if (updates.firstMessage !== undefined) dbUpdates.first_message = updates.firstMessage;
if (updates.maxSeconds !== undefined) dbUpdates.max_seconds = updates.maxSeconds;
```

## Common Errors & Solutions

### "Agent not loaded. Please refresh the page."
- **Cause**: agentId is null
- **Solution**: Refresh page to reload agent data

### "Invalid API key - connection failed"
- **Cause**: Vapi API key validation failed
- **Solution**: Check key is correct, try again (will retry 3 times)

### "Failed to save. Please try again."
- **Cause**: Network error after 3 retries
- **Solution**: Check internet connection, try again

### "Vapi not configured"
- **Cause**: Backend started without VAPI_API_KEY env var
- **Solution**: Set VAPI_API_KEY in .env and restart backend

## Files Modified

1. `src/app/dashboard/settings/page.tsx` - Frontend fixes (retry, validation, agentId, parallel fetch, cleanup)
2. `backend/src/routes/assistants.ts` - Backend fixes (optional Vapi, agentId validation, field transformation, context optimization)

## Next Steps

1. Test end-to-end: change one setting, verify it saves and syncs
2. Add rate limiting to settings endpoint
3. Implement input sanitization
4. Add JSDoc documentation
5. Add toast notification system
