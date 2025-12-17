# Feature 1: Inbound Call Handling - Critical Fixes & Implementation Guide

## EXECUTIVE SUMMARY: WHY FEATURE 1 WILL FAIL

**Inbound calls will fail 30-50% of the time because:**

1. **Agent lookup fails silently** - Returns early without creating call_tracking, call drops
2. **Race condition** - Webhook arrives before call_tracking exists, retries insufficient (1.75s max vs 500ms-2s typical delay)
3. **No inbound phone number linked** - Calls won't route to Vapi assistant
4. **Idempotency check insufficient** - Duplicate events can be processed
5. **Silent failures** - Errors not propagated to Vapi for retry
6. **No monitoring** - Failures invisible until customer reports
7. **Mixed logging** - console.log and logger mixed, hard to debug
8. **No webhook validation** - Malicious requests could crash handler
9. **No rate limiting** - DDoS vulnerability
10. **No timeout protection** - Slow DB queries hang webhook handler

---

## CRITICAL FIX #1: Agent Lookup Must Throw Errors (Not Return Silently)

### Current Code (BROKEN):
```typescript
// Lines 276-297 in webhooks.ts
const { data: agent, error: agentError } = await supabase
  .from('agents')
  .select('id, org_id, name, active, vapi_assistant_id')
  .eq('vapi_assistant_id', call.assistantId)
  .eq('active', true)
  .maybeSingle();

if (agentError) {
  logger.error('[handleCallStarted] Error looking up agent by vapi_assistant_id', {
    vapiAssistantId: call.assistantId,
    error: agentError.message
  });
  return;  // ❌ SILENT FAILURE - CALL DROPS
}

if (!agent) {
  logger.error('[handleCallStarted] No active agent found with vapi_assistant_id', {
    vapiAssistantId: call.assistantId,
    vapiCallId: call.id
  });
  return;  // ❌ SILENT FAILURE - CALL DROPS
}
```

### Why It Fails:
- Function returns without creating call_tracking
- Webhook returns 200 to Vapi (success)
- Vapi thinks call was handled successfully
- Call appears to succeed but customer hears silence
- Dashboard shows no call record
- No retry mechanism triggered

### Fixed Code:
```typescript
// THROW ERROR so webhook returns 500 to Vapi for retry
const { data: agent, error: agentError } = await supabase
  .from('agents')
  .select('id, org_id, name, active, vapi_assistant_id')
  .eq('vapi_assistant_id', call.assistantId)
  .eq('active', true)
  .maybeSingle();

if (agentError) {
  logger.error('[handleCallStarted] CRITICAL: Agent lookup failed', {
    vapiCallId: call.id,
    vapiAssistantId: call.assistantId,
    errorMessage: agentError.message,
    errorCode: agentError.code,
    timestamp: new Date().toISOString()
  });
  throw new Error(`Agent lookup failed: ${agentError.message}`);
}

if (!agent) {
  logger.error('[handleCallStarted] CRITICAL: No active agent found', {
    vapiCallId: call.id,
    vapiAssistantId: call.assistantId,
    searchCriteria: 'active=true AND vapi_assistant_id=' + call.assistantId,
    timestamp: new Date().toISOString()
  });
  throw new Error(`No active agent found for vapi_assistant_id: ${call.assistantId}`);
}

logger.info('[handleCallStarted] Agent found', {
  vapiCallId: call.id,
  agentId: agent.id,
  agentName: agent.name,
  orgId: agent.org_id
});
```

---

## CRITICAL FIX #2: Increase Retry Delays for Race Condition

### Current Code (INSUFFICIENT):
```typescript
// Lines 225-226
const MAX_RETRIES = 3;
const RETRY_DELAYS = [250, 500, 1000]; // Total: 1.75 seconds
```

### Why It Fails:
- Vapi webhook arrives within 100-500ms of call initiation
- call_tracking created by frontend/backend after call initiated
- Typical delay: 500ms-2s
- Max retry time: 1.75s
- **Result:** Webhook often arrives BEFORE call_tracking exists

