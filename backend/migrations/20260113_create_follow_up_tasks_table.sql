-- Migration: Create follow_up_tasks table for context handoff
-- Enables Sarah (outbound agent) to receive handoffs from Voxanne (inbound)
-- Part of Master Orchestrator Task 2: Context-Aware Handoff
-- Create task_type enum
CREATE TYPE task_type AS ENUM ('sms_follow_up', 'call_back', 'email');
-- Create task_status enum  
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
-- Create task_priority enum
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
-- Create follow_up_tasks table
CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    -- Task details
    task_type task_type NOT NULL,
    priority task_priority DEFAULT 'medium',
    service_context TEXT NOT NULL,
    -- e.g., "facelift", "rhinoplasty"
    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    -- Status tracking
    status task_status DEFAULT 'pending',
    error_message TEXT,
    -- Additional context
    metadata JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes for performance
CREATE INDEX idx_follow_up_tasks_org_id ON follow_up_tasks(org_id);
CREATE INDEX idx_follow_up_tasks_lead_id ON follow_up_tasks(lead_id);
CREATE INDEX idx_follow_up_tasks_status ON follow_up_tasks(status);
CREATE INDEX idx_follow_up_tasks_scheduled_for ON follow_up_tasks(scheduled_for);
CREATE INDEX idx_follow_up_tasks_status_scheduled ON follow_up_tasks(status, scheduled_for)
WHERE status = 'pending';
-- Updated_at trigger
CREATE TRIGGER update_follow_up_tasks_updated_at BEFORE
UPDATE ON follow_up_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Row Level Security (RLS)
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;
-- Policy: Users can only see tasks for their organization
CREATE POLICY follow_up_tasks_org_isolation ON follow_up_tasks FOR ALL USING (
    org_id = current_setting('app.current_org_id', true)::UUID
);
-- Policy: Service role has full access
CREATE POLICY follow_up_tasks_service_role ON follow_up_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Immutability trigger for org_id
CREATE TRIGGER prevent_org_id_update_follow_up_tasks BEFORE
UPDATE ON follow_up_tasks FOR EACH ROW
    WHEN (
        OLD.org_id IS DISTINCT
        FROM NEW.org_id
    ) EXECUTE FUNCTION prevent_org_id_update();
-- Comments
COMMENT ON TABLE follow_up_tasks IS 'Follow-up tasks for outbound agent (Sarah) after inbound calls';
COMMENT ON COLUMN follow_up_tasks.service_context IS 'Service mentioned during call (e.g., facelift, botox)';
COMMENT ON COLUMN follow_up_tasks.metadata IS 'Additional context: patient_name, patient_phone, etc.';
COMMENT ON COLUMN follow_up_tasks.scheduled_for IS 'When to execute this task (typically 5 min after call)';