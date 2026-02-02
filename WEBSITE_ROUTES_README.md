# Website Routes Implementation

## Overview
Three production-ready backend routes have been implemented for the Voxanne AI website:

1. **Calendly Webhook** - Automated appointment confirmation and notifications
2. **Contact Form** - Customer inquiries with intelligent routing
3. **Chat Widget** - AI-powered lead qualification and support

---

## 🚀 Quick Start

### 1. Install Dependencies
All required dependencies are already installed:
- ✅ `groq-sdk` (v0.9.1)
- ✅ `resend` (v6.6.0)
- ✅ `zod` (v4.1.13)
- ✅ `@slack/web-api` (v7.13.0)

### 2. Set Environment Variables
Add to `/backend/.env`:

```bash
# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@voxanne.ai

# Groq AI
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# Slack Alerts (already configured)
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxx
SLACK_ALERTS_CHANNEL=#voxanne-alerts

# Calendly Webhook (optional)
CALENDLY_WEBHOOK_SECRET=your_calendly_webhook_secret
```

### 3. Run Database Migration (Optional)
```bash
# Apply optional database tables
psql $DATABASE_URL -f backend/supabase/migrations/20260202_create_website_routes_tables.sql
```

### 4. Test Routes
```bash
# Start backend server
cd backend
npm run dev

# In another terminal, run tests
./scripts/test-website-routes.sh
```

---

## 📋 Routes Documentation

### 1. Calendly Webhook
**Endpoint:** `POST /api/webhooks/calendly`

**Purpose:** Receive and process Calendly booking events

**Features:**
- ✅ Webhook signature verification (optional)
- ✅ Email confirmation to invitee
- ✅ Email notification to support team
- ✅ Slack alerts for bookings/cancellations
- ✅ Database storage (optional)

