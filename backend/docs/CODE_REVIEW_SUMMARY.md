# Code Review Summary - One Page Quick Reference

**Date**: December 21, 2025
**File Reviewed**: `src/routes/webhooks.ts` (1205 lines)
**Overall Grade**: B+ → A- (after fixes)

---

## What Are Transactions?

A **transaction** is an atomic sequence of database operations that either ALL succeed or ALL fail. Think: charging a customer's card AND creating an order must happen together, not separately. PostgreSQL automatically wraps transactions and rolls back all changes if any step fails.

**Your Implementation**: Using RPC functions for atomic operations (good) + client-side multiple calls (risky without transactions).

---

## 🔴 CRITICAL ISSUES (Fix Before Production)

### 1. Missing org_id in UPDATE WHERE Clauses (3 locations)
```
RISK: Could update wrong organization's call data
LOCATIONS:
- Line 680: handleCallEnded (call_logs update)
- Line 1108: handleEndOfCallReport (call_logs update)
- Line 1122: handleEndOfCallReport (calls table update)

FIX: Add .eq('org_id', orgId) to all UPDATE statements
```

### 2. Inverted Idempotency Sequence (handleCallEnded)
```
RISK: Webhooks processed multiple times if service crashes
CURRENT: Check → Update → Mark as processed (WRONG)
CORRECT: Check → Mark as processed → Update (RIGHT)

See handleCallStarted (lines 328-362) for correct pattern
```

### 3. No Transactions for Multi-Step Operations
```
RISK: Data consistency issues if service crashes mid-operation
EXAMPLE: Create call_tracking succeeds, but call_logs insert fails
         → Orphaned call_tracking record

SOLUTION 1: Wrap critical operations in RPC function
SOLUTION 2: Use webhook event queue with retry logic
```

---

## 🟠 HIGH-PRIORITY ISSUES (First Sprint)

### 4. Race Condition - Check-Then-Act (TOCTOU)
```
RISK: Concurrent webhooks could cause duplicate key errors
MITIGATION: Retry with exponential backoff (already implemented)
IDEAL: Handle INSERT conflict gracefully instead of retry
```

### 5. Weak Transcript Idempotency Key
```
PROBLEM: Using timestamp bucket (1-second window) + substring(0, 50)
RISK: Identical phrases or similar transcripts treated as duplicates
FIX: Use SHA256 hash of full transcript content
```

### 6. Cascading Error Handling
```
PROBLEM: call_logs update fails but continues to calls table update
RISK: Inconsistent state (call_logs null, calls completed)
FIX: Throw immediately on error, don't continue
```

### 7. Silent Data Loss (Transcripts)
```
PROBLEM: If call_tracking not found after retries, transcript dropped
RISK: User sees call with no transcript
FIX: Queue for retry instead of silently dropping
```

### 8. WebSocket Broadcast Not Retried
```
PROBLEM: If broadcast fails, database is consistent but UI never updates
RISK: User sees outdated call status
FIX: Queue broadcasts for retry
```

---

## ✅ WHAT YOU'RE DOING RIGHT

- ✓ Signature verification before processing
- ✓ Zod schema validation
- ✓ Agent lookup with error throwing
- ✓ Lead access with double org_id filter
- ✓ Recording cleanup on errors
- ✓ Exponential backoff retry logic
- ✓ Proper idempotency check in handleCallStarted

---

## 📊 Multi-Tenant Data Leakage Risk Assessment

| Area | Status | Risk |
|------|--------|------|
| Agent lookup | ✅ PASS | Low |
| Lead access | ✅ PASS | Low |
| Call logs INSERT | ✅ PASS | Low |
| Call logs UPDATE | ❌ FAIL | **MEDIUM** |
| Calls UPDATE | ❌ FAIL | **MEDIUM** |
| Recording queue | ✅ PASS | Low |
| RAG context | ✅ PASS | Low |
| WebSocket broadcast | ⚠️ DEPENDS | Medium (frontend validation needed) |

---

## 🛠️ Implementation Priority

### Phase 1: CRITICAL (Before Launch)
1. Add org_id filters to 3 UPDATE statements
2. Fix idempotency sequence in handleCallEnded
3. Implement RPC transaction wrapper for multi-step operations

**Estimated Time**: 2-3 hours

### Phase 2: HIGH (First Week)
4. Improve transcript idempotency with hash
5. Fix cascading error handling
6. Queue retries for transcripts & broadcasts

**Estimated Time**: 4-6 hours

### Phase 3: MEDIUM (Next Sprint)
7. Parallel lead/config fetches (performance)
8. Add TTL to processed_webhook_events table
9. Improve error context in logging

**Estimated Time**: 3-4 hours

---

## 📋 Database & Transaction Best Practices

### Current Transaction Architecture
- **RPC Functions**: Atomic (good for config updates)
- **Webhook Handlers**: Sequential calls (risky without transactions)
- **Isolation Level**: READ COMMITTED (appropriate for your use case)
- **Org Isolation**: WHERE clause filtering (works but needs org_id in ALL queries)

### Recommendations
1. **Add NOT NULL constraint** to org_id columns
2. **Create composite indexes**: `(org_id, vapi_call_id)` for faster lookups
3. **Add TTL cleanup**: Delete processed_webhook_events older than 30 days
4. **Enable RLS**: Row-Level Security on all org-scoped tables (defense-in-depth)

---

## 🔐 Security Summary

**Vulnerabilities**: 3 MEDIUM-severity issues (missing org_id filters)
**Exploit Difficulty**: HARD (requires specific data conditions + timing)
**Impact**: Cross-organization data read/update

**Mitigations in Place**:
- ✓ Signature verification
- ✓ Schema validation (Zod)
- ✓ Multi-tenant isolation (mostly correct)
- ✓ Foreign key constraints

---

## 🎯 Code Quality Issues

### Naming (Minor)
- Mostly consistent (camelCase for variables, SCREAMING_SNAKE_CASE for constants)
- Good: Descriptive function names
- Improvement: Remove `as any` type casts

### Error Handling (Moderate)
- ✓ Good: Signature verification, Zod validation
- ⚠️ Needs: Better error context in logs
- ❌ Bad: Silent failures in handleTranscript

### Type Safety (Minor)
- ⚠️ Some `as any` casts bypass TypeScript
- Solution: Properly type metadata objects

---

## 📝 Quick Fix Checklist

Before production:
- [ ] Add org_id to UPDATE WHERE clauses (3 locations)
- [ ] Move "mark as processed" BEFORE updates (handleCallEnded)
- [ ] Create RPC function for atomic multi-table operations
- [ ] Add NOT NULL constraint to org_id
- [ ] Test with concurrent webhooks
- [ ] Document transaction semantics in code comments

---

## Full Review Location

See `backend/CODE_REVIEW.md` for:
- Detailed code examples
- Transaction implementation patterns
- Security vulnerability assessment
- Database schema improvements
- Appendix with fix patterns

---

**Next Step**: Address Phase 1 issues before production launch. Code is fundamentally sound with targeted fixes needed for data consistency and security.
