-- Migration: Create phone_number_mapping table for BYOC multi-tenant inbound routing
-- Date: 2026-01-12
-- Purpose: Link incoming phone numbers to clinic organizations for automatic credential lookup

BEGIN;

-- Create phone_number_mapping table
CREATE TABLE IF NOT EXISTS phone_number_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- The inbound phone number (E.164 format: +1-555-0100)
  inbound_phone_number TEXT NOT NULL,
  
  -- Clinic/organization name for easy reference
  clinic_name TEXT,
  
  -- Reference to Vapi's phone number ID (if using Vapi Numbers)
  vapi_phone_number_id TEXT,
  
  -- Whether this mapping is active
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ensure one phone number maps to exactly one org
  CONSTRAINT unique_phone_per_org UNIQUE(org_id, inbound_phone_number)
);

-- Index for fast lookup when call arrives
CREATE INDEX IF NOT EXISTS idx_phone_mapping_phone 
  ON phone_number_mapping(inbound_phone_number) 
  WHERE is_active = true;

-- Index for org context
CREATE INDEX IF NOT EXISTS idx_phone_mapping_org 
  ON phone_number_mapping(org_id) 
  WHERE is_active = true;

-- Enable RLS for multi-tenant isolation
ALTER TABLE phone_number_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/edit phone mappings for their org
CREATE POLICY phone_mapping_select_own_org ON phone_number_mapping
  FOR SELECT
  USING (org_id IN (
    SELECT id FROM organizations 
    WHERE created_by = auth.uid() 
       OR id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY phone_mapping_insert_own_org ON phone_number_mapping
  FOR INSERT
  WITH CHECK (org_id IN (
    SELECT id FROM organizations 
    WHERE created_by = auth.uid() 
       OR id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY phone_mapping_update_own_org ON phone_number_mapping
  FOR UPDATE
  USING (org_id IN (
    SELECT id FROM organizations 
    WHERE created_by = auth.uid() 
       OR id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT id FROM organizations 
    WHERE created_by = auth.uid() 
       OR id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY phone_mapping_delete_own_org ON phone_number_mapping
  FOR DELETE
  USING (org_id IN (
    SELECT id FROM organizations 
    WHERE created_by = auth.uid() 
       OR id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Add comment for documentation
COMMENT ON TABLE phone_number_mapping IS 'Maps inbound phone numbers to clinic organizations for automatic credential lookup during voice calls';
COMMENT ON COLUMN phone_number_mapping.inbound_phone_number IS 'E.164 format phone number (e.g., +1-555-0100)';
COMMENT ON COLUMN phone_number_mapping.vapi_phone_number_id IS 'Reference to Vapi phone number ID if using Vapi Numbers';

COMMIT;
