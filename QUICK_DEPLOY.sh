#!/bin/bash

# 🚀 Quick Deployment Script for Vapi Tool Registration Automation
# All 7 Phases - Ready for Production

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Vapi Tool Registration - Quick Deployment Guide              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

echo "✅ STEP 1: Phase 7 Migration (MANUAL - Go to Supabase Dashboard)"
echo "───────────────────────────────────────────────────────────────"
echo "1. Go to: https://app.supabase.com"
echo "2. Select project: Callwaiting-AI-Voxanne-2026"
echo "3. Go to: SQL Editor → New query"
echo "4. Copy content from: backend/migrations/add_definition_hash_to_org_tools.sql"
echo "5. Click: Run"
echo "6. Verify: No errors shown"
echo ""
echo "Then come back and run: npx ts-node backend/scripts/migrate-existing-tools.ts --dry-run"
echo ""
echo "Press ENTER to continue..."
read

echo ""
echo "✅ STEP 2: Dry Run Migration (Safe Testing)"
echo "───────────────────────────────────────────────────────────────"
npx ts-node backend/scripts/migrate-existing-tools.ts --dry-run

echo ""
echo "Review the output above to verify what will be migrated."
echo ""
echo "Ready to migrate? This will register tools for ALL existing organizations."
echo "Press ENTER to continue... (Ctrl+C to cancel)"
read

echo ""
echo "✅ STEP 3: Run Migration (This may take 1-5 minutes)"
echo "───────────────────────────────────────────────────────────────"
npx ts-node backend/scripts/migrate-existing-tools.ts

echo ""
echo "✅ STEP 4: Verify Deployment"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Run these commands in Supabase SQL Editor:"
echo ""
echo "SELECT o.name as organization, COUNT(*) as tool_count"
echo "FROM org_tools ot"
echo "JOIN organizations o ON ot.org_id = o.id"
echo "GROUP BY o.id, o.name"
echo "ORDER BY o.name;"
echo ""
echo "✅ STEP 5: Test End-to-End"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "1. Open founder console"
echo "2. Create or edit an agent"
echo "3. Click 'Save Agent'"
echo "4. Check logs: tail -f backend/logs/app.log | grep -i 'tool'"
echo ""
echo "Should see: 'Tools linked to assistant successfully' ✅"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETE                                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
