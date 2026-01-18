# VAPI Webhook Configuration Guide

## Overview

The VAPI webhook system is the backbone of call event processing, knowledge base integration, and real-time updates. This guide explains how it's configured, what events it handles, and how to verify it's working.

---

## 🔧 Automatic Configuration

When you run the startup orchestration script, the webhook is automatically configured:

```bash
cd backend
npm run startup
```

This script:
1. Creates ngrok public URL: `https://xxxx-xxxx.ngrok.io`
2. Starts backend server with `BACKEND_URL` set to ngrok URL
3. Calls webhook configurator to update VAPI assistant
4. Sets webhook URL to: `{ngrokUrl}/api/webhooks/vapi`
5. Enables recording for all calls
6. Configures RAG knowledge base integration

---

## 🎯 What the Webhook Does

### Webhook Routes

**Route 1: Main Event Webhook** (`POST /api/webhooks/vapi`)
- Receives all call lifecycle events from VAPI
- Validates org ownership (multi-tenant safety)
- Verifies webhook signature
- Processes events with idempotency tracking
- Broadcasts to UI via WebSocket

**Route 2: RAG Context Injection** (`POST /api/vapi/webhook`)
- Receives assistant request events
- Queries knowledge base with embeddings
- Injects relevant context into assistant system prompt
- Returns enhanced assistant instructions

**Route 3: Health Check** (`GET /api/vapi/webhook/health`)
- Status: `{"status": "ok", "timestamp": "..."}`
- Used to verify webhook is accessible

### Event Types Handled

| Event | Trigger | Action |
|-------|---------|--------|
| `call.started` | Call begins | Log start time, initialize call session |
| `call.ended` | Call ends | Update call duration, trigger cleanup |
| `call.transcribed` | Speech captured | Store transcription, trigger RAG search |
| `end-of-call-report` | Call complete | Aggregate metrics, update call record |
| `function-call` | Assistant invokes function | Execute booking, SMS, data actions |

---

## 🔐 Security Features

### Signature Verification

Every webhook request is signed using HMAC-SHA256:

```
Signature Header: x-vapi-signature
Format: v1,<hex-signature>
Algorithm: SHA256(${timestamp}.${body}, secret)
Verification: Timing-safe comparison
```

**Secret Source:**
- Per-org in database (`integrations` table)
- Stored encrypted using `ENCRYPTION_KEY`
- Fetched per request for verification

### Multi-Tenant Isolation

```typescript
// Each webhook request includes org_id
// 1. Resolve org from webhook payload
// 2. Fetch org-specific webhook secret
// 3. Verify signature with org secret
// 4. All processing scoped to org
// 5. No cross-tenant data access
```

### Idempotency Tracking

Prevents duplicate event processing:

```typescript
// Table: processed_webhook_events
// Tracks: (event_id, event_type, org_id, created_at)
// Logic: Skip if event_id already processed in last 24 hours
// Prevents: Double booking, duplicate SMS, etc.
```

---

## 📊 Knowledge Base Integration (RAG)

### RAG Workflow

```
1. Call received by VAPI
2. User speaks query
3. VAPI triggers assistant.request webhook
4. Backend receives request:
   ├─ Extracts query from prompt
   ├─ Generates embeddings (OpenAI)
   ├─ Searches knowledge base
   ├─ Retrieves top 5 chunks (similarity > 0.65)
   ├─ Injects into system prompt
   └─ Returns enhanced instructions to VAPI
5. Assistant continues with knowledge context
```

### Configuration

```typescript
// In webhook handler
const RAG_CONFIG = {
  enabled: true,
  similarityThreshold: 0.65,
  maxChunks: 5,
  timeoutMs: 5000  // Graceful degradation if slow
};

// Timeout behavior
if (ragQuery.duration > 5000) {
  // Proceed without KB context (don't block call)
  useKnowledgeBase = false;
}
```

### Knowledge Base Sources

- Custom company documents (uploaded by clinic)
- FAQ pages
- Product information
- Pricing details
- Service procedures

---

## 🚀 Getting Started

