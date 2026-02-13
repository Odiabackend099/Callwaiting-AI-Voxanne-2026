#!/bin/bash

###############################################################################
# Stripe Billing E2E Test - Quick Run Script
#
# This script helps you run the E2E test with proper prerequisites check
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Stripe Billing E2E Test - Prerequisites Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Backend Health
echo "📡 Checking backend server..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is NOT running${NC}"
    echo "   Start it: cd backend && npm run startup"
    exit 1
fi

# Check 2: Frontend Health
echo "🌐 Checking frontend server..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${RED}❌ Frontend is NOT running${NC}"
    echo "   It should be started by 'npm run startup'"
    exit 1
fi

# Check 3: Stripe CLI
echo "💳 Checking Stripe CLI..."
if command -v stripe > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Stripe CLI is installed${NC}"
else
    echo -e "${RED}❌ Stripe CLI is NOT installed${NC}"
    echo "   Install: brew install stripe/stripe-cli/stripe"
    exit 1
fi

# Check 4: Stripe Webhook Listener (can't easily check, so warn)
echo "🎣 Checking Stripe webhook listener..."
echo -e "${YELLOW}⚠️  Make sure you have 'stripe listen' running in another terminal${NC}"
echo "   Command: stripe listen --forward-to http://localhost:3001/api/webhooks/stripe"
echo ""

# Prompt user to confirm
read -p "Is the Stripe webhook listener running? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Test aborted. Start webhook listener first.${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Running E2E Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run the test
npx playwright test e2e/billing.spec.ts --headed --project=chromium

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
