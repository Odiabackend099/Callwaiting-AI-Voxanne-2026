-- Migration: Extend hybrid_forwarding_configs for multi-country support
-- Purpose: Add country_code and carrier_name columns for joining with carrier_forwarding_rules
-- Date: 2026-01-30
-- Feature: Global Hybrid Telephony Infrastructure

-- Add country_code column (ISO 3166-1 alpha-2)
-- This will eventually replace carrier_country_code for consistency
ALTER TABLE hybrid_forwarding_configs
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'US';

-- Add carrier_name column (maps to keys in carrier_forwarding_rules.carrier_codes JSONB)
-- Examples: 'glo', 'mtn', 'airtel', '9mobile' (Nigeria), 'turkcell', 'vodafone' (Turkey), etc.
ALTER TABLE hybrid_forwarding_configs
ADD COLUMN IF NOT EXISTS carrier_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN hybrid_forwarding_configs.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., NG, TR, GB, US). Used for joining with carrier_forwarding_rules table.';
COMMENT ON COLUMN hybrid_forwarding_configs.carrier_name IS 'Carrier slug from carrier_forwarding_rules.carrier_codes JSONB keys (e.g., glo, mtn, turkcell, att, tmobile). User-selected carrier for GSM code generation.';

-- Create index for joining with carrier_forwarding_rules
CREATE INDEX IF NOT EXISTS idx_forwarding_configs_country
ON hybrid_forwarding_configs(country_code);

-- Create composite index for efficient carrier lookups
CREATE INDEX IF NOT EXISTS idx_forwarding_configs_country_carrier
ON hybrid_forwarding_configs(country_code, carrier_name)
WHERE carrier_name IS NOT NULL;

-- Note: We keep the existing 'carrier' column for backward compatibility
-- The new 'carrier_name' column will be the primary field going forward
-- Legacy 'carrier' values: 'att', 'tmobile', 'verizon', 'sprint', 'other_gsm', 'other_cdma', 'international'
-- New 'carrier_name' values: 'att', 'tmobile', 'verizon', 'sprint' (US), 'glo', 'mtn', 'airtel', '9mobile' (NG),
--                            'turkcell', 'vodafone', 'turk_telekom' (TR), 'ee', 'vodafone', 'o2', 'three' (GB)

-- Migration strategy:
-- 1. New configs will populate country_code and carrier_name from carrier_forwarding_rules
-- 2. Existing configs retain their current 'carrier' values (US carriers)
-- 3. Future: Deprecate 'carrier' column once all configs migrated

-- Verification queries (commented out for production)
-- SELECT id, country_code, carrier_name, carrier FROM hybrid_forwarding_configs LIMIT 10;
-- SELECT country_code, carrier_name, COUNT(*) FROM hybrid_forwarding_configs GROUP BY country_code, carrier_name;
