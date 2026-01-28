# Voxanne AI: Disaster Recovery Plan

**Version:** 1.0  
**Last Updated:** 2026-01-28  
**Owner:** Engineering Team  
**Review Frequency:** Quarterly

---

## 1. Overview & Objectives

### Purpose

This document provides comprehensive procedures for recovering the Voxanne AI platform from catastrophic failures, ensuring business continuity and data protection for all customers.

### Recovery Objectives

| Metric | Target | Definition |
|--------|--------|------------|
| **RTO** (Recovery Time Objective) | <1 hour | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | <24 hours | Maximum acceptable data loss |
| **Backup Frequency** | Daily | Automated backup schedule |
| **Backup Retention** | 30 days | Point-in-time recovery window |

### Scope

**In Scope:**
- Supabase database (PostgreSQL)
- Application data (organizations, profiles, agents, appointments, contacts, call logs, knowledge base)
- Database schema and functions
- RLS policies and permissions

**Out of Scope:**
- Application code (managed via Git)
- Frontend assets (managed via Vercel)
- External service credentials (stored in environment variables)
- Third-party services (Vapi, Twilio, Google Calendar)

---

## 2. Backup Systems

### 2.1 Supabase Automatic Backups

**Provider:** Supabase (AWS-managed PostgreSQL)  
**Backup Type:** Full database snapshots + WAL (Write-Ahead Logging)  
**Frequency:** Daily at 2:00 AM UTC  
**Retention:** 30 days  
**Storage Location:** AWS S3 (same region as database)

**Features:**
- ✅ Point-in-time recovery (PITR) to any second within 30 days
- ✅ Automatic backup verification by Supabase
- ✅ Encrypted at rest (AES-256)
- ✅ Encrypted in transit (TLS 1.2+)
- ✅ Geo-redundant storage (3 copies minimum)

### 2.2 Backup Verification

**Automated Verification:**
- Script: `backend/src/scripts/verify-backups.ts`
- Schedule: Daily at 5:00 AM UTC (3 hours after backup)
- Checks:
  - Backup age (<24 hours)
  - Backup size (within expected range)
  - Critical tables present (7 tables)
  - Row counts reasonable (±10% variance)
- Alerts: Slack #engineering-alerts on failure

**Manual Verification:**
- Monthly recovery drill (last Friday of each month)
- Restore to staging environment
- Validate data integrity
- Document results in `backup_verification_log` table

### 2.3 Critical Tables

| Table | Description | Criticality |
|-------|-------------|-------------|
| `organizations` | Customer accounts | 🔴 CRITICAL |
| `profiles` | User accounts | 🔴 CRITICAL |
| `agents` | AI agent configurations | 🔴 CRITICAL |
| `appointments` | Scheduled appointments | 🔴 CRITICAL |
| `contacts` | Customer contacts/leads | 🔴 CRITICAL |
| `call_logs` | Call history and transcripts | 🟠 HIGH |
| `knowledge_base_chunks` | RAG embeddings | 🟠 HIGH |

---

## 3. Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:**
- Database queries returning errors
- Data inconsistencies reported by users
- Sentry alerts: "Database constraint violation"
- Application unable to read/write data

**Diagnosis:**
```bash
# Check database health
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"

# Check for corrupted indexes
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database WHERE datname = current_database();"

# Verify table integrity
psql $DATABASE_URL -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public';"
```

**Recovery Procedure:**

1. **Assess Impact** (5 minutes)
   ```bash
   # Identify corrupted tables
   psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
   
   # Check error logs
   # Supabase Dashboard → Logs → Database
   ```

2. **Enable Maintenance Mode** (2 minutes)
   ```bash
   # Set environment variable to block new requests
   # Vercel Dashboard → Settings → Environment Variables
   # Add: MAINTENANCE_MODE=true
   # Redeploy frontend
   ```

3. **Determine Recovery Point** (3 minutes)
   - Identify last known good state
   - Check `backup_verification_log` for recent successful backups
   - Consult with team on acceptable data loss

