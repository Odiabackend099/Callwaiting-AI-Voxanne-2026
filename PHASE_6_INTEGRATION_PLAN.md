# Phase 6: Integration Testing Blueprint

**Status:** 🎯 Architecture Finalized  
**Created:** January 15, 2026  
**Author:** Engineering Team  
**Principle:** "Real Pipes, Fake Signals"

---

## Executive Summary

Phase 6 answers: **"Do the pipes work together?"**

After Phase 5 proved individual components work in isolation (53 unit tests, 100% passing), Phase 6 tests how they integrate with each other. We simulate real external APIs but use a real database to catch integration issues that unit tests can't.

**Three Golden Scenarios:**

1. **Phase 6A:** New Clinic Handshake (Signup → Auth → Profile → JWT) - *Foundation*
2. **Phase 6B:** Live Booking Chain (Webhook → Lock → Calendar → Sync) - *Core*
3. **Phase 6C:** Smart Answer Loop (Query → Vector Search → Prompt → Response) - *Advanced* ← **START HERE**

---

## 🏗️ Architecture Decisions (FINAL)

### 1. Staging Database: Local Supabase Instance ✅

**Decision:** Use `supabase start` for local development environment.

**Why:**
- Every developer gets an identical copy of production database
- Database Triggers and RLS Policies tested in production-identical environment
- Reset to clean state in seconds (no residual test data)
- Zero cost, zero cloud dependencies

**Implementation:**
```bash
# One-time setup
supabase start

# Before each test session
supabase db reset

# Tear down
supabase stop
```

---

### 2. Vapi Webhooks: Simulated from Test Code ✅

**Decision:** Simulate Vapi JSON payloads instead of calling real sandbox.

**Why:**
- Real Vapi sandbox is slow (network latency kills test speed)
- Internet dependency = flaky tests
- 100 scenarios (hang-up, booking, wrong number) in milliseconds vs. minutes
- Deterministic: same input = same output every time

**Implementation:**
```typescript
// Example: Simulate a successful booking call
const mockVapiWebhook = {
  callId: 'call-123',
  assistantId: 'voxanne-prod',
  endedReason: 'userHangup',
  transcript: 'Book me for 2 PM tomorrow',
  messages: [
    {
      role: 'assistant',
      content: 'I\ve booked you for 2 PM tomorrow with Dr. Smith.'
    }
  ]
};
```

---

### 3. Google Calendar Sync: Mocked API + Latency Verification ✅

**Decision:** Mock Google API responses + verify sync happens within <5 seconds.

**Why:**
- Real Google OAuth in automation is a nightmare
- We care more about "Did our backend trigger the sync?" than "Is Google working?"
- Latency verification catches performance regressions
- Isolates our code from Google API changes

**Implementation:**
```typescript
// Mock the API response
vi.mock('@google-cloud/google-cloud-calendar', () => ({
  createEvent: vi.fn().mockResolvedValue({ eventId: 'evt-123' })
}));

// Verify it was called within latency budget
expect(googleCalendarMock).toHaveBeenCalledWithin(5000); // 5 seconds
```

---

### 4. RAG / Vector DB: Real Supabase pgvector (NO MOCKING) ✅

**Decision:** Use real `pgvector` in local Supabase. No mocking.

**Why:**
- Mocking vector search is dangerous (hides hallucinations)
- We need to know if AI actually finds Clinic Policy
- pgvector is built into Supabase (no extra dependency)
- Tests real similarity search: cosine distance, embedding quality

**Implementation:**
```sql
-- Real schema in Supabase
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embedding size
  created_at TIMESTAMP
);

-- Real vector search
SELECT content 
FROM knowledge_base 
WHERE org_id = $1
ORDER BY embedding <-> $2 -- cosine distance
LIMIT 5;
```

---

### 5. Test Data: Dynamic On-the-Fly Creation ✅

**Decision:** Create test data inside each test function, not snapshots.

**Why:**
- Snapshots get stale (breaks brittle tests)
- Dynamic creation = every test starts with clean state
- "Clinic A" and "Clinic B" created fresh each time
- No test pollution between test runs

