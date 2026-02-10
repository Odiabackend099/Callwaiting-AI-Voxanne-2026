# AI Forwarding Feature - Technical Architecture Design

**Date:** February 10, 2026
**Status:** Design Phase
**Author:** Technical Architecture Team
**Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema Design](#database-schema-design)
4. [API Endpoint Specifications](#api-endpoint-specifications)
5. [Twilio Integration Architecture](#twilio-integration-architecture)
6. [Security & Validation](#security--validation)
7. [Error Handling & Resilience](#error-handling--resilience)
8. [Integration Points](#integration-points)
9. [Sequence Diagrams](#sequence-diagrams)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Plan](#deployment-plan)

---

## Executive Summary

**Feature:** AI Forwarding (formerly "Hybrid Telephony")
**Purpose:** Enable users to forward their existing business phone number to a Voxanne AI-managed number, allowing the AI assistant to handle incoming calls without changing the customer-facing phone number.

**Key Requirements:**
- Support both BYOC (Bring Your Own Carrier) and managed Twilio credentials
- SMS verification of phone ownership
- Real-time call forwarding to AI assistant
- Dashboard integration for setup and management
- GDPR/HIPAA compliant phone number storage

**Architecture Approach:**
- Extend existing managed telephony infrastructure
- Reuse `IntegrationDecryptor` for credential management
- Follow the same security patterns as managed phone numbers
- Leverage existing Vapi integration for call routing

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   User's Existing Phone                       │
│                  (Customer-Facing Number)                     │
│                    +1-555-123-4567                            │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ (Call forwarding configured)
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              Voxanne Managed Phone Number                     │
│                (Provisioned via Twilio)                       │
│                    +1-555-987-6543                            │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ (Twilio webhook)
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  Voxanne Backend API                          │
│         /api/webhooks/twilio/forwarding-call                  │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ (Identify org by forwarding number)
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                      Vapi Platform                            │
│            AI Assistant handles the call                      │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Frontend (React)** | Phone number input, verification UI, status display |
| **Backend API** | Verification SMS, webhook handling, credential management |
| **Database** | Store forwarding configurations, verification attempts |
| **Twilio** | SMS verification, call forwarding (TwiML), phone number management |
| **Vapi** | AI assistant call handling |

---

## Database Schema Design

### 1. New Table: `forwarding_numbers`

Stores user-provided phone numbers that forward to managed numbers.

```sql
-- ============================================
-- Forwarding Numbers Table
-- Tracks customer phone numbers that forward to AI
-- ============================================

CREATE TABLE IF NOT EXISTS forwarding_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- The customer's existing phone number (verified)
  customer_phone_number TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',

  -- The Voxanne-managed number this forwards to
  managed_number_id UUID NOT NULL REFERENCES managed_phone_numbers(id) ON DELETE CASCADE,
  voxanne_phone_number TEXT NOT NULL,

  -- Verification tracking
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed', 'expired')),
  verification_code TEXT,
  verification_code_created_at TIMESTAMPTZ,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  max_verification_attempts INTEGER NOT NULL DEFAULT 5,
  verified_at TIMESTAMPTZ,

  -- Forwarding configuration
  forwarding_enabled BOOLEAN DEFAULT false,
  forwarding_instructions TEXT, -- User-provided instructions (e.g., "Call my cell if emergency")

  -- Call routing
  ai_assistant_id TEXT, -- Vapi assistant ID to route calls to
  fallback_phone_number TEXT, -- Optional: forward to human if AI can't handle

  -- Analytics
  total_calls_received INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,

  -- Billing (if charging extra for forwarding)
  forwarding_fee_cents INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Verification code expiry (5 minutes)

  -- Constraints
  CONSTRAINT unique_customer_phone_per_org UNIQUE (org_id, customer_phone_number),
  CONSTRAINT one_forwarding_per_org UNIQUE (org_id) -- Initially limit to 1 number per org
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forwarding_numbers_org
  ON forwarding_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_forwarding_numbers_managed
  ON forwarding_numbers(managed_number_id);
CREATE INDEX IF NOT EXISTS idx_forwarding_numbers_status
  ON forwarding_numbers(verification_status) WHERE verification_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_forwarding_numbers_customer_phone
  ON forwarding_numbers(customer_phone_number);
CREATE INDEX IF NOT EXISTS idx_forwarding_numbers_enabled
  ON forwarding_numbers(org_id, forwarding_enabled) WHERE forwarding_enabled = true;

-- Row Level Security
ALTER TABLE forwarding_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own forwarding numbers"
  ON forwarding_numbers FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "Service role full access on forwarding_numbers"
  ON forwarding_numbers FOR ALL TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE forwarding_numbers IS
  'Customer phone numbers that forward to Voxanne-managed numbers for AI handling. Requires SMS verification.';
COMMENT ON COLUMN forwarding_numbers.verification_code IS
  'Hashed 6-digit verification code (bcrypt). Expires in 5 minutes.';
COMMENT ON COLUMN forwarding_numbers.fallback_phone_number IS
  'Optional: Route to human if AI assistant cannot handle the call (e.g., escalation).';
```

### 2. Extend Existing Table: `managed_phone_numbers`

Add columns to track if a managed number is used for forwarding.

```sql
-- ============================================
-- Extend managed_phone_numbers for Forwarding
-- ============================================

ALTER TABLE managed_phone_numbers
  ADD COLUMN IF NOT EXISTS is_forwarding_target BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_managed_numbers_forwarding
  ON managed_phone_numbers(org_id, is_forwarding_target)
  WHERE is_forwarding_target = true;

COMMENT ON COLUMN managed_phone_numbers.is_forwarding_target IS
  'True if this number receives forwarded calls from customer phone numbers.';
```

### 3. New Table: `forwarding_verification_attempts`

Audit log for verification attempts (security & debugging).

```sql
-- ============================================
-- Forwarding Verification Attempts Log
-- Tracks all SMS verification attempts
-- ============================================

CREATE TABLE IF NOT EXISTS forwarding_verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarding_number_id UUID NOT NULL REFERENCES forwarding_numbers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Attempt details
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('send_sms', 'verify_code')),
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Security tracking
  ip_address INET,
  user_agent TEXT,

  -- Code validation details (for verify_code attempts)
  submitted_code TEXT, -- Not hashed (audit only, not stored long-term)
  code_matches BOOLEAN,

  -- Timestamps
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Auto-cleanup after 90 days (GDPR compliance)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_attempts_forwarding
  ON forwarding_verification_attempts(forwarding_number_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_org
  ON forwarding_verification_attempts(org_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_created
  ON forwarding_verification_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_cleanup
  ON forwarding_verification_attempts(expires_at) WHERE expires_at < NOW();

-- Row Level Security
ALTER TABLE forwarding_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own verification attempts"
  ON forwarding_verification_attempts FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "Service role full access on verification_attempts"
  ON forwarding_verification_attempts FOR ALL TO service_role
  USING (true);

-- Auto-cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_verification_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM forwarding_verification_attempts
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_verification_attempts IS
  'Delete verification attempts older than 90 days (GDPR compliance). Run daily via cron.';
```

---

## API Endpoint Specifications

### Base Route: `/api/forwarding`

All endpoints require authentication (`requireAuthOrDev`) and feature flag (`managed_telephony`).

---

### 1. **POST /api/forwarding/verify-number**

Initiate phone number verification by sending SMS code.

**Request:**
```typescript
{
  customerPhoneNumber: string;  // E.164 format: +15551234567
  country: string;               // ISO country code: 'US', 'GB', etc.
}
```

**Response (Success - 200):**
```typescript
{
  success: true;
  message: "Verification code sent via SMS";
  forwardingNumberId: string;    // UUID for tracking
  expiresAt: string;             // ISO timestamp (5 minutes from now)
  attemptsRemaining: number;     // e.g., 5
}
```

**Response (Error - 400):**
```typescript
{
  error: string;
  code: 'INVALID_PHONE' | 'ALREADY_VERIFIED' | 'NO_MANAGED_NUMBER' | 'RATE_LIMIT_EXCEEDED';
  details?: any;
}
```

**Error Scenarios:**
- `INVALID_PHONE`: Phone number format invalid for country
- `ALREADY_VERIFIED`: This number is already verified
- `NO_MANAGED_NUMBER`: Org doesn't have a managed number yet (must provision one first)
- `RATE_LIMIT_EXCEEDED`: Too many SMS requests (5 per hour per org)

**Rate Limiting:**
- 5 SMS sends per hour per organization
- 10 SMS sends per hour per IP address

**Implementation Logic:**
```typescript
1. Validate phone number format (per country)
2. Check if org has a managed number (required for forwarding)
3. Check rate limits (org + IP)
4. Check if number already verified
5. Generate 6-digit code (crypto-random)
6. Hash code with bcrypt
7. Store in `forwarding_numbers` table with 5-minute expiry
8. Send SMS via Twilio (using BYOC or managed credentials)
9. Log attempt in `forwarding_verification_attempts`
10. Return success response
```

---

### 2. **POST /api/forwarding/confirm-verification**

Verify the SMS code submitted by the user.

**Request:**
```typescript
{
  forwardingNumberId: string;  // UUID from previous step
  verificationCode: string;    // 6-digit code from SMS
}
```

**Response (Success - 200):**
```typescript
{
  success: true;
  message: "Phone number verified successfully";
  forwardingNumber: {
    id: string;
    customerPhoneNumber: string;
    voxannePhoneNumber: string;
    verifiedAt: string;
    forwardingEnabled: boolean;
  };
}
```

**Response (Error - 400):**
```typescript
{
  error: string;
  code: 'INVALID_CODE' | 'EXPIRED_CODE' | 'MAX_ATTEMPTS_EXCEEDED' | 'NOT_FOUND';
  attemptsRemaining?: number;
}
```

**Error Scenarios:**
- `INVALID_CODE`: Code doesn't match
- `EXPIRED_CODE`: Code was issued >5 minutes ago
- `MAX_ATTEMPTS_EXCEEDED`: 5 failed attempts
- `NOT_FOUND`: Forwarding number ID not found

**Rate Limiting:**
- 5 verification attempts per forwarding number (hard limit)
- 10 verification attempts per hour per IP address

**Implementation Logic:**
```typescript
1. Fetch forwarding_number record by ID
2. Check if already verified
3. Check if code expired (created_at + 5 minutes < now)
4. Check attempt count < max_attempts (5)
5. Hash submitted code with bcrypt
6. Compare with stored hash
7. If match:
   - Set verification_status = 'verified'
   - Set verified_at = NOW()
   - Set forwarding_enabled = true
   - Configure Twilio number for forwarding (TwiML webhook)
8. If no match:
   - Increment verification_attempts
   - Log failed attempt
   - Return error
9. Log attempt in verification_attempts table
```

---

### 3. **GET /api/forwarding/config**

Retrieve current forwarding configuration for the organization.

**Request:**
```
GET /api/forwarding/config
Headers: { Authorization: Bearer <jwt> }
```

**Response (Success - 200):**
```typescript
{
  hasForwarding: boolean;
  config?: {
    id: string;
    customerPhoneNumber: string;
    voxannePhoneNumber: string;
    verificationStatus: 'pending' | 'verified' | 'failed' | 'expired';
    forwardingEnabled: boolean;
    aiAssistantId: string;
    fallbackPhoneNumber?: string;
    totalCallsReceived: number;
    lastCallAt?: string;
    createdAt: string;
    verifiedAt?: string;
  };
}
```

**Response (No Forwarding - 200):**
```typescript
{
  hasForwarding: false;
}
```

**Implementation Logic:**
```typescript
1. Query forwarding_numbers table by org_id
2. Join with managed_phone_numbers to get Voxanne number
3. Return config or null
```

---

### 4. **DELETE /api/forwarding/config**

Remove forwarding configuration (stops forwarding, keeps record for audit).

**Request:**
```
DELETE /api/forwarding/config
Headers: { Authorization: Bearer <jwt> }
```

**Response (Success - 200):**
```typescript
{
  success: true;
  message: "Call forwarding disabled";
}
```

**Response (Error - 404):**
```typescript
{
  error: "No forwarding configuration found";
}
```

**Implementation Logic:**
```typescript
1. Fetch forwarding_numbers record
2. Set forwarding_enabled = false
3. Remove Twilio webhook (set to null)
4. Keep record for audit trail
5. Return success
```

---

### 5. **POST /api/forwarding/update-instructions**

Update forwarding instructions (optional user-provided notes).

**Request:**
```typescript
{
  instructions: string;           // Max 500 chars
  fallbackPhoneNumber?: string;   // Optional
}
```

**Response (Success - 200):**
```typescript
{
  success: true;
  message: "Forwarding instructions updated";
}
```

**Implementation Logic:**
```typescript
1. Validate instructions length <= 500
2. Validate fallback phone number format (if provided)
3. Update forwarding_numbers table
4. Return success
```

---

## Twilio Integration Architecture

### Credential Resolution Strategy

The system must support both BYOC and managed Twilio credentials.

**Priority Order for Credential Selection:**

```typescript
async function resolveCredentialsForSMS(orgId: string): Promise<TwilioCredentials> {
  // 1. Try managed credentials first (if org has managed mode)
  const { data: org } = await supabase
    .from('organizations')
    .select('telephony_mode')
    .eq('id', orgId)
    .single();

  if (org?.telephony_mode === 'managed') {
    // Get managed subaccount credentials
    const { data: subaccount } = await supabase
      .from('twilio_subaccounts')
      .select('twilio_account_sid, twilio_auth_token_encrypted')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    if (subaccount) {
      const authToken = EncryptionService.decrypt(subaccount.twilio_auth_token_encrypted);

      // Get managed phone number for "from" field
      const { data: managedNumber } = await supabase
        .from('managed_phone_numbers')
        .select('phone_number')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .single();

      return {
        accountSid: subaccount.twilio_account_sid,
        authToken,
        phoneNumber: managedNumber.phone_number
      };
    }
  }

  // 2. Fallback to BYOC credentials
  const byocCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
  return byocCreds;
}
```

---

### TwiML Configuration for Forwarding

When a call is forwarded to the Voxanne-managed number, Twilio sends a webhook. The backend must route the call to the correct AI assistant.

**Twilio Webhook URL Structure:**
```
https://api.voxanne.ai/api/webhooks/twilio/forwarding-call
```

**TwiML Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Route to Vapi assistant -->
  <Dial>
    <Sip>sip:assistant_id@vapi.ai</Sip>
  </Dial>

  <!-- Fallback if Vapi unavailable -->
  <Say voice="alice">
    We're experiencing technical difficulties. Please try again later.
  </Say>
</Response>
```

**Webhook Handler Logic:**
```typescript
// POST /api/webhooks/twilio/forwarding-call
async function handleForwardingCall(req: Request, res: Response) {
  const { To, From, CallSid } = req.body; // Twilio webhook payload

  // 1. Identify which org this call belongs to
  const { data: forwarding } = await supabase
    .from('forwarding_numbers')
    .select('org_id, ai_assistant_id, fallback_phone_number')
    .eq('voxanne_phone_number', To)
    .eq('forwarding_enabled', true)
    .single();

  if (!forwarding) {
    // No forwarding config found - reject call
    return res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>This number is not currently accepting calls.</Say>
        <Hangup/>
      </Response>
    `);
  }

  // 2. Get Vapi assistant for this org
  const { data: agent } = await supabase
    .from('agents')
    .select('vapi_assistant_id')
    .eq('org_id', forwarding.org_id)
    .single();

  if (!agent?.vapi_assistant_id) {
    // No AI assistant configured - fallback
    if (forwarding.fallback_phone_number) {
      return res.send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Dial>${forwarding.fallback_phone_number}</Dial>
        </Response>
      `);
    }

    return res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>AI assistant is not configured.</Say>
        <Hangup/>
      </Response>
    `);
  }

  // 3. Create Vapi inbound call via API
  const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);
  const vapiCall = await vapiClient.createInboundCall({
    assistantId: agent.vapi_assistant_id,
    phoneNumberId: forwarding.voxanne_phone_number, // The managed number
    customer: {
      number: From // Original caller
    },
    metadata: {
      orgId: forwarding.org_id,
      forwardedFrom: From,
      callSid: CallSid
    }
  });

  // 4. Update analytics
  await supabase
    .from('forwarding_numbers')
    .update({
      total_calls_received: supabase.sql`total_calls_received + 1`,
      last_call_at: new Date().toISOString()
    })
    .eq('id', forwarding.id);

  // 5. Return TwiML to connect to Vapi
  return res.send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Dial>
        <Sip>${vapiCall.sipUri}</Sip>
      </Dial>
    </Response>
  `);
}
```

---

### Webhook Security

**Validate Twilio Webhook Signatures:**

```typescript
import twilio from 'twilio';

function validateTwilioWebhook(req: Request): boolean {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  // Get Twilio auth token (from managed or BYOC credentials)
  const authToken = getTwilioAuthToken(req.body.AccountSid);

  return twilio.validateRequest(authToken, signature, url, req.body);
}

// Apply to webhook endpoint
router.post('/webhooks/twilio/forwarding-call', (req, res, next) => {
  if (!validateTwilioWebhook(req)) {
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }
  next();
}, handleForwardingCall);
```

---

## Security & Validation

### 1. Phone Number Validation

**Per-Country Validation Rules:**

```typescript
interface CountryPhoneRules {
  regex: RegExp;
  length: number;
  exampleFormat: string;
}

const PHONE_VALIDATION_RULES: Record<string, CountryPhoneRules> = {
  US: {
    regex: /^\+1[2-9]\d{9}$/,
    length: 12,
    exampleFormat: '+15551234567'
  },
  GB: {
    regex: /^\+44[1-9]\d{9,10}$/,
    length: 13,
    exampleFormat: '+441234567890'
  },
  CA: {
    regex: /^\+1[2-9]\d{9}$/,
    length: 12,
    exampleFormat: '+15141234567'
  },
  AU: {
    regex: /^\+61[2-478]\d{8}$/,
    length: 12,
    exampleFormat: '+61212345678'
  }
};

function validatePhoneNumber(phone: string, country: string): {
  valid: boolean;
  error?: string;
} {
  const rules = PHONE_VALIDATION_RULES[country];
  if (!rules) {
    return { valid: false, error: `Country ${country} not supported` };
  }

  if (!rules.regex.test(phone)) {
    return {
      valid: false,
      error: `Invalid phone format for ${country}. Expected: ${rules.exampleFormat}`
    };
  }

  return { valid: true };
}
```

---

### 2. Rate Limiting

**Multi-Layered Rate Limiting:**

```typescript
// Rate limiter configuration
const rateLimiters = {
  smsPerOrg: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyGenerator: (req) => `sms:org:${req.user.orgId}`,
    message: 'Too many SMS verification requests. Please try again in 1 hour.'
  }),

  smsPerIp: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many SMS requests from this IP address.'
  }),

  verifyPerNumber: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Hard limit enforced in DB as well
    keyGenerator: (req) => `verify:number:${req.body.forwardingNumberId}`,
    message: 'Too many verification attempts for this number.'
  })
};

