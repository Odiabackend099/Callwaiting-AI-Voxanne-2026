# Website Routes - API Quick Reference

## 🔗 Endpoints

### 1. Calendly Webhook
```
POST /api/webhooks/calendly
```

**Request:**
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
{ "success": true }
```

---

### 2. Contact Form
```
POST /api/contact-form
```

**Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+447987654321",
  "subject": "Interested in Professional Plan",
  "message": "I would like to know more about your AI phone system.",
  "company": "Example Ltd"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Thank you for contacting us! We will get back to you within 24 hours."
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Valid email is required" }
  ]
}
```

---

### 3. Chat Widget
```
POST /api/chat-widget
```

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are your pricing plans?"
    }
  ],
  "sessionId": "chat_12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "We have three pricing plans: Starter (£350/month), Professional (£550/month), and Enterprise (£800/month). Which would you like to know more about?",
  "sessionId": "chat_12345"
}
```

---

### 4. Chat Widget Health
```
GET /api/chat-widget/health
```

**Response:**
```json
{
  "success": true,
  "groq": "connected",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

---

## 🧪 cURL Examples

### Test Calendly Webhook
```bash
curl -X POST http://localhost:3001/api/webhooks/calendly \
  -H "Content-Type: application/json" \
  -d '{"event":"invitee.created","payload":{"event_type":{"name":"Demo"},"invitee":{"name":"Test","email":"test@example.com","uri":"https://calendly.com/invitees/123"},"event":{"start_time":"2026-02-15T14:00:00Z","end_time":"2026-02-15T14:30:00Z"}}}'
```

### Test Contact Form
```bash
curl -X POST http://localhost:3001/api/contact-form \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","subject":"Test","message":"This is a test message"}'
```

### Test Chat Widget
```bash
curl -X POST http://localhost:3001/api/chat-widget \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Tell me about your pricing"}]}'
```

### Test Chat Widget Health
```bash
curl http://localhost:3001/api/chat-widget/health
```

---

## 🔐 Environment Variables

```bash
# Email Service (Required)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@voxanne.ai

# Groq AI (Required)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# Slack Alerts (Required)
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxx
SLACK_ALERTS_CHANNEL=#voxanne-alerts

# Calendly Webhook (Optional)
CALENDLY_WEBHOOK_SECRET=your_calendly_webhook_secret
```

---

## 📊 Lead Scoring (Chat Widget)

| Score | Status | Action |
|-------|--------|--------|
| ≥70   | 🔥 Hot | Immediate Slack alert + priority follow-up |
| 60-69 | 🔥 Hot | Standard hot lead follow-up |
| 30-59 | 🟡 Warm | Standard follow-up within 24h |
| <30   | ❄️ Cold | Low priority follow-up |

**Scoring Factors:**
- Healthcare/Legal/Home Services: +20-30
- High call volume (50+): +25
- Pain points (missed calls, booking): +15-20
- Intent signals (demo, pricing): +25

---

## 🎯 UK Pricing (Chat Widget Response)

- **Starter:** £350/month + £1,000 setup (400 min/month)
- **Professional:** £550/month + £3,000 setup (1,200 min/month)
- **Enterprise:** £800/month + £7,000 setup (2,000 min/month)

**Contact Info:**
- Phone: +44 7424 038250
- Email: support@voxanne.ai
- Calendly: https://calendly.com/austyneguale/30min

---

## 📧 Email Templates

### Calendly Confirmation (to invitee)
- ✅ Appointment confirmed badge
- 📅 Date and time details
- 🔗 Reschedule button
- ❌ Cancel button

### Calendly Notification (to support)
- 📅 New/Cancelled booking header
- 👤 Invitee details
- 📞 Phone number (if provided)
- 🕐 Appointment time

### Contact Form (to support)
- 📧 Contact details
- 🏢 Company (if provided)
- 🚨 Urgent badge (if detected)
- ✉️ Reply-to user's email

### Contact Form Confirmation (to user)
- ✅ Message received confirmation
- 📚 Helpful resources
- 🔗 Book demo link
- 📞 Phone number

---

## 🔔 Slack Alerts

| Alert | Channel | Trigger |
|-------|---------|---------|
| 📅 New Calendly Booking | #voxanne-alerts | invitee.created |
| ❌ Calendly Cancellation | #voxanne-alerts | invitee.canceled |
| 🔥 Hot Chat Lead (score ≥70) | #voxanne-alerts | Chat widget qualification |
| 🚨 Urgent Contact | #voxanne-alerts | Urgent keywords in subject |
| 📧 New Contact | #voxanne-alerts | Any contact form submission |
| 🔴 Route Error | #voxanne-alerts | Any server error |

---

## 🐛 Common Errors

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [...]
}
```
**Fix:** Check request body matches schema

### Server Error (500)
```json
{
  "success": false,
  "error": "Failed to process your submission. Please try again or contact support@voxanne.ai directly."
}
```
**Fix:** Check server logs and Slack alerts

### Groq API Error (200 with fallback)
```json
{
  "success": true,
  "message": "I'm temporarily unavailable. Please book a demo...",
  "fallback": true
}
```
**Fix:** Check GROQ_API_KEY and API quota

---

## 📁 Files

| File | Purpose |
|------|---------|
| `/backend/src/routes/calendly-webhook.ts` | Calendly webhook handler |
| `/backend/src/routes/contact-form.ts` | Contact form handler |
| `/backend/src/routes/chat-widget.ts` | AI chat widget |
| `/backend/supabase/migrations/20260202_create_website_routes_tables.sql` | Database schema (optional) |
| `/backend/scripts/test-website-routes.sh` | Test suite |
| `/backend/.env.routes.example` | Environment variables guide |

---

## ✅ Deployment Checklist

- [ ] Environment variables configured
- [ ] RESEND_API_KEY added
- [ ] GROQ_API_KEY added
- [ ] Test script passes
- [ ] Slack alerts verified
- [ ] Email templates verified
- [ ] Database migration applied (optional)
- [ ] Calendly webhook configured
- [ ] Production URLs tested

---

## 🚀 Quick Deploy

```bash
# 1. Set environment variables
echo "RESEND_API_KEY=re_xxx" >> backend/.env
echo "GROQ_API_KEY=gsk_xxx" >> backend/.env

# 2. Test locally
cd backend
npm run dev
# In another terminal:
./scripts/test-website-routes.sh

# 3. Deploy
git add .
git commit -m "Add website routes"
git push origin main
```

---

**For full documentation, see:**
- `WEBSITE_ROUTES_README.md` - Complete guide
- `ROUTES_IMPLEMENTATION_SUMMARY.md` - Technical details
- `.env.routes.example` - Environment setup
