# DEPLOYMENT PHASES 3-7: MANUAL EXECUTION GUIDE

**Status:** Phase 1-2 Complete ✅  
**Current Phase:** Phase 3 (Database Migration)  
**Timeline:** 20 minutes remaining (Phases 3-6) + 24 hours monitoring (Phase 7)

---

## PHASE 3: Apply Database Migration (2 minutes)

**Owner:** DevOps  
**Action:** Manual - Go to Supabase SQL Editor

### Steps:

1. **Go to:** https://app.supabase.com
2. **Select:** Your Voxanne project
3. **Click:** "SQL Editor" (left sidebar)
4. **Click:** "New query"
5. **Copy and paste the entire SQL migration below:**

```sql
-- Migration: Add Performance Indexes for Queue Tables
-- Purpose: Optimize database queries for recording upload queue processing
-- Date: 2025-12-21

-- Indexes for recording_upload_queue (used by queue worker)
-- Worker queries by status and priority
CREATE INDEX IF NOT EXISTS idx_recording_upload_queue_status_priority
  ON recording_upload_queue(status, priority DESC)
  WHERE status IN ('pending', 'processing');

-- Query for locked items waiting for retry
CREATE INDEX IF NOT EXISTS idx_recording_upload_queue_locked_until
  ON recording_upload_queue(locked_until, status)
  WHERE status = 'processing';

-- Indexes for failed_recording_uploads (used by retry service)
-- Retry service checks which items are due for retry
CREATE INDEX IF NOT EXISTS idx_failed_uploads_next_retry
  ON failed_recording_uploads(next_retry_at)
  WHERE retry_count < max_retries;

-- Archive old failed uploads
CREATE INDEX IF NOT EXISTS idx_failed_uploads_created_at
  ON failed_recording_uploads(created_at DESC)
  WHERE retry_count >= max_retries;

-- Indexes for orphaned_recordings (used by cleanup job)
-- Cleanup job finds unclean orphaned recordings
CREATE INDEX IF NOT EXISTS idx_orphaned_recordings_cleanup_status
  ON orphaned_recordings(cleaned_up_at)
  WHERE cleaned_up_at IS NULL;

-- Find recordings by storage path for manual cleanup
CREATE INDEX IF NOT EXISTS idx_orphaned_recordings_storage_path
  ON orphaned_recordings(storage_path);

-- Indexes for recording_upload_metrics (used for monitoring)
-- Dashboard queries recent metrics
CREATE INDEX IF NOT EXISTS idx_recording_metrics_created_at
  ON recording_upload_metrics(created_at DESC);

-- Query metrics by organization
CREATE INDEX IF NOT EXISTS idx_recording_metrics_org_created
  ON recording_upload_metrics(org_id, created_at DESC);
```

6. **Click:** "Run" button
7. **Wait:** Should complete instantly (1-2 seconds)
8. **Verify:** No errors in output

### Verification Query (Optional):
```sql
-- Run this to confirm all indexes exist
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('recording_upload_queue', 'failed_recording_uploads', 'orphaned_recordings', 'recording_upload_metrics')
ORDER BY tablename, indexname;
```

**Expected Result:** 8 indexes created

---

## PHASE 4: Verify Health Endpoint (1 minute)

**Owner:** QA/DevOps  
**Action:** Terminal command

### Command:
```bash
curl https://voxanne-backend.onrender.com/health
```

### Expected Response:
```json
{
  "status": "ok",
  "services": {
    "database": true
  }
}
```

### If Database Shows False:
1. Wait 30 seconds (service may still be starting)
2. Retry the curl command
3. If still false after 2 minutes: Check Render logs for errors

### Response Time:
- Should be <500ms
- If >1000ms: Database may be slow (check Supabase metrics)

---

## PHASE 5: Run Load Test (10 minutes)

**Owner:** QA  
**Action:** Terminal command

### Prerequisites:
```bash
# Install k6 if not already installed
brew install k6  # macOS
# or
apt-get install k6  # Linux
# or
choco install k6  # Windows
```

### Command:
```bash
# Option 1: Test against production
BASE_URL=https://voxanne-backend.onrender.com k6 run load-test.js

# Option 2: Test against localhost (if running locally)
k6 run load-test.js
```

### Expected Output:
```
✓ checks passed: 100%
✓ http_req_duration < 1000ms: 100%
✓ http_req_failed < 5%: 100%
```

### Success Criteria:
- ✅ All checks passed (100%)
- ✅ p(99) response time <1000ms
- ✅ Error rate <5%
- ✅ No connection timeouts
- ✅ No crashes

