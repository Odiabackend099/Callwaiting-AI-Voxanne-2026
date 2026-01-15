# Phase 6 UAT Deployment Guide
**User Acceptance Testing for Vapi Voice Booking Integration**

Date: January 15, 2026  
Status: Ready for Staging Deployment  
Target: Real user testing before production launch

---

## Overview

This guide enables non-technical end users to test the Vapi voice booking system in a safe staging environment before real patients use it.

---

## Part 1: Staging Deployment Setup

### Prerequisites
- Staging Vapi account (separate from production)
- Staging Supabase project (test database)
- Staging API endpoint configured

### Deployment Steps

#### Step 1: Deploy to Staging Environment
```bash
# 1. Switch to staging branch
git checkout staging

# 2. Merge Phase 6 changes
git merge phase-6-vapi-integration

# 3. Deploy to staging server
npm run deploy:staging

# 4. Verify deployment
curl -X GET https://staging-api.callwaiting.ai/health
# Expected: { "status": "OK", "version": "6.0.0" }
```

#### Step 2: Configure Staging Vapi Agent

1. **Log into Vapi Console** (staging account)
2. **Create New Voice Agent**
   - Name: "Doctor Booking Bot - Staging"
   - Model: GPT-4 (same as production)
   - Language: English

3. **Add Tool: book_appointment**
   ```json
   {
     "name": "book_appointment",
     "description": "Book an appointment with a healthcare provider",
     "parameters": {
       "provider_id": { "type": "string", "description": "UUID of provider" },
       "appointment_date": { "type": "string", "description": "YYYY-MM-DD format" },
       "appointment_time": { "type": "string", "description": "HH:MM format (24h)" },
       "patient_email": { "type": "string", "description": "Patient email" },
       "patient_phone": { "type": "string", "description": "Patient phone (optional)" }
     }
   }
   ```

4. **Set Webhook URL**
   - Endpoint: `https://staging-api.callwaiting.ai/api/vapi/booking`
   - Method: POST
   - Headers: `Authorization: Bearer {staging-jwt}`
   - Test webhook: ✅ Should return 200 OK

5. **Configure Authorization**
   - Generate JWT with test `org_id`: `staging-clinic-uuid-001`
   - Include in webhook header: `Authorization: Bearer {test_jwt}`

#### Step 3: Create Test Data in Staging Database

```sql
-- Insert test organization
INSERT INTO organizations (id, name, slug) VALUES 
  ('staging-clinic-uuid-001', 'Staging Test Clinic', 'staging-test-clinic');

-- Insert test providers
INSERT INTO profiles (id, tenant_id, full_name, email, phone, role) VALUES 
  ('provider-uuid-001', 'staging-clinic-uuid-001', 'Dr. Sarah Smith', 'sarah@stagingclinic.com', '+1-555-0101', 'provider'),
  ('provider-uuid-002', 'staging-clinic-uuid-001', 'Dr. James Johnson', 'james@stagingclinic.com', '+1-555-0102', 'provider'),
  ('provider-uuid-003', 'staging-clinic-uuid-001', 'Dr. Maria Garcia', 'maria@stagingclinic.com', '+1-555-0103', 'provider');

-- Create available time slots (next 30 days)
INSERT INTO provider_availability (provider_id, available_date, start_time, end_time, duration_minutes) VALUES 
  ('provider-uuid-001', '2026-01-16', '09:00', '17:00', 30),
  ('provider-uuid-001', '2026-01-17', '09:00', '17:00', 30),
  ('provider-uuid-002', '2026-01-16', '10:00', '18:00', 45),
  ('provider-uuid-003', '2026-01-20', '13:00', '16:00', 30);
```

---

## Part 2: UAT Test Scenarios

### Scenario 1: Basic Appointment Booking (Happy Path)
**Objective:** Confirm user can successfully book an appointment via voice

**Steps:**
1. Call the Vapi agent: `curl -X POST https://staging-api.callwaiting.ai/call -d '{"number": "+1-555-TEST"}'`
2. Agent greets: "Hi, welcome to Staging Clinic. How can I help you today?"
3. User says: "I'd like to book an appointment with Dr. Smith next Friday at 2 PM"
4. Agent confirms: "Great! I have you booked with Dr. Smith for Friday, January 17th at 2:00 PM"
5. Agent asks: "Would you like a confirmation email sent to your address?"
6. User: "Yes, send it to patient@email.com"

