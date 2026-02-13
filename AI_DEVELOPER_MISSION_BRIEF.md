# 🎯 AI Developer Mission Brief: Dashboard API Enhancement & Security Audit

**Role:** Senior Full-Stack Developer
**Reporting To:** CTO
**Priority:** P0 - Critical
**Deadline:** Complete within 1 session
**Success Criteria:** 100% test coverage, zero security gaps, zero edge cases unhandled

---

## 📋 MANDATORY PRE-WORK: READ THESE FILES FIRST

**YOU MUST READ THESE FILES BEFORE STARTING ANY WORK:**

1. **`.agent/prd.md`** - Product Requirements Document
   - Understand the complete product architecture
   - Review all functional requirements
   - Note the Golden Record SSOT implementation

2. **`.agent/database-ssot.md`** - Database Schema Single Source of Truth
   - Study the complete database schema
   - Understand all table relationships
   - Note the RLS policies and multi-tenant isolation
   - Review the Golden Record fields in `calls` and `appointments` tables

3. **`API_VERIFICATION_REPORT.md`** - Current API Verification Status
   - Review what has been tested so far
   - Identify what gaps remain
   - Understand the current test coverage

**DO NOT PROCEED UNTIL YOU HAVE READ ALL THREE FILES.**

---

## 🎯 MISSION OBJECTIVE

You are tasked with conducting a **comprehensive security audit, edge case analysis, and enhancement** of the Voxanne AI dashboard API endpoints. This is not a surface-level review - you must dig deep into every corner of the system.

### What We've Done So Far

We have:
- ✅ Implemented Golden Record SSOT (cost_cents, appointment_id, tools_used, ended_reason, outcome, outcome_summary, sentiment fields)
- ✅ Created 4 main dashboard API endpoints
- ✅ Verified basic functionality with test data
- ✅ Confirmed outcome summaries are 3 sentences
- ✅ Verified multi-tenant isolation on happy path

### What You Must Do

You must **go beyond basic verification** and ensure:
1. **Zero security vulnerabilities** - No data leaks, no authorization bypasses, no injection attacks
2. **Zero edge cases unhandled** - Every error scenario has proper handling
3. **100% data integrity** - All fields populated correctly, no NULL where shouldn't be
4. **Complete test coverage** - Every code path tested, every scenario validated
5. **Production-ready** - Can handle real traffic, real users, real edge cases

---

## 🔍 CRITICAL AREAS TO INVESTIGATE

### 1. Multi-Tenant Security Audit (P0 - CRITICAL)

**OBJECTIVE:** Ensure zero possibility of cross-tenant data leakage.

**YOU MUST CHECK:**

#### Database Level
```sql
-- Check for any calls without org_id (data leak risk)
SELECT COUNT(*) FROM calls WHERE org_id IS NULL;

-- Check for any calls visible across tenants
SELECT org_id, COUNT(*) as call_count
FROM calls
GROUP BY org_id
ORDER BY call_count DESC;

-- Verify RLS policies are ENABLED (not just created)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('calls', 'appointments', 'contacts', 'organizations')
ORDER BY tablename, policyname;

-- Check for any foreign key violations
SELECT c.id, c.org_id, c.contact_id, ct.org_id as contact_org_id
FROM calls c
LEFT JOIN contacts ct ON c.contact_id = ct.id
WHERE c.contact_id IS NOT NULL
  AND c.org_id != ct.org_id;

-- Check for appointment linkage violations
SELECT c.id, c.org_id, a.org_id as appointment_org_id
FROM calls c
INNER JOIN appointments a ON c.appointment_id = a.id
WHERE c.org_id != a.org_id;
```

#### API Level
Test EVERY endpoint with:
1. **Valid JWT for Org A** - Should see only Org A data
2. **Valid JWT for Org B** - Should see only Org B data
3. **Expired JWT** - Should return 401 Unauthorized
4. **Malformed JWT** - Should return 401 Unauthorized
5. **JWT with fake org_id** - Should return empty results or 403
6. **No JWT** - Should return 401 Unauthorized
7. **JWT from different database** - Should fail validation

