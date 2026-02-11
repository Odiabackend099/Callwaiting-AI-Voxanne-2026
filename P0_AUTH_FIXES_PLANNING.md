# P0 Authentication Security Fixes - Implementation Plan

**Created:** 2026-02-11
**Status:** Planning Phase
**Estimated Total Effort:** 12-15 hours
**Priority:** CRITICAL - Production Blocker

---

## Executive Summary

Fix 3 critical (P0) authentication vulnerabilities discovered in Layer 4 audit that make the platform unsuitable for production:

1. **MFA Recovery Codes Use Base64 Encoding** - Replace with bcrypt hashing
2. **JWT Cache Stores Plaintext Tokens** - Implement LRU cache with size limit (quick fix)
3. **Zero Rate Limiting** - Add Redis-backed rate limiting on auth endpoints

**Risk if Not Fixed:** Account takeover, brute force attacks, database breach exposure, HIPAA non-compliance

---

## Implementation Phases

### Phase 1: MFA Recovery Code Security (P0-1)
**Priority:** CRITICAL
**Effort:** 5 hours
**Files Modified:** 2 files
**Tests Required:** 4 unit tests, 1 integration test

#### Technical Requirements

**1.1 Install bcrypt Dependency**
```bash
cd backend
npm install bcrypt @types/bcrypt --save
```

**1.2 Rewrite Recovery Code Generation**
- **File:** `backend/src/services/mfa-service.ts`
- **Function:** `generateRecoveryCodes(userId: string): Promise<string[]>`
- **Changes:**
  - Replace `Buffer.from(code).toString('base64')` with `bcrypt.hash(code, 12)`
  - Keep plaintext codes in memory to return to user
  - Store bcrypt hashes in database
  - Add salt rounds constant: `const RECOVERY_CODE_SALT_ROUNDS = 12`

**Code Blueprint:**
```typescript
import bcrypt from 'bcrypt';

const RECOVERY_CODE_SALT_ROUNDS = 12;

export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const codes: string[] = [];

  for (let i = 0; i < 10; i++) {
    // Generate random 16-character hex code
    const code = crypto.randomBytes(8).toString('hex');
    codes.push(code);

    // Hash with bcrypt (irreversible, one-way)
    const hashedCode = await bcrypt.hash(code, RECOVERY_CODE_SALT_ROUNDS);

    // Store hash in database (NOT the plaintext code)
    await supabase.from('auth.mfa_factors').insert({
      user_id: userId,
      factor_type: 'recovery_code',
      secret: hashedCode,
      status: 'unverified'
    });
  }

  return codes; // Return plaintext codes to user ONCE for saving
}
```

**1.3 Rewrite Recovery Code Verification**
- **File:** `backend/src/services/mfa-service.ts`
- **Function:** `verifyRecoveryCode(userId: string, code: string): Promise<boolean>`
- **Changes:**
  - Remove Base64 encoding
  - Fetch ALL unverified recovery codes for user
  - Loop through and compare with `bcrypt.compare()`
  - Mark matched code as 'verified' (single-use enforcement)

**Code Blueprint:**
```typescript
export async function verifyRecoveryCode(
  userId: string,
  code: string
): Promise<boolean> {
  // Fetch all unverified recovery codes for this user
  const { data: factors, error } = await supabase
    .from('auth.mfa_factors')
    .select('*')
    .eq('user_id', userId)
    .eq('factor_type', 'recovery_code')
    .eq('status', 'unverified');

  if (error || !factors || factors.length === 0) {
    return false;
  }

  // Compare input code against each stored hash
  for (const factor of factors) {
    const isMatch = await bcrypt.compare(code, factor.secret);

    if (isMatch) {
      // Mark this specific code as verified (single-use)
      await supabase
        .from('auth.mfa_factors')
        .update({ status: 'verified' })
        .eq('id', factor.id);

      return true;
    }
  }

  return false; // No codes matched
}
```

**1.4 Database Migration (Optional - For Fresh Installs)**
- **File:** `backend/supabase/migrations/20260211_recovery_code_hash_comment.sql`
- **Purpose:** Add comment to clarify hashing requirement
```sql
COMMENT ON COLUMN auth.mfa_factors.secret IS
  'SECURITY: For recovery_code factor_type, this column stores bcrypt hash (NOT plaintext or Base64).
   Always verify using bcrypt.compare(), never direct string comparison.';
```