4. **Initiate Point-in-Time Recovery** (15 minutes)
   ```bash
   # Via Supabase Dashboard:
   # 1. Navigate to Database → Backups
   # 2. Select "Point-in-time Recovery"
   # 3. Choose timestamp (before corruption)
   # 4. Click "Restore"
   # 5. Wait for restore completion (10-15 minutes)
   ```

5. **Verify Database Integrity** (10 minutes)
   ```bash
   # Check all critical tables exist
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM organizations;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM profiles;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM agents;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM contacts;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM call_logs;"
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM knowledge_base_chunks;"
   
   # Verify database functions
   psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname IN ('book_appointment_with_lock', 'cleanup_old_webhook_logs');"
   
   # Check RLS policies
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_policies;"
   ```

6. **Test Application Functionality** (10 minutes)
   ```bash
   # Test critical endpoints
   curl -H "Authorization: Bearer $TEST_TOKEN" https://api.voxanne.ai/api/health
   curl -H "Authorization: Bearer $TEST_TOKEN" https://api.voxanne.ai/api/agents
   curl -H "Authorization: Bearer $TEST_TOKEN" https://api.voxanne.ai/api/appointments
   
   # Test database writes
   # Create test appointment via API
   # Verify in database
   ```

7. **Disable Maintenance Mode** (2 minutes)
   ```bash
   # Remove MAINTENANCE_MODE environment variable
   # Redeploy frontend
   ```

8. **Post-Recovery Validation** (10 minutes)
   - Monitor Sentry for errors (30 minutes)
   - Check Slack alerts
   - Verify user reports
   - Document incident in post-mortem

**Total Recovery Time:** 45-60 minutes ✅

---

### Scenario 2: Accidental Data Deletion

**Symptoms:**
- User reports missing data
- Audit logs show DELETE operations
- Row counts significantly lower than expected
- Specific records cannot be found

**Diagnosis:**
```bash
# Check audit logs
psql $DATABASE_URL -c "SELECT * FROM audit_logs WHERE event_type LIKE 'delete%' ORDER BY created_at DESC LIMIT 50;"

# Check deleted records (soft deletes)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments WHERE deleted_at IS NOT NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM contacts WHERE deleted_at IS NOT NULL;"

# Identify deletion time window
psql $DATABASE_URL -c "SELECT MIN(deleted_at), MAX(deleted_at) FROM appointments WHERE deleted_at IS NOT NULL;"
```

**Recovery Procedure:**

1. **Identify Deletion Scope** (5 minutes)
   ```bash
   # Determine what was deleted
   psql $DATABASE_URL -c "SELECT table_name, COUNT(*) FROM audit_logs WHERE event_type = 'delete' AND created_at > NOW() - INTERVAL '24 hours' GROUP BY table_name;"
   
   # Identify affected organizations
   psql $DATABASE_URL -c "SELECT org_id, COUNT(*) FROM audit_logs WHERE event_type = 'delete' AND created_at > NOW() - INTERVAL '24 hours' GROUP BY org_id;"
   ```

2. **Attempt Soft Delete Recovery** (10 minutes)
   ```bash
   # If soft deletes are used, restore records
   psql $DATABASE_URL -c "UPDATE appointments SET deleted_at = NULL, deleted_by = NULL WHERE deleted_at > '2026-01-28 06:00:00';"
   
   # Verify restoration
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments WHERE deleted_at IS NULL;"
   ```

3. **If Hard Delete, Use Point-in-Time Recovery** (30 minutes)
   ```bash
   # Option A: Restore entire database to before deletion
   # (Follow Scenario 1 steps 2-8)
   
   # Option B: Selective table restore (advanced)
   # 1. Create temporary database from backup
   # 2. Export deleted records
   # 3. Import into production
   # 4. Verify data integrity
   ```

4. **Validate Restored Data** (10 minutes)
   ```bash
   # Compare row counts before/after
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments;"
   
   # Verify specific records
   psql $DATABASE_URL -c "SELECT * FROM appointments WHERE id = '[deleted-record-id]';"
   
   # Check data consistency
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments WHERE contact_id NOT IN (SELECT id FROM contacts);"
   ```

