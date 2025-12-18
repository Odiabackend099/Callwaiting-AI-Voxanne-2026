# Production Monitoring Setup - Phase 5

## UptimeRobot Configuration

### Backend Health Check
- **URL:** https://voxanne-backend.onrender.com/health
- **Method:** GET
- **Interval:** 5 minutes
- **Timeout:** 30 seconds
- **Alert Threshold:** 2 consecutive failures

### Frontend Health Check
- **URL:** https://callwaitingai.dev
- **Method:** GET
- **Interval:** 5 minutes
- **Timeout:** 30 seconds
- **Alert Threshold:** 2 consecutive failures

### Alert Configuration
- **Slack Integration:** Required for real-time alerts
- **Email Notifications:** Backup alerts
- **SMS Alerts:** Critical downtime only

## Sentry Configuration

### Error Tracking
- **Project:** Voxanne Backend
- **DSN:** Set in Render environment variables
- **Sample Rate:** 10% (production), 100% (development)
- **Trace Integration:** HTTP requests tracked

### Alert Rules
- Critical errors: Immediate Slack notification
- Performance degradation: Hourly digest
- Release tracking: Automatic on GitHub push

## Monitoring Checklist

- [ ] UptimeRobot monitors /health endpoint
- [ ] Slack integration configured
- [ ] Email alerts enabled
- [ ] Sentry DSN configured in Render
- [ ] Error tracking active
- [ ] Performance monitoring enabled
- [ ] 24-hour monitoring period started

## Production URLs

- **Backend:** https://voxanne-backend.onrender.com
- **Frontend:** https://callwaitingai.dev
- **Health Check:** https://voxanne-backend.onrender.com/health

## Next Steps

1. Create UptimeRobot account (if not exists)
2. Add health check monitors
3. Configure Slack webhook
4. Create Sentry project and get DSN
5. Update Render environment variables
6. Monitor for 24-48 hours
7. Document any issues found

## Success Criteria

- Backend health check: ✅ Passing
- Frontend responding: ✅ Passing
- Error tracking: ✅ Configured
- Uptime monitoring: ✅ Active
- All systems: ✅ Operational
