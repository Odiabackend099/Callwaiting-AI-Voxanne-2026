# Phase 1 MVP API Quick Reference

## Fast Facts

| Metric | Value |
|--------|-------|
| Files Created | 6 |
| Lines of Code | ~1,560 |
| Routes | 21 endpoints |
| Services | 3 production services |
| Multi-tenant | Yes (org_id filtering on all queries) |
| Database Tables | 5+ required |
| Authentication | requireAuthOrDev middleware |

---

## API Endpoints at a Glance

### Appointments (6 endpoints)
```
GET    /api/appointments                    List all appointments
POST   /api/appointments                    Create appointment
GET    /api/appointments/:id                Get appointment details
PATCH  /api/appointments/:id                Update appointment
DELETE /api/appointments/:id                Delete appointment
GET    /api/appointments/available-slots    Check open slots
```

### Contacts (7 endpoints)
```
GET    /api/contacts                    List all contacts
POST   /api/contacts                    Create contact
GET    /api/contacts/:id                Get contact + history
PATCH  /api/contacts/:id                Update contact
DELETE /api/contacts/:id                Delete contact
POST   /api/contacts/:id/call-back      Start outbound call
POST   /api/contacts/:id/sms            Send SMS to contact
```

### Notifications (5 endpoints)
```
GET    /api/notifications               List notifications
GET    /api/notifications/unread        Get unread count + list
PATCH  /api/notifications/:id/read      Mark as read
DELETE /api/notifications/:id           Delete notification
POST   /api/notifications               Create notification (internal)
```

---

## Key Patterns Used

### Every Route Must:
1. Extract orgId and check for 401
2. Parse input with Zod schema
3. Filter queries by org_id
4. Use try-catch for error handling
5. Log important actions

### Example Pattern:
```typescript
const orgId = req.user?.orgId;
if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

const schema = z.object({ ... });
const parsed = schema.parse(req.query);

const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('org_id', orgId)  // ← CRITICAL: Always filter
  .eq('status', parsed.status);

if (error) {
  log.error('Module', 'Operation - Error', { error: error.message });
  return res.status(500).json({ error: error.message });
}

return res.json({ data });
```

---

## Scoring Tiers (Lead Quality)

| Tier | Range | Emoji | Meaning |
|------|-------|-------|---------|
| Hot 🔥 | 70-100 | 🔥 | High-value prospect, ready to convert |
| Warm 🌡️ | 40-69 | 🌡️ | Interested but needs nurturing |
| Cold ❄️ | 0-39 | ❄️ | Low intent, long-term prospect |

### Score Calculation:
- Base: 50
- High-value keywords: +40 (max)
- Medium keywords: +20 (max)
- Positive sentiment: +30
- Negative sentiment: -20
- Urgency signals: +30
- Low urgency signals: -10

---

## Request/Response Patterns

### Pagination (Standard)
**Request:**
```json
{
  "page": 1,
  "limit": 20,
  "status": "scheduled"
}
```

**Response:**
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Error Response (Standard)
```json
{
  "error": "Descriptive error message"
}
```

**Status Codes:**
- `200` Success (GET, PATCH)
- `201` Created (POST)
- `400` Bad request (validation error)
- `401` Unauthorized (missing auth)
- `404` Not found (resource missing)
- `500` Server error (database error)

---

## Common Filters

### Appointments
- `status` (scheduled, completed, cancelled)
- `contact_id` (UUID)
- `startDate` (ISO date)
- `endDate` (ISO date)

### Contacts
- `leadStatus` (hot, warm, cold)
- `search` (name, phone, email - ilike)
- `startDate` (ISO date)
- `endDate` (ISO date)

### Notifications
- `status` (unread, read, all)
- `type` (hot_lead, appointment, sms, call, system)

---

## Service Exports