Create test script: `backend/src/scripts/audit-multi-tenant-security.ts`

#### Code Audit
Search codebase for:
```bash
# Find any queries without org_id filtering
grep -r "FROM calls" backend/src --include="*.ts" | grep -v "org_id"
grep -r "FROM appointments" backend/src --include="*.ts" | grep -v "org_id"
grep -r "FROM contacts" backend/src --include="*.ts" | grep -v "org_id"

# Find any .single() queries (potential RLS bypass)
grep -r "\.single()" backend/src/routes/*.ts

# Find any raw SQL (injection risk)
grep -r "sql\`" backend/src --include="*.ts"
grep -r "query(" backend/src --include="*.ts"
```

---

### 2. Edge Case Testing (P0 - CRITICAL)

**OBJECTIVE:** Identify and handle ALL edge cases.

**YOU MUST TEST:**

#### Call Detail Endpoint: `GET /api/calls-dashboard/:callId`

**Edge Cases:**
1. ✅ Call exists and belongs to requesting org
2. ⚠️ Call exists but belongs to different org (should return 404, not 403)
3. ⚠️ Call ID is invalid UUID format (should return 400, not 500)
4. ⚠️ Call ID is valid UUID but doesn't exist (should return 404)
5. ⚠️ Call has NULL for sentiment_summary (should handle gracefully)
6. ⚠️ Call has NULL for outcome_summary (should handle gracefully)
7. ⚠️ Call has empty transcript array (should not crash)
8. ⚠️ Call has malformed transcript (non-array) (should sanitize)
9. ⚠️ Call has recording_storage_path but file doesn't exist (should handle)
10. ⚠️ Call has huge transcript (>10MB) (should paginate or truncate)
11. ⚠️ Call has foreign characters in caller_name (should escape properly)
12. ⚠️ Call has SQL injection attempt in phone_number (should sanitize)
13. ⚠️ Call has XSS attempt in transcript (should sanitize)
14. ⚠️ Call is from deleted contact (contact_id FK is NULL) (should handle)
15. ⚠️ Call has appointment_id but appointment was deleted (should handle)

#### Call List Endpoint: `GET /api/calls-dashboard`

**Edge Cases:**
1. ⚠️ No calls for org (should return empty array, not error)
2. ⚠️ Limit is negative (should return 400)
3. ⚠️ Limit is 0 (should return empty array or default to 10)
4. ⚠️ Limit is > 1000 (should cap at max, not allow unbounded)
5. ⚠️ Offset is negative (should return 400)
6. ⚠️ Offset is beyond total count (should return empty array)
7. ⚠️ Invalid filter parameters (should return 400 with clear message)
8. ⚠️ Filter by non-existent contact_id (should return empty, not error)
9. ⚠️ Sort by invalid column (should return 400)
10. ⚠️ Date range filter with end before start (should return 400)
11. ⚠️ Org has 100,000+ calls (should paginate efficiently, not timeout)
12. ⚠️ Concurrent requests (should handle without race conditions)

#### Dashboard Stats Endpoint: `GET /api/calls-dashboard/stats`

**Edge Cases:**
1. ⚠️ Org has 0 calls (should return zeros, not null)
2. ⚠️ All calls have NULL duration (should handle division by zero)
3. ⚠️ All calls have NULL sentiment (should return 0 or N/A, not crash)
4. ⚠️ Date range filter returns 0 calls (should return zeros)
5. ⚠️ Org has calls with cost_cents = 0 (should include in stats)
6. ⚠️ Org has calls with negative cost_cents (data corruption - should alert)
7. ⚠️ Org has calls with duration > 24 hours (data corruption - should cap)
8. ⚠️ Stats calculation times out on large dataset (should optimize query)

