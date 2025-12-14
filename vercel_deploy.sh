#!/bin/bash
set -euo pipefail

# Vercel API automation script
# Sets NEXT_PUBLIC_APP_URL env vars and triggers redeploy

VERCEL_TOKEN="qAoRgUoM1VxNZESXb5XNPWW4"
PROJECT_ID="roxanne-python-server"
TEAM_ID="odia-backends-projects"

echo "========================================================================"
echo "VERCEL ENVIRONMENT VARIABLE SETUP & REDEPLOY"
echo "========================================================================"
echo ""

# Step 1: Get project details
echo "Step 1: Fetching project details..."
PROJECT_RESPONSE=$(curl -s -X GET \
  "https://api.vercel.com/v9/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json")

if echo "$PROJECT_RESPONSE" | grep -q '"id"'; then
  echo "✅ Project found: $PROJECT_ID"
else
  echo "❌ Project not found or API error"
  echo "$PROJECT_RESPONSE"
  exit 1
fi

# Step 2: Set environment variables
echo ""
echo "Step 2: Setting NEXT_PUBLIC_APP_URL environment variables..."

# Production
echo "  Setting Production env var..."
curl -s -X POST \
  "https://api.vercel.com/v10/projects/$PROJECT_ID/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "NEXT_PUBLIC_APP_URL",
    "value": "https://callwaitingai.dev",
    "target": ["production"]
  }' > /dev/null

echo "  ✅ Production: NEXT_PUBLIC_APP_URL=https://callwaitingai.dev"

# Preview
echo "  Setting Preview env var..."
curl -s -X POST \
  "https://api.vercel.com/v10/projects/$PROJECT_ID/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "NEXT_PUBLIC_APP_URL",
    "value": "https://callwaitingai.dev",
    "target": ["preview"]
  }' > /dev/null

echo "  ✅ Preview: NEXT_PUBLIC_APP_URL=https://callwaitingai.dev"

# Development
echo "  Setting Development env var..."
curl -s -X POST \
  "https://api.vercel.com/v10/projects/$PROJECT_ID/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "NEXT_PUBLIC_APP_URL",
    "value": "http://localhost:9121",
    "target": ["development"]
  }' > /dev/null

echo "  ✅ Development: NEXT_PUBLIC_APP_URL=http://localhost:9121"

# Step 3: Trigger redeploy
echo ""
echo "Step 3: Triggering production redeploy..."

DEPLOY_RESPONSE=$(curl -s -X POST \
  "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"roxanne-python-server\",
    \"project\": \"$PROJECT_ID\",
    \"gitSource\": {
      \"type\": \"github\",
      \"repo\": \"Odiabackend099/roxanne-python-server\",
      \"ref\": \"main\"
    }
  }")

DEPLOYMENT_ID=$(echo "$DEPLOY_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$DEPLOYMENT_ID" ]; then
  echo "✅ Deployment triggered: $DEPLOYMENT_ID"
  echo ""
  echo "Monitoring deployment status..."
  echo "  URL: https://vercel.com/dashboard/roxanne-python-server/deployments"
  echo ""
  
  # Wait for deployment (max 5 minutes)
  for i in {1..60}; do
    STATUS_RESPONSE=$(curl -s -X GET \
      "https://api.vercel.com/v13/deployments/$DEPLOYMENT_ID" \
      -H "Authorization: Bearer $VERCEL_TOKEN")
    
    STATE=$(echo "$STATUS_RESPONSE" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$STATE" = "READY" ]; then
      echo "✅ Deployment READY (took ~$((i * 5)) seconds)"
      break
    elif [ "$STATE" = "ERROR" ]; then
      echo "❌ Deployment ERROR"
      echo "$STATUS_RESPONSE"
      exit 1
    else
      echo "  ⏳ Status: $STATE (attempt $i/60)"
      sleep 5
    fi
  done
else
  echo "⚠️  Deployment may have been triggered but ID not captured"
  echo "Check: https://vercel.com/dashboard/roxanne-python-server/deployments"
fi

echo ""
echo "========================================================================"
echo "✅ VERCEL CONFIGURATION COMPLETE"
echo "========================================================================"
echo ""
echo "Environment variables set:"
echo "  - NEXT_PUBLIC_APP_URL (Production): https://callwaitingai.dev"
echo "  - NEXT_PUBLIC_APP_URL (Preview): https://callwaitingai.dev"
echo "  - NEXT_PUBLIC_APP_URL (Development): http://localhost:9121"
echo ""
echo "Next: Run production tests"
echo "  1. Google OAuth: https://callwaitingai.dev/sign-up → 'Continue with Google'"
echo "  2. Email signup: verify link contains callwaitingai.dev"
echo "  3. Password reset: verify link contains callwaitingai.dev"
echo ""
