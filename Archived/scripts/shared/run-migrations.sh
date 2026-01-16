#!/bin/bash
# Run Supabase migrations programmatically

set -e

echo "🗄️  Running Supabase Migrations..."
echo "=================================="

# Supabase connection details
SUPABASE_URL="https://lbjymlodxprzqgtyqtcq.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA"

# Extract project ref from URL
PROJECT_REF="lbjymlodxprzqgtyqtcq"

echo "📝 Migration 1: Performance Indexes..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "query": "
    CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON processed_webhook_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call_id ON call_logs(vapi_call_id);
    CREATE INDEX IF NOT EXISTS idx_call_tracking_vapi_call_id ON call_tracking(vapi_call_id);
    CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id_active ON agents(vapi_assistant_id, active) WHERE active = true;
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_active ON knowledge_base(org_id, active) WHERE active = true;
  "
}
EOF

echo ""
echo "✅ Migrations complete!"
