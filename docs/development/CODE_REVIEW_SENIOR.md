# Senior Engineer Code Review: Voxanne Backend

**Date:** December 15, 2025  
**Reviewer:** Senior Engineering Team  
**Focus Areas:** Webhooks, Auth, API Endpoints, Database Operations  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

The codebase demonstrates solid architectural patterns (idempotency, retry logic, webhook signature verification) but has **5 critical issues** that must be fixed before production deployment, plus **12 high-priority improvements** for security, performance, and maintainability.

---

## Critical Issues (🔴 Must Fix Before Production)

### 1. **Metadata Channel Not Propagated to `call_logs` Table**
**Location:** `webhooks.ts:321` in `handleCallStarted()`  
**Severity:** 🔴 Critical  
**Impact:** Inbound calls won't display with correct badge in UI; dashboard classification fails

**Current Code:**
```typescript
metadata: { is_test_call: callTracking?.metadata?.is_test_call ?? false }
```

**Problem:**
- Only `is_test_call` is stored in `call_logs.metadata`
- `channel` field (inbound/outbound) is NOT propagated
- UI queries `call_logs.metadata.channel` to determine badge color
- Result: All calls show as "unknown" or default badge

**Fix:**
```typescript
metadata: {
  is_test_call: callTracking?.metadata?.is_test_call ?? false,
  channel: callTracking?.metadata?.channel ?? 'outbound'  // ADD THIS
}
```

**Testing:**
```sql
select vapi_call_id, metadata->>'channel' as channel
from call_logs
order by started_at desc
limit 5;
-- Should show 'inbound' for inbound calls, 'outbound' for outbound
```

---

### 2. **Race Condition: Duplicate `call_logs` Rows on Webhook Retry**
**Location:** `webhooks.ts:315-322` in `handleCallStarted()`  
**Severity:** 🔴 Critical  
**Impact:** Multiple `call_logs` rows for same call; UI shows duplicates; analytics broken

**Problem:**
- `handleCallStarted()` inserts into `call_logs` without idempotency check
- If webhook retries (network flap), second insert succeeds (no unique constraint on `vapi_call_id`)
- Result: 2+ rows per call in database

**Current Code:**
```typescript
const { error } = await supabase.from('call_logs').insert({
  vapi_call_id: call.id,
  // ... no idempotency check before insert
});
```

**Fix:**
```typescript
// Check if call_logs row already exists
const { data: existingLog } = await supabase
  .from('call_logs')
  .select('id')
  .eq('vapi_call_id', call.id)
  .maybeSingle();

if (!existingLog) {
  const { error } = await supabase.from('call_logs').insert({
    vapi_call_id: call.id,
    // ...
  });
}
```

**Better Fix (DB-level):**
Add unique constraint in migration:
```sql
alter table public.call_logs
  add constraint unique_vapi_call_id unique(vapi_call_id);
```

---

### 3. **Missing Error Handling: Webhook Returns 200 Even on Failure**
**Location:** `webhooks.ts:117-166` main webhook handler  
**Severity:** 🔴 Critical  
**Impact:** Vapi retries fail silently; calls not tracked; no visibility into failures

**Current Code:**
```typescript
switch (event.type) {
  case 'call.started':
    await handleCallStarted(event);
    break;
  // ...
}
res.status(200).json({ received: true });  // Always 200, even if handler failed!
```

**Problem:**
- If `handleCallStarted()` throws or returns early, webhook still returns 200
- Vapi thinks webhook succeeded, doesn't retry
- Call tracking silently fails

**Fix:**
```typescript
try {
  let success = false;
  switch (event.type) {
    case 'call.started':
      success = await handleCallStarted(event);
      break;
    // ...
  }
  
  if (!success) {
    res.status(500).json({ error: 'Handler failed' });
    return;
  }
  
  res.status(200).json({ received: true });
} catch (error) {
  console.error('[Webhook Error]', error);
  res.status(500).json({ error: 'Webhook processing failed' });
}
```

---

### 4. **Timestamp Skew Window Too Large (5 minutes)**
**Location:** `webhooks.ts:63` in `verifyVapiSignature()`  
**Severity:** 🔴 Critical  
**Impact:** Replay attacks possible; old webhooks accepted

