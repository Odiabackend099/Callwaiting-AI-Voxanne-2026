# Copilot Instructions for Voxanne AI - 2026

## Quick Context

**Voxanne AI** is a multi-tenant AI Voice-as-a-Service (VaaS) platform for medical clinics. Built with Next.js (frontend), Express (backend), Supabase (DB + RLS), Vapi (voice AI), and Twilio (SMS). 

**Critical Architecture Rule**: The backend is the SOLE Vapi provider. ONE `VAPI_PRIVATE_KEY` is shared across ALL organizations. Tools are registered globally once, then linked to each org's assistants via the `org_tools` table.

---

## Architecture Overview

### Monorepo Structure
- **`src/`** - Next.js 14 frontend (App Router, `@/` imports)
- **`backend/src/`** - Express.js backend with full business logic
- **`supabase/`** - Database migrations and RLS policies
- **`docs/`** - Architecture and deployment documentation
- **`public/`** - Static assets (images, icons)

### Data Flow Patterns

**Booking Flow Example** (illustrates key patterns):
1. Frontend form → `useSyncMutation()` hook (idempotency key, optimistic UI, retry logic)
2. Backend receives → idempotency middleware checks cache, org validation via JWT
3. Atomic operation → creates booking, triggers SMS via `BookingConfirmationService`
4. WebSocket broadcast → `RealtimeSyncService` notifies all clients of state change
5. Offline support → failed requests queue in `OfflineQueue`, auto-sync on reconnect

**Key Services** (`backend/src/services/`):
- `atomic-booking-service.ts` - Idempotent booking operations with circuit breaker
- `booking-confirmation-service.ts` - SMS sending with compliance checks
- `realtime-sync.ts` - WebSocket broadcasts to sync UI across clients
- `vapi-client.ts` - Integration with Vapi voice agent API
- `encryption.ts` - Encrypt/decrypt org credentials (BYOC model)
- `org-validation.ts` - JWT verification + org context extraction

**Multi-Tenant Model**:
- Every user session validated via JWT + org_id extraction
- Supabase RLS policies enforce org_id isolation at database level
- Encrypted credential storage (BYOC - Bring Your Own Credentials for Twilio, Google Calendar, etc.)
- See: `backend/src/middleware/auth.ts` (JWT cache with TTL), `backend/src/middleware/tenant-resolver.ts`

---

## Critical Patterns & Where They Live

### 1. **Closed-Loop UX Synchronization** (Phase 2 Framework)
Combines idempotency, retry, realtime sync, and offline support.

**Frontend Hook** (`src/hooks/mutations/useSyncMutation.ts`):
- Generates UUID idempotency key automatically
- Sends `X-Idempotency-Key` header on every request
- Implements optimistic UI updates with rollback on error
- Exponential backoff retry (1s → 2s → 4s + jitter, max 30s)
- Auto-adds failed requests to offline queue

**Backend Middleware** (`backend/src/middleware/idempotency.ts`):
- Cache with 60-second TTL prevents duplicate processing
- Returns cached response for identical idempotency key
- Works with any endpoint - just mount middleware

**Example Implementation**:
```typescript
// Frontend
const mutation = useSyncMutation('/api/booking/confirm', {
  maxRetries: 3,
  initialDelayMs: 1000,
  onSuccess: () => showNotification('Booked!'),
  offlineQueueEnabled: true
});

// Backend route
app.post('/api/booking/confirm', createIdempotencyMiddleware(), async (req, res) => {
  const { bookingId } = req.body;
  const booking = await AtomicBookingService.confirm(bookingId);
  // Idempotency middleware auto-caches this response
  res.json(booking);
});
```

### 2. **Error Recovery & Resilience**
Located in `backend/src/utils/error-recovery.ts`:
- **CircuitBreaker** - stops cascading failures (e.g., SMS service outage)
- **retryWithBackoff()** - exponential backoff for retryable errors
- **OfflineQueue** - persists failed requests to localStorage, auto-syncs

Used throughout booking flow to prevent one failing service from blocking others.

### 3. **Vapi Tool Registration Automation** ✅ (ALL 7 PHASES DEPLOYED)

