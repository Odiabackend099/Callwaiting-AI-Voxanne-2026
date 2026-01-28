# Voxanne AI: Operational Runbook

**Version:** 1.0  
**Last Updated:** 2026-01-28  
**Owner:** Engineering Team

---

## Quick Reference

### Emergency Contacts
- **Slack:** #engineering-alerts (immediate)
- **Supabase:** support@supabase.com
- **Vapi:** support@vapi.ai
- **Twilio:** https://www.twilio.com/help/contact

### Critical URLs
- **API:** https://api.voxanne.ai
- **Supabase:** https://app.supabase.com/project/lbjymlodxprzqgtyqtcq
- **Health:** https://api.voxanne.ai/api/monitoring/health

### Quick Commands
```bash
# Health check
curl https://api.voxanne.ai/api/health

# Database test
psql $DATABASE_URL -c "SELECT 1;"

# Backup status
psql $DATABASE_URL -c "SELECT * FROM backup_verification_log ORDER BY verified_at DESC LIMIT 1;"
```

---

## 1. Database Issues

### 1.1 Connection Failures
**Symptoms:** API 500 errors, "Database connection failed"

**Resolution:**
1. Check Supabase status: https://status.supabase.com
2. Verify DATABASE_URL environment variable
3. Check connection pool: `SELECT count(*) FROM pg_stat_activity;`
4. Restart application if needed

### 1.2 Slow Queries
**Symptoms:** API >2s response time, timeouts

**Resolution:**
1. Find slow queries: `SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;`
2. Add missing indexes
3. Optimize query (add WHERE, LIMIT, specific columns)
4. Clear cache: `curl -X POST .../api/monitoring/cache-clear`

### 1.3 Deadlocks
**Symptoms:** "deadlock detected" error

**Resolution:**
1. View locks: `SELECT pid, query FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`
2. Kill blocking query: `SELECT pg_terminate_backend([PID]);`
3. Review transaction order in code

### 1.4 Migration Rollback
**Symptoms:** Failed migration, schema inconsistent

**Resolution:**
1. Check migration history
2. Create rollback script (DROP/ALTER statements)
3. Execute rollback in transaction
4. Verify application works

### 1.5 RLS Policy Issues
**Symptoms:** Users can't access data, empty results

**Resolution:**
1. List policies: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
2. Check if RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables;`
3. Fix policy logic (verify org_id cast to UUID)
4. Test with different roles

---

## 2. Application Issues

### 2.1 Server Won't Start
**Symptoms:** Crashes on startup, "Port in use"

**Resolution:**
1. Kill existing process: `lsof -i :3001` then `kill -9 [PID]`
2. Install dependencies: `npm install`
3. Check environment variables
4. Start server: `npm start`

### 2.2 Memory Leaks
**Symptoms:** Memory growing, "heap out of memory"

**Resolution:**
1. Restart server immediately: `pm2 restart voxanne-backend`
2. Increase memory: `node --max-old-space-size=4096 server.js`
3. Find leak source (unclosed connections, event listeners)
4. Fix and deploy

### 2.3 High CPU
**Symptoms:** CPU >80%, slow responses

**Resolution:**
1. Check top processes: `top -o cpu`
2. Profile code: `node --prof server.js`
3. Optimize hot path (cache, async operations)
4. Scale horizontally if needed

### 2.4 API Timeouts
**Symptoms:** 504 errors, ETIMEDOUT

**Resolution:**
1. Increase timeout: `server.timeout = 60000;`
2. Optimize slow endpoint (indexes, pagination, cache)
3. Implement async processing for long operations
4. Use circuit breaker

### 2.5 Webhook Failures
**Symptoms:** Webhooks not processed, dead letter queue growing

**Resolution:**
1. Check queue: `curl .../api/webhook-metrics/queue-health`
2. Check Redis: `redis-cli ping`
3. Review failures: `SELECT * FROM webhook_delivery_log WHERE status='failed';`
4. Retry manually: `curl -X POST .../api/webhook-metrics/retry-failed/[job-id]`

---

## 3. External Services

### 3.1 Vapi API Down
**Symptoms:** Voice calls failing

**Resolution:**
1. Check Vapi status
2. Verify API key: `curl -H "Authorization: Bearer $VAPI_API_KEY" https://api.vapi.ai/assistant`
3. Enable maintenance mode
4. Circuit breaker should auto-recover

### 3.2 Twilio Issues
**Symptoms:** SMS not delivered

