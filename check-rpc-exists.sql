-- Check if match_knowledge_chunks function exists
SELECT
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type,
  prosrc as source_code
FROM pg_proc
WHERE proname = 'match_knowledge_chunks';

-- If it doesn't exist, we need to create it
-- If it exists, let's see its full definition
SELECT pg_get_functiondef(oid) as full_definition
FROM pg_proc
WHERE proname = 'match_knowledge_chunks';
