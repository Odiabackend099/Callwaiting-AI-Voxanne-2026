# 🔐 Authentication & WebSocket Issues - Fixed

## Issues Identified

### 1. ✅ **401 Unauthorized Errors**
**Problem**: All backend API calls were returning 401 (Unauthorized) errors.

**Root Cause**: 
- Backend was running in **production mode** (default) which requires valid authentication tokens
- `NODE_ENV` was not set in `backend/.env`, so it defaulted to production mode
- Users not logged in couldn't access protected endpoints

**Fix Applied**:
- Added `NODE_ENV=development` to `backend/.env`
- In development mode, backend uses `requireAuthOrDev` middleware which allows:
  - Authenticated requests (with valid Supabase token)
  - Unauthenticated requests (falls back to dev user for testing)

### 2. ✅ **WebSocket Connection Failures**
**Problem**: Frontend trying to connect to `ws://localhost:3000/api/ws` (frontend port) instead of backend.

**Root Cause**:
- WebSocket URLs were using `window.location.host` which is `localhost:3000` (frontend)
- WebSocket server runs on backend (port 3001)
- Endpoint was wrong (`/api/ws` instead of `/ws/live-calls`)

**Fix Applied**:
- Updated `src/hooks/useTranscript.ts` to connect to backend WebSocket
- Updated `src/app/dashboard/calls/page.tsx` to connect to backend WebSocket
- Changed WebSocket URL to use `NEXT_PUBLIC_BACKEND_URL` (port 3001)
- Changed WebSocket endpoint to `/ws/live-calls` (correct backend path)

---

## Files Modified

### Backend Configuration
1. **`backend/.env`**
   - Added: `NODE_ENV=development`
   - This enables dev fallback authentication

### Frontend WebSocket Fixes
2. **`src/hooks/useTranscript.ts`** (Line 73-74)
   - **Before**: `const wsUrl = \`${protocol}//${window.location.host}/api/ws\`;`
   - **After**: Connects to backend using `NEXT_PUBLIC_BACKEND_URL` and `/ws/live-calls`

3. **`src/app/dashboard/calls/page.tsx`** (Line 116-117)
   - **Before**: `const wsUrl = \`${protocol}//${window.location.host}/api/ws\`;`
   - **After**: Connects to backend using `NEXT_PUBLIC_BACKEND_URL` and `/ws/live-calls`

---

## Backend WebSocket Endpoints

The backend exposes these WebSocket endpoints:

1. **`/ws/live-calls`** - Live call updates (transcripts, status changes)
   - Used by dashboard to show real-time call activity
   - Broadcasts: `call_ended`, `call_started`, `transcript` events

2. **`/api/web-voice/:trackingId`** - Browser-to-Vapi audio bridge
   - Used by "Test Agent" feature for web-based voice testing
   - Handles audio streaming between browser and Vapi

---

## Development Mode Authentication

With `NODE_ENV=development` set, the backend allows:

### Authenticated Requests (Preferred)
- Frontend sends Supabase session token in `Authorization: Bearer <token>` header
- Backend validates token and extracts `org_id` from user metadata
- Works like production (multi-tenant isolation)

### Unauthenticated Requests (Dev Fallback)
- If no token provided, backend creates a dev user:
  - `userId`: `dev-user` (or `DEV_USER_ID` env var)
  - `email`: `dev@local` (or `DEV_USER_EMAIL` env var)
  - `orgId`: `a0000000-0000-0000-0000-000000000001` (hardcoded dev org)
- **Only works when `NODE_ENV=development`**

---

## Testing the Fixes

### Test 1: Authentication (No Login Required)
```bash
# Should work without authentication in dev mode
curl http://localhost:3001/api/founder-console/settings
# Expected: 200 OK (or empty object if no settings)
```

### Test 2: WebSocket Connection
1. Open browser console on http://localhost:3000/dashboard/calls
2. You should see WebSocket connecting to `ws://localhost:3001/ws/live-calls`
3. No more errors about `ws://localhost:3000/api/ws` failing

### Test 3: API Calls
1. Open http://localhost:3000/dashboard
2. Check browser console - should see fewer/no 401 errors
3. Dashboard should load data (if any exists)

---

## Next Steps

### If You Want Full Authentication (Recommended)
1. **Log in to the frontend**:
   - Go to http://localhost:3000/login
   - Sign in with email/password or Google OAuth
   - Frontend will use your Supabase session token
   - Backend will validate and use your real `org_id`

2. **Verify Authentication**:
   - Check browser Network tab
   - API requests should have `Authorization: Bearer <token>` header
   - Backend logs should show your real user ID and org ID

### If You Want to Stay in Dev Mode (Testing)
- Current setup allows unauthenticated access
- Good for quick testing without login
- **Not recommended for production** - always use `NODE_ENV=production`

---

## Production Deployment

When deploying to production:

1. **Backend `.env`**:
   ```env
   NODE_ENV=production
   ```
   - Removes dev fallback
   - Requires valid authentication on all protected routes

2. **Frontend `.env.production`**:
   ```env
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.com
   ```
   - Update to production backend URL

3. **WebSocket URLs**:
   - Will automatically use production backend URL
   - Use `wss://` protocol for secure WebSocket connections

---

## Summary

✅ **Fixed**: Backend now runs in development mode (allows dev fallback auth)  
✅ **Fixed**: WebSocket URLs now point to backend on port 3001  
✅ **Fixed**: WebSocket endpoint changed to `/ws/live-calls`  

**Result**: 
- Frontend can access backend APIs without login (dev mode)
- WebSocket connections will succeed (connecting to correct backend port)
- All errors should be resolved after page refresh

**Action Required**: 
- Refresh your browser at http://localhost:3000
- Check console - should see WebSocket connecting to `ws://localhost:3001/ws/live-calls`
- 401 errors should be gone (unless you want to test with real authentication)

---

**Last Updated**: $(date)
