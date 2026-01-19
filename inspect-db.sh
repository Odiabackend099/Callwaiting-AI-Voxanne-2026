#!/bin/bash
source backend/.env

echo "=== Checking Supabase Credentials ==="
echo "SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "SERVICE_ROLE_KEY present: $([ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && echo 'YES' || echo 'NO')"

echo -e "\n=== Using Supabase REST API ==="
API_URL="${SUPABASE_URL}/rest/v1"
HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

echo -e "\n--- ORGANIZATIONS ---"
curl -s "${API_URL}/organizations" \
  -H "${HEADER}" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | jq . 2>/dev/null || curl -s "${API_URL}/organizations" -H "${HEADER}" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo -e "\n--- API CREDENTIALS ---"
curl -s "${API_URL}/organization_api_credentials" \
  -H "${HEADER}" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | jq . 2>/dev/null || curl -s "${API_URL}/organization_api_credentials" -H "${HEADER}" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo -e "\n--- OAUTH TOKENS ---"
curl -s "${API_URL}/oauth_tokens" \
  -H "${HEADER}" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | jq . 2>/dev/null || curl -s "${API_URL}/oauth_tokens" -H "${HEADER}" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo -e "\n--- APPOINTMENTS ---"
curl -s "${API_URL}/appointments?select=*" \
  -H "${HEADER}" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | jq . 2>/dev/null || curl -s "${API_URL}/appointments?select=*" -H "${HEADER}" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
