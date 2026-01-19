# Verification Execution Guide

## 🚀 Quick Start: Run All Tests

### Step 1: Get Your Credentials
```bash
# Get VAPI_PRIVATE_KEY from backend/.env
cat backend/.env | grep VAPI_PRIVATE_KEY

# Get VAPI_ASSISTANT_ID from Vapi dashboard or your config
# Usually available at: https://dashboard.vapi.ai/assistants
```

### Step 2: Set Environment Variables
```bash
export VAPI_PRIVATE_KEY="your-vapi-private-key-here"
export VAPI_ASSISTANT_ID="your-assistant-id-here"
```

**Verify they're set:**
```bash
echo "VAPI_PRIVATE_KEY: $VAPI_PRIVATE_KEY"
echo "VAPI_ASSISTANT_ID: $VAPI_ASSISTANT_ID"
```

### Step 3: Ensure Backend is Running
```bash
# In another terminal, start the backend
cd backend
npm run dev

# Verify it's running:
curl -s http://localhost:3001/health | jq .
# Expected: { "status": "ok" }
```

### Step 4: Run the Verification Suite
```bash
./run-verification-tests.sh
```

---

## 📊 Expected Results

### Test 1: Vapi Assistant Details
**Command**: Get assistant and verify `bookClinicAppointment` tool is registered  
**Expected**: Tool definition with 5 parameters:
- `patientName`
- `patientPhone`
- `patientEmail`
- `appointmentDate`
- `appointmentTime`

### Test 2: Tool Endpoint Reachability
**Command**: Test tool execution via Vapi  
**Expected**: `success: true` with valid `appointmentId`

### Test 3: Backend Health Check
**Command**: Simple health endpoint  
**Expected**: HTTP 200, `status: "ok"`

### Test 4: Valid Booking Creation
**Command**: Create appointment with valid data  
**Expected**: `success: true` with valid `appointmentId`

### Test 5: Duplicate Prevention - First Booking
**Command**: Book 2026-08-21 at 09:00  
**Expected**: `true` ✅ (First booking succeeds)

### Test 6: Duplicate Prevention - Second Booking (CRITICAL)
**Command**: Try to book same slot 2026-08-21 at 09:00  
**Expected**: `error: "SLOT_UNAVAILABLE"` ✅

**⚠️ CRITICAL**: If Test 6 returns `success: true`, **STOP** - Advisory locks are broken and duplicate prevention is failing.

---

## ✅ All Tests Pass?

If all 6 tests pass:

1. **Make a live test call**
   - Call your clinic's AI phone number
   - Request appointment for specific date/time
   - Verify booking appears in Supabase within 5 seconds

2. **Verify data normalization**
   - Check that phone is E.164 format: `+1XXXXXXXXXX`
   - Check that email is lowercase
   - Check that name is title case: `John Doe`

3. **Check database records**
   ```sql
   SELECT * FROM appointments 
   WHERE patient_phone LIKE '%555%' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

4. **Sign off on pre-deployment checklist**
   - ✅ All automated tests pass
   - ✅ Vapi API integration verified
   - ✅ Backend health confirmed
   - ✅ Valid booking creation works
   - ✅ Duplicate prevention working (CRITICAL)
   - ✅ Data normalized correctly
   - ✅ Database records created
   - ✅ Ready for production deployment

---

## 🔴 Tests Fail?

### Troubleshooting Matrix

| Issue | Solution |
|-------|----------|
| `VAPI_PRIVATE_KEY not set` | `export VAPI_PRIVATE_KEY="..."` |
| `VAPI_ASSISTANT_ID not set` | `export VAPI_ASSISTANT_ID="..."` |
| `Backend health check fails` | Verify backend running: `npm run dev` in `backend/` directory |
| `Vapi API test fails` | Verify VAPI_PRIVATE_KEY is correct; check Vapi dashboard |
| `Valid booking fails` | Check backend logs for errors; verify database connection |
| **Test 6 returns `success: true`** | 🚨 CRITICAL: Advisory locks broken - review `bookClinicAppointment` implementation |
| `Connection refused on localhost:3001` | Backend not running; start with `cd backend && npm run dev` |
| `jq command not found` | Install with `brew install jq` |

### Check Backend Logs
```bash
# If using npm run dev, you should see:
# - Request received
# - Database query executed
# - Response sent

# Look for errors like:
# - "SLOT_UNAVAILABLE"
# - "pg_advisory_xact_lock failed"
# - "Database connection error"
```

### Manual Test (If Script Fails)

Run individual curl commands:

```bash
# Test 1: Vapi assistant details
curl -X GET "https://api.vapi.ai/assistant/$VAPI_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_PRIVATE_KEY" | jq '.tools[] | select(.function.name=="bookClinicAppointment")'

# Test 2: Backend health
curl -s http://localhost:3001/health | jq .

# Test 3: Valid booking
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "test-001",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "John Doe",
        "patientPhone": "+15551234567",
        "patientEmail": "john@example.com",
        "appointmentDate": "2026-08-15",
        "appointmentTime": "14:00"
      }
    }
  }' | jq '.result'
```

---

## 📋 Pre-Deployment Checklist

After all tests pass, complete this checklist:

- [ ] **Security**: VAPI_PRIVATE_KEY never exposed in frontend
- [ ] **Data Isolation**: Only organization A can see org A's data
- [ ] **Latency**: All responses < 300ms (p95)
- [ ] **Availability**: No "SLOT_UNAVAILABLE" errors on valid slots
- [ ] **Reliability**: Zero race conditions (Test 6 proves this)
- [ ] **Compliance**: All patient data fields populated correctly
- [ ] **Monitoring**: Backend logs show all requests processed
- [ ] **Database**: Supabase shows new appointment records

**Checklist Status**: 
```
[ ] Test 1-6 all passing
[ ] Live test call successful
[ ] Database records verified
[ ] Data normalization confirmed
[ ] Ready to deploy
```

---

## 🎯 Success Criteria

**Deployment is APPROVED when:**

✅ All 6 automated tests pass  
✅ Test 6 (duplicate prevention) correctly returns `SLOT_UNAVAILABLE`  
✅ Live test call creates booking in database  
✅ All data normalized (E.164 phone, lowercase email, title case name)  
✅ No errors in backend logs  
✅ Response times consistently < 300ms  

---

## 📞 Next Step: Live Test Call

Once automated tests pass:

1. **Get clinic phone number** (where Vapi is configured to answer)
2. **Call the number** and say something like:
   - "I'd like to book an appointment for Thursday at 2 PM"
   - Or your clinic's booking request format
3. **Verify Vapi responds** with confirmation
4. **Check Supabase** within 5 seconds:
   ```sql
   SELECT id, patient_phone, scheduled_at, status 
   FROM appointments 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
5. **Verify data quality**:
   - Phone is `+1...` format (E.164)
   - Email is lowercase
   - Name is title case

---

## 🚀 Ready to Deploy?

If all tests pass and live call succeeds:

```bash
# Deploy to production
# (Following your deployment checklist)

# Monitor first 24 hours
# - Error rate < 0.1%
# - Latency p95 < 500ms
# - No duplicate booking reports
```

---

## Support

**Tests stuck?** Check:
1. Backend logs: `npm run dev` output
2. Vapi dashboard: Verify tool registration
3. Supabase dashboard: Verify data models exist
4. Environment: `echo $VAPI_PRIVATE_KEY $VAPI_ASSISTANT_ID`

**All passing?** You're ready to deploy! 🎉
