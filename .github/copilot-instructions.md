# Copilot Instructions for Voxanne AI - 2026

## Quick Context

**Voxanne AI** is a multi-tenant AI Voice-as-a-Service (VaaS) platform for medical clinics. Built with Next.js 14 (frontend), Express (backend), Supabase (DB + RLS), Vapi (voice AI), and Twilio (SMS/calls).

**Critical Architecture Rule**: Backend is the SOLE Vapi provider. ONE `VAPI_PRIVATE_KEY` shared across ALL orgs. Tools registered globally once, linked to orgs via `org_tools` table. **Never give orgs their own Vapi credentials.**

**Development Status (Jan 2026)**: MVP feature-complete. Focus is on production hardening, performance, and HIPAA compliance. 10 core features deployed. Post-launch backlog exists for advanced features.

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

### Starting Development (3-Terminal Setup)
```bash
# Terminal 1: Frontend (port 3000)
npm run dev

# Terminal 2: Backend (port 3001)
cd backend && npm run dev

# Terminal 3: Tunnel Vapi webhooks locally
ngrok http 3001  # Copy public URL and update backend/.env VAPI_WEBHOOK_URL
```

**Note**: Check `backend/.env.example` for required vars. Use `npm run dev:all` from root for concurrent start (recommended).

### Running Tests

**Frontend** (Vitest, happy-dom environment):
```bash
npm run test:frontend          # Run once
npm run test:frontend:watch    # Watch mode
npm run test:frontend:ui       # Test UI dashboard
```

**Backend** (Jest + Vitest, multiple test suits):
```bash
cd backend
npm run test:unit              # Unit tests only (no DB/API)
npm run test:integration       # Integration tests (real DB, services)
npm run test:backend           # Vitest runner
npm run test:backend:watch     # Watch mode
npm run test:backend:coverage  # Coverage report
```

**Performance & Validation**:
```bash
npm run perf:test              # Full suite (DB, API, load)
npm run test:booking           # E2E booking flow (Vitest)
npm run verify:webhook         # Test Vapi webhook integration
```

Key pattern: `__tests__/` directories mirror source structure. Mock external services (Vapi, Twilio, Supabase) for unit tests.

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

### Backend Service Architecture (50+ Services)

Key services in `backend/src/services/`:

| Service | Purpose | Key Pattern |
|---------|---------|------------|
| **vapi-client.ts** | Master Vapi API calls | Uses `VAPI_PRIVATE_KEY` only (backend exclusive) |
| **vapi-assistant-manager.ts** | Create/update/sync Vapi assistants | Auto-creates if missing, idempotent operations |
| **tool-sync-service.ts** | Register tools globally & link to orgs | Fire-and-forget async, auto-hash detection |
| **atomic-booking-service.ts** | Transactional booking with double-booking prevention | SERIALIZABLE isolation, circuit breaker |
| **booking-confirmation-service.ts** | SMS sending + compliance checks | Twilio + PII redaction |
| **org-validation.ts** | JWT verification + org context | Cached 5min, extracts `org_id` from JWT |
| **encryption.ts** | Encrypt/decrypt org credentials (BYOC) | AES-256-GCM, per-org keys |
| **realtime-sync.ts** | WebSocket broadcasts for live updates | Subscriptions scoped to org_id |
| **calendar-integration.ts** | Google Calendar OAuth + slot fetching | Credential refresh + error recovery |
| **webhook-deduplicator.ts** | Prevent duplicate webhook processing | Idempotency table with TTL |
| **logger.ts** | Structured logging with PII redaction | Pino + correlation IDs |

**Pattern**: All services export async functions, use dependency injection for testability, handle their own error logging.

### Frontend Hook Architecture

Key hooks in `src/hooks/mutations/`:

