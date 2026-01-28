# Rollback Procedures

**Priority 9: Developer Operations**  
**Created:** 2026-01-28  
**Last Updated:** 2026-01-28

---

## Quick Reference

### When to Rollback

**Immediate Rollback Required:**
- Error rate >1% in first 10 minutes after deployment
- Critical feature completely broken (authentication, payments, core workflows)
- Database migration failure causing data corruption
- Security vulnerability introduced
- User-reported critical bugs affecting >10% of users

**Consider Rollback:**
- Performance degradation >50% (page load times doubled)
- Non-critical feature broken but workaround exists
- Error rate 0.5-1% (monitor closely, rollback if increasing)

**Do NOT Rollback:**
- Minor UI issues (CSS, layout)
- Non-critical bugs with workarounds
- Error rate <0.1%
- Issues affecting <1% of users

### Rollback Time Targets

- **Application Rollback:** <5 minutes
- **Database Rollback:** <15 minutes
- **Full System Rollback:** <20 minutes

---

## Application Rollback

### Frontend (Vercel)

#### Method 1: Via Vercel Dashboard (Fastest)

1. **Navigate to Vercel Dashboard:**
   ```
   https://vercel.com/voxanne/voxanne-ai/deployments
   ```

2. **Find Previous Working Deployment:**
   - Look for deployment with green checkmark
   - Verify timestamp (should be before current deployment)
   - Click deployment to view details

3. **Promote to Production:**
   - Click "..." menu on deployment
   - Select "Promote to Production"
   - Confirm promotion

4. **Verify Rollback:**
   ```bash
   curl -I https://voxanne.ai
   # Check X-Vercel-Id header matches rolled-back deployment
   ```

**Time:** 2-3 minutes

#### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Rollback to previous deployment
vercel rollback

# Or rollback to specific deployment
vercel rollback <deployment-url>
```

**Time:** 3-5 minutes

#### Method 3: Via Git Revert (Slowest)

```bash
# Revert last commit
git revert HEAD --no-edit

# Push to trigger new deployment
git push origin main

# Wait for Vercel to build and deploy (~5 minutes)
```

**Time:** 8-10 minutes

---

### Backend (Render/Railway)

#### Method 1: Via Dashboard (Recommended)

**Render:**
1. Go to https://dashboard.render.com/
2. Select "voxanne-backend" service
3. Click "Manual Deploy" tab
4. Find previous successful deployment
5. Click "Redeploy" on that version

**Railway:**
1. Go to https://railway.app/dashboard
2. Select "voxanne-backend" project
3. Click "Deployments" tab
4. Find previous successful deployment
5. Click "Redeploy"

**Time:** 3-5 minutes

#### Method 2: Via Git Revert

```bash
# Navigate to backend directory
cd backend

# Revert last commit
git revert HEAD --no-edit

# Push to trigger redeployment
git push origin main

# Monitor deployment
# Render: https://dashboard.render.com/
# Railway: https://railway.app/dashboard
```

**Time:** 5-8 minutes

#### Method 3: Via Git Reset (Use with Caution)

```bash
# Find commit hash of last working version
git log --oneline -10

# Reset to that commit
git reset --hard <commit-hash>

# Force push (DANGEROUS - coordinate with team)
git push --force origin main
```

**⚠️ Warning:** Force push overwrites history. Only use in emergencies.

**Time:** 3-5 minutes

---

## Database Rollback

### Check Current Migration Version

```sql
-- Connect to database
psql $DATABASE_URL

-- Check current migration version
SELECT version, name 
FROM schema_migrations 
ORDER BY version DESC 
LIMIT 5;
```

### Rollback Last Migration

#### Method 1: Via Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/[project-id]/database/migrations
2. Find the migration to rollback
3. Click "Rollback" button
4. Confirm rollback

**Time:** 2-3 minutes

#### Method 2: Via Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm i -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref <project-id>

# Rollback to specific version
supabase db reset --version <previous-version>

# Or rollback last migration
supabase db reset --version $(supabase db version | tail -2 | head -1)
```

**Time:** 3-5 minutes

#### Method 3: Manual SQL Rollback

