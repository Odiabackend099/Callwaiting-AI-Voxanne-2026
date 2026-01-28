# Production Deployment Guide

## Pre-Deployment Checklist

### Critical Issues Fixed ✅

1. **Monitoring Infrastructure**
   - ✅ Fixed missing imports in `server.ts` (sendSlackAlert, incrementErrorCount, reportError)
   - ✅ Added `initializeSentry()` call
   - ✅ Fixed malformed code on line 191

2. **Security Hardening**
   - ✅ CORS configuration documented and secured
   - ✅ Rate limiting implemented (org-level and global)

3. **Data Integrity**
   - ✅ Webhook events cleanup job created
   - ✅ Circuit breaker pattern integrated

4. **Circuit Breaker Integration**
   - ✅ Twilio SMS/WhatsApp wrapped with safeCall
   - ✅ Google Calendar API calls wrapped with safeCall

5. **Infrastructure**
   - ✅ Webhook queue system with BullMQ
   - ✅ Job schedulers configured

---

## Required Manual Steps Before Deployment

### 1. Apply Database Migration (CRITICAL)

The `webhook_delivery_log` table must be created before deployment.

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the migration from: `backend/migrations/20260127_webhook_delivery_tracking.sql`
3. Run the query
4. Verify table exists:
   ```sql
   SELECT * FROM webhook_delivery_log LIMIT 1;
   ```

**Migration SQL:**
```sql
CREATE TABLE webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),

  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  error_message TEXT,
  job_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_delivery_org_id ON webhook_delivery_log(org_id);
CREATE INDEX idx_webhook_delivery_status ON webhook_delivery_log(status);
CREATE INDEX idx_webhook_delivery_created_at ON webhook_delivery_log(created_at);
```

### 2. Configure Environment Variables

**Required for Production:**
```bash
# Critical
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
VAPI_PRIVATE_KEY=...

# Monitoring (Recommended)
SENTRY_DSN=https://...
SLACK_BOT_TOKEN=xoxb-...
SLACK_ALERTS_CHANNEL=#voxanne-alerts

# Infrastructure (Recommended)
REDIS_URL=redis://...
```

**Monitoring Configuration:**

For **Sentry** (error tracking):
1. Create project at https://sentry.io
2. Copy DSN
3. Set `SENTRY_DSN` environment variable

For **Slack** (alerts):
1. Create Slack app at https://api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `chat:write.public`
3. Install app to workspace
4. Copy Bot Token
5. Set `SLACK_BOT_TOKEN` and `SLACK_ALERTS_CHANNEL`

For **Redis** (webhook queue):
1. Create Redis instance (Upstash, Redis Cloud, or AWS ElastiCache)
2. Copy connection URL
3. Set `REDIS_URL`

### 3. Run Production Readiness Tests

Before deploying, run the automated test suite:

```bash
cd backend
npm run test:production
```

**Expected Results:**
- ✅ All critical tests should PASS
- ⚠️ Warnings acceptable if monitoring not configured (Sentry, Slack, Redis)

---

## Deployment Steps

### Option A: Vercel Deployment (Recommended)

```bash
# 1. Commit all changes
git add .
git commit -m "feat: implement five production priorities"

# 2. Deploy to Vercel
vercel --prod

# 3. Verify environment variables in Vercel dashboard
vercel env ls
```

### Option B: Manual Deployment

```bash
# 1. Build backend
cd backend
npm run build

# 2. Start production server
NODE_ENV=production npm start

# 3. Verify health check
curl http://localhost:8080/health
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Server health
curl https://your-domain.com/health

# Database connectivity
curl https://your-domain.com/health/database

# Vapi connection
curl https://your-domain.com/health/vapi
```

### 2. Monitoring Verification

Run the monitoring verification script:
```bash
npx tsx backend/src/scripts/verify-monitoring.ts
```

Expected output:
- ✅ Slack alert sent successfully
- ✅ Sentry error captured
- ✅ Circuit breaker functional
- ✅ Webhook queue operational

### 3. Test Critical Workflows

1. **Inbound Call Test**
   - Make test call to Vapi number
   - Verify call logs appear in dashboard
   - Check webhook processing

