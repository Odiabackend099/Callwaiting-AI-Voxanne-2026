# Voxanne Phase 1 MVP: Migrations Deployment Guide

**Quick Reference for Deploying Database Migrations**

---

## Migration Files (In Order)

### Prerequisites (Must Already Exist)
- [ ] `20250110_create_organizations_table_foundation.sql`
- [ ] `20250110_create_org_id_immutability_triggers.sql`
- [ ] `20250110_create_auth_org_id_function.sql`

### NEW Phase 1 MVP Migrations (This Release)
- [ ] `20250110_create_contacts_table.sql` - Contact management (STEP 1)
- [ ] `20250110_create_appointments_table.sql` - Appointment scheduling (STEP 2)
- [ ] `20250110_create_notifications_table.sql` - Real-time notifications (STEP 3)
- [ ] `20250110_add_org_id_to_processed_webhook_events.sql` - Webhook isolation (STEP 4)
- [ ] `20250110_enable_pgaudit_logging.sql` - HIPAA audit logging (STEP 5)

---

## Step-by-Step Deployment

### 1. Pre-Deployment Checklist

```bash
# Backup database (using Supabase CLI or dashboard)
supabase db backup

# Verify database connectivity
psql $SUPABASE_DB_URL -c "SELECT version();"

# Check existing tables
psql $SUPABASE_DB_URL -c "SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT 5;"
```

### 2. Deploy Contacts Table (STEP 1)

**File:** `20250110_create_contacts_table.sql`

```bash
# Option A: Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste entire file content
# 3. Click "RUN"

# Option B: CLI
psql $SUPABASE_DB_URL < backend/migrations/20250110_create_contacts_table.sql

# Option C: Node.js Script
const { createClient } = require('@supabase/supabase-js');
const migration = require('fs').readFileSync('...sql', 'utf8');
const supabase = createClient(url, key);
await supabase.rpc('exec_sql', { sql: migration });
```

**Verification:**

```sql
-- In Supabase SQL Editor
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

-- Should see: id, org_id, name, phone, email, service_interests, lead_score, lead_status, last_contact_at, notes, created_at, updated_at

-- Check enum types
SELECT typname FROM pg_type WHERE typname IN ('lead_score_type', 'lead_status_type');

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'contacts';

-- Expected indexes:
-- idx_contacts_org_status_updated
-- idx_contacts_org_phone
-- idx_contacts_org_created
-- idx_contacts_service_interests
-- idx_contacts_last_contact
```

### 3. Deploy Appointments Table (STEP 2)

**File:** `20250110_create_appointments_table.sql`

```bash
psql $SUPABASE_DB_URL < backend/migrations/20250110_create_appointments_table.sql
```

**Verification:**

```sql
-- Check table structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'appointments' ORDER BY ordinal_position;

-- Check enum
SELECT typname FROM pg_type WHERE typname = 'appointment_status';

-- Check constraints (should reference contacts)
SELECT constraint_name, constraint_type FROM information_schema.table_constraints
WHERE table_name = 'appointments';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'appointments';

-- Test immutability trigger
INSERT INTO appointments (org_id, contact_id, service_type, scheduled_at)
VALUES ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM contacts LIMIT 1), 'consultation', NOW() + INTERVAL '1 day');

-- This should fail (demonstrates trigger works):
UPDATE appointments SET org_id = 'different-id' WHERE id = '...';
-- Error: org_id is immutable
```

### 4. Deploy Notifications Table (STEP 3)

**File:** `20250110_create_notifications_table.sql`

```bash
psql $SUPABASE_DB_URL < backend/migrations/20250110_create_notifications_table.sql
```

**Verification:**

```sql
-- Check user-specific isolation
SELECT column_name FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- Should include: id, org_id, user_id, type, title, message, status, etc.

-- Check enums
SELECT typname FROM pg_type
WHERE typname IN ('notification_type', 'notification_status', 'notification_priority');

-- Test create_notification() function
SELECT create_notification(
  'a0000000-0000-0000-0000-000000000001',  -- org_id
  '12345678-1234-1234-1234-123456789012',  -- user_id (replace with real)
  'hot_lead'::notification_type,
  'Hot Lead Alert',
  'A new hot lead was detected',
  NULL,
  NULL,
  '/dashboard/leads',
  'high'::notification_priority,
  '["in_app", "email"]'::jsonb
);

-- Verify notification was created
SELECT COUNT(*) FROM notifications WHERE type = 'hot_lead';
```

