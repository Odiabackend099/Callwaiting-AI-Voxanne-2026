# 📋 PHASE 6: INTEGRATION TESTING PLANNING

**Date**: January 15, 2026  
**Status**: Implementation Ready  
**Test Runner**: Vitest  
**Database**: Local Supabase (`supabase start`)  
**Focus**: Real Database, Real RLS, Real Triggers

---

## 🎯 OBJECTIVES

Move beyond unit tests (53 passing) to integration testing that validates the **connective tissue**:

1. **Auth → DB**: Verify identity handshake creates org_id automatically
2. **Vapi → API → DB → Calendar**: Validate booking chain with <500ms performance
3. **Vector DB ↔ AI**: Ensure RAG retrieves org-specific knowledge only
4. **RLS Security**: Verify clinic isolation at database layer

---

## 📊 GOLDEN SCENARIOS

### Scenario 1: The Identity Handshake (Auth → DB)
**User Story**: New clinic admin signs up → Supabase Auth trigger → Org created → JWT contains org_id

**Setup**:
- No existing org_id
- User completes signup flow
- Supabase Auth fires trigger

**Expected Flow**:
```
Signup Request
  ↓
Supabase Auth creates auth.users record
  ↓
PostgreSQL trigger fires: auth.on_auth_user_created()
  ↓
INSERT new org record in public.organizations
  ↓
SET user's org_id claim
  ↓
Return JWT with org_id
```

**Success Criteria**:
- ✅ org record created automatically
- ✅ JWT decode shows org_id in claims
- ✅ Profile linked to org_id
- ✅ RLS policies allow user to see their org data

**Test File**: `phase-6-identity-handshake.test.ts`

---

### Scenario 2: The Live Booking Chain (Vapi → API → DB → Calendar)
**User Story**: Patient books via Vapi call → Backend atomically locks slot → Stores booking → Syncs to Google Calendar

**Setup**:
- Vapi tool-call for `book_appointment`
- Clinic with available provider
- Google Calendar API credentials configured
- Local Supabase with bookings table + triggers

**Expected Flow**:
```
Vapi Tool Call: book_appointment
  ↓
POST /api/vapi/tools
  {
    "tool": "book_appointment",
    "params": {
      "clinic_id": "uuid",
      "provider_id": "uuid",
      "patient_name": "John Doe",
      "patient_email": "john@example.com",
      "appointment_time": "2026-01-15T14:00:00Z",
      "duration_minutes": 30
    }
  }
  ↓
Backend: Verify clinic authorization (org_id match)
  ↓
Backend: Lock the slot atomically (SELECT ... FOR UPDATE)
  ↓
Backend: Check for conflicts
  ↓
Backend: INSERT into appointments table
  ↓
PostgreSQL trigger: Insert event into calendar_events table
  ↓
Background job: Sync to Google Calendar
  ↓
Return response with appointment ID + Google Calendar link
```

**Success Criteria**:
- ✅ Response time < 500ms
- ✅ Appointment stored in database
- ✅ Slot lock prevents double-booking
- ✅ Google Calendar event created
- ✅ clinic_id validation passes
- ✅ Clinic A cannot book slots for Clinic B
- ✅ Invalid provider_id rejected

**Test File**: `phase-6-live-booking-chain.test.ts` (PRIMARY DELIVERABLE)

---

### Scenario 3: The Smart Answer Loop (Vector DB ↔ AI)
**User Story**: Patient asks "What's your cancellation policy?" → RAG retrieves clinic-specific policy → AI answers

**Setup**:
- pgvector embeddings in knowledge_base table
- Clinic-specific policies stored
- Multiple clinics with different policies

**Expected Flow**:
```
Patient Question
  ↓
Extract clinic_id from JWT
  ↓
Generate embedding of question
  ↓
pgvector similarity search:
  SELECT * FROM knowledge_base
  WHERE org_id = $1
  ORDER BY embedding <-> question_embedding
  LIMIT 3
  ↓
Pass context to Claude
  ↓
Claude generates answer
  ↓
Return answer to patient
```

**Success Criteria**:
- ✅ Clinic A cannot see Clinic B's knowledge base
- ✅ Query returns only top 3 similar documents
- ✅ org_id filter enforced
- ✅ Embedding similarity > 0.7
- ✅ Query time < 100ms

**Test File**: `phase-6-smart-answer-loop.test.ts`

---

### Scenario 4: Multi-Tenant Aggressor Test (Security)
**User Story**: User A (Clinic A) tries to book slot/edit settings for Clinic B → 403 Forbidden

**Setup**:
- 2 clinics, 2 users
- User A has auth token for Clinic A
- User A tries to access Clinic B resources

**Expected Flow**:
```
User A sends request:
  GET /api/clinics/{clinic_b_id}/settings
  Authorization: Bearer {clinic_a_jwt}
  ↓
Backend extracts org_id from JWT
  ↓
Compare: org_id != clinic_b_id
  ↓
Return 403 Forbidden
```

**Success Criteria**:
- ✅ 403 response for org_id mismatch
- ✅ RLS policy blocks query at database
- ✅ No data leakage
- ✅ Audit log records attempt

**Test File**: `phase-6-security-aggressor.test.ts`

---

## 📁 DIRECTORY STRUCTURE

