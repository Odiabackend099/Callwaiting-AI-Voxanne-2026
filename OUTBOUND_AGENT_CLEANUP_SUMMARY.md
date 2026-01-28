# Outbound Agent Infrastructure Cleanup - Summary

## Executive Summary

Completed comprehensive cleanup of outbound agent infrastructure to establish `agents` table as the single source of truth (SSOT). Removed all legacy references to the deprecated `outbound_agent_config` table.

## Problem Statement

The system had a critical mismatch:
- **SAVE PATH**: Agent Configuration page → `/agent/behavior` → `agents` table
- **READ PATH**: Test page → `/web-test-outbound` → `outbound_agent_config` table (LEGACY)

This caused the test page to show "Outbound agent configuration is incomplete" even when the agent was properly configured.

## Solution

Migrated all code to use `agents` table as the single source of truth, removing all dependencies on the legacy `outbound_agent_config` table.

---

## Files Modified

### 1. Backend Routes

#### `/backend/src/routes/integrations-byoc.ts`
**Line 407-420**: Updated phone number assignment for outbound agents
```typescript
// BEFORE: Wrote to outbound_agent_config table
await supabase
  .from('outbound_agent_config')
  .update({ vapi_phone_number_id: phoneId })
  .eq('org_id', orgId);

// AFTER: Writes to agents table (SSOT)
await supabase
  .from('agents')
  .update({ vapi_phone_number_id: phoneId })
  .eq('role', 'outbound')
  .eq('org_id', orgId);
```

#### `/backend/src/routes/webhooks.ts`
**Line 667-683**: Updated call configuration loading
```typescript
// BEFORE: Dynamic table selection
const configTableName = callType === 'inbound' ? 'inbound_agent_config' : 'outbound_agent_config';
await supabase.from(configTableName).select('*')

// AFTER: Single agents table with role filter
await supabase
  .from('agents')
  .select('*')
  .eq('role', agentRole) // 'inbound' or 'outbound'
```

#### `/backend/src/services/call-type-detector.ts`
**Line 121-132**: Updated `getAgentConfigForCallType` function
```typescript
// BEFORE: Dynamic table selection
const tableName = callType === 'inbound' ? 'inbound_agent_config' : 'outbound_agent_config';
await supabase.from(tableName).select('*')

// AFTER: Single agents table with role filter
await supabase
  .from('agents')
  .select('*')
  .eq('role', agentRole)
```

#### `/backend/src/routes/founder-console-settings.ts`
**Line 517-550**: Removed legacy agent sync call
```typescript
// BEFORE: Called sync-agents endpoint after saving settings
await fetch(`${BACKEND_URL}/api/founder-console/sync-agents`, { method: 'POST' })

// AFTER: Removed - agents table is SSOT, no sync needed
log.info('Settings', 'Skipping legacy agent sync - agents table is SSOT', { orgId });
```

#### `/backend/src/routes/founder-console-v2.ts`
**Line 2429-2431**: Removed default test destination number
```typescript
// BEFORE: Fallback to stored default
const storedDest = settings.test_destination_number;
const destination = testDestinationNumber || storedDest;

// AFTER: Require phone number in request
const destination = testDestinationNumber;
if (!destination) {
  res.status(400).json({ error: 'Test destination number required in request body' });
}
```

**Line 1665-1669**: Removed test destination persistence
```typescript
// BEFORE: Persisted test destination to database
if (testing?.testDestinationNumber) {
  await mergeIntegrationConfig(INTEGRATION_PROVIDERS.VAPI, {
    test_destination_number: testing.testDestinationNumber
  });
}

// AFTER: Removed - test numbers now passed dynamically
// NOTE: Default test destination number removed - now passed dynamically in requests
```

#### `/backend/src/server.ts`
**Line 60, 256**: Disabled legacy agent-sync router
```typescript
// BEFORE: Imported and mounted agent sync router
import agentSyncRouter from './routes/agent-sync';
app.use('/api/founder-console', agentSyncRouter);

// AFTER: Commented out - no longer needed
// DEPRECATED: Agent sync no longer needed - agents table is SSOT
// import agentSyncRouter from './routes/agent-sync';
// app.use('/api/founder-console', agentSyncRouter);
```

