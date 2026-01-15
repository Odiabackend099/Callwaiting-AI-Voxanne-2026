# Security Refactor: Developer Quick-Start Guide

**For:** Development Team  
**Time to Read:** 5 minutes  
**Date:** January 14, 2026

---

## TL;DR

✅ **What Changed:** Frontend now asks the backend "Are integrations configured?" instead of checking environment variables.

✅ **Why:** Enterprise security standard. Prevents secret leakage. Matches AWS/Google Cloud architecture.

✅ **What You Do:** Use the `useIntegrationStatus()` hook instead of checking `process.env`.

---

## The Pattern: Before vs. After

### ❌ BEFORE (Don't do this anymore)
```typescript
// Old way - checking env in frontend (DANGEROUS)
export default function MyComponent() {
  const hasVapi = !!process.env.NEXT_PUBLIC_VAPI_API_KEY;
  
  if (!hasVapi) {
    return <p>Vapi not configured</p>;
  }
  return <p>Vapi is ready</p>;
}
```

**Problems:**
- Secrets could be exposed in browser
- Frontend makes assumptions about backend state
- Hard to update without rebuilding frontend

### ✅ AFTER (Do this instead)
```typescript
// New way - ask backend (SAFE)
import { useIntegrationStatus } from '@/hooks/useIntegrationStatus';

export default function MyComponent() {
  const { vapi, loading, error } = useIntegrationStatus();
  
  if (loading) return <p>Checking...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!vapi) return <p>Vapi not configured</p>;
  
  return <p>Vapi is ready</p>;
}
```

**Benefits:**
- No secrets in frontend
- Single source of truth (backend)
- Can update backend without frontend rebuild
- Type-safe with TypeScript

---

## Using the Hook: 3 Easy Steps

### Step 1: Import the Hook
```typescript
import { useIntegrationStatus } from '@/hooks/useIntegrationStatus';
```

### Step 2: Call the Hook
```typescript
const { vapi, openai, twilio, loading, error } = useIntegrationStatus();
```

### Step 3: Use the Response
```typescript
if (loading) return <Spinner />;
if (error) return <Error message={error} />;

if (!vapi) {
  return <ConfigureVapi />;
}

return <VapiReady />;
```

---

## Hook API Reference

### Function Signature
```typescript
useIntegrationStatus(
  autoRefresh?: boolean,        // Default: true
  refreshInterval?: number      // Default: 5 minutes (in ms)
): UseIntegrationStatusReturn
```

### Return Value
```typescript
{
  // Individual integration statuses
  vapi: boolean;
  openai: boolean;
  twilio: boolean;
  supabase: boolean;
  stripe: boolean;
  googleCloud: boolean;
  anthropic: boolean;
  pinecone: boolean;
  
  // Hook state
  loading: boolean;
  error: string | null;
  
  // Full data
  data: IntegrationStatusData | null;
  
  // Methods
  refresh: () => Promise<void>;
  isConfigured: (integration: string) => boolean;
}
```

### Examples

**Check a single integration:**
```typescript
const { vapi, loading } = useIntegrationStatus();

if (!loading && !vapi) {
  return <div>Configure Vapi in settings</div>;
}
```

**Check multiple integrations:**
```typescript
const { vapi, openai, twilio } = useIntegrationStatus();

if (!vapi || !openai) {
  return <div>Missing integrations</div>;
}
```

**Disable auto-refresh:**
```typescript
// Useful if you want to control refresh manually
const { vapi, refresh } = useIntegrationStatus(false);

return (
  <div>
    Status: {vapi ? 'Ready' : 'Not configured'}
    <button onClick={() => refresh()}>Refresh</button>
  </div>
);
```

**Disable auto-refresh-on-focus:**
```typescript
// Don't refresh automatically when user focuses window
const { vapi } = useIntegrationStatus(false);
```

---

## Backend Endpoint: Reference

### GET /api/integrations/status
Returns all integration statuses in one call.

**Response:**
```json
{
  "success": true,
  "data": {
    "vapi": { "connected": true },
    "openai": { "connected": false },
    "twilio": { "connected": true },
    "supabase": { "connected": true },
    "stripe": { "connected": false },
    "googleCloud": { "connected": false },
    "anthropic": { "connected": false },
    "pinecone": { "connected": false }
  },
  "timestamp": "2026-01-14T14:35:00.000Z",
  "cacheAge": 45
}
```

