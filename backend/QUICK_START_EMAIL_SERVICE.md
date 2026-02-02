# Email Service V2 - Quick Start Guide

Get started with the enhanced email service in 5 minutes.

---

## Step 1: Set Environment Variables

Create or update `/backend/.env`:

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optional (defaults)
FROM_EMAIL=hello@voxanne.ai
SUPPORT_EMAIL=support@voxanne.ai
```

**Get your Resend API key:**
1. Visit https://resend.com/api-keys
2. Create new API key
3. Copy and paste into `.env`

---

## Step 2: Test the Service

```bash
cd backend
npm run test:email-v2
```

**Expected output:**
```
🧪 Testing Email Service V2

📋 Environment Check:
  RESEND_API_KEY: ✅ Set
  FROM_EMAIL: hello@voxanne.ai
  SUPPORT_EMAIL: support@voxanne.ai

--- Test 1: Appointment Confirmation ---
✅ Appointment confirmation sent (ID: xxx)

--- Test 2: Contact Form Notification ---
✅ Contact form notification sent (ID: xxx)

--- Test 3: Contact Form Confirmation ---
✅ Contact form confirmation sent (ID: xxx)

--- Test 4: Hot Lead Alert ---
✅ Hot lead alert sent (ID: xxx)

✅ Email Service V2 Testing Complete
```

---

## Step 3: Use in Your Code

### Example: Send Appointment Confirmation

```typescript
import {
  EmailServiceV2,
  generateICSFile,
  formatEmailDate,
  formatEmailTime
} from './services/email-service-v2';

// Appointment details
const startTime = new Date('2026-02-10T14:00:00Z');
const endTime = new Date('2026-02-10T14:30:00Z');

// Generate calendar invite
const icsContent = generateICSFile({
  startTime,
  endTime,
  summary: 'Voxanne AI Demo',
  description: 'Personalized demo of Voxanne AI',
  location: 'Zoom',
  organizerEmail: 'hello@voxanne.ai',
  attendeeEmail: 'customer@example.com',
  attendeeName: 'John Smith'
});

// Send email
const result = await EmailServiceV2.sendAppointmentConfirmation({
  name: 'John Smith',
  email: 'customer@example.com',
  date: formatEmailDate(startTime),
  time: formatEmailTime(startTime, 'GMT'),
  duration: '30 minutes',
  icsFile: icsContent
});

if (result.success) {
  console.log(`✅ Email sent! ID: ${result.id}`);
} else {
  console.error(`❌ Failed: ${result.error}`);
}
```

---

## Step 4: Integrate with Routes

### Calendly Webhook Example

```typescript
import { Router } from 'express';
import {
  EmailServiceV2,
  generateICSFile,
  formatEmailDate,
  formatEmailTime
} from '../services/email-service-v2';

const router = Router();

router.post('/webhooks/calendly', async (req, res) => {
  const { event, payload } = req.body;

  if (event === 'invitee.created') {
    const { name, email, scheduled_event } = payload;
    const startTime = new Date(scheduled_event.start_time);
    const endTime = new Date(scheduled_event.end_time);

    const icsContent = generateICSFile({
      startTime,
      endTime,
      summary: 'Voxanne AI Demo',
      description: 'Demo call',
      organizerEmail: 'hello@voxanne.ai',
      attendeeEmail: email,
      attendeeName: name
    });

    const result = await EmailServiceV2.sendAppointmentConfirmation({
      name,
      email,
      date: formatEmailDate(startTime),
      time: formatEmailTime(startTime, 'GMT'),
      duration: '30 minutes',
      icsFile: icsContent
    });

    return res.json({ success: result.success });
  }

  res.json({ message: 'Event ignored' });
});

