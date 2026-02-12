# Voxanne AI - Database Single Source of Truth (SSOT)

**Version:** 1.0.0
**Last Updated:** 2026-02-12 14:30 UTC
**Status:** ✅ **PRODUCTION SCHEMA COMPLETE**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Multi-Tenant Architecture](#multi-tenant-architecture)
3. [Core Tables](#core-tables)
4. [Authentication & Access](#authentication--access)
5. [Billing & Credits](#billing--credits)
6. [Telephony & Agents](#telephony--agents)
7. [Calling & Recordings](#calling--recordings)
8. [Knowledge Base](#knowledge-base)
9. [Integration Credentials](#integration-credentials)
10. [Appointment Management](#appointment-management)
11. [Monitoring & Audit](#monitoring--audit)
12. [Helper Functions](#helper-functions)
13. [Critical Invariants](#critical-invariants)
14. [Implementation References](#implementation-references)

---

## Overview

**Database:** Supabase PostgreSQL
**Region:** us-east-1
**Auth:** Row-Level Security (RLS) enforced
**Multi-Tenancy:** org_id based isolation
**Backup:** Daily automated, 30-day retention
**Recovery:** Point-in-time restore available

**Key Principle:** Every table filters by `org_id` in WHERE clauses. RLS policies enforce this at database level. No cross-org data leakage possible.

---

## Multi-Tenant Architecture

### Isolation Strategy

```
REQUEST
  ↓
JWT Token Extracted
  ↓
verifyJWTAndExtractOrgId(token)  [backend/src/middleware/auth.ts]
  ↓
Extract app_metadata.org_id (cryptographically signed by Supabase)
  ↓
Set req.user.orgId = extracted org_id
  ↓
All queries: WHERE org_id = req.user.orgId
  ↓
RLS Policies: Additional database-level filtering
  ↓
Result: Zero cross-org data leakage
```

### JWT Token Structure

```json
{
  "sub": "user-id-123",
  "email": "user@example.com",
  "app_metadata": {
    "org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  "iat": 1707819051,
  "exp": 1707905451
}
```

**Key:** `app_metadata.org_id` is the single source of truth for organization isolation. Never use query parameters or headers for org_id.

---

## Core Tables

### 1. organizations

**Purpose:** Customer accounts (organizations/businesses)
**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique organization ID
- `name` (TEXT) - Business name
- `email` (TEXT, UNIQUE) - Primary contact email
- `phone` (TEXT) - Primary contact phone
- `timezone` (TEXT, DEFAULT 'UTC') - Organization timezone
- `webhook_url` (TEXT) - Custom webhook endpoint
- `max_agents` (INTEGER, DEFAULT 5) - Agent limit
- `wallet_balance_pence` (INTEGER, DEFAULT 0) - Current credit balance in pence (£0.01 = 1 pence)
- `debt_limit_pence` (INTEGER, DEFAULT 50000) - Max negative balance before blocking ops (£500.00)
- `stripe_customer_id` (TEXT) - Stripe customer record
- `stripe_default_pm_id` (TEXT) - Default payment method for auto-recharge
- `wallet_auto_recharge` (BOOLEAN, DEFAULT false) - Auto top-up when balance drops below threshold
- `wallet_recharge_amount_pence` (INTEGER) - Amount to auto-recharge
- `wallet_recharge_threshold_pence` (INTEGER) - Trigger threshold for auto-recharge
- `created_at` (TIMESTAMPTZ) - Registration date
- `updated_at` (TIMESTAMPTZ) - Last modification date

**Indexes:**
- `organizations_pkey` - Primary key on id
- `organizations_email_key` - Unique on email (for signup lookups)
- `idx_organizations_created_at` - Sorted by creation date

**RLS Policies:**
- Users can SELECT their own org (WHERE org_id = auth.uid())
- Service role can CRUD all orgs
- Public cannot access

**Notes:**
- `wallet_balance_pence` is the single source of truth for credit balance
- `debt_limit_pence` defines maximum negative balance allowed
- All currency in pence (£0.01 = 1 pence) for precision

---

### 2. profiles

**Purpose:** User profiles within organizations
**Columns:**
- `id` (UUID, PRIMARY KEY) - User ID (linked to Supabase auth.users)
- `org_id` (UUID, FK → organizations.id) - Organization membership
- `email` (TEXT) - User email (denormalized from auth)
- `full_name` (TEXT) - User display name
- `role` (TEXT, CHECK: 'admin'|'agent'|'viewer') - User role
- `avatar_url` (TEXT) - Profile picture
- `created_at` (TIMESTAMPTZ) - Join date
- `updated_at` (TIMESTAMPTZ) - Last update

**Indexes:**
- `profiles_pkey` - Primary key on id
- `idx_profiles_org_id` - Org membership lookups
- `idx_profiles_email` - Email searches

**RLS Policies:**
- Users can SELECT/UPDATE own profile
- Org admins can SELECT/UPDATE profiles in their org
- Service role unrestricted

**Constraints:**
- `FOREIGN KEY (org_id)` references organizations(id)
- Role is one of: admin, agent, viewer

---

## Authentication & Access

### 3. auth_sessions

**Purpose:** Track active user sessions
**Columns:**
- `id` (UUID, PRIMARY KEY) - Session ID
- `user_id` (UUID, FK → profiles.id) - User reference
- `org_id` (UUID, FK → organizations.id) - Organization context
- `token_hash` (TEXT) - SHA256(JWT token) for matching
- `ip_address` (TEXT) - Client IP address
- `user_agent` (TEXT) - Browser/device info
- `device_type` (TEXT) - 'mobile'|'desktop'|'tablet'
- `location` (TEXT) - Geo-location (city, country)
- `expires_at` (TIMESTAMPTZ) - Session expiry (7 days from login)
- `created_at` (TIMESTAMPTZ) - Login timestamp

**Indexes:**
- `auth_sessions_pkey` - Primary key
- `idx_auth_sessions_user_id` - User's active sessions
- `idx_auth_sessions_org_id` - Org session list
- `idx_auth_sessions_expires_at` - Cleanup old sessions
- `idx_auth_sessions_active` - Partial: WHERE expires_at > NOW()

**RLS Policies:**
- Users view own sessions only
- Org admins can view all sessions in org
- Service role unrestricted

**Lifecycle:**
- Created: At login
- Expires: 7 days
- Cleanup: Automatic daily at 3 AM UTC

**Triggers:**
- `trigger_auth_sessions_expire_old` - Delete expired sessions daily

---

### 4. auth_audit_log

**Purpose:** Compliance audit trail for authentication events
**Columns:**
- `id` (UUID, PRIMARY KEY) - Log entry ID
- `user_id` (UUID, FK → profiles.id) - User reference
- `org_id` (UUID, FK → organizations.id) - Organization context
- `event_type` (TEXT) - Event type (see Event Types below)
- `ip_address` (TEXT) - Client IP
- `user_agent` (TEXT) - Browser info
- `metadata` (JSONB) - Event-specific data
- `created_at` (TIMESTAMPTZ) - Event timestamp

**Event Types:**
- `login_success` - Successful login
- `login_failed` - Failed login attempt
- `logout` - User logout
- `mfa_enabled` - Multi-factor authentication enabled
- `mfa_disabled` - Multi-factor authentication disabled
- `mfa_challenge_success` - MFA verification passed
- `mfa_challenge_failed` - MFA verification failed
- `password_changed` - Password reset
- `password_reset_requested` - Password reset initiated
- `session_revoked` - Session forcefully terminated
- `sso_login` - Single sign-on login

**Indexes:**
- `auth_audit_log_pkey` - Primary key
- `idx_auth_audit_log_user_id` - User's audit history
- `idx_auth_audit_log_org_id` - Organization audit trail
- `idx_auth_audit_log_event_type` - Filter by event type
- `idx_auth_audit_log_created_at` - Time-based queries

**RLS Policies:**
- Users view own audit logs
- Org admins view org audit logs
- Service role unrestricted

**Retention:**
- 90 days (automatic cleanup daily at 3 AM UTC)
- Immutable after creation

**Compliance:**
- SOC 2: Mandatory for privileged access audit
- HIPAA: Required for covered entity audits
- ISO 27001: Required for access control evidence

---

## Billing & Credits

### 5. credit_wallets

**Purpose:** Track organization credit balances (deprecated - use organizations.wallet_balance_pence)
**Status:** DEPRECATED - Use organizations.wallet_balance_pence instead

---

### 6. credit_transactions

**Purpose:** Immutable audit trail of all wallet operations
**Columns:**
- `id` (UUID, PRIMARY KEY) - Transaction ID
- `org_id` (UUID, FK → organizations.id) - Organization
- `type` (TEXT, CHECK) - Transaction type
- `amount_pence` (INTEGER) - Absolute transaction amount (always positive)
- `direction` (TEXT, CHECK: 'credit'|'debit') - Direction (credit = add, debit = subtract)
- `balance_before_pence` (INTEGER) - Balance before transaction
- `balance_after_pence` (INTEGER) - Balance after transaction
- `stripe_payment_intent_id` (TEXT) - Stripe payment reference
- `stripe_charge_id` (TEXT) - Stripe charge reference
- `call_id` (UUID, FK → calls.id) - Associated call (if call-related)
- `phone_number` (TEXT) - Phone number (if provisioning)
- `description` (TEXT) - Human-readable explanation
- `created_by` (TEXT) - Creator ('system', 'user', or user ID)
- `created_at` (TIMESTAMPTZ) - Transaction date

**Transaction Types:**
- `topup` - Stripe payment added to wallet
- `call` - Deduction for voice call
- `sms` - Deduction for SMS send
- `phone_provisioning` - Deduction for phone number purchase
- `refund` - Refund for failed operation
- `adjustment` - Manual admin adjustment

**Indexes:**
- `credit_transactions_pkey` - Primary key
- `idx_credit_transactions_org_id` - Organization transactions
- `idx_credit_transactions_created_at` - Time-sorted history
- `idx_credit_transactions_call_id` - Call lookups

**RLS Policies:**
- Users view own org transactions only
- Service role unrestricted

**Immutability:**
- Never UPDATE or DELETE transactions (audit trail integrity)
- INSERT-only table for production use

**Calculation Example:**
```sql
-- Get current wallet balance from transactions
SELECT balance_after_pence
FROM credit_transactions
WHERE org_id = 'xxx'
ORDER BY created_at DESC
LIMIT 1;

-- Alternative: Read from organizations table (denormalized)
SELECT wallet_balance_pence FROM organizations WHERE id = 'xxx';
```

---

### 7. auto_recharge_configs

**Purpose:** Settings for automatic wallet top-up
**Columns:**
- `id` (UUID, PRIMARY KEY) - Config ID
- `org_id` (UUID, FK → organizations.id, UNIQUE) - Organization (one config per org)
- `enabled` (BOOLEAN, DEFAULT false) - Is auto-recharge active?
- `recharge_amount_pence` (INTEGER) - Amount to recharge (e.g., 50000 = £500)
- `recharge_threshold_pence` (INTEGER) - Trigger point (e.g., 5000 = £50)
- `max_recharges_per_month` (INTEGER, DEFAULT 10) - Rate limit
- `recharge_count_this_month` (INTEGER, DEFAULT 0) - Counter
- `reset_day_of_month` (INTEGER, DEFAULT 1) - Counter reset date
- `payment_method_id` (TEXT) - Stripe PM ID for auto-charge
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `auto_recharge_configs_pkey` - Primary key
- `idx_auto_recharge_configs_org_id` - Org lookup

**RLS Policies:**
- Org admins can SELECT/UPDATE own config
- Service role unrestricted

**Business Logic:**
- When wallet balance drops below `recharge_threshold_pence`
- AND `enabled` = true
- AND `recharge_count_this_month` < `max_recharges_per_month`
- THEN charge Stripe and add `recharge_amount_pence` to wallet

---

## Telephony & Agents

### 8. agents

**Purpose:** AI voice agents configured by users
**Columns:**
- `id` (UUID, PRIMARY KEY) - Agent ID
- `org_id` (UUID, FK → organizations.id) - Organization owner
- `name` (TEXT) - Agent display name
- `description` (TEXT) - Agent purpose/description
- `system_prompt` (TEXT) - AI system prompt for voice agent
- `voice_id` (TEXT) - Voice character (Vapi voice ID)
- `vapi_assistant_id` (TEXT, UNIQUE) - Vapi remote assistant ID
- `vapi_phone_number_id` (UUID) - Vapi phone number UUID (for outbound calls)
- `phone_number_id` (UUID, FK → managed_phone_numbers.id) - Managed number reference (if applicable)
- `inbound_enabled` (BOOLEAN, DEFAULT false) - Accept inbound calls?
- `outbound_enabled` (BOOLEAN, DEFAULT false) - Make outbound calls?
- `greeting_message` (TEXT) - Initial greeting when call connects
- `forwarding_number` (TEXT) - Human handoff number (if escalation needed)
- `calendar_sync_enabled` (BOOLEAN, DEFAULT false) - Access to Google Calendar?
- `knowledge_base_id` (UUID, FK → knowledge_bases.id) - Linked KB for RAG
- `max_call_duration_minutes` (INTEGER, DEFAULT 30) - Call timeout
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `agents_pkey` - Primary key
- `idx_agents_org_id` - Organization agents
- `idx_agents_vapi_assistant_id` - Vapi webhook lookups
- `idx_agents_phone_number_id` - Phone number links

**RLS Policies:**
- Users SELECT agents in their org only
- Org admins UPDATE agents
- Service role unrestricted

**Critical Invariant:**
- `vapi_phone_number_id` is REQUIRED for outbound calls
- Must be UUID format (Vapi phone number ID, NOT E.164 number)
- Never null for agents with `outbound_enabled = true`

**Outbound Call Flow:**
```
contacts.ts /api/contacts/:id/call-back
  ↓
Query agent with .maybeSingle() (NOT .single())
  ↓
Check vapi_phone_number_id
  ↓
If NULL: resolveOrgPhoneNumberId() fallback
  ↓
Call VapiClient.createOutboundCall(phoneNumberId, assistantId, customerNumber)
  ↓
createOutboundCall() validates: assertOutboundCallReady()
  ↓
Check phoneNumberId is UUID (no + prefix)
  ↓
Make Vapi API call
```

---

### 9. managed_phone_numbers

**Purpose:** Track Twilio phone numbers provisioned by platform (operational tracking table)
**Columns:**
- `id` (UUID, PRIMARY KEY) - Internal ID
- `org_id` (UUID, FK → organizations.id) - Organization owner
- `phone_number` (TEXT, UNIQUE) - E.164 format (+1234567890)
- `vapi_phone_id` (UUID) - Vapi phone resource ID (for Vapi imports)
- `twilio_sid` (TEXT, UNIQUE) - Twilio phone SID
- `area_code` (TEXT) - US area code (e.g., '415')
- `status` (TEXT, CHECK: 'active'|'disabled'|'released') - Current status
- `cost_usd` (NUMERIC) - Monthly cost in USD
- `purchased_at` (TIMESTAMPTZ) - Purchase date
- `auto_renew` (BOOLEAN, DEFAULT true) - Auto-renew monthly?
- `expires_at` (TIMESTAMPTZ) - Renewal date
- `twilio_subaccount_id` (TEXT, FK) - Subaccount owner
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `managed_phone_numbers_pkey` - Primary key
- `idx_managed_phone_numbers_org_id` - Org's numbers
- `idx_managed_phone_numbers_status` - Active numbers only

**RLS Policies:**
- Users view numbers in own org
- Service role unrestricted

**Critical: Managed Phone Number Lifecycle**

Managed phone numbers require **dual-write strategy** and **complete cleanup on deletion** to maintain SSOT integrity:

#### Provisioning (Write to BOTH tables)
```typescript
// File: backend/src/routes/managed-telephony.ts
// When phone provisioned from Twilio:

// 1. Write operational data to managed_phone_numbers
await supabase.from('managed_phone_numbers').insert({
  phone_number: '+14158497226',
  vapi_phone_id: 'abc-123-uuid',
  twilio_sid: 'PN12345abcde',
  org_id: orgId,
  status: 'active'
});

// 2. ALSO write credential to org_credentials (SSOT for discovery)
await IntegrationDecryptor.saveTwilioCredential(orgId, {
  accountSid: masterSid,
  authToken: masterToken,
  phoneNumber: '+14158497226',
  vapiPhoneId: 'abc-123-uuid',
  source: 'managed',
  isManaged: true
});
```

**Why both tables?**
- `managed_phone_numbers`: Operational tracking (cost, renewal, status)
- `org_credentials`: SSOT for credential discovery (used by agent dropdown)
- Agent dropdown queries `org_credentials`, NOT `managed_phone_numbers`
- If phone is in `managed_phone_numbers` but NOT in `org_credentials`, it won't appear in dropdown

#### Deletion (Clean up BOTH tables + Unlink Agents)

**Complete 6-step deletion flow:**
File: `backend/src/services/managed-telephony-service.ts`

```typescript
// Step 1: Release from Vapi API
await vapi.deletePhoneNumber(vapiPhoneId);

// Step 2: Release from Twilio API
await twilio.incomingPhoneNumbers(twilioSid).remove();

// Step 3: Update managed_phone_numbers status
await supabaseAdmin
  .from('managed_phone_numbers')
  .update({ status: 'released' })
  .eq('org_id', orgId)
  .eq('phone_number', phoneNumber);

// Step 4: Remove phone_number_mapping
await supabaseAdmin
  .from('phone_number_mapping')
  .delete()
  .eq('vapi_phone_id', vapiPhoneId);

// Step 5: DELETE from org_credentials (CRITICAL FOR SSOT)
await supabaseAdmin
  .from('org_credentials')
  .delete()
  .eq('org_id', orgId)
  .eq('provider', 'twilio')
  .eq('is_managed', true);

// Step 6: Unlink agents (set vapi_phone_number_id = NULL)
const { data: linkedAgents } = await supabaseAdmin
  .from('agents')
  .select('id')
  .eq('org_id', orgId)
  .eq('vapi_phone_number_id', vapiPhoneId);

if (linkedAgents && linkedAgents.length > 0) {
  await supabaseAdmin
    .from('agents')
    .update({ vapi_phone_number_id: null })
    .eq('org_id', orgId)
    .eq('vapi_phone_number_id', vapiPhoneId);
}
```

**Result:** Phone completely removed from system:
- ✅ managed_phone_numbers.status = 'released' (soft delete, history preserved)
- ✅ org_credentials = DELETED (hard delete, cleans SSOT)
- ✅ Agents unlinked (vapi_phone_number_id = NULL)
- ✅ No longer appears in agent dropdown
- ✅ No orphaned credential records

---

### 10. org_credentials

**Purpose:** Single source of truth (SSOT) for all integration credentials (Twilio, Google Calendar, etc.)

**CRITICAL:** This table is the SSOT for credential discovery. Agent dropdowns, phone number selectors, and integration UIs query this table. If a credential is missing from `org_credentials`, it will NOT appear in the UI, even if it exists in other tables.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Credential ID
- `org_id` (UUID, FK → organizations.id) - Organization
- `provider` (TEXT, CHECK) - Provider type ('twilio'|'google'|'mailgun', etc.)
- `is_managed` (BOOLEAN, DEFAULT false) - Is this a managed provider?
- `is_active` (BOOLEAN, DEFAULT true) - Credential currently valid?
- `encrypted_config` (BYTEA) - AES-256-GCM encrypted JSON
- `encryption_salt` (BYTEA) - Salt for key derivation
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Provider Types:**
- `twilio` - Phone number and SMS provider
- `google` - Google Calendar integration
- `mailgun` - Email sending
- `stripe` - Stripe payment processor
- `vapi` - Vapi voice infrastructure

**Indexes:**
- `org_credentials_pkey` - Primary key
- `idx_org_credentials_org_provider_active` - Active creds per provider
- `idx_org_credentials_managed` - Managed numbers (is_managed=true)
- `idx_org_credentials_one_managed_per_org` - Unique managed number constraint

**RLS Policies:**
- Users can decrypt credentials for own org only
- Service role unrestricted
- Encrypted at rest (keys never logged)

**Encryption:**
- Algorithm: AES-256-GCM
- Key source: Environment variable `ENCRYPTION_KEY`
- Salt: Unique per credential
- Authentication tag: Prevents tampering
- Never decrypt without matching org_id

**Twilio Credential Schema (encrypted JSON):**
```json
{
  "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxx",
  "authToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "phoneNumber": "+14158497226",
  "vapiPhoneId": "abc-123-def-456-uuid",
  "source": "managed|byoc",
  "isManaged": true|false,
  "createdAt": "2026-02-12T14:30:00Z"
}
```

**Google Calendar Credential Schema (encrypted JSON):**
```json
{
  "accessToken": "ya29.c.xxxxxxxxxxxxx",
  "refreshToken": "1//xxxxxxxxxxxxxxxxx",
  "expiresIn": 3599,
  "tokenType": "Bearer",
  "scope": "https://www.googleapis.com/auth/calendar",
  "createdAt": "2026-02-12T14:30:00Z"
}
```

**Critical for Managed Phone Numbers:**

When a managed phone number is provisioned, a Twilio credential MUST be inserted into `org_credentials` with `is_managed=true`. This is what makes the number appear in:
- Agent configuration phone number dropdown
- UI selectors and pickers
- API responses listing available phones

**IMPORTANT: Deletion**
When a managed phone number is deleted:
- `managed_phone_numbers` record is soft-deleted (status='released')
- `org_credentials` record with `provider='twilio'` and `is_managed=true` MUST be hard-deleted
- Deletion flow: See "Managed Phone Number Lifecycle" in section 9 above

**If org_credentials is not deleted:**
- ❌ Phone number appears in org_credentials
- ❌ But disappears from managed_phone_numbers
- ❌ This creates SSOT violation
- ❌ Phone still appears in agent dropdown (confusing)
- ❌ If agent tries to use deleted phone: Vapi API error

---

## Calling & Recordings

### 11. calls

**Purpose:** Record of all inbound and outbound voice calls
**Columns:**
- `id` (UUID, PRIMARY KEY) - Call ID
- `org_id` (UUID, FK → organizations.id) - Organization
- `agent_id` (UUID, FK → agents.id) - AI agent handling call (if applicable)
- `contact_id` (UUID, FK → contacts.id) - Associated contact
- `vapi_call_id` (UUID, UNIQUE) - Vapi call reference
- `call_direction` (TEXT, CHECK: 'inbound'|'outbound') - Direction
- `status` (TEXT, CHECK) - Call state (queued|ringing|in_progress|completed|failed|missed)
- `from_number` (TEXT) - Caller number (inbound)
- `to_number` (TEXT) - Called number (outbound)
- `phone_number` (TEXT) - E.164 format phone number
- `caller_name` (TEXT) - Enriched caller name from contacts
- `duration_seconds` (INTEGER) - Call length
- `cost_usd` (NUMERIC) - Call charge to wallet
- `transcript` (TEXT) - Full call transcript
- `sentiment_label` (TEXT, CHECK: 'positive'|'neutral'|'negative') - Vapi sentiment analysis
- `sentiment_score` (NUMERIC, 0.0-1.0) - Numeric sentiment score
- `sentiment_summary` (TEXT) - Human summary of tone
- `sentiment_urgency` (TEXT, CHECK: 'low'|'medium'|'high'|'critical') - Lead urgency
- `recording_url` (TEXT) - Signed URL to call recording
- `ended_reason` (TEXT) - Why call ended (customer_hangup, agent_hangup, timeout, etc.)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `end_time` (TIMESTAMPTZ) - Call completion time

**Indexes:**
- `calls_pkey` - Primary key
- `idx_calls_org_id` - Organization calls
- `idx_calls_contact_id` - Contact's calls
- `idx_calls_agent_id` - Agent's calls
- `idx_calls_created_at` - Time-sorted list
- `idx_calls_vapi_call_id` - Webhook lookups

**RLS Policies:**
- Users view calls in own org only
- Service role unrestricted

**Billing Integration:**
- `cost_usd` is synced from Vapi end-of-call report
- Vapi rate: $0.70/minute (fixed prepaid rate)
- Deducted from wallet at call completion
- Calculation: `ceil((duration_seconds / 60) * 0.70 * 79 pence per USD)`

**Sentiment Analysis:**
- Populated from Vapi post-call analysis
- Used for lead scoring and hot lead alerts

---

### 12. call_recordings

**Purpose:** Metadata for call recordings (deprecated - use calls.recording_url)
**Status:** DEPRECATED - Use calls.recording_url instead

---

## Knowledge Base

### 13. knowledge_bases

**Purpose:** Document collections for RAG (Retrieval-Augmented Generation)
**Columns:**
- `id` (UUID, PRIMARY KEY) - Knowledge base ID
- `org_id` (UUID, FK → organizations.id) - Organization owner
- `name` (TEXT) - KB name
- `description` (TEXT) - KB purpose
- `document_count` (INTEGER, DEFAULT 0) - Number of documents
- `chunk_count` (INTEGER, DEFAULT 0) - Number of text chunks
- `size_bytes` (INTEGER, DEFAULT 0) - Total size
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `knowledge_bases_pkey` - Primary key
- `idx_knowledge_bases_org_id` - Org's KBs

**RLS Policies:**
- Users view own org's KBs
- Service role unrestricted

---

### 14. knowledge_base_documents

**Purpose:** Documents within a knowledge base
**Columns:**
- `id` (UUID, PRIMARY KEY) - Document ID
- `knowledge_base_id` (UUID, FK → knowledge_bases.id) - Parent KB
- `org_id` (UUID, FK → organizations.id) - Organization (denormalized for RLS)
- `name` (TEXT) - Document name/title
- `content` (TEXT) - Raw document content
- `file_type` (TEXT) - Format (pdf|docx|txt|md)
- `size_bytes` (INTEGER) - File size
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `knowledge_base_documents_pkey` - Primary key
- `idx_knowledge_base_documents_kb_id` - Documents in KB
- `idx_knowledge_base_documents_org_id` - Org documents

**RLS Policies:**
- Users view docs from own org's KBs
- Service role unrestricted

---

### 15. knowledge_base_chunks

**Purpose:** Embeddings for RAG retrieval
**Columns:**
- `id` (UUID, PRIMARY KEY) - Chunk ID
- `knowledge_base_id` (UUID, FK → knowledge_bases.id) - Parent KB
- `document_id` (UUID, FK → knowledge_base_documents.id) - Source document
- `org_id` (UUID, FK → organizations.id) - Organization (denormalized for RLS)
- `content` (TEXT) - Chunk text (max 1024 chars)
- `embedding` (vector) - OpenAI embedding (1536 dimensions)
- `metadata` (JSONB) - Source page, section, etc.
- `created_at` (TIMESTAMPTZ)

**Indexes:**
- `knowledge_base_chunks_pkey` - Primary key
- `idx_knowledge_base_chunks_kb_id` - Chunks in KB
- `idx_knowledge_base_chunks_org_id` - Org chunks
- `idx_knowledge_base_chunks_embedding` - Vector search index (ivfflat)

**RLS Policies:**
- Users access chunks from own org's KBs
- Service role unrestricted

**Vector Search:**
```sql
-- Find similar chunks
SELECT id, content, embedding <-> query_embedding AS distance
FROM knowledge_base_chunks
WHERE org_id = 'xxx'
ORDER BY distance ASC
LIMIT 5;
```

---

## Integration Credentials

### 16. twilio_subaccounts

**Purpose:** Twilio subaccounts for managed phone numbers
**Columns:**
- `id` (UUID, PRIMARY KEY) - Subaccount ID
- `org_id` (UUID, FK → organizations.id) - Organization owner
- `twilio_subaccount_sid` (TEXT, UNIQUE) - Twilio SID
- `twilio_auth_token_encrypted` (BYTEA) - AES-256-GCM encrypted token
- `status` (TEXT, CHECK: 'active'|'suspended'|'deleted') - Current status
- `friendly_name` (TEXT) - Display name
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `twilio_subaccounts_pkey` - Primary key
- `idx_twilio_subaccounts_org_id` - Org's subaccounts
- `idx_twilio_subaccounts_sid` - SID lookup

**RLS Policies:**
- Service role only (sensitive credential storage)

**Encryption:**
- Token encrypted with AES-256-GCM
- Never logged or returned to client

**Critical Rule:**
- One subaccount per organization
- Created during first managed number provisioning
- Tokens never exposed in API responses

---

## Appointment Management

### 17. appointments

**Purpose:** Calendar appointments booked via AI calls
**Columns:**
- `id` (UUID, PRIMARY KEY) - Appointment ID
- `org_id` (UUID, FK → organizations.id) - Organization
- `contact_id` (UUID, FK → contacts.id) - Customer
- `agent_id` (UUID, FK → agents.id) - Booking agent
- `call_id` (UUID, FK → calls.id) - Call where booked
- `title` (TEXT) - Appointment title
- `description` (TEXT) - Details
- `scheduled_at` (TIMESTAMPTZ) - Appointment datetime
- `duration_minutes` (INTEGER, DEFAULT 30) - Duration
- `location` (TEXT) - Location or Zoom link
- `google_event_id` (TEXT) - Google Calendar event ID
- `status` (TEXT, CHECK: 'confirmed'|'cancelled'|'completed'|'no_show') - Status
- `reminder_sent_at` (TIMESTAMPTZ) - SMS reminder timestamp
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Indexes:**
- `appointments_pkey` - Primary key
- `idx_appointments_org_id` - Organization appointments
- `idx_appointments_contact_id` - Customer appointments
- `idx_appointments_scheduled_at` - Time-sorted list
- `idx_appointments_google_event_id` - Google Calendar sync

**RLS Policies:**
- Users view own org appointments
- Service role unrestricted

**Booking Flow:**
```
Vapi call → /api/vapi-tools/check-availability
  ↓
Verify Google Calendar access
  ↓
Check agent's calendar for free slots
  ↓
/api/vapi-tools/book-appointment
  ↓
Call book_appointment_with_lock() RPC (advisory lock)
  ↓
Check no conflicts (protected by lock)
  ↓
Create appointment
  ↓
Create Google Calendar event
  ↓
Return confirmation
```

---

## Monitoring & Audit

### 18. webhook_delivery_log

**Purpose:** Audit trail for all webhook deliveries
**Columns:**
- `id` (UUID, PRIMARY KEY) - Log entry ID
- `org_id` (UUID, FK → organizations.id) - Organization
- `job_id` (TEXT, UNIQUE) - BullMQ job ID
- `event_type` (TEXT) - Event type (call.started, call.ended, etc.)
- `event_data` (JSONB) - Full webhook payload
- `status` (TEXT, CHECK: 'pending'|'processing'|'completed'|'failed'|'dead_letter') - Delivery status
- `attempts` (INTEGER) - Number of attempts
- `max_attempts` (INTEGER, DEFAULT 3) - Max retries
- `created_at` (TIMESTAMPTZ) - Log timestamp
- `last_attempt_at` (TIMESTAMPTZ) - Last retry time
- `completed_at` (TIMESTAMPTZ) - Success timestamp
- `error_message` (TEXT) - Failure reason

**Indexes:**
- `webhook_delivery_log_pkey` - Primary key
- `idx_webhook_delivery_log_org_id` - Organization webhooks
- `idx_webhook_delivery_log_status` - By status
- `idx_webhook_delivery_log_created_at` - Time-sorted

**RLS Policies:**
- Users view own org logs
- Service role unrestricted

**Retry Strategy:**
- Attempt 1: Immediate
- Attempt 2: +2 seconds (exponential backoff)
- Attempt 3: +4 seconds
- Dead letter: Permanent failure after 3 attempts

**Cleanup:**
- Logs older than 7 days auto-deleted
- Dead letters retained for 30 days (manual review)

---

### 19. processed_webhook_events

**Purpose:** Idempotency tracking for webhook processing
**Columns:**
- `id` (UUID, PRIMARY KEY) - Record ID
- `org_id` (UUID, FK → organizations.id) - Organization
- `vapi_event_id` (TEXT, UNIQUE) - Vapi webhook event ID
- `event_type` (TEXT) - Event type
- `processed_at` (TIMESTAMPTZ) - Processing timestamp
- `created_at` (TIMESTAMPTZ) - Creation timestamp

**Indexes:**
- `processed_webhook_events_pkey` - Primary key
- `idx_processed_webhook_events_vapi_event_id` - Dedup lookup
- `idx_processed_webhook_events_created_at` - Cleanup

**Idempotency Logic:**
```typescript
// Check if already processed
const existing = await supabase
  .from('processed_webhook_events')
  .select('id')
  .eq('vapi_event_id', event.id)
  .single();

if (existing) {
  // Already processed - skip
  return res.status(200).json({ message: 'Already processed' });
}

// Process webhook...

// Record as processed
await supabase.from('processed_webhook_events').insert({
  vapi_event_id: event.id,
  event_type: event.type,
  org_id: orgId
});
```

**Cleanup:**
- Entries older than 24 hours auto-deleted
- Prevents table bloat

---

### 20. stripe_webhook_events

**Purpose:** Stripe webhook event tracking (automated infrastructure)

**AUTOMATED: NO MANUAL CONFIGURATION NEEDED**

Stripe webhook endpoint registration is handled programmatically by `backend/src/scripts/setup-stripe-webhooks.ts`:
- Runs automatically on server startup
- Detects environment (development/staging/production)
- Automatically creates/updates webhook endpoint
- Stores signing secret in `.env` (one-time setup)
- Validates webhook signatures on receipt

**Environment-Based Configuration:**
```typescript
// File: backend/src/config/stripe-webhook-config.ts
// Automatically detects environment and sets webhook URL:

Development (NODE_ENV=development):
  → Uses ngrok tunnel: https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/stripe
  → Allows local webhook testing without manual Stripe Dashboard

Staging (NODE_ENV=staging):
  → Uses staging domain: https://staging-api.voxanne.ai/api/webhooks/stripe

Production (NODE_ENV=production):
  → Uses production domain: https://api.voxanne.ai/api/webhooks/stripe
```

**No Manual Steps Required:**
- ❌ Do NOT manually configure webhook endpoints in Stripe Dashboard
- ✅ Backend automatically registers on startup
- ✅ Secret automatically stored and validated
- ✅ Works across all environments

**Webhook Events Supported:**
- `checkout.session.completed` - Wallet top-up successful
- `payment_intent.succeeded` - Payment captured
- `customer.created` - New Stripe customer

**For Local Development:**
- ngrok tunnel must be running: `ngrok http 3001`
- Update `NGROK_TUNNEL_URL` in `.env` if ngrok URL changes
- Backend will auto-register webhook on startup

---

### 21. backup_verification_log

**Purpose:** Daily automated backup integrity checks
**Columns:**
- `id` (UUID, PRIMARY KEY) - Check ID
- `verified_at` (TIMESTAMPTZ) - Check timestamp
- `backup_id` (TEXT) - Backup identifier
- `backup_age_hours` (INTEGER) - Hours since backup
- `backup_size_mb` (INTEGER) - Backup size
- `status` (TEXT, CHECK: 'success'|'warning'|'failure') - Overall status
- `checks_passed` (INTEGER) - Passed checks count
- `checks_failed` (INTEGER) - Failed checks count
- `error_details` (JSONB) - Error information
- `verification_details` (JSONB) - All check results
- `created_at` (TIMESTAMPTZ)

**Indexes:**
- `backup_verification_log_pkey` - Primary key
- `idx_backup_verification_log_verified_at` - Recent checks
- `idx_backup_verification_log_status` - By status

**Checks Performed:**
1. Database connectivity
2. Critical tables exist
3. Row counts reasonable
4. Database functions exist
5. RLS policies active
6. Database size healthy

**Cleanup:**
- Entries older than 90 days auto-deleted

---

## Helper Functions

### RPC Functions

**1. book_appointment_with_lock**
```sql
book_appointment_with_lock(
  p_org_id UUID,
  p_contact_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INTEGER
) → JSONB
```
**Purpose:** Atomic appointment booking with Postgres advisory locks
**Returns:** `{ success: true, appointment_id: UUID }` or `{ success: false, error: TEXT }`
**Security:** SECURITY DEFINER, RLS enforced
**Race Condition Prevention:** Advisory locks prevent concurrent double-bookings

**2. add_wallet_credits**
```sql
add_wallet_credits(
  p_org_id UUID,
  p_amount_pence INTEGER,
  p_type TEXT,
  p_stripe_payment_intent_id TEXT = NULL,
  p_stripe_charge_id TEXT = NULL,
  p_description TEXT = NULL,
  p_created_by TEXT = 'system'
) → JSONB
```
**Purpose:** Atomic wallet credit transactions
**Returns:** `{ success: true, balance_after: INTEGER, transaction_id: UUID }`
**Features:**
- Negative amounts deduct (converted to debits)
- Positive amounts credit
- Atomic update with transaction logging
- Debt limit enforcement

**3. lookup_contact**
```sql
lookup_contact(p_org_id UUID, p_phone TEXT)
→ TABLE(id UUID, name TEXT, email TEXT, phone TEXT)
```
**Purpose:** Find or create contact from phone number
**Returns:** Contact record (creates if missing)

**4. get_appointment_availability**
```sql
get_appointment_availability(
  p_org_id UUID,
  p_date DATE
) → TABLE(time_slot TEXT, available BOOLEAN)
```
**Purpose:** List available time slots for a date
**Returns:** Array of time slots with availability

---

## Critical Invariants

**These rules prevent 95%+ of production failures. Never violate them.**

### Invariant 1: org_id Isolation
- **Rule:** Every query MUST filter by `org_id = req.user.orgId`
- **Enforcement:** RLS policies at database level
- **Violation:** Cross-org data leakage, data theft
- **Files:** All API route files

### Invariant 2: JWT Validation
- **Rule:** Extract org_id from `app_metadata.org_id` ONLY
- **Never:** Use query parameters, headers, or fallback org IDs
- **Function:** `verifyJWTAndExtractOrgId(token)` in `backend/src/middleware/auth.ts`
- **Violation:** Wrong org used, credential decryption fails, 500 errors

### Invariant 3: Wallet Balance Enforcement
- **Rule:** Check balance BEFORE deducting, deduct ATOMICALLY
- **Locations:**
  - Phone provisioning: `backend/src/routes/managed-telephony.ts` line 99-152
  - Call authorization: `backend/src/routes/vapi-webhook.ts` line 956-999
  - SMS sending: `backend/src/routes/messaging.ts`
- **Violation:** Free operations for unpaying users, revenue leak

### Invariant 4: Advisory Locks for Bookings
- **Rule:** All appointment bookings use `book_appointment_with_lock()` RPC
- **Never:** Use application-level locking or hope for the best
- **Why:** Postgres advisory locks prevent race conditions
- **Violation:** Double-bookings at same time slot

### Invariant 5: Webhook Idempotency
- **Rule:** Check `processed_webhook_events` before processing
- **Never:** Process same webhook twice
- **Retry Logic:** BullMQ with exponential backoff
- **Violation:** Duplicate transactions, refunds, call records

### Invariant 6: vapi_phone_number_id Format
- **Rule:** Phone number ID must be UUID (e.g., `abc-123-uuid`)
- **Never:** Pass E.164 numbers (e.g., `+12125551234`)
- **Validation:** `assertOutboundCallReady()` in `VapiClient.createOutboundCall()`
- **Violation:** Vapi API rejects call with 400 error

### Invariant 7: Credential Encryption
- **Rule:** Always encrypt sensitive data (Twilio tokens, Google tokens)
- **Never:** Store plaintext credentials in database
- **Algorithm:** AES-256-GCM with unique salt per credential
- **Key:** Environment variable `ENCRYPTION_KEY` (must match on all servers)
- **Violation:** Data breach, credential theft

### Invariant 8: Immutable Transaction Log
- **Rule:** Never UPDATE or DELETE from `credit_transactions`
- **Only:** INSERT new transactions
- **Why:** Audit trail integrity for compliance
- **Violation:** Non-repudiation failures, audit violations

### Invariant 9: Managed Phone Number Dual-Write & Complete Deletion
- **Provisioning Rule:** Phone numbers MUST be written to BOTH tables:
  - `managed_phone_numbers` (operational tracking)
  - `org_credentials` with `is_managed=true` (SSOT for UI discovery)
- **Deletion Rule:** Phone numbers MUST be cleaned from BOTH tables:
  - `managed_phone_numbers`: Set `status='released'` (soft delete)
  - `org_credentials`: DELETE record (hard delete)
  - `agents`: Set `vapi_phone_number_id=NULL` (unlink)
- **Why:** Agent dropdown queries `org_credentials`. If phone exists in one table but not the other, UI displays stale data (SSOT violation)
- **Implementation:** See "Managed Phone Number Lifecycle" section 9 (6-step deletion flow)
- **Violation:** Deleted phone still appears in agent dropdown, deleted phone can't be provisioned again (SID conflict)

---

## Disaster Recovery

### Backup Schedule
- **Frequency:** Daily at 2 AM UTC
- **Retention:** 30 days
- **Method:** Supabase automated backups
- **Recovery:** Point-in-time restore available

### Verification
- **Daily:** Automated checks at 5 AM UTC via `verify-backups.ts`
- **Monthly:** Manual recovery test (last Friday of month)
- **RTO:** <1 hour (Recovery Time Objective)
- **RPO:** <24 hours (Recovery Point Objective)

### Critical Table Priorities
If restore needed, restore in this order:
1. `organizations` (multi-tenant context)
2. `profiles` (users)
3. `agents` (AI configuration)
4. `calls` (call history)
5. `appointments` (customer commitments)
6. `credit_transactions` (billing audit trail)
7. `org_credentials` (integration tokens)
8. `knowledge_base_chunks` (RAG embeddings)

---

## Compliance

### HIPAA Compliance
- **PHI Data:** Call transcripts, patient notes in appointments
- **Encryption:** AES-256-GCM for credentials and sensitive fields
- **Access Control:** RLS policies + JWT validation
- **Audit:** Immutable logs in `auth_audit_log` and `webhook_delivery_log`
- **Retention:** 90 days for audit logs, 30 days for call recordings
- **BAA:** Required with Supabase for production healthcare use

### GDPR Compliance
- **User Data Retention:** 30 days after account closure
- **Data Deletion:** Automatic via `cleanup_old_auth_audit_logs()` job
- **Explicit Consent:** Required before call recording
- **Export Rights:** All user data exportable via admin dashboard

### SOC 2 Compliance
- **Access Logging:** `auth_audit_log` tracks all authentication events
- **Session Management:** `auth_sessions` enforces 7-day expiry
- **MFA Available:** TOTP-based multi-factor authentication
- **Incident Response:** Documented procedures in `DISASTER_RECOVERY_PLAN.md`

---

## Performance Tuning

### Query Optimization Tips
```sql
-- BAD: Full table scan
SELECT * FROM calls WHERE status = 'completed';

-- GOOD: Uses index
SELECT * FROM calls
WHERE org_id = 'xxx'
  AND status = 'completed'
  AND created_at > NOW() - INTERVAL '7 days';

-- BEST: Partial index
CREATE INDEX idx_calls_org_completed
ON calls(org_id, created_at DESC)
WHERE status = 'completed';
```

### Caching Strategy
- Agent configs: 5-minute TTL (denormalize in memory)
- Contact lists: 30-second TTL (changes frequently)
- Knowledge base embeddings: 1-hour TTL (vectors don't change)
- Org credentials: Never cache (security risk)

### Connection Pooling
- Supabase built-in: 20 connections per region
- Monitor: `SELECT count(*) FROM pg_stat_activity` weekly
- Alert: If > 80% capacity (16+ connections)

---

## Monitoring Queries

### Health Check Dashboard
```sql
-- Organizations with low wallet balance
SELECT id, name, wallet_balance_pence
FROM organizations
WHERE wallet_balance_pence < 50000
ORDER BY wallet_balance_pence ASC;

-- Recent calls (last 24 hours)
SELECT count(*) as call_count, AVG(duration_seconds) as avg_duration
FROM calls
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Webhook delivery success rate
SELECT status, count(*) as count
FROM webhook_delivery_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Active sessions
SELECT count(*) FROM auth_sessions WHERE expires_at > NOW();
```

---

## Implementation References

### Database & Schema
- **SSOT.md** (this file) - Database schema and architecture
- **DATABASE_SCHEMA_COMPLETE.md** - Detailed schema documentation
- **Critical Invariants** - Non-negotiable database rules (Section 13)

### Phone Number Management
- **Managed Telephony Service:** `backend/src/services/managed-telephony-service.ts`
  - Phone provisioning (dual-write strategy)
  - Phone deletion (6-step cleanup flow)
  - Agent unlinking
- **Phone Number Resolver:** `backend/src/services/phone-number-resolver.ts`
  - UUID resolution from phone credentials
- **Managed Telephony Routes:** `backend/src/routes/managed-telephony.ts`
  - API endpoints for phone operations

### Stripe & Billing
- **Stripe Webhook Config:** `backend/src/config/stripe-webhook-config.ts`
  - Environment-based webhook URL detection
  - No manual configuration required
- **Stripe Webhook Setup:** `backend/src/scripts/setup-stripe-webhooks.ts`
  - Automatic registration on startup
  - One-time webhook secret storage
- **Stripe Webhook Manager:** `backend/src/services/stripe-webhook-manager.ts`
  - Signature validation
  - Event processing and routing
- **Billing Documentation:** `STRIPE_WEBHOOK_IMPLEMENTATION_COMPLETE.md`

### Compliance & Operations
- **PRD:** `prd.md` - Product requirements
- **CLAUDE.md:** `.claude/CLAUDE.md` - Development guidelines
- **Disaster Recovery:** `DISASTER_RECOVERY_PLAN.md`
- **Runbook:** `RUNBOOK.md` - Operational procedures
- **Phone Deletion Fix:** `PHONE_DELETION_FIX_PHASE1_COMPLETE.md`

### Critical: Read These First
⚠️ **For Developers New to This Codebase:**
1. Read **SSOT.md** (this file) - Architecture and invariants
2. Read **Critical Invariants** section (especially #6 and #9)
3. Read **Managed Phone Number Lifecycle** section
4. Never modify phone deletion without reading this documentation

---

**Last Updated:** 2026-02-12 17:45 UTC
**Version:** 1.1.0 (Updated with phone deletion SSOT fix & Stripe webhook automation)
**Status:** ✅ **PRODUCTION SCHEMA - SINGLE SOURCE OF TRUTH**

**Recent Updates (2026-02-12):**
- ✅ Documented complete 6-step phone deletion flow (with org_credentials cleanup)
- ✅ Added Managed Phone Number Lifecycle section
- ✅ Added Invariant 9: Phone number dual-write and deletion
- ✅ Added Stripe webhook automation section (no manual configuration)
- ✅ Clarified org_credentials as SSOT for credential discovery
- ✅ Removed confusing/conflicting documentation

*This document is the authoritative reference for Voxanne AI's database schema. All architecture decisions, migration scripts, and data access patterns flow from these specifications. No contradictions, no confusion, no ambiguity.*

