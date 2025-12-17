# FEATURE 10: PRODUCTION DEPLOYMENT - END-TO-END TEST

## DEPLOYMENT STATUS

✅ **Backend:** Deployed to Render (voxanne-backend.onrender.com)
✅ **Frontend:** Deployed to Vercel (callwaitingai.dev)
✅ **Database:** Supabase (cloud-hosted)
✅ **Environment Variables:** Set in Render dashboard
✅ **Webhook URL:** Configured programmatically via environment

---

## END-TO-END TEST CHECKLIST

### PHASE 1: VERIFY INFRASTRUCTURE (5 minutes)

- [ ] **Health Check**
  - Test: `curl https://voxanne-backend.onrender.com/health`
  - Expected: 200 OK response
  - Command: `curl -v https://voxanne-backend.onrender.com/health`

- [ ] **Frontend Access**
  - Test: Open https://callwaitingai.dev in browser
  - Expected: Login page loads
  - Verify: No console errors

- [ ] **Database Connection**
  - Test: Login to dashboard
  - Expected: Dashboard loads, can see calls page
  - Verify: User data loads from Supabase

### PHASE 2: AUTHENTICATION TEST (5 minutes)

- [ ] **Login Flow**
  - Test: Login with valid credentials
  - Expected: Redirects to /dashboard
  - Verify: JWT token stored in localStorage

- [ ] **Protected Routes**
  - Test: Logout, then try accessing /dashboard/calls directly
  - Expected: Redirects to /login
  - Verify: No data leaked

- [ ] **API Authentication**
  - Test: Call `/api/calls` without token
  - Expected: 401 Unauthorized
  - Command: `curl https://voxanne-backend.onrender.com/api/calls`

### PHASE 3: KNOWLEDGE BASE TEST (10 minutes)

- [ ] **Upload KB Document**
  - Test: Go to /dashboard/knowledge-base
  - Upload: Sample document with pricing info
  - Expected: Document saved, chunks created
  - Verify: Check call logs show KB context

- [ ] **Auto-Chunking**
  - Test: Verify chunks created in database
  - Expected: knowledge_base_chunks table populated
  - Verify: Embeddings generated

### PHASE 4: AGENT CONFIGURATION TEST (5 minutes)

- [ ] **Configure Agent**
  - Test: Go to /dashboard/agent-config
  - Change: First message to "Hello from production"
  - Save: Click "Save Both Agents"
  - Expected: Success message
  - Verify: Changes synced to Vapi

### PHASE 5: VAPI WEBHOOK CONFIGURATION (5 minutes)

- [ ] **Configure Webhook**
  - Test: Go to /dashboard/vapi-setup
  - Click: "Configure Webhook"
  - Expected: Success message
  - Verify: Webhook URL is `https://voxanne-backend.onrender.com/api/webhooks/vapi`

- [ ] **Verify Webhook**
  - Test: Check Vapi dashboard
  - Expected: Assistant has server.url set to production webhook
  - Verify: Webhook URL is correct

### PHASE 6: INBOUND CALL TEST (15 minutes)

- [ ] **Make Test Call**
  - Test: Call the Twilio number
  - Expected: Agent answers within 3 seconds
  - Verify: Call appears in dashboard within 2 seconds

- [ ] **Live Transcript**
  - Test: Watch transcript appear in real-time
  - Expected: Words appear as customer speaks
  - Verify: WebSocket connection shows 🟢 Live

- [ ] **Recording**
  - Test: Call ends
  - Expected: Recording URL appears in call details
  - Verify: Recording is playable

- [ ] **Call Log**
  - Test: Check /dashboard/calls
  - Expected: Call appears in list
  - Verify: All details correct (duration, status, recording)

### PHASE 7: RAG INTEGRATION TEST (10 minutes)

- [ ] **KB Context Injection**
  - Test: Make call and ask question about KB content
  - Expected: Agent uses KB info in response
  - Verify: Call log shows RAG context in metadata

- [ ] **Smart Escalation**
  - Test: Ask medical question
  - Expected: Agent escalates (doesn't give medical advice)
  - Verify: Escalation logged in transcript

### PHASE 8: REAL-TIME UPDATES TEST (5 minutes)

- [ ] **WebSocket Connection**
  - Test: Open dashboard, make call from different phone
  - Expected: Call appears in list within 2 seconds
  - Verify: No page refresh needed

- [ ] **Auto-Reconnect**
  - Test: Close browser tab, reopen dashboard
  - Expected: WebSocket reconnects automatically
  - Verify: 🟢 Live indicator shows connected

### PHASE 9: ERROR HANDLING TEST (5 minutes)

- [ ] **Network Failure**
  - Test: Simulate network error (dev tools)
  - Expected: Graceful error message
  - Verify: Can retry operation

- [ ] **Invalid Token**
  - Test: Manually delete JWT from localStorage
  - Expected: Redirects to login
  - Verify: No data leaked

### PHASE 10: STABILITY TEST (24 hours)

- [ ] **Monitor Logs**
  - Test: Check Render logs for errors
  - Expected: No critical errors
  - Verify: All requests successful

- [ ] **Performance**
  - Test: Response times
  - Expected: <500ms for API calls
  - Verify: No timeouts

- [ ] **Uptime**
  - Test: Service available 24/7
  - Expected: 99.9% uptime
  - Verify: No downtime incidents

---

## TEST EXECUTION SCRIPT

```bash
#!/bin/bash

# PHASE 1: Infrastructure
echo "=== PHASE 1: Infrastructure ==="
curl -v https://voxanne-backend.onrender.com/health
echo ""

# PHASE 3: API Authentication
echo "=== PHASE 3: API Authentication ==="
curl -v https://voxanne-backend.onrender.com/api/calls
echo ""

# Success indicators
echo "✅ If all tests pass, production deployment is complete"
echo "❌ If any test fails, check Render logs and fix"
```

---

## PRODUCTION MONITORING

### Render Dashboard
- URL: https://dashboard.render.com
- Service: voxanne-backend
- Check: Logs, Metrics, Events

### Vercel Dashboard
- URL: https://vercel.com/dashboard
- Project: voxanne-frontend
- Check: Deployments, Analytics

### Supabase Dashboard
- URL: https://app.supabase.com
- Project: voxanne
- Check: Database, Logs, Realtime

---

## ROLLBACK PLAN

If production issues occur:

1. **Immediate:** Revert to previous commit on GitHub
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Render:** Auto-deploys from main (automatic rollback)

3. **Vercel:** Auto-deploys from main (automatic rollback)

4. **Verify:** Check health endpoint
   ```bash
   curl https://voxanne-backend.onrender.com/health
   ```

---

## SUCCESS CRITERIA

✅ All 10 MVP features working in production:
1. Inbound call handling
2. Call recording & storage
3. Live transcript
4. Call log dashboard
5. Knowledge Base RAG
6. Agent configuration
7. Smart Escalation
8. Real-time dashboard updates
9. Authentication & security
10. Production deployment

✅ 24-hour stability test passes
✅ No critical errors in logs
✅ All endpoints responding <500ms
✅ WebSocket connections stable
✅ Vapi webhooks receiving events

---

## NEXT STEPS

After successful production test:
1. ✅ Commit test results
2. ✅ Document production URLs
3. ✅ Set up monitoring alerts
4. ✅ Brief team on production status
5. ✅ Ready for first customer demo
