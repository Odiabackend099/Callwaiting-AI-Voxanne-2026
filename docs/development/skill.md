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


# Skill: Fix Supabase Google OAuth Redirect + PKCE (Voxanne)

## Goal
Fix Google OAuth so it always:
- returns to `.../auth/callback?code=...`
- successfully exchanges the session (no `400 pkce` / `auth_failed`)
- lands on `.../dashboard`

This skill is designed for agent execution: configuration-first, minimal-risk, reproducible.

---

## Definitions (contracts)
- **App callback route (authoritative):** `GET /auth/callback`
  - exchanges `code` via `supabase.auth.exchangeCodeForSession(code)`
  - redirects to `next` (default `/dashboard`)
- **Post-login landing:** `/dashboard`
- **OAuth initiation (client):** `signInWithOAuth({ options: { redirectTo: getAuthCallbackUrl() } })`
- **Allowed redirect URLs (Supabase):** must include the exact callback URLs used in dev/prod, including `www`/non-`www`.

---

## Step 0 — Preconditions
- Frontend running on `http://localhost:3000`
- Supabase project selected (prod)
- You can reproduce the failure in **incognito**
- You do NOT rely on stale service workers (see Step 4)

---

## Step 1 — Capture the failure signature (no guessing)
1) Incognito → `http://localhost:3000/login`
2) Click Google
3) After redirect back to app, record:
- Final URL (`/auth/callback?...` OR `/?code=...`)
- Error query on login page (`/login?error=...`)

**Decision:**
- If you land on `/?code=...`, callback route is bypassed → fix Supabase allowlist / fallback routing.
- If you land on `/auth/callback?code=...` but then go to `/login?error=...`, exchange failed → diagnose PKCE/cookies/origin.

---

## Step 2 — Verify Supabase URL Configuration (most common root cause)
Supabase Dashboard → Authentication → URL Configuration

### Site URL
Must match your canonical production host (choose one):
- `https://www.callwaitingai.dev` OR
- `https://callwaitingai.dev`

### Redirect URLs (allowlist)
Must include **exact** callback URLs used by the app:
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=/update-password`
- `https://www.callwaitingai.dev/auth/callback`
- `https://www.callwaitingai.dev/auth/callback?next=/update-password`
- (optional, if non-www is still served)
  - `https://callwaitingai.dev/auth/callback`
  - `https://callwaitingai.dev/auth/callback?next=/update-password`

**Fail condition:** any mismatch of port (`9121` vs `3000`) or domain (`www` vs non-`www`) can cause:
- redirect to Site URL root `/?code=...`
- PKCE verifier mismatch → `exchangeCodeForSession` fails

---

## Step 3 — Verify Google Cloud OAuth Client redirect URIs
Google Cloud Console → OAuth Client → Authorized redirect URIs

Include:
- `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- `http://localhost:3000/auth/callback`
- `https://www.callwaitingai.dev/auth/callback`

If you use non-www, include it too.

---

## Step 4 — Eliminate Service Worker / PWA interference (must-do in this repo)
In Chrome devtools (on localhost and prod):
- Application → Service Workers → **Unregister**
- Application → Storage → **Clear site data**

Rationale: stale SW can force asset/domain mismatches and break OAuth continuity.

---

## Step 5 — Confirm the app is generating the correct `redirectTo`
Expected at runtime:
- On `http://localhost:3000`, `getAuthCallbackUrl()` must resolve to `http://localhost:3000/auth/callback`
- On `https://www.callwaitingai.dev`, it must resolve to `https://www.callwaitingai.dev/auth/callback`

**Repo note:** The helper should prefer `window.location.origin` in the browser to avoid www/port drift.

---

## Step 6 — Minimal instrumentation (temporary, safe)
Only if exchange still fails:

1) In `src/app/auth/callback/route.ts`, log in non-production only:
- `{ code: error.code, name: error.name, message: error.message }`
2) Redirect back to login with a sanitized error:
- `/login?error=<safeError>`

Never log:
- auth codes
- tokens
- user emails

---

## Step 7 — Failsafe: handle `/?code=...` by forwarding to `/auth/callback`
If Supabase (or a misconfig) ever sends `code` to `/`, the homepage must forward it.

Minimal behavior:
- If `window.location.search` contains `code=...`, redirect to `/auth/callback` preserving querystring.

---

## Verification checklist (golden path)
### Local
- Google OAuth returns to: `http://localhost:3000/auth/callback?code=...`
- Callback redirects to: `http://localhost:3000/dashboard`
- Refresh `/dashboard` keeps you authenticated

### Production
- Google OAuth returns to: `https://www.callwaitingai.dev/auth/callback?code=...`
- Callback redirects to: `https://www.callwaitingai.dev/dashboard`

---

## Rollback plan
- If auth breaks after changes:
  - revert the root “code catcher” forwarding logic
  - revert any redirect helper changes
  - restore Supabase URL configuration to last-known-good
