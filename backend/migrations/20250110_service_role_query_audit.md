# Service Role Query Audit Report
**Date:** 2025-01-10  
**Context:** Zero-Trust Warden Phase 1 - Service Role Query Audit  
**Priority:** P1 HIGH

---

## EXECUTIVE SUMMARY

Audited all service role queries (queries using `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS). Found **3 critical violations** where queries do not filter by `org_id`, potentially processing data across all tenants.

---

## CRITICAL VIOLATIONS

### ❌ Violation #1: Orphan Recording Cleanup (CRITICAL)

**File:** `backend/src/jobs/orphan-recording-cleanup.ts`  
**Line:** 28-33  
**Issue:** Queries `call_logs` table WITHOUT `org_id` filter

```typescript
// ❌ CURRENT CODE - No org_id filter
const { data: orphans, error } = await supabase
  .from('call_logs')
  .select('id, recording_storage_path, recording_uploaded_at, created_at')
  .not('recording_storage_path', 'is', null)
  .is('recording_url', null)
  .lt('recording_uploaded_at', sevenDaysAgo);
```

**Impact:** 
- Processes orphaned recordings from ALL orgs in a single query
- No tenant isolation during processing
- Potential performance issues as data grows
- No audit trail of which org's data is being processed

**Required Fix:**
```typescript
// ✅ FIXED - Process per-org (recommended approach)
async function detectOrphanedRecordingsForOrg(orgId: string): Promise<OrphanedRecording[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orphans, error } = await supabase
    .from('call_logs')
    .select('id, recording_storage_path, recording_uploaded_at, created_at, org_id')
    .eq('org_id', orgId)  // ✅ CRITICAL: Filter by org_id
    .not('recording_storage_path', 'is', null)
    .is('recording_url', null)
    .lt('recording_uploaded_at', sevenDaysAgo);

  if (error) {
    logger.error('OrphanCleanup', `Failed to detect orphaned recordings for org ${orgId}: ${error.message}`);
    return [];
  }

  return orphans || [];
}

// Main job processes all orgs but in isolated batches
export async function runOrphanCleanupJob(): Promise<void> {
  // Get all active orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('status', 'active');

  if (!orgs || orgs.length === 0) return;

  // Process each org separately (tenant isolation)
  for (const org of orgs) {
    const orphans = await detectOrphanedRecordingsForOrg(org.id);
    // ... process orphans for this org
  }
}
```

**Alternative (if processing all orgs is intended):**
```typescript
// ✅ ALTERNATIVE - Add org_id to results for audit trail
.select('id, recording_storage_path, recording_uploaded_at, created_at, org_id')
// Log org_id when processing each orphan for audit trail
```

---

### ❌ Violation #2: Recording Queue Worker (CRITICAL)

**File:** `backend/src/jobs/recording-queue-worker.ts`  
**Line:** 208-214  
**Issue:** Queries `recording_upload_queue` table WITHOUT `org_id` filter

```typescript
// ❌ CURRENT CODE - No org_id filter
const { data: queueItems, error: fetchError } = await supabase
  .from('recording_upload_queue')
  .select('*')
  .eq('status', 'pending')
  .order('priority', { ascending: false })
  .order('created_at', { ascending: true })
  .limit(BATCH_SIZE);
```

**Impact:**
- Processes upload queue items from ALL orgs in a single batch
- No tenant isolation during processing
- Could process items from different orgs in the same batch (mixing tenant data)
- No org_id in SELECT (missing from audit trail)

**Required Fix:**
```typescript
// ✅ FIXED - Process per-org batches
async function processQueueForOrg(orgId: string): Promise<void> {
  const { data: queueItems, error: fetchError } = await supabase
    .from('recording_upload_queue')
    .select('*')
    .eq('org_id', orgId)  // ✅ CRITICAL: Filter by org_id
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  
  // ... process items for this org
}

// Main worker processes all orgs but in isolated batches
export async function processRecordingQueue(): Promise<void> {
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('status', 'active');

  if (!orgs || orgs.length === 0) return;

  // Process each org separately (tenant isolation)
  for (const org of orgs) {
    await processQueueForOrg(org.id);
  }
}
```

---

### ⚠️ Violation #3: Recording Upload Retry (MEDIUM)

**File:** `backend/src/services/recording-upload-retry.ts`  
**Line:** 69-74  
**Issue:** Queries `failed_recording_uploads` table WITHOUT `org_id` filter

```typescript
// ⚠️ CURRENT CODE - No org_id filter (but gets org_id later)
const { data: failedUploads, error } = await supabase
  .from('failed_recording_uploads')
  .select('id, call_id, vapi_recording_url, error_message, retry_count, next_retry_at, created_at')
  .is('resolved_at', null)
  .lt('next_retry_at', new Date().toISOString())
  .lt('retry_count', 3);