5. **Implement Prevention Measures** (15 minutes)
   - Review RLS policies
   - Add confirmation dialogs for bulk deletes
   - Enhance audit logging
   - Train team on safe deletion practices

**Total Recovery Time:** 30-60 minutes ✅

---

### Scenario 3: Regional Outage (Supabase EU-West-1)

**Symptoms:**
- Database connection timeouts
- Supabase dashboard inaccessible
- All API requests failing with 503 errors
- Sentry alerts: "Database connection failed"

**Diagnosis:**
```bash
# Check Supabase status
curl https://status.supabase.com/api/v2/status.json

# Test database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check AWS status (EU-West-1)
curl https://status.aws.amazon.com/
```

**Recovery Procedure:**

**Option A: Wait for Supabase Recovery (Recommended)**

1. **Enable Maintenance Mode** (2 minutes)
   - Display status page to users
   - Communicate via Slack/email

2. **Monitor Supabase Status** (Ongoing)
   - Check https://status.supabase.com
   - Subscribe to incident updates
   - Estimate recovery time

3. **Verify Service Restoration** (10 minutes)
   ```bash
   # Test database connection
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM organizations;"
   
   # Test application endpoints
   curl https://api.voxanne.ai/api/health
   ```

4. **Disable Maintenance Mode** (2 minutes)

**Option B: Failover to Backup Region (Advanced - Requires Setup)**

*Note: This requires pre-configured multi-region setup (not currently implemented)*

1. **Promote Read Replica** (15 minutes)
   - Switch DNS to backup region
   - Update DATABASE_URL environment variable
   - Redeploy application

2. **Verify Failover** (10 minutes)
   - Test database connectivity
   - Verify data consistency
   - Check application functionality

**Total Recovery Time:** 
- Option A: 2-4 hours (depends on Supabase)
- Option B: 25-30 minutes (requires pre-setup)

**Prevention:**
- Consider multi-region setup for enterprise customers
- Implement read replicas for high availability
- Document failover procedures

---

### Scenario 4: Complete Database Loss

**Symptoms:**
- Database completely inaccessible
- Supabase project deleted or corrupted
- All data appears lost
- Cannot connect to database

**Diagnosis:**
```bash
# Verify database existence
psql $DATABASE_URL -c "SELECT 1;"

# Check Supabase dashboard
# Project status: "Deleted" or "Error"

# Contact Supabase support immediately
```

**Recovery Procedure:**

1. **Contact Supabase Support** (Immediate)
   - Email: support@supabase.com
   - Subject: "URGENT: Database Recovery Needed"
   - Include: Project ID, timestamp of issue
   - Request: Emergency backup restoration

2. **Retrieve Latest Backup** (30 minutes)
   ```bash
   # Via Supabase Dashboard (if accessible):
   # 1. Navigate to Database → Backups
   # 2. Select most recent backup
   # 3. Click "Restore to new project"
   # 4. Wait for restoration
   ```

3. **Create New Supabase Project** (10 minutes)
   - If original project is unrecoverable
   - Same region (EU-West-1)
   - Same configuration

4. **Restore from Backup** (20 minutes)
   ```bash
   # Import backup to new project
   # Via Supabase CLI:
   supabase db dump --db-url $OLD_DATABASE_URL > backup.sql
   psql $NEW_DATABASE_URL < backup.sql
   ```

5. **Update Application Configuration** (10 minutes)
   ```bash
   # Update DATABASE_URL in all environments
   # Vercel: Environment Variables
   # Backend: .env file
   # Redeploy all services
   ```

6. **Verify Full Restoration** (20 minutes)
   - Run full test suite
   - Verify all tables and data
   - Check database functions
   - Test application end-to-end

**Total Recovery Time:** 1.5-2 hours ⚠️ (exceeds RTO)

**Prevention:**
- Maintain offline backup copies
- Document Supabase project configuration
- Regular backup exports to S3
- Consider backup to different provider

---

### Scenario 5: Application-Level Data Corruption

**Symptoms:**
- Data exists but is incorrect/inconsistent
- Business logic errors causing bad data
- Foreign key violations
- Orphaned records