// Apply to endpoints
router.post('/verify-number',
  rateLimiters.smsPerOrg,
  rateLimiters.smsPerIp,
  verifyNumberHandler
);

router.post('/confirm-verification',
  rateLimiters.verifyPerNumber,
  confirmVerificationHandler
);
```

---

### 3. Verification Code Security

**Bcrypt Hashing:**

```typescript
import bcrypt from 'bcrypt';
import crypto from 'crypto';

function generateVerificationCode(): string {
  // Generate cryptographically secure 6-digit code
  return crypto.randomInt(100000, 999999).toString();
}

async function hashVerificationCode(code: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(code, saltRounds);
}

async function verifyCode(submitted: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(submitted, hashed);
}
```

**Code Expiry:**
- Codes expire after 5 minutes
- Database constraint: `created_at + INTERVAL '5 minutes' > NOW()`
- Frontend displays countdown timer

---

### 4. Prevent Infinite Forwarding Loops

**Detection Logic:**

```typescript
async function detectForwardingLoop(
  customerPhone: string,
  voxannePhone: string
): Promise<{ hasLoop: boolean; reason?: string }> {
  // Check 1: Customer phone cannot be a Voxanne-managed number
  const { data: managedNumber } = await supabase
    .from('managed_phone_numbers')
    .select('id')
    .eq('phone_number', customerPhone)
    .maybeSingle();

  if (managedNumber) {
    return {
      hasLoop: true,
      reason: 'Cannot forward a Voxanne-managed number to itself'
    };
  }

  // Check 2: Customer phone cannot already be forwarding somewhere else
  const { data: existingForwarding } = await supabase
    .from('forwarding_numbers')
    .select('id')
    .eq('customer_phone_number', customerPhone)
    .eq('forwarding_enabled', true)
    .maybeSingle();

  if (existingForwarding) {
    return {
      hasLoop: true,
      reason: 'This number is already configured for forwarding'
    };
  }

  return { hasLoop: false };
}
```

---

### 5. GDPR Compliance

**Data Retention Policies:**

```typescript
// Auto-delete verification attempts after 90 days
CREATE OR REPLACE FUNCTION cleanup_expired_verification_data()
RETURNS void AS $$
BEGIN
  -- Delete old verification attempts
  DELETE FROM forwarding_verification_attempts
  WHERE expires_at < NOW();

  -- Delete failed/expired forwarding configs after 90 days
  DELETE FROM forwarding_numbers
  WHERE verification_status IN ('failed', 'expired')
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via cron (daily at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-forwarding-verification',
  '0 3 * * *',
  'SELECT cleanup_expired_verification_data()'
);
```

**User Data Deletion:**

When a user deletes their account:
```typescript
1. forwarding_numbers: Cascades via ON DELETE CASCADE
2. forwarding_verification_attempts: Cascades via ON DELETE CASCADE
3. Twilio number: Release from subaccount (via ManagedTelephonyService)
```

---

## Error Handling & Resilience

### 1. Circuit Breaker for External APIs

**Use Existing `safeCall` Pattern:**

```typescript
import { safeCall } from '../services/safe-call';

