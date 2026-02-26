# PROMPT: Consolidate & Clean PRD + SSOT Documentation

## Mission
Refactor `.agent/prd.md` and `.agent/database-ssot.md` to eliminate conflicts, redundancies, and confusion. Create authoritative, easy-to-navigate documentation that ANY AI developer can read without getting lost in duplicated explanations.

**Current State:**
- PRD: 876 lines with TIER confusion, duplicated billing sections, mixed historical changelog
- SSOT: 1165 lines with bloated configuration section, historical cruft, repeated information
- **Problem:** Same concepts explained 3-5 times in different ways, making it unclear which is authoritative

**Target State:**
- PRD: ~400-500 lines (clean, readable, no duplication)
- SSOT: ~600-700 lines (lean, focused on current schema, minimal history)
- **Clarity:** One explanation per concept, clear navigation between documents

---

## PRD CLEANUP STEPS

### Step 1: Remove TIER Confusion
**Current:** "TIER 1 (Non-negotiable rules)", "TIER 2 (Architecture)", "TIER 3 (Operational details)" → Confusing, inconsistent usage

**Action:** Replace with simpler structure:
- Section 1: **Critical Rules** (immutable)
- Section 2: **Current Capabilities** (what the system does)
- Section 3: **Operations & Reference** (where to find technical details)

### Step 2: Consolidate Billing (Currently in Sections 2.5, 3, 6.4)

**Problem:** Real-time Prepaid Billing explained 3 times:
1. Section 2.5 — Full phase breakdown (175 lines)
2. Section 3 — Summary list (5 lines)
3. Section 6.4 — Implementation details (scattered)

**Action:**
- Keep ONE consolidated "Real-Time Prepaid Billing" section (max 50 lines)
- Summary: 3 phases (Atomic Asset Billing, Credit Reservation, Kill Switch)
- Each phase: 1-2 line description + "See SSOT.md" for details
- Remove redundant Phase 1/2/3 breakdowns

**Result:**
```markdown
## Real-Time Prepaid Billing (3 Phases)

1. **Atomic Asset Billing** — RPC with FOR UPDATE locks prevents double-spending on phone number provisioning
2. **Credit Reservation** — 5-minute credit holds during calls, released at call end
3. **Kill Switch** — Auto-terminate calls when balance ≤ 0 (checked every 60s)

**Status:** ✅ All 3 phases deployed, 56 pence/min GBP fixed rate
**Details:** See SSOT.md Sections 5-6 (Database tables) + 2.5 (RPC functions)
```

### Step 3: Remove Historical Changelog from Architecture Section

**Problem:** Sections like "What's Changed Since Last Release (2026-02-25)" and "Previous Release (2026-02-24)" clutter current state documentation

**Action:**
- Move ALL dated changes (2026-02-13 through 2026-02-25) to a NEW **"Release History"** appendix
- Keep ONLY "Current Capabilities" in main document
- Appendix format: `## Release History | 2026-02-25: Onboarding Wizard | 2026-02-24: Multi-Number Support | ...`
- Developers can ignore history unless troubleshooting legacy behavior

**Result:** Main architecture section is 100% focused on what works NOW

### Step 4: Consolidate Form Explanations (Pre-Sales Form vs Onboarding Wizard)

**Current Problem:** Sections 6.5 AND 6.10 both explain forms with nearly identical warnings:
```
> ⚠️ **NAMING CLARITY:** This section describes the **pre-sales intake form** at `/start`
> for unauthenticated prospects...
```
And:
```
> ⚠️ **NAMING CLARITY:** This section describes the **post-signup conversion wizard**
> for authenticated new users...
```

**Action:**
- Create ONE "Forms Overview" subsection at top of Section 6:
  ```
  ### Two Forms (Don't Confuse!)
  | Form | Path | Users | Purpose |
  |------|------|-------|---------|
  | Pre-Sales Intake | `/start` | Unauthenticated prospects | Lead capture before signup |
  | Onboarding Wizard | `/dashboard/onboarding` | Authenticated new users | Post-signup conversion (payment → provisioning) |

  📌 They are COMPLETELY SEPARATE flows with different database tables. See sections 6.5 and 6.10 for details.
  ```
- Remove ⚠️ warnings from 6.5 and 6.10 (already explained above)

