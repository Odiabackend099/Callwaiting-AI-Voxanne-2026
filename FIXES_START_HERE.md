# IMMEDIATE FIXES - START HERE
## "Exactly What To Do In Next 48 Hours"

**Time to Production:** 2 days of engineering
**Revenue Potential:** £1,500-2,000/month first month
**Effort:** 41 hours of focused work

---

## FIX #1: Auth Bypass (30 minutes)
### The Problem
Invalid JWT tokens are accepted in production if NODE_ENV is not set to "production"

### The Fix
**File:** `backend/src/middleware/auth.ts`

**Current Code (Lines 44-75):**
```typescript
const isDev = (process.env.NODE_ENV || 'development') === 'development';
if (isDev) {
  // This fallback allows unauthorized access ❌
}
```

**Change To:**
```typescript
const isDev = (process.env.NODE_ENV || 'production') === 'development';
if (isDev) {
  // Still allow dev fallback in development
} else {
  // Production: ALWAYS require valid token
  await requireAuth(req, res, next);
  return;
}
```

**OR Better Yet:**
```typescript
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Strict production mode: no fallback
  await requireAuth(req, res, next);
  return;
}

// Dev mode: allow fallback
// ... existing logic ...
```

### Verify It Works
```bash
# Terminal 1: Start backend
NODE_ENV=production npm run dev

# Terminal 2: Test with invalid token
curl http://localhost:3001/api/calls \
  -H "Authorization: Bearer invalid-token-xyz"
# Should return: 401 Unauthorized ✅
# Old behavior: 200 OK (BUG) ❌
```

### Set in Production
```bash
# Render Dashboard → Environment Variables
# Add/Update: NODE_ENV = production
```

**Time:** 30 minutes
**Done?** ✅

---

## FIX #2: NODE_ENV in Production (5 minutes)
### The Problem
Backend defaults to development mode if NODE_ENV not set

### The Fix
In Render dashboard:

1. Go to: Settings → Environment
2. Add variable: `NODE_ENV` = `production`
3. Deploy (Render auto-redeploys)
4. Verify: Backend responds with NODE_ENV=production

### Verify
```bash
curl https://voxanne-backend.onrender.com/health
# Should show no dev-mode warnings
```

**Time:** 5 minutes
**Done?** ✅

---

## FIX #3: Recording Cleanup Job (2 hours)
### The Problem
Failed recording uploads accumulate forever, database grows unbounded

### The Solution
Create new file: `backend/src/jobs/recording-cleanup.ts`

```typescript
/**
 * Cleanup Job: Delete orphaned recording uploads after 7 days
 * Run: Daily at 2 AM UTC
 */

import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import schedule from 'node-schedule';

export async function cleanupOrphanedRecordings() {
  try {
    // Delete failed uploads older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { error, data } = await supabase
      .from('recording_upload_queue')
      .delete()
      .eq('status', 'failed')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (error) {
      log.error('RecordingCleanup', 'Failed to delete orphaned recordings', {
        error: error.message
      });
      return;
    }

    log.info('RecordingCleanup', 'Successfully cleaned up orphaned recordings', {
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log.error('RecordingCleanup', 'Cleanup job failed', {
      error: error?.message
    });
  }
}

// Schedule to run daily at 2 AM UTC
export function scheduleCleanup() {
  // Run at 2 AM UTC every day
  schedule.scheduleJob('0 2 * * *', cleanupOrphanedRecordings);
  log.info('RecordingCleanup', 'Scheduled daily cleanup job');
}
```

### Add to Server Startup
**File:** `backend/src/server.ts`

Add to the startup sequence (after other jobs):
```typescript
import { scheduleCleanup } from './jobs/recording-cleanup';

// ... other code ...

// Initialize jobs
if (process.env.NODE_ENV !== 'test') {
  scheduleCleanup();
  log.info('Server', 'Recording cleanup job scheduled');
}
```

### Verify It Works
```typescript
// Test file: backend/src/jobs/recording-cleanup.test.ts
import { cleanupOrphanedRecordings } from './recording-cleanup';

describe('Recording Cleanup', () => {
  test('should delete failed uploads older than 7 days', async () => {
    // Create test failed upload
    await supabase.from('recording_upload_queue').insert({
      call_id: 'test-123',
      status: 'failed',
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days old
    });

    // Run cleanup
    await cleanupOrphanedRecordings();

    // Verify it was deleted
    const { data } = await supabase
      .from('recording_upload_queue')
      .select('*')
      .eq('call_id', 'test-123');

    expect(data?.length).toBe(0);
  });
});
```