#### Recording URL Endpoint: `GET /api/calls-dashboard/:callId/recording-url`

**Edge Cases:**
1. ⚠️ Call has no recording (should return 404 with clear message)
2. ⚠️ Recording file exists in DB but not in S3 (should return 404)
3. ⚠️ S3 credentials expired (should return 500 with retry message)
4. ⚠️ Signed URL generation fails (should log and return 500)
5. ⚠️ User requests recording for different org's call (should return 404)
6. ⚠️ Recording path has directory traversal attack (should sanitize)
7. ⚠️ Concurrent requests for same recording (should handle)
8. ⚠️ Recording is being processed (status = 'processing') (should return 202)

---

### 3. Data Quality Audit (P0 - CRITICAL)

**OBJECTIVE:** Ensure all Golden Record fields are populated correctly.

**YOU MUST VERIFY:**

#### For ALL Calls in Database
```sql
-- Check for missing cost on completed calls
SELECT id, vapi_call_id, status, cost_cents, created_at
FROM calls
WHERE status = 'completed'
  AND (cost_cents IS NULL OR cost_cents = 0)
ORDER BY created_at DESC;

-- Check for missing sentiment on completed calls
SELECT id, vapi_call_id, status, sentiment_score, sentiment_label
FROM calls
WHERE status = 'completed'
  AND (sentiment_score IS NULL OR sentiment_label IS NULL)
ORDER BY created_at DESC;

-- Check for outcome_summary not being 3 sentences
SELECT id, outcome_summary,
       (LENGTH(outcome_summary) - LENGTH(REPLACE(outcome_summary, '.', ''))) as sentence_count
FROM calls
WHERE outcome_summary IS NOT NULL
  AND (LENGTH(outcome_summary) - LENGTH(REPLACE(outcome_summary, '.', ''))) != 3
ORDER BY created_at DESC;

-- Check for appointment linkage missing when booking tool used
SELECT id, tools_used, appointment_id
FROM calls
WHERE 'bookClinicAppointment' = ANY(tools_used)
  AND appointment_id IS NULL
ORDER BY created_at DESC;

-- Check for ended_reason missing on completed calls
SELECT id, vapi_call_id, status, ended_reason
FROM calls
WHERE status = 'completed'
  AND ended_reason IS NULL
ORDER BY created_at DESC;

-- Check for orphaned appointments (call_id points to deleted call)
SELECT a.id, a.call_id, a.vapi_call_id
FROM appointments a
LEFT JOIN calls c ON a.call_id = c.id
WHERE a.call_id IS NOT NULL
  AND c.id IS NULL;

-- Check for bidirectional linkage violations
SELECT c.id as call_id, c.appointment_id as call_appt_id,
       a.id as appt_id, a.call_id as appt_call_id
FROM calls c
INNER JOIN appointments a ON c.appointment_id = a.id
WHERE a.call_id IS NULL OR a.call_id != c.id;
```

#### Automated Data Quality Script
Create: `backend/src/scripts/audit-data-quality.ts`

Must check:
1. All completed calls have cost_cents > 0
2. All completed calls have sentiment fields
3. All outcome_summary fields are exactly 3 sentences
4. All calls with booking tool have appointment_id
5. All appointments with call_id have bidirectional link
6. No orphaned foreign keys
7. No data type violations
8. No constraint violations

---

### 4. Performance Optimization (P1 - HIGH)

**OBJECTIVE:** Ensure APIs respond in <200ms at p95.

**YOU MUST MEASURE:**

#### Query Performance
```sql
-- Enable query timing
\timing on

-- Measure call detail query
EXPLAIN ANALYZE
SELECT * FROM calls
WHERE id = 'test-uuid' AND org_id = 'test-org-uuid';

-- Measure call list query
EXPLAIN ANALYZE
SELECT * FROM calls
WHERE org_id = 'test-org-uuid'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;

-- Measure stats aggregation
EXPLAIN ANALYZE
SELECT
  COUNT(*) as total_calls,
  AVG(duration_seconds) as avg_duration,
  AVG(sentiment_score) as avg_sentiment
FROM calls
WHERE org_id = 'test-org-uuid'
  AND status = 'completed';

-- Check for missing indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('calls', 'appointments', 'contacts')
ORDER BY tablename, indexname;
```

