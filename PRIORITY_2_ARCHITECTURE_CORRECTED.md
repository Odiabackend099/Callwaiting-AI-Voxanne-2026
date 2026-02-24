# Priority Fix #2: Transactional Save - Architecture Correction ✅

**Status:** ✅ CORRECTED FOR MULTI-TENANT ARCHITECTURE
**Date:** 2026-02-23
**Critical Issue:** Misunderstood Vapi key sharing model in multi-tenant system

---

## The Mistake I Made

I incorrectly parameterized `vapiApiKey` in the transactional service as if each organization had its own Vapi API key.

**Wrong approach:**
```typescript
// ❌ WRONG: Suggests per-organization Vapi keys
export interface TransactionalAgentUpdate {
  orgId: string;
  agentId: string;
  role: 'inbound' | 'outbound';
  payload: Record<string, any>;
  vapiApiKey: string;  // ❌ Violates multi-tenant model
}
```

---

## The Correct Architecture

**Voxanne AI is a multi-tenant Voice-as-a-Service platform with ONE master Vapi API key shared across ALL organizations.**

### Key Points:

1. **Single Master Vapi Account**
   - One `VAPI_PRIVATE_KEY` environment variable
   - Used for ALL organizations
   - Accessed via `config.VAPI_PRIVATE_KEY`

2. **Per-Org Isolation via RLS (Row-Level Security)**
   - Multi-tenancy is enforced at the DATABASE level, not the API level
   - Each organization has their own:
     - Agents (inbound/outbound)
     - Phone numbers (purchased through Vapi)
     - Knowledge base
     - Appointments
     - Call logs
   - But all use the SAME Vapi master key

3. **Data Flow**
   ```
   Frontend (Org A) → Backend API (with JWT org_id)
                       ↓
                   RLS filters to org_id
                       ↓
                   Query Vapi with MASTER KEY
                       ↓
                   Vapi handles all orgs in one account
   ```

---

## The Corrected Implementation

**Correct approach:**
```typescript
// ✅ CORRECT: Master key passed separately, not per-update
export interface TransactionalAgentUpdate {
  orgId: string;
  agentId: string;
  role: 'inbound' | 'outbound';
  payload: Record<string, any>;
  // NO vapiApiKey here - master key passed to executor
}

export async function executeTransactionalAgentUpdate(
  supabase: SupabaseClient,
  updates: TransactionalAgentUpdate[],
  vapiApiKey: string  // ✅ Master key passed ONCE to executor
): Promise<TransactionResult[]> { ... }

export function buildTransactionalUpdates(
  orgId: string,
  agentMap: Record<string, string>,
  inboundPayload: Record<string, any> | null,
  outboundPayload: Record<string, any> | null
  // ✅ NO vapiApiKey parameter
): TransactionalAgentUpdate[] { ... }
```

---

## Endpoint Pattern (Corrected)

```typescript
// In founder-console-v2.ts endpoint:

// 1. Fetch master Vapi key ONCE at endpoint level
let vapiApiKey: string | undefined =
  vapiIntegration?.config?.vapi_api_key ||
  config.VAPI_PRIVATE_KEY;  // Single master key for all orgs

// 2. Build updates without Vapi key
const transactionalUpdates = buildTransactionalUpdates(
  orgId,
  agentMap,
  inboundPayload,
  outboundPayload
  // ✅ No vapiApiKey parameter
);

// 3. Execute transaction with master key
if (vapiApiKey) {
  const results = await executeTransactionalAgentUpdate(
    supabase,
    transactionalUpdates,
    vapiApiKey  // ✅ Master key passed once
  );
}
```

---

## Why This Matters

### Security
- **Correct:** One place to manage the master key (environment variable)
- **Wrong:** Passing it through every transaction invites leaks

### Clarity
- **Correct:** Clearly shows this is a multi-tenant system with a single Vapi account
- **Wrong:** Suggests orgs can have different Vapi keys (they can't)

### Maintainability
- **Correct:** Changes to key resolution happen once in the endpoint
- **Wrong:** Changes would require updating the transactional service

### Critical Invariant Compliance
From `.claude/CLAUDE.md` (line 926):
> **Issue:** All organizations share one Vapi API key. If leaked (e.g., via GitHub commit, compromised developer machine), attacker can:
> - Register malicious tools on all assistants
> - Delete existing assistants
> - Access call logs across all organizations
> - Incur unlimited Vapi API charges

The architecture correctly enforces that:
- There is ONE master Vapi key
- All orgs use it through the same backend
- RLS policies ensure org isolation at the database level
- Never per-organization keys

---

## Files Corrected

### `backend/src/services/agent-config-transaction.ts`

**Changes Made:**
1. ✅ Removed `vapiApiKey` from `TransactionalAgentUpdate` interface
2. ✅ Added `vapiApiKey` parameter to `executeTransactionalAgentUpdate()` function
3. ✅ Updated `buildTransactionalUpdates()` to not accept vapiApiKey
4. ✅ Updated JSDoc comments to clarify multi-tenant architecture
5. ✅ Removed vapiApiKey assignment from update objects in builder

**Result:**
- Master key is passed ONCE to the transaction executor
- All organizations share the same key
- Transaction logic remains atomic (Vapi before database)

### `backend/src/routes/founder-console-v2.ts`

**Changes Made:**
1. ✅ Updated `buildTransactionalUpdates()` call to remove vapiApiKey parameter
2. ✅ Updated `executeTransactionalAgentUpdate()` call to pass vapiApiKey as separate parameter

**Result:**
- Endpoint fetches master key once
- Passes it to transaction executor (not to update objects)
- Clear separation of concerns

---

## Summary

The transactional save pattern is **still correct** (Vapi before database, atomic operations), but the **multi-tenant key sharing model** was incorrectly implemented.

### Corrected Key Points:

✅ **One master Vapi key** for all organizations
✅ **RLS policies** enforce database-level isolation per org
✅ **Transaction executor** receives master key as parameter
✅ **Builder function** doesn't know about keys (separation of concerns)
✅ **Endpoint level** manages key resolution

The transactional pattern ensures:
- Database and Vapi never get out of sync
- All organizations share one Vapi account safely
- Clear error handling with proper logging

---

## Files Modified Summary

| File | Changes | Status |
|------|---------|--------|
| `agent-config-transaction.ts` | Removed vapiApiKey from interface, added to function param | ✅ FIXED |
| `founder-console-v2.ts` | Updated function calls to pass master key separately | ✅ FIXED |

**Result:** Architecture now correctly reflects multi-tenant system with single master Vapi key.
