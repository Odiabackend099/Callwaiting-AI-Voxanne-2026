# Phase 2: Integration Tests - Setup Guide

**Date:** 2025-01-10  
**Purpose:** Guide for setting up environment to run Phase 2 integration tests

---

## Prerequisites

### 1. Environment Variables Required

The integration tests require the following environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (sensitive)

### 2. Getting Supabase Credentials

1. **Log in to Supabase Dashboard:**
   - Go to https://app.supabase.com
   - Select your project

2. **Get Project URL:**
   - Navigate to: Settings > API
   - Copy the "Project URL" (e.g., `https://xxxxx.supabase.co`)

3. **Get Service Role Key:**
   - Navigate to: Settings > API
   - Find "service_role" key in the "Project API keys" section
   - ⚠️ **WARNING:** This key bypasses RLS. Keep it secret!
   - Click "Reveal" and copy the key

### 3. Setting Up Environment Variables

#### Option A: Create .env file (Recommended)

```bash
cd backend
cp .env.example .env
# Edit .env and add your credentials
nano .env  # or use your preferred editor
```

Add your credentials:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### Option B: Export Environment Variables (Temporary)

```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

#### Option C: Use .envrc (with direnv)

Create `.envrc` file in backend directory:
```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Then:
```bash
direnv allow
```

---

## Running Tests

### Quick Start

Once environment variables are set:

```bash
cd backend
bash scripts/run-phase2-tests.sh
```

### Manual Execution

#### Step 1: Run RLS Tests (No backend server needed)

```bash
cd backend
npm test -- rls-cross-tenant-isolation.test.ts
```

#### Step 2: Start Backend Server (for API tests)

```bash
# Terminal 1
cd backend
npm run dev
# Server should start on http://localhost:3001
```

#### Step 3: Run API Tests

```bash
# Terminal 2
cd backend
export BACKEND_URL=http://localhost:3001
npm test -- api-cross-tenant-isolation.test.ts
```

---

## What the Tests Do

### RLS Database-Level Tests

These tests verify that Row Level Security (RLS) policies prevent cross-tenant data access:

1. **Creates test organizations** (Org A and Org B)
2. **Creates test users** for each organization
3. **Creates test data** (campaigns, leads, call_logs, knowledge_base)
4. **Verifies RLS isolation:**
   - Org A user can SELECT their own data
   - Org A user cannot SELECT Org B's data
   - Org A user cannot INSERT data for Org B
   - Org A user cannot UPDATE/DELETE Org B's data

### API Application-Level Tests

These tests verify that API endpoints enforce tenant isolation:

1. **Creates test users and data** (same as RLS tests)
2. **Tests API endpoints:**
   - `/api/calls-dashboard` - filters by org_id
   - `/api/calls-dashboard/:callId` - enforces tenant isolation
   - `/api/calls-dashboard/stats` - returns org-scoped stats
   - `/api/knowledge-base` - filters by org_id
3. **Verifies cross-tenant access is blocked**

---

## Troubleshooting

### Error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"

**Solution:** Ensure environment variables are set:
```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY  # Should show your key (not blank)
```

If blank, check your `.env` file or export them manually.

### Error: "Failed to get test user tokens"

**Cause:** Service role key is invalid or insufficient permissions.

**Solution:**
1. Verify service role key is correct (no extra spaces/newlines)
2. Ensure key has `service_role` permissions (not `anon` key)
3. Check Supabase project is active and accessible

### Error: "Backend server not responding"

**Cause:** Backend server is not running on expected port.

**Solution:**
1. Check backend is running: `curl http://localhost:3001/health`
2. If using different port, set `BACKEND_URL` environment variable
3. Check backend logs for errors

### Tests Cleanup

The tests automatically clean up test data after running. If tests crash, you may need to manually clean up:

```sql
-- Run in Supabase SQL Editor (as service role)
DELETE FROM call_logs WHERE vapi_call_id LIKE 'test-%';
DELETE FROM calls WHERE phone_number LIKE '+1555%';
DELETE FROM leads WHERE phone LIKE '+1555%';
DELETE FROM campaigns WHERE name LIKE 'Test%';
DELETE FROM knowledge_base WHERE filename LIKE 'test-%';
DELETE FROM auth.users WHERE email LIKE 'test-%@test.com';
DELETE FROM organizations WHERE id = 'b0000000-0000-0000-0000-000000000001';
```

---

## Security Notes

⚠️ **IMPORTANT:**

1. **Never commit `.env` file** to version control
   - `.env` should be in `.gitignore`
   - Use `.env.example` for template

2. **Service Role Key is sensitive:**
   - Bypasses all Row Level Security (RLS)
   - Can access all data regardless of tenant
   - Should only be used server-side
   - Never expose in client-side code or browser

3. **Test Data:**
   - Tests create temporary test data
   - Test data is cleaned up automatically
   - If tests crash, manually clean up test data

---

## Next Steps

After tests pass:

1. ✅ Review test output
2. ✅ Document any issues found
3. ✅ Proceed to Phase 3: Manual Verification
4. ✅ See `MANUAL_VERIFICATION_CHECKLIST.md`

---

## Current Status

- ✅ Phase 2 test suites created
- ✅ Execution script created (`scripts/run-phase2-tests.sh`)
- ⏭️ Waiting for environment variables to be configured
- ⏭️ Tests ready to run once credentials are set
