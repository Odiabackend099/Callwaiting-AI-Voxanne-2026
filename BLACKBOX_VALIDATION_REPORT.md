# Black Box Validation Report
## CallWaiting AI - Production Readiness Assessment
### Generated: January 18, 2026

---

## Executive Summary

**Overall Status**: ⚠️ **2 of 4 Production Criteria PASSED**

The system demonstrates **strong multi-tenant isolation** and **proper date normalization**, but requires urgent fixes to **slot conflict prevention** and **contact record creation** before production deployment.

---

##  Test Results

### ✅ CRITERION 2: DATE HALLUCINATION PREVENTION - **PASSED**
**Test**: Send booking for "January 20th" (without year)
**Expected**: Backend interprets as 2026, not past year
**Result**: ✅ **PASSED**
**Evidence**:
- Booking submitted for 2026-01-20T09:00:00
- Database record shows correct year (2026)
- Date normalization function (`normalizeBookingData.ts`) working correctly
- Logs confirm: `isPast(parsedDate) → false` 

**Code Location**: [backend/src/utils/normalizeBookingData.ts](backend/src/utils/normalizeBookingData.ts#L48-L65)

---

### ✅ CRITERION 4: MULTI-TENANT ISOLATION - **PASSED**
**Test**: Book same slot time in Org_A and Org_B independently
**Expected**: Both should succeed (different orgs don't block each other)
**Result**: ✅ **PASSED**
**Evidence**:
- Org A booking created: `99319cc7-9111-4675-9150-1731ef59d4cd`
- Org B booking created: `12570a91-dbe7-4dd8-8188-84f56d59018a`
- Same time slot (2026-02-15 11:00), different orgs
- Both appointments successfully persisted
- No cross-org blocking detected

**Code Location**: 
- Multi-tenant enforcement: [backend/src/routes/vapi-tools-routes.ts](backend/src/routes/vapi-tools-routes.ts#L741) (orgId extraction)
- RLS policies: `supabase/migrations/` (org_id WHERE clause enforcement)

---

### ❌ CRITERION 1: DATA NORMALIZATION - **FAILED**
**Test**: Send booking with messy phone `(555) 123-4567` and name `john doe`
**Expected**: Stored as `+15551234567` (E.164) and `John Doe` (Title Case)
**Result**: ❌ **FAILED** - Contact record not created
**Root Cause**: 
- Booking function calls `book_appointment_atomic` RPC
- RPC queries `contacts` table, but system uses `leads` table
- Lead record never created → Cannot verify phone/name normalization
- API response shows appointment created, but contact lookup fails

**Evidence**:
- Appointment created: `a08299bd-7ee2-4229-a316-b91670cafa6e`
- Contact ID not returned from RPC
- REST API query for lead record returns empty: `GET /rest/v1/leads?id=eq.{contact_id}`

**Code Issues**:
1. RPC queries wrong table: `FROM contacts` instead of `FROM leads`
2. Response format mismatch: RPC returns `contact_id` but it's not populated
3. No lead record creation in atomic function

**Code Location**: 
- Booking RPC: [backend/migrations/create_atomic_booking.sql](backend/migrations/create_atomic_booking.sql) (line ~40)
- Expected table: `leads` (actual: `contacts`)

---

### ❌ CRITERION 3: ATOMIC CONFLICT PREVENTION - **FAILED**
**Test**: Book same slot twice for same org_id
**Expected**: First succeeds, second returns `slot_unavailable` error
**Result**: ❌ **FAILED** - Both bookings accepted
**Root Cause**: 
- `book_appointment_atomic` RPC has NO slot conflict detection
- Function only creates contacts/appointments without checking for duplicates
- No advisory locks or slot availability checks
- Multiple bookings allowed on same `scheduled_at` + `org_id`

**Evidence**:
- First booking: `10c77daf-de74-46f1-adb8-5d1b7bf62ec6` (2026-02-01 15:00)
- Second booking: `132b79b6-cc36-4ff6-a903-e0314befc1eb` (same time, same org)
- Both returned `success: true`
- No error message or alternative suggestions

**Code Issues**:
1. RPC function missing `pg_advisory_xact_lock()` for atomic slot claiming
2. No pre-insert slot availability check
3. No conflict detection logic
4. Function design allows unlimited bookings on same slot

**Code Location**: 
- Booking RPC: [backend/migrations/create_atomic_booking.sql](backend/migrations/create_atomic_booking.sql)
- Missing: slot conflict validation (lines should be ~42-60)

---

## Architecture Issues Identified

### Issue 1: Table Mismatch (`contacts` vs `leads`)
**Severity**: HIGH
**Description**: 
- The system uses `leads` table for patient records (per schema)
- RPC function queries `contacts` table (non-existent or wrong table)
- This breaks contact creation and verification

**Fix Location**:
- [backend/migrations/create_atomic_booking.sql](backend/migrations/create_atomic_booking.sql) - Line ~40
- Change: `FROM contacts` → `FROM leads`
- Ensure all column references match `leads` table schema

---

### Issue 2: No Slot Conflict Detection in RPC
**Severity**: CRITICAL
**Description**: 
- Booking RPC lacks advisory locking mechanism
- No check for duplicate `(org_id, scheduled_at)` combinations
- Allows double-booking when multiple calls try to book same time

**Fix Location**:
- [backend/migrations/create_atomic_booking.sql](backend/migrations/create_atomic_booking.sql) - Add before INSERT
```sql
-- CRITICAL: Acquire lock to prevent race condition
v_lock_key := hashtextextended(p_org_id::TEXT || p_scheduled_at::TEXT, 0);
PERFORM pg_advisory_xact_lock(v_lock_key);

-- Check for existing appointment
IF EXISTS (
    SELECT 1 FROM appointments
    WHERE org_id = p_org_id
    AND scheduled_at = p_scheduled_at
    AND status IN ('confirmed', 'held')
    AND deleted_at IS NULL
) THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END IF;
```

---

### Issue 3: Missing Lead Record Creation Path
**Severity**: HIGH
**Description**: 
- Frontend tests expect `leads` table to have patient records
- Current booking path doesn't create or populate leads
- Contact/lead record needed for SMS sending and confirmation

**Fix Location**:
- [backend/migrations/create_atomic_booking.sql](backend/migrations/create_atomic_booking.sql)
- Add upsert to `leads` table in addition to contacts
- Ensure normalization happens before insert

---

## Recommendations

### Phase 1: Critical Fixes (1-2 days)
1. **Update `book_appointment_atomic` RPC**:
   - Add pg_advisory_xact_lock for atomicity
   - Add pre-insert conflict check
   - Create leads record (not just contacts)
   - Return full normalized data in response

2. **Create new migration**: `20260118_fix_atomic_booking_conflicts.sql`
   - Drop and recreate function with conflict detection
   - Add test cases for duplicate bookings
   - Verify multi-tenant isolation still works

3. **Test**:
   - Re-run Criterion 1 test (verify lead creation)
   - Re-run Criterion 3 test (verify conflict rejection)
   - Confirm Criteria 2 & 4 still pass

### Phase 2: Enhanced Features (1 week)
1. Implement alternative slot suggestions (when conflict detected)
2. Add SMS compliance checks before sending confirmations
3. Integrate calendar availability checking
4. Add idempotency to all booking operations

### Phase 3: Production Hardening (ongoing)
1. Load testing with 1000+ concurrent booking attempts
2. Database monitoring for lock contention
3. Rate limiting per org_id
4. Comprehensive error logging and alerting

---

## Test Scripts & Queries

### To Manually Verify Fixes

**1. Check slot conflicts are prevented**:
```sql
SELECT org_id, scheduled_at, COUNT(*) as booking_count
FROM appointments
WHERE status IN ('confirmed', 'held')
GROUP BY org_id, scheduled_at
HAVING COUNT(*) > 1;
-- Result should be EMPTY (no duplicates)
```

**2. Verify lead records are created**:
```sql
SELECT l.id, l.name, l.phone, l.email, a.scheduled_at
FROM leads l
JOIN appointments a ON l.id = a.contact_id
WHERE a.created_at > NOW() - INTERVAL '1 hour'
ORDER BY a.created_at DESC
LIMIT 5;
-- Result should show normalized phone (+1...) and title case names
```

**3. Check multi-tenant isolation**:
```sql
SELECT org_id, COUNT(*) as total_appointments
FROM appointments
WHERE deleted_at IS NULL
GROUP BY org_id;
-- Result should show appointments distributed per org, no cross-org conflicts
```

---

## Deployment Blockers

| Criterion | Status | Blocker |
|-----------|--------|---------|
| 1. Normalization | ❌ FAIL | Lead table mismatch + RPC doesn't return contact data |
| 2. Date Hallucination | ✅ PASS | - |
| 3. Slot Conflicts | ❌ FAIL | No advisory locks + no conflict check in RPC |
| 4. Multi-Tenant | ✅ PASS | - |

**Production Readiness**: 🟡 **50% - NOT READY** (requires fixes to Criterion 1 & 3)

---

## Next Steps

1. **Immediate** (today):
   - Create SQL migration to fix RPC function
   - Re-run black-box validation
   - Get sign-off from engineering

2. **Before Deployment** (tomorrow):
   - Deploy fixed RPC to staging
   - Run full test suite
   - Verify all 4 criteria pass
   - Load test with concurrent bookings

3. **Post-Deployment** (day 3):
   - Monitor production booking success rate
   - Alert on any slot conflicts detected
   - Gather feedback from beta customers

---

**Report Generated**: 2026-01-18T18:45:00Z  
**Validation Tool**: BLACKBOX_VALIDATION_COMPLETE.py  
**Backend**: http://localhost:3001 (running ✅)  
**Database**: Supabase (connected ✅)
