# Vapi Webhook Configuration

## Current Ngrok URL

**Your public webhook URL**:
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

## Webhook Endpoints

Your backend exposes two webhook endpoints for Vapi:

### Primary Webhook Endpoint (Recommended)
```
POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
```
- **Route**: `/api/webhooks/vapi`
- **Handler**: `backend/src/routes/webhooks.ts`
- **Features**: 
  - Full event handling (call_started, call_ended, etc.)
  - Signature verification
  - Recording processing
  - Transcript updates
  - WebSocket broadcasting

### Alternative Webhook Endpoint (RAG Context)
```
POST https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/webhook
```
- **Route**: `/api/vapi/webhook`
- **Handler**: `backend/src/routes/vapi-webhook.ts`
- **Features**:
  - RAG context retrieval
  - Message processing
  - Knowledge base search

## Vapi Dashboard Configuration

### Step 1: Get Your Ngrok URL
The ngrok URL is currently:
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev
```

**Note**: Ngrok free tier URLs change on each restart. Get the current URL:
```bash
curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[] | select(.proto=="https") | .public_url'
```

### Step 2: Configure in Vapi Dashboard

1. **Go to Vapi Dashboard** → Settings → Webhooks
2. **Set Webhook URL**:
   ```
   https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
   ```
3. **Enable Event Types**:
   - ✅ `call_started`
   - ✅ `call_ended`
   - ✅ `message`
   - ✅ `transcript`
   - ✅ `recording_ready`
   - ✅ All other events

### Step 3: Configure Webhook Secret (Optional but Recommended)

1. **Generate a webhook secret**:
   ```bash
   openssl rand -hex 32
   ```

2. **Set in Vapi Dashboard**:
   - Go to Settings → Webhooks
   - Paste the secret in "Webhook Secret" field

3. **Update your backend `.env`**:
   ```env
   VAPI_WEBHOOK_SECRET=your_secret_here
   ```
   Or save it in integration settings via `/api/founder-console/settings`

### Step 4: Verify Webhook

Test that your webhook is accessible:
```bash
curl https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'
```

## Webhook Signature Verification

The backend automatically verifies webhook signatures if:
- `VAPI_WEBHOOK_SECRET` is set in `.env`, OR
- `vapi_webhook_secret` is set in `integration_settings` table

**In development** (no secret set): Webhooks are accepted without verification.
**In production** (secret set): All webhooks MUST have valid signatures.

## Ngrok Dashboard

View your ngrok tunnel status:
- **Local Dashboard**: http://127.0.0.1:4040
- **Inspect requests**: http://127.0.0.1:4040/inspect/http

## Troubleshooting

### Webhook Not Receiving Events

1. **Check ngrok is running**:
   ```bash
   ps aux | grep ngrok | grep -v grep
   ```

2. **Verify ngrok URL**:
   ```bash
   curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'
   ```

3. **Check backend logs**:
   ```bash
   tail -f logs/backend.log | grep webhook
   ```

4. **Verify Vapi webhook URL**:
   - Go to Vapi Dashboard → Settings → Webhooks
   - Ensure URL matches current ngrok URL

### Webhook Signature Errors

If you see "Invalid webhook signature":
1. Verify `VAPI_WEBHOOK_SECRET` matches Vapi Dashboard
2. Or remove the secret (development only)
3. Check backend logs for detailed error messages

### Ngrok URL Changed

If ngrok restarts, the URL changes. You must:
1. Get new URL: `curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'`
2. Update Vapi Dashboard with new URL
3. Or use ngrok authtoken for persistent URLs (paid)

## Production Deployment

For production, use a persistent URL instead of ngrok:
- Use Render/Vercel/Netlify production URL
- Or ngrok paid tier with fixed domain
- Update `WEBHOOK_URL` environment variable

Example:
```env
WEBHOOK_URL=https://your-production-url.com/api/webhooks/vapi
```