**Time:** 2 hours
**Done?** ✅

---

## FIX #4: OpenAI Embedding Fallback (3 hours)
### The Problem
When OpenAI hits rate limit (429), KB context is lost entirely

### The Solution
**File:** `backend/src/services/embeddings.ts`

**Current Code (Line 78-130):**
```typescript
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // ... if rate limited, throws error ❌
  // KB context stops working
}
```

**Change To:**
```typescript
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    throw new Error('No texts provided for embedding');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  const embeddings: number[][] = new Array(texts.length);
  const failedIndices: number[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchStartIndex = i;

    try {
      const validBatch = batch.map(t => {
        if (!t || typeof t !== 'string') {
          throw new Error('Invalid text in batch');
        }
        return t.substring(0, 8000);
      });

      const response = await openai!.embeddings.create({
        model: EMBEDDING_MODEL,
        input: validBatch,
        encoding_format: 'float'
      });

      // ... process response ...

    } catch (error: any) {
      if (error?.status === 429) {
        // Rate limited: Use fallback
        log.warn('Embeddings', 'OpenAI rate limited, using zero-vector fallback', {
          batchIndex: i,
          batchSize: batch.length
        });

        // Fallback: Return zero vectors
        // System will work, but KB won't match on this batch
        for (let j = 0; j < batch.length; j++) {
          embeddings[batchStartIndex + j] = new Array(EMBEDDING_DIMENSION).fill(0);
        }

        // Wait before next batch (rate limit recovery)
        await new Promise(r => setTimeout(r, 10000)); // 10 second delay
        continue;
      }

      // Other errors: log and mark for fallback
      log.error('Embeddings', 'Batch processing failed', {
        error: error?.message,
        batchIndex: i
      });

      failedIndices.push(i);

      // Fallback: Zero vectors for failed batch
      for (let j = 0; j < batch.length; j++) {
        embeddings[batchStartIndex + j] = new Array(EMBEDDING_DIMENSION).fill(0);
      }
    }
  }

  log.info('Embeddings', 'Batch processing complete', {
    total: texts.length,
    failed: failedIndices.length
  });

  return embeddings;
}
```

### How It Works
1. Try to embed with OpenAI ✅
2. If 429 rate limit → Use zero vectors ✅
3. System continues working, KB just doesn't match on that batch
4. After rate limit window, embeddings work again

### Verify
```bash
# Create test that triggers rate limit
curl -X POST http://localhost:3001/api/knowledge-base/upload \
  -H "Authorization: Bearer test-token" \
  -F "file=@large-document.txt" \
  --max-time 120

# Should complete even if OpenAI is rate limited
# Check logs: Should show "using zero-vector fallback"
```

**Time:** 3 hours
**Done?** ✅

---

## FIX #5: Health Check Dependencies (1 hour)
### The Problem
Health endpoint returns 200 even when database is down

### The Solution
**File:** `backend/src/routes/health.ts`

**Replace With:**
```typescript
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'ok' as 'ok' | 'degraded' | 'error',
    services: {
      database: false,
      supabase: false
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };

  // Check Supabase database connectivity
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (!error) {
      health.services.database = true;
      health.services.supabase = true;
    } else {
      health.status = 'degraded';
      log.warn('Health', 'Database check failed', { error: error.message });
    }
  } catch (error: any) {
    health.status = 'error';
    log.error('Health', 'Health check failed', { error: error?.message });
  }

  // Return 503 if any critical service is down
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export const healthRouter = router;
```

### Register Route
**File:** `backend/src/server.ts`

```typescript
import { healthRouter } from './routes/health';

// ... other routes ...

app.use('/health', healthRouter);
```

**Time:** 1 hour
**Done?** ✅

---

## FIX #6: WebSocket Memory Leak (2 hours)
### The Problem
Event listeners accumulate on each reconnect, memory grows unbounded

### The Solution
**File:** `backend/src/services/websocket.ts`

**Find this code (around line 80-150):**
```typescript
wss.on('connection', (ws: WebSocket, req) => {
  // ... existing code ...

  ws.on('message', (message: Buffer) => {
    // ... handle message ...
  });

  ws.on('error', (error) => {
    // ... handle error ...
  });
});
```

