#!/bin/bash

# Dashboard Data Verification Script
# Comprehensive check using Supabase REST API

SUPABASE_URL="https://lbjymlodxprzqgtyqtcq.supabase.co"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA"

echo "========================================"
echo "DASHBOARD DATA VERIFICATION"
echo "========================================"
echo ""
echo "Starting comprehensive verification..."
echo ""

# Counter variables
PASSED=0
FAILED=0
WARNINGS=0

# Check 1: Total Call Volume
echo "Check 1: Total Call Volume"
TOTAL_CALLS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/calls?select=count" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0')

if [ "$TOTAL_CALLS" -gt 0 ]; then
  echo "✅ PASS: Total calls in database: $TOTAL_CALLS"
  PASSED=$((PASSED + 1))
else
  echo "⚠️  WARN: No calls found in database"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 2: Recent Call Activity
echo "Check 2: Recent Call Activity"
LATEST_CALL=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/calls?select=created_at&order=created_at.desc&limit=1" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" | jq -r '.[0].created_at // ""')

if [ -n "$LATEST_CALL" ]; then
  echo "✅ PASS: Last call at: $LATEST_CALL"
  PASSED=$((PASSED + 1))
else
  echo "⚠️  WARN: No calls found in database"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 3: Caller Names (Last 7 days)
echo "Check 3: Caller Names (Last 7 days)"
SEVEN_DAYS_AGO=$(date -u -v-7d +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d '7 days ago' +"%Y-%m-%dT%H:%M:%S.000Z")

RECENT_CALLS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/calls?select=caller_name&created_at=gte.${SEVEN_DAYS_AGO}" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}")

TOTAL_RECENT=$(echo "$RECENT_CALLS" | jq 'length')
WITH_NAMES=$(echo "$RECENT_CALLS" | jq '[.[] | select(.caller_name != null and .caller_name != "Unknown Caller")] | length')
UNKNOWN=$(echo "$RECENT_CALLS" | jq '[.[] | select(.caller_name == null or .caller_name == "Unknown Caller")] | length')

if [ "$TOTAL_RECENT" -eq 0 ]; then
  echo "⚠️  WARN: No calls in the last 7 days"
  echo "   Details: total_calls=$TOTAL_RECENT, calls_with_names=$WITH_NAMES, unknown_callers=$UNKNOWN"
  WARNINGS=$((WARNINGS + 1))
elif [ "$WITH_NAMES" -eq 0 ]; then
  echo "❌ FAIL: ALL calls are 'Unknown Caller' - enrichment broken"
  echo "   Details: total_calls=$TOTAL_RECENT, calls_with_names=$WITH_NAMES, unknown_callers=$UNKNOWN"
  FAILED=$((FAILED + 1))
else
  PERCENT=$((WITH_NAMES * 100 / TOTAL_RECENT))
  if [ "$PERCENT" -lt 50 ]; then
    echo "⚠️  WARN: Low enrichment rate: ${PERCENT}%"
    echo "   Details: total_calls=$TOTAL_RECENT, calls_with_names=$WITH_NAMES, unknown_callers=$UNKNOWN"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "✅ PASS: ${WITH_NAMES}/${TOTAL_RECENT} calls have enriched names (${PERCENT}%)"
    echo "   Details: total_calls=$TOTAL_RECENT, calls_with_names=$WITH_NAMES, unknown_callers=$UNKNOWN"
    PASSED=$((PASSED + 1))
  fi
fi
echo ""

# Check 4: Contact Names (Last 7 days)
echo "Check 4: Contact Names (Last 7 days)"
RECENT_CONTACTS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/contacts?select=name&created_at=gte.${SEVEN_DAYS_AGO}" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}")

TOTAL_CONTACTS=$(echo "$RECENT_CONTACTS" | jq 'length')
CONTACTS_WITH_NAMES=$(echo "$RECENT_CONTACTS" | jq '[.[] | select(.name != null and .name != "Unknown Caller")] | length')

