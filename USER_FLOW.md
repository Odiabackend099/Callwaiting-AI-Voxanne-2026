# Voxanne Complete User Flow

## Overview
This document maps the complete user journey from landing page through authentication, configuration, testing, and inbound call handling.

---

## Phase 1: Landing Page & Authentication

### Step 1.1: Landing Page
- **URL:** `http://localhost:3000`
- **Expected:** Hero section with "Book Demo" / "Get Started" CTA
- **Components:** Navbar, Hero, TrustedBy, RevenueLeak, HowItWorks, Pricing, etc.
- **Action:** Click "Get Started" or "Sign Up" button
- **Next:** → Sign Up page

### Step 1.2: Sign Up
- **URL:** `http://localhost:3000/(auth)/sign-up`
- **Expected:** Email/password signup form
- **Backend:** Supabase Auth
- **Action:** Enter email, password, confirm password → Click "Sign Up"
- **Next:** → Email verification (if required) → Login

### Step 1.3: Login
- **URL:** `http://localhost:3000/(auth)/login`
- **Expected:** Email/password login form
- **Backend:** Supabase Auth
- **Action:** Enter email, password → Click "Login"
- **Next:** → Dashboard (middleware redirects authenticated users)

---

## Phase 2: Dashboard & Configuration

### Step 2.1: Dashboard Home
- **URL:** `http://localhost:3000/dashboard`
- **Expected:** 
  - LeftSidebar with navigation (Dashboard, Call Logs, Agent Config, API Keys, Test Agent)
  - Stats cards (Total Calls, Inbound, Outbound, Completed, Today's Calls, Avg Duration)
  - Recent calls widget
- **Auth Guard:** Redirects to login if not authenticated
- **Backend Calls:**
  - `GET /api/founder-console/calls/recent` (recent calls)
  - `GET /api/founder-console/leads` (stats)
- **Action:** Click "API Keys" in sidebar
- **Next:** → API Keys configuration

### Step 2.2: API Keys Configuration
- **URL:** `http://localhost:3000/dashboard/api-keys`
- **Expected:**
  - Vapi API Key input (private, masked)
  - Vapi Public Key input
  - Twilio Account SID input
  - Twilio Auth Token input
  - Twilio Phone Number input (E.164 format)
  - Status indicators (Vapi Connected / Not Configured, Twilio Connected / Not Configured)
- **Backend Calls:**
  - `GET /api/founder-console/settings` (load current keys)
  - `POST /api/founder-console/settings` (save keys)
  - `POST /api/integrations/vapi/test` (validate Vapi key)
- **Action:** 
  1. Fill all fields
  2. Click "Save Changes"
  3. Confirm status shows "Vapi Connected" and "Twilio Connected"
- **Next:** → Agent Config

### Step 2.3: Agent Configuration
- **URL:** `http://localhost:3000/dashboard/agent`
- **Expected:**
  - System Prompt textarea (large)
  - First Message textarea
  - Voice dropdown (populated from Vapi)
  - Language dropdown
  - Max Call Duration input (seconds, 60-3600)
  - "Save Changes" button
- **Dependencies:** Vapi API key must be configured first
- **Backend Calls:**
  - `GET /api/founder-console/agent/config` (load current config)
  - `GET /api/assistants/voices/available` (populate voice dropdown)
  - `POST /api/founder-console/agent/behavior` (save config)
  - **RPC:** `public.update_agent_and_integrations()` (updates agents table + creates Vapi assistant)
- **Action:**
  1. Fill system prompt, first message, select voice, set duration
  2. Click "Save Changes"
  3. Confirm "Saved!" indicator appears
- **Next:** → Inbound Config (if you want to receive inbound calls)

### Step 2.4: Inbound Configuration
- **URL:** `http://localhost:3000/dashboard/inbound-config`
- **Expected:**
  - Twilio Account SID input
  - Twilio Auth Token input
  - Twilio Phone Number input (the inbound number you own)
  - "Activate Inbound" / "Setup" button
  - Status indicator (Active / Not Active)
  - "Test Call" button (optional)
- **Dependencies:** 
  - Vapi API key configured
  - Agent Config saved
  - Twilio credentials configured
- **Backend Calls:**
  - `GET /api/inbound/status` (check current status)
  - `POST /api/inbound/setup` (activate inbound number)
  - `POST /api/inbound/test` (optional test call)
- **Vapi Integration (server-side):**
  - Import Twilio number into Vapi
  - Link number to inbound assistant
- **Action:**
  1. Fill Twilio credentials (if not already in API Keys)
  2. Click "Activate Inbound"
  3. Confirm status shows "Active"
- **Next:** → Test Agent (to test before real inbound call)

---

## Phase 3: Testing

### Step 3.1: Test Agent (Web Browser Microphone)
- **URL:** `http://localhost:3000/dashboard/test`
- **Expected:**
  - "Start Call" button
  - Microphone permission request
  - Live transcript display
  - Call status (Connecting, Active, Ended)
  - Duration timer
  - "End Call" button
  - Transcript history
- **Dependencies:** Agent Config saved
- **Backend Calls:**
  - `POST /api/founder-console/calls/start` (initiate test call)
  - `POST /api/founder-console/calls/end` (end test call)
  - `WS /api/web-voice` (WebSocket for real-time audio + transcript)
- **Action:**
  1. Click "Start Call"
  2. Allow microphone access
  3. Speak to the agent
  4. Watch live transcript update
  5. Click "End Call" when done
- **Expected Outcome:** Call appears in Call Logs with `is_test_call: true`
- **Next:** → Call Logs (to verify test call was logged)

### Step 3.2: Call Logs
- **URL:** `http://localhost:3000/dashboard/calls`
- **Expected:**
  - Table with columns: Phone, Status, Duration, Started At, Ended At, Channel (Inbound/Outbound/Test)
  - Pagination
  - Inbound badge (green) for inbound calls
  - Outbound badge (blue) for outbound calls
  - Test badge (yellow) for test calls
  - Click row to view transcript
- **Backend Calls:**
  - `GET /api/founder-console/calls/recent` (paginated call list)
- **Data Source:** `call_logs` table (with `metadata.channel` for badge classification)
- **Action:**
  1. Verify test call appears with correct badge
  2. Click call row to view transcript
- **Next:** → Real Inbound Call Test

---

## Phase 4: Real Inbound Call Test

### Step 4.1: Place Real Inbound Call
- **Action:** Call your Twilio inbound number from a real phone
- **Expected Backend Flow:**
  1. Vapi receives call from Twilio
  2. Vapi sends `call.started` webhook to `POST /api/webhooks/vapi`
  3. Backend creates `call_tracking` row (if inbound, creates new row with `metadata.channel='inbound'`)
  4. Vapi sends `call.transcribed` events → backend broadcasts to WebSocket
  5. Vapi sends `call.ended` / `end-of-call-report` → backend updates `call_logs` with duration, status
- **Expected DB State:**
  - `call_tracking`: new row with `vapi_call_id`, `status='completed'`, `metadata.channel='inbound'`
  - `call_logs`: new row with matching `vapi_call_id`, `metadata.channel='inbound'`, `duration_seconds` set
  - `call_transcripts`: rows with speaker + text for each transcript event

### Step 4.2: Verify in Dashboard
- **URL:** `http://localhost:3000/dashboard/calls`
- **Expected:**
  - New call appears in list
  - Inbound badge shows (green)
  - Duration shows correctly
  - Click to view transcript
- **Action:** Refresh page, confirm call appears with correct metadata
- **Next:** → Verify DB logs (optional, for debugging)

---

## Phase 5: Verification (Optional)

### Step 5.1: Verify Database Logs
Run these queries in Supabase SQL Editor:

**A) call_tracking**
```sql
select id, vapi_call_id, status, phone, metadata, created_at
from call_tracking
order by created_at desc
limit 5;
```
**Expected:** Latest row has `metadata->>'channel' = 'inbound'`

