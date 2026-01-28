# Production Monitoring Setup Guide

**Status:** 🚀 Ready for Configuration  
**Date:** 2026-01-27  
**Environment:** Production

---

## 📊 Monitoring Components

### 1. Sentry Error Tracking

**Purpose:** Real-time error monitoring and alerting

**Configuration:**

```bash
# Backend .env
SENTRY_DSN=https://[key]@[project].ingest.sentry.io/[id]
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_RELEASE=1.0.0
```

**Setup Steps:**

1. Go to: https://sentry.io/organizations/voxanne-ai/
2. Create new project for backend
3. Copy DSN to `.env`
4. Initialize Sentry in backend:

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: 0.1,
});
```

5. Add error handler:

```typescript
app.use(Sentry.Handlers.errorHandler());
```

**Monitoring:**
- ✅ Backend errors
- ✅ Database errors
- ✅ API errors
- ✅ Performance issues

---

### 2. Slack Notifications

**Purpose:** Real-time alerts to team

**Configuration:**

```bash
# Backend .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/[workspace]/[channel]/[token]
SLACK_BOT_TOKEN=xoxb-[token]
SLACK_CHANNEL_ALERTS=#production-alerts
SLACK_CHANNEL_MONITORING=#production-monitoring
```

**Setup Steps:**

1. Go to: https://api.slack.com/apps
2. Create new app for Voxanne
3. Enable Incoming Webhooks
4. Create webhook for #production-alerts
5. Copy webhook URL to `.env`
6. Enable Bot Token Scopes: `chat:write`, `files:write`
7. Install app to workspace

**Alert Types:**

```typescript
// Critical errors
await sendSlackAlert('🚨 CRITICAL ERROR', error, '#production-alerts');

// Backup verification
await sendSlackAlert('📦 BACKUP VERIFIED', status, '#production-monitoring');

// Feature flag changes
await sendSlackAlert('🚩 FEATURE FLAG CHANGED', change, '#production-monitoring');

// Authentication events
await sendSlackAlert('🔐 AUTH EVENT', event, '#production-monitoring');
```

**Monitoring:**
- ✅ Critical errors
- ✅ Backup status
- ✅ Feature flag changes
- ✅ Authentication events
- ✅ Performance alerts

---

### 3. Backup Verification Job

**Purpose:** Automated daily backup verification

**Configuration:**

```bash
# Backend .env
BACKUP_VERIFICATION_ENABLED=true
BACKUP_VERIFICATION_SCHEDULE=0 5 * * * # Daily at 5 AM UTC
BACKUP_VERIFICATION_WEBHOOK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/backup
```

**Setup Steps:**

1. Create backup verification job:

```typescript
import { CronJob } from 'cron';

const backupVerificationJob = new CronJob(
  '0 5 * * *', // Daily at 5 AM UTC
  async () => {
    try {
      const result = await verifyBackup();
      
      // Log to database
      await supabase
        .from('backup_verification_log')
        .insert({
          verified_at: new Date(),
          backup_id: result.backupId,
          backup_age_hours: result.ageHours,
          backup_size_mb: result.sizeMb,
          status: result.status,
          checks_passed: result.checksPassed,
          checks_failed: result.checksFailed,
          error_details: result.errors,
          verification_details: result.details
        });
      
      // Send Slack notification
      if (result.status !== 'success') {
        await sendSlackAlert(
          '⚠️ BACKUP VERIFICATION WARNING',
          result,
          '#production-alerts'
        );
      }
    } catch (error) {
      await sendSlackAlert(
        '🚨 BACKUP VERIFICATION FAILED',
        error,
        '#production-alerts'
      );
    }
  }
);

