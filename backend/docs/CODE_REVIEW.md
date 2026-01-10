# Senior Code Review: Voxanne Backend
## Database Isolation, Transactions & Multi-Tenant Safety Assessment

**Date**: December 21, 2025
**Reviewer**: Senior Engineer
**Scope**: Webhook handlers, transaction patterns, multi-tenant isolation
**Grade**: B+ → A- (after recommended fixes)

---

## Executive Summary

**What Are Transactions?**

A transaction is a sequence of database operations that either all succeed together (COMMIT) or all fail together (ROLLBACK). Think of it like a business transaction: you can't charge a customer's card without creating an order, and you can't create an order without charging the card. Transactions ensure **atomicity** (all-or-nothing) and **consistency** (data stays valid).

**Current State**: Your backend demonstrates sophisticated idempotency and multi-tenant isolation patterns with 9 explicit CRITICAL FIX markers. However, **3 UPDATE operations lack org_id filters**, creating potential **cross-organization data leakage** vulnerabilities.

---

## Part 1: Critical Vulnerabilities & Fixes Required

### 🔴 CRITICAL #1: Missing org_id Filters in UPDATE Statements

**Severity**: MEDIUM-HIGH (Data Leakage Risk)
**Impact**: Could update wrong organization's records
**Locations**: 3 instances

#### **Issue 1.1: handleCallEnded - Line 680**
```typescript
// CURRENT (VULNERABLE):
const { error } = await supabase
  .from('call_logs')
  .update({
    status: 'completed',
    ended_at: new Date().toISOString(),
    duration_seconds: call.duration || 0
  })
  .eq('vapi_call_id', call.id);  // ← Only filtered by vapi_call_id
```

**Problem**: If two organizations somehow share a vapi_call_id (theoretically possible from Vapi), this could update BOTH org's call logs.

**Fix**:
```typescript
// FIXED:
const { error } = await supabase
  .from('call_logs')
  .update({
    status: 'completed',
    ended_at: new Date().toISOString(),
    duration_seconds: call.duration || 0
  })
  .eq('vapi_call_id', call.id)
  .eq('org_id', callLog.org_id);  // ← ADD org_id filter
```

#### **Issue 1.2: handleEndOfCallReport - Line 1108**
```typescript
// CURRENT (VULNERABLE):
const { error: callLogsError } = await supabase
  .from('call_logs')
  .update({
    outcome: 'completed',
    recording_url: recordingSignedUrl || null,
    // ... more fields
  })
  .eq('vapi_call_id', call.id);  // ← Missing org_id
```

**Fix**:
```typescript
// FIXED:
.eq('vapi_call_id', call.id)
.eq('org_id', callLog.org_id);
```

#### **Issue 1.3: handleEndOfCallReport - Line 1122**
```typescript
// CURRENT (VULNERABLE):
const { error: callsError } = await supabase
  .from('calls')
  .update({
    call_type: callType,
    recording_storage_path: recordingStoragePath,
    status: 'completed'
  })
  .eq('vapi_call_id', call.id);  // ← Missing org_id
```

**Fix**:
```typescript
// FIXED:
.eq('vapi_call_id', call.id)
.eq('org_id', callLog.org_id);  // ← Add after fetching org_id from call_logs
```

**Why This Matters**:
- Supabase row-level security (RLS) is NOT enforced via the JavaScript client for non-RLS tables
- Application-layer filtering (your .eq() clauses) is the PRIMARY defense
- Every multi-tenant query must include org_id, even if it seems redundant
- **Defense in Depth**: Database should also enforce via foreign keys and constraints

---

### 🔴 CRITICAL #2: Inverted Idempotency Sequence in handleCallEnded

**Severity**: HIGH (Duplicate Processing Risk)
**Impact**: Webhooks could be processed multiple times despite idempotency check
**Location**: Lines 648-756

#### **Problem: Mark Event AFTER Updates**
```typescript
// WRONG SEQUENCE (lines 648-756):
1. Idempotency check (line 648-663)
2. Update call_logs (line 673-680)
3. Update call_tracking (line 734)
4. THEN mark as processed (line 745-756)  ← TOO LATE!

// What happens if service crashes between step 3 and 4:
// - call_logs already updated
// - call_tracking already updated
// - Event NOT marked as processed
// - Next retry will update both tables AGAIN
```

