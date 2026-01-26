# Contributing to Voxanne AI

## Fortress Protocol: Credential Access Guidelines

The Voxanne AI backend uses the **Fortress Protocol** - a centralized, type-safe architecture for managing credentials and integrations. This prevents schema bugs and ensures consistent error handling across the entire system.

### ⛔ STRICT RULES: Credential Access

#### DO:
✅ **Use `CredentialService.get(orgId, provider)` for ALL credential access**
```typescript
// ✅ CORRECT - Use CredentialService
import { CredentialService } from './services/credential-service';
import type { ProviderType } from './types/supabase-db';

async function myFunction(orgId: string) {
  try {
    const creds = await CredentialService.get(orgId, 'google_calendar');
    // Use creds.accessToken, creds.refreshToken, etc.
  } catch (error: any) {
    log.error('MyModule', 'Credential fetch failed', { orgId, error: error.message });
    return { success: false, error: 'Please connect Google Calendar in settings' };
  }
}
```

✅ **Import `ProviderType` from `types/supabase-db` for type safety**
```typescript
import type { ProviderType } from '../types/supabase-db';

// This prevents typos like 'google-calendar' or 'twillio'
const provider: ProviderType = 'google_calendar';  // ✅ Type-checked
```

✅ **Handle `CredentialService` errors gracefully with clear user messages**
```typescript
try {
  const creds = await CredentialService.get(orgId, 'twilio');
} catch (error: any) {
  // Return user-friendly message, not raw error
  return res.status(400).json({
    success: false,
    error: error.message  // Already formatted by CredentialService
  });
}
```

✅ **Log credential access with context**
```typescript
log.debug('MyService', 'Attempting credential fetch', { orgId, provider });
const creds = await CredentialService.get(orgId, 'vapi');
log.info('MyService', 'Credentials retrieved', { orgId, provider });
```

#### DON'T:
❌ **NEVER query `org_credentials` table directly**
```typescript
// ❌ WRONG - Direct query bypasses centralization
const { data } = await supabase
  .from('org_credentials')
  .select('encrypted_config')
  .eq('org_id', orgId)
  .eq('provider', 'google_calendar');
```

❌ **NEVER query `integration_settings` or `integrations` tables for credentials**
```typescript
// ❌ WRONG - Deprecated tables
const { data } = await supabase
  .from('integration_settings')
  .select('google_api_key')
  .eq('org_id', orgId);
```

❌ **NEVER use string literals for provider names**
```typescript
// ❌ WRONG - Typos at runtime
const provider = 'google-calendar';  // Should be 'google_calendar'
const provider = 'twillio';          // Typo - should be 'twilio'

// ✅ CORRECT - Type-checked by TypeScript
const provider: ProviderType = 'google_calendar';  // Compiler catches typos
```

❌ **NEVER write `.eq('service_type', ...)` or `.eq('integration_type', ...)`**
```typescript
// ❌ WRONG - Column doesn't exist (was in old schema)
.eq('service_type', 'vapi')
.eq('integration_type', 'twilio_byoc')

// ✅ CORRECT - New schema uses 'provider' column
.eq('provider', 'vapi')
.eq('provider', 'twilio')
```

### Common Patterns

#### Pattern 1: Fetch Credentials in a Service

```typescript
// backend/src/services/my-service.ts
import { CredentialService } from './credential-service';
import { log } from './logger';
import type { ProviderType } from '../types/supabase-db';

export class MyService {
  static async processWithCredentials(orgId: string, provider: ProviderType) {
    try {
      log.info('MyService', 'Starting process', { orgId, provider });

      // Centralized credential fetch
      const creds = await CredentialService.get(orgId, provider);

      // Use credentials...
      await someExternalAPI(creds);

      log.info('MyService', 'Process completed', { orgId, provider });
      return { success: true };
    } catch (error: any) {
      log.error('MyService', 'Process failed', { orgId, provider, error: error.message });
      throw error;  // Let caller handle the error message
    }
  }
}
```

#### Pattern 2: Check if Credentials Exist Before Expensive Operation

```typescript
import { CredentialService } from './credential-service';

// Cheap check - returns boolean
const hasCalendarCreds = await CredentialService.exists(orgId, 'google_calendar');

if (hasCalendarCreds) {
  // Safe to call expensive calendar operations
  const calendar = await getCalendarClient(orgId);
  // Use calendar...
} else {
  // Tell user to connect first
  return { success: false, error: 'Please connect Google Calendar in settings' };
}
```

#### Pattern 3: Use IntegrationDecryptor for Transformed Credentials

If you need provider-specific transformation (field name mappings, token validation, etc.), use `IntegrationDecryptor`:

```typescript
import { IntegrationDecryptor } from './integration-decryptor';

// These methods handle transformation and caching
const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
const twilioCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
const googleCreds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);

// These methods use CredentialService internally, so no double-fetching
```

### Available Providers

```typescript
type ProviderType = 'vapi' | 'twilio' | 'google_calendar' | 'resend' | 'elevenlabs';
```