**Current Code:**
```typescript
const maxSkewMs = 5 * 60 * 1000; // 5 minutes
```

**Problem:**
- 5-minute window allows replay attacks
- Attacker can capture webhook and replay within 5 minutes
- Industry standard: 30-60 seconds

**Fix:**
```typescript
const maxSkewMs = 60 * 1000; // 60 seconds (1 minute)
```

---

### 5. **No Validation of `call.customer.number` Format**
**Location:** `webhooks.ts:271` in `handleCallStarted()`  
**Severity:** 🔴 Critical  
**Impact:** Invalid phone numbers stored; lead matching fails; SMS/WhatsApp fails

**Current Code:**
```typescript
phone: call.customer?.number || null,
```

**Problem:**
- No E.164 validation
- Invalid formats stored: "123", "abc", "+1", etc.
- Lead matching by phone fails
- SMS/WhatsApp sending fails

**Fix:**
```typescript
import { validateE164Format } from '../utils/phone-validation';

const phoneNumber = call.customer?.number;
if (phoneNumber && !validateE164Format(phoneNumber)) {
  console.error('[handleCallStarted] Invalid phone format:', phoneNumber);
  return;
}

phone: phoneNumber || null,
```

---

## High-Priority Issues (🟠 Must Fix Before Scaling)

### 6. **Idempotency Key Collision: `call.duration` Not Stable**
**Location:** `webhooks.ts:377` in `handleCallEnded()`  
**Severity:** 🟠 High  
**Impact:** Duplicate `call.ended` events processed if duration changes

**Current Code:**
```typescript
const eventId = `ended:${call.id}:${call.duration || 0}`;
```

**Problem:**
- Vapi may send `call.ended` multiple times with slightly different durations
- Each unique duration creates new `eventId`
- Idempotency fails; multiple `call.ended` handlers run

**Fix:**
```typescript
const eventId = `ended:${call.id}`;  // Duration not part of key
```

---

### 7. **No Timeout on Supabase Queries**
**Location:** `webhooks.ts` (all handlers)  
**Severity:** 🟠 High  
**Impact:** Webhook handler hangs; Vapi timeout; call tracking lost

**Problem:**
- Supabase queries have no timeout
- Network flap → query hangs indefinitely
- Vapi webhook timeout (usually 30s) → retry loop
- No circuit breaker

**Fix:**
```typescript
import { withTimeout } from '../utils/timeout-helper';

const callTracking = await withTimeout(
  supabase
    .from('call_tracking')
    .select('id, lead_id, org_id, metadata')
    .eq('vapi_call_id', call.id)
    .maybeSingle(),
  5000  // 5 second timeout
);
```

---

### 8. **Sensitive Data Logged (Phone Numbers, Credentials)**
**Location:** `inbound-setup.ts:79, 97, 121`  
**Severity:** 🟠 High  
**Impact:** PII exposed in logs; compliance violation (GDPR, CCPA)

**Current Code:**
```typescript
console.log('[InboundSetup] Validating Twilio credentials', { requestId, accountSid: twilioAccountSid.substring(0, 4) + '...' });
```

**Problem:**
- Phone numbers logged in full
- Partial credentials still visible
- Logs stored in CloudWatch/Datadog (accessible to ops team)

**Fix:**
```typescript
// Redact sensitive data
const redactPhoneNumber = (phone: string) => phone?.slice(-4).padStart(phone.length, '*') || 'unknown';
const redactAccountSid = (sid: string) => sid?.slice(-4).padStart(sid.length, '*') || 'unknown';

console.log('[InboundSetup] Validating Twilio credentials', {
  requestId,
  accountSid: redactAccountSid(twilioAccountSid)
});
```

---

### 9. **No Rate Limiting on Webhook Endpoint (Denial of Service)**
**Location:** `webhooks.ts:12-18`  
**Severity:** 🟠 High  
**Impact:** Attacker can flood webhook; legitimate events dropped

**Current Code:**
```typescript
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,  // 1000 events per minute = 16/second
  // ...
});
```

**Problem:**
- 1000 events/minute is too high for single user
- Attacker can send 1000 fake webhooks, blocking real ones
- No per-call-id rate limiting

**Fix:**
```typescript
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,  // 100 events per minute = 1.6/second (reasonable for Vapi)
  keyGenerator: (req) => {
    // Rate limit per IP + call ID (if present)
    const callId = req.body?.call?.id || 'unknown';
    return `${req.ip}:${callId}`;
  }
});
```

