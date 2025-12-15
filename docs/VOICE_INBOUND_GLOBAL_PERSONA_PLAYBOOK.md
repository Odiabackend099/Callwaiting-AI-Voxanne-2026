# Voxanne Voice + Inbound Global Persona Playbook

## Scope
This document captures what we changed and learned while fixing:
- Inbound greeting not matching the dashboard-configured `First Message`
- Local development not receiving Vapi webhook events (no backend logs)
- API base URL issues causing `undefined` routes in the dashboard

It is written as a repeatable checklist to avoid re-introducing the same failures.

---

## Current Architecture (Mental Model)

### Components
- **Frontend (Next.js)**: `http://localhost:3000`
- **Backend (Express/ts-node)**: `http://localhost:3001`
- **Supabase (DB + Auth)**: stores org/user/agents/integrations
- **Vapi**: 
  - Hosts assistants
  - Hosts phone numbers
  - Sends call lifecycle events to `assistant.serverUrl` (webhooks)

### Key data objects
- **Agent rows** in `agents` table:
  - `role`: `inbound` vs `outbound`
  - `first_message`, `system_prompt`, `voice`, `language`, `max_call_duration`
  - `vapi_assistant_id` (maps DB agent to Vapi assistant)
- **Integrations rows** in `integrations` table:
  - `provider='vapi'` holds Vapi API key
  - `provider='twilio_inbound'` holds inbound phone number + `vapiPhoneNumberId` + `vapiAssistantId`

### Invariant
**What callers hear on inbound = Vapi assistant’s `firstMessage`** for the assistant linked to the inbound phone number.

---

## Symptoms We Saw

### 1) Inbound greeting mismatch
- Dashboard showed `First Message = "hello sam here how can i help you today"`
- Inbound call greeting sounded like a **Vapi dashboard default** (example: "I’m from wellnesspartners")

### 2) "Connection refused" / unreachable dashboard
- `ERR_CONNECTION_REFUSED` on `localhost:3000`
- Root cause: dev servers not running (nothing listening on 3000/3001)

### 3) No inbound call logs on backend
- Backend logs showed successful agent save/sync
- But **no `POST /api/webhooks/vapi`** entries when calls occurred
- Root cause: Vapi cannot reach `localhost` on your laptop

---

## Root Causes (What Actually Broke)

### Root Cause A — Wrong agent scope (inbound vs outbound)
The dashboard “Agent Config” flow initially updated the **outbound agent** only.
Inbound calls use the **inbound agent** (and its Vapi assistant) linked to the inbound number.

**Result:** Outbound greeting changed, inbound did not.

### Root Cause B — Assistant update drift (missing `firstMessage` on update)
One of the sync paths updated an existing Vapi assistant without setting `firstMessage`.
That allows Vapi to keep an old default greeting forever.

### Root Cause C — Local webhooks impossible without public URL
Vapi webhooks cannot hit `http://localhost:3001/api/webhooks/vapi`.
You must provide a public URL (`ngrok` for local dev, Render/Vercel in prod).

---

## Fixes Implemented (What We Changed)

### 1) Global Persona Sync
When you click **Save** in dashboard:
- Updates both **outbound** and **inbound** agent rows
- Syncs both corresponding Vapi assistants (parallel sync for performance)

### 2) Hardened assistant sync behavior
- Ensure **updates include `firstMessage`** (not only creates)
- Ensure voice/language/max duration stay consistent

### 3) Public webhook for local dev (ngrok)
- Start ngrok tunnel to backend port `3001`
- Set backend env var `BASE_URL` to ngrok public URL
- Restart backend
- Re-sync assistants so Vapi assistant `serverUrl` updates to public webhook endpoint

---

## Operational Checklists

### A) “Is the dashboard reachable?”
- Frontend must be running: `npm run dev` at repo root (port 3000)
- Backend must be running: `npm run dev` in `backend/` (port 3001)

Quick check:
- `http://localhost:3000` loads
- `http://localhost:3001/health` returns OK

### B) “Will inbound calls hit my local backend?” (Local dev)
1. Start ngrok:
   - `ngrok http 3001`
2. Set backend env:
   - `backend/.env`: `BASE_URL=https://<ngrok-subdomain>.ngrok-free.dev`
3. Restart backend
4. Re-sync assistants (Save in dashboard)
5. Place inbound call
6. Confirm backend logs show:
   - `POST /api/webhooks/vapi`

### C) “Does inbound greeting match dashboard First Message?”
1. Set dashboard First Message to a unique string, e.g. `HELLO_VERIFY_GLOBAL_SYNC_2026`
2. Save
3. Place inbound call
4. Confirm greeting matches

If mismatch:
- Verify inbound phone number is linked to the same `vapi_assistant_id` that was synced
- Verify Vapi assistant’s `firstMessage` in Vapi dashboard

---

## Mistakes We Made (Avoid Repeating)

### 1) Treating `localhost` as reachable by Vapi
It is not. You must use a public URL.

### 2) Not enforcing “update parity” in sync code
Sync/update code paths must be symmetrical:
- **Create** and **Update** must set the same fields (`firstMessage`, `serverUrl`, etc.)

### 3) Multiple sync code paths with different semantics
Having multiple “assistant sync” implementations increases drift risk.
Prefer a single shared helper for all sync operations.

### 4) Logging sensitive payloads
Do not log entire prompts or secrets.
Log:
- lengths
- request IDs
- IDs (agentId/assistantId)
- redacted keys

---

## What We Learned
- Inbound greeting control lives in **Vapi assistant config**, not the frontend.
- “Global persona” should be an explicit product decision:
  - apply to inbound only / outbound only / both
- Local dev for telephony/webhooks always needs a public tunnel.

---

## GitHub Checklist (Commit & Push)

1. `git status`
2. `git diff`
3. `git add -A`
4. `git commit -m "Fix global persona sync + ngrok webhook playbook"`
5. `git push`

---

## Deferred / Future Hardening
- Add tests that assert:
  - updating agent first message triggers Vapi assistant firstMessage update
  - inbound call uses the updated assistant
- Add a single source-of-truth sync module used by both founder-console and assistants routes
