# WebSocket Origin Mismatch - Critical Fix Documentation

## Status
🔴 **CRITICAL BLOCKER** - Affects all WebSocket features (Browser Test, Live Call Monitoring)

## Problem Description

### Symptom
- Browser console error: "WebSocket connection failed (close code 1006)"
- User sees: "Connection Error: WebSocket connection failed"
- Broken features:
  - Browser test in agent configuration
  - Live call monitoring
  - Real-time call status updates

### Root Cause
Production domain changed from `callwaitingai.dev` → `voxanne.ai`, but:

1. `FRONTEND_URL` environment variable in Render still points to old domain
2. WebSocket origin validation in [server.ts:509](backend/src/server.ts#L509) rejects new domain
3. Connection closes immediately with code 1008 "Origin not allowed"

### Technical Details

**Current WebSocket Origin Validation** ([server.ts:498-515](backend/src/server.ts#L498-L515)):

```typescript
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://voxanne.ai',          // ✅ Hardcoded in code
    'https://www.voxanne.ai',      // ✅ Hardcoded in code
    'http://localhost:3000',
    'https://callwaitingai.dev',   // ⚠️ Legacy domain
    'https://www.callwaitingai.dev' // ⚠️ Legacy domain
];

const isOriginAllowed = !origin || origin === 'unknown' || allowedOrigins.some(allowed => origin === allowed);

if (!isOriginAllowed) {
    console.error('[WebSocket] Origin not allowed', { origin, allowedOrigins });
    ws.close(1008, 'Origin not allowed');  // ← Kills connection
    return;
}
```

**Current Environment Variable (WRONG)**:
```bash
FRONTEND_URL=https://callwaitingai.dev
```

**Expected Environment Variable (CORRECT)**:
```bash
FRONTEND_URL=https://voxanne.ai
```

## Fix Instructions (5 minutes)

### Step 1: Access Render Dashboard

1. Navigate to: https://dashboard.render.com
2. Log in with Voxanne AI Render credentials
3. Select the **backend service** (not the static site)
4. Click **"Environment"** tab in left sidebar

### Step 2: Update FRONTEND_URL

1. Find the `FRONTEND_URL` environment variable
2. Click **"Edit"** button next to it
3. Change value from:
   ```
   https://callwaitingai.dev
   ```
   To:
   ```
   https://voxanne.ai
   ```
4. Click **"Save Changes"**

### Step 3: Trigger Redeploy

**Option A: Automatic (Recommended)**
- Render will auto-redeploy within 60 seconds after env var change
- Monitor the "Events" tab for deployment status

**Option B: Manual**
- Click **"Manual Deploy"** button
- Select **"Clear build cache & deploy"**
- Click **"Deploy"**

### Step 4: Wait for Deployment (2-3 minutes)

Monitor deployment logs:
```
[Render] Building...
[Render] Installing dependencies...
[Render] Starting server...
✅ [Server] Voxanne Backend Server Started
   Backend URL: https://api.voxanne.ai
```

## Verification Steps

### Test 1: WebSocket Connection (Browser Console)

Open browser developer console and run:

```javascript
const ws = new WebSocket('wss://api.voxanne.ai/ws/call');

ws.onopen = () => console.log('✅ WebSocket connected successfully');
ws.onerror = (err) => console.error('❌ WebSocket connection failed', err);
ws.onclose = (event) => console.log(`WebSocket closed: code=${event.code}, reason="${event.reason}"`);
```

**Expected output:**
```
✅ WebSocket connected successfully
WebSocket closed: code=1000, reason=""
```

**Failure output (if not fixed):**
```
❌ WebSocket connection failed
WebSocket closed: code=1006, reason=""
```

### Test 2: cURL with Origin Header

```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Origin: https://voxanne.ai" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://api.voxanne.ai/ws/call
```

**Expected response:**
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**Failure response (if not fixed):**
```http
HTTP/1.1 403 Forbidden
```

### Test 3: Browser Test Feature

1. Navigate to https://voxanne.ai/dashboard/agent-configuration
2. Scroll to "Test Agent" section
3. Click **"Browser Test"** button
4. Verify modal opens without "Connection Error"
5. Click microphone button
6. Speak: "Hello"
7. Verify AI responds

**Expected:** Call connects, AI responds
**Failure:** "Connection Error: WebSocket connection failed"

### Test 4: Live Call Monitoring

1. Navigate to https://voxanne.ai/dashboard/calls
2. Make a test call to your Vapi phone number
3. Verify call appears in real-time dashboard
4. Verify call status updates live (ringing → in-progress → completed)

**Expected:** Real-time updates visible
**Failure:** Call only appears after refresh, no live updates

## Rollback Procedure

If WebSocket issues persist after fix:

1. Revert `FRONTEND_URL` to old value:
   ```bash
   FRONTEND_URL=https://callwaitingai.dev
   ```
2. Redeploy backend
3. Check server.ts logs for actual origin being sent:
   ```
   [WebSocket] Origin not allowed { origin: '...', allowedOrigins: [...] }
   ```
4. Add the actual origin to hardcoded `allowedOrigins` array in server.ts:
   ```typescript
   const allowedOrigins = [
       // ... existing origins
       'https://actual-frontend-domain.com', // Add this
   ];
   ```
5. Commit and push to trigger deployment

## Prevention

### Code-Level Fix Applied

The code already has `voxanne.ai` hardcoded in `allowedOrigins` ([server.ts:501-502](backend/src/server.ts#L501-L502)):

```typescript
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://voxanne.ai',          // ✅ Hardcoded
    'https://www.voxanne.ai',      // ✅ Hardcoded
    // ...
];
```

This means WebSockets will work **even if FRONTEND_URL is not updated**. However, updating the environment variable is recommended for:
1. Consistency across the codebase
2. Future-proofing if hardcoded origins are removed
3. Matching other services that rely on FRONTEND_URL

### Future Domain Changes

If the domain changes again (e.g., voxanne.ai → newdomain.com):

1. Update `FRONTEND_URL` environment variable in Render
2. Add new domain to hardcoded `allowedOrigins` in server.ts
3. Keep old domain for 30 days (backward compatibility)
4. Remove old domain after migration complete

## Related Files

- `backend/src/server.ts` (lines 498-515) - WebSocket origin validation
- `backend/src/server.ts` (lines 160-166) - CORS origin validation (also uses voxanne.ai)

## Monitoring

After fix is deployed, monitor for 24 hours:

1. **Sentry errors**: Search for "WebSocket" or "Origin not allowed"
   - Expected: 0 new errors
   - Alert threshold: >5 errors/hour

2. **Server logs**: Check for rejected origins
   ```bash
   # In Render dashboard, click "Logs" tab
   grep "Origin not allowed" logs.txt
   ```
   - Expected: 0 occurrences from voxanne.ai
   - Acceptable: Occurrences from unknown/malicious origins

3. **User reports**: Monitor support channels
   - Expected: 0 "Browser Test not working" tickets
   - Action: If 2+ tickets, investigate immediately

## Success Criteria

✅ WebSocket connections from https://voxanne.ai succeed
✅ Browser Test feature works without errors
✅ Live call monitoring shows real-time updates
✅ No WebSocket-related errors in Sentry
✅ Server logs show successful WebSocket upgrades

## Contact

If issues persist after following this guide:

- **Slack:** #engineering-alerts channel
- **On-call:** [On-call phone number]
- **Escalation:** Check RUNBOOK.md for WebSocket troubleshooting

## Related Documentation

- [DISASTER_RECOVERY_PLAN.md](DISASTER_RECOVERY_PLAN.md) - Scenario 5: Application-Level Corruption
- [RUNBOOK.md](RUNBOOK.md) - WebSocket connection issues
- [Production Audit Plan](/.claude/plans/majestic-foraging-barto.md) - Critical Issue #1 details

---

**Created:** 2026-02-01
**Last Updated:** 2026-02-01
**Status:** ✅ READY TO DEPLOY
**Estimated Fix Time:** 5 minutes
**Risk Level:** LOW (hardcoded fallback exists)