**Add cleanup handler:**
```typescript
wss.on('connection', (ws: WebSocket, req) => {
  const origin = req.headers.origin || 'unknown';
  logger.info('Client connected', { remoteAddress: req.socket.remoteAddress, origin });

  clients.set(ws, { ws, userId: undefined });

  // ... existing handlers ...

  // CRITICAL: Cleanup on disconnect
  ws.on('close', () => {
    logger.info('Client disconnected', { origin });

    // Remove all event listeners (prevents accumulation)
    ws.removeAllListeners('message');
    ws.removeAllListeners('error');
    ws.removeAllListeners('close');
    ws.removeAllListeners('ping');
    ws.removeAllListeners('pong');

    // Remove from tracking map
    clients.delete(ws);

    logger.info('WebSocket cleaned up', {
      remainingClients: clients.size
    });
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error', { error: error.message });

    // Cleanup on error
    ws.removeAllListeners();
    clients.delete(ws);
  });
});
```

**Time:** 2 hours
**Done?** ✅

---

## FIX #7: Database Indexes (30 minutes)
### The Problem
Dashboard queries timeout with 10K+ calls (full table scan)

### The Solution
Create new migration file:

**File:** `backend/migrations/[TIMESTAMP]_add_call_indexes.sql`

```sql
-- Add indexes for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_calls_org_date
  ON calls(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_org_status
  ON calls(org_id, status);

CREATE INDEX IF NOT EXISTS idx_call_logs_call_id
  ON call_logs(call_id);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id
  ON call_transcripts(call_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_id
  ON knowledge_base(org_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunks_kb_id
  ON knowledge_base_chunks(knowledge_base_id);

-- Verify indexes were created
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('calls', 'call_logs', 'call_transcripts', 'knowledge_base', 'knowledge_base_chunks');
```

### Apply Manually (Can't Wait for Migration)
```bash
# If you need to apply immediately
psql postgresql://[connection-string] << 'EOF'
CREATE INDEX IF NOT EXISTS idx_calls_org_date ON calls(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);
EOF
```

### Verify
```bash
# Run dashboard query test
time psql -c "
  SELECT id, duration, status FROM calls
  WHERE org_id = 'test-org'
  AND created_at >= NOW() - interval '30 days'
  LIMIT 100
"

# Without index: 10+ seconds
# With index: <100ms ✅
```

**Time:** 30 minutes
**Done?** ✅

---

## FIX #8: Setup Sentry Error Monitoring (4 hours)
### The Problem
Errors invisible until customer complains

### The Solution
```bash
# Step 1: Install Sentry
npm install @sentry/node @sentry/tracing --save

# Step 2: Get DSN from Sentry (free tier)
# Visit: sentry.io
# Create account
# Create project: Node.js
# Copy DSN (looks like: https://xxx@yyyy.ingest.sentry.io/zzz)
```

### Configure in Backend
**File:** `backend/src/server.ts`

Add at very top (before other imports):
```typescript
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

// Initialize ASAP, before importing routes
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // Sample 10% of transactions
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({
      request: true,
      response: true
    })
  ]
});

// ... rest of imports ...
```

Add middleware:
```typescript
// After Express init, before routes
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// ... routes ...

// Error handler (after all routes)
app.use(Sentry.Handlers.errorHandler());
```

### Set Environment Variable
```bash
# Render Dashboard → Environment Variables
SENTRY_DSN = https://xxx@yyyy.ingest.sentry.io/zzz
```

### Test It
```bash
# Manually trigger an error to see if Sentry catches it
curl -X POST http://localhost:3001/api/test-error

# Check Sentry dashboard
# Should see error appearing in real-time
```

**Time:** 4 hours
**Done?** ✅

---

## FIX #9: Recording Error Handling (1 hour)
### The Problem
Recording playback fails silently if Supabase is down

### The Solution
**File:** `backend/src/routes/calls.ts`

Find recording endpoint and update:
```typescript
router.get('/:callId/recording', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    // Get recording URL from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('recording_url, recording_storage_path')
      .eq('id', callId)
      .single();

    if (error || !call?.recording_storage_path) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Generate signed URL (expires in 1 hour)
    const { data, error: signedError } = await supabase.storage
      .from('recordings')
      .createSignedUrl(call.recording_storage_path, 3600);

    if (signedError || !data?.signedUrl) {
      log.error('Calls', 'Failed to generate recording URL', {
        error: signedError?.message,
        callId
      });
      return res.status(500).json({
        error: 'Failed to retrieve recording',
        callId
      });
    }

    res.json({
      recordingUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      duration: call.duration || 0
    });

  } catch (error: any) {
    log.error('Calls', 'Recording endpoint error', { error: error?.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Time:** 1 hour
**Done?** ✅

---

## FIX #10: Load Test (4 hours)
### The Problem
Unknown capacity - might crash at 5 or 50 concurrent calls

### The Solution
Create load test script:

**File:** `load-test.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 5 },   // Ramp to 5 users
    { duration: '3m', target: 10 },  // Ramp to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 for 3 min
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],  // 99% of requests < 500ms
    http_req_failed: ['rate<0.1'],     // <10% failure rate
  }
};

