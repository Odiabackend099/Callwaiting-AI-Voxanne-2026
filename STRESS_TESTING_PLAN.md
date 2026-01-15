# Multi-Agent Orchestration Stress Testing Plan

**Date:** 14 January 2026  
**Framework:** CallWaiting AI - Full-Stack Orchestrator  
**Objective:** Validate autonomous multi-agent system under stress conditions

---

## Executive Summary

This document outlines a comprehensive stress testing strategy for the CallWaiting AI multi-agent orchestration system. The tests verify that:

1. **Manager Agent** (Supabase Edge Functions) correctly orchestrates Worker Agents
2. **Voice Agent** (Vapi) handles real-time conversational streams
3. **Brain** (RAG + LLM) respects medical guardrails and knowledge boundaries
4. **Integration Points** (SMS, Calendar, Database) coordinate without state failures
5. **Security** (PII redaction, clinic isolation, RLS policies) prevent data leaks

---

## Test Framework Architecture

```
┌─────────────────────────────────────────────────────────┐
│         MULTI-AGENT ORCHESTRATION TEST SUITE            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Cross-      │  │  Atomic      │  │  PII Leak &  │   │
│  │  Channel     │  │  Collision   │  │  Redaction   │   │
│  │  Booking     │  │  (Race Cond) │  │  Audit       │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Multi-Clinic│  │  Knowledge   │  │  State       │   │
│  │  Data Silo   │  │  Base        │  │  Management  │   │
│  │  (RLS Tests) │  │  Accuracy    │  │  Consistency │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  JSON + HTML Report Generation                       │ │
│  │  (Metrics, Coverage, Pass/Fail Status)               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Test Case 1: Cross-Channel Booking Flow

### Objective
Verify that when a patient calls via Vapi and hangs up mid-booking, the system:
- Persists incomplete booking state to Supabase
- Triggers automated SMS follow-up via Twilio
- Updates status from `In-Progress` to `Abandoned-Followup`
- Recognizes held calendar slot when patient clicks SMS link

### Test Scenario
```
1. Patient calls → Vapi initiates call
2. Call progresses to booking phase (slot selection shown)
3. Patient hangs up mid-conversation
4. System detects hang-up event
5. Supabase receives webhook: call ended, status = abandoned
6. SMS service triggered with recovery link
7. Patient clicks link in SMS
8. Calendar slot is recognized as "held" from previous call
9. Booking can be completed without re-selecting time
```

### Test Steps

**Step 1: Initiate Call**
```
POST /api/vapi/calls/initiate
{
  "orgId": "org_clinic_001",
  "phoneNumber": "+12025551234",
  "patientId": "patient_123",
  "assistantId": "asst_clinic1_inbound_001"
}
```

Expected Response:
```json
{
  "callId": "call_<timestamp>_001",
  "status": "in-progress",
  "timestamp": "2026-01-14T10:00:00Z"
}
```

**Step 2: Simulate Mid-Call Hang-up**
```
POST /api/vapi/webhook/end-of-call
{
  "message": {
    "type": "end-of-call-report",
    "call": {
      "id": "call_<timestamp>_001",
      "status": "ended",
      "duration": 45,  // Hung up mid-conversation
      "reason": "customer-ended"
    },
    "transcript": "Customer: I want to book... <cuts off>",
    "analysis": {
      "sentiment": "neutral",
      "intent": "booking_inquiry"
    }
  }
}
```

**Step 3: Verify Supabase State**
```sql
SELECT * FROM calls 
WHERE id = 'call_<timestamp>_001'
AND org_id = 'org_clinic_001';
```

Expected Result:
```
status: "abandoned"
reason: "customer-ended"
booking_status: "incomplete"
slot_held_until: "2026-01-14T10:30:00Z"  -- 30 min hold
transcript_preview: "Customer: I want to book..."
metadata: { incomplete_slot: "2026-01-15 10:00" }
```

**Step 4: Trigger SMS Follow-up**
```
POST /api/sms/send-followup
{
  "callId": "call_<timestamp>_001",
  "orgId": "org_clinic_001",
  "patientId": "patient_123"
}
```

**Step 5: Verify SMS Sent**
```
GET /api/sms/history?patientId=patient_123&limit=1
```

Expected Response:
```json
{
  "sent": true,
  "to": "+1<patient_phone>",
  "message": "Hi! We were connecting about your appointment. Complete your booking here: <link>",
  "sentAt": "2026-01-14T10:01:00Z"
}
```

**Step 6: Click SMS Link**
```
GET /api/booking/resume?token=<sms_token>&callId=call_<timestamp>_001
```

**Step 7: Verify Slot is Held**
```json
{
  "slotHeld": true,
  "heldUntil": "2026-01-14T10:30:00Z",
  "originalSlot": "2026-01-15 10:00 AM",
  "action": "customer can complete booking directly"
}
```

### Success Criteria
- ✅ Supabase status transitions: `in-progress` → `abandoned` → `follow-up-sent`
- ✅ SMS triggered within 5 seconds of hang-up
- ✅ Calendar slot marked as "held" for 30 minutes
- ✅ No data loss between Vapi → Supabase → SMS
- ✅ Resume link correctly maps to original call context

### Failure Scenarios to Test
- ❌ SMS fails to send (Twilio quota exceeded)
- ❌ Supabase offline during webhook
- ❌ Slot holder expires before SMS sent
- ❌ Patient clicks link after slot hold expires

---

## Test Case 2: Atomic Collision (Race Condition)

### Objective
Verify that concurrent booking requests for the same slot are handled atomically:
- Only ONE request succeeds (200 OK)
- All others fail (409 Conflict)
- Voice Agent pivots gracefully: "That slot was just taken, how about..."

### Test Scenario
```
5 simultaneous calls to same clinic
↓
All 5 patients select 10:00 AM slot
↓
5 concurrent claim_slot_atomic RPC calls
↓
Database lock prevents double-booking
↓
Only 1 succeeds, others get 409 Conflict
↓
Voice Agent detects conflict and suggests alternatives
```

### Test Implementation

**Setup: Create 5 concurrent booking requests**
```typescript
const slotToBook = "2026-01-15 10:00 AM";
const orgId = "org_clinic_001";
const concurrentRequests = 5;

