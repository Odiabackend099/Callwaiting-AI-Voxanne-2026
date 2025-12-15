# Voxanne Dashboard Structure

## Complete Dashboard Pages

| Page | URL | Sidebar | Backend Endpoints | Status |
|------|-----|---------|-------------------|--------|
| **Dashboard Home** | `/dashboard` | ✅ | Supabase direct (call_logs) | ✅ Complete |
| **Call Logs** | `/dashboard/calls` | ✅ | Supabase direct (call_logs, leads) | ✅ Complete |
| **Agent Config** | `/dashboard/agent` | ✅ | `/api/assistants/voices/available`, `/api/founder-console/settings`, `/api/founder-console/agent/config`, `/api/founder-console/agent/behavior` | ✅ Complete |
| **API Keys** | `/dashboard/api-keys` | ✅ | `/api/founder-console/settings` (GET/POST) | ✅ Complete |
| **Inbound Config** | `/dashboard/inbound-config` | ✅ | `/api/inbound/status`, `/api/inbound/setup`, `/api/inbound/test` | ✅ Complete |
| **Test Agent** | `/dashboard/test` | ✅ | `/api/founder-console/agent/web-test-outbound`, WebSocket `/ws/live-calls` | ✅ Complete |

---

## Navigation Structure (LeftSidebar)

```
📊 Dashboard          → /dashboard
📞 Call Logs          → /dashboard/calls
🤖 Agent Config       → /dashboard/agent
🔑 API Keys           → /dashboard/api-keys
📲 Inbound Config     → /dashboard/inbound-config
⚡ Test Agent         → /dashboard/test
---
👤 User Email
🚪 Logout
```

---

## Page Functionality Summary

### 1. Dashboard Home (`/dashboard`)
- **Purpose:** Overview of call statistics and recent activity
- **Features:**
  - Total calls, inbound, outbound, completed counts
  - Today's calls count
  - Average call duration
  - Recent calls list (last 5)
- **Data Source:** Supabase `call_logs` table

### 2. Call Logs (`/dashboard/calls`)
- **Purpose:** View and analyze all call activity
- **Features:**
  - Paginated call list
  - Direction badges (Inbound/Outbound)
  - Status badges (Completed, In Progress, Failed, Ringing)
  - Duration display
  - Lead name display
  - Export CSV button (UI only)
- **Data Source:** Supabase `call_logs` + `leads` tables

### 3. Agent Config (`/dashboard/agent`)
- **Purpose:** Configure AI agent personality and behavior
- **Features:**
  - System prompt (large textarea)
  - First message
  - Voice selection (dropdown from Vapi)
  - Language selection
  - Max call duration (60-3600 seconds)
  - Save button with success indicator
- **Backend:** `/api/founder-console/agent/behavior` (POST)
- **Dependencies:** Vapi API key must be configured first

### 4. API Keys (`/dashboard/api-keys`)
- **Purpose:** Manage Vapi and Twilio credentials
- **Features:**
  - Vapi Private API Key (masked input)
  - Twilio Account SID (masked input)
  - Twilio Auth Token (masked input)
  - Twilio Phone Number (E.164 format)
  - Default test phone number
  - Status indicators (Active/Not Configured)
- **Backend:** `/api/founder-console/settings` (GET/POST)

### 5. Inbound Config (`/dashboard/inbound-config`)
- **Purpose:** Configure Twilio number for inbound AI handling
- **Features:**
  - Twilio Account SID input
  - Twilio Auth Token input
  - Twilio Phone Number input (E.164)
  - Activate inbound button
  - Status indicator (Active/Not Configured)
  - Test Call button (when active)
  - Analytics preview (coming soon)
- **Backend:** `/api/inbound/setup` (POST), `/api/inbound/status` (GET), `/api/inbound/test` (POST)
- **Dependencies:** Vapi API key + Agent Config must be saved first

### 6. Test Agent (`/dashboard/test`)
- **Purpose:** Test agent in real-time
- **Features:**
  - **Browser Test tab:** Web microphone voice chat with live transcript
  - **Live Call tab:** Initiate outbound call to phone number with live transcript
  - Real-time transcript display
  - WebSocket connection for live updates
- **Backend:** `/api/founder-console/agent/web-test-outbound` (POST), WebSocket `/ws/live-calls`

---

## User Flow (Recommended Order)

```
1. Login
   ↓
2. API Keys (/dashboard/api-keys)
   - Configure Vapi API key
   - Configure Twilio credentials
   ↓
3. Agent Config (/dashboard/agent)
   - Set system prompt
   - Set first message
   - Select voice
   - Set max duration
   - Save
   ↓
4. Inbound Config (/dashboard/inbound-config)
   - Enter Twilio credentials
   - Activate inbound
   ↓
5. Test Agent (/dashboard/test)
   - Browser test (web microphone)
   - Live call test (phone)
   ↓
6. Call Logs (/dashboard/calls)
   - Verify calls appear
   - Check inbound/outbound badges
   ↓
7. Dashboard (/dashboard)
   - Monitor stats
   - View recent calls
```

---

## Backend Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/founder-console/settings` | GET | Load API keys status |
| `/api/founder-console/settings` | POST | Save API keys |
| `/api/founder-console/agent/config` | GET | Load agent config |
| `/api/founder-console/agent/behavior` | POST | Save agent config |
| `/api/assistants/voices/available` | GET | Get available voices |
| `/api/inbound/status` | GET | Check inbound config status |
| `/api/inbound/setup` | POST | Activate inbound number |
| `/api/inbound/test` | POST | Test inbound call |
| `/api/founder-console/agent/web-test-outbound` | POST | Start outbound test call |
| `/api/webhooks/vapi` | POST | Receive Vapi webhook events |
| `WS /ws/live-calls` | WebSocket | Live call updates |

---

## Files Structure

```
src/app/dashboard/
├── page.tsx                    # Dashboard home
├── agent/
│   └── page.tsx                # Agent configuration
├── api-keys/
│   └── page.tsx                # API keys management
├── calls/
│   └── page.tsx                # Call logs
├── inbound-config/
│   └── page.tsx                # Inbound configuration
└── test/
    └── page.tsx                # Test agent

src/components/dashboard/
└── LeftSidebar.tsx             # Shared sidebar navigation
```

---

## Removed Pages (Empty Placeholders)

- `/dashboard/settings` - Empty file, removed
- `/dashboard/voice-test` - Empty file, removed
- `/dashboard/agent-console` - Placeholder, removed earlier

---

## Verification Checklist

- [x] All 6 pages exist and are functional
- [x] All pages use shared LeftSidebar component
- [x] All pages are accessible from sidebar navigation
- [x] All pages connect to correct backend endpoints
- [x] No orphaned/unreachable pages
- [x] No duplicate/conflicting pages
- [x] Text contrast meets WCAG AA standards

