# Webhook Best Practices Guide

**For:** Voxanne AI Platform
**Last Updated:** 2026-01-25
**Scope:** Vapi, Twilio, and custom webhook implementations

---

## Table of Contents

1. [Architecture](#architecture)
2. [Security](#security)
3. [Reliability](#reliability)
4. [Monitoring](#monitoring)
5. [Common Patterns](#common-patterns)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

### The Webhook Lifecycle

```
External Service (Vapi/Twilio)
        ↓
   HTTP POST
        ↓
Backend Webhook Endpoint
        ↓
   ┌────────────────────────────────┐
   │  1. Verify Signature (1ms)     │
   │  2. Return 200 OK (5ms)        │
   │  3. Async Processing (2-30s)   │
   └────────────────────────────────┘
        ↓
   Update Database
        ↓
   Emit Events (SWR refresh)
        ↓
Frontend Updates in Real-time
```

### Why This Order?

1. **Verify Signature** - Ensure request is from trusted source
2. **Return 200 OK** - Tell external service we received it (prevents retries)
3. **Async Processing** - Do the actual work without blocking response
4. **Update DB** - Persist changes
5. **Emit Events** - Notify frontend via WebSocket/SWR

---

## Security

### 1. Signature Verification (CRITICAL)

Every webhook request includes a signature header. You MUST verify it.

#### Vapi Webhook Verification

```typescript
import crypto from 'crypto';

function verifyVapiSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
}

// In Express middleware
app.post('/api/webhooks/vapi', (req, res) => {
  const signature = req.headers['x-vapi-signature'] as string;
  const secret = process.env.VAPI_WEBHOOK_SECRET!;

  // Get raw body (IMPORTANT: Express json() parses it, you need raw)
  const rawBody = req.rawBody as string;

  if (!verifyVapiSignature(rawBody, signature, secret)) {
    log.error('webhook', 'Invalid signature', {
      ip: req.ip,
      signature: signature.substring(0, 10) + '...'
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Safe to process
  handleVapiWebhook(req.body);
  res.status(200).json({ status: 'received' });
});
```

#### Express Middleware for Raw Body

```typescript
// IMPORTANT: Express json() middleware consumes the body
// You need raw body for signature verification
import express from 'express';

const app = express();

// Capture raw body BEFORE json() middleware
app.use(express.raw({ type: 'application/json' }));

// Convert Buffer to string
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString('utf-8');
    req.body = JSON.parse(req.rawBody);
  }
  next();
});

// Now req.rawBody is available for signature verification
app.post('/api/webhooks/vapi', (req, res) => {
  const rawBody = req.rawBody; // ✅ Use this
  // ...
});
```

#### Twilio Webhook Verification

```typescript
import twilio from 'twilio';

function verifyTwilioSignature(
  url: string,
  params: Record<string, any>,
  signature: string
): boolean {
  const twilioSecret = process.env.TWILIO_AUTH_TOKEN!;

  const valid = twilio.webhook(twilioSecret, signature, url, params);
  return valid;
}

// In Express
app.post('/api/webhooks/twilio/sms', (req, res) => {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${process.env.BACKEND_URL}${req.originalUrl}`;

  if (!verifyTwilioSignature(url, req.body, signature)) {
    log.error('webhook', 'Invalid Twilio signature', {
      from: req.body.From
    });
    return res.status(401).send('Unauthorized');
  }

  handleTwilioSMS(req.body);
  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});
```

### 2. Input Validation

Always validate webhook data before processing:

```typescript
import { z } from 'zod';

const VapiWebhookSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['call.started', 'call.ended', 'tool.called']),
  data: z.object({
    callId: z.string().uuid(),
    assistantId: z.string().uuid(),
    // ... other fields
  })
});

app.post('/api/webhooks/vapi', async (req, res) => {
  try {
    const payload = VapiWebhookSchema.parse(req.body);
    // ✅ Type-safe from here on
    handleVapiEvent(payload);
  } catch (error) {
    log.error('webhook', 'Invalid payload', { error: error.message });
    return res.status(400).json({ error: 'Invalid payload' });
  }

  res.status(200).json({ status: 'received' });
});
```

### 3. IP Whitelisting (Optional but Recommended)

```typescript
const VAPI_IPS = ['1.2.3.4', '5.6.7.8']; // From Vapi docs
const TWILIO_IPS = ['3.208.0.0/12', ...]; // CIDR ranges from Twilio

function isAllowedIP(ip: string, allowedIPs: string[]): boolean {
  // Implement CIDR matching for production
  return allowedIPs.includes(ip);
}

