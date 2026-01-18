-- ============================================================================
-- FIX RLS POLICIES - Allow Service Role to Bypass
-- ============================================================================
-- ========================================
-- CONTACTS TABLE
-- ========================================
-- Drop existing policies if they conflict (to be safe, though specific names are better)
-- We use specific names to avoid dropping user policies accidentally
DROP POLICY IF EXISTS "contacts_service_role_bypass" ON contacts;
-- Enable RLS (required for policies to work, idempotently)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- Policy: Service role can do EVERYTHING (bypass RLS)
CREATE POLICY "contacts_service_role_bypass" ON contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ========================================
-- APPOINTMENTS TABLE
-- ========================================
-- Drop existing policies
DROP POLICY IF EXISTS "appointments_service_role_bypass" ON appointments;
-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- Policy: Service role can do EVERYTHING (bypass RLS)
CREATE POLICY "appointments_service_role_bypass" ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);