async function sendVerificationSMS(
  phone: string,
  code: string,
  credentials: TwilioCredentials
): Promise<{ success: boolean; error?: string }> {
  const result = await safeCall(
    'twilio_sms_forwarding',
    async () => {
      const client = twilio(credentials.accountSid, credentials.authToken);
      return client.messages.create({
        to: phone,
        from: credentials.phoneNumber,
        body: `Your Voxanne AI verification code is: ${code}\n\nThis code expires in 5 minutes.`
      });
    },
    {
      retries: 3,
      backoffMs: 1000,
      timeoutMs: 10000
    }
  );

  if (!result.success) {
    if (result.circuitOpen) {
      return {
        success: false,
        error: 'SMS service temporarily unavailable. Please try again in a few minutes.'
      };
    }

    return {
      success: false,
      error: result.userMessage || 'Failed to send verification SMS'
    };
  }

  return { success: true };
}
```

---

### 2. Graceful Degradation

**If Twilio is Down:**
- Show error message: "SMS verification temporarily unavailable"
- Suggest manual setup via phone call to support
- Queue verification request for retry when service recovers

**If Vapi is Down:**
- Forward calls to fallback phone number (if configured)
- Play error message: "AI assistant unavailable, please try again later"

---

### 3. Database Transaction Safety

**Atomic Operations:**

```typescript
async function createForwardingWithVerification(
  orgId: string,
  customerPhone: string,
  country: string
): Promise<ForwardingNumber> {
  // Use Postgres transaction
  const { data, error } = await supabase.rpc('create_forwarding_number_atomic', {
    p_org_id: orgId,
    p_customer_phone: customerPhone,
    p_country: country
  });

  if (error) {
    throw new Error(`Failed to create forwarding: ${error.message}`);
  }

  return data;
}
```

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION create_forwarding_number_atomic(
  p_org_id UUID,
  p_customer_phone TEXT,
  p_country TEXT
) RETURNS JSONB AS $$
DECLARE
  v_managed_number_id UUID;
  v_voxanne_phone TEXT;
  v_forwarding_id UUID;
BEGIN
  -- 1. Get managed number for this org (must exist)
  SELECT id, phone_number INTO v_managed_number_id, v_voxanne_phone
  FROM managed_phone_numbers
  WHERE org_id = p_org_id
    AND status = 'active'
  LIMIT 1;

  IF v_managed_number_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No managed phone number found for this organization'
    );
  END IF;

  -- 2. Insert forwarding record
  INSERT INTO forwarding_numbers (
    org_id,
    customer_phone_number,
    country_code,
    managed_number_id,
    voxanne_phone_number,
    verification_status
  ) VALUES (
    p_org_id,
    p_customer_phone,
    p_country,
    v_managed_number_id,
    v_voxanne_phone,
    'pending'
  )
  RETURNING id INTO v_forwarding_id;

  -- 3. Mark managed number as forwarding target
  UPDATE managed_phone_numbers
  SET is_forwarding_target = true
  WHERE id = v_managed_number_id;

  RETURN jsonb_build_object(
    'success', true,
    'forwardingNumberId', v_forwarding_id,
    'voxannePhoneNumber', v_voxanne_phone
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Integration Points

### 1. Integration with Existing Agent Configuration

**Dashboard Flow:**

```
User Setup Journey:
1. User navigates to /dashboard/telephony
2. If no managed number: Show "Buy Number" flow (existing)
3. If has managed number: Show "AI Forwarding" tab
4. User enters customer phone number
5. System sends SMS verification
6. User enters code
7. System configures Twilio forwarding
8. Dashboard shows "Active" status
```

**Link to AI Assistant:**

```typescript
// When forwarding is verified, link to agent
async function linkForwardingToAgent(
  forwardingNumberId: string,
  orgId: string
): Promise<void> {
  // Get org's AI assistant
  const { data: agent } = await supabase
    .from('agents')
    .select('vapi_assistant_id')
    .eq('org_id', orgId)
    .single();

  if (!agent?.vapi_assistant_id) {
    throw new Error('No AI assistant configured for this organization');
  }

  // Update forwarding config
  await supabase
    .from('forwarding_numbers')
    .update({ ai_assistant_id: agent.vapi_assistant_id })
    .eq('id', forwardingNumberId);
}
```

---

### 2. Integration with Call Tracking

**Update Calls Dashboard:**

```typescript
// When a forwarded call comes in, log it with special metadata
async function logForwardedCall(
  orgId: string,
  callSid: string,
  from: string,
  forwardedTo: string
): Promise<void> {
  await supabase
    .from('calls')
    .insert({
      org_id: orgId,
      call_id: callSid,
      phone_number: from,
      call_direction: 'inbound',
      call_type: 'forwarded', // New type
      metadata: {
        forwardedFrom: from,
        forwardedTo: forwardedTo,
        isForwarding: true
      }
    });
}
```

**Dashboard Metrics:**
- Total forwarded calls
- Forwarding success rate
- Average call duration for forwarded calls
- Top forwarding sources (which customer numbers call most)

---

### 3. Integration with Billing

**Forwarding Fee Structure:**

```typescript
// Charge extra $5/month for forwarding feature
const FORWARDING_FEE_CENTS = 500; // $5.00

