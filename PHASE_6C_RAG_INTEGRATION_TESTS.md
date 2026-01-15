# Phase 6C: Smart Answer Loop (RAG Integration) Tests

**Date:** January 15, 2026  
**Status:** 🚀 Implementation Phase  
**Objective:** Verify AI retrieves correct clinic policies and doesn't hallucinate

---

## 🎯 What Phase 6C Tests

The **Smart Answer Loop (RAG)** is where your AI stops guessing and starts **retrieving verified information** from your database before speaking.

**The Pipeline:**
```
User Question
    ↓
Vector Search (pgvector)
    ↓
Retrieve Matching Policies
    ↓
Inject Context into Prompt
    ↓
AI Responds with Verified Info
```

**Phase 6C validates every step of this pipeline.**

---

## 📋 Test Scenarios (5 Core Tests)

### Test 1: Vector Search Returns Correct Policy (Clinic A)

**Scenario:** Clinic A has a policy: "We offer 20% discount for new patients"

**Test:**
```typescript
describe('RAG: Vector Search - Clinic A Context', () => {
  it('should return Clinic A policy when querying from Clinic A context', async () => {
    // 1. SEED: Create Clinic A with policy
    const clinicA = await seedClinic({
      name: 'Heart & Wellness Clinic A',
      policies: [
        'We offer 20% discount for new patients',
        'Office hours: 9 AM - 5 PM'
      ]
    });

    // 2. EMBED: Convert policy text to vector
    const embedding = await openai.embeddings.create({
      input: 'We offer 20% discount for new patients',
      model: 'text-embedding-3-small'
    });

    // 3. SEED: Insert policy + embedding into vector DB
    await db.knowledge_base.insert({
      org_id: clinicA.id,
      content: 'We offer 20% discount for new patients',
      embedding: embedding.data[0].embedding
    });

    // 4. QUERY: Search from Clinic A context
    const userQuestion = 'Do you have any discounts?';
    const queryEmbedding = await openai.embeddings.create({
      input: userQuestion,
      model: 'text-embedding-3-small'
    });

    // 5. SEARCH: Vector similarity search
    const results = await db.rpc('rag_search', {
      org_id: clinicA.id,
      query_embedding: queryEmbedding.data[0].embedding,
      similarity_threshold: 0.7  // cosine similarity
    });

    // 6. ASSERT: Found the policy
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('20% discount');
    expect(results[0].similarity_score).toBeGreaterThan(0.7);
  });
});
```

**What This Tests:**
- ✅ pgvector cosine distance works correctly
- ✅ Similar queries find relevant documents
- ✅ Similarity threshold prevents noise
- ✅ Clinic A data is returned only for Clinic A context

---

### Test 2: Vector Search Isolates Clinic B Data

**Scenario:** Clinic B queries but finds ZERO results from Clinic A

**Test:**
```typescript
describe('RAG: Clinic Isolation in Vector Search', () => {
  it('should NOT return Clinic A policies when querying from Clinic B context', async () => {
    // 1. SETUP: Create both clinics
    const clinicA = await seedClinic({ name: 'Clinic A' });
    const clinicB = await seedClinic({ name: 'Clinic B' });

    // 2. SEED: Policy ONLY in Clinic A
    const policyAEmbedding = await openai.embeddings.create({
      input: 'We offer 20% discount for new patients',
      model: 'text-embedding-3-small'
    });

    await db.knowledge_base.insert({
      org_id: clinicA.id,  // ← CLINIC A ONLY
      content: 'We offer 20% discount for new patients',
      embedding: policyAEmbedding.data[0].embedding
    });

    // 3. QUERY: From Clinic B context
    const userQuestion = 'Do you have discounts?';
    const queryEmbedding = await openai.embeddings.create({
      input: userQuestion,
      model: 'text-embedding-3-small'
    });

    // 4. SEARCH: Using Clinic B's org_id
    const results = await db.rpc('rag_search', {
      org_id: clinicB.id,  // ← CLINIC B CONTEXT
      query_embedding: queryEmbedding.data[0].embedding,
      similarity_threshold: 0.7
    });

    // 5. ASSERT: Zero results (strict isolation)
    expect(results).toHaveLength(0);
  });
});
```

