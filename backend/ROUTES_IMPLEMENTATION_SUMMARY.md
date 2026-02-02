# Backend Routes Implementation Summary

## Overview
Three new backend routes have been created for Calendly webhooks, contact form submission, and AI chat widget functionality.

## Files Created

### 1. `/backend/src/routes/calendly-webhook.ts`
**Endpoint:** `POST /api/webhooks/calendly`

**Features:**
- Webhook signature verification (optional, requires `CALENDLY_WEBHOOK_SECRET`)
- Handles `invitee.created` and `invitee.canceled` events
- Sends appointment confirmation email to invitee
- Sends notification to support@voxanne.ai
- Stores booking in `calendly_bookings` table (optional)
- Sends Slack alerts for new bookings and cancellations
- Returns 200 OK immediately to prevent retries

**Email Templates:**
- **Confirmation Email:** Beautiful gradient design with appointment details, reschedule/cancel buttons
- **Support Notification:** Professional notification with all invitee details

**Database Schema (optional):**
```sql
CREATE TABLE calendly_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_phone TEXT,
  invitee_uri TEXT,
  appointment_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  cancel_url TEXT,
  reschedule_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Environment Variables Required:**
- `CALENDLY_WEBHOOK_SECRET` (optional, for signature verification)
- `RESEND_API_KEY` (for sending emails)
- `FROM_EMAIL` (sender email address)
- `SLACK_BOT_TOKEN` (for Slack alerts)
- `SLACK_ALERTS_CHANNEL` (Slack channel for alerts)

---

### 2. `/backend/src/routes/contact-form.ts`
**Endpoint:** `POST /api/contact-form`

**Features:**
- Zod schema validation (name, email, phone, subject, message, company)
- Sends email to support@voxanne.ai with reply-to as user's email
- Sends confirmation email to user
- Stores submission in `contact_submissions` table (optional)
- Urgent subject detection (keywords: urgent, emergency, critical, production, down, outage, broken)
- Priority Slack alerts for urgent messages
- Returns success/error JSON

**Email Templates:**
- **Support Email:** Professional design with all contact details, quick action buttons, urgent badge for urgent messages
- **Confirmation Email:** Friendly acknowledgment with helpful links and resources

**Database Schema (optional):**
```sql
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  company TEXT,
  is_urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Request Body Example:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+44 7123 456789",
  "subject": "Interested in Professional Plan",
  "message": "I run a dental clinic and would like to know more about your AI phone system.",
  "company": "Smith Dental"
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Thank you for contacting us! We will get back to you within 24 hours."
}
```

**Environment Variables Required:**
- `RESEND_API_KEY` (for sending emails)
- `FROM_EMAIL` (sender email address)
- `SLACK_BOT_TOKEN` (for Slack alerts)
- `SLACK_ALERTS_CHANNEL` (Slack channel for alerts)

---

### 3. `/backend/src/routes/chat-widget.ts`
**Endpoints:**
- `POST /api/chat-widget` - Handle chat conversations
- `GET /api/chat-widget/health` - Health check

**Features:**
- Groq AI integration with `llama-3.3-70b-versatile` model
- Comprehensive system prompt with UK pricing and contact info
- Lead qualification algorithm (scores: hot ≥60, warm ≥30, cold <30)
- Automatic Slack alerts for hot leads (score ≥70)
- Conversation storage and tracking (optional)
- Fallback response if Groq API fails
- Error handling with graceful degradation

**System Prompt Highlights:**
- **UK Pricing:**
  - Starter: £350/month + £1,000 setup, 400 minutes/month
  - Professional: £550/month + £3,000 setup, 1,200 minutes/month
  - Enterprise: £800/month + £7,000 setup, 2,000 minutes/month
- **Contact Info:**
  - Phone: +44 7424 038250
  - Calendly: https://calendly.com/austyneguale/30min
  - Email: support@voxanne.ai
- **Conversation Style:** Concise (2-4 sentences), UK English, professional

**Lead Qualification Algorithm:**
- Healthcare/Legal/Home Services keywords: +20-30 points
- High call volume (50+): +25 points
- Pain points (missed calls, booking): +15-20 points
- Intent signals (demo, pricing): +25 points
- **Hot Lead (≥60 points):** Immediate Slack alert
- **Warm Lead (30-59 points):** Tracked in database
- **Cold Lead (<30 points):** Standard tracking

**Database Schema (optional):**
```sql
CREATE TABLE chat_widget_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  lead_score INTEGER NOT NULL,
  lead_status TEXT NOT NULL CHECK (lead_status IN ('hot', 'warm', 'cold')),
  tags TEXT[] DEFAULT '{}',
  conversation_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Request Body Example:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I run a dental clinic receiving 60+ calls per day. Can you help?"
    }
  ],
  "sessionId": "chat_1234567890"
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Absolutely! With 60+ calls per day, you're an ideal fit for our Professional or Enterprise plan. Our AI agents can handle appointment bookings, answer patient questions, and send SMS reminders automatically. Would you like to book a quick demo to see it in action?",
  "sessionId": "chat_1234567890"
}
```

**Environment Variables Required:**
- `GROQ_API_KEY` (for AI chat completion)
- `SLACK_BOT_TOKEN` (for hot lead alerts)
- `SLACK_ALERTS_CHANNEL` (Slack channel for alerts)

---

## Server Configuration

### Routes Mounted in `/backend/src/server.ts`

```typescript
import calendlyWebhookRouter from './routes/calendly-webhook';
import contactFormRouter from './routes/contact-form';
import chatWidgetRouter from './routes/chat-widget';

