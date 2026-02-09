# Billing Infrastructure Audit - Senior Developer Handoff

**Project:** Voxanne AI - Prepaid Credit Billing System
**Date:** 2026-02-09
**Status:** Research Phase - 4 Active Agents Deployed
**Handoff To:** Senior Developer
**Handoff From:** Engineering Team Lead

---

## 🎯 MISSION

**Objective:** Conduct a comprehensive senior engineering audit of the entire billing infrastructure across frontend, backend, database, and external service integrations (Stripe, Vapi, Twilio, Supabase).

**Key Focus Areas:**
- **Transaction Boundaries** - Identify all "all or nothing" atomic operations
- **Invisible Logic** - Find gaps between frontend, backend, and database layers
- **Race Conditions** - Concurrent wallet operations and deduplication
- **Money Loss Risks** - Scenarios where the platform loses revenue
- **Data Integrity** - Scenarios where billing data becomes inconsistent

**Engineering Philosophy:**
> "The difference between a developer and an engineer is a developer works with code, an engineer works with invisible logic."

We're not just fixing bugs - we're identifying system-level guarantees and gaps that could cause catastrophic failures in production.

---

## 📋 WHAT WE'VE DONE SO FAR

### Phase 1: Agent Team Analysis (Complete)

**Deployed 3 specialized agents to analyze the billing system:**

1. **failure-mode-analyst** ✅ COMPLETE
   - Analyzed 31 failure scenarios across the entire billing pipeline
   - Identified money loss risks, race conditions, data integrity issues
   - Report location: Available in agent transcript

2. **integration-gap-analyst** ✅ COMPLETE
   - Analyzed 11 integration gaps between services
   - Identified missing reconciliation, monitoring blind spots
   - Report location: Available in agent transcript

3. **transaction-boundary-analyst** ❌ STALLED (>1 hour)
   - Was analyzing atomic operations and transaction guarantees
   - Abandoned due to excessive runtime
   - Manual analysis completed instead

### Phase 2: Direct Code Analysis (Complete)

**Files Analyzed:**
- `backend/src/services/wallet-service.ts` (391 lines)
- `backend/supabase/migrations/20260208_prepaid_credit_ledger.sql` (321 lines)

**Key Findings:**

#### ✅ What's Working Correctly

1. **Atomic RPC Functions**
   - `deduct_call_credits()` - Uses `FOR UPDATE` lock, prevents concurrent deductions
   - `add_wallet_credits()` - Uses `FOR UPDATE` lock, prevents concurrent top-ups
   - Both functions have UNIQUE constraints for idempotency

2. **Fixed-Rate Billing Model**
   - $0.70/minute flat rate (10 credits/minute)
   - All charges calculated in integer pence (no floating point errors)
   - Cost breakdown stored in JSONB for audit trail

3. **Multi-Tenant Isolation**
   - All operations filtered by `org_id`
   - RLS policies enforcing data boundaries

#### ❌ Critical Issues Identified

**8 P0 Issues Found** (17.5 hours total fix effort):

| Issue | Impact | Effort |
|-------|--------|--------|
| P0-1: Stripe webhook not transactional | Money loss | 1 hour |
| P0-2: Auto-recharge 5x charge | Customer overcharge | 2 hours |
| P0-3: No debt limit | Unlimited negative balance | 30 min |
| P0-4: Stripe reconciliation missing | Lost revenue | 4 hours |
| P0-5: Vapi reconciliation missing | Lost revenue | 6 hours |
| P0-6: No billing monitoring | Silent failures | 1 hour |
| P0-7: Duplicate checkout creation | Double charges | 2 hours |
| P0-8: Ambiguous duplicate flag | Debugging confusion | 1 hour |

Detailed implementation plans for all 8 fixes are in the plan file.

### Phase 3: Documentation Research (IN PROGRESS)

**Current Phase:** Before implementing fixes, we're researching official vendor documentation to ensure our approaches follow best practices.

**Why This Matters:**
- Stripe has specific recommendations for webhook processing
- Vapi has documented retry behavior we need to account for
- PostgreSQL has advisory lock patterns we should follow
- Supabase has connection pooling considerations

---

## 🤖 ACTIVE AGENT TEAM (4 Agents Deployed)

### Research Team Status

All 4 agents are currently searching official vendor documentation:

#### 1. **stripe-docs-researcher** 🟣 (Purple)
**Researching:**
- Webhook best practices (sync vs async processing)
- Payment reconciliation APIs (polling for missed webhooks)
- Idempotency key patterns (preventing duplicate charges)
- Webhook retry policy (HTTP status codes, timing)
- Checkout Session deduplication

