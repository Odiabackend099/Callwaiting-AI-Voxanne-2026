# Backend Monitoring & Operations Runbook

**Last Updated**: December 21, 2025
**Environment**: Render Free Tier + Supabase Free
**Status**: MVP Launch (Pre-Revenue)

---

## Quick Reference

### Health Endpoint
- **URL**: `https://your-render-app.onrender.com/health`
- **Expected Response**: HTTP 200 + JSON with `database_size_mb` field
- **Response Time Target**: <100ms
- **Frequency**: Every 10 minutes via UptimeRobot

### Critical Thresholds
| Metric | Threshold | Action |
|---|---|---|
| Database size | >400 MB | Plan upgrade; monitor daily |
| Database size | >480 MB | IMMEDIATE upgrade required |
| Webhook latency p99 | >200 ms | Monitor; upgrade if sustained |
| Cold-start delay | >5 sec | Verify UptimeRobot pinging; restart if needed |

---

## Part 1: Keep-Alive Pinging Strategy

### Why This Matters
Render free tier spins down after 15 minutes of inactivity. Without mitigation:
- 15+ min no requests → Service enters sleep state
- Next webhook arrives → 30-60 second spin-up delay
- Cold-start response time → 500-600 ms
- Twilio timeout → 15 seconds (fails webhook delivery)
- **Result**: Dropped inbound calls, lost leads

**Solution**: External HTTP ping every 10 minutes keeps service warm 24/7.

### UptimeRobot Configuration (Recommended)