### 5. Deploy Webhook Events Migration (STEP 4)

**File:** `20250110_add_org_id_to_processed_webhook_events.sql`

```bash
psql $SUPABASE_DB_URL < backend/migrations/20250110_add_org_id_to_processed_webhook_events.sql
```

**Verification:**

```sql
-- Check org_id column exists
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'processed_webhook_events' AND column_name = 'org_id';
-- Should show: org_id, false (NOT NULL)

-- Check new composite index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'processed_webhook_events'
AND indexname LIKE '%org_event%';
-- Should show: idx_processed_webhook_events_org_event

-- Verify old unique index is dropped
SELECT indexname FROM pg_indexes
WHERE tablename = 'processed_webhook_events'
AND indexname NOT LIKE '%org_event%'
AND indexname NOT LIKE '%_pkey%';
-- Should NOT include: processed_webhook_events_event_id_key

-- Test composite uniqueness
INSERT INTO processed_webhook_events (org_id, event_id, processed_at)
VALUES ('a0000000-0000-0000-0000-000000000001', 'vapi-event-123', NOW());

-- This should succeed (different org, same event_id):
INSERT INTO processed_webhook_events (org_id, event_id, processed_at)
VALUES ('b0000000-0000-0000-0000-000000000002', 'vapi-event-123', NOW());
-- Should succeed! (org_id namespaces the event_id)

-- This should fail (same org, same event_id):
INSERT INTO processed_webhook_events (org_id, event_id, processed_at)
VALUES ('a0000000-0000-0000-0000-000000000001', 'vapi-event-123', NOW());
-- Error: duplicate key value violates unique constraint
```

### 6. Deploy Audit Logging (STEP 5)

**File:** `20250110_enable_pgaudit_logging.sql`

```bash
psql $SUPABASE_DB_URL < backend/migrations/20250110_enable_pgaudit_logging.sql
```

**Verification:**

```sql
-- Check pgaudit extension
SELECT * FROM pg_extension WHERE extname = 'pgaudit';
-- Should show pgaudit extension installed

-- Check audit_logs table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'audit_logs' ORDER BY ordinal_position;

-- Test logging function
SELECT log_audit_event(
  'MANUAL_TEST',
  'SELECT',
  'test_table',
  SESSION_USER,
  'a0000000-0000-0000-0000-000000000001',
  'SELECT 1',
  NULL,
  NULL
);

-- Verify log was created
SELECT COUNT(*) FROM audit_logs WHERE event_type = 'MANUAL_TEST';

-- Test archival function
SELECT archive_old_audit_logs(90);

-- Check audit monitoring function
SELECT * FROM detect_suspicious_activity('a0000000-0000-0000-0000-000000000001', 100);
```

---

## Troubleshooting

### "relation contacts does not exist"
**Problem:** Contacts table not created
**Solution:** Run `20250110_create_contacts_table.sql` first

### "function prevent_org_id_change() does not exist"
**Problem:** Immutability trigger function not found
**Solution:** Ensure `20250110_create_org_id_immutability_triggers.sql` is run FIRST

### "function public.auth_org_id() does not exist"
**Problem:** Auth org_id function not found
**Solution:** Ensure `20250110_create_auth_org_id_function.sql` is run FIRST

### "constraint violation on org_id = NULL"
**Problem:** Backfill didn't populate all org_ids
**Solution:** Check migration logs. Manually fill in missing org_ids:
```sql
UPDATE processed_webhook_events
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;
```

### "duplicate key value violates unique constraint"
**Problem:** Duplicate (org_id, event_id) pairs exist
**Solution:** Find and delete duplicates:
```sql
-- Find duplicates
SELECT org_id, event_id, COUNT(*)
FROM processed_webhook_events
GROUP BY org_id, event_id
HAVING COUNT(*) > 1;

-- Delete duplicates (keep oldest)
DELETE FROM processed_webhook_events
WHERE id NOT IN (
  SELECT DISTINCT ON (org_id, event_id) id
  FROM processed_webhook_events
  ORDER BY org_id, event_id, created_at
);
```

