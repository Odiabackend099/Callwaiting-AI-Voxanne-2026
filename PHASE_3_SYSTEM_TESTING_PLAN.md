# 📋 Phase 3: System Testing - Master Orchestrator Validation

**Status:** Planning Phase  
**Date:** 14 January 2026  
**Scope:** End-to-end integration testing of multi-agent orchestration  
**Reference:** Master Orchestrator Build & Test Prompt

---

## Phase 3 Overview

After unit testing (Phase 1) and stress testing (Phase 2), Phase 3 validates the **complete system** working together:
- Vapi (Voice AI)
- Supabase (State Management)
- Google Calendar (Slot Management)
- SMS notifications (Twilio)
- Knowledge Base (Vector search)

---

## Step 1: Planning - The 5 Master Orchestrator Tasks

### Task 1: Atomic Slot Locking ✅

**Problem Solved:** Prevent double-booking when multiple patients try same slot simultaneously

**Code Requirement:**
```sql
-- Supabase RPC: claim_slot_atomic
CREATE OR REPLACE FUNCTION claim_slot_atomic(
  p_slot_id UUID,
  p_patient_id UUID,
  p_clinic_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_slot RECORD;
  v_result JSONB;
BEGIN
  -- Pessimistic lock: SELECT FOR UPDATE
  SELECT * INTO v_slot FROM calendar_slots
  WHERE id = p_slot_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  -- Check if already claimed
  IF v_slot.claimed_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 409,
      'error', 'Slot already claimed',
      'message', 'Sorry, that slot was just taken. How about these alternatives?'
    );
  END IF;

  -- Claim the slot
  UPDATE calendar_slots
  SET claimed_by = p_patient_id, claimed_at = NOW()
  WHERE id = p_slot_id;

  RETURN jsonb_build_object(
    'status', 200,
    'success', true,
    'slotId', p_slot_id,
    'claimedAt', NOW()
  );
END;
$$ LANGUAGE plpgsql;
```

**Test Specification:**
- Simulate 5 concurrent API calls to same slot
- Exactly 1 call returns success (200)
- Exactly 4 calls return conflict (409)
- Database contains only 1 booking

**Success Metric:**
```
Request 1: ✅ 200 OK (winner)
Request 2: ❌ 409 Conflict
Request 3: ❌ 409 Conflict
Request 4: ❌ 409 Conflict
Request 5: ❌ 409 Conflict

Database state: 1 booking, no duplicates
```

---

### Task 2: Contextual Memory Hand-off 🔄

**Problem Solved:** Auto-follow-up when patient hangs up mid-booking

**Webhook Trigger:**
```json
{
  "eventType": "call_ended",
  "callId": "call_xyz_123",
  "voxanAgentId": "voxan_001",
  "patientPhone": "+1-202-555-1234",
  "patientName": "Jane Doe",
  "leadId": "lead_xyz_789",
  "keyword": "Rhinoplasty",
  "bookingConfirmed": false,
  "callDuration": 245,
  "transcript": "interested in rhinoplasty... hung up"
}
```

**Logic Required:**
```
IF (call_ended AND booking_confirmed == false AND keyword != null) THEN
  CREATE lead_followup WITH (
    leadId: leadId,
    procedure: keyword,
    channel: "SMS",
    template: "rhinoplasty-guide",
    assignedAgent: "sarah_outbound"
  )
  TRIGGER sms_send()
END IF
```

**Procedure-Specific PDF Links:**
- Rhinoplasty → `/guides/rhinoplasty-guide.pdf`
- Liquid Rhinoplasty → `/guides/liquid-rhino-guide.pdf`
- Facelift → `/guides/facelift-guide.pdf`
- Breast Augmentation → `/guides/breast-aug-guide.pdf`

**SMS Template Example:**
```
Hi {{patientName}}, 

Thanks for chatting with us about {{procedure}}! 
We know you were busy, so here's your guide to review:
{{pdfLink}}

Let's schedule your consultation:
{{bookingLink}}

- Sarah from [Clinic Name]
```

**Test Specification:**
- Patient hangs up during booking
- Webhook triggered within 2 seconds
- SMS sent within 5 seconds
- Correct PDF attached for procedure
- Lead tracked for follow-up

**Success Metric:**
```
Event: call_ended (booking_confirmed=false, procedure="rhinoplasty")
  ✅ Lead created in database
  ✅ SMS sent to patient phone
  ✅ Correct PDF link included
  ✅ Agent assignment: sarah_outbound
  ✅ Execution time: <5 seconds
```

---

### Task 3: Security & Compliance Redline Test 🔒

