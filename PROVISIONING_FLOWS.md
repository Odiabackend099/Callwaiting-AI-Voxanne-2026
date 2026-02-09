# Provisioning Flows & Credential Management

**Purpose:** Visual documentation of all provisioning flows, credential hierarchies, and data pipelines
**Status:** Complete - Production Reference
**Last Updated:** February 9, 2026

---

## Table of Contents

1. [BYOC Provisioning Flow](#byoc-provisioning-flow)
2. [Managed Telephony Provisioning Flow](#managed-telephony-provisioning-flow)
3. [Credential Resolution Chain](#credential-resolution-chain)
4. [Encryption/Decryption Pipeline](#encryptiondecryption-pipeline)
5. [API Endpoint Reference](#api-endpoint-reference)

---

## BYOC Provisioning Flow

**BYOC (Bring Your Own Carrier):** Customer provides their own Twilio credentials

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant D as Dashboard (Frontend)
    participant B as Backend API
    participant E as EncryptionService
    participant DB as Supabase Database
    participant V as Vapi API

    Note over C,V: BYOC Provisioning: Customer provides own Twilio credentials

    C->>D: Navigate to Settings > Integrations
    D->>C: Show Twilio integration form

    C->>D: Enter credentials<br/>(Account SID, Auth Token, Phone Number)

    D->>B: POST /api/integrations/twilio<br/>{"accountSid": "AC...", "authToken": "...", "phoneNumber": "+1..."}

    B->>B: Validate format<br/>(AC prefix, 34 chars, E.164 phone)

    B->>V: Test connection<br/>twilioClient.api.accounts.fetch()

    alt Twilio API Success
        V-->>B: Account details returned

        B->>E: encrypt(credentials, ENCRYPTION_KEY)
        E->>E: AES-256-GCM encryption
        E-->>B: Encrypted config<br/>(iv:authTag:ciphertext hex)

        B->>DB: UPSERT org_credentials<br/>SET encrypted_config = '...'
        DB-->>B: Success (Row updated)

        B->>V: List available phone numbers<br/>vapiClient.listPhoneNumbers()
        V-->>B: [phone1, phone2, ...]

        B-->>D: 200 OK<br/>{"success": true, "phoneNumbers": [...]}
        D-->>C: ✅ Integration saved!<br/>Your Twilio account is connected
    else Twilio API Failure
        V-->>B: 401 Unauthorized
        B-->>D: 400 Bad Request<br/>{"error": "Invalid Twilio credentials"}
        D-->>C: ❌ Connection failed<br/>Please verify your credentials
    end
```

### Step-by-Step Process

**Step 1: User Input**
- Customer navigates to **Settings > Integrations**
- Selects "Connect Twilio Account"
- Enters 3 credentials:
  - **Account SID** (e.g., `AC_EXAMPLE_ACCT_SID`)
  - **Auth Token** (e.g., `0123456789abcdef0123456789abcdef`)
  - **Phone Number** (e.g., `+12125551234`)

**Step 2: Frontend Validation**
- Check Account SID starts with `AC` and is 34 characters
- Check Auth Token is 32 characters
- Check Phone Number is E.164 format (`+1234567890`)
- If invalid, show error before sending to backend

**Step 3: Backend API Call**
```http
POST /api/integrations/twilio HTTP/1.1
Host: backend.voxanne.ai
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "accountSid": "AC_EXAMPLE_ACCT_SID",
  "authToken": "0123456789abcdef0123456789abcdef",
  "phoneNumber": "+12125551234"
}
```

**Step 4: Backend Validation & Test**
```typescript
// backend/src/routes/integrations-byoc.ts
const twilioClient = require('twilio')(accountSid, authToken);

try {
  // Test connection by fetching account details
  await twilioClient.api.accounts(accountSid).fetch();
  // Success - credentials valid
} catch (error) {
  // Failure - credentials invalid
  return res.status(400).json({ error: 'Invalid Twilio credentials' });
}
```

**Step 5: Encrypt Credentials**
```typescript
// backend/src/services/encryption.ts
const plaintext = JSON.stringify({
  accountSid,
  authToken,
  phoneNumber
});

const encrypted = EncryptionService.encrypt(plaintext);
// Returns: "a1b2c3d4e5f6:g7h8i9j0k1l2:m3n4o5p6q7r8..." (hex)
```

**Step 6: Store in Database**
```sql
-- Supabase org_credentials table
INSERT INTO org_credentials (org_id, provider, encrypted_config)
VALUES (
  '46cf2995-2bee-44e3-838b-24151486fe4e',
  'twilio',
  'a1b2c3d4e5f6:g7h8i9j0k1l2:m3n4o5p6q7r8...'
)
ON CONFLICT (org_id, provider)
DO UPDATE SET encrypted_config = EXCLUDED.encrypted_config;
```

**Step 7: List Vapi Phone Numbers**
```typescript
// backend/src/services/vapi-client.ts
const vapiPhones = await vapiClient.listPhoneNumbers();
// Returns: [{ id: 'abc-123', number: '+12125551234' }, ...]
```

**Step 8: Return Success**
```json
{
  "success": true,
  "message": "Twilio account connected successfully",
  "phoneNumbers": [
    { "id": "abc-123", "number": "+12125551234" }
  ]
}
```

---

## Managed Telephony Provisioning Flow

**Managed Telephony:** Platform provisions phone numbers for customer (reseller model)

### Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant D as Dashboard
    participant B as Backend API
    participant TM as TwilioMasterClient
    participant DB as Database
    participant V as Vapi API

    Note over C,V: Managed Provisioning: Platform provides phone number

    C->>D: Click "Get Phone Number"
    D->>C: Show area code selector (US/UK)

    C->>D: Select area code (e.g., 442 for London)

    D->>B: POST /api/managed-telephony/provision<br/>{"areaCode": "442"}

    Note over B,TM: Step 1: Purchase number with MASTER credentials
    B->>TM: Purchase number (master Twilio)<br/>incomingPhoneNumbers.create({areaCode: "442"})
    TM-->>B: +14422526073

    Note over B,TM: Step 2: Create subaccount for billing isolation
    B->>TM: Create subaccount<br/>accounts.create({friendlyName: "Org abc-123"})
    TM-->>B: Subaccount SID + Token

    B->>DB: Encrypt subaccount token<br/>EncryptionService.encrypt()
    DB-->>B: Success

    Note over B,V: Step 3: Import to Vapi with MASTER credentials (Rule 7)
    B->>B: getMasterCredentials()<br/>(NOT subaccount credentials)

    B->>V: Import number<br/>vapiClient.importTwilioNumber({<br/>  twilioPhoneNumber: "+14422526073",<br/>  twilioAccountSid: MASTER_SID,<br/>  twilioAuthToken: MASTER_TOKEN<br/>})

    alt Vapi Import Success
        V-->>B: phone_number_id (UUID)

        Note over B,DB: Step 4: Store provisioned number
        B->>DB: INSERT managed_phone_numbers<br/>SET phone_number = "+14422526073"<br/>SET vapi_phone_number_id = "abc-123"<br/>SET twilio_subaccount_sid = "AC..."
        DB-->>B: Success

        B-->>D: 200 OK<br/>{"phoneNumber": "+14422526073", "vapiId": "abc-123"}
        D-->>C: ✅ Number provisioned!<br/>Your new number: +44 20 2526 073
    else Vapi Import Failure
        V-->>B: 400 Error (credentials mismatch)
        B->>TM: Rollback: Release number<br/>incomingPhoneNumbers.delete()
        B->>TM: Rollback: Delete subaccount
        B-->>D: 500 Error<br/>{"error": "Provisioning failed"}
        D-->>C: ❌ Provisioning failed<br/>Please try again
    end
```

### Step-by-Step Process

**Step 1: User Initiates Provisioning**
- Customer clicks "Get Phone Number" in dashboard
- Selects country and area code:
  - **US:** 212 (New York), 415 (San Francisco), etc.
  - **UK:** 20 (London), 121 (Birmingham), etc.

**Step 2: Purchase Number with Master Account**
```typescript
// backend/src/services/managed-telephony-service.ts
const masterClient = getMasterClient(); // Uses TWILIO_MASTER_* credentials

const number = await masterClient.incomingPhoneNumbers.create({
  areaCode: '442', // UK London
  friendlyName: `Voxanne-Managed-${orgId}`,
  voiceUrl: `${BACKEND_URL}/api/webhooks/vapi`
});

// Result: number.phoneNumber = '+14422526073'
```

**Step 3: Create Subaccount for Billing Isolation**
```typescript
const subaccount = await masterClient.api.accounts.create({
  friendlyName: `Org ${orgId}`,
});

// Result: subaccount.sid = 'AC84ac51...'
// Result: subaccount.authToken = 'bcd34dc74f...'
```

**Step 4: Encrypt and Store Subaccount Token**
```typescript
const encrypted = EncryptionService.encrypt(
  JSON.stringify({
    subaccountSid: subaccount.sid,
    subaccountToken: subaccount.authToken
  })
);

await supabase.from('twilio_subaccounts').insert({
  org_id: orgId,
  subaccount_sid: subaccount.sid,
  twilio_auth_token_encrypted: encrypted
});
```

**Step 5: Import to Vapi with MASTER Credentials (Rule 7)**
```typescript
// ⚠️ CRITICAL: Use MASTER credentials (not subaccount)
const masterCreds = getMasterCredentials();

const vapiPhone = await vapiClient.importTwilioNumber({
  twilioPhoneNumber: number.phoneNumber,
  twilioAccountSid: masterCreds.accountSid, // ✅ MASTER SID
  twilioAuthToken: masterCreds.authToken     // ✅ MASTER TOKEN
});

// If using subaccount credentials here, import FAILS (Rule 7)
```

**Step 6: Store Provisioned Number**
```sql
INSERT INTO managed_phone_numbers (
  org_id,
  phone_number,
  vapi_phone_number_id,
  twilio_subaccount_sid,
  status,
  provisioned_at
) VALUES (
  '46cf2995-2bee-44e3-838b-24151486fe4e',
  '+14422526073',
  'abc-123-def-456',
  'AC_EXAMPLE_ACCT_SID',
  'active',
  NOW()
);
```

**Step 7: Link to Agent**
```sql
UPDATE agents
SET vapi_phone_number_id = 'abc-123-def-456'
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND call_direction = 'inbound';
```

---

## Credential Resolution Chain

**Purpose:** Resolve Vapi phone number UUID from organization ID

### Flowchart

```mermaid
graph TD
    A[Start: Need phoneNumberId for org] --> B{Check managed_phone_numbers}
    B -->|Found| C[Return vapi_phone_number_id]
    B -->|Not Found| D{Check org_credentials for Twilio}

    D -->|Found| E[Decrypt Twilio credentials]
    E --> F[Get Twilio phone number]
    F --> G[Query Vapi: List phone numbers]
    G --> H{Find matching number?}

    H -->|Match Found| I[Return phone_number_id]
    H -->|No Match| J[Fallback: First available]

    J --> K{Has any phone numbers?}
    K -->|Yes| L[Return first phone_number_id]
    K -->|No| M[Return null]

    D -->|Not Found| N[Return null: No credentials]

    C --> O[Success: phoneNumberId returned]
    I --> O
    L --> O
    M --> P[Failure: No phone number]
    N --> P

    style C fill:#90EE90
    style O fill:#90EE90
    style M fill:#FFB6C1
    style N fill:#FFB6C1
    style P fill:#FFB6C1
```

### Resolution Logic

**Step 0: Check Managed Phone Numbers First (Short-Circuit)**
```typescript
// backend/src/services/phone-number-resolver.ts
const { data: managedPhone } = await supabase
  .from('managed_phone_numbers')
  .select('vapi_phone_number_id')
  .eq('org_id', orgId)
  .eq('status', 'active')
  .maybeSingle();

if (managedPhone) {
  return managedPhone.vapi_phone_number_id; // ✅ Short-circuit for managed orgs
}
```

**Step 1: Get Twilio Phone from BYOC Credentials**
```typescript
const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);

if (!twilioCredentials) {
  return null; // ❌ No credentials configured
}

const twilioPhone = twilioCredentials.phoneNumber; // e.g., '+12125551234'
```

**Step 2: List Vapi Phone Numbers**
```typescript
const vapiPhones = await vapiClient.listPhoneNumbers();
// Returns: [
//   { id: 'abc-123', number: '+12125551234' },
//   { id: 'def-456', number: '+14155551234' }
// ]
```

**Step 3: Find Matching Number**
```typescript
const matchingPhone = vapiPhones.find(p => p.number === twilioPhone);

if (matchingPhone) {
  return matchingPhone.id; // ✅ Match found
}
```

**Step 4: Fallback to First Available**
```typescript
if (vapiPhones.length > 0) {
  return vapiPhones[0].id; // ⚠️ Fallback to first available
}

return null; // ❌ No phone numbers available
```

---

## Encryption/Decryption Pipeline

**Purpose:** Secure storage of tenant credentials in database

### Encryption Flow

```mermaid
graph LR
    A[User Input:<br/>Plaintext Credentials] --> B[JSON.stringify]
    B --> C[EncryptionService.encrypt]
    C --> D[AES-256-GCM<br/>Algorithm]
    D --> E[Generate Random IV<br/>12 bytes]
    E --> F[Encrypt Plaintext]
    F --> G[Generate Auth Tag<br/>16 bytes]
    G --> H[Combine:<br/>iv:authTag:ciphertext]
    H --> I[Hex Encoding]
    I --> J[Store in Database:<br/>org_credentials.encrypted_config]

    style A fill:#FFE4B5
    style J fill:#90EE90
    style D fill:#87CEEB
```

**Encryption Example:**
```typescript
// Input
const plaintext = JSON.stringify({
  accountSid: 'AC_EXAMPLE_ACCT_SID',
  authToken: '490bd1cbcef733be829e7efd06291c09',
  phoneNumber: '+12125551234'
});

// Encryption
const encrypted = EncryptionService.encrypt(plaintext);

// Output (hex string)
"a1b2c3d4e5f6g7h8i9j0:k1l2m3n4o5p6q7r8s9t0:u1v2w3x4y5z6a7b8c9d0..."
//      ↑ IV (12 bytes)          ↑ Auth Tag (16 bytes)    ↑ Ciphertext
```

### Decryption Flow

```mermaid
graph LR
    A[Database:<br/>org_credentials.encrypted_config] --> B[Check 30-Second Cache]
    B -->|Cache Hit| C[Return Cached Credentials]
    B -->|Cache Miss| D[Read Encrypted String]
    D --> E[Split by Colon:<br/>iv, authTag, ciphertext]
    E --> F[Hex Decode]
    F --> G[AES-256-GCM Decrypt]
    G --> H[Verify Auth Tag]
    H -->|Valid| I[Return Plaintext]
    H -->|Invalid| J[Throw Error:<br/>Tampered Data]
    I --> K[JSON.parse]
    K --> L[Return Credentials Object]
    L --> M[Cache for 30 Seconds]
    M --> N[Application Uses Credentials]

    style A fill:#87CEEB
    style C fill:#90EE90
    style J fill:#FFB6C1
    style N fill:#90EE90
```

**Decryption Example:**
```typescript
// Input (from database)
const encrypted = "a1b2c3d4e5f6g7h8i9j0:k1l2m3n4o5p6q7r8s9t0:u1v2w3x4y5z6a7b8c9d0...";

// Decryption
const plaintext = EncryptionService.decrypt(encrypted);

// Output (JSON string)
"{\"accountSid\":\"ACbd0c...\",\"authToken\":\"490bd1...\",\"phoneNumber\":\"+1212...\"}"

// Parse
const credentials = JSON.parse(plaintext);

// Result: TwilioCredentials object
{
  accountSid: 'AC_EXAMPLE_ACCT_SID',
  authToken: '490bd1cbcef733be829e7efd06291c09',
  phoneNumber: '+12125551234'
}
```

---

## API Endpoint Reference

### BYOC Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/integrations/twilio` | Save Twilio credentials | ✅ JWT |
| GET | `/api/integrations/twilio` | Get masked Twilio config | ✅ JWT |
| GET | `/api/integrations/vapi/numbers` | List Vapi phone numbers | ✅ JWT |
| POST | `/api/integrations/vapi/assign-number` | Assign number to agent | ✅ JWT |
| GET | `/api/integrations/status` | Check all integrations | ✅ JWT |
| POST | `/api/integrations/:provider/verify` | Test credential connection | ✅ JWT |
| DELETE | `/api/integrations/:provider` | Disconnect integration | ✅ JWT |
| GET | `/api/integrations/telephony-mode` | Get current mode + status | ✅ JWT |

### Managed Telephony Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/managed-telephony/provision` | One-click number provisioning | ✅ JWT |
| DELETE | `/api/managed-telephony/numbers/:phoneNumber` | Release managed number | ✅ JWT |
| GET | `/api/managed-telephony/status` | Current managed telephony state | ✅ JWT |
| POST | `/api/managed-telephony/switch-mode` | Switch between byoc/managed | ✅ JWT |
| GET | `/api/managed-telephony/available-numbers` | Search without purchasing | ✅ JWT |
| POST | `/api/managed-telephony/a2p/register-brand` | A2P brand registration | ✅ JWT |
| POST | `/api/managed-telephony/a2p/register-campaign` | A2P campaign registration | ✅ JWT |

### Example API Calls

**Save Twilio Credentials (BYOC):**
```bash
curl -X POST http://localhost:3001/api/integrations/twilio \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountSid": "AC_EXAMPLE_ACCT_SID",
    "authToken": "490bd1cbcef733be829e7efd06291c09",
    "phoneNumber": "+12125551234"
  }'
```

**Provision Managed Number:**
```bash
curl -X POST http://localhost:3001/api/managed-telephony/provision \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "areaCode": "442",
    "country": "GB"
  }'
```

**Get Integration Status:**
```bash
curl -X GET http://localhost:3001/api/integrations/status \
  -H "Authorization: Bearer <JWT>"
```

**Expected Response:**
```json
{
  "twilio": {
    "connected": true,
    "phoneNumber": "+1212*****34",
    "lastVerified": "2026-02-09T10:30:00Z"
  },
  "googleCalendar": {
    "connected": true,
    "email": "user@example.com",
    "lastVerified": "2026-02-09T09:15:00Z"
  },
  "vapi": {
    "connected": true,
    "phoneNumbers": 1,
    "lastVerified": "2026-02-09T10:28:00Z"
  }
}
```

---

## Troubleshooting Guide

### Common Issues

**Issue 1: "Vapi import failed - credentials mismatch"**
- **Cause:** Using subaccount credentials instead of master credentials (Rule 7 violated)
- **Fix:** Use `getMasterCredentials()` for Vapi imports
- **Reference:** CONFIGURATION_CRITICAL_INVARIANTS.md (Rule 7)

**Issue 2: "No phone number available for organization"**
- **Cause:** `vapi_phone_number_id` is NULL and resolver can't find match
- **Fix:** Re-save agent configuration or provision managed number
- **Reference:** CONFIGURATION_CRITICAL_INVARIANTS.md (Rule 4)

**Issue 3: "Failed to decrypt credentials"**
- **Cause:** ENCRYPTION_KEY changed or incorrect
- **Fix:** Restore correct ENCRYPTION_KEY from backup
- **Reference:** CONFIGURATION_CRITICAL_INVARIANTS.md (Section 3)

**Issue 4: "Twilio authentication failed"**
- **Cause:** Invalid Twilio credentials (wrong Account SID or Auth Token)
- **Fix:** Verify credentials at https://console.twilio.com
- **Reference:** Run `npm run validate-env` to test connection

---

**END OF DOCUMENT**

**Version:** 1.0.0
**Last Updated:** February 9, 2026
**Next Review:** March 9, 2026
