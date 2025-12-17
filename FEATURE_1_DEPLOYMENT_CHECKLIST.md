# Feature 1: Inbound Call Handling - Deployment Checklist

## Pre-Deployment Verification

### Code Changes ✅
- [x] Logger calls fixed (all console.log replaced with logger)
- [x] handleCallStarted function completed
- [x] Agent lookup throws errors (not returns)
- [x] Retry delays increased (5 retries, 3.85s total)
- [x] Call type detection explicit (inbound vs outbound)
- [x] Idempotency check strict (mark immediately)
- [x] Zod validation for Vapi events
- [x] Webhook signature verification enhanced
- [x] Phone number validation with fallback
- [x] Call tracking creation for inbound calls
- [x] Call logs creation with UPSERT
- [x] WebSocket broadcast error handling
- [x] Comprehensive error logging

### Files Modified ✅
- [x] `backend/src/routes/webhooks.ts` - Main webhook handler with all 6 critical fixes

### Build & Compilation
- [ ] Run `npm run build` in backend directory
- [ ] Verify no TypeScript errors
- [ ] Verify no linting errors

### Database
- [ ] Verify unique constraint on agents (org_id, role) exists
- [ ] Verify processed_webhook_events table exists
- [ ] Verify call_tracking table has all required columns
- [ ] Verify call_logs table has all required columns

---

## Staging Deployment Steps

### 1. Build Backend
```bash
cd backend
npm run build
```

### 2. Deploy to Staging
```bash
# Deploy to staging environment
npm run deploy:staging
```

### 3. Verify Deployment
- [ ] Check logs for any startup errors
- [ ] Verify webhook endpoint is accessible
- [ ] Verify logger is working (check logs)

---

## Testing Plan

### Unit Tests (Manual)
1. **Test Idempotency**
   - Send same webhook twice
   - Verify second call is skipped
   - Check logs for "Duplicate event detected"

2. **Test Agent Lookup**
   - Send webhook with invalid vapi_assistant_id
   - Verify error is logged
   - Verify webhook returns 500 to Vapi for retry

3. **Test Call Tracking Creation**
   - Send inbound call webhook
   - Verify call_tracking row created
   - Verify call_logs row created
   - Verify metadata is correct

4. **Test Phone Number Validation**
   - Send webhook with invalid phone number
   - Verify warning is logged
   - Verify call still proceeds with normalized number

5. **Test WebSocket Broadcast**
   - Send inbound call webhook
   - Verify WebSocket event is broadcast
   - Verify broadcast error doesn't fail webhook

### Integration Tests (with Vapi)
1. **Make 10 Inbound Test Calls**
   - Use Vapi test phone number
   - Verify all calls are tracked
   - Verify success rate >99%
   - Check logs for any errors

2. **Verify Agent Routing**
   - Verify correct agent is selected
   - Verify agent name is logged
   - Verify org_id is correct

3. **Verify Call Logs**
   - Verify all calls have call_logs entries
   - Verify metadata is correct (channel, is_test_call)
   - Verify lead_id is populated if applicable

---

## Success Criteria

### Must Pass
- [ ] All 10 inbound test calls succeed (100% success rate)
- [ ] No errors in logs
- [ ] call_tracking rows created for all calls
- [ ] call_logs rows created for all calls
- [ ] Agent lookup succeeds for all calls
- [ ] Idempotency check works (duplicate webhooks skipped)

### Should Pass
- [ ] WebSocket broadcasts received for all calls
- [ ] Phone numbers normalized correctly
- [ ] Logs are structured and searchable
- [ ] Processing time <500ms per call

### Nice to Have
- [ ] Performance metrics collected
- [ ] Alerts configured for failures
- [ ] Dashboard shows all calls

---

## Rollback Plan

If any critical issues found:

1. **Immediate Rollback**
   ```bash
   git revert <commit-hash>
   npm run deploy:staging
   ```

2. **Partial Rollback**
   - Disable webhook endpoint temporarily
   - Revert to previous version
   - Investigate issue

3. **Investigation**
   - Check logs for errors
   - Review database state
   - Identify root cause
   - Fix and redeploy

---

## Post-Deployment Monitoring

### Metrics to Track
- Inbound calls received per hour
- Success rate (%)
- Average processing time (ms)
- Error rate (%)
- Agent lookup failures
- Call tracking creation failures

### Alerts to Configure
- Success rate drops below 95%
- Error rate exceeds 5%
- Processing time exceeds 1000ms
- Agent lookup failures >10 per hour

### Logs to Monitor
- Search for "CRITICAL" errors
- Search for "Agent lookup failed"
- Search for "Cannot determine call type"
- Search for "Failed to create call_tracking"

---

## Deployment Timeline

- **Pre-deployment:** 15 minutes (build, verify)
- **Deployment:** 5 minutes (deploy to staging)
- **Testing:** 30 minutes (10 test calls + verification)
- **Total:** ~50 minutes

---

## Sign-Off

- [ ] Code review completed
- [ ] All tests passed
- [ ] Logs verified
- [ ] Ready for production deployment

---

## Production Deployment (After Staging Success)

1. Create feature branch: `fix/feature-1-inbound-calls`
2. Merge to main after staging verification
3. Deploy to production with feature flag
4. Monitor for 24 hours
5. Full rollout if success rate >99%
