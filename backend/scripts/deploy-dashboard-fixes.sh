#!/bin/bash
# Quick Deployment Script for Dashboard API Fixes
# Run this after applying the database migration

set -e

echo "🚀 Dashboard API Fixes - Quick Deployment"
echo "=========================================="
echo ""

# Step 1: Check if migration applied
echo "📋 Step 1: Checking migration status..."
npx ts-node scripts/test-dashboard-api-fixes.ts
echo ""

# Step 2: Rebuild backend
echo "🔨 Step 2: Rebuilding backend..."
npm run build
echo "✅ Build complete"
echo ""

# Step 3: Git commit (optional)
echo "📦 Step 3: Ready to commit changes"
echo ""
echo "Run these commands to commit:"
echo "  git add backend/src/routes/"
echo "  git add backend/migrations/20260125_create_messages_table.sql"
echo "  git commit -m \"feat: fix API field mismatches and add action endpoints\""
echo ""

echo "=========================================="
echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Test endpoints manually (see deployment_checklist.md)"
echo "2. Verify dashboard loads without errors"
echo "3. Check messages table for audit logs"
echo ""
