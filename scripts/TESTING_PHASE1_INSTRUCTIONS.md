# 🧪 Phase 1 Testing Instructions

**Date:** 2025-01-10  
**Purpose:** Guide for testing Phase 1 implementation (Frontend API Migration)  

---

## 📋 Quick Start Guide

### Prerequisites

1. **Backend Server Running:**
   ```bash
   cd backend
   npm run dev
   # Should be running on http://localhost:3001
   ```

2. **Frontend Server Running:**
   ```bash
   npm run dev
   # Should be running on http://localhost:3000
   ```

3. **User Authenticated:**
   - Login to the application
   - Ensure user has `org_id` in JWT `app_metadata` (from Week 1)

---

## 🚀 Testing Methods

### Method 1: Automated API Testing (Quick Check)

**Step 1: Get Authentication Token**

**Option A: From Browser Console (Easiest)**
```javascript
// In browser console on http://localhost:3000
const { data: { session } } = await window.supabase.auth.getSession();
console.log('Auth Token:', session?.access_token);
// Copy the token from console
```

**Option B: From LocalStorage**
```javascript
// In browser console
const token = localStorage.getItem('sb-...access-token');
console.log('Auth Token:', token);
// Or check Application tab → Local Storage → supabase.auth.token
```

**Step 2: Run Automated API Tests**

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

# Get token from browser console first, then:
./scripts/test-phase1-api.sh http://localhost:3001 "YOUR_AUTH_TOKEN_HERE"

# Example:
./scripts/test-phase1-api.sh http://localhost:3001 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Output:**
- ✅ All endpoint tests should pass (200 OK)
- ✅ Response formats should match expected structure
- ✅ Authentication test should return 401 (no token)

---

### Method 2: Manual UI Testing (Comprehensive)

**Step 1: Open Testing Guide**

Open the detailed testing guide:
```
backend/tests/manual-testing-phase1.md
```

**Step 2: Follow Test Checklist**

1. **Dashboard Page Tests:**
   - [ ] Navigate to `http://localhost:3000/dashboard`
   - [ ] Verify page loads without errors
   - [ ] Check browser console for errors
   - [ ] Verify stats display correctly
   - [ ] Verify recent calls display correctly
   - [ ] Check Network tab - verify API calls to backend

2. **Knowledge Base Tests:**
   - [ ] Navigate to `http://localhost:3000/dashboard/knowledge-base`
   - [ ] Verify page loads without errors
   - [ ] Verify documents list displays
   - [ ] Create a new document
   - [ ] Delete a document
   - [ ] Check Network tab - verify API calls to backend

3. **Security Tests:**
   - [ ] Test rate limiting (make multiple rapid requests)
   - [ ] Test authentication (logout and try to access)
   - [ ] Verify cross-tenant isolation (if multiple orgs available)

**Step 3: Document Results**

Fill out the test results in:
- `backend/tests/manual-testing-phase1.md` (has checkboxes and space for notes)

---

## 🔍 Quick Verification Checklist

### Browser Developer Tools Checks

1. **Network Tab - Verify API Calls:**
   - Open DevTools → Network tab
   - Navigate to dashboard
   - Look for request to: `GET /api/calls-dashboard/stats`
   - Verify request has `Authorization: Bearer <token>` header
   - Verify response status: `200 OK`
   - Verify response format: `{ totalCalls, inboundCalls, ... }`

2. **Console Tab - Verify No Errors:**
   - Open DevTools → Console tab
   - Navigate to dashboard and knowledge base pages
   - Verify no errors appear
   - Verify no warnings about direct Supabase queries

3. **Application Tab - Verify Auth Token:**
   - Open DevTools → Application tab
   - Check Local Storage → `supabase.auth.token`
   - Verify token exists and is valid

### Backend Logs Checks

1. **Check Backend Console:**
   ```bash
   # In backend terminal
   # Look for log entries like:
   # [INFO] GET /api/calls-dashboard/stats - 200 OK
   # [INFO] GET /api/knowledge-base - 200 OK
   ```

2. **Verify No Errors:**
   - Check for any error messages
   - Check for rate limit warnings
   - Check for authentication errors

