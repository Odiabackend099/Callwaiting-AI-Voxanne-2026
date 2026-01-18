#!/bin/bash
# Script to create system contact via direct SQL using environment variables

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's/https:\/\/([^.]+)\.supabase\.co.*/\1/')

echo "🔧 Creating system contact for Vapi bookings..."
echo "📍 Project: $PROJECT_REF"

# Make direct API call to insert record
curl -X POST \
  "https://${PROJECT_REF}.supabase.co/rest/v1/leads" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e",
    "name": "Vapi Booking System",
    "email": "system@vapi.booking",
    "status": "active",
    "source": "vapi",
    "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }' 2>&1 | python3 -m json.tool

echo ""
echo "✅ Complete"
