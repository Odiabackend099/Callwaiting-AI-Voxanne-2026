# Voxanne AI – Product Requirements Document (PRD)

**Version:** 2026.32.0
**Last Updated:** 2026-02-13 17:50 UTC
**Status:** ✅ Production validated (Golden Record SSOT + Wallet Billing + Managed Telephony + Onboarding Form)

---

## 1. Purpose & Scope
Voxanne AI delivers a production-ready AI receptionist for healthcare practices. This PRD is the single source of truth for:

1. Product capabilities and business outcomes
2. Technical architecture (voice pipeline, billing, analytics)
3. Verification status and operational checklists

It intentionally removes legacy tiered pricing, stale troubleshooting notes, and duplicative implementation logs so new contributors can ramp quickly.

---

## 2. Product Overview
| Area | Description |
|------|-------------|
| Target user | Healthcare practices that need an AI assistant to qualify leads, book appointments, and route calls |
| Core value prop | End-to-end automation from inbound call → appointment → billing, with auditable Golden Record data |
| Deployment | Frontend (Next.js / Vercel) + Backend (Node/Express on port 3001) + Supabase (Postgres + Auth) + Stripe + Twilio + Vapi |
| Pricing model | Pay-as-you-go wallet. Customers top up from **£25** (2,500 pence). Calls billed at **$0.70/min (≈56p/min)**. |

---

## 3. Core Capabilities
1. **AI Voice Agent** – Handles inbound/outbound calls via Vapi, executes tools (availability checks, booking, KB queries, transfer, end call).
2. **Golden Record SSOT** – Unified `calls` + `appointments` schema with cost, appointment linkage, tools used, and end reasons for analytics.
3. **Wallet Billing** – Stripe Checkout top-ups, auto-recharge, credit ledger, webhook verification, and fixed-rate per-minute deductions.
4. **Managed Telephony** – Purchase Twilio subaccount numbers, surface in Agent Config, enforce one-number-per-org, support manual AI Forwarding.
5. **Dashboards & Leads** – Production dashboards for call stats, sentiment, lead enrichment, conversion tracking, and Geo/SEO telemetry.
6. **Onboarding Form** – Intake form at `/start` collects company info, greeting script, voice preference, and optional pricing PDF. Auto-sends confirmation email to user and support notification to support team. Stores submissions in `onboarding_submissions` table with full audit trail.
7. **Security & Compliance** – JWT middleware using `jwt-decode`, Supabase RLS on all tenant tables, hardened functions (`search_path` pinned to `public`).

---

## 4. System Architecture Summary
```
Caller → Twilio/Vapi → Vapi webhook → backend/src/routes/vapi-webhook.ts
    ↳ Calls table (Golden Record columns)
    ↳ Appointments table + bidirectional linkage
    ↳ Supabase views feed dashboard routes

Stripe Checkout (wallet top-up) → Stripe webhooks → BullMQ queue → wallet service
    ↳ credit_wallets + credit_transactions ledger
    ↳ webhook verification API ensures wallet credited

Managed number provisioning → Twilio subaccounts → Vapi import → org_credentials + managed_phone_numbers
```
Supporting services: wallet auto-recharge processor, webhook verification API, analytics/Geo instrumentation, AI Forwarding GSM code generator.

---

## 5. Recent Releases & Verification
| Date (UTC) | Release | Key Outcomes |
|------------|---------|--------------|
| 2026-02-13 | **Onboarding Form E2E** | Form submission at `/start` fully operational: FormData → backend validation → database storage → dual email delivery (user confirmation + support notification). Field name fix applied (greeting_script), comprehensive logging added, email verification API endpoints deployed. 20+ successful submissions tested. |
| 2026-02-13 | **Golden Record SSOT** | Calls enriched with cost_cents, appointment linkage, tools_used, ended_reason; dashboard + analytics updated. |
| 2026-02-13 | **Stripe Wallet E2E validation** | Frontend Wallet page aligned with backend min top-up, stale Stripe customer auto-recovery, checkout verified with real test card. |
| 2026-02-12 | **JWT Auth & Billing Gates** | `requireAuth*` middleware decodes JWTs, billing gate script passes 5/5 phases. |
| 2026-02-10 | **Managed Number Surfacing** | Managed Twilio numbers dual-written to `org_credentials` with `(Managed)` badges. |
| 2026-02-09 | **Security Hardening** | 255→0 TS errors, Supabase RLS + function hardening, managed telephony bug fixes, phone_number_mapping table restored. |
| 2026-02-07 | **Wallet Pricing Overhaul** | Subscription tiers removed; pay-as-you-go wallet + pricing/FAQ/Terms copy rewritten; auto-recharge + webhook verification APIs shipped. |

