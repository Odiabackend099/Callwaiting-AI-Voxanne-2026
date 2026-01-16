#!/bin/bash

# Quick diagnostic script to verify Google Calendar OAuth fixes are working
# Run this after completing the OAuth flow to validate the connection

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get your org_id from the browser console (localStorage.getItem('sb-supabase-auth-token'))
# Or from the JWT claims
ORG_ID="${1:-46cf2995-2bee-44e3-838b-24151486fe4e}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Google Calendar OAuth Status Diagnostic${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📋 Configuration${NC}"
echo "   ORG_ID: $ORG_ID"
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""

# Check if backend is running
echo -e "${YELLOW}🔧 Checking Services${NC}"
if lsof -i :3001 >/dev/null 2>&1; then
    echo -e "   ${GREEN}✓${NC} Backend is running on port 3001"
else
    echo -e "   ${RED}✗${NC} Backend NOT running on port 3001"
    exit 1
fi

if lsof -i :3000 >/dev/null 2>&1; then
    echo -e "   ${GREEN}✓${NC} Frontend is running on port 3000"
else
    echo -e "   ${RED}✗${NC} Frontend NOT running on port 3000"
    exit 1
fi
echo ""

# Check source code changes
echo -e "${YELLOW}🔍 Verifying Code Changes${NC}"

echo -n "   Checking backend has encrypted_config in query... "
if grep -q "select.*encrypted_config" backend/src/routes/google-oauth.ts; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo -n "   Checking backend has email fallback decryption... "
if grep -q "EncryptionService.decryptObject.*encrypted_config" backend/src/routes/google-oauth.ts; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo -n "   Checking frontend has 500ms delay for status refresh... "
if grep -q "setTimeout.*500.*fetchCalendarStatus" src/app/dashboard/api-keys/page.tsx; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo ""

# Check database (requires auth token)
echo -e "${YELLOW}📊 Checking Database${NC}"
echo "   To verify credentials were stored:"
echo "   1. Open Supabase dashboard"
echo "   2. Go to SQL Editor"
echo "   3. Run:"
echo ""
echo "   ${BLUE}SELECT org_id, provider, is_active, metadata, created_at"
echo "   FROM org_credentials"
echo "   WHERE org_id = '$ORG_ID'"
echo "   AND provider = 'google_calendar'${NC}"
echo ""
echo "   You should see:"
echo "   ${GREEN}✓${NC} is_active = true"
echo "   ${GREEN}✓${NC} metadata.email = your-email@gmail.com"
echo "   ${GREEN}✓${NC} encrypted_config is not null"
echo ""

# Manual test instruction
echo -e "${YELLOW}🧪 Manual Testing${NC}"
echo "   1. Open: http://localhost:3000/dashboard/api-keys"
echo "   2. Scroll to 'Calendar Integration' section"
echo "   3. Click 'Link My Google Calendar'"
echo "   4. Complete Google OAuth consent"
echo "   5. Wait 500ms after redirect"
echo ""
echo "   Expected result:"
echo "   ${GREEN}✓${NC} You see: 'Calendar connected successfully! (your-email@gmail.com)'"
echo "   ${GREEN}✓${NC} Status shows: 'Linked as: your-email@gmail.com'"
echo ""

# Browser console commands
echo -e "${YELLOW}🌐 Browser Console Debug${NC}"
echo "   Run these in your browser DevTools Console on /dashboard/api-keys:"
echo ""
echo "   ${BLUE}// Check JWT token org_id"
echo "   JSON.parse(atob(localStorage.getItem('sb-supabase-auth-token').split('.')[1]))"
echo ""
echo "   // Test status endpoint directly"
echo "   fetch('/api/google-oauth/status/46cf2995-2bee-44e3-838b-24151486fe4e')"
echo "     .then(r => r.json())"
echo "     .then(d => console.log(d))${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ All systems ready! Start testing the OAuth flow.${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