### If Load Test Fails:
1. Check Render logs: https://dashboard.render.com
2. Check Sentry dashboard: https://sentry.io
3. Check database status in Supabase
4. If critical: Rollback with `git revert HEAD && git push origin main`

---

## PHASE 6: Configure Sentry Alerts (2 minutes)

**Owner:** DevOps  
**Action:** Manual - Go to Sentry Dashboard

### Steps:

1. **Go to:** https://sentry.io
2. **Select:** Your Voxanne project
3. **Click:** "Alerts" (left sidebar)
4. **Click:** "Create Alert Rule"
5. **Create Alert 1: High Error Rate**
   - Condition: Error rate > 5%
   - Notification: Email/Slack
   - Save

6. **Create Alert 2: New Issue**
   - Condition: A new issue is created
   - Notification: Email/Slack
   - Save

### Verify Sentry is Receiving Events:
1. Go to Sentry dashboard
2. Look for "Events" section
3. Should see events coming in from production
4. If no events after 5 minutes: Check Render logs for Sentry DSN errors

---

## PHASE 7: 24-Hour Monitoring (Ongoing)

**Owner:** Tech Lead/DevOps  
**Action:** Passive monitoring

### Monitoring Schedule:

| Time | Check | Owner |
|------|-------|-------|
| Hour 0 | Health endpoint | DevOps |
| Hour 1 | Sentry events | Tech Lead |
| Hour 4 | Error rates | DevOps |
| Hour 8 | Performance metrics | Tech Lead |
| Hour 12 | Mid-point check | DevOps |
| Hour 16 | Performance review | Tech Lead |
| Hour 20 | Final checks | DevOps |
| Hour 24 | Sign-off | Tech Lead |

### What to Monitor:

**Sentry Dashboard:**
- Error rate (target: <1%)
- New issues appearing
- Error patterns
- Response times

**Render Logs:**
- No critical errors
- Background jobs running
- Database connections stable
- Memory/CPU usage normal

**Health Endpoint:**
- Test every 4 hours: `curl https://voxanne-backend.onrender.com/health`
- Should always return 200 OK
- Database should always show true

**Database Performance:**
- Check Supabase metrics
- Query performance normal
- No slow queries
- Indexes being used

### Success Criteria:
- ✅ Error rate <1% throughout 24 hours
- ✅ No critical issues in Sentry
- ✅ Health checks always passing
- ✅ Database performing normally
- ✅ No unexpected restarts

### If Issues Detected:
1. Check Sentry for error details
2. Check Render logs for root cause
3. If critical: Rollback immediately
   ```bash
   git revert HEAD
   git push origin main
   ```
4. If non-critical: Create fix and re-deploy

---

## 📊 CURRENT TIMELINE

```
✅ 10:15 AM - Phase 1: Code push COMPLETE
✅ 10:30 AM - Phase 2: Environment config COMPLETE (already configured)
⏳ 10:40 AM - Phase 3: Database migration (2 min) - DO THIS NOW
⏳ 10:45 AM - Phase 4: Health check (1 min)
⏳ 10:50 AM - Phase 5: Load test (10 min)
⏳ 11:00 AM - Phase 6: Sentry setup (2 min)
⏳ 11:05 AM - Phase 7: Begin 24-hour monitoring

TOMORROW (Dec 22):
⏳ 11:05 PM - 24-hour sign-off ✅ PRODUCTION READY

MONDAY (Dec 23):
⏳ 9:00 AM - Contact first customers
⏳ Revenue incoming
```

---

## 🎯 NEXT IMMEDIATE STEPS

1. **Right Now:** Go to Supabase SQL Editor
2. **Copy/Paste:** The SQL migration above
3. **Run:** Click "Run" button
4. **Verify:** No errors

Then proceed with:
- Phase 4: Health check (1 minute)
- Phase 5: Load test (10 minutes)
- Phase 6: Sentry setup (2 minutes)
- Phase 7: Monitor for 24 hours

---

## 🆘 QUICK REFERENCE

**Supabase SQL Editor:** https://app.supabase.com → SQL Editor  
**Render Dashboard:** https://dashboard.render.com  
**Sentry Dashboard:** https://sentry.io  
**Health Endpoint:** `curl https://voxanne-backend.onrender.com/health`  
**Load Test:** `BASE_URL=https://voxanne-backend.onrender.com k6 run load-test.js`  

---

**Status:** 🟢 READY TO EXECUTE PHASES 3-7  
**Confidence:** 90%+  
**Timeline:** 15 minutes to complete all phases, 24 hours to confirm stability

Let's finish this! 🚀
