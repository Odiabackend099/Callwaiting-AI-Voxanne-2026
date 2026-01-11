# BYOC Implementation - Quick Reference Guide

## For Developers: How to Use the New System

### 1. Getting Vapi Credentials

**Old Way** (❌ NO LONGER WORKS):
```typescript
const apiKey = process.env.VAPI_API_KEY;
```

**New Way** (✅ REQUIRED):
```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

const orgId = req.user.orgId; // from authenticated request
const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
const apiKey = vapiCreds.apiKey;
```

---

### 2. Getting Twilio Credentials

**Old Way** (❌ NO LONGER WORKS):
```typescript
const credentials = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
};
```

**New Way** (✅ REQUIRED):
```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

const orgId = req.user.orgId;
const twilioCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
// twilioCreds.accountSid, .authToken, .phoneNumber
```

---

### 3. Sending SMS

**Old Way** (❌ NO LONGER WORKS):
```typescript
import { sendSmsTwilio } from '../services/twilio-service';
sendSmsTwilio({ to: '+1234567890', message: 'Hello' });
```

**New Way** (✅ REQUIRED):
```typescript
import { sendSmsTwilio } from '../services/twilio-service';
import { IntegrationDecryptor } from '../services/integration-decryptor';

const twilioCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
const result = await sendSmsTwilio(
  { to: '+1234567890', message: 'Hello' },
  twilioCreds  // <-- NOW REQUIRED
);
```

---

### 4. Handling Vapi Webhooks

**Old Way** (❌ Insecure, no org isolation):
```typescript
// Only used global webhook secret
const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
```

**New Way** (✅ Org-specific secrets):
```typescript
import { resolveOrgFromWebhook, verifyVapiWebhookSignature } from '../utils/webhook-org-resolver';

// Step 1: Resolve org from webhook
const orgContext = await resolveOrgFromWebhook(req);
if (!orgContext) {
  return res.status(400).json({ error: 'Cannot resolve organization' });
}

const orgId = orgContext.orgId;

// Step 2: Verify signature with org-specific secret
const isValid = await verifyVapiWebhookSignature(req, orgId);
if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}

// Step 3: Now process webhook for this org
```

---

### 5. Creating/Updating Vapi Assistants

**New Way** (✅ Idempotent, prevents duplicates):
```typescript
import { VapiAssistantManager } from '../services/vapi-assistant-manager';

const orgId = req.user.orgId;

// This will:
// 1. Check if assistant exists
// 2. Update if exists, create if not
// 3. Register in mapping table
const result = await VapiAssistantManager.ensureAssistant(
  orgId,
  'inbound',
  {
    name: 'My Assistant',
    systemPrompt: 'You are helpful.',
    voiceId: 'Paige',
    maxDurationSeconds: 600,
  }
);

const assistantId = result.assistantId;
console.log(`Assistant ID: ${assistantId}`);
console.log(`Is new: ${result.isNew}`);
console.log(`Was deleted: ${result.wasDeleted}`);
```

---

### 6. Resolving Org from Assistant ID

**Use in webhook handlers or background jobs**:
```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

const vapiMessage = { assistantId: 'asst_abc123' };

// Fast O(1) lookup with caching
const orgId = await IntegrationDecryptor.resolveOrgFromAssistant(
  vapaMessage.assistantId
);

if (!orgId) {
  console.error('Unknown assistant');
  return;
}

console.log(`Processing for org: ${orgId}`);
```

---

### 7. Storing New Credentials

**When user configures integration**:
```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

const orgId = req.user.orgId;
const { apiKey, webhookSecret } = req.body;

// Automatically encrypted and stored
await IntegrationDecryptor.storeCredentials(
  orgId,
  'vapi',
  {
    apiKey: apiKey,
    webhookSecret: webhookSecret,
  }
);

console.log('Credentials stored securely');
```

---

### 8. Verifying Credentials

**Test connection before storing**:
```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

const result = await IntegrationDecryptor.verifyCredentials(orgId, 'vapi');

if (result.success) {
  console.log(`Connected! Last verified: ${result.lastVerified}`);
} else {
  console.error(`Connection failed: ${result.error}`);
}
```

---

### 9. Cache Invalidation

**When credentials are updated**:
```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

// Invalidate specific provider
IntegrationDecryptor.invalidateCache(orgId, 'vapi');

// Or invalidate all for org
IntegrationDecryptor.invalidateCache(orgId);

console.log('Cache cleared, next access will fetch from DB');
```

---

## Common Patterns

### Pattern 1: Webhook Handler with SMS Notification

```typescript
import { resolveOrgFromWebhook } from '../utils/webhook-org-resolver';
import { getSmsCredentialsForOrg } from '../utils/webhook-org-resolver';
import { sendSmsTwilio } from '../services/twilio-service';

async function handleWebhook(req: any) {
  // Step 1: Resolve org
  const orgContext = await resolveOrgFromWebhook(req);
  if (!orgContext) throw new Error('Unknown org');

  const orgId = orgContext.orgId;

  // Step 2: Get SMS credentials for this org
  const smsCreds = await getSmsCredentialsForOrg(orgId);
  if (!smsCreds) throw new Error('SMS not configured');

  // Step 3: Send SMS with org credentials
  const result = await sendSmsTwilio(
    { to: '+1234567890', message: 'Call completed' },
    smsCreds
  );

  console.log(`SMS sent: ${result.message_sid}`);
}
```

