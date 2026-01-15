# Infrastructure Synchronization & Identity Crisis Fix

**Status:** Ready for Phase 1 Execution  
**Created:** 2026-01-14  
**Objective:** Collapse org_id/tenant_id chaos into single source of truth

---

## Implementation Phases

### **PHASE 1: Database Migration (SQL)**
**Objective:** Standardize database schema and secure JWT creation  
**Duration:** ~5 min execution  
**Risk:** LOW (idempotent SQL, no data loss)

#### 1.1 - Rename `profiles.tenant_id` → `org_id`
```sql
-- Handle column rename safely
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tenant_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN tenant_id TO org_id;
    END IF;
END $$;
```
**Success Criteria:**
- ✅ `profiles.org_id` column exists
- ✅ All existing data migrated (no NULL values)
- ✅ Foreign key constraint to `organizations.id` exists

#### 1.2 - Create Auto-Org Trigger for New Signups
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create organization for new user
    INSERT INTO public.organizations (name, status)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Clinic'), 'active')
    RETURNING id INTO new_org_id;

    -- Create profile linked to org
    INSERT INTO public.profiles (id, email, org_id, role)
    VALUES (NEW.id, NEW.email, new_org_id, 'owner');

    -- Stamp org_id into JWT
    UPDATE auth.users 
    SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || jsonb_build_object('org_id', new_org_id::text)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();
```
**Success Criteria:**
- ✅ Trigger executes on new user creation
- ✅ New org created automatically
- ✅ JWT includes `app_metadata.org_id`
- ✅ Profile linked to org

#### 1.3 - Fix RLS Policies
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only see their own org" ON public.profiles;
CREATE POLICY "Users can only see their own org" ON public.profiles
    USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Apply to other org-scoped tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access their org" ON public.organizations;
CREATE POLICY "Users can access their org" ON public.organizations
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
```
**Success Criteria:**
- ✅ RLS enabled on profiles & organizations
- ✅ Policies prevent cross-org data access
- ✅ Test query `SELECT * FROM profiles WHERE org_id != current_org_id` returns 0 rows

**Testing:** [See TESTING section below]

---

### **PHASE 2: Backend Security Fix**
**Objective:** Remove dangerous fallback logic, enforce org_id validation  
**Duration:** ~15 min  
**Files Changed:**
- `backend/src/middleware/auth.ts`
- `backend/src/services/org-validation.ts` (NEW)
- `backend/src/routes/` (all routes updated)

#### 2.1 - Create Org Validation Service
**File:** `backend/src/services/org-validation.ts` (NEW)
```typescript
/**
 * Validates org_id resolution and membership
 */
export async function validateAndResolveOrgId(user: AuthUser): Promise<string> {
    // Source of truth: JWT app_metadata
    const orgId = user.app_metadata?.org_id;
    
    if (!orgId || typeof orgId !== 'string') {
        throw new Error('ORG_ID_MISSING: User has no linked organization in JWT');
    }
    
    // Verify org actually exists
    const { data: org, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .single();
    
    if (error || !org) {
        throw new Error(`ORG_ID_INVALID: Organization ${orgId} does not exist`);
    }
    
    return orgId;
}

/**
 * Validates user belongs to org and has permission
 */
export async function validateUserOrgMembership(
    userId: string,
    orgId: string
): Promise<boolean> {
    const { data } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .eq('org_id', orgId)
        .single();
    
    return !!data;
}
```

#### 2.2 - Fix Auth Middleware
**File:** `backend/src/middleware/auth.ts`

**REMOVE:**
```typescript
// ❌ DELETE THIS ENTIRE BLOCK (lines ~68-75)
if (orgId === 'default') {
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single();  // ← SECURITY HOLE: Gets first org!
  if (org) orgId = org.id;
}
```

**REPLACE WITH:**
```typescript
// ✅ NEW: Strict validation
if (!orgId) {
    return res.status(401).json({ 
        error: 'ORG_SETUP_REQUIRED',
        message: 'Your account is not linked to an organization. Please contact support.'
    });
}

// Validate the org exists
const orgValidation = await validateAndResolveOrgId(user);
req.org_id = orgValidation;
```

**Success Criteria:**
- ✅ No fallback to 'first' org
- ✅ Missing org_id returns 401, not silent data access
- ✅ All routes receive validated `req.org_id`
- ✅ Logging tracks validation failures

#### 2.3 - Update All Route Handlers
**Pattern:** Every API route must validate org_id parameter matches `req.org_id`

**Example Fix - `backend/src/routes/vapi-tools-routes.ts`:**

