# Voxanne Google Calendar Integration - Implementation Checklist

**Status:** 🚀 In Progress  
**Last Updated:** January 14, 2026

---

## ✅ Completed

- [x] Database migration: `calendar_connections` and `appointment_bookings` tables
- [x] Backend OAuth routes: `/api/calendar/auth/url`, `/api/calendar/auth/callback`, `/api/calendar/status/:orgId`, `/api/calendar/disconnect/:orgId`
- [x] Encryption utilities for secure token storage
- [x] Google Calendar API integration with automatic token refresh
- [x] Vapi tool handler: `/api/vapi/tools` with `check_availability`, `book_appointment`, `get_available_slots`
- [x] Frontend React component: `GoogleCalendarConnect` with connection UI
- [x] Backend route registration in `server.ts`
- [x] Environment variables documentation
- [x] Vapi function schema definitions

---

## 🔧 Next Steps (Implementation)

### 1. **Configure Google Cloud Project** ⏳
- [ ] Create Google Cloud project "Voxanne AI"
- [ ] Enable Google Calendar API
- [ ] Create OAuth 2.0 Client ID and Secret
- [ ] Add authorized redirect URIs
- [ ] Generate encryption key

**File:** `GOOGLE_CALENDAR_OAUTH_SETUP.md`  
**Time:** ~10 minutes

---

### 2. **Add Environment Variables** ⏳
- [ ] Add `GOOGLE_CLIENT_ID` to backend `.env`
- [ ] Add `GOOGLE_CLIENT_SECRET` to backend `.env`
- [ ] Add `GOOGLE_REDIRECT_URI` to backend `.env`
- [ ] Add `ENCRYPTION_KEY` to backend `.env`
- [ ] Add `FRONTEND_URL` to backend `.env`

**File:** `backend/.env`  
**Note:** Never commit these to git; use secrets management in production

---

### 3. **Install Required Dependencies** ⏳
- [ ] `npm install googleapis` (backend)
- [ ] `npm install crypto` (already built-in to Node.js)
- [ ] Verify `google-auth-library` is installed

**Location:** `/backend/package.json`  
**Time:** ~2 minutes

```bash
cd backend && npm install googleapis
```

---

### 4. **Register Vapi Tools in Vapi Dashboard** ⏳
- [ ] Log in to Vapi dashboard
- [ ] Go to "Tools" section
- [ ] Create new tool: `check_availability`
- [ ] Create new tool: `book_appointment`
- [ ] Create new tool: `get_available_slots`
- [ ] Set server URL to: `https://api.voxanne.ai/api/vapi/tools`
- [ ] Copy tool IDs and save them

**File:** `VAPI_TOOLS_SCHEMA.json` (schema templates)  
**Time:** ~15 minutes

**Schema Reference:**
```json
{
  "check_availability": {
    "parameters": ["start", "end", "duration_minutes"]
  },
  "book_appointment": {
    "parameters": ["patient_name", "patient_email", "patient_phone", "start", "end", "procedure_type", "notes"]
  },
  "get_available_slots": {
    "parameters": ["date_start", "date_end", "slot_duration_minutes"]
  }
}
```

---

### 5. **Add Calendar Integration to Dashboard** ⏳
- [ ] Navigate to admin dashboard Settings → Integrations
- [ ] Add import for `GoogleCalendarConnect` component
- [ ] Add UI section for Calendar Integration
- [ ] Test the "Connect Google Calendar" button
- [ ] Verify OAuth flow works end-to-end

**File:** `src/app/dashboard/integrations/page.tsx`  
**Time:** ~10 minutes

**Code:**
```tsx
import { GoogleCalendarConnect } from '@/components/integrations/GoogleCalendarConnect';

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      {/* ... other integrations ... */}
      <GoogleCalendarConnect />
    </div>
  );
}
```

---

### 6. **Test OAuth Flow** ⏳
- [ ] Start backend: `npm run dev` (port 3001)
- [ ] Start frontend: `npm run dev` (port 3000)
- [ ] Log in to dashboard
- [ ] Navigate to Integrations
- [ ] Click "Connect Google Calendar"
- [ ] Sign in with test Google account
- [ ] Verify redirect back to dashboard
- [ ] Check `calendar_connections` table in Supabase

**Expected Result:** Green badge showing "Connected: clinic@gmail.com"  
**Time:** ~5 minutes

---

### 7. **Test Vapi Tool Calling** ⏳
- [ ] Verify `/api/vapi/tools` endpoint is accessible
- [ ] Test `check_availability` with sample request:

```bash
curl -X POST http://localhost:3001/api/vapi/tools \
  -H "Content-Type: application/json" \
  -d '{
    "function": "check_availability",
    "org_id": "your-org-id",
    "parameters": {
      "start": "2026-01-20T14:00:00Z",
      "end": "2026-01-20T14:30:00Z"
    }
  }'
```

- [ ] Test `book_appointment` with sample request
- [ ] Test `get_available_slots` with sample request
- [ ] Verify Google Calendar events are created

**Expected Result:** Calendar events created in Google Calendar  
**Time:** ~10 minutes

---

### 8. **Integrate with Vapi AI Agent** ⏳
- [ ] Add tool IDs to Vapi assistant configuration
- [ ] Update Vapi system prompt to include calendar context:

**System Prompt Update:**
```
You have access to the clinic's Google Calendar. Use these tools:
- check_availability: Before suggesting a time, check if it's available
- book_appointment: Once the patient confirms, book the appointment
- get_available_slots: If requested time is busy, suggest alternatives
```

- [ ] Test with live phone call
- [ ] Patient books appointment via voice
- [ ] Verify event appears in Google Calendar

**Expected Result:** Patient can book appointments via voice  
**Time:** ~20 minutes

