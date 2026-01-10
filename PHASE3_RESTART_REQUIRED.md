# Phase 3: Server Restart Required ⚠️

**Current Status:** Server is running but routes return 404  
**Root Cause:** Server started before OAuth routes were added  
**Solution:** Proper server restart required

---

## ✅ What We Know

- ✅ Server is running (health endpoint works)
- ✅ Route file exists and is correct
- ✅ Routes are registered in code
- ❌ Routes return 404 (not loaded at runtime)
- ⏰ Server uptime: ~6.7 hours (started before OAuth routes added)

---

## 🔄 How to Properly Restart

### Step 1: Find the Backend Server Terminal

**Look for the terminal window running:**
```
npm run dev
# or
ts-node src/server.ts
# or  
tsx src/server.ts
```

### Step 2: Stop the Server

**In that terminal, press:**
```
Ctrl + C
```

**Or if you can't find it:**
```bash
kill $(lsof -ti:3001)
```

### Step 3: Wait for Process to Stop

```bash
# Verify port 3001 is free
lsof -ti:3001
# Should return nothing (process killed)
```

### Step 4: Start Server Fresh

```bash
cd backend
npm run dev
```

**Watch for startup messages:**
- ✅ "Server running on http://localhost:3001"
- ✅ No import errors
- ✅ No module not found errors

**If you see errors about google-oauth:**
- Note the error message
- Check the import/dependency
- Fix and restart

---

## ✅ Verification After Restart

### Test 1: Health Check (Should Work)
```bash
curl http://localhost:3001/health
```

**Expected:** JSON with status

### Test 2: OAuth Status Endpoint (Should Work Now)
```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** JSON response (not 404!)

### Test 3: OAuth Authorization (Should Redirect)
```bash
curl -I "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** HTTP 302 redirect to Google

---

## 🐛 If Routes Still Don't Work After Restart

### Check Backend Terminal for Errors

**Look for:**
- `Error: Cannot find module './routes/google-oauth'`
- `Error: Cannot find module './services/google-oauth-service'`
- `TypeError: ...`
- `GOOGLE_CLIENT_ID environment variable is required`

### Common Issues

**Issue: Missing Environment Variables**
```
Error: GOOGLE_CLIENT_ID environment variable is required
```

**Solution:**
- Verify `.env` file has all GOOGLE_* variables
- Restart server after adding variables

**Issue: Import Error**
```
Error: Cannot find module './services/google-oauth-service'
```

**Solution:**
- Verify `google-oauth-service.ts` exists
- Check file paths are correct

**Issue: TypeScript Compilation Error**
```
Error: Type error in google-oauth-service.ts
```

**Solution:**
- Check TypeScript compilation
- Fix any type errors

---

## 🎯 Expected Behavior After Restart

**Server Startup:**
```
Server running on http://localhost:3001
✅ All routes registered
```

**Route Access:**
```bash
# Should work (not 404)
curl http://localhost:3001/api/google-oauth/status?orgId=test
# Response: {"connected": false, ...}

curl -I http://localhost:3001/api/google-oauth/authorize?orgId=test  
# Response: HTTP 302 (redirect)
```

---

## 📋 Quick Checklist

**Before Testing:**
- [ ] Server properly stopped (Ctrl+C in terminal)
- [ ] Port 3001 is free (check with `lsof -ti:3001`)
- [ ] Server restarted fresh (`npm run dev`)
- [ ] No errors in startup logs
- [ ] Health endpoint works
- [ ] OAuth routes respond (not 404)

**Then Test:**
- [ ] Authorization URL redirects to Google
- [ ] OAuth flow completes
- [ ] Tokens stored in database
- [ ] Connection status shows `connected: true`

---

**Action Required:** Properly restart the backend server, then test OAuth routes again.

**Key:** Make sure the server terminal shows NO errors when starting, and routes are registered.
