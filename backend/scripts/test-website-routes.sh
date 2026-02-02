#!/bin/bash

# ========================================================================
# TEST SCRIPT: Website Routes (Calendly, Contact Form, Chat Widget)
# ========================================================================
# Purpose: Test all three new routes to verify functionality
# Usage: ./scripts/test-website-routes.sh
# ========================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo -e "${YELLOW}========================================================================${NC}"
echo -e "${YELLOW}Testing Website Routes${NC}"
echo -e "${YELLOW}========================================================================${NC}"
echo -e "Backend URL: ${BACKEND_URL}\n"

# ========================================================================
# Test 1: Chat Widget Health Check
# ========================================================================
echo -e "${YELLOW}Test 1: Chat Widget Health Check${NC}"
echo "GET ${BACKEND_URL}/api/chat-widget/health"
HEALTH_RESPONSE=$(curl -s -X GET "${BACKEND_URL}/api/chat-widget/health")
echo "Response: ${HEALTH_RESPONSE}"

if echo "${HEALTH_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Chat Widget Health Check PASSED${NC}\n"
else
  echo -e "${RED}❌ Chat Widget Health Check FAILED${NC}\n"
fi

# ========================================================================
# Test 2: Chat Widget - Simple Question
# ========================================================================
echo -e "${YELLOW}Test 2: Chat Widget - Simple Question${NC}"
echo "POST ${BACKEND_URL}/api/chat-widget"
CHAT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat-widget" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What are your pricing plans?"
      }
    ],
    "sessionId": "test_session_001"
  }')

echo "Response: ${CHAT_RESPONSE}" | head -c 200
echo "..."

if echo "${CHAT_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Chat Widget PASSED${NC}\n"
else
  echo -e "${RED}❌ Chat Widget FAILED${NC}\n"
fi

# ========================================================================
# Test 3: Chat Widget - Hot Lead (should trigger Slack alert)
# ========================================================================
echo -e "${YELLOW}Test 3: Chat Widget - Hot Lead Detection${NC}"
echo "POST ${BACKEND_URL}/api/chat-widget"
HOT_LEAD_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat-widget" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "I run a dental clinic with 70 calls per day. We are missing too many calls and losing business. Can you help?"
      }
    ],
    "sessionId": "test_session_002_hot_lead"
  }')

echo "Response: ${HOT_LEAD_RESPONSE}" | head -c 200
echo "..."

if echo "${HOT_LEAD_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Chat Widget Hot Lead PASSED${NC}"
  echo -e "${YELLOW}⚠️  Check Slack for hot lead alert${NC}\n"
else
  echo -e "${RED}❌ Chat Widget Hot Lead FAILED${NC}\n"
fi

# ========================================================================
# Test 4: Contact Form - Normal Submission
# ========================================================================
echo -e "${YELLOW}Test 4: Contact Form - Normal Submission${NC}"
echo "POST ${BACKEND_URL}/api/contact-form"
CONTACT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/contact-form" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+447123456789",
    "subject": "Interested in Professional Plan",
    "message": "I would like to learn more about your AI phone system for my business.",
    "company": "Test Company Ltd"
  }')

echo "Response: ${CONTACT_RESPONSE}"

if echo "${CONTACT_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Contact Form PASSED${NC}"
  echo -e "${YELLOW}⚠️  Check support@voxanne.ai for email${NC}\n"
else
  echo -e "${RED}❌ Contact Form FAILED${NC}\n"
fi

# ========================================================================
# Test 5: Contact Form - Urgent Submission
# ========================================================================
echo -e "${YELLOW}Test 5: Contact Form - Urgent Submission${NC}"
echo "POST ${BACKEND_URL}/api/contact-form"
URGENT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/contact-form" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Urgent User",
    "email": "urgent@example.com",
    "phone": "+447987654321",
    "subject": "URGENT: Production outage",
    "message": "Our phone system is completely down and we need immediate assistance!",
    "company": "Emergency Services Ltd"
  }')

echo "Response: ${URGENT_RESPONSE}"