const promises = Array.from({ length: concurrentRequests }).map((_, i) =>
  fetch('/api/booking/claim-slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId,
      slotTime: slotToBook,
      patientId: `patient_${i}`,
      callId: `call_${i}`,
      timestamp: Date.now()
    })
  })
);

const results = await Promise.all(promises);
```

**Expected Outcomes:**
```javascript
results = [
  { status: 200, slotBooked: true, patientId: 'patient_0' },
  { status: 409, error: 'Slot already claimed', patientId: 'patient_1' },
  { status: 409, error: 'Slot already claimed', patientId: 'patient_2' },
  { status: 409, error: 'Slot already claimed', patientId: 'patient_3' },
  { status: 409, error: 'Slot already claimed', patientId: 'patient_4' }
]
```

**Verify Database State:**
```sql
SELECT * FROM appointment_slots 
WHERE slot_time = '2026-01-15 10:00 AM'
AND org_id = 'org_clinic_001'
AND status = 'booked';
```

Expected: Exactly 1 row (no duplicates)

**Verify Voice Agent Behavior:**
```
Patient 1: "Great! I've booked you for 10:00 AM on January 15th."
Patient 2-5: "I'm sorry, that slot was just taken. How about 10:30 AM instead?"
```

### Success Criteria
- ✅ Exactly 1 booking succeeds per concurrent attempt
- ✅ Other 4 receive 409 Conflict
- ✅ No double-bookings in database
- ✅ Voice Agent detects failure and offers alternatives
- ✅ Alternative slots presented within 2 seconds
- ✅ Execution time: <500ms per request

### Stress Variations
- 10 concurrent requests
- 50 concurrent requests
- 100 concurrent requests
- Different time slots (10 AM, 2 PM, 4 PM simultaneously)

---

## Test Case 3: PII Leak & Redaction Audit

### Objective
Verify that sensitive patient data is redacted according to GDPR compliance:
- Medical concerns masked unless `GDPR_CONSENT = TRUE`
- Names redacted in logs by default
- Phone numbers masked in non-essential logs
- Vapi raw logs don't leak PII to Supabase

### Test Scenario
```
Patient Call Transcript:
  "My name is John Smith, my phone is 555-1234, 
   I have a scar from a previous rhinoplasty surgery."

Vapi Raw Logs:
  [UNREDACTED] - stored in Vapi's system

Supabase Stored Record:
  [REDACTED] - medical concern masked
