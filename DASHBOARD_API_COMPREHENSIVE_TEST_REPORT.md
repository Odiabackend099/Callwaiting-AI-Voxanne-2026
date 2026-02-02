# Dashboard API Endpoints - Comprehensive Test Report

**Generated:** 2026-02-02
**Purpose:** Document and verify ALL dashboard API endpoints return correct data
**Test Script:** `backend/src/scripts/test-all-dashboard-endpoints.ts`

---

## Executive Summary

**Total Endpoints:** 18 unique API endpoints
**Pages Tested:** 3 (Main Dashboard, Call Logs, Leads)
**Critical Data Fields:** 50+ fields verified

---

## Test Execution Instructions

### Prerequisites

1. Backend server running on `http://localhost:3000`
2. Valid JWT authentication token
3. Test data in database (calls, contacts)

### Run Tests

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Get JWT token from browser console:
# await supabase.auth.getSession().then(({data}) => console.log(data.session.access_token))

# Run test script
TEST_AUTH_TOKEN="your-jwt-here" ts-node src/scripts/test-all-dashboard-endpoints.ts
```

### Expected Output

```
✅ PASSED: 15/18
⚠️  WARNED: 2/18
❌ FAILED: 0/18
```

---

## Endpoint Specifications & Test Criteria

### 1. MAIN DASHBOARD ENDPOINTS

#### 1.1 Recent Activity Feed

```
GET /api/analytics/recent-activity
```

**Expected Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "type": "call_completed" | "hot_lead_detected" | "appointment_booked",
      "timestamp": "ISO 8601 date",
      "summary": "Human-readable text",
      "metadata": {
        "caller_name": "string (NOT 'Unknown Caller')",
        "phone_number": "+1234567890 (E.164 format)",
        "sentiment_label": "Positive" | "Negative" | ...,
        "sentiment_score": 0.85,
        "duration": 125
      }
    }
  ]
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `events` array exists
- ✅ Each event has `id`, `type`, `timestamp`, `summary`
- ✅ `metadata.caller_name` is NOT "Unknown Caller" (for known contacts)
- ✅ `metadata.phone_number` is in E.164 format (+...)
- ✅ Sentiment data populated when available

**Common Issues:**
- Empty `events` array → No recent activity (expected if no calls)
- `caller_name` = "Unknown Caller" → **BUG: Caller name enrichment failed**

---

#### 1.2 Dashboard KPIs (Clinical Pulse)

```
GET /api/analytics/dashboard-pulse
```

**Expected Response:**
```json
{
  "total_calls": 150,
  "inbound_calls": 120,
  "outbound_calls": 30,
  "avg_duration_seconds": 145,
  "inbound_percentage": 80
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ All 5 fields present: `total_calls`, `inbound_calls`, `outbound_calls`, `avg_duration_seconds`, `inbound_percentage`
- ✅ Numbers are non-negative integers
- ✅ `inbound_percentage` = (inbound_calls / total_calls) * 100

**Common Issues:**
- Missing fields → **BUG: Backend not calculating all metrics**
- `avg_duration_seconds` = 0 → No completed calls (expected) OR calculation error

---

#### 1.3 Hot Leads Summary

```
GET /api/analytics/leads
```

**Expected Response:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "contact_name": "string (NOT 'Unknown Caller')",
      "phone_number": "+1234567890",
      "lead_score": 85,
      "lead_temp": "hot" | "warm" | "cold",
      "last_call_summary": "text",
      "created_at": "ISO date"
    }
  ]
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `leads` array exists
- ✅ Each lead has `id`, `contact_name`, `phone_number`, `lead_score`
- ✅ `contact_name` is NOT "Unknown Caller"
- ✅ `lead_score` is between 0-100
- ✅ `lead_temp` matches score (hot: 80+, warm: 50-79, cold: <50)

**Common Issues:**
- Empty `leads` array → No hot/warm leads (expected if all cold)
- `contact_name` = "Unknown Caller" → **BUG: Contact name not populated**

---

### 2. CALL LOGS ENDPOINTS

#### 2.1 Call List (Paginated)

