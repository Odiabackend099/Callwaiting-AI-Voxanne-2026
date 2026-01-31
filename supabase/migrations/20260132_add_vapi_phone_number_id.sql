-- Migration: Add vapi_phone_number_id column to agents table
-- Date: 2026-01-31
-- Purpose: Support outbound agent phone number assignment

BEGIN;

-- Add vapi_phone_number_id column to agents table
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.agents.vapi_phone_number_id IS 'Vapi phone number ID for outbound agents';

COMMIT;
