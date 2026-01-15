# Master Orchestrator Task 4: Latency Optimization Strategy

## Current Performance Baseline
- **Average TTFB:** 950ms
- **Target TTFB:** <800ms
- **Gap:** -150ms needs optimization
- **Current Bottlenecks:**
  1. Org resolution from phone number (60-80ms)
  2. Embedding service call (100-120ms)
  3. Calendar slot retrieval (70-90ms)
  4. Credential fetching (50-70ms)
  5. SMS/compliance checks (40-50ms)

---

## Optimization Strategy

### Phase 1: Concurrent Operations (Save ~100ms)
Run non-dependent operations in parallel:

```typescript
// OLD (Sequential) - ~350ms
const orgId = await resolveTenantId(tenantId, inboundPhone);  // 60ms
const embeddings = await embeddingService.encode(context);    // 100ms
const slots = await calendarSlot.get(orgId, date);            // 80ms
// Total: 240ms

// NEW (Parallel) - ~120ms
const [orgId, embeddings] = await Promise.all([
  resolveTenantId(tenantId, inboundPhone),  // 60ms (parallel)
  embeddingService.encode(context),          // 100ms (parallel)
]);
const slots = await calendarSlot.get(orgId, date);  // 80ms (depends on orgId)
// Total: 160ms
```

**Savings:** ~80-100ms

### Phase 2: Credential Caching (Save ~50-70ms)
Add in-memory cache with 5-minute TTL for Twilio/email credentials:

```typescript
class CredentialCache {
  private cache = new Map<string, CachedCred>();
  
  async get(orgId: string, type: 'twilio' | 'email'): Promise<Creds> {
    // Check memory cache first (0ms)
    if (this.cache.has(key)) {
      return this.cache.get(key).data;
    }
    
    // Cache miss: fetch from DB (60ms)
    const creds = await supabase.from('org_credentials')
      .select('*')
      .eq('org_id', orgId)
      .eq('type', type);
    
    // Store in cache with 5-min TTL
    this.cache.set(key, { data: creds, expiry: now + 5*60*1000 });
    
    return creds;
  }
}
```

**Savings:** ~50-70ms per credential fetch

### Phase 3: Stream-Based Audio Processing (Save ~200-300ms)
For voice-based appointments, use streaming instead of batch processing:

```typescript
// OLD (Batch) - 950ms total
// 1. Record audio (1-3 seconds)
// 2. Process full audio (200ms)
// 3. Get LLM response (300ms)
// 4. Generate TTS (200ms)
// Total: 950ms

// NEW (Streaming) - 400-500ms
// 1. Stream STT (Deepgram Nova-2) - parallel with audio
// 2. Stream LLM processing - parallel with STT (100ms latency)
// 3. Stream TTS (Cartesia) - parallel with LLM
// Total: ~400ms TTFB, full response by 800ms
```

**Benefits:**
- Deepgram Nova-2: Low-latency STT (50-100ms latency vs 200ms batch)
- Cartesia: 100ms to first audio byte vs 200ms ElevenLabs
- Streaming allows user to hear response while being processed

### Phase 4: Request Pipelining (Save ~30-50ms)
Reuse connection pools and reduce roundtrips:

```typescript
// Connection pool configuration
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Keep-alive for Twilio/Calendar APIs
const httpAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 20,
});
```

**Savings:** ~20-30ms per request

---

## Expected Results After Optimization

| Phase | Optimization | Savings | Running Total |
|-------|-------------|---------|----------------|
| Baseline | - | - | 950ms |
| Phase 1 | Concurrent operations | 100ms | 850ms |
| Phase 2 | Credential caching | 50ms | 800ms ✅ |
| Phase 3 | Stream-based audio (if applicable) | 100-200ms | 600-700ms |
| Phase 4 | Connection pooling | 30ms | 770ms ✅ |

**Target Achievement:** ✅ <800ms TTFB

---

## Implementation Priority

**Critical Path (Must implement):**
1. ✅ Fix 4 critical code bugs (completed)
2. ⏳ Implement concurrent org/embedding resolution (Phase 1)
3. ⏳ Add credential caching (Phase 2)

**High Priority (Should implement):**
4. Stream-based audio processing (Phase 3) - If voice-based appointments are significant
5. Connection pooling (Phase 4) - For scale

**Nice-to-Have:**
6. Redis caching layer for distributed deployments
7. GraphQL batching for calendar queries
8. CDN for static audio assets

---

## Testing Strategy

### Load Test (k6)
```typescript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,  // 50 concurrent users
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1200'],  // 95th percentile <800ms
    http_req_failed: ['rate<0.01'],  // <1% error rate
  },
};

export default function () {
  const res = http.post('http://localhost:3000/api/check-availability', {
    tenantId: 'org-123',
    date: '2026-01-20',
    serviceType: 'consultation',
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 800ms': (r) => r.timings.duration < 800,
    'has available slots': (r) => JSON.parse(r.body).availableSlots?.length > 0,
  });
}
```

### Profiling
- Use Chrome DevTools for client-side latency
- Use Node.js `--prof` flag for backend profiling
- Monitor database query times with Supabase logs

---

## Related Fixes
All 4 critical security/reliability fixes have been applied:
1. ✅ Race condition in OTP credential fetch
2. ✅ SMS delivery verification with rollback
3. ✅ Phone regex false positives (dates/addresses)
4. ✅ Multi-tenant org_id validation

See `CRITICAL_FIXES_APPLIED.md` for details.

