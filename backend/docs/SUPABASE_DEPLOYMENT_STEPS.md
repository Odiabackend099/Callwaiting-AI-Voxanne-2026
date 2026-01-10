# RPC Functions - Supabase Deployment Steps

**Date**: December 21, 2025
**Project**: lbjymlodxprzqgtyqtcq
**Migration File**: `migrations/20251221_create_atomic_call_handlers.sql`

---

## ⚠️ Important: Database Password Required

To deploy using CLI or psql, you need your Supabase **database password** (not API key).

This is different from the access token. Get it from:
1. Go to: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/settings/database
2. Look for "Database Password" or "Reset password"
3. Use that password below

---

## Option 1: Supabase Dashboard (RECOMMENDED - No Password Needed)

### Steps:
1. **Open Supabase Dashboard**
   ```
   https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/sql
   ```

2. **Create New Query**
   - Click "New Query" button
   - Give it a name: "Deploy RPC Functions"

3. **Copy Migration SQL**
   - File: `migrations/20251221_create_atomic_call_handlers.sql`
   - Select all (397 lines)
   - Copy entire contents

4. **Paste into Editor**
   - Right-click in SQL editor
   - Paste entire migration

5. **Execute**
   - Click **Run** button (or Cmd+Enter)
   - Wait for success message

6. **Verify Success**
   ```sql
   -- Run in new query to verify:
   SELECT routine_name FROM information_schema.routines
   WHERE routine_name LIKE 'create_inbound_call_atomically'
      OR routine_name LIKE 'update_call_completed_atomically'
      OR routine_name LIKE 'update_call_with_recording_atomically'
   ORDER BY routine_name;
   
   -- Should return 3 rows
   ```

---

## Option 2: Supabase CLI (Requires Database Password)

### Prerequisites:
- Supabase CLI installed: ✅ (already available)
- Database password: ❓ (need to get from Supabase settings)
- Access token: ✅ (already provided)

### Steps:

```bash
# 1. Set environment variables
export SUPABASE_ACCESS_TOKEN="sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8"
export DB_PASSWORD="your_database_password_here"

# 2. Navigate to project
cd "/Users/mac/Desktop/callwaiting ai/Callwaiting-AI-Voxanne-2026/backend"

# 3. Check what migrations will be applied
supabase db push --dry-run

# 4. Deploy migrations
supabase db push -p "$DB_PASSWORD"
```

### If "linked" project:
```bash
# If project is already linked to Supabase:
supabase db push

# You'll be prompted for password if needed
```

---

## Option 3: Direct PostgreSQL Connection (Requires psql + Password)

### Prerequisites:
- psql installed: ❌ (not available in current environment)
- Database password: ❓ (need from Supabase settings)

### Steps:

```bash
# 1. Connect to Supabase PostgreSQL and run migration
psql -h lbjymlodxprzqgtyqtcq.supabase.co \
     -U postgres \
     -d postgres \
     -p 5432 \
     -f "migrations/20251221_create_atomic_call_handlers.sql"

# 2. When prompted, enter your database password

# 3. Verify success (in psql):
\df create_inbound_call_atomically
\df update_call_completed_atomically
\df update_call_with_recording_atomically
```

---

## Option 4: Docker + psql (If Local PostgreSQL Needed)

```bash
# Run PostgreSQL container
docker run --rm \
  -e PGPASSWORD="your_database_password" \
  postgres:15 \
  psql -h lbjymlodxprzqgtyqtcq.supabase.co \
       -U postgres \
       -d postgres \
       -p 5432 \
       -f migrations/20251221_create_atomic_call_handlers.sql
```

---

## Verification After Deployment

### Via Supabase Dashboard:

```sql
-- Run this in SQL Editor to verify all 3 functions exist:

SELECT 
  routine_name,
  routine_type,
  created
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE 'create_inbound_call_atomically'
       OR routine_name LIKE 'update_call_completed_atomically'
       OR routine_name LIKE 'update_call_with_recording_atomically')
ORDER BY routine_name;
```

**Expected Result**: 3 rows (one for each function)

---

## Verification via CLI:

```bash
# If using psql:
psql -h lbjymlodxprzqgtyqtcq.supabase.co \
     -U postgres \
     -d postgres \
     -c "SELECT routine_name FROM information_schema.routines \
         WHERE routine_name LIKE '%call_atomically' \
         ORDER BY routine_name;"

# Should show:
# create_inbound_call_atomically
# update_call_completed_atomically
# update_call_with_recording_atomically
```

---

## Troubleshooting

### "Cannot connect to database"
- **Cause**: Wrong password or wrong host
- **Solution**: Verify credentials in Supabase dashboard
- **Check**: Can you connect to Supabase via Dashboard? Yes → use Option 1

### "Migration already exists"
- **Cause**: Migration was already applied
- **Solution**: This is safe - functions will be recreated with REPLACE
- **Action**: Continue, it's idempotent

### "Function exists and cannot be replaced"
- **Cause**: Existing function with different signature
- **Solution**: Drop and recreate (migration handles this with CREATE OR REPLACE)

### "Syntax error in SQL"
- **Cause**: Corruption during file copy/paste
- **Solution**: Download fresh from project files
- **Try**: Use Option 1 (Dashboard) - less error-prone

---

## Recommended Order:

1. ✅ **Try Option 1 First** (Supabase Dashboard - easiest, no password needed)
2. ⏭️ **If Dashboard works**, then update application code
3. 🔄 **Then use Option 2** (CLI) for future deployments
4. 🐳 **Use Option 4** (Docker) only if needed for CI/CD automation

---

## Next After Deployment:

Once migration is deployed:

1. **Update webhook handlers** (src/routes/webhooks.ts)
   - Call new RPC functions instead of individual INSERTs
   - Add authorization checks

2. **Run test suite** (RPC_DEPLOYMENT_CHECKLIST.md)
   - 11 phases of testing
   - 50+ specific test cases

3. **Deploy application code**
   - git push to main
   - Render auto-deploys

4. **Monitor first 24 hours**
   - Watch logs for errors
   - Verify webhook latency < 500ms
   - Confirm no NULL org_ids

---

## Database Password Location:

If you need to find your Supabase database password:

1. Go to: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/settings/database
2. Scroll down to "Connection pooler" or "Direct connection"
3. Look for **Password** field
4. If you forgot it, click **Reset password** (will take effect immediately)
5. Use that password in the commands above

---

**Status**: Ready for deployment
**Recommended Method**: Option 1 (Supabase Dashboard)
**Estimated Time**: 5 minutes

