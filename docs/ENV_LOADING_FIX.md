# Environment Variable Loading Fix

**Date:** January 10, 2026  
**Issue:** Backend endpoints returning 500 errors due to "Invalid API key" - Supabase credentials not loading

---

## Problem

Backend server was running but Supabase client was throwing "Invalid API key" errors because environment variables from `backend/.env` were not being loaded correctly when using `tsx` to run TypeScript files.

**Root Cause:**
- `load-env.ts` used ESM syntax (`import.meta.url`) which doesn't work correctly with tsx
- `__dirname` is not always available in TypeScript/tsx context
- Environment variables were not loading before Supabase client initialization

---

## Solution Applied

**Changed approach to use `process.cwd()` instead of `__dirname`:**

1. **`backend/src/server.ts`** - Load .env using `process.cwd()`
2. **`backend/src/services/supabase-client.ts`** - Also load .env as fallback
3. Removed ESM-specific `load-env.ts` imports

**Code Changes:**

```typescript
// backend/src/server.ts
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
require('dotenv').config({ path: envPath });

// backend/src/services/supabase-client.ts  
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
require('dotenv').config({ path: envPath });
```

**Why `process.cwd()`?**
- `process.cwd()` returns the current working directory (where `npm run dev` is executed from)
- When running from `backend/` directory, `process.cwd()` = `/path/to/backend/`
- More reliable than `__dirname` with tsx TypeScript execution

---

## Verification

**Manual Test (Works):**
```bash
cd backend
node -e "require('dotenv').config({ path: '.env' }); console.log(process.env.SUPABASE_URL);"
# ✅ Loads correctly
```

**Runtime Issue:**
- Environment variables load when passed via command line
- Environment variables don't load from `.env` file at runtime with tsx

---

## Status

✅ **Code fixes applied**
- Using `process.cwd()` for reliable path resolution
- Both `server.ts` and `supabase-client.ts` load `.env` explicitly

⏳ **Testing required**
- Restart backend and test endpoints
- Verify Supabase connection works

---

## Next Steps

1. Verify `.env` file exists in `backend/` directory
2. Ensure Supabase credentials in `.env` are correct
3. Test all three endpoints after restart
4. If still failing, check Supabase service role key validity