```typescript
// BEFORE:
async function resolveTenantId(tenantId?: string, inboundPhoneNumber?: string): Promise<string | null> {
    if (tenantId) return tenantId;  // ❌ No validation
    // ...
}

// AFTER:
async function resolveTenantId(
    tenantId?: string, 
    inboundPhoneNumber?: string,
    authenticatedOrgId?: string  // ← Add this
): Promise<string | null> {
    if (tenantId) {
        // ✅ Validate passed tenantId matches authenticated org
        if (authenticatedOrgId && tenantId !== authenticatedOrgId) {
            throw new Error('FORBIDDEN: Cannot access other organization');
        }
        return tenantId;
    }
    // ...
}
```

**Success Criteria:**
- ✅ All routes validate org_id parameter
- ✅ No cross-org data access possible
- ✅ Invalid org_id requests log security warnings
- ✅ Tests pass: User from Org A cannot access Org B data

**Testing:** [See TESTING section below]

---

### **PHASE 3: Frontend Hook & API Integration**
**Objective:** Simplify org_id resolution, remove multiple sources of truth  
**Duration:** ~20 min  
**Files Changed:**
- `src/hooks/useOrg.ts`
- `src/contexts/AuthContext.tsx`
- `src/app/api/auth/tenant-id/route.ts`

#### 3.1 - Simplify useOrg Hook
**File:** `src/hooks/useOrg.ts`

**BEFORE:**
```typescript
const orgId = useMemo(() => {
    return (user?.app_metadata?.org_id || user?.user_metadata?.org_id) as string | undefined;
}, [user]);
```

**AFTER:**
```typescript
export function useOrg(): string {
    const { user } = useAuth();
    const orgId = user?.app_metadata?.org_id;
    
    if (!orgId) {
        console.warn('useOrg: No org_id in session. Attempting refresh...');
        // Trigger session refresh
        void refreshSession();
        return '';
    }
    
    return orgId;
}

// Helper to validate org is real UUID
export function validateOrgId(id: unknown): id is string {
    return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
```

#### 3.2 - Update AuthContext
**File:** `src/contexts/AuthContext.tsx` (lines 78-88)

**BEFORE:**
```typescript
if (response.ok && result.tenantId) {
    localStorage.setItem('org_id', result.tenantId);  // ❌ Redundant
    setUser(prev => prev ? {
        ...prev,
        app_metadata: {
            ...(prev.app_metadata || {}),
            org_id: result.tenantId  // ❌ Overwrites JWT
        }
    } : null);
}
```

**AFTER:**
```typescript
if (response.ok) {
    // Trust only the JWT from Supabase
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.user?.app_metadata?.org_id) {
        setUser(refreshed.data.user);
        // Only use JWT as source of truth
        localStorage.setItem('org_id', refreshed.data.user.app_metadata.org_id);
    } else {
        console.error('Organization setup incomplete');
    }
}
```

#### 3.3 - Remove Redundant Endpoint
**File:** `src/app/api/auth/tenant-id/route.ts`

**Action:** This endpoint is now REDUNDANT. The org_id is in the JWT.

**New Purpose:** Return org info for dashboard display only

```typescript
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const orgId = session.user.app_metadata?.org_id;
    if (!orgId) {
        return NextResponse.json({ error: 'No organization linked' }, { status: 400 });
    }
    
    // Fetch org details for display (not auth)
    const { data: org } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('id', orgId)
        .single();
    
    return NextResponse.json({ org });
}
```

**Success Criteria:**
- ✅ useOrg() always returns valid UUID or empty string
- ✅ No localStorage fallback logic
- ✅ AuthContext trusts only JWT
- ✅ Session refresh works correctly
- ✅ No 404 errors on /api/auth/tenant-id

**Testing:** [See TESTING section below]

---

### **PHASE 4: Settings Page & Organization Management**
**Objective:** Connect org settings UI to database  
**Duration:** ~25 min  
**Files Changed:**
- `src/app/dashboard/settings/page.tsx`
- `src/components/OrgSettingsForm.tsx` (NEW)

#### 4.1 - Create Org Settings Form Component
**File:** `src/components/OrgSettingsForm.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';

export function OrgSettingsForm() {
    const orgId = useOrg();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ name: '', status: 'active' as const });
    
    const handleSave = async () => {
        if (!orgId) {
            toast.error('Organization not found');
            return;
        }
        
        setLoading(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: formData.name,
                    status: formData.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orgId);
            
            if (error) throw error;
            toast.success('Organization settings saved');
        } catch (err) {
            toast.error(`Failed to save: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <input
                type="text"
                placeholder="Organization Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
}
```

#### 4.2 - Update Settings Page
**File:** `src/app/dashboard/settings/page.tsx`

Replace placeholder with:
```typescript
import { OrgSettingsForm } from '@/components/OrgSettingsForm';

