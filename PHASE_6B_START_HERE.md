# 🚀 Phase 6B: Booking Chain - Quick Start Guide

**Read this first for context, then jump to PHASE_6B_BOOKING_CHAIN_TESTS.md for code**

---

## What is Phase 6B?

Phase 6B proves the **complete booking lifecycle** works correctly:
- Staff creates appointments ✅
- Patients can confirm bookings ✅
- Clinics cannot see each other's appointments ✅
- Double-booking is prevented ✅
- Appointment states flow correctly ✅

**Why this matters:** This is the core transaction that makes the product work.

---

## What You're Building

### Before Phase 6B
```
Clinic A Dashboard          Clinic B Dashboard
┌─────────────────┐        ┌─────────────────┐
│ No bookings     │        │ No bookings     │
│ (Untested)      │        │ (Untested)      │
└─────────────────┘        └─────────────────┘
```

### After Phase 6B (What Tests Prove)
```
Clinic A Dashboard          Clinic B Dashboard
┌─────────────────┐        ┌─────────────────┐
│ Jan 20, 2-3 PM  │        │ Jan 20, 2-3 PM  │
│ John Smith      │        │ Sarah Johnson   │
│ ✅ CONFIRMED    │        │ ✅ CONFIRMED    │
│                 │        │                 │
│ Jan 21, 10 AM   │        │ Jan 21, 10 AM   │
│ (PENDING)       │        │ Lisa Wong       │
│ → Clinic A's    │        │ → Clinic B's    │
│   booking only  │        │   booking only  │
└─────────────────┘        └─────────────────┘

❌ Clinic B cannot see Clinic A's appointments
❌ Clinic A cannot book over Clinic B's slots
✅ System enforces complete isolation
```

---

## 6 Tests You're Creating

| Test | Purpose | Key Validation |
|------|---------|-----------------|
| **Test 1** | Basic booking creation | Booking stores clinic ID, timestamp, status |
| **Test 2** | Clinic isolation | Clinic A sees 3 bookings, Clinic B sees 2, never mixed |
| **Test 3** | Conflict detection | Double-booking rejected, error clear |
| **Test 4** | Status flow | pending → confirmed → completed (no skipping) |
| **Test 5** | Patient confirmation | Token-based flow, cannot confirm twice |
| **Test 6** | Availability windows | Booked slots excluded, free slots included |

---

## What You Need to Know

### 1. Booking Table Structure
```sql
CREATE TABLE bookings (
  id uuid,                    -- Unique booking ID
  org_id uuid,               -- ⭐ CLINIC ID (isolation key)
  patient_email text,        -- Who's being seen
  provider_id uuid,          -- Staff member (provider)
  start_time timestamp,      -- Appointment start
  end_time timestamp,        -- Appointment end
  status text,               -- pending|confirmed|completed|cancelled
  confirmation_token text,   -- Token for patient email link
  patient_confirmed_at timestamp,  -- When patient clicked link
  calendar_event_id text,    -- Google Calendar event ID
  notes text,
  created_at timestamp,
  updated_at timestamp,
  created_by uuid            -- Staff who created it
);
```

**Key point:** `org_id` = clinic isolation (different clinics = different org_id)

### 2. Status Machine
```
When created:
pending → (awaiting patient confirmation)

Patient clicks email link:
pending → confirmed → (if no conflicts)

Appointment happens:
confirmed → completed

Can cancel anytime:
pending → cancelled
or
confirmed → cancelled

Terminal states:
completed (no transitions out)
cancelled (no transitions out)
```

### 3. Conflict Detection
```
Question: "Can I book this provider at 10:00-10:30?"

Check: Are there any OTHER confirmed bookings 
       for same provider that overlap?

Overlaps include:
- 10:00-10:30 existing, 10:00-10:30 new ✗
- 9:30-10:15 existing, 10:00-10:30 new ✗
- 10:15-10:45 existing, 10:00-10:30 new ✗

OK:
- 9:00-10:00 existing, 10:00-10:30 new ✓ (adjacent)
- 10:30-11:00 existing, 10:00-10:30 new ✓ (adjacent)
- 2:00-3:00 existing, 10:00-10:30 new ✓ (different time)
```

### 4. Clinic Isolation
```
Database level:
- Clinic A bookings have org_id = clinic-a-uuid
- Clinic B bookings have org_id = clinic-b-uuid
- Queries filter by org_id automatically

In tests:
- seedClinic() returns UUID
- createBooking(clinicId: ...) stores org_id
- getClinicBookings(clinicId) queries WHERE org_id = clinicId
- Result: Clinics completely separated
```

