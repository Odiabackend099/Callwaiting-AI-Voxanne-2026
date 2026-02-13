# Wallet Summary SSOT Violation - Root Cause Analysis

**Date:** 2026-02-13  
**Status:** 🔴 CRITICAL - Frontend shows $0 for all wallet stats (Summary is NULL)  
**Root Cause:** RPC function `get_wallet_summary` queries non-existent database columns

---

## Problem Summary

The wallet page shows:
- Total Top-Ups: $0.00
- Total Spent: $0.00  
- Total Calls: 0
- Auto-Recharge: Off

**Why:** The backend returns `summary: null` because the RPC function fails silently.

---

## Root Cause: Column Mismatch

### RPC Function: `get_wallet_summary()` (Line 180-220 in 20260208_prepaid_credit_ledger.sql)

Queries these columns:
```sql
'total_spent_pence', COALESCE((
  SELECT SUM(client_charged_pence)  -- ❌ COLUMN DOESN'T EXIST
  FROM credit_transactions WHERE org_id = p_org_id AND type = 'call_deduction'
), 0),

'total_calls', (
  SELECT COUNT(*) FROM credit_transactions  -- ✅ This works
  WHERE org_id = p_org_id AND type = 'call_deduction'
),

'total_topped_up_pence', COALESCE((
  SELECT SUM(amount_pence)  -- ✅ This works
  FROM credit_transactions WHERE org_id = p_org_id AND direction = 'credit'
), 0),

'total_profit_pence', COALESCE((
  SELECT SUM(gross_profit_pence)  -- ❌ COLUMN DOESN'T EXIST
  FROM credit_transactions WHERE org_id = p_org_id AND type = 'call_deduction'
), 0)
```

