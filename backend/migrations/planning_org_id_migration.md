# 📋 Planning: org_id Column Migration & Backfill

**Date:** 2025-01-10  
**Task:** Add org_id columns to all existing tables and backfill data  
**Context:** Zero-Trust Warden Phase 1 - Schema Migration from user-based to org-based multi-tenant model  
**Status:** Planning Phase

---

## Problem Statement

The database currently uses a **user-based tenant model** (`user_id` columns), but the code expects an **org-based tenant model** (`org_id` columns). This mismatch prevents the Warden security fixes from being deployed.

**Current State:**
- ✅ `organizations` table exists (foundation migration applied)
- ✅ `public.auth_org_id()` function exists (can extract org_id from JWT)
- ❌ Tables have `user_id` but NO `org_id` columns
- ❌ No data backfilled from `user_id` to `org_id`
- ❌ JWT `app_metadata` doesn't include `org_id` for users

**Target State:**
- ✅ All org-scoped tables have `org_id` columns with NOT NULL constraints
- ✅ All existing data has `org_id` backfilled (1:1 mapping to default org initially)
- ✅ All users have `org_id` in JWT `app_metadata`
- ✅ Immutability triggers can be applied
- ✅ System operates in org-based multi-tenant model

---

## Implementation Phases

### Phase 1: Identify All Tables Requiring org_id (Discovery)

**Goal:** Create comprehensive list of tables that need `org_id` columns

**Steps:**
1. Query database to identify all tables with `user_id` but no `org_id`
2. Identify tables referenced in immutability triggers migration
3. Identify tables that should be org-scoped based on business logic
4. Create migration script with complete list

**Acceptance Criteria:**
- ✅ Complete list of 40+ tables requiring `org_id` columns
- ✅ Tables categorized by priority (critical vs secondary)
- ✅ No org-scoped tables missed

**Risk:** Missing tables could cause data leakage → **Mitigation:** Comprehensive audit of all tables

**Testing:**
- Verify query returns all expected tables
- Cross-reference with immutability triggers migration
- Verify no critical tables are missed

---

### Phase 2: Add org_id Columns to All Tables (Schema Migration)

**Goal:** Add `org_id UUID` columns to all identified tables with proper constraints

**Steps:**
1. Create migration file: `20250110_add_org_id_to_existing_tables.sql`
2. Add `org_id UUID` columns to all tables (nullable initially for backfill)
3. Add foreign key constraints: `REFERENCES organizations(id) ON DELETE CASCADE`
4. Create indexes on `org_id` columns for performance
5. Apply migration in Supabase

**Acceptance Criteria:**
- ✅ All tables have `org_id` column
- ✅ Foreign key constraints added (enforces referential integrity)
- ✅ Indexes created for query performance
- ✅ Migration applies successfully (no errors)

**Risk:** 
- Foreign key constraint fails if organizations table has no data → **Mitigation:** Default org already exists
- Index creation fails on large tables → **Mitigation:** Use `CREATE INDEX IF NOT EXISTS` (idempotent)
- Migration takes too long on large tables → **Mitigation:** Add columns first, then backfill (separate migrations)

**Testing:**
- Verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'X' AND column_name = 'org_id'`
- Verify foreign keys: `SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'`
- Verify indexes: `SELECT indexname FROM pg_indexes WHERE tablename = 'X' AND indexname LIKE '%org_id%'`

**Tables to Update (Critical):**
- call_logs
- call_tracking
- calls
- leads
- agents
- knowledge_base
- knowledge_base_changelog
- integrations
- recording_upload_queue
- imports
- outreach_templates
- campaign_metrics
- phone_blacklist
- hallucination_flags
- kb_sync_log

**Tables to Update (Secondary - user_id exists, may need org_id):**
- agent_configurations
- campaign_phone_numbers
- campaigns
- cold_call_logs
- contacts
- call_lists
- dnc_list
- embeddings
- knowledge_base_chunks
- knowledge_base_documents
- notification_history
- notification_templates
- phone_assistants
- sentiment_analysis
- telephony_audit_log
- user_active_calls
- user_phone_numbers
- user_twilio_subaccounts
- usage_events
- usage_records
- compliance_audit_logs
- consent_records
- credit_transactions
- customer_twilio_keys
- daily_lead_uploads
- notification_rate_limits
- onboarding_events
- payment_events_log
- payments
- billing_cycles

**Tables NOT Requiring org_id (excluded):**
- profiles (uses tenant_id, different model)
- user_profiles (user-specific, not org-scoped)
- user_credits (user-specific)
- user_subscriptions (user-specific)
- customers (user-specific)
- billing_plans (global reference data)
- pricing_tiers (global reference data)
- voice_options (global reference data)
- campaign_templates (global reference data)

