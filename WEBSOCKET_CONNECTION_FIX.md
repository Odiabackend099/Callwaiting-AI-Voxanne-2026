# WebSocket Connection Fix - Browser Test & Live Call Features

**Date:** 2026-01-31
**Issue:** WebSocket connections failing from https://voxanne.ai
**Impact:** Browser test and live call features not working
**Root Cause:** Backend WebSocket origin validation rejecting new domain

---

## Problem Analysis

### Error Messages
```
WebSocket connection to 'wss://callwaitingai-backend-sjbi.onrender.com/ws/live-calls' failed
WebSocket connection to 'wss://callwaitingai-backend-sjbi.onrender.com/api/web-voice/...' failed
[VoiceAgent] WebSocket error: Event
[VoiceAgent] WebSocket closed: 1006
```

### Root Cause
The backend WebSocket upgrade handler ([backend/src/server.ts:492-509](backend/src/server.ts#L492-L509)) validates origins against an allowed list:

```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://voxanne-frontend-7c8wg3jiv-odia-backends-projects.vercel.app',
  'https://callwaitingai.dev',
  'https://www.callwaitingai.dev',
  process.env.FRONTEND_URL || ''  // ← This should be https://voxanne.ai
].filter(Boolean);
```

When a WebSocket connection attempts from `https://voxanne.ai`, the backend checks:

```typescript
const isOriginAllowed = !origin || origin === 'unknown' || allowedOrigins.some(allowed => origin === allowed);

if (!isOriginAllowed) {
  console.error('[WebSocket] Origin not allowed', { origin, allowedOrigins });
  socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
  socket.destroy();
  return;
}
```

Since `https://voxanne.ai` is NOT in the allowed list and `FRONTEND_URL` is still set to the old domain, connections are rejected with `403 Forbidden`.

---

## Solution: Update Backend Environment Variable

### Step 1: Update FRONTEND_URL in Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/web/srv-d5jfstq4d50c79gq/env)
2. Find the environment variable: `FRONTEND_URL`
3. **Update value from:** `https://callwaitingai.dev` (or old value)
4. **Update value to:** `https://voxanne.ai`
5. Click **Save Changes**

### Step 2: Redeploy Backend

**CRITICAL:** Environment variable changes do NOT automatically redeploy the backend. You must manually trigger a deployment:

1. In Render Dashboard, click **"Manual Deploy"** button (top right)
2. Select **"Deploy latest commit"**
3. Wait 2-3 minutes for deployment to complete
4. Verify deployment status shows ✅ **Live**

### Step 3: Verify WebSocket Connections

1. Hard refresh your browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Open browser DevTools → Console tab
3. Try the browser test feature
4. Check for WebSocket connection success messages (no more 1006 errors)

---

## Expected Results

### Before Fix
```
❌ WebSocket connection to 'wss://callwaitingai-backend-sjbi.onrender.com/ws/live-calls' failed
❌ WebSocket connection to 'wss://callwaitingai-backend-sjbi.onrender.com/api/web-voice/...' failed
❌ [VoiceAgent] WebSocket closed: 1006
```

### After Fix
```
✅ [WebSocket] Upgrade request received { pathname: '/ws/live-calls', origin: 'https://voxanne.ai' }
✅ [WebSocket] Handling /ws/live-calls upgrade
✅ [WebSocket] /ws/live-calls upgrade successful, emitting connection event
✅ Client connected { remoteAddress: '...', origin: 'https://voxanne.ai' }
```

---

## Technical Details

### WebSocket Endpoints

1. **Live Calls WebSocket** (`/ws/live-calls`)
   - Used for: Real-time call monitoring, transcript streaming
   - Authentication: JWT token via subscribe message
   - File: [backend/src/services/websocket.ts](backend/src/services/websocket.ts)

2. **Web Voice WebSocket** (`/api/web-voice/:trackingId`)
   - Used for: Browser test (audio bridge between browser and Vapi)
   - Authentication: JWT token via auth message
   - File: [backend/src/services/web-voice-bridge.ts](backend/src/services/web-voice-bridge.ts)

### Origin Validation Flow

```
1. Frontend at https://voxanne.ai initiates WebSocket connection
   ↓
2. Backend receives HTTP Upgrade request with Origin header
   ↓
3. server.on('upgrade') handler checks origin against allowedOrigins
   ↓
4. If origin NOT allowed → Send 403 Forbidden, destroy socket
   ↓
5. If origin allowed → Call webTestWss.handleUpgrade() or liveCallsWss.handleUpgrade()
   ↓
6. WebSocket connection established
```

### Environment Variables Checked

The backend checks `process.env.FRONTEND_URL` in multiple places:

1. **CORS configuration** ([server.ts:169](backend/src/server.ts#L169))
   ```typescript
   const envOrigins = (process.env.CORS_ORIGIN || '')
     .trim()
     .split(',')
     .map((v) => v.trim())
     .filter(Boolean);
   ```

2. **WebSocket origin validation** ([server.ts:499](backend/src/server.ts#L499))
   ```typescript
   const allowedOrigins = [
     // ... hardcoded origins
     process.env.FRONTEND_URL || ''
   ].filter(Boolean);
   ```

Both need `https://voxanne.ai` to be set for full functionality.

---

## Verification Checklist

After updating `FRONTEND_URL` and redeploying:

- [ ] Backend deployment shows ✅ **Live** status
- [ ] Hard refresh browser (`Cmd+Shift+R` or `Ctrl+Shift+R`)
- [ ] No more WebSocket 1006 errors in console
- [ ] Browser test button works (audio test)
- [ ] Live call feature works (real-time transcript)
- [ ] No CORS errors in console
- [ ] No authentication errors in console

---

## Alternative: Add voxanne.ai to Hardcoded List (Not Recommended)

If you need a quick temporary fix without access to Render Dashboard, you could modify the code directly:

```typescript
// backend/src/server.ts (line 493)
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://voxanne-frontend-7c8wg3jiv-odia-backends-projects.vercel.app',
  'https://callwaitingai.dev',
  'https://www.callwaitingai.dev',
  'https://voxanne.ai',  // ← Add this line
  'https://www.voxanne.ai',  // ← Add this line
  process.env.FRONTEND_URL || ''
].filter(Boolean);
```

**Warning:** This requires a code commit and redeploy. The environment variable approach is cleaner.

---

## Related Documentation

- **Frontend Environment Variables:** Already updated to use `https://callwaitingai-backend-sjbi.onrender.com`
- **CORS Configuration:** Already updated with `CORS_ORIGIN=https://voxanne.ai`
- **Backend Redeployment:** Completed on 2026-01-31 07:36:21 UTC (activated CORS changes)

This WebSocket fix is the **final piece** to make browser test and live call features work with the new domain.

---

## Status

**Current State:** Waiting for backend `FRONTEND_URL` update + redeploy
**Next Step:** User updates `FRONTEND_URL` in Render Dashboard and triggers manual deployment
**Expected Resolution Time:** 5 minutes (2 min for update + 3 min for redeploy)

Once complete, all features will work seamlessly with the new `voxanne.ai` domain!
