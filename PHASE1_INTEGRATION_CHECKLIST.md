# Phase 1 MVP Integration Checklist

Use this checklist to ensure all files are properly integrated and deployed.

---

## Pre-Integration (Code Review)

### Code Quality Review
- [ ] Review `/backend/src/routes/appointments.ts` (372 lines)
- [ ] Review `/backend/src/routes/contacts.ts` (495 lines)
- [ ] Review `/backend/src/routes/notifications.ts` (276 lines)
- [ ] Review `/backend/src/services/lead-scoring.ts` (230 lines)
- [ ] Review `/backend/src/services/sms-notifications.ts` (319 lines)
- [ ] Review `/backend/src/services/calendar-integration.ts` (419 lines)
- [ ] All imports are correct (supabase, logger, etc.)
- [ ] No console.log statements (all use logger)
- [ ] No hardcoded credentials
- [ ] JSDoc comments present on all functions

### Security Review
- [ ] Every route has `requireAuthOrDev` middleware
- [ ] Every route extracts and checks `orgId`
- [ ] Every database query has `.eq('org_id', orgId)`
- [ ] Every create/update/delete checks org_id ownership
- [ ] No SQL injection vulnerabilities (using Supabase ORM)
- [ ] Input validation uses Zod schemas
- [ ] Error responses don't leak sensitive data

---

## Step 1: Update Server Configuration

### File: `/backend/src/server.ts`

**Location:** Line ~50 (near other route imports)

```typescript
// Add these three imports:
import { appointmentsRouter } from './routes/appointments';
import { contactsRouter } from './routes/contacts';
import { notificationsRouter } from './routes/notifications';
```

**Verification:**
- [ ] Imports added without errors
- [ ] TypeScript compiler accepts imports
- [ ] No circular dependency issues

**Location:** Line ~165 (near other route registrations)

```typescript
// Add these three route registrations:
app.use('/api/appointments', appointmentsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/notifications', notificationsRouter);
```

**Verification:**
- [ ] Routes registered in correct order
- [ ] No duplicate route paths
- [ ] Routes come before `app.use('/api/founder-console')` or other catch-alls

### Test Server Starts
```bash
cd backend
npm run build
npm start
```

- [ ] Server starts without errors
- [ ] No TypeScript compilation errors
- [ ] No missing module errors
- [ ] Health check endpoint works: `curl http://localhost:3001/health`

---

## Step 2: Create Database Tables

### Create Migration File

Create file: `/backend/migrations/20250110_create_phase1_tables.sql`

Copy-paste the SQL from `PHASE1_MVP_IMPLEMENTATION_GUIDE.md` section "Database Schema Requirements"

### Required Tables:
- [ ] `appointments` - Scheduling and management
- [ ] `contacts` - Lead/contact management
- [ ] `notifications` - User notifications
- [ ] `sms_logs` - SMS delivery tracking
- [ ] `integrations` - OAuth token storage

### Run Migrations

```bash
# Local development
supabase db push

# Production (via Supabase dashboard)
# Upload SQL file to Migrations tab
```

- [ ] All tables created without errors
- [ ] Columns have correct types (UUID, TEXT, BOOLEAN, etc.)
- [ ] Indexes created for performance
- [ ] Foreign key constraints set up
- [ ] RLS policies applied (if using Supabase RLS)

### Verify Tables Exist

```bash
# Connect to Supabase and verify:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Should show:
- [ ] appointments
- [ ] contacts
- [ ] notifications
- [ ] sms_logs
- [ ] integrations

---

## Step 3: Configure Environment Variables

### File: `/backend/.env`

Add these variables:

```bash
# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
CLINIC_NAME="Your Clinic Name"

# Calendar Configuration (Google)
GOOGLE_CALENDAR_API_KEY=your_api_key_here