```
backend/src/__tests__/
├── integration/
│   ├── phase-6-identity-handshake.test.ts
│   ├── phase-6-live-booking-chain.test.ts
│   ├── phase-6-smart-answer-loop.test.ts
│   ├── phase-6-security-aggressor.test.ts
│   ├── fixtures/
│   │   └── phase-6-fixtures.ts (shared test data)
│   └── setup/
│       └── phase-6-setup.ts (Supabase local instance setup)
├── vitest.config.ts
└── vitest.setup.ts
```

---

## 🛠️ IMPLEMENTATION PHASES

### Phase 6.1: Setup (Day 1)
**Goal**: Get local Supabase running with test data

- [ ] Install Vitest + dependencies
- [ ] Configure Vitest with local Supabase
- [ ] Create `phase-6-setup.ts` (start Supabase, seed tables)
- [ ] Create `phase-6-fixtures.ts` (test clinic, user, provider)
- [ ] Verify connection to local Supabase

**Deliverable**: Working test environment

---

### Phase 6.2: Scenario 1 - Identity Handshake (Day 1)
**Goal**: Validate Auth → DB flow

- [ ] Implement `phase-6-identity-handshake.test.ts`
- [ ] 4 test cases (success, missing auth, org already exists, RLS check)
- [ ] Verify trigger fires automatically
- [ ] Validate JWT structure

**Success**: 4/4 tests passing

---

### Phase 6.3: Scenario 2 - Live Booking Chain (Day 2) **PRIMARY**
**Goal**: Validate Vapi → API → DB → Calendar

- [ ] Implement `/api/vapi/tools` endpoint for `book_appointment`
- [ ] Implement atomic slot locking (SELECT ... FOR UPDATE)
- [ ] Implement Google Calendar sync (real or mock)
- [ ] Implement `phase-6-live-booking-chain.test.ts`
- [ ] 8 test cases (success, conflicts, invalid clinic, performance)
- [ ] Verify <500ms response time

**Success**: 8/8 tests passing + <500ms latency

---

### Phase 6.4: Scenario 3 - Smart Answer Loop (Day 2)
**Goal**: Validate Vector DB ↔ AI flow

- [ ] Set up pgvector in local Supabase
- [ ] Seed knowledge_base with test data
- [ ] Implement `phase-6-smart-answer-loop.test.ts`
- [ ] 4 test cases (org isolation, embedding similarity, query time, AI response)

**Success**: 4/4 tests passing

---

### Phase 6.5: Scenario 4 - Security Aggressor (Day 2)
**Goal**: Validate RLS + org_id isolation

- [ ] Implement `phase-6-security-aggressor.test.ts`
- [ ] 6 test cases (403 rejection, data isolation, RLS block, audit log)
- [ ] Test cross-org access attempts

**Success**: 6/6 tests passing

---

### Phase 6.6: Documentation & Refinement (Day 3)
**Goal**: Document findings, optimize performance

- [ ] Document test results
- [ ] Profile slow queries
- [ ] Optimize RLS policies if needed
- [ ] Create Phase 6 Final Report

**Success**: All scenarios validated, performance optimized

---

## 📊 TEST METRICS

| Scenario | Tests | Pass/Fail | Avg Duration | Status |
|----------|-------|-----------|--------------|--------|
| Identity Handshake | 4 | TBD | <100ms | Pending |
| Live Booking Chain | 8 | TBD | <500ms | Pending |
| Smart Answer Loop | 4 | TBD | <100ms | Pending |
| Security Aggressor | 6 | TBD | <200ms | Pending |
| **TOTAL** | **22** | **TBD** | **TBD** | **Pending** |

---

## 🔧 TECHNICAL REQUIREMENTS

### Dependencies
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "dotenv": "^latest",
    "ts-node": "^latest"
  }
}
```

### Environment Variables
```bash
# .env.test
SUPABASE_LOCAL_URL=http://localhost:54321
SUPABASE_LOCAL_ANON_KEY=<generated_by_supabase>
SUPABASE_LOCAL_SERVICE_KEY=<generated_by_supabase>
VAPI_API_KEY=<test_key>
GOOGLE_CALENDAR_TEST_CREDS=<test_service_account>
```

### Database Schema (Required)
- `public.organizations` (org_id, created_at)
- `public.profiles` (user_id, org_id, email, role)
- `public.appointments` (appointment_id, org_id, provider_id, clinic_id, patient_email, scheduled_at)
- `public.calendar_events` (event_id, org_id, appointment_id, google_event_id)
- `public.knowledge_base` (id, org_id, content, embedding)

### RLS Policies (Required)
```sql
-- All tables: SELECT WHERE org_id = auth.jwt()->>'org_id'
-- All tables: INSERT WHERE org_id = auth.jwt()->>'org_id'
-- All tables: UPDATE WHERE org_id = auth.jwt()->>'org_id'
-- All tables: DELETE WHERE org_id = auth.jwt()->>'org_id'
```

---

## 🎯 SUCCESS CRITERIA

✅ **All Scenarios Implemented**
- 4 test files created
- 22 total test cases
- All tests passing

✅ **Performance Validated**
- Booking chain < 500ms
- Smart answer < 100ms
- Average test time < 150ms

✅ **Security Verified**
- RLS policies block cross-org access
- JWT org_id properly enforced
- No data leakage detected

✅ **Database Integrity**
- Triggers fire automatically
- Atomic locking prevents conflicts
- Audit trails logged

---

## 📝 SIGN-OFF

**Planning Status**: ✅ COMPLETE  
**Ready for Implementation**: ✅ YES  
**Date**: January 15, 2026  
**Next Step**: Execute Phase 6.1-6.3 (Setup + Scenarios 1-2)