---

## Architecture Changes

### Before
```
Agent Config Page → /agent/behavior → agents table
                                     ↓
                                     X (not synced)
                                     ↑
Test Page → /web-test-outbound → outbound_agent_config table (stale data)
```

### After
```
Agent Config Page → /agent/behavior → agents table (SSOT)
                                     ↓
Test Page → /web-test-outbound → agents table (same source)
```

---

## Database Schema

### Active Tables (SSOT)
- **`agents`**: Primary storage for all agent configurations
  - `role` column: 'inbound' | 'outbound'
  - `vapi_phone_number_id`: Phone number for outbound caller ID
  - `vapi_assistant_id`: VAPI assistant ID
  - `system_prompt`, `first_message`, `voice`, etc.

### Deprecated Tables (Legacy - No Longer Used)
- **`outbound_agent_config`**: Deprecated (migration exists for history)
- **`inbound_agent_config`**: Still referenced by some legacy code, but not for outbound

### Migration Files (Preserved for History)
- `backend/migrations/20250111_create_outbound_agent_config.sql` - Kept for reference
- Migration files are not deleted to maintain database history

---

## Testing Checklist

### ✅ Completed
1. Updated phone number assignment to write to `agents` table
2. Updated webhook handler to read from `agents` table
3. Updated call type detector to read from `agents` table
4. Removed agent sync endpoint calls
5. Removed default test destination number field
6. Fixed TypeScript compilation errors

### 🔲 Pending
1. End-to-end test: Trigger outbound call to +2348141995397
2. Verify agent configuration page sync button works
3. Verify test page validation is accurate
4. Verify test page can initiate outbound calls
5. Verify phone number appears correctly as caller ID

---

## Breaking Changes

### API Changes
- **POST `/api/founder-console/agent/test-call`**
  - Now **requires** `testDestinationNumber` in request body
  - No longer falls back to stored default
  - Returns 400 error if phone number not provided

### Removed Features
- Default test destination number setting (removed from UI and backend)
- Agent sync endpoint (no longer called, route disabled)

---

## Security & Multi-tenancy

All changes maintain:
- ✅ Row Level Security (RLS) policies
- ✅ Organization ID filtering on all queries
- ✅ Credential encryption via `IntegrationDecryptor`
- ✅ E.164 phone number validation

---

## Code Quality

- ✅ All TypeScript errors related to changes fixed
- ✅ Consistent naming conventions maintained
- ✅ Comments added explaining deprecations
- ✅ No breaking changes to existing API contracts (except test-call endpoint)

---

## Next Steps

1. **Test End-to-End Flow**
   - Configure outbound agent in dashboard
   - Assign phone number to outbound agent
   - Trigger test call from test page
   - Verify call reaches phone with correct caller ID

2. **Monitor Production**
   - Check logs for any references to outbound_agent_config
   - Verify no errors in production after deployment

3. **Future Cleanup (Optional)**
   - Consider removing `outbound_agent_config` table from database
   - Remove `inbound_agent_config` references if no longer needed
   - Delete archived diagnostic scripts referencing legacy tables

---

## Related Documentation

- Plan file: `/Users/mac/.claude/plans/peaceful-knitting-beacon.md`
- Test script: `backend/src/scripts/trigger-outbound-test-call.ts`
- Migration: `backend/migrations/20250111_create_outbound_agent_config.sql`

---

## Verification Commands

```bash
# Check for remaining outbound_agent_config references
grep -r "outbound_agent_config" backend/src --include="*.ts" | grep -v ".sql" | grep -v "Archived"

# Check TypeScript compilation
cd backend && npx tsc --noEmit

# Test outbound call (requires environment variables)
export SUPABASE_URL="..."
export SUPABASE_ANON_KEY="..."
export TEST_EMAIL="voxanne@demo.com"
export TEST_PASSWORD="..."
npx tsx src/scripts/trigger-outbound-test-call.ts +2348141995397
```

---

**Completion Date**: 2026-01-26
**Status**: ✅ Cleanup Complete | 🔲 Testing Pending
