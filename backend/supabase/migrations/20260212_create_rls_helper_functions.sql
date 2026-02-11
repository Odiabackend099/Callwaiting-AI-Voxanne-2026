/**
 * RLS Policy Verification Helper Functions (P0-4)
 *
 * Creates database functions to check RLS status and policy configuration.
 * Used by verify-rls-policies.ts script for security auditing.
 */

-- Function: Check if RLS is enabled on a table
-- Returns: { table_name: TEXT, rls_enabled: BOOLEAN }
CREATE OR REPLACE FUNCTION check_rls_enabled(p_table_name TEXT)
RETURNS TABLE(table_name TEXT, rls_enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_table_name::TEXT,
    relrowsecurity::BOOLEAN
  FROM pg_class
  WHERE relname = p_table_name
    AND relkind = 'r'; -- 'r' = ordinary table
END;
$$;

-- Function: Get all RLS policies for a specific table
-- Returns: Array of { policyname: TEXT, definition: TEXT }
CREATE OR REPLACE FUNCTION get_table_policies(p_table_name TEXT)
RETURNS TABLE(policyname TEXT, definition TEXT, permissive BOOLEAN, roles TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pol.polname::TEXT AS policyname,
    pg_get_expr(pol.polqual, pol.polrelid)::TEXT AS definition,
    pol.polpermissive::BOOLEAN AS permissive,
    ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles))::TEXT[] AS roles
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  WHERE cls.relname = p_table_name;
END;
$$;

-- Function: Get ALL RLS policies across all tables
-- Returns: Array of { tablename: TEXT, policyname: TEXT, definition: TEXT }
CREATE OR REPLACE FUNCTION get_all_rls_policies()
RETURNS TABLE(tablename TEXT, policyname TEXT, definition TEXT, permissive BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cls.relname::TEXT AS tablename,
    pol.polname::TEXT AS policyname,
    pg_get_expr(pol.polqual, pol.polrelid)::TEXT AS definition,
    pol.polpermissive::BOOLEAN AS permissive
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  WHERE cls.relnamespace = 'public'::regnamespace
  ORDER BY cls.relname, pol.polname;
END;
$$;

-- Function: Count total RLS policies in database
-- Returns: INTEGER (total count)
CREATE OR REPLACE FUNCTION count_rls_policies()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  WHERE cls.relnamespace = 'public'::regnamespace;

  RETURN policy_count;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION check_rls_enabled IS 'Check if RLS is enabled on a specific table';
COMMENT ON FUNCTION get_table_policies IS 'Get all RLS policies for a specific table with definitions';
COMMENT ON FUNCTION get_all_rls_policies IS 'Get all RLS policies across all tables in public schema';
COMMENT ON FUNCTION count_rls_policies IS 'Count total number of RLS policies in database';