**Problem Solved:** Protect sensitive data per GDPR requirements

**NER (Named Entity Recognition) Implementation:**
```typescript
// Detect and classify PII
interface DetectedEntity {
  type: 'email' | 'phone' | 'ssn' | 'address' | 'medical' | 'name';
  value: string;
  confidence: number;
  startPos: number;
  endPos: number;
}

// Example input:
// "My address is 123 Harley Street and I have a history of heart issues"

// Expected output:
{
  entities: [
    { type: 'address', value: '123 Harley Street', table: 'contacts' },
    { type: 'medical', value: 'heart issues', table: 'clinical_notes' }
  ]
}
```

**Routing Rules:**
| Entity Type | Storage Location | Encryption | Audit Trail |
|-------------|------------------|------------|-------------|
| Email | contacts | None | Yes |
| Phone | contacts | None | Yes |
| Address | contacts | None | Yes |
| SSN | secure_identifiers | AES-256 | Yes |
| Medical History | clinical_notes | AES-256 | Yes |
| Allergies | clinical_notes | AES-256 | Yes |
| Name | contacts | None | Yes |

**Public Log vs Secure Storage:**
```typescript
// What gets logged publicly
publicTranscript = "Patient mentioned health concern and location preference";

// What goes to secure storage
clinicalNotes = {
  transcript: "...history of heart issues...",
  encrypted: true,
  encryptedAt: ISO8601,
  decryptionKey: "kms_ref",
  auditTrail: [
    { action: 'created', by: 'vapi_agent', at: timestamp },
    { action: 'accessed', by: 'doctor_id', at: timestamp }
  ]
};
```

**Test Specification:**
- Parse transcript with multiple PII types
- Route medical data to clinical_notes (encrypted)
- Route contact data to contacts (not encrypted)
- Verify audit trail created
- Ensure public log is sanitized

**Test Case:**
```
Input: "My address is 123 Harley Street and I have a history of heart issues"

Expected Behavior:
✅ contacts.address = "123 Harley Street"
✅ clinical_notes.medical_history = "[ENCRYPTED]"
✅ public_log = "Patient mentioned health concern and location preference"
✅ audit_trail entries created
✅ GDPR compliant routing
```

---

### Task 4: Latency & Response Benchmarking ⚡

**Problem Solved:** Ensure AI responses don't cause awkward silences

**Measurement Points:**
```
Time to First Byte (TTFB):
  Start: Patient finishes speaking
  End: AI begins response
  Target: <800ms
  Optimal: <200ms
```

**Latency Budget Allocation:**
```
Deepgram (STT):           100ms
Vector DB query (KB):     150ms
LLM inference (VAPI):     300ms
Cartesia/ElevenLabs (TTS):200ms
──────────────────────────────
Total:                    750ms ✅ (under 800ms)
```

**Optimization Strategy:**
```typescript
// Current: Sequential processing
STT → KB Query → LLM → TTS
     ├─ Total: 750ms

// Optimized: Parallel processing
┌─────────────┐
│ STT + KB    │ 150ms (parallel)
└──────┬──────┘
       ├─ LLM    │ 300ms
       │         ├─ TTS │ 200ms (overlap)
└─────────────
Total: ~400ms (parallel streams)
```

**Streaming Implementation:**
- Start TTS while KB query running
- Stream LLM response to Cartesia as it generates
- Patient hears response beginning within 200ms

**Test Specification:**
- Measure TTFB for different scenarios
- Verify <800ms in 95% of cases
- Optimize with streaming if needed
- Monitor under load (5+ concurrent calls)

**Success Metric:**
```
TTFB Distribution:
  <200ms: ✅ 40%
  200-500ms: ✅ 50%
  500-800ms: ✅ 10%
  >800ms: ❌ 0%
  
P95 latency: <700ms ✅
P99 latency: <800ms ✅
```

---

### Task 5: Multi-Tenant Silo Validation 🔐

**Problem Solved:** Prevent cross-clinic data leakage via RLS

**Test Scenario:**
```
Clinic A JWT attempts:
  GET /api/bookings/clinic_b/booking_123
  PUT /api/bookings/clinic_b/booking_123
  DELETE /api/patients/clinic_b/patient_456

Expected: ❌ 403 Forbidden on all attempts
```

**RLS Policy Implementation:**
```sql
-- Example RLS policy on bookings table
CREATE POLICY "Users can only access their clinic's bookings" ON bookings
  USING (clinic_id = auth.jwt() ->> 'org_id')
  WITH CHECK (clinic_id = auth.jwt() ->> 'org_id');

-- At database level: impossible to bypass
-- Even superuser with wrong org_id gets empty result set
```

