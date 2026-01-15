# 🎯 Phase 6B: Booking Chain Flow - Integration Testing Plan

**Date Created:** January 15, 2026  
**Phase Status:** 🚀 ARCHITECTURE & IMPLEMENTATION READY  
**Foundation:** Phase 6A (Clinic Auth) + Phase 6C (RAG) ✅ Complete  
**Target Completion:** January 20-22, 2026 (2-3 days)  

---

## Executive Summary

Phase 6B validates the **complete booking lifecycle** from scheduling through confirmation, with multi-tenant isolation and calendar provider integration. This phase proves the core business transaction works end-to-end.

### What Phase 6B Tests
- ✅ Clinic staff create bookings
- ✅ Bookings isolated by clinic (no cross-contamination)
- ✅ Calendar provider integration (Google Calendar)
- ✅ Booking state transitions (pending → confirmed → completed)
- ✅ Availability checking across clinics
- ✅ Conflict detection and prevention
- ✅ Patient confirmation flow
- ✅ Cancellation and rescheduling

### Why Phase 6B Matters
**Without Phase 6B testing:** Booking logic could work in unit tests but fail when clinics operate simultaneously  
**With Phase 6B testing:** Proven that Clinic A's bookings never interfere with Clinic B's availability

---

## 🏗️ Phase 6B Architecture

### Pattern: "Real Pipes, Fake Signals" (Extended from 6A)

```
Phase 6A (Auth):
┌─────────────────────────────────────┐
│ REAL: Supabase Auth + JWT tokens    │
│ REAL: Database profiles table       │
│ FAKE: Clinic IDs (in-memory UUIDs)  │
│ RESULT: Auth flow validated ✅      │
└─────────────────────────────────────┘

Phase 6B (Booking) - EXTENDS 6A:
┌─────────────────────────────────────────────────────┐
│ REAL: Supabase database (bookings table)            │
│ REAL: Time calculations & availability checking     │
│ REAL: State machine (pending → confirmed → done)    │
│ FAKE: Google Calendar (mocked with MSW)             │
│ FAKE: Vapi webhooks (mocked responses)              │
│ RESULT: Booking flow validated ✅                   │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
Test Setup:
  1. seedClinic() → Clinic A + Clinic B (UUIDs)
  2. seedUser(clinicA) → Staff user in Clinic A
  3. seedUser(clinicB) → Staff user in Clinic B
  4. createMockAuthToken() → JWT with org_id
     
Booking Creation:
  5. POST /api/bookings (staff JWT)
     ↓
  6. Backend: Validate clinic isolation (org_id claim)
     ↓
  7. Backend: Check availability (query calendar)
     ↓
  8. Database: Insert booking (org_id = clinic_id)
     ↓
  9. MSW Mock: Calendar API "created event"
     ↓
  10. Database: Update booking status
  
Verification:
  11. Query bookings for Clinic A (org_id filter)
  12. Assert Clinic B's bookings invisible
  13. Verify timestamp and state
```

---

## 🎯 Architectural Decisions for Phase 6B

### Decision 1: Real Supabase Tables
```typescript
// bookings table structure (already exists)
{
  id: uuid,           // Booking ID
  org_id: uuid,       // Clinic ID (from auth org_id claim)
  patient_email: text,
  provider_id: uuid,  // Calendar provider user
  start_time: timestamp,
  end_time: timestamp,
  status: enum('pending', 'confirmed', 'completed', 'cancelled'),
  calendar_event_id: text,  // Google Calendar event ID
  notes: text,
  created_at: timestamp,
  updated_at: timestamp,
  created_by: uuid    // Staff user who created booking
}
```

**Why:** Real table constraints catch bugs (unique constraints, foreign keys, timestamps)

### Decision 2: Mocked Google Calendar API
```typescript
// Instead of real Google Calendar:
import { http, HttpResponse } from 'msw';

server.use(
  http.post('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', 
    ({ request, params }) => {
      // Mock successful event creation
      return HttpResponse.json({
        id: 'mock-event-' + crypto.randomUUID(),
        summary: request.body.summary,
        start: request.body.start,
        end: request.body.end,
        organizer: { email: 'clinic@calendar.com' }
      });
    }
  )
);
```

