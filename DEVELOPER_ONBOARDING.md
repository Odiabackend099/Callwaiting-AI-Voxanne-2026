# 🚀 Voxanne AI - Developer Onboarding Guide

**Welcome to Voxanne AI!** This document explains what we've built, where we are, and what you need to know as a new developer joining the team.

---

## 📋 Quick Summary (Read This First)

**Voxanne AI** is an AI-powered phone receptionist for healthcare practices.

**What it does:**
- 📞 Answers phone calls 24/7 using artificial intelligence
- 📅 Books appointments automatically
- 💰 Handles billing (charges customers per minute)
- 📊 Tracks everything in a dashboard
- 🔒 Keeps patient data secure

**Current Status:** ✅ **PRODUCTION READY**
- Live in production since February 2026
- Used by healthcare clinics
- Processing real patient calls
- Handling real money transactions

---

## 🎯 What Problem Does It Solve?

### The Challenge
Healthcare practices receive 50-200 calls per day. Traditional solutions:
- ❌ Require hiring a receptionist ($30K-50K/year)
- ❌ Miss calls after hours
- ❌ Make scheduling errors
- ❌ No-shows due to forgotten appointments

### Voxanne's Solution
- ✅ AI receptionist works 24/7 (no days off)
- ✅ Answers calls in seconds (no hold times)
- ✅ Books appointments with zero errors
- ✅ Sends appointment reminders (reduces no-shows)
- ✅ Costs only ~£0.56 per minute (cheaper than hiring)

### Example Call Flow
```
Patient calls clinic
    ↓
AI answers: "Hi! Thanks for calling XYZ Clinic. How can I help?"
    ↓
Patient: "I'd like to book an appointment"
    ↓
AI checks calendar: "We have openings Tuesday at 2 PM or Wednesday at 10 AM"
    ↓
Patient: "Tuesday at 2 PM please"
    ↓
AI books appointment & sends confirmation text
    ↓
Clinic receives notification in dashboard
```

---

## 💼 Business Model (How We Make Money)

**Pricing:** Pay-as-you-go wallet system

1. **Customer tops up wallet:** Deposits £25 minimum
2. **Per-call charges:** Calls cost £0.56 per minute
3. **Example:** A 5-minute call = £2.80 deducted from wallet
4. **Auto-recharge:** Optional - automatically tops up when balance is low

**Revenue per customer:**
- Low usage clinic: £50-150/month
- Medium clinic: £200-500/month
- High volume clinic: £1,000-5,000+/month

**Current Customers:** Small number of beta/pilot customers (healthcare clinics)

---

## 🏗️ Technical Architecture (Explained Simply)

### The Stack
**Frontend (What users see)**
- Website: `https://voxanne.ai` (signup, login, dashboard)
- Built with: Next.js + React + TypeScript
- Hosted on: Vercel

**Backend (The brains)**
- API server: `https://voxanneai.onrender.com`
- Built with: Node.js + Express + TypeScript
- Hosted on: Render
- Database: PostgreSQL (Supabase)

**Voice Service**
- Phone calls handled by: Vapi (third-party AI company)
- SMS messages sent by: Twilio
- Calendar integration: Google Calendar API

**Payments**
- Credit card processing: Stripe
- Wallet system: Custom built

### How It All Works Together
```
Customer opens dashboard
    ↓
Dashboard talks to backend API
    ↓
Backend queries database for customer's calls/appointments
    ↓
Dashboard shows: "You had 47 calls this month, 32 booked appointments"
    ↓
Customer gets a phone call
    ↓
Call goes to Vapi AI
    ↓
Vapi does the talking (with our custom prompts)
    ↓
When call ends, Vapi tells backend what happened
    ↓
Backend records: call duration, cost, whether appointment was booked
    ↓
Backend deducts cost from customer's wallet
    ↓
Dashboard updates in real-time
```

---

## ✨ Major Features We've Built

### 1. **AI Voice Agent** ✅
- Answers inbound calls with custom greeting
- Asks qualifying questions
- Checks calendar availability
- Books appointments automatically
- Routes complex calls to humans
- Works 24/7

**Business Impact:** Eliminates need for hiring receptionist