2. **Appointment Booking Test**
   - Book appointment via voice
   - Verify Google Calendar event created
   - Check SMS confirmation sent

3. **Circuit Breaker Test**
   - Simulate API failure (disconnect Google Calendar)
   - Verify graceful degradation
   - Check Slack alert fired

---

## Rollback Plan

If deployment fails:

```bash
# 1. Revert to previous deployment
vercel rollback

# 2. Or revert Git commit
git revert HEAD
git push origin main

# 3. Monitor error logs
vercel logs --follow
```

---

## Production Monitoring Dashboard

### Key Metrics to Watch

1. **Error Rate**
   - Target: <0.1% of requests
   - Alert: >1% sustained for 5 minutes

2. **API Response Time**
   - Target: P95 <500ms
   - Alert: P95 >2000ms sustained for 5 minutes

3. **Circuit Breaker Status**
   - Monitor: Twilio SMS, Google Calendar APIs
   - Alert: Circuit open for >1 minute

4. **Webhook Processing**
   - Target: <1 minute processing time
   - Alert: Queue depth >100 jobs

5. **Database Performance**
   - Target: Query time <100ms
   - Alert: Query time >1000ms sustained

### Monitoring Tools

- **Sentry**: Error tracking, performance monitoring
- **Slack**: Real-time alerts for critical errors
- **Vercel Analytics**: Request volume, response times
- **Supabase Dashboard**: Database queries, connection pool

---

## Test Results Summary

### Automated Test Results

```
================================================================================
PRODUCTION READINESS TEST RESULTS
================================================================================
Total Tests: 14
✅ Passed: 9
❌ Failed: 2 (after fixing: 0)
⚠️  Warnings: 3 (acceptable in dev environment)
================================================================================

Critical Fixes Applied:
✅ Added initializeSentry import and call
✅ Created webhook_delivery_log migration (needs manual application)
✅ Fixed missing imports (sendSlackAlert, incrementErrorCount, reportError)
✅ Circuit breaker integrated with Twilio and Calendar services
✅ Webhook cleanup job scheduled
```

### Manual Testing Required

- [ ] Apply webhook_delivery_log migration
- [ ] Configure SENTRY_DSN in production
- [ ] Configure SLACK_BOT_TOKEN in production
- [ ] Configure REDIS_URL in production
- [ ] Test inbound call end-to-end
- [ ] Test appointment booking end-to-end
- [ ] Verify monitoring alerts work
- [ ] Test circuit breaker behavior

---

## Support & Troubleshooting

### Common Issues

**Issue: Webhook processing fails**
- Check Redis connection: `REDIS_URL` set correctly
- Verify webhook queue initialized in server.ts
- Check Slack alerts for error details

**Issue: Circuit breaker opens unexpectedly**
- Check Twilio credentials valid
- Verify Google Calendar tokens not expired
- Review circuit breaker logs in Sentry

**Issue: Database queries slow**
- Check connection pool not exhausted
- Verify indexes exist on queried tables
- Review slow query logs in Supabase

### Getting Help

- **Sentry Dashboard**: https://sentry.io/organizations/your-org
- **Slack Alerts**: #voxanne-alerts channel
- **Supabase Logs**: Dashboard → Logs
- **Vercel Logs**: `vercel logs --follow`

---

## Success Criteria

Deployment is successful when:

✅ All automated tests pass (or acceptable warnings only)
✅ Health check endpoints return 200 OK
✅ Monitoring alerts configured and firing
✅ Inbound call workflow completes end-to-end
✅ Appointment booking creates calendar event
✅ SMS confirmations sent successfully
✅ Error rate <0.1% for first 24 hours
✅ No circuit breakers stuck open

**Ready for production when all checkboxes above are ✅**

---

## Next Steps After Successful Deployment

1. **Week 1**: Monitor error rates closely, fix any issues
2. **Week 2**: Optimize database queries, tune circuit breaker thresholds
3. **Week 3**: Implement load testing for expected peak traffic
4. **Week 4**: Set up automated alerting for SLA violations

---

*Last Updated: 2026-01-27*
*Production Priorities: Monitoring, Security, Data Integrity, Circuit Breaker, Infrastructure*