#### **Correct Sequence (as done in handleCallStarted)**:
```typescript
// RIGHT SEQUENCE (handleCallStarted lines 328-362):
1. Idempotency check (line 332-346)
2. Mark as processed IMMEDIATELY (line 349-360) ← FIRST!
3. THEN do all other operations (lines 365+)     ← AFTER mark

// If service crashes between mark and update:
// - Event marked as processed
// - Retry detects duplicate, returns early
// - No duplicate updates
```

#### **Fix: Swap the order in handleCallEnded**
```typescript
// handleCallEnded should be:

const eventId = `ended:${call.id}`;

// Step 1: Check idempotency
const { data: existing } = await supabase
  .from('processed_webhook_events')
  .select('id')
  .eq('event_id', eventId)
  .maybeSingle();

if (existing) {
  logger.info('webhooks', 'Duplicate event, skipping');
  return;  // Early exit
}

// Step 2: Mark as processed IMMEDIATELY
const { error: markError } = await supabase
  .from('processed_webhook_events')
  .insert({ event_id: eventId, call_id: call.id, event_type: 'ended' });

if (markError) {
  throw new Error(`Failed to mark event: ${markError.message}`);
}

// Step 3: NOW do updates (safe because event marked)
const { error } = await supabase
  .from('call_logs')
  .update({ status: 'completed', ... })
  .eq('vapi_call_id', call.id)
  .eq('org_id', callLog.org_id);

// ... rest of updates
```

---

### 🔴 CRITICAL #3: Lack of Transactions for Multi-Step Operations

**Severity**: HIGH (Data Consistency Risk)
**Impact**: Multi-table operations not atomic; intermediate failures leave data inconsistent
**Affected Functions**: handleCallStarted, handleEndOfCallReport

#### **Problem: No Transaction Boundary**

```typescript
// handleCallStarted sequence WITHOUT transaction (lines 319-630):

1. Check idempotency
2. Mark as processed
3. Retry for call_tracking lookup
4. Create call_tracking       ← INSERT
5. Fetch lead data            ← SELECT
6. Load agent config          ← SELECT
7. Inject RAG context         ← EXTERNAL API CALL!
8. Create call_logs           ← INSERT
9. Update call_tracking       ← UPDATE
10. Broadcast via WebSocket   ← EXTERNAL API CALL!

// Failure scenarios:
// - Step 4 fails: No call_tracking created (but event marked)
// - Step 8 fails: call_tracking created but call_logs missing
// - Step 9 fails: Inconsistent state
// - Step 10 fails: Database consistent but UI doesn't update
```

#### **Current Problem**: External API calls (RAG, WebSocket) are NOT transactional
```typescript
// Lines 556-582: RAG injection (EXTERNAL API CALL)
await injectRagContextIntoAgent({
  vapiApiKey: vapiApiKey,
  assistantId: call.assistantId,
  ragContext: context
});
// ← If this succeeds but next operation fails, Vapi assistant is modified
//   but no corresponding call_logs entry

// Lines 628-630: WebSocket broadcast (EXTERNAL CALL)
wsBroadcast({
  type: 'call_status',
  // ...
});
// ← If database operations succeeded but broadcast fails,
//   UI never learns about the call
```

#### **Solution 1: Database Transaction Wrapper (for DB operations only)**
```typescript
// Create a PostgreSQL function that wraps multi-step DB operations
CREATE OR REPLACE FUNCTION create_inbound_call(
  p_org_id UUID,
  p_agent_id UUID,
  p_vapi_call_id TEXT,
  p_phone_number TEXT,
  p_lead_id UUID
) RETURNS TABLE (
  call_tracking_id UUID,
  call_logs_id UUID
) AS $$
BEGIN
  -- All these run in single transaction; auto-rollback on error
  INSERT INTO call_tracking (org_id, agent_id, vapi_call_id, phone, status)
  VALUES (p_org_id, p_agent_id, p_vapi_call_id, p_phone_number, 'ringing')
  RETURNING id INTO call_tracking_id;

  INSERT INTO call_logs (org_id, vapi_call_id, lead_id, status)
  VALUES (p_org_id, p_vapi_call_id, p_lead_id, 'in_progress')
  RETURNING id INTO call_logs_id;

  -- Return both IDs
  RETURN NEXT;
END $$
LANGUAGE plpgsql
SECURITY DEFINER;

// Then call from webhook:
const { data, error } = await supabase.rpc('create_inbound_call', {
  p_org_id: agent.org_id,
  p_agent_id: agent.id,
  p_vapi_call_id: call.id,
  p_phone_number: call.customer?.number,
  p_lead_id: lead?.id
});

if (error) throw new Error(`Failed to create call: ${error.message}`);
const { call_tracking_id, call_logs_id } = data;

// Now that DB is consistent, do external API calls
await injectRagContextIntoAgent({...});
wsBroadcast({...});
```

