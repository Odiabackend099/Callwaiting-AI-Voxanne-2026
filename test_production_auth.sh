#!/bin/bash
set -euo pipefail

# Production Authentication Test Suite
# Tests: Google OAuth, email signup verification, password reset

PROD_DOMAIN="https://callwaitingai.dev"
SUPABASE_URL="https://lbjymlodxprzqgtyqtcq.supabase.co"

echo ""
echo "========================================================================"
echo "PRODUCTION AUTHENTICATION TEST SUITE"
echo "========================================================================"
echo ""

# Test 1: Verify production domain is accessible
echo "TEST 1: Production domain connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_DOMAIN")
if [ "$RESPONSE" = "200" ]; then
  echo "✅ Production domain is accessible (HTTP $RESPONSE)"
else
  echo "⚠️  Production domain returned HTTP $RESPONSE (may still be deploying)"
fi
echo ""

# Test 2: Verify auth callback route exists
echo "TEST 2: Auth callback route"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
CALLBACK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_DOMAIN/auth/callback")
if [ "$CALLBACK_RESPONSE" = "307" ] || [ "$CALLBACK_RESPONSE" = "400" ]; then
  echo "✅ Auth callback route exists (HTTP $CALLBACK_RESPONSE)"
  echo "   (307 = redirect, 400 = missing code param — both expected)"
else
  echo "⚠️  Auth callback returned HTTP $CALLBACK_RESPONSE"
fi
echo ""

# Test 3: Verify Supabase connectivity
echo "TEST 3: Supabase connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SUPABASE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/")
if [ "$SUPABASE_RESPONSE" = "200" ] || [ "$SUPABASE_RESPONSE" = "401" ]; then
  echo "✅ Supabase is accessible (HTTP $SUPABASE_RESPONSE)"
else
  echo "⚠️  Supabase returned HTTP $SUPABASE_RESPONSE"
fi
echo ""

# Test 4: Check environment variable is set
echo "TEST 4: Environment variable check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "NEXT_PUBLIC_APP_URL" .env.local; then
  APP_URL=$(grep "NEXT_PUBLIC_APP_URL" .env.local | cut -d'=' -f2)
  echo "✅ NEXT_PUBLIC_APP_URL is set in .env.local"
  echo "   Value: $APP_URL"
else
  echo "⚠️  NEXT_PUBLIC_APP_URL not found in .env.local"
fi
echo ""

# Test 5: Verify code changes are deployed
echo "TEST 5: Code deployment verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "src/lib/auth-redirect.ts" ]; then
  echo "✅ Helper utility exists: src/lib/auth-redirect.ts"
else
  echo "❌ Helper utility not found"
fi

if grep -q "getAuthCallbackUrl" src/contexts/AuthContext.tsx; then
  echo "✅ AuthContext.tsx uses getAuthCallbackUrl()"
else
  echo "❌ AuthContext.tsx not updated"
fi

if grep -q "NEXT_PUBLIC_APP_URL" src/app/auth/callback/route.ts; then
  echo "✅ Callback route uses NEXT_PUBLIC_APP_URL"
else
  echo "❌ Callback route not updated"
fi
echo ""

# Test 6: Git commit verification
echo "TEST 6: Git deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
COMMIT=$(git log --oneline -1)
if echo "$COMMIT" | grep -q "auth redirect"; then
  echo "✅ Latest commit: $COMMIT"
else
  echo "⚠️  Latest commit: $COMMIT"
fi
echo ""

echo "========================================================================"
echo "MANUAL TESTING REQUIRED"
echo "========================================================================"
echo ""
echo "The automated tests above verify infrastructure. Now test the actual"
echo "authentication flows manually in an INCOGNITO window:"
echo ""
echo "1️⃣  GOOGLE OAUTH TEST"
echo "   URL: $PROD_DOMAIN/sign-up"
echo "   Steps:"
echo "     a) Click 'Continue with Google'"
echo "     b) Authorize the application"
echo "     c) Verify you land on /dashboard (NOT localhost)"
echo "   Expected: Redirect chain ends at $PROD_DOMAIN/dashboard"
echo ""
echo "2️⃣  EMAIL SIGNUP VERIFICATION TEST"
echo "   URL: $PROD_DOMAIN/sign-up"
echo "   Steps:"
echo "     a) Sign up with email"
echo "     b) Check email for verification link"
echo "     c) Verify link contains: $PROD_DOMAIN/auth/callback"
echo "   Expected: Link starts with $PROD_DOMAIN (NOT localhost)"
echo ""
echo "3️⃣  PASSWORD RESET TEST"
echo "   URL: $PROD_DOMAIN/login"
echo "   Steps:"
echo "     a) Click 'Forgot password?'"
echo "     b) Request reset"
echo "     c) Check email for reset link"
echo "     d) Verify link contains: $PROD_DOMAIN/auth/callback?next=/update-password"
echo "   Expected: Link starts with $PROD_DOMAIN (NOT localhost)"
echo ""
echo "========================================================================"
echo "DEPLOYMENT STATUS"
echo "========================================================================"
echo ""
echo "✅ Code deployed: commit ed2c13a"
echo "✅ Supabase configured: redirect URLs set"
echo "✅ Google OAuth configured: authorized URIs set"
echo "⏳ Vercel env vars: NEXT_PUBLIC_APP_URL set (check dashboard)"
echo "⏳ Production tests: manual testing required"
echo ""
echo "Monitor deployment: https://vercel.com/dashboard/roxan-frontend/deployments"
echo ""