**Search Queries Approved:**
- "Stripe API webhooks best practices 2026 return 200 before processing"
- "Stripe webhook signature verification idempotency keys 2026 stripe.com/docs"
- "Stripe payment reconciliation polling API missed webhooks 2026"
- "Stripe Checkout Session idempotency prevent duplicate charges 2026"
- "Stripe webhook retry policy HTTP status codes dead letter queue 2026"

#### 2. **vapi-docs-researcher** 🟠 (Orange)
**Researching:**
- Webhook lifecycle (call.started, call.ended events)
- Webhook retry behavior (what happens on failure)
- Call reconciliation APIs (listing calls for missed webhooks)
- Billing cost structures and metadata

**Search Queries Approved:**
- "Vapi API webhooks call.started call.ended 2026 documentation"
- "Vapi API webhook retry behavior failure handling 2026"
- "Vapi API call reconciliation billing costs 2026 docs.vapi.ai"

#### 3. **supabase-docs-researcher** 🩷 (Pink)
**Researching:**
- PostgreSQL advisory locks (`pg_try_advisory_xact_lock`)
- RPC function transaction handling
- Row-level locking patterns (`FOR UPDATE`, `SKIP LOCKED`)
- Idempotency with `ON CONFLICT` clauses
- Connection pooling (transaction mode vs session mode)

**Search Queries Approved:**
- "PostgreSQL advisory locks pg_try_advisory_xact_lock best practices 2026"
- "Supabase RPC functions transactions SECURITY DEFINER 2026 docs"
- "PostgreSQL row level locking FOR UPDATE SKIP LOCKED best practices 2026"
- "PostgreSQL idempotency patterns ON CONFLICT DO NOTHING 2026"
- "Supabase Pooler transaction mode vs session mode connection pooling 2026"

#### 4. **twilio-docs-researcher** 🩵 (Cyan)
**Researching:**
- SMS StatusCallback webhooks (delivery confirmation)
- Webhook retry behavior (failure scenarios)
- Webhook signature verification (security)
- SMS delivery failure handling

**Search Queries Approved:**
- "Twilio SMS StatusCallback webhook delivery confirmation 2026"
- "Twilio webhook retry behavior failure handling 2026 docs"
- "Twilio webhook signature verification security 2026 twilio.com/docs"

---

## 📊 WHAT EACH FIX WILL VALIDATE

Once research completes, each P0 fix will be cross-referenced against official documentation:

### P0-1: Stripe Webhook Processing
**Current Approach:** Move processing to background queue, return 200 immediately
**Need to Verify:**
- Does Stripe recommend sync or async webhook processing?
- What's the timeout before Stripe considers webhook failed?
- Should we return 200 before or after processing?
- What HTTP status codes trigger retries?

### P0-2: Auto-Recharge Deduplication
**Current Approach:** Advisory lock before creating Stripe Checkout Session
**Need to Verify:**
- Does Stripe have built-in idempotency for Checkout Sessions?
- Should we use `idempotency_key` parameter?
- What's the correct deduplication window (5 minutes? 1 hour?)?

### P0-3: Debt Limit Enforcement
**Current Approach:** Check balance in RPC function before allowing negative
**Need to Verify:**
- Best practices for balance checks in concurrent environments
- Should we use `SKIP LOCKED` to avoid deadlocks?
- How to handle race conditions between balance check and deduction?

### P0-4: Stripe Payment Reconciliation
**Current Approach:** Scheduled job polling Stripe API for completed payments
**Need to Verify:**
- Official Stripe reconciliation APIs and patterns
- How to handle `payment_intent.succeeded` events we missed
- Rate limits and pagination for large result sets

### P0-5: Vapi Call Reconciliation
**Current Approach:** Scheduled job polling Vapi API for completed calls
**Need to Verify:**
- Vapi call listing API and filtering options
- How reliable are Vapi webhooks (do we even need reconciliation)?
- Cost calculation from Vapi API responses

### P0-6: Billing Success Rate Monitoring
**Current Approach:** Track webhook processing failures, alert on <95%
**Need to Verify:**
- Industry standard success rate thresholds
- What to monitor (webhook delivery vs processing vs billing completion)

### P0-7: Duplicate Checkout Creation
**Current Approach:** Use Stripe idempotency keys
**Need to Verify:**
- Correct idempotency key format and generation
- Idempotency key lifetime and expiration
- What happens if two requests use same key?

### P0-8: Duplicate Flag Clarity
**Current Approach:** Return explicit boolean + metadata
**Need to Verify:**
- PostgreSQL `ON CONFLICT` error handling patterns
- Best practices for idempotency responses

---

## 🚀 YOUR MISSION: CONTINUE THE RESEARCH & IMPLEMENTATION

