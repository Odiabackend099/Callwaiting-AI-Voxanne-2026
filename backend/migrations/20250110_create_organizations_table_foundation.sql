-- ============================================
-- WARDEN FOUNDATION: Create Organizations Table
-- Date: 2025-01-10
-- Purpose: Foundation for multi-tenant org-based model (required before Warden fixes)
-- Context: Zero-Trust Warden Phase 1 - Schema Foundation
-- ============================================
-- 
-- CRITICAL: This migration MUST be applied BEFORE any Warden migrations
-- The database currently uses user_id (single-tenant per user)
-- This migration creates the organizations table foundation for org-based multi-tenant model
--
-- ============================================

-- STEP 1: Create organizations table (foundation for multi-tenant model)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- STEP 2: Create default organization for backward compatibility
-- This allows existing code to work while migrating from user-based to org-based model
INSERT INTO organizations (id, name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Default Organization', 'active')
ON CONFLICT (id) DO NOTHING;

-- STEP 3: Add updated_at trigger
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- ============================================
-- NEXT STEPS (After this migration):
-- ============================================
-- 1. Add org_id columns to existing tables (migration: 20250110_add_org_id_columns.sql)
-- 2. Backfill org_id from user_id (1:1 mapping initially)
-- 3. Update JWT app_metadata to include org_id for all users
-- 4. Then deploy Warden fixes (auth.org_id() function, immutability triggers)
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