| Hook | Purpose | Pattern |
|------|---------|---------|
| **useSyncMutation.ts** | HTTP mutation with retry + offline support | Auto-generates idempotency key, optimistic UI, exponential backoff |
| **useOrgValidation.ts** | Protect routes by org membership | Extract org_id from JWT, validate URL params |
| **useVoiceAgent.ts** | Vapi agent lifecycle | Handle call state, transcript updates |

**Pattern**: Mutations send `X-Idempotency-Key` header. Failed requests auto-queue to localStorage, sync on reconnect.

### Middleware Stack (Auth, Tenant Validation, Idempotency)

Key middleware in `backend/src/middleware/`:

1. **auth.ts** - JWT validation + 5min cache (reduces Supabase calls 80%)
2. **tenant-resolver.ts** - Validates URL `:orgId` matches JWT org_id (403 if mismatch)
3. **idempotency.ts** - Cache with 60s TTL (mounted on mutations like POST `/api/booking/confirm`)
4. **rate-limit.ts** - Tiered by subscription (starter: 100 req/min, pro: 1000 req/min)

**Critical Pattern**: Middleware runs BEFORE route handlers. Auth extracts org_id once, all downstream code uses it.

### Type Safety & Validation

- **TypeScript strict mode** enabled (`tsconfig.json`)
- **Zod schemas** for input validation (`backend/src/schemas/`)
  - Every route validates request body/params with Zod
  - Example: `const schema = z.object({ orgId: z.string().uuid(), bookingId: z.string().uuid() });`
- **Named exports preferred** (for discoverability in 50+ services)
- **Error types**: Custom `AppError` with status codes, thrown from services, caught by error middleware

### Testing Conventions

**Mock-first approach**:
```bash
# Unit tests (no Supabase, Vapi, or Twilio)
npm run test:unit

# Integration tests (real DB, mocked external APIs)
npm run test:integration
```

**Patterns**:
- Fixtures in test file tops (or `__fixtures__/` subdirs)
- Describe blocks test behavior, not implementation
- Setup/teardown with `beforeEach`/`afterEach`
- Async tests: Always `await` promises
- No external API calls in unit tests (mock everything)

