#!/bin/bash

# VOXANNE LEAD GENERATION - ONE-COMMAND STARTUP
# Run this to deploy the entire lead gen system

set -e

echo "🚀 VOXANNE LEAD GENERATION SYSTEM STARTUP"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check environment variables
echo "📋 Checking environment variables..."

if [ -z "$RESEND_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  RESEND_API_KEY not set${NC}"
    echo "   Get one at: https://resend.com/api-keys"
    echo "   Then run: export RESEND_API_KEY='re_xxxxx'"
else
    echo -e "${GREEN}✅ RESEND_API_KEY configured${NC}"
fi

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ SUPABASE_URL not set${NC}"
    exit 1
else
    echo -e "${GREEN}✅ SUPABASE_URL configured${NC}"
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_KEY not set${NC}"
    exit 1
else
    echo -e "${GREEN}✅ SUPABASE_SERVICE_KEY configured${NC}"
fi

echo ""

# Check Node.js
echo "🔍 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Install from https://nodejs.org${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION}${NC}"

echo ""

# Check leads file
echo "📊 Checking leads data..."
LEADS_FILE="$(dirname "$0")/filtered-leads.json"
if [ ! -f "$LEADS_FILE" ]; then
    echo -e "${RED}❌ filtered-leads.json not found${NC}"
    echo "   Run: node filter-leads.cjs"
    exit 1
fi

LEAD_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$LEADS_FILE')).length)")
echo -e "${GREEN}✅ ${LEAD_COUNT} leads loaded${NC}"

echo ""

# Display current status
echo "📈 CURRENT LEAD GENERATION STATUS"
echo "=================================="
node "$(dirname "$0")/lead-gen-system.js" status

echo ""

# Ask user what to do
echo "🎯 WHAT WOULD YOU LIKE TO DO?"
echo "1. Send cold emails (15/day)"
echo "2. Check status"
echo "3. Generate report"
echo "4. Log a conversion"
echo "5. Exit"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "📧 Starting cold email campaign..."
        echo "Sending 15 emails (Week 1 warmup)..."
        echo ""
        node "$(dirname "$0")/lead-gen-system.js" send-emails 15
        echo ""
        echo -e "${GREEN}✅ Email batch sent!${NC}"
        echo "Next run: Tomorrow at 9am"
        ;;
    2)
        echo ""
        node "$(dirname "$0")/lead-gen-system.js" status
        ;;
    3)
        echo ""
        echo "📊 Generating report..."
        node "$(dirname "$0")/lead-gen-system.js" generate-report
        echo ""
        echo -e "${GREEN}✅ Report saved to lead-gen-report.json${NC}"
        ;;
    4)
        echo ""
        read -p "Enter email: " email
        read -p "Enter demo date (YYYY-MM-DD): " demoDate
        read -p "Enter notes (optional): " notes
        node "$(dirname "$0")/lead-gen-system.js" log-conversion "$email" "$demoDate" "$notes"
        ;;
    5)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "📚 NEXT STEPS:"
echo "1. Read the playbook: cat LEAD_GEN_PLAYBOOK.md"
echo "2. Schedule daily sends: crontab -e"
echo "3. Monitor replies: support@callwaitingai.dev"
echo "4. Track conversions: node lead-gen-system.js log-conversion"
echo ""
echo "🚀 Happy selling!"