app.post('/api/webhooks/vapi', (req, res) => {
  if (!isAllowedIP(req.ip!, VAPI_IPS)) {
    log.warn('webhook', 'Unauthorized IP', { ip: req.ip });
    return res.status(403).send('Forbidden');
  }
  // ...
});
```

---

## Reliability

### 1. Immediate Response (CRITICAL)

External services expect a response within 5-30 seconds. If not, they mark it as failed and may retry.

```typescript
// ✅ CORRECT
app.post('/api/webhooks/vapi', async (req, res) => {
  // Respond immediately
  res.status(200).json({ status: 'received' });

  // Then process async (fire-and-forget)
  processVapiEvent(req.body).catch(err => {
    log.error('webhook_processing_failed', err);
  });
});

// ❌ WRONG - Will timeout!
app.post('/api/webhooks/vapi', async (req, res) => {
  // Vapi waits for this to complete
  await processVapiEvent(req.body);

  // Response sent after 10+ seconds = timeout
  res.status(200).json({ status: 'processed' });
});
```

### 2. Idempotency (Handle Duplicate Events)

External services may retry webhooks. Always detect and skip duplicates:

```typescript
async function processVapiEvent(payload: any) {
  const eventId = payload.eventId;

  // Check if already processed
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id, processed_at')
    .eq('external_event_id', eventId)
    .eq('service', 'vapi')
    .single();

  if (existing) {
    log.info('webhook', 'Event already processed', {
      eventId,
      processedAt: existing.processed_at
    });
    return; // Skip duplicate
  }

  try {
    // Process event
    await handleVapiCallEnded(payload.data);

    // Mark as processed
    await supabase
      .from('webhook_events')
      .insert({
        external_event_id: eventId,
        service: 'vapi',
        event_type: payload.type,
        processed_at: new Date().toISOString()
      });

    log.info('webhook', 'Event processed', { eventId });

  } catch (error) {
    log.error('webhook', 'Processing failed', {
      eventId,
      error: error.message
    });
    // Don't rethrow - webhook already returned 200
  }
}
```

### 3. Timeout Handling

```typescript
async function processWithTimeout(
  fn: () => Promise<void>,
  timeoutMs: number = 30000
): Promise<void> {
  return Promise.race([
    fn(),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

app.post('/api/webhooks/vapi', async (req, res) => {
  res.status(200).json({ status: 'received' });

  processWithTimeout(
    () => processVapiEvent(req.body),
    25000 // 25s timeout (leave 5s buffer for response)
  ).catch(err => {
    log.error('webhook', 'Processing timeout/error', {
      error: err.message
    });
  });
});
```

### 4. Retry Logic for Downstream Operations

When calling external services from webhook handler:

```typescript
async function callTwilioWithRetry(
  phoneNumber: string,
  message: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await twilio.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
        body: message
      });

      log.info('sms', 'Sent successfully', {
        sid: result.sid,
        attempt
      });

      return result.sid;

    } catch (error) {
      lastError = error;
      const backoffMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff

      if (attempt < maxRetries) {
        log.warn('sms', 'Retry attempt', {
          attempt,
          nextRetryIn: backoffMs,
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  log.error('sms', 'All retries failed', {
    error: lastError.message,
    attempts: maxRetries
  });

  throw lastError;
}
```

---

## Monitoring

### 1. Comprehensive Logging

```typescript
const log = {
  info: (service: string, message: string, metadata: any = {}) => {
    console.log(JSON.stringify({
      level: 'INFO',
      service,
      message,
      timestamp: new Date().toISOString(),
      ...metadata
    }));
  },

  error: (service: string, message: string, metadata: any = {}) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      service,
      message,
      timestamp: new Date().toISOString(),
      ...metadata
    }));
  }
};

// Usage in webhook handler
app.post('/api/webhooks/vapi', async (req, res) => {
  const startTime = Date.now();
  const eventId = req.body.eventId;

  log.info('webhook', 'Received vapi webhook', {
    eventId,
    type: req.body.type,
    ip: req.ip
  });

  res.status(200).json({ status: 'received' });

  processVapiEvent(req.body)
    .then(() => {
      const duration = Date.now() - startTime;
      log.info('webhook', 'Processed successfully', {
        eventId,
        duration
      });
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      log.error('webhook', 'Processing failed', {
        eventId,
        duration,
        error: error.message,
        stack: error.stack
      });
    });
});
```

### 2. Webhook Event Tracking

```typescript
// Create a webhook_events table for auditing
const { error } = await supabase
  .from('webhook_events')
  .insert({
    id: crypto.randomUUID(),
    service: 'vapi',
    external_event_id: payload.eventId,
    event_type: payload.type,
    status: 'received',
    received_at: new Date().toISOString(),
    request_body: payload,
    ip_address: req.ip,
    org_id: null // Set if you can identify org from payload
  });

