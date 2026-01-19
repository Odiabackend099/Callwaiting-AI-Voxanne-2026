# 🔗 Curl Testing Examples - Copy & Paste Ready

**Purpose**: Pre-built curl commands ready to copy/paste  
**Audience**: Developers testing booking endpoint  
**Prerequisites**: Backend running on localhost:3001

---

## 📋 Table of Contents

1. Basic Health Check
2. Valid Booking Request
3. Duplicate Slot Test
4. Edge Cases
5. Performance Tests
6. Multi-Org Tests
7. Data Validation Tests
8. Error Scenarios

---

## 1️⃣ Basic Health Check

### Test 1.1: Backend Health

```bash
curl -s http://localhost:3001/health | jq .
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T19:15:00Z",
  "uptime": 3600
}
```

**Success Criteria**: HTTP 200, status = "ok"

---

## 2️⃣ Valid Booking Requests

### Test 2.1: Simple Booking

```bash
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
  }' | jq .
```

**Expected Response**:
```json
{
  "toolCallId": "test-001",
  "result": {
    "success": true,
    "appointmentId": "apt-123-abc-def",
    "message": "Appointment confirmed for 2026-08-15 at 14:00"
  }
}
```

### Test 2.2: Booking with Messy Input (Tests Normalization)

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "test-002",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "jane SMITH",
        "patientPhone": "5559876543",
        "patientEmail": "JANE@EXAMPLE.COM",
        "appointmentDate": "2026-08-16",
        "appointmentTime": "10:00"
      }
    }
  }' | jq .
```

**Expected Response**: Same as Test 2.1, but verify in database:
- Name → "Jane Smith" (title case)
- Email → "jane@example.com" (lowercase)
- Phone → "+15559876543" (E.164 format)

### Test 2.3: Booking with All Fields Valid

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "test-comprehensive-'$(date +%s)'",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Michael Johnson",
        "patientPhone": "+14155551234",
        "patientEmail": "michael.johnson@company.com",
        "appointmentDate": "2026-08-20",
        "appointmentTime": "15:30"
      }
    }
  }' | jq '.'
```

**Expected**: success = true, valid appointmentId returned

---

## 3️⃣ Duplicate Prevention Tests

### Test 3.1: Sequential Bookings - Same Slot (Critical Test)

**First Booking - Should Succeed**:
```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "dup-test-001",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Patient A",
        "patientPhone": "+15551111111",
        "patientEmail": "patientA@example.com",
        "appointmentDate": "2026-08-21",
        "appointmentTime": "09:00"
      }
    }
  }' | jq '.result.success'
```

**Expected**: `true`

**Second Booking - Should Fail (Same slot)**:
```bash
sleep 1  # Wait 1 second

curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "dup-test-002",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Patient B",
        "patientPhone": "+15552222222",
        "patientEmail": "patientB@example.com",
        "appointmentDate": "2026-08-21",
        "appointmentTime": "09:00"
      }
    }
  }' | jq '.result'
```

**Expected Response**:
```json
{
  "success": false,
  "error": "SLOT_UNAVAILABLE",
  "message": "This time slot is already booked"
}
```

**⚠️ CRITICAL**: If second booking returns success=true, **STOP** - do not deploy. Advisory locks are not working.

### Test 3.2: Concurrent Requests (Race Condition Test)

```bash
#!/bin/bash

# Fire 2 requests simultaneously
{
  curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
    -H "Content-Type: application/json" \
    -d '{
      "toolCallId": "race-001",
      "tool": {
        "arguments": {
          "organizationId": "a0000000-0000-0000-0000-000000000001",
          "patientName": "Racer 1",
          "patientPhone": "+15553333333",
          "patientEmail": "racer1@example.com",
          "appointmentDate": "2026-08-22",
          "appointmentTime": "11:00"
        }
      }
    }' | jq '.result.success'
} &

{
  curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
    -H "Content-Type: application/json" \
    -d '{
      "toolCallId": "race-002",
      "tool": {
        "arguments": {
          "organizationId": "a0000000-0000-0000-0000-000000000001",
          "patientName": "Racer 2",
          "patientPhone": "+15554444444",
          "patientEmail": "racer2@example.com",
          "appointmentDate": "2026-08-22",
          "appointmentTime": "11:00"
        }
      }
    }' | jq '.result.success'
} &

wait

# Expected: One true, one false
```

