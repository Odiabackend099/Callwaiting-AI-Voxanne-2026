# 🚀 Quick Start - Google Calendar Integration for Developers

**TL;DR:** 5-minute setup guide to get calendar booking working

---

## ⚡ The Fast Path

### 1️⃣ Create Google Cloud Credentials (5 min)
```bash
# Go to Google Cloud Console and:
1. Create project "Voxanne AI"
2. Enable "Google Calendar API"
3. Create OAuth 2.0 Client ID (Web app)
4. Add redirect URI: http://localhost:3000/api/calendar/auth/callback
5. Copy Client ID and Secret
```

### 2️⃣ Add to backend/.env
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret-key
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/auth/callback
ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
FRONTEND_URL=http://localhost:3000
```

### 3️⃣ Install Package
```bash
cd backend && npm install googleapis
```

### 4️⃣ Restart Backend
```bash
npm run dev
```

### 5️⃣ Test in Dashboard
```
http://localhost:3000/dashboard/integrations
→ Click "Connect Google Calendar"
→ Sign in
→ Should show: "Connected: your-email@gmail.com"
```

✅ **Done!** Calendar is connected.

---

## 🔗 Key Endpoints

```
GET  /api/calendar/auth/url           Get OAuth URL
GET  /api/calendar/auth/callback      OAuth redirect
GET  /api/calendar/status/:orgId      Check status
POST /api/calendar/disconnect/:orgId  Remove connection

POST /api/vapi/tools                  Vapi function calls
  ├─ check_availability               Check if time is free
  ├─ book_appointment                 Book appointment
  └─ get_available_slots              List available times
```

---

## 📁 Files to Know About

| File | Purpose |
|------|---------|
| `backend/src/routes/calendar-oauth.ts` | OAuth flow |
| `backend/src/routes/vapi-tools.ts` | Vapi integration |
| `backend/src/utils/google-calendar.ts` | Calendar API calls |
| `backend/src/utils/encryption.ts` | Token encryption |
| `src/components/integrations/GoogleCalendarConnect.tsx` | UI component |

---

## 🧪 Quick Test

### Test OAuth Flow
```bash
curl http://localhost:3001/api/calendar/auth/url?org_id=test-org-uuid
# Returns: { "url": "https://accounts.google.com/..." }
```

### Test Vapi Tools
```bash
curl -X POST http://localhost:3001/api/vapi/tools \
  -H "Content-Type: application/json" \
  -d '{
    "function": "check_availability",
    "org_id": "test-org-uuid",
    "parameters": {
      "start": "2026-01-20T14:00:00Z",
      "end": "2026-01-20T14:30:00Z"
    }
  }'
```

---

## 🔒 Token Refresh (Automatic)

```
Before every Google Calendar API call:
  if (token_expiry < now + 5 minutes) {
    fetch new access_token using refresh_token
    update database
  }
```

→ No user action needed. Happens automatically.

---

## 📊 Vapi Integration

1. Go to Vapi Dashboard → Tools
2. Create 3 new tools with schemas from `VAPI_TOOLS_SCHEMA.json`
3. Set server URL: `https://yourdomain.com/api/vapi/tools`
4. Copy tool IDs
5. Add to your Vapi assistant

---

## 🐛 Debugging

### Check if Connected
```sql
SELECT google_email, token_expiry FROM calendar_connections WHERE org_id = 'your-org-id';
```

### Check Bookings
```sql
SELECT * FROM appointment_bookings WHERE org_id = 'your-org-id' ORDER BY created_at DESC;
```

### View Logs
```bash
tail -f backend/logs/calendar-integration.log
```

---

## ✨ The Flow (AI Books Appointment)

```
Patient: "Book me for Tuesday at 2 PM"
  ↓
Vapi AI → calls check_availability
  ↓
Backend → checks Google Calendar
  ↓
Response: "Available"
  ↓
Vapi: "I have Tuesday at 2 PM. What's your email?"
  ↓
Patient: "john@email.com"
  ↓
Vapi AI → calls book_appointment
  ↓
Backend → creates Google Calendar event
  ↓
Patient gets calendar invite
  ↓
Vapi: "Perfect! You're all set!"
```

✅ Done!

---

## 🚨 Common Issues

| Problem | Fix |
|---------|-----|
| "Invalid redirect URI" | Check .env matches Google Console exactly |
| "No refresh token" | Ensure `prompt=consent` in OAuth URL |
| "Tokens expired" | System auto-refreshes; check logs |
| "Booking fails" | Verify Google Calendar API is enabled |

---

## 📈 What's Next?

1. **Google Cloud Setup** (5 min) → `GOOGLE_CALENDAR_OAUTH_SETUP.md`
2. **Vapi Registration** (10 min) → Use schemas in `VAPI_TOOLS_SCHEMA.json`
3. **Full Implementation Guide** → `GOOGLE_CALENDAR_IMPLEMENTATION_CHECKLIST.md`

---

**Questions?** Check the full documentation files or grep the code:
```bash
grep -r "check_availability" backend/src/
```

**Ready in 5 minutes!** 🎉