### Step 5: Simplify "Where to Find Technical Details" Reference Table

**Current (Section TIER 2.5):** 8 rows of cross-references clutters navigation

**Action:** Replace with:
```markdown
## Technical Reference
For implementation details, database schema, and function signatures, see **SSOT.md**:
- Database schema & tables → SSOT.md Sections 3-6
- RPC functions & webhook delivery → SSOT.md Sections 8-11
- Critical invariants → SSOT.md Section 13

For older architectural decisions, see **Release History** appendix.
```

### Step 6: Clean Up Section 6 (Functional Requirements)

**Current:** Sections 6.1-6.10 are 400+ lines with redundant API endpoint lists, billing rules repeated from section 2.5, etc.

**Action:**
- 6.1: AI Call Handling (keep, 3 lines)
- 6.2: Golden Record Analytics (keep, 5 lines)
- 6.3: Wallet & Billing → **DELETE** (move 2 critical rules to Critical Rules section; rest is in SSOT)
- 6.4: Telephony & AI Forwarding (keep, consolidate)
- 6.5: Pre-Sales Lead Intake (keep, remove ⚠️)
- 6.6-6.9: **CONSOLIDATE** all monitoring/compliance into one "Security & Monitoring" subsection
- 6.10: Onboarding Wizard (keep, remove ⚠️)

### Step 7: Create Simple "How to Read This Document" Section

Replace confusing TIER introduction with:
```markdown
## How to Use This Document

**If you're fixing a bug:** Read Section 1 (Critical Rules) + relevant section in Section 2
**If you're adding a feature:** Read Section 2 (how the system works) + check SSOT.md for database details
**If you're deploying:** Read Section 3 (Operations) + Section 8 (Runbooks)
**If you're debugging:** Read the Release History appendix (what changed when)
```

---

## SSOT CLEANUP STEPS

### Step 1: Remove Historical Changelog from Main Document

**Current:** Lines 1057-1103 detailed historical changes (2026-02-09 through 2026-02-25) clutter the "Last Updated" section

**Action:**
- Keep ONLY: "Last Updated: 2026-02-25" + "Latest Event: [one line]"
- Move ALL dated changelog (2026-02-13 through 2026-02-24) to APPENDIX
- New main "Last Updated" section:
  ```markdown
  ## Last Updated
  - **Date:** February 25, 2026
  - **Latest:** Onboarding Wizard Schema (2 tables + 3 org columns)
  - **Status:** ✅ All systems operational, zero technical leakage, 56p/min billing verified

  **For what changed recently, see APPENDIX: Release History**
  ```

### Step 2: Consolidate Billing Tables Section

**Current Problem:**
- Lines 485-661 explain `credit_transactions`, `processed_webhook_events`, `credit_reservations` in excruciating detail
- Each table has 40+ lines of explanation
- RPC functions repeated multiple times
- Historical test results mixed with current state

**Action:** Restructure as lean reference:
```markdown
## Billing Tables (3 Critical Tables)

### credit_transactions
**Purpose:** Immutable ledger of wallet transactions (topups, deductions, refunds)
**Columns:** id, org_id, amount_pence, type, stripe_payment_intent_id, call_id (NEW 2026-02-16), vapi_call_id (NEW 2026-02-16), created_at
**Key Feature:** UNIQUE(call_id) prevents duplicate billing per call
**Rates:** 56 pence/min GBP (fixed, enforced at RPC level)
**Status:** ✅ Operational, E2E tested, zero leaks

### processed_webhook_events
**Purpose:** Idempotency tracking (prevent duplicate processing)
**Columns:** id, event_id, event_type, org_id, status, created_at
**Key Feature:** UNIQUE(event_id) enforces exactly-once processing
**Retention:** 24 hours (auto-cleanup)
**Status:** ✅ Operational, all sources supported (Stripe, Vapi, Twilio)

### credit_reservations
**Purpose:** Hold wallet balance during active calls (auth-then-capture pattern)
**Columns:** id, org_id, call_id (UNIQUE), reserved_pence, committed_pence, status, expires_at
**Key Feature:** UNIQUE(call_id) + expiry at 60min prevents infinite holds
**Status:** ✅ Operational, kill switch integrated
```

Result: ~80 lines instead of 180 lines. No loss of critical information.

