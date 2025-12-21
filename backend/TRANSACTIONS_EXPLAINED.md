# Transactions Explained: A Non-Technical Guide

**Purpose**: Help you understand what transactions are, why they matter, and how Voxanne backend uses them.

---

## The Simplest Explanation

Imagine you're at a vending machine:
1. You insert $5
2. You press "Soda" button
3. Machine gives you soda
4. Machine gives you $0.50 change

Now imagine if these happened separately **without guarantees**:
1. You insert $5 ✓ (money gone)
2. You press "Soda"
3. **Machine crashes** 💥
4. You never get soda, never get change
5. Machine loses $5

**With transaction protection**, if the machine crashes at step 2, either:
- **Everything succeeds** (you get soda + change)
- **Nothing happens** (your $5 is still there, machine is fine)

**No middle ground where you're stuck.**

---

## In Programming Terms

### Without Transaction (Dangerous)
```typescript
// Step 1: Debit account A
accountA.balance -= 100;
saveToDatabase(accountA);

// ← SERVICE CRASHES HERE? Your money is gone!

// Step 2: Credit account B
accountB.balance += 100;
saveToDatabase(accountB);
```

**Result if crash between steps**:
- Account A: -100 ✓
- Account B: +0 ✗ (never happened)
- **Total money in system**: -100 (LOST!)

### With Transaction (Safe)
```typescript
BEGIN TRANSACTION;

  accountA.balance -= 100;
  saveToDatabase(accountA);

  // ← SERVICE CRASHES HERE?

  accountB.balance += 100;
  saveToDatabase(accountB);

COMMIT;  // Only happens if BOTH operations succeed
```

**Result if crash between steps**:
- ROLLBACK automatically happens
- Account A: unchanged
- Account B: unchanged
- **Total money in system**: intact ✓

---

## In Your Voxanne Backend

### The Problem: Webhook Handlers Without Transactions

When an inbound call arrives, your code does this:
```
1. Create call_tracking record in database
   ↓ (waiting...)
2. Create call_logs record in database
   ↓ (waiting...)
3. Update call_tracking with final status
   ↓ (waiting...)
```

**What if service crashes between steps 1 and 2?**
- call_tracking created ✓
- call_logs never created ✗
- **Result**: Call exists in call_tracking but not in call_logs
- **Frontend**: Confused - shows call started but no call log

### Better: Transaction Wrapper
```sql
CREATE FUNCTION create_call_atomically(...) AS $$
BEGIN
  INSERT INTO call_tracking (...) VALUES (...);
  INSERT INTO call_logs (...) VALUES (...);
  UPDATE call_tracking SET status = 'ringing';

  -- If any of these fail, ALL are undone
  RETURN result;
END $$;
```

**If service crashes**: Either all succeed or all fail. No partial states.

---

## Real Scenario: Data Leakage Due to Missing org_id Filter

### Bad Code (Your Current Issue)
```typescript
// Update call logs
const { error } = await supabase
  .from('call_logs')
  .update({ status: 'completed' })
  .eq('vapi_call_id', call.id);  // ← Only filtered by call ID

// If vapi_call_id happens to be the same across organizations:
// Could update BOTH Organization A and Organization B's records!
```

### Good Code (With Transaction + org_id)
```typescript
const { error } = await supabase
  .from('call_logs')
  .update({ status: 'completed' })
  .eq('vapi_call_id', call.id)
  .eq('org_id', orgId);  // ← ADD THIS

// Within a transaction:
BEGIN TRANSACTION;
  UPDATE call_logs
  SET status = 'completed'
  WHERE vapi_call_id = ? AND org_id = ?;

  UPDATE calls
  SET status = 'completed'
  WHERE vapi_call_id = ? AND org_id = ?;
COMMIT;
// Now both updates are atomic AND org-safe
```

---

## Isolation Levels Explained

When multiple users access the database simultaneously, transactions can interact. **Isolation levels** control how much they interfere:

