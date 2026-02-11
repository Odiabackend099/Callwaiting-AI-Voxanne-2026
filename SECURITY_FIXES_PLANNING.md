# Security P0 Fixes - Planning Document

**Date:** 2026-02-12
**Priority:** P0 (Critical - Production Blockers)
**Estimated Time:** 7.5 hours total
**Principle:** 3-Step Coding (Plan → Code → Test)

---

## OVERVIEW

Layer 6 (Security Audit) identified **4 P0 critical vulnerabilities** that must be fixed before production launch:

1. **🔴 P0-1:** JWT Token Tampering + Privilege Escalation (CVSS 9.8)
2. **🔴 P0-2:** Billing Manipulation via Negative Amounts (CVSS 9.1)
3. **🔴 P0-3:** Webhook Replay Attack + Double Billing (CVSS 8.7)
4. **🔴 P0-4:** Horizontal Privilege Escalation via IDOR (CVSS 9.0)

All fixes are **surgical changes** with **zero breaking changes** to existing functionality.

---

## P0-1: JWT TOKEN TAMPERING + PRIVILEGE ESCALATION

### Current Code (VULNERABLE)

**File:** `backend/src/middleware/auth.ts`
**Lines:** 294-317

```typescript
// CRITICAL SECURITY HOLE: Cache bypasses signature verification
if (cachedUser) {
  // Cache hit: use cached data
  isCached = true;
  cacheStats.hits++;

  if (cachedUser.orgId === 'default') {
    res.status(401).json({ error: 'Missing org_id in JWT' });
    return;
  }

  req.user = {
    id: cachedUser.userId,
    email: cachedUser.email,
    orgId: cachedUser.orgId    // ← Uses CACHED org_id WITHOUT re-verifying token signature!
  };

  next();  // ← Proceeds without signature check
  return;
}
```

### Attack Vector

1. Attacker obtains valid JWT token (via XSS, network sniffing, etc.)
2. Decodes JWT payload (no signature required for decoding)
3. Modifies `org_id` claim to target competitor: `{ org_id: "competitor-uuid" }`
4. Sends modified token to API
5. If cache TTL (5 min) hasn't expired, middleware trusts cached `org_id`
6. **Result:** Attacker accesses competitor's data without signature verification

### Impact

- Access any organization's PHI (call logs, contacts, transcripts)
- View billing information
- Modify agent settings
- Exfiltrate all customer data within 5-minute cache window
- **HIPAA Violation:** Unauthorized PHI disclosure

### Fix Strategy

**Remove cache bypass for signature verification.** Cache should store TOKEN SIGNATURE for performance, not replace verification.

```typescript
// AFTER FIX
export function requireAuth(options: AuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    try {
      // ✅ ALWAYS VERIFY SIGNATURE (even if cached)
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        jwtCache.delete(token);  // Remove invalid token from cache
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // ✅ Extract org_id from VERIFIED user metadata
      const orgId = user.app_metadata?.org_id;

      if (!orgId || orgId === 'default') {
        return res.status(401).json({ error: 'Missing org_id in JWT' });
      }

      // ✅ Cache AFTER verification (not instead of)
      jwtCache.set(token, {
        userId: user.id,
        email: user.email || '',
        orgId: orgId
      });

      req.user = {
        id: user.id,
        email: user.email || '',
        orgId: orgId  // From VERIFIED token, not cache
      };

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token verification failed' });
    }
  };
}
```

### Verification

**Test 1: Valid Token**
```bash
# Should succeed with correct org_id
curl -H "Authorization: Bearer $VALID_TOKEN" \
  https://api.voxanne.ai/api/contacts
# Expected: 200 OK, returns contacts for correct org
```

**Test 2: Modified Token (JWT Tampering Attack)**
```bash
# Attacker modifies JWT payload (changes org_id)
# Should FAIL with 401 Unauthorized
curl -H "Authorization: Bearer $MODIFIED_TOKEN" \
  https://api.voxanne.ai/api/contacts
# Expected: 401 "Invalid or expired token"
```