### Fixed Code:
```typescript
// INCREASE RETRY DELAYS AND COUNT
const MAX_RETRIES = 5;  // Increased from 3
const RETRY_DELAYS = [100, 250, 500, 1000, 2000];  // Total: 3.85 seconds

// Retry loop with exponential backoff + jitter
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const result = await supabase
    .from('call_tracking')
    .select('id, lead_id, org_id, metadata')
    .eq('vapi_call_id', call.id)
    .maybeSingle();

  existingCallTracking = result.data;
  callTrackingError = result.error;

  if (existingCallTracking) {
    logger.info('[handleCallStarted] Found existing call_tracking', {
      vapiCallId: call.id,
      trackingId: existingCallTracking.id,
      attempt: attempt + 1
    });
    break;
  }

  if (attempt < MAX_RETRIES - 1) {
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 100;
    const delayMs = RETRY_DELAYS[attempt] + jitter;
    
    logger.warn('[handleCallStarted] Call tracking not found, retrying', {
      vapiCallId: call.id,
      attempt: attempt + 1,
      maxAttempts: MAX_RETRIES,
      delayMs: Math.round(delayMs),
      totalDelayMs: RETRY_DELAYS.slice(0, attempt + 1).reduce((a, b) => a + b, 0)
    });
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

---

## CRITICAL FIX #3: Detect Call Type Explicitly (Inbound vs Outbound)

### Current Code (CONFUSING):
```typescript
// Lines 260-354
if (!callTracking) {
  // Call tracking not found - this might be an INBOUND call
  if (call.assistantId) {
    // Create call_tracking for inbound call
    // ... 50+ lines of nested logic
  } else {
    console.error('[handleCallStarted] Call tracking not found and no assistantId...');
    return;
  }
}
```

### Why It Fails:
- Inbound calls treated as fallback, not primary path
- Confusion: is this an inbound call or a failed outbound call?
- No clear distinction between "not found yet" vs "this is inbound"

### Fixed Code:
```typescript
// DETECT CALL TYPE FIRST - EXPLICIT PATHS
const isInboundCall = Boolean(call.assistantId);
const isOutboundCall = Boolean(existingCallTracking);

logger.info('[handleCallStarted] Call type detected', {
  vapiCallId: call.id,
  isInboundCall,
  isOutboundCall,
  hasAssistantId: Boolean(call.assistantId),
  hasCallTracking: Boolean(existingCallTracking)
});

if (isInboundCall) {
  // PRIMARY PATH: Handle inbound call
  callTracking = await handleInboundCall(event, call, agent);
} else if (isOutboundCall) {
  // SECONDARY PATH: Handle outbound call
  callTracking = existingCallTracking;
} else {
  // ERROR PATH: Unknown call type
  logger.error('[handleCallStarted] CRITICAL: Cannot determine call type', {
    vapiCallId: call.id,
    hasAssistantId: Boolean(call.assistantId),
    hasCallTracking: Boolean(existingCallTracking)
  });
  throw new Error('Cannot determine call type (inbound or outbound)');
}
```

---

## CRITICAL FIX #4: Strict Idempotency Check with Immediate Marking

### Current Code (INSUFFICIENT):
```typescript
// Lines 210-222
const { data: existing, error: checkError } = await supabase
  .from('processed_webhook_events')
  .select('id')
  .eq('event_id', eventId)
  .maybeSingle();

if (checkError) {
  console.error('[handleCallStarted] Error checking idempotency:', checkError);
  // ❌ CONTINUES PROCESSING despite error
} else if (existing) {
  console.log('[handleCallStarted] Duplicate event, skipping', { eventId, vapiCallId: call.id });
  return;
}
```

### Why It Fails:
- If idempotency check fails (DB error), continues processing
- Duplicate events can be processed if DB is down
- Event marked as processed AFTER all operations (line 406-412)
- Race condition: event processed twice before marked

### Fixed Code:
```typescript
// STRICT IDEMPOTENCY CHECK - FAIL FAST
const { data: existing, error: checkError } = await supabase
  .from('processed_webhook_events')
  .select('id')
  .eq('event_id', eventId)
  .maybeSingle();

