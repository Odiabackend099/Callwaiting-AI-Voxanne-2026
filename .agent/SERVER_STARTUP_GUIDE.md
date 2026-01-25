# Server Startup & ngrok Webhook Tunneling Guide

**Last Updated:** 2026-01-25
**Project:** Voxanne AI
**Environment:** Local Development (localhost with ngrok tunneling)

---

## Quick Start (TL;DR)

```bash
# Terminal 1: Start Backend (from project root)
cd backend && npm run dev

# Terminal 2: Start Frontend (from project root)
npm run dev

# Terminal 3: Start ngrok tunnel (from backend directory)
npm run tunnel
# OR manually:
ngrok http 3001

# Terminal 4: Update .env.local with new ngrok URL
# Copy the ngrok URL and update NEXT_PUBLIC_BACKEND_URL
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  LOCAL DEVELOPMENT                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │  Frontend        │         │  Backend         │        │
│  │  localhost:3000  │◄────►   │  localhost:3001  │        │
│  └──────────────────┘         └──────────────────┘        │
│         ▲                             ▲                    │
│         │                             │                    │
│         │                    ┌────────┴────────┐           │
│         │                    │                 │           │
│         │              ┌──────────────┐    ┌──────────────┐│
│         │              │   ngrok      │    │  Supabase    ││
│         │              │  Tunnel      │    │  Database    ││
│         │              │  Port 3001   │    │              ││
│         │              └──────────────┘    └──────────────┘│
│         │                    ▲                             │
│         └────────────────────┼─────────────────────────────┘
│                              │
│                    ┌─────────┴──────────┐
│                    │ https://xxxx-xxxx   │
│                    │ .ngrok-free.dev    │
│                    │                    │
│                    │  (External Access) │
│                    └────────────────────┘
│
│  ┌─────────────────────────────────────┐
│  │  EXTERNAL SERVICES                  │
│  ├─────────────────────────────────────┤
│  │  • Vapi (webhook callbacks)         │
│  │  • Twilio (SMS/Call webhooks)       │
│  │  • Google Calendar (OAuth redirect) │
│  │  • Resend (Email service)           │
│  └─────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting, ensure you have:

```bash
# 1. Node.js 20+ installed
node --version  # Should show v20.x.x or higher

# 2. Dependencies installed
npm install     # Root (frontend)
cd backend && npm install  # Backend

# 3. ngrok installed
ngrok version   # Should show ngrok version
# If not installed:
# macOS: brew install ngrok
# Linux: Download from https://ngrok.com/download
# Windows: Download from https://ngrok.com/download

# 4. .env.local configured (see Environment Setup below)
```

---

## Step-by-Step Startup

### Step 1: Start Backend Server

**Terminal 1:**

```bash
cd backend
npm run dev
```

**Expected Output:**
```
[server] Starting Voxanne backend...
[server] Listening on http://localhost:3001
[server] Database connected
[server] Vapi client initialized
[server] Express server running
```

**Verify:** Open `http://localhost:3001` in browser → Should show a healthy backend response or 404 (not CORS error).

**Common Issues:**
- ❌ `Port 3001 already in use` → Kill process on port 3001: `lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- ❌ `Database connection failed` → Check `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- ❌ `Vapi client error` → Check `VAPI_PRIVATE_KEY` is set

---

### Step 2: Start Frontend Dev Server

**Terminal 2:**

```bash
npm run dev
```

**Expected Output:**
```
  ▲ Next.js 14.2.14
  - Ready in 2.5s

  ○ Localhost:3000
  ● http://localhost:3000

  ✓ Ready in 2.5s
```

**Verify:** Open `http://localhost:3000` in browser → Should see Voxanne dashboard login page.

**Common Issues:**
- ❌ `Port 3000 already in use` → Kill process: `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- ❌ CORS errors in console → Check `NEXT_PUBLIC_BACKEND_URL` in `.env.local`
- ❌ Blank page → Check browser console for TypeScript errors

---

### Step 3: Start ngrok Tunnel

**Terminal 3 (from backend directory):**

```bash
npm run tunnel
```

**OR manually:**

```bash
ngrok http 3001
```

**Expected Output:**
```
ngrok by @inconshreveable                                      (Ctrl+C to quit)