```

### Test Implementation

**Step 1: Initiate Call with Sensitive Data**
```
Customer: "Hi, my name is John Smith, I'm at 555-123-4567"
Assistant: "Nice to meet you, John. What brings you in today?"
Customer: "I have a previous rhinoplasty scar and want to know about revision surgery"
```

**Step 2: Capture Both Logs**

Vapi Raw Webhook:
```json
{
  "callId": "call_sensitive_001",
  "transcript": "John Smith...555-1234...previous rhinoplasty scar...",
  "gdprConsent": false
}
```

**Step 3: Verify Supabase Storage**
```sql
SELECT transcript, summary, metadata 
FROM calls 
WHERE id = 'call_sensitive_001'
AND org_id = 'org_clinic_001';
```

Expected:
```
transcript: "[REDACTED_NAME] at [REDACTED_PHONE] wants to discuss [REDACTED_MEDICAL]"
summary: "Patient inquired about rhinoplasty-related procedure"
metadata: {
  gdpr_consent: false,
  has_redacted_fields: true,
  redaction_timestamp: "2026-01-14T10:00:00Z"
}
```

**Step 4: Test GDPR Consent Override**
```
If gdprConsent = true:
transcript: "John Smith at 555-1234 wants to discuss previous rhinoplasty scar"
If gdprConsent = false:
transcript: "[REDACTED_NAME] at [REDACTED_PHONE] wants to discuss [REDACTED_MEDICAL]"
```

**Step 5: Verify Redaction Service Coverage**
```
Patterns to Test:
✅ Email: "john@example.com" → "[REDACTED_EMAIL]"
✅ Phone: "555-123-4567" → "[REDACTED_PHONE]"
✅ Address: "123 Main St, NYC" → "[REDACTED_ADDRESS]"
✅ SSN: "123-45-6789" → "[REDACTED_SSN]"
✅ Medical: "scar", "surgery", "rhinoplasty" → "[REDACTED_MEDICAL]"
✅ Names: "John", "Smith" → "[REDACTED_NAME]"
```

### Success Criteria
- ✅ All PII patterns detected and redacted
- ✅ GDPR consent flag respected
- ✅ Vapi logs remain unredacted (raw)
- ✅ Supabase logs properly redacted
- ✅ Audit trail shows redaction timestamp
- ✅ No plaintext sensitive data in logs

### Failure Scenarios
- ❌ Medical concerns leaked to non-GDPR consented records
- ❌ Phone numbers visible in customer-facing logs
- ❌ Redaction service fails silently
- ❌ GDPR consent flag not honored

---

## Test Case 4: Multi-Clinic Data Silo (RLS Enforcement)

### Objective
Verify that Row Level Security (RLS) policies prevent cross-clinic data leakage:
- Clinic A patient cannot see Clinic B's doctors
- Clinic A assistant cannot access Clinic B's knowledge base
- AI doesn't hallucinate cross-clinic information

### Test Scenario
```
Call to: Clinic A phone line
Request: "Tell me about Dr. Johnson from your clinic"
Clinic A has: Dr. Sarah (Dermatologist)
Clinic B has: Dr. Johnson (Surgeon) ← Should NOT be accessible

Expected Response:
"We don't have a Dr. Johnson on staff. 
 Our specialist is Dr. Sarah. Would you like to schedule with her?"

NOT Expected:
"Dr. Johnson is our surgeon..." ← Would indicate data leak
```

### Test Implementation

**Setup: Create Two Clinic Contexts**
```javascript
const clinicA = {
  id: 'org_clinic_001',
  name: 'Premier Cosmetic Surgery',
  doctors: [
    { id: 'doc_001', name: 'Dr. Sarah', specialty: 'Dermatology' }
  ]
};

const clinicB = {
  id: 'org_clinic_002',
  name: 'Advanced Aesthetic Clinic',
  doctors: [
    { id: 'doc_002', name: 'Dr. Johnson', specialty: 'Surgery' }
  ]
};
```

**Test 1: Query Cross-Clinic Doctor**
```
Clinic A Call:
  User: "Can I see Dr. Johnson?"
  
Supabase RLS Query:
  SELECT * FROM doctors 
  WHERE org_id = 'org_clinic_001'  -- Only Clinic A
  AND name LIKE '%Johnson%'
  
Expected: 0 rows (Dr. Johnson is in Clinic B)

Voice Response: "We don't have Dr. Johnson available..."
```

**Test 2: Verify Knowledge Base Isolation**
```
Clinic A KB documents (uploaded PDFs):
  - Dermatology procedures (facelift, laser)
  
