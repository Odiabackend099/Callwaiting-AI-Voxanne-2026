# PHASE 7: 24-Hour Production Monitoring

**Status:** Active  
**Duration:** 24 hours (Dec 21 12:15 PM → Dec 22 12:15 PM UTC+01:00)  
**Owner:** Tech Lead/DevOps  
**Goal:** Confirm system is stable before customer launch Monday

---

## Monitoring Schedule

### Hour 0 (NOW - 12:15 PM)
- [ ] Verify Sentry is receiving events
- [ ] Check health endpoint: `curl https://voxanne-backend.onrender.com/health`
- [ ] Review Render logs for errors
- [ ] Baseline metrics recorded

### Hour 4 (4:15 PM)
- [ ] Check error rate in Sentry (<1% target)
- [ ] Verify no new critical issues
- [ ] Check database performance
- [ ] Review response times

### Hour 8 (8:15 PM)
- [ ] Mid-point status check
- [ ] Review error trends
- [ ] Check for memory leaks
- [ ] Verify background jobs running

### Hour 12 (12:15 AM - Next day)
- [ ] Overnight stability check
- [ ] Review error patterns
- [ ] Check database connections
- [ ] Verify all services healthy

### Hour 16 (4:15 AM)
- [ ] Early morning check
- [ ] Review logs for any issues
- [ ] Verify system still responding
- [ ] Check error rate trend

### Hour 20 (8:15 AM)
- [ ] Pre-launch check
- [ ] Final error review
- [ ] Performance metrics
- [ ] Ready to declare stable?

### Hour 24 (12:15 PM - SIGN-OFF)
- [ ] Final verification
- [ ] Approve for customer launch
- [ ] Document any issues found
- [ ] Plan next optimizations

---

## What to Check at Each Interval

### 1. Health Endpoint (1 minute)

```bash
curl https://voxanne-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "services": {
    "database": true,
    "supabase": true,
    "backgroundJobs": true
  },
  "timestamp": "2025-12-21T12:15:00.000Z",
  "uptime": 3600
}
```

**If database shows false:**
- Wait 30 seconds and retry
- Check Supabase status page
- If persists >2 minutes: Alert team

---

### 2. Sentry Dashboard (5 minutes)

Go to: https://sentry.io → Your Voxanne project

**Check:**
- [ ] Error count (should be <5 per hour)
- [ ] Error rate (should be <1%)
- [ ] New issues (should be 0)
- [ ] Top errors (review top 3)

**What's Normal:**
- ✅ 404 errors on unknown routes
- ✅ 429 rate limit errors
- ✅ Vapi API timeouts
- ✅ Occasional database resets

**What's Critical:**
- ❌ Database connection failures
- ❌ Memory leaks
- ❌ Unhandled promise rejections
- ❌ WebSocket disconnections >10%

---

### 3. Render Logs (5 minutes)

Go to: https://dashboard.render.com → voxanne-backend → Logs

**Check:**
- [ ] No ERROR level messages
- [ ] No repeated error patterns
- [ ] Background jobs running (every 30 seconds)
- [ ] Memory usage stable

**Commands to search:**
- `ERROR` - Find all errors
- `WARN` - Find warnings
- `database` - Check DB health
- `timeout` - Check for timeouts

---

### 4. Performance Metrics (3 minutes)

**Response Times:**
- Health endpoint: <100ms (target)
- Calls endpoint: <500ms (target)
- Webhooks: <200ms (target)
- Assistants: <1000ms (known slow)

**Check in Sentry:**
1. Go to **Performance** tab
2. Look at p(99) response times
3. Should be <1000ms for most endpoints

---

### 5. Database Status (2 minutes)

Go to: https://app.supabase.com → Your project

**Check:**
- [ ] Database is online
- [ ] No slow queries (>1000ms)
- [ ] Connection pool healthy
- [ ] Disk usage normal

**Query to run:**
```sql
SELECT 
  datname,
  numbackends,
  pg_database_size(datname) as size_bytes
FROM pg_stat_database
WHERE datname = 'postgres'
LIMIT 1;
```