export default function () {
  // Simulate: Create call
  let createRes = http.post(
    'http://localhost:3001/api/calls',
    JSON.stringify({
      assistantId: 'test-assistant-123',
      phoneNumberId: 'test-phone-123',
      customer: {
        number: '+44 7700 900000',
        name: 'Test Customer'
      }
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(createRes, {
    'call creation successful': (r) => r.status === 200,
  });

  sleep(2); // Wait 2 seconds between requests

  // Simulate: Get dashboard
  let dashRes = http.get('http://localhost:3001/api/calls-dashboard?limit=20');

  check(dashRes, {
    'dashboard load successful': (r) => r.status === 200,
  });

  sleep(1);
}
```

### Run Test
```bash
# Install k6
npm install -g k6

# Run load test
k6 run load-test.js

# Expected output:
# ✓ All requests succeed
# ✓ <10% failure rate
# ✓ P99 latency <500ms

# If test fails, system needs fixing
```

**Time:** 4 hours
**Done?** ✅

---

## TOTAL EFFORT TRACKER

| Fix | Time | Priority | Status |
|-----|------|----------|--------|
| 1. Auth bypass | 30 min | 🔴 CRITICAL | ⬜ TODO |
| 2. NODE_ENV=prod | 5 min | 🔴 CRITICAL | ⬜ TODO |
| 3. Recording cleanup | 2 hours | 🔴 CRITICAL | ⬜ TODO |
| 4. OpenAI fallback | 3 hours | 🔴 CRITICAL | ⬜ TODO |
| 5. Health check | 1 hour | 🟠 HIGH | ⬜ TODO |
| 6. WebSocket cleanup | 2 hours | 🟠 HIGH | ⬜ TODO |
| 7. Database indexes | 30 min | 🟠 HIGH | ⬜ TODO |
| 8. Sentry setup | 4 hours | 🟠 HIGH | ⬜ TODO |
| 9. Error handling | 1 hour | 🟡 MEDIUM | ⬜ TODO |
| 10. Load test | 4 hours | 🟡 MEDIUM | ⬜ TODO |
| **TOTAL** | **~17.5 hours** | - | - |

---

## EXECUTION PLAN

### Day 1 (8 hours)
- [ ] 09:00-09:30: Fix #1 (Auth bypass)
- [ ] 09:30-09:35: Fix #2 (NODE_ENV)
- [ ] 09:35-11:35: Fix #3 (Recording cleanup)
- [ ] 11:45-12:45: Fix #5 (Health check)
- [ ] 13:45-15:45: Fix #4 (OpenAI fallback)

### Day 2 (8+ hours)
- [ ] 09:00-11:00: Fix #6 (WebSocket cleanup)
- [ ] 11:00-11:30: Fix #7 (Database indexes)
- [ ] 11:30-15:30: Fix #8 (Sentry setup)
- [ ] 15:30-16:30: Fix #9 (Error handling)
- [ ] 16:30-20:30: Fix #10 (Load testing)
- [ ] 20:30+: Deploy and verify

### Verification (During)
After each fix:
- [ ] Run specific test for that fix
- [ ] Check logs for warnings/errors
- [ ] Verify no regression in other features

### Pre-Launch (After All Fixes)
- [ ] 24-hour stability test
- [ ] Review Sentry for any errors
- [ ] Final load test
- [ ] Deploy to production
- [ ] Monitor first 24 hours

---

## SUCCESS CRITERIA

### Launch Only If:
- ✅ Auth cannot be bypassed (invalid token = 401)
- ✅ 10 concurrent calls don't crash system
- ✅ All recordings save successfully
- ✅ Dashboard loads in <2 seconds
- ✅ No errors in Sentry (or <1% rate)
- ✅ Health check reflects actual system status
- ✅ WebSocket memory stable over time

### Then You Can Tell CEO:
"Voxanne is production-ready. We can take our first customer today."

---

## NEXT STEP

**Pick your engineer and give them this document.**

"You have 2 days to implement these 10 fixes. This is the difference between launching and crashing."

Then watch them work through the checklist.

By day 3: You can take your first paying customer. 💰

🔥