### 2. **Golden Record (Call Tracking)** ✅
- Every call recorded with:
  - Duration (how long they talked)
  - Cost (how much it cost)
  - Outcome (did they book? did they hang up?)
  - Appointment linked (which appointment was booked)
  - Tools used (what did the AI do)
  - Sentiment analysis (was the customer happy?)

**Business Impact:** Clinic can see exactly what happened on every call

### 3. **Real-Time Prepaid Billing Engine** ✅
This is a complex technical achievement - here's what it means:

- **Wallet System:** Customer tops up with credit (like a prepaid phone)
- **Per-Minute Charging:** Cost deducted in real-time as they talk
- **Prevention of Overspending:** If wallet runs out during a call, AI automatically disconnects
- **No Fraud:** Money is reserved BEFORE call starts, preventing double-charging

**Business Impact:**
- Clinic never surprises customer with unexpected charges
- Voxanne never loses money to overspending
- Estimated £500-2,000/month revenue protection

### 4. **Dashboard** ✅
Clinic managers see:
- 📊 Key metrics: Total calls, appointments booked, average call duration, customer satisfaction
- 📞 Call logs: List of all calls with search/filter
- 📅 Appointments: Upcoming appointments linked to calls
- 💰 Wallet: Current balance, transaction history, auto-recharge settings
- 👥 Leads: Contact list with lead scoring (hot prospects)
- ⚙️ Settings: Configure AI behavior, upload knowledge base, manage phone numbers

**Business Impact:** Clinic can see ROI of using Voxanne ("We got 47 calls, booked 32 appointments, saved $400 on receptionist salary")

### 5. **Knowledge Base (AI Training)** ✅
Clinic uploads:
- Frequently asked questions
- Service descriptions
- Pricing information
- Clinic policies

AI learns from this and answers patient questions accurately

**Business Impact:** AI gives correct answers (e.g., "Do you accept insurance?") instead of guessing

### 6. **Phone Number Management** ✅
- Buy new phone numbers from Vapi
- Configure which AI agent answers each number
- Support manual "AI Forwarding" mode
- **Multi-Number Routing (Feb 22, 2026):** Each number tagged as `inbound` or `outbound` — prevents routing conflicts when the same org uses separate numbers for AI receptionist vs. outbound callbacks

**Business Impact:** Clinic can have multiple numbers or branded local numbers, with dedicated inbound and outbound lines

### 7. **Onboarding Form** ✅
New customers fill out form at `/start`:
- Company name
- Greeting script (what AI says when answering)
- Voice preference (male/female/accent)
- Knowledge base (upload PDF or paste text)

System auto-sends confirmation email and support notification

**Business Impact:** Quick 5-minute setup, no sales call needed

### 8. **Verified Caller ID** ✅
For outbound calls, Voxanne verifies ownership of phone number with Twilio

**Business Impact:** Clinics can make outbound calls (appointment reminders, follow-ups)

### 9. **Security & Compliance** ✅
- Patient data encrypted
- Only clinic can see their own data (RLS - Row Level Security)
- HIPAA-ready infrastructure
- JWT authentication (secure login)

**Business Impact:** Healthcare-grade security, compliant with regulations

### 10. **Error Sanitization (LATEST - Feb 22, 2026)** ✅
All error messages are now user-friendly and secure:
- ❌ OLD: "PostgreSQL error: column 'verified_at' does not exist"
- ✅ NEW: "Failed to verify phone number. Please try again."

Technical details logged internally for debugging, not shown to users

**Business Impact:** Professional experience, no technical jargon confuses users

---

## 📈 Recent Major Achievements (Last 2 Weeks)

### February 22, 2026: Multi-Number Routing Architecture
**What:** Upgraded phone system from 1:1 (1 org = 1 number) to 1:N (1 org = multiple numbers) with direction tagging
**Why:** Same number for inbound + outbound caused routing conflicts — patients calling back reached the wrong agent prompt
**Impact:** Orgs can now have dedicated inbound (AI receptionist) and outbound (callbacks/sales) numbers with zero routing conflicts
**Scope:** 14 files modified (1 migration + 8 backend + 5 frontend), all 6 critical invariants preserved