**Test Specification:**
- Create bookings for Clinic A and Clinic B
- Authenticate as Clinic A user
- Attempt access to Clinic B data
- Verify RLS rejection at database level
- Test 100 concurrent queries with org_id mixing

**Success Metric:**
```
Clinic A JWT + Clinic B booking:
  ❌ 403 Forbidden ✅
  ❌ No data leaked ✅
  ❌ Attempt logged in audit trail ✅

100 concurrent queries:
  ❌ 0 successful cross-org queries ✅
  ✅ 100% isolation maintained ✅
  ✅ <50ms query time ✅
```

---

## Step 2: Technical Requirements

### APIs & Endpoints to Test

**Supabase Functions:**
- `POST /functions/v1/claim_slot_atomic`
- `POST /functions/v1/trigger_followup_sms`
- `POST /functions/v1/redact_and_store_pii`
- `GET /functions/v1/get_clinic_data` (RLS)

**Vapi Integration:**
- Speech-to-text (Deepgram)
- LLM inference
- Text-to-speech (Cartesia/ElevenLabs)

**External Services:**
- Twilio SMS API
- Google Calendar API
- Vector DB (Supabase pgvector)

### Database Schema Validations

**Tables to Test:**
- `calendar_slots` - Atomic locking, slot holds
- `bookings` - Multi-tenant isolation, state tracking
- `patients` - PII handling, encryption
- `clinical_notes` - GDPR compliance, audit trails
- `contacts` - Non-sensitive data routing
- `audit_trail` - Complete tracking

### Performance Benchmarks

| Operation | Target | Critical |
|-----------|--------|----------|
| Slot claim (atomic) | <100ms | <200ms |
| SMS send | <5s | <10s |
| PII detection | <50ms | <100ms |
| KB query | <150ms | <300ms |
| LLM response | <300ms | <500ms |
| RLS query (100 concurrent) | <50ms | <100ms |

---

## Step 3: Testing Criteria

### Unit Test Criteria
- Each function tested independently
- Mock external services
- 95%+ code coverage per function

### Integration Test Criteria
- Full workflow from call to confirmation
- All systems communicating correctly
- Database state consistent
- No orphaned records

### System Test Criteria
- Real Supabase instance (or branch)
- Real Vapi staging environment
- Real SMS delivery (Twilio test mode)
- Real latency measurements
- Load testing (concurrent users)

### Acceptance Criteria

**For Each Task:**

Task 1 ✅:
```
[ ] 5 concurrent calls, 1 success, 4 conflicts
[ ] Database has only 1 booking
[ ] No race condition detected
[ ] < 100ms atomic operation
```

Task 2 ✅:
```
[ ] Webhook triggered within 2s of hangup
[ ] SMS sent within 5s
[ ] Correct procedure-specific content
[ ] Lead tracked for follow-up
```

Task 3 ✅:
```
[ ] Medical data encrypted in clinical_notes
[ ] Contact data in contacts (not encrypted)
[ ] Public log sanitized
[ ] Audit trail complete
[ ] GDPR compliant
```

Task 4 ✅:
```
[ ] TTFB < 800ms in 95% cases
[ ] P95 latency < 700ms
[ ] No awkward silences detected
[ ] Streaming working (if optimized)
```

Task 5 ✅:
```
[ ] Clinic A JWT cannot access Clinic B data
[ ] 403 Forbidden returned
[ ] RLS enforced at database level
[ ] 100 concurrent queries isolated
[ ] 0% data leakage
```

---

## Implementation Plan

### Phase 3a: Foundation (This Week)
1. Set up Supabase staging environment
2. Implement atomic slot locking RPC
3. Create webhook endpoint for hangup detection
4. Implement NER pipeline for PII detection
5. Configure RLS policies

### Phase 3b: Integration Testing (Next Week)
1. End-to-end booking flow test
2. Multi-agent coordination test
3. Performance benchmarking
4. Load testing (concurrent users)

### Phase 3c: Production Validation (Following Week)
1. Staging environment validation
2. Final performance review
3. Security audit sign-off
4. Team training & documentation
5. Production rollout

---

## Success Criteria Summary

✅ **All 5 Master Orchestrator tasks validated**
✅ **No race conditions or data leakage**
✅ **Latency targets met**
✅ **100% GDPR compliant**
✅ **Ready for production**

---

**Next Step:** Proceed to code implementation following 3-step principle?

---

*Generated: 14 January 2026*  
*Scope: Master Orchestrator System Testing*  
*Reference: 6 system testing.md + Master Orchestrator prompt*