**Diagnosis:**
```bash
# Check for orphaned appointments
psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments WHERE contact_id NOT IN (SELECT id FROM contacts);"

# Check for orphaned call logs
psql $DATABASE_URL -c "SELECT COUNT(*) FROM call_logs WHERE org_id NOT IN (SELECT id FROM organizations);"

# Verify data consistency
psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments WHERE scheduled_at > NOW() + INTERVAL '1 year';"

# Check for duplicate records
psql $DATABASE_URL -c "SELECT phone, COUNT(*) FROM contacts GROUP BY phone HAVING COUNT(*) > 1;"
```

**Recovery Procedure:**

1. **Identify Corruption Pattern** (15 minutes)
   ```bash
   # Analyze affected records
   psql $DATABASE_URL -c "SELECT * FROM appointments WHERE scheduled_at > NOW() + INTERVAL '1 year' LIMIT 10;"
   
   # Determine root cause
   # Check application logs
   # Review recent code changes
   ```

2. **Create Data Cleanup Script** (30 minutes)
   ```sql
   -- Example: Fix orphaned appointments
   BEGIN;
   
   -- Backup affected records
   CREATE TABLE appointments_backup AS 
   SELECT * FROM appointments 
   WHERE contact_id NOT IN (SELECT id FROM contacts);
   
   -- Delete orphaned records
   DELETE FROM appointments 
   WHERE contact_id NOT IN (SELECT id FROM contacts);
   
   -- Verify
   SELECT COUNT(*) FROM appointments_backup;
   
   COMMIT;
   ```

3. **Test Cleanup Script on Staging** (15 minutes)
   ```bash
   # Restore staging from production backup
   # Run cleanup script
   # Verify results
   # Document changes
   ```

4. **Execute Cleanup on Production** (10 minutes)
   ```bash
   # Run script during low-traffic period
   psql $DATABASE_URL < cleanup_script.sql
   
   # Monitor for errors
   # Verify row counts
   ```

5. **Implement Prevention** (30 minutes)
   - Add database constraints
   - Enhance validation logic
   - Add automated data quality checks
   - Create monitoring alerts

**Total Recovery Time:** 1-2 hours ✅

---

## 4. Recovery Team & Roles

### Primary Recovery Team

| Role | Responsibility | Contact |
|------|---------------|---------|
| **Incident Commander** | Overall coordination | On-call engineer |
| **Database Lead** | Database recovery | Senior backend engineer |
| **Application Lead** | Application testing | Lead developer |
| **Communications Lead** | Customer updates | Product manager |

### Escalation Path

1. **Level 1:** On-call engineer (respond within 15 minutes)
2. **Level 2:** Engineering manager (escalate if >30 minutes)
3. **Level 3:** CTO (escalate if >1 hour or data loss)
4. **Level 4:** Supabase support (for platform issues)

### Contact Information

**Internal:**
- Slack: #engineering-alerts (immediate)
- PagerDuty: (if configured)
- Phone tree: (maintain updated list)

**External:**
- Supabase Support: support@supabase.com
- AWS Support: (if direct AWS account)

---

## 5. Testing & Drills

### Monthly Recovery Drill Schedule

**Frequency:** Last Friday of each month, 10:00 AM UTC

**Drill Procedure:**
1. Select random disaster scenario
2. Assemble recovery team
3. Execute recovery procedure
4. Time each step
5. Document issues/improvements
6. Update this document

**Drill Checklist:**
- [ ] Scenario selected
- [ ] Team assembled (5 minutes)
- [ ] Recovery initiated
- [ ] Each step timed
- [ ] Data validated
- [ ] Total time recorded
- [ ] Post-drill review completed
- [ ] Action items created

### Backup Verification Checklist

**Daily Automated Checks:**
- [ ] Backup completed (<24 hours old)
- [ ] Backup size reasonable
- [ ] All 7 critical tables present
- [ ] Row counts within ±10%
- [ ] Verification logged
- [ ] Alerts sent (if failures)

**Monthly Manual Checks:**
- [ ] Restore to staging environment
- [ ] Verify all tables accessible
- [ ] Test sample queries
- [ ] Validate data integrity
- [ ] Document results
- [ ] Update backup_verification_log

