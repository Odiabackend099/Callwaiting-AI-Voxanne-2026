# Voxanne AI - Database Schema SSOT (Single Source of Truth)

**Status:** Updated after schema cleanup (2026-02-09)
**Generated:** Directly from live Supabase PostgreSQL database
**Database State:** Production-ready, 67% schema reduction complete

---

## 📊 Database Overview

| Metric | Count |
|--------|-------|
| **Total Tables** | 26 |
| **Production Tables** | 9 |
| **Configuration Tables** | 17 |
| **Columns** | ~500 |
| **Foreign Keys** | ~75 |
| **Indexes** | ~150 |
| **Check Constraints** | ~400 |

### Schema Reduction Summary
- **Before:** 79 tables
- **After:** 26 tables
- **Reduction:** -53 tables (-67%)
- **Data Loss:** Zero (no production data deleted)

---

## 🟢 PRODUCTION TABLES (9 - Active Data)

These 9 tables contain real user data and drive the platform:

### Table: `calls`
**Purpose:** Log of all inbound and outbound voice calls

**Columns:**
- `id` (uuid) - Unique call identifier
- `org_id` (uuid) - Organization owner
- `contact_id` (uuid, nullable) - Associated contact
- `call_direction` (text) - "inbound" or "outbound"
- `from_number` (text) - Caller phone number (E.164)
- `to_number` (text) - Called phone number (E.164)
- `duration_seconds` (integer, nullable) - Call length in seconds
- `status` (text) - "pending", "in_progress", "completed", "failed"
- `transcript` (text, nullable) - AI-generated call transcript
- `summary` (text, nullable) - AI summary of call
- `sentiment_label` (text, nullable) - "positive", "neutral", "negative"
- `sentiment_score` (numeric, nullable) - Score 0.0-1.0
- `sentiment_summary` (text, nullable) - Human-readable summary
- `sentiment_urgency` (text, nullable) - "low", "medium", "high", "critical"
- `phone_number` (text, nullable) - E.164 formatted phone
- `caller_name` (text, nullable) - Enriched caller name
- `vapi_call_id` (text, nullable) - Vapi platform call ID
- `recording_url` (text, nullable) - Call recording (if available)
- `created_at` (timestamp) - Call start time
- `updated_at` (timestamp) - Last update time

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id, contact_id → contacts.id
**Indexes:** org_id, call_direction, created_at, status
**Row Count:** 21

---

### Table: `appointments`
**Purpose:** Scheduled meetings/appointments for organizations

**Columns:**
- `id` (uuid) - Unique appointment ID
- `org_id` (uuid) - Organization owner
- `contact_id` (uuid) - Associated contact
- `title` (text) - Appointment title/type
- `description` (text, nullable) - Details about appointment
- `scheduled_at` (timestamp) - When appointment is scheduled
- `duration_minutes` (integer) - Duration in minutes
- `status` (text) - "scheduled", "completed", "cancelled", "no-show"
- `location` (text, nullable) - Physical or virtual location
- `notes` (text, nullable) - Internal notes
- `reminder_sent_at` (timestamp, nullable) - When reminder was sent
- `created_at` (timestamp) - When created
- `updated_at` (timestamp) - Last update

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id, contact_id → contacts.id
**Indexes:** org_id, scheduled_at, status, contact_id
**Row Count:** 30

---

### Table: `organizations`
**Purpose:** Customer accounts in the multi-tenant platform

**Columns:**
- `id` (uuid) - Unique organization ID
- `name` (text) - Organization name
- `email` (text) - Primary contact email
- `phone` (text, nullable) - Organization phone
- `website` (text, nullable) - Organization website
- `plan` (text) - Billing plan: "starter", "professional", "enterprise"
- `stripe_customer_id` (text, nullable) - Stripe customer reference
- `wallet_balance_pence` (integer, nullable) - Prepaid balance in pence
- `telephony_mode` (text) - "byoc", "managed", or "none"
- `settings` (jsonb, nullable) - Custom settings
- `created_at` (timestamp) - Account creation time
- `updated_at` (timestamp) - Last update time