export default router;
```

---

## Available Email Types

### 1. Appointment Confirmation
```typescript
EmailServiceV2.sendAppointmentConfirmation({
  name: 'Customer Name',
  email: 'customer@example.com',
  date: 'Monday, February 10, 2026',
  time: '2:00 PM GMT',
  duration: '30 minutes',
  icsFile: '...' // Optional calendar invite
});
```

### 2. Contact Form Notification (to Support)
```typescript
EmailServiceV2.sendContactFormNotification({
  name: 'Lead Name',
  email: 'lead@example.com',
  phone: '+1-555-123-4567', // Optional
  subject: 'Pricing Question',
  message: 'Message text...'
});
```

### 3. Contact Form Confirmation (to User)
```typescript
EmailServiceV2.sendContactFormConfirmation({
  name: 'Lead Name',
  email: 'lead@example.com',
  phone: '+1-555-123-4567',
  subject: 'Pricing Question',
  message: 'Message text...'
});
```

### 4. Hot Lead Alert
```typescript
EmailServiceV2.sendHotLeadAlert({
  leadInfo: 'Medical clinic, 200 calls/day',
  conversationSummary: 'Asked about pricing, ready to demo',
  contactEmail: 'lead@example.com', // Optional
  contactPhone: '+1-555-987-6543', // Optional
  timestamp: new Date().toLocaleString()
});
```

---

## Helper Functions

### Generate Calendar Invite (ICS File)
```typescript
const icsContent = generateICSFile({
  startTime: new Date('2026-02-10T14:00:00Z'),
  endTime: new Date('2026-02-10T14:30:00Z'),
  summary: 'Meeting Title',
  description: 'Meeting description',
  location: 'Zoom',
  organizerEmail: 'hello@voxanne.ai',
  attendeeEmail: 'attendee@example.com',
  attendeeName: 'Attendee Name'
});
```

### Format Dates for Email
```typescript
const date = new Date('2026-02-10T14:00:00Z');

formatEmailDate(date);  // "Monday, February 10, 2026"
formatEmailTime(date, 'GMT');  // "2:00 PM GMT"
```

---

## Error Handling

All methods return:

```typescript
{
  success: boolean;
  id?: string;      // Resend email ID (if successful)
  error?: string;   // Error message (if failed)
}
```

**Example:**
```typescript
const result = await EmailServiceV2.sendAppointmentConfirmation(data);

if (!result.success) {
  console.error('Failed to send email:', result.error);
  // Log error, retry, or alert team
}
```

---

## Production Setup

### 1. Verify Domain in Resend

1. Login to https://resend.com/domains
2. Click "Add Domain"
3. Enter `voxanne.ai`
4. Add DNS records provided by Resend:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: (provided by Resend)
   - DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@voxanne.ai`

### 2. Set Environment Variables

**Vercel/Production:**
```bash
vercel env add RESEND_API_KEY production
# Paste your production API key when prompted
```

### 3. Monitor Emails

View analytics in Resend Dashboard:
- https://resend.com/emails
- Filter by tags: `category`, `source`, `priority`
- Track: Sent, Delivered, Opened, Clicked

---

## Troubleshooting

### Email not sending
- Check `RESEND_API_KEY` is set correctly
- Verify domain in Resend Dashboard
- Check logs for error messages

### Email in spam
- Verify DNS records (SPF, DKIM, DMARC)
- Use verified domain in `FROM_EMAIL`
- Test with mail-tester.com

### Calendar invite not working
- Verify ICS file is valid
- Test with different calendar apps
- Check date formatting (use UTC)

---

## Documentation

**Full Documentation:**
- `/backend/src/services/EMAIL_SERVICE_V2_README.md` - Complete guide

**Examples:**
- `/backend/src/examples/email-service-integration.ts` - Real-world examples

**Test Suite:**
- `/backend/src/scripts/test-email-service-v2.ts` - Automated tests

---

## Need Help?

- 📧 Email: support@voxanne.ai
- 📞 Phone: +44 7424 038250
- 📚 Resend Docs: https://resend.com/docs

---

**Status:** ✅ Ready to use
**Version:** 2.0.0
**Last Updated:** February 2, 2026