**The "Invisible Hand"**: Automatically registers and links tools for new assistants without manual intervention.

**Critical Pattern**: Backend holds `VAPI_PRIVATE_KEY`. Tools registered globally ONCE, shared across all orgs.

**Main Service** (`backend/src/services/tool-sync-service.ts`):
- `syncAllToolsForAssistant(options)` - Main entry point (async, fire-and-forget)
- `syncSingleTool(orgId, toolDef, backendUrl)` - Register tool with Vapi + save to `org_tools` table
- `registerToolWithRetry(vapi, toolDef, orgId)` - Exponential backoff (2s, 4s, 8s) for Vapi API failures
- `linkToolsToAssistant(vapi, assistantId, toolIds)` - Links tools via `model.toolIds` (modern Vapi pattern)
- `getToolDefinitionHash(toolDef)` - SHA-256 hashing for detecting definition changes (Phase 7)

**Database**: `org_tools` table tracks which orgs use which global tools:
- `org_id`, `tool_name`, `vapi_tool_id`, `definition_hash`, timestamps
- Unique constraint: `(org_id, tool_name)` - prevents duplicates

**Trigger Point**: `/api/founders/save-agent` or assistant creation → async call to `ToolSyncService.syncAllToolsForAssistant()`

**What Happens**:
1. Get system tools blueprint (hardcoded `bookClinicAppointment` for now)
2. Check if already registered globally in `org_tools` table
3. If not: `POST /tool` to Vapi API, capture returned `toolId`
4. Save reference to `org_tools` with hash
5. Link tool to assistant via `PATCH /assistant` with `model.toolIds`
6. Return immediately (don't block agent save response)

**Why This Matters**: No more manual tool setup per org. Deploy once, works for all.

---

### 3.5. **Multi-Tenant Isolation (Defense-in-Depth)**

**Three Layers of Protection**:

1. **JWT Layer**: `backend/src/middleware/auth.ts`
   - Extracts `org_id` from JWT `app_metadata` (server-set, immutable)
   - Caches decoded JWTs (5min TTL) for performance
   - Rejects requests without valid JWT

2. **Application Layer**: `backend/src/middleware/tenant-resolver.ts`
   - Validates URL `:orgId` parameter matches JWT `org_id`
   - Returns 403 if mismatch
   - Example: `GET /api/org/:orgId/bookings` → reject if `:orgId` ≠ JWT org_id

3. **Database Layer**: RLS policies on all multi-tenant tables
   - Supabase PostgreSQL Row-Level Security enforced at DB level
   - Filters all queries: `WHERE org_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'org_id')`
   - Even service role bypasses require explicit org_id parameter

**Critical Test**: Run `npm run test:integration -- multi-tenant-isolation.test.ts` to verify no cross-org data leakage.

---

## Development Workflows

### Starting Development
```bash
# Terminal 1: Frontend (port 3000)
npm run dev

# Terminal 2: Backend (port 3001)
cd backend && npm run dev

# Terminal 3: Expose backend to Vapi webhooks (for local dev)
ngrok http 3001
```

Update backend/.env `VAPI_WEBHOOK_URL` with ngrok public URL.

### Running Tests

**Frontend** (Vitest, happy-dom environment):
```bash
npm run test:frontend          # Run tests once
npm run test:frontend:watch    # Watch mode
npm run test:frontend:ui       # Test UI dashboard
```

**Backend** (Jest + Vitest, multiple configs):
```bash
cd backend
npm run test:unit              # Unit tests (no integration)
npm run test:integration       # Integration tests (databases, APIs)
npm run test:backend:watch     # Vitest watch mode
npm run test:backend:coverage  # Coverage report
```

Test patterns found in `backend/src/__tests__/`:
- Mock-first approach (no external API calls)
- Service mocks in `__mocks__/` subdirs
- Fixtures for test data in each test file

### Building & Deployment

**Frontend**:
```bash
npm run build     # Next.js production build (outputs to .next/)
npm run start     # Run production server (port 3000)
npm run lint      # ESLint check
```

**Backend**:
```bash
cd backend
npm run build     # TypeScript compilation (outputs to dist/)
npm start         # Run compiled server (port 3001)
```

Deployed via:
- Frontend: Vercel (Next.js native)
- Backend: Render (Node.js service)
- Database: Supabase (Postgres + RLS)

---

## Code Conventions & Project-Specific Patterns

### File Organization
```
src/
  ├── app/                    # Next.js pages/routes (App Router)
  ├── components/             # React components (no app logic)
  ├── hooks/                  # React hooks (custom logic)
  │   └── mutations/          # useSyncMutation variants
  ├── contexts/               # React contexts (Auth, Theme, VoiceAgent)
  ├── lib/                    # Utilities (no React)
  ├── types/                  # TypeScript interfaces
  └── __tests__/              # Test files (mirrored structure)

backend/src/
  ├── routes/                 # Express route handlers (~30 routes for Vapi tools, webhooks, etc.)
  ├── services/               # Business logic (50+ services)
  ├── middleware/             # Auth, idempotency, rate-limiting, tenant resolver
  ├── agent-tools/            # AI agent tools (booked-slots, send-sms, etc.)
  ├── agents/                 # LLM prompt orchestration (Groq, Anthropic)
  ├── jobs/                   # Background jobs (job scheduler)
  ├── webhooks/               # Webhook handlers (Vapi, SMS status, etc.)
  ├── config/                 # Centralized config from env vars
  ├── schemas/                # Zod/input validation schemas
  ├── types/                  # TypeScript interfaces
  └── __tests__/              # Test suite (unit, integration, stress)
```

### Import Aliases
- Frontend: `@/*` resolves to `src/`
- Backend: Uses relative paths (no alias)

### Env Variables Structure
**Frontend** (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_VAPI_PUBLIC_KEY
NEXT_PUBLIC_APP_NAME=Voxanne
```

**Backend** (`.env`):
```
NODE_ENV=development
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    # DB access
VAPI_API_KEY, VAPI_PUBLIC_KEY               # Voice agent
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, etc. # SMS (encrypted per-org)
GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET  # OAuth
JWT_SECRET                                 # Session signing
SENTRY_DSN                                 # Error monitoring
```

All sensitive data encrypted per-organization using `encryption.ts`.

### Type Safety
- **TypeScript strict mode** enabled (`tsconfig.json`)
- **Zod schemas** for input validation (`backend/src/schemas/`)
- **SWR for data fetching** (`useSyncMutation` is higher-level wrapper)
- **Named exports preferred** for services/utilities

### Testing Conventions
- **Mock-first**: No external API calls in tests
- **Fixture data**: Define in test file top (or `fixtures/` subdirs)
- **Describe blocks**: Test behavior, not implementation
- **Setup/teardown**: Use `beforeEach`/`afterEach` for isolation
- **Async tests**: Always `await` promises, handle race conditions
- **Integration tests**: Run full request→middleware→service→response cycle

**Example Test** (`backend/src/__tests__/patterns/pattern-library.test.ts`):
```typescript
describe('Idempotency Middleware', () => {
  let middleware: any;
  
  beforeEach(() => {
    middleware = createIdempotencyMiddleware();
    clearIdempotencyCache();
  });
  
  it('returns cached response for duplicate idempotency key', async () => {
    const req = mockRequest({ headers: { 'x-idempotency-key': 'key-1' } });
    const res = mockResponse();
    
    // First call
    await middleware(req, res, () => {
      res.json({ status: 'created' });
    });
    
    // Second call - should use cache
    const res2 = mockResponse();
    await middleware(req, res2, () => {
      res2.json({ status: 'created-again' }); // Won't reach here
    });
    
    expect(res2._getStatusCode()).toBe(200);
    expect(res2._getJSONData()).toEqual({ status: 'created' }); // Cached!
  });
});
```

---

## Integration Points & External Dependencies

### Vapi (Voice Agent)
- **SDK**: `groq-sdk`, `@anthropic-ai/sdk` for LLM integration
- **Webhooks**: `/api/webhooks/vapi` receives call events
- **Tools**: Agent can call backend endpoints (`/api/vapi/tools/*`)
- **Setup**: `backend/src/routes/vapi-setup.ts` registers tools with Vapi API
- **Key Pattern**: Tool execution → service call → idempotent response

### Supabase
- **Auth**: Built-in auth, validated via `verifyAuth()` in middleware
- **DB**: Postgres with RLS policies (Row-Level Security for org isolation)
- **Migrations**: `migrations/` folder, applied via Supabase CLI
- **Client**: `backend/src/services/supabase-client.ts` (service role for backend)

### Twilio (SMS)
- **Per-org credentials**: Stored encrypted in `organization_api_credentials` table
- **Service**: `backend/src/services/twilio-service.ts` decrypts + sends SMS
- **Compliance**: `backend/src/services/sms-compliance-service.ts` checks opt-out lists
- **Webhook**: `/api/webhooks/sms-status` tracks delivery

### Google Calendar (Optional)
- **OAuth flow**: `/api/routes/google-oauth.ts` handles callback
- **Slot fetching**: `backend/src/services/google-calendar-service.ts` queries calendar
- **Integration**: Vapi agent tool calls `/api/vapi/tools/get-calendar-slots`

### WebSocket
- **Server**: `backend/src/services/websocket.ts` manages connections
- **Routes**: Express server upgrades HTTP to WS at `/frontend/stream`
- **Use case**: Real-time booking notifications, call state updates
- **Isolation**: Subscriptions scoped to org_id via auth middleware

---

## Common Tasks

### Adding a New Vapi Agent Tool
1. Create tool definition in `backend/src/config/` (e.g., `my-new-tool.ts`)
2. Update `ToolSyncService.getSystemToolsBlueprint()` to include new tool
3. Add route handler in `backend/src/routes/vapi-tools-routes.ts` (POST `/api/vapi/tools/my-tool`)
4. Create service in `backend/src/services/my-tool-service.ts` with business logic
5. Tools auto-sync on next agent save (no manual Vapi registration needed)
6. Test: `npm run test:integration -- tool-sync-service.test.ts`

**Key Pattern**: Don't register tools per-org. Add to blueprint → backend auto-registers globally → links to all assistants.

### Debugging Vapi Tool Sync Issues

**Tool not registering?**
- Check `VAPI_PRIVATE_KEY` in `.env` (backend must have it)
- Check logs: `grep -i "ToolSyncService" backend logs`
- Verify `org_tools` table exists: `SELECT * FROM org_tools LIMIT 5;` in Supabase SQL editor
- Check Vapi dashboard: https://dashboard.vapi.ai/tools - tools should appear there

**Tool link failed to assistant?**
- Click "Save Agent" again (sync is idempotent, safe to retry)
- Check error in backend logs: `Failed to link tools`
- Fallback: Manually add `toolId` to assistant in Vapi dashboard

**Tool definition changed?**
- Update blueprint in `backend/src/config/`
- New hash will be calculated on next sync
- If hashes differ, tool will be re-registered automatically
- Old tools remain registered, no cleanup needed

### Adding a Dashboard Page
1. Create component in `src/components/dashboard/MyDashboard.tsx` (Client Component with `"use client"`)
2. Create page in `src/app/dashboard/my-page/page.tsx`
3. Protect route: Wrap with `OrgErrorBoundary` component
4. Add org validation: Use `useOrg()` hook to ensure user belongs to org
5. Fetch data: Use `useSyncMutation()` or SWR for API calls
6. Test: `npm run test:frontend -- my-page.test.ts`

### Debugging Multi-Tenant Issues
- Check JWT payload in `browser DevTools → Application → Cookies` (auth token structure)
- Verify org_id in backend logs: `DEBUG_AUTH=true npm run dev` in backend
- Inspect RLS policies: Supabase dashboard → SQL Editor → query `information_schema.role_routine_grants`
- Test isolation: Create two orgs, verify one can't read other's data

### Performance Tuning
- JWT cache stats: `GET /api/internal/auth-cache-stats` (if enabled)
- Circuit breaker status: Check logs for `CircuitBreaker: OPEN` messages
- DB query performance: Enable Supabase query logging, review slow queries
- Frontend: Use Lighthouse, check waterfall in DevTools, profile React with React Profiler

---

## Key Files Reference

| File | Purpose | Key Concept |
|------|---------|-------------|
| `backend/src/middleware/auth.ts` | JWT validation + caching | Trust nothing, cache everything |
| `backend/src/middleware/idempotency.ts` | Deduplication | Same request = same response |
| `backend/src/middleware/tenant-resolver.ts` | Org validation | URL :orgId must match JWT org_id |
| `backend/src/services/tool-sync-service.ts` | Tool registration automation | Global tools, org linking |
| `backend/src/services/atomic-booking-service.ts` | Booking logic | All-or-nothing atomicity |
| `backend/src/services/vapi-client.ts` | Vapi integration | Master Vapi API key usage |
| `backend/src/services/vapi-assistant-manager.ts` | Assistant lifecycle | Create/update assistants |
| `src/hooks/mutations/useSyncMutation.ts` | Frontend mutations | Retry + offline + realtime |
| `backend/src/services/realtime-sync.ts` | WebSocket events | All clients see changes |
| `backend/src/services/encryption.ts` | Credential encryption | Secure multi-tenant secrets |
| `src/app/(auth)/` | Auth flows | Login, logout, signup |
| `src/app/dashboard/` | Protected pages | Org-specific UI |

---

## Gotchas & Common Pitfalls

### Critical Vapi Architecture Mistakes

1. **Per-Org Vapi Credentials** ❌
   - **Wrong**: Trying to get Vapi credentials from org_credentials table
   - **Right**: Organizations have ZERO Vapi API keys. Use backend's `VAPI_PRIVATE_KEY` only
   - **Pattern**: `const vapiKey = process.env.VAPI_PRIVATE_KEY;` (backend only)

2. **Registering Tools Per Organization** ❌
   - **Wrong**: Calling `registerTool()` once per org (creates duplicates in Vapi)
   - **Right**: Register ONCE globally, save reference in `org_tools` table, link many times
   - **Pattern**: Check if tool exists globally before registering

3. **Blocking Agent Save on Tool Sync** ❌
   - **Wrong**: `const result = await ToolSyncService.sync(); return result;` (user waits 2-5s)
   - **Right**: Fire-and-forget async pattern - return immediately, sync in background
   - **Pattern**: `(async () => { await sync(); })();` // Don't await

4. **Tool Definition Changes Not Detected** ❌
   - **Wrong**: Updating tool blueprint but not tracking changes
   - **Right**: Each tool has SHA-256 hash in `definition_hash` column (Phase 7)
   - **Pattern**: Hash changes trigger automatic re-registration with Vapi

### Other Critical Pitfalls

5. **JWT Token Expiry**: Default 24h TTL. If testing long-running flows, mock time or refresh manually.
6. **RLS Policies**: Query fails silently if missing org_id in WHERE clause. Always include in Supabase queries.
7. **Idempotency Key Scope**: Must be unique per operation type. Don't reuse across different endpoints.
8. **Timezone Handling**: Bookings use UTC in database. Frontend must convert to user's local timezone.
9. **WebSocket Reconnect**: Clients auto-reconnect after 30s. No manual intervention needed.
10. **SMS Rate Limiting**: Twilio has per-account limits. Circuit breaker opens if threshold hit.

---

## Performance Targets & Monitoring

- **API latency**: Target <100ms (measured via Sentry APM)
- **JWT cache hit rate**: Target >80%
- **Booking booking-to-confirmation**: <5s (including SMS delivery)
- **WebSocket message delivery**: <1s to all connected clients

Monitor via:
- **Sentry Dashboard** - Error rates, transaction durations, distributed traces
- **Supabase Dashboard** - Query execution times, cache hit rates
- **Browser DevTools** - Network waterfall, React profiler

---

## Documentation
- **Architecture**: See `docs/architecture/` for detailed system design
- **Deployment**: See `docs/deployment/` for Render/Vercel setup
- **API Reference**: See `docs/api/` for endpoint specs
- **Development**: See `docs/development/` for setup & troubleshooting

---

**Last Updated**: January 19, 2026  
**Maintained By**: Architecture Team  
**Status**: Vapi Tool Registration Automation - All 7 Phases Complete ✅  
**Next Review**: When adding new tools or if Vapi API patterns change
