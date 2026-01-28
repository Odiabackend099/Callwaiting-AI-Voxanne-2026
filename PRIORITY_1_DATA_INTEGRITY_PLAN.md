# Priority 1: Data Integrity - Implementation Plan

**Status:** 🔄 In Progress  
**Start Date:** 2026-01-27  
**Priority Level:** 🔴 CRITICAL (Production Readiness)  
**Estimated Completion:** 2-3 days

---

## Executive Summary

Priority 1 addresses critical data integrity issues that could cause production failures:
- **Race conditions** in appointment booking (double-bookings)
- **Lost webhooks** from Vapi (missed call events)
- **Database connection exhaustion** under load
- **Cascading failures** from external API timeouts

**Goal:** Make the platform reliable enough for the first paying customer.

---

## Phase 1: Postgres Advisory Locks (Day 1, 4 hours)

### Problem
Multiple concurrent booking requests can create double-bookings:
```
Request A: Check slot 2pm → Available
Request B: Check slot 2pm → Available
Request A: Book slot 2pm → Success
Request B: Book slot 2pm → Success (DOUBLE BOOKING!)
```

### Solution: Advisory Locks
```typescript
// backend/src/services/appointment-booking-service.ts
async function bookAppointmentWithLock(
  orgId: string,
  appointmentTime: Date,
  duration: number,
  contactId: string
): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Acquire advisory lock (prevents concurrent bookings for same slot)
    const lockKey = hashSlotToInt64(orgId, appointmentTime);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
    
    // Check availability (now protected by lock)
    const { rows: conflicts } = await client.query(
      `SELECT id FROM appointments 
       WHERE org_id = $1 
       AND scheduled_at = $2 
       AND status NOT IN ('cancelled', 'no_show')
       AND deleted_at IS NULL`,
      [orgId, appointmentTime]
    );
    
    if (conflicts.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Slot already booked' };
    }
    
    // Book appointment
    const { rows: [appointment] } = await client.query(
      `INSERT INTO appointments (
        org_id, contact_id, scheduled_at, 
        duration_minutes, status, created_at
      ) VALUES ($1, $2, $3, $4, 'confirmed', NOW())
      RETURNING id`,
      [orgId, contactId, appointmentTime, duration]
    );
    
    await client.query('COMMIT');
    return { success: true, appointmentId: appointment.id };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Helper: Convert slot to 64-bit integer for pg_advisory_lock
function hashSlotToInt64(orgId: string, time: Date): bigint {
  const crypto = require('crypto');
  const slotKey = `${orgId}_${time.toISOString()}`;
  const hash = crypto.createHash('sha256').update(slotKey).digest();
  return hash.readBigInt64BE(0);
}
```

### Files to Create/Modify
- `backend/src/services/appointment-booking-service.ts` (new)
- `backend/src/routes/appointments.ts` (update to use new service)
- `backend/src/__tests__/unit/appointment-booking.test.ts` (new)

### Test Plan
```typescript
// Race condition simulation test
test('should prevent double-booking under concurrent load', async () => {
  const orgId = 'test-org';
  const slot = new Date('2026-02-01T14:00:00Z');
  
  // Simulate 10 concurrent booking attempts
  const results = await Promise.all(
    Array(10).fill(null).map(() => 
      bookAppointmentWithLock(orgId, slot, 30, 'contact-123')
    )
  );
  
  // Only 1 should succeed
  const successful = results.filter(r => r.success);
  expect(successful.length).toBe(1);
  
  // Verify database has exactly 1 appointment
  const { rows } = await db.query(
    'SELECT COUNT(*) FROM appointments WHERE scheduled_at = $1',
    [slot]
  );
  expect(rows[0].count).toBe('1');
});
```

---

## Phase 2: Webhook Retry Logic with BullMQ (Day 1-2, 6 hours)

### Problem
Vapi webhooks can fail due to:
- Temporary network issues
- Database connection timeouts
- External API failures (Google Calendar, Twilio)

**Current behavior:** Webhook lost forever → missed call event → angry customer