### Pattern 2: API Endpoint for Configuration

```typescript
import express from 'express';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { VapiAssistantManager } from '../services/vapi-assistant-manager';

router.post('/configure-vapi', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { apiKey, systemPrompt, voiceId } = req.body;

    // Step 1: Store credentials (encrypted)
    await IntegrationDecryptor.storeCredentials(orgId, 'vapi', {
      apiKey: apiKey,
    });

    // Step 2: Create/update assistant
    const result = await VapiAssistantManager.ensureAssistant(
      orgId,
      'inbound',
      {
        name: 'Inbound Agent',
        systemPrompt: systemPrompt,
        voiceId: voiceId || 'Paige',
      }
    );

    // Step 3: Return success
    res.json({
      success: true,
      assistantId: result.assistantId,
      isNew: result.isNew,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### Pattern 3: Background Job with Org Isolation

```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

async function processCallBacklog() {
  const calls = await fetchUnprocessedCalls();

  for (const call of calls) {
    try {
      // Resolve org from assistant
      const orgId = await IntegrationDecryptor.resolveOrgFromAssistant(
        call.assistantId
      );

      if (!orgId) {
        console.warn(`Skipping call ${call.id}: unknown org`);
        continue;
      }

      // Get org-specific credentials
      const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);

      // Process with org's Vapi account
      await processCall(call, vapiCreds);
    } catch (error) {
      console.error(`Failed to process call ${call.id}:`, error);
    }
  }
}
```

---

## Error Handling

### Missing Credentials

```typescript
try {
  const creds = await IntegrationDecryptor.getTwilioCredentials(orgId);
} catch (error) {
  // Error message: "twilio credentials not found for org {orgId}"
  // Action: Tell user to configure Twilio in settings
}
```

### Invalid/Expired Google Token

```typescript
try {
  const creds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
} catch (error) {
  // Error message: "Google Calendar token expired"
  // Action: Tell user to reconnect Google account
}
```

### Failed Vapi Connection

```typescript
const result = await IntegrationDecryptor.verifyCredentials(orgId, 'vapi');

if (!result.success) {
  console.error(`Vapi verification failed: ${result.error}`);
  // Action: Notify user, update verification_error in DB
}
```

---

## Testing

### Test IntegrationDecryptor

```typescript
import { IntegrationDecryptor } from '../services/integration-decryptor';

it('should encrypt and decrypt credentials', async () => {
  const orgId = 'test-org-123';
  const creds = { apiKey: 'test-key-abc' };

  // Store
  await IntegrationDecryptor.storeCredentials(orgId, 'vapi', creds);

  // Retrieve
  const retrieved = await IntegrationDecryptor.getVapiCredentials(orgId);

  expect(retrieved.apiKey).toBe('test-key-abc');
});

it('should cache credentials', async () => {
  const start1 = Date.now();
  await IntegrationDecryptor.getVapiCredentials(orgId);
  const duration1 = Date.now() - start1;

  const start2 = Date.now();
  await IntegrationDecryptor.getVapiCredentials(orgId);
  const duration2 = Date.now() - start2;

  expect(duration2).toBeLessThan(duration1 / 10); // 10x faster
});
```

### Test Webhook Resolution

```typescript
it('should resolve org from webhook', async () => {
  const req = {
    body: { assistantId: 'asst_abc123' },
    headers: { 'x-vapi-signature': '...', 'x-vapi-timestamp': '...' },
  };

  const context = await resolveOrgFromWebhook(req);

  expect(context?.orgId).toBe('org-xyz');
  expect(context?.assistantId).toBe('asst_abc123');
});
```

---

## Debugging Tips

### Cache Stats

```typescript
const stats = IntegrationDecryptor.getCacheStats();
console.log(`Cache: ${stats.size}/${stats.maxSize} (${stats.usage})`);
```

### Logs to Watch

```
[IntegrationDecryptor] Cache hit
[IntegrationDecryptor] Credentials retrieved
[IntegrationDecryptor] Cache invalidated
[webhook-org-resolver] Successfully resolved org from webhook
[webhook-org-resolver] Webhook signature verified
```

### Common Issues

| Issue | Check |
|-------|-------|
| Credentials not found | Is org_id correct? Are credentials stored? |
| Cache not working | Check cache TTL (5 min), is cache invalidated? |
| Signature fails | Is webhook secret stored for org? |
| Assistant not found | Is assistant_id in mapping table? |

---

## Migration Checklist

Before going live:

- [ ] All migrations applied
- [ ] org_credentials table has data
- [ ] assistant_org_mapping table populated
- [ ] Old tables still exist (backup)
- [ ] IntegrationDecryptor works
- [ ] VapiAssistantManager works
- [ ] Webhooks resolve org
- [ ] SMS sends with new credentials
- [ ] Tests pass

---

**Phase 1 Complete** ✅

**Next**: Integrations API Endpoints (Phase 2)