Also queries non-existent organization columns:
- `wallet_low_balance_pence` ❌ (should be: doesn't exist)
- `wallet_auto_recharge` ❌ (not in organizations table)
- `wallet_recharge_amount_pence` ❌ (not in organizations table)
- `stripe_default_pm_id` ❌ (not in organizations table)

### Actual Database Schema (Per SSOT)

**credit_transactions table has these columns:**
```sql
- id (uuid)
- org_id (uuid)
- amount_pence (integer)  -- ✅ exists
- type (text)
- description (text, nullable)
- stripe_payment_intent_id (text, nullable)
- balance_before_pence (integer, nullable)
- balance_after_pence (integer, nullable)
- created_at (timestamptz)

-- Missing:
-- client_charged_pence ❌
-- gross_profit_pence ❌
```

**organizations table has these columns:**
```sql
- id (uuid)
- name (text)
- email (text)
- phone (text, nullable)
- website (text, nullable)
- plan (text)
- stripe_customer_id (text, nullable)
- wallet_balance_pence (integer, nullable)  -- ✅ exists
- debt_limit_pence (integer, default 500)
- wallet_markup_percent (integer, default 50)
- telephony_mode (text)
- settings (jsonb, nullable)
- created_at (timestamp)
- updated_at (timestamp)

-- Missing:
-- wallet_low_balance_pence ❌
-- wallet_auto_recharge ❌
-- wallet_recharge_amount_pence ❌
-- stripe_default_pm_id ❌
```

---

## Impact

| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend Wallet Page** | ❌ BROKEN | Shows NULL summary (displays zeros) |
| **API Endpoint `/api/billing/wallet`** | ⚠️ PARTIAL | Returns balance but `summary: null` |
| **Dashboard Stats** | ❌ MISSING | Total Top-Ups, Total Spent, Total Calls all show 0 |
| **Auto-Recharge UI** | ⚠️ DEGRADED | Shows "Off" because auto_recharge_enabled can't be queried |

---

## Data Flow Analysis

### Current (Broken) Flow

```
Frontend (wallet/page.tsx)
  ↓
  GET /api/billing/wallet
  ↓
Backend (billing-api.ts:364)
  await getWalletSummary(orgId)
  ↓
Wallet Service (wallet-service.ts:497)
  await supabase.rpc('get_wallet_summary', { p_org_id: orgId })
  ↓
RPC Function (20260208_prepaid_credit_ledger.sql:180)
  SELECT SUM(client_charged_pence)  -- ❌ ERROR: Column doesn't exist
  ↓
Backend catches error (wallet-service.ts:501-506)
  return null;
  ↓
API Response
  { ..., summary: null, ... }
  ↓
Frontend
  total_spent_pence: undefined → displays "$0.00"
  total_calls: undefined → displays "0"
  total_topped_up_pence: undefined → displays "$0.00"
```

### Expected (Fixed) Flow

```
Frontend
  ↓
GET /api/billing/wallet
  ↓
Query credit_transactions table correctly
  ↓
Calculate:
  - total_spent_pence = SUM(amount_pence) WHERE type='call_deduction'
  - total_calls = COUNT(*) WHERE type='call_deduction'
  - total_topped_up_pence = SUM(amount_pence) WHERE direction='credit'
  ↓
Return complete summary object
  ↓
Frontend displays correct stats
```

---

## Solution: Fix the RPC Function

**Migration needed:** Update `get_wallet_summary()` to use correct column names

**Option A: Quick Fix (Use existing amount_pence column)**

```sql
-- BEFORE (BROKEN):
'total_spent_pence', COALESCE((
  SELECT SUM(client_charged_pence)  -- ❌ Doesn't exist
  FROM credit_transactions
  WHERE org_id = p_org_id AND type = 'call_deduction'
), 0),

-- AFTER (FIXED):
'total_spent_pence', COALESCE((
  SELECT SUM(amount_pence)  -- ✅ Correct column
  FROM credit_transactions
  WHERE org_id = p_org_id AND type = 'call_deduction'
), 0),
```

**Option B: Add Missing Columns (If tracking per-call costs is needed)**

Add to credit_transactions schema:
- `client_charged_pence` (what we billed customer)
- `gross_profit_pence` (what we kept)

Add to organizations schema:
- `wallet_auto_recharge` (BOOLEAN)
- `wallet_recharge_amount_pence` (INTEGER)
- `wallet_low_balance_pence` (INTEGER) -- or use debt_limit_pence
- `stripe_default_pm_id` (TEXT, nullable)

---

## Recommended Action

**Use Option A (Quick Fix):** The RPC function should query `amount_pence` (what's already in the schema).

The `amount_pence` column in `credit_transactions` already contains:
- For type='call_deduction': The amount charged to customer
- For direction='credit': The amount topped up
- For type='phone_provisioning': The amount charged for number

This is the Single Source of Truth and should be used directly.

---

## Verification Checklist

After implementing the fix:

- [ ] Update RPC function `get_wallet_summary()` to query correct columns
- [ ] Test RPC: `SELECT * FROM get_wallet_summary('46cf2995-2bee-44e3-838b-24151486fe4e')`
- [ ] Verify result returns non-null object with all fields populated
- [ ] Frontend calls `/api/billing/wallet` and receives complete summary
- [ ] Wallet page displays:
  - Total Top-Ups: Shows actual amount (not $0.00)
  - Total Spent: Shows actual amount (not $0.00)
  - Total Calls: Shows actual count (not 0)
  - Auto-Recharge: Shows correct toggle state (not Off)

---

**Classification:** P1 - Data Integrity / SSOT Violation  
**Category:** Database Schema Mismatch  
**Files Affected:**
1. `backend/supabase/migrations/20260208_prepaid_credit_ledger.sql` - RPC function definition
2. `backend/src/services/wallet-service.ts` - getWalletSummary() caller
3. `backend/src/routes/billing-api.ts` - API endpoint returning summary
4. `src/app/dashboard/wallet/page.tsx` - Frontend displaying summary