### Solution: BullMQ Job Queue
```typescript
// backend/src/config/webhook-queue.ts (already exists, enhance)
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const webhookQueue = new Queue('vapi-webhooks', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: 100, // Keep last 100 for debugging
    removeOnFail: 500,
  },
});

// Worker to process webhooks
const webhookWorker = new Worker(
  'vapi-webhooks',
  async (job: Job) => {
    const { event, receivedAt } = job.data;
    
    log.info('WebhookWorker', 'Processing webhook', {
      jobId: job.id,
      eventType: event.type,
      attemptNumber: job.attemptsMade + 1,
    });
    
    // Process webhook (existing logic from webhooks.ts)
    await processVapiWebhook(event);
    
    log.info('WebhookWorker', 'Webhook processed successfully', {
      jobId: job.id,
      processingTime: Date.now() - new Date(receivedAt).getTime(),
    });
  },
  {
    connection: redis,
    concurrency: 5, // Process 5 webhooks concurrently
  }
);

// Error handling
webhookWorker.on('failed', (job, err) => {
  log.error('WebhookWorker', 'Webhook processing failed', {
    jobId: job?.id,
    eventType: job?.data?.event?.type,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
  
  // Alert on final failure
  if (job && job.attemptsMade >= 3) {
    sendSlackAlert({
      channel: '#voxanne-alerts',
      text: `🚨 Webhook permanently failed after 3 attempts`,
      details: {
        jobId: job.id,
        eventType: job.data.event.type,
        error: err.message,
      },
    });
  }
});
```

### Updated Webhook Endpoint
```typescript
// backend/src/routes/webhooks.ts
app.post('/api/webhooks/vapi', async (req, res) => {
  // Immediately return 200 to Vapi (prevents timeout)
  res.status(200).send('OK');
  
  // Add to job queue for asynchronous processing
  await webhookQueue.add('process-webhook', {
    event: req.body,
    receivedAt: new Date().toISOString(),
    headers: {
      signature: req.headers['x-vapi-signature'],
      timestamp: req.headers['x-vapi-timestamp'],
    },
  });
  
  log.info('WebhookEndpoint', 'Webhook queued', {
    eventType: req.body.type,
    callId: req.body.call?.id,
  });
});
```

### Files to Create/Modify
- `backend/src/config/webhook-queue.ts` (enhance existing)
- `backend/src/routes/webhooks.ts` (update endpoint)
- `backend/src/services/webhook-processor.ts` (extract logic)
- `backend/src/__tests__/unit/webhook-queue.test.ts` (new)

---

## Phase 3: Database Connection Pooling (Day 2, 3 hours)

### Problem
Current setup creates new connections on-demand → exhaustion under load

### Solution: Connection Pool with pg
```typescript
// backend/src/config/database.ts (new)
import { Pool } from 'pg';
import { config } from './index';

export const pool = new Pool({
  connectionString: config.SUPABASE_URL,
  max: 20, // Maximum 20 connections
  min: 5,  // Keep 5 connections warm
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if no connection available
  
  // Health check
  allowExitOnIdle: false,
});

// Monitor pool health
pool.on('connect', (client) => {
  log.debug('DatabasePool', 'New client connected', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  });
});

pool.on('error', (err, client) => {
  log.error('DatabasePool', 'Unexpected pool error', {
    error: err.message,
    totalCount: pool.totalCount,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('DatabasePool', 'Closing pool on SIGTERM');
  await pool.end();
});

export async function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
```

### Monitoring Endpoint
```typescript
// backend/src/routes/monitoring.ts (add)
app.get('/api/monitoring/db-pool', requireAuth, async (req, res) => {
  const stats = await getPoolStats();
  
  res.json({
    pool: stats,
    healthy: stats.waitingCount === 0 && stats.idleCount > 0,
    timestamp: new Date().toISOString(),
  });
});
```

---

## Phase 4: Circuit Breakers for External APIs (Day 2-3, 4 hours)

