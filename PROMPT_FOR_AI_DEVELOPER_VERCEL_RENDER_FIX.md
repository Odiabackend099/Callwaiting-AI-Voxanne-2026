# PROMPT: Fix Vercel Build Failure — Split Frontend/Backend Architecture

## Mission
Fix the Vercel deployment so it builds and deploys successfully WITHOUT requiring `SUPABASE_SERVICE_ROLE_KEY` on the frontend. The service role key should ONLY live on the Render backend.

**Current Status:** 🔴 Build fails with `Error: [api/auth/signup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`

**Target Status:** 🟢 Vercel builds clean with only public env vars, Render backend handles sensitive auth operations

---

## Root Cause Analysis

### Problem 1: Module-Level Guard in Next.js API Route
**File:** `src/app/api/auth/signup/route.ts` (lines 4-8)

```typescript
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[api/auth/signup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
```

This guard throws at **build time** (module load), not request time. When Vercel builds, the env var is missing, build fails immediately.

**Why it's bad:** The service role key is a sensitive credential that bypasses Supabase RLS. It should NEVER be on Vercel (frontend-facing infrastructure).

### Problem 2: Architecture Mismatch
The current setup assumes:
- **Vercel (Frontend):** Handles signup via `/api/auth/signup` using service role key
- **Render (Backend):** Handles everything else (calls, agents, etc.)

But this is backwards:
- Service role key should be on Render (backend-only)
- Vercel should only use public Supabase anon key
- Render should expose a `/api/auth/signup` endpoint that Vercel calls

---

## Solution Design

### Architecture After Fix
```
┌─────────────────────────────────┐
│ Vercel Frontend (Next.js)        │
├─────────────────────────────────┤
│ Env vars (PUBLIC ONLY):          │
│  - NEXT_PUBLIC_SUPABASE_URL      │
│  - NEXT_PUBLIC_SUPABASE_ANON_KEY │
│                                  │
│ No: SUPABASE_SERVICE_ROLE_KEY    │
│ No: /api/auth/signup route       │
└──────────────┬──────────────────┘
               │
               │ fetch('/api/auth/signup')
               │ → https://voxanneai.onrender.com/api/auth/signup
               │
┌──────────────▼──────────────────┐
│ Render Backend (Express)         │
├─────────────────────────────────┤
│ Env vars:                        │
│  - SUPABASE_SERVICE_ROLE_KEY ✅  │
│  - SUPABASE_URL                  │
│                                  │
│ Routes:                          │
│  POST /api/auth/signup ✅        │
│  (handles user creation)         │
└─────────────────────────────────┘
```

### Three-Step Fix

**Step 1: CREATE** `backend/src/routes/auth-signup.ts` (Render backend)
- Move signup logic from Vercel to Render
- Export router as default
- Accepts same JSON payload: `{ firstName, lastName, email, password }`
- Returns same response shape: `{ success: true }` (201) or `{ error, provider }` (409/5xx)
- Uses `SUPABASE_SERVICE_ROLE_KEY` which is available on Render

**Step 2: UPDATE** `src/app/(auth)/sign-up/page.tsx` (Vercel frontend)
- Line 64: Change API endpoint from `/api/auth/signup` to `https://voxanneai.onrender.com/api/auth/signup`
- Keep all other logic identical (error handling, Google OAuth, etc.)
- Test locally before pushing

**Step 3: DELETE** `src/app/api/auth/signup/route.ts` (Vercel frontend)
- Remove the file entirely — Vercel no longer needs this route
- Remove the module-level guard
- No more service role key usage on Vercel

**Step 4: MOUNT** the route in `backend/src/server.ts`
- Import the new auth signup router
- Mount it: `app.use('/api/auth', authSignupRouter);`
- Ensure it's before the catchall 404 handler

**Step 5: CONFIGURE** Vercel env vars
- Remove `SUPABASE_SERVICE_ROLE_KEY` from Vercel dashboard
- Keep ONLY:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Implementation Checklist

