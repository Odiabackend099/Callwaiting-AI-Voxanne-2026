-- Phase 6 Performance Optimization: Database Indexes
-- 
-- These indexes significantly improve query performance under concurrent load
-- Expected improvement: 30-50% latency reduction
--
-- Run in Supabase SQL Editor

-- 1. Composite index for conflict detection queries
-- This index optimizes: SELECT * FROM appointments 
--   WHERE org_id = ? AND contact_id = ? AND scheduled_at BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_appointments_org_contact_date 
ON appointments(org_id, contact_id, scheduled_at DESC);

-- 2. Organization isolation index
-- This index optimizes: SELECT * FROM appointments WHERE org_id = ?
CREATE INDEX IF NOT EXISTS idx_appointments_org_id 
ON appointments(org_id);

-- 3. Contact-based lookups
-- This index optimizes: SELECT * FROM appointments WHERE contact_id = ?
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id 
ON appointments(contact_id);

-- 4. Time-range queries
-- This index optimizes: SELECT * FROM appointments WHERE scheduled_at BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at 
ON appointments(scheduled_at DESC);

-- 5. Contact verification by org
-- This index optimizes: SELECT * FROM contacts WHERE id = ? AND org_id = ?
CREATE INDEX IF NOT EXISTS idx_contacts_org_id_id 
ON contacts(org_id, id);

-- 6. Organization lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_organizations_id 
ON organizations(id);

-- 7. Status filtering
-- This index optimizes: SELECT * FROM appointments WHERE org_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_appointments_org_status 
ON appointments(org_id, status);

-- Analyze impact
-- After creating indexes, run:
-- ANALYZE;
-- 
-- Then compare query plans:
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT * FROM appointments 
-- WHERE org_id = 'test-org-id' 
-- AND contact_id = 'test-contact-id' 
-- AND scheduled_at >= NOW()
-- LIMIT 1;

-- Expected index sizes (approximate):
-- idx_appointments_org_contact_date: ~100KB
-- idx_appointments_org_id: ~80KB  
-- idx_appointments_contact_id: ~80KB
-- idx_appointments_scheduled_at: ~80KB
-- Total additional storage: ~340KB (negligible)

-- Performance improvement estimates:
-- Conflict detection: 80-100ms → 10-20ms (8-10x faster)
-- Org isolation: 100-150ms → 5-10ms (10-15x faster)
-- Overall booking latency: 276ms → 200ms (25% improvement)
-- Under concurrency: 770ms → 380-420ms (50% improvement)

-- Maintenance notes:
-- - Indexes are automatically maintained on INSERT/UPDATE
-- - No manual REINDEX needed unless corruption suspected
-- - Monitor index bloat with: SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes;
-- - Vacuum indexes periodically: VACUUM ANALYZE appointments;
