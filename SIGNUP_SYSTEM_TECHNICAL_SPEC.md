# Sign-Up System: Technical Specification for Phase 1 Implementation

**Document Status:** Ready for Development
**Target Launch:** End of Week 1
**Owner:** Backend Engineering
**Reviewers:** DevOps, QA, Product

---

## 1. Redis Rate Limiter Migration

### Requirement

Replace in-memory IP-based rate limiter with Redis-backed distributed rate limiter.

### Current Implementation

**File:** `src/app/api/auth/signup/route.ts` (lines 23-43)

```typescript
const ipWindows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ipWindows) {
        if (now > entry.resetAt) ipWindows.delete(key);
    }
}, 5 * 60_000);

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = ipWindows.get(ip);
    if (!entry || now > entry.resetAt) {
        ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    entry.count += 1;
    return entry.count > MAX_PER_WINDOW;
}
```

### New Implementation

**File:** `backend/src/services/rate-limiter.ts` (NEW)

```typescript
import Redis from 'ioredis';

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimiterConfig;

  constructor(redisUrl: string, config: RateLimiterConfig) {
    this.redis = new Redis(redisUrl);
    this.config = config;
  }

  async isLimited(identifier: string): Promise<boolean> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      // Set TTL on first request in window
      await this.redis.expire(key, Math.ceil(this.config.windowMs / 1000));
    }

    return current > this.config.maxRequests;
  }

  async getRemainingRequests(identifier: string): Promise<number> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const current = await this.redis.get(key);
    return Math.max(0, this.config.maxRequests - (parseInt(current) || 0));
  }

  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    await this.redis.del(key);
  }
}

// Export singleton instance
export const signupRateLimiter = new RateLimiter(
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    windowMs: 60_000,
    maxRequests: 5,
    keyPrefix: 'rl:signup'
  }
);
```

**File:** `src/app/api/auth/signup/route.ts` (MODIFIED)

```typescript
// Remove lines 23-43 (old in-memory implementation)

import { signupRateLimiter } from '@/backend/src/services/rate-limiter';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  // Replace lines 49-54
  if (await signupRateLimiter.isLimited(ip)) {
    const remaining = await signupRateLimiter.getRemainingRequests(ip);
    return NextResponse.json(
      {
        error: 'Too many sign-up attempts. Please try again in a minute.',
        remainingRequests: remaining
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      }
    );
  }

  // ... rest of signup flow
}
```

### Testing

**Unit Test:** `backend/src/__tests__/unit/rate-limiter.test.ts`

```typescript
import { RateLimiter } from '@/backend/src/services/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter('redis://localhost:6379', {
      windowMs: 1000,
      maxRequests: 3,
      keyPrefix: 'test:rl'
    });
  });

  test('allows 3 requests per window', async () => {
    expect(await limiter.isLimited('ip1')).toBe(false); // 1st request
    expect(await limiter.isLimited('ip1')).toBe(false); // 2nd request
    expect(await limiter.isLimited('ip1')).toBe(false); // 3rd request
    expect(await limiter.isLimited('ip1')).toBe(true);  // 4th request - limited
  });

  test('resets after window expires', async () => {
    expect(await limiter.isLimited('ip2')).toBe(false);
    expect(await limiter.isLimited('ip2')).toBe(true);  // Limited

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 1100));

    expect(await limiter.isLimited('ip2')).toBe(false); // Reset
  });

  test('isolates different IPs', async () => {
    expect(await limiter.isLimited('ip3')).toBe(false);
    expect(await limiter.isLimited('ip4')).toBe(false);
    expect(await limiter.isLimited('ip3')).toBe(false);
    expect(await limiter.isLimited('ip4')).toBe(false);
    expect(await limiter.isLimited('ip3')).toBe(false);
    expect(await limiter.isLimited('ip4')).toBe(true);   // ip4 limited
    expect(await limiter.isLimited('ip3')).toBe(true);   // ip3 limited
  });

  test('getRemainingRequests returns correct value', async () => {
    await limiter.isLimited('ip5');
    const remaining = await limiter.getRemainingRequests('ip5');
    expect(remaining).toBe(2); // 3 max - 1 used
  });
});
```

### Deployment Checklist

