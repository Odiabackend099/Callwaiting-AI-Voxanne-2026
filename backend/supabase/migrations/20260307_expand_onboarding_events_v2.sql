-- Widen valid_event_name CHECK constraint to include v2 wizard events.
-- Matches VALID_EVENTS array in backend/src/routes/onboarding.ts.
--
-- Context: The original constraint only allowed 6 v1 event names. The v2 onboarding
-- wizard fires 14 additional event names. Because the /event endpoint is fire-and-forget
-- (DB errors are swallowed and a 200 is always returned), all v2 telemetry was silently
-- lost — rows were rejected by the constraint with no visible error.
--
-- Non-destructive: no existing rows are deleted; the constraint is widened, not narrowed.

ALTER TABLE onboarding_events DROP CONSTRAINT IF EXISTS valid_event_name;

ALTER TABLE onboarding_events ADD CONSTRAINT valid_event_name CHECK (
  event_name IN (
    -- v1 legacy (preserved for existing data)
    'started',
    'clinic_named',
    'specialty_chosen',
    'payment_viewed',
    'payment_success',
    'test_call_completed',
    -- v2 new wizard
    'direction_chosen',
    'number_searched',
    'number_selected',
    'number_provisioned',
    'telecom_routing_viewed',
    'forwarding_code_copied',
    'caller_id_verified',
    'telecom_routing_skipped',
    'agent_persona_selected',
    'agent_voice_selected',
    'agent_configured',
    'agent_syncing',
    'agent_sync_complete',
    'onboarding_complete',
    'test_call_initiated'
  )
);
