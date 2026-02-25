# Onboarding Wizard QA Fixes — Planning Document

**Date:** 2026-02-25
**Principle:** 3-Step Coding Principle
**Status:** Planning Phase → Executing

---

## Issues Identified (from 5-agent QA audit)

| # | Severity | File | Problem |
|---|---|---|---|
| Fix 1 | CRITICAL | `backend/src/routes/onboarding.ts` | Outer `catch` in `/provision-number` doesn't refund wallet if `provisionNumber()` throws a network error |
| Fix 2 | CRITICAL | New migration SQL | `onboarding_events` RLS policies use `USING (true)` — any authenticated user can read/write ALL orgs' telemetry |
| Fix 3 | HIGH | `src/components/onboarding/StepPaywall.tsx` | No area code length validation before Stripe checkout (1–2 digit codes silently fall back) |
| Fix 6 | LOW | `backend/src/routes/onboarding.ts` | `step_index > 5` should be `step_index > 4` (5 steps, 0-indexed, max valid = 4) |

**Already fixed — no action needed:**
- Fix 4: Abandonment email credit order — `recordEmailSent` is called FIRST (lines 193–200), preventing double-credit on retry ✅
- Fix 5: Zustand persist name — `name: 'voxanne-onboarding'` + `sessionStorage` already in store ✅

---

## Root Cause Analysis

### Fix 1 — Wallet loss on network throw
`/provision-number` deducts wallet before calling Twilio. If Twilio responds with `{success: false}`, the existing code refunds correctly. But if `service.provisionNumber()` **throws** (network timeout, 503), the outer `catch` at line 283 never calls `addCredits`. The user loses £10.

**Fix:** Add a `walletDebited` flag set to `true` after a successful deduction. The outer catch checks this flag and issues the refund.

### Fix 2 — RLS data leak
Original migration policies:
```sql
WITH CHECK (true);  -- any authenticated user can insert for any org
USING (true);       -- any authenticated user can read all events
```
**Fix:** Drop and recreate with org-scoped check using the codebase's canonical pattern: `(SELECT public.auth_org_id())` from `20260209_fix_supabase_linter_security_issues.sql`.

### Fix 3 — Silent area code fallback
`StepPaywall.tsx` has `maxLength={3}` on the input but no validation before calling the checkout API. User entering "4" or "41" triggers checkout; the backend receives `area_code: "4"` and passes it to Twilio, which may silently ignore it.

**Fix:** Compute `areaCodeInvalid = areaCode.length > 0 && areaCode.length < 3`. Disable button and show inline message when invalid.

### Fix 6 — Off-by-one in step_index validation
`TOTAL_STEPS = 5` → valid indices are 0–4. `step_index > 5` allows index 5 into the DB.
**Fix:** Change to `step_index > 4`.

---

## Implementation Phases

### Phase 1 — Backend route (onboarding.ts)
**Touches:** `backend/src/routes/onboarding.ts`
**Changes:**
1. Add `walletDebited = false` flag before deduction block
2. Set `walletDebited = true` after `deductResult.success` check passes
3. In outer `catch`, call `addCredits(...)` if `walletDebited` is true
4. Fix `step_index > 5` → `step_index > 4` on line 61

### Phase 2 — Database migration (new file)
**Touches:** `backend/supabase/migrations/20260225_fix_onboarding_rls.sql` (new file)
**Changes:**
1. Drop old INSERT policy on `onboarding_events`
2. Drop old SELECT policy on `onboarding_events`
3. Recreate INSERT with `WITH CHECK (org_id = (SELECT public.auth_org_id()))`
4. Recreate SELECT with `USING (org_id = (SELECT public.auth_org_id()))`

### Phase 3 — Frontend validation (StepPaywall.tsx)
**Touches:** `src/components/onboarding/StepPaywall.tsx`
**Changes:**
1. Derive `areaCodeInvalid` from `areaCode` state
2. Disable checkout button when `areaCodeInvalid`
3. Show inline validation message (blue palette, no red)

---

## Technical Constraints

- `addCredits` signature (from existing refund at line 259–268):
  `addCredits(orgId, PHONE_NUMBER_COST_PENCE, 'refund', undefined, undefined, 'reason', 'system:onboarding')`
- RLS pattern: `(SELECT public.auth_org_id())` — not the older `(auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid`
- No new npm dependencies
- Error message color: `text-obsidian/70 bg-surgical-50 border-surgical-200` (matches existing error in StepPaywall)

---

## Testing Criteria

### Phase 1
- [ ] `cd backend && npx tsc --noEmit` — zero new errors
- [ ] step_index=5 returns HTTP 400
- [ ] step_index=4 returns HTTP 200

### Phase 2
- [ ] SQL file has valid syntax (no parse errors)
- [ ] Policy names match the DROP targets exactly

### Phase 3
- [ ] `npx tsc --noEmit` — zero new errors
- [ ] Button disabled when areaCode = "4" (1 digit) or "41" (2 digits)
- [ ] Button enabled when areaCode = "" (empty) or "415" (3 digits)
- [ ] Validation message visible for 1–2 digit inputs
- [ ] `npx next build` — exit 0
