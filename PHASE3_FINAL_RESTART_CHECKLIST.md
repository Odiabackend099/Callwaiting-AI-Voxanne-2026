# Phase 3: Final Restart Checklist - OAuth Routes

**Status:** Code Fixed - Server Restart Required

---

## 🔧 Code Fix Applied

**Issue Found:** OAuth client was being initialized at module load time, which could cause errors if environment variables weren't loaded yet.

**Fix Applied:** Changed OAuth client to lazy initialization (only created when needed).

**Files Modified:**
- ✅ `backend/src/services/google-oauth-service.ts` - Made OAuth client initialization lazy

---

## 🔄 CRITICAL: Restart Server Now

### Step 1: Stop Server Completely

**In the terminal running `npm run dev`:**
```
Press Ctrl+C
```

**Or kill the process:**
```bash
kill $(lsof -ti:3001)
```

**Verify it's stopped:**
```bash
lsof -ti:3001
# Should return nothing
```

### Step 2: Wait 2 Seconds

```bash
sleep 2
```

### Step 3: Start Server Fresh

```bash
cd backend
npm run dev
```

**Watch for:**
- ✅ "Server running on http://localhost:3001"
- ❌ Any import errors
- ❌ Any module not found errors

---

## ✅ Verification After Restart

### Test 1: Simple Test Route (Should Work Now)

```bash
curl "http://localhost:3001/api/google-oauth/test"
```

**Expected Response:**
```json
{
  "message": "Google OAuth router is working!",
  "timestamp": "2026-01-10T..."
}
```

**If this works:** ✅ Routes are now loaded!

**If still 404:** ❌ Check backend terminal for errors

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

**Expected:** HTTP 302 redirect to Google

---

## 🐛 If Still 404 After Restart

### Check Backend Terminal for Errors

**Look for:**
- `Error: Cannot find module './routes/google-oauth'`
- `Error: GOOGLE_CLIENT_ID environment variable is required`
- `TypeError: ...`
- Any import/require errors

### Common Issues:

**1. Module Not Found**
- Check file exists: `ls backend/src/routes/google-oauth.ts`
- Verify import path in server.ts

**2. Environment Variable Error**
- Check `.env` file has all GOOGLE_* variables
- Verify variables are loaded (server should start without errors)

**3. TypeScript Compilation Error**
- Check for syntax errors
- Verify TypeScript compilation succeeds

---

## ✅ Success Indicators

**After restart, you should see:**

1. ✅ Server starts without errors
2. ✅ `/api/google-oauth/test` returns JSON (not 404)
3. ✅ `/api/google-oauth/status` returns JSON
4. ✅ `/api/google-oauth/authorize` redirects to Google

---

## 🚀 Once Routes Work

**Proceed with OAuth testing:**
1. Open authorization URL in browser
2. Grant Google Calendar permission
3. Verify callback works
4. Check token storage
5. Test calendar API calls

---

## 📋 Quick Checklist

- [ ] Server stopped completely
- [ ] Server restarted fresh
- [ ] No errors in startup logs
- [ ] `/api/google-oauth/test` works (returns JSON)
- [ ] `/api/google-oauth/status` works
- [ ] `/api/google-oauth/authorize` redirects

**All checked?** ✅ Ready to test OAuth flow!

---

**Action Required:** Restart server NOW to pick up the lazy initialization fix.
