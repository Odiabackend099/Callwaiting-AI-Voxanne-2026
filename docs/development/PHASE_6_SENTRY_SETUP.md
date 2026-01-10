# PHASE 6: Sentry Alerts Configuration

**Status:** Ready for manual setup  
**Time:** 5 minutes  
**Owner:** DevOps/Tech Lead

---

## What Sentry Does

Sentry captures all errors in production in real-time. It:
- ✅ Logs every error with full stack trace
- ✅ Groups similar errors together
- ✅ Sends alerts when thresholds exceeded
- ✅ Tracks error trends over time

---

## Step 1: Verify Sentry Project Exists

1. Go to: https://sentry.io
2. Sign in with your account
3. Look for project: **Voxanne** or **CallWaiting AI**
4. If it doesn't exist, create new project:
   - Platform: Node.js
   - Name: Voxanne
   - Team: Your team

---

## Step 2: Get Your DSN

1. In Sentry project, go to **Settings** → **Client Keys (DSN)**
2. Copy the DSN (looks like: `https://xxxxx@sentry.io/123456`)
3. Verify it's already set in Render:
   - Go to: https://dashboard.render.com
   - Select: voxanne-backend service
   - Check Environment: `SENTRY_DSN` should be set
   - If not set, paste the DSN there

---

## Step 3: Create Alert Rules

### Alert 1: High Error Rate

1. Go to Sentry → **Alerts**
2. Click **Create Alert Rule**
3. Configure:
   - **Condition:** Error rate > 5%
   - **Time Window:** Last 5 minutes
   - **Notification:** Email or Slack
   - **Name:** "High Error Rate Alert"
4. Click **Save**

### Alert 2: New Issue

1. Click **Create Alert Rule** again
2. Configure:
   - **Condition:** A new issue is created
   - **Notification:** Email or Slack
   - **Name:** "New Production Issue"
3. Click **Save**

### Alert 3: Spike in Error Rate

1. Click **Create Alert Rule** again
2. Configure:
   - **Condition:** Error rate increases by 50% in 10 minutes
   - **Notification:** Email or Slack
   - **Name:** "Error Rate Spike"
3. Click **Save**

---

## Step 4: Verify Events Are Coming In

1. Go to Sentry → **Issues**
2. Wait 1-2 minutes
3. You should see events appearing
4. If no events after 5 minutes:
   - Check Render logs for errors
   - Verify SENTRY_DSN is set correctly
   - Check that NODE_ENV=production

---

## Step 5: Set Up Slack Integration (Optional)

1. Go to Sentry → **Integrations**
2. Search for "Slack"
3. Click **Install**
4. Authorize Sentry to post to your Slack workspace
5. Select channel for alerts (e.g., #alerts or #engineering)

---

## Monitoring Checklist

After setup, verify:

- [ ] Sentry project exists
- [ ] DSN is set in Render environment
- [ ] Alert rules created (3 total)
- [ ] Events appearing in Sentry dashboard
- [ ] Slack integration working (if using)
- [ ] Test alert received (optional: trigger test error)

---

## What to Monitor During 24 Hours

**Every 4 hours, check:**

1. **Sentry Dashboard**
   - Error count (should be <5 per hour)
   - Error rate (should be <1%)
   - New issues (should be 0)

2. **Error Types**
   - Database errors
   - API errors
   - Timeout errors
   - Authentication errors

3. **Affected Services**
   - Health endpoint
   - Calls endpoint
   - Webhooks endpoint
   - Assistants endpoint

---

## Expected Errors (Normal)

These errors are OK and don't indicate problems:

- ✅ 404 errors on unknown routes (expected)
- ✅ 429 rate limit errors (expected under load)
- ✅ Vapi API timeouts (external service, not our fault)
- ✅ Occasional database connection resets (normal)

---

## Critical Errors (Must Fix)

These errors indicate problems:

- ❌ Database connection failures (persistent)
- ❌ Authentication bypass attempts
- ❌ Memory leaks (increasing memory usage)
- ❌ Unhandled promise rejections
- ❌ WebSocket disconnections (>10% of connections)

---

## Timeline

```
NOW:        Configure Sentry alerts
Hour 0-1:   Verify events coming in
Hour 1-24:  Monitor dashboard every 4 hours
Hour 24:    Review metrics and sign off
```

---

## Next Steps

1. Complete Sentry setup above
2. Proceed to PHASE 7: 24-hour monitoring
3. Check back every 4 hours
4. After 24 hours stable → Ready for customer launch

---

**Status:** Ready for execution  
**Estimated Time:** 5 minutes setup + 24 hours monitoring
