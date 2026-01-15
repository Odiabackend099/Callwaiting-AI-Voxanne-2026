# Phase 6A: Clinic Handshake Flow - Architecture & Tests

**Date:** January 15, 2026  
**Status:** 🚀 READY TO EXECUTE  
**Duration:** 1-2 days  
**Target Completion:** January 16-17, 2026

---

## What is the Clinic Handshake Flow?

The **Handshake** is the complete auth and clinic onboarding pipeline:

```
New Clinic Admin
    ↓
[SIGNUP] Create clinic account
    ↓
[AUTH] Generate Supabase auth tokens
    ↓
[PROFILE] Create user profile in database
    ↓
[JWT] Validate JWT and claims
    ↓
[PERMISSIONS] Verify clinic-specific access
    ↓
✅ Clinic Ready for Use
```

---

## 5 Critical Success Points

### 1. **Clinic Signup** ✅
- New clinic account created with UUID
- Email validation
- Clinic data stored in `orgs` table
- Success: `orgs` record exists

### 2. **Auth Token Generation** ✅
- Supabase auth creates JWT token
- Token includes clinic ID in custom claims
- Token has 24-hour expiration
- Success: Valid JWT with org_id claim

### 3. **User Profile Creation** ✅
- User profile stored in `profiles` table
- Links user to clinic (org_id)
- Email and metadata preserved
- Success: Profile accessible with clinic filter

### 4. **JWT Validation** ✅
- Token can be decoded and verified
- Claims include org_id
- Expiration is correct
- Success: JWT verifies without errors

### 5. **Permission Enforcement** ✅
- Clinic A user cannot access Clinic B data
- RLS policies block cross-tenant queries
- Error returned on unauthorized access
- Success: Isolation tested and proven

---

## Integration Test Plan

### Test 1: Clinic Account Creation
**What:** Create new clinic account  
**Setup:** Fresh UUID, email, clinic name  
**Action:** Insert into `orgs` table  
**Validate:** Record exists with correct ID  
**Fail Scenario:** Duplicate email  

### Test 2: Auth Token Generation
**What:** Generate auth JWT  
**Setup:** Clinic account exists  
**Action:** Call Supabase auth endpoint  
**Validate:** Token is valid JWT with org_id  
**Fail Scenario:** Invalid credentials  

### Test 3: User Profile Creation
**What:** Create user profile  
**Setup:** Auth token exists  
**Action:** Insert into `profiles` table  
**Validate:** Profile links to clinic  
**Fail Scenario:** Missing clinic reference  

### Test 4: JWT Claims Validation
**What:** Decode and verify JWT  
**Setup:** Token generated  
**Action:** Decode JWT and check claims  
**Validate:** org_id present and correct  
**Fail Scenario:** Tampered token  

### Test 5: Profile Retrieval with Clinic Filter
**What:** Fetch profile with org_id filter  
**Setup:** Profile created  
**Action:** Query profiles WHERE org_id = clinic_id  
**Validate:** Correct profile returned  
**Fail Scenario:** Empty result (isolation working)  

### Test 6: Cross-Clinic Isolation
**What:** Clinic B cannot see Clinic A profile  
**Setup:** Two clinics created  
**Action:** Clinic B queries Clinic A's profile  
**Validate:** Zero results returned  
**Fail Scenario:** Clinic A data leaked to B  

### Test 7: Complete Handshake Flow
**What:** Full signup → auth → profile → JWT → permission flow  
**Setup:** Nothing (from scratch)  
**Action:** Execute all 5 handshake steps  
**Validate:** All steps successful  
**Fail Scenario:** Any step fails  

---

## Key Differences from Phase 6C

| Aspect | Phase 6C | Phase 6A |
|--------|----------|----------|
| **Focus** | RAG & hallucination prevention | Auth & clinic setup |
| **Database** | Profiles (read-only) | Orgs + Profiles (read/write) |
| **External API** | None needed | Supabase Auth |
| **Main Risk** | AI inventing info | Cross-tenant data leakage |
| **Performance** | Query speed | Auth latency |
| **Complexity** | Medium | High |

---

## Test Infrastructure Setup

### New Fixtures Needed
1. **clinic-auth-fixtures.ts**
   - `seedClinic()` - Create clinic account
   - `seedUser()` - Create user profile
   - `createAuthToken()` - Generate JWT
   - `decodeJWT()` - Verify token claims

2. **auth-helpers.ts**
   - `generateClinicEmail()` - Unique test email
   - `parseJWTClaims()` - Extract org_id
   - `verifyClinicAccess()` - Check RLS policy