### February 22, 2026: Error Sanitization Security Hardening
**What:** Fixed 132+ places where technical errors were exposed to users
**Why:** Security - attackers could see database structure and find vulnerabilities
**Impact:** Platform is now production-grade secure

### February 21, 2026: Dashboard UI Overhaul
**What:** Completely redesigned dashboard with better metrics, filters, and navigation
**Why:** Previous dashboard was hard to use and missing key features
**Impact:** Clinic managers can now easily find calls, filter by status, see key metrics

### February 14, 2026: Billing Engine Deployment
**What:** Complex three-phase billing system (prepare charge → hold funds → capture payment)
**Why:** Prevents overspending, eliminates fraud, ensures revenue accuracy
**Impact:** Clinic can trust that charges are fair and transparent; Voxanne protected against revenue loss

### February 7, 2026: Pricing Overhaul
**What:** Changed from complicated tiered pricing to simple pay-as-you-go wallet
**Why:** Easier for customers to understand and budget
**Impact:** More customers comfortable with predictable per-minute pricing

---

## 🎓 What You Need to Know as a Developer

### The Repository Structure
```
/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/
├── frontend/                    # Next.js website (next.js, React, TypeScript)
│   ├── src/app/                # Pages (landing page, dashboard, login, etc)
│   ├── src/components/         # UI components (buttons, cards, modals)
│   └── src/utils/              # Helper functions
├── backend/                     # Node.js API server (Express, TypeScript)
│   ├── src/routes/             # API endpoints (/api/calls, /api/wallet, etc)
│   ├── src/services/           # Business logic (billing, authentication, etc)
│   ├── src/utils/              # Helpers (error sanitization, logging)
│   └── supabase/migrations/    # Database schema changes
├── .agent/prd.md               # Product Requirements Document (READ THIS!)
├── DEVELOPER_ONBOARDING.md     # This file
└── package.json                # Dependencies
```

### Key Files You'll Work With
1. **`.agent/prd.md`** - The source of truth for what we've built
   - What features exist
   - How they work
   - Current status
   - Operational runbooks

2. **`backend/src/utils/error-sanitizer.ts`** - How all errors are handled
   - Read this to understand error handling standards
   - Use this for any new error messages

3. **`backend/src/routes/`** - API endpoints
   - Each file handles one feature area
   - E.g., `calls-dashboard.ts` serves call metrics to dashboard

4. **`frontend/src/app/dashboard/`** - Dashboard pages
   - What clinic managers see
   - Where you'll add new features

### Important Concepts

**Multi-Tenancy:** Each clinic is separate
- Clinic A can ONLY see their own calls/appointments
- Clinic B can ONLY see their own data
- This is enforced at database level (RLS - Row Level Security)
- Your code MUST always filter by `org_id` (clinic ID)

**Golden Record:** Single source of truth for call data
- Every call creates a record with: duration, cost, outcome, appointment, tools used, sentiment
- Dashboard pulls from this record
- Billing system uses this record
- You should NEVER update this record unless you're sure it's correct

**Pre-Paid Billing:** Money reserved BEFORE service delivered
- When call starts: Backend reserves £0.56/min from wallet
- When call ends: Backend calculates actual cost and captures payment
- If wallet runs out: AI automatically hangs up
- This prevents overspending and fraud

---

## 🔍 How to Get Started (Your First Week)

### Day 1: Read & Understand
1. Read the PRD (`.agent/prd.md`) - spend 1-2 hours
2. Understand the business model (pay-as-you-go wallet billing)
3. Watch a demo call (ask for access to production)
4. Look at the dashboard as a clinic manager

### Day 2-3: Set Up Environment
```bash
# Clone repo
git clone https://github.com/Odiabackend099/Callwaiting-AI-Voxanne-2026.git

# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Set up .env file (ask team for credentials)
# Copy .env.example to .env and fill in values

# Start servers
npm run dev        # Starts both frontend & backend
```

### Day 4-5: Explore Code
1. Open frontend at `http://localhost:3000`
2. Login with test account: `test@demo.com / demo123`
3. Look around dashboard - understand what data is shown
4. Trace a feature: Find where dashboard calls API → where backend queries database → understand the data flow

