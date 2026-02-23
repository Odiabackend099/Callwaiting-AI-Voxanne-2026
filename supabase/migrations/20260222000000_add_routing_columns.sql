-- Add routing columns to tables
ALTER TABLE IF EXISTS managed_phone_numbers
  ADD COLUMN IF NOT EXISTS routing_direction TEXT DEFAULT 'inbound'
    CHECK (routing_direction IN ('inbound', 'outbound', 'unassigned'));

ALTER TABLE IF EXISTS agents
  ADD COLUMN IF NOT EXISTS linked_phone_number_id UUID REFERENCES managed_phone_numbers(id) ON DELETE SET NULL;