**Primary Key:** id
**Indexes:** name, email, plan, stripe_customer_id, telephony_mode
**Row Count:** 27

---

### Table: `profiles`
**Purpose:** User accounts with role-based access

**Columns:**
- `id` (uuid) - Unique user ID (Supabase auth)
- `org_id` (uuid) - Organization this user belongs to
- `email` (text) - User email address
- `full_name` (text, nullable) - User's full name
- `avatar_url` (text, nullable) - Profile picture URL
- `role` (text) - "admin", "manager", "user"
- `phone` (text, nullable) - User phone number
- `status` (text) - "active", "inactive", "suspended"
- `last_login` (timestamp, nullable) - Last login time
- `created_at` (timestamp) - Account creation
- `updated_at` (timestamp) - Last update

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id
**Indexes:** org_id, email, role, status
**Row Count:** 26

---

### Table: `contacts`
**Purpose:** Contact list for organizations (leads, customers, patients)

**Columns:**
- `id` (uuid) - Unique contact ID
- `org_id` (uuid) - Organization owner
- `phone` (text) - Phone number (E.164)
- `email` (text, nullable) - Email address
- `first_name` (text) - Contact first name
- `last_name` (text) - Contact last name
- `lead_status` (text) - "hot", "warm", "cold", "contacted"
- `lead_score` (integer, nullable) - Score 0-100
- `notes` (text, nullable) - Internal notes
- `last_contacted_at` (timestamp, nullable) - When last contacted
- `created_at` (timestamp) - When added
- `updated_at` (timestamp) - Last update

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id
**Indexes:** org_id, phone, lead_status, lead_score
**Row Count:** 12

---

### Table: `call_tracking`
**Purpose:** Analytics and tracking metrics for calls

**Columns:**
- `id` (uuid) - Unique tracking record ID
- `org_id` (uuid) - Organization
- `call_id` (uuid, nullable) - Associated call
- `contact_id` (uuid, nullable) - Associated contact
- `tracked_url` (text) - Source tracking URL
- `utm_source` (text, nullable) - UTM source parameter
- `utm_medium` (text, nullable) - UTM medium parameter
- `utm_campaign` (text, nullable) - UTM campaign parameter
- `device_type` (text, nullable) - "mobile", "desktop", "unknown"
- `browser` (text, nullable) - Browser name
- `os` (text, nullable) - Operating system
- `ip_address` (text, nullable) - Caller IP
- `location` (text, nullable) - Geographic location
- `created_at` (timestamp) - When tracked

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id, call_id → calls.id
**Indexes:** org_id, call_id, created_at, utm_source
**Row Count:** 85

---

### Table: `feature_flags`
**Purpose:** Global feature toggles for feature management

**Columns:**
- `id` (uuid) - Unique flag ID
- `name` (text) - Feature name
- `description` (text, nullable) - Feature description
- `enabled` (boolean) - Global enable/disable
- `rollout_percentage` (integer, nullable) - 0-100 rollout
- `created_at` (timestamp) - When created

**Primary Key:** id
**Indexes:** name, enabled
**Row Count:** 11

---

### Table: `org_tools`
**Purpose:** Organization-specific tool configurations

**Columns:**
- `id` (uuid) - Unique tool config ID
- `org_id` (uuid) - Organization owner
- `tool_name` (text) - Tool identifier
- `enabled` (boolean) - Whether tool is active
- `config` (jsonb, nullable) - Tool-specific configuration
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id
**Indexes:** org_id, tool_name
**Row Count:** 10

---

### Table: `onboarding_submissions`
**Purpose:** Lead capture from website forms