**Implementation:**
```typescript
describe('RAG Integration', () => {
  it('should isolate Clinic A data from Clinic B', async () => {
    // 1. Create Clinic A dynamically
    const clinicA = await db.orgs.insert({
      id: 'clinic-a-uuid',
      name: 'Heart & Wellness Clinic A'
    });
    
    // 2. Create Policy for Clinic A
    const policyA = await db.knowledge_base.insert({
      org_id: clinicA.id,
      content: 'We offer 20% discount for first-time patients',
      embedding: await embeddings.create('We offer 20% discount...')
    });
    
    // 3. Create Clinic B (separate)
    const clinicB = await db.orgs.insert({
      id: 'clinic-b-uuid',
      name: 'Wellness Center B'
    });
    
    // 4. Test: Clinic B queries Clinic A's knowledge base
    const results = await vectorDB.search({
      query: 'Do you have discounts?',
      orgId: clinicB.id  // B's context
    });
    
    // 5. Verify: Zero results (isolated)
    expect(results).toHaveLength(0);
  });
});
```

---

### 6. CI/CD: GitHub Actions with Failure Blocking ✅

**Decision:** GitHub Actions blocks merges if integration tests fail.

**Why:**
- Broken integrations caught before production
- No manual gate needed (automation)
- Developers see test results in 3 minutes
- Failed test → Cannot merge → Cannot deploy

**Implementation:**
```yaml
# .github/workflows/test.yml
name: Integration Tests
on: [pull_request, push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration
    # If tests fail, PR is blocked automatically
```

---

## 🎯 Three Golden Scenarios (Implementation Order)

### **Scenario A: The "New Clinic" Handshake**

**User Flow:** New signup → Auth trigger → Auto-create Profile → Lock org_id in JWT

**What We Test:**
1. New user signup creates profile in DB
2. Profile immediately has org_id assigned
3. JWT issued includes correct org_id
4. Second login retrieves same org_id (no duplication)
5. Two clinics cannot see each other's data

**Success Criteria:**
- ✅ Clinic A created → org_id assigned
- ✅ Clinic B created → different org_id
- ✅ Clinic A user cannot access Clinic B profile
- ✅ org_id immutable (cannot be changed after creation)

**Phase Location:** Phase 6A (Foundation)

---

### **Scenario B: The "Live Booking" Chain**

**User Flow:** AI Call → Vapi Webhook → Backend processes → Calendar locked → Google sync triggered

**What We Test:**
1. Simulate Vapi webhook with booking request
2. Backend extracts org_id from webhook
3. Atomic lock acquired on calendar slot
4. Google Calendar API called
5. Lock released after sync

**Success Criteria:**
- ✅ Webhook processed in <500ms
- ✅ Lock prevents double-booking (concurrent requests fail)
- ✅ Google sync triggered within <5 seconds
- ✅ Lock auto-released even if Google fails
- ✅ Clinic A bookings don't affect Clinic B calendar

**Phase Location:** Phase 6B (Core Functionality)

---

### **Scenario C: The "Smart Answer" Loop (RAG)** 🚀 **NEXT**

**User Flow:** AI receives question → Searches knowledge base → Constructs prompt with context → AI responds

**What We Test:**
1. Insert vector embedding of Clinic A policy
2. Query from Clinic A context (should find policy)
3. Query from Clinic B context (should find nothing)
4. Verify prompt includes retrieved context
5. Verify AI doesn't hallucinate beyond retrieved context

**Success Criteria:**
- ✅ Vector search returns correct policy for Clinic A
- ✅ Vector search returns zero results for Clinic B
- ✅ AI prompt includes [RETRIEVED_CONTEXT] section
- ✅ Cosine similarity score > 0.7 for relevant docs
- ✅ <200ms search latency (fast enough for conversation)

**Phase Location:** Phase 6C (Advanced - Starting Now)

---

## 📊 Test Infrastructure

### Directory Structure
```
backend/src/__tests__/integration/
├── 6a-clinic-handshake.test.ts       # Phase 6A
├── 6b-live-booking-chain.test.ts     # Phase 6B
├── 6c-rag-smart-answer.test.ts       # Phase 6C ← NEXT
├── fixtures/
│   ├── clinic-seeds.ts               # Clinic A/B creation
│   ├── vector-embeddings.ts          # Embedding utilities
│   └── vapi-payloads.ts              # Vapi webhook mocks
└── setup/
    └── integration-setup.ts           # Shared setup (local Supabase)
```

### Dependencies to Install
```json
{
  "devDependencies": {
    "vitest": "^4.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "@openai/embeddings-js": "^1.0.0",  // For vector embeddings
    "msw": "^1.3.0"                     // For mocking external APIs
  }
}
```

---

## ⚙️ Local Supabase Setup