### Backend (`backend/src/routes/auth-signup.ts`)

- [ ] Create new file with Express router
- [ ] Import Supabase admin client with service role key
- [ ] Implement IP-based rate limiting (same as current: 5/min per IP)
- [ ] Implement request body validation:
  - Required fields: firstName, lastName, email, password
  - Email regex validation
  - Name length ≤ 50 chars
  - Password length 8-128 chars
- [ ] Call `adminClient.auth.admin.createUser()` with:
  - `email_confirm: true` (user can sign in immediately)
  - `user_metadata`: first_name, last_name, full_name
- [ ] Handle 422 (duplicate email) → check existing providers → return 409 with provider info
- [ ] Handle other errors → return 500 with generic message
- [ ] Return 201 on success: `{ success: true }`
- [ ] Export as default: `export default authSignupRouter;`
- [ ] TypeScript strict mode: no `any` types
- [ ] Preserve rate limit window cleanup logic

**Key Code Pattern (from existing route):**
```typescript
const adminClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await adminClient.auth.admin.createUser({
  email: trimmedEmail,
  password,
  email_confirm: true,
  user_metadata: { first_name, last_name, full_name },
});
```

### Frontend (`src/app/(auth)/sign-up/page.tsx`)

- [ ] Line 64: Change fetch URL from `/api/auth/signup` to `https://voxanneai.onrender.com/api/auth/signup`
- [ ] Test locally: `npm run dev` → sign up flow should work
- [ ] Verify error handling works (409 duplicate email, 429 rate limit, etc.)
- [ ] Verify Google OAuth still works
- [ ] No other changes needed

### Cleanup

- [ ] Delete `src/app/api/auth/signup/route.ts` entirely
- [ ] Delete `src/app/api/auth/signup/` directory if empty

### Backend Server

- [ ] Add to `backend/src/server.ts` imports:
  ```typescript
  import authSignupRouter from './routes/auth-signup'; // default export
  ```

- [ ] Mount router (before other /api routes):
  ```typescript
  app.use('/api/auth', authSignupRouter);
  ```

### Vercel Configuration

- [ ] Go to Vercel dashboard
- [ ] Project settings → Environment Variables
- [ ] Remove: `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Keep ONLY:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Testing & Verification

### Local Testing (Before Deploy)

```bash
# 1. Backend should build
cd backend
npm run build

# 2. Frontend should build WITHOUT service role key
cd ..
unset SUPABASE_SERVICE_ROLE_KEY  # Remove it
npm run build
# Expected: ✅ Build succeeds

# 3. Test signup flow locally
npm run dev
# Visit http://localhost:3000/sign-up
# Try: Name + Email + Password
# Should POST to https://voxanneai.onrender.com/api/auth/signup
# Should see response in browser devtools
```

### Vercel Deployment Test

```bash
# 1. Push to GitHub
git add .
git commit -m "fix: Move signup to Render backend, remove Next.js API route"
git push origin main

# 2. Deploy to Vercel
export VERCEL_TOKEN=aF8XCJ7H06Xr6gA7lcfXJ4Az
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
vercel deploy --prod --token=$VERCEL_TOKEN

