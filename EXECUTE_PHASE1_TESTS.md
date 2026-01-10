# Execute Phase 1 Tests - Step-by-Step Guide

**Date:** 2025-01-10  
**Status:** Ready to Execute  
**Following:** 3-Step Coding Principle  

---

## 📋 Step 1: Plan First (Current State)

### Current Status
- ✅ Code is fixed (route order corrected)
- ✅ Backend server is running but on OLD code (returns 404)
- ✅ All test scripts are ready
- ⚠️ **Action Required:** Server restart needed

### What Needs to Happen
1. **Restart Backend Server** (manual step - you control this)
2. **Verify Fix** (automated - script will detect restart)
3. **Run Full Test Suite** (automated)
4. **Verify Frontend Integration** (manual browser check)

### Expected Outcomes
- `/api/calls-dashboard/stats` should return `401` (no auth) or `200` (with auth)
- Should NOT return `404` anymore
- Frontend dashboard should load data correctly
- All tests should pass

---

## 🔧 Step 2: Execute - Choose Your Method

### Method 1: Automatic (Recommended)
**This script will wait for you to restart the server, then automatically run tests:**

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
./scripts/wait-for-restart-and-test.sh
```

**What it does:**
1. Checks if server is running
2. Detects if server is on old code (404) or new code (401/200)
3. If old code, waits for you to restart (checks every 3 seconds)
4. Automatically detects when restart happens
5. Runs full verification test suite

**You need to:**
1. Run the script above in one terminal
2. In another terminal, restart your backend server:
   ```bash
   cd backend
   # Press Ctrl+C to stop current server
   npm run dev
   ```
3. Wait for "Server listening on port 3001"
4. The script will automatically detect the restart and run tests

---

### Method 2: Manual Step-by-Step

**Step 1: Restart Backend Server**
```bash
# In terminal where backend is running:
# Press Ctrl+C to stop
cd backend
npm run dev

# Wait for: "Server listening on port 3001"
```

**Step 2: Verify the Fix**
```bash
# Quick check:
curl http://localhost:3001/api/calls-dashboard/stats

# Should return: {"error":"Missing or invalid Authorization header"} (401)
# NOT: {"error":"Call not found"} (404)

# Full verification:
./scripts/test-phase1-verify.sh
```

**Step 3: Test with Authentication Token**
```bash
# Get token from browser console (on http://localhost:3000):
# Run this in browser console:
const { data: { session } } = await window.supabase.auth.getSession();
console.log('Token:', session?.access_token);

# Copy the token, then run:
TOKEN="your-token-here" ./scripts/test-phase1-api.sh http://localhost:3001 "your-token-here"
```

**Step 4: Verify Frontend Integration**
1. Open browser: `http://localhost:3000/dashboard`
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Network** tab
4. Refresh the page
5. Look for request: `GET /api/calls-dashboard/stats`
6. Verify:
   - ✅ Request URL: `http://localhost:3001/api/calls-dashboard/stats`
   - ✅ Response Status: `200 OK` (not `404`)
   - ✅ Response contains: `totalCalls`, `inboundCalls`, `recentCalls`, etc.
   - ✅ Dashboard displays stats correctly

---

## ✅ Step 3: Verify & Reflect

### Verification Checklist

After executing the steps above, verify:

- [ ] **Backend Server:**
  - [ ] Server starts successfully
  - [ ] `/health` returns `200 OK`
  - [ ] `/api/calls-dashboard/stats` returns `401` (without auth) or `200` (with auth)
  - [ ] Does NOT return `404` anymore

- [ ] **API Endpoints:**
  - [ ] `/api/calls-dashboard/stats` returns correct data format
  - [ ] `/api/knowledge-base` GET returns `{ items: [] }`
  - [ ] `/api/knowledge-base` POST creates documents
  - [ ] `/api/knowledge-base/:id` DELETE deletes documents
  - [ ] All endpoints require authentication (in production mode)

- [ ] **Frontend Integration:**
  - [ ] Dashboard page loads without errors
  - [ ] Stats display correctly (totalCalls, inboundCalls, etc.)
  - [ ] Recent calls display correctly
  - [ ] Network tab shows requests to backend API (not direct Supabase)
  - [ ] No console errors

- [ ] **Knowledge Base:**
  - [ ] Knowledge base page loads
  - [ ] Documents list displays
  - [ ] Create document works
  - [ ] Delete document works
  - [ ] All requests go through backend API

### Success Criteria

Phase 1 is successful when:

✅ All API endpoints return correct status codes  
✅ Dashboard stats endpoint returns data (not 404)  
✅ Frontend dashboard loads and displays data correctly  
✅ Knowledge base CRUD operations work correctly  
✅ No console errors or backend errors  
✅ All requests go through backend API (verified in Network tab)  
✅ Authentication is enforced (production mode)  

### If Tests Fail

**If `/stats` still returns 404:**
- Verify server was restarted (check logs for "Server listening on port 3001")
- Verify route order in `backend/src/routes/calls-dashboard.ts`:
  - `/stats` should be defined BEFORE `/:callId`
- Try restarting again

**If endpoints return 401 (expected without auth):**
- This is correct behavior in production mode
- Get authentication token and test with token
- See Step 3 in Method 2 above

**If frontend shows errors:**
- Check browser console for errors
- Check Network tab for failed requests
- Verify backend server is running
- Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly

---

## 🎯 Next Steps After Successful Testing

Once all tests pass:

1. **Document Results**
   - Update `PHASE1_TESTING_RESULTS.md` with final status
   - Mark Phase 1 as complete in TODO list

2. **Proceed to Week 2 Tasks**
   - **Phase 2:** Index Optimization (optional)
   - **Phase 3:** RLS Test Suite Execution (optional)

3. **Production Readiness**
   - Verify `NODE_ENV=production` in production environment
   - Ensure authentication is required for all endpoints
   - Verify rate limiting is active
   - Check RLS policies are working correctly

---

## 📚 Resources

- **Automatic Test Script:** `scripts/wait-for-restart-and-test.sh`
- **Verification Script:** `scripts/test-phase1-verify.sh`
- **API Test Script:** `scripts/test-phase1-api.sh`
- **Manual Testing Guide:** `backend/tests/manual-testing-phase1.md`
- **Quick Start:** `TESTING_PHASE1_QUICKSTART.md`
- **Complete Summary:** `PHASE1_COMPLETE_SUMMARY.md`

---

## 🚀 Quick Start Command

**Easiest way to execute everything:**

```bash
# Terminal 1: Run this and it will wait for restart, then auto-test
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
./scripts/wait-for-restart-and-test.sh

# Terminal 2: Restart your backend server
cd backend
# Ctrl+C to stop, then:
npm run dev
```

The script in Terminal 1 will automatically detect when you restart and run all tests!

---

**Ready to execute!** Choose Method 1 (automatic) for easiest experience, or Method 2 (manual) for step-by-step control.
