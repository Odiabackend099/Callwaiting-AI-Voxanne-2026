-- ============================================
-- Database Schema Verification Script
-- Date: 2025-01-10
-- Purpose: Verify database schema state matches code expectations
-- Context: Post-audit verification after critical fixes
-- ============================================

-- ============================================
-- VERIFICATION 1: Check org_id Columns Exist
-- ============================================
SELECT 
  'VERIFICATION 1: org_id Columns' as verification,
  table_name,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name = 'org_id' THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'call_logs', 
    'calls', 
    'leads', 
    'knowledge_base', 
    'agents',
    'integrations',
    'campaigns',
    'organizations'
  )
  AND column_name = 'org_id'
ORDER BY table_name;

-- Expected Result: All critical tables should have org_id column

-- ============================================
-- VERIFICATION 2: Check for NULL org_id Values
-- ============================================
SELECT 
  'VERIFICATION 2: NULL org_id Values' as verification,
  table_name,
  COUNT(*) FILTER (WHERE org_id IS NULL) as null_count,
  COUNT(*) as total_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE org_id IS NULL) = 0 THEN '✅ NO NULL VALUES'
    ELSE '❌ HAS NULL VALUES'
  END as status
FROM (
  SELECT 'call_logs' as table_name, org_id FROM call_logs
  UNION ALL
  SELECT 'calls' as table_name, org_id FROM calls WHERE org_id IS NOT NULL
  UNION ALL
  SELECT 'knowledge_base' as table_name, org_id FROM knowledge_base
  UNION ALL
  SELECT 'leads' as table_name, org_id FROM leads WHERE org_id IS NOT NULL
) as all_org_ids
GROUP BY table_name
ORDER BY table_name;

-- Expected Result: Zero NULL org_id values (after backfill migration)

-- ============================================
-- VERIFICATION 3: Check RLS is Enabled
-- ============================================
SELECT 
  'VERIFICATION 3: RLS Enabled' as verification,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'call_logs',
    'calls',
    'leads',
    'knowledge_base',
    'agents',
    'integrations',
    'campaigns'
  )
ORDER BY tablename;

-- Expected Result: All multi-tenant tables should have RLS enabled

-- ============================================
-- VERIFICATION 4: Check RLS Policies Use SSOT Function
-- ============================================
SELECT 
  'VERIFICATION 4: RLS Policies Use SSOT' as verification,
  tablename,
  policyname,
  cmd as command,
  CASE 
    WHEN qual LIKE '%auth_org_id%' OR qual LIKE '%public.auth_org_id%' THEN '✅ USES SSOT FUNCTION'
    WHEN qual LIKE '%user_metadata%org_id%' THEN '⚠️ USES OLD PATTERN'
    WHEN qual LIKE '%app_metadata%org_id%' THEN '⚠️ USES DIRECT PATTERN'
    ELSE '❌ UNKNOWN PATTERN'
  END as status,
  qual as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'call_logs',
    'calls',
    'leads',
    'knowledge_base',
    'agents',
    'integrations',
    'campaigns'
  )
  AND policyname LIKE '%org%'
ORDER BY tablename, policyname;

-- Expected Result: All policies should use public.auth_org_id() function

-- ============================================
-- VERIFICATION 5: Check auth_org_id() Function Exists
-- ============================================
SELECT 
  'VERIFICATION 5: auth_org_id() Function' as verification,
  routine_name,
  routine_schema,
  data_type as return_type,
  CASE 
    WHEN routine_name = 'auth_org_id' THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'auth_org_id';

-- Expected Result: Function should exist in public schema

-- ============================================
-- VERIFICATION 6: Check Organizations Table Exists
-- ============================================
SELECT 
  'VERIFICATION 6: Organizations Table' as verification,
  table_name,
  CASE 
    WHEN table_name = 'organizations' THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status,
  (SELECT COUNT(*) FROM organizations) as org_count,
  (SELECT COUNT(*) FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001') as default_org_exists
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'organizations';

-- Expected Result: Organizations table should exist with at least default org

-- ============================================
-- VERIFICATION 7: Check Indexes Exist
-- ============================================
SELECT 
  'VERIFICATION 7: Performance Indexes' as verification,
  tablename,
  indexname,
  CASE 
    WHEN indexname LIKE '%org_id%' THEN '✅ EXISTS'
    ELSE 'OTHER INDEX'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'call_logs',
    'calls',
    'leads',
    'knowledge_base',
    'campaigns'
  )
  AND indexname LIKE '%org_id%'
ORDER BY tablename, indexname;

-- Expected Result: Composite indexes should exist for query performance

-- ============================================
-- VERIFICATION 8: Check Foreign Key Constraints
-- ============================================
SELECT 
  'VERIFICATION 8: Foreign Key Constraints' as verification,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN ccu.table_name = 'organizations' AND kcu.column_name = 'org_id' THEN '✅ CORRECT FK'
    ELSE 'OTHER FK'
  END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'org_id'
  AND ccu.table_name = 'organizations'
ORDER BY tc.table_name;

-- Expected Result: All org_id columns should have FK to organizations(id)

-- ============================================
-- SUMMARY REPORT
-- ============================================
SELECT 
  'SUMMARY' as report_section,
  COUNT(DISTINCT table_name) FILTER (WHERE column_name = 'org_id') as tables_with_org_id,
  COUNT(DISTINCT tablename) FILTER (WHERE rowsecurity = true) as tables_with_rls,
  COUNT(DISTINCT policyname) FILTER (WHERE qual LIKE '%auth_org_id%') as policies_using_ssot,
  CASE 
    WHEN COUNT(DISTINCT routine_name) FILTER (WHERE routine_name = 'auth_org_id') > 0 
      THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as auth_org_id_function_status
FROM (
  SELECT 'columns' as source, table_name, column_name, NULL::text as tablename, NULL::boolean as rowsecurity, NULL::text as policyname, NULL::text as qual, NULL::text as routine_name
  FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'org_id'
  UNION ALL
  SELECT 'tables' as source, NULL::text, NULL::text, tablename, rowsecurity, NULL::text, NULL::text, NULL::text
  FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('call_logs', 'calls', 'leads', 'knowledge_base')
  UNION ALL
  SELECT 'policies' as source, NULL::text, NULL::text, NULL::text, NULL::boolean, policyname, qual, NULL::text
  FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('call_logs', 'calls', 'leads', 'knowledge_base') AND policyname LIKE '%org%'
  UNION ALL
  SELECT 'functions' as source, NULL::text, NULL::text, NULL::text, NULL::boolean, NULL::text, NULL::text, routine_name
  FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'auth_org_id'
) as all_checks;

-- ============================================
-- VERIFICATION COMPLETE
-- ============================================
-- Review all results above
-- All checks should show ✅ status for production readiness
