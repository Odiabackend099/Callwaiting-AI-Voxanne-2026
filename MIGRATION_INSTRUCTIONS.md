# 🗄️ Database Migration Instructions

## Run These Migrations on Supabase

### Step 1: Access Supabase SQL Editor

1. Go to <https://supabase.com/dashboard>
2. Select project: **lbjymlodxprzqgtyqtcq**
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

---

### Step 2: Run Performance Indexes Migration

**Copy and paste this entire SQL:**

```sql
-- Migration: Webhook Performance Indexes
-- Date: 2025-12-16
-- Purpose: Add indexes to improve webhook processing performance

-- Idempotency table indexes
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id 
ON processed_webhook_events(event_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_call_event 
ON processed_webhook_events(call_id, event_type);

-- Call logs indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call_id 
ON call_logs(vapi_call_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_user_status_created 
ON call_logs(user_id, status, created_at DESC) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_logs_outcome 
ON call_logs(outcome) 
WHERE outcome IS NOT NULL;

-- Call tracking indexes
CREATE INDEX IF NOT EXISTS idx_call_tracking_vapi_call_id 
ON call_tracking(vapi_call_id);

CREATE INDEX IF NOT EXISTS idx_call_tracking_org_status 
ON call_tracking(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_tracking_agent_id 
ON call_tracking(agent_id, created_at DESC) 
WHERE agent_id IS NOT NULL;

-- Call transcripts indexes
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id 
ON call_transcripts(call_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_speaker 
ON call_transcripts(speaker, timestamp DESC);

-- Agents table indexes
CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id_active 
ON agents(vapi_assistant_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_agents_org_active 
ON agents(org_id, active) 
WHERE active = true;

-- Knowledge base indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_active 
ON knowledge_base(org_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb_id 
ON knowledge_base_chunks(knowledge_base_id);

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_phone 
ON leads(phone) 
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_status 
ON leads(org_id, status, last_contacted_at DESC);

-- Calls table indexes
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id 
ON calls(vapi_call_id);

CREATE INDEX IF NOT EXISTS idx_calls_org_type_status 
ON calls(org_id, call_type, status, created_at DESC);

-- Verify indexes created
SELECT COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';
```

**Click "Run"** and verify you see: `index_count: [number]`

---

### Step 3: Run Unique Constraints Migration

**Copy and paste this entire SQL:**

```sql
-- Migration: Webhook Unique Constraints
-- Date: 2025-12-16
-- Purpose: Prevent duplicate webhook processing

-- Clean up any existing duplicates first
WITH duplicates AS (
  SELECT 
    id,
    vapi_call_id,
    ROW_NUMBER() OVER (PARTITION BY vapi_call_id ORDER BY created_at ASC) as rn
  FROM call_tracking
  WHERE vapi_call_id IS NOT NULL
)
DELETE FROM call_tracking
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

WITH duplicates AS (
  SELECT 
    id,
    event_id,
    ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at ASC) as rn
  FROM processed_webhook_events
  WHERE event_id IS NOT NULL
)
DELETE FROM processed_webhook_events
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraints
ALTER TABLE call_tracking 
ADD CONSTRAINT call_tracking_vapi_call_id_unique 
UNIQUE (vapi_call_id);

ALTER TABLE processed_webhook_events 
ADD CONSTRAINT processed_webhook_events_event_id_unique 
UNIQUE (event_id);

ALTER TABLE call_logs 
ADD CONSTRAINT call_logs_vapi_call_id_unique 
UNIQUE (vapi_call_id);

ALTER TABLE calls 
ADD CONSTRAINT calls_vapi_call_id_unique 
UNIQUE (vapi_call_id);

-- Verify constraints created
SELECT COUNT(*) as constraint_count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
AND constraint_type = 'UNIQUE'
AND constraint_name LIKE '%vapi_call_id%';
```

**Click "Run"** and verify you see: `constraint_count: 4`

---

### Step 4: Verify Success

Run this verification query:

```sql
-- Check all indexes and constraints
SELECT 
  'Indexes' as type,
  COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'

UNION ALL

SELECT 
  'Unique Constraints' as type,
  COUNT(*) as count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
AND constraint_type = 'UNIQUE'
AND constraint_name LIKE '%vapi_call_id%';
```

**Expected output:**

```
type                | count
--------------------|-------
Indexes             | 20+
Unique Constraints  | 4
```

---

## ✅ Migration Complete

Once you see the expected output, migrations are successfully applied!

**Next:** I'll proceed with Render deployment.