// When forwarding is enabled
async function enableForwardingBilling(orgId: string): Promise<void> {
  await supabase
    .from('organizations')
    .update({
      monthly_forwarding_fee_cents: FORWARDING_FEE_CENTS
    })
    .eq('id', orgId);

  // Create line item in billing system
  await createBillingLineItem({
    orgId,
    itemType: 'forwarding',
    description: 'AI Call Forwarding',
    amountCents: FORWARDING_FEE_CENTS,
    recurring: true
  });
}
```

---

## Sequence Diagrams

### Verification Flow

```
┌─────┐        ┌─────────┐        ┌─────────┐        ┌────────┐
│User │        │Frontend │        │Backend  │        │Twilio  │
└──┬──┘        └────┬────┘        └────┬────┘        └───┬────┘
   │                │                  │                  │
   │ Enter phone #  │                  │                  │
   ├───────────────>│                  │                  │
   │                │                  │                  │
   │                │ POST /verify-number                 │
   │                ├─────────────────>│                  │
   │                │                  │                  │
   │                │                  │ Validate phone   │
   │                │                  │ Generate code    │
   │                │                  │ Hash + store     │
   │                │                  │                  │
   │                │                  │ Send SMS         │
   │                │                  ├─────────────────>│
   │                │                  │                  │
   │                │                  │ SMS sent         │
   │                │                  │<─────────────────┤
   │                │                  │                  │
   │                │ { forwardingNumberId, expiresAt }  │
   │                │<─────────────────┤                  │
   │                │                  │                  │
   │ Show code input│                  │                  │
   │<───────────────┤                  │                  │
   │                │                  │                  │
   │  Enter code    │                  │                  │
   ├───────────────>│                  │                  │
   │                │                  │                  │
   │                │ POST /confirm-verification          │
   │                ├─────────────────>│                  │
   │                │                  │                  │
   │                │                  │ Verify code      │
   │                │                  │ Update status    │
   │                │                  │ Enable forwarding│
   │                │                  │                  │
   │                │ { success: true }│                  │
   │                │<─────────────────┤                  │
   │                │                  │                  │
   │ Show success   │                  │                  │
   │<───────────────┤                  │                  │
   │                │                  │                  │
