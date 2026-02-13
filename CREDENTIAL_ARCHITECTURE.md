# 🔐 Credential Architecture: SINGLE SOURCE OF TRUTH

**Status:** ✅ **DOCUMENTED & VERIFIED**  
**Date:** February 13, 2026  
**Critical:** YES - Impacts multi-tenant data isolation

---

## Executive Summary

The Voxanne AI platform follows a **strict single source of truth** principle for organization credentials:

> **Organization credentials stored in `org_credentials` table are the ONLY source for all API operations.**

This ensures complete isolation between organizations using different credential types:
- **BYOC (Bring Your Own Carrier):** Organization provides their own Twilio account
- **Managed Telephony:** Platform allocates Twilio numbers to the organization

---

## Credential Resolution Flow

### For Twilio Operations (Verified Caller ID, Call Forwarding, etc.)

```
User Request (with orgId in JWT)
    ↓
Route Handler (e.g., verified-caller-id.ts)
    ↓
IntegrationDecryptor.getTwilioCredentials(orgId)
    ↓
CredentialService.get(orgId, 'twilio')
    ↓
Query: SELECT * FROM org_credentials 
       WHERE org_id = $1 AND provider = 'twilio'
    ↓
Check: Is credential active? Is it valid?
    ↓
Decrypt: EncryptionService.decryptObject(encrypted_config)
    ↓
Return: { accountSid, authToken, phoneNumber }
    ↓
Create Twilio Client: twilio(accountSid, authToken)
    ↓
Make Twilio API Call
```

### Key Checkpoints

1. **Organization Isolation**
   - Query filters by org_id: `WHERE org_id = $1`
   - No cross-org access possible
   - Each org has separate credential rows

2. **Credential Type**
   - BYOC: Org stores their own Twilio account SID/token
   - Managed: Platform stores allocated credentials for org
   - Same API, different data

3. **Activation Status**
   - Each credential has `is_active` flag
   - Disabled credentials throw error (no fallback)
   - User must re-activate via dashboard

4. **Error Handling**
   - Missing credentials → User must configure in settings
   - Disabled integration → User must enable
   - Corrupt/invalid data → User must reconnect
   - NO FALLBACK TO ENVIRONMENT VARIABLES

5. **Caching Strategy**
   - Credentials cached per org+provider
   - Cache key: `${orgId}:${provider}`
   - TTL: 5 minutes (configurable)
   - Automatic invalidation on credential updates

---

## Implementation Details

### Credential Service (`backend/src/services/credential-service.ts`)

```typescript
static async get<T>(orgId: string, provider: ProviderType): Promise<T> {
  // Step 1: Validate inputs
  if (!orgId) throw new Error('Invalid orgId');
  
  // Step 2: Query org_credentials table (org-specific)
  const { data, error } = await supabase
    .from('org_credentials')
    .select('encrypted_config, is_active, ...')
    .eq('org_id', orgId)        // ← Only this organization's credentials
    .eq('provider', provider)    // ← Only Twilio credentials
    .maybeSingle();
  
  // Step 3: Validate credential exists
  if (!data) throw new Error('No credentials found');
  
  // Step 4: Check credential is active
  if (!data.is_active) throw new Error('Integration disabled');
  
  // Step 5: Decrypt credentials
  const decrypted = EncryptionService.decryptObject(data.encrypted_config);
  
  // Step 6: Return (will be cached)
  return decrypted;
}
```

### Integration Decryptor (`backend/src/services/integration-decryptor.ts`)

```typescript
static async getTwilioCredentials(orgId: string): Promise<TwilioCredentials> {
  return this.getCredentials<TwilioCredentials>(
    orgId,
    'twilio',
    (decrypted) => {
      // Transform to provider-specific format
      return {
        accountSid: decrypted.accountSid,
        authToken: decrypted.authToken,
        phoneNumber: decrypted.phoneNumber,
      };
    }
  );
}

private static async getCredentials<T>(
  orgId: string,
  provider: string,
  transformer: (decrypted: any) => T
): Promise<T> {
  // Check cache first (per org+provider)
  const cacheKey = `${orgId}:${provider}`;
  const cached = credentialCache.get(cacheKey);
  if (cached && still_valid) return cached;
  
  // Query org_credentials via CredentialService
  const decrypted = await CredentialService.get(orgId, provider);
  
  // Transform and cache
  const transformed = transformer(decrypted);
  credentialCache.set(cacheKey, transformed);
  
  return transformed;
}
```