**Setup Calendly Webhook:**
1. Go to Calendly Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/calendly`
3. Subscribe to events: `invitee.created`, `invitee.canceled`
4. Copy signing key to `CALENDLY_WEBHOOK_SECRET` env var

**Example Request:**
```json
{
  "event": "invitee.created",
  "payload": {
    "event_type": { "name": "30 Minute Demo" },
    "invitee": {
      "name": "John Smith",
      "email": "john@example.com",
      "text_reminder_number": "+447123456789",
      "uri": "https://calendly.com/invitees/123"
    },
    "event": {
      "start_time": "2026-02-15T14:00:00Z",
      "end_time": "2026-02-15T14:30:00Z"
    },
    "cancel_url": "https://calendly.com/cancel/123",
    "reschedule_url": "https://calendly.com/reschedule/123"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Email Templates:**
- **Invitee Confirmation:** Beautiful gradient design with appointment details, reschedule/cancel buttons
- **Support Notification:** Professional alert with all booking details

**Slack Alerts:**
- 📅 New booking notification with invitee details
- ❌ Cancellation notification

---

### 2. Contact Form
**Endpoint:** `POST /api/contact-form`

**Purpose:** Handle customer inquiries from website contact form

**Features:**
- ✅ Zod validation (name, email, phone, subject, message, company)
- ✅ Email to support@voxanne.ai (with reply-to)
- ✅ Confirmation email to user
- ✅ Urgent subject detection
- ✅ Slack alerts (urgent messages prioritized)
- ✅ Database storage (optional)

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+447987654321",
  "subject": "Interested in Professional Plan",
  "message": "I run a dental clinic and would like to know more about your AI phone system.",
  "company": "Example Dental Ltd"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Thank you for contacting us! We will get back to you within 24 hours."
}
```

**Response (Validation Error):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

**Urgent Detection:**
Messages containing these keywords trigger immediate Slack alerts:
- urgent
- emergency
- critical
- production
- down
- outage
- broken

**Email Templates:**
- **Support Email:** Professional layout with all contact details, quick action buttons, urgent badge
- **Confirmation Email:** Friendly acknowledgment with helpful resources

**Slack Alerts:**
- 🚨 URGENT: For critical issues (immediate priority)
- 📧 NEW: For normal inquiries

---

### 3. Chat Widget
**Endpoints:**
- `POST /api/chat-widget` - Handle chat conversations
- `GET /api/chat-widget/health` - Health check

**Purpose:** AI-powered chat widget for website visitors

**Features:**
- ✅ Groq AI integration (`llama-3.3-70b-versatile`)
- ✅ Comprehensive system prompt with UK pricing
- ✅ Automatic lead qualification (hot/warm/cold)
- ✅ Slack alerts for hot leads (score ≥70)
- ✅ Conversation tracking (optional)
- ✅ Fallback response if API fails

**System Prompt Includes:**
- UK pricing (£350-£800/month)
- Key features and benefits
- Contact information (+44 7424 038250)
- Calendly booking link
- Qualifying questions
- Lead scoring criteria

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I run a dental clinic with 70 calls per day. Can you help with missed calls?"
    }
  ],
  "sessionId": "chat_12345"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Absolutely! With 70+ calls per day, you're an ideal fit for our Professional or Enterprise plan. Our AI agents can handle appointment bookings, answer patient questions, and send SMS reminders automatically. Would you like to book a quick demo?",
  "sessionId": "chat_12345"
}
```

**Response (Fallback):**
```json
{
  "success": true,
  "message": "I'm temporarily unavailable. Please book a demo at https://calendly.com/austyneguale/30min or call us at +44 7424 038250. We'd love to chat!",
  "sessionId": "chat_12345",
  "fallback": true
}
```

**Lead Qualification Algorithm:**

| Factor | Score | Keywords |
|--------|-------|----------|
| Healthcare industry | +30 | healthcare, clinic, dental, doctor, medical |
| Legal industry | +25 | law, legal, solicitor, attorney |
| Home services | +20 | plumber, electrician, hvac, contractor |
| High call volume (50+) | +25 | 50+, hundreds, many calls, busy |
| Medium call volume (20-50) | +15 | 20, 30, 40, moderate |
| Missed calls pain point | +20 | missed calls, lost business, can't answer |
| Booking pain point | +15 | booking, appointment, scheduling |
| Customer service pain | +10 | customer service, support, frustrated |
| High intent | +25 | demo, show me, interested, pricing |
| Low intent | +5 | just looking, curious, researching |

**Lead Status:**
- **Hot (≥60 points):** Immediate Slack alert + high priority follow-up
- **Warm (30-59 points):** Standard follow-up
- **Cold (<30 points):** Low priority

**Slack Alerts:**
- 🔥 Hot Lead: Score ≥70, includes conversation summary and recommended action

**Health Check:**
```bash
curl http://localhost:3001/api/chat-widget/health
```

Response:
```json
{
  "success": true,
  "groq": "connected",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

---

## 🗄️ Database Tables (Optional)

### Schema Overview
- `calendly_bookings` - Calendly webhook events
- `contact_submissions` - Contact form submissions
- `chat_widget_leads` - Chat conversations with lead scores

### Analytics Views
- `hot_chat_leads` - Hot leads requiring immediate follow-up
- `urgent_contacts` - Urgent contact form submissions
- `upcoming_appointments` - Future Calendly bookings

### Analytics Functions
```sql
-- Contact form stats (last 30 days)
SELECT * FROM get_contact_form_stats(30);

-- Chat widget stats (last 7 days)
SELECT * FROM get_chat_widget_stats(7);

-- Calendly booking stats (last 30 days)
SELECT * FROM get_calendly_stats(30);
```

### Cleanup Functions (GDPR Compliance)
```sql
-- Delete data older than 90 days
SELECT cleanup_old_contact_submissions();
SELECT cleanup_old_chat_widget_leads();
```

---

## 🧪 Testing

### Automated Tests
```bash
# Run comprehensive test suite
./scripts/test-website-routes.sh
```

**Tests Include:**
1. ✅ Chat widget health check
2. ✅ Chat widget simple question
3. ✅ Chat widget hot lead detection
4. ✅ Contact form normal submission
5. ✅ Contact form urgent submission
6. ✅ Contact form validation error
7. ✅ Calendly invitee created
8. ✅ Calendly invitee canceled

### Manual Testing

**Test Chat Widget:**
```bash
curl -X POST http://localhost:3001/api/chat-widget \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are your pricing plans?"}
    ]
  }'
```

**Test Contact Form:**
```bash
curl -X POST http://localhost:3001/api/contact-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test",
    "message": "This is a test message"
  }'
```

**Test Calendly Webhook:**
```bash
curl -X POST http://localhost:3001/api/webhooks/calendly \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invitee.created",
    "payload": {
      "event_type": {"name": "30 Minute Demo"},
      "invitee": {
        "name": "Test User",
        "email": "test@example.com",
        "uri": "https://calendly.com/invitees/123"
      },
      "event": {
        "start_time": "2026-02-15T14:00:00Z",
        "end_time": "2026-02-15T14:30:00Z"
      }
    }
  }'
```

---

## 📊 Monitoring

### Slack Alerts
All routes send alerts to `#voxanne-alerts` channel:

| Alert Type | Icon | Trigger |
|------------|------|---------|
| New Calendly booking | 📅 | invitee.created event |
| Calendly cancellation | ❌ | invitee.canceled event |
| Hot chat lead | 🔥 | Lead score ≥70 |
| New contact submission | 📧 | Any submission |
| Urgent contact | 🚨 | Urgent keyword detected |
| Route error | 🔴 | Any server error |

### Logs
All activity logged using Pino logger:

```typescript
log.info('ChatWidget', 'Response generated', {
  sessionId,
  responseLength: assistantMessage.length,
  tokensUsed: completion.usage?.total_tokens,
});
```

### Health Checks
```bash
# Chat widget health
curl http://localhost:3001/api/chat-widget/health

# Server health (includes all dependencies)
curl http://localhost:3001/health
```

---

## 🔒 Security

### Input Validation
- ✅ Zod schemas enforce strict validation
- ✅ Email format validation
- ✅ Message length limits (max 5000 chars)
- ✅ SQL injection prevention (parameterized queries)

