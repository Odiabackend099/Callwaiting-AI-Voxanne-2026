-- Priority 6: Database Query Optimization - Missing Performance Indexes
-- Date: 2026-01-28
-- Purpose: Add missing indexes for frequently queried columns to improve dashboard and contact query performance

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index 1: Contact detail page - calls by phone number
-- Used by: backend/src/routes/contacts.ts (lines 232-246)
-- Query: SELECT * FROM call_logs WHERE org_id = X AND phone_number = Y ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_org_phone_created
ON call_logs(org_id, phone_number, created_at DESC)
WHERE org_id IS NOT NULL;

COMMENT ON INDEX idx_call_logs_org_phone_created IS
'Performance index for contact detail page - fetch calls by phone number';

-- Index 2: Appointments by contact
-- Used by: backend/src/routes/contacts.ts (lines 239-246)
-- Query: SELECT * FROM appointments WHERE org_id = X AND contact_id = Y ORDER BY scheduled_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_org_contact_scheduled
ON appointments(org_id, contact_id, scheduled_at DESC)
WHERE org_id IS NOT NULL;

COMMENT ON INDEX idx_appointments_org_contact_scheduled IS
'Performance index for contact appointment history';

-- Index 3: Availability checks (find scheduled appointments in time range)
-- Used by: backend/src/routes/appointments.ts (lines 363-394)
-- Query: SELECT * FROM appointments WHERE org_id = X AND status = 'scheduled' AND scheduled_at BETWEEN start AND end
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_org_status_scheduled
ON appointments(org_id, status, scheduled_at)
WHERE org_id IS NOT NULL AND status = 'scheduled';

COMMENT ON INDEX idx_appointments_org_status_scheduled IS
'Partial index for availability checks - only indexes scheduled appointments';

-- Index 4: Message duplicate prevention
-- Used by: backend/src/routes/appointments.ts (line 438 - reminder sending)
-- Query: Check if reminder already sent to contact via specific method
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_org_contact_method
ON messages(org_id, contact_id, method, sent_at DESC)
WHERE org_id IS NOT NULL;

COMMENT ON INDEX idx_messages_org_contact_method IS
'Performance index for message duplicate prevention and contact message history';

-- Index 5: Services lookup (used in lead scoring and pipeline value calculation)
-- Used by: backend/src/routes/services.ts, backend/src/services/lead-scoring.ts
-- Query: SELECT * FROM services WHERE org_id = X ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_org_created
ON services(org_id, created_at DESC)
WHERE org_id IS NOT NULL;

COMMENT ON INDEX idx_services_org_created IS
'Performance index for services list and lead scoring calculations';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify indexes are being used:

-- EXPLAIN ANALYZE
-- SELECT * FROM call_logs
-- WHERE org_id = 'some-uuid' AND phone_number = '+1234567890'
-- ORDER BY created_at DESC
-- LIMIT 10;
-- Expected: Index Scan using idx_call_logs_org_phone_created

-- EXPLAIN ANALYZE
-- SELECT * FROM appointments
-- WHERE org_id = 'some-uuid' AND contact_id = 'some-uuid'
-- ORDER BY scheduled_at DESC
-- LIMIT 10;
-- Expected: Index Scan using idx_appointments_org_contact_scheduled

-- EXPLAIN ANALYZE
-- SELECT * FROM appointments
-- WHERE org_id = 'some-uuid' AND status = 'scheduled'
-- AND scheduled_at BETWEEN '2026-01-28' AND '2026-01-29';
-- Expected: Index Scan using idx_appointments_org_status_scheduled

-- EXPLAIN ANALYZE
-- SELECT * FROM messages
-- WHERE org_id = 'some-uuid' AND contact_id = 'some-uuid' AND method = 'sms'
-- ORDER BY sent_at DESC
-- LIMIT 5;
-- Expected: Index Scan using idx_messages_org_contact_method

-- EXPLAIN ANALYZE
-- SELECT * FROM services
-- WHERE org_id = 'some-uuid'
-- ORDER BY created_at DESC;
-- Expected: Index Scan using idx_services_org_created

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this migration (DROP indexes):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_call_logs_org_phone_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_appointments_org_contact_scheduled;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_appointments_org_status_scheduled;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_messages_org_contact_method;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_services_org_created;