#### **Solution 2: Webhook Event Queue (for full atomicity including external calls)**
```typescript
// Queue the webhook event with all operations, then process atomically:

await supabase.from('webhook_event_queue').insert({
  vapi_event_id: call.id,
  event_type: 'call.started',
  payload: event,
  org_id: agent.org_id,
  status: 'pending',
  created_at: new Date().toISOString()
});

// Separate queue worker processes events atomically:
while (true) {
  const { data: events } = await supabase
    .from('webhook_event_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(1);

  for (const event of events || []) {
    try {
      // Step 1: Create call records (transactional DB RPC)
      const { data: result } = await supabase.rpc('create_inbound_call', {...});

      // Step 2: External API calls
      await injectRagContextIntoAgent({...});

      // Step 3: Mark as processed (ONLY if all above succeeded)
      await supabase
        .from('webhook_event_queue')
        .update({ status: 'completed' })
        .eq('id', event.id);

    } catch (error) {
      // Mark as failed or retry
      await supabase
        .from('webhook_event_queue')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', event.id);
    }
  }
}
```

---

## Part 2: High-Priority Issues

### 🟠 ISSUE #4: Race Condition - Check-Then-Act (TOCTOU)

**Severity**: MEDIUM (Duplicate Inserts, but mitigated)
**Location**: handleCallStarted lines 370-469
**Status**: Partially mitigated by retry logic

#### **The Vulnerability**:
```typescript
// TOCTOU Window (Time-of-Check to Time-of-Use):

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const result = await supabase
    .from('call_tracking')
    .select('id')
    .eq('vapi_call_id', call.id)
    .maybeSingle();

  existingCallTracking = result.data;
  if (existingCallTracking) break;

  // ← NO TRANSACTION BOUNDARY HERE ←
  // Between read and write, another webhook could insert same row
}

// Another webhook might execute here concurrently

const { data: newTracking, error: insertError } = await supabase
  .from('call_tracking')
  .insert({ vapi_call_id: call.id, ... });
  // ← Could fail with UNIQUE constraint violation
```

#### **Current Mitigation (lines 365-394)**:
- ✓ Retries with exponential backoff (100ms, 250ms, 500ms, 1s, 2s)
- ✓ Random jitter to prevent thundering herd
- ✓ Total wait: 3.85 seconds

#### **Why It Works**:
- If concurrent webhook inserts first, your retry will find existing row and use it
- Idempotency check at line 332-346 prevents duplicate EVENT processing
- So even if both webhooks proceed, the second marks event as processed and returns

#### **Ideal Solution**: Try INSERT, handle constraint violation gracefully
```typescript
// Better pattern:
let callTracking = null;

try {
  // Try insert
  const { data, error } = await supabase
    .from('call_tracking')
    .insert({
      org_id: agent.org_id,
      agent_id: agent.id,
      vapi_call_id: call.id,
      status: 'ringing'
    })
    .select()
    .single();

  if (error?.code === 'PGRST103') {
    // Unique constraint violation - row was inserted by another webhook
    // Fetch the existing row instead
    const { data: existing } = await supabase
      .from('call_tracking')
      .select()
      .eq('vapi_call_id', call.id)
      .single();
    callTracking = existing;
  } else if (error) {
    throw error;
  } else {
    callTracking = data;
  }
} catch (error) {
  throw error;
}
```

---

### 🟠 ISSUE #5: Weak Transcript Idempotency Key

**Severity**: MEDIUM (Duplicate Transcripts Possible)
**Location**: handleTranscript lines 790-794
**Current Implementation**:
```typescript
const timestampBucket = Math.floor(Date.now() / 1000);  // 1-second bucket
const eventId = `transcript:${call.id}:${speaker}:${cleanTranscript.substring(0, 50)}:${timestampBucket}`;
```

#### **Problems**:
1. **Same phrase within 1 second**: If agent repeats same phrase, gets same event_id → Treated as duplicate
2. **Substring collision**: Two different transcripts starting with same 50 chars → Same event_id
3. **Timestamp unreliability**: Network delay + server clock skew could cause mismatches

