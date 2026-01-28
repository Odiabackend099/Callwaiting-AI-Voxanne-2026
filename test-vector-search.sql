-- Test if vector similarity search works
-- This should return results if the migration was successful

-- Step 1: Check if we have embeddings
SELECT
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embeddings
FROM knowledge_base_chunks
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';

-- Step 2: Try a simple vector similarity query
-- Compare each embedding to the first one
SELECT
  id,
  content,
  LEFT(content, 100) as preview,
  1 - (embedding <=> (SELECT embedding FROM knowledge_base_chunks LIMIT 1)) as similarity
FROM knowledge_base_chunks
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND embedding IS NOT NULL
ORDER BY embedding <=> (SELECT embedding FROM knowledge_base_chunks LIMIT 1)
LIMIT 5;

-- Step 3: Check what the match_knowledge_chunks function returns
-- Using a sample embedding
SELECT * FROM match_knowledge_chunks(
  (SELECT embedding FROM knowledge_base_chunks LIMIT 1),
  0.1,  -- Lower threshold
  10,   -- More results
  '46cf2995-2bee-44e3-838b-24151486fe4e'::uuid
);
