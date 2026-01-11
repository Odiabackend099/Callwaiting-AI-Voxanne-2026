# Multi-Tenant BYOC Implementation Guide

Complete guide for deploying and maintaining the Multi-Tenant BYOC system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Setup](#database-setup)
3. [Backend Configuration](#backend-configuration)
4. [Frontend Setup](#frontend-setup)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Design

```
User Browser
    ↓ HTTPS
Frontend (Next.js)
├─ IntegrationsDashboard
├─ IntegrationCard (x5)
├─ VapiCredentialForm
├─ TwilioCredentialForm
└─ GoogleCalendarOAuthForm
    ↓ JWT Auth
Backend API (Express)
├─ POST /api/integrations/vapi
├─ POST /api/integrations/twilio
├─ GET /api/integrations/status
├─ POST /api/integrations/:provider/verify
└─ DELETE /api/integrations/:provider
    ↓
Services Layer
├─ IntegrationDecryptor (credentials + caching)
├─ VapiAssistantManager (assistant lifecycle)
├─ TwilioService (SMS/WhatsApp)
└─ GoogleOAuthService (calendar auth)
    ↓
Database (Supabase PostgreSQL)
├─ org_credentials (encrypted credentials)
├─ assistant_org_mapping (webhook routing)
└─ RLS Policies (org isolation)
```

### Key Principles

1. **Multi-Tenant Isolation**: Each organization has isolated credentials and assistants
2. **Encryption at Rest**: All credentials encrypted with AES-256-GCM before storage
3. **No Master Keys**: Backend doesn't own API keys, only borrows them from database
4. **Stateless Processing**: Any instance can process any webhook (no local credential state)
5. **Fast Lookups**: O(1) assistant-to-org mapping enables webhook processing <50ms

---

## Database Setup

### 1. Apply Migrations

```bash
# Ensure you're in the backend directory
cd backend

# Apply Phase 1 migrations
supabase migration up

# Verify migrations applied
psql $DATABASE_URL -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('org_credentials', 'assistant_org_mapping', 'outbound_agent_config')
;"
```

### 2. Expected Tables After Migration

#### org_credentials
```sql
CREATE TABLE org_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  provider TEXT NOT NULL CHECK (provider IN ('vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs')),
  encrypted_config TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  verification_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

CREATE INDEX idx_org_credentials_org_id ON org_credentials(org_id);
CREATE INDEX idx_org_credentials_provider ON org_credentials(provider);

-- RLS Policies
ALTER TABLE org_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_credentials_select ON org_credentials
  FOR SELECT USING (org_id = auth.org_id());

CREATE POLICY org_credentials_insert ON org_credentials
  FOR INSERT WITH CHECK (org_id = auth.org_id());

CREATE POLICY org_credentials_update ON org_credentials
  FOR UPDATE USING (org_id = auth.org_id());

CREATE POLICY org_credentials_delete ON org_credentials
  FOR DELETE USING (org_id = auth.org_id());

CREATE POLICY org_credentials_service_role ON org_credentials
  FOR ALL TO service_role USING (true);
```

#### assistant_org_mapping
```sql
CREATE TABLE assistant_org_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_assistant_id TEXT UNIQUE NOT NULL,
  org_id UUID NOT NULL REFERENCES orgs(id),
  assistant_role TEXT CHECK (assistant_role IN ('inbound', 'outbound')),
  assistant_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vapi_assistant_id)
);

CREATE INDEX idx_assistant_mapping_org_id ON assistant_org_mapping(org_id);
CREATE INDEX idx_assistant_mapping_assistant_id ON assistant_org_mapping(vapi_assistant_id);

-- RLS Policies
ALTER TABLE assistant_org_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_mapping_select ON assistant_org_mapping
  FOR SELECT USING (org_id = auth.org_id());

CREATE POLICY assistant_mapping_insert ON assistant_org_mapping
  FOR INSERT WITH CHECK (org_id = auth.org_id());

CREATE POLICY assistant_mapping_service_role ON assistant_org_mapping
  FOR ALL TO service_role USING (true);
```

### 3. Verify RLS Policies

```bash
# Check RLS is enabled
psql $DATABASE_URL -c "
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('org_credentials', 'assistant_org_mapping')
;"

# Should return 'true' for rowsecurity
```

### 4. Backfill Data (if migrating from old tables)

```sql
-- Migrate Vapi credentials from old integrations table
INSERT INTO org_credentials (org_id, provider, encrypted_config, is_active)
SELECT
  org_id,
  'vapi' as provider,
  encrypted_config,
  true
FROM integrations
WHERE provider = 'vapi'
ON CONFLICT (org_id, provider) DO NOTHING;

-- Populate assistant mappings
INSERT INTO assistant_org_mapping (vapi_assistant_id, org_id, assistant_role, assistant_name)
SELECT
  vapi_assistant_id,
  org_id,
  'inbound' as assistant_role,
  'Inbound Agent'
FROM agents
WHERE vapi_assistant_id IS NOT NULL
ON CONFLICT (vapi_assistant_id) DO NOTHING;
```

---

## Backend Configuration

### 1. Environment Variables

Create `.env.local` in backend directory:

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Encryption
ENCRYPTION_KEY=... # 32-byte hex string (use process.env directly, never in .env)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Vapi Configuration
VAPI_API_KEY=... # Only for server-to-server calls, not stored here normally
VAPI_WEBHOOK_SECRET=... # Default webhook secret (org-specific overrides this)

# Twilio Configuration
TWILIO_ACCOUNT_SID=... # Only for testing, each org brings their own
TWILIO_AUTH_TOKEN=... # Only for testing

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google-calendar/callback

# Resend
RESEND_API_KEY=... # Only for testing

# ElevenLabs
ELEVENLABS_API_KEY=... # Only for testing

# Server
PORT=3000
NODE_ENV=development
```

### 2. Verify Imports

Ensure these are imported in your main server file:

```typescript
import { integrationsRouter } from './routes/integrations-byoc';
import { IntegrationDecryptor } from './services/integration-decryptor';
import { VapiAssistantManager } from './services/vapi-assistant-manager';

// Register router
app.use('/api/integrations', integrationsRouter);

// Initialize services (they handle their own caching)
// No explicit initialization needed, they lazy-load on first use
```

### 3. Test Backend Endpoints

```bash
# Start backend server
npm run dev

# In another terminal, test status endpoint
curl -X GET http://localhost:3000/api/integrations/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response (org has no integrations yet):
{
  "success": true,
  "data": {
    "vapi": { "connected": false },
    "twilio": { "connected": false },
    "googleCalendar": { "connected": false },
    "resend": { "connected": false },
    "elevenlabs": { "connected": false }
  }
}
```

---

## Frontend Setup

### 1. Component Files

Ensure these files exist in your project:

```
src/components/integrations/
├─ IntegrationCard.tsx (280 lines)
├─ VapiCredentialForm.tsx (250 lines)
├─ TwilioCredentialForm.tsx (270 lines)
└─ GoogleCalendarOAuthForm.tsx (200 lines)

src/app/dashboard/
└─ integrations/
   └─ page.tsx (280 lines)
```

### 2. Verify Imports in Dashboard

```typescript
// src/app/dashboard/integrations/page.tsx
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { VapiCredentialForm } from '@/components/integrations/VapiCredentialForm';
import { TwilioCredentialForm } from '@/components/integrations/TwilioCredentialForm';
import { GoogleCalendarOAuthForm } from '@/components/integrations/GoogleCalendarOAuthForm';
```

### 3. Test Frontend Components

```bash
# Start frontend
npm run dev

# Navigate to http://localhost:3000/dashboard/integrations

# Expected:
# - See 5 integration cards (Vapi, Twilio, Google Calendar, Resend, ElevenLabs)
# - All show "Not Configured" state
# - Refresh button visible
# - No errors in browser console
```

### 4. Test Credential Form

```bash
# In browser console:
# 1. Click "Configure" on Vapi card
# 2. Modal should appear with:
#    - API Key input field
#    - Webhook Secret input field
#    - Info boxes
#    - Test & Save button
# 3. Try entering invalid API key (too short)
#    - Should show error before submission
# 4. Close modal with X button
#    - Modal should disappear
```

---

## Testing

### 1. Unit Tests

```bash
# Run IntegrationDecryptor tests
npm run test -- integration-decryptor.test.ts

# Expected output:
# PASS backend/src/services/__tests__/integration-decryptor.test.ts
#   IntegrationDecryptor
#     getVapiCredentials
#       ✓ should retrieve and decrypt Vapi credentials
#       ✓ should throw error when credentials not found
#       ✓ should cache credentials for faster access
#   ...
#   Test Files  1 passed (1)
#   Tests  25 passed (25)
#   Duration  1.23s
```

### 2. Integration Tests

```bash
# Run credential flow tests
npm run test:integration -- credential-flow.integration.test.ts

# Expected output:
# PASS backend/src/__tests__/integration/credential-flow.integration.test.ts
#   Credential Flow Integration Tests
#     Single-Tenant Credential Storage and Retrieval
#       ✓ should store and retrieve Vapi credentials
#       ✓ should store and retrieve Twilio credentials
#   Multi-Tenant Isolation
#       ✓ should isolate Vapi credentials between orgs
#       ✓ should prevent access to other org credentials
#   ...
#   Test Files  1 passed (1)
#   Tests  30 passed (30)
#   Duration  5.42s
```

### 3. Manual Testing Checklist

#### Vapi Integration
- [ ] Click "Configure" on Vapi card
- [ ] Enter valid Vapi API key (from console.vapi.ai)
- [ ] Enter webhook secret (optional)
- [ ] Click "Test & Save"
- [ ] See success message with assistant IDs
- [ ] Modal auto-closes
- [ ] Vapi card shows "Connected" state
- [ ] Click "Test Connection" button
- [ ] See success or error
- [ ] Click "Disconnect"
- [ ] Card returns to "Not Configured" state

#### Twilio Integration
- [ ] Click "Configure" on Twilio card
- [ ] Enter Account SID from Twilio Console
- [ ] Enter Auth Token
- [ ] Enter SMS phone number (+12025551234 format)
- [ ] Phone number auto-formats as you type
- [ ] Click "Test & Save"
- [ ] See success with masked phone
- [ ] Twilio card shows "Connected"
- [ ] (Repeat Vapi tests for disconnect/reconnect)

#### Status API
- [ ] Configure Vapi integration
- [ ] Check `/api/integrations/status` in browser
- [ ] Should show vapi: connected=true, lastVerified=timestamp
- [ ] Disconnect Vapi
- [ ] Refresh status API
- [ ] Should show vapi: connected=false

#### Multi-Tenant Isolation
- [ ] Login as Org A, configure Vapi
- [ ] Login as Org B, status should show empty
- [ ] Configure Vapi with different key for Org B
- [ ] Both orgs show as connected
- [ ] Each org has independent status

---

## Deployment

### 1. Pre-Deployment Checklist

- [ ] All tests passing (unit + integration)
- [ ] No TypeScript errors
- [ ] Environment variables set in production
- [ ] Database migrations applied to production
- [ ] RLS policies verified
- [ ] Backup of current system taken
- [ ] Rollback plan documented

### 2. Database Migration (Production)

```bash
# 1. Backup current database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Apply migrations (in order)
supabase migration up \
  --project-ref lbjymlodxprzqgtyqtcq

# 3. Verify tables created
psql $DATABASE_URL -c "\dt public.org_*"

# 4. Verify RLS enabled
psql $DATABASE_URL -c "
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE tablename IN ('org_credentials', 'assistant_org_mapping')
"

# 5. Test a credential insert
# (Via backend using IntegrationDecryptor.storeCredentials())
```

### 3. Backend Deployment

```bash
# 1. Build backend
npm run build

# 2. Deploy to production server
# (Via your deployment pipeline: GitHub Actions, Vercel, etc.)

# 3. Verify environment variables
echo $ENCRYPTION_KEY  # Should output 64-char hex string
echo $SUPABASE_SERVICE_ROLE_KEY  # Should be set

# 4. Restart backend service
systemctl restart voxanne-backend

# 5. Test endpoints
curl -X GET https://api.voxanne.ai/api/integrations/status \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 4. Frontend Deployment

```bash
# 1. Build frontend
npm run build

# 2. Export static site or deploy to Vercel
vercel deploy --prod

# 3. Verify components loaded
# - Visit https://app.voxanne.ai/dashboard/integrations
# - Should see 5 integration cards
# - No errors in browser console
```

### 5. Post-Deployment Validation

```bash
# 1. Test each endpoint
./test-integrations-api.sh

# 2. Test credential storage
curl -X POST https://api.voxanne.ai/api/integrations/vapi \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sk_test_...", "webhookSecret":"whs_test_..."}'

# Expected: { "success": true, "data": { "inboundAssistantId": "...", ... } }

# 3. Test credential retrieval
curl -X GET https://api.voxanne.ai/api/integrations/status \
  -H "Authorization: Bearer $JWT_TOKEN"

# Expected: { "success": true, "data": { "vapi": { "connected": true, ... } } }

# 4. Check logs for errors
tail -f /var/log/voxanne-backend.log | grep -i error

# 5. Monitor webhook latency
# (Should see <50ms overhead in logs)
```

### 6. Rollback Plan

If issues occur:

```bash
# 1. Revert to previous backend deployment
git revert HEAD
npm run build
# Deploy previous version

# 2. Restore database (if needed)
psql $DATABASE_URL < backup-20260111-120000.sql

# 3. Disable new API routes (if partial rollback needed)
# Comment out: import { integrationsRouter } from './routes/integrations-byoc'

# 4. Restart backend
systemctl restart voxanne-backend

# 5. Notify users if any outage occurred
```

---

## Monitoring

### 1. Key Metrics to Monitor

```
Backend Performance:
├─ API response time: /api/integrations/status (target: <100ms)
├─ Cache hit rate: (target: >95%)
├─ Database query count: (target: <3 per request)
└─ Error rate: (target: <0.1%)

Webhook Processing:
├─ Latency: from org resolution to response (target: <50ms)
├─ Signature verification failures: (watch for spikes)
├─ Assistant lookup time: (target: <10ms)
└─ Invalid assistant IDs: (watch for unknown assistants)

Credential Verification:
├─ Vapi connection tests: success rate (target: >95%)
├─ Twilio connection tests: success rate (target: >95%)
├─ Google token refreshes: success rate (target: >99%)
└─ Verification error count: (watch for credential issues)

Database:
├─ org_credentials row count: (should grow slowly)
├─ assistant_org_mapping row count: (1-2 per org)
└─ RLS policy enforcement: (every query should be isolated by org)
```

### 2. Logging

Enable structured logging:

```typescript
// In IntegrationDecryptor.getVapiCredentials()
log.info('integrations', 'Retrieved Vapi credentials', {
  orgId,
  cacheHit,
  duration: endTime - startTime
});

// In webhook handler
log.info('webhook', 'Processing Vapi webhook', {
  assistantId,
  resolvedOrgId,
  signatureValid,
  duration: endTime - startTime
});

// On error
log.error('integrations', 'Credential verification failed', {
  orgId,
  provider,
  error: error.message,
  // Never log actual credentials!
});
```

### 3. Alerts to Set Up

```yaml
alerts:
  - name: "High API Error Rate"
    condition: "error_rate > 1%"
    severity: "critical"

  - name: "Cache Hit Rate Low"
    condition: "cache_hit_rate < 90%"
    severity: "warning"

  - name: "Webhook Signature Failures"
    condition: "signature_failures > 10 in 5m"
    severity: "warning"

  - name: "Credential Verification Failures"
    condition: "verification_failures > 20% in 1h"
    severity: "high"

  - name: "Database Connection Errors"
    condition: "db_errors > 0 in 5m"
    severity: "critical"

  - name: "Unknown Assistant IDs"
    condition: "unknown_assistants > 5 in 1h"
    severity: "warning"
```

---

## Troubleshooting

### Issue: Credentials not storing

**Symptoms**: POST to `/api/integrations/vapi` returns 500 error

**Diagnosis**:
```bash
# Check ENCRYPTION_KEY is set
echo $ENCRYPTION_KEY

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check RLS policy allows insert
psql $DATABASE_URL -c "
  SELECT * FROM pg_policies
  WHERE tablename = 'org_credentials'
"

# Check org_id in JWT matches an existing org
```

**Solution**:
1. Verify `ENCRYPTION_KEY` environment variable is 64 characters (32 bytes hex)
2. Verify database connection working
3. Verify `org_id` in JWT token matches an org in database
4. Check backend logs for detailed error

### Issue: Credentials not retrieving

**Symptoms**: GET `/api/integrations/status` shows empty

**Diagnosis**:
```bash
# Query database directly
psql $DATABASE_URL -c "
  SELECT org_id, provider, is_active FROM org_credentials
  LIMIT 5;
"

# Check cache (in browser DevTools)
// In frontend console:
console.log(IntegrationDecryptor.getCacheStats())

# Check RLS policy
psql $DATABASE_URL -c "
  SELECT * FROM org_credentials
  WHERE org_id = 'org-123';
"
```

**Solution**:
1. Verify credentials stored (query org_credentials table)
2. Verify `is_active = true` in database
3. Verify RLS policy allows SELECT for this org
4. Clear browser cache (hard refresh)
5. Clear backend cache: `IntegrationDecryptor.invalidateCache(orgId)`

### Issue: Webhook signature verification failing

**Symptoms**: Webhook returns 401 "Invalid signature"

**Diagnosis**:
```bash
# Check webhook secret stored
psql $DATABASE_URL -c "
  SELECT provider, last_verified_at FROM org_credentials
  WHERE org_id = 'org-123' AND provider = 'vapi'
"

# Verify signature calculation in logs
# Look for: [webhook-org-resolver] Webhook signature verified

# Check timestamp skew (Vapi allows ~5 minutes)
echo "Server time:" $(date)
```

**Solution**:
1. Verify webhook secret stored in `org_credentials` table
2. Verify timestamp in request is within 5 minutes of server time
3. Check webhook secret matches Vapi console
4. Verify signature calculation includes full request body
5. Enable debug logging: `WEBHOOK_DEBUG=1`

### Issue: Vapi assistants not being created

**Symptoms**: API returns success but no assistants in Vapi console

**Diagnosis**:
```typescript
// Check VapiAssistantManager logs
log.info('vapi-assistant-manager', 'Creating assistant', {
  orgId,
  role,
  name
});

// Verify Vapi credentials are valid
const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
console.log(vapiCreds.apiKey); // Should start with 'sk_'

// Check assistant in mapping table
psql $DATABASE_URL -c "
  SELECT * FROM assistant_org_mapping
  WHERE org_id = 'org-123'
"
```

**Solution**:
1. Verify Vapi API key is valid (test in Vapi console)
2. Check VapiAssistantManager logs for errors
3. Verify assistant mapping table populated
4. If mapping missing: Call `IntegrationDecryptor.registerAssistantMapping()`
5. Check Vapi API rate limits not exceeded

### Issue: Multi-tenant data leakage

**Symptoms**: Org A can see Org B's credentials

**Diagnosis**:
```bash
# Check RLS policy is enabled
psql $DATABASE_URL -c "
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE tablename IN ('org_credentials', 'assistant_org_mapping')
"

# Verify RLS policies exist
psql $DATABASE_URL -c "
  SELECT policyname, qual FROM pg_policies
  WHERE tablename = 'org_credentials'
"

# Test RLS enforcement (requires switching to different user)
SET ROLE "org-123";
SELECT COUNT(*) FROM org_credentials;
```

**Solution**:
1. Verify RLS enabled: `ALTER TABLE org_credentials ENABLE ROW LEVEL SECURITY;`
2. Verify RLS policies in place (should restrict by `org_id = auth.org_id()`)
3. Verify `auth.org_id()` returns correct org in JWT
4. Test with different JWT tokens to verify isolation

---

## Quick Reference

### Common Commands

```bash
# Check all integrations for an org
psql $DATABASE_URL -c "
  SELECT provider, is_active, last_verified_at, verification_error
  FROM org_credentials
  WHERE org_id = 'org-123'
"

# Invalidate cache for an org
# (Call this after manual credential updates in database)
curl -X POST http://localhost:3000/api/debug/invalidate-cache \
  -d '{"orgId": "org-123"}'

# Check webhook statistics
curl -X GET http://localhost:3000/api/debug/webhook-stats

# View cache statistics
curl -X GET http://localhost:3000/api/debug/cache-stats

# Test credential verification
curl -X POST http://localhost:3000/api/integrations/vapi/verify \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### File Locations

```
Database:  Supabase PostgreSQL
Migrations:    backend/migrations/20250111_*.sql
Services:      backend/src/services/integration-decryptor.ts
               backend/src/services/vapi-assistant-manager.ts
API Routes:    backend/src/routes/integrations-byoc.ts
Frontend:      src/app/dashboard/integrations/page.tsx
Components:    src/components/integrations/*.tsx
Tests:         backend/src/services/__tests__/*.test.ts
               backend/src/__tests__/integration/*.test.ts
Config:        .env.local (backend)
Docs:          PHASE_1_COMPLETION_REPORT.md
               PHASE_2_COMPLETION_REPORT.md
               IMPLEMENTATION_GUIDE.md (this file)
```

---

## Support & Escalation

For issues that don't resolve with this guide:

1. **Check Logs**: Backend logs contain detailed error context
2. **Review Tests**: Test cases show expected behavior
3. **Database Query**: Direct SQL queries can reveal data issues
4. **Check Environment**: Verify all env vars set correctly
5. **Reach Out**: Contact the development team with logs/steps to reproduce

---

**Last Updated**: January 11, 2026
**Status**: Production Ready
