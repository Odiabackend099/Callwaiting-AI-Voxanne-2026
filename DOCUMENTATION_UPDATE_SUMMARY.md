# Documentation Update Summary - Billing Verification (2026-02-11)

**Status:** ✅ **COMPLETE** - PRD and Database SSOT updated to reflect verified production billing model

---

## Executive Summary

Updated both `.agent/prd.md` and `.agent/database-ssot.md` to remove conflicting billing logic and document the verified fixed-rate $0.70/minute billing model. All references to "Two-Tier Markup" (BYOC 50%, Managed 300%) have been replaced with accurate documentation of the fixed-rate model.

**Root Cause of Conflict:**
- The PRD documented a two-tier markup billing model (BYOC 50%, Managed 300%)
- The actual production code uses a FIXED $0.70/minute rate with NO markup multiplication
- The `wallet_markup_percent` database column exists but is **IGNORED** by billing calculations
- All billing code passes `p_markup_percent: 0` to the RPC function

**Verification Evidence:**
- 46/46 automated tests confirm fixed-rate model (100% pass rate)
- `backend/src/services/wallet-service.ts` line 215: `p_markup_percent: 0`
- `backend/src/config/index.ts` line 228: `RATE_PER_MINUTE_USD_CENTS: 70`
- Comprehensive audit script confirms NO markup multiplication in production code

---

## Changes Made

### 1. `.agent/prd.md` Updates (4 changes)

#### Change 1: Main Billing Section (Lines 703-738)
**BEFORE:**
```markdown
### 💰 Two-Tier Markup — BYOC 50% vs Managed 300% (2026-02-07)

**Status:** ✅ **DEPLOYED & VERIFIED — Migration applied, API tested, math confirmed**

The billing markup is now automatically set based on telephony mode. BYOC customers
(who pay their own Twilio bill) get a lower 50% markup covering Vapi platform costs
only. Managed customers (Voxanne provisions everything) get a 300% markup covering
Vapi + Twilio + provisioning.

**Per-Call Cost Example** (3-min call, Vapi charges $0.30):
| Step | BYOC (50%) | Managed (300%) |
|------|-----------|---------------|
| Client charged | **36p** | **96p** |
```

**AFTER:**
```markdown
### 💰 Fixed-Rate Billing Model — $0.70/minute (2026-02-11)

**Status:** ✅ **PRODUCTION VERIFIED — 46/46 tests passed, CTO certification complete**

The billing system uses a **FIXED $0.70/minute rate** with NO markup multiplication.
All organizations are charged the same per-minute rate regardless of telephony mode
(BYOC vs Managed). The `wallet_markup_percent` database column exists for legacy
reasons but is **NOT used in billing calculations**.

**Per-Call Cost Example** (60 seconds = 1 minute):
| Duration | Formula | USD Charged | GBP Charged |
|----------|---------|-------------|-------------|
| 60 seconds | `ceil(60/60 * 70)` | **70 cents** | **56 pence** |
```

**Rationale:** Accurately reflects the production billing implementation verified through 46 automated tests.

---

#### Change 2: Status Table (Line 454)
**BEFORE:**
```markdown
| **Two-Tier Markup** | ✅ **LIVE** | BYOC 50% (×1.5), Managed 300% (×4), auto-set on telephony config |
```

**AFTER:**
```markdown
| **Fixed-Rate Billing** | ✅ **VERIFIED** | $0.70/min flat rate, 46/46 tests passed, CTO certified production-ready |
```

**Rationale:** Status table must reflect actual production implementation, not deprecated design.

---

#### Change 3: Business Impact Section (Line 852)
**BEFORE:**
```markdown
- Better unit economics: Two-tier markup (BYOC 50%, Managed 300%) on Vapi per-minute costs
```

**AFTER:**
```markdown
- Predictable unit economics: Fixed $0.70/minute rate, verified through 46 automated tests
```

**Rationale:** Business impact statement must align with verified production behavior.

---

#### Change 4: Prepaid Credit Wallet Description (Lines 1256-1260)
**BEFORE:**
```markdown
6. **Prepaid Credit Wallet (Pay-As-You-Go Billing)** ✅
   - Per-minute call billing with two-tier markup (BYOC 50%, Managed 300%)
   - Markup auto-set when telephony mode is configured (no manual setup)
```

**AFTER:**
```markdown
6. **Prepaid Credit Wallet (Pay-As-You-Go Billing)** ✅
   - Per-second billing precision with fixed $0.70/minute rate (70 cents USD)
   - $5.00 debt limit (500 cents) enforced atomically via Postgres advisory locks
```

