# ✅ Complete Form Submission & Email Verification Test Prompt

## 🎯 Objective
Test the complete onboarding form workflow from submission to email delivery verification using browser automation and backend testing endpoints.

**Test Email:** `egualesamuel@gmail.com`

---

## 📋 PRE-TEST CHECKLIST

### Backend Verification
- ✅ Backend running on port 3001
- ✅ Frontend running on port 3000
- ✅ ngrok tunnel active
- ✅ Resend email service configured (RESEND_API_KEY set)
- ✅ Support email configured: support@voxanne.ai
- ✅ Email testing endpoints available at `/api/email-testing/*`

### Test Email Prerequisites
- Email: `egualesamuel@gmail.com`
- Access to email inbox (for verification)
- Browser for testing frontend form

---

## 🔧 STEP 1: Verify Email Configuration

### Check Email Service Status

```bash
# Verify Resend API is configured
curl http://localhost:3001/api/email-testing/config

# Expected response:
#{
#  "email_service": {
#    "resend_configured": true,
#    "from_email": "hello@voxanne.ai",
#    "support_email": "support@voxanne.ai"
#  },
#  "environment": "development",
#  "timestamp": "2026-02-13T17:11:52.000Z"
#}
```

### Send Test Email (Optional)

To verify Resend is working before the main test:

```bash
curl -X POST http://localhost:3001/api/email-testing/send-test-email \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "egualesamuel@gmail.com",
    "subject": "Test Email from Voxanne AI",
    "message": "This is a test email to verify the system is working"
  }'

# Expected: Email should arrive within 1-2 minutes
```

---

## 🌐 STEP 2: Fill & Submit Form via Browser

### Using Browser MCP (Playwright)

```javascript
// Navigate to form
browser.goto('http://localhost:3000/start');

// Fill form fields
browser.fill('input[name="company"]', 'QA Test Company');
browser.fill('input[name="email"]', 'egualesamuel@gmail.com');
browser.fill('input[name="phone"]', '+44 7424 038250');
browser.fill('textarea[name="greeting_script"]', 
  'Thank you for calling QA Test Company. How may I assist you?');

// Optional: Select voice preference
browser.selectOption('select[name="voice_preference"]', 'AI (Neutral)');

// Submit form
browser.click('button[type="submit"]');

// Wait for success message
browser.waitForSelector('h3:has-text("Submitted Successfully")');

// Capture screenshot
browser.screenshot('form-success.png');
```

### Manual Browser Steps (Alternative)

1. Open `http://localhost:3000/start` in browser
2. Fill in the form:
   - **Company Name:** QA Test Company
   - **Email:** egualesamuel@gmail.com
   - **Phone:** +44 7424 038250
   - **Greeting Script:** "Thank you for calling QA Test Company. How may I assist you?"
   - **Voice Type:** AI (Neutral)
3. Click "Submit Application"
4. You should see: "Submitted Successfully! ✅" message
5. Note the timestamp (e.g., 17:11:52 UTC)

---

## ✉️ STEP 3: Verify User Confirmation Email

### Check Email Inbox for `egualesamuel@gmail.com`

**Expected Email Details:**
- **From:** noreply@voxanne.ai
- **Subject:** "Thank you for your submission - Voxanne AI"
- **Should arrive within:** 1-2 minutes
- **Content should include:**
  - ✅ "Thank You for Your Submission!"
  - ✅ Company name: "QA Test Company"
  - ✅ "Our team will review your submission"
  - ✅ "configure your AI agent within the next 24 hours"
  - ✅ Submission ID (UUID format)
  - ✅ Link to support: support@voxanne.ai

### Verify via Testing Endpoint

```bash
# Check if submission was recorded
curl "http://localhost:3001/api/email-testing/verify-submission/egualesamuel@gmail.com"

# Expected response:
#{
#  "verified": true,
#  "message": "Submission found!",
#  "email": "egualesamuel@gmail.com",
#  "count": 1,
#  "latest_submission": {
#    "id": "550e8400-e29b-41d4-a716-446655440000",
#    "company": "QA Test Company",
#    "submitted_at": "2026-02-13T17:11:52.000Z",
#    "status": "pending",
#    "emails_sent": {
#      "confirmation": "✅ Confirmation email sent to egualesamuel@gmail.com",
#      "support": "✅ Notification sent to support@voxanne.ai",
#      "slack": "✅ Slack alert sent (if configured)"
#    },
#    "next_steps": [
#      "Check your email inbox (including spam/junk)",
#      "Support team notified and will configure agent within 24 hours",
#      "You should receive setup instructions via email"
#    ]
#  },
#  "all_submissions": [...]
#}
```