**Test 3: Expired Token**
```bash
# Should fail and clear from cache
curl -H "Authorization: Bearer $EXPIRED_TOKEN" \
  https://api.voxanne.ai/api/contacts
# Expected: 401 "Invalid or expired token"
```

---

## P0-2: BILLING MANIPULATION VIA NEGATIVE AMOUNTS

### Current Code (VULNERABLE)

**File:** `backend/src/routes/billing-api.ts`
**Lines:** 460-467

```typescript
// CRITICAL BUG: No validation for negative amounts
const minTopUp = parseInt(process.env.WALLET_MIN_TOPUP_PENCE || '2500', 10);
const { amount_pence } = req.body;

if (!amount_pence || typeof amount_pence !== 'number' || amount_pence < minTopUp) {
  return res.status(400).json({
    error: `Minimum top-up is £${(minTopUp / 100).toFixed(2)} (${minTopUp}p)`,
  });
}
// ❌ BUG: amount_pence = -100000 passes validation!
// Only checks: amount_pence < minTopUp (2500)
// Negative numbers are always < 2500, but logic is backwards
```

### Attack Vector

1. Attacker creates account (free trial)
2. Calls `/api/billing/wallet/topup` with negative amount: `{"amount_pence": -100000}`
3. Stripe checkout session created with negative line item
4. Attacker "completes checkout" → credited £1000 instead of charged
5. **Result:** Unlimited free calls, platform loses revenue

### Impact

- Unlimited free service consumption
- Platform bankruptcy (negative revenue)
- At scale: 1000 customers × £100K = £100M potential loss
- Financial fraud liability

### Fix Strategy

**Add explicit validation for negative, zero, and non-finite amounts.**

```typescript
// AFTER FIX
const minTopUp = parseInt(process.env.WALLET_MIN_TOPUP_PENCE || '2500', 10);
const { amount_pence } = req.body;

// ✅ Comprehensive validation
if (!amount_pence ||
    typeof amount_pence !== 'number' ||
    amount_pence <= 0 ||                  // ← Prevent negative AND zero
    !Number.isFinite(amount_pence) ||     // ← Prevent NaN, Infinity
    amount_pence < minTopUp ||            // ← Enforce minimum
    !Number.isInteger(amount_pence)) {    // ← Prevent decimal amounts (pence must be integer)
  return res.status(400).json({
    error: `Invalid amount. Minimum top-up is £${(minTopUp / 100).toFixed(2)}`,
  });
}
```

### Verification

**Test 1: Negative Amount (Attack)**
```bash
curl -X POST https://api.voxanne.ai/api/billing/wallet/topup \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount_pence": -100000}'
# Expected: 400 "Invalid amount"
```

**Test 2: Zero Amount**
```bash
curl -X POST https://api.voxanne.ai/api/billing/wallet/topup \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount_pence": 0}'
# Expected: 400 "Invalid amount"
```

**Test 3: NaN / Infinity**
```bash
curl -X POST https://api.voxanne.ai/api/billing/wallet/topup \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount_pence": "NaN"}'
# Expected: 400 "Invalid amount"
```

**Test 4: Decimal Amount (Fractional Pence)**
```bash
curl -X POST https://api.voxanne.ai/api/billing/wallet/topup \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount_pence": 2500.5}'
# Expected: 400 "Invalid amount"
```

**Test 5: Valid Amount**
```bash
curl -X POST https://api.voxanne.ai/api/billing/wallet/topup \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount_pence": 2500}'
# Expected: 200 OK, Stripe checkout URL returned
```

---

## P0-3: WEBHOOK REPLAY ATTACK + DOUBLE BILLING

### Current Code (VULNERABLE)

**File:** `backend/src/routes/stripe-webhooks.ts`
**Lines:** 36-84

```typescript
// CRITICAL BUG: No idempotency check
router.post('/stripe',
  verifyStripeSignature(),  // ← Only verifies signature, NOT event uniqueness
  async (req: Request, res: Response) => {
    const event = (req as any).stripeEvent;

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid event' });
    }

    // ❌ BUG: No check for duplicate event.id
    // ❌ BUG: No idempotency tracking
    res.status(200).json({ received: true });  // Returns 200 immediately

    try {
      const job = await enqueueBillingWebhook({
        eventId: event.id,
        eventType: event.type,
        eventData: event.data.object,
        receivedAt: new Date().toISOString(),
      });
      // ❌ BUG: Job queue doesn't check if eventId already processed!
```

