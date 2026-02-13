#!/bin/bash

# ============================================================================
# STRIPE CLI WEBHOOK SETUP SCRIPT
# ============================================================================
# This script sets up Stripe CLI and starts the webhook listener
# Run this FIRST to enable E2E billing tests
#
# Usage: bash setup-stripe-webhooks.sh
# ============================================================================

set -e

PROJECT_DIR="/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026"
BACKEND_DIR="$PROJECT_DIR/backend"
PORT=3001

echo "======================================================================"
echo "STRIPE CLI WEBHOOK SETUP"
echo "======================================================================"

# Step 1: Verify Stripe CLI is installed
echo ""
echo "✓ Step 1: Checking Stripe CLI installation..."
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Installing..."
    brew install stripe/stripe-cli/stripe
else
    STRIPE_VERSION=$(stripe --version)
    echo "✓ Stripe CLI found: $STRIPE_VERSION"
fi

# Step 2: Check if authenticated
echo ""
echo "✓ Step 2: Checking Stripe authentication..."
if [ ! -d "$HOME/.config/stripe" ]; then
    echo ""
    echo "⚠️  Stripe CLI not authenticated yet."
    echo ""
    echo "Follow these steps:"
    echo "  1. Run: stripe login"
    echo "  2. A browser window will open - authorize the CLI"
    echo "  3. Once authorized, run this script again"
    echo ""
    exit 1
fi

# Step 3: Verify backend .env has webhook secret
echo ""
echo "✓ Step 3: Checking backend .env configuration..."
if grep -q "STRIPE_WEBHOOK_SECRET=" "$BACKEND_DIR/.env"; then
    WEBHOOK_SECRET=$(grep "STRIPE_WEBHOOK_SECRET=" "$BACKEND_DIR/.env" | cut -d'=' -f2 | tr -d "'\"")
    echo "✓ Found STRIPE_WEBHOOK_SECRET: ${WEBHOOK_SECRET:0:20}..."
else
    echo "❌ STRIPE_WEBHOOK_SECRET not found in backend/.env"
    echo "   Add this line to backend/.env:"
    echo "   STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx"
    exit 1
fi

# Step 4: Check if backend is running
echo ""
echo "✓ Step 4: Checking if backend is running on port $PORT..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✓ Backend is running on port $PORT"
else
    echo "⚠️  Backend is NOT running on port $PORT"
    echo "   Start it with: cd $BACKEND_DIR && npm run dev"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 5: Start webhook listener
echo ""
echo "======================================================================"
echo "STARTING STRIPE WEBHOOK LISTENER"
echo "======================================================================"
echo ""
echo "About to run:"
echo "  stripe listen --forward-to localhost:$PORT/api/webhooks/stripe"
echo ""
echo "This will:"
echo "  • Listen for all Stripe test events"
echo "  • Forward them to your local backend"
echo "  • Allow E2E tests to trigger real webhook processing"
echo ""
echo "Keep this running in a separate terminal while testing!"
echo ""
read -p "Start webhook listener? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "Starting Stripe webhook listener..."
echo ""
stripe listen --forward-to localhost:$PORT/api/webhooks/stripe

# This will run indefinitely
# User must Ctrl+C to stop
