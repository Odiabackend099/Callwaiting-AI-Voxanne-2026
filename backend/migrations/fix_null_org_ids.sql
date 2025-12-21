-- Migration to fix null org_ids in call_logs and add NOT NULL constraint
-- Run this after deploying the webhook fix

-- Step 1: Update existing null org_id records to default org
UPDATE call_logs 
SET org_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE org_id IS NULL;

-- Step 2: Add NOT NULL constraint to prevent future nulls
ALTER TABLE call_logs 
ALTER COLUMN org_id SET NOT NULL;

-- Step 3: Add check constraint to ensure org_id references valid organization
ALTER TABLE call_logs 
ADD CONSTRAINT fk_call_logs_org_id 
FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- Step 4: Verify the migration
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN org_id IS NOT NULL THEN 1 END) as records_with_org_id,
  COUNT(CASE WHEN org_id = 'a0000000-0000-0000-0000-000000000001' THEN 1 END) as default_org_records
FROM call_logs;