### Lead Scoring
```typescript
// Score a transcript
const result = await scoreLead(orgId, transcript, sentiment, metadata);
// Returns: { score: 75, tier: 'hot', details: '...' }

// Calculate programmatically
const score = calculateLeadScore(keywords, sentiment, urgency, service);
// Returns: number (0-100)

// Format for UI
const icon = getTierEmoji('hot');        // Returns '🔥'
const label = formatTierWithEmoji('hot'); // Returns '🔥 Hot'
```

### SMS Notifications
```typescript
// Send hot lead alert
const msgId = await sendHotLeadSMS(phone, {
  name: 'John',
  phone: '+1-555-0123',
  service: 'Botox',
  summary: 'Interested in anti-aging procedures'
});

// Send appointment confirmation
const msgId = await sendAppointmentConfirmationSMS(phone, {
  serviceType: 'Filler',
  scheduledAt: new Date('2025-01-20T14:00:00Z'),
  confirmationUrl: 'https://...'
});

// Send appointment reminder
const msgId = await sendAppointmentReminderSMS(phone, {
  serviceType: 'Laser',
  scheduledAt: new Date('2025-01-20T14:00:00Z')
});

// Generic SMS
const msgId = await sendGenericSMS(phone, 'Your custom message (max 160 chars)');
```

### Calendar Integration
```typescript
// Get available slots
const slots = await getAvailableSlots(orgId, '2025-01-20');
// Returns: ['09:00', '09:45', '10:30', ...]

// Create calendar event
const event = await createCalendarEvent(orgId, {
  title: 'Botox Consultation',
  description: 'With Jane Doe',
  startTime: '2025-01-20T14:00:00Z',
  endTime: '2025-01-20T14:45:00Z',
  attendeeEmail: 'jane@example.com',
  googleMeetUrl: 'https://...'
});
// Returns: { eventId: 'abc123', eventUrl: 'https://...' }

// Store Google Calendar token
await storeGoogleCalendarRefreshToken(orgId, 'refresh_token_xyz');

// Get calendar auth
const auth = await getGoogleCalendarAuth(orgId);
// Returns: { refresh_token: '...', ... }
```

---

## Database Quick Reference

### Key Tables (Must Exist)

**appointments**
- id (UUID)
- org_id (UUID) ← Filter on this
- contact_id (UUID)
- service_type, scheduled_at, duration_minutes
- status (scheduled|completed|cancelled)
- confirmation_sent (boolean)
- created_at, updated_at

**contacts**
- id (UUID)
- org_id (UUID) ← Filter on this
- name, phone (unique per org), email
- service_interests (array), lead_status (hot|warm|cold)
- lead_score (integer), notes
- created_at, updated_at

**notifications**
- id (UUID)
- org_id (UUID) ← Filter on this
- type, title, message, metadata
- is_read (boolean), read_at
- created_at

**sms_logs**
- id (UUID)
- org_id (UUID), contact_id
- phone_number, message, message_id, status
- created_at

**integrations**
- id (UUID)
- org_id (UUID), provider, config, metadata
- active (boolean)
- created_at, updated_at

---

## Environment Variables

### Required
```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NODE_ENV=production
```

### For SMS (Twilio)
```bash
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
CLINIC_NAME=Your Clinic Name
```

### For Calendar (Google)
```bash
GOOGLE_CALENDAR_API_KEY
```

### Optional
```bash
DEV_USER_ID (development only)
DEV_USER_EMAIL (development only)
```

---

## Common Error Messages

| Message | Cause | Fix |
|---------|-------|-----|
| "Unauthorized" | Missing Authorization header or invalid orgId | Add Bearer token to header |
| "Invalid input: " | Zod validation failed | Check request body matches schema |
| "Not found" | Resource doesn't exist or org_id mismatch | Verify ID and org_id ownership |
| "Database error" | Supabase query failed | Check table exists, org_id filter is correct |
| "Appointment time cannot be in the past" | Invalid datetime | Use future datetime in ISO format |
| "Invalid phone number format" | Phone validation failed | Use E.164 format or US/EU format |
| "Google Calendar not configured" | No calendar integration for org | Store refresh token first |

