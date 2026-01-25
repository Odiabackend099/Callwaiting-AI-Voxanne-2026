# Quick Reference: Server Startup & Webhooks

## 🚀 Start Everything (4 Terminal Windows)

```bash
# Terminal 1: Backend
cd backend && npm run dev
# Runs on: http://localhost:3001

# Terminal 2: Frontend
npm run dev
# Runs on: http://localhost:3000

# Terminal 3: ngrok tunnel
cd backend && npm run tunnel
# Shows: https://xxxx-xxxx.ngrok-free.dev

# Terminal 4: Editor
# Keep this for code changes
```

---

## 📋 After ngrok Starts (DO THIS FIRST!)

1. **Copy ngrok URL** from Terminal 3
   - Looks like: `https://sobriquetical-zofia-abysmally.ngrok-free.dev`

2. **Update .env.local**
   ```bash
   NEXT_PUBLIC_BACKEND_URL="https://your-ngrok-url.ngrok-free.dev"
   ```

3. **Restart Frontend** (Terminal 2)
   - `Ctrl+C` to stop
   - `npm run dev` to start again

4. **Update External Services**
   - Vapi Dashboard: Webhook URL
   - Twilio Console: Phone number webhooks
   - Google Cloud: OAuth redirect URI

---

## 🧪 Test Webhooks

### Web Interface (Best for Debugging)
```bash
# While ngrok running, visit:
http://127.0.0.1:4040

# You can see all requests, responses, and replay them
```

### Manual Test with curl
```bash
curl -X POST http://localhost:3001/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test","type":"call.started"}'
```

---

## 🔍 Verify Everything Works

```bash
# 1. Backend is running
curl http://localhost:3001
# Should NOT get CORS error

# 2. Frontend is running
open http://localhost:3000
# Should see login page

# 3. Frontend can reach backend
# Open DevTools (F12) → Network tab
# Make any API call → Should see successful response

# 4. ngrok tunnel works
curl https://your-ngrok-url.ngrok-free.dev
# Should reach your backend
```

---

## ❌ Common Issues

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | `lsof -i :3000 \| grep LISTEN \| awk '{print $2}' \| xargs kill -9` |
| Port 3001 already in use | `lsof -i :3001 \| grep LISTEN \| awk '{print $2}' \| xargs kill -9` |
| CORS error | Update `NEXT_PUBLIC_BACKEND_URL` in `.env.local` and restart frontend |
| Webhook not reaching backend | Check ngrok URL in external service matches current tunnel URL |
| ngrok URL expires | Every 2 hours on free plan; update `.env.local` and restart frontend |
| Database connection failed | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` |

---

## 📖 Webhook Best Practices (Checklist)

- [ ] **Verify Signature**: Check `x-vapi-signature` header matches
- [ ] **Immediate Response**: Send 200 OK within 5 seconds
- [ ] **Async Processing**: Use fire-and-forget pattern
- [ ] **Idempotency**: Check if event already processed by eventId
- [ ] **Error Handling**: Return proper HTTP status codes
- [ ] **Logging**: Log all webhooks for debugging
- [ ] **Timeout**: Set 30s timeout for async processing

---

## 🔐 Security Checklist

```typescript
// ✅ DO THIS
if (!verifyWebhookSignature(req)) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// ❌ DON'T DO THIS
// Trust webhook without signature verification
```

---

## 📊 Webhook Verification Pattern

```typescript
// 1. Verify signature
if (!verifySignature(req)) return res.status(401).send('Unauthorized');

// 2. Response immediately
res.status(200).json({ status: 'received' });

// 3. Process async (don't await)
processWebhook(req.body).catch(err => {
  log.error('webhook_failed', err.message);
});
```

---

## 🔄 Environment Variables to Update

When ngrok URL changes:

1. **.env.local** (Frontend)
   ```bash
   NEXT_PUBLIC_BACKEND_URL="https://your-new-ngrok-url.ngrok-free.dev"
   ```

2. **Vapi Dashboard**
   - Webhook URL field

3. **Twilio Console**
   - Phone number webhooks (incoming, status callbacks)

4. **Google Cloud Console**
   - Authorized Redirect URIs

5. **backend/.env** (if using URL)
   ```bash
   GOOGLE_OAUTH_REDIRECT_URI="https://your-new-ngrok-url.ngrok-free.dev/api/auth/google/callback"
   ```

---

## 📞 Support Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/vapi` | POST | Vapi call webhooks |
| `/api/webhooks/twilio/sms` | POST | Twilio SMS webhooks |
| `/api/webhooks/twilio/voice` | POST | Twilio call webhooks |
| `/api/webhooks/twilio/status` | POST | Twilio status updates |
| `/api/auth/google/callback` | GET | Google OAuth callback |

---

## 🎯 Full URL Pattern

```
https://your-ngrok-url.ngrok-free.dev/api/webhooks/vapi
     └─ ngrok tunnel ────┘        └─ your endpoint ──┘
```

---

## 🔗 Links

- **Vapi Dashboard**: https://dashboard.vapi.ai
- **Twilio Console**: https://console.twilio.com
- **Google Cloud**: https://console.cloud.google.com
- **Supabase**: https://app.supabase.com
- **ngrok Status**: http://127.0.0.1:4040 (while running)

---

## ⏱️ Timing Checklist

- [ ] Backend starts: ~2 seconds
- [ ] Frontend starts: ~5 seconds
- [ ] ngrok connects: ~3 seconds
- [ ] Total startup time: ~10 seconds
- [ ] Webhook processing: <5 seconds response time
- [ ] ngrok free URL expires: After 2 hours of inactivity

---

**Tip:** Keep this guide open in a browser tab while developing!