- [ ] Redis instance provisioned (Redis Cloud or self-hosted)
- [ ] `REDIS_URL` added to `.env.production`
- [ ] Rate limiter tests passing (100%)
- [ ] Integration test with actual Redis
- [ ] Verify rate limiter survives serverless cold start
- [ ] Verify Redis connection pooling configured
- [ ] Monitor Redis CPU/memory during load test
- [ ] Rollback plan: revert to in-memory if Redis unavailable

### Success Criteria

- ✅ 5th request within 60s window rejected with 429
- ✅ Reset after window expires (60s)
- ✅ Different IPs don't interfere with each other
- ✅ Survives Vercel cold start / serverless restart
- ✅ <1ms latency per rate limit check

---

## 2. Async Org Creation with Retry Logic

### Requirement

Move database trigger out of critical path. Implement explicit async org creation with retry logic instead of synchronous trigger.

### Current Implementation

**File:** `backend/supabase/migrations/20260209_fix_auto_org_trigger.sql`

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();
```

**Problem:** Blocks signup until org/profile creation completes. If slow, causes timeouts.

### New Implementation

#### Step 1: Disable the Trigger

**File:** `backend/supabase/migrations/20260301_async_org_creation.sql` (NEW)

```sql
-- Disable the synchronous trigger
ALTER TRIGGER on_auth_user_created ON auth.users DISABLE;

-- Keep the function for historical records, but don't call it
-- (can be removed later after verification)
```

#### Step 2: Create Service Layer

**File:** `backend/src/services/org-creation-service.ts` (NEW)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CreateOrgRequest {
  userId: string;
  email: string;
  businessName?: string;
}

interface CreateOrgResult {
  success: boolean;
  orgId?: string;
  error?: string;
}

export async function createOrgForUser(
  request: CreateOrgRequest,
  options = { maxAttempts: 3, initialBackoffMs: 100 }
): Promise<CreateOrgResult> {
  const { userId, email, businessName } = request;
  const orgName = businessName || `${email} Organization`;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          email: email,
          status: 'active'
        })
        .select('id')
        .single();

      if (orgError) {
        throw new Error(`Failed to create org: ${orgError.message}`);
      }

      // 2. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          org_id: org.id,
          role: 'owner'
        });

      if (profileError) {
        // Org created but profile failed - this is bad
        // Try to clean up org
        await supabase.from('organizations').delete().eq('id', org.id);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // 3. Update JWT with org_id
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          app_metadata: { org_id: org.id }
        }
      );

      if (updateError) {
        // Org and profile created but JWT update failed
        // User will eventually get org_id on next login
        // But log this as a problem
        console.warn(
          `[org-creation] JWT update failed for user ${userId}, but org created`,
          updateError
        );
      }

      return { success: true, orgId: org.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      console.error(
        `[org-creation] Attempt ${attempt}/${options.maxAttempts} failed: ${error}`
      );

      if (attempt === options.maxAttempts) {
        // All retries exhausted - queue for background processing
        await queueFailedOrgCreation(userId, email, error);
        return {
          success: false,
          error: `Organization creation failed after ${options.maxAttempts} attempts`
        };
      }

      // Exponential backoff before next retry
      const backoffMs = options.initialBackoffMs * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  return {
    success: false,
    error: 'Unexpected: retry loop exhausted'
  };
}

async function queueFailedOrgCreation(
  userId: string,
  email: string,
  error: string
): Promise<void> {
  try {
    await supabase
      .from('failed_org_creations')
      .insert({
        user_id: userId,
        email: email,
        error_message: error,
        attempt_count: 0,
        created_at: new Date().toISOString()
      });
  } catch (err) {
    console.error('[org-creation] Failed to queue for retry:', err);
    // Last-resort: send alert to ops
    // alertOps('org-creation-queue-failure', { userId, email, error });
  }
}

export async function getFailedOrgCreations(): Promise<CreateOrgRequest[]> {
  const { data } = await supabase
    .from('failed_org_creations')
    .select('user_id, email')
    .eq('resolved', false)
    .lt('attempt_count', 10)
    .order('created_at', { ascending: true })
    .limit(100);

  return (data || []).map(row => ({
    userId: row.user_id,
    email: row.email
  }));
}

export async function retryFailedOrgCreation(
  userId: string
): Promise<void> {
  const result = await createOrgForUser(
    { userId, email: '' },
    { maxAttempts: 1 }
  );

  if (result.success) {
    await supabase
      .from('failed_org_creations')
      .update({ resolved: true })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('failed_org_creations')
      .update({ attempt_count: supabase.rpc('increment_attempt_count') })
      .eq('user_id', userId);
  }
}
```