**What This Tests:**
- ✅ org_id filtering in vector search is enforced
- ✅ Clinic A policies are completely hidden from Clinic B
- ✅ No data leakage across organizations
- ✅ RLS policies work in pgvector context

**Security Critical:** This prevents HIPAA violations.

---

### Test 3: Vector Search Latency < 200ms

**Scenario:** Search must complete in human-speed time (not 2 seconds)

**Test:**
```typescript
describe('RAG: Search Latency Performance', () => {
  it('should complete vector search in < 200ms', async () => {
    const clinicA = await seedClinic({ name: 'Clinic A' });

    // Seed 100 policies to simulate real KB
    for (let i = 0; i < 100; i++) {
      const embedding = await openai.embeddings.create({
        input: `Policy ${i}: ${generateRandomPolicy()}`,
        model: 'text-embedding-3-small'
      });

      await db.knowledge_base.insert({
        org_id: clinicA.id,
        content: `Policy ${i}: ${generateRandomPolicy()}`,
        embedding: embedding.data[0].embedding
      });
    }

    // Measure search time
    const startTime = performance.now();

    const queryEmbedding = await openai.embeddings.create({
      input: 'What are your hours?',
      model: 'text-embedding-3-small'
    });

    const results = await db.rpc('rag_search', {
      org_id: clinicA.id,
      query_embedding: queryEmbedding.data[0].embedding,
      similarity_threshold: 0.7
    });

    const endTime = performance.now();
    const latency = endTime - startTime;

    // Assert: Must be fast enough for conversation
    expect(latency).toBeLessThan(200);  // 200ms
  });
});
```

**What This Tests:**
- ✅ pgvector search is fast (not slow database query)
- ✅ Performance holds with 100+ policies
- ✅ No timeout issues during live calls
- ✅ Latency scales linearly (not exponentially)

**Why It Matters:** If search takes 2 seconds, the AI goes silent on the phone call.

---

### Test 4: Prompt Augmentation with Retrieved Context

**Scenario:** AI prompt includes [CONTEXT] section with retrieved policies

**Test:**
```typescript
describe('RAG: Prompt Construction with Retrieved Context', () => {
  it('should inject retrieved context into AI prompt', async () => {
    const clinicA = await seedClinic({ name: 'Clinic A' });

    // Seed policy
    const policyContent = 'We offer 20% discount for new patients. ' +
                         'Office hours: 9 AM - 5 PM, Mon-Fri.';
    
    const embedding = await openai.embeddings.create({
      input: policyContent,
      model: 'text-embedding-3-small'
    });

    await db.knowledge_base.insert({
      org_id: clinicA.id,
      content: policyContent,
      embedding: embedding.data[0].embedding
    });

    // User asks a question
    const userQuestion = 'What are your hours and do you have discounts?';

    // RETRIEVE: Get relevant context
    const queryEmbedding = await openai.embeddings.create({
      input: userQuestion,
      model: 'text-embedding-3-small'
    });

    const retrievedContext = await db.rpc('rag_search', {
      org_id: clinicA.id,
      query_embedding: queryEmbedding.data[0].embedding,
      similarity_threshold: 0.7
    });

    // CONSTRUCT: Build prompt with retrieved context
    const prompt = constructRagPrompt({
      userQuestion,
      retrievedContext,
      clinicName: clinicA.name
    });

    // ASSERT: Prompt includes retrieved content
    expect(prompt).toContain('[CONTEXT]');
    expect(prompt).toContain('20% discount');
    expect(prompt).toContain('9 AM - 5 PM');
    expect(prompt).toContain('[END_CONTEXT]');

    // ASSERT: Prompt structure is correct
    expect(prompt).toMatch(/\[CONTEXT\][\s\S]*\[END_CONTEXT\]/);
  });
});
```

**What This Tests:**
- ✅ Retrieved context is properly formatted
- ✅ Context is injected into prompt
- ✅ AI can see the data it needs
- ✅ Context boundaries are clear (prevents prompt injection)

**Why It Matters:** If context isn't in the prompt, the AI can't use it.

---

