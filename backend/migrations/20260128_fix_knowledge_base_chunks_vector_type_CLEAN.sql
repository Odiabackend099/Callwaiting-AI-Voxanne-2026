-- ============================================
-- CRITICAL FIX: Vector Embedding Type Migration
-- Date: 2026-01-28
-- Problem: knowledge_base_chunks.embedding is stored as TEXT instead of vector(1536)
-- Impact: 100% hallucination rate - AI cannot retrieve knowledge base during live calls
-- Fix: Convert column from TEXT to vector(1536) + Add missing RLS policies
-- ============================================
-- CLEAN VERSION: No RAISE NOTICE statements (Supabase compatible)
-- ============================================

-- STEP 1: Pre-Migration Safety Checks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension not installed. Run: CREATE EXTENSION vector;';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'knowledge_base_chunks') THEN
    RAISE EXCEPTION 'knowledge_base_chunks table does not exist';
  END IF;
END $$;

-- STEP 2: Backup Existing Data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'knowledge_base_chunks_backup_20260128') THEN
    CREATE TABLE knowledge_base_chunks_backup_20260128 AS
    SELECT * FROM knowledge_base_chunks;
  END IF;
END $$;

-- STEP 3: Drop Existing Vector Index
DROP INDEX IF EXISTS idx_knowledge_base_chunks_embedding;

-- STEP 4: Add New Vector Column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base_chunks'
    AND column_name = 'embedding_vector'
  ) THEN
    ALTER TABLE knowledge_base_chunks
    ADD COLUMN embedding_vector vector(1536);
  END IF;
END $$;

-- STEP 5: Convert String Embeddings to Vector Type
UPDATE knowledge_base_chunks
SET embedding_vector = embedding::vector
WHERE embedding IS NOT NULL
  AND embedding_vector IS NULL;

-- STEP 6: Swap Columns (Drop Old, Rename New)
ALTER TABLE knowledge_base_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE knowledge_base_chunks RENAME COLUMN embedding_vector TO embedding;

-- STEP 7: Recreate Vector Index
CREATE INDEX idx_knowledge_base_chunks_embedding
  ON knowledge_base_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- STEP 8: Add Missing RLS Policies (SECURITY FIX)
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_base_chunks_org_isolation" ON knowledge_base_chunks;
DROP POLICY IF EXISTS "knowledge_base_chunks_service_role_bypass" ON knowledge_base_chunks;

CREATE POLICY "knowledge_base_chunks_org_isolation"
  ON knowledge_base_chunks
  FOR ALL
  TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "knowledge_base_chunks_service_role_bypass"
  ON knowledge_base_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- STEP 9: Add org_id Immutability Trigger
DROP TRIGGER IF EXISTS org_id_immutable_knowledge_base_chunks ON knowledge_base_chunks;

CREATE TRIGGER org_id_immutable_knowledge_base_chunks
  BEFORE UPDATE ON knowledge_base_chunks
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

-- STEP 10: Verification - Count chunks to ensure no data loss
DO $$
DECLARE
  current_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count FROM knowledge_base_chunks;
  SELECT COUNT(*) INTO backup_count FROM knowledge_base_chunks_backup_20260128;

  IF current_count != backup_count THEN
    RAISE EXCEPTION 'Data loss detected: % current rows vs % backup rows', current_count, backup_count;
  END IF;
END $$;

-- Migration Complete
SELECT 'Migration Complete - Run diagnostic scripts to verify' as status;
