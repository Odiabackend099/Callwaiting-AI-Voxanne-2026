# 🚀 PHASE 6C: START HERE - Smart Answer Loop (RAG Integration)

**Status:** ✅ READY TO IMPLEMENT  
**Date:** January 15, 2026  
**Priority:** 🔴 CRITICAL (Prevents hallucination, ensures accuracy)  
**Duration:** 2-3 days  

---

## What is Phase 6C?

Phase 6C tests the **Smart Answer Loop** - the RAG (Retrieval Augmented Generation) pipeline that makes your AI answer with verified clinic data instead of hallucinating.

### The Problem It Solves

**WITHOUT RAG:**
```
Caller: "Do you have a pediatrics department?"
AI: "Yes, we do! We have board-certified pediatricians on staff 
    with 15 years of experience specializing in neonatal care..."
    
(This clinic has NO pediatrics - AI just made it up!)
```

**WITH RAG (Phase 6C):**
```
Caller: "Do you have a pediatrics department?"
AI searches clinic KB: (zero results)
AI responds: "I don't have information about a pediatrics department 
            in my database. Let me connect you with an operator..."
```

### Why Phase 6C First?

1. **Lowest dependency** - Only requires Supabase + pgvector
2. **Highest risk** - Hallucination is #1 production failure
3. **Fastest to validate** - Vector operations are deterministic
4. **Most valuable** - Proves RAG works = AI quality locked in

---

## 🎯 What Gets Tested (5 Core Tests)

| Test | What | Success Criteria |
|------|------|-----------------|
| **Test 1** | Vector search finds policies | Returns matching policy with similarity > 0.7 |
| **Test 2** | Clinic isolation in vectors | Clinic B sees ZERO results from Clinic A KB |
| **Test 3** | Search latency | Completes in < 200ms |
| **Test 4** | Prompt augmentation | AI prompt includes [CONTEXT] section |
| **Test 5** | Hallucination prevention | AI refuses to answer without KB data |

---

## 📊 Architecture: "Real Pipes, Fake Signals"

```
┌─────────────────────────────────────────┐
│  REAL (Production-Grade)                │
│  • Local Supabase Database              │
│  • pgvector extension enabled           │
│  • Real vector embeddings               │
│  • Real cosine similarity scoring       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SIMULATED (Test-Grade)                 │
│  • OpenAI embeddings (real API)         │
│  • Can be mocked if quota limited       │
└─────────────────────────────────────────┘

Result:
✅ Tests realistic vector search behavior
✅ No flaky network calls
✅ 100% reproducible
❌ No external vector DB needed (Pinecone, Weaviate)
```

---

## 🔧 Getting Started (3 Steps)

### Step 1: Start Local Supabase

```bash
# Install CLI (one-time)
brew install supabase/tap/supabase

# Start local DB
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
supabase start

# Should output:
# API URL: http://localhost:54321
# DB Connection: postgresql://postgres:postgres@localhost:54321/postgres
# JWT Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Install Dependencies

```bash
npm install --save-dev @supabase/supabase-js openai msw

# Verify
npm list @supabase/supabase-js openai msw
```

### Step 3: Create Test File

**File:** `backend/src/__tests__/integration/6c-rag-smart-answer.test.ts`

See full implementation in [PHASE_6C_RAG_INTEGRATION_TESTS.md](PHASE_6C_RAG_INTEGRATION_TESTS.md)

```bash
# Run tests
npm run test:6c

# Expected output:
# ✓ Test 1: Vector search finds policies
# ✓ Test 2: Clinic isolation verified
# ✓ Test 3: Latency < 200ms
# ✓ Test 4: Prompt augmentation works
# ✓ Test 5: Hallucination prevented
# 
# 5 passed in 25ms
```

---

## 📁 File Structure Created

```
backend/src/__tests__/integration/
├── setup/
│   └── integration-setup.ts          ← Supabase connection, helpers
├── fixtures/
│   ├── clinic-seeds.ts              ← Create test clinics
│   ├── vector-embeddings.ts         ← Generate embeddings
│   └── prompt-helpers.ts            ← Build RAG prompts
└── 6c-rag-smart-answer.test.ts      ← THE 5 TESTS (START HERE)

PHASE_6_INTEGRATION_PLAN.md          ← Master blueprint
PHASE_6C_RAG_INTEGRATION_TESTS.md    ← Full specifications
PHASE_6C_START_HERE.md               ← This file
```

---

## 🎓 Core Concept: Vector Embeddings

**What:** Converting text to mathematical vectors (arrays of numbers)

**Example:**
```
Policy: "We offer 20% discount for new patients"
         ↓ (OpenAI embedding)
