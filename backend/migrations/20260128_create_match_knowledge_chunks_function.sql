-- Migration: Create match_knowledge_chunks function for RAG context retrieval
-- Purpose: Enable vector similarity search on knowledge base embeddings
-- Date: 2026-01-28

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Create match_knowledge_chunks function for semantic search
-- This function performs cosine similarity search on knowledge base chunks
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_org_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base_chunks kb
  WHERE kb.org_id = p_org_id
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION match_knowledge_chunks(vector, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_chunks(vector, float, int, uuid) TO service_role;

-- Create index for faster similarity searches (if not exists)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunks_embedding
  ON knowledge_base_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Comment describing the function
COMMENT ON FUNCTION match_knowledge_chunks(vector, float, int, uuid) IS 'Performs cosine similarity search on knowledge base embeddings for RAG context retrieval. Returns matching chunks above similarity threshold.';