```

---

### Forwarding Call Flow

```
┌──────┐    ┌────────────┐    ┌─────────┐    ┌────────┐    ┌──────┐
│Caller│    │Customer #  │    │Voxanne #│    │Backend │    │ Vapi │
└──┬───┘    └─────┬──────┘    └────┬────┘    └───┬────┘    └──┬───┘
   │              │                 │             │            │
   │ Dial         │                 │             │            │
   ├─────────────>│                 │             │            │
   │              │                 │             │            │
   │              │ Forward call    │             │            │
   │              ├────────────────>│             │            │
   │              │                 │             │            │
   │              │                 │ Webhook     │            │
   │              │                 ├────────────>│            │
   │              │                 │             │            │
   │              │                 │             │ Identify org│
   │              │                 │             │ Get assistant│
   │              │                 │             │            │
   │              │                 │             │ Create call│
   │              │                 │             ├───────────>│
   │              │                 │             │            │
   │              │                 │             │ SIP URI    │
   │              │                 │             │<───────────┤
   │              │                 │             │            │
   │              │                 │ TwiML (Dial SIP)         │
   │              │                 │<────────────┤            │
   │              │                 │             │            │
   │              │                 │ Connect to Vapi          │
   │              │                 ├─────────────────────────>│
   │              │                 │             │            │
   │ Talk to AI   │                 │             │            │
   │<─────────────┼─────────────────┼─────────────┼───────────>│
   │              │                 │             │            │
