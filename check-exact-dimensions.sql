-- Get exact dimension count by parsing the vector as text
-- This bypasses pg_column_size overhead

SELECT
  -- Count elements in the vector
  array_length(
    string_to_array(
      trim(both '[]' from embedding::text),
      ','
    ),
    1
  ) as exact_dimensions,

  -- Show first few values
  substring(embedding::text, 1, 100) as preview,

  -- Verify it's actually 1536
  CASE
    WHEN array_length(string_to_array(trim(both '[]' from embedding::text), ','), 1) = 1536
    THEN '✅ Correct: 1536 dimensions (text-embedding-3-small)'
    WHEN array_length(string_to_array(trim(both '[]' from embedding::text), ','), 1) = 1024
    THEN '⚠️  Old model: 1024 dimensions (text-embedding-ada-002)'
    ELSE '❌ Unexpected dimension count'
  END as dimension_status

FROM knowledge_base_chunks
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
LIMIT 1;