### Attack Vector

1. Attacker intercepts legitimate webhook: `evt_1234567890` (User charged £10)
2. Replays webhook 100 times (signature still valid)
3. Each replay queued to BullMQ without deduplication
4. User credited 100× for single payment: £10 → £1000
5. **Result:** Billing fraud, revenue destruction

### Impact

- Double/triple billing fraud
- Revenue manipulation
- Customer churn (legitimate users charged for fraud)
- Data integrity violation

### Fix Strategy

**Create `processed_stripe_webhooks` table to track processed event IDs.** Check before queuing.

**Step 1: Create Migration**

```sql
-- backend/supabase/migrations/20260212_processed_stripe_webhooks.sql
CREATE TABLE IF NOT EXISTS processed_stripe_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX idx_processed_stripe_webhooks_event_id
  ON processed_stripe_webhooks(stripe_event_id);

-- Cleanup function (delete events older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_processed_stripe_webhooks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processed_stripe_webhooks
  WHERE processed_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE processed_stripe_webhooks IS
  'Idempotency tracking for Stripe webhooks (prevents replay attacks)';
```

**Step 2: Update Webhook Handler**

```typescript
// AFTER FIX
router.post('/stripe',
  verifyStripeSignature(),
  async (req: Request, res: Response) => {
    const event = (req as any).stripeEvent;

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid event' });
    }

    // ✅ Check if event already processed
    const { data: existing, error: checkError } = await supabase
      .from('processed_stripe_webhooks')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (checkError) {
      log.error('StripeWebhook', 'Idempotency check failed', {
        eventId: event.id,
        error: checkError.message
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (existing) {
      // Event already processed, return 200 without re-processing
      log.info('StripeWebhook', 'Duplicate event ignored (idempotency)', {
        eventId: event.id,
        eventType: event.type
      });
      return res.status(200).json({
        received: true,
        cached: true,
        message: 'Event already processed'
      });
    }

    // ✅ Mark event as processed BEFORE queuing
    const { error: insertError } = await supabase
      .from('processed_stripe_webhooks')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        processed_at: new Date().toISOString()
      });

    if (insertError) {
      // Possible race condition: another request beat us to it
      if (insertError.code === '23505') {  // Unique violation
        log.info('StripeWebhook', 'Race condition: event already processed', {
          eventId: event.id
        });
        return res.status(200).json({
          received: true,
          cached: true,
          message: 'Event already processed (race condition)'
        });
      }

      log.error('StripeWebhook', 'Failed to track event', {
        eventId: event.id,
        error: insertError.message
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    // ✅ Now safe to process (idempotency guaranteed)
    res.status(200).json({ received: true });

    try {
      const job = await enqueueBillingWebhook({
        eventId: event.id,
        eventType: event.type,
        eventData: event.data.object,
        receivedAt: new Date().toISOString(),
      });

      log.info('StripeWebhook', 'Event queued', {
        eventId: event.id,
        jobId: job.id
      });
    } catch (queueError: any) {
      log.error('StripeWebhook', 'Failed to queue event', {
        eventId: event.id,
        error: queueError.message
      });
    }
  }
);
```

### Verification

**Test 1: First Webhook Delivery**
```bash
stripe trigger checkout.session.completed
# Expected: 200 OK, event processed, credits added
```

**Test 2: Replay Attack (Same Event ID)**
```bash
# Replay same event 5 times
for i in {1..5}; do
  stripe trigger checkout.session.completed --replay evt_1234567890
done
# Expected: Only 1st request processes, 2nd-5th return "Event already processed"
```

**Test 3: Database Check**
```sql
SELECT * FROM processed_stripe_webhooks
WHERE stripe_event_id = 'evt_1234567890';
-- Expected: 1 row (not 5)
```

**Test 4: Race Condition (Concurrent Requests)**
```bash
# Send same event from 10 parallel curl requests
# Only 1 should insert, others should detect duplicate
# Expected: 1 credit applied, not 10
```