# Keep existing variables:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
NODE_ENV=production
```

### Verification Steps

**Twilio:**
- [ ] Visit twilio.com and log in
- [ ] Find Account SID (Settings → Account Info)
- [ ] Find Auth Token (Settings → Account Info)
- [ ] Find phone number (Phone Numbers → Active Numbers)
- [ ] Verify Twilio account has credits

**Google Calendar:**
- [ ] Visit Google Cloud Console
- [ ] Create/select project
- [ ] Enable Google Calendar API
- [ ] Create API key
- [ ] Verify API key works with a test request

**Supabase:**
- [ ] Verify SUPABASE_URL is correct
- [ ] Verify SUPABASE_SERVICE_ROLE_KEY is current
- [ ] Test with health check endpoint

### Test Environment Variables Load

```bash
node -e "console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER)"
```

- [ ] TWILIO_ACCOUNT_SID loads correctly
- [ ] TWILIO_AUTH_TOKEN loads correctly
- [ ] TWILIO_PHONE_NUMBER loads correctly
- [ ] GOOGLE_CALENDAR_API_KEY loads correctly

---

## Step 4: Test API Endpoints

### Test Authentication

```bash
# Should return 401 (no auth)
curl http://localhost:3001/api/appointments

# Should return 200 (with auth token)
curl http://localhost:3001/api/appointments \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] Request without auth returns 401
- [ ] Request with auth returns 200 or 400 (data error, not auth error)

### Test Appointments Routes

```bash
# Create appointment
curl -X POST http://localhost:3001/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "Botox",
    "scheduledAt": "2025-02-01T14:00:00Z",
    "customerName": "Test User",
    "contact_id": null
  }'
```

- [ ] POST /appointments returns 201 with appointment data
- [ ] Appointment has org_id set correctly
- [ ] Appointment id is UUID

```bash
# List appointments
curl "http://localhost:3001/api/appointments?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] GET /appointments returns 200
- [ ] Response has pagination object
- [ ] pagination.pages calculated correctly

```bash
# Check available slots
curl "http://localhost:3001/api/appointments/available-slots?date=2025-02-01" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] GET /appointments/available-slots returns 200
- [ ] availableSlots array contains times
- [ ] Times are in HH:MM format

### Test Contacts Routes

```bash
# Create contact
curl -X POST http://localhost:3001/api/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Test",
    "phone": "+1-555-0100",
    "email": "jane@test.com",
    "leadStatus": "warm"
  }'
```

- [ ] POST /contacts returns 201 with contact data
- [ ] Contact has org_id set correctly
- [ ] Duplicate phone number returns 400

```bash
# List contacts
curl "http://localhost:3001/api/contacts?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] GET /contacts returns 200
- [ ] Contacts have call/appointment counts
- [ ] Pagination works correctly

```bash
# Get contact with history
curl "http://localhost:3001/api/contacts/contact-uuid" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] GET /contacts/:id returns 200
- [ ] Response includes call_history array
- [ ] Response includes appointment_history array

### Test Notifications Routes

```bash
# Create notification (internal)
curl -X POST http://localhost:3001/api/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "hot_lead",
    "title": "New Hot Lead",
    "message": "John Doe is interested in Botox"
  }'
```

- [ ] POST /notifications returns 201
- [ ] Notification has org_id set correctly
- [ ] is_read defaults to false

```bash
# List unread notifications
curl "http://localhost:3001/api/notifications/unread" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] GET /notifications/unread returns 200
- [ ] Response has unreadCount
- [ ] Response has recentUnread array

```bash
# Mark notification as read
curl -X PATCH "http://localhost:3001/api/notifications/notif-uuid/read" \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] PATCH /notifications/:id/read returns 200
- [ ] is_read changes to true
- [ ] read_at is set

### Test Lead Scoring

```bash
# Test in code/script:
const { scoreLead } = require('./services/lead-scoring');
const result = await scoreLead(
  'test-org-id',
  'I am interested in Botox treatments, can you help me today?',
  'positive',
  { serviceType: 'Botox' }
);
console.log(result); // Should show score >= 70 (hot)
```

- [ ] Hot leads (score >= 70) identified
- [ ] Warm leads (40-69) identified
- [ ] Cold leads (< 40) identified
- [ ] Scoring breakdown provided

### Test SMS Service

