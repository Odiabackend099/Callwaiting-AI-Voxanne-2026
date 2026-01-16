#!/bin/bash

# Phase 6: Index Deployment - Manual Instructions
# 
# If automatic deployment script fails, use this manual process
# Time: 5 minutes
# Impact: 30-50% latency improvement (582ms → ~400ms p95)

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║    PHASE 6: MANUAL INDEX DEPLOYMENT INSTRUCTIONS          ║"
echo "║    Follow these steps to apply indexes in Supabase        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "STEP 1: Access Supabase Dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Go to: https://app.supabase.com"
echo "2. Select your project"
echo "3. Click 'SQL Editor' in the left sidebar"
echo "4. Click '+ New Query' button"
echo ""

echo "STEP 2: Copy the Following SQL Statements"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
-- Phase 6 Performance Optimization: Create Strategic Indexes
-- Expected impact: 30-50% latency reduction
-- Timeline: ~2-3 minutes for all indexes to create

-- 1. PRIMARY OPTIMIZATION: Composite index for conflict detection
-- This is the most critical index - 80ms → 10ms speedup
CREATE INDEX IF NOT EXISTS idx_appointments_org_contact_date 
ON appointments(org_id, contact_id, scheduled_at DESC);

-- 2. Organization isolation index
-- Speeds up: SELECT * FROM appointments WHERE org_id = ?
CREATE INDEX IF NOT EXISTS idx_appointments_org_id 
ON appointments(org_id);

-- 3. Contact-based lookups
-- Speeds up: SELECT * FROM appointments WHERE contact_id = ?
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id 
ON appointments(contact_id);

-- 4. Time-range query optimization
-- Speeds up: SELECT * FROM appointments WHERE scheduled_at BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at 
ON appointments(scheduled_at DESC);

-- 5. Contact verification by org
-- Speeds up: SELECT * FROM contacts WHERE id = ? AND org_id = ?
CREATE INDEX IF NOT EXISTS idx_contacts_org_id_id 
ON contacts(org_id, id);

-- 6. Organization lookups
-- Speeds up: SELECT * FROM organizations WHERE id = ?
CREATE INDEX IF NOT EXISTS idx_organizations_id 
ON organizations(id);

-- 7. Status filtering optimization
-- Speeds up: SELECT * FROM appointments WHERE org_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_appointments_org_status 
ON appointments(org_id, status);

-- Refresh query planner with statistics
-- This helps PostgreSQL use the new indexes effectively
ANALYZE;

EOF

echo ""
echo "STEP 3: Paste and Execute"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Copy all SQL above (from CREATE INDEX to ANALYZE)"
echo "2. Paste into the Supabase SQL Editor query window"
echo "3. Click the 'RUN' button (or Ctrl+Enter)"
echo "4. Wait for 'All done!' message (2-3 minutes)"
echo ""

echo "STEP 4: Verify Indexes Were Created"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Run this verification query to confirm all 7 indexes exist:"
echo ""

cat << 'EOF'
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_appointments_%'
  OR indexname LIKE 'idx_contacts_%'
  OR indexname LIKE 'idx_organizations_%'
ORDER BY indexname;

EOF

echo ""
echo "Expected Result: 7 rows returned (one for each index)"
echo ""

echo "STEP 5: Monitor Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "After clicking RUN, you should see:"
echo "  ✅ No errors"
echo "  ✅ 'All done!' message"
echo "  ✅ Query execution time: ~2-3 minutes"
echo ""

echo "STEP 6: Performance Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "After indexes are created, run tests locally:"
echo ""
echo "  cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend"
echo "  node scripts/performance-validation.js"
echo ""
echo "Expected latency improvement:"
echo "  Before: 30 concurrent p95 = 582ms"
echo "  After:  30 concurrent p95 = ~400ms (-31%)"
echo ""

echo "TROUBLESHOOTING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "If you get errors:"
echo ""
echo "ERROR: Index already exists"
echo "  └─ This is OK - the IF NOT EXISTS prevents duplicates"
echo ""
echo "ERROR: Permission denied"
echo "  └─ Use SERVICE_ROLE_KEY for authentication (not anon key)"
echo ""
echo "ERROR: Timeout (>10 minutes)"
echo "  └─ Cancel the query and try again"
echo "  └─ Large tables may take longer on shared infrastructure"
echo ""
echo "CRITICAL: Verify data integrity after"
echo "  └─ Run smoke tests: node scripts/smoke-test-v2.js"
echo "  └─ Run UAT tests: node scripts/uat-simple.js"
echo ""

echo "═════════════════════════════════════════════════════════════"
echo "Ready to deploy? Open Supabase and follow steps above!"
echo "═════════════════════════════════════════════════════════════"
echo ""
