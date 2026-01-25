-- Migration: Create services_audit table for tracking price changes
-- Date: 2026-01-25
--
-- PURPOSE: Services pricing affects financial calculations and customer quotes.
-- This audit trail ensures compliance and debugging when prices change.
--
-- TRACKS:
-- - Old and new pricing values
-- - Who made the change (user ID)
-- - When the change occurred
-- - Enables rollback identification and pricing dispute resolution

CREATE TABLE IF NOT EXISTS services_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Price change tracking
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,

  -- Change metadata
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,  -- "Manual update", "Import", "Bulk adjustment", etc.

  -- Timestamps
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_services_audit_org_id ON services_audit(org_id);
CREATE INDEX idx_services_audit_service_id ON services_audit(service_id);
CREATE INDEX idx_services_audit_changed_at ON services_audit(changed_at DESC);
CREATE INDEX idx_services_audit_org_service ON services_audit(org_id, service_id, changed_at DESC);

-- Row Level Security
ALTER TABLE services_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see audit logs for their organization
CREATE POLICY services_audit_org_isolation ON services_audit
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Service role has full access
CREATE POLICY services_audit_service_role ON services_audit
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger function to log price changes
CREATE OR REPLACE FUNCTION log_service_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO services_audit (
      service_id,
      org_id,
      old_price,
      new_price,
      changed_by,
      change_reason
    ) VALUES (
      NEW.id,
      NEW.org_id,
      OLD.price,
      NEW.price,
      auth.uid(),
      'Price update via API'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log all price changes
CREATE TRIGGER audit_service_price_changes
AFTER UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION log_service_price_change();

-- Comments
COMMENT ON TABLE services_audit IS 'Audit trail for all service price changes for compliance and debugging';
COMMENT ON COLUMN services_audit.change_reason IS 'Reason for the price change (e.g., manual update, bulk adjustment, import)';
COMMENT ON TRIGGER audit_service_price_changes ON services IS 'Automatically logs service price changes to audit table';
