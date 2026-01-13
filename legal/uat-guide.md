# User Acceptance Testing (UAT) Guide

## CallWaiting AI - Pilot Clinic Testing Protocol

---

## Overview

**Purpose:** Validate that CallWaiting AI solves real clinic problems before full launch  
**Duration:** 7-day pilot  
**Participants:** Clinic staff, patients (real calls)  
**Success Criteria:** 90%+ satisfaction, 1+ confirmed booking, zero critical bugs

---

## Pre-UAT Checklist

### Technical Setup

- [ ] Backend deployed and running
- [ ] Twilio number configured
- [ ] Vapi assistant activated
- [ ] Google Calendar connected
- [ ] Test calls completed successfully

### Clinic Preparation

- [ ] Pilot agreement signed
- [ ] Staff trained on dashboard
- [ ] Escalation process defined
- [ ] Feedback form shared
- [ ] Success metrics agreed

---

## UAT Scenarios

### Scenario 1: New Patient Booking (Happy Path)

**User Story:** "As a new patient, I want to book a consultation quickly without waiting on hold."

**Test Steps:**

1. Patient calls clinic number
2. Voxanne answers within 2 seconds
3. Patient requests consultation
4. Voxanne checks availability
5. Patient selects time slot
6. Patient provides contact info
7. OTP sent and verified
8. Booking confirmed

**Success Criteria:**

- [ ] Call answered within 2 seconds
- [ ] Natural conversation flow
- [ ] Correct slot offered
- [ ] OTP received within 30 seconds
- [ ] Booking appears in calendar
- [ ] Confirmation SMS sent

**User Feedback Questions:**

- Did Voxanne sound natural and professional?
- Was the booking process easy to follow?
- Would you use this service again?

---

### Scenario 2: Abandoned Call Recovery

**User Story:** "As a busy patient, I want to receive follow-up if I hang up before booking."

**Test Steps:**

1. Patient calls and mentions service interest (e.g., "facelift")
2. Patient provides phone number
3. Patient hangs up before OTP
4. System detects abandoned call
5. SMS sent within 5 minutes
6. SMS includes service-specific PDF link

**Success Criteria:**

- [ ] Abandoned call detected
- [ ] Follow-up SMS sent within 5 minutes
- [ ] Correct service mentioned in SMS
- [ ] PDF link works
- [ ] Patient can click to reschedule

**User Feedback Questions:**

- Was the follow-up SMS helpful?
- Did the PDF answer your questions?
- Would you prefer a call back instead?

---

### Scenario 3: Concurrent Booking Conflict

**User Story:** "As a clinic, I want to ensure two patients can't book the same slot."

**Test Steps:**

1. Two patients call simultaneously
2. Both request same time slot
3. First patient gets slot
4. Second patient offered alternative
5. Both bookings processed correctly

**Success Criteria:**

- [ ] Only one booking succeeds
- [ ] Second patient offered next available slot
- [ ] No double-booking in calendar
- [ ] Both patients satisfied with outcome

**User Feedback Questions:**

- (For clinic) Did you see any double-bookings?
- (For patient 2) Was the alternative slot acceptable?

---

### Scenario 4: Complex Query Handling

**User Story:** "As a patient, I want to ask questions about procedures before booking."

**Test Steps:**

1. Patient asks about pricing
2. Patient asks about recovery time
3. Patient asks about surgeon qualifications
4. Voxanne provides accurate answers
5. Patient proceeds to book or requests callback

**Success Criteria:**

- [ ] Accurate answers from knowledge base
- [ ] Natural conversation flow
- [ ] Appropriate escalation if needed
- [ ] Patient satisfied with information

**User Feedback Questions:**

- Did Voxanne answer your questions accurately?
- Was any information missing?
- Would you have preferred to speak to a human?

---

### Scenario 5: After-Hours Call

**User Story:** "As a patient calling after hours, I want to book an appointment without waiting until morning."

**Test Steps:**

