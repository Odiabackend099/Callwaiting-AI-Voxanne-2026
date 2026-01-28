-- Verify actual column type in database
SELECT
  column_name,
  data_type,
  udt_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'knowledge_base_chunks'
  AND column_name IN ('embedding', 'embedding_new', 'embedding_vector')
ORDER BY column_name;
