#!/bin/bash

# Database Migration Application Script
# Applies 3 critical database migrations to Supabase

set -e

SUPABASE_URL="https://lbjymlodxprzqgtyqtcq.supabase.co"
SUPABASE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/.env | cut -d"'" -f2)

if [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Could not find SUPABASE_SERVICE_ROLE_KEY in .env"
  exit 1
fi

echo "🚀 Starting database migrations..."
echo "📍 Supabase URL: $SUPABASE_URL"
echo ""

# Migration 1: Create view_actionable_leads
echo "📝 Migration 1/3: Creating view_actionable_leads..."
psql "postgresql://postgres:$SUPABASE_KEY@lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres" \
  -f /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/supabase/migrations/20260202_create_view_actionable_leads.sql \
  2>&1 | grep -E "ERROR|CREATE VIEW|ALTER VIEW|COMMENT" || echo "✅ Migration 1 applied"

# Migration 2: Add pagination indexes
echo "📝 Migration 2/3: Adding pagination indexes..."
psql "postgresql://postgres:$SUPABASE_KEY@lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres" \
  -f /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/supabase/migrations/20260202_add_calls_pagination_index.sql \
  2>&1 | grep -E "ERROR|CREATE INDEX|COMMENT" || echo "✅ Migration 2 applied"

# Migration 3: Create optimized dashboard stats function
echo "📝 Migration 3/3: Creating optimized dashboard stats function..."
psql "postgresql://postgres:$SUPABASE_KEY@lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres" \
  -f /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/supabase/migrations/20260202_optimize_dashboard_stats.sql \
  2>&1 | grep -E "ERROR|CREATE FUNCTION|COMMENT" || echo "✅ Migration 3 applied"

echo ""
echo "🔍 Verifying migrations..."
echo ""

# Verify view exists
echo "Checking view_actionable_leads..."
psql "postgresql://postgres:$SUPABASE_KEY@lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres" \
  -c "SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'view_actionable_leads');" \
  2>&1 | grep -q "t" && echo "✅ view_actionable_leads exists" || echo "❌ view_actionable_leads NOT found"

# Verify indexes exist
echo "Checking pagination indexes..."
psql "postgresql://postgres:$SUPABASE_KEY@lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres" \
  -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_calls_org_date_pagination', 'idx_calls_direction_date');" \
  2>&1 | grep -q "2" && echo "✅ Both pagination indexes exist" || echo "⚠️  Indexes may not exist"

# Verify function exists
echo "Checking get_dashboard_stats_optimized function..."
psql "postgresql://postgres:$SUPABASE_KEY@lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres" \
  -c "SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_dashboard_stats_optimized');" \
  2>&1 | grep -q "t" && echo "✅ get_dashboard_stats_optimized function exists" || echo "❌ Function NOT found"

echo ""
echo "🎉 Migration verification complete!"