#### Load Testing
Create: `backend/src/scripts/load-test-dashboard-apis.ts`

Must test:
1. 100 concurrent requests to call detail endpoint
2. 100 concurrent requests to call list endpoint
3. Response time distribution (p50, p95, p99)
4. Memory usage under load
5. Database connection pool exhaustion

**Performance Targets:**
- p50: <100ms
- p95: <200ms
- p99: <500ms
- Max concurrent: 100 requests/second
- Zero errors under load

---

### 5. Error Handling Audit (P1 - HIGH)

**OBJECTIVE:** All errors return proper HTTP status codes and clear messages.

**YOU MUST VERIFY:**

#### HTTP Status Codes
- ✅ 200 OK - Successful request
- ✅ 400 Bad Request - Invalid input (malformed UUID, negative limit, etc.)
- ✅ 401 Unauthorized - Missing or invalid JWT
- ✅ 403 Forbidden - Valid JWT but insufficient permissions
- ✅ 404 Not Found - Resource doesn't exist or belongs to different org
- ✅ 500 Internal Server Error - Unexpected error (with request ID for debugging)
- ✅ 503 Service Unavailable - Database down, S3 unavailable, etc.

#### Error Response Format
ALL errors must follow this format:
```json
{
  "error": "Clear, actionable error message",
  "code": "ERROR_CODE_CONSTANT",
  "request_id": "uuid-for-debugging",
  "details": {
    "field": "validation error details if applicable"
  }
}
```

#### Error Logging
ALL errors must be logged with:
- Timestamp
- Request ID
- User ID (if available)
- Org ID (if available)
- Error stack trace
- Request payload (sanitized)

---

### 6. Input Validation & Sanitization (P0 - CRITICAL)

**OBJECTIVE:** Prevent ALL injection attacks.

**YOU MUST CHECK:**

#### SQL Injection Prevention
```typescript
// BAD - Vulnerable to SQL injection
const { data } = await supabase.from('calls')
  .select('*')
  .filter('caller_name', 'eq', userInput); // ❌ NO RAW USER INPUT

// GOOD - Parameterized queries
const { data } = await supabase.from('calls')
  .select('*')
  .eq('caller_name', userInput); // ✅ Supabase handles escaping
```

#### XSS Prevention
All text fields returned to frontend must be sanitized:
- `caller_name` - Could contain `<script>alert('XSS')</script>`
- `transcript` - Could contain malicious HTML
- `outcome_summary` - Could contain `<img src=x onerror=alert(1)>`

#### Path Traversal Prevention
Recording paths must be validated:
```typescript
// BAD - Vulnerable to path traversal
const path = req.params.path; // Could be: ../../../etc/passwd
const url = generateSignedUrl(path); // ❌ DANGER

// GOOD - Validate against whitelist
if (!path.startsWith('recordings/') || path.includes('..')) {
  throw new Error('Invalid path');
}
```

---

### 7. Frontend Integration Verification (P1 - HIGH)

**OBJECTIVE:** Ensure frontend correctly displays all data.

**YOU MUST TEST:**

#### Call Log Page (`src/app/dashboard/calls/page.tsx`)
1. ⚠️ Displays call list correctly
2. ⚠️ Pagination works (next/prev buttons)
3. ⚠️ Clicking call opens detail modal
4. ⚠️ Modal shows all Golden Record fields
5. ⚠️ Outcome summary is readable (3 sentences displayed)
6. ⚠️ Sentiment score shows as percentage or 0-1 scale
7. ⚠️ Recording player appears when recording exists
8. ⚠️ Recording player shows "No recording" when missing
9. ⚠️ Transcript displays correctly formatted
10. ⚠️ Long transcripts are scrollable
11. ⚠️ Empty call list shows helpful message
12. ⚠️ Loading states show spinners
13. ⚠️ Error states show error messages
14. ⚠️ Filters work correctly
15. ⚠️ Search works correctly