---

## P0-4: HORIZONTAL PRIVILEGE ESCALATION VIA IDOR

### Current Code (VULNERABLE)

**File:** `backend/src/routes/contacts.ts`
**Lines:** 48-54

```typescript
// Filters by org_id from JWT, but combined with P0-1 (JWT tampering),
// attacker can modify org_id to access other orgs' data
contactsRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;  // ← Trusts org_id from potentially tampered JWT
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('contacts')
      .select('lead_status', { count: 'exact' })
      .eq('org_id', orgId);  // ← Filters by potentially SPOOFED org_id
```

### Attack Vector

Combined exploit with P0-1:
1. Attacker modifies JWT `org_id` to competitor's UUID
2. Calls `/api/contacts` with modified token
3. If JWT signature not verified (P0-1), org_id is spoofed
4. **Result:** Access competitor's contact list (PHI exposure)

### Impact

- Access contacts from any org (PHI breach)
- View call logs with patient names/phone numbers
- Steal competitive intelligence
- **HIPAA Violation:** Unauthorized PHI disclosure

### Fix Strategy

**This vulnerability is FIXED by P0-1 (JWT signature verification).** Additionally, verify RLS policies are enabled on all tables.

**Step 1: Verify RLS Policies Exist**

Check all customer-facing tables have RLS enabled:

```sql
-- Run this query to verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'contacts', 'call_logs', 'appointments',
    'agents', 'knowledge_base_chunks', 'organizations'
  )
ORDER BY tablename;

-- Expected: All tables show rls_enabled = true
```

**Step 2: Audit RLS Policies**

Verify each table has org_id filtering policy:

```sql
-- Example for contacts table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'contacts';

-- Expected: Policy with org_id filtering like:
-- qual: "(org_id = ( SELECT auth.uid() AS uid))"
```

**Step 3: Test Cross-Org Access**

Create test to verify RLS blocks cross-org access:

```typescript
// backend/src/__tests__/integration/rls-enforcement.test.ts
describe('RLS Enforcement (P0-4 Fix)', () => {
  it('should block cross-org contact access', async () => {
    const org1Token = 'jwt-for-org-1';
    const org2Token = 'jwt-for-org-2';

    // Create contact in org 1
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${org1Token}`)
      .send({ name: 'Org 1 Contact', phone: '+12125551234' });

    // Try to access org 1's contacts from org 2 token
    const response = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${org2Token}`);

    // RLS should prevent org 2 from seeing org 1's contacts
    expect(response.status).toBe(200);
    expect(response.body.contacts).toEqual([]);  // Empty array (RLS blocked)
  });
});
```

### Verification

**Test 1: Same-Org Access (Should Work)**
```bash
curl -H "Authorization: Bearer $ORG_1_TOKEN" \
  https://api.voxanne.ai/api/contacts
# Expected: 200 OK, returns org 1's contacts
```

**Test 2: Cross-Org Access (Should Fail)**
```bash
# Use org 2's token to access org 1's data
curl -H "Authorization: Bearer $ORG_2_TOKEN" \
  https://api.voxanne.ai/api/contacts?org_id=org-1-uuid
# Expected: 200 OK, but empty array (RLS blocks cross-org access)
```

**Test 3: RLS Bypass Attempt (Should Fail)**
```bash
# Try to bypass via query parameter
curl -H "Authorization: Bearer $ORG_2_TOKEN" \
  "https://api.voxanne.ai/api/contacts?org_id=org-1-uuid"
# Expected: RLS enforces org_id from JWT, not query param
```

---

## IMPLEMENTATION ORDER

### Phase 1: JWT Signature Verification (2 hours)

1. Open `backend/src/middleware/auth.ts`
2. Modify `requireAuth()` function (lines 280-365)
3. Remove cache bypass logic
4. Always call `supabase.auth.getUser(token)` to verify signature
5. Cache AFTER verification (not instead of)
6. Test with valid/invalid/expired tokens

### Phase 2: Negative Amount Validation (30 minutes)

1. Open `backend/src/routes/billing-api.ts`
2. Update validation at lines 460-467
3. Add checks for: `<= 0`, `!isFinite()`, `!isInteger()`
4. Test with negative/zero/NaN/decimal amounts