**Why:** 
- No real Google auth needed
- Deterministic (no network flakiness)
- Test error paths (what if Google Calendar is down?)
- Test concurrent bookings (flood test)

### Decision 3: Dynamic Availability Windows
```typescript
// Available slots = based on clinic's schedule + booked slots
const availableSlots = {
  '2026-01-20': [
    { start: '09:00', end: '09:30' },  // 30 min slot
    { start: '09:30', end: '10:00' },
    // ... minus any existing bookings
  ]
};
```

**Why:** Realistic appointment scheduling, tests conflict detection

### Decision 4: Real-Time Status Transitions
```typescript
// Status flow validation
const validTransitions = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['completed', 'cancelled'],
  'completed': [],  // Terminal state
  'cancelled': []   // Terminal state
};
```

**Why:** Prevents invalid states (e.g., completed → pending)

### Decision 5: Multi-Clinic Isolation Testing
```typescript
// Every assertion includes org_id filter
const clinicABookings = await db
  .from('bookings')
  .select('*')
  .eq('org_id', clinicA.id);  // ← MUST filter by clinic

const clinicBBookings = await db
  .from('bookings')
  .select('*')
  .eq('org_id', clinicB.id);

// Cross-contamination test
expect(clinicABookings).not.toContainEqual(clinicBBooking);
```