**1. Create Free UptimeRobot Account**
- Go to [https://uptimerobot.com](https://uptimerobot.com)
- Sign up with your email
- Create new account (free tier allows 50 monitors)

**2. Add HTTP Monitor**
- Login to UptimeRobot dashboard
- Click "Add New Monitor"
- Select "HTTP(s)" monitor type
- Configure:
  ```
  Monitor Name:     Voxanne Backend Health Check
  Monitor Type:     HTTP(s)
  URL:              https://your-render-app.onrender.com/health
  Monitoring Interval:  10 minutes
  Timeout:          30 seconds
  Keyword Monitoring: "status":"ok"  (optional, validates response)
  ```
- Click "Create Monitor"

**3. Enable Alerts**
- Click monitor name → "Settings"
- Notification Contacts: Add your email
- Alert Threshold: "If down for 15+ minutes, send alert"
- Save

**4. Verify Pinging**
- Wait 10-15 minutes after setup
- Check UptimeRobot dashboard → Your monitor should show uptime %
- Check Render app logs: Search for "Health" to see ping requests
  ```
  Log pattern: GET /health 200 <100ms
  ```

### Alternative: GitHub Actions

If you prefer avoiding external services:

**1. Create `.github/workflows/keep-alive.yml`**
```yaml
name: Keep Render App Alive

on:
  schedule:
    # Run every 10 minutes
    - cron: '*/10 * * * *'

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping health endpoint
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" \
            "https://your-render-app.onrender.com/health")
          if [ "$response" != "200" ]; then
            echo "Health check failed: $response"
            exit 1
          fi
          echo "Health check passed: $response"
```

**2. Deploy**
- Commit and push to main branch
- GitHub Actions automatically runs every 10 minutes
- No setup required; integrated with repo

**Pros**: Free, integrated, no external service
**Cons**: Depends on GitHub availability, less visible monitoring

---

## Part 2: Database Size Monitoring

### Why This Matters
Supabase free tier has **500 MB limit**. Once exceeded:
- No new records can be inserted
- Inbound calls cannot be logged
- System stops working

### Daily Manual Check

**Check Database Size**:
```bash
# Option 1: Via health endpoint
curl https://your-render-app.onrender.com/health | jq .database_size_mb

# Option 2: In Supabase dashboard
# Login → Select project → Settings → Database → View database size
```

**What You'll See**:
```json
{
  "status": "ok",
  "database_size_mb": 125.4,
  "services": {...}
}
```

**Interpretation**:
- **<200 MB**: Comfortable; no action needed
- **200-300 MB**: Monitor weekly; no action needed
- **300-400 MB**: Monitor 2x per week; plan upgrade
- **400+ MB**: ALERT; upgrade to Supabase Pro within 48 hours
- **>480 MB**: CRITICAL; system may become unstable

### Automated Alerts (Supabase)

**Setup Supabase Alert**:
1. Log in to Supabase dashboard
2. Select your project
3. Go to "Settings" → "Alerts" (or "Integrations")
4. Create alert:
   - **Metric**: Database size
   - **Threshold**: 400 MB (warning), 480 MB (critical)
   - **Notification**: Email + Slack (if available)
   - **Frequency**: Daily check at 9 AM
5. Test alert manually by clicking "Send test"

**Alert Response**:
- If alert fires: Check current database size immediately
- If >400 MB: Plan Supabase upgrade to Pro ($25/mo) within 48 hours
- If >480 MB: Initiate upgrade immediately (may impact performance)

### Growth Tracking

**Calculate Monthly Growth Rate**:
```
Date 1: database_size_mb = 100 MB
Date 2 (30 days later): database_size_mb = 130 MB
Monthly growth = 30 MB/month

Runway to 500 MB = (500 - 130) / 30 = ~12 months
```

**Growth Thresholds by Client Count**:
| Active Clients | Monthly Growth | Runway to 500 MB | Action |
|---|---|---|---|
| 1 | 5-7 MB | 60+ months | None; monitor |
| 2-3 | 15-20 MB | 20-30 months | Monitor quarterly |
| 5+ | 30-50 MB | 10-15 months | Plan upgrade at 300 MB |

---

## Part 3: Health Endpoint Interpretation

### Response Structure
```json
{
  "status": "ok|degraded|error",
  "services": {
    "database": true|false,
    "supabase": true|false,
    "backgroundJobs": true|false
  },
  "timestamp": "2025-12-21T12:34:56.789Z",
  "uptime": 3600,
  "database_size_mb": 125.4
}
```

### Status Meanings

**status: "ok"**
- All services healthy
- Database connectivity confirmed
- Database size <400 MB
- **Action**: None; monitor normally

**status: "degraded"**
- Non-critical service issue
- Database connection works but slow
- Database size 400-480 MB (approaching limit)
- **Action**: Investigate which service is degraded; plan fixes/upgrades

**status: "error"**
- Critical service down
- Database connection failed
- Database size >480 MB
- **Action**: Investigate immediately; consider manual intervention

### Response Time Interpretation

**Typical Response Times**:
- Cold service (just spun up): 500-600 ms
- Warm service (pinged regularly): 50-100 ms
- With database latency: 100-200 ms

**Warning Signs**:
- Consistently >500 ms: Service not being pinged; verify UptimeRobot active
- Consistently >1000 ms: High database load; may need to upgrade

---

## Part 4: Webhook Processing Monitoring

### Expected Latency
- Webhook receipt to response: **<100 ms**
- Total handler processing: **100-500 ms** (background queue for heavy work)

### Monitoring Steps

**1. Check Logs for Webhook Processing**
```bash
# In Render dashboard, view real-time logs:
# Search for: "Webhook received" or "Handler error"

Pattern (success):
[12:34:56] Webhook received
[12:34:56] Signature verified
[12:34:56] Event validated
[12:34:56] Handler successful
Webhook latency: 85ms

Pattern (failure):
[12:34:56] Webhook received
[12:34:57] Handler error: Database timeout
Webhook latency: 1200ms (TOO HIGH)
```

**2. Calculate Webhook Latency**
```
Latency = Response time - Request timestamp
Target: <100 ms
Warning: >200 ms
Critical: >1000 ms (likely exceeds Twilio 15s timeout if in cold state)
```

**3. Check for Dropped Webhooks**
```
Signs of dropped webhooks:
- Inbound calls not being logged
- Call logs show gaps in activity
- Missed call_logs records for known incoming calls
- Webhook handler returning 500 error

Debug:
1. Check Render logs for 500 errors
2. Verify database connectivity (via /health endpoint)
3. Check Sentry for error reports
4. Verify UptimeRobot pinging is active (Render logs should show GET /health)
```

---

## Part 5: Daily & Weekly Monitoring Checklist

### Daily (5 minutes)
- [ ] **Verify health endpoint**: `curl https://your-app.onrender.com/health`
- [ ] **Check status**: Should be "ok" and response <100ms
- [ ] **Verify database_size_mb**: Should be <300 MB

### Daily (Detailed, if alerted)
- [ ] **Check Render logs** for 500 errors or handler exceptions
- [ ] **Verify UptimeRobot pings** in logs (should see GET /health every 10 min)
- [ ] **Check Sentry** for new errors in production
- [ ] **Manual test**: Make a test inbound call; verify call_logs entry created

### Weekly (15 minutes)
- [ ] **Review database growth**: Compare size to previous week
- [ ] **Calculate growth rate**: (Size now - Size last week) * 4.3 = monthly growth
- [ ] **Check webhook processing latency**: p50 and p99 in logs
- [ ] **Verify all background jobs running**: Orphan cleanup, recording upload, metrics monitor
- [ ] **Test manual health check**: `curl https://your-app.onrender.com/health | jq`

### Monthly (30 minutes)
- [ ] **Database capacity planning**: If >300 MB, schedule Supabase Pro upgrade
- [ ] **Review cost**: Render free tier ($0) + Supabase free ($0) = $0/mo baseline
- [ ] **Check revenue status**: If first client closed, upgrade Render to Starter ($7/mo)
- [ ] **Review backup status**: Verify Supabase automated backups are active
- [ ] **Performance review**: Any sustained latency increases? Database bloat?

---

## Part 6: Troubleshooting Guide

### Issue: Health endpoint returns "degraded" status

**Symptoms**:
- Health check shows status: "degraded"
- database_size_mb: >400 MB

**Solution**:
1. Check current database size in Supabase dashboard
2. If >400 MB: Plan upgrade to Supabase Pro
   - Upgrade is seamless; no downtime
   - Current data migrates automatically
   - Cost: $25/mo (includes 8 GB storage, 100x larger)
3. If <400 MB: Check database latency
   - May be temporary slowness from high concurrent calls
   - Monitor for 1 hour; should normalize

### Issue: Health endpoint returns "error" status

**Symptoms**:
- status: "error"
- services.database: false
- Unable to make inbound calls

**Solution**:
1. **Immediate**: Restart Render service
   - Go to Render dashboard → Select your service
   - Click "Manual Deploy" → Deploy main branch
   - Service restarts in ~2 minutes

2. **Verify**: Check health endpoint again after restart
   - Should return status: "ok"
   - Retry failed inbound calls

3. **Investigate**: If error persists after restart
   - Check Supabase dashboard → Confirm database is online
   - Check Supabase logs for connection issues
   - Contact Supabase support if down >30 minutes

### Issue: Cold-start delays (health endpoint takes >500ms)

**Symptoms**:
- Health endpoint response time: 500-1000 ms
- Inbound calls arriving but delayed response
- Some webhooks failing (Twilio timeout)

**Cause**:
- Service not being pinged regularly
- UptimeRobot not active or misconfigured
- Service spinning down every 15 minutes

**Solution**:
1. **Verify UptimeRobot active**:
   - Log in to UptimeRobot dashboard
   - Check monitor status: Should show uptime % >99%
   - Check monitor URL: Should match your app URL
   - Check last check time: Should be <10 minutes ago

2. **If UptimeRobot down**:
   - Recreate monitor (see Part 1)
   - Test by waiting 10 minutes; check logs for GET /health
   - Verify response time drops to <100ms after first ping

3. **If UptimeRobot active but latency still high**:
   - May be temporary database load
   - Monitor latency for 1 hour
   - If sustained: Upgrade Render to Starter ($7/mo) or optimize database queries

### Issue: Webhooks returning 401 "Invalid signature"

**Symptoms**:
- Webhook logs show: "Invalid webhook signature"
- Inbound calls not being processed
- status: 401 response

**Cause**:
- VAPI_WEBHOOK_SECRET not set in environment
- Webhook secret changed in Vapi dashboard
- Secret not synchronized between services

**Solution**:
1. **Verify environment variable**:
   - Go to Render dashboard → Environment → Check VAPI_WEBHOOK_SECRET
   - Value should match Vapi dashboard → Webhooks → Signing secret

2. **Regenerate if mismatch**:
   - Go to Vapi → Webhooks settings
   - Copy "Signing Secret"
   - Update VAPI_WEBHOOK_SECRET in Render environment
   - Redeploy application

3. **Verify webhook URL**:
   - Vapi Webhook URL should be: `https://your-render-app.onrender.com/api/webhooks/vapi`
   - Confirm in Vapi dashboard → Webhooks

---

## Part 7: Upgrade Triggers & Actions

### When to Upgrade Render (Starter - $7/mo)

**Trigger Metrics**:
- Database size: No impact (Supabase limit, not Render)
- API latency: p99 consistently >200 ms
- CPU bottleneck: Sustained high latency under 3+ concurrent calls
- **Revenue trigger**: First client closes (recommended minimum)

**What Changes**:
- CPU: 0.1 → 0.5 (5x more powerful)
- RAM: 512 MB → 512 MB (same, but less resource contention)
- **Spin-down**: Eliminated (no more cold-starts!)
- **Cost**: $0 → $7/mo

**Implementation**:
1. Go to Render dashboard → Service settings
2. Select plan: "Starter"
3. Confirm billing
4. Service restarts automatically (2-3 min downtime)
5. Verify health endpoint <100 ms response

### When to Upgrade Supabase (Pro - $25/mo)

**Trigger Metrics**:
- Database size: >300 MB (plan), >400 MB (do it now)
- Growth rate: >20 MB/month + more clients expected
- Active clients: 3+ clinics simultaneously
- Query latency: Dashboard slow to load

**What Changes**:
- Storage: 500 MB → 8 GB (16x larger)
- Connections: 10 → 60 (more concurrent operations)
- Read replicas: Available (optional, for scaling)
- **Cost**: $0 → $25/mo

**Implementation**:
1. Go to Supabase dashboard → Billing
2. Select plan: "Pro"
3. Confirm payment method
4. Upgrade is instant; no downtime or data migration needed
5. Verify health endpoint still returns "ok"

### When to Upgrade Render Standard ($25/mo)

**Trigger Metrics**:
- Concurrent calls: 50+ per minute
- Active clinics: 5+ simultaneously
- API latency: p99 >300 ms even with Starter
- **Recommendation**: If first month revenue >$50

**What Changes**:
- CPU: 0.5 → 1.0 (2x more)
- RAM: 512 MB → 2 GB (4x more)
- Availability: Better resource allocation
- **Cost**: $7 → $25/mo

---

## Part 8: Emergency Procedures

### Manual Health Check (If Dashboard Down)

```bash
# From your laptop
curl -s https://your-render-app.onrender.com/health | jq

# Expected output:
{
  "status": "ok",
  "database_size_mb": 125.4,
  "services": {
    "database": true,
    "supabase": true,
    "backgroundJobs": true
  },
  "timestamp": "2025-12-21T12:34:56.789Z",
  "uptime": 3600
}
```

### Manual Database Size Check (If /health fails)

```bash
# Log in to Supabase dashboard directly
# Select project → Settings → Database → View database size

# Or via Supabase CLI:
supabase db stats --project-ref your-project-id
```

### Force Service Restart

```bash
# Via Render dashboard:
1. Go to Service → Settings
2. Click "Manual Deploy"
3. Select main branch
4. Click "Deploy"
5. Wait 2-3 minutes for restart

# Service should come back online and pass health check
```

### Bypass UptimeRobot (Temporary)

If UptimeRobot is down temporarily but you need to keep service alive:

```bash
# Set up manual ping loop (Linux/Mac)
while true; do
  curl -s https://your-app.onrender.com/health > /dev/null
  echo "$(date): Pinged health endpoint"
  sleep 600  # 10 minutes
done

# Or as a cron job (Linux):
# Add to crontab:
# */10 * * * * curl -s https://your-app.onrender.com/health > /dev/null
```

---

## Part 9: Contact & Escalation

### Support Channels

| Issue | Contact | Response Time |
|---|---|---|
| Render service down | Render status page | Check real-time |
| Supabase database down | Supabase status page | Check real-time |
| Twilio webhooks failing | Twilio dashboard → Logs | View webhook history |
| Vapi API issues | Vapi support | 24 hours |

### Critical Escalation Path

1. **Service down (any)**: Check status page immediately
2. **Persistent issue (>15 min)**: Restart service via Render dashboard
3. **Still down (>30 min)**: Check Sentry for errors; post in dev channels
4. **Requires immediate attention**: Consider temporary fallback (manual answering, call forwarding)

---

## Quick Links

- **Render Dashboard**: https://dashboard.render.com
- **Supabase Dashboard**: https://supabase.com/dashboard
- **UptimeRobot**: https://uptimerobot.com
- **Sentry Monitoring**: [Your Sentry Project URL]
- **Vapi Dashboard**: https://dashboard.vapi.ai
- **Twilio Console**: https://console.twilio.com

---

## Version History

| Date | Changes | Author |
|---|---|---|
| 2025-12-21 | Initial runbook; Tier 1 launch docs | Claude Code |

---

**Last Review**: December 21, 2025
**Next Review**: After first live inbound calls (monitor for 48 hours)