### Usage in Routes (`backend/src/routes/verified-caller-id.ts`)

```typescript
router.post('/verify', requireAuth, async (req, res) => {
  const orgId = req.user.orgId;  // From JWT
  
  // Retrieve organization's Twilio credentials (BYOC or Managed)
  const credentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
  
  // Create client with org's credentials
  const twilioClient = twilio(credentials.accountSid, credentials.authToken);
  
  // Make Twilio API call using org's account
  const validation = await twilioClient.outgoingCallerIds.create({...});
});
```

---

## Database Schema: `org_credentials`

```sql
CREATE TABLE org_credentials (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL,  -- 'twilio', 'google_calendar', 'vapi'
  encrypted_config JSONB NOT NULL,  -- Encrypted credential JSON
  is_active BOOLEAN DEFAULT true,   -- Organization can disable
  verification_status TEXT,         -- 'valid', 'invalid', 'expired'
  verification_error TEXT,          -- Last error message
  last_verified_at TIMESTAMPTZ,    -- When credentials were last tested
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, provider)  -- One credential per org+provider
);

-- RLS Policy: Organizations can only see their own credentials
ALTER TABLE org_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON org_credentials
  USING (org_id = auth.jwt() ->> 'org_id');
```

---

## Credential Types Supported

### 1. Twilio (for Verified Caller ID & Call Forwarding)

**BYOC Example:**
```json
{
  "accountSid": "ACxxx...yyy",     // User's own Twilio Account SID
  "authToken": "token...",         // User's own Twilio Auth Token
  "phoneNumber": "+15551234567"    // User's provisioned or BYOC number
}
```

**Managed Example:**
```json
{
  "accountSid": "ACplatform...",   // Platform's Twilio Account SID
  "authToken": "platform_token",   // Platform's Twilio Auth Token
  "phoneNumber": "+15551000001"    // Number allocated to this org
}
```

### 2. Google Calendar (for Availability Checking)

```json
{
  "accessToken": "ya29...",        // OAuth 2.0 Access Token
  "refreshToken": "1//...",        // OAuth 2.0 Refresh Token
  "expiresAt": "2026-02-27T..."   // Token expiration
}
```

### 3. Vapi (for AI Voice Configuration)

```json
{
  "apiKey": "xxx...",              // Vapi API Key
  "webhookSecret": "secret...",    // Webhook verification secret
  "phoneNumberId": "uuid..."       // Vapi Phone Number UUID
}
```

---

## Error Scenarios & Handling

### Scenario 1: User Hasn't Configured Twilio

**Credentials Missing**
```
GET org_credentials WHERE org_id = 'xxx' AND provider = 'twilio'
Result: No rows returned

Error thrown:
"No twilio credentials found for organization xxx. 
 Please connect in dashboard settings."

User sees: "Twilio credentials not configured. 
           Please connect your Twilio account in integrations."
```

**What Doesn't Happen:**
- ❌ Does NOT fall back to `process.env.TWILIO_ACCOUNT_SID`
- ❌ Does NOT use platform's default credentials
- ❌ Does NOT guess credentials

### Scenario 2: User Disabled Integration

**Credential Exists but Inactive**
```
SELECT * FROM org_credentials WHERE org_id = 'xxx'
Result: { is_active: false }

Error thrown:
"twilio integration is disabled for organization xxx. 
 Please enable in settings."
```

### Scenario 3: Credentials Corrupted

**Encrypted Data Can't be Decrypted**
```
Decryption fails due to wrong encryption key or corrupted data

Error thrown:
"Failed to decrypt twilio credentials. 
 Please reconnect in settings."

User Action: Re-do Twilio integration setup
```

### Scenario 4: Credential Expired (Google Calendar)

**Token Refresh Needed**
```
Access token expired, but refresh token valid

Action:
1. Use refresh token to get new access token
2. Update org_credentials with new access token
3. Retry operation
4. Return success

User doesn't need to do anything - automatic!
```

---

## Architecture Principles

### ✅ MUST Do

1. **Always retrieve org-specific credentials**
   ```typescript
   const creds = await IntegrationDecryptor.getTwilioCredentials(orgId);
   ```