**B) call_logs**
```sql
select id, vapi_call_id, status, started_at, ended_at, duration_seconds, metadata
from call_logs
order by started_at desc
limit 5;
```
**Expected:** Latest row has `metadata->>'channel' = 'inbound'`, `duration_seconds` set, `status='completed'`

**C) call_transcripts**
```sql
select ct.vapi_call_id, t.speaker, left(t.text, 120) as text, t.timestamp
from call_transcripts t
join call_tracking ct on ct.id = t.call_id
order by t.timestamp desc
limit 20;
```
**Expected:** Rows appear with speaker + transcript text

---

## Complete User Flow Summary

```
Landing Page (/)
    ↓
Sign Up (/(auth)/sign-up)
    ↓
Login (/(auth)/login)
    ↓
Dashboard (/dashboard)
    ↓
API Keys (/dashboard/api-keys) [REQUIRED]
    ↓
Agent Config (/dashboard/agent) [REQUIRED]
    ↓
Inbound Config (/dashboard/inbound-config) [OPTIONAL but needed for inbound]
    ↓
Test Agent (/dashboard/test) [OPTIONAL, for testing before real call]
    ↓
Call Logs (/dashboard/calls) [VERIFY calls appear here]
    ↓
Real Inbound Call (call Twilio number)
    ↓
Verify in Call Logs (/dashboard/calls)
    ↓
Verify in Database (optional)
```

---

## Critical Dependencies

| Step | Depends On | Error If Missing |
|------|-----------|------------------|
| Agent Config | Vapi API Key | "Configure Vapi API key first" |
| Inbound Config | Agent Config + Vapi Key | Inbound setup fails |
| Test Agent | Agent Config | Test call won't work |
| Real Inbound Call | Inbound Config + Twilio number linked | Call won't reach agent |
| Call Logs | call_logs table with correct schema | Calls won't display |

---

## Backend Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/founder-console/settings` | GET/POST | Load/save API keys |
| `/api/founder-console/agent/config` | GET/POST | Load/save agent config |
| `/api/founder-console/agent/behavior` | POST | Save agent behavior (calls RPC) |
| `/api/founder-console/calls/start` | POST | Start test call |
| `/api/founder-console/calls/end` | POST | End test call |
| `/api/founder-console/calls/recent` | GET | Get recent calls for dashboard |
| `/api/assistants/voices/available` | GET | Get available voices |
| `/api/integrations/vapi/test` | POST | Validate Vapi API key |
| `/api/inbound/status` | GET | Check inbound status |
| `/api/inbound/setup` | POST | Activate inbound number |
| `/api/inbound/test` | POST | Test inbound call |
| `/api/webhooks/vapi` | POST | Receive Vapi webhook events |
| `WS /api/web-voice` | WebSocket | Real-time audio + transcript |
| `WS /ws/live-calls` | WebSocket | Live call updates |

---

## Environment Variables Required

**Frontend (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**Backend (.env):**
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
VAPI_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
VAPI_WEBHOOK_SECRET=...
PORT=3001
```

---

## Testing Checklist

- [ ] Landing page loads
- [ ] Sign up works
- [ ] Login works
- [ ] Dashboard loads with sidebar
- [ ] API Keys page loads and saves
- [ ] Agent Config page loads and saves
- [ ] Inbound Config page loads and activates
- [ ] Test Agent page loads and test call works
- [ ] Test call appears in Call Logs
- [ ] Real inbound call reaches agent
- [ ] Real inbound call appears in Call Logs with correct badge
- [ ] Transcript displays correctly
- [ ] Database rows created correctly

