# API Endpoint Audit - Fix Hardcoded Caller Name

## Summary
Audit revealed one critical bug in Call Logs endpoint where `caller_name` is hardcoded to return 'inbound'/'outbound' instead of actual contact names. All other endpoints (Dashboard, Recent Activity, Hot Leads, Leads) use real database queries with no hardcoded values.

## Critical Bug Identified

**File**: `backend/src/routes/calls-dashboard.ts` line 145

**Issue**: Hardcoded caller_name logic
```typescript
caller_name: call.call_type || (call.call_direction === 'outbound' ? 'Outbound Call' : 'Unknown')
```

**Impact**: Call Logs page shows 'inbound'/'outbound' instead of actual contact names

## Implementation Plan

### Step 1: Add LEFT JOIN with contacts table

**Location**: `backend/src/routes/calls-dashboard.ts` line ~120-145 (main list endpoint)

**Current Query**:
```typescript
const { data: calls, error, count } = await supabase
  .from('calls')
  .select('*', { count: 'exact' })
  .eq('org_id', orgId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

**New Query with JOIN**:
```typescript
const { data: calls, error, count } = await supabase
  .from('calls')
  .select(`
    *,
    contacts:contact_id (
      first_name,
      last_name,
      company_name
    )
  `, { count: 'exact' })
  .eq('org_id', orgId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

### Step 2: Update caller_name resolution logic

**Location**: `backend/src/routes/calls-dashboard.ts` line 145

**Replace**:
```typescript
caller_name: call.call_type || (call.call_direction === 'outbound' ? 'Outbound Call' : 'Unknown'),
```

**With**:
```typescript
caller_name: (() => {
  // For outbound calls, use contact name from JOIN
  if (call.call_direction === 'outbound' && call.contacts) {
    const { first_name, last_name, company_name } = call.contacts;
    if (first_name || last_name) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    if (company_name) {
      return company_name;
    }
  }

  // For inbound calls, use existing caller_name from database
  if (call.caller_name) {
    return call.caller_name;
  }

  // Fallback for missing data
  return call.call_direction === 'outbound' ? 'Unknown Contact' : 'Unknown Caller';
})(),
```

### Step 3: Apply same fix to single call detail endpoint

**Location**: `backend/src/routes/calls-dashboard.ts` line ~350+ (GET /api/calls-dashboard/:callId)

Apply the same:
1. Add LEFT JOIN with contacts table in the query
2. Update caller_name resolution logic

## Testing Plan

### 1. Start Development Server
```bash
cd backend
npm run dev
```

### 2. Test Call Logs List Endpoint
```bash
curl http://localhost:3000/api/calls-dashboard?page=1&limit=20
```

**Verify**:
- Outbound calls show contact name (e.g., "John Smith", "ABC Company")
- Inbound calls show caller_name from database
- No calls show "inbound", "outbound", or "Outbound Call"
- All other fields intact (sentiment, outcome, recording URLs)

### 3. Test Single Call Detail Endpoint
```bash
curl http://localhost:3000/api/calls-dashboard/{callId}
```

**Verify**:
- Same caller_name resolution logic works
- No regressions in other fields

### 4. Verify Other Endpoints (No Changes Expected)
```bash
# Dashboard stats (already uses real DB queries)
curl http://localhost:3000/api/calls-dashboard/stats

# Recent activity (already uses real DB queries)
curl http://localhost:3000/api/analytics/recent-activity

# Hot leads (already uses real DB queries)
curl http://localhost:3000/api/dashboard/hot-leads

# Leads list (already uses real DB queries)
curl http://localhost:3000/api/contacts

# Call Back action (already uses Vapi API)
curl -X POST http://localhost:3000/api/contacts/{id}/call-back

# SMS action (already uses Twilio API)
curl -X POST http://localhost:3000/api/contacts/{id}/sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Test message"}'
```

## Audit Results Summary

### ✅ Dashboard Page - All Real Database Queries
- Total Volume: Uses RPC function `get_dashboard_stats_optimized`
- Average Duration: Uses RPC function `get_dashboard_stats_optimized`
- All Caught Up / No Urgent Leads: Uses `hot_lead_alerts` table
- Recent Activity: Combines data from `calls`, `hot_lead_alerts`, `appointments` tables
- **No hardcoded values found**

### ❌ Call Logs Page - One Bug Found
- Date & Time: ✅ Uses `created_at` from database
- Caller: ❌ **BUG** - Hardcoded to return 'inbound'/'outbound'
- Duration: ✅ Uses `duration` from database
- Status: ✅ Uses `status` from database
- Sentiment: ✅ Uses `sentiment_label` from database
- Outcome Summary: ✅ Uses `outcome_summary` from database
- Recording: ✅ Uses signed URL generation (correct implementation)

### ✅ Leads Page - All Real Database/API Integrations
- Call Back: Uses Vapi API for outbound calls
- SMS: Uses Twilio API for SMS sending
- **No hardcoded values found**

## Implementation Steps

1. ✅ Read PRD for context
2. ✅ Use Senior Engineer prompt
3. ✅ Use 3-step coding principle (Planning → Implementation → Testing)
4. ✅ Explore codebase and identify bugs
5. ⏳ Fix hardcoded caller_name in calls-dashboard.ts
6. ⏳ Test endpoints in dev mode (npm run dev)
7. ⏳ Verify all Call Logs fields return correct data

## Success Criteria

- [ ] Call Logs page shows actual contact names for outbound calls
- [ ] Call Logs page shows caller_name from database for inbound calls
- [ ] No calls display "inbound", "outbound", or "Outbound Call"
- [ ] All other fields remain functional (sentiment, outcome, recording, etc.)
- [ ] No regressions in Dashboard, Recent Activity, Hot Leads, or Leads endpoints
- [ ] Server runs successfully in dev mode without JWT authentication