---

## 📊 Expected Test Results

### Dashboard Stats Endpoint

**Request:**
```
GET /api/calls-dashboard/stats
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "totalCalls": 10,
  "inboundCalls": 5,
  "outboundCalls": 5,
  "completedCalls": 8,
  "callsToday": 2,
  "avgDuration": 120,
  "recentCalls": [
    {
      "id": "...",
      "phone_number": "+1234567890",
      "call_date": "2025-01-10T...",
      "duration_seconds": 120,
      "status": "completed",
      "call_type": "inbound",
      "to_number": "+1234567890",
      "started_at": "2025-01-10T...",
      "metadata": { "channel": "inbound" }
    }
  ]
}
```

### Knowledge Base Endpoints

**GET /api/knowledge-base:**
```json
{
  "items": [
    {
      "id": "...",
      "filename": "test.md",
      "content": "...",
      "category": "general",
      "active": true,
      ...
    }
  ]
}
```

**POST /api/knowledge-base:**
```json
{
  "id": "...",
  "filename": "test.md",
  "content": "...",
  "category": "general",
  "active": true,
  ...
}
```

**DELETE /api/knowledge-base/:id:**
```json
{
  "success": true
}
// Or 204 No Content
```

---

## 🐛 Troubleshooting

### Issue: "401 Unauthorized"

**Cause:** Invalid or missing authentication token

**Solution:**
1. Check if user is logged in
2. Verify token is being sent in request headers
3. Check backend logs for authentication errors
4. Try logging out and logging back in

---

### Issue: "Network Error" or "Failed to fetch"

**Cause:** Backend server not running or not accessible

**Solution:**
1. Verify backend is running: `curl http://localhost:3001/health`
2. Check backend logs for errors
3. Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly in `.env.local`
4. Check firewall/network settings

---

### Issue: "500 Internal Server Error"

**Cause:** Backend error processing request

**Solution:**
1. Check backend logs for error details
2. Verify database connection
3. Verify RLS policies are working correctly
4. Check if `org_id` exists in user's JWT metadata

---

### Issue: Dashboard Shows No Data

**Cause:** No data exists or RLS policies blocking access

**Solution:**
1. Verify test data exists in database
2. Check if user has `org_id` in JWT metadata
3. Verify RLS policies allow user to access their org's data
4. Check backend logs for database query errors

---

### Issue: Console Shows Direct Supabase Query Warnings

**Cause:** Some code still using direct Supabase queries

**Solution:**
1. Check which component is making direct query
2. Verify all queries have been migrated to backend API
3. Check if old code is still being used

---

## ✅ Success Criteria

**Phase 1 Testing is Successful When:**

- ✅ All API endpoints return `200 OK` (or appropriate status codes)
- ✅ Dashboard page loads and displays data correctly
- ✅ Knowledge base page loads and CRUD operations work
- ✅ No console errors in browser
- ✅ No errors in backend logs
- ✅ All requests go through backend API (not direct Supabase)
- ✅ Rate limiting is enforced (test with multiple rapid requests)
- ✅ Authentication is required (test without token)
- ✅ Cross-tenant isolation works (users only see their org's data)

---

## 📝 Next Steps After Testing

### If All Tests Pass:

1. ✅ **Document test results** in `backend/tests/manual-testing-phase1.md`
2. ✅ **Mark Phase 1 as complete** in TODO list
3. ✅ **Proceed to Phase 2** (Index Optimization) or **Phase 3** (RLS Test Suite)

### If Tests Fail:

1. ❌ **Document issues** in `backend/tests/manual-testing-phase1.md`
2. ❌ **Fix critical issues** before proceeding
3. ❌ **Re-test** after fixes
4. ❌ **Update documentation** with fixes

---

## 🔗 Resources

- **Detailed Testing Guide:** `backend/tests/manual-testing-phase1.md`
- **API Testing Script:** `scripts/test-phase1-api.sh`
- **Phase 1 Completion Doc:** `WARDEN_WEEK2_PHASE1_COMPLETE.md`
- **Planning Document:** `backend/migrations/planning_week2_tasks.md`

---

**Happy Testing! 🧪**