**Example** (`backend/src/__tests__/services/atomic-booking.test.ts`):
```typescript
describe('Atomic Booking', () => {
  let db: any;
  beforeEach(() => {
    db = createMockDb(); // Mock Supabase
  });
  
  it('prevents double-booking with SERIALIZABLE isolation', async () => {
    const slot = { org_id: 'org1', scheduled_at: '2026-02-01T14:00:00Z' };
    
    // Two concurrent attempts for SAME slot
    const results = await Promise.allSettled([
      bookAppointment(slot),
      bookAppointment(slot)
    ]);
    
    // Exactly ONE succeeds, ONE fails
    expect(results[0].status).not.toBe(results[1].status);
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

## Common Developer Tasks

### Agent Save Flow (Critical Pattern - Zero Tolerance for Errors)

**When fixing agent save issues, follow this checklist:**

1. **Input Validation**: Use defensive validation that allows empty/undefined fields
   - Don't reject empty language/voice - use defaults instead
   - Check field existence AND type AND non-empty: `if (field && typeof field === 'string' && field !== '')`
   - Validation errors should throw errors that return HTTP 400, not 500

2. **Payload Building**: Only include fields that are actually provided
   - Skip fields that are `undefined`, `null`, or empty strings
   - Let the database use column defaults for unspecified fields
   - Example: `if (voice && voice !== '') { payload.voice = voice; }`

3. **Error Handling**: Distinguish validation errors from server errors
   - Validation errors (bad input) → HTTP 400
   - Server errors (DB, Vapi, etc.) → HTTP 500
   - Pattern: `const statusCode = error?.message?.includes('Invalid') ? 400 : 500;`

4. **Multi-Field Save**: When saving both inbound and outbound agents
   - Build separate payloads for each agent
   - Only update agents that have payload data
   - Log what was sent and what was saved (verify round-trip)
   - Return 200 on success even if Vapi sync skipped (browser-only mode)

**File to know**: [backend/src/routes/founder-console-v2.ts](backend/src/routes/founder-console-v2.ts) → `POST /agent/behavior` endpoint (line 1881)
1. Create tool definition in `backend/src/config/` (e.g., `my-new-tool.ts`)
2. Update `ToolSyncService.getSystemToolsBlueprint()` to include new tool
3. Add route handler in `backend/src/routes/vapi-tools-routes.ts` (POST `/api/vapi/tools/my-tool`)
4. Create service in `backend/src/services/my-tool-service.ts` with business logic
5. Tools auto-sync on next agent save (no manual Vapi registration needed)
6. Test: `npm run test:integration -- tool-sync-service.test.ts`

**Key Pattern**: Don't register tools per-org. Add to blueprint → backend auto-registers globally → links to all assistants.

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

## Gotchas & Critical Anti-Patterns

### Critical Vapi Architecture Mistakes

1. **Per-Org Vapi Credentials** ❌
   - **Wrong**: Trying to get Vapi credentials from org_credentials table
   - **Right**: Organizations have ZERO Vapi API keys. Backend's `VAPI_PRIVATE_KEY` is shared
   - **Pattern**: `const vapiKey = process.env.VAPI_PRIVATE_KEY;` (backend only, never frontend)

2. **Registering Tools Per Organization** ❌
   - **Wrong**: Calling `registerTool()` once per org (creates duplicates in Vapi)
   - **Right**: Register ONCE globally, save reference in `org_tools` table, link many times
   - **Pattern**: Check if tool exists before registering; use hash detection (Phase 7)

3. **Blocking Agent Save on Tool Sync** ❌
   - **Wrong**: `const result = await ToolSyncService.sync(); return result;` (user waits 2-5s)
   - **Right**: Fire-and-forget async pattern - return immediately, sync in background
   - **Pattern**: `(async () => { await sync(); })();` // Don't await in route handler

4. **Cross-Org Data Access** ❌
   - **Wrong**: Trusting `req.query.orgId` or `req.body.orgId` (can be spoofed)
   - **Right**: Extract org_id from JWT (`req.auth.orgId`), validate against URL params
   - **Pattern**: Middleware validates JWT org_id matches `:orgId` in URL path (403 if mismatch)

5. **Missing RLS Policies** ❌
   - **Wrong**: Querying Supabase without org_id filtering
   - **Right**: ALL tables have RLS enabled; queries auto-filtered by org_id at DB layer
   - **Pattern**: Even if app code forgets org_id, RLS blocks cross-org access

### Other Critical Pitfalls

6. **JWT Token Expiry**: Default 24h TTL. Expired tokens return 401.
7. **Idempotency Key Scope**: Must be unique per user+operation. Don't reuse across endpoints.
8. **Timezone Handling**: Bookings stored in UTC. Frontend converts to local for display.
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

---

## Quick Reference: Key Files Map

| File | Purpose |
|------|---------|
| `backend/src/middleware/auth.ts` | JWT validation + caching (5min TTL) |
| `backend/src/middleware/idempotency.ts` | Request deduplication (60s TTL) |
| `backend/src/middleware/tenant-resolver.ts` | Org isolation enforcement |
| `backend/src/services/tool-sync-service.ts` | Vapi tool registration + linking |
| `backend/src/services/atomic-booking-service.ts` | Double-booking prevention |
| `backend/src/services/vapi-client.ts` | Master Vapi API integration |
| `backend/src/services/vapi-assistant-manager.ts` | Assistant lifecycle management |
| `src/hooks/mutations/useSyncMutation.ts` | Frontend: retry + offline + realtime |
| `backend/src/config/index.ts` | Centralized env var validation |
| `backend/src/services/logger.ts` | Structured logging + PII redaction |

---

**Last Updated**: January 20, 2026  
**Maintained By**: Architecture Team  
**Status**: Production MVP (Jan 2026) - All Core Features Complete ✅  
**Next Review**: Monthly during production hardening phase
