# 🚨 CRITICAL: Knowledge Base Retrieval Fix Required

**Status**: PRODUCTION BLOCKER
**Impact**: AI cannot retrieve knowledge base data during live calls
**Risk**: 100% hallucination rate - AI will make up answers
**Discovery**: PhD-level end-to-end testing (test-live-rag-retrieval.ts)

---

## Root Cause

The `knowledge_base_chunks.embedding` column is storing vector embeddings as **TEXT/STRING** instead of as PostgreSQL `vector(1536)` type.

### Evidence
```
Embedding type: string  ← PROBLEM!
String value: "[-0.048442382,0.033642985,0.035430636,...]"
String length: 19,222 characters
```

### Why This Breaks Everything
- PostgreSQL's vector similarity operator (`<=>`) only works on `vector` type
- The `match_knowledge_chunks` RPC function cannot compute cosine similarity on strings
- All vector searches return 0 results
- AI receives empty context and hallucinates or says "I don't know"

---

## Test Results

**Live Call Simulation**: 8/8 scenarios FAILED
```
❌ "How much do your services cost?" → 0 chunks retrieved
❌ "Who are the doctors on your team?" → 0 chunks retrieved
❌ "How do I book an appointment?" → 0 chunks retrieved
❌ "Do you offer Botox treatments?" → 0 chunks retrieved
❌ "What happens during a consultation?" → 0 chunks retrieved
❌ "Where are you located?" → 0 chunks retrieved
❌ "What are your hours of operation?" → 0 chunks retrieved
❌ "Tell me about your clinic" → 0 chunks retrieved

Success Rate: 0.0%
```

---

## Fix Required

### Option 1: Proper Fix (Recommended)

**Step 1**: Install pgvector extension (if not already installed)
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 2**: Convert column to vector type
```sql
-- Backup existing data first!
CREATE TABLE knowledge_base_chunks_backup AS
SELECT * FROM knowledge_base_chunks;

-- Add new vector column
ALTER TABLE knowledge_base_chunks
ADD COLUMN embedding_vector vector(1536);

-- Convert string embeddings to vector type
UPDATE knowledge_base_chunks
SET embedding_vector = embedding::vector
WHERE embedding IS NOT NULL;

-- Drop old column and rename new one
ALTER TABLE knowledge_base_chunks DROP COLUMN embedding;
ALTER TABLE knowledge_base_chunks RENAME COLUMN embedding_vector TO embedding;
```

**Step 3**: Recreate vector index
```sql
CREATE INDEX knowledge_base_chunks_embedding_idx
ON knowledge_base_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Step 4**: Verify fix
```bash
cd backend
npx tsx src/scripts/test-live-rag-retrieval.ts
```

Expected: 8/8 tests should PASS

---

### Option 2: Quick Fix (If Schema Cannot Be Changed)

Modify the `match_knowledge_chunks` RPC function to cast strings to vectors:

```sql
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector,
  match_threshold float,
  match_count int,
  p_org_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    knowledge_base_chunks.id,
    knowledge_base_chunks.content,
    (1 - (knowledge_base_chunks.embedding::vector <=> query_embedding)) as similarity
  FROM knowledge_base_chunks
  WHERE knowledge_base_chunks.org_id = p_org_id
    AND knowledge_base_chunks.embedding IS NOT NULL
    AND (1 - (knowledge_base_chunks.embedding::vector <=> query_embedding)) > match_threshold
  ORDER BY knowledge_base_chunks.embedding::vector <=> query_embedding
  LIMIT match_count;
$$;
```

Note: This casts on every query (slower), but works without schema changes.

---

## Verification Steps

After applying the fix:

1. **Run diagnostic**:
   ```bash
   cd backend
   npx tsx src/scripts/diagnose-vector-search.ts
   ```
   Expected: "Embedding type: object" (array) or proper vector type

2. **Run live call simulation**:
   ```bash
   npx tsx src/scripts/test-live-rag-retrieval.ts
   ```
   Expected: 8/8 tests PASS

3. **Check sample query**:
   ```sql
   SELECT
     content,
     1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
   FROM knowledge_base_chunks
   WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
   ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
   LIMIT 3;
   ```
   Expected: Returns 3 chunks with similarity scores

---

## Impact If Not Fixed

- ❌ AI cannot access knowledge base during live calls
- ❌ 100% hallucination rate or "I don't know" responses
- ❌ Knowledge base is essentially non-functional
- ❌ Callers receive inaccurate or incomplete information
- ❌ Business risk: lost conversions, poor customer experience

---

## Next Steps

1. Apply Option 1 fix in Supabase SQL Editor
2. Run verification tests
3. Monitor first few live calls to confirm AI retrieves KB correctly
4. Update chunking code to ensure future chunks use vector type

---

## Files Involved

- **Test Script**: `backend/src/scripts/test-live-rag-retrieval.ts` (NEW)
- **Diagnostic**: `backend/src/scripts/diagnose-vector-search.ts` (NEW)
- **RAG Provider**: `backend/src/services/rag-context-provider.ts`
- **Table**: `knowledge_base_chunks` (Supabase)
- **RPC Function**: `match_knowledge_chunks` (Supabase)

---

## Priority

🔴 **P0 - CRITICAL**: Must be fixed before next live call.

Without this fix, the knowledge base feature is completely broken despite appearing to work in the UI.
