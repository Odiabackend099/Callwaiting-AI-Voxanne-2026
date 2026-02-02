# Email Service V2 Documentation

Enhanced email service using native Resend SDK with professional email templates.

## Features

- ✅ **Native Resend SDK** - Modern API with better error handling
- ✅ **Professional HTML Templates** - Responsive, accessible email designs
- ✅ **Calendar Invites** - ICS file generation for appointment confirmations
- ✅ **Email Analytics** - Tags for tracking email performance
- ✅ **Graceful Error Handling** - Detailed error messages and logging
- ✅ **TypeScript Support** - Full type safety

## Installation

The Resend SDK is already installed in the project:

```json
"dependencies": {
  "resend": "^6.6.0"
}
```

## Environment Variables

Required environment variables (`.env` file):

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optional (defaults shown)
FROM_EMAIL=hello@voxanne.ai
SUPPORT_EMAIL=support@voxanne.ai
```

## Usage

### 1. Appointment Confirmation

Send appointment confirmation with calendar invite to customer.

```typescript
import { EmailServiceV2, generateICSFile, formatEmailDate, formatEmailTime } from './services/email-service-v2';

// Generate ICS file for calendar invite
const startTime = new Date('2026-02-10T14:00:00Z');
const endTime = new Date('2026-02-10T14:30:00Z');

const icsContent = generateICSFile({
  startTime,
  endTime,
  summary: 'Voxanne AI Demo',
  description: 'Personalized demo of Voxanne AI voice agents',
  location: 'Zoom (link will be sent separately)',
  organizerEmail: 'hello@voxanne.ai',
  attendeeEmail: 'customer@example.com',
  attendeeName: 'John Smith'
});

// Send confirmation email
const result = await EmailServiceV2.sendAppointmentConfirmation({
  name: 'John Smith',
  email: 'customer@example.com',
  date: formatEmailDate(startTime),
  time: formatEmailTime(startTime, 'GMT'),
  duration: '30 minutes',
  icsFile: icsContent // Optional
});

