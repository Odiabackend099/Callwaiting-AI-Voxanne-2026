# 🔐 Security Refactor: Integration State Management

## Overview
**Problem:** Frontend hard-codes integration checks for Vapi/OpenAI/Twilio, exposing sensitive environment variables and violating the "Backend as Single Source of Truth" protocol.

**Solution:** Move all integration state queries to a secure backend endpoint that returns only boolean status flags.

**Impact:** Eliminates security vulnerabilities, improves maintainability, and provides consistent UX regardless of client-side environment.

---

## Phase 1: Backend Endpoint Implementation

### Objective
Create a secure `/api/integrations/status` endpoint that checks for service credentials server-side only.

### Technical Requirements
- Route: `src/api/integrations/status.ts` (backend Express/Node route)
- Method: GET
- Auth: No authentication required (returns non-sensitive boolean flags)
- Response Format:
  ```json
  {
    "integrations": {
      "vapi": true/false,
      "openai": true/false,
      "twilio": true/false,
      "supabase": true/false,
      "stripe": true/false
    },
    "timestamp": "2026-01-14T14:35:00.000Z"
  }
  ```

### Implementation Details
- Check for presence of secret keys: `VAPI_API_KEY`, `OPENAI_API_KEY`, `TWILIO_AUTH_TOKEN`, etc.
- **DO NOT** return the actual keys, only boolean status
- Implement caching with 5-minute TTL to reduce redundant checks
- Add error handling for failed checks

### Success Criteria
✅ Endpoint responds with correct integration status
✅ No sensitive data exposed in response
✅ Response time < 100ms (cached)
✅ Works with all integrated services

---

## Phase 2: Frontend Hook & Component Refactor

### Objective
Replace hardcoded environment checks with server-driven hook.

### Technical Requirements

#### 2A: Create Hook (`src/hooks/useIntegrationStatus.ts`)
- Query `/api/integrations/status` on mount
- Cache result in React state
- Provide loading/error states
- Auto-refresh on focus (optional)

#### 2B: Identify Hardcoded Checks
Search for patterns:
- `process.env.NEXT_PUBLIC_VAPI_API_KEY`
- `process.env.VAPI_API_KEY`
- Direct environment variable references in `.tsx` files
- Conditional renders based on env checks

#### 2C: Refactor Components
- Replace all hardcoded checks with `useIntegrationStatus()`
- Update error messages to reflect server-side state
- Remove `process.env` references from client components

### Success Criteria
✅ All integration checks use the backend hook
✅ No NEXT_PUBLIC_ secrets in frontend code
✅ UI renders based on backend response
✅ Loading states display while checking status

---

## Phase 3: Security Audit & Cleanup

### Objective
Verify no secrets are exposed via NEXT_PUBLIC_ prefix or direct env access.

### Technical Requirements

#### 3A: Run Audit Script
- Execute `audit-security.js` against entire codebase
- Identify all NEXT_PUBLIC_ prefixed sensitive variables
- Scan for process.env usage in .tsx files

#### 3B: Remediation
- Remove NEXT_PUBLIC_ prefix from all sensitive keys
- Update .env files with corrected variable names
- Rotate compromised API keys in Vapi/OpenAI/Twilio dashboards

#### 3C: Documentation
- Create security audit report
- Document all changes made
- Provide team guidelines for future environment variable usage

### Success Criteria
✅ Security audit script returns no red flags
✅ All sensitive keys removed from browser bundle
✅ .env file follows naming conventions
✅ Team guidelines documented

---

## File Structure Changes

```
backend/src/
├── api/
│   ├── integrations/
│   │   └── status.ts          [NEW]
│   └── ...existing routes
└── ...

frontend/src/
├── hooks/
│   └── useIntegrationStatus.ts [NEW]
├── pages/
│   └── ...components using hook
└── ...

root/
├── audit-security.js           [NEW]
└── .env                         [MODIFIED - remove NEXT_PUBLIC_ prefixes]
```

---

## Environment Variables: Before & After

### ❌ BEFORE (Insecure)
```env
NEXT_PUBLIC_VAPI_API_KEY=xxxxx
NEXT_PUBLIC_OPENAI_API_KEY=xxxxx
VAPI_API_KEY=xxxxx
OPENAI_API_KEY=xxxxx
```

### ✅ AFTER (Secure)
```env
# Backend-only secrets (NEVER expose with NEXT_PUBLIC_)
VAPI_API_KEY=xxxxx
OPENAI_API_KEY=xxxxx
TWILIO_AUTH_TOKEN=xxxxx

# Public endpoints (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=xxxxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

---

## Testing Criteria

### Unit Tests
- Backend endpoint returns correct boolean for each service
- Hook properly formats response
- Error handling works when endpoint fails

### Integration Tests
- Frontend correctly queries backend
- UI updates when integration status changes
- Loading states display appropriately

### Security Tests
- Run audit script confirms no NEXT_PUBLIC_ secrets
- Browser DevTools shows no API keys in source
- Network requests don't expose credentials

---

## Timeline

| Phase | Duration | Dependency |
|-------|----------|-----------|
| Phase 1: Backend Endpoint | 30 min | None |
| Phase 2: Frontend Refactor | 45 min | Phase 1 Complete |
| Phase 3: Security Audit | 20 min | Phase 2 Complete |
| **Total** | **~95 minutes** | - |

---

## Rollback Plan

If issues arise:
1. Revert endpoint to hardcoded checks (temporary)
2. Restore .env to previous state
3. Disable hook usage in components
4. Investigate logs and retry

---

## Sign-Off Checklist

- [ ] Phase 1: Backend endpoint tested
- [ ] Phase 2: All components refactored and tested
- [ ] Phase 3: Security audit passed with zero flags
- [ ] Code review completed
- [ ] Deployed to staging for QA verification
- [ ] Production rollout approved