### End of Week 1: Small Task
Ask your manager for a small bug fix or feature (e.g., "Change button color from blue to green")
- This will teach you the development workflow
- You'll learn the git process, testing, deployment

---

## 🐛 Common Issues & How to Debug

### Problem: "Why is my call cost wrong?"
**Check:**
1. Go to `backend/src/routes/vapi-webhook.ts` - this records calls
2. Search for "cost_cents" - see how cost is calculated
3. Check `backend/src/services/wallet-service.ts` - see how payment is deducted
4. Look at `.agent/prd.md` section on "Real-Time Prepaid Billing Engine"

### Problem: "Why can't this clinic see another clinic's calls?"
**Answer:** Multi-tenancy RLS (Row Level Security)
- Check `backend/src/middleware/requireAuth.ts` - extracts org_id from login
- This org_id filters ALL queries
- Database enforces this at the data level (RLS policies)
- This is INTENTIONAL - safety feature

### Problem: "Why is the dashboard slow?"
**Check:**
1. Sentry dashboard: `https://sentry.io/organizations/voxanne/`
2. Look for slow API calls
3. Check `.agent/prd.md` section on "Error Monitoring & Debugging"
4. Follow the debugging runbook

### Problem: "Where do I find the X feature?"
**Answer:** Check `.agent/prd.md`
- Section 3 lists all 10 features
- Each has a brief description
- Tells you which files implement it

---

## 📞 Who to Ask Questions

### Technical Questions
- "How does the billing engine work?" → See `.agent/prd.md` Section 2.5
- "How do I add a new API endpoint?" → Look at similar endpoint in `backend/src/routes/`
- "How do I fix a bug?" → Follow runbook in `.agent/prd.md` Section 7

### Product Questions
- "Why did we build this feature?" → Check `.agent/prd.md` section for that feature
- "What's the current status?" → Check recent releases in `.agent/prd.md` Section 5

### Business Questions
- "How much do we charge?" → £0.56 per minute (see this guide, section "Business Model")
- "How much revenue are we making?" → Ask management (depends on customer usage)
- "Who are our customers?" → Healthcare clinics (ask for customer list)

---

## 🎯 Your First Goals as a Developer

### Week 1-2: Understanding
- [ ] Read the PRD completely
- [ ] Understand the business model
- [ ] Set up local development environment
- [ ] Make a successful API call and see response in code
- [ ] Understand how multi-tenancy RLS works

### Week 3-4: First Contribution
- [ ] Find a small bug or feature request
- [ ] Create a branch
- [ ] Make the change
- [ ] Test locally
- [ ] Create a pull request
- [ ] Get code review
- [ ] Merge to main
- [ ] See it deployed to production

### Month 2: Own a Feature
- [ ] Pick a feature area (e.g., "calls dashboard", "wallet billing", "phone numbers")
- [ ] Understand how it works end-to-end
- [ ] Make improvements
- [ ] Monitor in production
- [ ] Become the expert on that feature

---

## 📚 Important Documents to Read