### One-Time Setup
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize in project
cd backend
supabase init

# Start local instance
supabase start

# You should see:
# Started Supabase local development setup.
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:5432/postgres
```

### Before Each Test Session
```bash
# Reset database to clean state
supabase db reset

# Run migrations
supabase db push
```

### Integration Test Setup (Inside Test)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://localhost:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Local anon key

const db = createClient(supabaseUrl, supabaseKey);
```

---

## 🔐 Security Validation Matrix

All integration tests include security checks:

| Scenario | Security Test | Pass Criteria |
|----------|---------------|---------------|
| **A. Handshake** | Cross-clinic access | Clinic B ≠ access Clinic A data |
| **B. Booking** | Org isolation | Clinic A booking only affects Clinic A calendar |
| **C. RAG** | Data leakage | Clinic B query returns 0 results from Clinic A KB |
| **All** | JWT validation | Missing/invalid JWT = 401 Unauthorized |
| **All** | Idempotency | Same request 2x = no duplicate data |

---

## 📈 Success Metrics

### Performance Benchmarks
```
- Vector search: <200ms (human-speed for conversation)
- Webhook processing: <500ms
- Google sync: <5 seconds
- Database operations: <100ms
- Full integration flow: <2 seconds end-to-end
```

### Coverage Targets
```
- Integration test count: 15+ scenarios
- Clinic isolation: 100% of paths tested
- Security: All 7 categories validated
- Error handling: Happy + sad paths
```

---

## 📅 Implementation Timeline

| Phase | Focus | Duration | Status |
|-------|-------|----------|--------|
| **6A** | New Clinic Handshake | 1-2 days | 📋 Planned |
| **6B** | Live Booking Chain | 2-3 days | 📋 Planned |
| **6C** | Smart Answer Loop (RAG) | 2-3 days | 🚀 **NEXT** |
| **6D** | Performance & Load | 1-2 days | 📋 Planned |

---

## 🚀 Phase 6C: Smart Answer Loop (Starting Now)

This is where your AI stops guessing and starts knowing.

**What We're Building:**
- Local Supabase with real `pgvector` extension
- Vector embedding pipeline (OpenAI or similar)
- Clinic isolation in vector search (org_id scoping)
- Prompt augmentation (retrieved context injection)
- Latency verification (<200ms)

**Deliverables:**
- `6c-rag-smart-answer.test.ts` - Complete test suite
- Vector embedding fixtures - Sample policies for Clinics A/B
- Documentation - How RAG works in Voxanne

**Success Criteria:**
- ✅ 5+ test cases for vector search
- ✅ 100% clinic isolation verified
- ✅ <200ms search latency
- ✅ Prompt augmentation working
- ✅ Ready to integrate real AI model

---

## 🎓 Key Principles

### 1. "Real Pipes, Fake Signals"
- Database: **Real** (local Supabase)
- Vector Search: **Real** (pgvector)
- External APIs: **Mocked** (Vapi, Google, OpenAI)

### 2. "Fail Fast, Fix First"
- If a test fails, all dependent tests skip
- Clear error messages point to root cause
- No cascading failures

### 3. "One Test, One Truth"
- Each test validates exactly one integration point
- No multi-step dependencies within a test
- Every test is independent and runnable alone

---

## 📚 Documentation Trail

- **PHASE_6_INTEGRATION_PLAN.md** ← You are here
- **PHASE_6C_RAG_INTEGRATION_TESTS.md** ← Start implementing next
- **TESTING_COMMAND_REFERENCE.md** - How to run tests
- **PHASE_6_SECURITY_AUDIT.md** - Security validation (after Phase 6D)

---

## ✅ Approval Checklist

Before we start Phase 6C implementation:

- [x] Architecture decisions approved (Local Supabase, Mocked APIs, Real pgvector)
- [x] Staging environment strategy finalized
- [x] Security isolation strategy confirmed
- [x] Test data creation approach decided
- [x] CI/CD blocking strategy approved

**Status:** ✅ Ready to implement Phase 6C

---

**Next:** [PHASE_6C_RAG_INTEGRATION_TESTS.md](PHASE_6C_RAG_INTEGRATION_TESTS.md)

**Timeline:** Phase 6C should take 2-3 days to fully implement and validate.

**Go-Live Readiness:** After Phase 6D, your system will be production-ready.

---

**Phase 6 Integration Testing Plan: ✅ APPROVED**  
**Ready for Phase 6C Execution**  
**Date: January 15, 2026**