---

### 10. **No Validation of `assistantId` Format**
**Location:** `webhooks.ts:238` in `handleCallStarted()`  
**Severity:** 🟠 High  
**Impact:** Invalid assistant IDs accepted; agent lookup fails silently

**Current Code:**
```typescript
if (call.assistantId) {
  const { data: agent } = await supabase
    .from('agents')
    .select('id, org_id, name, active')
    .eq('vapi_assistant_id', call.assistantId)
    .eq('active', true)
    .maybeSingle();
}
```

**Problem:**
- No validation that `assistantId` is UUID format
- SQL injection risk (though Supabase parameterizes)
- Silent failure if agent not found

**Fix:**
```typescript
import { isValidUUID } from '../utils/validation';

if (!call.assistantId || !isValidUUID(call.assistantId)) {
  console.error('[handleCallStarted] Invalid assistantId format:', call.assistantId);
  return;
}
```

---

### 11. **Inconsistent Error Handling: Some Handlers Return, Others Continue**
**Location:** `webhooks.ts` (all handlers)  
**Severity:** 🟠 High  
**Impact:** Inconsistent behavior; some failures silent, others logged

**Current Code:**
```typescript
// handleCallStarted: returns on error
if (!agent) {
  console.error('[handleCallStarted] No active agent found...');
  return;  // ← Early return
}

// handleCallEnded: continues on error
if (error) {
  console.error('[handleCallEnded] Failed to update call log:', error);
  // ← No return, continues to next operation
}
```

**Problem:**
- Inconsistent error handling makes debugging hard
- Some failures cascade; others are isolated
- No clear contract on what constitutes "success"

**Fix:**
```typescript
// Consistent pattern: log error, return early
if (error) {
  console.error('[handleCallEnded] Failed to update call log:', error);
  return false;  // Signal failure to caller
}
```

---

### 12. **No Validation of Webhook Payload Structure**
**Location:** `webhooks.ts:96-115` VapiEvent interface  
**Severity:** 🟠 High  
**Impact:** Malformed webhooks crash handler; no graceful degradation

**Current Code:**
```typescript
interface VapiEvent {
  type: string;
  call?: {
    id: string;
    status: string;
    // ... optional fields
  };
}
```

**Problem:**
- No runtime validation (TypeScript is compile-time only)
- Missing `call.id` → undefined behavior
- No schema validation library (zod, joi)

**Fix:**
```typescript
import { z } from 'zod';

const VapiEventSchema = z.object({
  type: z.enum(['call.started', 'call.ended', 'call.transcribed', 'end-of-call-report', 'function-call']),
  call: z.object({
    id: z.string().uuid(),
    status: z.string(),
    duration: z.number().optional(),
    assistantId: z.string().uuid().optional(),
    customer: z.object({
      number: z.string(),
      name: z.string().optional()
    }).optional()
  }).optional()
});

const event = VapiEventSchema.parse(req.body);
```

---

## Medium-Priority Issues (🟡 Should Fix Before Scaling)

### 13. **No Circuit Breaker for Vapi API Calls**
**Location:** `inbound-setup.ts:125-138`  
**Severity:** 🟡 Medium  
**Impact:** Cascading failures; slow error recovery

**Problem:**
- If Vapi API is down, every inbound setup request hangs
- No exponential backoff or circuit breaker
- User waits 30+ seconds for timeout

**Recommendation:**
Use `opossum` (already in dependencies):
```typescript
import CircuitBreaker from 'opossum';

const vapiBreaker = new CircuitBreaker(
  async (fn) => fn(),
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  }
);

try {
  vapiPhoneNumber = await vapiBreaker.fire(() =>
    vapiClient.importTwilioNumber(...)
  );
} catch (error) {
  if (error.message.includes('breaker is open')) {
    res.status(503).json({ error: 'Vapi service temporarily unavailable' });
  }
}
```

---

### 14. **No Audit Trail for Sensitive Operations**
**Location:** `inbound-setup.ts`, `founder-console.ts`  
**Severity:** 🟡 Medium  
**Impact:** No compliance audit trail; can't trace who changed what