```

---

## Testing Strategy

### Unit Tests

**Test Coverage Requirements: >80%**

```typescript
// tests/unit/forwarding-validation.test.ts
describe('Phone Number Validation', () => {
  test('should accept valid US phone number', () => {
    const result = validatePhoneNumber('+15551234567', 'US');
    expect(result.valid).toBe(true);
  });

  test('should reject invalid US phone number', () => {
    const result = validatePhoneNumber('+1234567890', 'US');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid phone format');
  });

  test('should reject non-E.164 format', () => {
    const result = validatePhoneNumber('(555) 123-4567', 'US');
    expect(result.valid).toBe(false);
  });
});

describe('Verification Code Generation', () => {
  test('should generate 6-digit code', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  test('should hash code with bcrypt', async () => {
    const code = '123456';
    const hashed = await hashVerificationCode(code);
    expect(hashed).not.toBe(code);
    expect(hashed).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  test('should verify correct code', async () => {
    const code = '123456';
    const hashed = await hashVerificationCode(code);
    const isValid = await verifyCode('123456', hashed);
    expect(isValid).toBe(true);
  });

  test('should reject incorrect code', async () => {
    const code = '123456';
    const hashed = await hashVerificationCode(code);
    const isValid = await verifyCode('654321', hashed);
    expect(isValid).toBe(false);
  });
});
```

---

### Integration Tests

```typescript
// tests/integration/forwarding-flow.test.ts
describe('Forwarding Verification Flow', () => {
  let testOrgId: string;
  let testPhoneNumber: string;

  beforeAll(async () => {
    // Setup test org with managed number
    testOrgId = await createTestOrg();
    await provisionTestManagedNumber(testOrgId);
    testPhoneNumber = '+15551234567';
  });

  test('should send verification SMS', async () => {
    const response = await request(app)
      .post('/api/forwarding/verify-number')
      .set('Authorization', `Bearer ${testJWT}`)
      .send({
        customerPhoneNumber: testPhoneNumber,
        country: 'US'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.forwardingNumberId).toBeDefined();
  });

  test('should verify correct code', async () => {
    // Send verification
    const sendResponse = await request(app)
      .post('/api/forwarding/verify-number')
      .set('Authorization', `Bearer ${testJWT}`)
      .send({
        customerPhoneNumber: testPhoneNumber,
        country: 'US'
      });

    const forwardingNumberId = sendResponse.body.forwardingNumberId;

    // Get code from database (test environment only)
    const { data } = await supabase
      .from('forwarding_numbers')
      .select('verification_code')
      .eq('id', forwardingNumberId)
      .single();

    // Verify code
    const verifyResponse = await request(app)
      .post('/api/forwarding/confirm-verification')
      .set('Authorization', `Bearer ${testJWT}`)
      .send({
        forwardingNumberId,
        verificationCode: data.verification_code // In test env, code is not hashed
      });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
  });

  test('should reject expired code', async () => {
    // Create forwarding with expired code
    const forwardingId = await createExpiredForwarding(testOrgId, testPhoneNumber);

    const response = await request(app)
      .post('/api/forwarding/confirm-verification')
      .set('Authorization', `Bearer ${testJWT}`)
      .send({
        forwardingNumberId: forwardingId,
        verificationCode: '123456'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EXPIRED_CODE');
  });

  test('should enforce max attempts limit', async () => {
    const forwardingId = await createForwarding(testOrgId, testPhoneNumber);

    // Attempt 5 times with wrong code
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/forwarding/confirm-verification')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({
          forwardingNumberId: forwardingId,
          verificationCode: '000000'
        });
    }

    // 6th attempt should fail
    const response = await request(app)
      .post('/api/forwarding/confirm-verification')
      .set('Authorization', `Bearer ${testJWT}`)
      .send({
        forwardingNumberId: forwardingId,
        verificationCode: '123456'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('MAX_ATTEMPTS_EXCEEDED');
  });
});
```

---

### End-to-End Tests

```typescript
// tests/e2e/forwarding-call-routing.test.ts
describe('Forwarding Call Routing', () => {
  test('should route forwarded call to AI assistant', async () => {
    // Setup
    const orgId = await createTestOrg();
    await provisionManagedNumber(orgId);
    await setupVerifiedForwarding(orgId, '+15551234567');

    // Simulate Twilio webhook
    const response = await request(app)
      .post('/api/webhooks/twilio/forwarding-call')
      .send({
        To: '+15559876543', // Voxanne managed number
        From: '+15551234567', // Customer's number (forwarding source)
        CallSid: 'CA1234567890abcdef',
        AccountSid: 'AC...'
      });

    // Verify TwiML response
    expect(response.status).toBe(200);
    expect(response.text).toContain('<Dial>');
    expect(response.text).toContain('<Sip>');

    // Verify call was logged
    const { data: call } = await supabase
      .from('calls')
      .select('*')
      .eq('call_id', 'CA1234567890abcdef')
      .single();

    expect(call).toBeDefined();
    expect(call.call_type).toBe('forwarded');
  });
});
```

---

### Load Tests

```typescript
// tests/load/sms-verification.test.ts
import autocannon from 'autocannon';

describe('SMS Verification Load Test', () => {
  test('should handle 100 concurrent verification requests', async () => {
    const result = await autocannon({
      url: 'http://localhost:3000/api/forwarding/verify-number',
      connections: 100,
      duration: 10,
      headers: {
        'Authorization': `Bearer ${testJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerPhoneNumber: '+15551234567',
        country: 'US'
      })
    });

    // Verify rate limiter works
    expect(result.non2xx).toBeGreaterThan(0); // Some requests should be rate limited
    expect(result.errors).toBe(0); // No server errors
  });
});
```

---

## Deployment Plan

### Phase 1: Database Migration (Week 1)

**Tasks:**
1. Create migration file: `20260210_ai_forwarding_schema.sql`
2. Run migration in staging environment
3. Verify tables, indexes, and RLS policies
4. Test rollback procedure
5. Run migration in production (off-peak hours)

**Rollback Plan:**
```sql
-- Rollback migration
DROP TABLE IF EXISTS forwarding_verification_attempts CASCADE;
DROP TABLE IF EXISTS forwarding_numbers CASCADE;
ALTER TABLE managed_phone_numbers DROP COLUMN IF EXISTS is_forwarding_target;
```

---

### Phase 2: Backend API Development (Week 2)

**Tasks:**
1. Implement verification endpoints
2. Add Twilio webhook handler
3. Integrate with existing services
4. Write unit tests (>80% coverage)
5. Deploy to staging

**Code Review Checklist:**
- [ ] All endpoints have rate limiting
- [ ] Bcrypt hashing for verification codes
- [ ] Circuit breaker for external APIs
- [ ] Webhook signature validation
- [ ] GDPR compliance (data retention)
- [ ] Error messages don't leak sensitive data

---

### Phase 3: Frontend Integration (Week 3)

**Tasks:**
1. Create AI Forwarding tab in dashboard
2. Implement verification UI
3. Add status indicators
4. Show analytics (calls received, etc.)
5. Deploy to staging

**UI Components:**
- `ForwardingSetup.tsx` - Main setup wizard
- `PhoneVerification.tsx` - SMS code input
- `ForwardingStatus.tsx` - Active/inactive indicator
- `ForwardingAnalytics.tsx` - Call metrics

---

### Phase 4: Testing & QA (Week 4)

**Test Plan:**
1. Unit tests (backend + frontend)
2. Integration tests (API endpoints)
3. E2E tests (full flow)
4. Load tests (100+ concurrent users)
5. Security audit (OWASP checklist)
6. Accessibility audit (WCAG 2.1 AA)

**QA Sign-off Criteria:**
- [ ] All tests passing (>80% coverage)
- [ ] No P0/P1 bugs
- [ ] Performance: SMS sent in <3 seconds
- [ ] Performance: Webhook response in <500ms
- [ ] Security: No SQL injection vulnerabilities
- [ ] Security: Rate limiting effective

---

### Phase 5: Production Deployment (Week 5)

**Pre-Deployment:**
1. Feature flag rollout plan (10% → 50% → 100%)
2. Monitoring dashboards (Grafana + Sentry)
3. On-call rotation schedule
4. Runbook documentation

**Deployment Steps:**
1. Deploy backend (blue-green deployment)
2. Run smoke tests
3. Enable feature flag for 10% of orgs
4. Monitor error rates for 24 hours
5. Gradual rollout to 100%

**Monitoring Metrics:**
- SMS delivery success rate (>95%)
- Verification success rate (>70%)
- Webhook response time P95 (<500ms)
- Error rate (<1%)
- Circuit breaker trips (0 expected)

---

## Success Criteria

### Technical Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| SMS delivery time | <3 seconds | <10 seconds |
| Verification success rate | >70% | >50% |
| Webhook response time (P95) | <500ms | <1000ms |
| API error rate | <1% | <5% |
| Database query time (P95) | <100ms | <500ms |
| Test coverage | >80% | >60% |

### Business Metrics

| Metric | Target | Measurement Period |
|--------|--------|-------------------|
| Feature adoption rate | >30% | 30 days post-launch |
| User completion rate | >70% | (verified / started) |
| Support tickets | <10 | Per week |
| Churn due to forwarding issues | <1% | Monthly |

---

## Security Controls Checklist

- [x] Phone number format validation (per country)
- [x] Rate limiting (org + IP)
- [x] Bcrypt hashing for verification codes
- [x] 5-minute code expiry
- [x] Max 5 verification attempts
- [x] Twilio webhook signature validation
- [x] Circuit breaker for external APIs
- [x] GDPR-compliant data retention (90 days)
- [x] Row-level security (RLS) on all tables
- [x] Audit logging for verification attempts
- [x] Infinite loop prevention
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention (input sanitization)
- [x] CSRF protection (existing middleware)

---

## Appendix: API Error Codes

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `INVALID_PHONE` | 400 | Phone format invalid | Check phone number format |
| `ALREADY_VERIFIED` | 400 | Number already verified | Use existing config |
| `NO_MANAGED_NUMBER` | 400 | Org needs managed number | Provision managed number first |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and try again |
| `INVALID_CODE` | 400 | Verification code wrong | Check code and retry |
| `EXPIRED_CODE` | 400 | Code expired (>5 min) | Request new code |
| `MAX_ATTEMPTS_EXCEEDED` | 400 | 5 failed attempts | Request new code |
| `NOT_FOUND` | 404 | Forwarding config not found | Contact support |
| `TWILIO_ERROR` | 500 | Twilio API error | Try again later |
| `VAPI_ERROR` | 500 | Vapi API error | Contact support |
| `DATABASE_ERROR` | 500 | Database transaction failed | Contact support |

---

## Appendix: Database Size Estimates

**Assumptions:**
- 1,000 active organizations
- 50% adopt forwarding feature (500 orgs)
- Average 3 verification attempts per org
- 90-day retention for audit logs

**Storage Estimates:**

| Table | Rows | Row Size | Total Size |
|-------|------|----------|------------|
| `forwarding_numbers` | 500 | 1 KB | 500 KB |
| `forwarding_verification_attempts` | 1,500 | 500 bytes | 750 KB |
| **Total** | 2,000 | - | **1.25 MB** |

**Negligible impact on database size.**

---

## Appendix: Cost Analysis

**Twilio Costs per Organization:**

| Item | Cost | Frequency | Monthly Cost |
|------|------|-----------|--------------|
| Verification SMS | $0.0075 | 3 attempts/month | $0.02 |
| Inbound calls (avg) | $0.0085/min | 100 calls × 3 min | $2.55 |
| **Total per Org** | - | - | **$2.57** |

**Revenue Opportunity:**
- Charge $5/month for forwarding feature
- Gross margin: $2.43/org ($5 - $2.57)
- 500 orgs × $2.43 = **$1,215/month profit**

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Technical Architecture Team | Initial design document |

---

**END OF DOCUMENT**
