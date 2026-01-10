# Phase 3: Server Restart Required 🔄

**Issue:** OAuth routes returning 404  
**Reason:** Backend server was started before routes were added  
**Solution:** Restart the backend server

---

## ✅ Routes Are Configured Correctly

- ✅ `google-oauth.ts` route file exists
- ✅ Route imported in `server.ts`
- ✅ Route registered at `/api/google-oauth`

**The server just needs to be restarted to load the new routes.**

---

## 🔄 Restart Backend Server

### Step 1: Stop Current Server

**Find and stop the running server:**
```bash
# Find process ID
lsof -ti:3001

# Stop it (replace PID with actual process ID)
kill <PID>

# Or kill all node processes on port 3001
kill $(lsof -ti:3001)
```

### Step 2: Start Server Fresh

```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server running on http://localhost:3001
✅ All routes registered
```

**Check for errors:**
- ❌ Module not found errors → Check route file exists
- ❌ Import errors → Check TypeScript compilation
- ✅ No errors → Ready to test

---

## 🧪 Verify Routes After Restart

### Test 1: Check Authorization Endpoint
```bash
curl -I "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** HTTP 302 redirect (or 401 if auth required)

### Test 2: Check Status Endpoint
```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** JSON response (not 404)

---

## ✅ After Restart

Once server is restarted, proceed with OAuth testing:

1. **Open in browser:**
   ```
   http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
   ```

2. **Expected:** Redirects to Google OAuth consent screen

3. **Complete OAuth flow** (grant permission)

4. **Verify callback** redirects to frontend

5. **Check status:**
   ```bash
   curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
   ```

---

## 🔍 Troubleshooting

### If routes still return 404 after restart:

1. **Check route file exists:**
   ```bash
   ls -la backend/src/routes/google-oauth.ts
   ```

2. **Check import in server.ts:**
   ```bash
   grep "google-oauth" backend/src/server.ts
   ```

3. **Check route registration:**
   ```bash
   grep "app.use.*google-oauth" backend/src/server.ts
   ```

4. **Check for TypeScript errors:**
   ```bash
   cd backend
   npx tsc --noEmit
   ```

---

**Action:** Restart the backend server, then retry OAuth testing.