**Resolution:**
1. Check status: https://status.twilio.com
2. Verify balance and credentials
3. Check error codes in Twilio console
4. Retry failed messages

### 3.3 Google Calendar Failures
**Symptoms:** Appointments not syncing

**Resolution:**
1. Refresh OAuth token
2. Check API quota in Google Cloud Console
3. Verify calendar permissions
4. Implement retry with backoff

### 3.4 Supabase Outage
**Symptoms:** All database operations failing

**Resolution:**
1. Check https://status.supabase.com
2. Enable maintenance mode
3. Monitor for recovery
4. Verify data integrity after recovery

---

## 4. Data Issues

### 4.1 Duplicate Records
**Symptoms:** Multiple records with same data

**Resolution:**
1. Find duplicates: `SELECT scheduled_at, contact_id, COUNT(*) FROM appointments GROUP BY scheduled_at, contact_id HAVING COUNT(*) > 1;`
2. Merge duplicates (keep oldest, delete rest)
3. Add unique constraint to prevent future duplicates

### 4.2 Missing Data
**Symptoms:** Records disappeared

**Resolution:**
1. Check soft deletes: `SELECT COUNT(*) FROM appointments WHERE deleted_at IS NOT NULL;`
2. Check audit logs
3. Restore from backup if needed
4. Fix orphaned records

### 4.3 Incorrect Calculations
**Symptoms:** Dashboard stats wrong

**Resolution:**
1. Recalculate stats
2. Fix invalid data (dates, durations)
3. Clear cache
4. Add validation constraints

### 4.4 Orphaned Records
**Symptoms:** Foreign key violations

**Resolution:**
1. Find orphans: `SELECT COUNT(*) FROM appointments WHERE contact_id NOT IN (SELECT id FROM contacts);`
2. Backup and delete orphaned records
3. Add foreign key constraints

---

## 5. Monitoring

### 5.1 Sentry Errors
**Process:**
1. Open Sentry dashboard
2. Analyze error (stack trace, frequency, users affected)
3. Categorize: Critical/High/Medium/Low
4. Fix based on severity
5. Deploy and verify

### 5.2 Slack Alerts
**Alert Levels:**
- 🚨 **Critical:** Respond immediately (<15 min)
- ⚠️ **Warning:** Review within 1 hour
- ℹ️ **Info:** Review daily

### 5.3 Metrics Dashboard
**Key Metrics:**
- API response time (target: <500ms)
- Error rate (target: <1%)
- Database query time (target: <100ms)
- Cache hit rate (target: >80%)
- Webhook success rate (target: >99%)

---

## 6. Deployment

### 6.1 Failed Deployment
**Symptoms:** Build fails, application won't start

**Resolution:**
1. Check build logs
2. Verify environment variables
3. Test locally first
4. Rollback if needed: `git revert [commit]`

### 6.2 Rollback Procedure
```bash
# Identify last good commit
git log --oneline

# Revert to previous version
git revert [bad-commit]
git push origin main

# Or force rollback
git reset --hard [good-commit]
git push -f origin main

# Verify
curl https://api.voxanne.ai/api/health
```

---

## 7. Security

### 7.1 Suspicious Activity
**Symptoms:** Unusual API calls, rate limit breaches

**Resolution:**
1. Check logs for IP addresses
2. Review recent authentication attempts
3. Block suspicious IPs if needed
4. Rotate API keys if compromised

### 7.2 Data Breach Response
**Immediate Actions:**
1. Isolate affected systems
2. Notify security team
3. Preserve logs
4. Contact affected users
5. Document incident

---

## 8. Performance

### 8.1 Slow Dashboard
**Resolution:**
1. Check database query performance
2. Verify cache is working
3. Optimize N+1 queries
4. Add pagination

### 8.2 Cache Issues
**Resolution:**
1. Check cache stats: `curl .../api/monitoring/cache-stats`
2. Clear cache if stale
3. Verify cache hit rate >80%
4. Adjust TTL if needed

---

## Escalation Path

1. **Level 1:** On-call engineer (15 min response)
2. **Level 2:** Engineering manager (30 min)
3. **Level 3:** CTO (1 hour or data loss)
4. **Level 4:** External support (Supabase, Vapi, etc.)

---

## Related Documents

- `DISASTER_RECOVERY_PLAN.md` - Backup and recovery procedures
- `PRIORITY_8_PLANNING.md` - Implementation plan
- `.claude/claude.md` - Production priorities

---

**Document Maintenance:**
- Review monthly
- Update after incidents
- Keep contact info current