if [ "$TOTAL_CONTACTS" -eq 0 ]; then
  echo "⚠️  WARN: No contacts in the last 7 days"
  echo "   Details: total_contacts=$TOTAL_CONTACTS, contacts_with_names=$CONTACTS_WITH_NAMES"
  WARNINGS=$((WARNINGS + 1))
elif [ "$CONTACTS_WITH_NAMES" -eq 0 ]; then
  echo "❌ FAIL: ALL contacts have no names"
  echo "   Details: total_contacts=$TOTAL_CONTACTS, contacts_with_names=$CONTACTS_WITH_NAMES"
  FAILED=$((FAILED + 1))
else
  echo "✅ PASS: ${CONTACTS_WITH_NAMES}/${TOTAL_CONTACTS} contacts have names"
  echo "   Details: total_contacts=$TOTAL_CONTACTS, contacts_with_names=$CONTACTS_WITH_NAMES"
  PASSED=$((PASSED + 1))
fi
echo ""

# Check 5: Sentiment Data (Last 7 days)
echo "Check 5: Sentiment Data (Last 7 days)"
SENTIMENT_DATA=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/calls?select=sentiment_label,sentiment_score&created_at=gte.${SEVEN_DAYS_AGO}" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}")

TOTAL_SENTIMENT=$(echo "$SENTIMENT_DATA" | jq 'length')
WITH_LABEL=$(echo "$SENTIMENT_DATA" | jq '[.[] | select(.sentiment_label != null)] | length')
WITH_SCORE=$(echo "$SENTIMENT_DATA" | jq '[.[] | select(.sentiment_score != null)] | length')
AVG_SCORE=$(echo "$SENTIMENT_DATA" | jq '[.[] | select(.sentiment_score != null) | .sentiment_score] | add / length')

if [ "$TOTAL_SENTIMENT" -eq 0 ]; then
  echo "⚠️  WARN: No calls in the last 7 days"
  echo "   Details: total_calls=$TOTAL_SENTIMENT, with_label=$WITH_LABEL, with_score=$WITH_SCORE, avg_score=$AVG_SCORE"
  WARNINGS=$((WARNINGS + 1))
elif [ "$AVG_SCORE" == "0" ] || [ "$AVG_SCORE" == "null" ]; then
  echo "❌ FAIL: Average sentiment is 0% - sentiment analysis BROKEN"
  echo "   Details: total_calls=$TOTAL_SENTIMENT, with_label=$WITH_LABEL, with_score=$WITH_SCORE, avg_score=$AVG_SCORE"
  FAILED=$((FAILED + 1))
elif [ "$WITH_SCORE" -eq 0 ]; then
  echo "❌ FAIL: No calls have sentiment scores"
  echo "   Details: total_calls=$TOTAL_SENTIMENT, with_label=$WITH_LABEL, with_score=$WITH_SCORE"
  FAILED=$((FAILED + 1))
else
  AVG_PERCENT=$(echo "$AVG_SCORE * 100" | bc -l | cut -d. -f1)
  echo "✅ PASS: Avg sentiment: ${AVG_PERCENT}%, ${WITH_SCORE}/${TOTAL_SENTIMENT} calls scored"
  echo "   Details: total_calls=$TOTAL_SENTIMENT, with_label=$WITH_LABEL, with_score=$WITH_SCORE, avg_score=$AVG_SCORE"
  PASSED=$((PASSED + 1))
fi
echo ""

# Check 6: Hot Lead Alerts (Last 7 days)
echo "Check 6: Hot Lead Alerts (Last 7 days)"
ALERTS_DATA=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/hot_lead_alerts?select=lead_score&created_at=gte.${SEVEN_DAYS_AGO}" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}")

TOTAL_ALERTS=$(echo "$ALERTS_DATA" | jq 'length')
ABOVE_THRESHOLD=$(echo "$ALERTS_DATA" | jq '[.[] | select(.lead_score >= 60)] | length')

if [ "$TOTAL_ALERTS" -eq 0 ]; then
  echo "⚠️  WARN: No hot lead alerts in the last 7 days"
  echo "   Details: total_alerts=$TOTAL_ALERTS, alerts_above_threshold=$ABOVE_THRESHOLD"
  WARNINGS=$((WARNINGS + 1))
