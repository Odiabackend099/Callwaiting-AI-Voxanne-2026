# 🔗 Vapi Webhook Configuration Guide

## ✅ All Servers Running

### Server Status
- **✅ Backend**: Running on http://localhost:3001
- **✅ Frontend**: Running on http://localhost:3000  
- **✅ Ngrok**: Active tunnel to backend

### Ngrok Public URL
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

---

## 📋 Vapi Webhook URLs

Configure these URLs in your Vapi assistant settings:

### Main Webhook (Call Events)
**Endpoint**: `/api/webhooks/vapi`
**Full URL**: 
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
```

**Purpose**: Receives Vapi call events (call.ended, call.started, etc.)
- Creates call logs in database
- Triggers recording processing
- Updates call status

### RAG Webhook (Knowledge Base Injection)
**Endpoint**: `/api/vapi/webhook`
**Full URL**:
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/webhook
```

**Purpose**: Injects knowledge base context before AI responses
- Searches knowledge base for relevant chunks
- Injects context into system prompt
- Provides accurate, contextualized responses

---

## 🚀 Configuration Methods

### Method 1: Via Vapi Dashboard (Recommended)

1. Go to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Select your assistant
3. Navigate to **Settings** → **Server** 
4. Set **Server URL** to:
   ```
   https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
   ```
5. Save changes

### Method 2: Via API (Programmatic)

**Option A: Use Backend Endpoint**
```bash
curl -X POST http://localhost:3001/api/vapi/setup/configure-webhook \
  -H "Content-Type: application/json"
```

**Option B: Direct Vapi API**
```bash
curl -X PATCH https://api.vapi.ai/assistant/YOUR_ASSISTANT_ID \
  -H "Authorization: Bearer YOUR_VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "server": {
      "url": "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi"
    }
  }'
```

### Method 3: Auto-Configuration

When you save Vapi API keys in the dashboard (`/dashboard/api-keys`), the system automatically configures the webhook if:
- `VAPI_API_KEY` is set in backend `.env`
- `VAPI_ASSISTANT_ID` is set in backend `.env`
- Backend endpoint `/api/vapi/setup/configure-webhook` is called

---

## 🔧 Backend Environment Variables

Make sure your `backend/.env` has:

```env
PORT=3001
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Vapi Configuration (required for webhooks)
VAPI_API_KEY=your_vapi_api_key_here
VAPI_ASSISTANT_ID=your_assistant_id_here
WEBHOOK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
VAPI_WEBHOOK_SECRET=your_webhook_secret_here

# Twilio Configuration (optional, for inbound calls)
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_token_here
```

---

## 📝 Webhook Events Handled

### Main Webhook (`/api/webhooks/vapi`)
- ✅ `call.started` - Call initiated
- ✅ `call.ended` - Call completed
- ✅ `transcript.created` - Transcript segment received
- ✅ `function-call` - Function call from AI
- ✅ `model-output` - AI model response

### RAG Webhook (`/api/vapi/webhook`)
- ✅ `message.created` - Before AI generates response
- ✅ Retrieves relevant KB chunks via vector search
- ✅ Injects context into system prompt

---

## 🧪 Testing Webhooks

### Test Main Webhook
```bash
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.ended",
    "call": {
      "id": "test-call-id",
      "status": "ended"
    }
  }'
```

### Test RAG Webhook
```bash
curl -X POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your pricing?",
    "assistantId": "your-assistant-id"
  }'
```

---

## ⚠️ Important Notes

1. **Ngrok URL Changes**: If ngrok restarts, the URL will change. Update Vapi configuration with new URL.

2. **Webhook Secret**: For production, set `VAPI_WEBHOOK_SECRET` in backend `.env` for signature verification.

3. **Local Development**: For local testing without ngrok, use `http://localhost:3001/api/webhooks/vapi` (Vapi must support localhost URLs).

4. **Firewall**: Ensure ngrok can reach your local backend on port 3001.

---

## 🐛 Troubleshooting

### Webhook Not Receiving Events
1. Check ngrok is running: http://127.0.0.1:4040
2. Verify backend is running: `curl http://localhost:3001/health`
3. Check Vapi assistant configuration has correct webhook URL
4. View ngrok logs: http://127.0.0.1:4040/inspect/http

### Webhook Signature Verification Failing
- Ensure `VAPI_WEBHOOK_SECRET` matches your Vapi dashboard settings
- Check webhook signature verification in `backend/src/routes/webhooks.ts`

### RAG Not Working
- Verify knowledge base has documents uploaded
- Check `/api/knowledge-base/search` endpoint works
- View backend logs: `tail -f logs/backend.log`

---

## 📚 Related Documentation

- [Server Status](./SERVERS_STATUS.md)
- [Start All Servers](./start-all-servers.sh)
- [Stop All Servers](./stop-all-servers.sh)

---

**Last Updated**: $(date)
**Ngrok URL**: https://sobriquetical-zofia-abysmally.ngrok-free.dev