All releases validated via manual E2E tests, automated scripts (wallet/billing, webhook verification, telephony, onboarding), and Supabase migration logs.

---

## 6. Functional Requirements
### 6.1 AI Call Handling
- Voice agent must execute tools in order: `checkAvailability` → `bookClinicAppointment` → `transferCall`/`endCall`.  
- `queryKnowledgeBase` is mandatory for answering content questions (no hallucinated answers).  
- Every call writes a Golden Record row with cost, tool names, and appointment linkage within 1 second of webhook receipt.

### 6.2 Golden Record Analytics
- Calls table stores `cost_cents`, `appointment_id`, `tools_used[]`, `ended_reason`.  
- Appointments table stores `call_id`, `vapi_call_id`.  
- Dashboard APIs (`/api/calls-dashboard`, `/api/contacts`) must surface these fields for FE usage.  
- Data quality gates: no NULL cost on completed calls, appointment linkage attempted when booking tool invoked.

### 6.3 Wallet & Billing
- Minimum top-up: **2,500 pence (£25)**; preset buttons derive from env-configured rate.  
- Backend validates positive integer pence and recreates Stripe customer if stale.  
- Stripe Checkout sessions include `client_reference_id = orgId` and metadata (org, amount, credits).  
- Stripe webhooks processed async via BullMQ; wallet credits are idempotent per `stripe_payment_intent_id`.  
- Auto-recharge saves payment method (setup_future_usage). Job dedup key `recharge-${orgId}` prevents double charges.  
- Wallet deductions use fixed `RATE_PER_MINUTE_USD_CENTS = 70` and convert to GBP pence with `USD_TO_GBP_RATE`.

### 6.4 Telephony & AI Forwarding
- Managed number provisioning purchases via Twilio subaccounts and **must import into Vapi using subaccount credentials**.  
- `phone_number_mapping`, `managed_phone_numbers`, `twilio_subaccounts` tables required with RLS enabled.  
- Agent Config dropdown shows managed numbers with badges and enforces one active managed number per org (DB unique index + frontend guard).  
- AI Forwarding wizard generates GSM codes for supported carriers and verifies Twilio caller ID ownership before enabling.

### 6.5 Onboarding Intake Form
- Form page at `/src/app/start/page.tsx` accepts company name, email, phone (E.164), greeting script, voice preference, optional pricing PDF.
- Form submission validates required fields and submits FormData (multipart) to `POST /api/onboarding-intake`.
- Backend route `backend/src/routes/onboarding-intake.ts` stores submission to `onboarding_submissions` table with full details, UTM attribution, and timestamps.
- Auto-sends confirmation email to user's email address (via Resend) and support notification to support@voxanne.ai.
- Testing endpoints at `/api/email-testing/*` enable programmatic email verification without manual inbox checks.
- Submissions logged with structured context for debugging and audit trail.

### 6.6 Webhook Monitoring & Tooling
- `backend/src/routes/webhook-verification.ts` exposes:
  1. `GET /api/webhook-verification/payment/:paymentIntentId`
  2. `GET /api/webhook-verification/recent-transactions`
  3. `GET /api/webhook-verification/health`
- Health endpoint must report 24h counts for processed webhooks vs wallet credits.
- Stripe listener logs must include `charge.succeeded` events with org context.

