# VAPI_API_KEY to VAPI_PRIVATE_KEY Migration - Code Examples

## Before and After Examples

### Example 1: Route Handler (backend/src/routes/assistants.ts)

**Before:**
```typescript
import express from 'express';
import { VapiClient } from '../services/vapi-client';

const vapiApiKey = process.env.VAPI_API_KEY;
if (!vapiApiKey) {
  throw new Error('VAPI_API_KEY is required');
}
```

**After:**
```typescript
import express from 'express';
import { config } from '../config/index';
import { VapiClient } from '../services/vapi-client';

const vapiApiKey = config.VAPI_PRIVATE_KEY;
if (!vapiApiKey) {
  throw new Error('VAPI_PRIVATE_KEY is required');
}
```

### Example 2: Service Handler (backend/src/services/booking-agent-setup.ts)

**Before:**
```typescript
export class BookingAgentSetup {
  constructor(vapiApiKey: string) {
    const key = vapiApiKey || process.env.VAPI_API_KEY;
    if (!key) {
      throw new Error('VAPI_API_KEY is required');
    }
  }
}
```

**After:**
```typescript
import { config } from '../config/index';

export class BookingAgentSetup {
  constructor(vapiApiKey: string) {
    const key = vapiApiKey || config.VAPI_PRIVATE_KEY;
    if (!key) {
      throw new Error('VAPI_PRIVATE_KEY is required');
    }
  }
}
```

### Example 3: Nested Script (backend/src/scripts/test-inbound-setup-refactor.ts)

**Before:**
```typescript
// CRITICAL: This test verifies:
// 1. VAPI_API_KEY is used from environment variables only (not from request body)
// 2. VapiClient constructor reads from VAPI_API_KEY env var
// 3. Backend rejects requests missing VAPI_API_KEY from env

const VAPI_API_KEY = process.env.VAPI_API_KEY;
if (!VAPI_API_KEY) {
  console.error('VAPI_API_KEY not configured');
}
```

**After:**
```typescript
import { config } from '../../config/index';

// CRITICAL: This test verifies:
// 1. VAPI_PRIVATE_KEY is used from environment variables only (not from request body)
// 2. VapiClient constructor reads from VAPI_PRIVATE_KEY env var
// 3. Backend rejects requests missing VAPI_PRIVATE_KEY from env

const VAPI_PRIVATE_KEY = config.VAPI_PRIVATE_KEY;
if (!VAPI_PRIVATE_KEY) {
  console.error('VAPI_PRIVATE_KEY not configured');
}
```

### Example 4: Job Handler (backend/src/jobs/vapi-call-poller.ts)

**Before:**
```typescript
export async function pollVapiCalls() {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VAPI_API_KEY environment variable');
  }
  
  const client = new VapiClient(apiKey);
  // ... rest of implementation
}
```

**After:**
```typescript
import { config } from '../config/index';

export async function pollVapiCalls() {
  const apiKey = config.VAPI_PRIVATE_KEY;
  if (!apiKey) {
    throw new Error('Missing VAPI_PRIVATE_KEY environment variable');
  }
  
  const client = new VapiClient(apiKey);
  // ... rest of implementation
}
```

## Import Path Patterns

The import path varies based on file location:

| File Location | Import Path |
|---|---|
| `backend/src/services/*.ts` | `import { config } from '../config/index';` |
| `backend/src/routes/*.ts` | `import { config } from '../config/index';` |
| `backend/src/jobs/*.ts` | `import { config } from '../config/index';` |
| `backend/src/scripts/*.ts` | `import { config } from '../../config/index';` |
| `backend/scripts/*.ts` | `import { config } from '../src/config/index';` |
| `backend/*.ts` | `import { config } from './src/config/index';` |

## Key Changes Summary

1. **Direct Environment Access**
   - Removed: `process.env.VAPI_API_KEY`
   - Added: `config.VAPI_PRIVATE_KEY`

2. **Import Statements**
   - Added: `import { config } from '../config/index';` (or appropriate relative path)
   - Must be placed after other imports in the file

3. **Error Messages**
   - Updated all references from `VAPI_API_KEY` to `VAPI_PRIVATE_KEY`
   - Ensures consistency in logging and error reporting

4. **Type Safety**
   - The config module provides type-safe access to configuration values
   - Configuration is validated at runtime startup

## Configuration Module Integration

The `config` module (backend/src/config/index.ts) handles:
- Loading environment variables at startup
- Type validation
- Error handling for missing required configuration
- Centralized access point for all environment configuration

All VAPI API key access now goes through this module, ensuring:
- No scattered `process.env` calls throughout the codebase
- Consistent error handling
- Easy auditing of API key usage
- Better security practices
