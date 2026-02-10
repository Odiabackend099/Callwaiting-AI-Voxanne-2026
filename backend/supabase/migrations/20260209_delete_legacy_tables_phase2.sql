-- Phase 2: Delete 9 Legacy/Deprecated Tables
-- Risk Level: LOW (8 rows total, mostly test data)
-- Date: 2026-02-09
-- Purpose: Remove old code, archived data, and test fixtures

-- ============================================================
-- PHASE 2: LEGACY TABLES DELETION (9 tables)
-- ============================================================
-- These tables contain old/deprecated code
-- Total rows: 8 (mostly 0 rows except call_logs_legacy with 8 rows)
-- Risk: LOW - archived data only
-- ============================================================

-- Legacy Call Logs (Replaced by 'calls' table) - 1 table
-- Contains: 8 rows of archived call data
-- Reason: Replaced by current 'calls' table
-- Recovery: Available in PITR if needed (7 days)
DROP TABLE IF EXISTS call_logs_legacy CASCADE;

-- Demo Data (Should never be in production) - 3 tables
-- Contains: 0 rows each (test fixtures)
-- Reason: Development/testing only, not production-ready
DROP TABLE IF EXISTS demo_assets CASCADE;
DROP TABLE IF EXISTS demo_bookings CASCADE;
DROP TABLE IF EXISTS demo_send_log CASCADE;

-- Abandoned Features (Never activated) - 2 tables
-- Contains: 0 rows each
-- Reason: Features were designed but never implemented
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS appointment_holds CASCADE;

-- Development Only (Not production) - 1 table
-- Contains: 0 rows
-- Reason: Voice testing transcripts, development use only
DROP TABLE IF EXISTS voice_test_transcripts CASCADE;

-- Legacy Monitoring (Old approach) - 1 table
-- Contains: 2 rows of old verification data
-- Reason: Superseded by modern monitoring approach
DROP TABLE IF EXISTS backup_verification_log CASCADE;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Total Tables Deleted: 9
-- Total Rows Deleted: 10 (call_logs_legacy: 8, backup_verification_log: 2)
-- Data Loss Impact: LOW (archived/test data only)
-- Backup: Available (7-day PITR from Supabase)
-- ============================================================
