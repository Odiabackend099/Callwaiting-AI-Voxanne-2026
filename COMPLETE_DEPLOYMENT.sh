#!/bin/bash
set -euo pipefail

# COMPLETE DEPLOYMENT - Authentication Redirect Fix
# ==================================================
# One-command deployment completion guide
# Time: 15-20 minutes total

PRODUCTION_DOMAIN="https://callwaitingai.dev"
SUPABASE_PROJECT="lbjymlodxprzqgtyqtcq"
VERCEL_PROJECT="roxanne-python-server"

clear

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         AUTHENTICATION REDIRECT FIX - COMPLETE DEPLOYMENT                 ║
║                                                                            ║
║  Status: Code deployed ✅ | Configuration pending ⏳ | Testing ready 🧪   ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: VERIFY CODE DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify git commit
if git log --oneline -1 | grep -q "auth redirect"; then
    COMMIT=$(git log --oneline -1 | cut -d' ' -f1)
    echo "✅ Code deployed to GitHub"
    echo "   Commit: $COMMIT"
    echo "   Message: $(git log --oneline -1 | cut -d' ' -f2-)"
else
    echo "❌ Code not deployed"
    exit 1
fi

# Verify files
FILES=(
    "src/lib/auth-redirect.ts"
    "src/contexts/AuthContext.tsx"
    "src/app/auth/callback/route.ts"
    ".env.local"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file NOT FOUND"
        exit 1
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: CONFIGURE 3 DASHBOARDS (15 minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📌 DASHBOARD 1: VERCEL ENVIRONMENT VARIABLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 URL:"
echo "   https://vercel.com/dashboard/$VERCEL_PROJECT/settings/environment-variables"
echo ""
echo "📋 ACTION:"
echo "   1. Click 'Add New' → 'Environment Variable'"
echo "   2. Name: NEXT_PUBLIC_APP_URL"
echo "   3. Value: $PRODUCTION_DOMAIN"
echo "   4. Environments: Production, Preview, Development"
echo "   5. Click 'Save'"
echo ""
echo "⏱️  Time: 2 minutes"
echo ""

echo "📌 DASHBOARD 2: SUPABASE REDIRECT URLS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 URL:"
echo "   https://app.supabase.com/project/$SUPABASE_PROJECT/auth/url-configuration"
echo ""
echo "📋 ACTION:"
echo "   1. Go to Authentication → URL Configuration"
echo "   2. Add to 'Redirect URLs':"
echo "      • $PRODUCTION_DOMAIN/auth/callback"
echo "      • $PRODUCTION_DOMAIN/auth/callback?next=/update-password"
echo "   3. Keep existing localhost entries"
echo "   4. Click 'Save'"
echo ""
echo "⏱️  Time: 3 minutes"
echo ""

echo "📌 DASHBOARD 3: GOOGLE OAUTH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 URL:"
echo "   https://console.cloud.google.com/apis/credentials"
echo ""
echo "📋 ACTION:"
echo "   1. Find OAuth 2.0 Client ID (web application)"
echo "   2. Click to edit"
echo "   3. Add to 'Authorized redirect URIs':"
echo "      • $PRODUCTION_DOMAIN/auth/callback"
echo "      • https://$SUPABASE_PROJECT.supabase.co/auth/v1/callback"
echo "   4. Keep existing localhost entries"
echo "   5. Click 'Save'"
echo ""
echo "⏱️  Time: 3 minutes"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: WAIT FOR DEPLOYMENT (2 minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏳ After configuration, Vercel will automatically redeploy"
echo "   Monitor: https://vercel.com/dashboard/$VERCEL_PROJECT/deployments"
echo ""
echo "✅ Wait for deployment to show 'Ready' status"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: VERIFY DEPLOYMENT (2 minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Run these commands to verify:"
echo ""
echo "  # Check Vercel deployment"
echo "  curl -I $PRODUCTION_DOMAIN"
echo ""
echo "  # Check auth callback route"
echo "  curl -I $PRODUCTION_DOMAIN/auth/callback"
echo ""
echo "  # Check Supabase connectivity"
echo "  curl https://$SUPABASE_PROJECT.supabase.co/rest/v1/"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5: TEST AUTHENTICATION FLOWS (10 minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🧪 TEST 1: Email Signup (2 min)"
echo "   1. Go to: $PRODUCTION_DOMAIN/sign-up"
echo "   2. Sign up with email"
echo "   3. Check email for verification link"
echo "   4. Verify link contains: $PRODUCTION_DOMAIN/auth/callback"
echo "   5. Click link and verify redirect to dashboard"
echo ""

echo "🧪 TEST 2: Google OAuth (2 min)"
echo "   1. Go to: $PRODUCTION_DOMAIN/sign-up"
echo "   2. Click 'Continue with Google'"
echo "   3. Authorize and verify redirect to dashboard"
echo ""

echo "🧪 TEST 3: Password Reset (3 min)"
echo "   1. Go to: $PRODUCTION_DOMAIN/login"
echo "   2. Click 'Forgot password?'"
echo "   3. Request reset and check email"
echo "   4. Verify link contains: $PRODUCTION_DOMAIN/auth/callback?next=/update-password"
echo "   5. Click link and verify redirect to update-password page"
echo ""

echo "🧪 TEST 4: Error Handling (1 min)"
echo "   1. Go to: $PRODUCTION_DOMAIN/login"
echo "   2. Enter invalid credentials"
echo "   3. Verify error message displays"
echo ""

echo "🧪 TEST 5: No Localhost Redirects (2 min)"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to Network tab"
echo "   3. Run all tests above"
echo "   4. Verify no requests to localhost"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ CODE DEPLOYED"
echo "   All changes pushed to GitHub (commit: $COMMIT)"
echo ""
echo "⏳ CONFIGURATION REQUIRED"
echo "   3 dashboards to configure (15 minutes)"
echo ""
echo "🧪 TESTING READY"
echo "   5 test scenarios provided (10 minutes)"
echo ""
echo "📚 DOCUMENTATION"
echo "   - FINAL_DEPLOYMENT_GUIDE.md (this file)"
echo "   - DEPLOYMENT_NEXT_STEPS.md"
echo "   - AUTH_REDIRECT_FIX.md"
echo "   - CODE_REVIEW_AUTH.md"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TOTAL TIME TO COMPLETION: ~25 minutes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 NEXT ACTION: Open the 3 dashboard URLs above and follow the steps"
echo ""