// Later, update status
await supabase
  .from('webhook_events')
  .update({
    status: 'processed',
    processed_at: new Date().toISOString(),
    response_data: result
  })
  .eq('external_event_id', payload.eventId);
```

### 3. Alert on Webhook Failures

```typescript
async function alertOnWebhookFailure(
  eventId: string,
  error: Error,
  service: string
) {
  // Send Slack notification
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `⚠️ ${service.toUpperCase()} Webhook Failed`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Event ID:* ${eventId}\n*Service:* ${service}\n*Error:* ${error.message}`
          }
        }
      ]
    })
  });

  // Send email to ops
  await sendEmail({
    to: process.env.OPS_EMAIL,
    subject: `⚠️ ${service} webhook failed: ${eventId}`,
    body: `${error.message}\n\n${error.stack}`
  });
}
```

---

## Common Patterns

### Pattern 1: Call Webhook Handler

```typescript
// Handle call started event
async function handleCallStarted(data: any) {
  const { callId, assistantId, phoneNumber } = data;

  // Create call record in DB
  const { data: call } = await supabase
    .from('call_logs')
    .insert({
      id: callId,
      vapi_assistant_id: assistantId,
      phone_number: phoneNumber,
      status: 'ringing',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  // Notify frontend via SWR
  await notifyFrontend({
    org_id: call.org_id,
    event: 'call_started',
    data: call
  });

  log.info('call', 'Call started', { callId });
}

// Handle call ended event
async function handleCallEnded(data: any) {
  const { callId, duration, transcript, recording } = data;

  // Update call record
  await supabase
    .from('call_logs')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration,
      transcript,
      has_recording: !!recording,
      recording_url: recording?.url
    })
    .eq('id', callId);

  // Analyze call (sentiment, booking, etc.)
  const { sentiment, booking } = await analyzecall(transcript);

  // Update with analytics
  await supabase
    .from('call_logs')
    .update({
      sentiment_score: sentiment.score,
      booking_confirmed: booking?.confirmed
    })
    .eq('id', callId);

  log.info('call', 'Call completed', { callId, duration });
}
```

### Pattern 2: Message Webhook Handler

```typescript
async function handleTwilioIncomingSMS(data: any) {
  const { From: phoneNumber, Body: message, MessageSid: sid } = data;

  // Find contact by phone
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, org_id')
    .eq('phone_number', phoneNumber)
    .single();

  if (!contact) {
    log.warn('sms', 'Contact not found', { phoneNumber });
    return;
  }

  // Log message
  await supabase
    .from('messages')
    .insert({
      org_id: contact.org_id,
      contact_id: contact.id,
      direction: 'inbound',
      method: 'sms',
      recipient: phoneNumber,
      content: message,
      service_provider: 'twilio',
      external_message_id: sid,
      status: 'received',
      received_at: new Date().toISOString()
    });

  // Process message (trigger follow-up, etc.)
  await processIncomingMessage(contact.id, message);

  log.info('sms', 'Incoming message', {
    contactId: contact.id,
    from: phoneNumber
  });
}
```

### Pattern 3: Tool Call Webhook Handler

```typescript
async function handleToolCall(data: any) {
  const { callId, toolName, arguments: toolArgs } = data;

  // Find call and organization
  const { data: call } = await supabase
    .from('call_logs')
    .select('org_id')
    .eq('id', callId)
    .single();

  // Process based on tool name
  switch (toolName) {
    case 'bookAppointment':
      return await handleBookAppointment(
        call.org_id,
        callId,
        toolArgs
      );

    case 'getAvailability':
      return await handleGetAvailability(
        call.org_id,
        toolArgs
      );

    default:
      log.warn('webhook', 'Unknown tool', { toolName });
  }
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Webhook Signature Verification', () => {
  it('should accept valid signature', () => {
    const body = '{"eventId":"123"}';
    const secret = 'test-secret';

    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    expect(verifyVapiSignature(body, hash, secret)).toBe(true);
  });

  it('should reject invalid signature', () => {
    const body = '{"eventId":"123"}';
    const secret = 'test-secret';
    const invalidSignature = 'invalid-hash';

    expect(verifyVapiSignature(body, invalidSignature, secret)).toBe(false);
  });

  it('should handle missing signature', () => {
    expect(() => {
      verifyVapiSignature('body', undefined as any, 'secret');
    }).toThrow();
  });
});
```

### Integration Test Example

```typescript
describe('Vapi Webhook Integration', () => {
  it('should process call started event', async () => {
    const response = await request(app)
      .post('/api/webhooks/vapi')
      .set('x-vapi-signature', validSignature)
      .send({
        eventId: 'test-event-123',
        type: 'call.started',
        data: {
          callId: 'call-123',
          assistantId: 'assistant-123',
          phoneNumber: '+1234567890'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');

    // Give async processing time
    await new Promise(r => setTimeout(r, 100));

    // Verify database record created
    const { data: call } = await supabase
      .from('call_logs')
      .select('*')
      .eq('id', 'call-123')
      .single();

    expect(call).toBeDefined();
    expect(call.status).toBe('ringing');
  });
});
```

---

## Troubleshooting

### Issue: Webhook Returns 500 Error

**Symptoms:**
- External service shows failed delivery
- Logs show error in webhook handler

**Debug Steps:**
```bash
# 1. Check logs
tail -f backend/logs/webhook.log | grep "500\|error"

# 2. Check database
SELECT * FROM webhook_events WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5;

# 3. Test signature verification
# Temporarily remove signature check (dev only!)
if (process.env.NODE_ENV !== 'production') {
  // Skip verification in dev
} else {
  if (!verifySignature(...)) return res.status(401);
}

# 4. Check external service logs
# Vapi: https://dashboard.vapi.ai/calls
# Twilio: https://console.twilio.com/logs
```

### Issue: Webhook Timeout (Vapi retries multiple times)

**Symptoms:**
- Webhook takes >30 seconds
- External service retries 3-5 times
- Database has duplicate events

**Solutions:**
```typescript
// Identify slow operations
const startTime = Date.now();

// This is slow - move to async
await expensiveDatabase Operation();

const duration = Date.now() - startTime;
if (duration > 5000) {
  log.warn('webhook', 'Slow operation', {
    operation: 'expensiveDatabaseOperation',
    duration
  });
}

// Instead, do:
res.status(200).send('OK');
expensiveDatabaseOperation().catch(err => {
  log.error('async_operation_failed', err);
});
```

### Issue: Webhook Signature Invalid

**Symptoms:**
- 401 Unauthorized responses
- Logs show "Invalid signature"

**Solutions:**
```bash
# 1. Check secret is correct
echo $VAPI_WEBHOOK_SECRET
echo $TWILIO_AUTH_TOKEN

# 2. Verify you're using raw body
# (See "Express Middleware for Raw Body" section above)

# 3. Check signature header name
# Vapi: x-vapi-signature
# Twilio: x-twilio-signature

# 4. Log signature for debugging (dev only)
log.info('webhook', 'Signature debug', {
  received: signature.substring(0, 10),
  calculated: hash.substring(0, 10),
  match: signature === hash
});
```

### Issue: Frontend Not Updating

**Symptoms:**
- Webhook processes successfully
- Database updated correctly
- Frontend doesn't reflect changes

**Solutions:**
```typescript
// 1. Emit event for frontend
await emitWebhookEvent({
  org_id: call.org_id,
  event: 'call_started',
  data: call
});

// 2. Invalidate SWR cache
// Frontend code
const { data, mutate } = useSWR(
  `/api/calls/${callId}`,
  fetcher,
  { revalidateOnFocus: true }
);

// After webhook, SWR auto-revalidates if:
// - User focuses tab
// - Interval polling enabled
// - Manual mutate() called

// 3. Check WebSocket connection
// If using real-time updates:
const connected = ws.readyState === WebSocket.OPEN;
console.log('WebSocket connected:', connected);
```

---

## Checklist for New Webhook Endpoint

- [ ] Create `/api/webhooks/{service}` endpoint
- [ ] Implement signature verification
- [ ] Validate input with Zod schema
- [ ] Return 200 immediately
- [ ] Process async (fire-and-forget)
- [ ] Check for duplicate events (idempotency)
- [ ] Log webhook receipt and processing
- [ ] Update database records
- [ ] Notify frontend (WebSocket/SWR)
- [ ] Handle errors gracefully
- [ ] Add comprehensive logging
- [ ] Test with ngrok web interface
- [ ] Test with curl/Postman
- [ ] Test with real external service
- [ ] Monitor in production

---

**Last Updated:** 2026-01-25
**Status:** Complete Webhook Best Practices Guide