```bash
# Test in code/script (requires Twilio credentials):
const { sendGenericSMS } = require('./services/sms-notifications');
const msgId = await sendGenericSMS('+1-555-0100', 'Test message from Voxanne');
console.log('Message ID:', msgId); // Should return valid Twilio message ID
```

- [ ] SMS sends successfully
- [ ] Message ID returned
- [ ] Check Twilio dashboard for message
- [ ] Verify SMS received on test phone

### Test Calendar Service

```bash
# Test in code/script (requires Google Calendar token):
const { getAvailableSlots } = require('./services/calendar-integration');
const slots = await getAvailableSlots('test-org-id', '2025-02-01');
console.log(slots); // Should show array of available times
```

- [ ] Available slots retrieved
- [ ] Times in HH:MM format
- [ ] Times within 9 AM - 6 PM range
- [ ] Busy times excluded

---

## Step 5: Verify Multi-Tenant Isolation

### Test Organization Isolation

```bash
# Create with Org A
export TOKEN_A="<org-a-token>"
curl -X POST http://localhost:3001/api/contacts \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"Org A Contact","phone":"+1-555-0101"}'

# Create with Org B
export TOKEN_B="<org-b-token>"
curl -X POST http://localhost:3001/api/contacts \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"name":"Org B Contact","phone":"+1-555-0102"}'

# Verify Org A can't see Org B's contact
curl "http://localhost:3001/api/contacts" \
  -H "Authorization: Bearer $TOKEN_A"
# Should NOT contain "Org B Contact"
```

- [ ] Each org sees only their own data
- [ ] Org A contacts != Org B contacts
- [ ] org_id filtering is working
- [ ] Cross-org access prevented

### Test Database Constraints

Connect to Supabase directly:

```sql
-- Check org_id is set on all records
SELECT COUNT(*) FROM appointments WHERE org_id IS NULL;  -- Should be 0
SELECT COUNT(*) FROM contacts WHERE org_id IS NULL;      -- Should be 0
SELECT COUNT(*) FROM notifications WHERE org_id IS NULL; -- Should be 0
```

- [ ] No records missing org_id
- [ ] All tables have org_id constraint
- [ ] Foreign key relationships valid

---

## Step 6: Monitor Logs and Errors

### Check Server Logs

```bash
# If running locally:
npm start
# Watch console output

# If deployed to Render:
render logs --tail
```

Look for:
- [ ] Route registration messages (should see new routes)
- [ ] No TypeScript compilation errors
- [ ] No 404 errors on new endpoints
- [ ] Normal operation logs from test requests

### Check Database Logs

In Supabase dashboard:
- [ ] Database → Logs
- [ ] Filter for table access
- [ ] Verify org_id filtering in queries

### Check Service Integration

```bash
# View Twilio message logs
# Twilio Console → Message → Logs

# View Google Calendar API logs
# Google Cloud Console → APIs & Services → Quotas
```

- [ ] SMS messages appear in Twilio logs
- [ ] Calendar API calls in Google Cloud logs
- [ ] No error codes
- [ ] Quota usage within limits

---

## Step 7: Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Code reviewed by team
- [ ] No console.log statements
- [ ] No hardcoded credentials
- [ ] Error messages user-friendly

### Deploy to Render (or your platform)

```bash
# Build
npm run build

# Test build output
node dist/server.js

# Push to production
git add .
git commit -m "feat: Add Phase 1 MVP APIs (appointments, contacts, notifications)"
git push origin main
```

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No missing dependencies

### Post-Deployment Verification

```bash
# Test production endpoint
curl https://your-render-domain.com/health

# Test with production token
curl https://your-render-domain.com/api/appointments \
  -H "Authorization: Bearer $PROD_TOKEN"
```

- [ ] Health endpoint returns 200
- [ ] API endpoints responding
- [ ] Correct org_id isolation in production
- [ ] Database connected
- [ ] Logs visible in Render dashboard

---

## Step 8: Monitor and Validate

### Daily Monitoring (First Week)

