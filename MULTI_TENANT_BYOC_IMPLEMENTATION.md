# Multi-Tenant BYOC (Bring Your Own Credentials) Implementation Plan

**Status:** Phase 1 Planning
**Created:** 2026-01-10
**Owner:** AI Receptionist MVP Team

---

## Problem Statement

Current Phase 1 implementation uses hardcoded API credentials at the backend:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `.env`
- `GOOGLE_CALENDAR_API_KEY` in `.env`

**Problems:**
1. ❌ Single-tenant only (one clinic = one key)
2. ❌ Violates multi-tenant architecture (org_id isolation doesn't apply to credentials)
3. ❌ Not production-ready (credentials exposed in environment)
4. ❌ Clinics can't use their own Twilio/Google accounts
5. ❌ Security risk: Shared credentials across organizations

**Solution:** Implement BYOC where each organization manages their own API credentials securely.

---

## Implementation Strategy

**Phase 0 (Proof of Concept):** Use Temi's test credentials to validate integration works
**Phase 1 (Foundation):** Create database schema for credential storage
**Phase 2 (Backend Refactor):** Update services to fetch credentials from database
**Phase 3 (Frontend UI):** Add credential management dashboard

---

## Phase 0: Temi Test Integration (Validate SMS Works)

**Goal:** Prove Twilio SMS integration is working end-to-end with Temi's account before BYOC refactor.

### Step 0.1: Set Up Temi's Twilio Credentials
- Get Twilio credentials from Temi (if available)
- OR use test credentials in `.env.example`
- Document which credentials are being used

### Step 0.2: Test SMS Delivery
- Call endpoint: `POST /api/sms/test`
- Send hot lead alert SMS to test phone number
- Verify SMS arrives within 5 seconds
- Check error handling for invalid phones, account issues

### Step 0.3: Document Test Results
- Create `TWILIO_SMS_TEST_RESULTS.md`
- Document successful SMS scenarios
- Document error scenarios and error messages
- Validate lead scoring triggers SMS correctly

**Acceptance Criteria:**
- ✅ SMS sends successfully with Temi credentials
- ✅ All error scenarios handled gracefully
- ✅ Twilio integration pattern verified
- ✅ Ready to refactor to BYOC

---

## Phase 1: Database Schema for Credentials (BYOC Foundation)

**Goal:** Create secure storage for per-organization API credentials with encryption.

### Step 1.1: Create `organization_api_credentials` Table

```sql
CREATE TABLE organization_api_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Credential Type (twilio, google_calendar, etc)
  credential_type VARCHAR(50) NOT NULL,

  -- Encrypted credential data (JSON)
  encrypted_data BYTEA NOT NULL,
  encryption_key_version INT DEFAULT 1,

  -- Metadata
  display_name VARCHAR(255), -- "My Twilio Account" or "Work Google Calendar"
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP,
  verification_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, failed
  verification_error TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(org_id, credential_type, display_name),
  CHECK (credential_type IN ('twilio', 'google_calendar', 'stripe', 'hubspot'))
);

-- RLS: Organization members can only view/edit their org's credentials
ALTER TABLE organization_api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_credentials_select ON organization_api_credentials
  FOR SELECT USING (org_id = public.auth_org_id());

CREATE POLICY org_credentials_insert ON organization_api_credentials
  FOR INSERT WITH CHECK (
    org_id = public.auth_org_id() AND
    (SELECT role FROM organization_members WHERE user_id = auth.uid() AND org_id = org_id) IN ('owner', 'admin')
  );

CREATE POLICY org_credentials_update ON organization_api_credentials
  FOR UPDATE USING (
    org_id = public.auth_org_id() AND
    (SELECT role FROM organization_members WHERE user_id = auth.uid() AND org_id = org_id) IN ('owner', 'admin')
  );

CREATE POLICY org_credentials_delete ON organization_api_credentials
  FOR DELETE USING (
    org_id = public.auth_org_id() AND
    (SELECT role FROM organization_members WHERE user_id = auth.uid() AND org_id = org_id) = 'owner'
  );

-- Immutability trigger for org_id
CREATE TRIGGER prevent_org_id_change_credentials
BEFORE UPDATE ON organization_api_credentials
FOR EACH ROW
EXECUTE FUNCTION check_org_id_immutability();
```

### Step 1.2: Create Credential Encryption/Decryption Service

**File:** `/backend/src/services/credential-encryption.ts`

```typescript
import crypto from 'crypto';

interface EncryptedCredential {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Encrypt sensitive credential data
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptCredential(data: Record<string, string>): EncryptedCredential {
  const key = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ]);

  return {
    encryptedData: encrypted,
    iv,
    authTag: cipher.getAuthTag()
  };
}

/**
 * Decrypt credential data
 */
export function decryptCredential(
  encryptedData: Buffer,
  iv: Buffer,
  authTag: Buffer
): Record<string, string> {
  const key = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY!, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
```

### Step 1.3: Create Credential Manager Service

**File:** `/backend/src/services/credential-manager.ts`

```typescript
import { supabase } from './supabase-client';
import { encryptCredential, decryptCredential } from './credential-encryption';

export async function storeCredential(
  orgId: string,
  type: 'twilio' | 'google_calendar',
  data: Record<string, string>,
  displayName: string
) {
  const encrypted = encryptCredential(data);

  const { data: result, error } = await supabase
    .from('organization_api_credentials')
    .insert({
      org_id: orgId,
      credential_type: type,
      encrypted_data: encrypted.encryptedData,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      display_name: displayName,
      verification_status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getCredential(
  orgId: string,
  type: 'twilio' | 'google_calendar'
): Promise<Record<string, string> | null> {
  const { data, error } = await supabase
    .from('organization_api_credentials')
    .select('encrypted_data, iv, auth_tag, is_active, verification_status')
    .eq('org_id', orgId)
    .eq('credential_type', type)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  if (data.verification_status !== 'verified') {
    console.warn(`Credential for ${type} not verified for org ${orgId}`);
    return null;
  }

  return decryptCredential(data.encrypted_data, data.iv, data.auth_tag);
}

export async function verifyCredential(
  credentialId: string,
  orgId: string,
  type: 'twilio' | 'google_calendar'
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('organization_api_credentials')
      .select('encrypted_data, iv, auth_tag')
      .eq('id', credentialId)
      .eq('org_id', orgId)
      .single();

    if (!data) return false;

    const credentials = decryptCredential(data.encrypted_data, data.iv, data.auth_tag);

    // Type-specific verification
    if (type === 'twilio') {
      return await verifyTwilioCredential(credentials);
    } else if (type === 'google_calendar') {
      return await verifyGoogleCalendarCredential(credentials);
    }

    return false;
  } catch (error) {
    console.error(`Credential verification failed: ${error}`);
    return false;
  }
}

async function verifyTwilioCredential(creds: Record<string, string>): Promise<boolean> {
  try {
    const twilio = require('twilio')(creds.accountSid, creds.authToken);
    const account = await twilio.api.accounts(creds.accountSid).fetch();
    return account.status === 'active';
  } catch {
    return false;
  }
}

async function verifyGoogleCalendarCredential(creds: Record<string, string>): Promise<boolean> {
  try {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      creds.redirectUrl
    );
    oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.calendarList.list();
    return true;
  } catch {
    return false;
  }
}
```

**Acceptance Criteria:**
- ✅ Table created with RLS policies
- ✅ Encryption/decryption working
- ✅ Credential storage/retrieval working
- ✅ Verification logic working for both Twilio and Google Calendar

---

## Phase 2: Backend Service Refactor (Use DB Credentials)

### Step 2.1: Refactor `sms-notifications.ts`

**Current:** Uses hardcoded `process.env.TWILIO_*`
**New:** Fetch from `organization_api_credentials` table

```typescript
import { credentialManager } from './credential-manager';
import twilio from 'twilio';

export async function sendHotLeadSMS(orgId: string, phone: string, leadName: string) {
  // Get org's Twilio credentials
  const credentials = await credentialManager.getCredential(orgId, 'twilio');

  if (!credentials) {
    throw new Error(`Twilio not configured for organization ${orgId}`);
  }

  const client = twilio(credentials.accountSid, credentials.authToken);

  return await client.messages.create({
    from: credentials.phoneNumber,
    to: phone,
    body: `🔥 Hot Lead! ${leadName} just expressed high interest in booking.`
  });
}
```

### Step 2.2: Refactor `calendar-integration.ts`

**Current:** Uses hardcoded `process.env.GOOGLE_CALENDAR_API_KEY`
**New:** Fetch from `organization_api_credentials` table

```typescript
import { credentialManager } from './credential-manager';
import { google } from 'googleapis';

export async function checkCalendarAvailability(
  orgId: string,
  date: string,
  duration: number
) {
  const credentials = await credentialManager.getCredential(orgId, 'google_calendar');

  if (!credentials) {
    throw new Error(`Google Calendar not configured for organization ${orgId}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUrl
  );

  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Check availability...
}
```

**Acceptance Criteria:**
- ✅ SMS service uses DB credentials
- ✅ Calendar service uses DB credentials
- ✅ Graceful error handling if credentials not found
- ✅ Fallback to test credentials for backward compatibility (during transition)

---

## Phase 3: API Endpoints for Credential Management

### Step 3.1: Create `/api/organization/credentials` Routes

```typescript
// GET /api/organization/credentials
// List all credentials for current org
export async function listCredentials(req, res) {
  const orgId = req.auth.org_id;
  const { data, error } = await supabase
    .from('organization_api_credentials')
    .select('id, credential_type, display_name, is_active, verification_status, last_verified_at')
    .eq('org_id', orgId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// POST /api/organization/credentials/twilio
// Store Twilio credentials
export async function addTwilioCredential(req, res) {
  const orgId = req.auth.org_id;
  const { accountSid, authToken, phoneNumber, displayName } = req.body;

  const credential = await credentialManager.storeCredential(
    orgId,
    'twilio',
    { accountSid, authToken, phoneNumber },
    displayName
  );

  res.json(credential);
}

// POST /api/organization/credentials/:id/verify
// Verify credential validity
export async function verifyCredential(req, res) {
  const { id } = req.params;
  const orgId = req.auth.org_id;

  const isValid = await credentialManager.verifyCredential(id, orgId, req.body.type);

  const { error } = await supabase
    .from('organization_api_credentials')
    .update({
      verification_status: isValid ? 'verified' : 'failed',
      last_verified_at: new Date().toISOString()
    })
    .eq('id', id);

  res.json({ verified: isValid });
}

// DELETE /api/organization/credentials/:id
// Deactivate credential
export async function deleteCredential(req, res) {
  const { id } = req.params;
  const orgId = req.auth.org_id;

  const { error } = await supabase
    .from('organization_api_credentials')
    .update({ is_active: false })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}
```

**Acceptance Criteria:**
- ✅ All CRUD endpoints working
- ✅ Verification endpoint validates credentials
- ✅ RLS prevents cross-org access
- ✅ Audit trail maintained (created_by, created_at)

---

## Phase 4: Frontend Dashboard (Credential Management UI)

### Step 4.1: Create `/src/app/dashboard/settings/page.tsx`

**Features:**
- List current API credentials
- Add new Twilio account
- Add new Google Calendar
- Test/verify button for each
- Revoke/remove credentials
- Status indicators (✅ verified, ⚠️ needs verification, ❌ failed)

### Step 4.2: Implement OAuth Flow for Google Calendar

**Frontend:**
- "Connect Google Calendar" button
- OAuth popup opens
- User grants permissions
- Credentials stored in database

**Backend:**
- `/api/auth/google/callback` endpoint
- Exchange auth code for refresh token
- Store encrypted refresh token in credentials table

**Acceptance Criteria:**
- ✅ Settings page displays current credentials
- ✅ Add Twilio form validates input
- ✅ Add Google Calendar uses OAuth flow
- ✅ Verify button tests credentials
- ✅ Revoke button deactivates credentials safely

---

## Testing Strategy

### Unit Tests
- [ ] `credential-encryption.ts` - encrypt/decrypt roundtrip
- [ ] `credential-manager.ts` - store/retrieve/verify logic
- [ ] Twilio verification with mock account
- [ ] Google Calendar verification with mock token

### Integration Tests
- [ ] SMS delivery uses org credentials (not global)
- [ ] Calendar availability check uses org credentials
- [ ] Cross-org isolation (org A can't access org B's credentials)
- [ ] Credential expiration/deactivation handled

### Manual Verification
- [ ] Add Temi's Twilio credentials via dashboard
- [ ] Send test SMS (verify it uses org credentials)
- [ ] Connect Google Calendar account
- [ ] Book appointment (verify it checks org calendar)
- [ ] Revoke credentials (verify SMS/calendar fail gracefully)

---

## Rollout Plan

**Week 1:**
- [ ] Phase 0: Validate SMS with Temi credentials
- [ ] Phase 1: Create database schema
- [ ] Phase 2: Refactor backend services

**Week 2:**
- [ ] Phase 3: Create credential API endpoints
- [ ] Phase 4: Build frontend settings UI
- [ ] Testing and validation

**Production Rollout:**
- [ ] Migrate existing Temi instance to use BYOC
- [ ] Provide documentation for clinics to add own credentials
- [ ] Monitor for errors/issues in production
- [ ] Deprecate hardcoded environment credentials

---

## Success Criteria

✅ **Phase 0:** SMS works with Temi test account
✅ **Phase 1:** Database schema secure and RLS protected
✅ **Phase 2:** Backend services fetch from DB
✅ **Phase 3:** API endpoints working with proper auth
✅ **Phase 4:** Frontend UI for credential management
✅ **Testing:** All integration tests passing
✅ **Security:** Credentials encrypted, RLS enforced, audit trail logged

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Credential loss/corruption | 🔴 High | Encrypted in DB, backups, rotation policy |
| API quota exceeded | 🟡 Medium | Rate limiting, quota monitoring, alerts |
| OAuth token expiration | 🟡 Medium | Automatic refresh token rotation |
| Cross-org credential leak | 🔴 High | RLS policies, audit logging |
| Performance (decrypt every call) | 🟡 Medium | Credential caching with TTL |

---

## Notes

- **Backward Compatibility:** During Phase 0-2, keep fallback to env vars for Temi's test account
- **Encryption Key:** `CREDENTIAL_ENCRYPTION_KEY` must be 32 bytes (256-bit) hex string
- **Rotation:** Implement credential rotation strategy (not in Phase 1)
- **Audit:** Log all credential access and modifications for compliance