**Success Criteria:**
- ✅ Agent understands natural language request
- ✅ Appointment created in database
- ✅ Confirmation email sent within 30 seconds
- ✅ Latency <500ms (measured in response)
- ✅ No errors or crashes

**Failure Scenarios to Test:**
- User says "Tomorrow" (past date) → Agent should say "I can only book future appointments"
- User says "Midnight" (invalid time) → Agent should offer available times
- User asks for unavailable slot → Agent should offer alternatives

---

### Scenario 2: Concurrent Booking (Stress Test)
**Objective:** Verify system handles multiple simultaneous booking requests without double-booking

**Steps:**
1. **UAT Tester 1** calls and books: "Dr. Smith, Friday 2 PM"
2. **UAT Tester 2** calls simultaneously and tries: "Dr. Smith, Friday 2 PM"
3. Both receive responses

**Expected Behavior:**
- ✅ Tester 1: Success (appointment created)
- ✅ Tester 2: Conflict message ("That slot was just taken. Would you like Friday at 3 PM?")
- ✅ Database shows exactly 1 appointment (not 2)
- ✅ No data corruption

---

### Scenario 3: Multi-Clinic Isolation
**Objective:** Verify clinic data doesn't leak between organizations

**Test Setup:**
- Staging has 2 test clinics: `Clinic A` and `Clinic B`
- Each has different providers

**Steps:**
1. **Clinic A User** books with Dr. Smith
2. **Clinic B User** calls same agent
3. Agent should only show `Clinic B` providers, NOT `Clinic A` providers

**Success Criteria:**
- ✅ Clinic B cannot see Clinic A's providers
- ✅ Clinic B cannot book Clinic A's slots
- ✅ Each clinic's data remains isolated

---

### Scenario 4: Error Handling
**Objective:** System gracefully handles errors without crashing

**Test Cases:**
1. **No Provider Available**
   - User: "Book with Dr. Who"
   - Expected: "I don't have a provider by that name. Available providers are..."

2. **Database Offline**
   - Trigger by stopping Supabase temporarily
   - Expected: Agent says "Sorry, we're experiencing technical issues. Please call back later."

3. **Invalid Time Format**
   - User: "I want 25:99 AM"
   - Expected: Agent suggests valid times

---

### Scenario 5: Confirmation Email/SMS
**Objective:** User receives confirmation outside of voice channel

**Steps:**
1. Complete booking via voice
2. Check patient email inbox within 1 minute
3. Click confirmation link in email
4. Verify appointment marked as "confirmed" in database

**Success Criteria:**
- ✅ Email arrives within 30 seconds
- ✅ Email includes appointment date, time, provider name
- ✅ Confirmation link is clickable and secure (uses token)
- ✅ Clicking link updates database status
- ✅ No typos or formatting issues

---

## Part 3: UAT Participant Checklist

### Before Testing
- [ ] Participant has access to staging Vapi phone number
- [ ] Participant has email account for receiving confirmations
- [ ] Participant understands they're testing, not booking a real appointment
- [ ] Participant has written instructions for each scenario

### During Testing
- [ ] Record voice call (for debugging if needed)
- [ ] Note any unexpected behaviors
- [ ] Time each interaction (should be <3 minutes per booking)
- [ ] Take screenshots of confirmation emails

### After Each Test
- [ ] Mark scenario as PASS or FAIL
- [ ] If FAIL, describe exactly what went wrong
- [ ] Note any confusing voice prompts or unclear instructions
- [ ] Rate experience 1-5 stars

### UAT Test Report Template

```
Test Scenario: [e.g., "Basic Appointment Booking"]
Participant: [Name]
Date: [Date]
Duration: [Time taken]

Result: ✅ PASS / ❌ FAIL

Issues Found:
1. [Description of issue]
2. [How it affected user experience]

Recommendations:
- [Suggested improvement]

Overall Impression:
[User feedback on the system]

Rating: ⭐⭐⭐⭐☆ (4/5)
```

---

## Part 4: Monitoring During UAT

### Real-Time Dashboards

#### Dashboard 1: Booking Success Rate
```
Successful Bookings: 14/15 (93%)
Failed Attempts: 1
Average Latency: 243ms
Peak Latency: 389ms (still <500ms)
```

#### Dashboard 2: Error Breakdown
```
Conflicts (expected): 2
Invalid Dates: 0
Provider Not Found: 0
Database Errors: 0
JWT Failures: 0
```

#### Dashboard 3: Voice Agent Performance
```
Average Call Duration: 2m 30s (target: <5m)
User Satisfaction: 4.3/5
Completion Rate: 87%
Agent Clarity: 4.5/5
```