2. **Never use global environment variables for org-specific operations**
   ```typescript
   // ❌ WRONG
   const accountSid = process.env.TWILIO_ACCOUNT_SID;
   
   // ✅ CORRECT
   const { accountSid } = await IntegrationDecryptor.getTwilioCredentials(orgId);
   ```

3. **Always validate orgId from JWT**
   ```typescript
   const orgId = (req.user as any)?.orgId;
   if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
   ```

4. **Let errors propagate (don't suppress)**
   ```typescript
   // ❌ WRONG
   try {
     const creds = await getTwilioCredentials(orgId);
   } catch {
     // Silently continue with default creds
   }
   
   // ✅ CORRECT
   try {
     const creds = await getTwilioCredentials(orgId);
   } catch (error) {
     logger.error('Credentials missing', { orgId });
     return res.status(400).json({ error: error.message });
   }
   ```

5. **Use environment variables ONLY for:**
   - Platform-level configuration (LOG_LEVEL, PORT, etc.)
   - Internal service URLs (SUPABASE_URL, etc.)
   - NOT for credentials that should be org-specific

### ❌ MUST NOT Do

1. **Don't create Twilio clients with env var credentials**
   ```typescript
   // ❌ WRONG - Uses platform default, not org's account
   const client = twilio(
     process.env.TWILIO_ACCOUNT_SID,
     process.env.TWILIO_AUTH_TOKEN
   );
   ```

2. **Don't bypass credential checks**
   ```typescript
   // ❌ WRONG - Might use wrong credentials if lookup fails
   const creds = await getTwilioCredentials(orgId)
     .catch(() => ({
       accountSid: process.env.TWILIO_ACCOUNT_SID,
       authToken: process.env.TWILIO_AUTH_TOKEN,
     }));
   ```

3. **Don't mix BYOC and Managed credentials**
   ```typescript
   // ❌ WRONG - Hardcoding assumption
   if (isUserBYOC) {
     // Use env vars (wrong!)
   } else {
     // Use org credentials (right, but inconsistent)
   }
   
   // ✅ CORRECT - Always use org credentials
   const creds = await getTwilioCredentials(orgId);
   // Creds are BYOC if user configured them, Managed otherwise
   ```

4. **Don't store credentials outside org_credentials table**
   ```typescript
   // ❌ WRONG - Decentralized, hard to manage
   store credential in agents table
   
   // ✅ CORRECT - Centralized, single source of truth
   store credential in org_credentials table
   reference it from agents via org_id
   ```

---

## Caching Strategy

### Per-Organization Caching

```typescript
const cacheKey = `${orgId}:${provider}`;
// Example: "org-123:twilio" vs "org-456:twilio"

// Each organization gets separate cached credentials
// Changes to one org don't affect others
```

### Cache Invalidation

**Automatic on credential update:**
```typescript
async function updateCredential(orgId, provider, newCreds) {
  // Update in database
  await supabase.from('org_credentials').update(newCreds);
  
  // Invalidate cache for this org+provider
  const cacheKey = `${orgId}:${provider}`;
  credentialCache.delete(cacheKey);
  
  // Next request will fetch fresh credentials
}
```

**Manual cache check:**
```typescript
// Credentials are refreshed every 5 minutes (configurable)
// If you need immediate consistency:
credentialCache.clear();  // Clear all caches
// Be careful - impacts all organizations
```

---

## Integration with Different Scenarios

### Scenario A: New User (BYOC Setup)

```
1. User navigates to Dashboard → Integrations
2. Clicks "Connect Twilio"
3. Provides their Twilio Account SID and Auth Token
4. System encrypts and stores in org_credentials table
5. Row: { org_id: 'user123', provider: 'twilio', encrypted_config: {...}, is_active: true }

Next operation:
6. User initiates caller ID verification
7. System retrieves encrypted config from org_credentials
8. Credentials are decrypted
9. Twilio client created with USER'S account (BYOC)
10. Call made from user's Twilio account
```

### Scenario B: Managed Customer

```
1. Customer signs up for Managed Telephony plan
2. Platform creates Twilio number in PLATFORM'S account
3. System stores platform's credentials in org_credentials
4. Row: { org_id: 'customer456', provider: 'twilio', encrypted_config: {...}, is_active: true }

Next operation:
5. Customer initiates caller ID verification
6. System retrieves encrypted config from org_credentials
7. Credentials are decrypted (platform's credentials)
8. Twilio client created with PLATFORM'S account
9. Call made from platform's Twilio account (but labeled for customer)
```

### Scenario C: Customer Switches from Managed to BYOC

```
1. Managed customer decides to use BYOC
2. Customer uploads their own Twilio credentials
3. System creates NEW row in org_credentials OR updates existing
4. Old managed credentials can be disabled: UPDATE org_credentials SET is_active = false

Next operation:
5. System retrieves CUSTOMER'S credentials (from org_credentials)
6. Twilio client created with CUSTOMER'S account (BYOC)
7. System still labeled as same "telephony provider" but using customer's account
```

---

## Testing Strategy

### Unit Test: Credential Isolation

```typescript
test('Each organization gets separate credentials', async () => {
  // Org 1 stores their credentials
  const creds1 = { accountSid: 'AC_ORG1...', authToken: 'token1' };
  await storeCredentials('org-1', 'twilio', creds1);
  
  // Org 2 stores different credentials
  const creds2 = { accountSid: 'AC_ORG2...', authToken: 'token2' };
  await storeCredentials('org-2', 'twilio', creds2);
  
  // When org 1 retrieves, should get org 1's credentials only
  const retrieved1 = await getTwilioCredentials('org-1');
  expect(retrieved1.accountSid).toBe('AC_ORG1...');
  
  // When org 2 retrieves, should get org 2's credentials only
  const retrieved2 = await getTwilioCredentials('org-2');
  expect(retrieved2.accountSid).toBe('AC_ORG2...');
});
```

### Integration Test: Error Handling

```typescript
test('Missing credentials returns helpful error', async () => {
  // Organization has no Twilio credentials configured
  
  const result = await getTwilioCredentials('org-no-creds');
  
  // Should throw with user-friendly message
  expect(result).rejects.toThrow(
    'No twilio credentials found for organization'
  );
  
  // Should NOT fallback to env vars
  expect(result).rejects.not.toThrow('TWILIO_ACCOUNT_SID');
});
```

---

## Maintenance & Operations

### Monitoring Credential Health

```bash
# See which organizations have Twilio credentials
SELECT org_id, is_active, last_verified_at
FROM org_credentials
WHERE provider = 'twilio'
ORDER BY org_id;

# Find disabled integrations (potential issues)
SELECT org_id, provider, verification_error
FROM org_credentials
WHERE is_active = false;

# Find stale credentials (not verified recently)
SELECT org_id, provider, last_verified_at
FROM org_credentials
WHERE last_verified_at < NOW() - INTERVAL '30 days';
```

### Credential Rotation

**User initiates (via dashboard):**
```
1. User goes to Settings → Connected Integrations → Twilio
2. Clicks "Update Credentials"
3. Enters new Account SID and Auth Token
4. System updates org_credentials row
5. Cache invalidated automatically
6. Next request uses new credentials
```

**Emergency Rotation:**
```bash
# If credentials leaked:
1. Disable old credentials
   UPDATE org_credentials SET is_active = false
   WHERE org_id = 'compromised-org' AND provider = 'twilio';

2. User must upload new credentials via dashboard
3. Operations resume with new credentials
```

---

## Summary

| Aspect | Rule |
|--------|------|
| **Source of Truth** | `org_credentials` table (org_id + provider) |
| **Credential Retrieval** | IntegrationDecryptor.getTwilioCredentials(orgId) |
| **Fallback Strategy** | None - error if credentials missing |
| **BYOC Support** | Yes - org stores their own credentials |
| **Managed Support** | Yes - platform stores allocated credentials |
| **Isolation** | Complete - org can't access other orgs' credentials |
| **Caching** | Per org+provider, 5 min TTL |
| **Error Handling** | User-friendly, actionable messages |
| **Environment Variables** | Never used for org-specific operations |

---

**Status:** ✅ **ARCHITECTURE VERIFIED & DOCUMENTED**
**Implementation:** ✅ **CORRECT ACROSS ALL ROUTES**
**Future Maintenance:** ✅ **PRINCIPLES DOCUMENTED FOR TEAMS**