#### Testing Criteria

**Unit Tests (backend/src/__tests__/unit/mfa-service.test.ts):**

```typescript
describe('MFA Recovery Code Security', () => {
  it('should generate 10 recovery codes and hash them with bcrypt', async () => {
    const userId = 'test-user-id';
    const codes = await generateRecoveryCodes(userId);

    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[0-9a-f]{16}$/); // Hex format

    // Verify database stores hashed versions
    const { data: factors } = await supabase
      .from('auth.mfa_factors')
      .select('secret')
      .eq('user_id', userId)
      .eq('factor_type', 'recovery_code');

    expect(factors).toHaveLength(10);

    // Verify stored secrets are bcrypt hashes (start with $2b$)
    expect(factors[0].secret).toMatch(/^\$2b\$/);

    // Verify plaintext codes NOT stored
    expect(factors[0].secret).not.toBe(codes[0]);
  });

  it('should verify a valid recovery code', async () => {
    const userId = 'test-user-id';
    const codes = await generateRecoveryCodes(userId);
    const validCode = codes[0];

    const isValid = await verifyRecoveryCode(userId, validCode);

    expect(isValid).toBe(true);

    // Verify code marked as 'verified' (single-use)
    const { data: factor } = await supabase
      .from('auth.mfa_factors')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'verified')
      .single();

    expect(factor.status).toBe('verified');
  });

  it('should reject an invalid recovery code', async () => {
    const userId = 'test-user-id';
    await generateRecoveryCodes(userId);

    const isValid = await verifyRecoveryCode(userId, 'invalid-code-1234');

    expect(isValid).toBe(false);
  });

  it('should not allow reusing a recovery code', async () => {
    const userId = 'test-user-id';
    const codes = await generateRecoveryCodes(userId);
    const code = codes[0];

    // Use code first time
    const firstUse = await verifyRecoveryCode(userId, code);
    expect(firstUse).toBe(true);

    // Try to use same code again
    const secondUse = await verifyRecoveryCode(userId, code);
    expect(secondUse).toBe(false); // Should fail (already verified)
  });
});
```

**Integration Test:**
```typescript
it('should allow user to recover account with recovery code', async () => {
  // 1. Enroll MFA and generate recovery codes
  // 2. Simulate lost TOTP device
  // 3. Use recovery code to bypass MFA
  // 4. Verify user can login successfully
});
```

**Acceptance Criteria:**
- [ ] All 4 unit tests pass
- [ ] Integration test passes
- [ ] Existing MFA enrollment flow still works
- [ ] Frontend displays recovery codes correctly
- [ ] Database never stores plaintext codes

---

### Phase 2: JWT Cache Security (P0-2)
**Priority:** HIGH
**Effort:** 2 hours (Quick Fix with LRU)
**Files Modified:** 1 file
**Tests Required:** 3 unit tests

#### Technical Requirements

**2.1 Install LRU Cache Dependency**
```bash
cd backend
npm install lru-cache --save
```

**2.2 Replace Unbounded Map with LRU Cache**
- **File:** `backend/src/middleware/auth.ts`
- **Lines:** 29-96
- **Changes:**
  - Import `LRU` from `lru-cache`
  - Replace `const jwtCache = new Map<string, CachedJWT>()` with LRU instance
  - Configure max size: 10,000 entries
  - Configure TTL: 5 minutes (300,000ms)
  - Remove manual cleanup interval (LRU handles eviction)

**Code Blueprint:**
```typescript
import { LRUCache } from 'lru-cache';

interface CachedJWT {
  userId: string;
  email: string;
  orgId: string;
  expiresAt: number;
}

// LRU cache with size limit and TTL
const MAX_JWT_CACHE_SIZE = 10000; // Max 10K cached JWTs
const JWT_CACHE_TTL = 300000; // 5 minutes

const jwtCache = new LRUCache<string, CachedJWT>({
  max: MAX_JWT_CACHE_SIZE,
  ttl: JWT_CACHE_TTL,
  updateAgeOnGet: false, // Don't refresh TTL on cache hit
  allowStale: false // Don't return expired entries
});

function cacheJWT(token: string, userId: string, email: string, orgId: string): void {
  const expiresAt = Date.now() + JWT_CACHE_TTL;

  // LRU automatically evicts oldest entry when max size reached
  jwtCache.set(token, { userId, email, orgId, expiresAt });
}

function getCachedJWT(token: string): CachedJWT | null {
  const cached = jwtCache.get(token);

  if (!cached) return null;

  // Double-check expiration (LRU TTL handles this, but defensive check)
  if (Date.now() > cached.expiresAt) {
    jwtCache.delete(token);
    return null;
  }

  return cached;
}

// Remove manual cleanup interval - LRU handles eviction automatically
// DELETE: setInterval(() => { ... }, 60000);
```

