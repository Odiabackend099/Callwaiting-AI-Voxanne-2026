-- ============================================
-- TIER 1 - T1.3: Create User/Team Management
-- Date: 2025-01-11
-- Purpose: Create user_org_roles table for role-based access control
-- 
-- FEATURES:
--   - Three roles: admin, agent, viewer
--   - Multi-tenant team management
--   - Invitation tracking
--   - Admin-only team modifications
-- 
-- ROLES:
--   - admin: Full access + team management
--   - agent: View + take actions (transfer, book appointments)
--   - viewer: Dashboard read-only
-- ============================================
-- ===== user_org_roles Table =====
-- Maps users to organizations with specific roles
CREATE TABLE IF NOT EXISTS user_org_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'viewer')),
    -- Invitation tracking
    invited_by UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        invited_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        -- One role per user per org
        UNIQUE(user_id, org_id)
);
-- Ensure columns exist (idempotent)
ALTER TABLE user_org_roles
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE
SET NULL;
ALTER TABLE user_org_roles
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP DEFAULT NOW();
ALTER TABLE user_org_roles
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_user_org_roles_user ON user_org_roles(user_id);
CREATE INDEX idx_user_org_roles_org ON user_org_roles(org_id);
CREATE INDEX idx_user_org_roles_role ON user_org_roles(org_id, role);
CREATE INDEX idx_user_org_roles_user_org ON user_org_roles(user_id, org_id);
-- ===== RLS Policies =====
ALTER TABLE user_org_roles ENABLE ROW LEVEL SECURITY;
-- Users can see members of their own org
DROP POLICY IF EXISTS "user_org_roles_org_isolation" ON user_org_roles;
CREATE POLICY "user_org_roles_org_isolation" ON user_org_roles FOR
SELECT TO authenticated USING (
        org_id IN (
            SELECT org_id
            FROM user_org_roles
            WHERE user_id = auth.uid()
        )
    );
-- Only admins can insert/update/delete team members
DROP POLICY IF EXISTS "user_org_roles_admin_insert" ON user_org_roles;
CREATE POLICY "user_org_roles_admin_insert" ON user_org_roles FOR
INSERT TO authenticated WITH CHECK (
        org_id IN (
            SELECT org_id
            FROM user_org_roles
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );
DROP POLICY IF EXISTS "user_org_roles_admin_update" ON user_org_roles;
CREATE POLICY "user_org_roles_admin_update" ON user_org_roles FOR
UPDATE TO authenticated USING (
        org_id IN (
            SELECT org_id
            FROM user_org_roles
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    ) WITH CHECK (
        org_id IN (
            SELECT org_id
            FROM user_org_roles
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );
DROP POLICY IF EXISTS "user_org_roles_admin_delete" ON user_org_roles;
CREATE POLICY "user_org_roles_admin_delete" ON user_org_roles FOR DELETE TO authenticated USING (
    org_id IN (
        SELECT org_id
        FROM user_org_roles
        WHERE user_id = auth.uid()
            AND role = 'admin'
    )
);
-- Service role bypass
CREATE POLICY "user_org_roles_service_role_bypass" ON user_org_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ===== Immutability Triggers =====
-- Prevent org_id from being changed after creation
CREATE TRIGGER org_id_immutable_user_org_roles BEFORE
UPDATE ON user_org_roles FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
-- ===== Updated At Trigger =====
CREATE OR REPLACE FUNCTION update_user_org_roles_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER user_org_roles_updated_at BEFORE
UPDATE ON user_org_roles FOR EACH ROW EXECUTE FUNCTION update_user_org_roles_updated_at();
-- ===== Helper Function: Get User Role =====
-- Function to easily get a user's role for an org
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID, p_org_id UUID) RETURNS TEXT AS $$
SELECT role
FROM user_org_roles
WHERE user_id = p_user_id
    AND org_id = p_org_id
LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
-- ===== Backfill Existing Users =====
-- Add all existing users as admins for their orgs
INSERT INTO user_org_roles (user_id, org_id, role, accepted_at)
SELECT DISTINCT u.id as user_id,
    COALESCE(
        (u.raw_app_meta_data->>'org_id')::uuid,
        (u.raw_user_meta_data->>'org_id')::uuid
    ) as org_id,
    'admin' as role,
    NOW() as accepted_at
FROM auth.users u
WHERE COALESCE(
        (u.raw_app_meta_data->>'org_id')::uuid,
        (u.raw_user_meta_data->>'org_id')::uuid
    ) IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM organizations o
        WHERE o.id = COALESCE(
                (u.raw_app_meta_data->>'org_id')::uuid,
                (u.raw_user_meta_data->>'org_id')::uuid
            )
    ) ON CONFLICT (user_id, org_id) DO NOTHING;
-- ===== Comments =====
COMMENT ON TABLE user_org_roles IS 'Maps users to organizations with role-based access control. Supports admin, agent, and viewer roles.';
COMMENT ON COLUMN user_org_roles.role IS 'User role: admin (full access + team mgmt), agent (view + actions), viewer (read-only)';
COMMENT ON COLUMN user_org_roles.invited_by IS 'User ID of admin who invited this user. NULL for original org members.';
COMMENT ON COLUMN user_org_roles.accepted_at IS 'Timestamp when user accepted invitation. NULL for pending invitations.';
COMMENT ON FUNCTION get_user_role IS 'Helper function to get a user''s role for a specific organization. Returns NULL if user not in org.';
-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check table exists
-- \dt user_org_roles
--
-- -- Check RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'user_org_roles';
--
-- -- Check policies exist
-- SELECT policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'user_org_roles'
-- ORDER BY policyname;
--
-- -- Check backfill worked
-- SELECT COUNT(*) FROM user_org_roles WHERE role = 'admin';
--
-- -- Test get_user_role function
-- SELECT get_user_role(auth.uid(), (SELECT public.auth_org_id()));
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Create backend routes and services