# Expected: ✅ Build succeeds
# Expected output: "Production: https://callwaiting-ai-voxanne-2026..."
```

### End-to-End Test (Post-Deploy)

1. **Test Signup:**
   - Visit https://callwaiting-ai-voxanne-2026....vercel.app/sign-up
   - Enter: First name, Last name, Email, Password
   - Click "Create Account"
   - Should see success (redirect to dashboard) or error (duplicate email, weak password, etc.)

2. **Test Duplicate Email:**
   - Try signing up with same email as step 1
   - Should see: "An account with this email already exists. Sign in instead → "
   - Should NOT see generic 500 error

3. **Test Rate Limiting:**
   - Trigger 6 signup attempts in <1 minute
   - 6th attempt should get: 429 "Too many sign-up attempts"

4. **Test Google OAuth:**
   - Still works as before (not affected by this change)

5. **Verify No Service Role Key Leak:**
   - Browser DevTools → Network → XHR POST to `/api/auth/signup`
   - Response should NOT contain: SUPABASE_SERVICE_ROLE_KEY
   - Response should NOT expose internal Supabase org IDs

---

## Senior Engineer Review Checklist

**Security:**
- [ ] Service role key NOT in Vercel logs, build output, or deployed assets
- [ ] No API key leakage in error messages
- [ ] Rate limiting prevents brute force
- [ ] Email enumeration prevention maintained (409 response same for all duplicate emails)

**Reliability:**
- [ ] IP-based rate limiting with cleanup prevents unbounded Map growth
- [ ] Error handling covers all Supabase error codes (422, 500, network errors)
- [ ] Type-safe input validation (guards against null/undefined)
- [ ] Idempotency via email uniqueness constraint

**Maintainability:**
- [ ] Code is DRY (no duplication between old route and new)
- [ ] Comments explain why (HIPAA, email enumeration, etc.)
- [ ] No debug logging that leaks PII
- [ ] Easy to understand request/response flow

**Performance:**
- [ ] Rate limiter runs in-memory (no DB queries)
- [ ] Single Supabase call per request (no N+1)
- [ ] Cleanup runs on interval (no unbounded growth)

---

## Expected Outcome

✅ **Vercel builds successfully** with only public env vars
✅ **Signup still works** (user flow unchanged)
✅ **Security improved** (service role key protected on Render)
✅ **Architecture cleaner** (clear separation of concerns)
✅ **No new dependencies** (uses existing code patterns)

---

## Rollback Plan (If Needed)

If something breaks, immediate rollback:

```bash
git revert <commit-hash>
git push origin main
vercel deploy --prod --token=$VERCEL_TOKEN
# Add SUPABASE_SERVICE_ROLE_KEY back to Vercel env vars
# Redeploy
```

---

## Files to Modify

| File | Action | Complexity |
|------|--------|------------|
| `backend/src/routes/auth-signup.ts` | CREATE | High (copy + adapt existing) |
| `backend/src/server.ts` | MODIFY | Low (add 2 lines) |
| `src/app/(auth)/sign-up/page.tsx` | MODIFY | Low (change 1 URL) |
| `src/app/api/auth/signup/route.ts` | DELETE | Low (remove file) |
| `src/app/api/auth/signup/` | DELETE | Low (remove dir if empty) |
| Vercel Dashboard | MODIFY | Low (remove 1 env var) |

---

## Success Criteria

- ✅ `vercel deploy --prod` completes without errors
- ✅ Vercel build log shows: "✓ Build completed"
- ✅ No `SUPABASE_SERVICE_ROLE_KEY` in Vercel build output
- ✅ Signup form on production works end-to-end
- ✅ Error handling matches current behavior
- ✅ Rate limiting enforced
- ✅ TypeScript strict compilation passes

---

## References

**Current Code:**
- Vercel route: `src/app/api/auth/signup/route.ts` (179 lines)
- Frontend: `src/app/(auth)/sign-up/page.tsx` (lines 64-73 — fetch call)
- Backend server: `backend/src/server.ts` (mount point for new route)
- Error normalizer: `src/lib/auth-errors.ts` (reuse this for frontend error display)

**Architecture:**
- Vercel: Frontend only, HTTPS://vercel deployment
- Render: Backend only, https://voxanneai.onrender.com
- Supabase: Auth provider (accessed via service role from Render only)

---

## Notes

- **No new npm packages needed** — uses existing express, supabase SDK
- **Backward compatible** — response shape unchanged, frontend error handling unchanged
- **Timing:** This is a critical fix for production readiness (security + build reliability)
- **Post-fix:** Once this merges, Vercel deployment becomes deterministic (no service role key required)