### Immediate Next Steps (Today)

#### Step 1: Monitor Agent Research (30-60 minutes)

The 4 research agents are actively searching documentation. You need to:

1. **Wait for agents to complete** - They should finish within 15-30 minutes
2. **Review their findings** - Each agent will send a message with research summary
3. **Identify conflicts** - Note any findings that contradict our proposed fixes

**How to Check Agent Status:**
```bash
# Agents will send messages when they complete
# You'll see teammate messages in the Claude Code interface
# Each agent has a color: Purple (Stripe), Orange (Vapi), Pink (Supabase), Cyan (Twilio)
```

#### Step 2: Validate P0 Fixes Against Documentation (2-3 hours)

Once all research completes:

1. **Cross-reference each P0 fix** with official vendor recommendations
2. **Update implementation plans** based on documentation findings
3. **Add documentation citations** to each fix (e.g., "Per Stripe docs: https://...")
4. **Flag any approaches that don't match best practices**

**Output:** Updated plan file with documentation-verified approaches

#### Step 3: Prioritize Implementation Order (30 minutes)

Based on:
- **Money loss risk** (P0-1, P0-4, P0-5 are highest priority)
- **Implementation dependencies** (P0-1 must complete before P0-4)
- **Effort vs impact** (P0-3 is 30 minutes for unlimited debt protection)

**Recommended Order:**
1. P0-1: Webhook transactionality (unblocks P0-4, P0-5)
2. P0-3: Debt limit (quick win, high impact)
3. P0-2: Auto-recharge dedup (customer-facing issue)
4. P0-4: Stripe reconciliation (revenue recovery)
5. P0-5: Vapi reconciliation (revenue recovery)
6. P0-7: Checkout dedup (edge case, but critical)
7. P0-6: Monitoring (observability)
8. P0-8: Duplicate flag (developer experience)

#### Step 4: Begin Implementation (Remaining Time)

Start with P0-1 (webhook transactionality):
- **File to modify:** `backend/src/routes/billing-api.ts`
- **Changes needed:** Move webhook processing to BullMQ queue
- **Testing:** Simulate webhook failures, verify retries work
- **Rollout:** Deploy behind feature flag, test with 1 org first

---

## 📁 KEY FILES & LOCATIONS

### Billing Implementation Files

```
backend/src/
├── services/
│   ├── wallet-service.ts          # Core wallet operations (391 lines)
│   ├── stripe-service.ts          # Stripe API integration
│   └── billing-manager.ts         # Billing orchestration
├── routes/
│   ├── billing-api.ts             # Stripe webhook endpoint
│   └── wallet-api.ts              # Wallet API endpoints
└── config/
    └── billing-queue.ts           # BullMQ job queue (if exists)

backend/supabase/migrations/
└── 20260208_prepaid_credit_ledger.sql  # Database schema (321 lines)

frontend/src/app/dashboard/wallet/
└── page.tsx                       # Wallet UI (top-up, history)
```

### Documentation & Planning

```
/Users/mac/.claude/plans/
└── elegant-marinating-kurzweil.md  # Main plan file (updated continuously)

/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/
├── BILLING_AUDIT_HANDOFF.md       # This file
├── .claude/CLAUDE.md              # Project context & PRD
└── .agent/senior engineer prompt.md  # Engineering philosophy
```

### Agent Team Files

```
~/.claude/teams/billing-infrastructure-audit/
└── config.json                    # Team configuration

~/.claude/tasks/billing-infrastructure-audit/
└── [task files]                   # Agent task tracking
```

---

## 🎓 ENGINEERING PRINCIPLES TO FOLLOW

### 1. Transaction Boundaries
**Question to ask:** "If this operation fails halfway through, what's the worst that can happen?"

**Examples:**
- ✅ GOOD: RPC function with `FOR UPDATE` lock - atomic at database level
- ❌ BAD: Webhook processes data, then writes to DB - can fail between steps

### 2. Idempotency
**Question to ask:** "What happens if this operation runs twice with the same input?"

**Examples:**
- ✅ GOOD: `UNIQUE(org_id, vapi_call_id)` constraint - database prevents duplicates
- ❌ BAD: Check if exists, then insert - race condition between check and insert

### 3. Money Loss vs Data Integrity
**Priority:** Fix money loss bugs first, data integrity bugs second

**Examples:**
- 🔴 CRITICAL: Missed webhook = lost revenue (money loss)
- 🟡 HIGH: Duplicate charge = customer anger (data integrity)
- 🟢 MEDIUM: Slow query = bad UX (performance)

### 4. Reconciliation
**Question to ask:** "If webhooks fail for 24 hours, can we recover?"