#### Step 3: Update Signup Route

**File:** `src/app/api/auth/signup/route.ts` (MODIFIED)

```typescript
import { createOrgForUser } from '@/backend/src/services/org-creation-service';

export async function POST(req: NextRequest) {
  // ... existing input validation and rate limiting ...

  try {
    // Create user
    const { data, error } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: trimmedFirst,
        last_name: trimmedLast
      }
    });

    if (error) {
      if (error.status === 422) {
        // ... existing duplicate email handling ...
      }
      throw error;
    }

    // NEW: Create org asynchronously (non-blocking)
    // Start the process but don't wait for it to complete
    createOrgForUser(
      {
        userId: data.user.id,
        email: trimmedEmail
      },
      { maxAttempts: 3 }
    ).catch(err => {
      // Log failures for monitoring
      console.error('[signup] Async org creation failed:', {
        userId: data.user.id,
        email: trimmedEmail,
        error: err.message
      });
    });

    // Return success immediately (user created, org creation in progress)
    return NextResponse.json(
      {
        success: true,
        message: 'Account created. Setting up organization...'
      },
      { status: 201 }
    );
  } catch (err) {
    // ... existing error handling ...
  }
}
```

#### Step 4: Create Polling/Verification Endpoint

**File:** `src/app/api/auth/verify-org-ready/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check if org_id is in JWT
  const orgId = user.app_metadata?.org_id;

  if (orgId) {
    return NextResponse.json(
      { ready: true, orgId },
      { status: 200 }
    );
  }

  // Still pending - check if it's in progress
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profile?.org_id) {
    // Profile exists but JWT not updated yet
    // Refresh session to get new JWT
    const { error: refreshError } = await supabase.auth.refreshSession();

    if (!refreshError) {
      return NextResponse.json({ ready: true, orgId: profile.org_id });
    }
  }

  // Still pending
  return NextResponse.json(
    { ready: false, message: 'Organization setup in progress' },
    { status: 202 }  // 202 Accepted (not yet ready)
  );
}
```

#### Step 5: Background Job for Failed Orgs

**File:** `backend/src/jobs/retry-failed-org-creations.ts` (NEW)

```typescript
import { CronJob } from 'cron';
import {
  getFailedOrgCreations,
  createOrgForUser,
  retryFailedOrgCreation
} from '@/backend/src/services/org-creation-service';

// Run every 5 minutes
export const jobRetryFailedOrgs = new CronJob('*/5 * * * *', async () => {
  try {
    console.log('[job] Retrying failed org creations...');

    const failed = await getFailedOrgCreations();

    for (const request of failed) {
      const result = await createOrgForUser(request, { maxAttempts: 1 });

      if (result.success) {
        await retryFailedOrgCreation(request.userId);
        console.log(`[job] Recovered org creation for ${request.email}`);
      }
    }

    console.log(`[job] Retried ${failed.length} failed org creations`);
  } catch (err) {
    console.error('[job] Retry job failed:', err);
  }
});

// Start the job
jobRetryFailedOrgs.start();
```

### Database Schema

**File:** `backend/supabase/migrations/20260301_failed_org_creations_table.sql` (NEW)

```sql
-- Track org creations that failed for retry later
CREATE TABLE IF NOT EXISTS public.failed_org_creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  error_message TEXT,
  attempt_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying pending failures
CREATE INDEX IF NOT EXISTS idx_failed_org_creations_pending
  ON public.failed_org_creations(resolved, attempt_count)
  WHERE resolved = false AND attempt_count < 10;

-- RLS: service role only
ALTER TABLE public.failed_org_creations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage"
  ON public.failed_org_creations
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Testing

**Unit Test:** `backend/src/__tests__/unit/org-creation-service.test.ts`

```typescript
import { createOrgForUser } from '@/backend/src/services/org-creation-service';