### Webhook Security
- ✅ Calendly signature verification (optional)
- ✅ Always returns 200 to prevent retries
- ✅ Malformed JSON handled gracefully

### Rate Limiting
- ✅ Protected by existing `org-rate-limiter` middleware
- ✅ 1000 requests/hour per org
- ✅ 100 requests/15 minutes per IP

### Email Security
- ✅ Reply-to header prevents spoofing
- ✅ HTML escaping in templates
- ✅ No sensitive data in emails

### Error Handling
- ✅ Never exposes internal errors to users
- ✅ User-friendly error messages
- ✅ Detailed logging for debugging
- ✅ Slack alerts for critical errors

---

## 🚀 Deployment

### Pre-Deployment Checklist
- [ ] Environment variables configured
- [ ] RESEND_API_KEY added
- [ ] GROQ_API_KEY added
- [ ] Database migration applied (optional)
- [ ] Test script passes
- [ ] Slack alerts working
- [ ] Email templates verified

### Deploy to Production
```bash
# 1. Verify environment variables
grep -E "RESEND_API_KEY|GROQ_API_KEY" backend/.env

# 2. Test locally
npm run dev
./scripts/test-website-routes.sh

# 3. Deploy
git add .
git commit -m "Add website routes (Calendly, Contact Form, Chat Widget)"
git push origin main

# 4. Configure Calendly webhook
# Go to Calendly Settings → Webhooks
# Add: https://yourdomain.com/api/webhooks/calendly
```

### Post-Deployment Verification
```bash
# Test production endpoints
BACKEND_URL=https://api.voxanne.ai ./scripts/test-website-routes.sh

# Check Slack for alerts
# Check support@voxanne.ai for emails
# Check database for records (if tables exist)
```

---

## 📝 Maintenance

### Update System Prompt
Edit `/backend/src/routes/chat-widget.ts` lines 25-105:
```typescript
const SYSTEM_PROMPT = `You are Voxanne, an intelligent AI assistant...`;
```

### Update Email Templates
Templates are inline in route files:
- Calendly: `/backend/src/routes/calendly-webhook.ts`
- Contact Form: `/backend/src/routes/contact-form.ts`

### Update Pricing
Update in chat widget system prompt:
- Starter: £350/month + £1,000 setup
- Professional: £550/month + £3,000 setup
- Enterprise: £800/month + £7,000 setup

### Update Lead Scoring
Edit `/backend/src/routes/chat-widget.ts` `qualifyLead()` function to adjust scoring algorithm.

---

## 🐛 Troubleshooting

### Groq API Errors
**Problem:** Chat widget returns fallback message

**Solutions:**
1. Check `GROQ_API_KEY` is valid
2. Verify API quota not exceeded
3. Test health endpoint: `GET /api/chat-widget/health`

### Email Not Sending
**Problem:** No confirmation emails received

**Solutions:**
1. Check `RESEND_API_KEY` is valid
2. Verify `FROM_EMAIL` is configured
3. Check Resend dashboard for delivery status
4. Verify email domain is verified in Resend

### Slack Alerts Not Working
**Problem:** No Slack notifications

**Solutions:**
1. Check `SLACK_BOT_TOKEN` is valid
2. Verify `SLACK_ALERTS_CHANNEL` exists
3. Ensure bot has permission to post in channel
4. Check Slack API logs for errors

### Database Storage Failing
**Problem:** Warning logs about table not existing

**Solutions:**
1. Apply migration: `psql $DATABASE_URL -f backend/supabase/migrations/20260202_create_website_routes_tables.sql`
2. Or ignore warnings - routes work without database tables

---

## 📚 Resources

### Files Created
- `/backend/src/routes/calendly-webhook.ts` - Calendly webhook handler
- `/backend/src/routes/contact-form.ts` - Contact form handler
- `/backend/src/routes/chat-widget.ts` - AI chat widget
- `/backend/supabase/migrations/20260202_create_website_routes_tables.sql` - Database schema
- `/backend/scripts/test-website-routes.sh` - Test suite
- `/backend/.env.routes.example` - Environment variables guide
- `/backend/ROUTES_IMPLEMENTATION_SUMMARY.md` - Detailed technical docs

### External Services
- **Resend:** https://resend.com (email delivery)
- **Groq:** https://console.groq.com (AI chat completions)
- **Calendly:** https://calendly.com (appointment booking)
- **Slack:** https://api.slack.com (team notifications)

### Support
- Email: support@voxanne.ai
- Phone: +44 7424 038250
- Documentation: See `ROUTES_IMPLEMENTATION_SUMMARY.md`

---

## ✅ Success Criteria

- [x] All three routes created and mounted
- [x] TypeScript type safety enforced
- [x] Comprehensive error handling
- [x] Email templates designed
- [x] Slack alerts configured
- [x] Lead qualification implemented
- [x] Database storage optional
- [x] Health check endpoints
- [x] Documentation complete
- [x] Test suite created

**Status:** ✅ Ready for deployment 🚀
