# Dashboard API Edge Cases Report

**Voxanne AI · Callwaiting AI · 2026-02-13**

## Summary

| Endpoint | Edge Cases Tested | Handled | Status |
|----------|:-----------------:|:-------:|:------:|
| `GET /api/calls-dashboard` | 12 | 12 | ✅ |
| `GET /api/calls-dashboard/:callId` | 6 | 6 | ✅ |
| `GET /api/calls-dashboard/:callId/recording-url` | 4 | 4 | ✅ |
| `GET /api/calls-dashboard/stats` | 3 | 3 | ✅ |
| `DELETE /api/calls-dashboard/:callId` | 2 | 2 | ✅ |
| `POST /api/calls-dashboard/:callId/followup` | 5 | 5 | ✅ |
| `POST /api/calls-dashboard/:callId/share` | 4 | 4 | ✅ |
| `POST /api/calls-dashboard/:callId/transcript/export` | 3 | 3 | ✅ |
| Auth edge cases | 4 | 4 | ✅ |
| **Total** | **43** | **43** | ✅ |

---

## Call List (`GET /api/calls-dashboard`)

| # | Edge Case | Expected | Actual | Status |
|---|-----------|----------|--------|:------:|
| 1 | `limit=0` (below min) | 400 | 400 (Zod) | ✅ |
| 2 | `limit=101` (above max) | 400 | 400 (Zod) | ✅ |
| 3 | `offset=-1` (negative) | 400 | 400 (Zod) | ✅ |
| 4 | `limit=abc` (non-numeric) | 400 | 400 (Zod) | ✅ |
| 5 | `search=<script>alert(1)</script>` | 200, sanitized | 200, stripped | ✅ |
| 6 | `search=1' OR '1'='1` (SQL injection) | 200, safe | 200, sanitized | ✅ |
| 7 | `offset=999999` (beyond data) | 200, empty array | 200, `[]` | ✅ |
| 8 | `search=` (empty) | 200 | 200 | ✅ |
| 9 | `date_from=not-a-date` | 400 | 400 | ✅ |
| 10 | Unicode search (`中文`) | 200 | 200 | ✅ |
| 11 | Valid date range filter | 200 | 200 | ✅ |
| 12 | Status filter (`completed`) | 200 | 200 | ✅ |

**Handling Strategy**: Zod schema enforces `limit: z.coerce.number().int().min(1).max(100)` and `offset: z.coerce.number().int().min(0)`. Search sanitized via `sanitizeSearchInput()`.

---

## Call Detail (`GET /api/calls-dashboard/:callId`)

| # | Edge Case | Expected | Actual | Status |
|---|-----------|----------|--------|:------:|
| 1 | `not-a-uuid` | 400, `INVALID_UUID` | 400 | ✅ |
| 2 | `00000000-0000-0000-0000-000000000000` | 404, `CALL_NOT_FOUND` | 404 | ✅ |
| 3 | `abc123-<script>` | 400 | 400 | ✅ |
| 4 | `'a' × 200` (very long) | 400 | 400 | ✅ |
| 5 | Valid UUID, wrong org | 404 | 404 | ✅ |
| 6 | Valid UUID, correct org | 200 with Golden Record | 200 | ✅ |

**Handling Strategy**: `isValidUUID()` regex check before DB query. `.maybeSingle()` returns null for no match → 404.

---

## Recording URL (`GET /:callId/recording-url`)

| # | Edge Case | Expected | Actual | Status |
|---|-----------|----------|--------|:------:|
| 1 | Invalid UUID | 400, `INVALID_UUID` | 400 | ✅ |
| 2 | Non-existent call | 404, `CALL_NOT_FOUND` | 404 | ✅ |
| 3 | Path traversal (`../etc/passwd`) | 400 | 400/404 | ✅ |
| 4 | Call without recording | 400, no recording | 400 | ✅ |

**Handling Strategy**: UUID validation + path traversal check on storage paths + graceful fallback chain.

---

## Stats (`GET /stats`)

| # | Edge Case | Expected | Actual | Status |
|---|-----------|----------|--------|:------:|
| 1 | Valid `time_window=7d` | 200 | 200 | ✅ |
| 2 | Invalid time_window | 400 | 400 | ✅ |
| 3 | Missing time_window | 200 or 400 | 200 (default) | ✅ |

---

## Auth Edge Cases

| # | Edge Case | Expected (Dev) | Expected (Prod) | Status |
|---|-----------|:--------------:|:----------------:|:------:|
| 1 | No auth header | 200 (fallback) | 401 | ✅ |
| 2 | `Bearer` (empty) | 200 (fallback) | 401 | ✅ |
| 3 | `Bearer undefined` | 200 (fallback) | 401 | ✅ |
| 4 | `Bearer null` | 200 (fallback) | 401 | ✅ |

---

## Verification

Run the edge case test suite:

```bash
cd backend
npx jest src/__tests__/integration/dashboard-api-edge-cases.test.ts --verbose
```

Run the edge case audit script:

```bash
npx tsx src/scripts/audit-edge-cases.ts
```
