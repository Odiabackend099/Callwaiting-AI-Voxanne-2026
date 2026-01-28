# Local Testing Guide - Production Priorities

**Purpose:** Test all production priorities locally before deploying

---

## Quick Start - Local Testing

### 1. Apply Migration Locally

**Option A: Direct SQL (Recommended)**
```bash
# Open Supabase Dashboard → SQL Editor
# Copy and run: backend/migrations/20260127_webhook_delivery_tracking.sql
```

**Option B: Using Script**
```bash
cd backend
# Ensure .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npx tsx src/scripts/apply-webhook-delivery-log-migration.ts
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

---

### 2. Configure Environment (Optional)

Edit `backend/.env`:

```bash
# Required (should already be set)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
VAPI_PRIVATE_KEY=...

# Optional - for full monitoring features
SENTRY_DSN=https://...@sentry.io/...
SLACK_BOT_TOKEN=xoxb-...
SLACK_ALERTS_CHANNEL=#voxanne-alerts
REDIS_URL=redis://localhost:6379

# Local development
NODE_ENV=development
PORT=8080
```

---

### 3. Start Local Server

```bash
cd backend

# Install dependencies if needed
npm install

# Start development server
npm run dev

# Server should start on http://localhost:8080
```

**Expected output:**
```
{"timestamp":"...","level":"INFO","module":"Server","message":"Initializing Sentry..."}
{"timestamp":"...","level":"INFO","module":"Server","message":"Initializing Redis..."}
{"timestamp":"...","level":"INFO","module":"Server","message":"Scheduling webhook events cleanup..."}
{"timestamp":"...","level":"INFO","module":"Server","message":"Server listening on port 8080"}
```

---

### 4. Run Production Readiness Tests

**In a new terminal:**

```bash
cd backend

# Run full production readiness test suite
npm run test:production

# Or manually:
npx tsx src/scripts/production-readiness-test.ts
```

**Expected Results:**
```
================================================================================
PRODUCTION READINESS TEST RESULTS
================================================================================
Total Tests: 14
✅ Passed: 10+ (should increase after migration)
⚠️ Warnings: 0-3 (depending on monitoring config)
================================================================================
```

---

### 5. Verify Server Health

```bash
# Health check
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","timestamp":"2026-01-27T..."}

# Database health
curl http://localhost:8080/health/database

# VAPI health (if VAPI_PRIVATE_KEY configured)
curl http://localhost:8080/health/vapi
```

---

### 6. Test Monitoring (If Configured)

```bash
# Run monitoring verification script
cd backend
npx tsx src/scripts/verify-monitoring.ts
```

**This tests:**
- ✅ Slack alerts (if SLACK_BOT_TOKEN set)
- ✅ Sentry error capture (if SENTRY_DSN set)
- ✅ Circuit breaker functionality
- ✅ Error count tracking
- ✅ Webhook queue metrics (if REDIS_URL set)

---

### 7. Test Circuit Breakers

**Test Twilio Circuit Breaker:**
```bash
# In backend/.env, temporarily set invalid Twilio credentials
# Then make API call that sends SMS
curl -X POST http://localhost:8080/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Test message"
  }'

# Should see circuit breaker open after 3 failures
# Check logs for: "Circuit breaker opened for twilio_sms"
```

**Test Calendar Circuit Breaker:**
```bash
# Similar test for calendar availability check
curl -X GET "http://localhost:8080/api/calendar/availability?date=2026-01-28"

# Monitor logs for circuit breaker behavior
```

---

### 8. Test Webhook Processing

```bash
# Send test webhook (simulating VAPI)
curl -X POST http://localhost:8080/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.ended",
    "call": {
      "id": "test-call-123",
      "status": "completed"
    }
  }'

# Check webhook was processed
# Should see in logs: "Webhook processing queued"
```

---

### 9. Test Cleanup Job

```bash
# Manually trigger cleanup job
cd backend
npx tsx -e "
  import { runWebhookEventsCleanup } from './src/jobs/webhook-events-cleanup';
  runWebhookEventsCleanup().then(() => process.exit(0));
"