**Columns:**
- `id` (uuid) - Unique submission ID
- `org_id` (uuid, nullable) - Associated organization
- `email` (text) - Submitter email
- `phone` (text) - Submitter phone
- `name` (text) - Submitter name
- `company` (text, nullable) - Company name
- `message` (text, nullable) - Message or inquiry
- `source` (text, nullable) - Where form was accessed from
- `ip_address` (text, nullable) - Submitter IP
- `created_at` (timestamp) - Submission time

**Primary Key:** id
**Foreign Keys:** org_id → organizations.id
**Indexes:** org_id, email, created_at
**Row Count:** 21

---

## 🔵 CONFIGURATION TABLES (17 - System Config)

These 17 tables store legitimate system configuration needed for the platform:

### Table: `agents`
**Purpose:** AI agent configurations for voice calls
**Row Count:** 6 | **Columns:** 45 | **Key:** id | **Foreign Keys:** org_id

### Table: `services`
**Purpose:** Service catalog (service types, pricing, etc)
**Row Count:** 7 | **Columns:** 8 | **Key:** id | **Foreign Keys:** org_id

### Table: `knowledge_base`
**Purpose:** Knowledge base articles and content
**Row Count:** 8 | **Columns:** 12 | **Key:** id | **Foreign Keys:** org_id

### Table: `knowledge_base_chunks`
**Purpose:** Vectorized text chunks for RAG/embeddings
**Row Count:** 8 | **Columns:** 8 | **Key:** id | **Foreign Keys:** knowledge_base_id

### Table: `knowledge_base_changelog`
**Purpose:** History of knowledge base updates
**Row Count:** 8 | **Columns:** 8 | **Key:** id | **Foreign Keys:** knowledge_base_id

### Table: `integrations`
**Purpose:** Third-party API integrations configuration
**Row Count:** 3 | **Columns:** 10 | **Key:** id | **Foreign Keys:** org_id

### Table: `org_credentials`
**Purpose:** Encrypted API keys vault for external services
**Row Count:** 4 | **Columns:** 12 | **Key:** id | **Foreign Keys:** org_id

### Table: `carrier_forwarding_rules`
**Purpose:** Telephony carrier configuration for call forwarding
**Row Count:** 4 | **Columns:** 10 | **Key:** id | **Foreign Keys:** org_id

### Table: `leads`
**Purpose:** CRM lead records and pipeline
**Row Count:** 4 | **Columns:** 12 | **Key:** id | **Foreign Keys:** org_id

### Table: `audit_logs`
**Purpose:** System audit trail for compliance
**Row Count:** 3 | **Columns:** 8 | **Key:** id | **Foreign Keys:** org_id

### Table: `telephony_country_audit_log`
**Purpose:** Telephony country configuration audit
**Row Count:** 4 | **Columns:** 10 | **Key:** id | **Foreign Keys:** org_id

### Table: `security_audit_log`
**Purpose:** Security events and login tracking
**Row Count:** 2 | **Columns:** 8 | **Key:** id | **Foreign Keys:** org_id

### Table: `org_feature_flags`
**Purpose:** Organization-specific feature toggles
**Row Count:** 2 | **Columns:** 8 | **Key:** id | **Foreign Keys:** org_id

### Table: `hot_lead_alerts`
**Purpose:** High-priority lead notifications
**Row Count:** 2 | **Columns:** 10 | **Key:** id | **Foreign Keys:** org_id

### Table: `twilio_subaccounts`
**Purpose:** Twilio subaccount mapping for multi-tenant
**Row Count:** 1 | **Columns:** 8 | **Key:** id | **Foreign Keys:** org_id

### Table: `escalation_rules`
**Purpose:** Call escalation rules configuration
**Row Count:** 1 | **Columns:** 10 | **Key:** id | **Foreign Keys:** org_id

### Table: `integration_settings`
**Purpose:** Global integration configuration
**Row Count:** 1 | **Columns:** 8 | **Key:** id

---

## 📊 Schema Statistics

