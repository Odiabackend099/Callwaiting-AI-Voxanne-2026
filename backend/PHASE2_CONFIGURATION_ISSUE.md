# Phase 2: Configuration Issue

**Date:** 2025-01-10  
**Issue:** Service role key project mismatch

---

## 🔍 Issue Identified

The service role key provided is for a different Supabase project than the one connected via MCP.

### Project Mismatch

- **MCP Connected Project:** `igdaiursvzwnqucvrhdo`
  - URL: `https://igdaiursvzwnqucvrhdo.supabase.co`
  - Status: ✅ Resolves and accessible
  - This is the active project in Supabase MCP

- **Service Role Key Project:** `lbjymlodyxprzqgtyqtcq`
  - URL: `https://lbjymlodyxprzqgtyqtcq.supabase.co`
  - Status: ❌ Does not resolve (DNS lookup fails)
  - The service role key is for this project

### Error Messages

1. **First Attempt (with `lbjymlodyxprzqgtyqtcq` URL):**
   - Error: `getaddrinfo ENOTFOUND lbjymlodyxprzqgtyqtcq.supabase.co`
   - Cause: DNS lookup failed - project URL doesn't exist

2. **Second Attempt (with `igdaiursvzwnqucvrhdo` URL):**
   - Error: `Invalid API key`
   - Cause: Service role key is for a different project (`lbjymlodyxprzqgtyqtcq`)

---

## ✅ Solution Options

### Option 1: Get Service Role Key for Active Project (Recommended)

The service role key needs to match the active MCP project (`igdaiursvzwnqucvrhdo`).

**Steps:**
1. Log in to Supabase Dashboard: https://app.supabase.com
2. Select the project: `igdaiursvzwnqucvrhdo` (or check which project is active in MCP)
3. Navigate to: Settings > API
4. Find "service_role" key in "Project API keys" section
5. Click "Reveal" and copy the key
6. Update `.env` file:
   ```env
   SUPABASE_URL=https://igdaiursvzwnqucvrhdo.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-correct-service-role-key-here
   ```

### Option 2: Use Different Project (If Intended)

If you intended to use project `lbjymlodyxprzqgtyqtcq`:

1. Verify the project exists in Supabase Dashboard
2. Check if the project is paused or deleted
3. If project exists, verify the correct URL format
4. Update `.env` with correct URL (if different)
5. Ensure service role key matches the project

### Option 3: Check Project Access

It's possible:
- The project `lbjymlodyxprzqgtyqtcq` has been paused/deleted
- The project URL format is different
- Network/DNS issues preventing resolution
- The project is in a different organization/region

---

## 🔧 Current Configuration

**Current `.env` file:**
```env
SUPABASE_URL=https://igdaiursvzwnqucvrhdo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA
```

**Issue:** Service role key project ref (`lbjymlodyxprzqgtyqtcq`) doesn't match URL project ref (`igdaiursvzwnqucvrhdo`)

---

## 📋 Next Steps

1. **Verify Active Project:**
   - Check which Supabase project is connected via MCP
   - Verify project status in Supabase Dashboard

2. **Get Correct Service Role Key:**
   - For project `igdaiursvzwnqucvrhdo`: Get service role key from Settings > API
   - Update `.env` with correct key

3. **Or Update Project Connection:**
   - If you need to use project `lbjymlodyxprzqgtyqtcq`:
     - Verify project exists and is accessible
     - Update MCP configuration if needed
     - Use correct project URL

4. **Test Connection:**
   ```bash
   cd backend
   export $(cat .env | grep -v '^#' | xargs)
   npm test -- rls-cross-tenant-isolation.test.ts
   ```

---

## 🔒 Security Note

⚠️ **Important:** Service role keys are sensitive credentials. Ensure:
- Never commit `.env` to version control (already in `.gitignore`)
- Only share service role keys through secure channels
- Rotate keys if accidentally exposed
- Use different keys for different environments (dev/staging/prod)

---

## 📊 Status

- ✅ Environment setup script created
- ✅ Test suites ready
- ❌ Configuration issue: Project mismatch
- ⏭️ **BLOCKED:** Awaiting correct service role key

---

**Last Updated:** 2025-01-10  
**Resolution Required:** Get service role key for project `igdaiursvzwnqucvrhdo`  
**See:** `backend/PHASE2_TEST_SETUP.md` for setup instructions