### 6.7 Security & Compliance
- JWT decoding (`jwt-decode`) extracts `org_id` from `app_metadata`; no fallback user allowed.
- Supabase RLS enforced on all multitenant tables (wallets, calls, leads, appointments, phone mappings, onboarding_submissions).
- SECURITY DEFINER/INVOKER functions pin `search_path = public`.
- Credentials stored encrypted (AES-256-GCM) and accessed through IntegrationDecryptor caches.
- Onboarding form sanitizes input, validates email/phone format, and stores all data with audit timestamps.

---

## 7. Operational Runbooks
1. **Wallet Top-Up Validation**
   - Use test account `test@demo.com / demo123` (org ID from Supabase).
   - Navigate `/dashboard/wallet`, choose £25 preset, complete Stripe Checkout with `4242 4242 4242 4242`, exp `12/30`, CVC `123`.
   - Verify balance increase, transaction history entry, backend log `[StripeWebhook] Processing wallet top-up`, and Stripe listener `charge.succeeded`.

2. **Managed Number Provisioning**
   - Login as `voxanne@demo.com / demo@123`.
   - Buy local number from Telephony page (area code 415). Ensure success modal, Agent Config badge, and DB rows across both tables.
   - Attempt second purchase → UI + DB constraint should block.

3. **Golden Record Spot Check**
   - Trigger Vapi test call, end via `bookClinicAppointment` tool.
   - Confirm `calls.cost_cents > 0`, `appointment_id` populated, `tools_used` contains booking tool, dashboards reflect data.

4. **Onboarding Form Intake**
   - Navigate to `/start` and fill out form: company="Test Co", email="egualesamuel@gmail.com", phone="+1-555-123-4567", greeting="Thank you for calling", voice="AI (Neutral)".
   - Click Submit. Verify success message displays.
   - Confirm via API: `curl -s http://localhost:3001/api/email-testing/verify-submission/egualesamuel@gmail.com | jq '.verified'` (expected: true).
   - Check confirmation email sent and support notification received.

5. **Webhook Health**
   - Hit `/api/webhook-verification/health` (auth required) to ensure processed counts >0 and ratio = 1.0 after payments.

---

## 8. Test Accounts & Environment
| Purpose | Email / Credential | Notes |
|---------|-------------------|-------|
| Demo org | `voxanne@demo.com / demo@123` | Org `46cf2995-2bee-44e3-838b-24151486fe4e` for full dashboard & telephony flows |
| Payment QA | `test@demo.com / demo123` | Wallet testing, Stripe Checkout, webhook verification |
| Frontend URL | `http://localhost:3000` | Login at `/sign-in`, dashboard at `/dashboard` |
| Backend URL | `http://localhost:3001` | APIs secured via JWT middleware |
| Stripe keys | `pk_test_...`, `sk_test_...` (see `.env`) | Never hardcode secrets in client bundles |

---

## 9. Backlog / Open Questions
1. ~~Implement onboarding form intake~~  ✅ **COMPLETE** (2026-02-13) – Form submission, email delivery, and verification all operational.
2. Surface webhook verification status in frontend wallet success screen.
3. Expand AI Forwarding carrier library beyond current presets.
4. Add automated regression around Golden Record linkage (unit + integration).
5. Build monitoring alert when webhook_credit_ratio < 0.95 in health endpoint.
6. Evaluate retirement of `wallet_markup_percent` column once dynamic pricing roadmap defined.
7. Add Slack alerts for high-priority onboarding submissions (optional enhancement).

---

## 10. Acceptance Criteria Checklist
- [x] Wallet top-up increases balance, ledger entry recorded, backend + Stripe logs confirmed.
- [x] Managed telephony provisioning surfaces new numbers immediately and blocks duplicates.
- [x] Golden Record data visible in dashboard + analytics endpoints.
- [x] JWT auth never falls back to default org.
- [x] Webhook verification API deployed and queryable.
- [x] Onboarding form submission stores data, sends confirmation email to user, sends support notification to support@voxanne.ai.
- [x] Email delivery verified programmatically via `/api/email-testing/*` endpoints.
- [x] Form validation enforces required fields (company, email, phone, greeting_script).
- [x] Documentation kept concise (single source, no duplicated incident logs).