1. Patient calls at 10 PM
2. Voxanne answers (24/7)
3. Patient books next-day appointment
4. Confirmation sent immediately

**Success Criteria:**

- [ ] Call answered after hours
- [ ] Booking process identical to business hours
- [ ] Confirmation received immediately
- [ ] Clinic staff notified next morning

**User Feedback Questions:**

- Were you surprised the AI answered after hours?
- Did this save you time?
- Would you recommend this to others?

---

## Daily UAT Checklist

### Morning (9 AM)

- [ ] Check overnight calls in dashboard
- [ ] Review any escalations
- [ ] Verify calendar sync
- [ ] Check for system errors

### Midday (1 PM)

- [ ] Review morning call metrics
- [ ] Check patient feedback
- [ ] Test knowledge base accuracy
- [ ] Verify SMS delivery

### Evening (5 PM)

- [ ] Review full day metrics
- [ ] Document any issues
- [ ] Update feedback log
- [ ] Plan next day tests

---

## Metrics to Track

### Quantitative

- Total calls answered: _____
- Bookings confirmed: _____
- Abandoned calls: _____
- Follow-up SMS sent: _____
- Average call duration: _____
- OTP success rate: _____
- System uptime: _____

### Qualitative

- Patient satisfaction (1-10): _____
- Staff satisfaction (1-10): _____
- Conversation naturalness (1-10): _____
- Knowledge accuracy (1-10): _____

---

## Feedback Collection

### Patient Feedback Form

**After each call, send SMS:**
"Thank you for calling [Clinic Name]. Please rate your experience: [Link]"

**Questions:**

1. How natural did Voxanne sound? (1-10)
2. Was the booking process easy? (Yes/No)
3. Would you use this again? (Yes/No)
4. Any suggestions for improvement? (Text)

### Clinic Staff Feedback

**Daily check-in:**

1. Any technical issues today?
2. Any patient complaints?
3. Any missed bookings?
4. Suggestions for improvement?

---

## Issue Escalation

### Critical (Immediate)

- System down
- Double-booking occurred
- Patient data leak
- **Action:** Call support immediately

### Major (Within 4 hours)

- OTP not received
- Calendar sync failed
- Knowledge base inaccurate
- **Action:** Email support with details

### Minor (Within 24 hours)

- Awkward phrasing
- Slow response time
- UI suggestion
- **Action:** Log in feedback form

---

## Success Criteria

### Minimum Viable Success

- [ ] 50+ calls answered
- [ ] 1+ confirmed booking
- [ ] Zero critical bugs
- [ ] 70%+ patient satisfaction

### Pilot Success

- [ ] 100+ calls answered
- [ ] 5+ confirmed bookings
- [ ] Zero double-bookings
- [ ] 80%+ patient satisfaction
- [ ] 90%+ staff satisfaction

### Exceptional Success

- [ ] 200+ calls answered
- [ ] 10+ confirmed bookings
- [ ] 100% uptime
- [ ] 90%+ patient satisfaction
- [ ] Clinic requests full deployment

---

## Post-UAT Actions

### If Successful

1. Schedule full deployment
2. Create case study
3. Request testimonial
4. Plan expansion to other clinics

### If Issues Found

1. Document all bugs
2. Prioritize fixes
3. Schedule follow-up pilot
4. Update training materials

---

## UAT Completion Report Template

**Pilot Clinic:** _____________________  
**Dates:** _____ to _____  
**Total Calls:** _____  
**Bookings:** _____  
**Satisfaction:** _____/10  

**Key Wins:**
-

-
-

**Issues Found:**
-

-
-

**Recommendations:**
-

-
-

**Decision:** [ ] Deploy  [ ] Fix & Retry  [ ] Cancel

---

## Contact Information

**Technical Support:** <support@callwaiting.ai>  
**Emergency:** [Phone Number] (24/7)  
**Feedback:** <feedback@callwaiting.ai>

---

**Remember:** UAT is about validating real-world use, not perfect performance. Document everything, listen to users, and iterate quickly.