#### **Example Failure**:
```
Agent says: "Hello, how can I help you today? This is Sarah from..."  (char 0-50)
Agent says: "Hello, how can I help you today? This is John from..."   (char 0-50)

Both have same event_id because substring(0, 50) is identical!
Second transcript silently dropped as duplicate.
```

#### **Fix: Use Content Hash**
```typescript
import crypto from 'crypto';

const contentHash = crypto
  .createHash('sha256')
  .update(`${speaker}:${cleanTranscript}`)
  .digest('hex')
  .substring(0, 16);  // Use first 16 chars of hash

const eventId = `transcript:${call.id}:${contentHash}`;

// Now each unique (speaker, transcript) pair gets unique event_id
```

---

### 🟠 ISSUE #6: Cascading Error Handling in handleEndOfCallReport

**Severity**: MEDIUM (Data Inconsistency)
**Location**: Lines 1110-1142

#### **Problem**:
```typescript
// call_logs update
const { error: callLogsError } = await supabase
  .from('call_logs')
  .update({...})
  .eq('vapi_call_id', call.id)
  .eq('org_id', callLog.org_id);

if (callLogsError) {
  logger.error('webhooks', 'Failed to update call log');
  // ← PROBLEM: Doesn't throw! Continues anyway!
}

// calls table update (might fail if previous failed)
const { error: callsError } = await supabase
  .from('calls')
  .update({...})
  .eq('vapi_call_id', call.id);

if (callsError) {
  // Cleanup happens
  if (recordingStoragePath) {
    await deleteRecording(recordingStoragePath);
  }
  throw new Error(`Failed to update calls table`);  // ← Only throws here
}
```

#### **Result**: Inconsistent state
- call_logs NOT updated (outcome = null)
- calls IS updated (status = 'completed')
- Recording deleted
- UI sees completed call with no outcome

#### **Fix: Throw Immediately**
```typescript
const { error: callLogsError } = await supabase
  .from('call_logs')
  .update({...})
  .eq('vapi_call_id', call.id)
  .eq('org_id', callLog.org_id);

if (callLogsError) {
  throw new Error(`Failed to update call log: ${callLogsError.message}`);
}

// Now safe to proceed to next update
const { error: callsError } = await supabase
  .from('calls')
  .update({...})
  .eq('vapi_call_id', call.id)
  .eq('org_id', callLog.org_id);

if (callsError) {
  throw new Error(`Failed to update calls table: ${callsError.message}`);
}
```

---

### 🟠 ISSUE #7: Silent Failures in handleTranscript

**Severity**: MEDIUM (Data Loss - Transcripts Dropped)
**Location**: Lines 887-892

#### **Problem**:
```typescript
if (callTracking) {
  // Insert transcript
  const { error: insertError } = await supabase.from('call_transcripts').insert({...});
} else {
  logger.warn('webhooks', 'Call tracking not found after retries');
  return;  // ← Returns without error! Transcript never stored!
}
```