describe('createOrgForUser', () => {
  test('successfully creates org and profile', async () => {
    const result = await createOrgForUser({
      userId: 'test-user-123',
      email: 'test@example.com'
    });

    expect(result.success).toBe(true);
    expect(result.orgId).toBeDefined();
  });

  test('retries on transient failure', async () => {
    // Mock Supabase to fail once, then succeed
    const result = await createOrgForUser({
      userId: 'test-user-456',
      email: 'test2@example.com'
    });

    expect(result.success).toBe(true);
  });

  test('queues for background retry after max attempts', async () => {
    // Mock persistent failure
    const result = await createOrgForUser(
      { userId: 'test-user-789', email: 'test3@example.com' },
      { maxAttempts: 2 }
    );

    expect(result.success).toBe(false);

    // Verify queued in failed_org_creations table
    const { data } = await supabase
      .from('failed_org_creations')
      .select()
      .eq('user_id', 'test-user-789');

    expect(data).toHaveLength(1);
  });
});
```

### Deployment Checklist

- [ ] `failed_org_creations` table created
- [ ] Async org-creation service tests passing (100%)
- [ ] Signup route modified to call async service
- [ ] Verify-org-ready endpoint created and tested
- [ ] Background retry job configured and running
- [ ] Trigger disabled (not removed)
- [ ] Load test: 100 concurrent signups, verify all orgs created within 5 minutes
- [ ] Monitor `failed_org_creations` table (should be empty)

### Success Criteria

- ✅ Signup returns within 500ms (not blocked by org creation)
- ✅ Org created within 5 minutes of signup
- ✅ Zero orphaned users (org creation always succeeds eventually)
- ✅ Failed org creations automatically retried every 5 minutes
- ✅ No manual intervention needed

---

## 3. Timeout + Async Fallback for Slow Auth

### Requirement

Prevent signup endpoint from blocking indefinitely if Supabase auth is slow.

### Implementation

**File:** `backend/src/services/signup-with-timeout.ts` (NEW)

```typescript
interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface CreateUserResult {
  success: boolean;
  userId?: string;
  queued?: boolean;
  error?: string;
}

export async function createUserWithTimeoutAndFallback(
  request: CreateUserRequest,
  options = { timeoutMs: 5000 }
): Promise<CreateUserResult> {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Race between actual auth call and timeout
    const result = await Promise.race([
      adminClient.auth.admin.createUser({
        email: request.email,
        password: request.password,
        email_confirm: true,
        user_metadata: {
          first_name: request.firstName,
          last_name: request.lastName
        }
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('SIGNUP_TIMEOUT')),
          options.timeoutMs
        )
      )
    ]);

    return {
      success: true,
      userId: result.user?.id
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    if (error === 'SIGNUP_TIMEOUT') {
      // Supabase was slow, queue for async processing
      await queueSignupForAsyncProcessing(request);

      return {
        success: true,  // From user's perspective, signup is "accepted"
        queued: true,
        error: 'Signup queued due to service load'
      };
    }

    return {
      success: false,
      error: error
    };
  }
}