**DO NOT ADD** providers to database without:
1. Updating `ProviderType` in `backend/src/types/supabase-db.ts`
2. Adding to migration file `CHECK (provider IN ('vapi', ...))` constraint
3. Adding provider-specific transformation method to `IntegrationDecryptor` if needed
4. Testing with `CredentialService.get()` before deployment

### Error Handling

**CredentialService** provides clear, user-facing error messages:

```typescript
// These errors are automatically formatted for users:
"No google_calendar credentials found for organization {orgId}. Please connect in dashboard settings."
"google_calendar integration is disabled for organization {orgId}. Please enable in settings."
"Failed to decrypt google_calendar credentials. Please reconnect in settings."
"Empty credential configuration for google_calendar. Please reconnect in settings."
```

**DO NOT** wrap these errors in additional try-catch blocks unless you're doing something specific with them. Let the error propagate with its message intact.

### Testing

When writing tests that need credentials:

```typescript
// ✅ GOOD: Mock CredentialService
jest.mock('../services/credential-service', () => ({
  CredentialService: {
    get: jest.fn().mockResolvedValue({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: '2099-12-31T23:59:59Z'
    })
  }
}));

// ✅ GOOD: Use IntegrationDecryptor stubs if provider-specific
jest.mock('../services/integration-decryptor', () => ({
  IntegrationDecryptor: {
    getGoogleCalendarCredentials: jest.fn().mockResolvedValue({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: '2099-12-31T23:59:59Z'
    })
  }
}));
```

### Debugging Credential Issues

If a credential fetch is failing:

1. **Check logs for `[CredentialService]` prefix** - This indicates which step failed:
   - "No google_calendar credentials found" → User hasn't connected
   - "Failed to decrypt" → Corruption or encryption key issue
   - "Database error" → RLS or connection issue

2. **Verify org_id** - Most credential issues are org_id mismatches

3. **Check is_active flag** - Credentials might be disabled

4. **Use `CredentialService.getLastError()`** to see previous verification errors:
   ```typescript
   const lastError = await CredentialService.getLastError(orgId, 'google_calendar');
   log.error('LastError', lastError);
   ```

### Migration Guide: Updating Existing Code

If you find code querying credentials directly, refactor it:

**Before:**
```typescript
const { data } = await supabase
  .from('integration_settings')
  .select('twilio_account_sid, twilio_auth_token')
  .eq('org_id', orgId)
  .single();

const accountSid = decrypt(data.twilio_account_sid);
```

**After:**
```typescript
const creds = await IntegrationDecryptor.getTwilioCredentials(orgId);
// or
const rawCreds = await CredentialService.get(orgId, 'twilio');
const accountSid = rawCreds.accountSid || rawCreds.twilio_account_sid;
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Service / Route Handler                                   │
│  (routes/api/*, services/*)                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
                    ✅ USE THIS
                         │
┌─────────────────────────────────────────────────────────────────┐
│  IntegrationDecryptor                                           │
│  - Caches credentials (30s TTL)                                 │
│  - Transforms to provider-specific format                       │
│  - getVapiCredentials()                                         │
│  - getTwilioCredentials()                                       │
│  - getGoogleCalendarCredentials()                               │
│  - etc.                                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
        ⬇️ DELEGATES TO (centralized) ⬇️
                         │
┌─────────────────────────────────────────────────────────────────┐
│  CredentialService                                              │
│  - Single source of truth                                       │
│  - get(orgId, provider) → Raw decrypted config                  │
│  - exists(orgId, provider) → boolean                            │
│  - Type-safe ProviderType union                                 │
│  - Consistent error messages                                    │
│  - Audit logging                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
    ❌ NEVER QUERY DIRECTLY - Use CredentialService ❌
                         │
┌─────────────────────────────────────────────────────────────────┐
│  org_credentials table (Supabase)                               │
│  - id, org_id, provider, encrypted_config, is_active, etc.      │
│  - Single source of truth in database                           │
│  - Row-level security (RLS) enforced                            │
└─────────────────────────────────────────────────────────────────┘
```

### When in Doubt

1. **Is this credential-related?** → Use `CredentialService`
2. **Do I need provider-specific transformation?** → Use `IntegrationDecryptor`
3. **Do I need just a quick boolean check?** → Use `CredentialService.exists()`
4. **Should I query the database directly?** → NO (unless you're updating org_credentials, which should also be centralized)

## Git Hook: Pre-Commit Credential Checks

A pre-commit hook prevents credential-related bugs:

```bash
# Prevents hardcoded secrets
# Prevents typos like 'service_type' instead of 'provider'
# Prevents imports from deprecated tables

# The hook is in: .git/hooks/pre-commit
# Violations will block your commit
```

## Questions?

If credential access isn't clear:
1. Check existing usage in `backend/src/services/`
2. Review `CredentialService` documentation in `backend/src/services/credential-service.ts`
3. Look at `IntegrationDecryptor` for provider-specific examples
4. Ask in code review if unsure

**Remember:** The Fortress Protocol exists to prevent bugs through architecture, not to slow you down. Use it with confidence! 🏰
