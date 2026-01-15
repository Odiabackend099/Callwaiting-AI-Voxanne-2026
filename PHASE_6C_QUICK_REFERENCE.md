# Phase 6C: Quick Reference Card

**Date:** January 15, 2026  
**Status:** 🚀 Ready to Execute  

---

## 🎯 What You're Building

Smart Answer Loop (RAG) = AI answers with verified clinic data, not hallucinations

```
Question → Embed → Search → Retrieve → Augment Prompt → AI Responds
```

---

## ⚡ 5 Quick Commands

```bash
# 1. Start Local Supabase
supabase start

# 2. Install Dependencies
npm install --save-dev @supabase/supabase-js openai msw

# 3. Create Test File (copy template from PHASE_6C_RAG_INTEGRATION_TESTS.md)
mkdir -p backend/src/__tests__/integration/{setup,fixtures}
touch backend/src/__tests__/integration/6c-rag-smart-answer.test.ts

# 4. Run Tests
npm run test:6c

# 5. Verify Success
# Expected: 5/5 tests passing, <200ms latency, 100% clinic isolation
```

---

## 📊 5 Tests at a Glance

| # | Test | Validates | Pass Criteria |
|---|------|-----------|---------------|
| 1 | Vector search | DB finds policies | Returns results, similarity > 0.7 |
| 2 | Clinic isolation | No data leaks | Clinic B sees 0 results from Clinic A |
| 3 | Latency | Speed | Search < 200ms |
| 4 | Prompt augment | Context injection | [CONTEXT] in prompt |
| 5 | No hallucinate | AI accuracy | No made-up info |

---

## 📁 3 Fixture Files to Create

### 1. `backend/src/__tests__/integration/setup/integration-setup.ts`
```typescript
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

export const db = createClient('http://localhost:54321', 'anon_key');
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function setupTest() {
  // Reset DB before each test
  await db.from('knowledge_base').delete().neq('id', '');
}
```

### 2. `backend/src/__tests__/integration/fixtures/clinic-seeds.ts`
```typescript
export async function seedClinic({ name, policies = [] }) {
  const org = await db.from('orgs').insert({
    id: crypto.randomUUID(),
    name
  }).select().single();

  for (const policy of policies) {
    const embedding = await openai.embeddings.create({
      input: policy,
      model: 'text-embedding-3-small'
    });
    
    await db.from('knowledge_base').insert({
      org_id: org.id,
      content: policy,
      embedding: embedding.data[0].embedding
    });
  }
  
  return org;
}
```

### 3. `backend/src/__tests__/integration/fixtures/prompt-helpers.ts`
```typescript
export function buildRagPrompt({ userQuestion, context, clinicName }) {
  return `You are AI for ${clinicName}.

User: ${userQuestion}

[CONTEXT]
${context.map(c => c.content).join('\n')}
[END_CONTEXT]

Rules:
- Only use context above
- If empty: "I don't have that info"`;
}
```

---

## 🧪 Test Skeleton