### Prerequisites

```bash
# 1. Ensure backend/.env has:
VAPI_API_KEY=your-key
VAPI_ASSISTANT_ID=your-assistant-id
VAPI_WEBHOOK_SECRET=your-secret (optional, generated if missing)
BACKEND_URL=http://localhost:3001 (set automatically by startup script)
```

### Manual Configuration

If you need to configure the webhook manually:

```bash
# 1. Export variables
export VAPI_API_KEY="your-key"
export VAPI_ASSISTANT_ID="your-assistant-id"

# 2. Call configurator
cd backend
npm run startup

# OR configure specific assistant
ts-node scripts/configure-vapi-webhook.ts
```

### Programmatic Configuration

```typescript
import { configureVapiWebhook } from './services/vapi-webhook-configurator';

const result = await configureVapiWebhook(
  process.env.VAPI_API_KEY,
  process.env.VAPI_ASSISTANT_ID
);

if (result.success) {
  console.log('Webhook configured:', result.message);
}
```

---

## ✅ Verification

### Quick Verification

```bash
# Test webhook is accessible and responding
curl https://xxxx-xxxx-xxxx.ngrok.io/api/vapi/webhook/health

# Expected response:
# {"status":"ok","timestamp":"2026-01-17T..."}
```

### Comprehensive Verification

```bash
cd backend

# Run verification suite
npm run verify:webhook

# This tests:
# ✅ Backend accessibility
# ✅ Webhook health check
# ✅ Webhook endpoint
# ✅ RAG webhook
# ✅ Signature verification
# ✅ Event types
# ✅ Multi-tenant isolation
# ✅ Configuration status
```

### Manual Testing

```bash
# 1. Test webhook accepts POST
curl -X POST https://xxxx-xxxx-xxxx.ngrok.io/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type":"test",
    "timestamp":"2026-01-17T10:00:00Z",
    "orgId":"test-org"
  }'

# 2. Expected response: 202 Accepted or 422 Unprocessable (validation error)

# 3. Check ngrok dashboard for request
open http://localhost:4040
```

---

## 🔍 Monitoring

### Log Locations

**Backend logs (terminal running startup):**
- Look for webhook configuration messages
- Contains webhook signature verification status
- Shows event processing details

**ngrok Dashboard** (`http://localhost:4040`):
- All webhook requests/responses
- Request headers and body
- Response status codes
- Latency measurements

### Key Log Messages

```
// Successful webhook configuration
✓ Vapi webhook configured successfully

// Webhook received
[Webhook] Received event: call.started from VAPI

// Signature verified
[Webhook] Signature verification passed for org: clinic-123

// Event processed
[Webhook] Processing call.started (idempotency check: OK)

// RAG context injected
[RAG] Injected 3 knowledge base chunks (similarity: 0.72)
```

---

## 🚨 Troubleshooting

### Webhook Not Receiving Events

**Problem:** Webhook configured but no events arriving

**Solution:**
1. Verify ngrok tunnel is active
   ```bash
   curl https://xxxx-xxxx-xxxx.ngrok.io/api/vapi/webhook/health
   ```

2. Check VAPI dashboard has correct webhook URL
   - Should match: `{ngrokUrl}/api/webhooks/vapi`

3. Verify webhook URL doesn't include `/health`
   - Correct: `https://xxxx-xxxx.ngrok.io/api/webhooks/vapi`
   - Wrong: `https://xxxx-xxxx.ngrok.io/api/webhooks/vapi/health`

4. Check ngrok tunnel is not restarted
   - Each restart changes public URL
   - Must update VAPI dashboard if tunnel restarts

### Signature Verification Failing

**Problem:** `401 Unauthorized` responses

**Solution:**
1. Verify `VAPI_WEBHOOK_SECRET` is set
   ```bash
   cat backend/.env | grep VAPI_WEBHOOK_SECRET
   ```

2. Ensure secret matches VAPI dashboard
3. If in multi-tenant mode, secret comes from database, not `.env`

### RAG Context Not Injecting

**Problem:** Knowledge base chunks not appearing in calls