**Examples:**
- ✅ GOOD: Scheduled job polls Stripe API for payments from last 7 days
- ❌ BAD: Rely only on webhooks with no fallback

### 5. Monitoring
**Question to ask:** "How will we know if this breaks in production?"

**Examples:**
- ✅ GOOD: Alert if webhook processing success rate <95%
- ❌ BAD: Wait for customer complaints

---

## 🔧 COMMANDS & SCRIPTS

### Run Backend Tests
```bash
cd backend
npm run test:unit -- wallet-service.test.ts
npm run test:integration -- billing.test.ts
```

### Check Database Schema
```bash
# Connect to Supabase
supabase db remote commit

# List RPC functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%credit%';
```

### Monitor Agent Team
```bash
# Check team status
cat ~/.claude/teams/billing-infrastructure-audit/config.json

# View agent tasks
ls ~/.claude/tasks/billing-infrastructure-audit/
```

### Deploy Migration
```bash
cd backend
supabase db push  # Push local migrations to remote
supabase db reset # Reset local DB (dev only)
```

---

## 📞 ESCALATION & SUPPORT

### If Agents Don't Complete
**Symptoms:** Agents run for >30 minutes without reporting back

**Action:**
1. Check agent status: Look for error messages in Claude Code interface
2. Stop stalled agents: Message them to stop or create new agents
3. Manual fallback: Read documentation directly using WebFetch tool

**Example:**
```typescript
// If stripe-docs-researcher stalls, do this:
WebFetch({
  url: "https://stripe.com/docs/webhooks/best-practices",
  prompt: "Extract webhook processing recommendations: sync vs async, return timing, retry policy"
})
```

### If Implementation Blocked
**Symptoms:** Documentation contradicts our approach, unclear how to proceed

**Action:**
1. Document the conflict in plan file
2. Ask user for guidance: "Stripe recommends X, but our approach is Y. Which should we follow?"
3. Default to vendor recommendations if user unavailable

### If Tests Fail
**Symptoms:** Unit tests fail after implementing fixes

**Action:**
1. Check if failure is in new code or existing code
2. If new code: Fix and re-test
3. If existing code: Document as separate issue, don't block current fixes

---

## ✅ SUCCESS CRITERIA

You'll know you're done when:

1. **Research Complete:**
   - ✅ All 4 agents reported back with documentation findings
   - ✅ Each P0 fix validated against vendor best practices
   - ✅ Plan file updated with documentation citations

2. **Implementation Complete:**
   - ✅ All 8 P0 fixes deployed to staging
   - ✅ All unit tests passing (>95% coverage)
   - ✅ Integration tests passing (webhook retries, reconciliation)
   - ✅ Manual testing complete (simulate failures, verify recovery)

3. **Monitoring Active:**
   - ✅ Alerts configured for webhook failures
   - ✅ Dashboard showing billing success rate
   - ✅ Reconciliation jobs running on schedule

4. **Documentation Complete:**
   - ✅ Implementation notes in plan file
   - ✅ Runbook for billing incidents
   - ✅ Monitoring playbook (what alerts mean, how to respond)

---

## 📖 BACKGROUND READING

Before starting, read these files to understand context:

1. **`.claude/CLAUDE.md`** (5000+ lines)
   - Complete project history and architecture
   - All 10 production priorities completed (monitoring, security, HIPAA, etc.)
   - Disaster recovery plan and operational runbook

2. **`.agent/senior engineer prompt.md`**
   - Engineering philosophy: "invisible logic" vs code
   - Transaction boundary thinking
   - System-level guarantee analysis

3. **Plan file: `elegant-marinating-kurzweil.md`**
   - Current P0 issue details
   - Implementation plans for all 8 fixes
   - Agent research findings (once complete)

---

## 🎯 FINAL INSTRUCTIONS

**Your immediate tasks:**

1. ✅ **Wait for agents to complete** (15-30 min) - Monitor for their reports
2. ✅ **Review documentation findings** (30 min) - Cross-reference with P0 fixes
3. ✅ **Update implementation plans** (1 hour) - Add vendor best practices
4. ✅ **Begin implementation** (Remaining time) - Start with P0-1 (webhooks)

**Remember:**
- Don't implement blindly - validate against official documentation first
- Prioritize money loss fixes over data integrity fixes
- Test each fix in isolation before deploying multiple fixes
- Document everything - future engineers will thank you

**Questions?**
- Check the plan file first
- Search official vendor documentation
- Ask the original engineering team if blocked

---

**Good luck! The billing system's integrity is in your hands.** 🚀

---

**Handoff Complete**
**Date:** 2026-02-09
**Agent Team:** billing-infrastructure-audit (4 active researchers)
**Next Review:** After implementation of P0-1 through P0-3
