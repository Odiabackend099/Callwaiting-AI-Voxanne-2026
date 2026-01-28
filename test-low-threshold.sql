-- Test with a very low similarity threshold to see if ANY matches exist
-- between new OpenAI embeddings and database embeddings

-- This will tell us if the models are just slightly different (some matches at low threshold)
-- or completely incompatible (zero matches even at 0.0 threshold)

-- We can't directly test with a new OpenAI embedding in SQL,
-- but we can check what the similarity scores actually are
SELECT
  id,
  content,
  LEFT(content, 80) as preview,
  1 - (embedding <=> (
    SELECT embedding
    FROM knowledge_base_chunks
    WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
    ORDER BY created_at DESC
    LIMIT 1
  )) as similarity_score
FROM knowledge_base_chunks
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND embedding IS NOT NULL
ORDER BY similarity_score DESC;

-- This shows ALL similarity scores between chunks
-- If they're all > 0.6, the embeddings are from the same model
-- If they're all < 0.3, different models
