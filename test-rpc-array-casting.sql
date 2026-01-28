-- Test if PostgreSQL can cast a JSON array to vector type in RPC calls
-- This simulates what the JavaScript client does

-- First, get a sample embedding as an array
WITH sample_embedding AS (
  SELECT embedding::text as emb_text
  FROM knowledge_base_chunks
  WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  LIMIT 1
)
-- Try to call the RPC function with the embedding as text (simulating JSON)
SELECT * FROM match_knowledge_chunks(
  (SELECT emb_text::vector FROM sample_embedding),  -- Cast text back to vector
  0.1,
  10,
  '46cf2995-2bee-44e3-838b-24151486fe4e'::uuid
);

-- Also test: Can we create a vector from a text array representation?
SELECT '[0.1, 0.2, 0.3]'::vector as test_vector;

-- Check the actual RPC function definition in the database
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'match_knowledge_chunks';