### Step 3: Collapse Configuration Tables Section

**Current (Lines 805-880):** 17 "configuration tables" with mostly empty descriptions
- Most entries are 3-4 lines: "name | purpose | row count | columns | key | FKs"
- These are just metadata for internal reference, not required reading

**Action:** Replace entire section with compact table:
```markdown
## Configuration Tables (17 - System Setup)

| Table | Purpose | Used By |
|-------|---------|---------|
| agents | AI agent configs | Voice calls |
| services | Service catalog | Dashboard |
| knowledge_base* | KB articles | RAG queries |
| integrations | API configs | Tool sync |
| org_credentials | Encrypted API keys | All services |
| verified_caller_ids | Outbound caller ID verification | Telephony |
| onboarding_events | Funnel telemetry | Cart abandonment job |
| abandonment_emails | Sent-email ledger | Cart abandonment job |
| [9 others: escalation_rules, audit_logs, etc.] | Various | Various |

**Note:** For detailed schema on any table, search by table name in sections above.
```

Result: 80 lines becomes 20 lines.

### Step 4: Remove Repeated RPC Explanations

**Current:** RPC functions explained in:
1. Individual table sections (e.g., credit_transactions lines 645-650)
2. "Phase 2" section (lines 185-195)
3. Multiple "Business Logic" subsections

**Action:** Create ONE "RPC Functions Reference" mini-section right after billing tables:
```markdown
## Critical RPC Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| reserve_call_credits() | Hold wallet during call (5min) | { reservation_id, reserved_pence } |
| commit_reserved_credits() | Capture actual cost at call end | { transaction_id, committed_pence, released_pence } |
| check_balance_and_deduct_asset_cost() | Atomic phone provisioning | Success/failure + remaining balance |

**Key Principle:** All use FOR UPDATE row locks → zero race conditions
**Status:** ✅ All 3 deployed, production verified, 56p/min enforced
```

Result: Removes 100+ lines of scattered explanations.

### Step 5: Simplify Multi-Tenancy & Security Section

**Current (Lines 924-937):** 14 lines of mostly obvious statements ("All tables have org_id", "RLS Enabled: Yes")

**Action:** Replace with:
```markdown
## Security & Multi-Tenancy

**Isolation Model:** JWT org_id from Supabase Auth → RLS filters all queries → Database enforces via policies
**Status:** ✅ 23+ RLS policies active across 28 tables, automated verification scheduled daily
**Critical Invariant:** `org_id` is SINGLE SOURCE OF TRUTH — no user_id based queries, no cross-org data leaks
```

Result: 14 lines → 4 lines, same information.

### Step 6: Consolidate "Last Updated" & Historical Sections

**Current:** Lines 1012-1070+ are a chronological mess with:
- "Last Updated" header at line 1012
- "Previous Events" at line 1038
- Nested changelog entries going back to 2026-02-09
- Mix of current status + historical facts

**Action:**
- Move ALL dates before 2026-02-25 to **APPENDIX: Release History**
- Keep "Last Updated" section (5 lines max):
  ```markdown
  ## Status & Last Updated
  **Current:** February 25, 2026
  **Latest Event:** Onboarding Wizard Schema + Dashboard E2E Fixes deployed
  **Key Metrics:** ✅ 32 tables, 183 indexes, 23 RLS policies, 56p/min billing enforced

  For what changed when, see **APPENDIX: Release History**
  ```

Result: Remove 50+ lines from main document, consolidate into appendix.

### Step 7: Create "At a Glance" Summary Table

**New section after intro:**
```markdown
## System Status at a Glance

| Component | Status | Key Metric |
|-----------|--------|-----------|
| **Database** | ✅ Production | 32 tables, 183 indexes, 23 RLS policies |
| **Billing** | ✅ Production | 56 pence/min GBP, atomic enforcement, zero leaks |
| **Multi-Tenancy** | ✅ Hardened | org_id isolation, daily RLS verification |
| **Security** | ✅ Hardened | 95+/100 score, P0 vulns mitigated, 132+ exposures fixed |
| **Webhooks** | ✅ Production | Defense-in-depth idempotency, 24-96hr retention |
| **Onboarding** | ✅ Production | 5-step wizard, auto-provisioning, cart abandonment (3-email) |

**For details on any component, search by name in the sections below.**
```