### Problem
External API failures (Google Calendar, Twilio, Vapi) can cascade and block all requests

### Solution: Opossum Circuit Breaker
```typescript
// backend/src/services/circuit-breakers.ts (new)
import CircuitBreaker from 'opossum';

// Google Calendar circuit breaker
export const googleCalendarBreaker = new CircuitBreaker(
  async (action: () => Promise<any>) => action(),
  {
    timeout: 5000, // 5s timeout
    errorThresholdPercentage: 50, // Open after 50% failures
    resetTimeout: 30000, // Try again after 30s
    rollingCountTimeout: 10000, // 10s window
    rollingCountBuckets: 10,
  }
);

googleCalendarBreaker.on('open', () => {
  log.warn('CircuitBreaker', 'Google Calendar circuit opened (too many failures)');
  sendSlackAlert({
    channel: '#voxanne-alerts',
    text: '⚠️ Google Calendar API circuit breaker opened',
  });
});

googleCalendarBreaker.on('halfOpen', () => {
  log.info('CircuitBreaker', 'Google Calendar circuit half-open (testing)');
});

googleCalendarBreaker.on('close', () => {
  log.info('CircuitBreaker', 'Google Calendar circuit closed (healthy)');
});

// Usage example
export async function createCalendarEvent(orgId: string, event: any) {
  try {
    return await googleCalendarBreaker.fire(async () => {
      const creds = await CredentialService.get(orgId, 'google_calendar');
      const calendar = google.calendar({ version: 'v3', auth: creds });
      return await calendar.events.insert({ calendarId: 'primary', requestBody: event });
    });
  } catch (error) {
    if (error.message === 'Breaker is open') {
      log.warn('CircuitBreaker', 'Google Calendar unavailable', { orgId });
      return { success: false, error: 'Calendar service temporarily unavailable' };
    }
    throw error;
  }
}
```

### Files to Create/Modify
- `backend/src/services/circuit-breakers.ts` (new)
- `backend/src/services/google-calendar-service.ts` (update)
- `backend/src/services/twilio-service.ts` (update)
- `backend/src/__tests__/unit/circuit-breakers.test.ts` (new)

---

## Testing Strategy

### Unit Tests
- Advisory lock race condition simulation
- Webhook retry logic (mock BullMQ)
- Circuit breaker state transitions
- Connection pool exhaustion handling

### Integration Tests
```bash
# Simulate production load
npm run test:load -- --concurrent=50 --duration=60s
```

### Manual Verification
1. **Race condition test:**
   - Open 10 browser tabs
   - Simultaneously book same appointment slot
   - Verify only 1 succeeds

2. **Webhook retry test:**
   - Stop Redis temporarily
   - Trigger Vapi webhook
   - Start Redis
   - Verify webhook processes after retry

3. **Circuit breaker test:**
   - Disconnect from Google Calendar
   - Attempt 10 calendar operations
   - Verify circuit opens and requests fail fast

---

## Success Criteria

✅ **Zero double-bookings** in race condition test (1000 concurrent attempts)  
✅ **99.9% webhook delivery** (with retries)  
✅ **Database pool never exhausted** under 100 concurrent requests  
✅ **Circuit breakers prevent cascading failures** (fail fast in <100ms)  
✅ **All unit tests passing** (new + existing)  
✅ **Documentation updated** in `.claude/claude.md`

---

## Dependencies

- `pg` (already installed) - Postgres connection pooling
- `bullmq` (already installed) - Job queue
- `opossum` (already installed) - Circuit breaker
- Redis (required for BullMQ) - Already in use

---

## Rollback Plan

If Priority 1 causes issues:
1. Revert advisory lock changes (use optimistic locking instead)
2. Disable webhook queue (process synchronously)
3. Remove circuit breakers (fail through to external APIs)
4. Keep connection pooling (low risk, high benefit)

---

## Next Steps After Priority 1

**Priority 2:** Error Monitoring & Alerting
- Sentry error tracking
- Slack alerts for critical failures
- Performance monitoring dashboard