Session Status                online
Account                       your-email@example.com (Plan: Free)
Version                       3.x.x
Region                        auto
Latency                       -
Web Interface                 http://127.0.0.1:4040

Forwarding                    https://sobriquetical-zofia-abysmally.ngrok-free.dev -> http://localhost:3001

Connections                   ttl     opn     dl      in      out
                              0       0       0       B       0B
```

**Copy the Forwarding URL:** `https://sobriquetical-zofia-abysmally.ngrok-free.dev`

---

### Step 4: Update Environment Configuration

**File:** `.env.local`

Update `NEXT_PUBLIC_BACKEND_URL` with your new ngrok URL:

```bash
# OLD (replace with your ngrok URL)
NEXT_PUBLIC_BACKEND_URL="https://sobriquetical-zofia-abysmally.ngrok-free.dev"

# NEW (update after step 3)
NEXT_PUBLIC_BACKEND_URL="https://your-new-ngrok-url.ngrok-free.dev"
```

**Important:** Every time you restart ngrok, you get a NEW URL. You must update `.env.local` and restart the frontend dev server.

---

## Environment Variables Reference

### Frontend (.env.local)

```bash
# API Configuration
NEXT_PUBLIC_API_URL="https://voxanne-backend.onrender.com"  # Production API
NEXT_PUBLIC_BACKEND_URL="https://sobriquetical-zofia-abysmally.ngrok-free.dev"  # ngrok tunnel
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Frontend URL

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://lbjymlodxprzqgtyqtcq.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Backend (.env in backend directory)

```bash
# Server
NODE_ENV=development
BACKEND_URL=http://localhost:3001  # Local backend URL
BACKEND_PORT=3001

# Supabase
SUPABASE_URL="https://lbjymlodxprzqgtyqtcq.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Vapi (Required for voice calls)
VAPI_PRIVATE_KEY="<your-vapi-private-key>"
VAPI_PUBLIC_KEY="<your-vapi-public-key>"

# Twilio (Required for SMS/Calls)
TWILIO_ACCOUNT_SID="<your-account-sid>"
TWILIO_AUTH_TOKEN="<your-auth-token>"

# Google OAuth (Required for Calendar integration)
GOOGLE_CLIENT_ID="<your-client-id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<your-client-secret>"
GOOGLE_OAUTH_REDIRECT_URI="https://your-ngrok-url.ngrok-free.dev/api/auth/google/callback"

# Email Service
RESEND_API_KEY="<your-resend-api-key>"

# Webhook Security
VAPI_WEBHOOK_SECRET="<your-webhook-secret>"
```

---

## Webhook Configuration (CRITICAL)

When you start ngrok, external services need to know your new URL.

### 1. **Vapi Webhook URL**

Update in Vapi dashboard:

```
Webhook URL: https://your-ngrok-url.ngrok-free.dev/api/webhooks/vapi
```

Steps:
1. Go to https://dashboard.vapi.ai
2. Select your Assistant
3. Find "Webhook URL" field
4. Update with your ngrok URL

### 2. **Twilio Webhook URLs**

Update in Twilio Console:

```
Incoming Messages: https://your-ngrok-url.ngrok-free.dev/api/webhooks/twilio/sms
Incoming Calls:    https://your-ngrok-url.ngrok-free.dev/api/webhooks/twilio/voice
Status Callbacks:  https://your-ngrok-url.ngrok-free.dev/api/webhooks/twilio/status
```

Steps:
1. Go to https://console.twilio.com
2. Select your phone number
3. Update webhook URLs

### 3. **Google OAuth Redirect URI**

Add to Google Cloud Console:

```
https://your-ngrok-url.ngrok-free.dev/api/auth/google/callback
```

Steps:
1. Go to https://console.cloud.google.com
2. OAuth 2.0 Client IDs
3. Add "Authorized Redirect URI"
4. Restart backend after updating

---

## Webhook Best Practices

### 1. **Verify Webhook Signatures**

Always validate incoming webhooks before processing:

```typescript
// Example: Vapi webhook verification
import crypto from 'crypto';