This goes near the top so developers instantly know the system is healthy.

---

## EXECUTION CHECKLIST

### Phase 1: PRD Cleanup (Do These in Order)
- [ ] Remove "TIER 1/2/3" terminology, replace with simpler section names
- [ ] **Consolidate billing:** Keep Section 2.5, delete duplicate billing from 3 and 6.4, summarize to 50 lines max
- [ ] **Move changelog:** Create "Release History" appendix, move all dates 2026-02-13 through 2026-02-25 there
- [ ] **Consolidate forms:** Create forms overview table in Section 6, remove ⚠️ warnings
- [ ] **Simplify technical references:** Replace TIER 2.5 reference table with 5-line "See SSOT.md" guidance
- [ ] **Create "How to Read":** Replace confusing intro with clear navigation guide
- [ ] **Cleanup Section 6:** Consolidate 6.6-6.9, remove redundancy
- [ ] Verify no section > 150 lines (except appendix)

**Target:** ~400-500 lines (currently 876)

### Phase 2: SSOT Cleanup (Do These in Order)
- [ ] **Remove history:** Delete lines 1012-1103 (historical changelog), move to appendix
- [ ] **Simplify "Last Updated":** 5 lines max, point to appendix for history
- [ ] **Consolidate billing tables:** Replace 180-line section with lean 80-line reference (keep all critical info)
- [ ] **Create RPC functions reference:** One table with all 3 critical functions, remove scattered explanations
- [ ] **Collapse config tables:** Replace detailed 17-table section with compact reference table (20 lines max)
- [ ] **Add "At a Glance" table:** Near top, instant system health overview
- [ ] **Simplify security section:** Replace obvious statements with 4-line critical invariants
- [ ] Verify no section > 100 lines (except production tables section which can be 120 lines for schema details)

**Target:** ~600-700 lines (currently 1165)

### Phase 3: Verification
- [ ] Read both documents top-to-bottom (should take 20 minutes total for PRD + SSOT)
- [ ] Check: No duplicate explanations of the same concept
- [ ] Check: All references to historical events point to Release History appendix
- [ ] Check: All technical references point to appropriate SSOT.md section
- [ ] Check: First 50 lines of EACH document can stand alone (new reader understands scope)
- [ ] Check: No "⚠️ WARNING" or "🔴 CRITICAL" repeated more than once per concept

---

## Output Format

After cleanup:
1. **`.agent/prd.md`** — Cleaned PRD (~450 lines)
2. **`.agent/database-ssot.md`** — Cleaned SSOT (~650 lines)
3. **APPENDIX (within each file):** Release History section with all dated changes

Each document should:
- Start with 2-3 line overview of what it is
- Have clear section numbers (1, 2, 3...)
- Have "See SSOT.md Section X" cross-references instead of duplicating details
- End with appendix (historical changelog, old release notes)

---

## Success Criteria

✅ **PRD:** Any developer can read in 15 minutes, understand what the system does, where to find technical details
✅ **SSOT:** Any developer can read in 20 minutes, understand database schema, find critical invariants, navigate to relevant sections
✅ **No Duplication:** Each concept explained exactly ONCE (redirect to that location for additional context)
✅ **Clarity:** ZERO confusion about which document is authoritative for a given topic
✅ **Maintainability:** New features can be added to Section X with a one-line cross-reference to SSOT.md

---

## Critical Don'ts

❌ Don't remove:
- Critical Rules (Section 1 of PRD)
- Production deployment URLs/config
- Database table schemas in SSOT
- RPC function signatures
- Security/compliance policies

❌ Do remove:
- Test results from 2026-02-14 (dates, timestamps, implementation cruft)
- Detailed breakdowns of "how we fixed X bug" (belongs in commit logs, not docs)
- Multiple explanations of same feature
- Historical context that doesn't affect current operations
- TIER terminology and confusing hierarchies

---

## Notes for Executor

- This is a **documentation consolidation**, not a code change
- No functional changes to the system
- Goal: Make reading these docs 50% faster by removing 40% of the content (via consolidation, not deletion)
- Use markdown tables liberally for dense information
- Link between sections with "See Section X" instead of duplicating
- Keep the Release History appendix for reference, but hide it from main narrative

