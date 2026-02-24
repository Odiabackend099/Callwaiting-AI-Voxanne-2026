# PRD Current State: 2026-02-24

**Status:** ✅ PRODUCTION READY - Multi-Number Support Enabled
**Last Update:** 2026-02-24 (Bug 3 Fix Deployed)
**Version:** 2026.38.0

---

## What the PRD Should Contain (Clear Hierarchy)

### TIER 1: Non-Negotiable Truths (NEVER Change)

1. **Backend is Sole Vapi Provider**
   - ONE Vapi API key in backend `.env`
   - ALL orgs share single key
   - Tools registered globally, linked to each org's assistants
   - Reference: PRD Section "CRITICAL ARCHITECTURE RULE"

2. **Multi-Tenant Isolation via org_id**
   - JWT `app_metadata.org_id` = single source of truth for org
   - Every query filters by `org_id`
   - RLS policies enforce at database level
   - Reference: SSOT.md Section 2

3. **Wallet Balance Must Be Enforced**
   - Check BEFORE deducting
   - Deduct ATOMICALLY
   - Negative balances trigger kill switch
   - Reference: PRD Section 2.5 (Real-Time Prepaid Billing)

### TIER 2: Current Architecture (Reference SSOT.md)

4. **Multi-Number Support: 1 Inbound + 1 Outbound per Org** ✅ NEW (2026-02-24)
   - `org_credentials` constraint: `UNIQUE(org_id, provider, type)`
   - Each direction stored separately with independent vapi_phone_id
   - RPC parameter: `p_routing_direction` (not `p_type`)
   - Service always writes org_credentials (no skip logic)
   - Reference: SSOT.md Section 9 + PRD_UPDATE_2026_02_24.md

5. **org_credentials IS SSOT for Credential Discovery**
   - Agent dropdowns query `org_credentials`, not `managed_phone_numbers`
   - Dual-write strategy: Both tables must be kept in sync
   - Deletion: Hard-delete from `org_credentials`, soft-delete from `managed_phone_numbers`
   - Reference: SSOT.md Section 10 + Invariant 9

6. **Webhook Architecture: Single Endpoint**
   - `/api/vapi/webhook` (vapi-webhook.ts) = used by production
   - `/api/webhooks/vapi` (webhooks.ts) = unused legacy
   - DO NOT modify webhooks.ts — it won't affect production
   - Reference: PRD Section "WEBHOOK ARCHITECTURE - CRITICAL"

7. **Billing: Real-Time Prepaid with Kill Switch**
   - Phase 1: Atomic asset billing (phone provisioning)
   - Phase 2: Credit reservation (active calls)
   - Phase 3: Kill switch (endCall when balance ≤ 0)
   - Reference: PRD Section 2.5

### TIER 3: Operational Details (Query SSOT.md, not PRD)

8. **Database Tables & Columns**
   - Reference SSOT.md, don't duplicate in PRD
   - Keep PRD focused on business logic, not schema

9. **RPC Functions & Helpers**
   - Reference SSOT.md, don't duplicate
   - Keep PRD as business contract, not technical spec

10. **Compliance & Audit Logs**
    - Reference SSOT.md Section on Compliance
    - Keep PRD focused on what we promised to customers

---

## What to REMOVE from PRD (Conflicting/Stale)

❌ **Old Tiered Pricing** — No longer exists, wallet model only
❌ **"Skip for 2nd Number" Pattern** — This was the bug, now deleted
❌ **Confusing "Single-Slot" References** — Outdated, replaced by multi-direction
❌ **Dashboard Field Mapping Tables** — Moved this to SSOT.md Section 11
❌ **Webhook Column Mappings** — Reference SSOT.md for source-of-truth
❌ **"BYOC Credential Storage" Confusion** — Clarified as `org_credentials` SSOT
❌ **Duplicate Explanation of Advisory Locks** — Reference SSOT.md Invariant 4
❌ **Old "Fortress Protocol" Details** — Keep only if still relevant to business
❌ **Lengthy Troubleshooting Logs** — Archive to separate docs, keep PRD focused

---

## PRD Structure (Recommended)

### Section 1: Business Overview
- Purpose (solve scheduling for healthcare)
- Target market (SMB practices)
- Value prop (inbound → booking → billing automation)
- Pricing (wallet model, £25 minimum, 56p/min calls)