### Logs to Monitor

```bash
# Real-time booking logs
tail -f logs/vapi-bookings.log | grep "appointment_created\|conflict_detected\|error"

# JWT validation logs
grep "JWT.*failed\|JWT.*expired" logs/auth.log

# Database latency
grep "query_time_ms" logs/database.log | awk '{sum+=$NF; count++} END {print "Avg:", sum/count "ms"}'

# Error summary
grep "ERROR\|WARN" logs/*.log | wc -l
```

---

## Part 5: Success Criteria & Go/No-Go Decision

### Go to Production Criteria (ALL REQUIRED)

✅ **Booking Success Rate**
- Target: ≥95%
- Formula: (Successful Bookings / Total Attempts) × 100

✅ **Latency**
- Target: <500ms (95th percentile)
- Measured by: `latency_ms` field in response

✅ **Error Handling**
- Target: 0 unhandled exceptions
- Measured by: 0 database errors, 0 crashes

✅ **Multi-Tenant Isolation**
- Target: 100% (no data leaks)
- Test: Clinic A cannot see Clinic B data

✅ **Concurrent Bookings**
- Target: Exactly 1 success per slot
- Test: 5 simultaneous requests → 1 success, 4 conflicts

✅ **User Satisfaction**
- Target: ≥4.0/5 stars
- Measured by: UAT participant feedback

✅ **Email Delivery**
- Target: 100% within 30 seconds
- Measured by: Confirmation emails received

### No-Go Scenarios (STOP deployment if any occur)

❌ **System Crash**
- Any unhandled exception or 500 error

❌ **Data Corruption**
- Duplicate appointments created
- Lost or corrupted booking records
- Cross-clinic data leakage

❌ **Security Breach**
- JWT validation bypassed
- Org_id isolation violated
- Unauthorized access to provider data

❌ **Performance Degradation**
- Latency >1 second consistently
- Timeouts or request failures

---

## Part 6: Deployment Timeline

### UAT Phase 1: Controlled Testing (1 day)
- **When:** [Date]
- **Participants:** 3-5 internal testers
- **Scenarios:** All 5 scenarios, each run 3 times
- **Monitoring:** Close watch on logs, immediate feedback

### UAT Phase 2: Extended Testing (2-3 days)
- **When:** [Date]
- **Participants:** 10-20 clinic staff members
- **Scenarios:** Real-world usage patterns
- **Monitoring:** Dashboard tracking, hourly reports

### Final Review Meeting (1 day)
- **When:** [Date]
- **Attendees:** QA lead, product owner, engineering lead
- **Decision:** Go or No-Go to production

### Production Deployment (if Go approved)
- **Date:** [Date]
- **Rollout:** Gradual (10% → 50% → 100% traffic)
- **Monitoring:** 24/7 dashboard, on-call support

---

## Part 7: Post-Launch Monitoring

### First 24 Hours (Critical Watch)
- **Check Every Hour:**
  - Booking success rate (target: ≥95%)
  - Error rate (target: <1%)
  - Average latency (target: <400ms)
  - Zero crashes or data corruption

### First Week
- **Daily Reports:**
  - Total bookings processed
  - Success rate trend
  - Top errors (if any)
  - User feedback summary

### First Month
- **Weekly Reviews:**
  - System stability assessment
  - Performance optimization opportunities
  - Feature improvement requests

---

## Part 8: Rollback Plan

If critical issues emerge post-launch:

```bash
# Option 1: Disable Vapi integration (immediate)
curl -X POST https://api.callwaiting.ai/admin/disable-vapi-booking

# Option 2: Rollback to previous version (5 mins)
git checkout v5.9.0
npm run deploy:production
# Patients can still book via web/phone, just not voice

# Option 3: Scale down (gradual)
kubectl scale deployment vapi-handler --replicas=0
# All Vapi calls fail gracefully, users directed to alternative booking
```

---

## Summary

**Deliverables for UAT:**
1. ✅ Staging environment with test data
2. ✅ Vapi agent configured and ready
3. ✅ 5 detailed test scenarios
4. ✅ Success criteria and go/no-go checklist
5. ✅ Real-time monitoring dashboards
6. ✅ Participant feedback templates
7. ✅ Rollback procedures

**Timeline to Production:**
- Staging setup: 1 day
- UAT execution: 3 days
- Analysis & fixes: 1 day
- Production deployment: 1 day
- **Total: 6 days**

**Status: 🟢 READY FOR STAGING DEPLOYMENT**