else
  echo "✅ PASS: ${TOTAL_ALERTS} alerts found (${ABOVE_THRESHOLD} above threshold)"
  echo "   Details: total_alerts=$TOTAL_ALERTS, alerts_above_threshold=$ABOVE_THRESHOLD"
  PASSED=$((PASSED + 1))
fi
echo ""

# Check 7: Phone Numbers (Last 7 days)
echo "Check 7: Phone Numbers (Last 7 days)"
PHONE_DATA=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/calls?select=phone_number&created_at=gte.${SEVEN_DAYS_AGO}" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}")

TOTAL_PHONES=$(echo "$PHONE_DATA" | jq 'length')
E164_FORMAT=$(echo "$PHONE_DATA" | jq '[.[] | select(.phone_number != null and (.phone_number | startswith("+")))] | length')

if [ "$TOTAL_PHONES" -eq 0 ]; then
  echo "⚠️  WARN: No calls in the last 7 days"
  echo "   Details: total=$TOTAL_PHONES, e164_format=$E164_FORMAT"
  WARNINGS=$((WARNINGS + 1))
elif [ "$E164_FORMAT" -ne "$TOTAL_PHONES" ]; then
  NOT_E164=$((TOTAL_PHONES - E164_FORMAT))
  echo "❌ FAIL: ${NOT_E164}/${TOTAL_PHONES} phone numbers NOT in E.164 format"
  echo "   Details: total=$TOTAL_PHONES, e164_format=$E164_FORMAT"
  FAILED=$((FAILED + 1))
else
  echo "✅ PASS: All ${TOTAL_PHONES} phone numbers in E.164 format"
  echo "   Details: total=$TOTAL_PHONES, e164_format=$E164_FORMAT"
  PASSED=$((PASSED + 1))
fi
echo ""

# Check 8: Sample Data
echo "Check 8: Sample Data (5 most recent calls)"
SAMPLE_DATA=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/calls?select=id,caller_name,phone_number,sentiment_label,sentiment_score,call_direction,status,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}")

SAMPLE_COUNT=$(echo "$SAMPLE_DATA" | jq 'length')

if [ "$SAMPLE_COUNT" -eq 0 ]; then
  echo "⚠️  WARN: No calls found in database"
  WARNINGS=$((WARNINGS + 1))
else
  echo "✅ PASS: Retrieved ${SAMPLE_COUNT} recent calls"
  PASSED=$((PASSED + 1))
  echo ""
  echo "Sample data:"
  echo "$SAMPLE_DATA" | jq -r '.[] | "  ID: \(.id)\n  Caller: \(.caller_name // "N/A")\n  Phone: \(.phone_number // "N/A")\n  Sentiment: \(.sentiment_label // "N/A") (\(.sentiment_score // 0))\n  Direction: \(.call_direction // "N/A")\n  Status: \(.status // "N/A")\n  Created: \(.created_at // "N/A")\n"'
fi
echo ""

# Check 9: Organizations Count
echo "Check 9: Organizations Count"
ORG_COUNT=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/organizations?select=count" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0')

if [ "$ORG_COUNT" -gt 0 ]; then
  echo "✅ PASS: Total organizations: $ORG_COUNT"
  PASSED=$((PASSED + 1))
else
  echo "⚠️  WARN: No organizations found in database"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
TOTAL_CHECKS=9

echo "========================================"
echo "VERIFICATION SUMMARY"
echo "========================================"
echo ""
echo "✅ Passed: $PASSED/$TOTAL_CHECKS checks"
echo "❌ Failed: $FAILED/$TOTAL_CHECKS checks"
echo "⚠️  Warnings: $WARNINGS/$TOTAL_CHECKS checks"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "CRITICAL ISSUES DETECTED!"
  echo "Review the failed checks above for details."
  echo ""
fi

echo "========================================"
echo "VERIFICATION COMPLETE"
echo "========================================"
echo ""

# Exit with appropriate code
if [ "$FAILED" -gt 0 ]; then
  exit 1
else
  exit 0
fi