**Solution:**
1. Verify `OPENAI_API_KEY` is set (required for embeddings)
2. Check knowledge base has documents uploaded
3. Test with lower similarity threshold (try 0.5 instead of 0.65)
4. Check ngrok logs for timeout errors (RAG timeouts gracefully)

### Events Processing Slowly

**Problem:** Delayed event processing, call delays

**Solution:**
1. Check webhook signature verification (adds ~10ms)
2. Verify RAG query doesn't timeout (5sec limit with graceful degradation)
3. Monitor database query performance
4. Check network latency to backend

---

## 📋 Event Processing Flow

```
┌─────────────────────────────────────────┐
│   VAPI Makes Call (Phone or Web)       │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Call Lifecycle Events Generated       │
└──────────────┬──────────────────────────┘
               │ (e.g., call.started)
               ↓
┌─────────────────────────────────────────┐
│   VAPI Sends Webhook to Backend         │
│   POST /api/webhooks/vapi              │
│   Headers: x-vapi-signature             │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   1. Verify Webhook Signature           │
│   2. Resolve Organization (org_id)      │
│   3. Check Idempotency (duplicate?)     │
└──────────────┬──────────────────────────┘
               │ (if new event)
               ↓
┌─────────────────────────────────────────┐
│   Process Event Based on Type           │
│   ├─ call.started: Initialize           │
│   ├─ call.transcribed: Extract text     │
│   ├─ function-call: Execute action      │
│   └─ end-of-call-report: Finalize       │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Trigger Actions (if applicable)       │
│   ├─ Update database                    │
│   ├─ Send SMS                           │
│   ├─ Book appointment                   │
│   └─ Analyze sentiment                  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Broadcast to UI (WebSocket)           │
│   Real-time call dashboard update       │
└─────────────────────────────────────────┘
```

---

## 🔄 RAG Context Injection Flow

```
┌──────────────────────────────────────┐
│   VAPI User Asks Question            │
│   "What's your pricing?"             │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│   VAPI Triggers assistant.request    │
│   POST /api/vapi/webhook             │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│   1. Extract Question Text           │
│   2. Generate Embeddings (OpenAI)    │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│   Search Knowledge Base              │
│   ├─ Query embeddings table          │
│   ├─ Similarity search (> 0.65)      │
│   └─ Retrieve top 5 chunks           │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│   Build Enhanced System Prompt       │
│   Original prompt +                  │
│   "Here is relevant info:            │
│    [chunk 1]                         │
│    [chunk 2]                         │
│    [chunk 3]"                        │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│   Return to VAPI                     │
│   Assistant uses enhanced prompt     │
│   Response: "Based on our docs..."   │
└──────────────────────────────────────┘
```

---

## 🎯 Best Practices

1. **Always use the startup script**
   - Automatically configures everything
   - Sets correct URLs
   - Handles environment setup

2. **Monitor ngrok dashboard**
   - View all webhook traffic
   - Debug failed requests
   - Check response times

3. **Test with curl**
   - Verify endpoint accessibility
   - Test signature generation
   - Debug connection issues

4. **Enable debug logging**
   - Set `DEBUG_VAPI=true` in `.env`
   - Shows detailed webhook processing
   - Helps troubleshoot issues

5. **Keep secrets secure**
   - Use environment variables
   - Never hardcode secrets
   - Rotate secrets regularly

---

## 📚 Related Documentation

- `STARTUP_GUIDE.md` - How to start everything
- `STARTUP_QUICK_REFERENCE.md` - Quick commands
- `ENVIRONMENT_README.md` - Environment variables
- `INFRASTRUCTURE_AUDIT_SUMMARY.md` - System architecture

---

## 🆘 Getting Help

If webhook issues persist:

1. Check ngrok dashboard for request details
2. Review backend logs in terminal
3. Verify all environment variables set
4. Test health endpoint: `curl https://xxxx-xxxx.ngrok.io/api/vapi/webhook/health`
5. Run verification suite: `npm run verify:webhook`

---

**Your webhook is now fully configured and ready to process VAPI events!**
