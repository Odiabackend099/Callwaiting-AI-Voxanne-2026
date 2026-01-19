#!/usr/bin/env bash

# Quick diagnostic script to check agent sync status
# Usage: ./check-agent-sync.sh

echo "🔍 VOXANNE AGENT SYNC DIAGNOSTIC"
echo "================================="
echo

# Get credentials from environment
SUPABASE_URL="${SUPABASE_URL:-https://lbjymlodxprzqgtyqtcq.supabase.co}"
SUPABASE_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

if [ -z "$SUPABASE_KEY" ]; then
  echo "❌ SUPABASE key not found in environment"
  echo "Please source .env: source backend/.env"
  exit 1
fi

echo "✅ Supabase URL: $SUPABASE_URL"
echo "✅ API Key loaded"
echo

# Step 1: List all organizations
echo "Step 1: Finding organizations..."
echo

ORG_LIST=$(curl -s "$SUPABASE_URL/rest/v1/organizations?limit=20&select=id,name" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json")

# Count organizations
ORG_COUNT=$(echo "$ORG_LIST" | grep -o '"id"' | wc -l)

echo "Found $ORG_COUNT organizations"
echo

# Extract and display organizations
if command -v jq &> /dev/null; then
  echo "$ORG_LIST" | jq -r '.[] | "  • \(.name) (ID: \(.id[0:8])...)"'
else
  # Fallback without jq
  echo "$ORG_LIST" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read name; do
    echo "  • $name"
  done
fi

echo
echo "Step 2: Looking for agents..."
echo

# If you know the org ID, you can pass it as argument
if [ ! -z "$1" ]; then
  ORG_ID="$1"
  echo "Using organization ID: $ORG_ID"
  echo

  # Get agents for this org
  curl -s "$SUPABASE_URL/rest/v1/agents?org_id=eq.$ORG_ID&select=id,role,name,vapi_assistant_id,created_at,updated_at" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" > /tmp/agents.json

  if command -v jq &> /dev/null; then
    AGENT_COUNT=$(cat /tmp/agents.json | jq 'length')
    echo "Found $AGENT_COUNT agents:"
    echo
    cat /tmp/agents.json | jq -r '.[] | "  Role: \(.role)\n    Name: \(.name)\n    Vapi ID: \(.vapi_assistant_id // "❌ NULL")\n    Updated: \(.updated_at)\n"'
  else
    echo "Use jq to parse agents:"
    echo "  jq . /tmp/agents.json"
  fi
else
  echo "Tip: Pass org ID to get agents for specific organization:"
  echo "  ./check-agent-sync.sh <ORG_ID>"
fi

echo
echo "✅ Diagnostic complete"