### Level 1: READ UNCOMMITTED (Dangerous)
```
User A: Inserts account transfer data (uncommitted)
User B: Reads account balance (includes User A's uncommitted data)
User A: Crashes, transaction ROLLS BACK
User B: Based decision on data that doesn't exist!
```
❌ **Not recommended**

### Level 2: READ COMMITTED ✓ (Your Current Setup)
```
User A: Inserts account transfer (uncommitted)
User B: Reads account balance (waits until User A commits)
User A: Commits successfully
User B: Reads new balance (sees final state)
```
✓ **Good for most cases** (You're using this)

### Level 3: REPEATABLE READ
```
User A: Starts transaction, reads balance
User B: Updates balance, commits
User A: Reads balance again (sees OLD value, not User B's changes)
User A: Makes decision based on consistent state
```
✓ **Good for complex queries**

### Level 4: SERIALIZABLE (Strict)
```
Everything runs as if transactions happened one-at-a-time
No concurrent access at all
```
❌ **Slowest, only for financial transactions**

**Voxanne Recommendation**: Keep READ COMMITTED. Your org_id filtering provides sufficient isolation.

---

## Transaction Patterns in Your Code

### Pattern 1: RPC Function (GOOD - Atomic)
```sql
CREATE FUNCTION update_agent_config(...) RETURNS JSONB AS $$
BEGIN
  UPDATE agents SET ...;
  UPSERT integrations SET ...;
  UPSERT integrations SET ...;
  RETURN result;

  -- Everything commits together or rolls back together
END $$;
```
**Why Good**: PostgreSQL handles atomicity automatically inside function.

### Pattern 2: Webhook Handler (RISKY - No Transaction)
```typescript
// handleCallStarted
const { data: result1 } = await supabase
  .from('call_tracking')
  .insert({...});

// ← Service could crash here

const { data: result2 } = await supabase
  .from('call_logs')
  .insert({...});

// ← Orphaned call_tracking if this fails
```
**Why Risky**: Multiple database calls with no atomic guarantee.

### Pattern 3: Idempotency (Mitigates Risk)
```typescript
// Mark as processed FIRST
const { error } = await supabase
  .from('processed_webhook_events')
  .insert({ event_id, ... });

// THEN do operations
await supabase.from('call_tracking').insert({...});
await supabase.from('call_logs').insert({...});

// If webhook retried:
// - Idempotency check finds event_id
// - Returns early, doesn't re-process
// - No duplicate inserts
```
**Why Good**: Even without transaction, idempotency prevents duplicates.

---

## Why Voxanne Needs Transactions

### Scenario 1: Inbound Call Processing
```
Call arrives:
1. Create call_tracking (org_id = "Clinic A")
2. Create call_logs (org_id = "Clinic A")
3. Update call_tracking status = "ringing"

If step 2 fails:
- call_tracking exists but call_logs doesn't
- Dashboard queries call_logs, finds nothing
- Shows incomplete call
- Clinic A confused: "We took the call but lost the log"
```

### Scenario 2: Recording Upload
```
After call ends:
1. Update call_logs (recording_url = "s3://...")
2. Update calls (status = "completed")
3. Queue recording for upload

If step 2 fails:
- call_logs marked as completed
- calls not updated
- Recording queued
- Inconsistent state: are we still processing or done?
```

### Solution: Wrap in Transaction
```typescript
// All-or-nothing
BEGIN TRANSACTION;
  UPDATE call_logs SET recording_url = ...;
  UPDATE calls SET status = 'completed';
  INSERT INTO recording_upload_queue ...;
COMMIT;
// Either all happen or none do
```

---

## Common Misconceptions

### ❌ "Transactions are slow"
✓ **Reality**: Correct transactions PREVENT slow recovery.
- Without transactions: Must manually fix inconsistent data
- With transactions: Database handles it automatically

### ❌ "My code already has error handling, I don't need transactions"
✓ **Reality**: Error handling + idempotency is NOT the same as transactions.
- Error handling can log failures, but data might be partially updated
- Transactions guarantee all-or-nothing atomicity

### ❌ "Transactions only matter for financial systems"
✓ **Reality**: Any multi-step operation benefits from transactions.
- Phone calls (like Voxanne): need atomic call_tracking + call_logs
- Orders: need atomic inventory reduction + order creation
- User registration: need atomic user creation + org assignment

### ✓ "Transactions have isolation levels"
✓ **Reality**: Correct! Different levels prevent different problems.
- Level 1: Prevents dirty reads
- Level 2: Prevents dirty reads + non-repeatable reads
- Level 3: Prevents all of above + phantom reads
- Level 4: Strictest, prevents everything

---

## Voxanne-Specific Recommendations

### For Your Webhook Handlers:

**Option A: Simplest - Use RPC Function**
```sql
-- In migration file
CREATE FUNCTION handle_call_started(
  p_org_id UUID,
  p_vapi_call_id TEXT,
  p_agent_id UUID,
  p_phone TEXT
) RETURNS TABLE (
  call_tracking_id UUID,
  call_logs_id UUID
) AS $$
BEGIN
  INSERT INTO call_tracking (org_id, agent_id, vapi_call_id, phone, status)
  VALUES (p_org_id, p_agent_id, p_vapi_call_id, p_phone, 'ringing')
  RETURNING id INTO call_tracking_id;

  INSERT INTO call_logs (org_id, agent_id, vapi_call_id, status)
  VALUES (p_org_id, p_agent_id, p_vapi_call_id, 'in_progress')
  RETURNING id INTO call_logs_id;

  RETURN NEXT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;  -- Auto-rollback
END $$
LANGUAGE plpgsql
SECURITY DEFINER;
```

Then in webhook handler:
```typescript
const { data, error } = await supabase.rpc('handle_call_started', {
  p_org_id: agent.org_id,
  p_vapi_call_id: call.id,
  p_agent_id: agent.id,
  p_phone: call.customer?.number
});

if (error) throw error;

// Database state is now consistent
// Safe to do external calls (Vapi, WebSocket)
await injectRagContextIntoAgent({...});
wsBroadcast({...});
```

**Option B: Queue-Based - Use Webhook Event Queue**
```
1. Insert webhook event to queue (single operation)
2. Separate worker processes queue atomically
3. Can retry failed events automatically
4. Good for scaling to multiple workers
```

---

## Summary: Transaction Checklist

Before deploying webhooks to production, ensure:

- [ ] **Critical database operations wrapped in transaction**
  - All-or-nothing guarantee
  - Auto-rollback on error

- [ ] **org_id filter on EVERY database query**
  - Prevents cross-organization data leakage
  - Required in WHERE clause for UPDATE/DELETE

- [ ] **Idempotency marker strategy**
  - Mark event as processed BEFORE modifications
  - Retry detection prevents duplicate work

- [ ] **Error handling with proper status codes**
  - 500: Internal error (Vapi will retry)
  - 401: Invalid signature (Vapi won't retry)
  - 400: Invalid data (Vapi won't retry)

- [ ] **Logging with context**
  - Include org_id, vapi_call_id, error message
  - Helps debug data consistency issues

- [ ] **Testing for concurrency**
  - Simulate concurrent webhooks
  - Verify no duplicate processing
  - Verify no data leakage between orgs

---

## Next Steps

1. **Read** `CODE_REVIEW.md` for detailed fix recommendations
2. **Implement** Phase 1 fixes (critical org_id issues)
3. **Test** with concurrent webhooks
4. **Monitor** logs for data consistency issues
5. **Schedule** Phase 2 fixes (retry queues, etc.)

Your backend is fundamentally sound. With these transaction/isolation improvements, it will be production-ready.