export default function SettingsPage() {
    return (
        <div>
            <h1>Organization Settings</h1>
            <OrgSettingsForm />
        </div>
    );
}
```

**Success Criteria:**
- ✅ Settings page loads org data
- ✅ Save button updates database
- ✅ No console.log placeholders
- ✅ Toast notifications on success/error
- ✅ Loading state visible

---

## Technical Requirements

### Database
- ✅ Supabase project with profiles table
- ✅ organizations table with id, name, status
- ✅ auth.users table (Supabase Auth)
- ✅ org_id column on all tenant-scoped tables

### Backend
- ✅ Node.js + Express
- ✅ Supabase client for DB access
- ✅ JWT middleware already in place

### Frontend
- ✅ Next.js 13+ (App Router)
- ✅ Supabase Auth integration
- ✅ React Context for session management
- ✅ Toast/notification component

### Dependencies
No new packages needed. Uses existing:
- `@supabase/supabase-js`
- `next`
- `react`

---

## Testing Criteria

### Phase 1: Database Testing
```sql
-- Test 1: profiles.org_id exists
SELECT column_name FROM information_schema.columns 
WHERE table_name='profiles' AND column_name='org_id';
-- Expected: 1 row

-- Test 2: RLS policy exists
SELECT policyname FROM pg_policies 
WHERE tablename='profiles' AND policyname LIKE '%own%';
-- Expected: 1+ rows

-- Test 3: New user trigger works
-- Create test user via Supabase Auth UI
-- Check that org auto-created and JWT has org_id
```

### Phase 2: Backend Testing
```bash
# Test 1: Missing org_id returns 401
curl -X GET http://localhost:3001/api/schedule \
  -H "Authorization: Bearer FAKE_TOKEN_NO_ORG" \
# Expected: 401 ORG_ID_MISSING

# Test 2: Valid org_id passes through
# (test with real token after Phase 1)

# Test 3: Cross-org access blocked
# User from Org A tries to access Org B data
# Expected: 403 FORBIDDEN
```

### Phase 3: Frontend Testing
```typescript
// Test 1: useOrg returns UUID
const orgId = useOrg();
expect(validateOrgId(orgId)).toBe(true);

// Test 2: Missing org triggers refresh
// (mock session without org_id)
expect(refreshSession).toHaveBeenCalled();

// Test 3: localStorage fallback removed
localStorage.clear();
const orgId = useOrg();
// orgId should come from JWT only, not localStorage
```

### Phase 4: Integration Testing
```typescript
// Test 1: Settings save works
const form = render(<OrgSettingsForm />);
fireEvent.change(form.getByPlaceholderText('Organization Name'), { target: { value: 'New Name' } });
fireEvent.click(form.getByText('Save Changes'));
// Expected: Toast success, org.name updated in DB

// Test 2: User cannot see other org settings
// User from Org A tries to access Org B settings endpoint
// Expected: 404 or 403
```

### Verification Checklist
- [ ] Phase 1 SQL runs without errors
- [ ] New user signup auto-creates org
- [ ] JWT includes org_id in app_metadata
- [ ] Middleware logs "Org validated: {orgId}"
- [ ] Frontend console shows no org_id errors
- [ ] Settings page saves to database
- [ ] RLS prevents cross-org data access
- [ ] localStorage.getItem('org_id') matches JWT org_id

---

## Rollback Plan

**If something breaks:**

1. **Database:** Run reverse migrations to restore tenant_id column
2. **Backend:** Revert auth.ts to original fallback logic
3. **Frontend:** Revert useOrg hook to check both sources

All changes are versioned in git. Run: `git revert <commit-hash>`

---

## Timeline

| Phase | Duration | Blockers |
|-------|----------|----------|
| 1. Database | 5 min | None |
| 2. Backend | 15 min | Phase 1 complete |
| 3. Frontend | 20 min | Phase 2 complete |
| 4. Settings | 25 min | Phase 3 complete |
| **Total** | **~1 hour** | None |

---

## Success Indicators

After all phases complete:

✅ `localStorage.org_id` === JWT `app_metadata.org_id`  
✅ Dashboard loads without 404 errors  
✅ Settings page saves org changes  
✅ Team Members list shows correct org members  
✅ User A cannot access User B's data  
✅ New user signup auto-creates org  
✅ Middleware logs org validation  
✅ RLS policies enforcing isolation  
