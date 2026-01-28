-- ============================================
-- ULTRA-SIMPLE Vector Type Migration
-- Just the core steps, no fancy error handling
-- ============================================

-- 1. Create backup
CREATE TABLE IF NOT EXISTS knowledge_base_chunks_backup_20260128_v2 AS
SELECT * FROM knowledge_base_chunks;

-- 2. Drop index
DROP INDEX IF EXISTS idx_knowledge_base_chunks_embedding;

-- 3. Add new vector column
ALTER TABLE knowledge_base_chunks
ADD COLUMN IF NOT EXISTS embedding_new vector(1536);

-- 4. Convert data (this is the critical step)
UPDATE knowledge_base_chunks
SET embedding_new = embedding::vector
WHERE embedding IS NOT NULL;

-- 5. Drop old column
ALTER TABLE knowledge_base_chunks
DROP COLUMN embedding;

-- 6. Rename new column
ALTER TABLE knowledge_base_chunks
RENAME COLUMN embedding_new TO embedding;

-- 7. Create new index
CREATE INDEX idx_knowledge_base_chunks_embedding
ON knowledge_base_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 8. Verify
SELECT
  'Migration complete' as status,
  COUNT(*) as total_rows,
  COUNT(embedding) as rows_with_embeddings
FROM knowledge_base_chunks;