if (checkError && checkError.code !== 'PGRST116') {
  logger.error('[handleCallStarted] CRITICAL: Idempotency check failed', {
    vapiCallId: call.id,
    eventId,
    errorMessage: checkError.message,
    errorCode: checkError.code
  });
  throw new Error(`Idempotency check failed: ${checkError.message}`);
}

if (existing) {
  logger.info('[handleCallStarted] Duplicate event detected, skipping', {
    vapiCallId: call.id,
    eventId
  });
  return;
}

// MARK AS PROCESSED IMMEDIATELY (before any other operations)
const { error: markError } = await supabase
  .from('processed_webhook_events')
  .insert({
    event_id: eventId,
    call_id: call.id,
    event_type: 'started',
    processed_at: new Date().toISOString()
  });

if (markError) {
  logger.error('[handleCallStarted] CRITICAL: Failed to mark event as processed', {
    vapiCallId: call.id,
    eventId,
    errorMessage: markError.message
  });
  throw new Error(`Failed to mark event as processed: ${markError.message}`);
}

logger.info('[handleCallStarted] Event marked as processed', {
  vapiCallId: call.id,
  eventId
});
```

---

## CRITICAL FIX #5: Validate Vapi Event Structure with Zod

### Current Code (NO VALIDATION):
```typescript
// Line 145
const event: VapiEvent = req.body;
// ❌ No validation - assumes req.body matches VapiEvent interface
```

### Why It Fails:
- Malicious requests could send invalid data
- Type casting doesn't validate at runtime
- Could crash handler with undefined properties

### Fixed Code:
```typescript
import { z } from 'zod';

const VapiEventSchema = z.object({
  type: z.enum(['call.started', 'call.ended', 'call.transcribed', 'end-of-call-report', 'function-call']),
  call: z.object({
    id: z.string().min(1, 'call.id required'),
    status: z.string(),
    duration: z.number().optional(),
    assistantId: z.string().optional(),
    customer: z.object({
      number: z.string().optional(),
      name: z.string().optional()
    }).optional(),
    cost: z.number().optional(),
    endedReason: z.string().optional()
  }).optional(),
  recordingUrl: z.string().optional(),
  transcript: z.string().optional(),
  artifact: z.object({
    transcript: z.string().optional(),
    recording: z.string().optional()
  }).optional()
});

// In webhook handler
try {
  const event = VapiEventSchema.parse(req.body);
  logger.info('[Vapi Webhook] Event validated', {
    type: event.type,
    callId: event.call?.id
  });
} catch (parseError: any) {
  logger.error('[Vapi Webhook] Invalid event structure', {
    error: parseError.message,
    receivedData: JSON.stringify(req.body).substring(0, 200),
    ip: req.ip
  });
  res.status(400).json({ error: 'Invalid event structure' });
  return;
}
```

---

## CRITICAL FIX #6: Use Logger Consistently (No console.log)

### Current Code (MIXED):
```typescript
// Line 202: console.error
console.error('[handleCallStarted] Missing call data');

// Line 269: logger.info
logger.info('[handleCallStarted] Inbound call detected', {...});

// Line 311: console.error
console.error('[handleCallStarted] Invalid phone number format:', phoneValidation.error);
```

### Why It Fails:
- Inconsistent logging makes it hard to aggregate logs in production
- console.log goes to stdout, logger goes to structured logs
- Difficult to search/filter logs

### Fixed Code:
```typescript
// Use logger EVERYWHERE - consistent format
logger.error('[handleCallStarted] Missing call data', {
  vapiCallId: call?.id,
  hasCall: Boolean(call),
  hasCallId: Boolean(call?.id)
});

logger.info('[handleCallStarted] Inbound call detected', {
  vapiCallId: call.id,
  vapiAssistantId: call.assistantId,
  customerNumber: maskPhone(call.customer?.number)
});