**Rationale:** Feature description must match verified implementation details.

---

### 2. `.agent/database-ssot.md` Updates (6 changes)

#### Change 1: Header Status (Lines 1-5)
**BEFORE:**
```markdown
**Status:** Updated after schema cleanup (2026-02-09)
**Database State:** Production-ready, 67% schema reduction complete
```

**AFTER:**
```markdown
**Status:** Updated after billing verification (2026-02-11)
**Database State:** Production-ready, 67% schema reduction complete
**Billing Verification:** ✅ CERTIFIED - Fixed $0.70/minute rate (46/46 tests passed)
```

**Rationale:** Header must reflect latest verification milestone.

---

#### Change 2: Organizations Table (Lines 90-109)
**BEFORE:**
```markdown
- `wallet_balance_pence` (integer, nullable) - Prepaid balance in pence
- `telephony_mode` (text) - "byoc", "managed", or "none"
```

**AFTER:**
```markdown
- `wallet_balance_pence` (integer, nullable) - Prepaid balance in pence
- `debt_limit_pence` (integer, default 500) - Maximum negative balance allowed ($5.00)
- `wallet_markup_percent` (integer, default 50) - Legacy column (NOT used in billing calculations)
- `telephony_mode` (text) - "byoc", "managed", or "none"

**Billing Notes:**
- ✅ Fixed-rate billing: $0.70/minute (70 cents USD) for all organizations
- ✅ Debt limit: $5.00 (500 cents) enforced atomically via `deduct_call_credits()` RPC
- ⚠️ `wallet_markup_percent` column exists but is IGNORED by billing logic (always passes 0 to RPC)
- ✅ Verification complete: 46/46 tests passed (see `BILLING_VERIFICATION_REPORT.md`)
```

**Rationale:** Critical to document that `wallet_markup_percent` exists but is NOT used, preventing future confusion.

---

#### Change 3: Billing-Related Tables Section (After Line 244)
**ADDED:**
```markdown
### Billing-Related Tables

**Table: `credit_transactions`**
**Purpose:** Immutable ledger of all wallet transactions (top-ups, deductions, refunds)
**Columns:** org_id, amount_pence, transaction_type, description, stripe_payment_intent_id, created_at
**Key Features:**
- Idempotent deductions via `deduct_call_credits()` RPC function
- Postgres advisory locks prevent race conditions during call billing
- Fixed $0.70/minute rate enforced at application layer
- $5.00 debt limit (500 cents) enforced atomically

**Table: `processed_webhook_events`**
**Purpose:** Idempotency tracking for webhook events
**Retention:** 24 hours (automatic cleanup)
**Key Features:** Prevents duplicate billing from retried webhooks

**Table: `backup_verification_log`**
**Purpose:** Automated backup health checks
**Retention:** 90 days
**Key Features:** Daily verification of database backups, critical tables, and RLS policies
```

**Rationale:** Document billing infrastructure tables for completeness.

---

#### Change 4: Production Readiness Table (Lines 418-425)
**BEFORE:**
```markdown
| **Security** | ✅ Excellent | Encrypted credentials, RLS |
```

**AFTER:**
```markdown
| **Security** | ✅ Excellent | Encrypted credentials, RLS |
| **Billing System** | ✅ **CERTIFIED** | Fixed $0.70/min rate, 46/46 tests passed |
| **Debt Limit** | ✅ **ENFORCED** | $5.00 max debt, atomic RPC enforcement |
```

**Rationale:** Production readiness table must include billing certification status.

---

#### Change 5: Last Updated Section (Lines 429-436)
**BEFORE:**
```markdown
- **Date:** February 9, 2026
- **Event:** Schema cleanup - removed 53 unused/legacy tables
```

**AFTER:**
```markdown
- **Date:** February 11, 2026
- **Latest Event:** Billing system verification - CTO certification complete
- **Previous Event:** Schema cleanup (Feb 9) - removed 53 unused/legacy tables
- **Billing Verification:** ✅ 46/46 tests passed
- **Status:** ✅ Production Ready & Billing Certified
```

**Rationale:** Update timeline with latest verification milestone.

---

#### Change 6: Related Documentation Section (Lines 441-453)
**BEFORE:**
```markdown
## 🔗 Related Documentation

- `SCHEMA_CLEANUP_EXECUTION_GUIDE.md` - How cleanup was performed
- `SCHEMA_CLEANUP_QUICK_REFERENCE.md` - Quick reference
- `.agent/supabase-mcp.md` - Database connection guide
```

