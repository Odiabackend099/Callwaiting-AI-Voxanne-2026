-- Migration: Create messages table for SMS/email audit trail
-- Tracks all outbound messages (SMS follow-ups, reminders, shares) for compliance
-- Date: 2026-01-25

-- Create messages table with full audit trail
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    call_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,

    -- Message metadata
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    method TEXT NOT NULL CHECK (method IN ('sms', 'email')),
    recipient TEXT NOT NULL,  -- Phone number or email address
    subject TEXT,  -- For emails only
    content TEXT NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    error_message TEXT,

    -- Service tracking
    service_provider TEXT,  -- 'twilio', 'resend', etc.
    external_message_id TEXT,  -- ID from SMS/email provider

    -- Timestamps
    sent_at TIMESTAMPTZ,  -- Set only when message is actually sent/delivered
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_org_id ON messages(org_id);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_call_id ON messages(call_id);
CREATE INDEX idx_messages_method ON messages(method);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_org_method_sent ON messages(org_id, method, sent_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can only see messages for their organization
CREATE POLICY messages_org_isolation ON messages
    FOR ALL TO authenticated
    USING (org_id = (SELECT public.auth_org_id()))
    WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Service role has full access
CREATE POLICY messages_service_role ON messages
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Immutability trigger for org_id
CREATE TRIGGER prevent_org_id_change_messages BEFORE UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
    EXECUTE FUNCTION prevent_org_id_change();

-- Comments for documentation
COMMENT ON TABLE messages IS 'Audit trail for all outbound SMS and email messages sent by the system';
COMMENT ON COLUMN messages.direction IS 'Direction: inbound (received) or outbound (sent by system)';
COMMENT ON COLUMN messages.method IS 'Communication method: sms or email';
COMMENT ON COLUMN messages.status IS 'Delivery status: pending, sent, failed, or bounced';
COMMENT ON COLUMN messages.external_message_id IS 'Reference ID from external provider (Twilio SID, Resend ID, etc.)';