### Test 5: RAG Prevents Hallucination (Comprehensive Integration)

**Scenario:** Full pipeline test - Question → Search → Augment → Mock AI Response

**Test:**
```typescript
describe('RAG: End-to-End Prevention of Hallucination', () => {
  it('should only allow AI to answer about clinic policies, not invent info', async () => {
    const clinicA = await seedClinic({ name: 'Cardiac Center' });

    // Seed ONLY these policies
    const policies = [
      'We offer cardiology services',
      'Our hours are 9 AM - 5 PM, Monday to Friday',
      'Insurance accepted: Blue Cross, Aetna'
    ];

    for (const policy of policies) {
      const embedding = await openai.embeddings.create({
        input: policy,
        model: 'text-embedding-3-small'
      });

      await db.knowledge_base.insert({
        org_id: clinicA.id,
        content: policy,
        embedding: embedding.data[0].embedding
      });
    }

    // User asks about something NOT in KB
    const userQuestion = 'Do you have pediatric services?';

    // RETRIEVE: What does KB say?
    const queryEmbedding = await openai.embeddings.create({
      input: userQuestion,
      model: 'text-embedding-3-small'
    });

    const retrievedContext = await db.rpc('rag_search', {
      org_id: clinicA.id,
      query_embedding: queryEmbedding.data[0].embedding,
      similarity_threshold: 0.7
    });

    // ASSERT: KB doesn't have pediatric info
    expect(retrievedContext).toHaveLength(0);  // No match
    
    // This means the prompt should include:
    // "I don't have information about pediatric services in my database."
    
    // CONSTRUCT: Prompt with empty context
    const prompt = constructRagPrompt({
      userQuestion,
      retrievedContext: [],  // Empty!
      clinicName: clinicA.name
    });

    // ASSERT: Prompt includes fallback for unknown info
    expect(prompt).toContain('If you don\'t find relevant information');
    expect(prompt).toContain('please say "I don\'t have that information"');
  });
});
```

**What This Tests:**
- ✅ No hallucination when data isn't in KB
- ✅ Clear fallback behavior for unknown questions
- ✅ AI directed to admit ignorance
- ✅ Full RAG pipeline works end-to-end

**Why It Matters:** This prevents AI from making up medical info (lawsuit liability).

---

## 🛠️ Implementation Files Needed

### 1. Setup Helper: Integration Test Base

**File:** `backend/src/__tests__/integration/setup/integration-setup.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Local Supabase credentials
export const supabaseUrl = 'http://localhost:54321';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const db = createClient(supabaseUrl, supabaseKey);

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Setup/Teardown for each test
export async function setupIntegrationTest() {
  // Reset database to clean state
  await db.from('knowledge_base').delete().neq('id', '');
  await db.from('orgs').delete().neq('id', '');
}

export async function teardownIntegrationTest() {
  // Cleanup
  await db.from('knowledge_base').delete().neq('id', '');
  await db.from('orgs').delete().neq('id', '');
}
```

### 2. Clinic Fixtures

**File:** `backend/src/__tests__/integration/fixtures/clinic-seeds.ts`

```typescript
import { db } from '../setup/integration-setup';

export async function seedClinic({ 
  name, 
  policies = [] 
}: { 
  name: string; 
  policies?: string[] 
}) {
  // Create org
  const { data: org, error } = await db.from('orgs').insert({
    id: crypto.randomUUID(),
    name,
    created_at: new Date()
  }).select().single();

  if (error) throw error;

  // Insert policies
  for (const policy of policies) {
    const embedding = await openai.embeddings.create({
      input: policy,
      model: 'text-embedding-3-small'
    });

    await db.from('knowledge_base').insert({
      id: crypto.randomUUID(),
      org_id: org.id,
      content: policy,
      embedding: embedding.data[0].embedding
    });
  }

  return org;
}
```

### 3. Prompt Construction Helper

**File:** `backend/src/__tests__/integration/fixtures/prompt-helpers.ts`