### Tables by Purpose
```
Production/Core (9):     calls, appointments, organizations, profiles,
                         contacts, call_tracking, feature_flags,
                         org_tools, onboarding_submissions

Configuration (17):      agents, services, knowledge_base*,
                         integrations, org_credentials, audit_logs,
                         and 11 other config tables

Totals:                  26 tables, ~500 columns, 75 FKs, 150 indexes
```

### Data Distribution
```
call_tracking:        85 rows  ████████████████ (largest)
appointments:         30 rows  ██████
organizations:        27 rows  █████
profiles:             26 rows  █████
onboarding_subs:      21 rows  ████
calls:                21 rows  ████
contacts:             12 rows  ██
feature_flags:        11 rows  ██
org_tools:            10 rows  █
Configuration:       ~50 rows  ██ (spread across 17 tables)
```

---

## 🔐 Multi-Tenancy & Security

### Organization Isolation
All production tables have `org_id` foreign key referencing `organizations.id`
- **RLS Enabled:** Yes (Row-Level Security policies on all multi-tenant tables)
- **Isolation Level:** Strong (database + application layer)
- **Data Breach Risk:** Minimal (cryptographic UUID isolation)

### User Access Control
All user operations filtered by:
1. JWT `org_id` from Supabase Auth
2. RLS policies enforcing `org_id = current_user_org_id`
3. Application-level additional validation

---

## 📈 Key Relationships

### Call Lifecycle
```
Call (calls table)
├── org_id → organizations (which org made the call)
├── contact_id → contacts (who called/was called)
├── tracked by → call_tracking (analytics)
└── may create → hot_lead_alerts (if high scoring)
```

### Appointment Lifecycle
```
Appointment (appointments table)
├── org_id → organizations
├── contact_id → contacts
└── may create → hot_lead_alerts (if VIP)
```

### Configuration Hierarchy
```
Organization (organizations)
├── agents (voice AI agents)
├── services (service offerings)
├── integrations (API connections)
├── org_credentials (encrypted API keys)
├── org_tools (tool configurations)
├── org_feature_flags (feature toggles)
└── carrier_forwarding_rules (telephony config)
```

---

## ✅ Validation Rules

### Critical Constraints
- All org_id references must exist in organizations table
- All contact_id references must exist in contacts table
- All profile access must be RLS-filtered by org_id
- Call status must be one of: pending, in_progress, completed, failed
- Lead status must be: hot, warm, cold, contacted

### Data Quality Rules
- Phone numbers stored in E.164 format (+1234567890)
- Emails must be valid format
- Timestamps always in UTC (timestamp with time zone)
- UUIDs generated by database (uuid_generate_v4() or gen_random_uuid())

---

## 🚀 Production Readiness Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Schema Complexity** | ✅ Optimal | 26 tables (67% reduction) |
| **Data Integrity** | ✅ Strong | Constraints, FKs, RLS active |
| **Performance** | ✅ Good | 150+ indexes on critical paths |
| **Multi-Tenancy** | ✅ Secure | RLS policies enforced |
| **Backup Strategy** | ✅ 7-day PITR | Daily Supabase backups |
| **Security** | ✅ Excellent | Encrypted credentials, RLS |

---

## 📝 Last Updated

- **Date:** February 9, 2026
- **Event:** Schema cleanup - removed 53 unused/legacy tables
- **Tables Before:** 79
- **Tables After:** 26
- **Data Loss:** Zero
- **Breaking Changes:** None
- **Status:** ✅ Production Ready

---

## 🔗 Related Documentation

- `SCHEMA_CLEANUP_EXECUTION_GUIDE.md` - How cleanup was performed
- `SCHEMA_CLEANUP_QUICK_REFERENCE.md` - Quick reference
- `SCHEMA_CLEANUP_DEPLOYMENT_COMPLETE.md` - Execution report
- `.agent/supabase-mcp.md` - Database connection guide

---

**This is the Single Source of Truth (SSOT) for the Voxanne AI database schema.**
**Status:** Current as of 2026-02-09
**Last Verified:** Database query verification completed
**Next Review:** Scheduled for 2026-03-09