**Problem:**
- No record of who configured inbound setup
- No timestamp of configuration changes
- Compliance issue (SOC 2, HIPAA)

**Recommendation:**
Create `audit_logs` table:
```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  changes jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index idx_audit_logs_org_id on public.audit_logs(org_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
```

Log all sensitive operations:
```typescript
await supabase.from('audit_logs').insert({
  org_id: orgId,
  user_id: userId,
  action: 'inbound_setup_completed',
  resource_type: 'inbound_config',
  resource_id: agentId,
  changes: { phoneNumber: twilioPhoneNumber, vapiAssistantId },
  ip_address: req.ip
});
```

---

### 15. **Webhook Signature Verification Uses Database Fetch on Every Call**
**Location:** `webhooks.ts:25-27`  
**Severity:** 🟡 Medium  
**Impact:** Performance degradation; unnecessary DB load

**Current Code:**
```typescript
async function verifyVapiSignature(req: express.Request): Promise<boolean> {
  const settings = await getIntegrationSettings();  // DB query on every webhook
  const secret = settings?.vapi_webhook_secret;
}
```

**Problem:**
- Every webhook triggers DB query
- Vapi sends 100s of webhooks/day
- DB load increases linearly

**Fix:**
Cache secret in memory with TTL:
```typescript
const secretCache = new Map<string, { secret: string; expiresAt: number }>();

async function getWebhookSecret(orgId: string): Promise<string | null> {
  const cached = secretCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.secret;
  }

  const settings = await getIntegrationSettings();
  const secret = settings?.vapi_webhook_secret;
  
  if (secret) {
    secretCache.set(orgId, {
      secret,
      expiresAt: Date.now() + 5 * 60 * 1000  // 5 min TTL
    });
  }
  
  return secret;
}
```

---

### 16. **No Validation of `call.status` Enum**
**Location:** `webhooks.ts:100`  
**Severity:** 🟡 Medium  
**Impact:** Invalid statuses stored; UI breaks

**Problem:**
- `call.status` can be any string
- No validation against allowed values
- UI assumes specific status values

**Fix:**
```typescript
const VALID_CALL_STATUSES = ['queued', 'ringing', 'active', 'completed', 'failed', 'ended'] as const;

if (!VALID_CALL_STATUSES.includes(call.status)) {
  console.error('[handleCallStarted] Invalid call status:', call.status);
  return;
}
```

---

## Low-Priority Issues (🟢 Nice to Have)

### 17. **Inconsistent Logging Format**
**Location:** `webhooks.ts`, `inbound-setup.ts`  
**Severity:** 🟢 Low  
**Impact:** Hard to parse logs; inconsistent debugging experience

**Current Code:**
```typescript
console.log('[handleCallStarted] Call tracking not found, retrying', { ... });
console.error('[InboundSetup] ❌ Twilio validation failed', { ... });
console.warn('[handleCallStarted] Timestamp outside allowed skew window');
```

**Recommendation:**
Use structured logging with consistent format:
```typescript
logger.info('call_tracking_not_found', {
  vapiCallId: call.id,
  attempt: attempt + 1,
  nextRetryMs: RETRY_DELAYS[attempt]
});

logger.error('twilio_validation_failed', {
  accountSid: redactAccountSid(twilioAccountSid),
  error: twilioError.message
});
```

---

### 18. **Magic Strings Instead of Enums**
**Location:** `webhooks.ts:273`, `inbound-setup.ts:195`  
**Severity:** 🟢 Low  
**Impact:** Typos cause silent bugs; hard to refactor

**Current Code:**
```typescript
metadata: {
  channel: 'inbound',  // Magic string
  source: 'vapi_webhook'
}

provider: 'twilio_inbound'  // Magic string
```

**Fix:**
```typescript
enum Channel {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  TEST = 'test'
}

enum Provider {
  VAPI = 'vapi',
  TWILIO = 'twilio',
  TWILIO_INBOUND = 'twilio_inbound'
}

metadata: {
  channel: Channel.INBOUND,
  source: 'vapi_webhook'
}

provider: Provider.TWILIO_INBOUND
```

---

### 19. **No Observability: Missing Distributed Tracing**
**Location:** All handlers  
**Severity:** 🟢 Low  
**Impact:** Hard to debug end-to-end flows

