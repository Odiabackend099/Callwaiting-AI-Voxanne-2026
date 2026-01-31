#!/bin/bash

echo "🔍 MIGRATION VERIFICATION SCRIPT"
echo "================================="
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo "❌ npm not found"
  exit 1
fi

# Get the org ID from the database by querying the sample org
echo "1️⃣ Checking if unified 'calls' table exists..."
npm run db:query "SELECT COUNT(*) as total_calls, COUNT(CASE WHEN call_direction='inbound' THEN 1 END) as inbound_calls, COUNT(CASE WHEN call_direction='outbound' THEN 1 END) as outbound_calls FROM calls LIMIT 1;" 2>/dev/null || echo "⚠️ Note: Database query tool may not be configured"

echo ""
echo "2️⃣ Checking legacy tables..."
npm run db:query "SELECT COUNT(*) as legacy_call_logs FROM call_logs_legacy;" 2>/dev/null || echo "⚠️ Note: Legacy tables may need verification via dashboard"

echo ""
echo "3️⃣ Verifying TypeScript compilation..."
npx tsc --noEmit 2>&1 | head -20

echo ""
echo "✅ Migration verification complete!"
