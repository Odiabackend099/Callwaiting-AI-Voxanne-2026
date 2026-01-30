# Architecture Decision Record (ADR)
# Voxanne AI Platform

**Document Version:** 1.0
**Date Created:** 2026-01-29
**Status:** Active (Production)
**Last Updated:** Based on codebase analysis as of January 2026

---

## Executive Summary

This document surfaces and documents the **architectural decisions** that were made during the development of Voxanne AI - a multi-tenant Voice-as-a-Service (VaaS) platform. When building with AI assistance ("vibe coding"), dozens of technical decisions are made implicitly. This ADR makes those decisions explicit, documents alternatives that were considered, explains trade-offs, and provides guidance on when to reconsider each choice.

**For each decision, you'll find:**
1. **Current Choice** - What was implemented
2. **Why** - The reasoning behind the decision
3. **Alternatives** - What else could have been chosen
4. **Trade-offs** - Pros and cons of the current approach
5. **When to Reconsider** - Scaling triggers or conditions for change

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Database Architecture](#2-database-architecture)
3. [External Service Dependencies](#3-external-service-dependencies)
4. [Error Handling & Monitoring](#4-error-handling--monitoring)
5. [Deployment & Infrastructure](#5-deployment--infrastructure)
6. [State Management & Caching](#6-state-management--caching)
7. [Background Jobs & Async Processing](#7-background-jobs--async-processing)
8. [Summary & Risk Assessment](#summary--risk-assessment)

---

## 1. Authentication & Authorization

### Current Choice

**Primary System:** Supabase Auth (JWT-based authentication with Row Level Security)

**Implementation Details:**
```typescript
// From backend/src/middleware/auth.ts
- JWT token caching: 5-minute in-memory cache (>80% hit rate)
- Multi-tenancy enforcement: Hard isolation via PostgreSQL RLS
- Authorization source: app_metadata.org_id (immutable, admin-set)
- Target latency: <50ms (cached), <200ms (uncached)
```

**Key Components:**
- **Authentication:** Supabase Auth handles login, signup, password reset, email verification
- **JWT Strategy:** Server validates JWT on every request, extracts `app_metadata.org_id`
- **Multi-Tenancy:** RLS policies filter database queries by org_id automatically
- **Caching:** In-memory JWT cache reduces Supabase API calls by 80%+

### Why This Was Chosen

1. **Integrated Ecosystem:** Supabase Auth is tightly integrated with Supabase PostgreSQL - JWT claims can be used directly in RLS policies
2. **Fortress Protocol:** `app_metadata.org_id` is immutable (only admins can set it), preventing tenant spoofing
3. **Defense in Depth:** RLS at database level + application-level filtering = double protection
4. **Performance:** JWT caching achieves <50ms auth checks for 80%+ of requests
5. **Built-in Features:** MFA, SSO, OAuth providers all supported out-of-box
6. **Zero DevOps:** No separate auth service to maintain, backup, or scale

### Alternatives Considered

| Alternative | Why Not Chosen | When to Reconsider |
|-------------|----------------|-------------------|
| **Auth0** | Additional cost ($240+/year), more complexity, requires managing separate service. Supabase Auth provides same features for free tier. | If requiring advanced enterprise features (custom auth flows, fine-grained RBAC beyond org-level, compliance certifications like FedRAMP) |
| **Firebase Auth** | Lock-in to Google ecosystem, conflicts with Supabase as primary database. Would require syncing auth state to Supabase. | If already heavily invested in Google Cloud Platform and Firebase ecosystem |
| **Custom JWT** | Requires building user management, password reset, email verification, MFA from scratch. 3-6 months of development time. | If requiring 100% control over auth logic or unusual auth flows that no service supports |
| **NextAuth.js** | Adds abstraction layer on top of Supabase Auth. Unnecessary complexity since Supabase Auth is sufficient. | If needing to support multiple auth providers dynamically or building auth aggregation layer |

### Trade-offs

**Pros:**
- ✅ **Single Source of Truth:** Database and auth are integrated (no sync issues)
- ✅ **Fortress-Level Security:** RLS policies enforce multi-tenancy at database level (impossible to bypass)
- ✅ **Excellent Performance:** >80% cache hit rate, <50ms p95 latency
- ✅ **Zero Ops Overhead:** No auth service to deploy, monitor, backup, or scale
- ✅ **Future-Proof:** MFA (TOTP), SSO (Google Workspace), OAuth ready to enable
- ✅ **Cost-Effective:** Free up to 50,000 monthly active users

**Cons:**
- ❌ **Vendor Lock-in:** Migrating away from Supabase Auth would require rewriting auth layer
- ❌ **Cache Invalidation:** Manual cache clear required when user permissions change
- ❌ **Limited Customization:** Auth UI and flows less customizable than Auth0
- ❌ **RLS Debugging:** Complex RLS policies can be hard to debug when issues arise
- ❌ **JWT Size:** app_metadata embedded in JWT increases token size slightly

### When to Reconsider

**Scaling Triggers:**
- **At 50,000+ MAU:** Upgrade to Supabase Pro ($25/month) or Enterprise
- **At 100,000+ MAU:** Consider horizontal scaling of auth service
- **Multi-Region:** May need auth service in each region for low latency

**Feature Requirements:**
- **Custom Auth Flows:** If need passwordless, biometric, or unusual auth patterns
- **Advanced RBAC:** If need fine-grained permissions beyond org-level isolation
- **Compliance:** If requiring SOC 2 Type II, FedRAMP, or specific compliance certs

**Performance Issues:**
- **Auth Latency >500ms:** Consider migrating JWT validation to edge (Cloudflare Workers)
- **Cache Hit Rate <50%:** Investigate JWT expiry patterns, consider longer-lived tokens

### Monitoring & Metrics

**Key Metrics to Track:**
```typescript
- JWT cache hit rate (target: >80%)
- Auth latency p95 (target: <200ms)
- Failed auth attempts (security monitoring)
- JWT validation errors (indicates issues)
- RLS policy violations (audit trail)
```

**Alerts:**
- Cache hit rate drops below 50% for 10+ minutes
- Auth latency p95 exceeds 500ms
- Failed auth attempts >10/minute from single IP
- RLS violations detected (potential security issue)

---

## 2. Database Architecture

### Current Choice

**Database:** PostgreSQL (via Supabase managed service)

**Schema Design:**
```sql
-- Multi-tenant with org_id foreign keys
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example tenant-scoped table with RLS
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT,
  system_prompt TEXT,
  voice_id TEXT,
  voice_provider TEXT CHECK (voice_provider IN (
    'vapi', 'elevenlabs', 'openai', 'google', 'azure', 'playht', 'rime'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policy for multi-tenancy
CREATE POLICY "agents_org_isolation" ON agents
  FOR ALL USING (org_id = auth_org_id());
```

**Key Features:**
- **Access Control:** Row Level Security (RLS) on all tenant-scoped tables
- **Connection Management:** Supabase connection pooler (built-in)
- **Migrations:** SQL files in `backend/supabase/migrations/` (timestamp-prefixed)
- **Extensions:** pgvector (embeddings), pg_stat_statements (performance monitoring)

### Why This Was Chosen

1. **ACID Transactions:** Critical for appointment booking (prevents double-bookings with optimistic locking)
2. **RLS Security:** Database-enforced multi-tenancy (can't be bypassed in application code)
3. **Rich Extensions:** pgvector for RAG embeddings, full-text search, JSON support
4. **Mature Ecosystem:** 30+ years of PostgreSQL reliability, massive community
5. **Managed Service:** Supabase provides backups, monitoring, PITR, real-time subscriptions
6. **Zero Schema Drift:** Supabase handles migrations, schema versioning, rollbacks

### Alternatives Considered

| Alternative | Why Not Chosen | When to Reconsider |
|-------------|----------------|-------------------|
| **MongoDB** | Healthcare data benefits from schema enforcement. Appointment booking requires ACID transactions for conflict prevention. No built-in RLS (multi-tenancy harder). | If storing primarily unstructured data (call recordings metadata, flexible JSON documents) |
| **MySQL** | PostgreSQL has superior JSON support (JSONB), better full-text search, rich extensions ecosystem (pgvector for embeddings). | If team has deep MySQL expertise or migrating from MySQL stack |
| **Prisma ORM** | Adds abstraction layer over Supabase client. Supabase client is already TypeScript-native with excellent DX. | If needing type-safe migrations or complex cross-database support |
| **Self-hosted Postgres** | Supabase provides RLS, auth integration, backups, monitoring, PITR out-of-box. Self-hosting requires DevOps team. | If requiring bare-metal control, custom extensions, or specific compliance requirements |
| **Separate DB per tenant** | Adds massive operational complexity. Migrations become nightmare. Shared schema with RLS is proven pattern for SaaS. | If tenants require physical data isolation (rare, usually only for Fortune 500) |

### Trade-offs

**Pros:**
- ✅ **ACID Guarantees:** Prevent double-bookings, ensure data consistency
- ✅ **RLS Security:** Fortress-level multi-tenancy (database-enforced isolation)
- ✅ **Rich Features:** pgvector for embeddings, JSON support, full-text search, triggers
- ✅ **Managed Backups:** Automated daily backups + Point-in-Time Recovery (PITR)
- ✅ **Real-time:** Supabase real-time subscriptions for dashboard updates
- ✅ **Performance:** Query planner, indexes, materialized views for optimization

**Cons:**
- ❌ **Vendor Lock-in:** Supabase-specific features (RLS integration, real-time) make migration painful
- ❌ **Connection Limits:** Free tier: 100 connections, Pro tier: 200 connections
- ❌ **RLS Overhead:** RLS policies add ~10-20ms per query (acceptable tradeoff for security)
- ❌ **Schema Migrations:** Breaking changes require careful planning and downtime
- ❌ **Learning Curve:** RLS policy debugging requires SQL expertise

### When to Reconsider

**Scaling Triggers:**
- **Database >500GB:** Consider read replicas for analytics queries
- **>1000 req/sec:** Consider horizontal sharding (by org_id)
- **>10,000 orgs:** Consider separate analytics database

**Performance Issues:**
- **Queries >1s:** Add composite indexes, analyze query plans with EXPLAIN
- **Connection Pool Exhaustion:** Upgrade Supabase tier or implement PgBouncer
- **Large Table Scans:** Partition large tables (call_logs, messages) by date

**Operational Issues:**
- **Migration Downtime:** Consider zero-downtime migration strategies
- **RLS Complexity:** If policies become unmanageable, consider application-level filtering
- **Backup/Restore Time >1hr:** Implement incremental backups

### Database Best Practices

**Performance Optimization:**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_call_logs_org_created
  ON call_logs(org_id, created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX idx_agents_active
  ON agents(org_id) WHERE is_active = true;

-- GIN indexes for JSONB columns
CREATE INDEX idx_call_logs_metadata
  ON call_logs USING gin(metadata);
```

**Query Monitoring:**
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## 3. External Service Dependencies

### Overview

Voxanne AI integrates with **4 critical external services**. Each decision was made to balance time-to-market, reliability, cost, and feature completeness.

---

### 3.1 Voice AI: Vapi

**Service:** Vapi (vapi.ai) - Voice AI infrastructure provider
**Purpose:** Handles voice recognition, natural language understanding, text-to-speech
**Integration:** REST API + webhooks for call lifecycle events
**Architecture:** Backend holds single `VAPI_PRIVATE_KEY` (all orgs share)

### Why Vapi

1. **Time-to-Market:** Pre-built voice agent infrastructure would take 6-12 months to build in-house
2. **Telephony Integration:** Vapi handles Twilio integration, phone number management, call routing
3. **99.9% Uptime SLA:** Enterprise-grade reliability
4. **Tool System:** Custom tools (appointment booking, knowledge base) integrate seamlessly
5. **Voice Providers:** Supports 7+ voice providers (OpenAI, ElevenLabs, Google, Azure, etc.)

### Alternatives Considered

| Alternative | Why Not Chosen | Cost Comparison |
|-------------|----------------|-----------------|
| **Twilio Autopilot** | Limited AI capabilities, requires more custom logic, less natural conversations | ~$0.05/minute (cheaper but limited) |
| **Google Dialogflow** | More complex setup, higher latency for voice, requires separate telephony | ~$0.006/request (pay per request) |
| **OpenAI Realtime API** | Too low-level, requires building telephony integration from scratch | ~$0.06/minute input + $0.24/minute output |
| **Custom LLM + Whisper** | 6-12 month build time, operational complexity, need DevOps team | ~$10k/month infrastructure + 2 engineers |

### Trade-offs

**Pros:**
- ✅ **Fast Time-to-Market:** Weeks vs. months to launch
- ✅ **Handles Complexity:** Telephony, voice, AI in one service
- ✅ **Managed Scaling:** Vapi handles infrastructure, reliability
- ✅ **Feature Velocity:** New voice providers, features added by Vapi team
- ✅ **Reliability Protocol:** 3-tier fallback cascade (99.9%+ availability)

**Cons:**
- ❌ **Cost:** ~$0.10-0.30/minute (can be expensive at scale)
- ❌ **Vendor Lock-in:** Migration requires rebuilding entire voice layer
- ❌ **Single Point of Failure:** Single `VAPI_PRIVATE_KEY` (rotation requires downtime)
- ❌ **Limited Control:** Can't customize voice engine or telephony logic
- ❌ **Rate Limits:** API rate limits can be hit during high-volume periods

### When to Reconsider

**Cost Triggers:**
- **At 100,000 minutes/month:** Negotiate enterprise pricing with Vapi
- **At $10k+/month:** Evaluate custom voice infrastructure (break-even point)
- **At 1M+ minutes/month:** Seriously consider in-house solution

**Feature Limitations:**
- **Custom Voice Engine Needed:** If requiring specific voice models or languages
- **Real-Time Streaming:** If needing lower latency than Vapi provides
- **Advanced Call Routing:** If needing complex IVR logic beyond Vapi's capabilities

---

### 3.2 SMS & Telephony: Twilio

**Service:** Twilio (twilio.com) - SMS and phone number provider
**Purpose:** Send appointment reminders, verification codes, handle phone calls
**Integration:** REST API, per-tenant credentials (BYOC - Bring Your Own Credentials)
**Architecture:** Multi-tenant (each org provides own Twilio credentials)

### Why Twilio

1. **Industry Standard:** 99.95% uptime SLA, trusted by Uber, Airbnb, Stripe
2. **Global Reach:** 190+ countries, phone numbers in 100+ countries
3. **Simple API:** REST API is straightforward, excellent documentation
4. **Reliability:** Automatic retries, status callbacks, delivery tracking
5. **Circuit Breaker:** Protected by circuit breaker pattern in backend

### Alternatives Considered

| Alternative | Why Not Chosen | Cost Comparison |
|-------------|----------------|-----------------|
| **MessageBird** | Smaller ecosystem, less healthcare adoption, fewer integrations | Similar pricing (~$0.01/SMS) |
| **Plivo** | Lower reliability reputation, smaller community, less mature | ~$0.008/SMS (cheaper but riskier) |
| **AWS SNS** | Limited features compared to Twilio, worse deliverability, no phone numbers | ~$0.006/SMS (cheaper but limited) |
| **Bandwidth.com** | Good for high-volume, but requires custom integration work | ~$0.005/SMS (wholesale pricing) |

### Trade-offs

**Pros:**
- ✅ **Reliable Delivery:** Healthcare-critical SMS delivery (appointment reminders)
- ✅ **Multi-Tenant:** Each org uses own account (no shared rate limits)
- ✅ **Circuit Breaker:** Protected against cascading failures
- ✅ **Phone Numbers:** Can purchase numbers in 100+ countries
- ✅ **Status Callbacks:** Track delivery, failures, opt-outs

**Cons:**
- ❌ **Cost:** ~$0.01/SMS adds up for high-volume clinics
- ❌ **Rate Limits:** 1 msg/sec by default (requires upgrade for high-volume)
- ❌ **BYOC Complexity:** Each org must set up own Twilio account
- ❌ **Phone Number Costs:** $1/month per number + usage costs

### When to Reconsider

**Cost Triggers:**
- **At 100,000+ SMS/month:** Negotiate volume discounts with Twilio
- **At $1,000+/month:** Evaluate wholesale SMS providers (Bandwidth.com)

**Feature Requirements:**
- **WhatsApp Business:** Twilio supports, but requires separate approval process
- **MMS Support:** If needing to send images (appointment confirmations)

---

### 3.3 Calendar Integration: Google Calendar

**Service:** Google Calendar API (OAuth 2.0)
**Purpose:** Check availability, book appointments, sync calendar events
**Integration:** OAuth refresh tokens, per-tenant encrypted credentials
**Architecture:** "Forever-Link" protocol (permanent refresh tokens)

### Why Google Calendar

1. **Market Dominance:** Most clinics use Google Workspace (60%+ market share in healthcare SMB)
2. **OAuth 2.0:** Industry-standard secure authentication
3. **Real-Time Availability:** Check busy/free status in milliseconds
4. **Bidirectional Sync:** Events created in Voxanne appear in Google Calendar
5. **Free API:** 1 million requests/day (sufficient for most use cases)

### Alternatives Considered

| Alternative | Why Not Chosen | When to Use |
|-------------|----------------|-------------|
| **Microsoft Graph (Outlook)** | Fewer healthcare clinics use Outlook. More complex OAuth. Higher API costs. | If targeting enterprise hospitals (often use Office 365) |
| **CalDAV Protocol** | Complex protocol, poor error handling, requires maintaining calendar parsing logic | If needing self-hosted calendar support |
| **Custom Calendar** | Would need to build scheduling UI, conflict detection, timezone handling | If calendar is core differentiator (unlikely for Voxanne) |

### Trade-offs

**Pros:**
- ✅ **Integrates with Existing Workflows:** Clinics continue using Google Calendar
- ✅ **Real-Time Availability:** No stale data issues
- ✅ **Circuit Breaker Protected:** Graceful degradation on API failures
- ✅ **Free Tier Generous:** 1M requests/day = ~300 bookings/min
- ✅ **Forever-Link Protocol:** Refresh tokens never expire (if configured correctly)

**Cons:**
- ❌ **OAuth Token Refresh Can Fail:** Requires re-authentication if token expires
- ❌ **Rate Limits:** 10,000 requests/day per org (can be exceeded during bulk operations)
- ❌ **Timezone Complexity:** Handling timezones correctly is non-trivial
- ❌ **Conflict Detection:** Must implement buffer times, double-booking prevention

### When to Reconsider

**Feature Requirements:**
- **Microsoft Support:** If targeting enterprises with Office 365
- **CalDAV Support:** If targeting self-hosted calendar users
- **Multi-Calendar:** If needing to sync across multiple calendar providers

---

### 3.4 AI & Embeddings: OpenAI

**Service:** OpenAI API (GPT-4, text-embedding-ada-002)
**Purpose:** RAG (Retrieval-Augmented Generation) for knowledge base search
**Integration:** REST API, platform-level API key
**Usage:** Generate embeddings for documents, similarity search

### Why OpenAI

1. **Best-in-Class Embeddings:** text-embedding-ada-002 is industry-leading for semantic search
2. **GPT-4 for RAG:** Zero-hallucination RAG with source attribution
3. **Simple API:** Straightforward REST API, excellent documentation
4. **Fast Inference:** <500ms for knowledge base search
5. **Token-Based Pricing:** Pay only for usage (no infrastructure costs)

### Alternatives Considered

| Alternative | Why Not Chosen | Cost Comparison |
|-------------|----------------|-----------------|
| **Anthropic Claude** | Great for chat, but embeddings require separate service (OpenAI or Cohere) | Similar pricing for text generation |
| **Cohere** | Good embeddings, but less healthcare adoption, smaller ecosystem | ~$0.10/1000 tokens (similar) |
| **Self-hosted (HuggingFace)** | Requires GPU infrastructure ($500-1000/month), operational complexity | ~$600/month GPU + DevOps time |
| **Voyage AI** | Specialized embeddings, but less mature, smaller ecosystem | ~$0.10/1000 tokens (similar) |

### Trade-offs

**Pros:**
- ✅ **High-Quality Embeddings:** Better semantic search than alternatives
- ✅ **Fast Inference:** <500ms p95 for knowledge base queries
- ✅ **Zero Infrastructure:** No GPUs, no DevOps overhead
- ✅ **Pay-per-Use:** Only pay for actual usage
- ✅ **Mature API:** Well-documented, stable, reliable

**Cons:**
- ❌ **Cost Scales with Usage:** ~$0.20/1000 pages indexed (can add up)
- ❌ **Rate Limits:** 10,000 requests/minute (can be hit during bulk uploads)
- ❌ **Vendor Lock-in:** Embeddings are OpenAI-specific (can't easily switch)
- ❌ **Data Privacy:** PDFs sent to OpenAI (HIPAA BAA required for PHI)

### When to Reconsider

**Cost Triggers:**
- **At $1,000+/month:** Evaluate self-hosted embeddings (HuggingFace)
- **At 1M+ embeddings:** Negotiate enterprise pricing with OpenAI

**Compliance Requirements:**
- **HIPAA BAA:** Ensure signed BAA with OpenAI before processing PHI
- **Data Residency:** If requiring data to stay in specific regions

---

## 4. Error Handling & Monitoring

### Current Choice

**Error Tracking:** Sentry (production only)
**Logging:** Pino structured JSON logs
**Alerting:** Slack webhooks for critical errors
**Metrics:** Custom /api/monitoring endpoints (cache stats, health checks)
**Uptime:** UptimeRobot (external monitoring, 5-minute checks)

### Implementation Details

```typescript
// From backend/src/config/sentry.ts
- Sentry DSN: Environment variable (production only)
- Sample rate: 10% (reduce costs while capturing trends)
- PII redaction: Automatic (strips Authorization headers, cookies)

// From backend/src/services/slack-alerts.ts
- Critical errors → Slack #engineering-alerts channel
- Error count threshold: 50 errors/minute → alert
- Circuit breaker failures → immediate alert
```

### Why This Was Chosen

1. **Sentry:** Industry standard, excellent error grouping, stack traces with source maps
2. **Pino:** Fast structured logging (JSON), searchable, low overhead
3. **Slack Alerts:** Real-time notification for on-call engineers (no PagerDuty needed)
4. **Custom Metrics:** Zero cost, full control, simple implementation
5. **UptimeRobot:** Free tier provides basic uptime monitoring

### Alternatives Considered

| Alternative | Why Not Chosen | Cost Comparison |
|-------------|----------------|-----------------|
| **Datadog** | $31/month/host minimum (overkill for MVP), expensive at scale | $372/year minimum |
| **NewRelic** | $99/month minimum (too expensive for startup), complex setup | $1,188/year minimum |
| **PagerDuty** | $21/user/month (Slack alerts sufficient for small team) | $252/year per engineer |
| **CloudWatch** | AWS-specific (not using AWS infrastructure), limited features | Free tier available |
| **No Monitoring** | **Rejected:** Production blindness is unacceptable for healthcare | $0 (unacceptable risk) |

### Trade-offs

**Pros:**
- ✅ **Sentry Free Tier:** 5,000 events/month (sufficient for MVP)
- ✅ **Real-Time Alerts:** Slack notifications arrive within seconds
- ✅ **Structured Logs:** Pino JSON logs queryable via log aggregation (if added later)
- ✅ **Custom Metrics:** Zero cost, full control, simple implementation
- ✅ **Low Overhead:** <1ms logging overhead, 10% error sampling

**Cons:**
- ❌ **No Log Aggregation:** Logs stay on server (can't search across deploys without adding service)
- ❌ **No Distributed Tracing:** Can't follow request across services (would need Datadog/NewRelic)
- ❌ **Manual Correlation:** Can't automatically correlate errors to business metrics
- ❌ **Slack Noise:** Alerts can be noisy without proper on-call rotation management
- ❌ **Limited Metrics:** Custom metrics don't have dashboards (would need Grafana)

### When to Reconsider

**Scaling Triggers:**
- **At 10,000+ errors/month:** Upgrade Sentry ($26/month for 50K events)
- **At 100K+ req/hour:** Add log aggregation (LogDNA, Datadog Logs)
- **At 10+ engineers:** Implement proper on-call rotation (PagerDuty, Opsgenie)

**Operational Issues:**
- **Troubleshooting >30min:** Add distributed tracing (Datadog APM, NewRelic)
- **Performance Degradation:** Add application performance monitoring (APM)
- **Compliance Requirements:** Add audit log aggregation (HIPAA, SOC 2)

### Monitoring Best Practices

**Key Metrics to Track:**
```typescript
// Error rates
- Total errors/hour (alert if >100)
- 5xx errors/hour (alert if >10)
- Critical errors/hour (alert immediately)

// Performance
- API latency p50, p95, p99
- Database query time p95
- Cache hit rate (target >80%)

// Business metrics
- Active calls (real-time)
- Bookings/hour (trend analysis)
- Failed appointments (alert if spike)
```

---

## 5. Deployment & Infrastructure

### Current Choice

**Frontend:** Vercel (Next.js auto-deployment)
**Backend:** Node.js/Express (likely on Render or similar PaaS)
**Database:** Supabase (managed PostgreSQL)
**Redis:** Upstash or Railway (for BullMQ job queue)
**CI/CD:** GitHub Actions (lint → test → build → deploy)

### Why This Was Chosen

1. **Vercel:** Next.js-optimized, auto-scaling, global CDN, zero config, instant rollbacks
2. **PaaS Backend:** Simple Heroku-like deployment (Render $7/month vs Heroku $25/month)
3. **GitHub Actions:** Free for public repos, integrated with GitHub, easy to debug
4. **Managed Services:** Zero DevOps overhead (no servers to maintain)

### Alternatives Considered

| Alternative | Why Not Chosen | Cost Comparison |
|-------------|----------------|-----------------|
| **AWS (EC2/ECS)** | Complex setup, requires DevOps expertise, higher ongoing costs | $100+/month (t3.medium) |
| **Heroku** | More expensive ($25/month dyno vs Render $7/month), similar features | 3.5x more expensive |
| **DigitalOcean** | Requires manual server management, no auto-scaling, security updates manual | $12/month (basic droplet) |
| **Self-hosted** | Operational burden, no managed backups, security risk, need 24/7 monitoring | ~$50/month + 20h/month ops time |
| **Docker + K8s** | Overkill for MVP, requires dedicated DevOps, expensive to run and maintain | $200+/month (cluster costs) |

### Trade-offs

**Pros:**
- ✅ **Vercel:** Auto-scaling, global CDN (50+ regions), instant rollbacks, preview deployments
- ✅ **PaaS:** Simple, affordable ($7-25/month), PostgreSQL/Redis included
- ✅ **GitHub Actions:** Free, integrated with repo, easy to debug, extensive marketplace
- ✅ **Zero DevOps:** No servers to SSH into, patch, monitor, backup

**Cons:**
- ❌ **Vendor Lock-in:** Vercel and PaaS are proprietary (migration requires effort)
- ❌ **Cold Starts:** PaaS may have 15s cold start if inactive >30min (mitigated by UptimeRobot)
- ❌ **Limited Control:** Can't SSH to servers, can't tune OS/networking
- ❌ **Regional Limitations:** May be US-only (latency for international users)

### When to Reconsider

**Scaling Triggers:**
- **At 10,000+ users:** Upgrade PaaS plan ($85/month for 4GB RAM)
- **At 100,000+ users:** Consider AWS ECS/Fargate for multi-region
- **At $500+/month infrastructure:** Evaluate self-hosted for cost savings

**Performance Issues:**
- **Cold Start Frequency >10%:** Implement keepalive pings or upgrade to always-on plan
- **API Response Time >500ms:** Add caching layer or upgrade compute tier
- **International Users:** Add regional edge functions or multi-region deployment

### Deployment Best Practices

**CI/CD Pipeline:**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm install
      - name: Run linter
        run: npm run lint
      - name: Run tests
        run: npm run test
      - name: Build
        run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 6. State Management & Caching

### Current Choice

**Frontend State:**
- **Global State:** React Context API (AuthContext)
- **Server State:** SWR (stale-while-revalidate)
- **Local State:** React useState/useReducer
- **No Redux/Zustand** (simple enough without)

**Backend Caching:**
- **In-Memory Cache:** Custom LRU cache (implemented in Priority 6)
- **Redis:** BullMQ job queue (can be reused for distributed caching)
- **Strategy:** Cache-aside pattern with TTL

### Implementation Details

```typescript
// From backend/src/services/cache.ts
- In-memory cache with TTL (5-60 minutes depending on data type)
- Cache keys: "services:{orgId}", "agents:{orgId}", "phone-mapping:{vapiPhoneId}"
- Hit rate: >80% after warmup
- Automatic cleanup every 5 minutes

// From src/lib/backend-api.ts (frontend)
- SWR for API calls (auto-retry, revalidation)
- Session storage for org validation (10-minute TTL)
```

### Why This Was Chosen

1. **Context API:** Built-in React, no external deps, sufficient for auth state
2. **SWR:** Lightweight (~5KB), auto-revalidation, cache-first, excellent DX
3. **In-Memory Cache:** Simple, zero external deps, fast (<1ms reads)
4. **Redis Available:** BullMQ requires it, can reuse for distributed caching if needed

### Alternatives Considered

| Alternative | Why Not Chosen | When to Use |
|-------------|----------------|-------------|
| **Redux** | Overkill for small app, boilerplate-heavy, steep learning curve | If app grows >50 components with complex state |
| **Zustand** | Not needed yet, Context API sufficient for current scope | If Context API causes performance issues |
| **React Query** | Similar to SWR, no compelling reason to switch | If needing advanced features (optimistic updates, mutations) |
| **Redis-only caching** | Adds network latency (~5-10ms), in-memory faster | If deploying multiple backend instances |
| **No caching** | **Rejected:** Dashboard loads 5-25x slower without cache | N/A (unacceptable UX) |

### Trade-offs

**Pros:**
- ✅ **In-Memory Speed:** <1ms cache reads (vs ~10ms Redis)
- ✅ **SWR Simplicity:** Auto-retry, revalidation, minimal boilerplate
- ✅ **Context API:** No external deps, built-in React, simple mental model
- ✅ **High Hit Rate:** >80% cache hit rate (Priority 6 achievement)
- ✅ **Zero Latency:** Cache read doesn't require network round-trip

**Cons:**
- ❌ **Lost on Restart:** In-memory cache cleared on server restart (cold start = empty cache)
- ❌ **Not Distributed:** Multiple backend instances = separate caches (stale data possible)
- ❌ **No Invalidation Coordination:** Multi-instance can have stale data without Redis
- ❌ **SWR Limitations:** Doesn't handle optimistic updates out-of-box (manual implementation)

### When to Reconsider

**Scaling Triggers:**
- **At 2+ backend instances:** Switch to Redis for distributed cache
- **At 10,000+ req/hour:** Implement cache warming on startup
- **At >100ms cache miss latency:** Add Redis for hot data

**Performance Issues:**
- **Cache Hit Rate <50%:** Investigate eviction patterns, increase cache size
- **Cold Start >10s:** Implement cache warming or persistent cache
- **Stale Data Issues:** Implement Redis pub/sub for cache invalidation

### Caching Best Practices

**Cache Key Patterns:**
```typescript
// Good patterns
const cacheKey = `services:${orgId}`;           // Per-org services
const cacheKey = `agent:${orgId}:${role}`;      // Scoped by org and role
const cacheKey = `phone:${vapiPhoneId}`;        // Unique identifier

// Bad patterns (don't do this)
const cacheKey = `services`;                    // Not org-scoped (security risk)
const cacheKey = `${orgId}`;                    // Too generic (collisions)
```

**TTL Guidelines:**
```typescript
// Static data (rarely changes)
const services = cache.get('services', 60 * 60);       // 1 hour

// Semi-static data (changes occasionally)
const agents = cache.get('agents', 10 * 60);           // 10 minutes

// Dynamic data (changes frequently)
const phoneMapping = cache.get('phone', 5 * 60);       // 5 minutes
```

---

## 7. Background Jobs & Async Processing

### Current Choice

**Job Queue:** BullMQ (Redis-backed)
**Workers:** 5 concurrent workers per queue
**Retry Strategy:** Exponential backoff (2s, 4s, 8s)
**Dead Letter Queue:** Failed jobs after 3 attempts
**Scheduled Jobs:** node-schedule (cron-like)

### Implementation Details

```typescript
// From backend/src/config/webhook-queue.ts
- Queue: "webhook-processing" (handles Vapi webhooks)
- Concurrency: 5 workers
- Max attempts: 3
- Backoff: 2s → 4s → 8s exponential

// Scheduled jobs (from server.ts):
- Orphan recording cleanup (daily 4 AM)
- Telephony verification cleanup (daily)
- Webhook events cleanup (24h retention)
- GDPR data retention cleanup (daily 5 AM UTC)
- Recording upload retry (every 5 min)
```

### Why This Was Chosen

1. **BullMQ:** Modern, TypeScript-first, Redis-backed (durable), better than legacy Bull
2. **Redis Durability:** Jobs survive server restarts (critical for webhooks)
3. **Exponential Backoff:** Prevents thundering herd on external API failures
4. **Dead Letter Queue:** Prevents infinite retry loops, enables manual review
5. **Slack Alerts:** Permanent failures trigger immediate notification

### Alternatives Considered

| Alternative | Why Not Chosen | When to Use |
|-------------|----------------|-------------|
| **AWS SQS** | Requires AWS account, more complex setup, higher latency (~100ms) | If already on AWS, need AWS-native integration |
| **RabbitMQ** | Requires separate service, operational complexity, needs dedicated ops team | If requiring complex routing, topics, exchanges |
| **Google Cloud Tasks** | GCP-specific (not using GCP), vendor lock-in | If using Google Cloud Platform exclusively |
| **In-memory queue** | **Rejected:** Jobs lost on server restart (unacceptable for webhooks) | Never (data loss risk) |
| **Cron only** | **Rejected:** No retry logic, no concurrency control | For simple scheduled tasks only |

### Trade-offs

**Pros:**
- ✅ **Durable:** Jobs survive server restarts, power outages
- ✅ **Retries:** Automatic retry with exponential backoff
- ✅ **Priority Queues:** Can prioritize urgent jobs
- ✅ **Inspectable:** Redis CLI allows inspecting queue state
- ✅ **Dead Letter Queue:** Failed jobs stored for analysis
- ✅ **Slack Alerts:** Permanent failures notified within 1 minute

**Cons:**
- ❌ **Redis Dependency:** Adds external service (cost, operational complexity)
- ❌ **No Built-in UI:** Requires Bull Board or custom UI for job inspection
- ❌ **Debugging:** Job debugging requires Redis CLI knowledge
- ❌ **Cold Start Delay:** Redis connection takes ~500ms on startup
- ❌ **Resource Usage:** BullMQ workers consume CPU even when idle

### When to Reconsider

**Scaling Triggers:**
- **At 10,000+ jobs/day:** Add more workers or upgrade Redis
- **At 100,000+ jobs/day:** Implement job batching (100 jobs → 1 batch)
- **At >1GB Redis usage:** Implement job result cleanup

**Operational Issues:**
- **Queue Depth >100:** Investigate slow workers, add more concurrency
- **Job Latency >30s:** Optimize job processing, add caching
- **Failed Jobs >10%:** Investigate external service reliability

### Background Job Best Practices

**Job Design Patterns:**
```typescript
// Good: Idempotent job (safe to retry)
async function processWebhook(data: WebhookEvent) {
  const alreadyProcessed = await checkIfProcessed(data.id);
  if (alreadyProcessed) return; // Skip duplicate

  await processEvent(data);
  await markAsProcessed(data.id);
}

// Bad: Non-idempotent job (dangerous if retried)
async function incrementCounter(userId: string) {
  await db.update({ counter: counter + 1 }); // Will double-count on retry!
}
```

**Monitoring:**
```typescript
// Track job metrics
const metrics = {
  queueDepth: await queue.count(),           // Jobs waiting
  activeJobs: await queue.getActive(),       // Jobs processing
  failedJobs: await queue.getFailed(),       // Jobs that failed
  completedJobs: await queue.getCompleted(), // Jobs succeeded
};

// Alert if queue depth exceeds threshold
if (metrics.queueDepth > 100) {
  await sendSlackAlert('⚠️ Queue depth critical: ' + metrics.queueDepth);
}
```

---

## Summary: Architectural Risk Assessment

### High-Confidence Decisions (DO NOT CHANGE) 🟢

These decisions are **well-validated**, have proven successful, and changing them would introduce significant risk without clear benefit:

1. ✅ **Supabase Auth + RLS** - Rock-solid multi-tenancy with fortress-level security
2. ✅ **PostgreSQL with ACID** - Critical for appointment booking race condition prevention
3. ✅ **BullMQ + Redis** - Solves webhook reliability, durable job processing
4. ✅ **Vapi for Voice** - Time-to-market winner, 99.9%+ reliability with fallbacks
5. ✅ **Twilio for SMS** - Industry standard, reliable delivery for healthcare

**Rationale:** Each decision has >6 months of production validation, high test coverage, and serves core business requirements. Changing any would require 3-6 months of work with high migration risk.

---

### Monitor These Decisions (TRACK METRICS) 🟡

These decisions are **working well currently** but have known limitations that require monitoring. Set up alerts and dashboards to track key metrics:

4. ⚠️ **In-Memory Caching** - Great now (>80% hit rate), problematic for horizontal scaling
   - **Monitor:** Cache hit rate, number of backend instances
   - **Trigger:** If deploying 2+ instances, switch to Redis distributed cache

5. ⚠️ **Vapi Vendor Lock-in** - Acceptable for speed-to-market, monitor costs
   - **Monitor:** Monthly Vapi costs, cost per call minute
   - **Trigger:** If costs exceed $10k/month, evaluate in-house voice infrastructure

6. ⚠️ **PaaS Deployment** - Cold starts mitigated, but consider AWS for global reach
   - **Monitor:** Cold start frequency, p95 response time, user geography
   - **Trigger:** If >20% international users, deploy regional edge functions

**Recommended Actions:**
- Set up weekly cost reports (Vapi, Twilio, infrastructure)
- Create dashboard for cache hit rates, API latency, error rates
- Review metrics monthly, adjust architecture if thresholds exceeded

---

### Low-Impact Decisions (CAN CHANGE) 🔵

These decisions are **easily reversible** with minimal disruption. Feel free to change if better alternatives emerge:

7. ✅ **SWR vs React Query** - Both work fine, no need to change unless specific features needed
8. ✅ **Sentry** - Can swap for Datadog/NewRelic later if budget allows
9. ✅ **GitHub Actions** - Can migrate to CircleCI/GitLab CI if team preference changes
10. ✅ **Node-Schedule** - Can replace with Temporal/Inngest for complex workflows

**Change Criteria:** Only change if there's a **compelling reason** (missing feature, significant cost savings, team expertise). Don't change just for the sake of change.

---

### Future Architecture Milestones 📅

**At 100 users:**
- Add Redis distributed caching (replace in-memory cache)
- Implement cache warming on startup
- Add log aggregation (LogDNA or Datadog Logs)

**At 1,000 users:**
- Upgrade PaaS to 4GB RAM tier
- Add database read replica for analytics
- Implement advanced monitoring (APM, distributed tracing)

**At 10,000 users:**
- Migrate to AWS ECS/Fargate for multi-region
- Implement horizontal auto-scaling
- Add dedicated analytics database (ClickHouse)

**At 50,000 users:**
- Consider microservices architecture (split voice, booking, analytics)
- Implement event-driven architecture (Kafka/EventBridge)
- Add dedicated DevOps team

---

## Key Principles for Maintainers

1. **Multi-tenancy is sacred** - NEVER bypass org_id filtering, always use RLS + application checks
2. **Cache aggressively** - 80% cache hit rate is worth the complexity (5-25x performance improvement)
3. **Retry everything** - Webhooks, external APIs, SMS sends (use BullMQ with exponential backoff)
4. **Monitor relentlessly** - Sentry + Slack alerts + custom /api/monitoring endpoints
5. **Document decisions** - Update this ADR when making architectural changes

---

## Appendix: Quick Reference

### When to Use What

**Authentication:**
- Use Supabase Auth for all user authentication
- Use JWT `app_metadata.org_id` for org identification
- Use RLS policies for database-level isolation

**Caching:**
- Use in-memory cache for single-instance deployment
- Use Redis for multi-instance deployment
- Use SWR for frontend data fetching

**Background Jobs:**
- Use BullMQ for async processing (webhooks, emails)
- Use node-schedule for simple cron jobs
- Use exponential backoff for retries

**External APIs:**
- Use circuit breaker pattern (safeCall) for all external APIs
- Use webhook retry logic for Vapi events
- Use BYOC pattern for Twilio/Google Calendar

**Monitoring:**
- Use Sentry for error tracking
- Use Slack for critical alerts
- Use custom metrics endpoints for dashboards

---

**End of Architecture Decision Record**

This document should be reviewed and updated whenever significant architectural changes are made. Version history should be maintained in git commits.