### "pgaudit not installed"
**Problem:** pgaudit extension unavailable
**Solution:** Contact Supabase support to enable pgaudit contrib module

### RLS policies not blocking cross-tenant access
**Problem:** Users can see other org's data
**Solution:** Check:
```sql
-- Verify auth.org_id() returns correct value
SELECT public.auth_org_id();

-- Verify RLS policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'contacts';

-- Test as specific user
SET ROLE 'user_123';
SELECT COUNT(*) FROM contacts;
-- Should only see your org's contacts
```

---

## Performance Verification

After all migrations deployed:

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('contacts', 'appointments', 'notifications', 'audit_logs')
ORDER BY tablename;

-- Check all indexes exist
SELECT COUNT(*) as total_indexes FROM pg_indexes
WHERE tablename IN ('contacts', 'appointments', 'notifications');
-- Should be: ~15+ indexes

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('contacts', 'appointments', 'notifications')
ORDER BY tablename;
-- All should show: true

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;

-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('contacts', 'appointments', 'notifications', 'audit_logs')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Rollback Procedure

If migrations fail and you need to rollback:

```sql
-- Drop triggers first
DROP TRIGGER IF EXISTS org_id_immutable_contacts ON contacts;
DROP TRIGGER IF EXISTS org_id_immutable_appointments ON appointments;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;

-- Drop functions
DROP FUNCTION IF EXISTS create_notification CASCADE;
DROP FUNCTION IF EXISTS expire_old_notifications CASCADE;
DROP FUNCTION IF EXISTS log_audit_event CASCADE;
DROP FUNCTION IF EXISTS archive_old_audit_logs CASCADE;
DROP FUNCTION IF EXISTS get_org_audit_logs CASCADE;
DROP FUNCTION IF EXISTS detect_suspicious_activity CASCADE;

-- Disable RLS
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Drop tables
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS audit_logs;

-- Drop enums
DROP TYPE IF EXISTS appointment_status;
DROP TYPE IF EXISTS lead_score_type;
DROP TYPE IF EXISTS lead_status_type;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_priority;
```

---

## Success Criteria

Deployment is successful when:

- [ ] All 5 migration files execute without errors
- [ ] All 5 tables exist with correct structure
- [ ] All 5 enums created successfully
- [ ] All indexes created and performing well
- [ ] All RLS policies enabled
- [ ] Immutability triggers prevent org_id modification
- [ ] Updated_at triggers auto-update on changes
- [ ] Test users can only see their own org's data
- [ ] Notifications are user-specific (not cross-user)
- [ ] Webhook events support org-scoped idempotency
- [ ] Audit logging enabled (pgaudit active or queued)
- [ ] Helper functions (create_notification, log_audit_event) work correctly
- [ ] No errors in application logs

---

## Post-Deployment Tasks

1. **Update Application Code**
   - Add TypeScript types for new tables
   - Create API endpoints for contacts, appointments, notifications
   - Update dashboard to show new data

2. **Set Up Maintenance Jobs**
   - Weekly: `SELECT archive_old_audit_logs(90);`
   - Monthly: Index analysis and maintenance
   - Quarterly: Audit log S3 archival

3. **Configure Monitoring**
   - Set up alerts for RLS policy violations
   - Monitor query performance
   - Track audit log size

4. **Update Documentation**
   - Database schema diagram
   - RLS policy documentation
   - API documentation for new endpoints

5. **Team Training**
   - Explain new tables and RLS policies
   - Review audit logging access
   - Discuss data retention policies

---

## Support & Questions

- **Database Questions:** Check Supabase documentation
- **RLS Issues:** Review org_id isolation strategy above
- **Performance Issues:** Check indexes and query plans
- **Audit Logging:** Review pgaudit PostgreSQL documentation

---

**Ready to Deploy!** 🚀

Apply migrations in order (1→5) and follow verification steps for each.
