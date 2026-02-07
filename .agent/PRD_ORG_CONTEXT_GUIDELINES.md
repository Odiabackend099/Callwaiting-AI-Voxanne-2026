# PRD Addendum: Organization Context Guidelines

**Date:** 2026-02-07
**Type:** Critical Security & Architecture Guideline
**Status:** ✅ MANDATORY - All developers must follow
**Bug Reference:** Browser test voice mismatch (2026-02-07)

---

## Executive Summary

This document establishes **mandatory guidelines** for handling organization context in the Voxanne AI platform. Following the discovery of a critical bug where browser tests were fetching data from random organizations, these guidelines prevent data leakage and ensure multi-tenant isolation.

**Key Principle:** ALWAYS use `req.user?.orgId` from JWT authentication. NEVER query organizations randomly.

---

## Table of Contents

1. [The Problem We're Preventing](#the-problem-were-preventing)
2. [Correct Pattern (ALWAYS Use This)](#correct-pattern-always-use-this)
3. [Incorrect Pattern (NEVER Use This)](#incorrect-pattern-never-use-this)
4. [Enforcement Mechanisms](#enforcement-mechanisms)
5. [Testing Requirements](#testing-requirements)
6. [Migration Guide](#migration-guide)
7. [FAQ](#faq)

---

## The Problem We're Preventing

### Bug History: Browser Test Voice Mismatch (2026-02-07)

**Symptoms:**
- Frontend UI showed: Rohan (male voice) + "Thank you for calling Serenity Medspa..."
- Browser test played: JennyNeural (female voice) + Generic message
- **Mismatch!** UI and test showed different configurations

**Root Cause:**
The `getOrgAndVapiConfig()` helper function queried the organizations table without filtering:

```typescript
// BROKEN CODE (DO NOT USE):
const { data: org } = await supabase
  .from('organizations')
  .select('id')
  .limit(1)
  .single();

const orgId = org.id;  // Returns RANDOM org (whichever was created first)!
```

**Impact:**
- Browser test fetched agent config from demo org (`a0000000-0000-0000-0000-000000000001`)
- Frontend UI fetched from authenticated user's org (`46cf2995-2bee-44e3-838b-24151486fe4e`)
- Data leakage across organizations (SECURITY RISK)
- Customer-facing bug (wrong voice, wrong prompts, wrong behavior)

**Why It Happened:**
- Developer assumed there was only one organization
- No validation that orgId came from authentication
- `.limit(1).single()` without org filter returns first row in table
- Multi-tenant architecture broken at SSOT level

---

## Correct Pattern (ALWAYS Use This)

### Single Source of Truth: JWT Authentication

The **ONLY** way to determine which organization to use is from JWT authentication:

```typescript
// ✅ CORRECT: Extract orgId from JWT authentication
const orgId = req.user?.orgId;

// Validate it exists
if (!orgId) {
  return res.status(401).json({
    error: 'Organization context required',
    message: 'Your authentication token is missing organization context. Please log in again.'
  });
}

// Now use it to filter database queries
const { data: agent, error } = await supabase
  .from('agents')
  .select('*')
  .eq('org_id', orgId)  // ✅ Filter by authenticated user's org
  .eq('role', 'inbound')
  .single();
```

### JWT Structure

The `req.user` object comes from Supabase Auth middleware and contains:

```typescript
interface AuthenticatedUser {
  id: string;           // User UUID from auth.users
  email: string;        // User email
  orgId: string;        // Organization UUID from app_metadata ← SSOT
  role?: 'admin' | 'agent' | 'viewer';  // User role
}
```

**Where orgId comes from:**
1. User signs up → `organizations` table row created → UUID generated
2. User record in `auth.users` gets `app_metadata.org_id` set to UUID
3. Supabase Auth middleware decodes JWT → Extracts `app_metadata.org_id` → Attaches to `req.user.orgId`
4. Your code uses `req.user.orgId` for ALL org-specific queries

### Validation Helpers (Use These)

```typescript
// Import validation helpers
import {
  assertOrgContext,
  requireOrgContext,
  getOrgIdFromRequest,
  AuthenticatedRequest
} from '../middleware/org-context-validator';

// Option 1: Middleware (validates before route handler)
router.get('/api/agents', requireOrgContext, async (req: AuthenticatedRequest, res) => {
  // orgId is guaranteed to exist here
  const orgId = req.user.orgId;
  // ... rest of handler
});

// Option 2: Manual assertion at start of handler
router.get('/api/agents', async (req, res) => {
  assertOrgContext(req);  // Throws if orgId missing
  const orgId = req.user.orgId;
  // ... rest of handler
});

// Option 3: Helper function (validates + returns orgId)
router.get('/api/agents', async (req, res) => {
  const orgId = getOrgIdFromRequest(req);  // Throws if missing
  // ... rest of handler
});
```

---

## Incorrect Pattern (NEVER Use This)

### Anti-Pattern #1: Random Organization Query

```typescript
// ❌ WRONG: Returns RANDOM organization!
const { data: org } = await supabase
  .from('organizations')
  .select('id')
  .limit(1)
  .single();

const orgId = org.id;  // This is whichever org was created first in database!

// WHY THIS IS WRONG:
// - Returns first row in table (random from user's perspective)
// - Breaks multi-tenant isolation
// - Causes data leakage across organizations
// - Breaks when multiple orgs exist in production
```

### Anti-Pattern #2: Client-Provided Org ID

```typescript
// ❌ WRONG: Client can lie about their org!
const orgId = req.body.orgId;  // User can send ANY orgId!

// WHY THIS IS WRONG:
// - Client-controlled input (security risk)
// - User can access other organizations' data
// - Authorization bypass vulnerability
// - Fails security audits
```

### Anti-Pattern #3: Query Without Org Filter

```typescript
// ❌ WRONG: Queries across ALL organizations!
const { data: agents } = await supabase
  .from('agents')
  .select('*')
  .limit(10);

// WHY THIS IS WRONG:
// - Returns data from all organizations
// - Leaks sensitive information
// - Breaks multi-tenancy
// - HIPAA/GDPR violation
```

### Anti-Pattern #4: Assuming Single Organization

```typescript
// ❌ WRONG: Assumes only one org exists!
const { data: config } = await supabase
  .from('inbound_configs')
  .select('*')
  .single();

// WHY THIS IS WRONG:
// - Breaks when multiple orgs use the platform
// - Works in development, fails in production
// - Silent data corruption
```

---

## Enforcement Mechanisms

### 1. Runtime Validation

```typescript
// backend/src/middleware/org-context-validator.ts

/**
 * Throws error if orgId is missing
 */
export function assertOrgContext(req: Request): asserts req is AuthenticatedRequest {
  if (!req.user?.orgId) {
    throw new Error('CRITICAL: Organization context missing from authenticated request');
  }
}

/**
 * Middleware: Validates org context before route handler
 */
export function requireOrgContext(req: Request, res: Response, next: NextFunction): void {
  try {
    assertOrgContext(req);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Organization context required' });
  }
}
```

### 2. TypeScript Guards

```typescript
/**
 * Type guard: Ensures req.user has orgId
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    orgId: string;  // REQUIRED - enforced by type system
    role?: 'admin' | 'agent' | 'viewer';
  };
}

// Usage:
async function handler(req: AuthenticatedRequest, res: Response) {
  // TypeScript knows orgId exists here
  const orgId = req.user.orgId;
}
```

### 3. Automated Testing

```typescript
// backend/src/__tests__/unit/org-context-validator.test.ts

describe('Organization Context Validator', () => {
  it('should throw when orgId is missing', () => {
    const req = { user: { id: 'user-123', email: 'test@example.com' } } as any;
    expect(() => assertOrgContext(req)).toThrow('CRITICAL');
  });

  it('should pass when orgId is present', () => {
    const req = {
      user: { id: 'user-123', email: 'test@example.com', orgId: 'org-123' }
    } as Request;
    expect(() => assertOrgContext(req)).not.toThrow();
  });
});
```

### 4. Code Review Checklist

**Before approving any PR, verify:**

- [ ] All database queries include `.eq('org_id', orgId)` filter
- [ ] `orgId` comes from `req.user?.orgId`, NOT client input
- [ ] No `.limit(1).single()` without org filter
- [ ] No `.from('organizations').select('id')` queries
- [ ] Route handlers use validation helpers
- [ ] Tests verify org isolation

### 5. Linting Rules (Future)

```javascript
// eslint-plugin-voxanne (to be created)
{
  "rules": {
    "no-random-org-query": "error",
    "require-org-filter": "error",
    "no-client-org-id": "error"
  }
}
```

---

## Testing Requirements

### Unit Tests

Every route handler MUST have tests covering:

```typescript
describe('GET /api/agents', () => {
  it('should return 401 when orgId is missing', async () => {
    const req = { user: { id: 'user-123', email: 'test@example.com' } } as any;
    const res = await request(app).get('/api/agents').set('Authorization', 'Bearer invalid');
    expect(res.status).toBe(401);
  });

  it('should fetch data from authenticated user\'s org', async () => {
    const req = { user: { id: 'user-123', orgId: 'org-123' } } as Request;
    // ... test that queries use org-123
  });

  it('should NOT return data from other organizations', async () => {
    // Create data for org-123 and org-456
    // Login as user in org-123
    // Verify query only returns org-123 data
  });
});
```

### Integration Tests

Test multi-org isolation:

```typescript
describe('Multi-org isolation', () => {
  it('should isolate data between organizations', async () => {
    // Create org1 with agent1
    // Create org2 with agent2
    // Login as user in org1
    // Fetch agents
    // Verify only agent1 returned, NOT agent2
  });
});
```

### Manual Testing Checklist

- [ ] Login as org A → Create agent config
- [ ] Login as org B → Create different agent config
- [ ] Login as org A → Verify sees only org A config
- [ ] Login as org B → Verify sees only org B config
- [ ] Browser test for org A → Verify uses org A config
- [ ] Browser test for org B → Verify uses org B config

---

## Migration Guide

### Step 1: Audit Existing Code

Search for dangerous patterns:

```bash
# Find random org queries
grep -r "from('organizations')" backend/src/routes/

# Find queries without org filter
grep -r "\.limit(1)\.single()" backend/src/routes/

# Find client-provided org IDs
grep -r "req\.body\.orgId" backend/src/routes/
```

### Step 2: Replace Broken Patterns

**Before (BROKEN):**
```typescript
async function getOrgAndVapiConfig(req: Request, res: Response) {
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
  const orgId = org.id;  // ❌ Random org!
  // ...
}
```

**After (FIXED):**
```typescript
async function getOrgAndVapiConfig(req: Request, res: Response) {
  const orgId = req.user?.orgId;  // ✅ From JWT auth
  if (!orgId) {
    return res.status(401).json({ error: 'Organization context required' });
  }
  // ...
}
```

### Step 3: Add Validation

```typescript
// Add at top of route handlers
import { assertOrgContext } from '../middleware/org-context-validator';

router.get('/api/agents', async (req, res) => {
  assertOrgContext(req);  // ✅ Validates orgId exists
  const orgId = req.user.orgId;
  // ... rest of handler
});
```

### Step 4: Add Tests

Create test file for each route verifying org isolation.

### Step 5: Update Documentation

Add comments explaining why orgId comes from JWT, not queries.

---

## FAQ

### Q: Why can't I query the organizations table?

**A:** The organizations table exists for administrative purposes (managing org settings, billing, etc.). It should NEVER be used to determine which org to use for a request. That comes from JWT authentication (`req.user.orgId`).

### Q: What if I need to list all organizations?

**A:** Admin-only endpoints can list organizations, but:
1. Require super-admin role
2. Use for display purposes only
3. Never use for filtering user data

### Q: What about background jobs/cron tasks?

**A:** Background jobs don't have `req.user` context. Instead:
1. Query all orgs explicitly: `.from('organizations').select('id')`
2. Loop through each org
3. Process data for that org with `.eq('org_id', org.id)`

```typescript
// ✅ CORRECT for background jobs
const { data: orgs } = await supabase.from('organizations').select('id');

for (const org of orgs) {
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', org.id);  // Process each org separately
  // ...
}
```

### Q: What about webhooks without authentication?

**A:** Webhooks should:
1. Extract org identifier from webhook payload (e.g., Vapi sends org context)
2. Validate webhook signature
3. Use that org ID for database queries

```typescript
// ✅ CORRECT for webhooks
router.post('/webhooks/vapi', async (req, res) => {
  // Vapi sends org-specific data in payload
  const orgId = req.body.metadata?.org_id;

  if (!orgId) {
    return res.status(400).json({ error: 'Missing org_id in webhook payload' });
  }

  // Validate webhook signature
  // ...

  // Use orgId from webhook
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', orgId)
    .single();
});
```

### Q: What if orgId is missing from JWT?

**A:** This indicates a problem with authentication:
1. User needs to log in again
2. JWT token might be expired
3. User account might be misconfigured

Return 401 error and ask user to re-authenticate.

---

## Reference Implementation

See these files for correct patterns:

| File | Purpose | Pattern |
|------|---------|---------|
| `backend/src/middleware/org-context-validator.ts` | Validation helpers | Runtime validation |
| `backend/src/routes/founder-console-v2.ts` | Route handlers | Uses `req.user.orgId` |
| `backend/src/__tests__/unit/org-context-validator.test.ts` | Tests | Org isolation tests |

---

## Approval & Sign-Off

This document is **mandatory** for all developers working on the Voxanne AI platform.

**Approved By:**
- Engineering Lead: [To be signed]
- Security Team: [To be signed]
- Product Owner: [To be signed]

**Date:** 2026-02-07

**Enforcement:** Effective immediately. All new code MUST follow these guidelines. Existing code will be audited and migrated within 30 days.

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-07 | Claude Sonnet 4.5 | Initial document after browser test bug fix |

---

## Related Documents

- [Main PRD](./.agent/prd.md)
- [Architecture Decisions](./.agent/ARCHITECTURE_DECISIONS.md)
- [Security Guidelines](../SECURITY.md)
- [API Documentation](../API.md)