### Section 2: Core Features
- **Inbound Calling:** AI receptionist answers, qualifies leads, books appointments
- **Outbound Calling:** Agent-assisted callbacks, integrates with calendar
- **Appointment Booking:** Google Calendar sync, automatic reminders
- **Multi-Number Support:** 1 inbound + 1 outbound per org (NEW 2026-02-24)
- **Knowledge Base:** RAG pipeline for intelligent responses
- **Compliance:** UK GDPR primary, HIPAA secondary

### Section 3: Technical Architecture (High-Level)
- **Deployment:** Frontend (Vercel) + Backend (Render) + Supabase + Stripe + Twilio + Vapi
- **Multi-Tenancy:** org_id-based isolation, RLS enforcement
- **Billing:** Real-time prepaid with atomic deductions + kill switch
- **Webhook:** Single `/api/vapi/webhook` endpoint for all Vapi events
- **Credential SSOT:** `org_credentials` table (reference SSOT.md for details)

### Section 4: Implementation Status
- ✅ Phase 1: Core inbound calling
- ✅ Phase 2: Appointment booking
- ✅ Phase 3: Outbound calling
- ✅ Phase 4: Multi-number support (2026-02-24)
- ✅ Phase 5: Real-time prepaid billing (2026-02-14)
- ✅ Security: RLS + encryption + credential SSOT
- ✅ Compliance: UK GDPR primary + HIPAA secondary

### Section 5: References
- **Database Schema:** SSOT.md (authoritative)
- **Critical Invariants:** SSOT.md Section 13
- **Managed Phone Numbers:** SSOT.md Section 9 + PRD_UPDATE_2026_02_24.md
- **Billing System:** PRD Section 2.5 + SSOT.md Section 5
- **Webhook Architecture:** PRD Section "WEBHOOK ARCHITECTURE" + SSOT.md Section 11

---

## What CHANGED in 2026-02-24 Update

### Database (Production Deployed)
- RPC `insert_managed_number_atomic()`: Parameter `p_type` → `p_routing_direction`
- Constraint on `org_credentials`: `UNIQUE(org_id, provider)` → `UNIQUE(org_id, provider, type)`
- Now supports 1 inbound + 1 outbound number per org ✅

### Code (Commit 3a84709)
- `saveTwilioCredential()`: Accepts `type` parameter, uses direction-aware onConflict
- `managed-telephony-service.ts`: Removed "skip for 2nd number" logic, always writes org_credentials
- `csrf-protection.ts`: Added voice-preview to skipPaths (Bug 1)
- `vapi-sync.ts`: New proxy module (server crash fix)

### Result
- ✅ Outbound number +16812711486 purchased successfully
- ✅ Two rows in org_credentials (one per direction)
- ✅ Agent can select outbound number from dropdown
- ✅ Outbound calls use correct vapi_phone_id

---

## Key Decisions Locked In (Do Not Revert)

1. **Multi-direction approach** — Using `type` column on `org_credentials` is correct (aligns with RPC logic)
2. **Dual-write strategy** — Always write to both `managed_phone_numbers` AND `org_credentials` (SSOT consistency)
3. **Direction-aware RPC** — Using `p_routing_direction` parameter, not `p_type` (must match unique index)
4. **Complete deletion flow** — Hard-delete from org_credentials, soft-delete from managed_phone_numbers (6-step cleanup)
5. **Single Vapi provider model** — Backend holds the key, organizations don't have their own Vapi credentials

---

## For Next Developer Reading This

**Step 1: Read SSOT.md** (1-2 hours)
- Understand database architecture
- Review Critical Invariants section
- Pay special attention to Invariant 9 (Phone Numbers)

**Step 2: Read This Document** (15 mins)
- Understand what changed in PRD
- Know what to keep/remove
- Understand the multi-number decision

**Step 3: Read PRD_UPDATE_2026_02_24.md** (30 mins)
- See exactly what changed
- Understand the Bug 3 fix
- Learn the pattern for future multi-faceted constraints

**Step 4: Reference, Don't Replicate**
- PRD = Business promises to customers
- SSOT.md = Technical implementation truth
- Don't duplicate schema/code details in PRD
- Reference by link instead

---

**Status:** ✅ PRODUCTION READY
**Bug 3 (Multi-Number Support):** ✅ FIXED & VERIFIED
**Next Review:** 2026-03-03 (monthly review)

