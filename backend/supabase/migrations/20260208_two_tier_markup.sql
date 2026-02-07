-- Two-Tier Markup: BYOC 50% (×1.5) vs Managed 300% (×4)
-- BYOC customers pay their own Twilio, so lower markup (Vapi only).
-- Managed customers get everything from Voxanne, so higher markup.

-- Change default from 100% to 50% (BYOC-friendly default for new orgs)
ALTER TABLE organizations
  ALTER COLUMN wallet_markup_percent SET DEFAULT 50;

-- Backfill existing BYOC orgs (currently at old 100% default)
UPDATE organizations
  SET wallet_markup_percent = 50
  WHERE telephony_mode = 'byoc'
    AND wallet_markup_percent = 100;

-- Backfill existing managed orgs to 300% markup
UPDATE organizations
  SET wallet_markup_percent = 300
  WHERE telephony_mode = 'managed'
    AND wallet_markup_percent = 100;
