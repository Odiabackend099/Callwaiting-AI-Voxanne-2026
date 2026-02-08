# Database Schema Reference - Voxanne AI

**Last Updated:** 2026-02-09
**Purpose:** Single source of truth for database column names, auto-organization setup, and critical invariants

---

## ⚠️ CRITICAL: Correct Column Names

**This section prevents common mistakes that break user signup.**

### Auth Users Table (`auth.users` - Supabase managed)

```sql
-- ✅ CORRECT metadata column names (note the underscores!)
raw_app_meta_data   JSONB  -- Server-set data (NOT editable by users)
raw_user_meta_data  JSONB  -- User-provided data (editable by users)

-- ❌ WRONG - These columns DO NOT exist:
raw_app_metadata    -- Missing underscore
raw_user_metadata   -- Missing underscore
```

**Key Difference:**
- `raw_app_meta_data` = Where we store `org_id` for JWT (used by RLS policies)
- `raw_user_meta_data` = Where users can store custom signup data (like `business_name`)

### Profiles Table (`public.profiles`)

```sql
-- ✅ CORRECT organization reference column
org_id  UUID  REFERENCES organizations(id)

-- ❌ WRONG - This column does NOT exist:
organization_id  UUID  -- Never use this!
```

**Why This Matters:**
- Old migrations used `organization_id` (wrong)
- This caused silent trigger failures
- Users created without profiles → infinite login loop

---

## 🔧 Auto-Organization Creation System

### How It Works

When a new user signs up via Supabase Auth:

1. **User Created:** Supabase creates record in `auth.users`
2. **Trigger Fires:** `on_auth_user_created` trigger executes
3. **Organization Created:** New org created in `public.organizations`
4. **Profile Created:** New profile created in `public.profiles` with `org_id`
5. **JWT Updated:** `raw_app_meta_data` updated with `org_id` for RLS

### Current Implementation (2026-02-09)

**Migration:** `backend/supabase/migrations/20260209_fix_auto_org_trigger.sql`

**Trigger Function:** `public.handle_new_user_signup()`

**Key Features:**
- ✅ Uses correct column names (`org_id`, `raw_app_meta_data`)
- ✅ Blocks signup if trigger fails (`RAISE EXCEPTION`)
- ✅ No conflicting trigger versions
- ✅ Secured with `SECURITY DEFINER` and `search_path = 'public'`

**Trigger Code:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- 1. Create organization
  INSERT INTO public.organizations (name, email, status, created_at, updated_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
    NEW.email,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_org_id;

  -- 2. Create profile with CORRECT column name (org_id)
  INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    new_org_id,  -- Uses org_id, NOT organization_id
    'owner',
    NOW(),
    NOW()
  );

  -- 3. Update JWT metadata with CORRECT column name
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('org_id', new_org_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: Blocks signup if trigger fails
  RAISE EXCEPTION 'Failed to create organization for user %: %', NEW.email, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';
```

### Backfill Migration (For Orphaned Users)

**Migration:** `backend/supabase/migrations/20260209_backfill_orphaned_users.sql`

**Purpose:** Fixes existing users created before the trigger was fixed

**What It Does:**
1. Finds all users in `auth.users` without a profile
2. Creates organization for each
3. Creates profile with correct `org_id`
4. Updates JWT `raw_app_meta_data` with `org_id`

**Run Once:** This migration was applied 2026-02-09 and fixed all orphaned users.

---

## 🚨 DO NOT USE - Archived Migrations

These migrations are **BROKEN** and were archived on 2026-02-09:

### ❌ `backend/migrations/20260114_create_auth_trigger.sql`
**Problem:** Uses `organization_id` (column doesn't exist)
**Location:** `.archive/2026-02-09-broken-auth-triggers/`

### ❌ `backend/migrations/20260115T22401_fix_auth_trigger.sql`
**Problem:** Uses `raw_app_metadata` (column doesn't exist)
**Location:** `.archive/2026-02-09-broken-auth-triggers/`

### ❌ `backend/supabase/migrations/20260116195200_add_auto_org_creation_trigger.sql`
**Problem:** Uses different architecture (`is_organization` flag)
**Location:** `.archive/2026-02-09-broken-auth-triggers/`

**DO NOT RESTORE THESE FILES.** They will break user signup.

---

## 📊 Table Schema Reference

### `public.organizations`

```sql
CREATE TABLE public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Users can only see their own organization
CREATE POLICY "organizations_own_org_only" ON organizations
  FOR SELECT TO authenticated
  USING (id = (SELECT public.auth_org_id()));
```

### `public.profiles`

```sql
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  org_id      UUID NOT NULL REFERENCES organizations(id),  -- NOT organization_id!
  role        TEXT NOT NULL DEFAULT 'owner',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Users can only see profiles in their organization
CREATE POLICY "profiles_org_isolation" ON profiles
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));
```

### `auth.users` (Supabase Managed)

```sql
-- Key columns for auto-organization setup:
id                   UUID PRIMARY KEY
email                TEXT NOT NULL
raw_app_meta_data    JSONB  -- Stores org_id for JWT
raw_user_meta_data   JSONB  -- Stores user signup data (e.g., business_name)
```

---

## 🔐 Helper Functions

### `public.auth_org_id()`

**Purpose:** Extracts `org_id` from current user's JWT

**Usage:** All RLS policies use this function

```sql
CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid;
$$;
```

**Why It's Important:**
- Used in ALL RLS policies
- Ensures multi-tenant data isolation
- Reads from `raw_app_meta_data` (set by trigger)

---

## ✅ Verification Commands

### Check if trigger is active:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/lbjymlodxprzqgtyqtcq/database/query" \
  -H "Authorization: Bearer sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = '\''on_auth_user_created'\'';"}'
```