### Modified Files
- `6a-clinic-handshake.test.ts` - Main test suite
- `integration-setup.ts` - Add auth helpers

---

## Success Criteria

- [ ] Clinic signup works (test 1)
- [ ] Auth tokens generated (test 2)
- [ ] Profiles created and linked (test 3)
- [ ] JWT claims valid (test 4)
- [ ] Profile queries with clinic filter work (test 5)
- [ ] Cross-clinic isolation enforced (test 6)
- [ ] Complete handshake succeeds (test 7)
- [ ] All tests pass in <10 seconds total
- [ ] No database errors
- [ ] Ready for Phase 6B

---

## Estimated Timeline

### Phase 6A Execution (Jan 16-17)

**Jan 16 Morning (1-2 hours)**
- Create clinic-auth-fixtures.ts
- Create 6a-clinic-handshake.test.ts
- Run tests (expect 2-3 failures, iterate)

**Jan 16 Afternoon (1-2 hours)**
- Fix failing tests
- Validate clinic isolation
- Verify JWT handling

**Jan 17 Morning (30 min)**
- Final validation
- Document results
- Prepare for Phase 6B

**Success:** 7/7 tests passing by Jan 17 noon
**Blocker:** RLS policies need correct configuration

---

## RLS Policy Requirements

For clinic isolation to work, these RLS policies must be active:

```sql
-- profiles table: Only owner can read
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- orgs table: Only clinic admin can read
CREATE POLICY "Clinic members can read org"
ON orgs FOR SELECT
USING (id IN (
  SELECT org_id FROM profiles 
  WHERE id = auth.uid()
));
```

---

## What Happens If Tests Fail

### Scenario 1: Cross-tenant data leak
**Symptom:** Clinic B sees Clinic A profile  
**Fix:** Enable/fix RLS policy on profiles table  
**Test:** `test('should isolate clinics from each other')`

### Scenario 2: Invalid JWT
**Symptom:** Decoded JWT missing org_id  
**Fix:** Update auth token generation to include org_id in custom claims  
**Test:** `test('should include org_id in JWT claims')`

### Scenario 3: Profile not linked to clinic
**Symptom:** Profile created but org_id is null  
**Fix:** Verify INSERT statement includes org_id  
**Test:** `test('should create profile with clinic reference')`

---

## Architecture Decision: JWT Claims Structure

```json
{
  "sub": "user-uuid",
  "email": "admin@clinic.com",
  "org_id": "clinic-uuid",
  "role": "admin",
  "iat": 1673000000,
  "exp": 1673086400
}
```

**Why this structure:**
- `sub` = User ID (Supabase standard)
- `org_id` = Clinic ID (custom claim for RLS)
- `role` = Permission level (future expansion)
- `exp` = 24-hour expiration (standard)

---

## Next Phase (6B) Preview

After Phase 6A succeeds, Phase 6B will test:
1. **Booking creation** - New appointment in KB
2. **Clinic-specific bookings** - Filtered by org_id
3. **Booking retrieval** - Query and display
4. **Permission on bookings** - Only clinic can see
5. **Calendar sync** - Sync booking to Google Calendar

**Dependencies:** Phase 6A JWT must work (needed for booking auth)

---

## Command Reference

### Run Phase 6A Tests
```bash
cd backend
npx jest src/__tests__/integration/6a-clinic-handshake.test.ts --verbose
```

### Expected Output
```
PASS src/__tests__/integration/6a-clinic-handshake.test.ts
  Clinic Handshake Flow
    ✓ should create new clinic account
    ✓ should generate auth token with org_id
    ✓ should create user profile linked to clinic
    ✓ should validate JWT claims correctly
    ✓ should retrieve profile with clinic filter
    ✓ should isolate clinics from each other
    ✓ should complete full handshake flow

Tests: 7 passed, 0 failed
Time:  ~8-10 seconds
```

---

## Validation Checklist

- [ ] Phase 6C tests still passing (regression)
- [ ] Clinic account creation working
- [ ] Auth tokens valid and contain org_id
- [ ] Profiles linked to clinics
- [ ] JWT decoding works
- [ ] Cross-clinic isolation enforced
- [ ] Full handshake flow succeeds
- [ ] Ready for Phase 6B

---

## Status

🚀 **Ready to execute immediately**

All Phase 6C tests passing provides foundation:
- ✅ Supabase connection proven
- ✅ Database queries working
- ✅ Multi-tenant architecture baseline

Phase 6A builds on this by adding:
- ✅ Auth/JWT validation
- ✅ RLS policy enforcement
- ✅ Clinic isolation at permission layer

**Next Command:** Create clinic-auth-fixtures.ts