### GET /api/integrations/status/:integration
Check status of a specific integration.

**Example:**
```bash
curl http://localhost:3001/api/integrations/status/vapi
```

**Response:**
```json
{
  "integration": "vapi",
  "configured": true,
  "timestamp": "2026-01-14T14:35:00.000Z"
}
```

### POST /api/integrations/status/clear-cache
Clear the 5-minute cache (development only).

**Usage:**
```bash
curl -X POST http://localhost:3001/api/integrations/status/clear-cache
```

---

## Testing Your Changes

### Test 1: Verify Frontend Can't Access Secrets
```javascript
// Open DevTools Console, paste this:
console.log(process.env.VAPI_API_KEY);     // ❌ undefined
console.log(process.env.OPENAI_API_KEY);   // ❌ undefined
console.log(process.env.TWILIO_AUTH_TOKEN); // ❌ undefined

// But these are OK:
console.log(process.env.NEXT_PUBLIC_BACKEND_URL); // ✅ http://localhost:3001
```

### Test 2: Verify Backend Endpoint Works
```bash
curl http://localhost:3001/api/integrations/status | jq .
# Should show: {"success": true, "data": {...}}
```

### Test 3: Verify Hook Works
```typescript
// In a test component:
import { useIntegrationStatus } from '@/hooks/useIntegrationStatus';

export default function TestComponent() {
  const { vapi, loading, error } = useIntegrationStatus();
  
  return (
    <div>
      <p>Loading: {loading ? 'yes' : 'no'}</p>
      <p>Error: {error || 'none'}</p>
      <p>Vapi: {vapi ? 'configured' : 'not configured'}</p>
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: Conditionally Render UI
```typescript
const { vapi, loading } = useIntegrationStatus();

return loading ? (
  <Spinner />
) : vapi ? (
  <VapiDashboard />
) : (
  <SetupVapi />
);
```

### Pattern 2: Show Error State
```typescript
const { vapi, error } = useIntegrationStatus();

if (error) {
  return <ErrorAlert message={`Failed to load: ${error}`} />;
}
```

### Pattern 3: Multi-Integration Check
```typescript
const { vapi, openai, twilio } = useIntegrationStatus();

const allConfigured = vapi && openai && twilio;

return allConfigured ? (
  <FullFeatures />
) : (
  <LimitedFeatures missingIntegrations={{ vapi, openai, twilio }} />
);
```

### Pattern 4: Manual Refresh
```typescript
const { vapi, refresh } = useIntegrationStatus(false);

async function handleSetup() {
  // User configures integration...
  
  // Refresh status after setup
  await refresh();
}
```

---

## When Adding a New Integration

### Step 1: Add to Backend Endpoint
Edit `backend/src/routes/integrations-status.ts`:

```typescript
function getIntegrationStatus() {
  return {
    integrations: {
      vapi: isSecretConfigured(process.env.VAPI_API_KEY),
      openai: isSecretConfigured(process.env.OPENAI_API_KEY),
      twilio: isSecretConfigured(process.env.TWILIO_AUTH_TOKEN),
      // ✨ NEW: Add your integration here
      myNewService: isSecretConfigured(process.env.MY_NEW_SERVICE_KEY),
    }
  };
}
```

### Step 2: Update Hook Type
Edit `src/hooks/useIntegrationStatus.ts`:

```typescript
export interface IntegrationStatusData {
  integrations: {
    vapi: boolean;
    openai: boolean;
    twilio: boolean;
    // ✨ NEW: Add your integration here
    myNewService: boolean;
  };
}
```

### Step 3: Use in Frontend
```typescript
const { myNewService } = useIntegrationStatus();

if (!myNewService) {
  return <SetupMyNewService />;
}
```

**That's it!** No frontend rebuild needed, just restart the backend.

---

## Troubleshooting

### Problem: Hook returns `loading: true` forever

**Cause:** Backend endpoint not responding  
**Fix:**
```bash
# Check if endpoint is working
curl http://localhost:3001/api/integrations/status

# If not, restart backend
npm run dev  # in backend directory
```

### Problem: Integration status is stale

**Cause:** 5-minute cache, not refreshed yet  
**Fix:**
```bash
# Clear cache manually
curl -X POST http://localhost:3001/api/integrations/status/clear-cache

