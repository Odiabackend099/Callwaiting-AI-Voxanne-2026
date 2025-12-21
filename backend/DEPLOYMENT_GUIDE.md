# Phase 1 Critical Fixes - Deployment Guide

**Effective Date**: December 21, 2025
**Target Deployment**: Before first live inbound calls
**Estimated Deployment Time**: 15-20 minutes

---

## Pre-Deployment Checklist

### Environment Setup
- [ ] Have access to Supabase dashboard
- [ ] Have access to Render dashboard
- [ ] Have git history access (can rollback if needed)
- [ ] Have database backup capability verified
- [ ] Have read-write access to migrations folder

### Code Review
- [ ] Reviewed changes in `src/routes/webhooks.ts`
- [ ] Reviewed migration files:
  - `migrations/20251221_create_atomic_call_handlers.sql`
  - `migrations/20251221_add_org_id_not_null_constraints.sql`
- [ ] Verified no conflicting changes in other branches
- [ ] Confirmed all critical fixes are present

### Testing (Local)
- [ ] Run `npm run build` (no TypeScript errors)
- [ ] Run `npm test` (if test suite exists)
- [ ] Manually tested webhook handler changes locally
- [ ] Verified database connection works

---

## Step-by-Step Deployment

### Step 1: Database Backup (5 minutes)
**Safety First**: Always backup before schema changes

**Option A: Using Supabase Dashboard**
1. Go to Supabase Dashboard → Your Project
2. Click "Backups" tab
3. Click "Create Backup"
4. Name: "Before Phase 1 Critical Fixes - Dec 21"
5. Wait for backup completion (usually <2 min)

**Option B: Using pg_dump (from command line)**
```bash
# Export database (use service role key)
pg_dump -h db.*** .supabase.co \
  -U postgres \
  -W \
  --format custom \
  --file voxanne_db_backup_20251221.dump \
  voxanne_db

# Store backup securely
mv voxanne_db_backup_20251221.dump ~/backups/
```

**Verification**: Confirm backup exists and is recent

---

### Step 2: Deploy Migrations (5 minutes)
**Order**: Migrations BEFORE code changes (critical)