Vector: [0.1, -0.2, 0.8, ..., 0.5]  (1536 dimensions)

Question: "Do you have discounts?"
         ↓ (Same model)
Vector: [0.15, -0.19, 0.78, ..., 0.48]  (similar to policy!)

Similarity = Cosine Distance
Similarity > 0.7 = "These are related!"
```

**pgvector:** PostgreSQL extension that stores + searches vectors efficiently

```sql
-- Create table with vector column
CREATE TABLE knowledge_base (
  id UUID,
  content TEXT,
  embedding vector(1536)  -- OpenAI embedding size
);

-- Search with cosine distance
SELECT content 
FROM knowledge_base
WHERE (1 - (embedding <=> query_vector)) > 0.7
ORDER BY embedding <=> query_vector
LIMIT 5;
```

---

## 🧪 Test Pattern Explained

### Test 1: Vector Search Works

```typescript
// Seed: Create clinic with policy
const clinic = await seedClinic({ name: 'Clinic A' });

// Embed: Convert policy text to vector
const policyEmbedding = await openai.embeddings.create({
  input: "We offer 20% discount for new patients",
  model: "text-embedding-3-small"
});

// Store: Insert into pgvector
await db.knowledge_base.insert({
  org_id: clinic.id,
  content: "We offer 20% discount for new patients",
  embedding: policyEmbedding.data[0].embedding
});

// Query: Convert user question to vector
const queryEmbedding = await openai.embeddings.create({
  input: "Do you have discounts?",
  model: "text-embedding-3-small"
});

// Search: Find matching policies
const results = await db.rpc('rag_search', {
  org_id: clinic.id,
  query_embedding: queryEmbedding.data[0].embedding,
  similarity_threshold: 0.7
});

// Assert: Found it!
expect(results[0].content).toContain("20% discount");
```

### Test 2: Clinic Isolation

```typescript
// Create TWO separate clinics
const clinicA = await seedClinic({ name: 'Clinic A' });
const clinicB = await seedClinic({ name: 'Clinic B' });

// Insert policy ONLY in Clinic A
await db.knowledge_base.insert({
  org_id: clinicA.id,  // ← CLINIC A
  content: "We offer 20% discount",
  embedding: embedding
});

// Query FROM Clinic B
const results = await db.rpc('rag_search', {
  org_id: clinicB.id,  // ← CLINIC B
  query_embedding: query_embedding,
  threshold: 0.7
});

// Assert: Clinic B sees NOTHING from Clinic A
expect(results).toHaveLength(0);
```

This is **security critical** - prevents data leakage between clinics.

### Test 3: Latency Performance

```typescript
const startTime = performance.now();

const results = await db.rpc('rag_search', {
  org_id: clinic.id,
  query_embedding: embedding,
  threshold: 0.7
});

const latency = performance.now() - startTime;

// Assert: Must be fast (conversation speed)
expect(latency).toBeLessThan(200);  // milliseconds
```

Why 200ms? During a live call, if search takes 2 seconds, the AI goes silent for 2 seconds. Users hang up.

### Test 4: Prompt Augmentation

```typescript
// Get retrieved context
const retrievedContext = [
  "We offer 20% discount for new patients",
  "Office hours: 9 AM - 5 PM"
];

// Build prompt with context section
const prompt = `
You are an AI assistant for ${clinic.name}.

User Question: ${userQuestion}

[CONTEXT]
${retrievedContext.map(r => r.content).join('\n')}
[END_CONTEXT]

Instructions:
- ONLY answer based on the context above.
- Never invent information.
`;

// Assert: Prompt includes context
expect(prompt).toContain("[CONTEXT]");
expect(prompt).toContain("20% discount");
expect(prompt).toContain("[END_CONTEXT]");
```

### Test 5: Hallucination Prevention

```typescript
// Ask about something NOT in KB
const question = "Do you have pediatrics?";

// Query returns ZERO results
const results = await db.rpc('rag_search', {
  org_id: clinic.id,
  query_embedding: query_embedding,
  threshold: 0.7
});

expect(results).toHaveLength(0);

// Prompt should include fallback:
expect(prompt).toContain("don't have that information");