if (result.success) {
  console.log(`Email sent! ID: ${result.id}`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

**Template Preview:**
- ✅ Confirmation checkmark
- 📅 Date, time, duration details
- 📋 What to expect section
- 📞 Contact information
- 📎 Calendar invite attachment (ICS file)

---

### 2. Contact Form Notification (to Support)

Send internal notification when someone submits a contact form.

```typescript
const result = await EmailServiceV2.sendContactFormNotification({
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1-555-123-4567', // Optional
  subject: 'Interested in Enterprise Plan',
  message: 'I need pricing for 500 calls/day...'
});
```

**Email Details:**
- **To:** `SUPPORT_EMAIL` (from environment)
- **Reply-To:** Customer's email (for easy replies)
- **Subject:** `[Contact Form] {subject} - {name}`
- **Tags:** `category: contact_form`, `source: website`

**Template Preview:**
- Contact details (name, email, phone)
- Subject line
- Message content in readable box
- Click-to-call/email links

---

### 3. Contact Form Confirmation (to User)

Send confirmation to user who submitted the contact form.

```typescript
const result = await EmailServiceV2.sendContactFormConfirmation({
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1-555-123-4567',
  subject: 'Interested in Enterprise Plan',
  message: 'I need pricing...'
});
```

**Template Preview:**
- ✉️ Envelope icon
- Thank you message
- 24-hour response time commitment
- Links to resources (demo, pricing, blog)
- Contact information

---

### 4. Hot Lead Alert

Send urgent notification when a qualified lead is detected.

```typescript
const result = await EmailServiceV2.sendHotLeadAlert({
  leadInfo: 'Medical clinic owner, 200 calls/day',
  conversationSummary: `
    - Asked about HIPAA compliance
    - Mentioned $50k budget
    - Ready to book demo
    - Quality score: 9/10
  `,
  contactEmail: 'lead@example.com', // Optional
  contactPhone: '+1-555-987-6543',  // Optional
  timestamp: new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'long'
  })
});
```

**Email Details:**
- **To:** `SUPPORT_EMAIL`
- **Subject:** `🔥 Hot Lead from Chat Widget`
- **Tags:** `category: hot_lead_alert`, `source: chat_widget`, `priority: high`

**Template Preview:**
- 🔥 Fire icon and gradient header
- Lead information box
- Contact details (email, phone)
- Conversation summary
- ⚡ Action required: Follow up within 24 hours
- Timestamp

---

## Helper Functions

### `generateICSFile()`

Generate ICS (iCalendar) file for calendar invites.

```typescript
import { generateICSFile } from './services/email-service-v2';

const icsContent = generateICSFile({
  startTime: new Date('2026-02-10T14:00:00Z'),
  endTime: new Date('2026-02-10T14:30:00Z'),
  summary: 'Meeting Title',
  description: 'Meeting description',
  location: 'Zoom', // Optional
  organizerEmail: 'organizer@voxanne.ai',
  attendeeEmail: 'attendee@example.com',
  attendeeName: 'Attendee Name'
});

// Returns ICS file content as string
// Can be attached to emails or saved to file
```

**ICS Features:**
- ✅ Standard RFC 5545 format
- ✅ 15-minute reminder alarm
- ✅ Organizer and attendee details
- ✅ Works with Google Calendar, Outlook, Apple Calendar

---

### `formatEmailDate()`

Format date for email display.

```typescript
import { formatEmailDate } from './services/email-service-v2';

const date = new Date('2026-02-10T14:00:00Z');
const formatted = formatEmailDate(date);
// Returns: "Monday, February 10, 2026"
```

---

### `formatEmailTime()`

Format time for email display.

```typescript
import { formatEmailTime } from './services/email-service-v2';

const date = new Date('2026-02-10T14:00:00Z');
const formatted = formatEmailTime(date, 'GMT');
// Returns: "2:00 PM GMT"
```

---

## Testing

Run the test script to verify email service:

```bash
# Set test email in .env
TEST_EMAIL=your-email@example.com

# Run tests
npm run test:email-v2
```

Or run manually:

```bash
npx tsx src/scripts/test-email-service-v2.ts
```

**Test Coverage:**
- ✅ Appointment confirmation with ICS attachment
- ✅ Contact form notification to support
- ✅ Contact form confirmation to user
- ✅ Hot lead alert
- ✅ ICS file generation
- ✅ Date/time formatting helpers

---

## Email Analytics (Resend Dashboard)

All emails include tags for tracking:

| Email Type | Tags |
|------------|------|
| Appointment Confirmation | `category: appointment_confirmation`, `source: calendly` |
| Contact Form Notification | `category: contact_form`, `source: website` |
| Contact Form Confirmation | `category: contact_form_confirmation`, `source: website` |
| Hot Lead Alert | `category: hot_lead_alert`, `source: chat_widget`, `priority: high` |

View analytics in [Resend Dashboard](https://resend.com/emails) → Filter by tags

---

## Error Handling

All methods return a standard result object:

```typescript
interface SendEmailResult {
  success: boolean;
  id?: string;      // Resend email ID (if successful)
  error?: string;   // Error message (if failed)
}
```

**Example:**

```typescript
const result = await EmailServiceV2.sendAppointmentConfirmation(data);

if (result.success) {
  console.log(`✅ Email sent! ID: ${result.id}`);
  // Store result.id in database for tracking
} else {
  console.error(`❌ Failed to send email: ${result.error}`);
  // Log error, retry, or alert team
}
```

---

## Migration from V1

If you're using the old `email-service.ts` (nodemailer-based):

| Old (V1) | New (V2) |
|----------|----------|
| `sendEmailViaSmtp()` | Use Resend SDK directly |
| `sendDemoEmailTemplate()` | `EmailServiceV2.sendAppointmentConfirmation()` |

**Benefits of V2:**
- ✨ Better error messages
- ✨ Built-in analytics tracking
- ✨ Modern HTML templates
- ✨ Calendar invite support
- ✨ Type-safe API

---

## Troubleshooting

### Email not sending

1. **Check API key:**
   ```bash
   echo $RESEND_API_KEY
   # Should start with "re_"
   ```

2. **Verify domain in Resend:**
   - Login to [Resend Dashboard](https://resend.com/domains)
   - Ensure `voxanne.ai` is verified (DNS records configured)

3. **Check logs:**
   ```bash
   # Enable debug logging
   console.log('[EmailServiceV2] Sending email:', result);
   ```

### Email in spam folder

- Add SPF, DKIM, DMARC records in DNS
- Use verified domain in `FROM_EMAIL`
- Avoid spam trigger words in subject/body
- Include unsubscribe link (for marketing emails)

### ICS file not working

- Verify dates are valid JavaScript Date objects
- Check timezone handling (use UTC for consistency)
- Test with different calendar apps (Google, Outlook, Apple)

---

## Production Checklist

Before deploying to production:

- [ ] Set `RESEND_API_KEY` in production environment
- [ ] Verify `voxanne.ai` domain in Resend Dashboard
- [ ] Configure DNS records (SPF, DKIM, DMARC)
- [ ] Test all email templates with real data
- [ ] Set up email analytics monitoring
- [ ] Configure email rate limits (Resend dashboard)
- [ ] Add unsubscribe links (for marketing emails)
- [ ] Test ICS files with multiple calendar apps
- [ ] Monitor deliverability rates (>95%)
- [ ] Set up alerts for failed emails

---

## API Reference

### `EmailServiceV2.sendAppointmentConfirmation(data)`

**Parameters:**

```typescript
interface AppointmentConfirmationData {
  name: string;           // Customer name
  email: string;          // Customer email
  date: string;           // Formatted date (e.g., "Monday, February 10, 2026")
  time: string;           // Formatted time (e.g., "2:00 PM GMT")
  duration: string;       // Duration (e.g., "30 minutes")
  calendlyUrl?: string;   // Optional Calendly URL
  icsFile?: string;       // Optional ICS file content (Base64 or plain text)
}
```

**Returns:** `Promise<SendEmailResult>`

---

### `EmailServiceV2.sendContactFormNotification(data)`

**Parameters:**

```typescript
interface ContactFormData {
  name: string;       // Contact name
  email: string;      // Contact email
  phone?: string;     // Contact phone (optional)
  subject: string;    // Form subject
  message: string;    // Form message
}
```

**Returns:** `Promise<SendEmailResult>`

---

### `EmailServiceV2.sendContactFormConfirmation(data)`

**Parameters:** Same as `sendContactFormNotification()`

**Returns:** `Promise<SendEmailResult>`

---

### `EmailServiceV2.sendHotLeadAlert(data)`

**Parameters:**

```typescript
interface HotLeadAlertData {
  leadInfo: string;              // Lead information summary
  conversationSummary: string;   // Conversation details
  contactEmail?: string;         // Lead email (optional)
  contactPhone?: string;         // Lead phone (optional)
  timestamp: string;             // When lead was detected
}
```

**Returns:** `Promise<SendEmailResult>`

---

## Support

For questions or issues:

- 📧 Email: support@voxanne.ai
- 📞 Phone: +44 7424 038250
- 📚 Resend Docs: https://resend.com/docs
- 🐛 Report bugs: Create GitHub issue

---

## Changelog

### Version 2.0.0 (2026-02-02)

- ✨ Initial release using Resend SDK
- ✨ Four email templates (appointment, contact form, hot leads)
- ✨ ICS calendar invite generation
- ✨ Email analytics tags
- ✨ Comprehensive test suite
- ✨ TypeScript support