---

## 6. Communication Plan

### During Incident

**Internal Communication:**
1. **Immediate:** Post in #engineering-alerts
   ```
   🚨 INCIDENT: [Brief description]
   Impact: [User-facing impact]
   Status: Investigating
   ETA: [Estimated recovery time]
   ```

2. **Every 15 minutes:** Status update
   ```
   UPDATE: [Current step]
   Progress: [X of Y steps complete]
   ETA: [Updated estimate]
   ```

3. **Resolution:** Final update
   ```
   ✅ RESOLVED: [Brief summary]
   Duration: [Total downtime]
   Impact: [Data loss, if any]
   Next steps: [Post-mortem, prevention]
   ```

**External Communication:**

1. **Status Page:** Update https://status.voxanne.ai
   - Incident detected
   - Investigating
   - Identified
   - Monitoring
   - Resolved

2. **Customer Email:** (if downtime >30 minutes)
   ```
   Subject: Service Disruption - [Date]
   
   We experienced a service disruption affecting [impact].
   
   Timeline:
   - Started: [Time]
   - Resolved: [Time]
   - Duration: [Minutes]
   
   Impact: [What was affected]
   Data Loss: [None/Minimal/Details]
   
   We apologize for the inconvenience.
   ```

### Post-Incident

**Post-Mortem Document:**
1. Incident timeline
2. Root cause analysis
3. Recovery actions taken
4. Data loss assessment
5. Prevention measures
6. Action items with owners

**Post-Mortem Meeting:**
- Schedule within 48 hours
- All recovery team members
- Review timeline
- Identify improvements
- Update disaster recovery plan

---

## 7. Prevention & Monitoring

### Proactive Measures

**Daily:**
- ✅ Automated backup verification (5 AM UTC)
- ✅ Database health checks
- ✅ Error rate monitoring (Sentry)
- ✅ Performance monitoring

**Weekly:**
- Review Sentry error trends
- Check database query performance
- Verify backup retention
- Review audit logs

**Monthly:**
- Recovery drill
- Backup restore test
- Update disaster recovery plan
- Review incident history

**Quarterly:**
- Full disaster recovery plan review
- Update contact information
- Test all recovery procedures
- Audit backup systems

### Monitoring Alerts

**Critical Alerts (Immediate Response):**
- Database connection failures
- Backup verification failures
- Data corruption detected
- Regional outage detected

**Warning Alerts (Review Within 1 Hour):**
- Backup age >24 hours
- Row count variance >10%
- Slow query performance
- High error rates

**Info Alerts (Review Daily):**
- Backup completed successfully
- Verification passed
- Recovery drill scheduled

---

## 8. Document Maintenance

### Review Schedule

- **Monthly:** Review by on-call engineer
- **Quarterly:** Full team review
- **After Incident:** Update based on lessons learned
- **After Drill:** Update based on drill results

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-28 | Initial document | AI Developer |

### Related Documents

- `PRIORITY_8_PLANNING.md` - Implementation plan
- `RUNBOOK.md` - Operational procedures
- `backend/src/scripts/verify-backups.ts` - Backup verification script
- `.claude/claude.md` - Production priorities overview

---

## 9. Quick Reference

### Emergency Contacts

**Supabase Support:**
- Email: support@supabase.com
- Dashboard: https://app.supabase.com
- Status: https://status.supabase.com

**Internal Team:**
- Slack: #engineering-alerts
- On-call: (maintain updated schedule)

### Critical URLs

- Production Database: (stored in 1Password)
- Supabase Dashboard: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq
- Monitoring: https://api.voxanne.ai/api/monitoring/health
- Status Page: https://status.voxanne.ai

### Quick Commands

```bash
# Check database health
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"

# Verify backup age
psql $DATABASE_URL -c "SELECT MAX(created_at) FROM backup_verification_log;"

# Count critical tables
psql $DATABASE_URL -c "SELECT COUNT(*) FROM organizations;"

# Test application
curl https://api.voxanne.ai/api/health
```

---

**END OF DISASTER RECOVERY PLAN**

*This document is a living document and should be updated regularly based on incidents, drills, and system changes.*