**Option A: Using Supabase SQL Editor (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of:
   ```
   migrations/20251221_create_atomic_call_handlers.sql
   ```
4. Click "Run" button
5. Verify: "Database updated successfully"
6. Repeat for:
   ```
   migrations/20251221_add_org_id_not_null_constraints.sql
   ```

**Option B: Using Supabase CLI (Advanced)**
```bash
# Ensure authenticated
supabase login

# Run migrations in order
supabase db push

# Verify migrations applied
supabase db migrations list
```

**Verification Queries** (run in SQL Editor):
```sql
-- Verify RPC functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE 'create_inbound_call_atomically'
   OR routine_name LIKE 'update_call_completed_atomically'
   OR routine_name LIKE 'update_call_with_recording_atomically';

-- Should return 3 rows (all 3 functions)

-- Verify NOT NULL constraints exist
SELECT constraint_name FROM information_schema.check_constraints
WHERE table_name IN ('call_logs', 'call_tracking', 'calls', 'recording_upload_queue')
AND constraint_name LIKE '%org_id%';

-- Should return 4+ rows (one per table)

-- Verify composite indexes exist
SELECT indexname FROM pg_stat_user_indexes
WHERE indexname IN ('idx_processed_events_org_event',
                     'idx_call_logs_org_vapi_call_id',
                     'idx_call_tracking_org_vapi_call_id');

-- Should return 3 rows (all 3 indexes)
```

---

### Step 3: Deploy Code Changes (5 minutes)
**After migrations are applied and verified**

**Option A: Using Git (Recommended)**
```bash
# Ensure you're on the correct branch
git status

# Stage changes
git add src/routes/webhooks.ts

# Verify only webhooks.ts is staged
git diff --staged

# Commit with meaningful message
git commit -m "CRITICAL: Phase 1 fixes - org_id isolation + idempotency

- Add org_id filters to 3 UPDATE statements (handleCallEnded, handleEndOfCallReport)
- Fix inverted idempotency sequence in handleCallEnded
- Prepare for atomic RPC functions (migrations deployed)

Fixes: #CRITICAL-1, #CRITICAL-2, #CRITICAL-4"

# Push to remote
git push origin main

# CI/CD pipeline runs automatically (if configured)
```

**Option B: Using Render Dashboard (Manual)**
1. Go to Render Dashboard → Your Backend Service
2. Click "Manual Deploy"
3. Select branch: "main" (or your deployment branch)
4. Click "Deploy"
5. Wait for deployment to complete (usually 2-3 minutes)
6. Verify service is "Live" and "up to date"

**Verification**: Check Render logs for any errors
```
# In Render dashboard, click "Logs" tab
# Look for lines like:
# "Server listening on port 3001"
# "Database connected"
# Should NOT see TypeScript errors
```

---

### Step 4: Health Check Verification (3 minutes)
**Confirm deployment successful**

**Test 1: Basic Health Endpoint**
```bash
curl https://your-render-app.onrender.com/health

# Expected response:
# {
#   "status": "ok",
#   "database_size_mb": 125.4,
#   "services": {
#     "database": true,
#     "supabase": true,
#     "backgroundJobs": true
#   },
#   "timestamp": "2025-12-21T12:34:56.789Z",
#   "uptime": 3600
# }
```

**Test 2: Database Size Check**
```bash
curl https://your-render-app.onrender.com/health | jq '.database_size_mb'

# Expected: A number between 50-500 (depends on your data)
# If you see "database_size_mb": 0, the RPC function may not exist
```

**Test 3: Webhook Signature Verification**
```bash
# Test with invalid signature (should get 401)
curl -X POST https://your-render-app.onrender.com/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: invalid" \
  -d '{"type":"call.started","call":{"id":"test"}}'

# Expected response: 401 Unauthorized
# If you get 200, signature verification may be disabled
```

---

### Step 5: Monitor Logs (5 minutes)
**Watch for any errors or issues**

**In Render Dashboard**:
1. Go to Logs tab
2. Look for these patterns:
   - ✅ "Health check endpoint verified"
   - ✅ "Database connectivity confirmed"
   - ❌ "Error checking idempotency"
   - ❌ "Failed to mark event as processed"
   - ❌ "CRITICAL"

**In Supabase Dashboard**:
1. Go to SQL Editor
2. Run this query to verify no errors occurred:
```sql
SELECT * FROM processed_webhook_events
ORDER BY created_at DESC
LIMIT 10;

-- Should show events being logged
-- Should NOT show NULL org_ids
```

---

## Post-Deployment (First 24 Hours)

### Hour 0-1: Intensive Monitoring
- [ ] Watch logs continuously
- [ ] Monitor health endpoint every 5 minutes
- [ ] Verify no 500 errors in logs
- [ ] Check database size isn't growing unexpectedly

### Hour 1-4: Standard Monitoring
- [ ] Check logs every 15 minutes
- [ ] Health endpoint check every 10 minutes
- [ ] Verify webhook processing working (if calls coming in)

### Hour 4-24: Continuous Monitoring
- [ ] Health endpoint check every 30 minutes
- [ ] Database size check once per 4 hours
- [ ] Monitor for any data inconsistencies

### Daily (After First 24 Hours)
- [ ] Health endpoint check twice daily
- [ ] Database size check daily (compare to baseline)
- [ ] Review logs for any errors or warnings
- [ ] Verify idempotency working (no duplicates in call logs)

---

## Rollback Plan (If Issues Occur)

### Scenario 1: Code Error (TypeScript/Logic)
**Symptoms**: 500 errors in logs, calls not being processed

**Action**:
```bash
# Rollback code to previous version
git revert HEAD

# Push to trigger new deploy
git push origin main

# Wait for Render to redeploy (~3 minutes)

# Verify
curl https://your-render-app.onrender.com/health
```

**Note**: Database schema remains unchanged (safe to revert code anytime)

### Scenario 2: Migration Issue (Constraints Breaking Insert)
**Symptoms**: "NOT NULL constraint violation" or "constraint failed" errors

**Action** (via Supabase SQL Editor):
```sql
-- Option 1: Drop the problematic constraint (QUICK)
ALTER TABLE call_logs DROP CONSTRAINT call_logs_org_id_not_null;

-- Option 2: Restore from backup (SAFEST)
-- Contact Supabase support or restore from automated backup
```

**Then**:
1. Fix the issue in code/migrations
2. Re-deploy migrations with corrected logic
3. Re-deploy code

### Scenario 3: Complete Rollback Required
**Symptoms**: Multiple errors, data inconsistency, unsure of cause

**Action**:
```bash
# 1. Rollback code
git revert HEAD
git push origin main
# Wait for Render redeploy

# 2. Restore database from backup
# Go to Supabase Dashboard → Backups
# Click "Restore" on the backup from before deployment
# Wait 5-10 minutes for restore to complete

# 3. Verify
curl https://your-render-app.onrender.com/health

# 4. Test webhook (if possible)
# Send test call and verify logs
```

**Note**: This reverts BOTH code AND database to pre-deployment state

---

## Verification Queries

### Query 1: Verify org_id Isolation
```sql
-- For each org, verify call_logs have correct org_id
SELECT org_id, COUNT(*) as call_count
FROM call_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY org_id;

-- Should see one row per organization
-- If org_id is NULL, constraint failed
```

### Query 2: Verify Idempotency Working
```sql
-- Check for duplicate event_ids (should be none)
SELECT event_id, COUNT(*) as occurrences
FROM processed_webhook_events
GROUP BY event_id
HAVING COUNT(*) > 1;

-- Should return zero rows
-- If any rows, idempotency failed
```

### Query 3: Verify No NULL org_ids
```sql
-- Check for NULL org_ids in critical tables
SELECT 'call_logs' as table_name, COUNT(*) as null_count
FROM call_logs WHERE org_id IS NULL
UNION ALL
SELECT 'call_tracking', COUNT(*)
FROM call_tracking WHERE org_id IS NULL
UNION ALL
SELECT 'calls', COUNT(*)
FROM calls WHERE org_id IS NULL;

-- Should return all zeros
-- If any non-zero, constraints didn't work
```

---

## Troubleshooting

### Issue: Health endpoint returns 0 for database_size_mb
**Cause**: RPC function `pg_database_size()` doesn't exist
**Solution**:
1. Verify migration ran: Check Supabase SQL Editor
2. Re-run first migration: Copy-paste entire `20251221_create_atomic_call_handlers.sql`
3. Restart service: Render Dashboard → Manual Deploy

### Issue: "NOT NULL constraint violation" on INSERT
**Cause**: org_id not being set in INSERT statement
**Solution**:
1. Check webhook code: Ensure `org_id` is being passed
2. Check agent lookup: Verify `org_id` comes from agent record
3. Add logging: Log org_id value before INSERT

### Issue: 401 Unauthorized on all webhooks
**Cause**: Signature verification failed or secret changed
**Solution**:
1. Verify VAPI_WEBHOOK_SECRET in environment:
   ```bash
   # In Render dashboard, check Environment
   # Should match Vapi dashboard → Webhooks → Signing Secret
   ```
2. If secret changed in Vapi:
   - Copy new secret from Vapi dashboard
   - Update VAPI_WEBHOOK_SECRET in Render environment
   - Restart service

### Issue: Webhooks hanging/timing out
**Cause**: RPC function taking too long
**Solution**:
1. Check database load (Supabase dashboard)
2. Check logs for slow queries
3. Consider reducing webhook rate temporarily
4. Contact support if persists

---

## Success Criteria

After deployment, verify all of these:

- [ ] Health endpoint returns 200 with database_size_mb field
- [ ] Invalid webhook signatures return 401
- [ ] Valid webhooks process without errors
- [ ] call_logs records have org_id populated
- [ ] call_tracking records have org_id populated
- [ ] No NULL org_id values exist in database
- [ ] Duplicate webhooks are skipped (idempotency works)
- [ ] Logs show no "CRITICAL" errors
- [ ] Response time for /health < 500ms
- [ ] Database size doesn't grow unexpectedly

---

## Timeline Summary

| Step | Time | Action |
|------|------|--------|
| Pre-Deploy | 5 min | Backup database |
| Migration 1 | 2 min | Deploy atomic call handlers RPC |
| Migration 2 | 2 min | Deploy NOT NULL constraints |
| Code Deploy | 5 min | Deploy webhooks.ts changes |
| Health Check | 3 min | Verify endpoints working |
| Log Monitor | 5 min | Watch for errors |
| **Total** | **22 min** | **Complete** |

---

## Need Help?

### If Deployment Fails
1. Check deployment logs in Render dashboard
2. Review error message carefully
3. Follow rollback steps above
4. Re-read the specific troubleshooting section

### If Migration Fails
1. Verify database credentials are correct
2. Ensure no other migrations are running
3. Check Supabase dashboard → Database → Activity
4. Restore from backup if needed

### If Unsure
1. Don't proceed to next step
2. Reach out to the team
3. Review CODE_REVIEW.md for context
4. Check TRANSACTIONS_EXPLAINED.md for concepts

---

## Post-Deployment Handoff

After successful deployment:

**Documentation to Share**:
- ✅ PHASE1_CRITICAL_FIXES_SUMMARY.md (implementation details)
- ✅ CODE_REVIEW_SUMMARY.md (at-a-glance issues)
- ✅ TRANSACTIONS_EXPLAINED.md (learning guide)
- ✅ MONITORING.md (ops runbook)

**For Operations Team**:
- Monitoring checklist (see above)
- Rollback procedures
- Troubleshooting guide

**For Development Team**:
- Next steps: Phase 2 improvements
- Code review feedback summary
- Testing recommendations

---

**Deployment Ready**: ✅
**Confidence Level**: High (92%)
**Rollback Capability**: Yes (< 15 minutes)

Good luck with deployment! 🚀