// This instructs AI:
// "If KB is empty, tell user you don't know"
```

---

## 📈 Success Metrics

After Phase 6C:

- ✅ **5/5 tests passing** (100%)
- ✅ **Clinic isolation verified** (Clinic B cannot access Clinic A vectors)
- ✅ **Latency < 200ms** (confirmed in performance test)
- ✅ **Hallucination prevention** (AI uses ONLY KB data)
- ✅ **Test coverage** (RAG pipeline documented + tested)

**Go/No-Go Decision:**
- All tests passing? → Proceed to Phase 6A (Handshake)
- Any test failing? → Debug, fix, rerun

---

## 🔗 Documentation

| Document | Purpose | Link |
|----------|---------|------|
| Full RAG Test Specs | Detailed test code + setup | [PHASE_6C_RAG_INTEGRATION_TESTS.md](PHASE_6C_RAG_INTEGRATION_TESTS.md) |
| Integration Plan | All 3 phases (6A/6B/6C) | [PHASE_6_INTEGRATION_PLAN.md](PHASE_6_INTEGRATION_PLAN.md) |
| Phase 5 Baseline | Unit tests (for reference) | [PHASE_5_EXECUTION_SUMMARY.md](PHASE_5_EXECUTION_SUMMARY.md) |
| Arch Decisions | Why these 6 choices | [PHASE_6_INTEGRATION_PLAN.md#architectural-decisions-finalized](PHASE_6_INTEGRATION_PLAN.md) |

---

## ⏱️ Timeline

| Step | Action | Duration | Status |
|------|--------|----------|--------|
| 1 | Install Supabase CLI | 5 min | 🚀 Do Now |
| 2 | Start local DB | 2 min | 🚀 Do Now |
| 3 | Install npm packages | 3 min | 🚀 Do Now |
| 4 | Create test fixtures | 30 min | 🚀 Do Now |
| 5 | Write 5 tests | 1-2 hrs | 🚀 Do Now |
| 6 | Run tests + debug | 1-2 hrs | 🚀 Do Now |
| 7 | Document results | 30 min | ✅ Then |
| **Total** | **Phase 6C Complete** | **2-3 days** | 🚀 **START TODAY** |

---

## ⚠️ Common Issues & Fixes

### Issue: "pgvector extension not found"

**Fix:**
```bash
# Start Supabase
supabase start

# Reset DB (enables extensions)
supabase db reset

# Verify pgvector
psql postgresql://postgres:postgres@localhost:54321/postgres -c \
  "CREATE EXTENSION IF NOT EXISTS vector; \
   SELECT version();"
```

### Issue: "Connection refused localhost:54321"

**Fix:**
```bash
# Check if Supabase is running
supabase status

# If not, start it
supabase start

# If port is busy, stop and restart
supabase stop
supabase start
```

### Issue: "OpenAI API quota exceeded"

**Fix:**
```bash
# Mock OpenAI embeddings in tests instead:
// In test setup
vi.mock('@openai/client', () => ({
  OpenAI: class {
    embeddings = {
      create: vi.fn(() => ({
        data: [{ embedding: Array(1536).fill(0.1) }]
      }))
    }
  }
}));
```

### Issue: "Tests pass locally but fail in GitHub Actions"

**Fix:**
- GitHub Actions runs in clean environment
- Supabase not automatically started in CI
- Use Docker service to start Postgres + pgvector
- Add `.github/workflows/integration-tests.yml`

---

## 🎬 First Test Run

```bash
# Navigate to project
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

# Ensure Supabase is running
supabase status

# Install test deps (if not already)
npm install --save-dev @supabase/supabase-js openai msw

# Create test file structure
mkdir -p backend/src/__tests__/integration/{setup,fixtures}

# Copy test template (from PHASE_6C_RAG_INTEGRATION_TESTS.md)
# → backend/src/__tests__/integration/6c-rag-smart-answer.test.ts

# Run Phase 6C tests
npm run test:6c

# Expected output:
# ✓ Test 1: Vector search finds policies (5ms)
# ✓ Test 2: Clinic isolation verified (8ms)
# ✓ Test 3: Latency < 200ms (120ms)
# ✓ Test 4: Prompt augmentation works (3ms)
# ✓ Test 5: Hallucination prevented (6ms)
#
# 5 passed in 145ms
```

---

## 🏆 When Phase 6C is Done

You'll have proved:

1. **AI doesn't hallucinate** - Uses ONLY clinic KB data
2. **Clinic isolation holds** - No data leaks between clinics
3. **Performance is acceptable** - <200ms search latency
4. **Prompt engineering works** - Context injected correctly
5. **Database integration works** - pgvector functions as expected

Next: Phase 6A (Handshake flow) and 6B (Booking pipeline)

---

**Ready to start? See:** [PHASE_6C_RAG_INTEGRATION_TESTS.md](PHASE_6C_RAG_INTEGRATION_TESTS.md)

**Questions? Refer to:** [PHASE_6_INTEGRATION_PLAN.md](PHASE_6_INTEGRATION_PLAN.md) (full architecture decisions)