---

## 4️⃣ Edge Cases

### Test 4.1: Missing Required Field

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "edge-001",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Test Patient"
        # Missing: patientPhone, patientEmail, appointmentDate, appointmentTime
      }
    }
  }' | jq '.result'
```

**Expected**: Error response about missing required fields

### Test 4.2: Invalid Email

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "edge-002",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Test Patient",
        "patientPhone": "+15551234567",
        "patientEmail": "not-a-valid-email",
        "appointmentDate": "2026-08-23",
        "appointmentTime": "12:00"
      }
    }
  }' | jq '.result'
```

**Expected**: Either error OR auto-normalization

### Test 4.3: Invalid Date Format

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "edge-003",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Test Patient",
        "patientPhone": "+15551234567",
        "patientEmail": "test@example.com",
        "appointmentDate": "15/08/2026",
        "appointmentTime": "12:00"
      }
    }
  }' | jq '.result'
```

**Expected**: Error about invalid date format

### Test 4.4: Invalid Time Format

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "edge-004",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Test Patient",
        "patientPhone": "+15551234567",
        "patientEmail": "test@example.com",
        "appointmentDate": "2026-08-24",
        "appointmentTime": "25:00"
      }
    }
  }' | jq '.result'
```

**Expected**: Error about invalid time format

### Test 4.5: Past Date

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "edge-005",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Test Patient",
        "patientPhone": "+15551234567",
        "patientEmail": "test@example.com",
        "appointmentDate": "2020-01-01",
        "appointmentTime": "14:00"
      }
    }
  }' | jq '.result'
```

**Expected**: Error about date being in the past

---

## 5️⃣ Performance Tests

### Test 5.1: Response Time

```bash
echo "Testing response time..."

START=$(date +%s%N)
curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "perf-001",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Performance Test",
        "patientPhone": "+15557777777",
        "patientEmail": "perf@example.com",
        "appointmentDate": "2026-08-25",
        "appointmentTime": "13:00"
      }
    }
  }' > /dev/null
END=$(date +%s%N)

DURATION=$(( (END - START) / 1000000 ))
echo "Response time: ${DURATION}ms"
echo "Target: <300ms"
echo "Status: $([ $DURATION -lt 300 ] && echo "✅ PASS" || echo "❌ SLOW")"
```

### Test 5.2: 10 Sequential Bookings (Load Test)

```bash
#!/bin/bash

echo "Running 10 sequential bookings..."
SUCCESS=0
FAILED=0

for i in {1..10}; do
  DATE="2026-08-$((26 + i/2))"
  TIME="$(printf "%02d:00" $((10 + i % 4)))"
  
  RESPONSE=$(curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
    -H "Content-Type: application/json" \
    -d "{
      \"toolCallId\": \"load-$i\",
      \"tool\": {
        \"arguments\": {
          \"organizationId\": \"a0000000-0000-0000-0000-000000000001\",
          \"patientName\": \"Patient $i\",
          \"patientPhone\": \"+1555000000$(printf '%04d' $i)\",
          \"patientEmail\": \"patient$i@example.com\",
          \"appointmentDate\": \"$DATE\",
          \"appointmentTime\": \"$TIME\"
        }
      }
    }")
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    ((SUCCESS++))
    echo "✅ Booking $i success"
  else
    ((FAILED++))
    echo "❌ Booking $i failed"
  fi
done

echo ""
echo "Results: $SUCCESS passed, $FAILED failed"
echo "Success rate: $(( 100 * SUCCESS / 10 ))%"
```

---

## 6️⃣ Multi-Organization Tests

### Test 6.1: Two Organizations - Same Slot

**Org A - First booking**:
```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "multi-org-a-001",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Org A Patient",
        "patientPhone": "+15558888888",
        "patientEmail": "orga@example.com",
        "appointmentDate": "2026-08-30",
        "appointmentTime": "10:00"
      }
    }
  }' | jq '.result.success'