Clinic B KB documents:
  - Surgical procedures (rhinoplasty, augmentation)

Call to Clinic A asking about rhinoplasty:
  Q: "What's your recovery time for rhinoplasty?"
  
Expected: Generic response (not from KB, not Clinic B's docs)
NOT Expected: Clinic B's surgical recovery details
```

**Test 3: RLS Policy Enforcement**
```sql
-- Test as Clinic A user
SELECT * FROM doctors 
WHERE org_id = current_setting('app.current_org_id')  
-- current_org_id = 'org_clinic_001'
-- Result: Only 1 doctor (Dr. Sarah)

-- Attempt to bypass:
SELECT * FROM doctors 
WHERE org_id = 'org_clinic_002'
-- Result: DENIED by RLS policy
-- PostgreSQL: "new row violates row level security policy"
```

### Success Criteria
- ✅ Cross-clinic doctors not visible in queries
- ✅ AI doesn't hallucinate cross-clinic information
- ✅ Knowledge base filtered by org_id
- ✅ RLS policy actively blocks unauthorized access
- ✅ Voice response indicates "not available" not "doesn't exist"
- ✅ Audit logs show RLS denials

### Failure Scenarios
- ❌ AI retrieves Clinic B doctor info
- ❌ RLS policy not enforced (all clinics see all data)
- ❌ Knowledge base bleeds across clinics
- ❌ Cross-org credential access

---

## Test Case 5: Knowledge Base Accuracy (Niche Procedures)

### Objective
Verify that the system retrieves accurate surgical knowledge from the KB PDF:
- Liquid Rhinoplasty is recognized (niche procedure)
- Recovery time is pulled from KB, not generic LLM
- Responses match the "Surgical-Grade" procedure list
- Alternative names are recognized (nose job = rhinoplasty)

### Test Scenario
```
Question: "What's the recovery time for liquid rhinoplasty?"

WITHOUT KB: 
  "Liquid rhinoplasty typically has 1-2 days recovery..." (generic)

WITH KB (Expected):
  "Liquid rhinoplasty at our clinic involves injectable fillers 
   with immediate results. Recovery: no downtime, minor swelling 
   resolves in 24-48 hours. Cost: $2,500-3,500." 
   (from uploaded PDF)
```

### Test Implementation

**Setup: Upload Sample KB PDF**
```
Procedure Database (from clinic's uploaded PDF):
  
1. Facelift
   - Traditional surgical facelift
   - Recovery: 2-4 weeks
   - Cost: £12,000-£15,000
   
2. Rhinoplasty
   - Surgical nose reshaping
   - Recovery: 2-3 weeks
   - Cost: £8,000-£10,000
   
3. Liquid Rhinoplasty (NICHE - Tests if KB is used)
   - Non-surgical injectable rhinoplasty
   - Recovery: No downtime
   - Cost: £2,500-£3,500
   - Alternative names: "filler rhinoplasty", "liquid nose job"

4. Breast Augmentation
   - Surgical breast implant placement
   - Recovery: 1-2 weeks
   - Cost: £7,000-£9,000
```

**Test 1: Query Niche Procedure**
```
Q: "How much does liquid rhinoplasty cost at your clinic?"

Check Response Contains:
  ✅ Cost: £2,500-£3,500 (matches PDF)
  ✅ Recovery: No downtime (matches PDF)
  ✅ Mentions "injectable fillers" (KB-specific detail)
  
NOT Expected:
  ❌ "Most liquid rhinoplasties cost $X" (generic LLM response)
  ❌ Generic response without price quote
  ❌ "We don't offer that" (KB has it)
```

**Test 2: Alternative Name Recognition**
```
Q: "Can I get a liquid nose job?"

Expected:
  - System recognizes "liquid nose job" = "liquid rhinoplasty"
  - Returns KB info for liquid rhinoplasty
  - NOT confused with surgical rhinoplasty
```

**Test 3: Recovery Time Accuracy**
```
Q: "How long is recovery after liquid rhinoplasty?"

Expected (from KB PDF):
  "No downtime. Minor swelling resolves in 24-48 hours."

NOT Expected (generic LLM):
  "Typically 1-2 weeks recovery..." (That's for surgical)
```

**Test 4: Verify KB is Used vs LLM**
```
Procedure: "Quantum Nose Reconstruction" (doesn't exist in KB)

Expected: 
  AI defers to generic response
  "I don't have specific information about that procedure."

NOT Expected:
  AI hallucinates details about imaginary procedure
```

### Success Criteria
- ✅ Niche procedures (liquid rhinoplasty) recognized
- ✅ KB prices match procedure list exactly
- ✅ Recovery times are accurate per KB
- ✅ Alternative names map correctly
- ✅ Unknown procedures return "We don't offer that"
- ✅ Response includes KB source attribution
- ✅ Vector similarity search >0.75 for relevant procedures

### Failure Scenarios
- ❌ Liquid rhinoplasty not recognized
- ❌ Generic recovery time instead of KB time
- ❌ AI hallucinates unknown procedures
- ❌ Alternative names not mapped
- ❌ Wrong cost quoted

---

## Test Execution Framework

### Implementation Technology
```
Language: TypeScript/Node.js
Framework: Jest + Supertest (HTTP testing)
Database: Supabase mock + real test database
Queue: Bull/BullMQ for async task simulation
Reporting: JSON + HTML generation
```

### Test Runner Script
```typescript
// stress-tests.ts
import { runCrossChannelTest } from './tests/cross-channel';
import { runAtomicCollisionTest } from './tests/atomic-collision';
import { runPIIAuditTest } from './tests/pii-audit';
import { runClinicSiloTest } from './tests/clinic-silo';
import { runKBAccuracyTest } from './tests/kb-accuracy';
import { generateReport } from './reporting/report-generator';

async function runAllStressTests() {
  const results = [];
  
  console.log('🚀 Starting Multi-Agent Orchestration Stress Tests\n');
  
  // Run each test in sequence
  results.push(await runCrossChannelTest());
  results.push(await runAtomicCollisionTest());
  results.push(await runPIIAuditTest());
  results.push(await runClinicSiloTest());
  results.push(await runKBAccuracyTest());
  
  // Generate reports
  const report = generateReport(results);
  
  return report;
}

// Execute
runAllStressTests().then(report => {
  console.log('\n✅ Stress Test Complete');
  console.log(`📊 Report: ${report.jsonPath}`);
  console.log(`📈 HTML: ${report.htmlPath}`);
});
```

### Report Format

**JSON Report:**
```json
{
  "timestamp": "2026-01-14T10:00:00Z",
  "environment": "staging",
  "duration": "4m 32s",
  "tests": [
    {
      "id": "cross-channel-001",
      "name": "Cross-Channel Booking Flow",
      "status": "PASS",
      "duration": "45s",
      "assertions": {
        "total": 12,
        "passed": 12,
        "failed": 0
      },
      "metrics": {
        "smsLatency": "2.3s",
        "dbUpdateLatency": "0.8s",
        "slotHoldDuration": "30m"
      }
    },
    // ... more tests
  ],
  "summary": {
    "total": 5,
    "passed": 5,
    "failed": 0,
    "coverage": "98.5%"
  }
}
```

**HTML Report:**
```html
<html>
  <head><title>Stress Test Report</title></head>
  <body>
    <h1>Multi-Agent Orchestration Stress Tests</h1>
    <p>Date: 2026-01-14T10:00:00Z</p>
    
    <div class="summary">
      <h2>Summary: 5/5 PASSED ✅</h2>
      <p>Coverage: 98.5%</p>
      <p>Duration: 4m 32s</p>
    </div>
    
    <div class="test-results">
      <!-- Test results cards -->
    </div>
  </body>
</html>
```

---

## Success Metrics

| Metric | Target | Threshold |
|--------|--------|-----------|
| **Test Pass Rate** | 100% | ≥95% |
| **Concurrent Booking** | 100% atomic | No double-books |
| **SMS Latency** | <5s | <10s |
| **Voice Pivot Time** | <2s | <5s |
| **PII Redaction** | 100% | No leaks |
| **Clinic Isolation** | 100% | Zero data bleeds |
| **KB Accuracy** | 100% match | >95% match |
| **Coverage** | >95% | >85% |

---

## Next Steps

1. **Phase 1:** Create test framework scaffolding
2. **Phase 2:** Implement test cases 1-2 (cross-channel, atomic)
3. **Phase 3:** Implement test cases 3-5 (PII, isolation, KB)
4. **Phase 4:** Create reporting infrastructure
5. **Phase 5:** Run full suite and analyze results

---

**Status:** ✅ PLAN COMPLETE  
**Ready for Implementation:** YES