// ...

app.use('/api/webhooks', calendlyWebhookRouter); // POST /api/webhooks/calendly
app.use('/api/contact-form', contactFormRouter); // POST /api/contact-form
app.use('/api/chat-widget', chatWidgetRouter); // POST /api/chat-widget, GET /api/chat-widget/health
```

---

## Dependencies

All dependencies are already installed in `backend/package.json`:
- ✅ `groq-sdk` (v0.9.1)
- ✅ `resend` (v6.6.0)
- ✅ `zod` (v4.1.13)
- ✅ `@slack/web-api` (v7.13.0)
- ✅ `@supabase/supabase-js` (v2.90.1)

---

## Testing

### 1. Test Calendly Webhook
```bash
curl -X POST http://localhost:3001/api/webhooks/calendly \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invitee.created",
    "payload": {
      "event_type": { "name": "30 Minute Meeting" },
      "invitee": {
        "name": "John Smith",
        "email": "john@example.com",
        "text_reminder_number": "+447123456789",
        "uri": "https://calendly.com/invitees/123"
      },
      "event": {
        "start_time": "2026-02-10T10:00:00Z",
        "end_time": "2026-02-10T10:30:00Z"
      },
      "cancel_url": "https://calendly.com/cancel/123",
      "reschedule_url": "https://calendly.com/reschedule/123"
    }
  }'
```

**Expected:**
- ✅ Confirmation email sent to john@example.com
- ✅ Support notification sent to support@voxanne.ai
- ✅ Slack alert posted to #voxanne-alerts
- ✅ Response: `{"success": true}`

---

### 2. Test Contact Form
```bash
curl -X POST http://localhost:3001/api/contact-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+447987654321",
    "subject": "Urgent: Production issue",
    "message": "Our phone system is down and we need immediate assistance.",
    "company": "Example Ltd"
  }'
```

**Expected:**
- ✅ Support email sent to support@voxanne.ai (with reply-to: jane@example.com)
- ✅ Confirmation email sent to jane@example.com
- ✅ Urgent Slack alert posted (subject contains "urgent")
- ✅ Response: `{"success": true, "message": "Thank you for contacting us..."}`

---

### 3. Test Chat Widget
```bash
curl -X POST http://localhost:3001/api/chat-widget \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "I run a dental clinic with 70 calls per day. Can you help with missed calls?"
      }
    ],
    "sessionId": "test_session_123"
  }'
```

**Expected:**
- ✅ AI response generated by Groq
- ✅ Lead scored as HOT (healthcare + high volume + pain point = 75+ points)
- ✅ Slack alert posted for hot lead
- ✅ Response: `{"success": true, "message": "...", "sessionId": "test_session_123"}`

---

### 4. Test Chat Widget Health
```bash
curl http://localhost:3001/api/chat-widget/health
```

**Expected:**
- ✅ Response: `{"success": true, "groq": "connected", "timestamp": "..."}`

---

## Environment Variables Setup

Add the following to `/backend/.env`:

```bash
# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@voxanne.ai

# Groq AI
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# Slack Alerts
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxx
SLACK_ALERTS_CHANNEL=#voxanne-alerts

