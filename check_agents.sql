-- Check for agents saved around 1:00 PM (13:00) for MedSpa Aesthetics
SELECT 
  a.id,
  a.org_id,
  o.name as org_name,
  a.name,
  a.role,
  a.vapi_assistant_id,
  a.system_prompt,
  a.created_at,
  a.updated_at,
  EXTRACT(HOUR FROM a.created_at AT TIME ZONE 'America/Los_Angeles') as hour_created,
  EXTRACT(HOUR FROM a.updated_at AT TIME ZONE 'America/Los_Angeles') as hour_updated
FROM agents a
JOIN organizations o ON a.org_id = o.id
WHERE o.name ILIKE '%MedSpa%'
  OR o.name ILIKE '%medesthet%'
ORDER BY a.updated_at DESC
LIMIT 20;
