-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_managed_numbers_direction
  ON managed_phone_numbers(org_id, routing_direction, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agents_linked_phone
  ON agents(linked_phone_number_id) WHERE linked_phone_number_id IS NOT NULL;