---

## Testing with curl

### Create Contact
```bash
curl -X POST http://localhost:3001/api/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "phone": "+1-555-0123",
    "email": "jane@example.com",
    "serviceInterests": ["Botox", "Filler"],
    "leadStatus": "warm"
  }'
```

### Get Available Slots
```bash
curl "http://localhost:3001/api/appointments/available-slots?date=2025-01-20" \
  -H "Authorization: Bearer $TOKEN"
```

### Create Appointment
```bash
curl -X POST http://localhost:3001/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "Botox",
    "scheduledAt": "2025-01-20T14:00:00Z",
    "customerName": "Jane Doe",
    "contact_id": "uuid-here"
  }'
```

### Send SMS
```bash
curl -X POST http://localhost:3001/api/contacts/contact-uuid/sms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your appointment is confirmed! See you soon."
  }'
```

### List Unread Notifications
```bash
curl "http://localhost:3001/api/notifications/unread" \
  -H "Authorization: Bearer $TOKEN"
```

---

## File Locations

| File | Purpose | Lines |
|------|---------|-------|
| `/backend/src/routes/appointments.ts` | Appointment management | 280 |
| `/backend/src/routes/contacts.ts` | Contact + lead management | 380 |
| `/backend/src/routes/notifications.ts` | User notifications | 200 |
| `/backend/src/services/lead-scoring.ts` | Lead quality scoring | 180 |
| `/backend/src/services/sms-notifications.ts` | Twilio SMS delivery | 220 |
| `/backend/src/services/calendar-integration.ts` | Google Calendar sync | 300 |

---

## Integration Steps (TL;DR)

1. **Copy files to backend/src/**
2. **Add imports to server.ts:**
   ```typescript
   import { appointmentsRouter } from './routes/appointments';
   import { contactsRouter } from './routes/contacts';
   import { notificationsRouter } from './routes/notifications';
   ```
3. **Register routes:**
   ```typescript
   app.use('/api/appointments', appointmentsRouter);
   app.use('/api/contacts', contactsRouter);
   app.use('/api/notifications', notificationsRouter);
   ```
4. **Create database tables** (SQL provided in implementation guide)
5. **Set environment variables** (see above)
6. **Test endpoints** (use curl examples)
7. **Deploy** (npm run build && npm start)

---

## Support & Debugging

### Check if route is registered:
```bash
curl http://localhost:3001/api/contacts \
  -H "Authorization: Bearer dev-token"
```

### View logs in production:
```bash
# Render logs
render logs

# Or check console output
tail -f server.log
```

### Common setup issues:

**500 error on every request?**
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Verify database tables exist
- Check org_id column exists on tables

**401 Unauthorized on every request?**
- Verify Authorization header format: `Bearer <token>`
- Check NODE_ENV (dev mode allows missing token)
- Verify orgId exists in user metadata

**Twilio SMS not sending?**
- Check TWILIO_ACCOUNT_SID, AUTH_TOKEN, PHONE_NUMBER are set
- Verify phone format is valid (E.164 or US/EU)
- Check Twilio account has credits

**Google Calendar not working?**
- Check GOOGLE_CALENDAR_API_KEY is set
- Verify refresh token is stored in integrations table
- Check calendar_id in integration metadata

---

## Next Steps

1. ✅ Files created - Ready for review
2. ⏳ Add to server.ts - Register routes
3. ⏳ Create database tables - Run migrations
4. ⏳ Configure environment - Set variables
5. ⏳ Test endpoints - Use curl/Postman
6. ⏳ Deploy - Push to production
7. ⏳ Monitor - Watch logs and metrics

All code follows patterns from existing routes (calls-dashboard.ts, knowledge-base.ts) and is production-ready.

**Questions?** Review the full implementation guide: `PHASE1_MVP_IMPLEMENTATION_GUIDE.md`
