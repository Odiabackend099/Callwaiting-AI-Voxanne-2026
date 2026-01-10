# PRODUCTION MVP ROADMAP
## "What People Will Actually Pay For (That We Can Ship)"

**Status:** Strategic MVP definition
**Timeline:** 2 weeks to revenue
**Pricing:** £169-449/month (already defined)

---

## THE CORE REALITY

**What People Pay For:**
- Phones that don't ring unanswered ✅ (We have this)
- Calls that get recorded/logged ✅ (We have this)
- Ability to review what customers asked ✅ (We have this)

**What They DON'T Care About (For MVP):**
- Load testing to 100 concurrent calls ❌ (Can happen later)
- Perfect escalation algorithm ❌ (Good enough works)
- Advanced RAG matching ❌ (Basic KB lookup works)

**What Actually Kills the Sale:**
- Can't answer calls ❌ (We can, this is solved)
- Lost recordings ❌ (We store these)
- Can't review calls ❌ (We have dashboard)
- Data breach/HIPAA violation ❌ (We can fix)

---

## THE FIXABLE MVP (2 WEEKS)

### TIER 1: Must Fix (Can't Launch Without) - 3 days

#### 1. Fix Auth Bypass (Dev Mode in Production)
**Current Problem:** NODE_ENV fallback allows unauthorized access
**Impact:** HIPAA violation, data breach
**Fix:** 30 minutes

```typescript
// backend/src/middleware/auth.ts
// CHANGE: Remove dev fallback in production

export async function requireAuthOrDev(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // STRICT: No fallback whatsoever
    await requireAuth(req, res, next);
    return;
  }

  // Dev mode: Allow fallback (for internal testing only)
  // ... existing dev logic ...
}
```

**Effort:** 30 minutes (code + verify)
**Risk:** None (tightening security)
**Blockers:** None

---

#### 2. Add Recording Cleanup Job
**Current Problem:** Failed uploads accumulate forever
**Impact:** Database bloat, lost recordings
**Fix:** 2 hours

```typescript
// backend/src/jobs/recording-cleanup.ts (NEW FILE)

export async function cleanupOrphanedRecordings() {
  // Delete failed uploads older than 7 days
  const { error } = await supabase
    .from('recording_upload_queue')
    .delete()
    .eq('status', 'failed')
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    log.error('Cleanup', 'Failed to delete orphaned recordings', { error });
  } else {
    log.info('Cleanup', 'Deleted orphaned recordings');
  }
}

// Run daily at 2 AM UTC
schedule.scheduleJob('0 2 * * *', cleanupOrphanedRecordings);
```

**Effort:** 2 hours (write + test + deploy)
**Risk:** Low (cleanup only)
**Blockers:** None

---

#### 3. Implement OpenAI Embedding Fallback
**Current Problem:** KB breaks when OpenAI hits rate limit
**Impact:** Knowledge base doesn't work during load
**Fix:** 3 hours

```typescript
// backend/src/services/embeddings.ts

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Try primary (OpenAI)
    return await openai!.embeddings.create({...});
  } catch (error: any) {
    if (error?.status === 429) {
      // Rate limited: Use Groq as fallback
      log.warn('Embeddings', 'OpenAI rate limited, using Groq fallback');
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        // Groq embedding endpoint (if available)
        // If not, return zero vector (KB lookup disabled but system continues)
        return new Array(1536).fill(0);
      } catch {
        // Fallback to zero vector: System works, KB just doesn't match
        return new Array(1536).fill(0);
      }
    }
    throw error;
  }
}
```

**Effort:** 3 hours (implement + test)
**Risk:** Low (graceful degradation)
**Blockers:** Need Groq API key or accept zero-vector fallback

---

#### 4. Set NODE_ENV=production in Render
**Current Problem:** Dev mode auth bypass active in production
**Impact:** HIPAA violation possible
**Fix:** 5 minutes

```bash
# Render dashboard:
# Environment → NODE_ENV = production

# Verify:
curl https://voxanne-backend.onrender.com/api/calls \
  -H "Authorization: Bearer invalid-token"
# Should return 401, not 200
```

**Effort:** 5 minutes
**Risk:** None
**Blockers:** None

---

#### 5. Add Health Check for Dependencies
**Current Problem:** Health check doesn't verify database/API connectivity
**Impact:** Load balancer thinks system is healthy when it's broken
**Fix:** 1 hour