if echo "${URGENT_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Contact Form Urgent PASSED${NC}"
  echo -e "${YELLOW}⚠️  Check Slack for urgent alert${NC}\n"
else
  echo -e "${RED}❌ Contact Form Urgent FAILED${NC}\n"
fi

# ========================================================================
# Test 6: Contact Form - Validation Error
# ========================================================================
echo -e "${YELLOW}Test 6: Contact Form - Validation Error (should fail)${NC}"
echo "POST ${BACKEND_URL}/api/contact-form"
VALIDATION_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/contact-form" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "email": "invalid-email",
    "subject": "",
    "message": "short"
  }')

echo "Response: ${VALIDATION_RESPONSE}"

if echo "${VALIDATION_RESPONSE}" | grep -q '"success":false'; then
  echo -e "${GREEN}✅ Validation Error Handling PASSED${NC}\n"
else
  echo -e "${RED}❌ Validation Error Handling FAILED${NC}\n"
fi

# ========================================================================
# Test 7: Calendly Webhook - Invitee Created
# ========================================================================
echo -e "${YELLOW}Test 7: Calendly Webhook - Invitee Created${NC}"
echo "POST ${BACKEND_URL}/api/webhooks/calendly"
CALENDLY_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/webhooks/calendly" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invitee.created",
    "payload": {
      "event_type": {
        "name": "30 Minute Demo"
      },
      "invitee": {
        "name": "Test Invitee",
        "email": "invitee@example.com",
        "text_reminder_number": "+447123456789",
        "uri": "https://calendly.com/invitees/test123"
      },
      "event": {
        "start_time": "2026-02-15T14:00:00Z",
        "end_time": "2026-02-15T14:30:00Z"
      },
      "cancel_url": "https://calendly.com/cancel/test123",
      "reschedule_url": "https://calendly.com/reschedule/test123"
    }
  }')

echo "Response: ${CALENDLY_RESPONSE}"

if echo "${CALENDLY_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Calendly Webhook PASSED${NC}"
  echo -e "${YELLOW}⚠️  Check invitee@example.com and support@voxanne.ai for emails${NC}\n"
else
  echo -e "${RED}❌ Calendly Webhook FAILED${NC}\n"
fi

# ========================================================================
# Test 8: Calendly Webhook - Invitee Canceled
# ========================================================================
echo -e "${YELLOW}Test 8: Calendly Webhook - Invitee Canceled${NC}"
echo "POST ${BACKEND_URL}/api/webhooks/calendly"
CANCEL_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/webhooks/calendly" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invitee.canceled",
    "payload": {
      "event_type": {
        "name": "30 Minute Demo"
      },
      "invitee": {
        "name": "Canceled User",
        "email": "canceled@example.com",
        "uri": "https://calendly.com/invitees/cancel123"
      },
      "event": {
        "start_time": "2026-02-15T14:00:00Z",
        "end_time": "2026-02-15T14:30:00Z"
      }
    }
  }')

echo "Response: ${CANCEL_RESPONSE}"

if echo "${CANCEL_RESPONSE}" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Calendly Cancellation PASSED${NC}"
  echo -e "${YELLOW}⚠️  Check Slack for cancellation alert${NC}\n"
else
  echo -e "${RED}❌ Calendly Cancellation FAILED${NC}\n"
fi

# ========================================================================
# Summary
# ========================================================================
echo -e "${YELLOW}========================================================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================================================${NC}"
echo -e "✅ All tests completed"
echo -e "\n${YELLOW}Manual Verification Required:${NC}"
echo "1. Check Slack channel for hot lead alerts"
echo "2. Check support@voxanne.ai for contact form and Calendly emails"
echo "3. Check test email inboxes for confirmation emails"
echo -e "\n${YELLOW}Database Verification (if tables exist):${NC}"
echo "SELECT * FROM chat_widget_leads ORDER BY created_at DESC LIMIT 5;"
echo "SELECT * FROM contact_submissions ORDER BY created_at DESC LIMIT 5;"
echo "SELECT * FROM calendly_bookings ORDER BY created_at DESC LIMIT 5;"
echo -e "${YELLOW}========================================================================${NC}"