**Recommendation:**
Add request ID propagation:
```typescript
const requestId = req.headers['x-request-id'] || crypto.randomUUID();

// Pass through all async operations
const { data } = await supabase
  .from('call_tracking')
  .select('*')
  .eq('vapi_call_id', call.id)
  .headers({ 'x-request-id': requestId });
```

---

### 20. **No Health Check Endpoint for Webhook**
**Location:** `webhooks.ts`  
**Severity:** 🟢 Low  
**Impact:** No way to verify webhook is alive

**Recommendation:**
```typescript
webhooksRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

## Summary Table

| Issue | Severity | Category | Impact | Fix Time |
|-------|----------|----------|--------|----------|
| Metadata not propagated | 🔴 Critical | Data | UI broken | 15 min |
| Duplicate call_logs rows | 🔴 Critical | Data | Analytics broken | 30 min |
| Webhook returns 200 on failure | 🔴 Critical | Reliability | Silent failures | 20 min |
| Timestamp skew too large | 🔴 Critical | Security | Replay attacks | 5 min |
| No phone number validation | 🔴 Critical | Data | Invalid data stored | 15 min |
| Idempotency key collision | 🟠 High | Reliability | Duplicate processing | 10 min |
| No query timeout | 🟠 High | Reliability | Hangs | 20 min |
| Sensitive data logged | 🟠 High | Security | PII exposure | 30 min |
| No webhook rate limiting | 🟠 High | Security | DoS | 15 min |
| No assistantId validation | 🟠 High | Data | Silent failures | 10 min |
| Inconsistent error handling | 🟠 High | Maintainability | Hard to debug | 40 min |
| No payload validation | 🟠 High | Reliability | Crashes | 30 min |
| No circuit breaker | 🟡 Medium | Reliability | Cascading failures | 45 min |
| No audit trail | 🟡 Medium | Compliance | No accountability | 60 min |
| DB fetch on every webhook | 🟡 Medium | Performance | DB load | 25 min |
| No status enum validation | 🟡 Medium | Data | Invalid data | 10 min |
| Inconsistent logging | 🟢 Low | Observability | Hard to debug | 30 min |
| Magic strings | 🟢 Low | Maintainability | Typos | 20 min |
| No distributed tracing | 🟢 Low | Observability | Hard to debug | 40 min |
| No health check | 🟢 Low | Observability | No visibility | 10 min |

---

## Recommended Fix Priority

**Phase 1 (Before Production):**
1. Metadata channel propagation (Issue #1)
2. Duplicate call_logs rows (Issue #2)
3. Webhook error handling (Issue #3)
4. Timestamp skew (Issue #4)
5. Phone number validation (Issue #5)

**Phase 2 (Before Scaling):**
6. Idempotency key collision (Issue #6)
7. Query timeout (Issue #7)
8. Sensitive data logging (Issue #8)
9. Webhook rate limiting (Issue #9)
10. AssistantId validation (Issue #10)

**Phase 3 (Before SOC 2):**
11. Payload validation (Issue #12)
12. Audit trail (Issue #14)
13. Circuit breaker (Issue #13)

---

## Testing Recommendations

### Unit Tests
```typescript
describe('Webhook Handlers', () => {
  it('should propagate channel metadata to call_logs', async () => {
    // Verify metadata.channel is set
  });

  it('should not create duplicate call_logs on retry', async () => {
    // Send same webhook twice, verify only 1 row
  });

  it('should validate phone number format', async () => {
    // Test invalid formats rejected
  });

  it('should reject old timestamps', async () => {
    // Test timestamp > 60s old rejected
  });
});
```

### Integration Tests
```typescript
describe('Inbound Call Flow', () => {
  it('should handle complete inbound call lifecycle', async () => {
    // call.started → call.transcribed → call.ended
    // Verify all DB rows created correctly
  });

  it('should handle webhook retries idempotently', async () => {
    // Send same webhook 3 times
    // Verify only 1 row in each table
  });
});
```

---

## Conclusion

The codebase has **solid foundations** (idempotency, retry logic, signature verification) but needs **critical fixes** before production. Focus on the 5 🔴 issues first, then the 7 🟠 issues before scaling.

**Estimated effort:** 8-10 hours for all fixes  
**Risk if not fixed:** Data corruption, security vulnerabilities, silent failures

