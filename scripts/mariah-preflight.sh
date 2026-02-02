#!/bin/bash

#############################################################################
# Mariah Protocol Pre-Flight Checks
#
# Automated system readiness verification for the Mariah Protocol
# certification. Validates all critical services and configurations
# before running end-to-end transaction tests.
#
# Usage:
#   ./scripts/mariah-preflight.sh
#
# Exit Codes:
#   0 - All checks passed
#   1 - One or more checks failed
#
# Requirements:
#   - curl
#   - jq (for JSON parsing)
#   - Environment variables set (SUPABASE_URL, VAPI_PRIVATE_KEY, etc.)
#############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
CHECKS_PASSED=0
CHECKS_FAILED=0
TOTAL_CHECKS=6

# Helper functions
print_check() {
    echo -e "\n${YELLOW}[CHECK $1/$TOTAL_CHECKS]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_failure() {
    echo -e "${RED}❌${NC} $1"
}

print_header() {
    echo -e "\n${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}   MARIAH PROTOCOL PRE-FLIGHT CHECKS${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}\n"
}

# Load environment variables
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
HEALTH_ENDPOINT="${BACKEND_URL}/api/health"
VAPI_HEALTH_ENDPOINT="https://api.vapi.ai/v1/assistant"
TEST_ORG_ID="${TEST_ORG_ID:-}"

#############################################################################
# CHECK 1: Database Connectivity
#############################################################################
check_database() {
    print_check 1 "Database Connectivity"

    # Test via health endpoint
    if response=$(curl -s -w "\n%{http_code}" "${HEALTH_ENDPOINT}" 2>/dev/null); then
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')

        if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
            # Check if database check passed in response
            if echo "$body" | grep -q '"database":true'; then
                print_success "Database connection verified via health endpoint"
                CHECKS_PASSED=$((CHECKS_PASSED + 1))
                return 0
            else
                print_failure "Database check failed in health response"
                echo "Response: $body"
                CHECKS_FAILED=$((CHECKS_FAILED + 1))
                return 1
            fi
        else
            print_failure "Health endpoint returned HTTP $http_code"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    else
        print_failure "Could not reach health endpoint at ${HEALTH_ENDPOINT}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

#############################################################################
# CHECK 2: Vapi API Connectivity
#############################################################################
check_vapi_api() {
    print_check 2 "Vapi API Connectivity"

    if [ -z "$VAPI_PRIVATE_KEY" ]; then
        print_failure "VAPI_PRIVATE_KEY environment variable not set"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi

    # Test Vapi API with a simple list request
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer ${VAPI_PRIVATE_KEY}" \
        "${VAPI_HEALTH_ENDPOINT}?limit=1" 2>/dev/null)

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        print_success "Vapi API connection verified"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    elif [ "$http_code" = "401" ]; then
        print_failure "Vapi API authentication failed (invalid key)"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    else
        print_failure "Vapi API returned HTTP $http_code"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

#############################################################################
# CHECK 3: Google Calendar Credentials
#############################################################################
check_google_calendar_credentials() {
    print_check 3 "Google Calendar Credentials"

    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_failure "Supabase credentials not configured"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi

    # Query credentials table for Google Calendar integration
    # Using Supabase REST API
    response=$(curl -s -w "\n%{http_code}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        "${SUPABASE_URL}/rest/v1/credentials?provider=eq.google_calendar&select=id,org_id&limit=1" 2>/dev/null)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        # Check if any credentials exist
        if echo "$body" | grep -q '\[{'; then
            print_success "Google Calendar credentials found"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
            return 0
        else
            print_failure "No Google Calendar credentials configured for test organization"
            echo "Hint: Configure Google Calendar integration in the test org"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    else
        print_failure "Failed to query credentials table (HTTP $http_code)"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

#############################################################################
# CHECK 4: Twilio Credentials
#############################################################################
check_twilio_credentials() {
    print_check 4 "Twilio Credentials"

    # Query credentials table for Twilio integration
    response=$(curl -s -w "\n%{http_code}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        "${SUPABASE_URL}/rest/v1/credentials?provider=eq.twilio&select=id,org_id&limit=1" 2>/dev/null)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        # Check if any credentials exist
        if echo "$body" | grep -q '\[{'; then
            print_success "Twilio credentials found"
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
            return 0
        else
            print_failure "No Twilio credentials configured"
            echo "Hint: Configure Twilio integration for SMS functionality"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    else
        print_failure "Failed to query credentials table (HTTP $http_code)"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

#############################################################################
# CHECK 5: Test Agent Exists and Active
#############################################################################
check_test_agent() {
    print_check 5 "Test Agent Configuration"

    # Query agents table for active test agent
    response=$(curl -s -w "\n%{http_code}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        "${SUPABASE_URL}/rest/v1/agents?select=id,name,is_active,vapi_assistant_id&is_active=eq.true&limit=1" 2>/dev/null)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        # Check if any active agents exist
        if echo "$body" | grep -q '\[{'; then
            # Verify vapi_assistant_id is not null
            if echo "$body" | grep -q '"vapi_assistant_id":"[^"]*"'; then
                print_success "Active agent found with Vapi assistant ID"
                CHECKS_PASSED=$((CHECKS_PASSED + 1))
                return 0
            else
                print_failure "Active agent found but missing Vapi assistant ID"
                echo "Hint: Save agent configuration to sync with Vapi"
                CHECKS_FAILED=$((CHECKS_FAILED + 1))
                return 1
            fi
        else
            print_failure "No active agents configured"
            echo "Hint: Create and activate an agent in the dashboard"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    else
        print_failure "Failed to query agents table (HTTP $http_code)"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

#############################################################################
# CHECK 6: Webhook Endpoint Reachable
#############################################################################
check_webhook_endpoint() {
    print_check 6 "Webhook Endpoint Reachability"

    # Test webhook endpoint (should return 400 for GET but be reachable)
    webhook_url="${BACKEND_URL}/api/webhooks/vapi"

    response=$(curl -s -w "\n%{http_code}" "${webhook_url}" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)

    # Webhook endpoints typically reject GET requests with 400 or 405
    # We just want to verify the endpoint is reachable
    if [ "$http_code" = "400" ] || [ "$http_code" = "405" ] || [ "$http_code" = "200" ]; then
        print_success "Webhook endpoint is reachable at ${webhook_url}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    elif [ "$http_code" = "404" ]; then
        print_failure "Webhook endpoint not found (HTTP 404)"
        echo "URL: ${webhook_url}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    else
        print_failure "Webhook endpoint returned unexpected HTTP $http_code"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

#############################################################################
# Main Execution
#############################################################################
main() {
    print_header

    # Run all checks (continue even if some fail to show all results)
    check_database || true
    check_vapi_api || true
    check_google_calendar_credentials || true
    check_twilio_credentials || true
    check_test_agent || true
    check_webhook_endpoint || true

    # Print summary
    echo -e "\n${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}   PRE-FLIGHT CHECK SUMMARY${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}\n"

    echo "Total Checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"

    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✅ All pre-flight checks passed!${NC}"
        echo -e "${GREEN}System is ready for Mariah Protocol certification.${NC}\n"
        exit 0
    else
        echo -e "\n${RED}❌ $CHECKS_FAILED check(s) failed!${NC}"
        echo -e "${RED}Fix the issues above before running certification tests.${NC}\n"
        exit 1
    fi
}

# Run main function
main