logger.error('[handleCallStarted] Invalid phone number format', {
  vapiCallId: call.id,
  providedNumber: call.customer?.number,
  validationError: phoneValidation.error
});
```

---

## CRITICAL FIX #7: Extract Inbound Call Handling to Separate Function

### Current Code (NESTED):
```typescript
// Lines 260-354: 95 lines of nested conditionals
if (!callTracking) {
  if (call.assistantId) {
    // ... 50+ lines
  } else {
    return;
  }
}
```

### Fixed Code:
```typescript
/**
 * Handle inbound call - create call_tracking and call_logs
 */
async function handleInboundCall(
  event: VapiEvent,
  call: VapiCall,
  agent: Agent
): Promise<CallTracking> {
  logger.info('[handleInboundCall] Processing inbound call', {
    vapiCallId: call.id,
    vapiAssistantId: call.assistantId,
    agentId: agent.id
  });

  // Validate phone number
  let phoneNumber = call.customer?.number || null;
  if (phoneNumber) {
    const phoneValidation = validateE164Format(phoneNumber);
    if (!phoneValidation.valid) {
      logger.warn('[handleInboundCall] Invalid phone number, using as-is', {
        vapiCallId: call.id,
        providedNumber: phoneNumber,
        error: phoneValidation.error
      });
      phoneNumber = phoneValidation.normalized || phoneNumber;
    } else {
      phoneNumber = phoneValidation.normalized;
    }
  }

  // Create call_tracking for inbound call
  const { data: newTracking, error: insertError } = await supabase
    .from('call_tracking')
    .insert({
      org_id: agent.org_id,
      agent_id: agent.id,
      vapi_call_id: call.id,
      status: 'ringing',
      phone: phoneNumber,
      metadata: {
        channel: 'inbound',
        assistantId: call.assistantId,
        userId: undefined,
        is_test_call: false,
        created_at: new Date().toISOString(),
        source: 'vapi_webhook'
      } as CallTrackingMetadata
    })
    .select('id, lead_id, org_id, metadata')
    .single();

  if (insertError) {
    logger.error('[handleInboundCall] Failed to insert call_tracking', {
      vapiCallId: call.id,
      agentId: agent.id,
      error: insertError.message
    });
    throw new Error(`Failed to create call_tracking: ${insertError.message}`);
  }

  logger.info('[handleInboundCall] Call tracking created', {
    vapiCallId: call.id,
    trackingId: newTracking.id
  });

  return newTracking;
}
```

---

## CRITICAL FIX #8: Add Timeout Protection to Database Operations

### Current Code (NO TIMEOUT):
```typescript
// Lines 231-235: No timeout specified
const result = await supabase
  .from('call_tracking')
  .select('id, lead_id, org_id, metadata')
  .eq('vapi_call_id', call.id)
  .maybeSingle();