#### Dashboard Stats Page
1. ⚠️ Total calls shows correct count
2. ⚠️ Average duration shows in minutes/seconds
3. ⚠️ Average sentiment shows as percentage
4. ⚠️ Pipeline value shows in currency
5. ⚠️ Charts render without errors
6. ⚠️ Zero state shows when no data

---

### 8. Recording Playback End-to-End Test (P0 - CRITICAL)

**OBJECTIVE:** Verify recording playback works from end to end.

**YOU MUST:**

1. **Trigger New Test Call**
   ```bash
   # Call the test number
   Call: +1 (650) 459-5418
   ```

2. **Verify Recording Created in Database**
   ```sql
   SELECT id, duration_seconds, recording_storage_path, recording_url
   FROM calls
   WHERE recording_storage_path IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. **Test Recording URL Endpoint**
   ```bash
   curl http://localhost:3001/api/calls-dashboard/{callId}/recording-url \
     -H "Authorization: Bearer {jwt}" \
     -w "\nStatus: %{http_code}\n"
   ```

4. **Verify Signed URL Works**
   ```bash
   # Download recording using signed URL
   curl -I "{signed_url}"
   # Should return 200 OK with audio/mpeg or audio/wav content-type
   ```

5. **Test Frontend Recording Player**
   - Open call detail modal
   - Click play button
   - Verify audio plays
   - Verify playback controls work (pause, seek, volume)
   - Verify download button works

6. **Test Edge Cases**
   - Recording URL expires after 1 hour (should regenerate)
   - S3 bucket unreachable (should show error)
   - Audio file corrupted (should show error)
   - Concurrent playback requests (should work)

---

### 9. Database Migration Audit (P1 - HIGH)

**OBJECTIVE:** Verify all migrations applied correctly.

**YOU MUST CHECK:**

```sql
-- Check migration history
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

-- Verify Golden Record columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'calls'
  AND column_name IN ('cost_cents', 'appointment_id', 'tools_used', 'ended_reason',
                      'outcome', 'outcome_summary', 'sentiment_summary')
ORDER BY column_name;

-- Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'calls'
  AND indexname LIKE '%golden%' OR indexname LIKE '%cost%' OR indexname LIKE '%appointment%';