---

## 🎯 STEP 4: Verify Support Team Notification

### Check Support Email Inbox (`support@voxanne.ai`)

**Expected Email Details:**
- **From:** noreply@voxanne.ai
- **To:** support@voxanne.ai
- **Subject:** "🔔 New Onboarding: QA Test Company"
- **Should arrive within:** 30-60 seconds of form submission
- **Content should include:**

#### Company Information Section
- ✅ Company: QA Test Company
- ✅ Email: egualesamuel@gmail.com (clickable mailto link)
- ✅ Phone: +44 7424 038250 (clickable tel link)
- ✅ Voice Preference: AI (Neutral)
- ✅ Submission ID: [UUID]
- ✅ Submitted: [timestamp]

#### Greeting Script Section
- ✅ Display of submitted greeting script
- ✅ Properly formatted in code block

#### Action Required Section
- ✅ "Review the pricing PDF and greeting script"
- ✅ "Configure the AI agent in the dashboard"
- ✅ "Send setup instructions to egualesamuel@gmail.com"
- ✅ Link to Supabase dashboard
- ✅ Direct reply link to customer email

### Verify via Database

```bash
# Check Supabase for submission record
curl "http://localhost:3001/api/email-testing/submissions?email=egualesamuel@gmail.com"

# Expected: Should show 1 submission with all data
```

---

## 📊 STEP 5: Verify Database Record

### Check Supabase onboarding_submissions Table

```bash
# Get all submissions
curl "http://localhost:3001/api/email-testing/submissions"

# Or filter by email
curl "http://localhost:3001/api/email-testing/submissions?email=egualesamuel@gmail.com"

# Verify record contains:
#{
#  "id": "550e8400-e29b-41d4-a716-446655440000",
#  "company_name": "QA Test Company",
#  "user_email": "egualesamuel@gmail.com",
#  "phone_number": "+44 7424 038250",
#  "greeting_script": "Thank you for calling QA Test Company. How may I assist you?",
#  "voice_preference": "AI (Neutral)",
#  "status": "pending",
#  "created_at": "2026-02-13T17:11:52.000Z"
#}
```

---

## 🔄 STEP 6: Email Delivery Timeline Verification

### Expected Timing

| Component | Timeout | Expected |
|-----------|---------|----------|
| Form submission | - | Immediate (< 500ms) |
| Database write | - | < 1 second |
| Support email sent | 2-5 min | 30-60 sec |
| User confirmation email sent | 2-5 min | 1-2 min |
| Slack alert (if configured) | 5 min | < 30 sec |

### Verify Timing

```bash
# Check when submission was created
curl "http://localhost:3001/api/email-testing/verify-submission/egualesamuel@gmail.com" \
  | grep -i "submitted_at\|created"

# Expected: Timestamp should be within testing window
```

---

## ✅ SUCCESS CRITERIA

All of the following must be TRUE for test to PASS:

### ✔️ Frontend
- [ ] Form loads at http://localhost:3000/start
- [ ] All form fields present and valid
- [ ] Form submits successfully (status 200 OK)
- [ ] Success message displayed: "Submitted Successfully! ✅"

### ✔️ Database
- [ ] Submission recorded in `onboarding_submissions` table
- [ ] All fields populated correctly
- [ ] Status = "pending"
- [ ] created_at timestamp correct

### ✔️ User Confirmation Email
- [ ] Email received at egualesamuel@gmail.com
- [ ] Received within 2 minutes of submission
- [ ] From: noreply@voxanne.ai
- [ ] Subject contains confirmation language
- [ ] Body includes company name and submission ID
- [ ] Not in spam/junk folder

### ✔️ Support Notification Email
- [ ] Email received at support@voxanne.ai
- [ ] Received within 1 minute of submission (faster than user email)
- [ ] From: noreply@voxanne.ai
- [ ] Subject contains 🔔 and company name
- [ ] Body includes all company details
- [ ] Includes clickable links (mailto, tel)
- [ ] Includes greeting script
- [ ] Includes action items for support team

### ✔️ Slack Notification (if configured)
- [ ] Slack alert received in #engineering-alerts or similar
- [ ] Includes company name, email, phone
- [ ] Formatted clearly with emojis

### ✔️ Testing Endpoints
- [ ] GET `/api/email-testing/config` returns 200
- [ ] GET `/api/email-testing/verify-submission/{email}` returns submission
- [ ] Database query confirms all fields match

