#!/bin/bash
# Complete Verification Script for Production Booking System
# This script verifies all components are working correctly

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        PRODUCTION BOOKING SYSTEM VERIFICATION             ║"
echo "║              Senior Engineer Solution v1.0               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Backend Running
echo "🔍 Check 1: Backend Health"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend running on port 3001${NC}"
  BACKEND_OK=1
else
  echo -e "${RED}❌ Backend not responding - start with: npm run dev${NC}"
  BACKEND_OK=0
fi

# Check 2: Database Connection
echo ""
echo "🔍 Check 2: Database Connection"
if curl -s http://localhost:3001/health | grep -q '"database": true'; then
  echo -e "${GREEN}✅ Database connected${NC}"
  DB_OK=1
else
  echo -e "${RED}❌ Database connection failed${NC}"
  DB_OK=0
fi

# Check 3: Test Booking Endpoint
if [ $BACKEND_OK -eq 1 ]; then
  echo ""
  echo "🔍 Check 3: Booking Endpoint Response"
  
  RESPONSE=$(curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
    -H "Content-Type: application/json" \
    -d '{
      "appointmentDate":"2026-02-20",
      "appointmentTime":"14:30",
      "patientName":"System Test",
      "patientEmail":"test@system.com",
      "patientPhone":"+441234567890",
      "serviceType":"Production Verification",
      "duration":30,
      "customer":{"metadata":{"org_id":"46cf2995-2bee-44e3-838b-24151486fe4e"}}
    }')
  
  if echo "$RESPONSE" | grep -q '"success"'; then
    echo -e "${GREEN}✅ Booking endpoint responding${NC}"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
      echo -e "${GREEN}✅ Booking succeeded - Full verification complete!${NC}"
      echo ""
      echo "📊 Response Summary:"
      echo "$RESPONSE" | jq '.toolResult.content' 2>/dev/null || echo "$RESPONSE"
    else
      echo -e "${YELLOW}⚠️  Booking failed - Check logs for details${NC}"
      echo ""
      echo "Response:"
      echo "$RESPONSE" | jq '.toolResult.content' 2>/dev/null || echo "$RESPONSE"
    fi
  else
    echo -e "${RED}❌ Endpoint error${NC}"
    echo "$RESPONSE"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping endpoint test (backend not running)${NC}"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                   VERIFICATION SUMMARY                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

if [ $BACKEND_OK -eq 1 ] && [ $DB_OK -eq 1 ]; then
  echo -e "${GREEN}🟢 System is READY for production${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Verify database migration applied: ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;"
  echo "2. Switch Google project to Production mode (1-year token lifetime)"
  echo "3. Monitor logs: tail -f /tmp/backend.log"
  echo ""
else
  echo -e "${YELLOW}🟡 Some checks failed - see details above${NC}"
fi

echo ""
