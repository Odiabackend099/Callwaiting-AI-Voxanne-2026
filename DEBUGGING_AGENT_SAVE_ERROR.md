# 🔍 Debugging: Agent Save 500 Error & AbortError

**Date**: 2026-01-19  
**Error Pattern**: Frontend receives 500 error + AbortError (operation aborted)

---

## Issues Identified

### 1. **Backend 500 Error**
- Request to `/api/founder-console/agent/behavior` fails
- Response: `500 Internal Server Error`
- Status: ❓ Not showing in backend logs (async error?)

### 2. **AbortError: This operation was aborted**
- Frontend request gets cancelled
- Likely cause: Request timeout OR backend taking >30 seconds
- Error thrown by browser: `AbortError`

### 3. **Image Aspect Ratio Warning** (Minor)
- Logo src: `/callwaiting-ai-logo.png`
- Missing CSS: `width: auto` or `height: auto`
- Affects: Responsive design

---

## Root Cause Analysis

**Hypothesis 1**: Backend `ensureAssistantSynced()` is hanging
- Vapi API calls timeout or network issue
- Function hangs for >30 seconds
- Frontend abort timeout fires
- Browser cancels request → 500 error

**Hypothesis 2**: Database query timeout
- Agent update query is slow
- Locks on agents table
- RLS policy evaluation slow

**Hypothesis 3**: Unhandled async error
- Tool sync fire-and-forget throws error
- Error not caught, crashes handler
- Returns 500

---

## Step 2 — Implementation Plan

### Phase 1: Diagnose Backend Timeout
- [ ] Add request timeout logging to agent save endpoint
- [ ] Add timer/duration logging to `ensureAssistantSynced()`
- [ ] Check if Vapi API calls are timing out
- [ ] Verify database connection pool has capacity

### Phase 2: Fix Timeout Issues
- [ ] Set request timeout: 60 seconds (allow Vapi API time)
- [ ] Add early error response if sync takes >30 seconds
- [ ] Implement request cancellation handling
- [ ] Add circuit breaker for Vapi API failures

### Phase 3: Fix Image CSS Issue
- [ ] Add `width: auto` and `height: auto` to logo image
- [ ] Test responsive design
- [ ] Remove console warning

### Phase 4: Frontend Error Handling
- [ ] Improve error message to user (currently vague)
- [ ] Show which agent failed to sync
- [ ] Offer retry button
- [ ] Add request timeout display

---

## Testing Criteria

✅ **Phase 1**: Backend logs show clear timing information  
✅ **Phase 2**: Agent save completes within 30 seconds OR returns clear error  
✅ **Phase 3**: No image aspect ratio warning in console  
✅ **Phase 4**: User sees helpful error message (not "operation was aborted")

---

## Quick Diagnostics (Run Now)

```bash
# 1. Check if agent save endpoint is responding
curl -i -X POST http://localhost:3001/api/founder-console/agent/behavior \
  -H "Content-Type: application/json" \
  -d '{"inbound":{"system_prompt":"test"},"outbound":{"system_prompt":"test"}}'

# 2. Check backend process health
ps aux | grep "npm run dev"

# 3. Check database connection
# (In backend terminal, see if queries are slow)
```

---

**Next Step**: Execute Phase 1 diagnostics to identify exact timeout location.
