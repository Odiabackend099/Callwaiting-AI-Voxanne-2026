# Load Testing Guide

This document explains how to run the load test for Voxanne Backend to verify system stability under concurrent user load.

## Overview

The load test (`load-test.js`) simulates 10 concurrent users making requests to key API endpoints over 7 minutes:
- Ramp up: 5 users over 1 minute
- Ramp up: 10 users over 2 minutes (total: 3 minutes)
- Hold: 10 users for 3 minutes
- Ramp down: 0 users over 1 minute

## Prerequisites

Install k6 (load testing framework):

```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-get install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

Verify installation:
```bash
k6 version
```

## Running Load Tests

### Local Development (Against localhost:3001)

```bash
k6 run load-test.js
```

### Against Production (Render Deployment)

```bash
BASE_URL=https://voxanne-backend.onrender.com k6 run load-test.js
```

### Custom Configuration

```bash
# Test with custom API token for authenticated endpoints
BASE_URL=https://your-backend.com API_TOKEN=your-jwt-token k6 run load-test.js

# Run with higher load (modify stages in load-test.js)
BASE_URL=http://localhost:3001 k6 run load-test.js
```

## Understanding Load Test Results

The test measures:

**Metrics:**
- `http_req_duration`: Response time for each request
- `http_req_failed`: Percentage of failed requests
- `http_reqs`: Total requests per second
- `vus_max`: Peak concurrent users

**Thresholds (Pass/Fail Criteria):**
- ✅ 99th percentile response time < 1 second
- ✅ Error rate < 5%
- ✅ At least 1 request per second

**Sample Output:**
```
http_req_duration..........: avg=245ms   min=45ms    med=180ms   max=1250ms  p(99)=850ms
http_req_failed............: 2.5%
http_reqs..................: 234/s
vus_max....................: 10
```

### Success Criteria

Load test **PASSES** when:
1. ✅ 99th percentile response time < 1000ms
2. ✅ Error rate < 5%
3. ✅ No crashes or timeouts
4. ✅ Health check passes at start and end

### Common Issues

**Issue: "Connection refused"**
- Verify backend is running on localhost:3001
- Check firewall settings
- Verify URL: `curl http://localhost:3001/health`

**Issue: "High error rate (>5%)"**
- Check backend logs for exceptions
- Verify database connectivity
- Check if server is memory/CPU constrained

**Issue: "High response times (>1s p99)"**
- Check database query performance
- Review Sentry for slow endpoints
- Consider adding database indexes

## Deployment Verification

After deploying to production, always run the load test to verify:

```bash
# 1. Verify health check
curl https://voxanne-backend.onrender.com/health

# 2. Run load test
BASE_URL=https://voxanne-backend.onrender.com k6 run load-test.js

# 3. Check Sentry for errors during load test
# (Should see minimal errors during load test)

# 4. Monitor Render dashboard for resource usage
# (CPU, memory, logs)
```

## Load Test Endpoints

The test covers these critical endpoints:

1. **GET /health** (most critical)
   - Tests database connectivity
   - Returns 200 if system is healthy
   - Expected response time: < 100ms

2. **GET /** (root endpoint)
   - Basic connectivity test
   - Expected response time: < 100ms

3. **GET /api/calls-dashboard** (authenticated)
   - Tests dashboard data retrieval
   - Requires valid JWT (test uses dummy token)
   - Expected response time: < 500ms

4. **GET /api/vapi/webhook/health** (webhook health)
   - Tests Vapi integration health
   - Expected response time: < 200ms

5. **GET /api/assistants** (authenticated)
   - Tests data retrieval for authenticated users
   - Expected response time: < 500ms

## Advanced: Custom Load Profiles

To test different load scenarios, edit `load-test.js`:

```javascript
// Conservative: 5 concurrent users
stages: [
  { duration: '1m', target: 5 },
  { duration: '5m', target: 5 },
  { duration: '1m', target: 0 }
]

// Aggressive: 20 concurrent users
stages: [
  { duration: '2m', target: 10 },
  { duration: '2m', target: 20 },
  { duration: '5m', target: 20 },
  { duration: '2m', target: 0 }
]

// Spike test: Sudden traffic spike
stages: [
  { duration: '1m', target: 5 },
  { duration: '30s', target: 20 },  // Spike to 20
  { duration: '30s', target: 5 },   // Drop to 5
  { duration: '1m', target: 0 }
]
```

## Performance Baseline

Expected baseline performance (local development):

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| /health | 5ms | 15ms | 30ms |
| / | 3ms | 10ms | 20ms |
| /api/calls-dashboard | 150ms | 300ms | 500ms |
| /api/vapi/webhook/health | 50ms | 100ms | 150ms |
| /api/assistants | 200ms | 400ms | 600ms |

## Scheduled Load Testing

For continuous monitoring, consider scheduling load tests:

```bash
# Run load test every hour (via cron)
0 * * * * cd /path/to/Callwaiting-AI-Voxanne-2026 && BASE_URL=https://voxanne-backend.onrender.com k6 run load-test.js >> load-test-results.log 2>&1
```

## Next Steps

After load test passes:
1. ✅ Deploy to production
2. ✅ Monitor Sentry for first 24 hours
3. ✅ Check health endpoint from external service
4. ✅ Run periodic load tests (weekly/monthly)
5. ✅ Ready for customer launch

## References

- k6 Documentation: https://k6.io/docs/
- k6 Best Practices: https://k6.io/docs/best-practices/
- k6 Thresholds: https://k6.io/docs/results-output/end-of-test-summary/#thresholds
