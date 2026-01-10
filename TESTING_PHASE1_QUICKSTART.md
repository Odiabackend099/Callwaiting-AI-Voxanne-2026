# 🚀 Phase 1 Testing - Quick Start Guide

**Status:** ✅ Backend server is running on http://localhost:3001  
**Date:** 2025-01-10  
**Purpose:** Quick guide to test Phase 1 implementation  

---

## ✅ Pre-Flight Check

**Backend Status:**
```bash
✅ Backend server is running
✅ Health endpoint: http://localhost:3001/health (responding)
✅ Database: Connected
✅ Services: All healthy
```

**Next Steps:**
1. Ensure frontend is running: `npm run dev` (should be on http://localhost:3000)
2. Login to the application
3. Follow testing instructions below

---

## 🧪 Testing Methods (Choose One)

### Option A: Quick Browser Test (Recommended First)

**Step 1: Open Browser Developer Tools**
- Navigate to `http://localhost:3000/dashboard`
- Open DevTools (F12 or Cmd+Option+I)
- Go to **Network** tab
- Filter by "stats" or "calls-dashboard"

**Step 2: Verify API Calls**
1. Refresh the dashboard page
2. Look for request: `GET /api/calls-dashboard/stats`
3. Click on the request → **Headers** tab
4. Verify:
   - ✅ Request URL: `http://localhost:3001/api/calls-dashboard/stats`
   - ✅ Authorization header: `Bearer <token>`
   - ✅ Method: GET

5. Click **Response** tab
6. Verify response contains:
   ```json
   {
     "totalCalls": <number>,
     "inboundCalls": <number>,
     "outboundCalls": <number>,
     "completedCalls": <number>,
     "callsToday": <number>,
     "avgDuration": <number>,
     "recentCalls": [...]
   }
   ```

**Step 3: Test Knowledge Base**
1. Navigate to `http://localhost:3000/dashboard/knowledge-base`
2. Open **Network** tab
3. Refresh page
4. Look for request: `GET /api/knowledge-base`
5. Verify:
   - ✅ Request to backend API (not direct Supabase)
   - ✅ Response contains `{ "items": [...] }`

**Step 4: Test Console Errors**
1. Open **Console** tab in DevTools
2. Navigate through dashboard and knowledge base pages
3. Verify:
   - ✅ No errors in console
   - ✅ No warnings about direct Supabase queries

**✅ If all checks pass → Phase 1 is working correctly!**

---

### Option B: Automated API Testing (Advanced)

**Step 1: Get Authentication Token**

In browser console on `http://localhost:3000`:
```javascript
const { data: { session } } = await window.supabase.auth.getSession();
console.log('Auth Token:', session?.access_token);
// Copy the token from console output
```

**Step 2: Run Automated Tests**

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

# Replace YOUR_TOKEN_HERE with the token from Step 1
./scripts/test-phase1-api.sh http://localhost:3001 "YOUR_TOKEN_HERE"
```

**Expected Output:**
```
🧪 Testing Phase 1 API Endpoints
Backend URL: http://localhost:3001
==========================================

Test 1: GET /api/calls-dashboard/stats
✅ Status: 200 OK
✅ Response contains 'totalCalls'
✅ Response contains 'recentCalls'
Response body: {...}

Test 2: GET /api/knowledge-base
✅ Status: 200 OK
✅ Response contains 'items' array
...

Test 3: POST /api/knowledge-base
✅ Status: 200 OK
✅ Document created successfully
...

Test 4: DELETE /api/knowledge-base/...
✅ Status: 200 OK
✅ Document deleted successfully
...

Test 5: GET /api/calls-dashboard/stats (No Auth Token)
✅ Status: 401 Unauthorized (Expected)
✅ Authentication required - security check passed
```

---

### Option C: Comprehensive Manual Testing

**Follow the detailed guide:**
```
backend/tests/manual-testing-phase1.md
```

This guide includes:
- Detailed test cases for each endpoint
- Checklist for dashboard functionality
- Checklist for knowledge base CRUD operations
- Security and rate limiting tests
- Test results template

---

## 🔍 Quick Verification Checklist

### Dashboard Page ✅
- [ ] Page loads without errors
- [ ] Stats display correctly (totalCalls, inboundCalls, etc.)
- [ ] Recent calls display correctly
- [ ] Network tab shows request to `/api/calls-dashboard/stats`
- [ ] No console errors

### Knowledge Base Page ✅
- [ ] Page loads without errors
- [ ] Documents list displays
- [ ] Create document works
- [ ] Delete document works
- [ ] Network tab shows requests to `/api/knowledge-base`
- [ ] No console errors

### Backend API ✅
- [ ] Dashboard stats endpoint returns correct format
- [ ] Knowledge base GET endpoint returns `{ items: [] }`
- [ ] Knowledge base POST endpoint creates document
- [ ] Knowledge base DELETE endpoint deletes document
- [ ] All endpoints require authentication (401 without token)

### Security ✅
- [ ] All requests include `Authorization: Bearer <token>` header
- [ ] No direct Supabase queries (all go through backend API)
- [ ] Rate limiting enforced (test with rapid requests)
- [ ] Cross-tenant isolation works (users only see their org's data)

---

## 📊 Success Criteria

**Phase 1 Testing is Successful When:**

✅ All API endpoints return `200 OK` (or appropriate status codes)  
✅ Dashboard page loads and displays data correctly  
✅ Knowledge base page loads and CRUD operations work  
✅ No console errors in browser  
✅ No errors in backend logs  
✅ All requests go through backend API (verified in Network tab)  
✅ Rate limiting is enforced (test with multiple rapid requests)  
✅ Authentication is required (test without token)  

---

## 🐛 Troubleshooting

### Issue: Dashboard Shows "Failed to load dashboard data"

**Possible Causes:**
1. Backend server not running → Check: `curl http://localhost:3001/health`
2. Authentication token invalid → Try logging out and logging back in
3. CORS error → Check backend CORS configuration

**Solution:**
1. Verify backend is running: ✅ (Already confirmed)
2. Check browser console for error details
3. Check backend logs for error messages

---

### Issue: Network Tab Shows Direct Supabase Requests

**Possible Causes:**
1. Old code still using direct queries
2. Some components not migrated yet

**Solution:**
1. Check which component is making direct query (Network tab → Request → Initiator)
2. Verify all queries have been migrated (check `src/app/dashboard/page.tsx` and `src/lib/supabaseHelpers.ts`)
3. Clear browser cache and refresh

---

### Issue: 401 Unauthorized Errors

**Possible Causes:**
1. User not logged in
2. Authentication token expired
3. Token not being sent in request headers

**Solution:**
1. Verify user is logged in
2. Check Network tab → Request Headers → Authorization header exists
3. Try logging out and logging back in
4. Check backend logs for authentication errors

---

## 📝 Next Steps After Testing

### If All Tests Pass ✅

1. **Document test results** in `backend/tests/manual-testing-phase1.md`
2. **Mark Phase 1 as complete** in TODO list
3. **Proceed to Phase 2** (Index Optimization) or **Phase 3** (RLS Test Suite)

### If Tests Fail ❌

1. **Document issues** with details (error messages, screenshots, logs)
2. **Fix critical issues** before proceeding
3. **Re-test** after fixes
4. **Update documentation** with fixes

---

## 📚 Resources

- **Detailed Testing Guide:** `backend/tests/manual-testing-phase1.md`
- **Automated Test Script:** `scripts/test-phase1-api.sh`
- **Testing Instructions:** `scripts/TESTING_PHASE1_INSTRUCTIONS.md`
- **Phase 1 Completion Doc:** `WARDEN_WEEK2_PHASE1_COMPLETE.md`
- **Planning Document:** `backend/migrations/planning_week2_tasks.md`

---

## 🎯 Quick Test Script

**Run this in browser console to quickly verify:**

```javascript
// Test 1: Dashboard Stats API
(async () => {
  const { data: { session } } = await window.supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    console.error('❌ No authentication token found');
    return;
  }
  
  console.log('🧪 Testing Phase 1 API Endpoints...');
  
  // Test Dashboard Stats
  try {
    const response = await fetch('http://localhost:3001/api/calls-dashboard/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    console.log('✅ Dashboard Stats API:', response.status, data);
  } catch (e) {
    console.error('❌ Dashboard Stats API Error:', e);
  }
  
  // Test Knowledge Base GET
  try {
    const response = await fetch('http://localhost:3001/api/knowledge-base', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    console.log('✅ Knowledge Base GET API:', response.status, data);
  } catch (e) {
    console.error('❌ Knowledge Base GET API Error:', e);
  }
  
  console.log('✅ All API tests completed!');
})();
```

---

**Ready to test! Start with Option A (Quick Browser Test) for fastest verification.** 🚀