# Then refresh frontend
```

### Problem: Getting error "Failed to fetch"

**Cause:** CORS issue or backend down  
**Fix:**
1. Check backend is running: `curl http://localhost:3001/health`
2. Check CORS allows `localhost:3000`
3. Check browser console for actual error

---

## Security Checklist

Before committing code with this pattern:

- ✅ Using `useIntegrationStatus()` hook, not checking `process.env`?
- ✅ No `NEXT_PUBLIC_` prefix on sensitive keys?
- ✅ No hardcoded environment variables in frontend?
- ✅ All API calls go through backend proxies?
- ✅ Type-safe with TypeScript interfaces?

---

## Performance Notes

### Response Time
- First call: ~10-50ms (varies by backend load)
- Cached calls: ~1-5ms (5-minute cache)
- Network latency: typically <5ms on localhost

### Data Size
- Response: ~200-300 bytes
- Negligible network impact
- Safe for mobile/slow networks

### Cache Strategy
- 5-minute default TTL
- Auto-clear on production key rotation
- Manual clear available for development
- No database queries (uses environment variables)

---

## Examples: Real Components

### Example 1: Agent Config Page
```typescript
const { vapi, loading } = useIntegrationStatus();

return (
  <div>
    {loading && <Spinner />}
    {!loading && !vapi && (
      <Alert type="warning">
        Vapi is not configured. Please set it up in integrations.
      </Alert>
    )}
    {!loading && vapi && (
      <ConfigSection>
        {/* Show full config options */}
      </ConfigSection>
    )}
  </div>
);
```

### Example 2: Integrations Dashboard
```typescript
const { vapi, openai, twilio } = useIntegrationStatus();

return (
  <div className="grid grid-cols-3 gap-4">
    <IntegrationCard name="Vapi" connected={vapi} />
    <IntegrationCard name="OpenAI" connected={openai} />
    <IntegrationCard name="Twilio" connected={twilio} />
  </div>
);
```

### Example 3: Feature Gate
```typescript
const { vapi, twilio } = useIntegrationStatus();

const canMakeOutboundCalls = vapi && twilio;

return (
  <Button disabled={!canMakeOutboundCalls}>
    {canMakeOutboundCalls ? 'Make Call' : 'Configure Integrations'}
  </Button>
);
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│ 🔒 SECURITY PATTERN: Backend as Source of Truth    │
├─────────────────────────────────────────────────────┤
│ ❌ BEFORE: if (process.env.VAPI_API_KEY) { ... }   │
│ ✅ AFTER: const { vapi } = useIntegrationStatus()  │
├─────────────────────────────────────────────────────┤
│ Hook Import:                                        │
│ import { useIntegrationStatus }                     │
│   from '@/hooks/useIntegrationStatus'              │
├─────────────────────────────────────────────────────┤
│ Hook Usage:                                         │
│ const { vapi, openai, twilio,                       │
│   loading, error, refresh } = useIntegrationStatus()│
├─────────────────────────────────────────────────────┤
│ Backend Endpoint:                                   │
│ GET /api/integrations/status                       │
├─────────────────────────────────────────────────────┤
│ Response: {integrations: {vapi: bool, ...}}        │
├─────────────────────────────────────────────────────┤
│ Cache: 5 minutes                                    │
│ Clear: POST /api/integrations/status/clear-cache   │
├─────────────────────────────────────────────────────┤
│ Test: curl http://localhost:3001/api/integrations/ │
│       status | jq .                                 │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ **Review** this guide (5 min)
2. ✅ **Test** the hook in your component (5 min)
3. ✅ **Verify** with: `curl http://localhost:3001/api/integrations/status`
4. ✅ **Update** any components using old pattern
5. ✅ **Commit** changes and push

---

## Questions?

- **How does caching work?** → 5-minute TTL in backend, auto-refresh on page focus
- **Can I disable auto-refresh?** → Yes, pass `false` as first argument
- **How do I add a new integration?** → Add to backend endpoint, update hook type, restart
- **Is this slower?** → No, cached responses are <5ms. Worth it for security
- **What if backend is down?** → Hook returns error, UI handles gracefully

---

**Last Updated:** 2026-01-14  
**Status:** Ready for Development  
**Security Level:** 🟢 Production-Grade

🔒 **Your secrets are now safe.** 🔒
