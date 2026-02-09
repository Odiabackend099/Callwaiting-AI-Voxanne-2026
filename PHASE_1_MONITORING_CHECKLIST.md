# Phase 1 Billing Infrastructure - 24-Hour Monitoring Checklist

**Monitoring Period:** 2026-02-09 05:56 PST → 2026-02-10 05:56 PST
**Purpose:** Verify stability before production deployment
**Owner:** CTO / Technical Lead

---

## Quick Reference Commands

```bash
# All-in-one health check
curl -s http://localhost:3001/health | python3 -m json.tool

# Check all listening services
lsof -i -P -n | grep LISTEN | grep -E ":300[01]|:404[01]|:6379"

# Redis queue metrics
redis-cli INFO stats | grep -E "total_commands_processed|keyspace"

# Backend logs (last 50 lines)
tail -50 /tmp/voxanne_final_startup.log

# Backend memory usage
ps aux | grep "node.*3001" | grep -v grep | awk '{print $6/1024" MB"}'

# Redis memory usage
redis-cli INFO memory | grep used_memory_human
```

---

## Monitoring Schedule

### ⏰ Every 2 Hours (12 checks total)

**Time Slots:**
- 08:00 AM PST (Hour 2)
- 10:00 AM PST (Hour 4)
- 12:00 PM PST (Hour 6)
- 02:00 PM PST (Hour 8)
- 04:00 PM PST (Hour 10)
- 06:00 PM PST (Hour 12)
- 08:00 PM PST (Hour 14)
- 10:00 PM PST (Hour 16)
- 12:00 AM PST (Hour 18)
- 02:00 AM PST (Hour 20)
- 04:00 AM PST (Hour 22)
- 06:00 AM PST (Hour 24) ✅ MONITORING COMPLETE

**At Each Check:**
1. [ ] Run health check command (verify all services: true)
2. [ ] Check backend uptime (should increase by ~2 hours)
3. [ ] Check Redis memory usage (should be stable <50MB)
4. [ ] Review backend logs for errors (last 50 lines)
5. [ ] Verify queue metrics (no stalled jobs)
6. [ ] Document any anomalies

---

## Hour-by-Hour Checklist

### Hour 2: 08:00 AM PST ⏰
**Timestamp:** _________________

#### Health Check
```bash
curl -s http://localhost:3001/health | python3 -m json.tool
```

- [ ] Status: `ok`
- [ ] Database: `true`
- [ ] Supabase: `true`
- [ ] backgroundJobs: `true`
- [ ] webhookQueue: `true`
- [ ] Uptime: ~2 hours (7,200 seconds)

#### Backend Logs
```bash
tail -50 /tmp/voxanne_final_startup.log
```

- [ ] No ERROR level logs
- [ ] No CRITICAL alerts
- [ ] RecordingQueueWorker running normally

#### Redis Check
```bash
redis-cli INFO memory | grep used_memory_human
```

