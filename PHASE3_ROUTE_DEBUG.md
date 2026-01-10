# Phase 3: Route Debugging Guide 🔍

**Issue:** OAuth routes returning 404 even after server restart

---

## ✅ What We Know

- ✅ Route file exists: `backend/src/routes/google-oauth.ts`
- ✅ Route file exports router: `export default router;`
- ✅ Route imported in server.ts: `import googleOAuthRouter from './routes/google-oauth';`
- ✅ Route registered: `app.use('/api/google-oauth', googleOAuthRouter);`
- ❌ Routes returning 404

---

## 🔍 Debugging Steps

### 1. Verify Server is Using Updated Code

**Check if server process is actually running the new code:**
```bash
# Check when server files were last modified
ls -la backend/src/routes/google-oauth.ts
ls -la backend/src/server.ts

# Check server process start time
ps -p $(lsof -ti:3001) -o lstart
```

**If server started BEFORE files were modified:**
- Server needs full restart (kill and restart)

---

### 2. Check for Runtime Errors

**Watch backend terminal logs when accessing route:**
```bash
# Access the route
curl http://localhost:3001/api/google-oauth/authorize?orgId=test

# Check terminal for errors like:
# - "Cannot find module"
# - "TypeError"
# - Import errors
```

---

### 3. Verify Route Registration Order

**Check server.ts route registration:**
```bash
grep -n "app.use" backend/src/server.ts | grep -E "google|/api"
```

**OAuth routes should be registered BEFORE any catch-all routes**

---

### 4. Test Route Import Directly

**Check if route module can be imported:**
```bash
cd backend
node -e "
try {
  // Check if file exists and is readable
  require('fs').accessSync('./src/routes/google-oauth.ts');
  console.log('✅ Route file is readable');
  
  // Try to see if ts-node can load it
  console.log('Note: TypeScript files need ts-node/tsx to run');
} catch(e) {
  console.error('❌ Error:', e.message);
}
"
```

---

### 5. Check Server Startup Logs

**When server starts, it should show:**
- All routes being registered
- No import errors
- Server listening on port 3001

**If you see errors about google-oauth:**
- Module not found
- Import error
- Syntax error

**Fix the error and restart server**

---

## 🔧 Quick Fix Attempts

### Fix 1: Hard Restart

```bash
# Kill all node processes
killall node

# Wait a moment
sleep 2

# Start server fresh
cd backend
npm run dev
```

### Fix 2: Check Route Path

**Verify the route path is correct:**
```bash
# Check what routes are actually registered
curl http://localhost:3001/api/ 2>&1 | head -20
```

### Fix 3: Test Another Route

**Verify other routes work:**
```bash
# Test a known working route
curl http://localhost:3001/api/book-demo
curl http://localhost:3001/health
```

**If other routes work but OAuth doesn't:**
- Issue is specific to OAuth route module
- Check for import errors in google-oauth.ts

---

## 🐛 Common Issues

### Issue: Module Not Found
**Solution:**
- Check file path is correct
- Verify import statement matches file name
- Check if TypeScript compilation is working

### Issue: Import Error in Route File
**Solution:**
- Check all imports in google-oauth.ts are valid
- Verify google-oauth-service.ts exists and exports correctly
- Check for circular dependencies

### Issue: Route Registered But Not Found
**Solution:**
- Check route path: `/api/google-oauth` (not `/google-oauth`)
- Verify route is registered before catch-all routes
- Check for middleware blocking the route

---

## 🔍 Next Steps

1. **Check backend terminal for errors** when accessing route
2. **Verify server restarted after code changes**
3. **Test if other routes work** (to isolate the issue)
4. **Check import/export statements** are correct
5. **Try hard restart** (killall node, then restart)

---

**Once routes work:**
- Test OAuth authorization URL
- Complete OAuth flow
- Verify token storage
- Test calendar API calls
