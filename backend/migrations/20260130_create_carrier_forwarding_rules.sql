-- Migration: Create carrier_forwarding_rules table (Single Source of Truth for GSM codes)
-- Purpose: Centralize all GSM forwarding code definitions for every country/carrier combination
-- Date: 2026-01-30
-- Feature: Global Hybrid Telephony Infrastructure

-- Create the carrier_forwarding_rules table
CREATE TABLE IF NOT EXISTS carrier_forwarding_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Country identification
    country_code TEXT NOT NULL,              -- ISO 3166-1 alpha-2: 'NG', 'TR', 'GB', 'US'
    country_name TEXT NOT NULL,              -- Display name: 'Nigeria', 'Turkey', 'United Kingdom', 'United States'

    -- Smart routing logic
    recommended_twilio_country TEXT NOT NULL, -- 'US' or 'GB' for provisioning

    -- Carrier information (JSONB for flexibility)
    carrier_codes JSONB NOT NULL,            -- { "glo": { "total_ai": "**67*{number}#", "safety_net": "**67*{number}#", "deactivate": "##67#" } }

    -- Cost/latency metadata
    forwarding_cost_estimate TEXT,           -- "~₦30/min via US" or "Local rate"
    avg_latency_ms INTEGER,                  -- Average call latency

    -- User guidance
    warning_message TEXT,                    -- "⚠️ Use Glo Mobile or MTN International Bundle to avoid high charges"
    setup_notes TEXT,                        -- Additional setup instructions

    -- Administrative
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_country_code UNIQUE(country_code)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_carrier_rules_country
ON carrier_forwarding_rules(country_code)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_carrier_rules_recommended
ON carrier_forwarding_rules(recommended_twilio_country);

-- Add comments for documentation
COMMENT ON TABLE carrier_forwarding_rules IS 'Single Source of Truth for GSM call forwarding codes by country and carrier';
COMMENT ON COLUMN carrier_forwarding_rules.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN carrier_forwarding_rules.carrier_codes IS 'JSONB object with carrier names as keys and GSM code objects as values';
COMMENT ON COLUMN carrier_forwarding_rules.recommended_twilio_country IS 'Country code for smart Twilio number provisioning (cost optimization)';

-- Seed data for 4 countries: Nigeria, Turkey, United Kingdom, United States

-- Nigeria (forwards to US for cost savings: ₦30/min vs ₦350/min)
INSERT INTO carrier_forwarding_rules (
    country_code,
    country_name,
    recommended_twilio_country,
    carrier_codes,
    forwarding_cost_estimate,
    warning_message
) VALUES (
    'NG',
    'Nigeria',
    'US',
    '{
        "glo": {
            "total_ai": "**67*{number}#",
            "safety_net": "**67*{number}#",
            "deactivate": "##67#"
        },
        "mtn": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        },
        "airtel": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        },
        "9mobile": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        }
    }'::jsonb,
    '~₦30/min (via US)',
    '⚠️ IMPORTANT: For standard rates (~₦30/min), use Glo Mobile or ensure you have an MTN International Calling Bundle active. Without this, calls may cost ₦350+/min.'
);

-- Turkey (forwards to US for cost savings)
INSERT INTO carrier_forwarding_rules (
    country_code,
    country_name,
    recommended_twilio_country,
    carrier_codes,
    forwarding_cost_estimate,
    warning_message
) VALUES (
    'TR',
    'Turkey',
    'US',
    '{
        "turkcell": {
            "total_ai": "*21*{number}#",
            "safety_net": "*61*{number}#",
            "deactivate": "#21#"
        },
        "vodafone": {
            "total_ai": "*21*{number}#",
            "safety_net": "*61*{number}#",
            "deactivate": "#21#"
        },
        "turk_telekom": {
            "total_ai": "*21*{number}#",
            "safety_net": "*61*{number}#",
            "deactivate": "#21#"
        }
    }'::jsonb,
    'Standard international rate',
    '⚠️ International calling rates apply. Check with your operator for US calling packages to reduce costs.'
);

-- United Kingdom (forwards to UK local for optimal latency and cost)
INSERT INTO carrier_forwarding_rules (
    country_code,
    country_name,
    recommended_twilio_country,
    carrier_codes,
    forwarding_cost_estimate,
    warning_message
) VALUES (
    'GB',
    'United Kingdom',
    'GB',
    '{
        "ee": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        },
        "vodafone": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        },
        "o2": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        },
        "three": {
            "total_ai": "**21*{number}#",
            "safety_net": "**62*{number}#",
            "deactivate": "##21#"
        }
    }'::jsonb,
    'Local rate',
    'Forwarding is charged at local UK rates. No international charges apply.'
);

-- United States (forwards to US local - existing functionality)
INSERT INTO carrier_forwarding_rules (
    country_code,
    country_name,
    recommended_twilio_country,
    carrier_codes,
    forwarding_cost_estimate,
    warning_message
) VALUES (
    'US',
    'United States',
    'US',
    '{
        "att": {
            "total_ai": "*21*{number}#",
            "safety_net": "*004*{number}*11*{ring_time}#",
            "deactivate": "#21#"
        },
        "tmobile": {
            "total_ai": "**21*{number}#",
            "safety_net": "**61*{number}*11*{ring_time}#",
            "deactivate": "##21#"
        },
        "verizon": {
            "total_ai": "*72{number}",
            "safety_net": "*71{number}",
            "deactivate": "*73"
        },
        "sprint": {
            "total_ai": "*72{number}",
            "safety_net": "*71{number}",
            "deactivate": "*73"
        }
    }'::jsonb,
    'Local rate',
    'Call forwarding is included in most US mobile plans at no additional charge.'
);

-- Enable Row Level Security (RLS)
ALTER TABLE carrier_forwarding_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (carrier rules are not sensitive)
CREATE POLICY "carrier_rules_public_read" ON carrier_forwarding_rules
    FOR SELECT
    USING (is_active = true);

-- RLS Policy: Only service role can insert/update/delete
CREATE POLICY "carrier_rules_service_write" ON carrier_forwarding_rules
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Verification queries (commented out for production)
-- SELECT country_code, country_name, recommended_twilio_country FROM carrier_forwarding_rules ORDER BY country_code;
-- SELECT country_code, jsonb_pretty(carrier_codes) FROM carrier_forwarding_rules WHERE country_code = 'NG';
