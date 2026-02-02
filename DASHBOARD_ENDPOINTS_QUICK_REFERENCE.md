# Dashboard Endpoints - Quick Reference Guide

**Purpose:** Fast lookup of all dashboard endpoints and what they return

---

## 18 Total Endpoints

### Main Dashboard (3 endpoints)

| # | Endpoint | Returns |
|---|----------|---------|
| 1 | `GET /api/analytics/recent-activity` | Recent events (calls, hot leads, bookings) |
| 2 | `GET /api/analytics/dashboard-pulse` | KPIs: total calls, avg duration, inbound % |
| 3 | `GET /api/analytics/leads` | Hot/warm leads for action cards |

### Call Logs (9 endpoints)

| # | Endpoint | Returns |
|---|----------|---------|
| 4 | `GET /api/calls-dashboard` | Paginated call list with filters |
| 5 | `GET /api/calls-dashboard/analytics/summary` | Call stats (total, completed, avg duration, **avg sentiment**) |
| 6 | `GET /api/calls-dashboard/:callId` | Full call detail + transcript |
| 7 | `GET /api/calls-dashboard/:callId/recording-url` | Signed URL for audio playback |
| 8 | `POST /api/calls-dashboard/:callId/followup` | Send follow-up SMS |
| 9 | `POST /api/calls-dashboard/:callId/share` | Share recording via email |
| 10 | `POST /api/calls-dashboard/:callId/transcript/export` | Export transcript (PDF/TXT) |
| 11 | `DELETE /api/calls-dashboard/:callId` | Delete call record |
| 12 | `POST /api/contacts` | Add caller to CRM (from call) |

### Leads (6 endpoints)

| # | Endpoint | Returns |
|---|----------|---------|
| 13 | `GET /api/contacts` | Paginated lead list with filters |
| 14 | `GET /api/contacts/stats` | Lead counts (total, hot, warm, cold) |
| 15 | `GET /api/contacts/:leadId` | Full lead detail + call/appointment history |
| 16 | `POST /api/contacts/:leadId/call-back` | Initiate outbound call |
| 17 | `POST /api/contacts/:leadId/sms` | Send SMS to lead |
| 18 | `PATCH /api/contacts/:leadId` | Update lead status (book/lost) |

---

## Critical Data Fields (Must Be Verified)

### Caller/Contact Names
- **MUST NOT** be "Unknown Caller" for known contacts
- **Locations:** All calls, all leads, all activity events

### Phone Numbers
- **MUST** be E.164 format (+1234567890)
- **Locations:** All calls, all leads

### Sentiment Data
- **MUST** be populated for completed calls
- **Fields:** `sentiment_label`, `sentiment_score`, `sentiment_summary`
- **Avg Sentiment MUST NOT** be 0% (unless no calls)

---

## Test Command

```bash
cd backend
TEST_AUTH_TOKEN="your-jwt" ts-node src/scripts/test-all-dashboard-endpoints.ts
```

---

## Recent Fixes Applied (Commit c8e61b8)

1. ✅ **Caller Names** - Now set for BOTH inbound and outbound calls
2. ✅ **Hot Lead Alerts** - Created for ALL calls (not just new contacts)
3. ✅ **Sentiment Analytics** - Fetches correct column (`sentiment_score`)

---

## Manual Verification Checklist

### Main Dashboard
- [ ] Recent Activity populated (not empty)
- [ ] Caller names NOT "Unknown Caller"
- [ ] KPI cards show numbers

### Call Logs
- [ ] Table shows calls
- [ ] Caller names NOT "Unknown Caller"
- [ ] Sentiment column shows % (NOT "0%")
- [ ] Play button works
- [ ] SMS button sends message

### Leads Page
- [ ] Lead cards show data
- [ ] Names NOT "Unknown Caller"
- [ ] Call Back button works
- [ ] SMS button sends message
- [ ] Book/Lost buttons update status

---

**Full Documentation:** See `DASHBOARD_API_COMPREHENSIVE_TEST_REPORT.md`
**Test Script:** `backend/src/scripts/test-all-dashboard-endpoints.ts`