```

**Expected**: `true`

**Org B - Same slot, different org**:
```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "multi-org-b-001",
    "tool": {
      "arguments": {
        "organizationId": "b0000000-0000-0000-0000-000000000001",
        "patientName": "Org B Patient",
        "patientPhone": "+15559999999",
        "patientEmail": "orgb@example.com",
        "appointmentDate": "2026-08-30",
        "appointmentTime": "10:00"
      }
    }
  }' | jq '.result.success'
```

**Expected**: `true` (different org, so same slot is allowed)

**Verification**:
```bash
psql "postgresql://..." -c "
  SELECT org_id, COUNT(*) as bookings
  FROM appointments
  WHERE scheduled_at::date = '2026-08-30' AND scheduled_at::time = '10:00'
  GROUP BY org_id;"

# Expected:
# org_id                               | bookings
# ──────────────────────────────────────┼──────────
# a0000000-0000-0000-0000-000000000001 |        1
# b0000000-0000-0000-0000-000000000001 |        1
```

---

## 7️⃣ Data Validation Tests

### Test 7.1: Check Normalized Data in Database

After running any booking test, verify normalization:

```bash
psql "postgresql://..." -c "
  SELECT 
    id,
    name,
    phone,
    email,
    scheduled_at,
    created_at
  FROM appointments
  WHERE created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY created_at DESC
  LIMIT 1
  \x"

# Review output:
# name → Should be title case (e.g., "John Doe")
# email → Should be lowercase (e.g., "john@example.com")
# phone → Should be E.164 format (e.g., "+15551234567")
# scheduled_at → Should be UTC timestamp
```

---

## 8️⃣ Error Scenarios

### Test 8.1: Invalid Organization

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "error-001",
    "tool": {
      "arguments": {
        "organizationId": "invalid-org-id",
        "patientName": "Test",
        "patientPhone": "+15551234567",
        "patientEmail": "test@example.com",
        "appointmentDate": "2026-09-01",
        "appointmentTime": "14:00"
      }
    }
  }' | jq '.result'
```

**Expected**: Error about invalid organization

### Test 8.2: Malformed JSON

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "error-002",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001"
        "patientName": "Missing comma above - invalid JSON"
      }
    }
  }' | jq '.'
```

**Expected**: HTTP 400 Bad Request

### Test 8.3: Wrong Content-Type

```bash
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: text/plain" \
  -d 'This is not JSON' | jq '.'
```

**Expected**: HTTP 415 Unsupported Media Type (or similar)

---

## 🧪 Test Summary Table

| Test | Command | Expected | Critical |
|------|---------|----------|----------|
| Health | `curl health` | HTTP 200 | No |
| Valid Booking | `curl POST` | success=true | Yes |
| Duplicate | Two same-slot bookings | 1st pass, 2nd fail | **Yes** |
| Normalization | Messy input | Fields cleaned | Yes |
| Multi-Org | Same slot, diff orgs | Both succeed | Yes |
| Performance | Response time | <300ms | Yes |

---

## 📝 Testing Notes

- All tests use `jq` for JSON parsing (install: `brew install jq`)
- Replace `a0000000-0000-0000-0000-000000000001` with your actual org ID
- Dates are in format `YYYY-MM-DD`
- Times are in 24-hour format `HH:MM`
- Phone numbers should be in `+1XXXXXXXXXX` format
- Use unique patient emails for each test (prevents collisions)

---

## 🆘 Common Curl Issues

**Issue**: "curl: command not found"  
**Fix**: `brew install curl`

**Issue**: `jq: command not found`  
**Fix**: `brew install jq`

**Issue**: "Connection refused"  
**Fix**: Start backend: `cd backend && npm run dev`

**Issue**: JSON parse error  
**Fix**: Check endpoint returns valid JSON: `curl http://localhost:3001/health`

---

**Ready to test?** Pick a test above and copy/paste the curl command!

✅ All tests passing? → You're cleared to deploy!