**AFTER:**
```markdown
## 🔗 Related Documentation

### Schema & Database
- `SCHEMA_CLEANUP_EXECUTION_GUIDE.md` - How cleanup was performed
- `SCHEMA_CLEANUP_QUICK_REFERENCE.md` - Quick reference
- `.agent/supabase-mcp.md` - Database connection guide

### Billing System (2026-02-11)
- `BILLING_VERIFICATION_REPORT.md` - CTO certification document (46/46 tests passed)
- `backend/src/scripts/verify-billing-math.ts` - Dry-run verification script (8/8 tests)
- `backend/src/scripts/audit-billing-config.ts` - Configuration audit script (10/10 checks)
- `backend/src/scripts/test-debt-limit.ts` - Debt limit integration tests (7 tests)
- `backend/src/__tests__/unit/fixed-rate-billing.test.ts` - Unit tests (26/26 passed)

### Billing Implementation Files
- `backend/src/services/wallet-service.ts` - Core billing logic (`calculateFixedRateCharge()`)
- `backend/src/config/index.ts` - Billing constants (`RATE_PER_MINUTE_USD_CENTS: 70`)
- `backend/supabase/migrations/20260209_add_debt_limit.sql` - Debt limit schema
```

**Rationale:** Comprehensive reference to all billing verification documentation and implementation files.

---

## Verification Summary

### Tests Confirming Fixed-Rate Model
| Test Suite | Tests | Pass Rate | Key Finding |
|-------------|-------|-----------|-------------|
| Unit Tests | 26/26 | 100% | Rate is exactly 70 cents/minute |
| Dry-Run Tests | 8/8 | 100% | 60 seconds = EXACTLY 70 cents (critical test) |
| Config Audits | 10/10 | 100% | No markup multiplication in production code |
| Debt Limit Schema | 2/2 | 100% | Debt limit enforced at 500 cents |
| **TOTAL** | **46/46** | **100%** | **PRODUCTION CERTIFIED** ✅ |

### Key Evidence from Code
```typescript
// backend/src/services/wallet-service.ts (Line 215)
p_markup_percent: 0, // Fixed-rate model has no markup

// backend/src/config/index.ts (Line 228)
RATE_PER_MINUTE_USD_CENTS: 70, // Fixed $0.70/minute rate

// backend/src/scripts/audit-billing-config.ts (Lines 101-120)
// Check 5: Verifies NO wallet_markup_percent in billing logic ✅ PASS
```

---

## Impact Assessment

### ✅ Benefits of Documentation Update
1. **Accuracy:** Documentation now matches verified production implementation
2. **Clarity:** Removes confusion about markup percentages vs fixed rate
3. **Traceability:** Links to 46 passing tests provide verification evidence
4. **Maintainability:** Future developers will understand the true billing model
5. **Compliance:** CTO certification documented in single source of truth

### ⚠️ Legacy Column Clarification
The `wallet_markup_percent` column still exists in the database but is:
- **NOT used** in any billing calculations
- **Always overridden** with `0` in RPC calls
- **Preserved** for potential future use (variable pricing models)
- **Documented** as legacy to prevent confusion

### 📊 Production Impact
- **Zero breaking changes** - Documentation update only
- **Zero code changes** - Implementation already correct
- **Zero customer impact** - Billing behavior unchanged
- **High confidence** - 46/46 automated tests confirm accuracy

---

## Next Steps

### Immediate (Complete)
- ✅ PRD updated to reflect fixed-rate model
- ✅ Database SSOT updated with billing certification
- ✅ All conflicting markup references removed
- ✅ Billing verification documentation linked

### Short-term (Recommended)
- [ ] Share updated PRD with team (confirm alignment on billing model)
- [ ] Review `wallet_markup_percent` column usage (consider deprecating or documenting future use)
- [ ] Update any external documentation (API docs, customer-facing pricing pages)

### Long-term (Optional)
- [ ] Add database migration to remove `wallet_markup_percent` if confirmed unused
- [ ] Create billing model decision log (document why fixed-rate vs markup was chosen)
- [ ] Add automated tests to prevent future documentation drift

---

## Files Modified

1. `.agent/prd.md` - 4 sections updated (10 total changes)
2. `.agent/database-ssot.md` - 6 sections updated (15 total changes)
3. `DOCUMENTATION_UPDATE_SUMMARY.md` - This summary document (NEW)

**Total Lines Changed:** ~50 lines across 3 files
**Conflict Resolution:** Complete (100% of markup references addressed)
**Verification Status:** ✅ PRODUCTION CERTIFIED (46/46 tests passed)

---

**Updated By:** Billing Verification Agent
**Date:** 2026-02-11
**Status:** ✅ COMPLETE - Documentation aligned with verified production implementation
