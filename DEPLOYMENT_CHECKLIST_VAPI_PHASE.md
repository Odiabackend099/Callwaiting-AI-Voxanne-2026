# VAPI Appointment Booking & Hot Lead SMS - Deployment Checklist

**Status**: Ready for Production
**Last Updated**: January 10, 2026
**Branch**: reorganize-repository-structure

---

## ✅ PRE-DEPLOYMENT (Before pushing to main)

### Code Review

- [ ] All OAuth 'active' → 'connected' fixes applied
- [ ] WebSocket JWT validation enhanced
- [ ] VAPI tool definitions created (backend/src/config/vapi-tools.ts)
- [ ] Function call handlers implemented in webhooks.ts (1,550+ lines)
- [ ] Hot lead SMS endpoint added to founder-console-settings.ts
- [ ] Frontend settings UI updated with phone input and test button
- [ ] Database migration file created (20250111_add_hot_lead_alerts.sql)

### Environment Variables

- [ ] `GOOGLE_CLIENT_ID` - Set and verified
- [ ] `GOOGLE_CLIENT_SECRET` - Set and verified
- [ ] `GOOGLE_ENCRYPTION_KEY` - Generated with `openssl rand -hex 32`
- [ ] `TWILIO_ACCOUNT_SID` - Set and verified
- [ ] `TWILIO_AUTH_TOKEN` - Set and verified
- [ ] `TWILIO_PHONE_NUMBER` - Set and verified (your Twilio sender number)
- [ ] `BACKEND_URL` - Points to your backend (for OAuth redirects & SMS callbacks)
- [ ] `DATABASE_URL` - Verified and accessible
- [ ] `SUPABASE_JWT_SECRET` - Set for WebSocket JWT validation

### Git Preparation

- [ ] All changes committed to 'reorganize-repository-structure' branch
- [ ] Commit message references VAPI implementation
- [ ] Branch is up-to-date with main
- [ ] No uncommitted changes

---

## ✅ DEPLOYMENT TO PRODUCTION

### 1. Database Migration (CRITICAL - Do This First)

```bash
# SSH into production database
psql $DATABASE_URL -f backend/migrations/20250111_add_hot_lead_alerts.sql

# Verify migration succeeded
psql $DATABASE_URL -c "SELECT * FROM information_schema.tables WHERE table_name='hot_lead_alerts';"

# Check column was added
psql $DATABASE_URL -c "\d integration_settings" | grep hot_lead_alert_phone

# If all looks good:
[ ] Migration completed successfully
```

**Rollback if needed**:

```bash
psql $DATABASE_URL -c "DROP TABLE IF EXISTS hot_lead_alerts CASCADE;"
psql $DATABASE_URL -c "ALTER TABLE integration_settings DROP COLUMN IF EXISTS hot_lead_alert_phone;"
```

### 2. Deploy Backend Code

```bash
# Pull latest code
git pull origin reorganize-repository-structure

# Install dependencies
cd backend
npm install

# Build TypeScript
npm run build

# Start backend (verify no errors in logs)
npm start

# In another terminal, verify webhook endpoint responds
curl -X POST http://localhost:3001/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: test" \
  -d '{"type":"call.started","call":{"id":"test-123"}}'

[ ] Backend started successfully
[ ] Webhook endpoint responding
[ ] No critical errors in logs
```

### 3. Deploy Frontend Code

```bash
cd ../
npm install
npm run build
npm start

# In browser, navigate to /dashboard/settings
# Verify "Hot Lead SMS Alerts" section appears

[ ] Frontend built successfully
[ ] Settings page loads without errors
[ ] Hot lead SMS section visible
```

### 4. Verify OAuth Flow

1. Go to `/dashboard/settings`
2. In Founder Console:
   - Paste your Vapi API key
   - Click "Discover Assistants"
   - Select an assistant
   - Click "Configure Webhook & Save"
3. Should see: "✅ Vapi Configured"

```
[ ] OAuth flow works without errors
[ ] Vapi Assistant discovered
[ ] Webhook configured
```

### 5. Configure Hot Lead Alert Phone

1. Still in `/dashboard/settings`
2. Scroll to "🔥 Hot Lead SMS Alerts"
3. Enter clinic manager phone in E.164 format (e.g., +12025551234)
4. Click "Send Test SMS"
5. Check phone for test message: "This is a test alert. Your hot lead SMS notifications are configured correctly!"

```
[ ] Alert phone input accepts E.164 format
[ ] Test SMS sent successfully
[ ] Test SMS received on phone
[ ] Alert phone setting saved to database
```

### 6. Update VAPI Assistant with Tools

**In VAPI Dashboard**:

1. Go to: Assistants → [Your Assistant] → Tools
2. Add 3 tools (use JSON from docs/VAPI_IMPLEMENTATION_COMPLETE.md):
   - check_availability
   - book_appointment
   - notify_hot_lead
3. Update system prompt with tool guidance (include when/how to use each tool)
4. Save and deploy

```
[ ] check_availability tool added to VAPI
[ ] book_appointment tool added to VAPI
[ ] notify_hot_lead tool added to VAPI
[ ] System prompt updated with guidance
[ ] VAPI assistant deployed
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Live Call Testing

#### Test 1: Check Availability

```
Action: Call your VAPI number
Say: "What times are available tomorrow?"

Expected:
- AI calls check_availability function
- Returns list of available slots (e.g., "9:00 AM, 10:30 AM, 2:00 PM...")
- Formatted for natural speech

Result: [ ] PASS / [ ] FAIL
Logs to check: "Checking availability" in backend logs
```

#### Test 2: Book Appointment (Calendar Connected)

```
Action: Call your VAPI number
Say: "I'd like to book Botox for [tomorrow's date] at 2 PM. My name is [Your Name] and my phone is [Your Phone]"

Expected:
- AI calls book_appointment function
- Appointment created in database with status='scheduled'
- Google Calendar event created
- SMS confirmation sent to customer phone
- AI confirms: "Great! I've confirmed your Botox appointment..."

Check:
[ ] Appointment visible in database
[ ] Google Calendar event created
[ ] SMS confirmation received
[ ] AI response was natural and helpful

Result: [ ] PASS / [ ] FAIL
Logs to check: "Processing appointment booking" & "Google Calendar event created"
```

#### Test 3: Book Appointment (Calendar NOT Connected)

```
Action: Disconnect Google Calendar OAuth first
Call your VAPI number
Say: "Book Laser Treatment for [date] at 3 PM. My name is [Name], phone [Number]"

Expected:
- AI calls book_appointment function
- Appointment created with status='pending' (since calendar not connected)
- SMS confirmation sent
- AI confirms: "I've scheduled your appointment...Our team will call you within 24 hours to confirm"

Check:
[ ] Appointment created with status='pending'
[ ] SMS still sent
[ ] AI gracefully explained pending status

Result: [ ] PASS / [ ] FAIL
Logs to check: "Google Calendar not connected, booking as pending"
```

#### Test 4: Hot Lead Alert (Manual Trigger)

```
Action: Call your VAPI number
Say: "I'm interested in Botox and Dermal Filler treatments. I have budget set aside. I'd like to book this week. My name is [Name], phone [Phone]"

Expected:
- AI recognizes high-value lead
- Calls notify_hot_lead function
- SMS alert sent to clinic manager phone with format:
  "🔥 VOXANNE HOT LEAD ALERT:
   👤 Name: [Name]
   📞 Phone: [Phone]
   💉 Interest: Botox and Dermal Filler
   📝 Summary: [Details]
   Action: Call them back ASAP to close the booking!"

Check:
[ ] SMS alert received on clinic manager phone
[ ] Alert contains customer name and phone
[ ] Dashboard notification created
[ ] No duplicate alerts for same call

Result: [ ] PASS / [ ] FAIL
Logs to check: "Hot lead SMS sent" in backend logs
```

#### Test 5: Hot Lead Alert (Automatic Detection)

```
Action: Call your VAPI number with high-value conversation
Include keywords: "Botox", "this week", "budget confirmed", "ready to move"

Expected:
- Call ends
- Backend scores transcript (should be 70+)
- SMS alert automatically sent to clinic manager (without AI calling notify_hot_lead)
- Dashboard notification created

Check:
[ ] SMS alert received without manual trigger
[ ] Lead score >= 70 in logs
[ ] Alert properly attributed to "Auto-detected"

Result: [ ] PASS / [ ] FAIL
Logs to check: "Lead scored from transcript" & "Auto hot lead SMS sent"
```

#### Test 6: Duplicate Prevention

```
Action: Call your VAPI number twice with same high-value content
Or: Manually trigger notify_hot_lead, then wait for automatic trigger

Expected:
- Only ONE SMS sent to clinic manager
- Database constraint prevents duplicate alert (UNIQUE on org_id, call_id)
- Second attempt silently fails or returns "Already notified"

Check:
[ ] Only one SMS received despite multiple triggers
[ ] Database shows only one record in hot_lead_alerts
[ ] Logs show duplicate prevention working