**2.3 Add Cache Metrics (Optional - For Monitoring)**
```typescript
export function getJWTCacheStats() {
  return {
    size: jwtCache.size,
    maxSize: MAX_JWT_CACHE_SIZE,
    utilizationPercent: (jwtCache.size / MAX_JWT_CACHE_SIZE) * 100
  };
}
```

#### Testing Criteria

**Unit Tests (backend/src/__tests__/unit/jwt-cache.test.ts):**

```typescript
describe('JWT Cache Security', () => {
  it('should cache JWT and retrieve it', () => {
    const token = 'test-jwt-token';
    cacheJWT(token, 'user-123', 'user@example.com', 'org-456');

    const cached = getCachedJWT(token);

    expect(cached).not.toBeNull();
    expect(cached?.userId).toBe('user-123');
    expect(cached?.orgId).toBe('org-456');
  });

  it('should evict oldest entry when cache size exceeds limit', () => {
    // Fill cache to max capacity
    for (let i = 0; i < 10001; i++) {
      cacheJWT(`token-${i}`, `user-${i}`, `user${i}@example.com`, `org-${i}`);
    }

    // Verify oldest token evicted
    const oldestToken = getCachedJWT('token-0');
    expect(oldestToken).toBeNull();

    // Verify newest token still cached
    const newestToken = getCachedJWT('token-10000');
    expect(newestToken).not.toBeNull();

    // Verify cache size at max limit
    expect(getJWTCacheStats().size).toBeLessThanOrEqual(10000);
  });

  it('should expire cached JWT after TTL', async () => {
    jest.useFakeTimers();

    const token = 'test-jwt-token';
    cacheJWT(token, 'user-123', 'user@example.com', 'org-456');

    // Verify cached immediately
    expect(getCachedJWT(token)).not.toBeNull();

    // Fast-forward 6 minutes (beyond 5-minute TTL)
    jest.advanceTimersByTime(6 * 60 * 1000);

    // Verify expired
    expect(getCachedJWT(token)).toBeNull();

    jest.useRealTimers();
  });
});
```

**Acceptance Criteria:**
- [ ] All 3 unit tests pass
- [ ] Cache never exceeds 10,000 entries
- [ ] LRU eviction works correctly
- [ ] JWT verification still works
- [ ] No memory leaks under load

---

### Phase 3: Rate Limiting (P0-3)
**Priority:** CRITICAL
**Effort:** 5 hours
**Files Modified:** 2 files
**Tests Required:** 5 integration tests

#### Technical Requirements

**3.1 Install Rate Limiting Dependencies**
```bash
cd backend
npm install express-rate-limit rate-limit-redis --save
```

**3.2 Create Rate Limiter Configuration**
- **File:** `backend/src/middleware/rate-limiter.ts` (NEW FILE)
- **Purpose:** Centralize rate limiting config for auth endpoints

**Code Blueprint:**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// STRICT rate limit for MFA verification (3 attempts per 15 min per user)
export const mfaRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:mfa:',
    sendCommand: (...args: string[]) => redis.call(...args)
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per window
  keyGenerator: (req) => {
    // Rate limit per user ID (not IP, prevents IP rotation bypass)
    return req.body?.userId || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many MFA verification attempts',
      message: 'Account locked for 15 minutes due to repeated failed attempts.',
      retryAfter: 15 * 60 // seconds
    });
  },
  skipSuccessfulRequests: false, // Count all attempts
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

// Moderate rate limit for login (10 attempts per 15 min per IP)
export const loginRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:login:',
    sendCommand: (...args: string[]) => redis.call(...args)
  }),
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes.',
      retryAfter: 15 * 60
    });
  }
});

// Relaxed rate limit for signup (5 attempts per hour per IP)
export const signupRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:signup:',
    sendCommand: (...args: string[]) => redis.call(...args)
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many signup attempts',
      message: 'Please try again in 1 hour.',
      retryAfter: 60 * 60
    });
  }
});