```typescript
export function constructRagPrompt({
  userQuestion,
  retrievedContext,
  clinicName
}: {
  userQuestion: string;
  retrievedContext: any[];
  clinicName: string;
}) {
  const contextSection = retrievedContext.length > 0
    ? `[CONTEXT]\n${retrievedContext.map(r => r.content).join('\n')}\n[END_CONTEXT]`
    : '[CONTEXT]\nNo relevant information found in database.\n[END_CONTEXT]';

  return `You are an AI assistant for ${clinicName}.

User Question: ${userQuestion}

${contextSection}

Instructions:
- ONLY answer based on the context above.
- If context is empty or doesn't contain relevant info, say: "I don't have that information in my database."
- Never invent or hallucinate information.
- Be professional and helpful.`;
}
```

### 4. Supabase RLS Policy (SQL)

**File:** `backend/supabase/migrations/xxx_rag_vector_search.sql`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base table with vector support
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create index for faster vector search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- RLS: Users can only search their org's knowledge base
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_base_org_isolation ON knowledge_base
  FOR SELECT
  USING (org_id = auth.jwt() ->> 'org_id');

-- RLS Policy Function: Vector search within org context
CREATE OR REPLACE FUNCTION rag_search(
  org_id UUID,
  query_embedding vector,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity_score FLOAT
) AS $$
  SELECT
    kb.id,
    kb.content,
    (1 - (kb.embedding <=> query_embedding))::FLOAT as similarity_score
  FROM knowledge_base kb
  WHERE kb.org_id = $1
    AND (1 - (kb.embedding <=> query_embedding)) > $3
  ORDER BY kb.embedding <=> query_embedding
  LIMIT 5;
$$ LANGUAGE SQL;
```

---

## 📊 Test Execution

### Run Phase 6C Tests Only

```bash
cd backend

# Run RAG integration tests
npm run test:integration -- src/__tests__/integration/6c-rag-smart-answer.test.ts

# Run with coverage
npm run test:integration:coverage -- src/__tests__/integration/6c-rag-smart-answer.test.ts

# Run with verbose output
npm run test:integration -- --reporter=verbose src/__tests__/integration/6c-rag-smart-answer.test.ts
```

### Add to package.json

```json
{
  "scripts": {
    "test:integration": "vitest run --config vitest.config.integration.mjs",
    "test:integration:watch": "vitest --config vitest.config.integration.mjs",
    "test:integration:coverage": "vitest run --coverage --config vitest.config.integration.mjs",
    "test:6c": "vitest run src/__tests__/integration/6c-rag-smart-answer.test.ts"
  }
}
```

---

## 🔧 Vitest Configuration for Integration Tests

**File:** `backend/vitest.config.integration.mjs`

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000, // 30s for API calls
    hookTimeout: 30000,
    setupFiles: ['./src/__tests__/integration/setup/integration-setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  }
});
```

---

## 📈 Success Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Test 1: Vector search finds policies | ✅ Pass | 🚀 Ready |
| Test 2: Clinic isolation works | ✅ 100% isolation | 🚀 Ready |
| Test 3: Search latency | <200ms | 🚀 Ready |
| Test 4: Prompt augmentation | Context included | 🚀 Ready |
| Test 5: Hallucination prevention | No made-up info | 🚀 Ready |
| Overall coverage | 5+ test cases | 🚀 Ready |

---

## 🚀 Next Steps

1. **Set up local Supabase**
   ```bash
   supabase start
   supabase db reset
   ```

2. **Create the test file** (`6c-rag-smart-answer.test.ts`)

3. **Run Phase 6C tests**
   ```bash
   npm run test:6c
   ```

4. **Verify all 5 tests pass**

5. **Move to Phase 6D** (Performance & Load Tests)

---

## 📚 Reference Files

- [PHASE_6_INTEGRATION_PLAN.md](PHASE_6_INTEGRATION_PLAN.md) - Full architecture
- [TESTING_COMMAND_REFERENCE.md](TESTING_COMMAND_REFERENCE.md) - All test commands
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings
- pgvector: https://github.com/pgvector/pgvector
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security

---

**Phase 6C: Smart Answer Loop Integration**  
**Status:** ✅ Ready to Implement  
**Estimated Duration:** 2-3 days  
**Priority:** 🔴 CRITICAL (Prevents hallucination, ensures accuracy)  
**Date:** January 15, 2026