-- Verify foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('calls', 'appointments');
```

---

### 10. Observability & Monitoring (P1 - HIGH)

**OBJECTIVE:** Ensure we can debug production issues.

**YOU MUST ADD:**

#### Structured Logging
Every API endpoint must log:
```typescript
logger.info('API Request', {
  endpoint: '/api/calls-dashboard/:callId',
  method: 'GET',
  callId: req.params.callId,
  orgId: req.user.orgId,
  userId: req.user.sub,
  requestId: req.headers['x-request-id'],
  timestamp: new Date().toISOString()
});
```

#### Performance Metrics
Track:
- Request duration (histogram)
- Database query time (histogram)
- Error count by endpoint (counter)
- Active requests (gauge)

#### Health Check Endpoint
Create: `GET /api/health/dashboard`
```typescript
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "s3": "ok",
    "apis": {
      "calls-dashboard": "ok",
      "recording-url": "ok"
    }
  },
  "uptime": 12345,
  "version": "1.0.0"
}
```

---

## 🛠️ DELIVERABLES

You must create the following files:

### 1. Audit Scripts
- ✅ `backend/src/scripts/audit-multi-tenant-security.ts`
- ✅ `backend/src/scripts/audit-data-quality.ts`
- ✅ `backend/src/scripts/audit-edge-cases.ts`
- ✅ `backend/src/scripts/load-test-dashboard-apis.ts`
- ✅ `backend/src/scripts/test-recording-playback.ts`

### 2. Test Suites
- ✅ `backend/src/__tests__/integration/dashboard-api-security.test.ts`
- ✅ `backend/src/__tests__/integration/dashboard-api-edge-cases.test.ts`
- ✅ `backend/src/__tests__/integration/recording-playback.test.ts`

### 3. Documentation
- ✅ `DASHBOARD_API_SECURITY_AUDIT.md` - Complete security audit report
- ✅ `DASHBOARD_API_EDGE_CASES.md` - All edge cases documented and tested
- ✅ `DASHBOARD_API_PERFORMANCE.md` - Performance benchmarks and optimizations

### 4. Code Fixes
Fix any issues found:
- Security vulnerabilities → Immediate fix + test
- Edge cases → Handle gracefully + test
- Performance issues → Optimize + benchmark
- Missing validations → Add + test
- Error handling gaps → Improve + test

---

## ✅ SUCCESS CRITERIA

Your work is COMPLETE when:

1. **Security Audit:** ✅ Zero security vulnerabilities found
2. **Edge Cases:** ✅ All edge cases handled and tested
3. **Data Quality:** ✅ 100% of calls have correct Golden Record fields
4. **Performance:** ✅ All endpoints respond in <200ms at p95
5. **Error Handling:** ✅ All errors return proper status codes and messages
6. **Input Validation:** ✅ All inputs sanitized and validated
7. **Frontend:** ✅ All pages display data correctly
8. **Recording:** ✅ Recording playback works end-to-end
9. **Database:** ✅ All migrations applied, no data corruption
10. **Observability:** ✅ Comprehensive logging and monitoring in place
11. **Tests:** ✅ 100% test coverage of critical paths
12. **Documentation:** ✅ All findings documented with remediation steps

---

## 🚨 CRITICAL RULES

1. **NEVER skip security checks** - Multi-tenant isolation is P0
2. **NEVER assume edge cases don't exist** - Test everything
3. **NEVER commit code without tests** - 100% coverage required
4. **NEVER expose sensitive data** - Always sanitize, always validate
5. **NEVER ignore performance** - <200ms or optimize
6. **NEVER leave TODOs** - Fix it now or create a ticket
7. **NEVER break existing functionality** - Run full test suite
8. **NEVER deploy without verification** - Test in staging first

---

## 📞 SUPPORT & ESCALATION

If you encounter:
- **Security vulnerability:** Flag immediately, document, fix, test
- **Performance regression:** Profile, optimize, benchmark
- **Data corruption:** Investigate root cause, fix migration, backfill
- **Breaking change:** Create migration path, document, communicate
- **Unclear requirement:** Reference PRD, ask CTO, document decision

---

## 🎯 MINDSET

You are not just testing - you are **hunting for bugs before customers find them.**

Think like:
- **A hacker** trying to break multi-tenant isolation
- **A user** entering unexpected data
- **A QA engineer** testing every edge case
- **A performance engineer** optimizing every query
- **A security auditor** checking every input
- **A site reliability engineer** ensuring uptime

Your mission is to ensure that when we ship this to production, it's **bulletproof**.

---

## 🚀 GET STARTED

1. ✅ Read `.agent/prd.md`
2. ✅ Read `.agent/database-ssot.md`
3. ✅ Read `API_VERIFICATION_REPORT.md`
4. ✅ Review `backend/src/routes/calls-dashboard.ts`
5. ✅ Start with multi-tenant security audit
6. ✅ Move to edge case testing
7. ✅ Then data quality audit
8. ✅ Then performance optimization
9. ✅ Create all audit scripts
10. ✅ Document all findings
11. ✅ Fix all issues
12. ✅ Report back to CTO

**This is not optional. This is mission-critical.**

**Go. Hunt. Fix. Ship.**