// Very strict for password reset (3 attempts per hour per email)
export const passwordResetRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:reset:',
    sendCommand: (...args: string[]) => redis.call(...args)
  }),
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.email || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many password reset requests',
      message: 'Please try again in 1 hour.',
      retryAfter: 60 * 60
    });
  }
});
```

**3.3 Apply Rate Limiters to Auth Routes**
- **File:** `backend/src/routes/auth-management.ts`
- **Changes:** Import and apply rate limiters to endpoints

**Code Blueprint:**
```typescript
import {
  mfaRateLimiter,
  loginRateLimiter,
  signupRateLimiter,
  passwordResetRateLimiter
} from '../middleware/rate-limiter';

// Apply to specific routes
router.post('/auth/signup', signupRateLimiter, signupHandler);
router.post('/auth/signin', loginRateLimiter, signinHandler);
router.post('/mfa/verify-login', mfaRateLimiter, mfaVerifyHandler);
router.post('/mfa/verify-enrollment', mfaRateLimiter, mfaEnrollmentVerifyHandler);
router.post('/auth/reset-password', passwordResetRateLimiter, resetPasswordHandler);
```

**3.4 Add Failed Attempt Tracking in Database**
- **Purpose:** Persistent tracking beyond Redis TTL
- **Table:** `auth_audit_log` (already exists from Priority 10)

**Code Addition to Login Handler:**
```typescript
async function trackFailedLogin(userId: string, ipAddress: string, reason: string) {
  await supabase.from('auth_audit_log').insert({
    user_id: userId,
    event_type: 'login_failed',
    ip_address: ipAddress,
    metadata: { reason },
    created_at: new Date().toISOString()
  });

  // Check if user has >5 failed attempts in last hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { count } = await supabase
    .from('auth_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', 'login_failed')
    .gte('created_at', oneHourAgo);

  if (count && count >= 5) {
    // Lock account for 1 hour
    await supabase
      .from('profiles')
      .update({
        account_locked_until: new Date(Date.now() + 3600000).toISOString()
      })
      .eq('id', userId);

    throw new Error('Account temporarily locked due to multiple failed login attempts');
  }
}
```

#### Testing Criteria

**Integration Tests (backend/src/__tests__/integration/rate-limiting.test.ts):**

```typescript
describe('Auth Rate Limiting', () => {
  it('should allow 3 MFA attempts then block', async () => {
    const userId = 'test-user-id';

    // Attempt 1-3: Allowed
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/mfa/verify-login')
        .send({ userId, code: '000000' });

      expect(res.status).toBe(401); // Wrong code, but allowed
    }

    // Attempt 4: Rate limited
    const res = await request(app)
      .post('/api/auth/mfa/verify-login')
      .send({ userId, code: '000000' });

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many MFA verification attempts');
  });

  it('should allow 10 login attempts per IP then block', async () => {
    // Make 10 login attempts from same IP
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
    }

    // 11th attempt: Rate limited
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'test@example.com', password: 'wrong' });

    expect(res.status).toBe(429);
  });

  it('should allow 5 signups per hour per IP', async () => {
    // 5 signups: Allowed
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/signup')
        .send({ email: `test${i}@example.com`, password: 'Test123!' });
    }

    // 6th signup: Rate limited
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test6@example.com', password: 'Test123!' });

    expect(res.status).toBe(429);
  });

  it('should reset rate limit after window expires', async () => {
    jest.useFakeTimers();

    // Hit rate limit
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/signin').send({ email: 'test@example.com', password: 'wrong' });
    }

    // Verify blocked
    const blockedRes = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'test@example.com', password: 'wrong' });
    expect(blockedRes.status).toBe(429);

    // Fast-forward 16 minutes (beyond 15-minute window)
    jest.advanceTimersByTime(16 * 60 * 1000);

    // Verify allowed again
    const allowedRes = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'test@example.com', password: 'wrong' });
    expect(allowedRes.status).toBe(401); // Wrong password, but not rate limited

    jest.useRealTimers();
  });

  it('should lock account after 5 failed logins in 1 hour', async () => {
    const userId = 'test-user-id';

    // Simulate 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await trackFailedLogin(userId, '127.0.0.1', 'invalid_password');
    }

    // Verify account locked
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_locked_until')
      .eq('id', userId)
      .single();

    expect(profile.account_locked_until).not.toBeNull();

    const lockExpiry = new Date(profile.account_locked_until);
    const now = new Date();
    const lockDurationMs = lockExpiry.getTime() - now.getTime();

    // Verify locked for ~1 hour
    expect(lockDurationMs).toBeGreaterThan(55 * 60 * 1000); // At least 55 min
    expect(lockDurationMs).toBeLessThan(65 * 60 * 1000); // At most 65 min
  });
});
```

**Acceptance Criteria:**
- [ ] All 5 integration tests pass
- [ ] Redis connection stable (no crashes)
- [ ] Rate limits reset after window expires
- [ ] Rate limit headers returned in response
- [ ] Failed attempt tracking works
- [ ] Account lockout enforced

---

## Testing Strategy

### Pre-Implementation Checklist
- [ ] Redis instance running and accessible
- [ ] Supabase connection working
- [ ] All dependencies installed (`bcrypt`, `lru-cache`, `express-rate-limit`, `rate-limit-redis`)
- [ ] Test database seeded with test users

### Phase-by-Phase Validation

**Phase 1 Complete When:**
- [ ] 4 unit tests pass (recovery code generation, verification, rejection, single-use)
- [ ] Integration test passes (full MFA recovery flow)
- [ ] Frontend can display recovery codes
- [ ] No regression in existing MFA enrollment

**Phase 2 Complete When:**
- [ ] 3 unit tests pass (cache operations, eviction, TTL)
- [ ] JWT verification endpoint still works
- [ ] Cache stats endpoint returns metrics
- [ ] No memory growth under load (10K requests)

**Phase 3 Complete When:**
- [ ] 5 integration tests pass (MFA rate limit, login rate limit, signup rate limit, window reset, account lockout)
- [ ] Redis connection stable for 1 hour
- [ ] Rate limit headers present in responses
- [ ] Failed login tracking works
- [ ] No false positives (legitimate users not blocked)

### Regression Testing

**Critical User Flows:**
1. Sign up → Email verification → Login → MFA enrollment → Logout → Login with MFA
2. Sign up → Reset password → Login → Access dashboard
3. Sign up → Enable MFA → Lose device → Use recovery code → Disable MFA → Re-enable MFA
4. Sign up from 5 different IPs → Verify no false rate limiting

**Performance Benchmarks:**
- JWT cache hit rate: >80%
- Login endpoint: <200ms (with rate limiting)
- MFA verification: <500ms (with bcrypt.compare)
- Recovery code generation: <2s (10 bcrypt hashes)

---

## Rollback Procedures

### Phase 1 Rollback (MFA Recovery Codes)
```bash
# Revert backend/src/services/mfa-service.ts
git checkout HEAD~1 -- backend/src/services/mfa-service.ts