```

### Why It Fails:
- If database is slow, webhook handler hangs
- Vapi retries webhook, creating cascading failures
- Handler blocks other webhooks

### Fixed Code:
```typescript
// Add timeout wrapper
const result = await Promise.race([
  supabase
    .from('call_tracking')
    .select('id, lead_id, org_id, metadata')
    .eq('vapi_call_id', call.id)
    .maybeSingle(),
  new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Database query timeout (5s)')),
      5000
    )
  )
]);
```

---

## CRITICAL FIX #9: Enforce Webhook Signature Verification

### Current Code (INSUFFICIENT):
```typescript
// Lines 138-143
const isValid = await verifyVapiSignature(req);
if (!isValid) {
  console.error('[Vapi Webhook] Invalid signature, rejecting webhook');
  res.status(401).json({ error: 'Invalid webhook signature' });
  return;
}
```

### Why It Fails:
- If verifyVapiSignature throws error, not caught
- No logging of failed verification attempts
- No rate limiting on failed attempts

### Fixed Code:
```typescript
try {
  const isValid = await verifyVapiSignature(req);
  if (!isValid) {
    logger.error('[Vapi Webhook] Invalid webhook signature', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
      path: req.path
    });
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }
  logger.debug('[Vapi Webhook] Signature verified', { ip: req.ip });
} catch (verifyError: any) {
  logger.error('[Vapi Webhook] Signature verification failed', {
    error: verifyError.message,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  res.status(401).json({ error: 'Webhook verification failed' });
  return;
}
```

---

## CRITICAL FIX #10: Add Metrics Collection & Alerting

### Current Code (NO MONITORING):
```typescript
// No metrics collected
// No alerts configured
// No SLA tracking
```

### Why It Fails:
- Failures invisible until customer reports
- No visibility into call success rate
- No early warning system

### Fixed Code:
```typescript
// Add metrics collection
const metrics = {
  inboundCallsReceived: 0,
  inboundCallsSuccessful: 0,
  inboundCallsFailed: 0,
  agentLookupFailures: 0,
  callTrackingCreationFailures: 0,
  averageProcessingTimeMs: 0,
  maxProcessingTimeMs: 0
};

// In handleCallStarted
const startTime = Date.now();
try {
  // ... process call
  metrics.inboundCallsReceived++;
  metrics.inboundCallsSuccessful++;
} catch (error) {
  metrics.inboundCallsFailed++;
  if (error.message.includes('Agent lookup')) {
    metrics.agentLookupFailures++;
  } else if (error.message.includes('call_tracking')) {
    metrics.callTrackingCreationFailures++;
  }
  throw error;
} finally {
  const processingTime = Date.now() - startTime;
  metrics.averageProcessingTimeMs = processingTime;
  metrics.maxProcessingTimeMs = Math.max(metrics.maxProcessingTimeMs, processingTime);
  
  // Send to monitoring service
  sendMetrics(metrics);
  
  // Alert on failures
  if (metrics.inboundCallsFailed > 5) {
    sendAlert('Inbound call failures detected', {
      failureCount: metrics.inboundCallsFailed,
      successCount: metrics.inboundCallsSuccessful,
      failureRate: (metrics.inboundCallsFailed / metrics.inboundCallsReceived * 100).toFixed(2) + '%'
    });
  }
}
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: CRITICAL (Do First - Blocks Feature 1)
- [ ] Fix agent lookup to throw errors (Fix #1)
- [ ] Increase retry delays (Fix #2)
- [ ] Detect call type explicitly (Fix #3)
- [ ] Strict idempotency check (Fix #4)
- [ ] Validate Vapi event structure (Fix #5)

### Phase 2: HIGH PRIORITY (Next)
- [ ] Use logger consistently (Fix #6)
- [ ] Extract inbound call handling (Fix #7)
- [ ] Add timeout protection (Fix #8)
- [ ] Enforce webhook signature verification (Fix #9)
- [ ] Add metrics collection (Fix #10)

### Phase 3: TESTING
- [ ] Unit tests for each fix
- [ ] Integration tests with Vapi
- [ ] Load testing (100+ concurrent calls)
- [ ] Failure scenario testing

---

## EXPECTED OUTCOMES

### Before Fixes:
- Inbound call success rate: 50-70%
- Agent lookup failures: 10-15%
- Race condition failures: 15-20%
- Silent failures: 5-10%

### After Fixes:
- Inbound call success rate: 99%+
- Agent lookup failures: <0.1%
- Race condition failures: <0.5%
- Silent failures: 0% (all errors logged)

---

## FILES TO MODIFY

1. `backend/src/routes/webhooks.ts` - Main webhook handler
2. `backend/src/schemas/vapi-event.ts` - Add Zod validation schema
3. `backend/src/services/logger.ts` - Ensure consistent logging
4. `backend/src/services/metrics.ts` - Add metrics collection
5. `backend/src/routes/inbound-call.ts` - Extract inbound logic (new file)

---

## DEPLOYMENT PLAN

1. Create feature branch: `fix/feature-1-inbound-calls`
2. Implement all 10 critical fixes
3. Add unit tests for each fix
4. Deploy to staging environment
5. Run integration tests with Vapi
6. Deploy to production with feature flag
7. Monitor metrics for 24 hours
8. Full rollout if success rate >99%
