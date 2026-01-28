-- Performance Indexes Migration - Successfully Applied
-- Date: 2026-01-28
-- Project: Callwaiting AI (lbjymlodxprzqgtyqtcq)
-- Status: ✅ SUCCESSFULLY APPLIED

-- ============================================================================
-- CORRECTIONS MADE TO ORIGINAL MIGRATION
-- ============================================================================

-- 1. Removed CONCURRENTLY keyword (not supported in transaction blocks)
-- 2. Fixed column name: phone_number → from_number/to_number (call_logs table)
-- 3. Fixed enum value: 'scheduled' → 'confirmed' (appointment_status enum)
-- 4. Added NULL checks to partial indexes for better performance

-- ============================================================================
-- INDEXES SUCCESSFULLY CREATED
-- ============================================================================

-- 1. idx_call_logs_org_from_created (16 kB)
--    Table: call_logs
--    Columns: org_id, from_number, created_at DESC
--    WHERE: org_id IS NOT NULL AND from_number IS NOT NULL
--    Purpose: Contact detail page - fetch calls by from_number

-- 2. idx_call_logs_org_to_created (16 kB)
--    Table: call_logs
--    Columns: org_id, to_number, created_at DESC
--    WHERE: org_id IS NOT NULL AND to_number IS NOT NULL
--    Purpose: Contact detail page - fetch calls by to_number

-- 3. idx_appointments_org_contact_scheduled (16 kB)
--    Table: appointments
--    Columns: org_id, contact_id, scheduled_at DESC
--    WHERE: org_id IS NOT NULL AND contact_id IS NOT NULL
--    Purpose: Contact appointment history

-- 4. idx_appointments_org_status_confirmed (16 kB)
--    Table: appointments
--    Columns: org_id, status, scheduled_at
--    WHERE: org_id IS NOT NULL AND status = 'confirmed'
--    Purpose: Availability checks - confirmed appointments only

-- 5. idx_messages_org_contact_method (8192 bytes)
--    Table: messages
--    Columns: org_id, contact_id, method, sent_at DESC
--    WHERE: org_id IS NOT NULL AND contact_id IS NOT NULL
--    Purpose: Message duplicate prevention and contact message history

-- 6. idx_services_org_created (16 kB)
--    Table: services
--    Columns: org_id, created_at DESC
--    WHERE: org_id IS NOT NULL
--    Purpose: Services list and lead scoring calculations

-- ============================================================================
-- PERFORMANCE IMPROVEMENTS EXPECTED
-- ============================================================================

-- • Contact detail page queries: Significant speedup for call history lookup
-- • Appointment availability checks: Faster time-range queries with partial index
-- • Message duplicate prevention: Efficient lookup for reminder sending
-- • Services listing: Optimized for lead scoring and pipeline calculations
-- • Overall dashboard performance: Reduced query times across multiple modules

-- ============================================================================
-- VERIFICATION COMPLETED
-- ============================================================================

-- ✅ All 6 indexes created successfully
-- ✅ Index sizes verified (8-16 kB each)
-- ✅ Partial indexes with proper WHERE clauses
-- ✅ Multi-column composite indexes for optimal query performance
-- ✅ Correct column mappings based on actual table structure

-- ============================================================================
-- ROLLBACK COMMANDS (if needed)
-- ============================================================================

-- DROP INDEX IF EXISTS idx_call_logs_org_from_created;
-- DROP INDEX IF EXISTS idx_call_logs_org_to_created;
-- DROP INDEX IF EXISTS idx_appointments_org_contact_scheduled;
-- DROP INDEX IF EXISTS idx_appointments_org_status_confirmed;
-- DROP INDEX IF EXISTS idx_messages_org_contact_method;
-- DROP INDEX IF EXISTS idx_services_org_created;
