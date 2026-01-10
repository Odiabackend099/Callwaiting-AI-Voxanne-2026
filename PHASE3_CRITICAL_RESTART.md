# Phase 3: CRITICAL - Server Must Be Restarted

**Issue:** Routes returning 404  
**Root Cause:** Server process started at 12:16PM (BEFORE OAuth routes were added)  
**Solution:** MUST restart server to load new routes

---

## ⚠️ CRITICAL FINDING

**Current Server Process:**
- Process ID: 17955
- Started: 12:16PM (several hours ago)
- Status: Still running OLD code (before OAuth routes were added)

**The server HAS NOT been restarted yet!**

---

## 🔄 MANDATORY: Stop and Restart Server

### Method 1: Kill Specific Process (Recommended)

```bash
# Kill the specific server process
kill 17955

# Verify it's dead
ps -p 17955
# Should show: "No matching processes"
```

### Method 2: Kill by Port

```bash
# Kill any process on port 3001
kill $(lsof -ti:3001)

# Verify port is free
lsof -ti:3001
# Should return nothing
```

### Method 3: Kill All Node Processes (Nuclear Option)

```bash
# WARNING: Kills ALL node processes
killall node

# Wait
sleep 2
```

---

## ✅ Verify Server is Stopped

**Check:**
```bash
# Check process is gone
ps -p 17955
# Should show: "No matching processes"

# Check port is free
lsof -ti:3001
# Should return nothing
```

---

## 🚀 Start Server Fresh

```bash
cd backend
npm run dev
```

**Watch terminal for:**
- ✅ "Server running on http://localhost:3001"
- ✅ "Google OAuth routes registered at /api/google-oauth" (if log message appears)
- ❌ Any errors (import errors, module not found, etc.)

---

## ✅ After Restart - Immediate Verification

### Test 1: Test Route (Should Work Now)

```bash
curl "http://localhost:3001/api/google-oauth/test"
```

**Expected:** `{"message": "Google OAuth router is working!", ...}`

**If this works:** ✅ Routes are loaded! Proceed to OAuth testing.

**If still 404:** ❌ Check backend terminal for errors during startup.

---

### Test 2: Status Endpoint

```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** JSON response (not 404)

---

### Test 3: Authorization Endpoint

```bash
curl -I "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** HTTP 302 redirect

---

## 🔍 Why Routes Don't Work

**The server process is still running code from 12:16PM:**
- OAuth routes were added AFTER 12:16PM
- Server never loaded the new route files
- Routes return 404 because they don't exist in the running process

**Solution:** Restart server to load new code.

---

## 📋 Complete Restart Checklist

**Before Restart:**
- [ ] Identify server terminal window
- [ ] Note process ID: 17955
- [ ] Prepare to kill process

**Restart Steps:**
- [ ] Kill process: `kill 17955`
- [ ] Verify process is dead
- [ ] Verify port 3001 is free
- [ ] Start server: `cd backend && npm run dev`
- [ ] Watch for startup messages
- [ ] Check for any errors

**After Restart:**
- [ ] Test `/api/google-oauth/test` endpoint
- [ ] Verify routes work (not 404)
- [ ] Check backend terminal for errors
- [ ] Proceed with OAuth testing if routes work

---

## ⚠️ IMPORTANT

**The server MUST be restarted for routes to work.**

Current situation:
- ✅ Code is correct (files exist, exports correct, routes registered)
- ❌ Server is running old code (process from 12:16PM)
- ❌ Routes return 404 because they don't exist in running process

**Action:** Kill process 17955 and start server fresh.

---

**Once server restarts with new code, routes will work immediately!**