```bash
# Create rollback script
cat > rollback_migration.sql << 'EOF'
-- Rollback migration: 20260128_create_feature_flags

-- Drop tables
DROP TABLE IF EXISTS feature_flag_audit_log CASCADE;
DROP TABLE IF EXISTS org_feature_flags CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS is_feature_enabled(UUID, TEXT);
DROP FUNCTION IF EXISTS get_org_enabled_features(UUID);
DROP FUNCTION IF EXISTS update_feature_flag(TEXT, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS log_feature_flag_change();

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '20260128_create_feature_flags';
EOF

# Execute rollback
psql $DATABASE_URL -f rollback_migration.sql
```

**Time:** 5-10 minutes

### Verify Database Rollback

```sql
-- Check tables were removed
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%feature_flag%';
-- Should return 0 rows

-- Check functions were removed
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%feature%';
-- Should return 0 rows

-- Verify row counts in critical tables
SELECT 
  'organizations' as table_name, COUNT(*) as row_count FROM organizations
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts;
-- Verify counts match pre-migration baseline
```

---

## Feature Flag Emergency Disable

**Fastest way to disable a broken feature without full rollback:**

### Method 1: Via SQL (Fastest)

```sql
-- Disable feature globally
UPDATE feature_flags 
SET enabled_globally = false, 
    rollout_percentage = 0,
    updated_at = NOW()
WHERE flag_key = 'broken_feature';

-- Verify
SELECT flag_key, enabled_globally, rollout_percentage 
FROM feature_flags 
WHERE flag_key = 'broken_feature';
```

**Time:** <1 minute

### Method 2: Via API

```bash
# Disable feature via API
curl -X PATCH https://api.voxanne.ai/api/feature-flags/broken_feature \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled_globally": false,
    "rollout_percentage": 0
  }'

# Clear cache to apply immediately
curl -X POST https://api.voxanne.ai/api/feature-flags/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Time:** 1-2 minutes

### Method 3: Via Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/[project-id]/editor
2. Open `feature_flags` table
3. Find row with `flag_key = 'broken_feature'`
4. Edit row: Set `enabled_globally = false`, `rollout_percentage = 0`
5. Save changes

**Time:** 2-3 minutes

---

## Rollback Verification Checklist

After any rollback, verify the following:

### Application Health

```bash
# Check frontend is accessible
curl -f https://voxanne.ai
# Expected: HTTP 200

# Check backend health
curl -f https://api.voxanne.ai/health
# Expected: {"status":"healthy"}

# Check database connectivity
curl -f https://api.voxanne.ai/api/health/database
# Expected: {"status":"connected"}
```

### Error Rate Monitoring

```bash
# Check Sentry for error rate
# Go to: https://sentry.io/organizations/voxanne/issues/

# Error rate should be <0.1% within 5 minutes of rollback
```

### Critical User Flows

Test these manually or via automated smoke tests:

1. **Authentication:**
   - Login with test account
   - Verify dashboard loads

2. **Agent Configuration:**
   - View agent settings
   - Verify knowledge base displays

3. **Appointments:**
   - View appointments list
   - Verify calendar integration works

4. **Call Logs:**
   - View call logs
   - Verify recordings play

### Database Integrity

```sql
-- Check row counts haven't changed unexpectedly
SELECT 
  'organizations' as table, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'agents', COUNT(*) FROM agents
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'call_logs', COUNT(*) FROM call_logs;

-- Compare to baseline (should be within 1-2% of pre-deployment counts)
```

---

## Post-Rollback Procedures

### 1. Notify Team

**Slack Message Template:**

```
🔄 ROLLBACK EXECUTED

Deployment: [deployment-id]
Reason: [brief description]
Rollback Time: [timestamp]
Status: ✅ Complete / ⚠️ In Progress / ❌ Failed

Verification:
- Frontend: ✅ Healthy
- Backend: ✅ Healthy
- Database: ✅ Healthy
- Error Rate: 0.05% (normal)

Next Steps:
1. Root cause analysis scheduled for [time]
2. Fix deployment scheduled for [time]
3. Post-mortem document: [link]
```

### 2. Create Incident Post-Mortem

Create file: `incidents/YYYY-MM-DD-rollback-[issue].md`

```markdown
# Incident Post-Mortem: [Issue Description]

