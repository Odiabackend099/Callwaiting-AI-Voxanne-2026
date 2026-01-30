-- Insert test call directly into call_logs table
INSERT INTO call_logs (
  org_id,
  vapi_call_id,
  from_number,
  to_number,
  start_time,
  end_time,
  started_at,
  ended_at,
  duration_seconds,
  status,
  call_type,
  sentiment,
  transcript,
  transcript_text,
  intent,
  booking_created,
  recording_url,
  recording_status,
  agent_name,
  outcome,
  metadata
) VALUES (
  '46cf2995-2bee-44e3-838b-24151486fe4e',
  'test-dashboard-call-' || extract(epoch from now())::text,
  '+15551234567',
  '+12345678901',
  now() - interval '2 minutes',
  now(),
  now() - interval '2 minutes',
  now(),
  120,
  'completed',
  'inbound',
  'positive',
  'AI: Hello! How can I help you today? | Patient: Hi, do you offer Botox treatments? | AI: Yes, we do! Our Botox treatments are very popular. How can I assist you with that? | Patient: I would like to know the prices.',
  'AI: Hello! How can I help you today? | Patient: Hi, do you offer Botox treatments? | AI: Yes, we do! Our Botox treatments are very popular. How can I assist you with that? | Patient: I would like to know the prices.',
  'inquiry',
  false,
  null,
  'pending',
  'test-agent',
  'inquiry',
  jsonb_build_object(
    'test_record', true,
    'created_by', 'debug-sql',
    'purpose', 'dashboard-verification-test'
  )
);

-- Verify the insert worked
SELECT 
  vapi_call_id,
  from_number,
  duration_seconds,
  status,
  sentiment,
  outcome,
  created_at
FROM call_logs 
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
ORDER BY created_at DESC 
LIMIT 5;