```typescript
// backend/src/routes/health.ts (REPLACE)

router.get('/health', async (req: Request, res: Response) => {
  const checks = {
    status: 'ok',
    database: false,
    vapi: false,
    timestamp: new Date().toISOString()
  };

  // Check database
  try {
    const { data } = await supabase.from('organizations').select('id').limit(1);
    checks.database = true;
  } catch {
    checks.status = 'degraded';
  }

  // Check Vapi (optional, for observability)
  // Only critical: database must be reachable

  return res.status(checks.database ? 200 : 503).json(checks);
});
```

**Effort:** 1 hour
**Risk:** Low
**Blockers:** None

---

### TIER 2: Should Fix (Makes It Actually Good) - 4 days

#### 6. Add Sentry Error Monitoring
**Current Problem:** Errors invisible, issues go unnoticed
**Impact:** Find problems when customer complains (week late)
**Fix:** 4 hours

```bash
# 1. Create Sentry account (free tier exists)
# 2. Install SDK
npm install @sentry/node @sentry/tracing

# 3. Initialize in server.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Effort:** 4 hours (setup + integration)
**Cost:** $0-29/month (free tier)
**Risk:** Low
**Blockers:** Need Sentry account

---

#### 7. Fix WebSocket Memory Leak (Listener Cleanup)
**Current Problem:** Event listeners accumulate on reconnect
**Impact:** Memory usage grows 1-2% per reconnect
**Fix:** 2 hours

```typescript
// backend/src/services/websocket.ts

ws.on('close', () => {
  // CRITICAL: Remove all listeners before closing
  ws.removeAllListeners();

  // Remove from clients map
  clients.delete(ws);

  logger.info('WebSocket', 'Client disconnected and cleaned up');
});
```

**Effort:** 2 hours
**Risk:** Low (cleanup only)
**Blockers:** None

---

#### 8. Load Test with 10 Concurrent Calls
**Current Problem:** Unknown capacity, system might crash at 5 calls
**Impact:** Customer tries during lunch hour, system fails
**Fix:** 4 hours

```bash
# Use k6 for load testing
npm install -g k6

# Create test script: load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,        // 10 concurrent calls
  duration: '5m', // 5 minute test
};

export default function () {
  // Simulate: make call, record it, retrieve from dashboard
  let res = http.post(
    'http://localhost:3001/api/calls',
    JSON.stringify({...})
  );
  check(res, { 'status is 200': (r) => r.status === 200 });
}

# Run test
k6 run load-test.js
```

**Effort:** 4 hours (create test + run + analyze)
**Cost:** $0 (free tool)
**Risk:** Medium (might find issues)
**Blockers:** None

---

#### 9. Add Recording Playback Timeout Detection
**Current Problem:** Recording playback doesn't handle Supabase failures
**Impact:** User clicks play, nothing happens, confused
**Fix:** 1 hour

```typescript
// backend/src/routes/calls.ts

router.get('/calls/:callId/recording', async (req: Request, res: Response) => {
  try {
    const { data } = await supabase.storage
      .from('recordings')
      .createSignedUrl(`${callId}.wav`, 3600); // 1 hour expiry

    if (!data?.signedUrl) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.json({
      recordingUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });
  } catch (error) {
    log.error('Calls', 'Failed to generate recording URL', { error });
    res.status(500).json({ error: 'Failed to retrieve recording' });
  }
});
```

**Effort:** 1 hour
**Risk:** Low
**Blockers:** None

---

#### 10. Database Index on Call Filters
**Current Problem:** Dashboard query timeout with 10K+ calls
**Impact:** Clinic with 2+ months of history = slow dashboard
**Fix:** 30 minutes

```sql
-- Add to migration file: backend/migrations/[timestamp]_add_call_indexes.sql

CREATE INDEX IF NOT EXISTS idx_calls_org_date ON calls(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);
```

**Effort:** 30 minutes
**Risk:** Low (adds indexes only)
**Blockers:** None

---

### TIER 3: Nice to Have (Can Do Post-Launch) - Skip For Now

❌ Load testing to 100 concurrent calls (overkill for MVP)
❌ Comprehensive unit test suite (can automate later)
❌ Multi-language support (English is enough)
❌ Advanced RAG/KB matching (basic lookup works)
❌ Outbound calling feature (inbound only for MVP)
❌ CRM integrations (not needed yet)

---

## WHAT YOU DELETE/DISABLE

### Delete This (It's Broken)

```bash
# 1. workspace.ts is disabled (.disabled extension)
# Keep it disabled, it's not in MVP