**Date:** YYYY-MM-DD  
**Duration:** [deployment time] to [rollback complete time]  
**Severity:** Critical / High / Medium  
**Impact:** [number] users affected, [duration] downtime

## Timeline

- **HH:MM** - Deployment initiated
- **HH:MM** - Issue first detected
- **HH:MM** - Rollback decision made
- **HH:MM** - Rollback executed
- **HH:MM** - System verified healthy

## Root Cause

[Detailed explanation of what went wrong]

## Resolution

[What was done to fix the issue]

## Prevention

[What will be done to prevent this in the future]

## Action Items

- [ ] Fix underlying issue
- [ ] Add test coverage
- [ ] Update deployment checklist
- [ ] Schedule fix deployment
```

### 3. Schedule Fix Deployment

1. **Identify Root Cause:** Debug the issue locally
2. **Create Fix:** Implement and test thoroughly
3. **Deploy to Staging:** Verify fix works
4. **Schedule Production Deploy:** Coordinate with team
5. **Monitor Closely:** Watch error rates for 1 hour post-deploy

---

## Rollback Testing & Drills

### Monthly Rollback Drill Schedule

**Frequency:** Last Friday of each month  
**Duration:** 30 minutes  
**Participants:** Engineering team

**Drill Procedure:**

1. **Deploy Test Change:**
   - Deploy intentionally broken feature to staging
   - Verify it's broken

2. **Execute Rollback:**
   - Follow rollback procedures
   - Time the rollback process
   - Document any issues

3. **Verify Rollback:**
   - Run verification checklist
   - Confirm system is healthy

4. **Review & Update:**
   - Review rollback time (should be <5 minutes)
   - Update procedures if needed
   - Document lessons learned

---

## Emergency Contacts

**Incident Commander:** [Name] - [Phone] - [Email]  
**Database Lead:** [Name] - [Phone] - [Email]  
**Application Lead:** [Name] - [Phone] - [Email]  
**DevOps Lead:** [Name] - [Phone] - [Email]

**Escalation Path:**
1. On-call engineer (responds within 5 minutes)
2. Team lead (responds within 15 minutes)
3. CTO (responds within 30 minutes)

---

## Rollback Decision Matrix

| Scenario | Error Rate | Users Affected | Rollback? | Time Limit |
|----------|-----------|----------------|-----------|------------|
| Authentication broken | Any | >50% | ✅ YES | Immediate |
| Payment processing broken | Any | Any | ✅ YES | Immediate |
| Dashboard slow | <1% | <10% | ❌ NO | Monitor |
| Minor UI bug | <0.1% | <5% | ❌ NO | Fix forward |
| Database migration failed | N/A | All | ✅ YES | Immediate |
| Feature flag broken | Varies | Varies | 🟡 MAYBE | Disable flag |
| API latency +50% | <1% | <25% | 🟡 MAYBE | Monitor 15 min |
| API latency +200% | Any | >25% | ✅ YES | Within 10 min |

---

## Automated Rollback Script

**Location:** `backend/src/scripts/rollback-deployment.ts`

```bash
# Run automated rollback
npm run rollback

# Or manually
npx ts-node backend/src/scripts/rollback-deployment.ts
```

**What it does:**
1. Reverts frontend (Vercel)
2. Reverts backend (Git revert + push)
3. Verifies health endpoints
4. Sends Slack notification
5. Creates incident log

---

## Best Practices

1. **Always Have a Rollback Plan:** Before deploying, know how to rollback
2. **Test Rollback Procedures:** Monthly drills ensure procedures work
3. **Monitor Closely:** Watch error rates for 1 hour after deployment
4. **Communicate Early:** Notify team immediately if issues detected
5. **Document Everything:** Post-mortems prevent future incidents
6. **Automate When Possible:** Automated rollbacks are faster and less error-prone
7. **Feature Flags First:** Use feature flags to disable broken features without full rollback
8. **Database Backups:** Always verify backup exists before risky migrations

---

## Related Documentation

- `DISASTER_RECOVERY_PLAN.md` - Full disaster recovery procedures
- `RUNBOOK.md` - Operational issue resolution guide
- `PRIORITY_9_PLANNING.md` - DevOps implementation plan
- `.github/workflows/` - CI/CD pipeline configurations