---

### Phase 3: Backfill org_id from user_id Data (Data Migration)

**Goal:** Populate `org_id` columns for all existing records using 1:1 mapping to default organization

**Steps:**
1. Create migration file: `20250110_backfill_org_id_from_user_id.sql`
2. For each table with `user_id`, set `org_id = default_org_id` for all records
3. For tables without `user_id` but with FK relationships, backfill via joins
4. Verify no NULL `org_id` values remain
5. Apply NOT NULL constraints after backfill completes

**Strategy:**
- **Direct user_id tables:** `UPDATE table SET org_id = 'a0000000-0000-0000-0000-000000000001' WHERE org_id IS NULL`
- **FK relationship tables:** Backfill via JOIN with parent table
- **Orphaned records:** Set to default org (defensive)

**Acceptance Criteria:**
- ✅ All existing records have `org_id` populated
- ✅ Zero NULL `org_id` values in org-scoped tables
- ✅ Data integrity preserved (no records lost)
- ✅ Backfill completed successfully

**Risk:**
- Orphaned records (user_id doesn't exist) → **Mitigation:** Use `COALESCE` or default org
- Large tables slow backfill → **Mitigation:** Process in batches if needed
- Data corruption during UPDATE → **Mitigation:** Run in transaction, verify before commit

**Testing:**
- Verify counts: `SELECT COUNT(*) FROM table WHERE org_id IS NULL` (should be 0)
- Verify backfill: `SELECT COUNT(*) FROM table WHERE org_id = 'a0000000-0000-0000-0000-000000000001'`
- Verify data integrity: Compare record counts before/after backfill

---

### Phase 4: Add NOT NULL Constraints (Enforcement)

**Goal:** Enforce `org_id NOT NULL` constraints to prevent future NULL values

**Steps:**
1. Create migration file: `20250110_add_org_id_not_null_constraints.sql`
2. Add CHECK constraints: `org_id IS NOT NULL` to all org-scoped tables
3. Verify constraints work (attempt INSERT with NULL org_id → should fail)
4. Apply migration

**Acceptance Criteria:**
- ✅ All org-scoped tables have NOT NULL constraint on `org_id`
- ✅ Attempting to insert NULL `org_id` fails with clear error
- ✅ Existing data still valid (no constraint violations)

**Risk:**
- Constraint fails if NULL values exist → **Mitigation:** Phase 3 must complete successfully first
- Application code breaks if it tries to insert NULL → **Mitigation:** Code already expects org_id (per audit)

**Testing:**
- Verify constraints: `SELECT * FROM information_schema.check_constraints WHERE constraint_name LIKE '%org_id%'`
- Test constraint: `INSERT INTO table (org_id) VALUES (NULL)` → Should fail
- Test valid insert: `INSERT INTO table (org_id, ...) VALUES ('a0000000-0000-0000-0000-000000000001', ...)` → Should succeed

---

### Phase 5: Update JWT app_metadata for All Users (Identity Migration)

**Goal:** Set `org_id` in JWT `app_metadata` for all existing users

**Steps:**
1. Create script: `backend/scripts/update-user-org-metadata.ts`
2. Query all users from `auth.users`
3. For each user, update `app_metadata.org_id = default_org_id`
4. Verify JWT contains `org_id` after update
5. Test `public.auth_org_id()` function returns org_id

**Strategy:**
- Use Supabase Admin API: `supabase.auth.admin.updateUserById(userId, { app_metadata: { org_id } })`
- Process in batches if user count is large
- Log all updates for audit trail

**Acceptance Criteria:**
- ✅ All users have `org_id` in `app_metadata`
- ✅ `public.auth_org_id()` function returns org_id for authenticated users
- ✅ No users with missing `org_id` in metadata

**Risk:**
- Admin API rate limits → **Mitigation:** Batch updates with delays
- Users logged in during update may have stale JWT → **Mitigation:** Users need to re-login (acceptable)
- Update fails for some users → **Mitigation:** Retry logic, audit failed updates

**Testing:**
- Verify metadata: Query `auth.users` and check `raw_app_meta_data->>'org_id'`
- Test JWT: Authenticate as user, decode JWT, verify `app_metadata.org_id` exists
- Test function: `SELECT public.auth_org_id()` as authenticated user → Should return org_id

---

### Phase 6: Deploy Immutability Triggers (Final Step)

**Goal:** Apply org_id immutability triggers migration (now that columns exist)

**Steps:**
1. Verify all tables have `org_id` columns (from Phase 2)
2. Verify all data has `org_id` backfilled (from Phase 3)
3. Apply migration: `20250110_create_org_id_immutability_triggers.sql`
4. Test triggers work (attempt UPDATE that changes org_id → should fail)
5. Verify normal UPDATEs work (changing other columns → should succeed)

**Acceptance Criteria:**
- ✅ All triggers created successfully
- ✅ Attempting to change `org_id` fails with clear error
- ✅ Normal updates (other columns) succeed
- ✅ No application code breaks

**Risk:**
- Trigger causes performance degradation → **Mitigation:** Triggers only fire on UPDATE, minimal overhead
- Application code tries to update org_id → **Mitigation:** Code audit confirmed no org_id updates

**Testing:**
- Verify triggers: `SELECT * FROM pg_trigger WHERE tgname LIKE '%org_id_immutable%'`
- Test trigger: `UPDATE table SET org_id = 'different-org' WHERE id = '...'` → Should fail
- Test normal update: `UPDATE table SET status = 'completed' WHERE id = '...'` → Should succeed

---

## Testing Strategy

### Unit Tests (Per Migration)
- Verify SQL syntax is correct (no syntax errors)
- Verify migration applies without errors
- Verify expected changes are made (columns, constraints, triggers)

### Integration Tests (After All Migrations)
- Test `public.auth_org_id()` function returns org_id
- Test RLS policies use org_id correctly (if RLS policies exist)
- Test application code queries work with org_id columns

### Manual Verification Checklist
- [ ] All tables have `org_id` column
- [ ] All records have `org_id` populated
- [ ] NOT NULL constraints are applied
- [ ] Foreign keys reference organizations table
- [ ] Indexes exist on `org_id` columns
- [ ] Immutability triggers work
- [ ] JWT contains `org_id` in `app_metadata`
- [ ] `public.auth_org_id()` function works
- [ ] No data loss occurred during migration
- [ ] Application can query data by org_id

---

## Success Criteria

- [x] Planning document created ✅
- [ ] Phase 1: All tables identified
- [ ] Phase 2: org_id columns added to all tables
- [ ] Phase 3: All data backfilled with org_id
- [ ] Phase 4: NOT NULL constraints applied
- [ ] Phase 5: All users have org_id in JWT metadata
- [ ] Phase 6: Immutability triggers deployed
- [ ] All tests passing
- [ ] No regressions introduced
- [ ] Documentation updated
- [ ] Warden Week 1 deployment can proceed

---

## Dependencies

**Before Starting:**
- ✅ `organizations` table exists (foundation migration applied)
- ✅ `public.auth_org_id()` function exists (can extract org_id from JWT)
- ✅ Default organization exists (`a0000000-0000-0000-0000-000000000001`)

**Blocking:**
- ❌ Immutability triggers migration (blocked until Phase 2-4 complete)
- ❌ Warden Week 1 full deployment (blocked until all phases complete)

**Dependent On This:**
- Backend code already expects org_id (no code changes needed)
- Frontend code already expects org_id (no code changes needed)

---

## Rollback Plan

**If Phase 2-4 Fail:**
1. Drop `org_id` columns: `ALTER TABLE table DROP COLUMN org_id CASCADE;`
2. Drop foreign key constraints: `ALTER TABLE table DROP CONSTRAINT fk_table_org_id;`
3. Drop indexes: `DROP INDEX IF EXISTS idx_table_org_id;`
4. Revert to user-based model (temporary)

**If Phase 5 Fails:**
1. No rollback needed (JWT metadata updates are additive)
2. Users without org_id in metadata will use `user_metadata.org_id` fallback (existing code)

**If Phase 6 Fails:**
1. Drop triggers: `DROP TRIGGER IF EXISTS org_id_immutable_X ON table;`
2. System continues without immutability enforcement (less secure, but functional)

---

## Timeline Estimate

- **Phase 1:** 30 minutes (discovery and verification)
- **Phase 2:** 1-2 hours (migration creation and application)
- **Phase 3:** 1-2 hours (backfill data, depends on table sizes)
- **Phase 4:** 30 minutes (constraint application)
- **Phase 5:** 1 hour (script creation and execution)
- **Phase 6:** 30 minutes (trigger application and testing)

**Total:** 4-6 hours (single engineer, sequential execution)

---

## Notes

- **Idempotency:** All migrations use `IF NOT EXISTS` / `IF EXISTS` patterns for safety
- **Performance:** Large tables may need batch processing (monitor during Phase 3)
- **Zero Downtime:** Migrations are additive (no table drops), application continues working
- **Backward Compatibility:** Existing `user_id` columns remain (not dropped), can be used during transition

---

**Status:** Planning Complete ✅  
**Next Step:** Begin Phase 1 - Identify All Tables Requiring org_id