backupVerificationJob.start();
```

2. Verification checks:
   - ✅ Backup exists and is recent (<24 hours)
   - ✅ Backup size is reasonable (>100MB)
   - ✅ All critical tables present
   - ✅ Row counts match expectations
   - ✅ Indexes are healthy

**Monitoring:**
- ✅ Daily backup verification
- ✅ Backup age tracking
- ✅ Backup size monitoring
- ✅ Table integrity checks
- ✅ Automatic alerting

---

### 4. Uptime Monitoring

**Purpose:** Monitor service availability

**Recommended Services:**

1. **Pingdom** (https://www.pingdom.com/)
   - Monitor: https://sobriquetical-zofia-abysmally.ngrok-free.dev/health
   - Interval: 5 minutes
   - Alert on: Down, Slow response

2. **UptimeRobot** (https://uptimerobot.com/)
   - Monitor: https://sobriquetical-zofia-abysmally.ngrok-free.dev/health
   - Interval: 5 minutes
   - Alert on: Down

3. **Datadog** (https://www.datadoghq.com/)
   - Monitor: Backend health, database, cache
   - Interval: 1 minute
   - Alert on: Errors, performance degradation

**Setup:**

```bash
# Add health check endpoint
GET /health
Response: {
  "status": "ok",
  "services": {
    "database": true,
    "supabase": true,
    "backgroundJobs": true,
    "webhookQueue": true
  },
  "timestamp": "2026-01-27T20:16:00Z",
  "uptime": 3600
}
```

---

## 🔧 Implementation Checklist

### Sentry Setup
- [ ] Create Sentry project
- [ ] Copy DSN to `.env`
- [ ] Initialize Sentry in backend
- [ ] Add error handler middleware
- [ ] Test error tracking
- [ ] Configure alert rules

### Slack Setup
- [ ] Create Slack app
- [ ] Enable Incoming Webhooks
- [ ] Create webhook for alerts
- [ ] Copy webhook URL to `.env`
- [ ] Enable Bot Token Scopes
- [ ] Install app to workspace
- [ ] Test webhook notifications

### Backup Verification
- [ ] Create backup verification job
- [ ] Implement verification checks
- [ ] Add database logging
- [ ] Configure Slack alerts
- [ ] Test backup verification
- [ ] Schedule daily job

### Uptime Monitoring
- [ ] Choose monitoring service
- [ ] Configure health check endpoint
- [ ] Set up monitoring alerts
- [ ] Configure Slack notifications
- [ ] Test uptime monitoring

---

## 📊 Alert Rules

### Critical Alerts (Immediate)
- Backend down
- Database connection lost
- Backup verification failed
- Authentication system down

### Warning Alerts (Within 1 hour)
- High error rate (>1% of requests)
- Slow response times (>5 seconds)
- Backup older than 24 hours
- Cache hit rate <50%

### Info Alerts (Daily summary)
- Daily backup verification status
- Feature flag changes
- Authentication metrics
- Performance statistics

---

## 🚀 Deployment

### Step 1: Configure Environment Variables

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Add to .env
echo "SENTRY_DSN=https://[key]@[project].ingest.sentry.io/[id]" >> .env
echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/[workspace]/[channel]/[token]" >> .env
echo "BACKUP_VERIFICATION_ENABLED=true" >> .env
```

### Step 2: Restart Backend

```bash
npm run startup
```

### Step 3: Verify Monitoring

```bash
# Check Sentry
curl https://sentry.io/api/0/organizations/voxanne-ai/projects/

# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"🚀 Monitoring system online"}'

# Check backup verification job
curl https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/monitoring/backup-status
```

---

## 📈 Monitoring Dashboard

**Recommended Metrics:**

1. **Backend Health**
   - Uptime percentage
   - Error rate
   - Response time
   - Request volume

2. **Database**
   - Query performance
   - Connection pool
   - Backup status
   - Table sizes

3. **Authentication**
   - Login success rate
   - MFA enrollment rate
   - Session count
   - Audit log entries

4. **Feature Flags**
   - Enabled flags
   - Rollout percentage
   - Flag changes
   - Performance impact

---

## 🔍 Troubleshooting

### Sentry Not Capturing Errors
1. Verify DSN is correct
2. Check Sentry initialization
3. Verify error handler middleware
4. Test with manual error

### Slack Webhooks Not Working
1. Verify webhook URL is correct
2. Check Slack app permissions
3. Verify channel exists
4. Test with curl command

### Backup Verification Not Running
1. Check cron job is scheduled
2. Verify database connection
3. Check Slack webhook
4. Review backend logs

---

## ✨ Summary

Monitoring is critical for production reliability. Implement all 4 components:

1. **Sentry** - Error tracking and alerting
2. **Slack** - Team notifications
3. **Backup Verification** - Disaster recovery assurance
4. **Uptime Monitoring** - Service availability

This ensures the platform is always monitored and the team is immediately notified of any issues.

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-27T20:16:00Z  
**Status:** Ready for Implementation