### Phase 3: Webhook Idempotency (1 hour)

1. Create migration: `backend/supabase/migrations/20260212_processed_stripe_webhooks.sql`
2. Apply migration via Supabase MCP
3. Update `backend/src/routes/stripe-webhooks.ts` (lines 36-84)
4. Add idempotency check before queuing
5. Test with replay attacks

### Phase 4: RLS Policy Verification (4 hours)

1. Run SQL query to verify RLS enabled
2. Audit RLS policies for org_id filtering
3. Create RLS enforcement test suite
4. Test cross-org access (should fail)

**Total Time:** 7.5 hours

---

## RISK ASSESSMENT

**P0-1: JWT Signature Verification**
- **Breaking Changes:** None (signature verification already existed, just bypassed by cache)
- **Rollback:** Git revert
- **Risk Level:** LOW (improves security, no functionality changes)

**P0-2: Negative Amount Validation**
- **Breaking Changes:** None (only blocks invalid inputs)
- **Rollback:** Git revert
- **Risk Level:** ZERO (pure validation, no logic changes)

**P0-3: Webhook Idempotency**
- **Breaking Changes:** None (idempotency prevents duplicates, doesn't change behavior)
- **Rollback:** Drop table, revert code
- **Risk Level:** LOW (additive change, backward-compatible)

**P0-4: RLS Policy Verification**
- **Breaking Changes:** None (RLS already enabled, just verifying)
- **Rollback:** N/A (no code changes)
- **Risk Level:** ZERO (verification only)

---

## SUCCESS CRITERIA

**P0-1 Success:**
- ✅ JWT signature verified on EVERY request
- ✅ Cache no longer bypasses verification
- ✅ Modified tokens rejected with 401
- ✅ Valid tokens still work correctly

**P0-2 Success:**
- ✅ Negative amounts rejected (400 error)
- ✅ Zero amounts rejected
- ✅ NaN/Infinity rejected
- ✅ Decimal amounts rejected
- ✅ Valid amounts still process correctly

**P0-3 Success:**
- ✅ Duplicate webhooks ignored (idempotency)
- ✅ Only 1 credit applied for replayed events
- ✅ Database tracks all processed event IDs
- ✅ Cleanup function removes old events (30 days)

**P0-4 Success:**
- ✅ RLS enabled on all customer tables
- ✅ Cross-org access blocked by RLS
- ✅ Same-org access still works
- ✅ RLS enforcement test suite passes

---

## FILES TO MODIFY

### Backend (3 files + 1 migration)
- `backend/src/middleware/auth.ts` (modify 40 lines)
- `backend/src/routes/billing-api.ts` (modify 10 lines)
- `backend/src/routes/stripe-webhooks.ts` (modify 50 lines)
- `backend/supabase/migrations/20260212_processed_stripe_webhooks.sql` (new file, 50 lines)

**Total Changes:** 3 files modified, 1 migration added, ~150 lines of code

---

## DEPLOYMENT CHECKLIST

**Pre-Deployment:**
- [ ] Code changes committed
- [ ] Migration applied to Supabase
- [ ] Tests passing (JWT, billing, webhooks, RLS)
- [ ] All automated tests pass

**Post-Deployment:**
- [ ] Monitor Sentry for JWT validation errors (first 24 hours)
- [ ] Check billing flow (top-up, credits, auto-recharge)
- [ ] Verify webhook processing still works (Stripe test mode)
- [ ] Verify RLS blocks cross-org access
- [ ] Monitor support tickets for billing/auth confusion

---

## NEXT STEPS AFTER FIXES

1. ✅ Verify P0 fixes deployed
2. ⏳ Update npm dependencies (P1-1) - 2 hours
3. ⏳ Fix CORS configuration (P1-2) - 3 hours
4. ⏳ Sanitize error messages (P1-3) - 4 hours
5. ⏳ Resume Layer 7 (Infrastructure Audit)

---

**STATUS:** ✅ PLANNING COMPLETE - READY TO CODE

**Next Phase:** CODE (Step 2 of 3-step coding principle)