# Expected output:
# Starting webhook events cleanup job
# Cleaning processed_webhook_events...
# Cleaning webhook_delivery_log...
# Webhook events cleanup completed
```

---

## Troubleshooting

### Server Won't Start

**Error: "Missing environment variables"**
```bash
# Check .env file exists
ls -la backend/.env

# Verify required variables
cat backend/.env | grep -E "SUPABASE_URL|DATABASE_URL|VAPI_PRIVATE_KEY"
```

**Error: "Port 8080 already in use"**
```bash
# Kill existing process
lsof -ti:8080 | xargs kill -9

# Or change port in .env
echo "PORT=8081" >> backend/.env
```

### Tests Failing

**"Database connection failed"**
```bash
# Verify Supabase credentials
curl -I $SUPABASE_URL/rest/v1/

# Check if migration was applied
# Go to Supabase Dashboard → Table Editor
# Look for webhook_delivery_log table
```

**"Circuit breaker tests failing"**
```bash
# This is expected if external APIs (Twilio, Google) aren't configured
# Circuit breaker should still show as "functional"
# Check test output for specific error
```

**"Webhook queue metrics failed"**
```bash
# Expected if Redis not running
# Start Redis locally:
redis-server

# Or install via Homebrew:
brew install redis
brew services start redis
```

### Monitoring Not Working

**Sentry not capturing errors:**
```bash
# Verify SENTRY_DSN format
echo $SENTRY_DSN
# Should be: https://[key]@sentry.io/[project-id]

# Test manually
npx tsx -e "
  import { reportError } from './src/config/sentry';
  reportError(new Error('Test error'), { test: true });
  setTimeout(() => process.exit(0), 2000);
"
```

**Slack alerts not sending:**
```bash
# Check token has correct permissions
# Required scopes: chat:write, chat:write.public

# Test manually
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$SLACK_ALERTS_CHANNEL\",
    \"text\": \"Test alert from local development\"
  }"
```

---

## What to Check Before Deploying

### ✅ Pre-Deployment Checklist

- [ ] Migration applied successfully
- [ ] Server starts without errors
- [ ] Health check returns 200 OK
- [ ] Production readiness tests mostly passing
- [ ] Circuit breakers functional
- [ ] Webhook processing working
- [ ] No critical errors in console

### ⚠️ Acceptable Warnings

- "SENTRY_DSN not configured" - OK if you haven't set up Sentry
- "SLACK_BOT_TOKEN not configured" - OK if you haven't set up Slack
- "REDIS_URL not configured" - OK, webhooks work synchronously
- "Webhook queue metrics failed" - OK without Redis

### 🚨 Critical Issues (Must Fix)

- Server won't start
- Database connection failing
- Missing environment variables (DATABASE_URL, SUPABASE_URL)
- TypeScript compilation errors
- Health check returning 500

---

## Local Testing Commands - Quick Reference

```bash
# Start server
cd backend && npm run dev

# Run production tests
cd backend && npm run test:production

# Health checks
curl http://localhost:8080/health
curl http://localhost:8080/health/database

# Test monitoring
cd backend && npx tsx src/scripts/verify-monitoring.ts

# Trigger cleanup job
cd backend && npx tsx -e "
  import { runWebhookEventsCleanup } from './src/jobs/webhook-events-cleanup';
  runWebhookEventsCleanup();
"

# Check server logs
# (automatically displayed in terminal where server is running)

# Stop server
# Press Ctrl+C in server terminal
```

---

## Next Steps After Local Testing

Once all local tests pass:

1. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: implement five production priorities - monitoring, security, circuit breakers"
   git push origin main
   ```

2. **Deploy to staging/production**
   ```bash
   # Using Vercel
   vercel --prod

   # Or your preferred deployment method
   ```

3. **Verify production deployment**
   ```bash
   # Replace with your actual domain
   curl https://your-domain.com/health
   ```

4. **Monitor for 24 hours**
   - Check error rates in Sentry
   - Monitor Slack alerts
   - Review circuit breaker status
   - Verify webhook processing

---

**✅ Local testing complete when:**
- Server starts successfully
- Health checks return 200
- Production tests show "READY" status
- No critical errors in logs

**🚀 Ready to deploy!**

---

*For production deployment, see: [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)*