- [ ] Check server logs for errors
- [ ] Verify API response times
- [ ] Monitor database performance
- [ ] Check SMS delivery rates (Twilio dashboard)
- [ ] Verify calendar API quotas
- [ ] Review error tracking (Sentry if configured)

### Weekly Validation

- [ ] Run full test suite
- [ ] Load test with production traffic
- [ ] Verify database size growth
- [ ] Check rate limit effectiveness
- [ ] Review user feedback

### Monthly Review

- [ ] Analyze API metrics
- [ ] Database query performance
- [ ] Cost analysis (Twilio, Google Calendar)
- [ ] Plan optimizations
- [ ] Security audit

---

## Rollback Plan (If Issues Occur)

### Quick Rollback

If issues found before full production traffic:

```bash
# Revert to previous version
git revert <commit-hash>
git push origin main

# Or disable routes temporarily:
# Comment out app.use() calls in server.ts
```

### Partial Rollback

If specific endpoint has issues:

1. Comment out that route in `/backend/src/server.ts`
2. Push changes
3. Investigate in separate branch
4. Fix and retest
5. Re-enable

### Full Rollback

If entire Phase 1 needs rollback:

1. Revert git commits
2. Downgrade database (restore previous backup)
3. Redeploy previous version
4. Plan fix in staging environment

---

## Success Criteria

### All integration checklist items checked ✅

When ALL items below are checked, Phase 1 is successfully integrated:

- [ ] Code reviewed and approved
- [ ] Imports added to server.ts
- [ ] Routes registered
- [ ] Server builds and starts
- [ ] Database tables created
- [ ] Environment variables configured
- [ ] All endpoint tests pass
- [ ] Authentication verified
- [ ] Pagination working
- [ ] Lead scoring working
- [ ] SMS integration working
- [ ] Calendar integration working
- [ ] Multi-tenant isolation verified
- [ ] No hardcoded credentials
- [ ] Error handling verified
- [ ] Logging working
- [ ] Production deployed
- [ ] Monitoring active
- [ ] Team notified

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Code Review | 30 min | ⏳ |
| Server Update | 15 min | ⏳ |
| Database Setup | 30 min | ⏳ |
| Environment Config | 15 min | ⏳ |
| Testing | 60 min | ⏳ |
| Debugging (if needed) | 30-60 min | ⏳ |
| Deployment | 15 min | ⏳ |
| Validation | 15 min | ⏳ |
| **Total** | **3-4 hours** | |

---

## Support & Troubleshooting

### Common Issues

**"Cannot find module" error**
- [ ] Check imports in server.ts are correct
- [ ] Run `npm install` if dependencies missing
- [ ] Clear node_modules and reinstall

**"org_id is undefined" error**
- [ ] Check Authorization header present
- [ ] Verify user metadata has org_id
- [ ] Check auth middleware is applied

**"Table doesn't exist" error**
- [ ] Run database migrations
- [ ] Verify tables in Supabase dashboard
- [ ] Check table names match code

**SMS not sending**
- [ ] Verify Twilio credentials correct
- [ ] Check account has credits
- [ ] Verify phone number format (E.164)
- [ ] Check Twilio logs for errors

**Calendar not working**
- [ ] Verify GOOGLE_CALENDAR_API_KEY set
- [ ] Check refresh token stored
- [ ] Verify Google Calendar API enabled
- [ ] Check quota not exceeded

### Get Help

1. Check documentation:
   - `PHASE1_MVP_IMPLEMENTATION_GUIDE.md`
   - `PHASE1_API_QUICK_REFERENCE.md`

2. Review existing code patterns:
   - `/backend/src/routes/calls-dashboard.ts`
   - `/backend/src/routes/knowledge-base.ts`

3. Check logs:
   - Server console output
   - Render/deployment logs
   - Twilio/Google dashboard logs

---

## Final Sign-Off

**Integration Completed:** _______________  (Date)
**Tested By:** _________________________  (Name)
**Approved By:** ________________________  (Name)
**Deployed To:** ________________________  (Environment)

---

*Checklist Version: 1.0*
*Last Updated: January 10, 2025*
*Status: Ready for Integration*
