# Single Source of Truth: Verification & Cleanup Plan

**Date**: January 18, 2026  
**Objective**: Verify database foundation is production-ready AND clean codebase of legacy booking logic  
**Status**: Active

---

## Phase 1: Verify Database Foundation (Prove It Works)

### Goal
Prove the `book_appointment_atomic` RPC handles all 4 critical failure points:
1. **Data Normalization** - names, phones, dates formatted correctly
2. **Date Logic** - missing year defaults to 2026 correctly
3. **Race Conditions** - advisory locks prevent double-booking
4. **Multi-Tenancy** - org isolation is absolute

### Steps
1. **Run Python Validation Suite**
   - Command: `python3 BLACKBOX_VALIDATION_COMPLETE.py`
   - Expected: 4/4 PASS (green checks)
   - Evidence: Output shows all criteria passing

2. **Run Stress Test (10 Concurrent Bookings)**
   - Fire 10 simultaneous requests for exact same slot (2026-06-01 11:00 AM)
   - Expected: 1 success, 9 failures with "slot_unavailable"
   - Evidence: Database shows exactly 1 booking, others fail gracefully

3. **Verify with SQL Query**
   - Check Supabase for exactly 1 booking at that time
   - Verify no double-bookings exist
   - Evidence: SQL results show clean atomic transaction

### Acceptance Criteria
- ✅ Python script completes with 4/4 PASS
- ✅ Stress test shows 1 winner, 9 losers
- ✅ Database contains exactly 1 booking for the contested slot
- ✅ All tests run without crashes or unhandled errors

---

## Phase 2: Clean Sweep (Remove Legacy Code)

### Goal
Eliminate all "V2", legacy, and duplicate booking logic to prevent:
- Developers calling wrong function
- Deployment confusion
- Dead code causing bugs

### Steps
1. **Scan for Ghost Functions**
   - Find: `book_appointment_atomic_v2` references
   - Find: Any "legacy" booking handlers
   - Find: Commented-out test blocks in production code

2. **Check Migrations**
   - Scan: `supabase/migrations/` for old function definitions
   - Verify: Only latest version is deployed
   - Risk: Old migration could re-create deleted function

3. **Clean Backend Routes**
   - File: `backend/src/routes/vapi-tools-routes.ts`
   - Action: Remove any manual booking logic, keep only RPC call
   - Verify: Single entry point for all booking requests

4. **Remove Dead Imports & Code**
   - Strip: Unused imports related to old booking logic
   - Strip: Test/debug blocks left in production code
   - Result: Cleaner, smaller, faster codebase

### Acceptance Criteria
- ✅ `grep -r "book_appointment_atomic_v2"` returns 0 matches
- ✅ `grep -r "bookAppointmentLegacy"` returns 0 matches
- ✅ `vapi-tools-routes.ts` has single booking entry point
- ✅ No commented-out test code in production files
- ✅ All imports used (no dangling references)

---

## Phase 3: Generate Verification Report

### Goal
Create audit trail showing what was verified and what was cleaned

### Deliverables
1. **Verification Results**
   - Python validation output (4/4 PASS)
   - Stress test results (1 success, 9 failures)
   - Database query showing atomic transaction worked

2. **Code Cleanup Report**
   - List of files scanned
   - List of files modified
   - List of legacy code removed
   - Confirmation: No ghost migrations remain

3. **Production Readiness Checklist**
   - ✅ Database logic verified
   - ✅ Race conditions handled
   - ✅ Multi-tenancy enforced
   - ✅ Legacy code removed
   - ✅ Ready for Google Calendar integration

---

## Timeline

| Phase | Est. Time | Status |
|-------|-----------|--------|
| Phase 1: Verify DB | 15 min | Not Started |
| Phase 2: Clean Sweep | 20 min | Not Started |
| Phase 3: Report | 10 min | Not Started |
| **TOTAL** | **45 min** | **In Progress** |

---

## Success Criteria (All Must Pass)

- [x] Plan created
- [ ] Python validation: 4/4 PASS
- [ ] Stress test: 1 winner, 9 losses
- [ ] Database query: Exactly 1 booking at contested time
- [ ] No "v2" functions found in codebase
- [ ] No legacy booking logic in routes
- [ ] No ghost migrations remain
- [ ] Final report generated

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Python script fails to run | Check Python 3 installed, dependencies present |
| Stress test shows 2+ bookings | Advisory locks not working—must fix SQL |
| Found "v2" references | Delete immediately, verify no migrations recreate it |
| Backend crashes during test | Check error logs, trace parameter mismatch |
| Production deployment fails | Review environment variables, database connection |

---

## Notes

- **Database is the source of truth** - If DB passes validation, API layer must respect it
- **Advisory locks are the bouncer** - 10 requests = 1 winner + 9 queued rejections
- **Clean code = fewer bugs** - Removing legacy paths reduces deployment risk
- **This is the final foundation check before Google Calendar integration**

---

**Next Action**: Execute Phase 1 - Run Python validation script
