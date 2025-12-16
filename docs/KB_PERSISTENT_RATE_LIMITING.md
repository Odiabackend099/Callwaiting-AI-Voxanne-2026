# Persistent Rate Limiting Implementation Guide

## Overview

The current Knowledge Base sync endpoint uses in-memory rate limiting, which has limitations:
- Resets on server restart
- Doesn't work across multiple server instances
- Memory leak: Map grows indefinitely

This guide provides implementation options for persistent rate limiting.

## Option 1: Database-Based Rate Limiting (Recommended)

### Advantages
- Works across multiple server instances
- Persistent across restarts
- Easy to audit and monitor
- No external dependencies

### Implementation

**Step 1: Create the sync log table**

Already created via migration: `20251215_create_kb_sync_log.sql`

```sql
create table if not exists public.kb_sync_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  created_at timestamptz not null default now(),
  tool_id text,
  status text not null default 'success',
  error_message text,
  duration_ms integer,
  docs_synced integer,
  assistants_updated integer
);

create index if not exists kb_sync_log_org_id_created_at_idx 
  on public.kb_sync_log(org_id, created_at desc);
```

**Step 2: Update the sync endpoint**

Replace the in-memory rate limiting with database queries:

```typescript
// In knowledge-base.ts sync endpoint

knowledgeBaseRouter.post('/sync', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Check rate limit using database
    const { data: lastSync, error: lastSyncError } = await supabase
      .from('kb_sync_log')
      .select('created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastSyncError && lastSync) {
      const lastSyncTime = new Date(lastSync.created_at).getTime();
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTime;

      if (timeSinceLastSync < SYNC_RATE_LIMIT_MS) {
        const remainingMs = SYNC_RATE_LIMIT_MS - timeSinceLastSync;
        return res.status(429).json({ 
          error: `Rate limited. Try again in ${Math.ceil(remainingMs / 1000)}s.` 
        });
      }
    }

    // ... rest of sync logic ...

    const startTime = Date.now();

    // ... perform sync ...

    const duration = Date.now() - startTime;

    // Log sync attempt
    await supabase.from('kb_sync_log').insert({
      org_id: orgId,
      tool_id: toolId,
      status: 'success',
      duration_ms: duration,
      docs_synced: items.length,
      assistants_updated: updated.length
    });

    return res.json({ success: true, toolId, assistantsUpdated: updated });
  } catch (err: any) {
    const orgId = getOrgId(req);
    
    // Log failed sync attempt
    if (orgId) {
      await supabase.from('kb_sync_log').insert({
        org_id: orgId,
        status: 'failed',
        error_message: err?.message || 'Unknown error'
      }).catch(e => console.error('Failed to log sync error:', e));
    }

    return res.status(500).json({ error: err?.message || 'Failed to sync knowledge base' });
  }
});
```

**Step 3: Remove in-memory rate limiting**

Delete these lines from the top of the file:

```typescript
// REMOVE THESE:
const SYNC_RATE_LIMIT_MS = 5 * 60 * 1000;
const syncTimestamps = new Map<string, number>();
```

### Monitoring

Query sync history:

```sql
-- Last 10 syncs for an org
SELECT * FROM kb_sync_log 
WHERE org_id = '...' 
ORDER BY created_at DESC 
LIMIT 10;

-- Sync success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM kb_sync_log
WHERE org_id = '...' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Average sync duration
SELECT 
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  MIN(duration_ms) as min_duration_ms
FROM kb_sync_log
WHERE org_id = '...' AND status = 'success';
```

---

## Option 2: Redis-Based Rate Limiting

### Advantages
- Extremely fast (in-memory)
- Works across instances
- TTL-based cleanup (no memory leak)
- Good for high-traffic scenarios

### Disadvantages
- Requires Redis infrastructure
- Additional external dependency
- More complex setup

### Implementation

**Step 1: Install Redis client**

```bash
npm install redis
```

**Step 2: Create Redis service**

```typescript
// backend/src/services/redis-client.ts
import { createClient } from 'redis';

const redisClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

redisClient.on('error', (err) => console.error('Redis error:', err));

export async function initRedis() {
  await redisClient.connect();
  console.log('Redis connected');
}

export default redisClient;
```

