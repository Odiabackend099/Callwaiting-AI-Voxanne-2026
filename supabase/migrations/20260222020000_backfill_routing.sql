-- Backfill existing data
UPDATE managed_phone_numbers SET routing_direction = 'inbound' WHERE routing_direction IS NULL;

UPDATE agents a SET linked_phone_number_id = mn.id FROM managed_phone_numbers mn
WHERE a.org_id = mn.org_id AND a.role = 'outbound' AND a.vapi_phone_number_id = mn.vapi_phone_id AND mn.status = 'active' AND a.linked_phone_number_id IS NULL;