---

## Escalation Procedures

### If Error Rate > 5%

1. **Immediate:** Check Sentry for error details
2. **Within 5 min:** Identify root cause
3. **Options:**
   - If Vapi API issue: Expected, monitor
   - If database issue: Check Supabase status
   - If code issue: Prepare rollback

### If Health Check Fails

1. **Immediate:** Wait 30 seconds, retry
2. **If still failing:** Check Render logs
3. **If database shows false:** Check Supabase
4. **If persists >2 min:** Rollback

```bash
# Rollback command (if needed)
git revert HEAD
git push origin main
# Render auto-deploys previous version
```

### If New Critical Issue Appears

1. **Assess severity:**
   - Critical: Blocks core calls → Rollback
   - High: Affects some users → Fix & redeploy
   - Medium: Minor impact → Monitor & fix later
   - Low: Cosmetic → Document & fix later

2. **If rollback needed:**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **After rollback:**
   - Wait 5 minutes for deployment
   - Verify health endpoint
   - Investigate root cause
   - Plan fix for next deployment

---

## Success Criteria (24-Hour Sign-Off)

System is production-ready when:

- ✅ Error rate <1% throughout 24 hours
- ✅ No critical issues in Sentry
- ✅ Health checks always passing
- ✅ Database performing normally
- ✅ No unexpected restarts
- ✅ Response times stable
- ✅ Background jobs running
- ✅ WebSocket connections stable

---

## Monitoring Checklist

### Hour 0 (NOW)
- [ ] Sentry receiving events
- [ ] Health endpoint responding
- [ ] Render logs clean
- [ ] Database connected

### Hour 4
- [ ] Error rate <1%
- [ ] No new critical issues
- [ ] Response times normal
- [ ] Database healthy

### Hour 8
- [ ] Continued stability
- [ ] No memory leaks
- [ ] Background jobs running
- [ ] No error spikes

### Hour 12
- [ ] Overnight stability confirmed
- [ ] Error patterns normal
- [ ] Database connections stable
- [ ] All services healthy

### Hour 16
- [ ] Early morning check passed
- [ ] No overnight issues
- [ ] System responding normally
- [ ] Ready for business hours

### Hour 20
- [ ] Pre-launch verification
- [ ] Final error review
- [ ] Performance metrics good
- [ ] Ready to declare stable

### Hour 24 (SIGN-OFF)
- [ ] 24-hour stability confirmed
- [ ] All metrics within targets
- [ ] No critical issues found
- [ ] **APPROVED FOR CUSTOMER LAUNCH**

---

## Post-Monitoring (After 24 Hours)

Once approved:

1. **Update Status**
   - Mark system as "Production Ready"
   - Document any issues found
   - Plan optimizations for next sprint

2. **Customer Launch**
   - Contact first customer Monday morning
   - Begin onboarding
   - Monitor closely first week

3. **Ongoing Monitoring**
   - Continue checking Sentry daily
   - Monitor error trends
   - Plan performance improvements
   - Schedule assistants endpoint optimization

---

## Contact & Escalation

**If critical issue during monitoring:**

1. Check Sentry for details
2. Check Render logs for root cause
3. Decide: Fix or Rollback
4. If rollback: Execute immediately
5. If fix: Deploy and re-monitor

**Team contacts:**
- Tech Lead: [Your name/contact]
- DevOps: [Your name/contact]
- On-call: [Your name/contact]

---

## Timeline Summary

```
Dec 21, 12:15 PM - Monitoring starts
Dec 21, 4:15 PM  - 4-hour check
Dec 21, 8:15 PM  - 8-hour check
Dec 22, 12:15 AM - 12-hour check
Dec 22, 4:15 AM  - 16-hour check
Dec 22, 8:15 AM  - 20-hour check
Dec 22, 12:15 PM - 24-hour sign-off ✅ APPROVED
Dec 23, 9:00 AM  - Contact first customer
```

---

**Status:** Monitoring Active  
**Duration:** 24 hours  
**Goal:** Confirm production readiness before customer launch