# Calendly Webhook (optional, for signature verification)
CALENDLY_WEBHOOK_SECRET=your_calendly_webhook_secret
```

---

## Optional Database Tables

If you want to store data in the database, create these tables:

```sql
-- Calendly bookings
CREATE TABLE calendly_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_phone TEXT,
  invitee_uri TEXT,
  appointment_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  cancel_url TEXT,
  reschedule_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact form submissions
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  company TEXT,
  is_urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat widget leads
CREATE TABLE chat_widget_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  lead_score INTEGER NOT NULL,
  lead_status TEXT NOT NULL CHECK (lead_status IN ('hot', 'warm', 'cold')),
  tags TEXT[] DEFAULT '{}',
  conversation_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_calendly_bookings_email ON calendly_bookings(invitee_email);
CREATE INDEX idx_calendly_bookings_created ON calendly_bookings(created_at DESC);
CREATE INDEX idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX idx_contact_submissions_urgent ON contact_submissions(is_urgent) WHERE is_urgent = true;
CREATE INDEX idx_chat_widget_leads_status ON chat_widget_leads(lead_status);
CREATE INDEX idx_chat_widget_leads_created ON chat_widget_leads(created_at DESC);
```

**Note:** The routes will work without these tables. Database storage is optional and will fail gracefully with warning logs if tables don't exist.

---

## Error Handling

All routes include comprehensive error handling:

1. **Validation Errors:** Returns 400 with detailed error messages
2. **Service Errors:** Returns 500 with user-friendly error message
3. **Slack Alerts:** Sent for critical errors
4. **Logging:** All errors logged with context
5. **Graceful Degradation:** Chat widget returns fallback message if Groq API fails
6. **Webhook Retries:** Calendly webhook always returns 200 to prevent retries

---

## Security Considerations

1. **Webhook Signature Verification:** Calendly webhook verifies signature if secret is configured
2. **Input Validation:** All endpoints use Zod schemas for strict validation
3. **Rate Limiting:** Protected by existing org-rate-limiter middleware
4. **Email Security:** Reply-to header prevents email spoofing
5. **Database Safety:** Optional storage prevents application failures if tables don't exist

---

## Next Steps

1. **Set Environment Variables:** Add required API keys to `.env`
2. **Create Database Tables (Optional):** Run SQL migrations if you want data storage
3. **Configure Calendly Webhook:** Add webhook URL in Calendly settings: `https://yourdomain.com/api/webhooks/calendly`
4. **Test Endpoints:** Use curl commands above to verify functionality
5. **Monitor Slack Alerts:** Check Slack channel for notifications
6. **Deploy to Production:** Push changes and verify all integrations work

---

## API Documentation

### Calendly Webhook
- **Method:** POST
- **Path:** `/api/webhooks/calendly`
- **Auth:** Signature verification (optional)
- **Body:** Calendly webhook payload
- **Response:** `{"success": true}`

### Contact Form
- **Method:** POST
- **Path:** `/api/contact-form`
- **Auth:** None (public endpoint)
- **Body:** `{name, email, phone?, subject, message, company?}`
- **Response:** `{"success": true, "message": "..."}`

### Chat Widget
- **Method:** POST
- **Path:** `/api/chat-widget`
- **Auth:** None (public endpoint)
- **Body:** `{messages: [{role, content}], sessionId?}`
- **Response:** `{"success": true, "message": "...", "sessionId": "..."}`

### Chat Widget Health
- **Method:** GET
- **Path:** `/api/chat-widget/health`
- **Auth:** None
- **Response:** `{"success": true, "groq": "connected", "timestamp": "..."}`

---

## Maintenance

- **Email Templates:** Located inline in route files for easy customization
- **System Prompt:** Located in `/backend/src/routes/chat-widget.ts` (lines 25-105)
- **Lead Scoring:** Algorithm in `/backend/src/routes/chat-widget.ts` `qualifyLead()` function
- **Slack Alerts:** Configured via `sendSlackAlert()` from `/backend/src/services/slack-alerts.ts`

---

## Success Criteria

✅ All three routes created and mounted
✅ TypeScript type safety enforced
✅ Comprehensive error handling
✅ Email templates designed
✅ Slack alerts configured
✅ Lead qualification implemented
✅ Database storage optional
✅ Health check endpoints
✅ Documentation complete

**Status:** Ready for deployment 🚀