**Step 3: Update sync endpoint**

```typescript
import redisClient from '../services/redis-client';

const SYNC_RATE_LIMIT_MS = 5 * 60 * 1000;

knowledgeBaseRouter.post('/sync', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Check rate limit using Redis
    const redisKey = `kb:sync:${orgId}`;
    const lastSyncStr = await redisClient.get(redisKey);
    
    if (lastSyncStr) {
      const lastSync = parseInt(lastSyncStr);
      const now = Date.now();
      const timeSinceLastSync = now - lastSync;

      if (timeSinceLastSync < SYNC_RATE_LIMIT_MS) {
        const remainingMs = SYNC_RATE_LIMIT_MS - timeSinceLastSync;
        return res.status(429).json({ 
          error: `Rate limited. Try again in ${Math.ceil(remainingMs / 1000)}s.` 
        });
      }
    }

    // Set rate limit with TTL
    await redisClient.setEx(
      redisKey,
      Math.ceil(SYNC_RATE_LIMIT_MS / 1000),
      Date.now().toString()
    );

    // ... rest of sync logic ...

    return res.json({ success: true, toolId, assistantsUpdated: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to sync knowledge base' });
  }
});
```

---

## Option 3: Hybrid Approach

Use Redis for fast checks, database for audit trail:

```typescript
// Fast check with Redis
const redisKey = `kb:sync:${orgId}`;
const lastSyncStr = await redisClient.get(redisKey);

if (lastSyncStr) {
  const lastSync = parseInt(lastSyncStr);
  const now = Date.now();
  const timeSinceLastSync = now - lastSync;

  if (timeSinceLastSync < SYNC_RATE_LIMIT_MS) {
    const remainingMs = SYNC_RATE_LIMIT_MS - timeSinceLastSync;
    return res.status(429).json({ 
      error: `Rate limited. Try again in ${Math.ceil(remainingMs / 1000)}s.` 
    });
  }
}

// ... perform sync ...

// Log to database for audit trail
await supabase.from('kb_sync_log').insert({
  org_id: orgId,
  tool_id: toolId,
  status: 'success',
  duration_ms: duration,
  docs_synced: items.length,
  assistants_updated: updated.length
});

// Update Redis TTL
await redisClient.setEx(
  redisKey,
  Math.ceil(SYNC_RATE_LIMIT_MS / 1000),
  Date.now().toString()
);
```

---

## Recommendation

**Use Option 1 (Database-Based)** for:
- Simplicity (no new infrastructure)
- Audit trail requirements
- Monitoring and debugging
- Small to medium traffic

**Use Option 2 (Redis)** for:
- High-traffic scenarios
- Microsecond-level latency requirements
- Already using Redis for other features

**Use Option 3 (Hybrid)** for:
- Best of both worlds
- Production deployments
- Need both speed and audit trail

---

## Testing Rate Limiting

```bash
# First sync (should succeed or fail based on agents, not rate limit)
curl -X POST http://localhost:3001/api/knowledge-base/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-Id: <org-id>"

# Second sync immediately (should be rate limited)
curl -X POST http://localhost:3001/api/knowledge-base/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-Id: <org-id>"

# Response should be:
# HTTP 429
# {
#   "error": "Rate limited. Try again in 245s."
# }
```

---

## Migration Path

1. Deploy database migration (`20251215_create_kb_sync_log.sql`)
2. Update sync endpoint to use database rate limiting
3. Remove in-memory `syncTimestamps` Map
4. Test rate limiting works correctly
5. Monitor sync logs for issues
6. (Optional) Add Redis if needed for performance

---

## Monitoring Queries

```sql
-- Sync attempts in last 24 hours
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_syncs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM kb_sync_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at);

-- Orgs with most sync attempts
SELECT 
  org_id,
  COUNT(*) as sync_count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
FROM kb_sync_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY org_id
ORDER BY sync_count DESC
LIMIT 10;

-- Failed syncs with errors
SELECT 
  org_id,
  created_at,
  error_message
FROM kb_sync_log
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```