### 5. Test Data Pattern (From Phase 6A)
```typescript
// Step 1: Create clinic (just UUID)
const clinic = await seedClinic({ name: 'Heart Clinic' });
// Result: { id: 'uuid-..', name: 'Heart Clinic', email: 'clinic-..@test.com' }

// Step 2: Create staff user (real auth user)
const staff = await seedUser({ clinicId: clinic.id, role: 'staff' });
// Result: { id: 'uuid-..', email: 'email-@test.com', clinicId: clinic.id, role: 'staff' }

// Step 3: Create booking
const booking = await createBooking({
  clinicId: clinic.id,        // Links to clinic
  providerId: staff.id,       // Links to staff
  patientEmail: `..@example.com`,
  startTime: new Date(...),
});
// Result: { id: 'uuid-..', org_id: clinic.id, status: 'pending', ... }
```

---

## 4-Hour Implementation Timeline

### Hour 1: Setup
```bash
# 1. Read PHASE_6B_QUICK_REFERENCE.md (10 min)
# 2. Create database migration (10 min)
# 3. Apply migration to Supabase (5 min)
# 4. Verify table exists (5 min)
# 5. Review Phase 6A tests for patterns (15 min)
```

### Hour 2: Fixtures
```bash
# 1. Create booking-chain-fixtures.ts (30 min)
# 2. Implement functions:
#    - createBooking() (10 min)
#    - updateBookingStatus() (8 min)
#    - getClinicBookings() (8 min)
#    - getAvailableSlots() (8 min)
#    - confirmBooking() (8 min)
# 3. Quick test each function (10 min)
```

### Hour 3: Tests 1-3
```bash
# Create 6b-booking-chain.test.ts
# 
# Test 1: Basic booking (15 min)
# Test 2: Clinic isolation (20 min)
# Test 3: Conflict detection (15 min)
# Run and debug (10 min)
```

### Hour 4: Tests 4-6 + Verification
```bash
# Test 4: Status transitions (15 min)
# Test 5: Patient confirmation (15 min)
# Test 6: Availability slots (15 min)
# Run all 6 tests (10 min)
# Verify: npm run test:6b shows 6/6 passing
```

---

## Dependencies (Already Have from 6A)

✅ Supabase (@supabase/supabase-js)  
✅ Jest test framework  
✅ TypeScript  
✅ Node crypto module  
✅ clinic-auth-fixtures.ts (reuse!)  
✅ integration-setup.ts (reuse!)  

**New in Phase 6B:**
- ✨ Bookings table (SQL migration)
- ✨ booking-chain-fixtures.ts (new file)
- ✨ 6b-booking-chain.test.ts (new file)

---

## File Locations

```
backend/
├── src/
│   └── __tests__/
│       └── integration/
│           ├── 6a-clinic-handshake.test.ts      ✅ EXISTING (8 tests)
│           ├── 6b-booking-chain.test.ts         🚀 CREATE THIS
│           ├── 6c-rag-smart-answer.test.ts      ✅ EXISTING (8 tests)
│           ├── fixtures/
│           │   ├── clinic-auth-fixtures.ts      ✅ EXISTING (reuse)
│           │   └── booking-chain-fixtures.ts    🚀 CREATE THIS
│           └── setup/
│               └── integration-setup.ts         ✅ EXISTING (reuse)
```

---

## Success Checklist

**Before starting:**
- [ ] Phase 6A tests (6a-clinic-handshake.test.ts) showing 8/8 passing
- [ ] Phase 6C tests (6c-rag-smart-answer.test.ts) showing 8/8 passing
- [ ] Supabase running locally or cloud connection ready
- [ ] Node.js and npm working

**After creating migration:**
- [ ] Bookings table exists in Supabase
- [ ] Columns visible with `\d bookings` (psql)
- [ ] Indexes created for performance
- [ ] RLS policies set (if using Supabase Auth)

**After creating fixtures:**
- [ ] booking-chain-fixtures.ts file created (400+ lines)
- [ ] All 5 functions implemented
- [ ] No syntax errors

**After creating tests:**
- [ ] 6b-booking-chain.test.ts created (500+ lines)
- [ ] 6 test blocks defined
- [ ] No missing imports

**Final validation:**
- [ ] `npm run test:6b` shows 6/6 PASSING
- [ ] All Phase 6A tests still passing (8/8)
- [ ] All Phase 6C tests still passing (8/8)
- [ ] Combined: 22/22 total tests passing
- [ ] Execution time: <30 seconds for all

---

## Common Gotchas

### ❌ Gotcha 1: Hardcoded Emails Cause Failures
```typescript
// WRONG - Same email every test run
patientEmail: 'patient@example.com'

// RIGHT - Unique email each test
const testId = crypto.randomUUID().substr(0, 8);
patientEmail: `patient-${testId}@example.com`
```

