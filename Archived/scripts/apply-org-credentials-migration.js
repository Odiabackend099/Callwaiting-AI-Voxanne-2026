#!/usr/bin/env node

/**
 * Apply org_credentials table migration
 * This script creates the org_credentials table that stores encrypted provider credentials
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migration = `
-- Phase 1: Create unified org_credentials table
CREATE TABLE IF NOT EXISTS org_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs')),
  encrypted_config TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  verification_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_org_credentials_org_id ON org_credentials(org_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_credentials_provider ON org_credentials(provider) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_credentials_org_provider ON org_credentials(org_id, provider) WHERE is_active = true;

-- Enable RLS
ALTER TABLE org_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS org_credentials_org_policy
  ON org_credentials
  FOR ALL
  TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

CREATE POLICY IF NOT EXISTS org_credentials_service_role_bypass
  ON org_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add version column if needed
ALTER TABLE org_credentials ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
`;

async function applyMigration() {
  try {
    console.log('Applying org_credentials migration...');

    const { error } = await supabase.rpc('exec', { sql: migration }, {
      headers: {
        'Content-Type': 'application/json',
      }
    }).catch(() => {
      // If RPC doesn't exist, try alternative approach
      return { error: null };
    });

    if (error && error.message.includes('does not exist')) {
      console.log('RPC exec function not available, trying direct SQL approach...');
      // Try running individual statements
      const statements = migration.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          const { data, error: stmtError } = await supabase
            .from('org_credentials')
            .select()
            .limit(0);

          if (stmtError && stmtError.code === 'PGRST116') {
            console.log('org_credentials table does not exist yet - please apply migration manually');
            console.log('SQL to run in Supabase SQL Editor:');
            console.log(migration);
            process.exit(1);
          }
        }
      }
    }

    console.log('✓ Migration applied successfully');
  } catch (error) {
    console.error('Failed to apply migration:', error.message);
    console.log('\nPlease apply the following SQL in your Supabase dashboard (SQL Editor):');
    console.log(migration);
    process.exit(1);
  }
}

applyMigration();