```typescript
// backend/src/__tests__/integration/6c-rag-smart-answer.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { db, openai, setupTest } from './setup/integration-setup';
import { seedClinic } from './fixtures/clinic-seeds';
import { buildRagPrompt } from './fixtures/prompt-helpers';

describe('Phase 6C: Smart Answer Loop - RAG', () => {
  beforeEach(setupTest);

  // TEST 1: Vector search finds policies
  it('should retrieve matching policy via vector search', async () => {
    const clinic = await seedClinic({
      name: 'Test Clinic',
      policies: ['We offer 20% discount for new patients']
    });
    
    const embedding = await openai.embeddings.create({
      input: 'Do you have discounts?',
      model: 'text-embedding-3-small'
    });

    const results = await db.rpc('rag_search', {
      org_id: clinic.id,
      query_embedding: embedding.data[0].embedding,
      similarity_threshold: 0.7
    });

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('discount');
  });

  // TEST 2: Clinic isolation
  it('should isolate Clinic A from Clinic B', async () => {
    const clinicA = await seedClinic({
      name: 'Clinic A',
      policies: ['Clinic A policy']
    });
    const clinicB = await seedClinic({
      name: 'Clinic B',
      policies: []
    });

    const embedding = await openai.embeddings.create({
      input: 'Clinic A policy',
      model: 'text-embedding-3-small'
    });

    const results = await db.rpc('rag_search', {
      org_id: clinicB.id,
      query_embedding: embedding.data[0].embedding,
      threshold: 0.7
    });

    expect(results).toHaveLength(0);
  });

  // TEST 3: Latency < 200ms
  it('should complete search in < 200ms', async () => {
    const clinic = await seedClinic({ name: 'Clinic' });
    
    const embedding = await openai.embeddings.create({
      input: 'test',
      model: 'text-embedding-3-small'
    });

    const start = performance.now();
    await db.rpc('rag_search', {
      org_id: clinic.id,
      query_embedding: embedding.data[0].embedding,
      threshold: 0.7
    });
    const latency = performance.now() - start;

    expect(latency).toBeLessThan(200);
  });

  // TEST 4: Prompt augmentation
  it('should include context in AI prompt', () => {
    const context = [
      { content: 'Policy A' },
      { content: 'Policy B' }
    ];

    const prompt = buildRagPrompt({
      userQuestion: 'Question?',
      context,
      clinicName: 'Test'
    });

    expect(prompt).toContain('[CONTEXT]');
    expect(prompt).toContain('Policy A');
    expect(prompt).toContain('[END_CONTEXT]');
  });

  // TEST 5: Prevent hallucination
  it('should not answer without KB context', async () => {
    const clinic = await seedClinic({
      name: 'Clinic',
      policies: []  // Empty KB
    });

    const embedding = await openai.embeddings.create({
      input: 'Do you have pediatrics?',
      model: 'text-embedding-3-small'
    });

    const results = await db.rpc('rag_search', {
      org_id: clinic.id,
      query_embedding: embedding.data[0].embedding,
      threshold: 0.7
    });

    expect(results).toHaveLength(0);
  });
});
```

---

## 🔍 Debugging Commands

```bash
# See Supabase logs
supabase logs postgres --local

# Check DB state manually
psql postgresql://postgres:postgres@localhost:54321/postgres \
  -c "SELECT count(*) FROM knowledge_base;"

# Reset DB
supabase db reset

# Run specific test with verbose output
npm run test:6c -- --reporter=verbose

# Run with coverage
npm run test:6c -- --coverage
```

---

## ✅ Success Checklist

- [ ] Supabase running (`supabase status` shows "Services are running")
- [ ] Dependencies installed (`npm list @supabase/supabase-js`)
- [ ] Test file created (`backend/src/__tests__/integration/6c-rag-smart-answer.test.ts`)
- [ ] All 5 tests passing (`npm run test:6c`)
- [ ] Latency metric captured (< 200ms)
- [ ] Clinic isolation verified (test 2 passes)
- [ ] Results documented (`PHASE_6C_RESULTS.md`)

---

## 🚨 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Connection refused` | Run `supabase start` |
| `Extension pgvector not found` | Run `supabase db reset` |
| `No such table: knowledge_base` | Check migrations are applied (`supabase db reset`) |
| `OpenAI API error` | Check `OPENAI_API_KEY` env var |
| `Timeout 30s` | Increase in vitest config: `testTimeout: 60000` |

---

## 📚 Full Documentation

- **Detailed specs:** [PHASE_6C_RAG_INTEGRATION_TESTS.md](PHASE_6C_RAG_INTEGRATION_TESTS.md)
- **Architecture:** [PHASE_6_INTEGRATION_PLAN.md](PHASE_6_INTEGRATION_PLAN.md)
- **Getting started:** [PHASE_6C_START_HERE.md](PHASE_6C_START_HERE.md)

---

## ⏱️ Time Estimate

- Setup (Supabase + npm): 15 min
- Create fixtures: 30 min
- Write tests: 1 hr
- Debug + optimize: 1 hr
- **Total: 2-3 hours for Phase 6C implementation**

**Then:** Phase 6A (2-3 days) → Phase 6B (2-3 days) → Phase 6D (1-2 days)

---

**Phase 6C: Smart Answer Loop is production-critical.**

If this works → AI never hallucinated → Clinics trust the system

**Start now:** `supabase start`