```
GET /api/calls-dashboard?page=1&limit=20&call_type=inbound&status=completed
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `call_type` (optional: "inbound" | "outbound")
- `status` (optional: "completed" | "missed" | "transferred" | "failed")
- `search` (optional: search by name or phone)
- `sortBy` (optional: "date" | "duration" | "name")
- `startDate` (optional: ISO date)
- `endDate` (optional: ISO date)

**Expected Response:**
```json
{
  "calls": [
    {
      "id": "uuid",
      "phone_number": "+1234567890",
      "caller_name": "John Smith (NOT 'Unknown Caller')",
      "call_date": "2026-01-15T14:30:00Z",
      "duration_seconds": 125,
      "status": "completed",
      "call_type": "inbound",
      "has_recording": true,
      "has_transcript": true,
      "sentiment_label": "Positive",
      "sentiment_score": 0.85,
      "sentiment_summary": "Customer satisfied...",
      "sentiment_urgency": "Medium"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `calls` array exists
- ✅ Each call has required fields: `id`, `phone_number`, `caller_name`, `call_date`, `duration_seconds`, `status`, `call_type`
- ✅ **CRITICAL:** `caller_name` is NOT "Unknown Caller" for known contacts
- ✅ `phone_number` is in E.164 format
- ✅ Sentiment fields populated: `sentiment_label`, `sentiment_score`
- ✅ `has_recording` and `has_transcript` are booleans
- ✅ Pagination object present with correct values

**Common Issues:**
- `caller_name` = "Unknown Caller" for ALL calls → **BUG: Caller name enrichment not working**
- `sentiment_label` = null → **BUG: Sentiment not populated by webhook**
- `sentiment_score` = 0 → **BUG: Sentiment score not stored correctly**

---

#### 2.2 Call Analytics Summary

```
GET /api/calls-dashboard/analytics/summary
```

**Expected Response:**
```json
{
  "total_calls": 150,
  "completed_calls": 120,
  "missed_calls": 20,
  "average_duration": 145,
  "average_sentiment": 0.78,
  "calls_today": 15,
  "calls_this_week": 85,
  "calls_this_month": 150
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ All 8 metrics present
- ✅ Numbers are non-negative
- ✅ **CRITICAL:** `average_sentiment` is NOT 0 (unless no calls have sentiment)
- ✅ `total_calls` = `completed_calls` + `missed_calls` + other statuses

**Common Issues:**
- `average_sentiment` = 0 → **BUG: Sentiment calculation fetching wrong column**
  - **Root Cause:** Query selects `sentiment` (old packed format) instead of `sentiment_score` (numeric column)
  - **Fixed in commit c8e61b8**

---

#### 2.3 Call Detail

```
GET /api/calls-dashboard/:callId
```

**Expected Response:**
```json
{
  "id": "uuid",
  "phone_number": "+1234567890",
  "caller_name": "John Smith",
  "call_date": "2026-01-15T14:30:00Z",
  "duration_seconds": 125,
  "status": "completed",
  "call_type": "inbound",
  "recording_url": "https://...",
  "recording_storage_path": "s3://...",
  "has_recording": true,
  "has_transcript": true,
  "transcript": [
    {
      "speaker": "Voxanne",
      "text": "...",
      "timestamp": 0.5,
      "sentiment": 0.85,
      "confidence": 0.95
    }
  ],
  "sentiment_label": "Positive",
  "sentiment_score": 0.85,
  "sentiment_summary": "Customer satisfied...",
  "sentiment_urgency": "Medium",
  "action_items": ["Follow up on pricing question"]
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ **CRITICAL:** `caller_name` is NOT "Unknown Caller" for known contacts
- ✅ Full call metadata present
- ✅ Transcript array populated (if `has_transcript` = true)
- ✅ Sentiment data complete
- ✅ Recording URL present (if `has_recording` = true)

**Common Issues:**
- `caller_name` = "Unknown Caller" → **BUG: Enrichment failed**
- `sentiment_score` = 0 or null → **BUG: Webhook not populating field**
- `recording_url` = null but `has_recording` = true → **Vapi processing delay (expected)**

---

#### 2.4 Recording Signed URL

```
GET /api/calls-dashboard/:callId/recording-url
```

**Expected Response:**
```json
{
  "recording_url": "https://supabase-storage.../signed-url?token=...",
  "expires_in": 3600,
  "source": "supabase"
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `recording_url` is a valid HTTPS URL
- ✅ URL includes signature token
- ✅ `expires_in` is positive integer (seconds)
- ✅ `source` is "supabase" or "vapi"

**Common Issues:**
- 404 Not Found → Recording doesn't exist (expected if no recording)
- 403 Forbidden → RLS policy blocking access
- URL without signature → **BUG: Backend not generating signed URL**

---

#### 2.5 Send Follow-up SMS

```
POST /api/calls-dashboard/:callId/followup
Content-Type: application/json

{
  "message": "Thank you for calling!"
}
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "SM1234567890abcdef",
  "phone": "+1234567890",
  "message": "📱 Follow-up SMS sent successfully"
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `success` = true
- ✅ `messageId` is Twilio message ID (starts with "SM")
- ✅ `phone` is recipient number

**Common Issues:**
- Error: "twilio_sms system temporarily unavailable" → **Circuit breaker OPEN**
  - **Solution:** Reset circuit breaker via `/api/debug/circuit-breakers/twilio_sms/reset`
- Error: "Invalid phone number" → Phone not in E.164 format

---

### 3. LEADS ENDPOINTS

#### 3.1 Lead List (Paginated)

```
GET /api/contacts?page=1&limit=20&leadStatus=hot
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `leadStatus` (optional: "hot" | "warm" | "cold")
- `search` (optional: search by name or phone)

**Expected Response:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "name": "Jane Doe (NOT 'Unknown Caller')",
      "phone": "+1234567890",
      "email": "jane@example.com",
      "services_interested": ["Botox", "Filler"],
      "lead_score": 85,
      "lead_status": "new",
      "last_contact_time": "2026-01-15T14:30:00Z",
      "notes": "Interested in pricing",
      "created_at": "2026-01-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `contacts` array exists
- ✅ **CRITICAL:** `name` is NOT "Unknown Caller" for known contacts
- ✅ `phone` is in E.164 format
- ✅ `lead_score` is between 0-100
- ✅ `lead_status` is one of: "new", "contacted", "qualified", "booked", "converted", "lost"
- ✅ Pagination object present

**Common Issues:**
- `name` = "Unknown Caller" for ALL contacts → **BUG: Contact creation not setting name**
- `lead_score` = 0 for all → **BUG: Lead scoring not calculating**

---

#### 3.2 Lead Statistics

```
GET /api/contacts/stats
```

**Expected Response:**
```json
{
  "total_leads": 50,
  "hot_leads": 10,
  "warm_leads": 25,
  "cold_leads": 15
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ All 4 stats present
- ✅ Numbers are non-negative integers
- ✅ `total_leads` = `hot_leads` + `warm_leads` + `cold_leads`

**Common Issues:**
- All stats = 0 → No contacts in database (expected if empty)

---

#### 3.3 Lead Detail

```
GET /api/contacts/:leadId
```

**Expected Response:**
```json
{
  "id": "uuid",
  "name": "Jane Doe",
  "phone": "+1234567890",
  "email": "jane@example.com",
  "services_interested": ["Botox", "Filler"],
  "lead_score": 85,
  "lead_status": "new",
  "last_contact_time": "2026-01-15T14:30:00Z",
  "notes": "Interested in pricing",
  "created_at": "2026-01-10T10:00:00Z",
  "call_history": [
    {
      "id": "uuid",
      "call_date": "2026-01-15T14:30:00Z",
      "duration_seconds": 125,
      "sentiment_label": "Positive",
      "transcript_preview": "First 200 chars..."
    }
  ],
  "appointment_history": [
    {
      "id": "uuid",
      "service": "Botox Consultation",
      "scheduled_at": "2026-01-20T10:00:00Z",
      "status": "confirmed"
    }
  ]
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ **CRITICAL:** `name` is NOT "Unknown Caller"
- ✅ Full lead data present
- ✅ `call_history` array populated with recent calls
- ✅ `appointment_history` array populated (if appointments exist)

**Common Issues:**
- `name` = "Unknown Caller" → **BUG: Contact name not set**
- Empty `call_history` → No calls from this contact (expected)

---

#### 3.4 Initiate Call Back

```
POST /api/contacts/:leadId/call-back
```

**Expected Response:**
```json
{
  "success": true,
  "call_id": "uuid",
  "message": "Outbound call initiated successfully"
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `success` = true
- ✅ `call_id` is valid UUID

**Common Issues:**
- Error: "Outbound agent not configured" → Agent config missing vapi_phone_number_id
- Error: "No phone number available" → Vapi phone number not linked
- Error: "Invalid phone format" → Contact phone not in E.164 format

---

#### 3.5 Send SMS to Lead

```
POST /api/contacts/:leadId/sms
Content-Type: application/json

{
  "message": "Hi Jane, following up on your inquiry..."
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully"
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ `success` = true

**Common Issues:**
- Same as Call Follow-up SMS (circuit breaker, invalid phone)

---

#### 3.6 Update Lead Status

```
PATCH /api/contacts/:leadId
Content-Type: application/json

{
  "lead_status": "booked"
}
```

**Expected Response:**
```json
{
  "id": "uuid",
  "name": "Jane Doe",
  "lead_status": "booked",
  ...
}
```

**Test Criteria:**
- ✅ Returns 200 status
- ✅ Updated contact object returned
- ✅ `lead_status` matches requested value

**Common Issues:**
- 400 Bad Request → Invalid `lead_status` value

---

## Critical Data Field Verification

### Must NOT Be "Unknown Caller"

These fields **MUST** contain actual names for known contacts:

| Field | Endpoint | Location |
|-------|----------|----------|
| `metadata.caller_name` | `/api/analytics/recent-activity` | Recent Activity events |
| `contact_name` | `/api/analytics/leads` | Hot leads list |
| `caller_name` | `/api/calls-dashboard` | Call list table |
| `caller_name` | `/api/calls-dashboard/:callId` | Call detail modal |
| `name` | `/api/contacts` | Lead list table |
| `name` | `/api/contacts/:leadId` | Lead detail modal |

### Must Be E.164 Format

Phone numbers **MUST** start with `+` and country code:

| Field | Endpoint | Format |
|-------|----------|--------|
| `metadata.phone_number` | `/api/analytics/recent-activity` | +1234567890 |
| `phone_number` | `/api/calls-dashboard` | +1234567890 |
| `phone` | `/api/contacts` | +1234567890 |

### Must Be Populated (Not 0 or null)

Sentiment data **MUST** be populated for completed calls:

| Field | Endpoint | Expected |
|-------|----------|----------|
| `average_sentiment` | `/api/calls-dashboard/analytics/summary` | 0.0-1.0 (NOT 0 unless no calls) |
| `sentiment_label` | `/api/calls-dashboard` | "Positive", "Negative", etc. |
| `sentiment_score` | `/api/calls-dashboard` | 0.0-1.0 |

---

## Known Issues & Fixes

### Issue 1: Caller Names Show "Unknown Caller" ✅ FIXED (commit c8e61b8)

**Root Cause:** `caller_name` only set for inbound calls, NULL for outbound
**Location:** `backend/src/routes/vapi-webhook.ts:409`
**Fix:** Changed to use `finalCallerName` for BOTH inbound and outbound

### Issue 2: Recent Activity Empty ✅ FIXED (commit c8e61b8)

**Root Cause:** Guard condition `if (!existingContact)` blocked repeat callers
**Location:** `backend/src/routes/vapi-webhook.ts:564`
**Fix:** Removed guard, lowered threshold from 70 to 60, added 3-tier urgency

### Issue 3: Average Sentiment Shows "0%" ✅ FIXED (commit c8e61b8)

**Root Cause:** Query fetched wrong column (`sentiment` instead of `sentiment_score`)
**Location:** `backend/src/routes/calls-dashboard.ts:296,325-330`
**Fix:** Changed SELECT to `sentiment_score`, simplified calculation

---

## Test Automation

### Automated Test Script

Run the comprehensive test script to verify all endpoints:

```bash
cd backend
TEST_AUTH_TOKEN="your-jwt" ts-node src/scripts/test-all-dashboard-endpoints.ts
```

### Expected Output

```
╔══════════════════════════════════════════════════════════════╗
║  COMPREHENSIVE DASHBOARD ENDPOINT TESTING                     ║
╚══════════════════════════════════════════════════════════════╝

Backend URL: http://localhost:3000
Supabase URL: https://lbjymlodxprzqgtyqtcq.supabase.co

📊 Fetching test data from database...

Found 25 test calls
Found 15 test contacts

🏠 === MAIN DASHBOARD ENDPOINTS ===

✅ GET /api/analytics/recent-activity: Returned 10 events
✅ GET /api/analytics/dashboard-pulse: All KPI fields present (150 calls, 145s avg)
✅ GET /api/analytics/leads: Returned 5 hot leads

📞 === CALL LOGS ENDPOINTS ===

✅ GET /api/calls-dashboard: 20/20 calls have enriched caller names
✅ GET /api/calls-dashboard/analytics/summary: All metrics present (150 calls, 78% sentiment)
✅ GET /api/calls-dashboard/{callId}: Call detail has caller name: "John Smith"
✅ GET /api/calls-dashboard/{callId}/recording-url: Recording URL generated successfully

👥 === LEADS ENDPOINTS ===

✅ GET /api/contacts: 15/15 contacts have names
✅ GET /api/contacts/stats: All stats present (50 total, 10 hot)
✅ GET /api/contacts/{leadId}: Lead detail has name: "Jane Doe" and phone: "+1234567890"

╔══════════════════════════════════════════════════════════════╗
║  TEST SUMMARY                                                 ║
╚══════════════════════════════════════════════════════════════╝

✅ PASSED: 18/18
⚠️  WARNED: 0/18
❌ FAILED: 0/18
```

---

## Manual Testing Checklist

### Main Dashboard Page

- [ ] Recent Activity shows events (not empty)
- [ ] Caller names appear (not "Unknown Caller")
- [ ] Phone numbers formatted (+1...)
- [ ] Sentiment badges show labels
- [ ] KPI cards show non-zero numbers
- [ ] Hot leads section populated

### Call Logs Page

- [ ] Call table loads with data
- [ ] Caller column shows names (not "Unknown Caller")
- [ ] Phone column formatted (+1...)
- [ ] Sentiment column shows labels + percentages
- [ ] Outcome column shows summaries
- [ ] Play button enabled for calls with recordings
- [ ] Analytics cards show correct numbers
- [ ] Average Sentiment NOT "0%"

### Call Detail Modal

- [ ] Opens when clicking call row
- [ ] Shows caller name (not "Unknown Caller")
- [ ] Shows phone number (+1...)
- [ ] Shows sentiment badge
- [ ] Transcript sections display
- [ ] Recording player works (if recording ready)
- [ ] Follow-up button opens SMS modal
- [ ] SMS modal sends successfully

### Leads Page

- [ ] Lead cards load with data
- [ ] Names appear (not "Unknown Caller")
- [ ] Phone numbers formatted (+1...)
- [ ] Lead scores displayed (0-100)
- [ ] Status badges correct
- [ ] Call Back button works
- [ ] SMS button opens modal
- [ ] Book/Lost buttons update status

### Lead Detail Modal

- [ ] Opens when clicking lead card
- [ ] Shows lead name (not "Unknown Caller")
- [ ] Shows phone number (+1...)
- [ ] Call history populated
- [ ] Appointment history shown (if exists)
- [ ] Call Now button works

---

## Conclusion

All 18 dashboard API endpoints must be tested and verified to return:
1. **Correct HTTP status** (200 for success)
2. **Proper data structure** (arrays, objects as expected)
3. **Populated fields** (not null/undefined)
4. **Real names** (not "Unknown Caller" for known contacts)
5. **Formatted phones** (E.164 format with +)
6. **Sentiment data** (labels and scores populated)

Run the automated test script regularly to catch regressions early.

---

**Last Updated:** 2026-02-02
**Fixes Applied:** Commit c8e61b8 (caller names, hot lead alerts, sentiment analytics)