---

## 🧪 OPTIONAL: Resend Confirmation Email

If user didn't receive confirmation email, resend it:

```bash
curl -X POST http://localhost:3001/api/email-testing/resend-confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "email": "egualesamuel@gmail.com"
  }'

# Expected: Email resent to user inbox
```

---

## 🐛 TROUBLESHOOTING

### No Support Email Received
1. Check support@voxanne.ai inbox (including spam)
2. Verify SUPPORT_EMAIL env var: `grep SUPPORT_EMAIL backend/.env`
3. Check backend logs: `tail -100 /path/to/backend.log`
4. Resend email manually: `curl -X POST http://localhost:3001/api/email-testing/resend-confirmation...`

### No User Confirmation Email
1. Check egualesamuel@gmail.com inbox (including spam)
2. Verify FROM_EMAIL env var: `grep FROM_EMAIL backend/.env`
3. Check Resend API key configured: `grep RESEND_API_KEY backend/.env`
4. Run test email endpoint to verify Resend: `curl -X POST http://localhost:3001/api/email-testing/send-test-email...`

### Form Submit Shows Error
1. Check backend logs for validation errors
2. Verify all required fields filled (company, email, phone, greeting_script)
3. Check phone format: Must start with + and include country code
4. Verify greeting_script field name matches (was greetingScript before fix)

### Database Record Missing
1. Verify Supabase connection: `curl http://localhost:3001/api/email-testing/submissions`
2. Check database table exists: `onboarding_submissions`
3. Check RLS policies allow inserts

### Testing Endpoint Returns 404
1. Restart backend: `pkill -f "npm run dev"` then restart
2. Verify route mounted: Check `/api/email-testing/config` responds
3. Check server logs for import errors

---

## 📝 TEST REPORT TEMPLATE

```markdown
# Form Submission Test Report
**Date:** 2026-02-13
**Test Email:** egualesamuel@gmail.com
**Tester:** [Your Name]

## Test Results

### Frontend
- Form loads: ✅ YES / ❌ NO
- Fields populate correctly: ✅ YES / ❌ NO
- Form submits (200 OK): ✅ YES / ❌ NO
- Success message displays: ✅ YES / ❌ NO
- Submission timestamp: [HH:MM:SS UTC]

### Database
- Record created: ✅ YES / ❌ NO
- All fields populated: ✅ YES / ❌ NO
- Status = pending: ✅ YES / ❌ NO

### User Confirmation Email
- Received: ✅ YES / ❌ NO
- Time received: [HH:MM:SS UTC]
- Time after submission: [X minutes]
- From address: noreply@voxanne.ai
- Subject: [COPY SUBJECT LINE]
- Contains company name: ✅ YES / ❌ NO
- Contains submission ID: ✅ YES / ❌ NO

### Support Notification Email
- Received: ✅ YES / ❌ NO
- Time received: [HH:MM:SS UTC]
- Time after submission: [X minutes]
- From address: noreply@voxanne.ai
- Subject: [COPY SUBJECT LINE]
- Contains all details: ✅ YES / ❌ NO
- Includes greeting script: ✅ YES / ❌ NO

### Overall Result
**PASS ✅ / FAIL ❌**

## Issues Found
1. [Issue 1]
2. [Issue 2]

## Notes
[Any additional observations]
```

---

## 🚀 QUICK TEST COMMAND (All-in-One)

```bash
#!/bin/bash

echo "=== FORM SUBMISSION TEST SEQUENCE ==="
echo ""

# 1. Verify email config
echo "1️⃣  Checking email configuration..."
curl -s http://localhost:3001/api/email-testing/config | jq .

echo ""
echo "2️⃣  Verify submission endpoint..."
curl -s "http://localhost:3001/api/email-testing/verify-submission/egualesamuel@gmail.com" | jq .

echo ""
echo "3️⃣  Check all submissions..."
curl -s http://localhost:3001/api/email-testing/submissions | jq .

echo ""
echo "✅ Test complete! Check inbox for emails."
```

---

## 📧 How to Share Test Results

1. **Screenshot Form Success:** `form-success.png`
2. **Confirmation Email Screenshot:** Show from/to/subject/timestamp
3. **Support Email Screenshot:** Show from/to/subject/timestamp
4. **API Response:** Output of verify-submission endpoint
5. **Database Record:** Content of onboarding_submissions record

---

**This comprehensive test ensures the complete workflow from form submission → email delivery → database storage is working correctly.**

**Status:** ✅ **READY FOR TESTING**
