# 📋 Phase 6B: Booking Chain - Quick Reference

**Keep this open while implementing. Copy code blocks directly.**

---

## 🚀 Quick Start (4 Commands)

```bash
# 1. Create database migration
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
supabase migration new create_bookings_table

# 2. Copy SQL from "Database Migration SQL" section below
# (Add to the migration file created above)

# 3. Apply migration
supabase db push

# 4. Copy code from sections below into:
#    - src/__tests__/integration/fixtures/booking-chain-fixtures.ts
#    - src/__tests__/integration/6b-booking-chain.test.ts

# 5. Run tests
npm run test:6b
```

---

## 📊 6 Tests at a Glance

| # | Test | What It Validates | Expected Duration |
|---|------|-----------------|-------------------|
| 1 | Basic Booking | Booking stores clinic ID, status, timestamps | ~500ms |
| 2 | Clinic Isolation | Clinic A sees only own bookings, Clinic B separate | ~1200ms |
| 3 | Conflict Detection | Double-booking rejected with clear error | ~800ms |
| 4 | Status Machine | Transitions: pending→confirmed→completed | ~600ms |
| 5 | Patient Confirmation | Token-based confirmation, cannot confirm twice | ~700ms |
| 6 | Availability Slots | Booked slots excluded, free slots listed | ~1100ms |

**Total:** 6 tests, ~5.5 seconds execution

---

## 🛠️ Fixture Functions Summary

### createBooking()
```typescript
const booking = await createBooking({
  clinicId: clinic.id,              // Clinic UUID
  providerId: staff.id,             // Staff UUID
  patientEmail: `p-${testId}@e.com`,
  startTime: new Date('2026-01-20T14:00:00Z'),
  endTime: new Date('2026-01-20T14:30:00Z'),  // Optional, defaults +30min
  notes: 'Follow-up visit',                    // Optional
});

// Returns: { id, org_id, status: 'pending', confirmation_token, ... }
// Throws: Error if time conflict or validation fails
```

### updateBookingStatus()
```typescript
const updated = await updateBookingStatus(
  bookingId,
  'confirmed'  // or 'completed' or 'cancelled'
);

// Returns: { id, status: 'confirmed', updated_at, ... }
// Throws: Error if invalid transition
```

### getClinicBookings()
```typescript
const bookings = await getClinicBookings(
  clinicId,
  {
    status: 'confirmed',                    // Optional filter
    dateRange: [start, end],               // Optional filter
    providerId: staffId,                   // Optional filter
  }
);

// Returns: Array of bookings, sorted by start_time
```

### getAvailableSlots()
```typescript
const slots = await getAvailableSlots(
  clinicId,
  providerId,
  new Date('2026-01-20'),
  30  // slot duration in minutes
);

// Returns: [
//   { start: Date, end: Date },
//   { start: Date, end: Date },
//   ...
// ]
```

### confirmBooking()
```typescript
const confirmed = await confirmBooking(confirmationToken);

// Returns: { id, status: 'confirmed', patient_confirmed_at, ... }
// Throws: Error if token invalid or already confirmed
```

---

## 📊 Database Schema (SQL)

**Add this to migration file:**

```sql
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_email text NOT NULL,
  provider_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  calendar_event_id text,
  confirmation_token text,
  patient_confirmed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.profiles (id),
  CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  CONSTRAINT valid_time_range CHECK ((start_time < end_time)),
  CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]))),
  CONSTRAINT bookings_confirmation_token_key UNIQUE (confirmation_token)
);

CREATE INDEX idx_bookings_org_id ON public.bookings USING btree (org_id);
CREATE INDEX idx_bookings_provider_id ON public.bookings USING btree (provider_id);
CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);
CREATE INDEX idx_bookings_start_time ON public.bookings USING btree (start_time);
CREATE INDEX idx_bookings_org_id_status ON public.bookings USING btree (org_id, status);
CREATE INDEX idx_bookings_provider_start ON public.bookings USING btree (provider_id, start_time);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
```

---

## 🧪 Test Skeleton

```typescript
// Add to 6b-booking-chain.test.ts

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { setupIntegration, cleanupIntegration } from './setup/integration-setup';
import { seedClinic, seedUser } from './fixtures/clinic-auth-fixtures';
import { 
  initializeFixtures,
  createBooking, 
  updateBookingStatus 
} from './fixtures/booking-chain-fixtures';

describe('Phase 6B: Booking Chain Flow', () => {
  let db;
  let testId;

  beforeEach(async () => {
    const result = await setupIntegration();
    db = result.client;
    initializeFixtures(db);
    testId = crypto.randomUUID().substr(0, 8);
  });

  afterEach(async () => {
    await cleanupIntegration();
  });

  it('TEST 1: should create booking...', async () => {
    // Setup
    const clinic = await seedClinic();
    const staff = await seedUser({ clinicId: clinic.id });

    // Action
    const booking = await createBooking({
      clinicId: clinic.id,
      providerId: staff.id,
      patientEmail: `p-${testId}@e.com`,
      startTime: new Date('2026-01-20T14:00:00Z'),
    });

    // Assert
    expect(booking.org_id).toBe(clinic.id);
    expect(booking.status).toBe('pending');
  });

  // ... more tests
});
```