#### **Scenario**:
- Call just started, webhook #1 creates call_tracking
- Before call_tracking data returns to webhook processor, transcript webhook (#2) arrives
- Transcript webhook doesn't find call_tracking (still processing), logs warning, discards transcript
- Transcript is permanently lost

#### **Fix: Queue for Retry**
```typescript
if (!callTracking) {
  logger.warn('webhooks', 'Call tracking not found, queuing transcript for retry');

  // Queue for retry
  await supabase.from('transcript_retry_queue').insert({
    vapi_call_id: call.id,
    speaker: speaker,
    text: cleanTranscript,
    event_id: eventId,
    attempt_count: 0,
    created_at: new Date().toISOString()
  });

  // Don't mark as processed - allow retry
  return;
}
```

---

### 🟠 ISSUE #8: WebSocket Broadcast Failures Not Retried

**Severity**: MEDIUM (UI Doesn't Update)
**Location**: Lines 628-630, 868

#### **Problem**:
```typescript
try {
  wsBroadcast({
    type: 'call_status',
    vapiCallId: call.id,
    userId: userId || '',
    status: 'ringing'
  });
} catch (broadcastError: any) {
  logger.warn('webhooks', 'WebSocket broadcast failed');
  // ← Continues! UI never gets update!
}
```

#### **Result**:
- Database is consistent ✓
- But frontend never learns call is ringing
- User sees nothing, gets confused

#### **Fix: Queue Broadcast for Retry**
```typescript
try {
  await wsBroadcast({...});
} catch (broadcastError: any) {
  // Queue for retry
  await supabase.from('websocket_broadcast_queue').insert({
    tracking_id: callTracking.id,
    user_id: userId,
    event_type: 'call_status',
    payload: {
      vapiCallId: call.id,
      status: 'ringing'
    },
    attempt_count: 0,
    created_at: new Date().toISOString()
  });

  logger.warn('webhooks', 'Broadcast queued for retry');
}
```

---

## Part 3: Best Practices - What You're Doing Right

### ✅ GOOD #1: Agent Lookup Validation

**Location**: Lines 414-429
```typescript
const { data: agent, error: agentError } = await supabase
  .from('agents')
  .select('id, org_id, name, active, vapi_assistant_id')
  .eq('vapi_assistant_id', call.assistantId)
  .eq('active', true)
  .maybeSingle();

if (agentError) {
  throw new Error(`Agent lookup failed: ${agentError.message}`);
}

if (!agent) {
  throw new Error(`No active agent found for vapi_assistant_id: ${call.assistantId}`);
}
```

**Why This Is Good**:
- ✓ Doesn't silently continue if agent missing
- ✓ Throws with descriptive error
- ✓ Filters by both vapi_assistant_id AND active status
- ✓ org_id derived from trusted agent record

---

### ✅ GOOD #2: Lead Isolation with Double Filter

**Location**: Lines 491-499
```typescript
if (callTracking?.lead_id) {
  const { data: leadData } = await supabase
    .from('leads')
    .select('id, contact_name, name, clinic_name, company_name, org_id')
    .eq('id', callTracking.lead_id)
    .eq('org_id', callTracking.org_id)  // ← Double filter!
    .maybeSingle();
}
```

**Why This Is Good**:
- ✓ Filters by both lead_id AND org_id (defense in depth)
- ✓ Prevents accessing leads from other organizations
- ✓ Even if lead_id was wrong, org_id provides safety net

---

### ✅ GOOD #3: Recording Cleanup on Errors

**Location**: Lines 1130-1142
```typescript
if (callsError) {
  logger.warn('webhooks', 'Cleaning up orphaned recording due to DB error');

  try {
    if (recordingStoragePath) {
      await deleteRecording(recordingStoragePath);
    }
  } catch (deleteError: any) {
    logger.error('webhooks', 'Failed to delete orphaned recording');
  }

  throw new Error(`Failed to update calls table`);
}
```

**Why This Is Good**:
- ✓ Prevents storage bloat from failed operations
- ✓ Doesn't fail if cleanup fails (catches error from delete)
- ✓ Then throws original error for retry

---

### ✅ GOOD #4: Signature Verification

**Location**: Lines 247-259
```typescript
try {
  const isValid = await verifyVapiSignature(req);
  if (!isValid) {
    logger.error('webhooks', 'Invalid webhook signature');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }
} catch (verifyError: any) {
  logger.error('webhooks', 'Signature verification failed');
  res.status(401).json({ error: 'Webhook verification failed' });
  return;
}
```

**Why This Is Good**:
- ✓ First thing checked before processing
- ✓ Returns 401 Unauthorized
- ✓ Prevents malicious webhooks

---

### ✅ GOOD #5: Zod Schema Validation

**Location**: Lines 261-270
```typescript
let event: VapiEvent;
try {
  event = VapiEventValidationSchema.parse(req.body) as VapiEvent;
} catch (parseError: any) {
  logger.error('webhooks', 'Invalid event structure');
  res.status(400).json({ error: 'Invalid event structure' });
  return;
}
```

**Why This Is Good**:
- ✓ Schema validation BEFORE any processing
- ✓ Type-safe parsing
- ✓ Rejects malformed webhooks

---

## Part 4: Transaction Concepts & Your Implementation

### What Are Transactions?

**Definition**: A sequence of database operations that either ALL succeed (COMMIT) or ALL fail (ROLLBACK).

**Example**:
```
Bank transfer: $100 from Account A to Account B

Transaction:
1. Debit Account A:   -$100
2. Credit Account B:  +$100

If step 1 succeeds but step 2 fails:
- ROLLBACK: Both changes undone, money neither lost nor duplicated
- Without transaction: Money disappears!
```

### Isolation Levels

Your backend relies on **READ COMMITTED** (PostgreSQL default):

| Level | Allows Dirty Reads | Allows Non-Repeatable Reads | Allows Phantom Reads | Use Case |
|---|---|---|---|---|
| **READ UNCOMMITTED** | Yes | Yes | Yes | Not supported by PostgreSQL |
| **READ COMMITTED** | No | Yes | Yes | ✓ Your current setup |
| **REPEATABLE READ** | No | No | Yes | High-concurrency scenarios |
| **SERIALIZABLE** | No | No | No | Strict consistency (slower) |

**For Voxanne**: READ COMMITTED is fine because:
- org_id filtering provides isolation boundaries
- Non-repeatable reads are acceptable (call logs don't need to be re-read)
- No complex queries spanning multiple tables

---

### Your Transaction Implementation

You use **two approaches**:

#### Approach 1: RPC Functions (Server-Side)
```typescript
// File: add-atomic-config-update-rpc.sql

CREATE OR REPLACE FUNCTION update_agent_and_integrations(...)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- All operations here run in single transaction
  UPDATE agents SET ... WHERE id = p_agent_id AND org_id = p_org_id;
  UPSERT integrations SET ... ON CONFLICT ...;
  UPSERT integrations SET ... ON CONFLICT ...;
  RETURN json_build_object(...);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;  -- Auto-rollback on any error
END;
$$;
```

**Pros**:
- ✓ Atomic by default
- ✓ Auto-rollback on error
- ✓ Org isolation in WHERE clause

**Cons**:
- ✗ Only works for simple operations
- ✗ Can't call external APIs inside transaction

#### Approach 2: Client-Side (Your Webhooks)
```typescript
// No explicit transaction - multiple separate database calls
const { data: result1 } = await supabase.from('call_tracking').insert(...);
const { data: result2 } = await supabase.from('call_logs').insert(...);
const { data: result3 } = await supabase.from('call_tracking').update(...);
// ← If result2 fails, result1 and result3 may be inconsistent
```

**Pros**:
- Can call external APIs
- Flexible retry logic

**Cons**:
- Not atomic
- Requires idempotency for reliability

---

## Part 5: Naming & Code Style Issues

### 🟡 ISSUE #9: Inconsistent Naming

**Problem**: Mix of camelCase, snake_case, and abbreviated names

#### Examples:
```typescript
// Inconsistent:
const eventId = `call.started:${call.id}`;           // camelCase
const MAX_RETRIES = 5;                               // SCREAMING_SNAKE_CASE
const cleanTranscript = text.trim().toLowerCase();   // camelCase
const RETRY_DELAYS = [100, 250, 500, 1000, 2000];   // SCREAMING_SNAKE_CASE

// Functions mix styles:
handleCallStarted()      // camelCase
verifyVapiSignature()    // camelCase
getRagContext()          // camelCase
injectRagContextIntoAgent() // Verbose camelCase

// Database columns use snake_case:
vapi_call_id, org_id, call_tracking, processed_webhook_events
```

**Best Practice**:
- ✓ **Constants**: SCREAMING_SNAKE_CASE (MAX_RETRIES, RETRY_DELAYS)
- ✓ **Variables/Functions**: camelCase (eventId, handleCallStarted)
- ✓ **Database columns**: snake_case (vapi_call_id) - enforce in schema

**Your Code**: Mostly consistent, minor issues

---

### 🟡 ISSUE #10: Type Casting Without Validation

**Location**: Various places
```typescript
// Line 763:
userId: (callTracking as any)?.metadata?.userId,

// Problem: `as any` bypasses TypeScript safety
// callTracking.metadata could be:
// - undefined
// - null
// - { userId: 123 } (number, not string!)
// - { userId: "" } (empty string)
```

**Fix**:
```typescript
// Define types first
interface CallTrackingMetadata {
  userId?: string;
  channel?: 'inbound' | 'outbound';
  // ... other fields
}

// Then safely cast:
const metadata = callTracking?.metadata as CallTrackingMetadata | undefined;
const userId = (metadata?.userId && typeof metadata.userId === 'string')
  ? metadata.userId
  : '';

// Or use type guard:
function isValidUserId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

const userId = isValidUserId(callTracking?.metadata?.userId)
  ? callTracking.metadata.userId
  : '';
```

---

## Part 6: Performance Optimizations

### 🟢 GOOD: Retry with Exponential Backoff (Lines 365-394)

Current implementation is efficient:
```typescript
const RETRY_DELAYS = [100, 250, 500, 1000, 2000];  // Total: 3.85s
const jitter = Math.random() * 100;                // Random jitter
const delayMs = RETRY_DELAYS[attempt] + jitter;    // Applied per retry
```

✓ Prevents thundering herd
✓ Reasonable wait time before giving up
✓ Jitter prevents synchronized retries

---

### 🟠 OPPORTUNITY: Parallel Lead/Config Fetches

**Current (Sequential - Lines 491-548)**:
```typescript
// Waits for lead to fetch
const { data: leadData } = await supabase
  .from('leads')
  .select(...)
  .eq('id', callTracking.lead_id)
  .eq('org_id', callTracking.org_id)
  .maybeSingle();
lead = leadData;

// Then waits for config
const { data: config } = await supabase
  .from(configTableName)
  .select(...)
  .eq('org_id', callTracking.org_id)
  .eq('is_active', true)
  .maybeSingle();
```

**Optimized (Parallel)**:
```typescript
// Fetch simultaneously
const [leadResult, configResult] = await Promise.all([
  supabase
    .from('leads')
    .select('id, contact_name, name, clinic_name, company_name, org_id')
    .eq('id', callTracking.lead_id)
    .eq('org_id', callTracking.org_id)
    .maybeSingle(),

  supabase
    .from(configTableName)
    .select('*')
    .eq('org_id', callTracking.org_id)
    .eq('is_active', true)
    .maybeSingle()
]);

lead = leadResult.data;
const config = configResult.data;
```

**Impact**: Shaves ~100-200ms from webhook processing time

---

## Part 7: Database Schema Improvements

### 🟡 ISSUE #11: Missing NOT NULL Constraints on org_id

**Current State**: org_id columns don't have NOT NULL constraints in all tables

**Risk**: A bug could insert NULL org_id, creating ambiguous records

**Fix**: Add constraint to all tenant-scoped tables
```sql
ALTER TABLE call_logs
ADD CONSTRAINT call_logs_org_id_not_null
CHECK (org_id IS NOT NULL);

ALTER TABLE call_tracking
ADD CONSTRAINT call_tracking_org_id_not_null
CHECK (org_id IS NOT NULL);

-- etc. for all org-scoped tables
```

---

### 🟡 ISSUE #12: Composite Unique Index for Idempotency

**Current**: Only event_id is unique
```sql
CREATE UNIQUE INDEX idx_processed_events_event_id
ON processed_webhook_events(event_id);
```

**Better**: Include org_id to prevent same event_id across orgs (though unlikely)
```sql
CREATE UNIQUE INDEX idx_processed_events_org_event
ON processed_webhook_events(org_id, event_id);
```

---

### 🟡 ISSUE #13: TTL for processed_webhook_events

**Current**: Table grows indefinitely

**Risk**: Eventually bloats database

**Solution**: Archive old events
```sql
-- Delete events older than 30 days
DELETE FROM processed_webhook_events
WHERE received_at < NOW() - INTERVAL '30 days';

-- Or move to archive table
INSERT INTO processed_webhook_events_archive
SELECT * FROM processed_webhook_events
WHERE received_at < NOW() - INTERVAL '30 days';

DELETE FROM processed_webhook_events
WHERE received_at < NOW() - INTERVAL '30 days';
```

---

## Part 8: Security Vulnerabilities Assessment

### 🔴 DATA LEAKAGE VECTORS

| Vector | Current Risk | Mitigation | Grade |
|--------|---|---|---|
| Missing org_id filters on UPDATE | MEDIUM | Add org_id to WHERE clauses | 🔴 FIX CRITICAL |
| Lead access without org_id | LOW | Double-filtered (good) | ✅ PASS |
| Recording access | LOW | Path includes org_id | ✅ PASS |
| RAG context leakage | LOW | org_id passed to RPC | ✅ PASS |
| Webhook signature bypass | MEDIUM | Verified first in handler | ✅ PASS |
| Transcript to wrong user | MEDIUM | Frontend must validate | ⚠️ DOCUMENT |
| Call type confusion | LOW | Explicit detection | ✅ PASS |

---

## Part 9: Debugging & Production Readiness

### 🔴 ISSUE #14: Excessive `as any` Type Casts

**Location**: Multiple places
```typescript
const userId = (callTracking as any)?.metadata?.userId;
// Should be:
const metadata = (callTracking?.metadata as CallTrackingMetadata) ?? {};
const userId = metadata.userId ?? '';
```

### 🟡 ISSUE #15: Missing Error Context in Logs

**Current**:
```typescript
logger.error('webhooks', 'Handler error');  // ← Too generic!
```

**Better**:
```typescript
logger.error('webhooks', 'Handler error in call.ended', {
  vapiCallId: call.id,
  errorMessage: error.message,
  errorStack: error.stack,
  timestamp: new Date().toISOString()
});
```

### ✅ GOOD: Structured Logging

Your logger service properly structures errors:
```typescript
logger.error('webhooks', 'CRITICAL: Agent lookup failed', {
  vapiAssistantId: call.assistantId,
  error: agentError.message,
  timestamp: new Date().toISOString()
});
```

---

## Recommended Implementation Timeline

### Phase 1: CRITICAL (Do Before Production)
- [ ] Add org_id filters to UPDATE statements (Issues #1, 3 locations)
- [ ] Fix idempotency sequence in handleCallEnded (Issue #2)
- [ ] Implement transaction wrapper RPC (Issue #3)
- [ ] Add NOT NULL constraint to org_id (Issue #11)

### Phase 2: HIGH (First Sprint)
- [ ] Improve transcript idempotency key (Issue #5)
- [ ] Fix cascading error handling (Issue #6)
- [ ] Queue transcript retries (Issue #7)
- [ ] Queue broadcast retries (Issue #8)

### Phase 3: MEDIUM (Next Sprint)
- [ ] Parallel lead/config fetches (Performance)
- [ ] TTL for processed_webhook_events (Issue #13)
- [ ] Composite unique index (Issue #12)
- [ ] Improve error context in logs (Issue #15)

### Phase 4: LOW (Polish)
- [ ] Remove `as any` type casts (Issue #14)
- [ ] Audit all naming conventions (Issue #9)
- [ ] Add comprehensive documentation (Issue #16)

---

## Summary & Grading

### Current State: B+ (Good with Concerns)

**Strengths**:
- ✓ Sophisticated idempotency implementation
- ✓ Multi-tenant isolation (mostly correct)
- ✓ Signature verification
- ✓ Zod validation
- ✓ Recording cleanup on errors
- ✓ Exponential backoff retry logic

**Critical Issues**:
- ✗ Missing org_id filters on 3 UPDATE statements (HIGH)
- ✗ Inverted idempotency sequence (HIGH)
- ✗ No transaction boundaries (HIGH)

**After Fixes: A- (Production Ready)**

---

## Appendix: Code Examples

### Example 1: Safe Multi-Tenant Query
```typescript
// ✓ CORRECT: Always include org_id
const { data: record, error } = await supabase
  .from('call_logs')
  .update({ status: 'completed' })
  .eq('vapi_call_id', call.id)
  .eq('org_id', orgId);  // ← CRITICAL
```

### Example 2: Safe Idempotency Sequence
```typescript
// ✓ CORRECT: Mark BEFORE modifications

const eventId = `event:${call.id}`;

// 1. Check idempotency
const { data: existing } = await supabase
  .from('processed_webhook_events')
  .select('id')
  .eq('event_id', eventId)
  .maybeSingle();

if (existing) return;  // Early exit

// 2. Mark as processed FIRST
const { error: markError } = await supabase
  .from('processed_webhook_events')
  .insert({ event_id: eventId });

if (markError) throw markError;

// 3. NOW safe to modify
const { error } = await supabase
  .from('call_logs')
  .update({...});
```

### Example 3: Transactional RPC Function
```sql
-- ✓ CORRECT: All operations atomic

CREATE OR REPLACE FUNCTION create_call_atomically(
  p_org_id UUID,
  p_vapi_call_id TEXT,
  p_agent_id UUID
) RETURNS TABLE (
  tracking_id UUID,
  logs_id UUID
) AS $$
BEGIN
  INSERT INTO call_tracking (org_id, vapi_call_id, agent_id, status)
  VALUES (p_org_id, p_vapi_call_id, p_agent_id, 'ringing')
  RETURNING id INTO tracking_id;

  INSERT INTO call_logs (org_id, vapi_call_id, agent_id, status)
  VALUES (p_org_id, p_vapi_call_id, p_agent_id, 'in_progress')
  RETURNING id INTO logs_id;

  RETURN NEXT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;  -- Auto-rollback
END $$
LANGUAGE plpgsql
SECURITY DEFINER;
```

---

**Review Complete** ✓

Senior Engineer Recommendation: **Address Phase 1 (CRITICAL) issues before production deployment. Overall architecture is sound with targeted fixes needed.**