### Must Read
1. **`.agent/prd.md`** - Everything about what we built (2-3 hours)
2. **`DEVELOPER_ONBOARDING.md`** - This file (15 minutes, you're reading it now)

### Should Read
3. **`backend/src/utils/error-sanitizer.ts`** - Code comments explain error handling
4. **`backend/package.json`** - See what libraries we use and why
5. **`.github/workflows/ci.yml`** - Automated tests that run on every commit

### Nice to Read
6. **`DISASTER_RECOVERY_PLAN.md`** - What happens if something breaks
7. **`RUNBOOK.md`** - How to debug common issues

---

## 🚀 Deployment & Production

### How Code Gets to Production
```
You write code locally
    ↓
You create a git branch (git checkout -b my-feature)
    ↓
You push to GitHub (git push origin my-feature)
    ↓
GitHub runs automated tests (CI pipeline)
    ↓
You create a Pull Request
    ↓
Team reviews your code
    ↓
You merge to main branch
    ↓
GitHub auto-deploys to production
    ↓
Your code is live on https://voxanne.ai
    ↓
Real clinics are using it
```

### Important: Don't Break Production
- ALWAYS test locally first
- ALWAYS get code review before merging
- ALWAYS run existing tests to make sure you didn't break anything
- ALWAYS check `.agent/prd.md` CRITICAL INVARIANTS section before changing core logic

---

## 💡 Pro Tips

1. **The PRD is your friend**
   - Confused about a feature? Check the PRD
   - Want to understand why something works that way? Check the PRD
   - Need to know the current status? Check the PRD
   - It's updated constantly with latest info

2. **Start small, think big**
   - Your first week: small bug fix
   - Your second month: own a feature area
   - Your third month: suggest improvements
   - Your sixth month: design new features

3. **Ask questions early**
   - Better to ask "why?" and understand than to waste time guessing
   - The team expects you to ask questions
   - There's no such thing as a dumb question in onboarding

4. **Read the error messages**
   - If something breaks, read the error message in full
   - Look at the request_id in Sentry
   - Follow the debugging runbook in the PRD
   - 90% of bugs can be solved by reading error messages carefully

5. **Respect multi-tenancy**
   - ALWAYS filter by org_id
   - NEVER assume a user can see another user's data
   - Test with multiple clinics to make sure isolation works
   - This is a security feature - treat it seriously

---

## ❓ FAQ

**Q: What language is this written in?**
A: TypeScript (a safer version of JavaScript). Frontend uses React. Backend uses Express.

**Q: Do I need to know React?**
A: For frontend work, yes. For backend work, no. Ask your manager what you'll be working on.

**Q: How often do things break?**
A: Rarely. We have good tests. When something does break, check Sentry (error tracking) and the runbook.

**Q: Can I delete customer data by accident?**
A: Very hard. Database enforces RLS (multi-tenancy). You can only delete data you have permission to delete. Still be careful!

**Q: How do I run tests?**
A: `npm run test` in either frontend or backend directory. Always run tests before submitting code.

**Q: How do I see what my code changed?**
A: `git diff` shows changes. Use this before committing to make sure you didn't change anything by accident.

**Q: What if I make a mistake in production?**
A: Don't panic! We have backups and rollback procedures. Tell your manager immediately. Check the PRD section on "Disaster Recovery" to understand the process.

**Q: How do I know if my code is working?**
A:
1. Test locally first: `npm run dev` and try the feature
2. Check for errors: Look in browser console (frontend) or backend logs
3. Get code review: Another developer looks at your code
4. Check Sentry after deploy: Did errors increase? Are there new errors?

**Q: Who do I ask if something is wrong?**
A:
1. Check the PRD first (it probably explains it)
2. Check existing code (look for similar patterns)
3. Ask a senior developer
4. Ask the team lead

---

## 🎓 Next Steps

1. **Today:** Read this guide completely
2. **Tomorrow:** Read the PRD (`.agent/prd.md`)
3. **Day 3:** Set up your development environment
4. **Day 4-5:** Explore the codebase
5. **Week 2:** Make your first commit
6. **Week 3:** Deploy your first feature
7. **Month 2:** Own a feature area
8. **Month 3:** Lead a feature project

---

## 📞 Contact

- **Questions about the codebase?** Ask your tech lead
- **Questions about the product?** Check the PRD or ask product manager
- **Questions about deployment?** Check the runbook or ask DevOps
- **Questions about business?** Ask your manager

---

## 📞🔀 Multi-Number Routing Architecture (February 22, 2026)

This section documents the multi-number routing upgrade — one of the largest architectural changes to the phone system. Read this if you're working on anything related to phone numbers, outbound calls, agent configuration, or telephony provisioning.

### The Problem

Each org was limited to **1 AI phone number**. That single number was used for both:
- **Inbound calls** — AI receptionist answers patient inquiries
- **Outbound calls** — Sales callbacks, appointment reminders

This caused a critical routing conflict: if a patient missed an outbound call and called back, the system loaded the **outbound agent prompt** (sales script) instead of the **inbound agent prompt** (receptionist). Wrong agent, wrong experience.

### The Solution: 1:N Phone Number Model

Upgraded from `1 org = 1 number` to `1 org = N numbers`, with each number explicitly tagged:

| Direction | Purpose | Example |
|-----------|---------|---------|
| `inbound` | AI receptionist answers patient calls | `+1 (212) 555-0100` |
| `outbound` | Caller ID for callbacks and sales | `+1 (212) 555-0200` |
| `unassigned` | Reserved, not yet configured | — |

**Current limit:** 1 inbound + 1 outbound per org (expandable later).
**Backward compatibility:** All existing numbers automatically defaulted to `inbound`. Zero downtime.

### Database Schema Changes

**Migration:** `backend/supabase/migrations/20260222_add_routing_direction.sql`

**`managed_phone_numbers` table — new column:**
```sql
routing_direction TEXT NOT NULL DEFAULT 'inbound'
  CHECK (routing_direction IN ('inbound', 'outbound', 'unassigned'))
```
Index: `idx_managed_numbers_direction` on `(org_id, routing_direction, status) WHERE status = 'active'`

**`agents` table — new column:**
```sql
linked_phone_number_id UUID REFERENCES managed_phone_numbers(id) ON DELETE SET NULL
```
Index: `idx_agents_linked_phone` on `(linked_phone_number_id) WHERE linked_phone_number_id IS NOT NULL`

**IMPORTANT:** `linked_phone_number_id` is **supplementary** to `vapi_phone_number_id`. Both are written on every agent save. `vapi_phone_number_id` remains the single source of truth for Vapi API calls (Critical Invariant #1 from CLAUDE.md).

**Updated RPC:** `insert_managed_number_atomic()` — upgraded from 9 to 10 parameters with `p_routing_direction TEXT DEFAULT 'inbound'`. Inbound direction creates `phone_number_mapping`; outbound direction skips mapping and updates the outbound agent's `linked_phone_number_id`.

### Backend Files Modified (8 files)

| # | File | What Changed |
|---|------|-------------|
| 1 | `backend/src/services/phone-validation-service.ts` | Added `RoutingDirection` type, `DirectionStatus` interface, per-direction validation (allows 1 inbound + 1 outbound) |
| 2 | `backend/src/routes/managed-telephony.ts` | Extracts `direction` from request body, validates, passes to provisioning chain |
| 3 | `backend/src/services/managed-telephony-service.ts` | Direction-aware provisioning, `routingDirection` in status response, cleanup on release |
| 4 | `backend/src/services/phone-number-resolver.ts` | Outbound resolution filters by `routing_direction = 'outbound'` first, with fallback |
| 5 | `backend/src/routes/phone-settings.ts` | Returns `numbers: { inbound, outbound, all }` grouped arrays |
| 6 | `backend/src/routes/founder-console-v2.ts` | Resolves `linked_phone_number_id` for outbound agent; test-call backfill writes both IDs |
| 7 | `backend/src/routes/contacts.ts` | Call-back backfill writes both `vapi_phone_number_id` AND `linked_phone_number_id` |
| 8 | `backend/src/routes/agent-sync.ts` | Additionally writes `linked_phone_number_id` on agent save |

**Files verified — no changes needed:** `calls-dashboard.ts`, `analytics.ts`, `dashboard-mvp.ts`, `dashboard-queries.ts` (all query `calls.call_direction`, not phone number tables), `outbound-call-preflight.ts`, `vapi-client.ts`.

### Frontend Files Modified (5 files)

| # | File | What Changed |
|---|------|-------------|
| 1 | `src/components/dashboard/BuyNumberModal.tsx` | Direction toggle (green=inbound, blue=outbound), per-direction limit check |
| 2 | `src/app/dashboard/phone-settings/page.tsx` | Direction badges next to numbers, "Buy Outbound Number" button |
| 3 | `src/app/dashboard/agent-config/page.tsx` | Dropdown options show `[Inbound]`/`[Outbound]` badges via `useMemo` direction map |
| 4 | `src/app/dashboard/test/page.tsx` | Shows actual outbound phone number instead of UUID |
| 5 | `src/app/dashboard/appointments/page.tsx` | Colored pill badges (green "Inbound", blue "Outbound") in table and detail modal |

### Key Code Patterns

**Pattern 1: Direction-aware validation** (`phone-validation-service.ts`)
```typescript
export type RoutingDirection = 'inbound' | 'outbound' | 'unassigned';

async validateCanProvision(orgId: string, direction: RoutingDirection = 'inbound') {
  const dirStatus = await this.checkDirectionStatus(orgId);
  if (direction === 'inbound' && dirStatus.hasInbound) {
    return { canProvision: false, reason: 'Already have inbound number' };
  }
  if (direction === 'outbound' && dirStatus.hasOutbound) {
    return { canProvision: false, reason: 'Already have outbound number' };
  }
}
```

**Pattern 2: Linked phone number backfill** (`contacts.ts`, `founder-console-v2.ts`)
```typescript
// Always write BOTH vapi_phone_number_id AND linked_phone_number_id
let linkedId: string | null = null;
try {
  const { data: linkedMn } = await supabase
    .from('managed_phone_numbers').select('id')
    .eq('org_id', orgId).eq('vapi_phone_id', phoneNumberId)
    .eq('status', 'active').maybeSingle();
  linkedId = linkedMn?.id || null;
} catch { /* best-effort */ }

await supabase.from('agents').update({
  vapi_phone_number_id: phoneNumberId,
  ...(linkedId ? { linked_phone_number_id: linkedId } : {}),
}).eq('id', agent.id).eq('org_id', orgId);
```

**Pattern 3: Direction-filtered phone resolution** (`phone-number-resolver.ts`)
```typescript
// Try outbound-tagged numbers first
const { data: outboundMn } = await supabase
  .from('managed_phone_numbers').select('vapi_phone_id')
  .eq('org_id', orgId).eq('routing_direction', 'outbound')
  .eq('status', 'active').limit(1).maybeSingle();

if (outboundMn?.vapi_phone_id) return outboundMn.vapi_phone_id;

// Fallback: any active managed number (backward compatibility)
const { data: anyMn } = await supabase
  .from('managed_phone_numbers').select('vapi_phone_id')
  .eq('org_id', orgId).eq('status', 'active').limit(1).maybeSingle();
```

**Pattern 4: Frontend direction map** (`agent-config/page.tsx`)
```typescript
const numberDirectionMap = useMemo(() => {
  const map: Record<string, string> = {};
  phoneSettingsRaw?.numbers?.inbound?.forEach((n: any) => {
    if (n.vapiPhoneId) map[n.vapiPhoneId] = 'inbound';
  });
  phoneSettingsRaw?.numbers?.outbound?.forEach((n: any) => {
    if (n.vapiPhoneId) map[n.vapiPhoneId] = 'outbound';
  });
  return map;
}, [phoneSettingsRaw]);
```

### Gotchas for New Developers

1. **`linked_phone_number_id` is supplementary, not a replacement.** `vapi_phone_number_id` (UUID) is SSOT for Vapi calls. The new column links to internal `managed_phone_numbers` for direction awareness. Always write both.

2. **`buildUpdatePayload()` in founder-console-v2.ts is synchronous.** The `linked_phone_number_id` resolution needs `await` (database query) — do this OUTSIDE the sync function, in the async handler scope. Putting `await` inside causes TS1308.

3. **Backward-compatible fallback.** If an org only has an inbound-tagged number (legacy), outbound calls fall back to using it. This prevents breaking existing orgs.

4. **Dashboard queries are unaffected.** Call logs/analytics use `calls.call_direction` (set at call creation from Vapi webhook), NOT from phone number tables.

5. **Inbound calls route via Vapi assistant mapping.** Multiple inbound numbers work naturally because Vapi looks up the `assistantId` attached to the phone number.

### Verification Results

- Backend `npx tsc --noEmit`: 0 new errors in modified files
- Frontend `npm run build`: SUCCESS with zero errors
- All 6 CLAUDE.md critical invariants: PASS
- Database migration: Applied via Supabase Management API (6 SQL statements, all successful)

---

## 🎉 Welcome to the Team!

You're joining at an exciting time. The platform is production-ready and we're focused on:
- Adding new features customers ask for
- Improving reliability and performance
- Expanding to new healthcare specialties
- Growing the customer base

Your contributions will directly impact real clinics and real patients. Let's build something great together! 🚀

---

**Last Updated:** February 22, 2026
**Version:** 1.1 (Added Multi-Number Routing Architecture)
**Status:** Complete & Ready for New Developers