### ❌ Gotcha 2: Forgetting to Confirm Before Checking Conflicts
```typescript
// WRONG - Conflict check only works for CONFIRMED bookings
const booking1 = await createBooking({...});
const booking2 = await createBooking({...});  // No error!

// RIGHT - Confirm first
const booking1 = await createBooking({...});
await updateBookingStatus(booking1.id, 'confirmed');
const booking2 = await createBooking({...});  // Error! ✓
```

### ❌ Gotcha 3: Times in Wrong Timezone
```typescript
// WRONG - Local time (different on each machine)
new Date('2026-01-20T14:00:00')

// RIGHT - UTC/Zulu time
new Date('2026-01-20T14:00:00Z')
```

### ❌ Gotcha 4: Forgetting org_id in Queries
```typescript
// WRONG - Could see other clinics' bookings
const bookings = await db.from('bookings').select('*');

// RIGHT - Filter by clinic
const bookings = await getClinicBookings(clinic.id);
// or manually:
const bookings = await db
  .from('bookings')
  .select('*')
  .eq('org_id', clinic.id);
```

### ❌ Gotcha 5: Database Migration Not Applied
```bash
# WRONG - Create fixtures without migration
npm run test:6b  # ❌ "Table 'public.bookings' not found"

# RIGHT - Apply migration first
supabase migration new create_bookings_table
# (add SQL)
supabase db push
npm run test:6b  # ✅ Works
```

---

## Quick Reference Commands

```bash
# Create migration
cd backend
supabase migration new create_bookings_table

# View pending migrations
supabase migration list

# Apply migration
supabase db push

# Reset Supabase (CAREFUL! Deletes all data)
supabase db reset

# Run Phase 6B tests
npm run test:6b

# Run with verbose output
npx jest src/__tests__/integration/6b-booking-chain.test.ts --verbose

# Watch mode (auto-rerun on file changes)
npm run test:6b -- --watch

# Check test coverage
npm run test:6b -- --coverage
```

---

## Architecture Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 6B Architecture                     │
└─────────────────────────────────────────────────────────────┘

         Test File (6b-booking-chain.test.ts)
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
    Fixture 1      Fixture 2     Fixture 3
  createBooking()  updateStatus  getClinicBookings()
    (DB insert)      (DB update)   (DB select)
        │             │             │
        └─────────────┴─────────────┘
                    ↓
    ┌───────────────────────────────────┐
    │   Supabase Cloud (Real Database)  │
    ├───────────────────────────────────┤
    │  Table: bookings                  │
    │  - org_id (clinic isolation)      │
    │  - status (state machine)         │
    │  - provider_id (conflict check)   │
    │  - start_time/end_time            │
    │  - confirmation_token (patient)   │
    └───────────────────────────────────┘

Key Pattern: "Real Pipes, Fake Signals"
- Real: Actual database operations ✅
- Real: Actual Supabase tables ✅
- Fake: Simulated time (test controls dates) ✅
```

---

## Next Steps

1. **Read:** [PHASE_6B_QUICK_REFERENCE.md](PHASE_6B_QUICK_REFERENCE.md) (cheat sheet)
2. **Reference:** [PHASE_6B_BOOKING_CHAIN_TESTS.md](PHASE_6B_BOOKING_CHAIN_TESTS.md) (copy code from here)
3. **Review:** Phase 6A tests (`6a-clinic-handshake.test.ts`) for fixture patterns
4. **Create:** Database migration with SQL provided
5. **Implement:** Copy fixtures file
6. **Implement:** Copy test file
7. **Run:** `npm run test:6b`
8. **Debug:** Until 6/6 tests passing
9. **Verify:** Combined 22/22 tests (6A + 6B + 6C)

---

## Success Looks Like

```bash
$ npm run test:6b

PASS  src/__tests__/integration/6b-booking-chain.test.ts (8.342s)
  Phase 6B: Booking Chain Flow
    ✓ should create booking with clinic isolation (523 ms)
    ✓ should isolate bookings between clinics (1247 ms)
    ✓ should prevent double-booking same time slot (892 ms)
    ✓ should follow valid status transitions... (673 ms)
    ✓ should handle patient confirmation workflow... (654 ms)
    ✓ should calculate available slots... (1156 ms)
    ✓ should verify clinic isolation prevents... (445 ms)

Tests:      7 passed, 7 total
Time:       8.342s

✅ Phase 6B COMPLETE
✅ Phase 6A still passing (8/8)
✅ Phase 6C still passing (8/8)
✅ Total: 22/22 integration tests passing

🎉 Ready for Phase 6D or production
```

---

**Status:** Ready to implement  
**Estimated time:** 3-4 hours  
**Next action:** Read PHASE_6B_QUICK_REFERENCE.md →