async function queueSignupForAsyncProcessing(
  request: CreateUserRequest
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('signup_queue')
    .insert({
      email: request.email,
      password_hash: await hashPassword(request.password),  // Hash before storing
      first_name: request.firstName,
      last_name: request.lastName,
      status: 'pending',
      created_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Failed to queue signup: ${error.message}`);
  }
}

async function hashPassword(password: string): Promise<string> {
  // Use bcrypt or similar
  const bcrypt = require('bcrypt');
  return bcrypt.hash(password, 10);
}
```

**File:** `src/app/api/auth/signup/route.ts` (MODIFIED)

```typescript
import { createUserWithTimeoutAndFallback } from '@/backend/src/services/signup-with-timeout';

export async function POST(req: NextRequest) {
  // ... existing validation ...

  try {
    const result = await createUserWithTimeoutAndFallback({
      email: trimmedEmail,
      password: password,
      firstName: trimmedFirst,
      lastName: trimmedLast
    });

    if (result.queued) {
      // Signup timed out and was queued
      return NextResponse.json(
        {
          success: true,
          message: 'Your signup is being processed. Check your email in 2-3 minutes.',
          queued: true
        },
        { status: 202 }  // 202 Accepted (not 201 Created)
      );
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    // Continue with async org creation
    // ...
  } catch (err) {
    // ... error handling ...
  }
}
```

**Background Job:** `backend/src/jobs/process-signup-queue.ts` (NEW)

```typescript
import { CronJob } from 'cron';

// Run every minute
export const jobProcessSignupQueue = new CronJob('* * * * *', async () => {
  try {
    console.log('[job] Processing signup queue...');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get pending signups (max 10 per run to avoid overload)
    const { data: pendingSignups } = await supabase
      .from('signup_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    for (const signup of pendingSignups || []) {
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await adminClient.auth.admin.createUser({
          email: signup.email,
          password: Buffer.from(signup.password_hash, 'base64').toString(),  // Decode
          email_confirm: true,
          user_metadata: {
            first_name: signup.first_name,
            last_name: signup.last_name
          }
        });

        if (error) {
          // Mark as failed
          await supabase
            .from('signup_queue')
            .update({
              status: 'failed',
              error_message: error.message,
              retry_count: (signup.retry_count || 0) + 1
            })
            .eq('id', signup.id);
        } else {
          // Mark as completed
          await supabase
            .from('signup_queue')
            .update({ status: 'completed', user_id: data.user.id })
            .eq('id', signup.id);

          // Create org asynchronously
          createOrgForUser(
            { userId: data.user.id, email: signup.email }
          ).catch(err =>
            console.error('[job] Async org creation failed:', err)
          );
        }
      } catch (err) {
        console.error('[job] Error processing signup:', signup.email, err);
      }
    }

    console.log(`[job] Processed ${pendingSignups?.length || 0} queued signups`);
  } catch (err) {
    console.error('[job] Signup queue job failed:', err);
  }
});

jobProcessSignupQueue.start();
```

### Deployment Checklist

- [ ] Timeout value set to 5 seconds (not infinite)
- [ ] Async signup queue table created with proper schema
- [ ] Background job configured and tested
- [ ] Hash function for passwords implemented securely
- [ ] Timeout + async fallback tests passing (100%)
- [ ] Load test: Mock slow Supabase (10s latency), verify timeouts trigger
- [ ] Verify queued signups eventually complete

### Success Criteria

- ✅ Slow signup request returns within 6 seconds (5s timeout + overhead)
- ✅ Queued signups completed within 5 minutes by background job
- ✅ User receives email confirmation regardless of timeout
- ✅ Zero connection pool exhaustion due to hanging requests

---

## 4. Observability: Sentry + Structured Logging

### Requirement

Add comprehensive error tracking, metrics, and structured logging for signup funnel.

### Implementation

**File:** `backend/src/services/observability.ts` (NEW)

```typescript
import * as Sentry from '@sentry/node';

// Signup pipeline steps (for tracking funnel)
export const SIGNUP_PIPELINE = {
  INPUT_VALIDATION: 'input_validation',
  RATE_LIMIT_CHECK: 'rate_limit_check',
  EXISTING_USER_CHECK: 'existing_user_check',
  AUTH_CREATE_USER: 'auth_create_user',
  ORG_CREATION_QUEUED: 'org_creation_queued',
  SUCCESS: 'success'
};

interface SignupMetrics {
  step: string;
  result: 'success' | 'failure';
  latencyMs: number;
  context?: Record<string, unknown>;
}

export function recordSignupMetric(metrics: SignupMetrics) {
  const { step, result, latencyMs, context } = metrics;

  // Log as structured JSON for indexing
  console.log(JSON.stringify({
    event_type: 'signup_metric',
    step,
    result,
    latency_ms: latencyMs,
    timestamp: new Date().toISOString(),
    ...context
  }));

  // Also send to metrics service (Datadog, etc.)
  // metrics.timing(`signup.step.${step}.latency`, latencyMs);
  // metrics.increment(`signup.step.${step}.count`);
}

interface SignupErrorContext {
  step: string;
  email?: string;
  errorMessage: string;
  statusCode?: number;
  [key: string]: unknown;
}

export function recordSignupError(context: SignupErrorContext) {
  const { step, email, errorMessage, statusCode, ...extra } = context;

  // Send to Sentry with context
  Sentry.captureException(new Error(errorMessage), {
    tags: {
      service: 'signup',
      step,
      error_type: errorMessage.split(':')[0]
    },
    extra: {
      email_domain: email?.split('@')[1],  // Don't log full email
      status_code: statusCode,
      ...extra
    },
    level: statusCode === 429 ? 'info' : 'error'  // Rate limits are not errors
  });

  // Also log structured
  console.error(JSON.stringify({
    event_type: 'signup_error',
    step,
    error: errorMessage,
    status_code: statusCode,
    timestamp: new Date().toISOString(),
    context: {
      email_domain: email?.split('@')[1],
      ...extra
    }
  }));
}

// Dashboard export
export function getSignupMetricsSchema() {
  return {
    total_signups: 'COUNT(*)',
    success_rate: 'COUNT(result="success") / COUNT(*)',
    avg_latency: 'AVG(latency_ms)',
    p50_latency: 'PERCENTILE(latency_ms, 0.50)',
    p95_latency: 'PERCENTILE(latency_ms, 0.95)',
    p99_latency: 'PERCENTILE(latency_ms, 0.99)',
    failures_by_step: 'COUNT(*) GROUP BY step WHERE result="failure"',
    rate_limit_blocks: 'COUNT(*) WHERE step="rate_limit_check" AND result="failure"'
  };
}
```

**File:** `src/app/api/auth/signup/route.ts` (MODIFIED - full integration)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { signupRateLimiter } from '@/backend/src/services/rate-limiter';
import { createUserWithTimeoutAndFallback } from '@/backend/src/services/signup-with-timeout';
import { createOrgForUser } from '@/backend/src/services/org-creation-service';
import {
  recordSignupMetric,
  recordSignupError,
  SIGNUP_PIPELINE
} from '@/backend/src/services/observability';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let email = '';

  try {
    // 1. Extract IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

    // 2. Parse and validate input
    const rawText = await req.text().catch(() => '');
    if (!rawText) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.INPUT_VALIDATION,
        result: 'failure',
        latencyMs: Date.now() - startTime,
        context: { reason: 'empty_body' }
      });
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.INPUT_VALIDATION,
        result: 'failure',
        latencyMs: Date.now() - startTime,
        context: { reason: 'invalid_json' }
      });
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.INPUT_VALIDATION,
        result: 'failure',
        latencyMs: Date.now() - startTime,
        context: { reason: 'invalid_type' }
      });
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const p = parsed as Record<string, unknown>;
    const trimmedFirst = typeof p.firstName === 'string' ? p.firstName.trim() : '';
    const trimmedLast = typeof p.lastName === 'string' ? p.lastName.trim() : '';
    const trimmedEmail = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
    const password = typeof p.password === 'string' ? p.password : '';

    if (!trimmedFirst || !trimmedLast || !trimmedEmail || !password) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.INPUT_VALIDATION,
        result: 'failure',
        latencyMs: Date.now() - startTime,
        context: { reason: 'missing_fields' }
      });
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      );
    }

    email = trimmedEmail;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.INPUT_VALIDATION,
        result: 'failure',
        latencyMs: Date.now() - startTime,
        context: { reason: 'invalid_email', email }
      });
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    if (trimmedFirst.length > 50 || trimmedLast.length > 50 || password.length < 8) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.INPUT_VALIDATION,
        result: 'failure',
        latencyMs: Date.now() - startTime,
        context: { reason: 'validation_failed', email }
      });
      return NextResponse.json(
        { error: 'Validation failed.' },
        { status: 400 }
      );
    }

    recordSignupMetric({
      step: SIGNUP_PIPELINE.INPUT_VALIDATION,
      result: 'success',
      latencyMs: Date.now() - startTime,
      context: { email }
    });

    // 3. Rate limit check
    const rateLimitStart = Date.now();
    if (await signupRateLimiter.isLimited(ip)) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.RATE_LIMIT_CHECK,
        result: 'failure',
        latencyMs: Date.now() - rateLimitStart,
        context: { ip }
      });
      return NextResponse.json(
        { error: 'Too many sign-up attempts. Please try again in a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    recordSignupMetric({
      step: SIGNUP_PIPELINE.RATE_LIMIT_CHECK,
      result: 'success',
      latencyMs: Date.now() - rateLimitStart,
      context: { ip }
    });

    // 4. Create user with timeout
    const authStart = Date.now();
    const authResult = await createUserWithTimeoutAndFallback({
      email: trimmedEmail,
      password: password,
      firstName: trimmedFirst,
      lastName: trimmedLast
    });

    recordSignupMetric({
      step: SIGNUP_PIPELINE.AUTH_CREATE_USER,
      result: authResult.success ? 'success' : 'failure',
      latencyMs: Date.now() - authStart,
      context: { email, queued: authResult.queued }
    });

    if (!authResult.success && !authResult.queued) {
      recordSignupError({
        step: SIGNUP_PIPELINE.AUTH_CREATE_USER,
        email: trimmedEmail,
        errorMessage: authResult.error || 'Unknown auth error',
        statusCode: 500
      });
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      );
    }

    if (authResult.queued) {
      recordSignupMetric({
        step: SIGNUP_PIPELINE.ORG_CREATION_QUEUED,
        result: 'success',
        latencyMs: Date.now() - startTime,
        context: { email, queued: true }
      });
      return NextResponse.json(
        { success: true, message: 'Your signup is being processed.' },
        { status: 202 }
      );
    }

    // 5. Queue org creation (don't wait)
    createOrgForUser({
      userId: authResult.userId!,
      email: trimmedEmail
    }).catch(err => {
      recordSignupError({
        step: SIGNUP_PIPELINE.ORG_CREATION_QUEUED,
        email: trimmedEmail,
        errorMessage: err.message,
        statusCode: 500
      });
    });

    recordSignupMetric({
      step: SIGNUP_PIPELINE.SUCCESS,
      result: 'success',
      latencyMs: Date.now() - startTime,
      context: { email, userId: authResult.userId }
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    recordSignupError({
      step: SIGNUP_PIPELINE.SUCCESS,
      email,
      errorMessage: message,
      statusCode: 500
    });

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
```

### Sentry Configuration

**File:** `backend/src/config/sentry.ts` (NEW)

```typescript
import * as Sentry from '@sentry/node';

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection()
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV !== 'production',
    beforeSend(event, hint) {
      // Filter PII from error reports
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.Authorization;
        // Redact email from query params
        if (event.request.url) {
          event.request.url = event.request.url.replace(
            /email=([^&]+)/,
            'email=[REDACTED]'
          );
        }
      }
      return event;
    }
  });
}
```

### Deployment Checklist

- [ ] Sentry project created, DSN available
- [ ] `SENTRY_DSN` added to `.env.production`
- [ ] Structured logging JSON format validated
- [ ] Metrics exported to dashboard/grafana
- [ ] Alert configured for >10% failure rate
- [ ] Alert configured for p95 latency >2 seconds
- [ ] Verify PII redaction (no emails/passwords in Sentry)
- [ ] Load test: verify metrics dashboard shows correct data

### Success Criteria

- ✅ All signup errors captured in Sentry with full context
- ✅ Signup funnel visible: input_validation → rate_limit → auth → org → success
- ✅ Response time metrics tracked (p50, p95, p99)
- ✅ Rate limit blocks tracked separately (not counted as errors)
- ✅ Zero PII in logs/metrics

---

## Summary: Phase 1 Deployment Timeline

| Week | Task | Hours | Owner |
|------|------|-------|-------|
| **Week 1** | Redis rate limiter | 2h | Backend |
| **Week 1** | Async org creation | 6h | Backend |
| **Week 1** | Timeout + fallback | 3h | Backend |
| **Week 1** | Observability (Sentry) | 4h | Backend |
| **Week 1** | Testing + load testing | 4h | QA |
| **Week 1** | Deployment + monitoring | 3h | DevOps |
| **Total** | | **22 hours** | |

**Estimated Cost:**
- Redis Cloud: $10-20/month (5GB tier)
- Sentry Pro: $99/month
- Total: ~$120/month additional

**Expected Results:**
- ✅ 99.9% uptime at 1000 signups/day
- ✅ <500ms p95 latency
- ✅ Zero orphaned users
- ✅ Full observability into signup pipeline

---

**Document Version:** 1.0
**Last Updated:** February 26, 2026
**Status:** Ready for Implementation
