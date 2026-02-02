-- Migration: Create calendly_bookings table
-- Description: Stores Calendly booking events from webhook
-- Created: 2026-02-02

CREATE TABLE IF NOT EXISTS calendly_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_event_id TEXT UNIQUE NOT NULL,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_phone TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled, canceled, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint to validate status values
ALTER TABLE calendly_bookings
  ADD CONSTRAINT calendly_bookings_status_check
  CHECK (status IN ('scheduled', 'canceled', 'completed'));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_calendly_bookings_email
  ON calendly_bookings(invitee_email);

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_scheduled
  ON calendly_bookings(scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_status
  ON calendly_bookings(status);

CREATE INDEX IF NOT EXISTS idx_calendly_bookings_created
  ON calendly_bookings(created_at DESC);

-- Partial index for active bookings only
CREATE INDEX IF NOT EXISTS idx_calendly_bookings_active
  ON calendly_bookings(scheduled_at DESC)
  WHERE status = 'scheduled';

-- Add table comment
COMMENT ON TABLE calendly_bookings IS 'Stores Calendly booking events from webhook';
COMMENT ON COLUMN calendly_bookings.calendly_event_id IS 'Unique Calendly event identifier';
COMMENT ON COLUMN calendly_bookings.status IS 'Booking status: scheduled, canceled, or completed';
COMMENT ON COLUMN calendly_bookings.scheduled_at IS 'When the appointment is scheduled for';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_calendly_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendly_bookings_updated_at
  BEFORE UPDATE ON calendly_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_calendly_bookings_updated_at();