---

## 🔍 Common Assertions

```typescript
// Status checks
expect(booking.status).toBe('pending');
expect(booking.status).toBe('confirmed');

// Existence checks
expect(booking.id).toBeDefined();
expect(booking.confirmation_token).toBeDefined();

// Clinic isolation
expect(bookingA.org_id).toBe(clinicA.id);
expect(bookingB.org_id).toBe(clinicB.id);
expect(bookingsA.some(b => b.org_id === clinicB.id)).toBe(false);

// Time comparisons
expect(new Date(booking.start_time)).toEqual(startTime);
expect(booking.end_time > booking.start_time).toBe(true);

// Array/Count checks
expect(bookings.length).toBe(3);
expect(bookings.length).toBeLessThan(previousCount);

// Error catching
const error = await createBooking({...}).catch(err => err);
expect(error.message).toContain('conflict');
```

---

## ⚙️ Key Settings

### Status Machine
```typescript
const validTransitions = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['completed', 'cancelled'],
  'completed': [],        // Terminal
  'cancelled': [],        // Terminal
};
```

### Available Time Window
```typescript
Business Hours: 9:00 AM - 5:00 PM
Slot Duration: 30 minutes
Timezone: UTC (use Z suffix)
```

### Conflict Detection
```typescript
Overlapping means:
  existing.start < new.end AND
  existing.end > new.start

Safe to book adjacent:
  new.start = existing.end (back to back OK)
```

---

## 🐛 Debugging Commands

```bash
# Watch test file for changes
npm run test:6b -- --watch

# Run with verbose output
npx jest src/__tests__/integration/6b-booking-chain.test.ts --verbose

# Run specific test only
npx jest -t "should create booking"

# Show coverage
npm run test:6b -- --coverage

# No timeout (if tests slow)
npx jest src/__tests__/integration/6b-booking-chain.test.ts --testTimeout=60000

# Clear Jest cache
npx jest --clearCache && npm run test:6b
```

---

## ✅ Success Checklist

- [ ] Migration created with SQL above
- [ ] `supabase db push` runs successfully
- [ ] `\d bookings` shows all columns
- [ ] booking-chain-fixtures.ts created (400+ lines)
- [ ] 6b-booking-chain.test.ts created (500+ lines)
- [ ] `npm run test:6b` shows 6/6 passing
- [ ] All 6A tests still passing (8/8)
- [ ] All 6C tests still passing (8/8)
- [ ] Combined: 22/22 tests passing
- [ ] Execution time < 30 seconds

---

## 🚨 Common Errors

### "Cannot find table 'public.bookings'"
→ Run: `supabase db push`

### "Foreign key constraint violated"
→ Use: `const staff = await seedUser({ clinicId: clinic.id })`

### "A user with this email address has already been registered"
→ Use: `` `patient-${testId}@example.com` ``

### "invalid input syntax for type uuid"
→ Use: `crypto.randomUUID()` (not short strings)

### "Booking already X"
→ Use: different email, unique testId per test

### "Time slot conflict"
→ Use: `await updateBookingStatus(booking.id, 'confirmed')`  
then try different time or provider

---

## 📁 Files to Create

1. **booking-chain-fixtures.ts** (400+ lines)
   - Copy from PHASE_6B_BOOKING_CHAIN_TESTS.md section "File 1"

2. **6b-booking-chain.test.ts** (500+ lines)
   - Copy from PHASE_6B_BOOKING_CHAIN_TESTS.md section "File 2"

3. **Migration SQL** (in supabase migration file)
   - Copy from section "Database Migration File" above

---

## 🎯 Development Flow

```
1. Create migration file
   ↓
2. Add SQL to migration
   ↓
3. Run: supabase db push
   ↓
4. Create: booking-chain-fixtures.ts
   ↓
5. Create: 6b-booking-chain.test.ts
   ↓
6. Run: npm run test:6b
   ↓
7. Debug until 6/6 passing
   ↓
8. Run all phases: npm run test:integration
   ↓
9. Verify: 22/22 passing
```

---

## 📞 Quick Help

| Issue | Fix |
|-------|-----|
| Tests won't import fixtures | Check file path: `./fixtures/booking-chain-fixtures` |
| Database errors | Run: `supabase db push` then `supabase migration list` |
| Tests timing out | Increase: `--testTimeout=60000` |
| Can't confirm booking | Check token not already used |
| Time conflicts incorrect | Ensure dates in UTC (use Z) |
| Clinic isolation failing | Check WHERE clause includes `org_id` |

---

## 🔗 Related Files

- **PHASE_6B_START_HERE.md** - Read this first for context
- **PHASE_6B_BOOKING_CHAIN_TESTS.md** - Full implementation guide with all code
- **PHASE_6B_INTEGRATION_PLAN.md** - Architecture and design decisions
- **6a-clinic-handshake.test.ts** - Reference for fixture patterns
- **clinic-auth-fixtures.ts** - Reuse these functions

---

**Print this page or keep it open while coding! 📋**

Time to implement: 3-4 hours  
Total tests after completion: 22/22 (6A + 6B + 6C)