**Expected:** `[{"tgname":"on_auth_user_created","tgenabled":"O"}]`

### Check for orphaned users:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/lbjymlodxprzqgtyqtcq/database/query" \
  -H "Authorization: Bearer sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT COUNT(*) as total_orphaned FROM auth.users au LEFT JOIN public.profiles p ON au.id = p.id WHERE p.id IS NULL;"}'
```

**Expected:** `[{"total_orphaned":0}]`

### Verify specific user has profile + org:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/lbjymlodxprzqgtyqtcq/database/query" \
  -H "Authorization: Bearer sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT au.id, au.email, p.id as profile_id, p.org_id, o.name as org_name, au.raw_app_meta_data->>'\''org_id'\'' as jwt_org_id FROM auth.users au LEFT JOIN public.profiles p ON au.id = p.id LEFT JOIN public.organizations o ON p.org_id = o.id WHERE au.email = '\''ceo@demo.com'\'';"}'
```

**Expected:** All fields populated, `jwt_org_id` matches `org_id`

---

## 🎯 Common Mistakes to Avoid

### ❌ Mistake 1: Wrong Metadata Column

```typescript
// WRONG - Column doesn't exist
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { org_id: orgId }  // This won't work!
});
```

```typescript
// CORRECT - Use Supabase client method
await supabase.auth.admin.updateUserById(userId, {
  user_metadata: {},  // Note: Supabase client handles the underscore conversion
  app_metadata: { org_id: orgId }  // Supabase client converts to raw_app_meta_data
});
```

### ❌ Mistake 2: Wrong Profile Column

```sql
-- WRONG
INSERT INTO profiles (id, email, organization_id, role)
VALUES (user_id, email, org_id, 'owner');
```

```sql
-- CORRECT
INSERT INTO profiles (id, email, org_id, role)
VALUES (user_id, email, org_id, 'owner');
```

### ❌ Mistake 3: Querying Wrong Metadata Field

```sql
-- WRONG
SELECT raw_app_metadata->>'org_id' FROM auth.users;
```

```sql
-- CORRECT
SELECT raw_app_meta_data->>'org_id' FROM auth.users;
```

---

## 📚 Related Documentation

- **Auto-Organization Fix:** `.archive/2026-02-09-broken-auth-triggers/README.md`
- **Supabase MCP Guide:** `.agent/supabase-mcp.md`
- **Migration Runner:** `backend/src/scripts/apply-migrations-via-api.ts`
- **Verification Script:** `backend/src/scripts/verify-user-signup.ts`

---

## 🚀 Production Status

**Last Updated:** 2026-02-09

**Status:** ✅ **PRODUCTION READY**

- ✅ All orphaned users fixed (0 remaining)
- ✅ Trigger active and working correctly
- ✅ No conflicting migrations
- ✅ All users have valid organizations
- ✅ Login works for all users (including ceo@demo.com)

**Signup Flow Verified:**
- URL: http://localhost:3000/sign-up (note: hyphen, not `signup`)
- Creates user → trigger fires → org + profile created → JWT updated → login works

---

**For AI Assistants:** This is the DEFINITIVE reference for auto-organization setup. If you encounter conflicting information elsewhere, trust this document. It was created 2026-02-09 after fixing production-blocking bugs.
