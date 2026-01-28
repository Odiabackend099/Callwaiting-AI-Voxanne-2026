-- Test if NEW OpenAI embeddings match OLD database embeddings
-- We'll manually create a test embedding and see if it matches anything

-- First, let's check what the average similarity score is between
-- a query embedding and the stored embeddings

-- For testing, we'll use an embedding from chunk 1 to search chunk 2
-- If they're from the same model, similarity should be 0.7-0.9
-- If different models, similarity will be <0.3

WITH test_embedding AS (
  SELECT embedding FROM knowledge_base_chunks
  WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  ORDER BY created_at LIMIT 1
),
other_chunks AS (
  SELECT embedding FROM knowledge_base_chunks
  WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  ORDER BY created_at OFFSET 1 LIMIT 1
)
SELECT
  1 - ((SELECT embedding FROM test_embedding) <=> (SELECT embedding FROM other_chunks)) as similarity_score,
  CASE
    WHEN 1 - ((SELECT embedding FROM test_embedding) <=> (SELECT embedding FROM other_chunks)) > 0.7
    THEN '✅ Same model - embeddings are compatible'
    WHEN 1 - ((SELECT embedding FROM test_embedding) <=> (SELECT embedding FROM other_chunks)) > 0.3
    THEN '⚠️  Moderate similarity - might be same model family'
    ELSE '❌ Different models - embeddings incompatible'
  END as diagnosis;

-- Also check: are these embeddings the right dimension?
SELECT
  pg_column_size(embedding) as bytes,
  pg_column_size(embedding) / 4 as float_count,
  CASE
    WHEN pg_column_size(embedding) / 4 = 1536 THEN '✅ Correct dimension (1536)'
    WHEN pg_column_size(embedding) / 4 = 1024 THEN '⚠️  Old ada-002 model (1024 dims)'
    ELSE '❌ Unknown dimension'
  END as dimension_check
FROM knowledge_base_chunks
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
LIMIT 1;
