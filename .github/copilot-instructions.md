# Copilot Instructions for CallWaiting AI - Voxanne

## Quick Context

**CallWaiting AI** is an AI voice receptionist platform for medical clinics. It uses Next.js (frontend), Express (backend), Supabase (database), Vapi (voice agent), and Twilio (SMS). The architecture emphasizes **multi-tenant isolation**, **resilience patterns** (idempotency, retry, circuit breaker), and **real-time synchronization**.

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

### 3. **Real-Time Synchronization**
`backend/src/services/realtime-sync.ts` + WebSocket server (`server.ts` line ~600):
- After booking created, emits `RealtimeSyncEvent`
- All connected clients receive update via WebSocket
- UI updates without polling or manual refresh
- Handles client subscriptions per org_id (isolation)

**Frontend Integration** (`src/hooks/mutations/useSyncMutation.ts` line ~434):
- `useOfflineQueueSync()` hook monitors network status
- Auto-syncs offline queue when connection restored
- Realtime events trigger React state updates

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
1. Create service in `backend/src/services/my-new-tool-service.ts`
2. Define Zod schema in `backend/src/schemas/my-new-tool.ts`
3. Add route in `backend/src/routes/vapi-tools-routes.ts` (POST `/api/vapi/tools/my-tool`)
4. Register tool with Vapi: `backend/src/routes/vapi-setup.ts` (add to tool list)
5. Test: `npm run test:integration -- my-new-tool.test.ts`

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
| `backend/src/services/atomic-booking-service.ts` | Booking logic | All-or-nothing atomicity |
| `src/hooks/mutations/useSyncMutation.ts` | Frontend mutations | Retry + offline + realtime |
| `backend/src/services/realtime-sync.ts` | WebSocket events | All clients see changes |
| `backend/src/services/encryption.ts` | Credential encryption | Secure multi-tenant secrets |
| `backend/src/server.ts` | Server setup | All routes + middleware |
| `src/app/(auth)/` | Auth flows | Login, logout, signup |
| `src/app/dashboard/` | Protected pages | Org-specific UI |
| `vitest.config.mjs` | Frontend test config | Happy-DOM, no jsdom |
| `backend/vitest.config.mjs` | Backend test config | Mock-first, fixtures |

---

## Gotchas & Common Pitfalls

1. **JWT Token Expiry**: Default 24h TTL. If testing long-running flows, mock time or refresh manually.
2. **RLS Policies**: Query fails silently if missing org_id in WHERE clause. Always include in Supabase queries.
3. **Idempotency Key Scope**: Must be unique per operation type. Don't reuse across different endpoints.
4. **Timezone Handling**: Bookings use UTC in database. Frontend must convert to user's local timezone.
5. **WebSocket Reconnect**: Clients auto-reconnect after 30s. No manual intervention needed.
6. **Offline Queue Persistence**: Uses localStorage. Won't survive app uninstall. OK for web, consider upgrade for mobile PWA.
7. **Vapi Tool Registration**: Changes require redeploy to Vapi (via setup endpoint). Test locally with mock first.
8. **SMS Rate Limiting**: Twilio has per-account limits. Circuit breaker opens if threshold hit.

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

**Last Updated**: January 17, 2026  
**Maintained By**: Architecture Team  
**Next Review**: When major patterns change (new resilience pattern, new service category, etc.)