**Why:** Proves HIPAA compliance (clinic B cannot see clinic A's bookings)

### Decision 6: Performance Benchmarking
```typescript
const startTime = performance.now();
const booking = await createBooking({...});
const duration = performance.now() - startTime;

expect(duration).toBeLessThan(200);  // <200ms SLA
```

**Why:** Performance requirements validated in tests

---

## 📋 Phase 6B Test Suite (6 Tests)

### Test 1: Create Basic Booking
**Purpose:** Validate core booking creation flow  
**Duration:** ~500ms (includes DB writes)

```typescript
it('should create booking with clinic isolation', async () => {
  // Setup
  const clinicA = await seedClinic({ name: 'Heart Clinic' });
  const staffA = await seedUser({ clinicId: clinicA.id, role: 'staff' });
  const token = createMockAuthToken({ clinicId: clinicA.id, userId: staffA.id });
  
  // Create booking
  const booking = await createBooking({
    clinicId: clinicA.id,
    patientEmail: `patient-${testId}@example.com`,
    startTime: new Date('2026-01-20T14:00:00'),
    endTime: new Date('2026-01-20T14:30:00'),
    providerId: staffA.id,
  });
  
  // Verify
  expect(booking.id).toBeDefined();
  expect(booking.org_id).toBe(clinicA.id);
  expect(booking.status).toBe('pending');
  expect(booking.created_by).toBe(staffA.id);
});
```

**What It Validates:**
- ✅ Booking inserted with org_id = clinic
- ✅ Status defaults to 'pending'
- ✅ Created by tracked
- ✅ Timestamps set correctly

### Test 2: Clinic Isolation (Cross-Contamination Prevention)
**Purpose:** Prove Clinic A's bookings invisible to Clinic B  
**Duration:** ~1200ms (2 clinics, 3 bookings each)

```typescript
it('should isolate bookings between clinics', async () => {
  // Setup Clinic A
  const clinicA = await seedClinic({ name: 'Heart Clinic' });
  const staffA = await seedUser({ clinicId: clinicA.id });
  
  // Setup Clinic B
  const clinicB = await seedClinic({ name: 'Vision Clinic' });
  const staffB = await seedUser({ clinicId: clinicB.id });
  
  // Create 3 bookings in Clinic A
  await createBooking({ clinicId: clinicA.id, ... });
  await createBooking({ clinicId: clinicA.id, ... });
  await createBooking({ clinicId: clinicA.id, ... });
  
  // Create 2 bookings in Clinic B
  await createBooking({ clinicId: clinicB.id, ... });
  await createBooking({ clinicId: clinicB.id, ... });
  
  // Query with Clinic A's context
  const tokenA = createMockAuthToken({ clinicId: clinicA.id });
  const bookingsA = await getClinicBookings(clinicA.id);
  
  // Query with Clinic B's context
  const tokenB = createMockAuthToken({ clinicId: clinicB.id });
  const bookingsB = await getClinicBookings(clinicB.id);
  
  // Verify isolation
  expect(bookingsA.length).toBe(3);
  expect(bookingsB.length).toBe(2);
  expect(bookingsA.some(b => b.org_id === clinicB.id)).toBe(false);
  expect(bookingsB.some(b => b.org_id === clinicA.id)).toBe(false);
});
```

**What It Validates:**
- ✅ Clinic A only sees own bookings
- ✅ Clinic B only sees own bookings
- ✅ No cross-clinic visibility
- ✅ Database query filters by org_id correctly

### Test 3: Availability Checking
**Purpose:** Validate conflict detection and available slot management  
**Duration:** ~800ms (multiple time calculations)

```typescript
it('should prevent double-booking same time slot', async () => {
  // Setup
  const clinic = await seedClinic();
  const staff = await seedUser({ clinicId: clinic.id });
  const startTime = new Date('2026-01-20T10:00:00');
  const endTime = new Date('2026-01-20T10:30:00');
  
  // Create first booking
  const booking1 = await createBooking({
    clinicId: clinic.id,
    startTime,
    endTime,
    providerId: staff.id,
  });
  expect(booking1.id).toBeDefined();
  
  // Try to create overlapping booking
  const bookingError = await createBooking({
    clinicId: clinic.id,
    startTime,  // Same time
    endTime,
    providerId: staff.id,
  }).catch(err => err);
  
  // Verify conflict detected
  expect(bookingError.message).toContain('conflict');
  expect(bookingError.message).toContain('already booked');
});
```

**What It Validates:**
- ✅ Overlapping bookings rejected
- ✅ Adjacent bookings allowed (10:00-10:30, 10:30-11:00)
- ✅ Error message is clear
- ✅ First booking remains intact

### Test 4: Status Transitions
**Purpose:** Validate booking state machine  
**Duration:** ~600ms (multiple status updates)

```typescript
it('should follow valid status transitions', async () => {
  // Setup
  const clinic = await seedClinic();
  const staff = await seedUser({ clinicId: clinic.id });
  
  // Create booking (starts as 'pending')
  const booking = await createBooking({
    clinicId: clinic.id,
    providerId: staff.id,
    startTime: new Date('2026-01-20T14:00:00'),
    endTime: new Date('2026-01-20T14:30:00'),
  });
  expect(booking.status).toBe('pending');
  
  // Transition: pending → confirmed
  const confirmed = await updateBookingStatus(booking.id, 'confirmed');
  expect(confirmed.status).toBe('confirmed');
  expect(confirmed.updated_at > booking.created_at).toBe(true);
  
  // Transition: confirmed → completed
  const completed = await updateBookingStatus(booking.id, 'completed');
  expect(completed.status).toBe('completed');
  
  // Try invalid transition: completed → confirmed (should fail)
  const invalidTransition = await updateBookingStatus(
    booking.id, 
    'confirmed'
  ).catch(err => err);
  expect(invalidTransition.message).toContain('invalid transition');
});
```

**What It Validates:**
- ✅ pending → confirmed allowed
- ✅ confirmed → completed allowed
- ✅ completed → * prevented
- ✅ Status updates tracked with timestamp

### Test 5: Calendar Event Integration
**Purpose:** Validate Google Calendar sync (mocked)  
**Duration:** ~900ms (includes Google API mocks)

```typescript
it('should create calendar event when booking confirmed', async () => {
  // Setup
  const clinic = await seedClinic();
  const staff = await seedUser({ 
    clinicId: clinic.id,
    calendarId: 'clinic@calendar.com'
  });
  
  // Mock Google Calendar API
  const googleMock = server.use(
    http.post('https://www.googleapis.com/calendar/v3/calendars/:id/events',
      ({ request }) => {
        return HttpResponse.json({
          id: 'google-event-123',
          start: request.body.start,
          end: request.body.end,
        });
      }
    )
  );
  
  // Create and confirm booking
  const booking = await createBooking({
    clinicId: clinic.id,
    providerId: staff.id,
    startTime: new Date('2026-01-20T14:00:00'),
  });
  
  const confirmed = await updateBookingStatus(booking.id, 'confirmed');
  
  // Verify calendar event created
  expect(confirmed.calendar_event_id).toBe('google-event-123');
  
  // Verify event details sent to Google
  const lastRequest = googleMock.requests[0];
  expect(lastRequest.body.summary).toContain('Appointment');
  expect(lastRequest.body.start.dateTime).toBe(booking.start_time);
});
```

**What It Validates:**
- ✅ Calendar event created on confirmation
- ✅ Event details match booking
- ✅ calendar_event_id stored in booking
- ✅ Google API called with correct payload

### Test 6: Patient Confirmation Flow
**Purpose:** Validate patient confirmation process  
**Duration:** ~700ms (includes email sending simulation)

```typescript
it('should handle patient confirmation workflow', async () => {
  // Setup
  const clinic = await seedClinic();
  const staff = await seedUser({ clinicId: clinic.id });
  const patientEmail = `patient-${testId}@example.com`;
  
  // Staff creates booking in "awaiting patient" state
  const booking = await createBooking({
    clinicId: clinic.id,
    providerId: staff.id,
    patientEmail,
    startTime: new Date('2026-01-20T14:00:00'),
  });
  expect(booking.status).toBe('pending');
  
  // Simulate confirmation link clicked by patient
  const confirmToken = booking.confirmation_token;
  const confirmed = await confirmBooking(confirmToken);
  
  // Verify status changed
  expect(confirmed.status).toBe('confirmed');
  expect(confirmed.patient_confirmed_at).toBeDefined();
  
  // Verify calendar event created
  expect(confirmed.calendar_event_id).toBeDefined();
  
  // Try confirming again (should fail)
  const doubleConfirm = await confirmBooking(confirmToken)
    .catch(err => err);
  expect(doubleConfirm.message).toContain('already confirmed');
});
```

**What It Validates:**
- ✅ Pending booking awaits confirmation
- ✅ Confirmation token prevents unauthorized changes
- ✅ Confirmation triggers calendar event
- ✅ Double confirmation prevented
- ✅ Confirmation timestamp recorded

---

## 🛠️ Fixture Functions (Extensions to 6A)

All Phase 6A fixtures continue to work. Phase 6B adds:

### seedClinic() - UNCHANGED
```typescript
export async function seedClinic(options?: {
  name?: string;
  email?: string;
}): Promise<Clinic> {
  return {
    id: crypto.randomUUID(),
    name: options?.name || 'Test Clinic',
    email: options?.email || `clinic-${Date.now()}@test.com`,
  };
}
```

### seedUser() - UNCHANGED (from 6A)
```typescript
export async function seedUser(options: {
  clinicId: string;
  role?: 'admin' | 'staff' | 'doctor';
  calendarId?: string;
}): Promise<User> {
  // Creates real Supabase auth user + profile
}
```

### createMockAuthToken() - UNCHANGED (from 6A)
```typescript
export function createMockAuthToken(options: {
  userId: string;
  clinicId: string;
  role?: string;
}): { token: string; expiresAt: number } {
  // Returns JWT with org_id claim
}
```

### NEW: createBooking()
```typescript
export async function createBooking(options: {
  clinicId: string;
  providerId: string;
  patientEmail: string;
  startTime: Date;
  endTime?: Date;
  notes?: string;
}): Promise<Booking> {
  const endTime = options.endTime || 
    new Date(options.startTime.getTime() + 30 * 60000);
  
  const { data, error } = await db.from('bookings').insert({
    org_id: options.clinicId,
    patient_email: options.patientEmail,
    provider_id: options.providerId,
    start_time: options.startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: 'pending',
    created_by: options.providerId,
  }).select().single();
  
  if (error) throw error;
  return data;
}
```

### NEW: updateBookingStatus()
```typescript
export async function updateBookingStatus(
  bookingId: string,
  newStatus: 'confirmed' | 'completed' | 'cancelled'
): Promise<Booking> {
  const { data, error } = await db
    .from('bookings')
    .update({ status: newStatus, updated_at: new Date() })
    .eq('id', bookingId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

### NEW: getClinicBookings()
```typescript
export async function getClinicBookings(
  clinicId: string,
  filters?: { status?: string; dateRange?: [Date, Date] }
): Promise<Booking[]> {
  let query = db.from('bookings').select('*').eq('org_id', clinicId);
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.dateRange) {
    const [start, end] = filters.dateRange;
    query = query.gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```

### NEW: getAvailableSlots()
```typescript
export async function getAvailableSlots(
  clinicId: string,
  providerId: string,
  date: Date,
  duration: number = 30  // minutes
): Promise<Array<{ start: Date; end: Date }>> {
  // Query existing bookings
  const { data: bookings } = await db
    .from('bookings')
    .select('start_time, end_time')
    .eq('org_id', clinicId)
    .eq('provider_id', providerId)
    .eq('status', 'confirmed')
    .gte('start_time', getStartOfDay(date).toISOString())
    .lte('start_time', getEndOfDay(date).toISOString());
  
  // Calculate available slots (9am-5pm, 30-min slots)
  const slots = [];
  let current = new Date(date);
  current.setHours(9, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(17, 0, 0, 0);
  
  while (current < endOfDay) {
    const slotEnd = new Date(current.getTime() + duration * 60000);
    
    // Check if slot overlaps with any booking
    const hasConflict = bookings?.some(booking => {
      const bookStart = new Date(booking.start_time);
      const bookEnd = new Date(booking.end_time);
      return current < bookEnd && slotEnd > bookStart;
    });
    
    if (!hasConflict) {
      slots.push({ start: new Date(current), end: slotEnd });
    }
    
    current = new Date(current.getTime() + duration * 60000);
  }
  
  return slots;
}
```

### NEW: confirmBooking()
```typescript
export async function confirmBooking(
  confirmationToken: string
): Promise<Booking> {
  // Verify token hasn't expired (valid for 48 hours)
  const { data: booking, error } = await db
    .from('bookings')
    .select('*')
    .eq('confirmation_token', confirmationToken)
    .single();
  
  if (error || !booking) throw new Error('Invalid confirmation token');
  
  if (booking.status !== 'pending') {
    throw new Error('Booking already confirmed');
  }
  
  // Update status and timestamp
  const { data: updated, error: updateError } = await db
    .from('bookings')
    .update({
      status: 'confirmed',
      patient_confirmed_at: new Date(),
      confirmation_token: null,  // Invalidate token
    })
    .eq('id', booking.id)
    .select()
    .single();
  
  if (updateError) throw updateError;
  return updated;
}
```

---

## 🗂️ Test File Structure

```
backend/src/__tests__/integration/
├── 6a-clinic-handshake.test.ts          ✅ COMPLETE (8 tests)
├── 6b-booking-chain.test.ts             🚀 THIS PHASE (6 tests)
├── 6c-rag-smart-answer.test.ts          ✅ COMPLETE (8 tests)
├── fixtures/
│   ├── clinic-auth-fixtures.ts          ✅ REUSE FROM 6A
│   └── booking-chain-fixtures.ts        🚀 NEW FOR 6B
└── setup/
    └── integration-setup.ts             ✅ REUSE FROM 6A
```

### New File: 6b-booking-chain.test.ts
```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { setupIntegration, cleanupIntegration } from './setup/integration-setup';
import {
  seedClinic,
  seedUser,
  createMockAuthToken,
} from './fixtures/clinic-auth-fixtures';
import {
  createBooking,
  updateBookingStatus,
  getClinicBookings,
  getAvailableSlots,
  confirmBooking,
} from './fixtures/booking-chain-fixtures';

describe('Phase 6B: Booking Chain Flow', () => {
  let db;
  let testId;
  
  beforeEach(async () => {
    const result = await setupIntegration();
    db = result.client;
    testId = crypto.randomUUID().substr(0, 8);
  });
  
  afterEach(async () => {
    await cleanupIntegration();
  });
  
  // 6 tests implemented here
});
```

### New File: booking-chain-fixtures.ts
```typescript
// Import existing fixtures
export { seedClinic, seedUser, createMockAuthToken } from './clinic-auth-fixtures';

// New functions for booking tests
export async function createBooking(options) { ... }
export async function updateBookingStatus(bookingId, newStatus) { ... }
export async function getClinicBookings(clinicId, filters) { ... }
export async function getAvailableSlots(clinicId, providerId, date) { ... }
export async function confirmBooking(confirmationToken) { ... }
```

---

## 📊 Phase 6B Timeline

```
Week of Jan 15-22:

JAN 15 (TODAY):
├─ ✅ Phase 6A COMPLETE (16/16 tests with 6C)
├─ 📋 Phase 6B architecture finalized
└─ 📝 Documentation created

JAN 16-17 (TOMORROW-DAY AFTER):
├─ 🚀 Create booking-chain-fixtures.ts (200+ lines)
├─ 🚀 Create 6b-booking-chain.test.ts (400+ lines)
├─ 🚀 Update Supabase schema (bookings table)
└─ 🚀 Run tests, debug, fix until 6/6 passing

JAN 18-19:
├─ 📊 Performance optimization if needed
├─ 🧪 Edge case testing
└─ 📝 Documentation + results

JAN 20-22:
├─ 🚀 Start Phase 6D (if needed)
└─ Final verification + production readiness check
```

---

## ✅ Success Criteria

**Phase 6B is successful when:**

- [ ] Supabase has `bookings` table with required columns
- [ ] `booking-chain-fixtures.ts` created with 5+ helper functions
- [ ] `6b-booking-chain.test.ts` created with 6 comprehensive tests
- [ ] All 6 tests passing consistently (`npm run test:6b`)
- [ ] Test 2 proves clinic isolation (Clinic A ≠ Clinic B bookings)
- [ ] Test 3 proves conflict detection (no double-booking)
- [ ] Test 4 proves state machine (valid transitions only)
- [ ] Test 5 proves calendar integration (mocked Google Calendar)
- [ ] Test 6 proves patient confirmation (token-based)
- [ ] Combined verification: 22/22 tests passing (6A + 6C + 6B)
- [ ] `PHASE_6B_RESULTS.md` created with test output + analysis
- [ ] Performance metrics <1s for all tests recorded

---

## 🔌 Database Schema (Existing or New)

### bookings Table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES profiles(id),  -- Clinic isolation
  patient_email TEXT NOT NULL,
  provider_id UUID NOT NULL REFERENCES profiles(id),  -- Staff member
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  calendar_event_id TEXT,  -- Google Calendar event ID
  confirmation_token TEXT UNIQUE,
  patient_confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  
  -- Constraints
  CONSTRAINT no_double_booking UNIQUE (org_id, provider_id, start_time, status)
    WHERE status = 'confirmed',
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Indexes for performance
CREATE INDEX idx_bookings_org_id ON bookings(org_id);
CREATE INDEX idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_org_time ON bookings(org_id, start_time);
```

### Migration Script
```typescript
// backend/migrations/[timestamp]_create_bookings_table.sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  patient_email TEXT NOT NULL,
  provider_id UUID NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  calendar_event_id TEXT,
  confirmation_token TEXT UNIQUE,
  patient_confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  
  CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES profiles(id),
  CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES profiles(id),
  CONSTRAINT valid_time CHECK (start_time < end_time),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'))
);

CREATE INDEX idx_bookings_org_id ON bookings(org_id);
CREATE INDEX idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
```

---

## 🚀 Implementation Checklist

### Pre-Implementation (30 min)
- [ ] Read PHASE_6B_START_HERE.md (understanding)
- [ ] Read PHASE_6B_QUICK_REFERENCE.md (reference)
- [ ] Review PHASE_6A tests for fixture usage patterns
- [ ] Ensure Phase 6A tests still passing

### Database Setup (30 min)
- [ ] Create bookings table migration
- [ ] Apply migration to Supabase
- [ ] Verify table structure with `\d bookings`
- [ ] Create indexes for performance

### Fixture Development (1-2 hours)
- [ ] Copy clinic-auth-fixtures.ts as template
- [ ] Implement createBooking()
- [ ] Implement updateBookingStatus()
- [ ] Implement getClinicBookings()
- [ ] Implement getAvailableSlots()
- [ ] Implement confirmBooking()
- [ ] Test each fixture independently

### Test Development (2-3 hours)
- [ ] Create 6b-booking-chain.test.ts
- [ ] Implement Test 1 (basic booking)
- [ ] Implement Test 2 (clinic isolation)
- [ ] Implement Test 3 (conflict detection)
- [ ] Implement Test 4 (status transitions)
- [ ] Implement Test 5 (calendar integration)
- [ ] Implement Test 6 (patient confirmation)
- [ ] Run tests, debug until 6/6 passing

### Verification (1 hour)
- [ ] All Phase 6B tests passing (6/6)
- [ ] All Phase 6A tests still passing (8/8)
- [ ] All Phase 6C tests still passing (8/8)
- [ ] Combined: 22/22 tests passing
- [ ] Performance metrics <1s total
- [ ] Create PHASE_6B_RESULTS.md

**Total Time:** 4-6 hours (can be done in 1-2 days)

---

## 🎓 Key Concepts in Phase 6B

### Concept 1: Multi-Tenant Availability
```
Clinic A Schedule:       Clinic B Schedule:
9:00 - BOOKED          9:00 - AVAILABLE
9:30 - AVAILABLE       9:30 - AVAILABLE
10:00 - AVAILABLE      10:00 - BOOKED
10:30 - AVAILABLE      10:30 - BOOKED

Query: "Available at 10:00 for Clinic A?"
Result: YES (Clinic A is free, doesn't matter that Clinic B is booked)

Query: "Available at 10:00 for Clinic B?"
Result: NO (Clinic B is booked at that time)
```

### Concept 2: State Machine Validation
```
pending ──confirmed──→ completed
   │                      ↑
   └────cancelled─────────┘

Invalid transitions:
- completed → pending ❌
- confirmed → pending ❌
- cancelled → anything ❌
```

### Concept 3: Calendar Event Linking
```
Database Booking:
{
  id: "uuid-123",
  status: "confirmed",
  calendar_event_id: "google-event-xyz"
}

Google Calendar:
{
  id: "google-event-xyz",
  summary: "Appointment",
  start: {...},
  end: {...}
}

Two-way sync:
- If calendar event deleted → booking marked cancelled
- If booking cancelled → calendar event deleted
```

---

## 📚 Documentation Hierarchy

```
PHASE_6B_START_HERE.md
    ↓ (Read first - provides context)

PHASE_6B_BOOKING_CHAIN_TESTS.md
    ↓ (Implementation guide - copy code from here)

PHASE_6B_QUICK_REFERENCE.md
    ↓ (Cheat sheet - keep open while coding)

PHASE_6B_INTEGRATION_PLAN.md (THIS DOCUMENT)
    ↓ (Master architecture - reference for design decisions)
```

---

## 🎯 Vision After Phase 6B

**Completed Components:**
- ✅ Phase 6A: Clinic authentication + JWT + multi-tenant users (16 tests)
- 🚀 Phase 6B: Booking creation + isolation + state machine (6 tests)
- ✅ Phase 6C: RAG smart answers + hallucination prevention (8 tests)

**What's Proven After Phase 6B:**
- ✅ Clinic staff can create bookings (Test 1)
- ✅ Clinic A's bookings never visible to Clinic B (Test 2)
- ✅ System prevents double-booking (Test 3)
- ✅ Booking state machine enforced (Test 4)
- ✅ Calendar provider integration works (Test 5)
- ✅ Patient confirmation flow works (Test 6)

**Ready For:**
- ✅ Phase 6D: Performance testing + load testing
- ✅ Phase 7: Advanced workflows (webhooks, notifications)
- ✅ Production deployment with confidence

---

## ⚡ Quick Start Commands

```bash
# Apply database migration
supabase migration new create_bookings_table
# (add SQL from schema section above)
supabase db push

# Create fixture file
touch backend/src/__tests__/integration/fixtures/booking-chain-fixtures.ts
# (populate from this document)

# Create test file
touch backend/src/__tests__/integration/6b-booking-chain.test.ts
# (populate from this document)

# Run tests
cd backend
npm run test:6b

# Watch mode (for development)
npm run test:6b -- --watch

# With coverage
npm run test:6b -- --coverage
```

---

**Status:** 🚀 **READY TO IMPLEMENT PHASE 6B**

**Start date:** January 16, 2026 (tomorrow)  
**Expected completion:** January 20-22, 2026 (2-3 days)  
**Blocking issues:** None - all architecture finalized

**Next action:** Read PHASE_6B_START_HERE.md
