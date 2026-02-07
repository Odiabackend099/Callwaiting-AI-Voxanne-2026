-- ============================================
-- Managed Telephony Schema
-- Adds support for Twilio Subaccount-based phone provisioning
-- alongside existing BYOC (Bring Your Own Carrier) model
-- ============================================

-- ============================================
-- STEP 1: Add telephony_mode to organizations
-- ============================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS telephony_mode TEXT DEFAULT 'byoc'
  CHECK (telephony_mode IN ('byoc', 'managed', 'none'));

CREATE INDEX IF NOT EXISTS idx_organizations_telephony_mode
  ON organizations(telephony_mode) WHERE telephony_mode = 'managed';

-- ============================================
-- STEP 2: Twilio Subaccounts Table
-- Stores one subaccount per managed organization
-- Credentials encrypted with AES-256-GCM (same as org_credentials)
-- ============================================

CREATE TABLE IF NOT EXISTS twilio_subaccounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Twilio identifiers
  twilio_account_sid TEXT NOT NULL UNIQUE,
  twilio_auth_token_encrypted TEXT NOT NULL,
  friendly_name TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),

  -- A2P 10DLC regulatory compliance
  a2p_brand_id TEXT,
  a2p_campaign_id TEXT,
  a2p_registration_status TEXT DEFAULT 'pending'
    CHECK (a2p_registration_status IN ('pending', 'submitted', 'approved', 'rejected', 'not_required')),
  shaken_stir_enabled BOOLEAN DEFAULT false,

  -- Billing
  stripe_customer_id TEXT,
  monthly_number_cost_cents INTEGER DEFAULT 150,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  suspension_reason TEXT,

  CONSTRAINT one_subaccount_per_org UNIQUE (org_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_twilio_subaccounts_org_id
  ON twilio_subaccounts(org_id);
CREATE INDEX IF NOT EXISTS idx_twilio_subaccounts_active
  ON twilio_subaccounts(status) WHERE status = 'active';

-- ============================================
-- STEP 3: Managed Phone Numbers Table
-- Tracks numbers purchased in Twilio subaccounts
-- ============================================

CREATE TABLE IF NOT EXISTS managed_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subaccount_id UUID NOT NULL REFERENCES twilio_subaccounts(id) ON DELETE CASCADE,

  -- Phone number details
  phone_number TEXT NOT NULL,
  twilio_phone_sid TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL DEFAULT 'US',
  number_type TEXT NOT NULL DEFAULT 'local'
    CHECK (number_type IN ('local', 'toll_free', 'mobile')),

  -- Vapi registration
  vapi_phone_id TEXT,
  vapi_credential_id TEXT,

  -- Capabilities
  voice_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,

  -- Status
  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'released', 'failed')),

  -- Billing
  monthly_cost_cents INTEGER NOT NULL DEFAULT 150,

  -- Timestamps
  provisioned_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_phone_per_org UNIQUE (org_id, phone_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_managed_numbers_org
  ON managed_phone_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_managed_numbers_subaccount
  ON managed_phone_numbers(subaccount_id);
CREATE INDEX IF NOT EXISTS idx_managed_numbers_phone
  ON managed_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_managed_numbers_vapi
  ON managed_phone_numbers(vapi_phone_id) WHERE vapi_phone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_managed_numbers_active
  ON managed_phone_numbers(org_id, status) WHERE status = 'active';

-- ============================================
-- STEP 4: Row Level Security
-- ============================================

ALTER TABLE twilio_subaccounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Org users can view their own subaccount
CREATE POLICY "Users view own subaccount"
  ON twilio_subaccounts FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

-- Org users can view their own managed numbers
CREATE POLICY "Users view own managed numbers"
  ON managed_phone_numbers FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

-- Service role has full access (all writes are server-side)
CREATE POLICY "Service role full access on twilio_subaccounts"
  ON twilio_subaccounts FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access on managed_phone_numbers"
  ON managed_phone_numbers FOR ALL TO service_role
  USING (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE twilio_subaccounts IS 'Twilio subaccounts created for managed telephony orgs. One subaccount per org, isolating usage/logs/billing.';
COMMENT ON TABLE managed_phone_numbers IS 'Phone numbers purchased in Twilio subaccounts. Tracks Vapi registration and billing.';
COMMENT ON COLUMN twilio_subaccounts.twilio_auth_token_encrypted IS 'AES-256-GCM encrypted auth token in format: iv:authTag:content';
COMMENT ON COLUMN managed_phone_numbers.vapi_phone_id IS 'Vapi phone number UUID used for outbound calls. Set after successful Vapi import.';