function verifyVapiWebhook(req: express.Request): boolean {
  const signature = req.headers['x-vapi-signature'];
  const body = JSON.stringify(req.body);

  const hash = crypto
    .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  return hash === signature;
}

// In your route:
app.post('/api/webhooks/vapi', (req, res) => {
  if (!verifyVapiWebhook(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Process webhook
});
```

### 2. **Immediate Response**

Always respond to webhooks within 5 seconds:

```typescript
// GOOD: Respond immediately, process async
app.post('/api/webhooks/vapi', async (req, res) => {
  res.status(200).json({ status: 'received' }); // Send first

  // Then process async (don't await)
  processWebhook(req.body).catch(err => {
    console.error('Webhook processing failed:', err);
  });
});

// BAD: Don't do this - timeout!
app.post('/api/webhooks/vapi', async (req, res) => {
  await processWebhook(req.body);  // Wait for processing
  res.status(200).json({ status: 'processed' });  // Then respond
});
```

### 3. **Idempotency Handling**

Webhooks may be retried. Always handle duplicate events:

```typescript
async function processVapiWebhook(payload: any) {
  const eventId = payload.eventId; // Unique ID from Vapi

  // Check if already processed
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('external_event_id', eventId)
    .single();

  if (existing) {
    console.log(`Webhook ${eventId} already processed`);
    return;
  }

  // Process new event
  await handleVapiEvent(payload);

  // Mark as processed
  await supabase
    .from('webhook_events')
    .insert({
      external_event_id: eventId,
      processed_at: new Date().toISOString()
    });
}
```

### 4. **Error Handling**

Return proper HTTP status codes:

```typescript
app.post('/api/webhooks/vapi', async (req, res) => {
  try {
    if (!verifyVapiWebhook(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.body.eventId) {
      return res.status(400).json({ error: 'Missing eventId' });
    }

    // Process webhook
    res.status(200).json({ status: 'received' });

    // Async processing
    processWebhook(req.body).catch(err => {
      log.error('webhook', 'Processing failed', {
        eventId: req.body.eventId,
        error: err.message
      });
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 5. **Logging & Monitoring**

Log all webhooks for debugging:

```typescript
app.post('/api/webhooks/vapi', async (req, res) => {
  const startTime = Date.now();
  const eventId = req.body.eventId;
  const eventType = req.body.type;

  log.info('webhook', 'Received webhook', {
    eventId,
    eventType,
    timestamp: new Date().toISOString()
  });

  res.status(200).json({ status: 'received' });

  processWebhook(req.body)
    .then(() => {
      const duration = Date.now() - startTime;
      log.info('webhook', 'Processed successfully', {
        eventId,
        duration,
        eventType
      });
    })
    .catch(err => {
      const duration = Date.now() - startTime;
      log.error('webhook', 'Processing failed', {
        eventId,
        duration,
        eventType,
        error: err.message,
        stack: err.stack
      });
    });
});
```

---

## Testing Webhooks Locally

### Option 1: Using ngrok Web Interface

```bash
# While ngrok is running, visit:
http://127.0.0.1:4040

# You can:
# - Inspect all requests to your tunnel
# - See request/response headers and bodies
# - Replay requests for testing
```

### Option 2: Manual Testing with curl

```bash
# Test Vapi webhook endpoint
curl -X POST http://localhost:3001/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: <signature>" \
  -d '{
    "eventId": "test-123",
    "type": "call.started",
    "data": { "callId": "call-456" }
  }'
```

### Option 3: Using Postman

1. Open Postman
2. Create a new POST request
3. URL: `http://localhost:3001/api/webhooks/vapi`
4. Headers: `Content-Type: application/json`
5. Body (raw JSON):

```json
{
  "eventId": "test-123",
  "type": "call.started",
  "data": { "callId": "call-456" }
}
```

6. Send and check response

---

## Troubleshooting

### Issue: "CORS error when frontend calls backend"

**Solution:**
```bash
# Check NEXT_PUBLIC_BACKEND_URL matches ngrok URL
cat .env.local | grep NEXT_PUBLIC_BACKEND_URL

# Restart frontend dev server after updating .env.local
npm run dev  # Stop and restart
```

### Issue: "Webhook not reaching backend"

**Solution:**
```bash
# Check ngrok is still running
# Check ngrok forwarding URL in Terminal 3

# Verify webhook URL is correct in external service:
# Vapi Dashboard → Assistant → Webhook URL
# Should match: https://your-ngrok-url.ngrok-free.dev/api/webhooks/vapi

# Test with curl:
curl -X POST https://your-ngrok-url.ngrok-free.dev/api/webhooks/vapi
```

### Issue: "ngrok URL expires or stops working"

**Solution:**
```bash
# Free ngrok accounts expire after 2 hours of inactivity
# If URL changes, update in three places:

# 1. .env.local
NEXT_PUBLIC_BACKEND_URL="https://new-ngrok-url.ngrok-free.dev"

# 2. Vapi Dashboard
# → Assistant → Webhook URL

# 3. Twilio Console
# → Phone Number → Webhooks

# Restart frontend:
npm run dev
```

### Issue: "Backend not connecting to database"

**Solution:**
```bash
# Check Supabase credentials:
cat backend/.env | grep SUPABASE

# Verify connection:
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('organizations').select('count').single()
  .then(r => console.log('✅ Connected'))
  .catch(e => console.error('❌ Error:', e.message));
"
```

---

## Monitoring & Debugging

### View Backend Logs

```bash
# Terminal 1 (backend) should show:
[server] GET /api/integrations/twilio 200 45ms
[server] POST /api/webhooks/vapi 200 123ms
[server] Error processing webhook: User not found
```

### View Frontend Logs

```bash
# Terminal 2 (frontend) should show:
GET http://localhost:3001/api/integrations/twilio 200 45ms
POST http://localhost:3001/api/webhooks/vapi 200 123ms

# Check browser DevTools:
# F12 → Network tab → See all API calls
```

### View ngrok Activity

```bash
# Terminal 3 (ngrok) shows:
Connections                   ttl     opn     dl      in      out
                              10      2       0       4.5MB   2.1MB

# Visit ngrok web interface:
http://127.0.0.1:4040
```

---

## Production Considerations

### When Ready to Deploy

```bash
# Build frontend
npm run build

# Build backend
cd backend && npm run build

# Deploy to Vercel/Render
# (See deployment documentation)
```

### Important: Update All URLs

When moving to production, update:

1. **Vapi Dashboard**
   - Webhook URL → Production URL

2. **Twilio Console**
   - Webhook URLs → Production URLs

3. **Google Cloud Console**
   - Authorized Redirect URIs → Production URL

4. **Environment Variables**
   - `NEXT_PUBLIC_BACKEND_URL` → Production backend URL
   - `GOOGLE_OAUTH_REDIRECT_URI` → Production callback URL
   - All API keys from production environment

---

## Quick Reference Commands

```bash
# Start everything (from project root)
npm run dev:all  # Starts both frontend and backend concurrently

# Start individual services
cd backend && npm run dev      # Backend on 3001
npm run dev                    # Frontend on 3000
cd backend && npm run tunnel   # ngrok tunnel on 4040

# Kill processes on ports (if stuck)
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
lsof -i :4040 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Check if servers are running
curl http://localhost:3000  # Frontend
curl http://localhost:3001  # Backend
curl http://127.0.0.1:4040 # ngrok web interface

# View environment
cat .env.local
cat backend/.env
```

---

## Summary Checklist

- [ ] Node.js 20+ installed
- [ ] `npm install` run in both root and backend
- [ ] ngrok installed and authenticated
- [ ] `.env.local` has correct values
- [ ] Backend `.env` has Vapi, Twilio, Google credentials
- [ ] Backend starts on port 3001
- [ ] Frontend starts on port 3000
- [ ] ngrok tunnel running and forwarding to 3001
- [ ] `NEXT_PUBLIC_BACKEND_URL` updated with ngrok URL
- [ ] Frontend dev server restarted after .env.local update
- [ ] Vapi webhook URL updated in dashboard
- [ ] Twilio webhook URLs updated in console
- [ ] Google redirect URI updated in cloud console
- [ ] Webhooks tested and working
- [ ] Browser DevTools showing successful API calls

---

**Last Updated:** 2026-01-25
**Status:** ✅ Complete Server Startup Guide