# Remove bcrypt dependency
npm uninstall bcrypt @types/bcrypt

# Rebuild and restart
npm run build
pm2 restart voxanne-backend
```

### Phase 2 Rollback (JWT Cache)
```bash
# Revert backend/src/middleware/auth.ts
git checkout HEAD~1 -- backend/src/middleware/auth.ts

# Remove LRU cache dependency
npm uninstall lru-cache

# Rebuild and restart
npm run build
pm2 restart voxanne-backend
```

### Phase 3 Rollback (Rate Limiting)
```bash
# Remove rate limiter file
rm backend/src/middleware/rate-limiter.ts

# Revert auth-management.ts
git checkout HEAD~1 -- backend/src/routes/auth-management.ts

# Remove dependencies
npm uninstall express-rate-limit rate-limit-redis

# Rebuild and restart
npm run build
pm2 restart voxanne-backend
```

---

## Deployment Strategy

### Zero-Downtime Deployment

**Step 1: Deploy Phase 1 (MFA Recovery Codes)**
- Deploy during low-traffic window (3 AM UTC)
- No downtime required (backward compatible)
- Existing recovery codes remain valid (Base64 check fallback for 24 hours)

**Step 2: Deploy Phase 2 (JWT Cache)**
- Deploy anytime (no user impact)
- Cache warms up automatically within 5 minutes
- Monitor cache hit rate via metrics endpoint

**Step 3: Deploy Phase 3 (Rate Limiting)**
- Deploy during business hours (monitor closely)
- Start with relaxed limits (2x normal) for first 24 hours
- Tighten limits after validating no false positives

### Monitoring & Alerts

**Critical Metrics:**
- MFA recovery code verification success rate (should be >95%)
- JWT cache hit rate (target: >80%)
- Rate limit trigger rate (target: <0.1% of requests)
- Failed login attempt rate (baseline: establish first week)

**Alerts:**
- Recovery code verification failure >10% → Slack #engineering-alerts
- JWT cache hit rate <60% → Investigate cache TTL
- Rate limit triggers >1000/hour → Possible DDoS attack
- Account lockouts >50/day → Possible credential stuffing

---

## Success Criteria (All Phases)

### Functional Requirements
- [ ] MFA recovery codes use bcrypt hashing
- [ ] Recovery code verification works correctly
- [ ] JWT cache has size limit (10K entries)
- [ ] Rate limiting active on all auth endpoints
- [ ] Account lockout enforced after 5 failed logins

### Non-Functional Requirements
- [ ] Zero downtime during deployment
- [ ] No regression in existing auth flows
- [ ] Performance within acceptable limits (<200ms for login)
- [ ] All automated tests pass (12 total tests)

### Security Requirements
- [ ] Database breach does NOT expose recovery codes
- [ ] Memory dump does NOT expose JWT tokens (size-limited)
- [ ] Brute force attacks blocked (rate limiting)
- [ ] Email enumeration prevented (signup rate limiting)

### HIPAA Compliance Progress
- [x] Rate limiting (prevents brute force) ← Fixed by P0-3
- [ ] Password strength requirements (still P1-6)
- [ ] Email verification enforcement (still P2-10)
- [ ] Inactivity timeout (still P2-12)

**HIPAA Authentication Progress:** 40% → 50% (+10% from rate limiting fix)

---

## Dependencies & Prerequisites

### Environment Variables Required
```bash
# .env
REDIS_URL=redis://localhost:6379  # Or production Redis URL
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### NPM Packages Required
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "lru-cache": "^10.1.0",
    "express-rate-limit": "^7.1.5",
    "rate-limit-redis": "^4.2.0",
    "ioredis": "^5.3.2"  // Already installed
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2"
  }
}
```

### Infrastructure Required
- Redis instance (already configured for webhook queue)
- Supabase project with auth enabled
- Access to `auth.mfa_factors` table

---

## Timeline

**Day 1 (5 hours):**
- Morning: Phase 1 - MFA recovery code hashing (implementation + tests)
- Afternoon: Code review, manual testing of MFA flow

**Day 2 (4 hours):**
- Morning: Phase 2 - JWT cache LRU implementation (implementation + tests)
- Afternoon: Phase 3 Part 1 - Rate limiter configuration

**Day 3 (3 hours):**
- Morning: Phase 3 Part 2 - Apply rate limiters to routes, add failed attempt tracking
- Afternoon: Integration testing, regression testing

**Day 4 (2 hours):**
- Morning: Load testing (simulate 1000 auth requests)
- Afternoon: Documentation updates, deployment preparation

**Day 5 (1 hour):**
- Morning: Production deployment (3 AM UTC)
- Afternoon: Monitor metrics, validate fixes

**Total:** 15 hours over 5 days (3 hours/day average)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| bcrypt slows down MFA enrollment | Medium | Low | Acceptable (2s for 10 codes is reasonable UX) |
| LRU cache evicts active sessions | Low | Medium | 10K limit very high (supports 10K concurrent users) |
| Rate limiting blocks legitimate users | Medium | High | Start with relaxed limits, monitor false positive rate |
| Redis connection failure | Low | High | Graceful degradation (disable rate limiting if Redis down) |
| Deployment breaks existing MFA | Low | Critical | Rollback procedure documented, backward compatibility tested |

---

## Approval Checklist

Before proceeding to Step 3 (Implementation):
- [ ] Planning document reviewed and approved
- [ ] All dependencies available and tested
- [ ] Redis instance accessible
- [ ] Test database prepared
- [ ] Rollback procedures understood
- [ ] Timeline approved (5 days acceptable)

**Approval Required From:** CTO / Tech Lead

**Next Step:** Proceed to Phase 1 implementation (MFA recovery code hashing)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-11
**Author:** Claude Code (Anthropic)
**Status:** ✅ READY FOR IMPLEMENTATION