```

**Status:** PARTIALLY ACCEPTABLE
- Gets `org_id` later from `call_logs` table (Line 90-94)
- Still processes across all orgs in a single query
- Missing `org_id` in SELECT for audit trail

**Recommended Fix:**
```typescript
// ✅ IMPROVED - Add org_id join or filter
// Option 1: Join with call_logs to get org_id upfront
const { data: failedUploads, error } = await supabase
  .from('failed_recording_uploads')
  .select(`
    id, call_id, vapi_recording_url, error_message, retry_count, next_retry_at, created_at,
    call_logs!inner(org_id)
  `)
  .is('resolved_at', null)
  .lt('next_retry_at', new Date().toISOString())
  .lt('retry_count', 3);

// Then filter by org_id before processing:
// const uploadsForOrg = failedUploads.filter(u => u.call_logs.org_id === orgId);
```

---

## ✅ ACCEPTABLE SERVICE ROLE QUERIES

These queries are ACCEPTABLE because they either:
1. Filter by `org_id` explicitly
2. Are used in authenticated routes (where `req.user.orgId` is available)
3. Are aggregation queries that should process all orgs (with explicit documentation)

### ✅ Recording Metrics Monitor (ACCEPTABLE)

**File:** `backend/src/services/recording-metrics.ts`  
**Status:** ACCEPTABLE  
**Reason:** Metrics aggregation queries are designed to aggregate across all orgs for system-level monitoring. However, should add `org_id` to SELECT for future per-org analytics.

**Recommendation:** Add `org_id` to SELECT statements for audit trail and future per-org analytics, but keep aggregation across all orgs for system monitoring.

---

## ✅ AUTHENTICATED ROUTE QUERIES (ACCEPTABLE)

All queries in routes that use `requireAuth` or `requireAuthOrDev` middleware are ACCEPTABLE because:
- They use `req.user.orgId` from authenticated JWT
- They filter by `org_id` using `req.user.orgId`
- They don't bypass RLS (using anon key, not service role)

**Examples:**
- `backend/src/routes/founder-console-v2.ts` - Uses `req.user.orgId`
- `backend/src/routes/knowledge-base.ts` - Uses `req.user.orgId` via `getOrgId(req)`
- `backend/src/routes/calls-dashboard.ts` - Uses `req.user.orgId`

---

## RECOMMENDATIONS

### Immediate Actions (This Week)

1. **Fix Orphan Cleanup Job** (P1 HIGH)
   - Process per-org in isolated batches
   - Add `org_id` to SELECT for audit trail
   - Log which org's data is being processed

2. **Fix Recording Queue Worker** (P1 HIGH)
   - Process per-org batches
   - Add `org_id` to SELECT
   - Prevent cross-tenant data mixing

3. **Improve Recording Upload Retry** (P2 MEDIUM)
   - Add `org_id` join to SELECT
   - Consider per-org processing if queue grows large

### Long-Term Improvements (Week 2-3)

4. **Add ESLint Rule**
   - Rule: Require `.eq('org_id', orgId)` in service role queries
   - Pre-commit hook to block deployments without org_id filter

5. **Add Service Role Query Wrapper**
   ```typescript
   // Helper function that enforces org_id filtering
   function supabaseServiceRoleWithOrg(orgId: string) {
     return {
       from: (table: string) => {
         return supabase.from(table).eq('org_id', orgId);
       }
     };
   }
   ```

6. **Add Audit Logging**
   - Log every service role query with `org_id` context
   - Alert if query doesn't include `org_id` in SELECT or WHERE

---

## TESTING CHECKLIST

After fixes, verify:

- [ ] Orphan cleanup processes each org separately
- [ ] Recording queue worker processes per-org batches
- [ ] All service role queries include `org_id` in SELECT or WHERE
- [ ] No cross-tenant data mixing in background jobs
- [ ] Audit logs show which org's data is being processed

---

## MIGRATION COMPLETE

**Next Steps:**
1. Fix critical violations (orphan cleanup, queue worker)
2. Add ESLint rule to prevent future violations
3. Add service role query wrapper for enforcement
4. Deploy fixes to staging for testing
