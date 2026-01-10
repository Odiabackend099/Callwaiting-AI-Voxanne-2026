# RPC Functions Deployment Instructions

## Issue
The RPC migration contains nested exception blocks that cannot be deployed via the Supabase MCP tool due to SQL parsing limitations.

## Solution: Deploy via Supabase Dashboard

### Steps:

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq
   - Navigate to: **SQL Editor**

2. **Open the Migration File**
   - File: `backend/migrations/20251221_create_atomic_call_handlers.sql`
   - Copy the entire contents (397 lines)

3. **Paste into SQL Editor**
   - Click **"New Query"**
   - Paste the full migration SQL
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

4. **Verify Deployment**
   Run this query to confirm functions were created:
   ```sql
   SELECT 
     routine_name,
     routine_type,
     security_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name LIKE '%atomically%'
   ORDER BY routine_name;
   ```

   **Expected Output:**
   - `create_inbound_call_atomically` - FUNCTION - INVOKER
   - `update_call_completed_atomically` - FUNCTION - INVOKER
   - `update_call_with_recording_atomically` - FUNCTION - INVOKER

5. **Test Functions**
   See `backend/RPC_DEPLOYMENT_CHECKLIST.md` for comprehensive test suite

## Why Manual Deployment?

The migration contains:
- Nested `BEGIN...EXCEPTION...END` blocks
- Complex exception handling with multiple WHEN clauses
- Format strings with PostgreSQL-specific syntax

These are valid in PostgreSQL but require direct execution rather than parameterized queries.

## Alternative: Use Supabase CLI

If you prefer command-line deployment:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref lbjymlodxprzqgtyqtcq

# Apply migration
supabase db push
```

## Status

- ✅ Migration file ready: `backend/migrations/20251221_create_atomic_call_handlers.sql`
- ⏳ Pending: Manual deployment via Supabase Dashboard
- ⏳ Pending: Function verification
- ⏳ Pending: Test suite execution

## Notes

This is **optional** for production deployment. The webhook handlers currently work without RPC functions. The RPC functions provide:
- Atomic transactions (all-or-nothing updates)
- Better error handling
- Idempotency for webhook retries
- Performance optimization

Deploy when you have time for thorough testing (2-3 hours recommended).
