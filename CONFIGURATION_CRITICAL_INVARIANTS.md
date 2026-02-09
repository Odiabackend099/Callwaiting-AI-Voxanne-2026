# CONFIGURATION CRITICAL INVARIANTS

**Status:** 🔒 **IMMUTABLE** - These rules MUST NOT be broken by any AI or developer
**Last Updated:** February 9, 2026
**Purpose:** Single source of truth for backend configuration preventing production breakage

---

## ⚠️ CRITICAL WARNING

**This document defines 7 CRITICAL INVARIANTS that protect the Voxanne AI backend from configuration-related failures.**

Breaking any of these rules will cause:
- 🔴 Backend startup failures
- 🔴 Outbound calling pipeline breakage
- 🔴 Data loss (unreadable encrypted credentials)
- 🔴 Security vulnerabilities
- 🔴 Multi-tenant isolation breaches

**Before modifying ANY backend configuration, credential handling, or telephony code:**
1. Read this entire document
2. Reference the specific rule numbers in your PR
3. Get approval from Technical Architecture agent
4. Test with `npm run validate-env`

---

## Table of Contents

1. [Credential Hierarchy](#credential-hierarchy)
2. [The 7 Critical Invariants](#the-7-critical-invariants)
3. [ENCRYPTION_KEY Requirements](#encryption_key-requirements)
4. [Master Credentials Usage Rules](#master-credentials-usage-rules)
5. [Startup Validation Rules](#startup-validation-rules)
6. [Credential Storage Immutability](#credential-storage-immutability)
7. [Prevention Rules for AI/Developers](#prevention-rules-for-aidevelopers)

---

## Credential Hierarchy

Voxanne AI uses a **three-tier credential system** for multi-tenant security:

### Tier 1: Platform Secrets (in .env, immutable)

These credentials are **owned by the platform** and apply globally to all organizations:

| Credential | Purpose | Immutability |
|------------|---------|--------------|
| `ENCRYPTION_KEY` | Master key for decrypting all tenant credentials | ⚠️ **NEVER CHANGE** after data encrypted |
| `VAPI_PRIVATE_KEY` | Global Vapi account for all organizations | Changes require re-sync all assistants |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access with RLS bypass | Platform-wide auth |
| `SUPABASE_URL` | Database connection URL | Platform-wide DB |

**Storage:** `backend/.env` file (never in Git, never in code)
**Access:** Loaded once on backend startup via `backend/src/config/index.ts`
**Security:** Must be in .gitignore, never logged, never exposed in errors

### Tier 2: Tenant Secrets (in database, encrypted)

These credentials are **owned by individual organizations** (BYOC model):

| Credential | Storage | Encryption |
|------------|---------|----------|
| Twilio Account SID/Token | `org_credentials.encrypted_config` | AES-256-GCM |
| Google Calendar OAuth tokens | `org_credentials.encrypted_config` | AES-256-GCM |
| Vapi phone number mappings | `phone_number_mapping` table | None (UUIDs) |

**Storage:** `org_credentials` table in Supabase (JSONB `encrypted_config` field)
**Access:** Via `IntegrationDecryptor.getCredentials(orgId)` service
**Security:** Row-Level Security (RLS) enforced, 30-second cache with TTL

### Tier 3: Master Account Credentials (for managed telephony)

These credentials are **owned by the platform** for reselling Twilio service:

| Credential | Purpose | When Used |
|------------|---------|-----------|
| `TWILIO_MASTER_ACCOUNT_SID` | Master Twilio account owner | Creating subaccounts, purchasing numbers |
| `TWILIO_MASTER_AUTH_TOKEN` | Master account authentication | Subaccount creation, Vapi number imports |

**Storage:** `backend/.env` file (platform-level)
**Access:** Via `getMasterClient()` in `managed-telephony-service.ts`
**Security:** Used ONLY for managed telephony operations (see Rule 7)

---

## The 7 Critical Invariants

### Rule 1: Never remove `vapi_phone_number_id` from agent-sync writes

**Files Affected:**
- `backend/src/routes/agent-sync.ts` (update payload)
- `backend/src/routes/founder-console-v2.ts` (agent save payload)

**Why This Rule Exists:**
The `agents.vapi_phone_number_id` column is the **Single Source of Truth (SSOT)** for the Vapi phone number UUID used by outbound calls. If this field is removed from sync writes, the column stays NULL and outbound calls fail with "No phone number available."

**Correct Implementation:**
```typescript
// ✅ CORRECT - Always include vapi_phone_number_id
const agentPayload = {
  name: agentData.name,
  system_prompt: agentData.systemPrompt,
  voice_id: agentData.voiceId,
  vapi_assistant_id: assistantId,
  vapi_phone_number_id: phoneNumberId, // ✅ REQUIRED FOR OUTBOUND
  // ... other fields
};
```

**What NOT To Do:**
```typescript
// ❌ WRONG - Missing vapi_phone_number_id
const agentPayload = {
  name: agentData.name,
  vapi_assistant_id: assistantId,
  // Missing vapi_phone_number_id - outbound calls will FAIL
};
```

**Verification:**
```bash
# Check if column is synced in agent save
grep -n "vapi_phone_number_id" backend/src/routes/agent-sync.ts
grep -n "vapi_phone_number_id" backend/src/routes/founder-console-v2.ts
```

---

### Rule 2: Never change `.maybeSingle()` back to `.single()` on outbound agent queries

**File Affected:**
- `backend/src/routes/contacts.ts` (call-back endpoint agent query)

**Why This Rule Exists:**
Supabase's `.single()` method throws Postgres error PGRST116 when 0 rows match, causing a 500 error instead of a clear "Outbound agent not configured" message. `.maybeSingle()` returns null gracefully when no agent exists.

**Correct Implementation:**
```typescript
// ✅ CORRECT - Returns null gracefully when no agent
const { data: agent, error: agentError } = await supabase
  .from('agents')
  .select('*')
  .eq('org_id', orgId)
  .eq('call_direction', 'outbound')
  .maybeSingle(); // ✅ Returns null if 0 rows, no error thrown

if (!agent) {
  return res.status(400).json({
    error: 'Outbound agent not configured. Please configure in Agent settings.'
  });
}
```

**What NOT To Do:**
```typescript
// ❌ WRONG - Throws PGRST116 error when 0 rows
const { data: agent, error: agentError } = await supabase
  .from('agents')
  .select('*')
  .eq('org_id', orgId)
  .eq('call_direction', 'outbound')
  .single(); // ❌ Throws error if 0 rows - breaks graceful handling
```

**Verification:**
```bash
# Check if maybeSingle is used in contacts route
grep -n "maybeSingle" backend/src/routes/contacts.ts
```

---

### Rule 3: Never pass raw phone strings as Vapi `phoneNumberId`

**File Affected:**
- `backend/src/services/vapi-client.ts` (createOutboundCall method)
- All 8 call sites that invoke `vapiClient.createOutboundCall()`

**Why This Rule Exists:**
Vapi API expects a **UUID** (e.g., `abc123-def456`) for `phoneNumberId`, NOT an E.164 phone number (e.g., `+12125551234`). Passing a raw phone string causes "Invalid phone number ID" errors.

**Correct Implementation:**
```typescript
// ✅ CORRECT - Use resolveOrgPhoneNumberId to get UUID
const phoneNumberId = await resolveOrgPhoneNumberId(orgId);

if (!phoneNumberId) {
  throw new Error('No Vapi phone number available for organization');
}

await vapiClient.createOutboundCall({
  assistantId: agent.vapi_assistant_id,
  phoneNumberId: phoneNumberId, // ✅ UUID from resolver
  customer: { number: contactPhone }
});
```

**What NOT To Do:**
```typescript
// ❌ WRONG - Passing raw E.164 phone number
await vapiClient.createOutboundCall({
  assistantId: agent.vapi_assistant_id,
  phoneNumberId: '+12125551234', // ❌ Raw phone string - will FAIL
  customer: { number: contactPhone }
});
```

**Verification:**
```bash
# Pre-flight assertion in VapiClient catches this
# Error message: "phoneNumberId cannot be an E.164 phone number (starts with +)"
npm run dev # Will throw error on startup if violated
```

---

### Rule 4: Never remove phone number auto-resolution fallback

**File Affected:**
- `backend/src/routes/contacts.ts` (after agent query in call-back endpoint)

**Why This Rule Exists:**
If `agents.vapi_phone_number_id` is NULL (common after agent re-configuration), the endpoint auto-resolves via `resolveOrgPhoneNumberId()` and backfills the database. Removing this fallback breaks outbound calls for any org that hasn't re-saved their agent config.

**Correct Implementation:**
```typescript
// ✅ CORRECT - Auto-resolve and backfill if NULL
let phoneNumberId = agent.vapi_phone_number_id;

if (!phoneNumberId) {
  log('WARN', 'vapi_phone_number_id is NULL - auto-resolving');
  phoneNumberId = await resolveOrgPhoneNumberId(orgId);

  if (phoneNumberId) {
    // Backfill database for future calls
    await supabase
      .from('agents')
      .update({ vapi_phone_number_id: phoneNumberId })
      .eq('id', agent.id);
  }
}
```

**What NOT To Do:**
```typescript
// ❌ WRONG - No fallback resolution
const phoneNumberId = agent.vapi_phone_number_id; // ❌ Will be NULL for many orgs

await vapiClient.createOutboundCall({
  phoneNumberId: phoneNumberId, // ❌ NULL value - call FAILS
  // ...
});
```

**Verification:**
```bash
# Check if resolver is called in contacts route
grep -n "resolveOrgPhoneNumberId" backend/src/routes/contacts.ts
```

---

### Rule 5: Never remove pre-flight assertion in `createOutboundCall()`

**File Affected:**
- `backend/src/services/vapi-client.ts` (createOutboundCall method)

**Why This Rule Exists:**
The `assertOutboundCallReady()` call validates `assistantId`, `phoneNumberId` (UUID format), and `customer.number` before making the Vapi API call. This is the **single defense layer** protecting all 8 call sites across the codebase from invalid data.

**Correct Implementation:**
```typescript
// ✅ CORRECT - Pre-flight validation protects all callers
async createOutboundCall(request: OutboundCallRequest): Promise<Call> {
  // ✅ CRITICAL: Validate before API call
  assertOutboundCallReady(
    request.assistantId,
    request.phoneNumberId,
    request.customer.number
  );

  // Safe to call Vapi API - data validated
  const response = await this.makeRequest<Call>('POST', '/call', request);
  return response;
}
```

**What NOT To Do:**
```typescript
// ❌ WRONG - Removing validation
async createOutboundCall(request: OutboundCallRequest): Promise<Call> {
  // ❌ No validation - invalid data reaches Vapi API
  const response = await this.makeRequest<Call>('POST', '/call', request);
  return response; // ❌ Will fail with cryptic Vapi error
}
```

**Verification:**
```bash
# Check if assertion exists in VapiClient
grep -n "assertOutboundCallReady" backend/src/services/vapi-client.ts
```

---

### Rule 6: Never auto-recreate Vapi assistants in error handlers

**File Affected:**
- `backend/src/routes/contacts.ts` (catch block in call-back endpoint)

**Why This Rule Exists:**
Creating a new assistant inline **destroys the user's configured agent** (loses tools, knowledge base, system prompt, voice settings). On Vapi errors, return a clear error message telling the user to re-save in Agent Configuration.

**Correct Implementation:**
```typescript
// ✅ CORRECT - Tell user to fix via UI, don't auto-recreate
catch (error) {
  log('ERROR', 'Vapi outbound call failed', { error: error.message });

  return res.status(500).json({
    error: 'Failed to initiate call. Please verify your agent is configured correctly in Agent Settings.',
    details: error.message
  });
}
```

**What NOT To Do:**
```typescript
// ❌ WRONG - Auto-creating assistant destroys user's config
catch (error) {
  // ❌ NEVER DO THIS - creates fresh assistant, loses all customization
  const newAssistant = await vapiClient.createAssistant({
    name: 'Auto-created assistant', // ❌ Generic name
    // Missing: tools, knowledge base, custom voice, system prompt
  });

  // User's configuration is now GONE
}
```

**Verification:**
```bash
# Check that no createAssistant is called in error handlers
grep -n "createAssistant" backend/src/routes/contacts.ts # Should be 0 results
```

---

### Rule 7: Never use subaccount credentials for Vapi number import

**File Affected:**
- `backend/src/services/managed-telephony-service.ts` (provision number flow)

**Why This Rule Exists:**
When provisioning managed numbers:
1. Master account purchases the Twilio number (master owns it)
2. Subaccount is created for billing isolation
3. **Vapi import MUST use master credentials** (ownership must match)

If you use subaccount credentials for Vapi import, the import fails because the subaccount doesn't own the number.

**Correct Implementation:**
```typescript
// ✅ CORRECT - Use master credentials for Vapi import
export async function provisionManagedNumber(orgId: string, areaCode: string) {
  // Step 1: Purchase number with master account
  const masterClient = getMasterClient(); // ✅ Master Twilio client
  const number = await masterClient.incomingPhoneNumbers.create({
    areaCode: areaCode
  });

  // Step 2: Create subaccount for billing
  const subaccount = await masterClient.api.accounts.create({
    friendlyName: `Org ${orgId}`
  });

  // Step 3: Import to Vapi with MASTER credentials (Rule 7)
  const masterCreds = getMasterCredentials(); // ✅ Master credentials
  const vapiPhone = await vapiClient.importTwilioNumber({
    twilioPhoneNumber: number.phoneNumber,
    twilioAccountSid: masterCreds.accountSid, // ✅ MASTER SID (not subaccount)
    twilioAuthToken: masterCreds.authToken     // ✅ MASTER TOKEN (not subaccount)
  });

  return vapiPhone;
}
```

**What NOT To Do:**
```typescript
// ❌ WRONG - Using subaccount credentials for Vapi import
export async function provisionManagedNumber(orgId: string, areaCode: string) {
  const masterClient = getMasterClient();
  const number = await masterClient.incomingPhoneNumbers.create({ areaCode });

  const subaccount = await masterClient.api.accounts.create({
    friendlyName: `Org ${orgId}`
  });

  // ❌ WRONG - Vapi import with subaccount credentials
  const vapiPhone = await vapiClient.importTwilioNumber({
    twilioPhoneNumber: number.phoneNumber,
    twilioAccountSid: subaccount.sid,     // ❌ Subaccount doesn't own number
    twilioAuthToken: subaccount.authToken // ❌ Import FAILS
  });
}
```

**Verification:**
```bash
# Check that getMasterCredentials is used for Vapi imports
grep -A 10 "importTwilioNumber" backend/src/services/managed-telephony-service.ts
# Should see getMasterCredentials(), not subaccount credentials
```

---

## ENCRYPTION_KEY Requirements

### Immutability Rule

**⚠️ CRITICAL: ENCRYPTION_KEY must NEVER change after data is encrypted.**

**Why:**
- All tenant credentials are encrypted with `ENCRYPTION_KEY`
- Changing the key makes ALL encrypted data permanently unreadable
- No recovery possible - would require all customers to re-enter credentials
- Affects: Twilio credentials, Google Calendar tokens, all integrations

**Exception:**
Only change with a **migration plan**:
1. Decrypt all credentials with old key
2. Re-encrypt with new key
3. Update all encrypted records in database
4. Deploy atomically (no downtime)

### Format Requirements

**Valid Formats:**
1. **64 hexadecimal characters** (32 bytes = 256 bits):
   ```
   bbaf521ae57542c3d879a7ec3d45d6c7b58358e617754974c2c928094c12886b
   ```
2. **Plain text string** (will be SHA-256 hashed automatically):
   ```
   MySecretEncryptionPassphrase123!
   ```

**Generation:**
```bash
# Recommended: Generate 64-character hex key
openssl rand -hex 32

# Alternative: Use strong passphrase (will be hashed)
echo "VoxanneAI-SecureKey-2026" | sha256sum
```

**Validation:**
```typescript
// backend/src/config/index.ts validates on startup
const key = process.env.ENCRYPTION_KEY;
if (!key) throw new Error('ENCRYPTION_KEY missing');
if (key === 'your-256-bit-hex-key-here') {
  throw new Error('ENCRYPTION_KEY is placeholder - generate with: openssl rand -hex 32');
}
```

### Security Requirements

**NEVER:**
- Commit to Git (must be in .gitignore)
- Log in error messages (use `[REDACTED]`)
- Expose in API responses
- Share in Slack/email/docs
- Store in plaintext in database

**ALWAYS:**
- Store in environment variables only (`backend/.env`)
- Use secure secret management (GitHub Secrets, Render environment)
- Rotate with migration plan (decrypt → re-encrypt all)
- Backup old key during rotation (recovery mechanism)

**Access Control:**
- Only backend service has access
- Never sent to frontend
- Never in HTTP headers/cookies
- Used only by `EncryptionService.encrypt/decrypt`

---

## Master Credentials Usage Rules

### When to Use Master Credentials

**✅ ALLOWED - Managed Telephony Operations:**

1. **Creating Twilio subaccounts** for organizations:
   ```typescript
   const masterClient = getMasterClient();
   const subaccount = await masterClient.api.accounts.create({
     friendlyName: `Org ${orgId}`
   });
   ```

2. **Purchasing phone numbers** in master account inventory:
   ```typescript
   const masterClient = getMasterClient();
   const number = await masterClient.incomingPhoneNumbers.create({
     areaCode: '442', // UK London
     friendlyName: `Voxanne-Managed-${orgId}`
   });
   ```

3. **Importing phone numbers to Vapi** (Rule 7):
   ```typescript
   const masterCreds = getMasterCredentials();
   const vapiPhone = await vapiClient.importTwilioNumber({
     twilioPhoneNumber: number.phoneNumber,
     twilioAccountSid: masterCreds.accountSid, // ✅ MASTER (not subaccount)
     twilioAuthToken: masterCreds.authToken
   });
   ```

### When NOT to Use Master Credentials

**❌ FORBIDDEN - Tenant-Specific Operations:**

1. **Sending SMS on behalf of organization:**
   ```typescript
   // ❌ WRONG - Using master credentials for tenant SMS
   const masterClient = getMasterClient();
   await masterClient.messages.create({
     from: orgPhone, // ❌ Org's phone, but master creds
     to: customerPhone,
     body: 'Your appointment reminder'
   });

   // ✅ CORRECT - Use tenant credentials
   const tenantCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
   const tenantClient = getTwilioClient(tenantCreds);
   await tenantClient.messages.create({
     from: orgPhone,
     to: customerPhone,
     body: 'Your appointment reminder'
   });
   ```

2. **Making outbound calls for organization:**
   ```typescript
   // ❌ WRONG - All calls billed to master account
   const masterCreds = getMasterCredentials();
   await vapiClient.createOutboundCall({
     phoneNumberId: getPhoneNumberId(masterCreds) // ❌ Master number
   });

   // ✅ CORRECT - Use org's phone number
   const phoneNumberId = await resolveOrgPhoneNumberId(orgId);
   await vapiClient.createOutboundCall({
     phoneNumberId: phoneNumberId // ✅ Org-specific number
   });
   ```

3. **Accessing organization's call logs:**
   ```typescript
   // ❌ WRONG - Master account can't see subaccount logs
   const masterClient = getMasterClient();
   const calls = await masterClient.calls.list(); // ❌ Only master's calls

   // ✅ CORRECT - Use Vapi API or subaccount credentials
   const calls = await vapiClient.listCalls(assistantId);
   ```

### Correct Flow for Managed Number Provisioning

**Step-by-Step:**

```
1. Purchase number using getMasterClient() (master Twilio)
     ↓
   Twilio number created in master account

2. Create subaccount for billing isolation (master Twilio)
     ↓
   Subaccount SID + token stored encrypted in database

3. Import to Vapi using getMasterCredentials() (master for ownership match - Rule 7)
     ↓
   Vapi phone number UUID returned

4. Link to agent using Vapi phone number ID
     ↓
   Agent ready for inbound/outbound calls
```

**Code Example:**
```typescript
// Full managed provisioning flow (all steps)
export async function provisionManagedNumberFull(orgId: string, areaCode: string) {
  // Step 1: Purchase with master
  const masterClient = getMasterClient();
  const number = await masterClient.incomingPhoneNumbers.create({ areaCode });

  // Step 2: Create subaccount
  const subaccount = await masterClient.api.accounts.create({
    friendlyName: `Org ${orgId}`
  });

  // Step 3: Import to Vapi with MASTER credentials (Rule 7)
  const masterCreds = getMasterCredentials();
  const vapiPhone = await vapiClient.importTwilioNumber({
    twilioPhoneNumber: number.phoneNumber,
    twilioAccountSid: masterCreds.accountSid, // Master owns number
    twilioAuthToken: masterCreds.authToken
  });

  // Step 4: Store in database
  await supabase.from('managed_phone_numbers').insert({
    org_id: orgId,
    phone_number: number.phoneNumber,
    vapi_phone_number_id: vapiPhone.id,
    twilio_subaccount_sid: subaccount.sid
  });

  return vapiPhone;
}
```

---

## Startup Validation Rules

### Backend WILL NOT START Without

The following environment variables are **REQUIRED** by `backend/src/config/index.ts`:

| Variable | Purpose | Failure Mode |
|----------|---------|--------------|
| `SUPABASE_URL` | Database connection | ❌ Backend crashes on startup |
| `SUPABASE_SERVICE_ROLE_KEY` | Database authentication | ❌ Backend crashes on startup |
| `VAPI_PRIVATE_KEY` | Voice AI platform | ❌ Backend crashes on startup |
| `TWILIO_ACCOUNT_SID` | SMS and managed telephony | ❌ Backend crashes on startup |
| `TWILIO_AUTH_TOKEN` | Twilio authentication | ❌ Backend crashes on startup |
| `TWILIO_PHONE_NUMBER` | SMS sender identity | ❌ Backend crashes on startup |
| `ENCRYPTION_KEY` | Decrypt tenant credentials | ❌ Backend crashes on startup |

### Validation Location

**File:** `backend/src/config/index.ts` (lines 281-340)

**Method:** `config.validate()` - Runs automatically on module load

**Behavior:**
```typescript
export const config = {
  ENCRYPTION_KEY: getRequired('ENCRYPTION_KEY'), // Throws if missing
  // ... other required fields

  validate(): void {
    const critical = ['SUPABASE_URL', 'ENCRYPTION_KEY', /* ... */];
    const missing = critical.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ CRITICAL CONFIGURATION ERROR');
      console.error('Missing required environment variables:', missing);
      throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
    }
  }
};

// Auto-validate on import
try {
  config.validate();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1); // ❌ Exit with error code 1
}
```

### Failure Mode

**If ANY required variable is missing:**

1. Backend prints detailed error message:
   ```
   ================================================================================
   ❌ CRITICAL CONFIGURATION ERROR
   ================================================================================

   Missing required environment variables:
     ❌ ENCRYPTION_KEY
     ❌ TWILIO_MASTER_ACCOUNT_SID

   ================================================================================
   HOW TO FIX:
   ================================================================================

   1. Go to backend/.env
   2. Add missing variables:
      ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
      TWILIO_MASTER_ACCOUNT_SID=AC...
   3. Restart backend: npm run dev

   Reference: See backend/.env.example for configuration guide.
   ================================================================================
   ```

2. Backend exits with code 1 (does NOT start server)

3. All routes return "Connection refused" (server not running)

### Verification Command

**Before Starting Backend:**
```bash
cd backend
npm run validate-env # ✅ Pre-flight checks (Phase 3 implementation)
```

**Expected Output (Success):**
```
✅ ENCRYPTION_KEY: Valid 64-character hex
✅ TWILIO_MASTER_ACCOUNT_SID: Valid format (ACe18...)
✅ TWILIO_MASTER_AUTH_TOKEN: Valid format (20461...)
✅ VAPI_PRIVATE_KEY: Valid UUID format
✅ Supabase connection: Successful
✅ Encryption round-trip: Successful

🎉 All validation checks passed - backend ready to start!
```

**Expected Output (Failure):**
```
❌ ENCRYPTION_KEY: Placeholder detected - generate with: openssl rand -hex 32
⚠️  TWILIO_PHONE_NUMBER: Still placeholder (+1234567890)
❌ TWILIO_MASTER_ACCOUNT_SID: Missing or invalid

🔴 Validation failed - fix errors above before starting backend
```

---

## Credential Storage Immutability

### Encryption Pipeline

**Save Credentials (User Input → Database):**

```
User enters credentials in dashboard
  ↓
Frontend: POST /api/integrations/twilio with plaintext credentials
  ↓
Backend: IntegrationDecryptor.saveTwilioCredential(orgId, credentials)
  ↓
EncryptionService.encrypt(JSON.stringify(credentials), ENCRYPTION_KEY)
  ↓
AES-256-GCM encryption: iv:authTag:ciphertext (hex format)
  ↓
Database: org_credentials.encrypted_config = "a1b2c3:d4e5f6:g7h8i9..."
  ↓
Success: Credentials securely stored
```

**Format Details:**
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **IV:** 12 bytes (random per encryption)
- **Auth Tag:** 16 bytes (integrity verification)
- **Encoding:** Hex string (readable in database)

### Decryption Pipeline

**Retrieve Credentials (Database → Application):**

```
Application needs Twilio credentials for SMS send
  ↓
IntegrationDecryptor.getTwilioCredentials(orgId)
  ↓
Check 30-second cache (key: `twilio:${orgId}`)
  ↓ (cache miss)
Database query: SELECT encrypted_config FROM org_credentials WHERE org_id = ?
  ↓
EncryptionService.decrypt(encryptedConfig, ENCRYPTION_KEY)
  ↓
AES-256-GCM decryption: ciphertext → plaintext JSON
  ↓
Parse JSON: { accountSid: "AC...", authToken: "...", phoneNumber: "+1..." }
  ↓
Cache for 30 seconds (reduce decryption overhead)
  ↓
Return: TwilioCredentials object
```

**Caching Strategy:**
- **TTL:** 30 seconds (security vs performance balance)
- **Key Format:** `${provider}:${orgId}` (e.g., `twilio:46cf2995-2bee...`)
- **Invalidation:** On credential update (delete cache entry)
- **Max Size:** 1000 entries (prevent memory bloat)

### Row-Level Security (RLS)

**Database Table:** `org_credentials`

**RLS Policies:**
```sql
-- Users can only view their own org's credentials
CREATE POLICY "Users can view own org credentials"
  ON org_credentials
  FOR SELECT
  USING (org_id = auth.jwt() ->> 'app_metadata' ->> 'org_id');

-- Users can only update their own org's credentials
CREATE POLICY "Users can update own org credentials"
  ON org_credentials
  FOR UPDATE
  USING (org_id = auth.jwt() ->> 'app_metadata' ->> 'org_id');

-- Service role bypasses RLS (backend operations)
GRANT ALL ON org_credentials TO service_role;
```

**Multi-Tenant Isolation:**
- User A (org_id = `abc-123`) **CANNOT** access User B's credentials (org_id = `def-456`)
- Database enforces isolation at row level
- Backend service role bypasses RLS for cross-org operations (e.g., admin dashboard)

### Security Guarantees

**Encrypted at Rest:**
- All credentials encrypted before hitting disk
- Database backups contain encrypted data (safe to store offsite)
- No plaintext credentials in database logs

**Encrypted in Transit:**
- HTTPS for frontend → backend communication
- TLS for backend → database communication (Supabase built-in)

**Never Logged:**
```typescript
// ❌ WRONG - Logging decrypted credentials
log('INFO', 'Twilio credentials:', { accountSid: creds.accountSid, authToken: creds.authToken });

// ✅ CORRECT - Redact sensitive fields
log('INFO', 'Twilio credentials retrieved', {
  accountSid: creds.accountSid.substring(0, 6) + '...', // AC12...
  authToken: '[REDACTED]',
  phoneNumber: creds.phoneNumber
});
```

---

## Prevention Rules for AI/Developers

### NEVER Do These Things

1. **Hardcode credentials in source code**
   ```typescript
   // ❌ WRONG - Credentials in code
   const twilioClient = require('twilio')('AC12345', 'secret-token');

   // ✅ CORRECT - From environment or database
   const creds = await IntegrationDecryptor.getTwilioCredentials(orgId);
   const twilioClient = getTwilioClient(creds);
   ```

2. **Skip `config.validate()` on startup**
   ```typescript
   // ❌ WRONG - Commenting out validation
   // config.validate(); // Disabled for testing

   // ✅ CORRECT - Always validate
   config.validate(); // Required for safety
   ```

3. **Remove encryption for "performance"**
   ```typescript
   // ❌ WRONG - Storing plaintext for "speed"
   await supabase.from('org_credentials').insert({
     org_id: orgId,
     credentials: JSON.stringify(credentials) // ❌ Plaintext!
   });

   // ✅ CORRECT - Always encrypt
   const encrypted = EncryptionService.encrypt(JSON.stringify(credentials));
   await supabase.from('org_credentials').insert({
     org_id: orgId,
     encrypted_config: encrypted
   });
   ```

4. **Log decrypted credentials**
   ```typescript
   // ❌ WRONG - Credentials in logs
   console.log('Credentials:', credentials);

   // ✅ CORRECT - Redacted logging
   log('INFO', 'Credentials retrieved', {
     provider: 'twilio',
     accountSid: credentials.accountSid.substring(0, 6) + '...'
   });
   ```

5. **Change ENCRYPTION_KEY without migration**
   ```typescript
   // ❌ WRONG - Just changing key
   ENCRYPTION_KEY=new-key-here # All existing data now unreadable!

   // ✅ CORRECT - Migrate first
   # 1. Decrypt all with old key
   # 2. Re-encrypt with new key
   # 3. Update database atomically
   # 4. Deploy new ENCRYPTION_KEY
   ```

6. **Use master credentials for tenant operations**
   ```typescript
   // ❌ WRONG - Master creds for tenant SMS
   const masterClient = getMasterClient();
   await masterClient.messages.create({ from: orgPhone, to: customer });

   // ✅ CORRECT - Tenant creds from database
   const tenantCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
   const tenantClient = getTwilioClient(tenantCreds);
   await tenantClient.messages.create({ from: orgPhone, to: customer });
   ```

7. **Store credentials in Git history**
   ```bash
   # ❌ WRONG - Committing .env with secrets
   git add backend/.env
   git commit -m "Add production credentials"

   # ✅ CORRECT - .env in .gitignore
   git add backend/.env.example # Template only, no real values
   ```

### ALWAYS Do These Things

1. **Reference CONFIGURATION_CRITICAL_INVARIANTS.md in PRs**
   ```markdown
   ## Changes Made
   - Updated Twilio credential handling

   ## Rules Verified
   - ✅ Rule 7: Master credentials used for Vapi import
   - ✅ ENCRYPTION_KEY not changed
   - ✅ No hardcoded credentials added

   See: CONFIGURATION_CRITICAL_INVARIANTS.md
   ```

2. **Test backend startup after .env changes**
   ```bash
   # After changing .env
   npm run validate-env # Pre-flight checks
   npm run dev          # Verify startup succeeds
   curl http://localhost:3001/health # Verify health check
   ```

3. **Use IntegrationDecryptor for all credential access**
   ```typescript
   // ✅ ALWAYS go through IntegrationDecryptor
   const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
   const googleCredentials = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
   const vapiCredentials = await IntegrationDecryptor.getVapiCredentials(orgId);

   // ❌ NEVER query org_credentials table directly
   const { data } = await supabase.from('org_credentials').select('*'); // ❌ Bypass decryption
   ```

4. **Validate credentials before saving**
   ```typescript
   // ✅ CORRECT - Test before storing
   const twilioClient = require('twilio')(credentials.accountSid, credentials.authToken);
   await twilioClient.api.accounts(credentials.accountSid).fetch(); // Throws if invalid

   // Now safe to encrypt and store
   await IntegrationDecryptor.saveTwilioCredential(orgId, credentials);
   ```

5. **Implement rollback on credential save failures**
   ```typescript
   // ✅ CORRECT - Rollback on error
   const oldCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);

   try {
     await IntegrationDecryptor.saveTwilioCredential(orgId, newCredentials);
   } catch (error) {
     log('ERROR', 'Failed to save credentials - rolling back');
     await IntegrationDecryptor.saveTwilioCredential(orgId, oldCredentials);
     throw error;
   }
   ```

6. **Document WHY a credential is needed**
   ```typescript
   // ✅ CORRECT - Explain purpose
   /**
    * TWILIO_MASTER_ACCOUNT_SID - Master Twilio account for managed telephony
    * Used for:
    * - Creating subaccounts per organization (billing isolation)
    * - Purchasing phone numbers in master inventory
    * - Importing numbers to Vapi (Rule 7: ownership must match)
    *
    * NEVER use for tenant-specific operations (SMS, calls, logs)
    */
   const TWILIO_MASTER_ACCOUNT_SID = process.env.TWILIO_MASTER_ACCOUNT_SID;
   ```

---

## Verification Checklist

Before deploying ANY changes to backend configuration or credential handling:

### Pre-Deployment Checks

- [ ] All 7 Critical Invariants verified (reference rule numbers in PR)
- [ ] `npm run validate-env` passes successfully
- [ ] Backend starts without "Missing required environment variables" error
- [ ] No hardcoded credentials added to code
- [ ] ENCRYPTION_KEY not changed (or migration plan executed)
- [ ] Master credentials used ONLY for managed telephony (Rule 7)
- [ ] All credential access via `IntegrationDecryptor` (not direct DB queries)
- [ ] Error messages redact sensitive data (`[REDACTED]`)
- [ ] .env file in .gitignore (never committed)
- [ ] JSDoc comments reference this document (CONFIGURATION_CRITICAL_INVARIANTS.md)

### Post-Deployment Verification

- [ ] Backend health check returns 200: `curl http://localhost:3001/health`
- [ ] Supabase connection successful (check logs)
- [ ] Redis connection successful (check logs)
- [ ] Encryption round-trip test passes (decrypt test data)
- [ ] Outbound call flow works (Rule 1-6 verified)
- [ ] Managed number provisioning works (Rule 7 verified)
- [ ] No credentials in logs (grep for `authToken`, `password`, `secret`)
- [ ] All integration tests pass: `npm run test:integration`

---

## Emergency Procedures

### If ENCRYPTION_KEY is Compromised

**Symptom:** Unauthorized access to tenant credentials

**Immediate Actions:**
1. Rotate ENCRYPTION_KEY with migration:
   ```bash
   # Decrypt all with old key
   npm run migrate:decrypt-all

   # Generate new key
   openssl rand -hex 32 > new-key.txt

   # Re-encrypt with new key
   ENCRYPTION_KEY=$(cat new-key.txt) npm run migrate:encrypt-all

   # Deploy new key
   git add backend/.env.example # Update docs only
   # Manually update production environment variables
   ```

2. Notify all customers of potential breach
3. Force password reset for all users
4. Audit access logs for suspicious activity
5. Generate incident post-mortem

### If Master Twilio Credentials are Wrong

**Symptom:** "Twilio authentication failed" errors in logs

**Immediate Actions:**
1. Verify credentials in Twilio dashboard (console.twilio.com)
2. Update `backend/.env`:
   ```bash
   TWILIO_MASTER_ACCOUNT_SID=AC... # Correct master SID
   TWILIO_MASTER_AUTH_TOKEN=...     # Correct master token
   ```
3. Run validation: `npm run validate-env`
4. Restart backend: `npm run dev`
5. Test managed provisioning: `npm run test:managed-telephony`

### If Outbound Calls Fail (Rules 1-6 Violated)

**Symptom:** "No phone number available" or "Invalid phoneNumberId" errors

**Diagnosis:**
1. Check if `vapi_phone_number_id` is NULL:
   ```sql
   SELECT id, name, vapi_phone_number_id FROM agents WHERE call_direction = 'outbound';
   ```
2. Check if raw phone strings passed to Vapi:
   ```bash
   grep -n "phoneNumberId: '+'" backend/src/**/*.ts # Should be 0 results
   ```
3. Check if `.single()` used instead of `.maybeSingle()`:
   ```bash
   grep -n "\.single()" backend/src/routes/contacts.ts # Should be 0 results
   ```

**Resolution:**
1. Identify which rule was violated (1-6)
2. Revert code to last working commit: `git revert HEAD`
3. Re-apply change with correct implementation
4. Reference this document in PR

---

## Document Maintenance

**Ownership:** Technical Architecture Agent + Devil's Advocate Agent

**Update Frequency:** Whenever ANY of these change:
- New critical invariant discovered (add Rule 8, 9, etc.)
- Credential hierarchy changes (new tier added)
- Encryption algorithm upgraded (AES-256-GCM → newer)
- Master credential usage expands (new use cases)

**Review Schedule:**
- Quarterly security audit (verify all rules still enforced)
- Before major releases (check no rules broken)
- After production incidents (update with learnings)

**Version History:**
| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-09 | Initial document creation (7 rules) |

---

## Appendix: Quick Reference

### Critical Files

| File | Purpose | Rules |
|------|---------|-------|
| `backend/.env` | Platform credentials (ENCRYPTION_KEY, master Twilio) | Never commit, never hardcode |
| `backend/src/config/index.ts` | Startup validation (config.validate()) | Rules apply to all credentials |
| `backend/src/services/integration-decryptor.ts` | SSOT for credential decryption | Always use, never bypass |
| `backend/src/services/vapi-client.ts` | Pre-flight assertions (createOutboundCall) | Rule 3, 5 |
| `backend/src/routes/contacts.ts` | Outbound call endpoint | Rules 2, 4, 6 |
| `backend/src/routes/agent-sync.ts` | Agent save logic | Rule 1 |
| `backend/src/services/managed-telephony-service.ts` | Managed provisioning | Rule 7 |

### Emergency Contacts

| Role | Slack | Email | On-Call |
|------|-------|-------|---------|
| Technical Architecture Agent | @tech-arch | tech@voxanne.ai | 24/7 |
| Devil's Advocate Agent | @devils-advocate | security@voxanne.ai | Business hours |
| Platform Owner | @austin | austin@voxanne.ai | 24/7 |

---

**END OF DOCUMENT**

**Last Reviewed:** February 9, 2026
**Next Review Due:** May 9, 2026 (Quarterly)
**Status:** 🔒 IMMUTABLE - Do not modify without team review
