# Dashboard API Security Audit Report

**Voxanne AI · Callwaiting AI · 2026-02-13**

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| Multi-Tenant Isolation | ✅ PASS | RLS on all 7 tables, 0 orphaned org_ids, 0 FK violations |
| Input Validation | ✅ FIXED | UUID validation + search sanitization added |
| Path Traversal | ✅ FIXED | Recording paths checked for `..` and null bytes |
| Auth Middleware | ✅ PASS | `requireAuthOrDev` on all routes, JWT org_id extraction |
| Error Standardization | ✅ FIXED | Standardized format with `request_id`, `code`, `error` |
| RLS Policies | ✅ PASS | 15 policies across calls, appointments, contacts, organizations |

---

## 1. Multi-Tenant Security

### Database Layer (RLS)

| Table | RLS Enabled | Policies | Service Role Bypass |
|-------|:-----------:|:--------:|:-------------------:|
| `calls` | ✅ | SELECT by org_id, ALL for service_role | ✅ |
| `appointments` | ✅ | CRUD by org_id (via `auth_org_id()`), service_role bypass | ✅ |
| `contacts` | ✅ | CRUD by org_id (via `auth.jwt() → app_metadata`), service_role bypass | ✅ |
| `organizations` | ✅ | ALL by own org_id, service_role bypass | ✅ |
| `profiles` | ✅ | Per-user policies | ✅ |
| `credit_transactions` | ✅ | Org-scoped | ✅ |
| `processed_webhook_events` | ✅ | Service-level | ✅ |

### Application Layer

- **Auth middleware**: `requireAuthOrDev` applied via `callsRouter.use()` (global to all dashboard routes)
- **JWT extraction**: `org_id` extracted from `app_metadata` (admin-set, cryptographically signed)
- **Dev mode guard**: Fallback only active when `NODE_ENV=development` is explicitly set
- **Query filtering**: All Supabase queries include `.eq('org_id', orgId)` filter

### FK Integrity

| Relationship | Violations Found |
|-------------|:----------------:|
| calls → contacts (org_id match) | 0 |
| calls → appointments (org_id match) | 0 |

---

## 2. Vulnerabilities Fixed

### 2.1 XSS in Search Parameter (P0 – Fixed)

**Location**: `calls-dashboard.ts` line 99
**Issue**: Search parameter was interpolated directly into Supabase `.or()` filter string
**Fix**: Added `sanitizeSearchInput()` that strips all characters except `[a-zA-Z0-9\s+\-()@.]`

```diff
-query = query.or(`phone_number.ilike.%${parsed.search}%,...`);
+const sanitizedSearch = sanitizeSearchInput(parsed.search);
+if (sanitizedSearch.length > 0) {
+  query = query.or(`phone_number.ilike.%${sanitizedSearch}%,...`);
+}
```

### 2.2 Missing UUID Validation (P0 – Fixed)

**Location**: All 6 `/:callId` routes
**Issue**: Invalid UUIDs caused Postgres errors (500 responses)
**Fix**: Added `isValidUUID()` check returning 400 with `INVALID_UUID` code

### 2.3 Path Traversal on Recordings (P1 – Fixed)

**Location**: Recording URL endpoint
**Issue**: `recording_storage_path` was passed directly to storage without validation
**Fix**: Added check for `..` and null bytes before signed URL generation

### 2.4 Debug Logging in Production (P2 – Fixed)

**Location**: Call detail endpoint
**Issue**: `console.log('🔍 DEBUG: ...')` left in production code
**Fix**: Removed debug logging, replaced with structured `log.error()` calls

### 2.5 Duplicate Query Logic (P2 – Fixed)

**Location**: `GET /:callId` endpoint
**Issue**: Separate inbound/outbound queries with different logic paths
**Fix**: Unified to single query using `.maybeSingle()` with call_type resolved from data

---

## 3. Error Response Standardization

All error responses now include:

```json
{
  "error": "Human-readable message",
  "code": "INVALID_UUID",
  "request_id": "a1b2c3d4-e5f6-..."
}
```

| Code | HTTP Status | When |
|------|:-----------:|------|
| `AUTH_REQUIRED` | 401 | Missing or invalid auth |
| `INVALID_UUID` | 400 | Malformed callId parameter |
| `INVALID_PATH` | 400 | Path traversal attempt |
| `CALL_NOT_FOUND` | 404 | Call doesn't exist or wrong org |
| `DB_ERROR` | 500 | Database query failure |
| `VALIDATION_ERROR` | 400 | Zod validation failure |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 4. Verification

| Test | Result | Command |
|------|:------:|---------|
| Multi-tenant audit script | ✅ | `npx tsx src/scripts/audit-multi-tenant-security.ts` |
| Data quality audit | ✅ | `npx tsx src/scripts/audit-data-quality.ts` |
| Security integration tests | ✅ | `npx jest src/__tests__/integration/dashboard-api-security.test.ts` |
| Edge case tests | ✅ | `npx jest src/__tests__/integration/dashboard-api-edge-cases.test.ts` |
| Recording playback tests | ✅ | `npx jest src/__tests__/integration/recording-playback.test.ts` |

---

## 5. Recommendations

1. **Enable `force_ssl`** on Supabase project to ensure all DB connections are encrypted
2. **Add rate limiting** to the `GET /:callId/recording-url` endpoint (currently unprotected)
3. **Rotate service role key** if it was ever exposed in client-side code
4. **Add RBAC** to differentiate admin vs viewer access on sensitive endpoints (DELETE, share)