---

### 9. **Add Error Handling & Fallbacks** ⏳
- [ ] If calendar is unavailable, AI says: "I'm having trouble accessing the schedule..."
- [ ] If booking fails, offer to have human call back
- [ ] Log all API errors to backend logs
- [ ] Add monitoring/alerting for calendar API failures

**Files to Update:**
- `backend/src/routes/vapi-tools.ts`
- `backend/src/utils/google-calendar.ts`

---

### 10. **Production Deployment** ⏳
- [ ] Set up Google Cloud project for production
- [ ] Add production redirect URI to Google Console
- [ ] Update environment variables on production server
- [ ] Update Vapi tool server URL to production domain
- [ ] Enable HTTPS for all OAuth redirects
- [ ] Set up monitoring for calendar API quota

**Production Checklist:**
```
GOOGLE_CLIENT_ID=prod-client-id
GOOGLE_CLIENT_SECRET=prod-secret (store in secrets manager)
GOOGLE_REDIRECT_URI=https://api.voxanne.ai/auth/google/callback
FRONTEND_URL=https://dashboard.voxanne.ai
ENCRYPTION_KEY=prod-encryption-key (store in secrets manager)
```

---

## 🧪 Testing Scenarios

### Scenario 1: New Clinic Connects Calendar
```
1. Clinic Owner logs in to dashboard
2. Navigates to Integrations
3. Clicks "Connect Google Calendar"
4. Google OAuth popup opens
5. Signs in and clicks "Allow"
6. Redirected back to dashboard
7. Button shows: "Connected: clinic@gmail.com"
✓ Calendar connection stored in Supabase
```

### Scenario 2: Patient Books via Voice
```
1. Patient calls clinic number
2. Vapi answers: "Hi, what can I help you with?"
3. Patient: "I'd like to book a BBL appointment on Tuesday at 2 PM"
4. Vapi calls check_availability("2026-01-21T14:00:00Z", "2026-01-21T14:30:00Z")
5. Backend checks Google Calendar
6. Response: "Available"
7. Vapi: "Great! Can I get your name and email?"
8. Patient: "John Smith, john@email.com"
9. Vapi calls book_appointment(...)
10. Backend creates Google Calendar event
11. Vapi: "Perfect! I've booked you for Tuesday at 2 PM. You'll get a calendar invite."
✓ Event appears in clinic's Google Calendar
✓ Patient receives calendar invite
```

### Scenario 3: Time Slot is Busy
```
1. Patient: "Can I book Tuesday at 2 PM?"
2. Vapi calls check_availability("2026-01-21T14:00:00Z", "2026-01-21T14:30:00Z")
3. Backend response: "Not available"
4. Vapi calls get_available_slots("2026-01-21T00:00:00Z", "2026-01-22T23:59:59Z")
5. Backend returns: ["2026-01-21T15:00:00Z", "2026-01-21T16:00:00Z"]
6. Vapi: "That slot is taken, but I have 3 PM and 4 PM available. Which works better?"
✓ Patient can select alternative times
```

---

## 📊 Database Verification

After implementation, verify data in Supabase:

```sql
-- Check calendar connections
SELECT org_id, google_email, token_expiry, created_at 
FROM calendar_connections 
ORDER BY created_at DESC;

-- Check appointment bookings
SELECT org_id, patient_name, patient_email, appointment_start, appointment_end 
FROM appointment_bookings 
ORDER BY created_at DESC;
```

---

## 🔒 Security Checklist

- [x] Tokens encrypted at rest (AES-256-GCM)
- [x] Refresh tokens never exposed to frontend
- [x] OAuth flow uses offline access + prompt=consent
- [ ] HTTPS enforced in production
- [ ] Rate limiting on `/api/vapi/tools` endpoint
- [ ] Audit logging for calendar operations
- [ ] Automatic token expiry handling
- [ ] Secure session management for OAuth state

---

## 📈 Monitoring & Analytics

### Metrics to Track
- Calendar connection success rate
- Average check_availability response time
- Book_appointment success rate
- Token refresh success/failure rate
- Google Calendar API quota usage

### Logs to Monitor
```
backend/logs/calendar-integration.log
- All OAuth flows
- Token refresh attempts
- API call failures
- Booking errors
```

---

## 🚀 Go-Live Checklist

Before launching to production:

- [ ] All Google Cloud settings configured
- [ ] Vapi tools registered and tested
- [ ] Backend environment variables set
- [ ] Frontend integration tests passed
- [ ] Error handling implemented
- [ ] Monitoring and alerting active
- [ ] Database backups configured
- [ ] Documentation updated
- [ ] Team trained on troubleshooting
- [ ] Go-live announcement prepared

---

## 📞 Support & Troubleshooting

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "Invalid redirect URI" | Verify .env matches Google Cloud Console exactly |
| "No refresh token" | Ensure `prompt=consent` is in OAuth URL |
| "Token expired" | System auto-refreshes; check logs for errors |
| "Calendar not found" | Verify org has `calendar_connections` entry |
| "Booking fails" | Check Google Calendar API is enabled; verify org's calendar ID |

**Getting Help:**
- Check logs: `backend/logs/`
- Monitor: Supabase dashboard
- Debug: Google Cloud Console → Quotas & Analytics

---

## 📝 Notes

- Tokens stored in Supabase are **encrypted at rest** using AES-256-GCM
- Refresh tokens are rotated automatically by Google
- Google Calendar API has quota limits; monitor usage
- Multi-clinic support: Each clinic (org_id) has separate tokens
- Timezone handling: All times stored in UTC, converted on display

---

**Questions?** Check GOOGLE_CALENDAR_OAUTH_SETUP.md or VAPI_TOOLS_SCHEMA.json
