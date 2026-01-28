# Manual Vector Type Fix - Step by Step

## Problem
The embedding column is TEXT instead of vector(1536), causing 0% retrieval success.

## Solution
Execute these SQL statements **ONE AT A TIME** in Supabase SQL Editor.

---

## STEP 1: Verify Current State

```sql
-- Check current column type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'knowledge_base_chunks'
AND column_name = 'embedding';
```

**Expected Result:**
- `data_type`: `text` or `character varying`
- `udt_name`: `text` or `varchar`

**If you see `vector`:** Skip to verification tests - already fixed!

---

## STEP 2: Create Backup

```sql
-- Create backup table
CREATE TABLE IF NOT EXISTS kb_chunks_backup_final AS
SELECT * FROM knowledge_base_chunks;

-- Verify backup
SELECT COUNT(*) FROM kb_chunks_backup_final;
```

**Expected Result:** Should show `8` rows

---

## STEP 3: Drop Existing Index

```sql
-- Drop the vector index (will recreate after conversion)
DROP INDEX IF EXISTS idx_knowledge_base_chunks_embedding;
```

**Expected Result:** `DROP INDEX`

---

## STEP 4: Add New Vector Column

```sql
-- Add new column with proper vector type
ALTER TABLE knowledge_base_chunks
ADD COLUMN embedding_vector vector(1536);
```

**Expected Result:** Success message

---

## STEP 5: Convert Data

```sql
-- Convert string embeddings to vector type
-- This is the CRITICAL step
UPDATE knowledge_base_chunks
SET embedding_vector = embedding::vector
WHERE embedding IS NOT NULL;
```

**Expected Result:** `UPDATE 8`

**If you get an error:**
- Error: "cannot cast type text to vector" → The string format is incompatible
- Error: "out of memory" → Contact me, we'll use a different approach

---

## STEP 6: Verify Conversion

```sql
-- Check that all rows were converted
SELECT
  COUNT(*) as total,
  COUNT(embedding) as old_count,
  COUNT(embedding_vector) as new_count
FROM knowledge_base_chunks;
```

**Expected Result:**
- `total`: 8
- `old_count`: 8
- `new_count`: 8

**If new_count is 0:** The conversion in Step 5 failed - STOP and contact me

---

## STEP 7: Swap Columns

```sql
-- Drop old TEXT column
ALTER TABLE knowledge_base_chunks DROP COLUMN embedding;

-- Rename new vector column
ALTER TABLE knowledge_base_chunks RENAME COLUMN embedding_vector TO embedding;
```

**Expected Result:** Success messages

---

## STEP 8: Recreate Index

```sql
-- Create vector index for similarity search
CREATE INDEX idx_knowledge_base_chunks_embedding
ON knowledge_base_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Expected Result:** `CREATE INDEX`

**If you get "out of memory" error:**

Try HNSW instead:
```sql
CREATE INDEX idx_knowledge_base_chunks_embedding
ON knowledge_base_chunks
USING hnsw (embedding vector_cosine_ops);
```

---

## STEP 9: Final Verification

```sql
-- Verify column type is now vector
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'knowledge_base_chunks'
AND column_name = 'embedding';
```

**Expected Result:**
- `data_type`: `USER-DEFINED`
- `udt_name`: `vector`

**If you still see `text`:** The migration didn't work - contact me immediately

---

## STEP 10: Test Vector Search

```sql
-- Test that vector similarity search works
SELECT
  id,
  content,
  1 - (embedding <=> (SELECT embedding FROM knowledge_base_chunks LIMIT 1)) as similarity
FROM knowledge_base_chunks
WHERE embedding IS NOT NULL
ORDER BY embedding <=> (SELECT embedding FROM knowledge_base_chunks LIMIT 1)
LIMIT 3;
```

**Expected Result:** Should return 3 rows with similarity scores (numbers like 0.85, 0.72, etc.)

**If you get an error about `<=>` operator:** The column is still not properly typed as vector

---

## After All Steps Complete

Run these verification tests in your terminal:

```bash
cd backend
npx tsx src/scripts/diagnose-vector-search.ts
npx tsx src/scripts/test-live-rag-retrieval.ts
```

**Expected Results:**
- Embedding type: object/array (not string)
- 8/8 tests PASS (not 0/8)

---

## If Anything Goes Wrong

Rollback:
```sql
DROP TABLE IF EXISTS knowledge_base_chunks;
ALTER TABLE kb_chunks_backup_final RENAME TO knowledge_base_chunks;
```

Then contact me with the exact error message you received.