Result: [ ] PASS / [ ] FAIL
Logs to check: "Hot lead alert already sent for this call"
```

### Production Monitoring

#### First 24 Hours

- [ ] No critical errors in backend logs
- [ ] All VAPI webhook calls succeeding
- [ ] No timeout issues (all handlers < 5 seconds)
- [ ] SMS sent successfully for each alert
- [ ] Google Calendar events being created
- [ ] WebSocket connections stable

#### Metrics to Track

- [ ] Number of calls received
- [ ] Number of appointments booked
- [ ] Number of hot leads detected
- [ ] SMS success rate (should be 99%+)
- [ ] Calendar integration success rate
- [ ] Average response time for each handler

#### Error Log Analysis

Search logs for:

```
ERROR: Failed to send hot lead SMS
ERROR: Failed to check availability
ERROR: Error in handleEndOfCallReport
ERROR: Error resolving org_id from assistantId
```

If any errors found:

- [ ] Document error
- [ ] Check related environment variables
- [ ] **Verify Database Connection**
  - Check `DATABASE_URL` matches production Supabase instance
  - Verify migrations are up to date: `npm run db:migrate`
- [ ] Check external API status (Twilio, Google Calendar)
- [ ] Roll back if necessary

### 4. Production Safety Checks (2026 Edition)
>
> [!IMPORTANT]
> **Critical Compliance & Verification Steps**

- [ ] **Google OAuth Sensitive Scope Verification**
  - **Why:** Using `https://www.googleapis.com/auth/calendar` triggers "Sensitive Scope" review.
  - **Action:**
    - [ ] For first 100 users: Keep app in "Testing" mode in Google Cloud Console.
    - [ ] For Public Launch: Submit 1-minute YouTube demo of Voxanne integration to Google Trust & Safety.
  - **Verify:** Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are for the correct project.

- [ ] **HIPAA Compliance Toggle**
  - **Why:** Vapi has a `hipaaEnabled: true` flag that disables their logging.
  - **Action:**
    - [ ] Confirm if `hipaaEnabled` is required for this deployment.
    - [ ] **CRITICAL:** Verify `webhooks.ts` saves transcript/recording to YOUR Supabase *before* Vapi wipes it (if HIPAA enabled).
  - **Verify:** Check `backend/src/routes/webhooks.ts` transcript persistence logic.

### 5. Backend Deployment

---

## ✅ ROLLBACK PROCEDURE (If Needed)

### 1. Database Rollback

```bash
# Drop new tables (CAUTION: This deletes data)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS hot_lead_alerts CASCADE;"

# Remove column from integration_settings
psql $DATABASE_URL -c "ALTER TABLE integration_settings DROP COLUMN IF EXISTS hot_lead_alert_phone;"

# Verify rollback
psql $DATABASE_URL -c "\dt hot_lead_alerts"  # Should show "Did not find any relation"
```

### 2. Code Rollback

```bash
# Revert to previous version
git revert <commit-hash>

# Or restore from previous branch
git checkout main

# Redeploy backend
cd backend
npm install
npm run build
npm start
```

### 3. Communication

- [ ] Notify team of rollback
- [ ] Document what went wrong
- [ ] Schedule postmortem
- [ ] Create tickets to fix issues

---

## ✅ FINAL SIGN-OFF

### Deployment Complete When All Checked

- [ ] Database migration successful
- [ ] Backend code deployed and running
- [ ] Frontend code deployed and running
- [ ] OAuth flow verified working
- [ ] Hot lead alert phone configured
- [ ] VAPI assistant updated with 3 tools
- [ ] All 6 live call tests PASSED
- [ ] No critical errors in logs (24 hours)
- [ ] Production metrics look good
- [ ] Team training completed (if applicable)

### Go/No-Go Decision

- [ ] **GO** - All checks passed, ready for customers
- [ ] **NO-GO** - Issues found, needs rollback and fixes

**Approval By**: ___________________
**Date**: ___________________
**Time**: ___________________

---

## 📞 Support Resources

**Documentation**: See `docs/VAPI_IMPLEMENTATION_COMPLETE.md`

**Quick Links**:

- VAPI Tool Definitions: `backend/src/config/vapi-tools.ts`
- Function Handlers: `backend/src/routes/webhooks.ts` (lines 1214-1772)
- Database Schema: `backend/migrations/20250111_add_hot_lead_alerts.sql`
- Frontend UI: `src/app/dashboard/settings/page.tsx`
- Test Endpoint: `backend/src/routes/founder-console-settings.ts` (lines 616-667)

**Logs to Monitor**:

- Backend: Check logs for "webhooks:" prefix
- Frontend: Browser console for errors
- Database: Check RLS policy violations
- SMS: Check Twilio logs for delivery status

---

**Ready for Deployment** ✅
**Production-Ready Code** 🚀