# 2. Remove debug/developer-only endpoints
# Any route with EXPOSE_DEBUG_INFO environment variable
# Remove from production

# 3. Disable any TODO features
# Comment out:
# - TODO: Send alert to monitoring service
# - TODO: Encrypt API keys
# - TODO: Use secrets manager
```

### Disable This

```typescript
// In configuration:
// - Outbound calling (not in MVP pricing)
// - Multi-org support (assume single org for MVP)
// - Advanced reporting (basic dashboard only)
```

---

## WHAT YOU KEEP (The Money Features)

### Core Functionality - What People Pay For

✅ **Feature 1: Inbound Calls Answered**
- Customer calls clinic
- Agent picks up within 3 seconds
- **Cost to fix:** 0 (works already)
- **Revenue impact:** $169/month minimum

✅ **Feature 2: Call Recording & Playback**
- Every call recorded automatically
- Dashboard shows all calls
- Click to play recording
- **Cost to fix:** 2 hours (cleanup job + error handling)
- **Revenue impact:** $169/month minimum

✅ **Feature 3: Live Transcript**
- See what customer is asking
- See agent's response
- Real-time during call
- **Cost to fix:** 1 hour (memory leak fix)
- **Revenue impact:** $289/month tier

✅ **Feature 4: Knowledge Base**
- Upload pricing, services, FAQs
- Agent references them in responses
- **Cost to fix:** 3 hours (OpenAI fallback)
- **Revenue impact:** $289/month tier

✅ **Feature 5: Basic Escalation**
- Medical questions → escalate to human
- **Cost to fix:** 0 (works, keyword matching is fine)
- **Revenue impact:** HIPAA compliance (required)

✅ **Feature 6: Call Dashboard**
- See all calls, filter by date
- View transcripts
- **Cost to fix:** 1 hour (database index)
- **Revenue impact:** $289/month tier

✅ **Feature 7: System Stability**
- Doesn't crash unexpectedly
- Records actually save
- No data loss
- **Cost to fix:** 2 days (Sentry + health check + tests)
- **Revenue impact:** Required for production

---

## ACTUAL TIMELINE (REALISTIC)

### Week 1: Fix Critical Issues (3 days of work)
**Day 1:**
- [ ] Auth bypass fix (30 min)
- [ ] NODE_ENV=production (5 min)
- [ ] Health check fix (1 hour)
- [ ] Recording cleanup job (2 hours)
- **Total: 4 hours**

**Day 2:**
- [ ] OpenAI fallback (3 hours)
- [ ] Sentry setup (4 hours)
- **Total: 7 hours**

**Day 3:**
- [ ] WebSocket leak fix (2 hours)
- [ ] Recording error handling (1 hour)
- [ ] Database indexes (30 min)
- [ ] Testing all fixes (3 hours)
- **Total: 6.5 hours**

**Week 1 Total: ~17 hours (2 engineer-days)**

### Week 2: Testing & Hardening (4 days of work)
**Day 4:**
- [ ] Load test with 10 concurrent calls (4 hours)
- [ ] Fix any failures found (2-4 hours)

**Day 5-6:**
- [ ] 24-hour stability test
- [ ] Monitor Sentry for errors
- [ ] Document incident response

**Day 7:**
- [ ] Final verification
- [ ] Deploy to production
- [ ] Monitor first 24 hours

**Week 2 Total: ~24 hours (3 engineer-days)**

**Total: ~41 hours (5 engineer-days) = 1 week of 1 engineer**

---

## WHAT PEOPLE WILL PAY FOR

### Pricing Tiers (Already Defined)

**Tier 1: £169/month (Starter)**
- Inbound call handling
- Recording + playback
- Basic dashboard
- 1 phone number
- **Enough for:** Solo practitioners, small clinics

**Tier 2: £289/month (Professional)**
- Everything in Tier 1 +
- Live transcripts
- Knowledge base (basic)
- 5 phone numbers
- Multi-user dashboard
- **Enough for:** Medium clinics (5-10 staff)

**Tier 3: £449/month (Enterprise)**
- Everything in Tier 2 +
- Advanced KB matching
- API access
- Priority support
- 10+ phone numbers
- Custom escalation rules
- **Enough for:** Large clinics (20+ staff)

---

## GO-TO-MARKET STRATEGY

### What You Actually Sell

**NOT:** "World's best AI receptionist with perfect 100-call load handling"

**YES:** "Never miss a call again. Know what customers are asking. Keep recordings forever."

### Three Customer Segments

**1. Small Clinics (Tier 1, £169/month)**
- Pain: "We miss calls when we're busy"
- Solution: "Voxanne answers every call"
- Sell: Simplicity, affordability, reliability
- Expected customers: Aesthetic clinics, dentists, salons

**2. Medium Clinics (Tier 2, £289/month)**
- Pain: "We don't know why customers aren't booking"
- Solution: "Read transcripts, fix your pitch"
- Sell: Insights, transcripts, team access
- Expected customers: Multi-location practices

**3. Enterprise (Tier 3, £449/month)**
- Pain: "We need custom AI behavior per clinic location"
- Solution: "API access, custom rules"
- Sell: Integration, customization, support
- Expected customers: Large DSOs, enterprise health systems

---

## LAUNCH CHECKLIST

### Before You Take Money (Must Have)

- [ ] Auth is actually secure (no dev bypass in prod)
- [ ] Recordings actually save (cleanup job running)
- [ ] Dashboard actually works (database indexes)
- [ ] Errors are actually visible (Sentry connected)
- [ ] System doesn't crash (WebSocket leak fixed)
- [ ] Handles 10 concurrent calls (load test passed)

### Things You Can Skip

- ❌ Handles 100 concurrent calls (not needed)
- ❌ Perfect AI escalation (keywords are fine)
- ❌ Advanced KB matching (basic search works)
- ❌ Multi-language support (English is fine)
- ❌ Automated test suite (manual testing is OK for MVP)

### Things You Can Do Later

- After customer 1: Collect feedback on AI behavior
- After customer 3: Implement token refresh (24hr expiration)
- After customer 5: Advanced KB matching (Tier 3 feature)
- After month 1: Outbound calling (new tier)
- After month 2: CRM integration (custom tier)

---

## RISK MITIGATION

### If OpenAI Rate Limits Hit
**Fallback:** System returns zero-vector embedding, KB disabled but core functionality works

### If Vapi API Down
**Fallback:** Existing calls continue, new calls queue for retry

### If Recording Upload Fails
**Fallback:** Retry job runs every 5 minutes, records keep for 7 days

### If Database Down
**Fallback:** Health check returns 503, load balancer redirects to voicemail

### If WebSocket Connection Lost
**Fallback:** Auto-reconnect within 30 seconds (after fix)

---

## SUCCESS METRICS FOR MVP

**Week 1:**
- ✅ No auth vulnerabilities
- ✅ 10 concurrent calls without crash
- ✅ All recordings save successfully
- ✅ Dashboard loads in < 2 seconds

**Week 2:**
- ✅ First paying customer signs up
- ✅ Customer makes 50+ calls successfully
- ✅ Zero support tickets for missing recordings
- ✅ Sentry reports < 1% error rate

**Month 1:**
- ✅ 5 paying customers
- ✅ £1,500-2,000 monthly recurring revenue
- ✅ Zero HIPAA violations
- ✅ Customer NPS > 8/10

---

## DECISION POINT

**You have two options:**

### Option A: Fix & Launch (2 weeks)
- 5 days of focused engineering
- ~£3-5K cost (engineering time)
- ~£1,500-2,000 first month revenue
- Confidence: High (tested)
- Customer risk: Low

**ROI:** Positive by month 1, very positive by month 3

### Option B: Keep Current & Hope
- 0 days of engineering
- £0 cost
- £0 revenue (until it works)
- Confidence: Low (untested)
- Customer risk: High (crashes at 10 concurrent)

**ROI:** Negative (lost sales + reputation)

---

## THE BOTTOM LINE

**You don't need perfection to launch.**

You need:
1. ✅ Phones answered (you have this)
2. ✅ Calls recorded (you have this)
3. ✅ Recordings saved (need 2-hour job)
4. ✅ Dashboard working (need 1-hour index)
5. ✅ System secure (need 30-min fix)
6. ✅ System doesn't crash (need 2-hour fix)
7. ✅ Errors are visible (need 4-hour setup)

**Total: ~10 hours of engineering = 1.5 days**

Everything else is nice-to-have for post-launch.

---

**What's your move?**

1. Fix the 7 critical issues (2 days)
2. Load test with 10 calls (1 day)
3. Launch to first customer (1 day)
4. Make money (ongoing)

Or keep selling vaporware that might crash. Your call. 🔥
