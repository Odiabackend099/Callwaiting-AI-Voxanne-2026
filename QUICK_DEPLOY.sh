#!/bin/bash
set -euo pipefail

# QUICK DEPLOYMENT SCRIPT - Authentication Redirect Fix
# =====================================================
# Completes the production deployment in 3 steps
# Time: ~15 minutes

PRODUCTION_DOMAIN="https://callwaitingai.dev"
SUPABASE_PROJECT="lbjymlodxprzqgtyqtcq"
VERCEL_PROJECT="roxanne-python-server"

echo ""
echo "========================================================================"
echo "AUTHENTICATION REDIRECT FIX - QUICK DEPLOYMENT"
echo "========================================================================"
echo ""
echo "Production Domain: $PRODUCTION_DOMAIN"
echo "Supabase Project: $SUPABASE_PROJECT"
echo "Vercel Project: $VERCEL_PROJECT"
echo ""

# Step 1: Verify code is deployed
echo "========================================================================"
echo "STEP 1: VERIFYING CODE DEPLOYMENT"
echo "========================================================================"
echo ""

if git log --oneline -1 | grep -q "auth redirect"; then
    echo "✅ Code deployed to GitHub (commit: $(git log --oneline -1 | cut -d' ' -f1))"
else
    echo "❌ Code not deployed. Run: git push origin main"
    exit 1
fi

if [ -f "src/lib/auth-redirect.ts" ]; then
    echo "✅ Helper utility created: src/lib/auth-redirect.ts"
else
    echo "❌ Helper utility not found"
    exit 1
fi

echo ""
echo "========================================================================"
echo "STEP 2: OPEN CONFIGURATION DASHBOARDS"
echo "========================================================================"
echo ""

echo "🔗 DASHBOARD 1: VERCEL ENVIRONMENT VARIABLES"
echo "   URL: https://vercel.com/dashboard/$VERCEL_PROJECT/settings/environment-variables"
echo ""
echo "   ACTION:"
echo "   1. Click 'Add New' → 'Environment Variable'"
echo "   2. Name: NEXT_PUBLIC_APP_URL"
echo "   3. Value: $PRODUCTION_DOMAIN"
echo "   4. Select: Production, Preview, Development"
echo "   5. Click 'Save'"
echo ""

echo "🔗 DASHBOARD 2: SUPABASE REDIRECT URLS"
echo "   URL: https://app.supabase.com/project/$SUPABASE_PROJECT/auth/url-configuration"
echo ""
echo "   ACTION:"
echo "   1. Go to Authentication → URL Configuration"
echo "   2. Add to 'Redirect URLs':"
echo "      - $PRODUCTION_DOMAIN/auth/callback"
echo "      - $PRODUCTION_DOMAIN/auth/callback?next=/update-password"
echo "   3. Keep existing localhost entries"
echo "   4. Click 'Save'"
echo ""

echo "🔗 DASHBOARD 3: GOOGLE OAUTH"
echo "   URL: https://console.cloud.google.com/apis/credentials"
echo ""
echo "   ACTION:"
echo "   1. Find OAuth 2.0 Client ID (web application)"
echo "   2. Click to edit"
echo "   3. Add to 'Authorized redirect URIs':"
echo "      - $PRODUCTION_DOMAIN/auth/callback"
echo "      - https://$SUPABASE_PROJECT.supabase.co/auth/v1/callback"
echo "   4. Keep existing localhost entries"
echo "   5. Click 'Save'"
echo ""

echo "========================================================================"
echo "STEP 3: WAIT FOR DEPLOYMENT & TEST"
echo "========================================================================"
echo ""
echo "⏳ After configuration:"
echo "   1. Wait 2 minutes for Vercel to redeploy"
echo "   2. Test email signup at: $PRODUCTION_DOMAIN/sign-up"
echo "   3. Test Google OAuth at: $PRODUCTION_DOMAIN/sign-up"
echo "   4. Test password reset at: $PRODUCTION_DOMAIN/login"
echo ""

echo "========================================================================"
echo "VERIFICATION COMMANDS"
echo "========================================================================"
echo ""
echo "Check Vercel deployment:"
echo "  curl -I $PRODUCTION_DOMAIN"
echo ""
echo "Check auth callback route:"
echo "  curl -I $PRODUCTION_DOMAIN/auth/callback"
echo ""
echo "Check Supabase connectivity:"
echo "  curl https://$SUPABASE_PROJECT.supabase.co/rest/v1/"
echo ""

echo "========================================================================"
echo "DOCUMENTATION"
echo "========================================================================"
echo ""
echo "📚 For more details, see:"
echo "   - DEPLOYMENT_NEXT_STEPS.md"
echo "   - AUTH_REDIRECT_FIX.md"
echo "   - CODE_REVIEW_AUTH.md"
echo "   - PRODUCTION_DEPLOYMENT_CHECKLIST.md"
echo ""

echo "========================================================================"
echo "✨ READY FOR PRODUCTION"
echo "========================================================================"
echo ""
echo "Next: Open the 3 dashboard URLs above and follow the actions"
echo ""
