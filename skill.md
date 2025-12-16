# Skill: Debug WebSocket 1006 for Inbound Web Test (Voxanne)

## Goal
Fix the "Browser Test" WebSocket failing with code **1006** so the UI reaches **Connected** and audio can flow Browser ⇄ Backend ⇄ Vapi.

This is a battle-tested, minimal-risk checklist to isolate:
- Browser/Network WS upgrade failures
- Backend session attachment failures
- Vapi ending the call due to missing customer audio

---

## Definitions (contracts)
- **HTTP create session**: `POST /api/founder-console/agent/web-test` returns `{ trackingId, bridgeWebsocketUrl }`.
- **WS attach**: browser connects to `WS /api/web-voice/:trackingId?userId=...`.
- **Success** is **all 3**:
  - Backend logs show **upgrade + connection handler** for that `trackingId`
  - Backend logs show **client attached** to session
  - Frontend `ws.onopen` fires and UI flips to connected

---

## Step 0 — Preconditions
- Backend running on **:3001**
- Frontend running on **:3000**
- `NEXT_PUBLIC_E2E_AUTH_BYPASS=true` (for dev-user)

---

## Step 1 — Confirm the frontend is using the correct WS URL
In browser console you must see:
- `Connecting to WebSocket: ws://localhost:3001/api/web-voice/<trackingId>?userId=dev-user`

If you see `ws://localhost:3000/...` in dev, **it will fail** unless you have a real WS proxy on :3000.

---

## Step 2 — Confirm the backend receives the WS upgrade + connection
On the backend terminal, for the same `trackingId`, you must see:
- `[WebSocket] Upgrade request received { pathname: '/api/web-voice/<trackingId>?userId=dev-user' ... }`
- `[WebSocket] Handling /api/web-voice upgrade`
- `[WebSocket] Upgrade successful, emitting connection event`
- `[WebVoice] WS connection attempt { trackingId: '<trackingId>', userId: 'dev-user' ... }`

### If you see upgrade logs but NOT the `Upgrade successful` line
This means the WS handshake is not completing.

**Common causes**:
- Another server is bound to the port
- The request is being intercepted by Next.js routing
- Proxy/rewrites are changing headers in a way that breaks ws handshake

---

## Step 3 — Confirm the session attachment succeeds
Backend must log:
- `[WebVoice] ✅ Client attached to session { trackingId: ... }`

If you get:
- `Failed to attach to session`

Then one of these is true:
- Wrong `trackingId`
- Session not in memory (created too late / cleaned up)
- Wrong user authorization

---

## Step 4 — CLI isolation test (bypass browser)
This isolates frontend issues.

1) Create a session:
```bash
curl -s -X POST http://localhost:3001/api/founder-console/agent/web-test \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dev' | cat
```
2) Take the returned `trackingId` and connect:
```bash
npx wscat -c "ws://localhost:3001/api/web-voice/<trackingId>?userId=dev-user"
```

Expected:
- `connected (press CTRL+C to quit)`

If `wscat` cannot connect, the issue is backend/server-level.

---

## Step 5 — If WS attaches but Vapi ends with “did not receive customer audio”
This is **audio pipeline**, not WS.

Backend logs will show:
- `endedReason":"call.in-progress.error-assistant-did-not-receive-customer-audio"`

Fix checklist:
- Confirm browser mic permission granted
- Confirm recorder is sending binary PCM frames to WS
- Add a short log counter on backend for bytes received from client WS (redact content)

---

## Minimal, safe instrumentation (temporary)
Add only these logs (no PII):
- Frontend: log ws URL, ws `readyState` transitions
- Backend: log per `trackingId`:
  - upgrade received
  - connection attempt
  - attach success/failure reason
  - bytes received from client (count only)

---

## Rollback plan
If changes make things worse:
- Revert any Next.js routes under `/api/web-voice/*` (Next cannot handle WS upgrades)
- Ensure browser connects directly to backend WS at **:3001**

---

## Expected “golden path” log timeline
1) Frontend:
- Web test initiated → trackingId
- Connecting to WebSocket → `ws://localhost:3001/...`
- WebSocket connected

2) Backend:
- Session created and registered
- Upgrade request received
- Upgrade successful
- WS connection attempt
- ✅ Client attached

3) Vapi:
- assistant.started
- transcript/audio events