- [ ] Memory usage: _______ MB (should be <50MB)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 4: 10:00 AM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~4 hours (14,400 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 6: 12:00 PM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~6 hours (21,600 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Queue Metrics (Midday Check)
```bash
curl -s http://localhost:3001/api/monitoring/queue-stats -H "Authorization: Bearer <TOKEN>"
```

- [ ] Active jobs: _______
- [ ] Completed jobs: _______
- [ ] Failed jobs: _______ (should be 0)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 8: 02:00 PM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~8 hours (28,800 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 10: 04:00 PM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~10 hours (36,000 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 12: 06:00 PM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~12 hours (43,200 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Halfway Point Assessment
- [ ] No critical errors encountered
- [ ] Backend uptime stable (>12 hours)
- [ ] Redis memory stable (<50MB)
- [ ] All queue workers healthy

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 14: 08:00 PM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~14 hours (50,400 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 16: 10:00 PM PST ⏰
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~16 hours (57,600 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 18: 12:00 AM PST ⏰ (Overnight Check)
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~18 hours (64,800 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 20: 02:00 AM PST ⏰ (Overnight Check)
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~20 hours (72,000 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Vapi Reconciliation Job Check (if 3 AM UTC = 7 PM PST)
**Note:** If 3 AM UTC is between Hour 20-22, check reconciliation logs:

```bash
grep -i "reconcil" /tmp/voxanne_final_startup.log | tail -20
```

- [ ] Reconciliation job triggered (if applicable)
- [ ] No errors during reconciliation

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 22: 04:00 AM PST ⏰ (Overnight Check)
**Timestamp:** _________________

#### Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~22 hours (79,200 seconds)

#### Backend Logs
- [ ] No new errors since last check

#### Redis Check
- [ ] Memory usage: _______ MB (stable?)

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

### Hour 24: 06:00 AM PST ⏰ ✅ MONITORING COMPLETE
**Timestamp:** _________________

#### Final Health Check
- [ ] Status: `ok`
- [ ] All services: `true`
- [ ] Uptime: ~24 hours (86,400 seconds) ✅

#### Final Backend Logs Review
```bash
grep -i -E "error|critical|fatal" /tmp/voxanne_final_startup.log | wc -l
```

- [ ] Critical errors: _______ (should be 0)

#### Final Redis Check
- [ ] Memory usage: _______ MB (stable throughout)

#### Final Queue Metrics
```bash
curl -s http://localhost:3001/api/monitoring/queue-stats -H "Authorization: Bearer <TOKEN>"
```

- [ ] Active jobs: _______
- [ ] Completed jobs: _______
- [ ] Failed jobs: _______ (should be 0)
- [ ] Stalled jobs: _______ (should be 0)

#### 24-Hour Summary
- [ ] Total uptime: 24 hours ✅
- [ ] Critical errors: 0 ✅
- [ ] Backend memory stable ✅
- [ ] Redis memory stable ✅
- [ ] All queue workers healthy ✅
- [ ] No Slack alerts ✅

#### Notes
___________________________________________________________________________
___________________________________________________________________________

---

## Automated Monitoring (Optional)

### Setup Continuous Monitoring Script

Create `monitor-phase1.sh`:

```bash
#!/bin/bash
# Phase 1 24-Hour Monitoring Script
# Run: ./monitor-phase1.sh

LOG_FILE="phase1_monitoring_$(date +%Y%m%d).log"
CHECK_INTERVAL=7200  # 2 hours in seconds

while true; do
  echo "========================================" >> "$LOG_FILE"
  echo "Check at: $(date)" >> "$LOG_FILE"

  # Health check
  curl -s http://localhost:3001/health >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # Redis memory
  echo "Redis Memory:" >> "$LOG_FILE"
  redis-cli INFO memory | grep used_memory_human >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # Backend memory
  echo "Backend Memory:" >> "$LOG_FILE"
  ps aux | grep "node.*3001" | grep -v grep | awk '{print $6/1024" MB"}' >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # Recent errors
  echo "Recent Errors:" >> "$LOG_FILE"
  tail -50 /tmp/voxanne_final_startup.log | grep -i error >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  sleep $CHECK_INTERVAL
done
```

**Usage:**
```bash
chmod +x monitor-phase1.sh
nohup ./monitor-phase1.sh &

# View live monitoring
tail -f phase1_monitoring_20260209.log
```

---

## Alert Thresholds

### Critical Alerts 🔴 (Immediate Action Required)

**Condition:** Backend crashes (health check fails)
**Action:** Restart backend immediately, investigate cause

**Condition:** Redis connection lost (webhookQueue: false)
**Action:** Restart Redis, check logs

**Condition:** Backend memory >1GB
**Action:** Investigate memory leak, restart if necessary

**Condition:** Queue jobs stalled >10 minutes
**Action:** Check BullMQ workers, restart if needed

### Warning Alerts 🟡 (Investigate Soon)

**Condition:** Redis memory >100MB
**Action:** Check for memory leak, clear unnecessary keys

**Condition:** Backend uptime resets unexpectedly
**Action:** Review crash logs, identify root cause

**Condition:** ERROR logs >10 in 1 hour
**Action:** Review error patterns, fix recurring issues

### Info Alerts 🔵 (Monitor)

**Condition:** RecordingQueueWorker processing calls
**Action:** Normal operation, no action required

**Condition:** Queue jobs completing normally
**Action:** System healthy, continue monitoring

---

## Incident Response

### If Backend Crashes

1. **Check logs immediately:**
   ```bash
   tail -200 /tmp/voxanne_final_startup.log | grep -A 10 -i "error\|fatal"
   ```

2. **Restart backend:**
   ```bash
   pkill -9 -f "npm run startup"
   cd backend && export NGROK_AUTH_TOKEN="..." && nohup npm run startup > /tmp/voxanne_restart_$(date +%Y%m%d_%H%M%S).log 2>&1 &
   ```

3. **Verify health:**
   ```bash
   sleep 30
   curl -s http://localhost:3001/health
   ```

4. **Document incident:**
   - Timestamp of crash
   - Error message from logs
   - Root cause (if identified)
   - Actions taken

### If Redis Fails

1. **Check Redis status:**
   ```bash
   redis-cli ping
   ```

2. **Restart Redis if needed:**
   ```bash
   redis-server --daemonize yes
   ```

3. **Verify backend reconnects:**
   ```bash
   curl -s http://localhost:3001/health | grep webhookQueue
   ```

### If Queue Jobs Stall

1. **Check queue metrics:**
   ```bash
   redis-cli KEYS "bull:*" | wc -l
   ```

2. **Review stalled jobs:**
   ```bash
   curl -s http://localhost:3001/api/monitoring/queue-stats
   ```

3. **Restart workers if necessary:**
   ```bash
   # Restart backend (workers restart with it)
   pkill -9 -f "npm run startup"
   cd backend && npm run startup
   ```

---

## Success Criteria (All Must Pass)

### Primary Criteria ✅

- [ ] **Uptime:** 24 hours without crashes
- [ ] **Errors:** Zero critical errors in logs
- [ ] **Redis:** webhookQueue: true throughout period
- [ ] **Memory:** Backend <500MB, Redis <100MB
- [ ] **Queue:** All jobs processed successfully (failed: 0)

### Secondary Criteria ✅

- [ ] **Logs:** No ERROR level logs (or all resolved)
- [ ] **Alerts:** No Slack alerts (or all acknowledged)
- [ ] **Performance:** Health check response <100ms
- [ ] **Stability:** No unexpected restarts

### Manual Tests Completed ✅

- [ ] **P0-1:** Send test Stripe webhook (if available)
- [ ] **P0-3:** Test debt limit enforcement (manual call)
- [ ] **P0-5:** Trigger manual reconciliation job

---

## Post-Monitoring Report

**After 24 hours, complete this summary:**

### Overall Assessment
- Total uptime: _______ hours
- Critical errors: _______
- Warning events: _______
- Info events: _______

### Issues Encountered
1. _______________________________________________________________________
2. _______________________________________________________________________
3. _______________________________________________________________________

### Resolutions Applied
1. _______________________________________________________________________
2. _______________________________________________________________________
3. _______________________________________________________________________

### Production Readiness Decision
- [ ] ✅ APPROVED: Deploy to production
- [ ] ⚠️ CONDITIONAL: Fix issues first, re-monitor
- [ ] ❌ REJECTED: Major issues, redesign required

### Approver Signature
**Name:** _______________________
**Date:** _______________________
**Decision:** _______________________

---

## Next Steps After Monitoring

### If Approved ✅
1. [ ] Deploy database migrations to production
2. [ ] Update production .env with REDIS_URL
3. [ ] Deploy backend code to production
4. [ ] Verify production health checks
5. [ ] Monitor production for 1 week

### If Conditional ⚠️
1. [ ] Document all issues found
2. [ ] Create fix plan for each issue
3. [ ] Apply fixes
4. [ ] Restart 24-hour monitoring period

### If Rejected ❌
1. [ ] Document all critical issues
2. [ ] Identify architectural problems
3. [ ] Create redesign plan
4. [ ] Re-implement Phase 1
5. [ ] Restart monitoring from scratch

---

**Checklist Created:** 2026-02-09 05:56:00 PST
**Monitoring Start:** 2026-02-09 05:56:00 PST
**Monitoring End:** 2026-02-10 05:56:00 PST
**Owner:** CTO / Technical Lead
**Status:** ⏳ Active Monitoring Period
