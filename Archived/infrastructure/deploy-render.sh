#!/bin/bash
set -e

echo "🚀 Deploying Voxanne Backend to Render..."
echo "=========================================="

# Since Render API requires GitHub OAuth connection first,
# we'll use a workaround: create a render.yaml and push it,
# then use Render's auto-detection

# Step 1: Ensure render.yaml is committed
echo "✅ Step 1: Verifying render.yaml..."
if [ ! -f "render.yaml" ]; then
  echo "❌ render.yaml not found!"
  exit 1
fi

# Step 2: Commit and push if needed
echo "✅ Step 2: Pushing to GitHub..."
git add render.yaml
git diff --quiet && git diff --staged --quiet || git commit -m "chore: update render.yaml" || true
git push origin main

echo ""
echo "✅ Code pushed to GitHub!"
echo ""
echo "📋 Next: Manual Render Setup Required"
echo "======================================"
echo ""
echo "Render requires GitHub OAuth connection which can't be automated via API."
echo "Please follow these steps:"
echo ""
echo "1. Go to: https://dashboard.render.com/select-repo?type=web"
echo "2. Search for: Callwaiting-AI-Voxanne-2026"
echo "3. Click 'Connect'"
echo "4. Render will auto-detect render.yaml and configure everything"
echo "5. Click 'Apply' to create the service"
echo ""
echo "All environment variables are pre-configured in render.yaml!"
echo ""
echo "⚠️  IMPORTANT: After deployment, you need to manually add these secrets:"
echo "   (Render doesn't allow secrets in render.yaml for security)"
echo ""
echo "   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA"
echo "   VAPI_API_KEY=fa8fe4f9-4f22-4efd-af6f-37351aaf1628"
echo "   OPENAI_API_KEY=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"
echo "   TWILIO_AUTH_TOKEN=919da20c675c7e4c5a6d8060863042d8"
echo ""
echo "Alternative: Use Railway (fully CLI-based)"
echo "=========================================="
echo ""
echo "Railway supports full CLI deployment without OAuth:"
echo ""
echo "  npm install -g @railway/cli"
echo "  railway login"
echo "  railway init"
echo "  railway up"
echo ""
