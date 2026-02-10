# Voxanne AI - Complete Database Schema Documentation
**Generated:** Directly from live Supabase PostgreSQL database**Tables:** 84**Columns:** 1129**Foreign Keys:** 75**Indexes:** 392**Constraints:** 530
---

## Table: `agents`
**Columns:**
- `id` (uuid, NOT NULL, default: uuid_generate_v4())
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `name` (text, NOT NULL)
- `description` (text, nullable)
- `active` (boolean, nullable, default: true)
- `system_prompt` (text, NOT NULL)
- `model` (text, nullable, default: 'llama-3.3-70b-versatile'::text)
- `temperature` (numeric, nullable, default: 0.7)
- `max_tokens` (integer, nullable, default: 500)
- `voice` (text, nullable, default: 'aura-asteria-en'::text)
- `language` (text, nullable, default: 'en-US'::text)
- `initial_message` (text, nullable)
- `goodbye_phrases` (ARRAY, nullable, default: ARRAY['bye'::text, 'goodbye'::text, 'good bye'::text])
- `allowed_idle_time_seconds` (integer, nullable, default: 30)
- `interrupt_sensitivity` (text, nullable, default: 'high'::text)
- `knowledge_base_urls` (ARRAY, nullable, default: ARRAY[]::text[])
- `faq` (jsonb, nullable, default: '[]'::jsonb)
- `integrations` (jsonb, nullable, default: '{}'::jsonb)
- `total_calls` (integer, nullable, default: 0)
- `total_minutes` (numeric, nullable, default: 0)
- `average_rating` (numeric, nullable)
- `first_message` (text, nullable)
- `voice_model` (character varying, nullable, default: 'aura-asteria-en'::character varying)
- `functions` (jsonb, nullable, default: '[]'::jsonb)
- `knowledge_base_ids` (ARRAY, nullable, default: ARRAY[]::uuid[])
- `settings` (jsonb, nullable, default: '{}'::jsonb)
- `role` (text, nullable, default: 'inbound'::text)
- `org_id` (uuid, nullable)
- `vapi_assistant_id` (text, nullable)
- `max_call_duration` (integer, nullable, default: 600)
- `organization_id` (uuid, nullable)
- `is_active` (boolean, nullable, default: true)
- `prompt_synced_at` (timestamp with time zone, nullable)
- `prompt_syncing_at` (timestamp without time zone, nullable)
- `voice_provider` (text, nullable)
- `vapi_assistant_id_outbound` (text, nullable)
- `vapi_phone_number_id` (text, nullable)
- `voice_id` (text, nullable, default: 'Neha'::text)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `role`

**Check Constraints:**
- 2200_32824_1_not_null: id IS NOT NULL
- 2200_32824_4_not_null: name IS NOT NULL
- 2200_32824_7_not_null: system_prompt IS NOT NULL
- agents_interrupt_sensitivity_check: (interrupt_sensitivity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))

**Indexes (12):**
- `agents_org_id_role_unique`
- `agents_pkey`
- `idx_agents_active`
- `idx_agents_created_at`
- `idx_agents_org_active`
- `idx_agents_org_id`
- `idx_agents_org_role`
- `idx_agents_prompt_synced_at`
- `idx_agents_prompt_syncing_at`
- `idx_agents_vapi_assistant_id`
- `idx_agents_vapi_assistant_id_outbound`
- `idx_agents_voice_provider`

---
## Table: `appointment_holds`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `calendar_id` (text, NOT NULL)
- `slot_time` (timestamp with time zone, NOT NULL)
- `call_sid` (text, NOT NULL)
- `patient_name` (text, nullable)
- `patient_phone` (text, nullable)
- `otp_code` (text, nullable)
- `otp_sent_at` (timestamp with time zone, nullable)
- `verification_attempts` (integer, nullable, default: 0)
- `status` (text, NOT NULL, default: 'held'::text)
- `expires_at` (timestamp with time zone, NOT NULL)
- `appointment_id` (uuid, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `deleted_at` (timestamp with time zone, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_95282_11_not_null: status IS NOT NULL
- 2200_95282_12_not_null: expires_at IS NOT NULL
- 2200_95282_1_not_null: id IS NOT NULL
- 2200_95282_2_not_null: org_id IS NOT NULL
- 2200_95282_3_not_null: calendar_id IS NOT NULL
- 2200_95282_4_not_null: slot_time IS NOT NULL
- 2200_95282_5_not_null: call_sid IS NOT NULL

**Foreign Key Relationships:**
- `appointment_id` → `appointments.id` (ON DELETE: SET NULL)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `appointment_holds_pkey`
- `idx_appointment_holds_call_sid`
- `idx_appointment_holds_expires`
- `idx_appointment_holds_org_slot`

---
## Table: `appointment_reservations`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `scheduled_at` (timestamp with time zone, NOT NULL)
- `patient_phone` (text, NOT NULL)
- `patient_name` (text, nullable)
- `status` (text, NOT NULL)
- `appointment_id` (uuid, nullable)
- `expires_at` (timestamp with time zone, NOT NULL)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_107268_1_not_null: id IS NOT NULL
- 2200_107268_2_not_null: org_id IS NOT NULL
- 2200_107268_3_not_null: scheduled_at IS NOT NULL
- 2200_107268_4_not_null: patient_phone IS NOT NULL
- 2200_107268_6_not_null: status IS NOT NULL
- 2200_107268_8_not_null: expires_at IS NOT NULL
- appointment_reservations_status_check: (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'FAILED'::text, 'REQUIRES_MANUAL_REVIEW'::text]))

**Foreign Key Relationships:**
- `appointment_id` → `appointments.id` (ON DELETE: NO ACTION)
- `org_id` → `organizations.id` (ON DELETE: NO ACTION)

**Indexes (3):**
- `appointment_reservations_pkey`
- `idx_appointment_reservations_org_phone`
- `idx_appointment_reservations_status`

---
## Table: `appointments`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `contact_id` (uuid, nullable)
- `service_type` (text, NOT NULL)
- `scheduled_at` (timestamp with time zone, NOT NULL)
- `duration_minutes` (integer, nullable, default: 30)
- `status` (USER-DEFINED, nullable, default: 'pending'::appointment_status)
- `calendar_link` (text, nullable)
- `confirmation_sent` (boolean, nullable, default: false)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `deleted_at` (timestamp with time zone, nullable)
- `google_calendar_event_id` (text, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_95247_1_not_null: id IS NOT NULL
- 2200_95247_2_not_null: org_id IS NOT NULL
- 2200_95247_4_not_null: service_type IS NOT NULL
- 2200_95247_5_not_null: scheduled_at IS NOT NULL

**Foreign Key Relationships:**
- `contact_id` → `contacts.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (10):**
- `appointments_pkey`
- `idx_appointments_contact`
- `idx_appointments_org_contact_scheduled`
- `idx_appointments_org_scheduled_at`
- `idx_appointments_org_status`
- `idx_appointments_org_status_confirmed`
- `idx_appointments_org_status_scheduled`
- `idx_appointments_scheduling_lookup`
- `idx_appointments_time_range`
- `idx_appointments_upcoming`

---
## Table: `audit_logs`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `event_type` (text, NOT NULL)
- `user_id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `ip_address` (text, nullable)
- `user_agent` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `success` (boolean, nullable, default: true)

**Primary Key:** id

**Check Constraints:**
- 2200_104972_1_not_null: id IS NOT NULL
- 2200_104972_2_not_null: created_at IS NOT NULL
- 2200_104972_3_not_null: event_type IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: SET NULL)

**Indexes (5):**
- `audit_logs_pkey`
- `idx_audit_logs_created_at`
- `idx_audit_logs_event_type`
- `idx_audit_logs_org_id`
- `idx_audit_logs_user_id`

---
## Table: `auth_audit_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `user_id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `event_type` (text, NOT NULL)
- `ip_address` (inet, nullable)
- `user_agent` (text, nullable)
- `metadata` (jsonb, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_111527_1_not_null: id IS NOT NULL
- 2200_111527_4_not_null: event_type IS NOT NULL
- auth_audit_log_event_type_check: (event_type = ANY (ARRAY['login_success'::text, 'login_failed'::text, 'logout'::text, 'mfa_enabled'::text, 'mfa_disabled'::text, 'mfa_challenge_success'::text, 'mfa_challenge_failed'::text, 'password_changed'::text, 'password_reset_requested'::text, 'session_revoked'::text, 'sso_login'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: SET NULL)

**Indexes (6):**
- `auth_audit_log_pkey`
- `idx_auth_audit_log_created_at`
- `idx_auth_audit_log_event_type`
- `idx_auth_audit_log_org_date`
- `idx_auth_audit_log_org_id`
- `idx_auth_audit_log_user_id`

---
## Table: `auth_sessions`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `user_id` (uuid, NOT NULL)
- `org_id` (uuid, NOT NULL)
- `session_token` (text, NOT NULL)
- `ip_address` (inet, nullable)
- `user_agent` (text, nullable)
- `device_type` (text, nullable)
- `location` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `last_activity_at` (timestamp with time zone, nullable, default: now())
- `expires_at` (timestamp with time zone, NOT NULL)
- `revoked_at` (timestamp with time zone, nullable)
- `revoked_reason` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `session_token`

**Check Constraints:**
- 2200_111499_11_not_null: expires_at IS NOT NULL
- 2200_111499_1_not_null: id IS NOT NULL
- 2200_111499_2_not_null: user_id IS NOT NULL
- 2200_111499_3_not_null: org_id IS NOT NULL
- 2200_111499_4_not_null: session_token IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (7):**
- `auth_sessions_pkey`
- `auth_sessions_session_token_key`
- `idx_auth_sessions_active`
- `idx_auth_sessions_created_at`
- `idx_auth_sessions_expires_at`
- `idx_auth_sessions_org_id`
- `idx_auth_sessions_user_id`

---
## Table: `backup_verification_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `verified_at` (timestamp with time zone, NOT NULL, default: now())
- `backup_id` (text, nullable)
- `backup_age_hours` (integer, nullable)
- `backup_size_mb` (integer, nullable)
- `status` (text, NOT NULL)
- `checks_passed` (integer, NOT NULL, default: 0)
- `checks_failed` (integer, NOT NULL, default: 0)
- `error_details` (jsonb, nullable)
- `verification_details` (jsonb, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_111400_11_not_null: created_at IS NOT NULL
- 2200_111400_1_not_null: id IS NOT NULL
- 2200_111400_2_not_null: verified_at IS NOT NULL
- 2200_111400_6_not_null: status IS NOT NULL
- 2200_111400_7_not_null: checks_passed IS NOT NULL
- 2200_111400_8_not_null: checks_failed IS NOT NULL
- backup_verification_log_status_check: (status = ANY (ARRAY['success'::text, 'warning'::text, 'failure'::text]))

**Indexes (5):**
- `backup_verification_log_pkey`
- `idx_backup_verification_log_created_at`
- `idx_backup_verification_log_failures`
- `idx_backup_verification_log_status`
- `idx_backup_verification_log_verified_at`

---
## Table: `bookings`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `patient_email` (text, NOT NULL)
- `provider_id` (uuid, NOT NULL)
- `start_time` (timestamp with time zone, NOT NULL)
- `end_time` (timestamp with time zone, NOT NULL)
- `status` (text, NOT NULL, default: 'pending'::text)
- `calendar_event_id` (text, nullable)
- `confirmation_token` (text, nullable)
- `patient_confirmed_at` (timestamp with time zone, nullable)
- `notes` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `updated_at` (timestamp with time zone, NOT NULL, default: now())
- `created_by` (uuid, NOT NULL)

**Primary Key:** id

**Unique Constraints:**
- `confirmation_token`

**Check Constraints:**
- 2200_117239_12_not_null: created_at IS NOT NULL
- 2200_117239_13_not_null: updated_at IS NOT NULL
- 2200_117239_14_not_null: created_by IS NOT NULL
- 2200_117239_1_not_null: id IS NOT NULL
- 2200_117239_2_not_null: org_id IS NOT NULL
- 2200_117239_3_not_null: patient_email IS NOT NULL
- 2200_117239_4_not_null: provider_id IS NOT NULL
- 2200_117239_5_not_null: start_time IS NOT NULL
- 2200_117239_6_not_null: end_time IS NOT NULL
- 2200_117239_7_not_null: status IS NOT NULL
- valid_status: (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]))
- valid_time_range: (start_time < end_time)

**Foreign Key Relationships:**
- `created_by` → `profiles.id` (ON DELETE: NO ACTION)
- `org_id` → `profiles.id` (ON DELETE: CASCADE)
- `provider_id` → `profiles.id` (ON DELETE: NO ACTION)

**Indexes (8):**
- `bookings_confirmation_token_key`
- `bookings_pkey`
- `idx_bookings_org_id`
- `idx_bookings_org_id_status`
- `idx_bookings_provider_id`
- `idx_bookings_provider_start`
- `idx_bookings_start_time`
- `idx_bookings_status`

---
## Table: `call_analytics_summary`
**Columns:**
- `date` (date, nullable)
- `call_type` (text, nullable)
- `status` (text, nullable)
- `total_calls` (bigint, nullable)
- `total_seconds` (bigint, nullable)
- `avg_duration_seconds` (numeric, nullable)
- `total_cost` (numeric, nullable)
- `bookings_created` (bigint, nullable)
- `positive_calls` (bigint, nullable)
- `negative_calls` (bigint, nullable)

---
## Table: `call_logs_legacy`
**Columns:**
- `id` (uuid, NOT NULL, default: uuid_generate_v4())
- `call_sid` (text, NOT NULL)
- `from_number` (text, nullable)
- `to_number` (text, nullable)
- `start_time` (timestamp with time zone, nullable)
- `end_time` (timestamp with time zone, nullable)
- `duration_seconds` (integer, nullable)
- `transcript` (text, nullable)
- `status` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `call_type` (text, nullable)
- `transcript_text` (text, nullable)
- `sentiment` (text, nullable)
- `intent` (text, nullable)
- `booking_created` (boolean, nullable, default: false)
- `transfer_requested` (boolean, nullable, default: false)
- `recording_url` (text, nullable)
- `recording_duration` (integer, nullable)
- `twilio_cost` (numeric, nullable, default: 0)
- `deepgram_cost` (numeric, nullable, default: 0)
- `groq_cost` (numeric, nullable, default: 0)
- `total_cost` (numeric, nullable, default: 0)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `tags` (ARRAY, nullable, default: ARRAY[]::text[])
- `agent_name` (text, nullable, default: 'roxan_sales'::text)
- `outcome` (text, nullable)
- `lead_id` (uuid, nullable)
- `error_message` (text, nullable)
- `vapi_call_id` (text, nullable)
- `started_at` (timestamp with time zone, nullable)
- `org_id` (uuid, NOT NULL)
- `ended_at` (timestamp with time zone, nullable)
- `recording_storage_path` (text, nullable)
- `recording_signed_url` (text, nullable)
- `recording_signed_url_expires_at` (timestamp without time zone, nullable)
- `recording_format` (text, nullable, default: 'wav'::text)
- `recording_size_bytes` (bigint, nullable)
- `recording_duration_seconds` (integer, nullable)
- `recording_uploaded_at` (timestamp without time zone, nullable)
- `transcript_only_fallback` (boolean, nullable, default: false)
- `recording_status` (text, nullable, default: 'pending'::text)
- `transfer_to` (text, nullable)
- `transfer_time` (timestamp with time zone, nullable)
- `transfer_reason` (text, nullable)
- `outcome_summary` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `vapi_call_id`
- `call_sid`

**Check Constraints:**
- 2200_31964_1_not_null: id IS NOT NULL
- 2200_31964_2_not_null: call_sid IS NOT NULL
- 2200_31964_32_not_null: org_id IS NOT NULL
- call_logs_call_type_check: (call_type = ANY (ARRAY['inbound'::text, 'outbound'::text, 'browser'::text]))
- call_logs_recording_status_check: (recording_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))
- call_logs_sentiment_check: (sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text]))
- call_logs_status_check: (status = ANY (ARRAY['active'::text, 'completed'::text, 'failed'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: RESTRICT)

**Indexes (25):**
- `call_logs_call_sid_key`
- `call_logs_pkey`
- `call_logs_vapi_call_id_key`
- `idx_call_logs_call_sid`
- `idx_call_logs_call_type`
- `idx_call_logs_created_at`
- `idx_call_logs_from_number`
- `idx_call_logs_org`
- `idx_call_logs_org_created`
- `idx_call_logs_org_from_created`
- `idx_call_logs_org_id`
- `idx_call_logs_org_to_created`
- `idx_call_logs_outcome_summary`
- `idx_call_logs_recording_status`
- `idx_call_logs_recording_storage_path`
- `idx_call_logs_recording_uploaded_at`
- `idx_call_logs_recording_url`
- `idx_call_logs_sentiment`
- `idx_call_logs_started_at`
- `idx_call_logs_status`
- `idx_call_logs_to_number`
- `idx_call_logs_transcript_only_fallback`
- `idx_call_logs_transcript_search`
- `idx_call_logs_transfer_time`
- `idx_call_logs_vapi_call_id`

---
## Table: `call_tracking`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `sequence_id` (uuid, nullable)
- `vapi_call_id` (text, nullable)
- `agent_id` (uuid, nullable)
- `called_at` (timestamp with time zone, nullable, default: now())
- `answered` (boolean, nullable, default: false)
- `voicemail` (boolean, nullable, default: false)
- `duration_seconds` (integer, nullable)
- `demo_sent` (boolean, nullable, default: false)
- `meeting_booked` (boolean, nullable, default: false)
- `call_outcome` (text, nullable)
- `call_notes` (text, nullable)
- `transcript` (text, nullable)
- `sentiment` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())
- `status` (text, nullable, default: 'queued'::text)
- `started_at` (timestamp with time zone, nullable)
- `ended_at` (timestamp with time zone, nullable)
- `org_id` (uuid, nullable)
- `phone` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `vapi_call_id`

**Check Constraints:**
- 2200_54535_1_not_null: id IS NOT NULL
- call_tracking_call_outcome_check: (call_outcome = ANY (ARRAY['answered_interested'::text, 'answered_not_interested'::text, 'answered_callback_requested'::text, 'voicemail_left'::text, 'no_answer'::text, 'busy'::text, 'failed'::text, 'queued'::text, 'in_progress'::text, 'ringing'::text]))
- call_tracking_sentiment_check: (sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text, 'not_analyzed'::text]))

**Foreign Key Relationships:**
- `agent_id` → `agents.id` (ON DELETE: SET NULL)
- `lead_id` → `leads.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)
- `sequence_id` → `campaign_sequences.id` (ON DELETE: SET NULL)

**Indexes (14):**
- `call_tracking_pkey`
- `call_tracking_vapi_call_id_unique`
- `idx_call_tracking_answered`
- `idx_call_tracking_called_at`
- `idx_call_tracking_lead`
- `idx_call_tracking_lead_id`
- `idx_call_tracking_org`
- `idx_call_tracking_org_id`
- `idx_call_tracking_outcome`
- `idx_call_tracking_phone_active`
- `idx_call_tracking_phone_recent`
- `idx_call_tracking_status`
- `idx_call_tracking_vapi_call_id`
- `idx_unique_active_call_per_lead`

---
## Table: `call_transcripts`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `call_id` (uuid, nullable)
- `speaker` (text, NOT NULL)
- `text` (text, NOT NULL)
- `timestamp` (timestamp with time zone, nullable, default: now())
- `created_at` (timestamp with time zone, nullable, default: now())
- `org_id` (uuid, NOT NULL)

**Primary Key:** id

**Check Constraints:**
- 2200_55295_1_not_null: id IS NOT NULL
- 2200_55295_3_not_null: speaker IS NOT NULL
- 2200_55295_4_not_null: text IS NOT NULL
- 2200_55295_7_not_null: org_id IS NOT NULL
- call_transcripts_speaker_check: (speaker = ANY (ARRAY['agent'::text, 'client'::text]))

**Foreign Key Relationships:**
- `call_id` → `call_tracking.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (3):**
- `call_transcripts_pkey`
- `idx_call_transcripts_call_id`
- `idx_call_transcripts_timestamp`

---
## Table: `calls`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `vapi_call_id` (text, NOT NULL, default: (gen_random_uuid())::text)
- `contact_id` (uuid, nullable)
- `call_direction` (text, NOT NULL)
- `call_type` (text, NOT NULL, default: 'inbound'::text)
- `from_number` (text, nullable)
- `to_number` (text, nullable)
- `call_sid` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `updated_at` (timestamp with time zone, NOT NULL, default: now())
- `start_time` (timestamp with time zone, nullable)
- `end_time` (timestamp with time zone, nullable)
- `duration_seconds` (integer, nullable)
- `status` (text, nullable)
- `recording_url` (text, nullable)
- `recording_storage_path` (text, nullable)
- `transcript` (text, nullable)
- `transcript_text` (text, nullable)
- `sentiment` (text, nullable)
- `intent` (text, nullable)
- `outcome` (text, nullable)
- `outcome_summary` (text, nullable)
- `notes` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `phone_number` (text, nullable)
- `caller_name` (text, nullable)
- `sentiment_label` (text, nullable)
- `sentiment_score` (numeric, nullable)
- `sentiment_summary` (text, nullable)
- `sentiment_urgency` (text, nullable)
- `reconciled` (boolean, nullable, default: false)
- `is_test_call` (boolean, nullable, default: false)

**Primary Key:** id

**Unique Constraints:**
- `vapi_call_id`

**Check Constraints:**
- 2200_117376_10_not_null: created_at IS NOT NULL
- 2200_117376_11_not_null: updated_at IS NOT NULL
- 2200_117376_1_not_null: id IS NOT NULL
- 2200_117376_2_not_null: org_id IS NOT NULL
- 2200_117376_3_not_null: vapi_call_id IS NOT NULL
- 2200_117376_5_not_null: call_direction IS NOT NULL
- 2200_117376_6_not_null: call_type IS NOT NULL
- calls_unified_call_direction_check: (call_direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))

**Foreign Key Relationships:**
- `contact_id` → `contacts.id` (ON DELETE: SET NULL)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (11):**
- `calls_unified_pkey`
- `calls_unified_vapi_call_id_key`
- `idx_calls_contact_id`
- `idx_calls_created_at`
- `idx_calls_direction`
- `idx_calls_direction_date`
- `idx_calls_from_number`
- `idx_calls_org_created`
- `idx_calls_org_date_pagination`
- `idx_calls_reconciled`
- `idx_calls_vapi_call_id`

---
## Table: `calls_with_caller_names`
**Columns:**
- `id` (uuid, nullable)
- `vapi_call_id` (text, nullable)
- `org_id` (uuid, nullable)
- `contact_id` (uuid, nullable)
- `phone_number` (text, nullable)
- `call_direction` (text, nullable)
- `call_type` (text, nullable)
- `from_number` (text, nullable)
- `to_number` (text, nullable)
- `call_sid` (text, nullable)
- `status` (text, nullable)
- `duration_seconds` (integer, nullable)
- `start_time` (timestamp with time zone, nullable)
- `end_time` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable)
- `updated_at` (timestamp with time zone, nullable)
- `recording_url` (text, nullable)
- `recording_storage_path` (text, nullable)
- `transcript` (text, nullable)
- `transcript_text` (text, nullable)
- `sentiment` (text, nullable)
- `sentiment_label` (text, nullable)
- `sentiment_score` (numeric, nullable)
- `sentiment_summary` (text, nullable)
- `sentiment_urgency` (text, nullable)
- `intent` (text, nullable)
- `outcome` (text, nullable)
- `outcome_summary` (text, nullable)
- `notes` (text, nullable)
- `metadata` (jsonb, nullable)
- `reconciled` (boolean, nullable)
- `is_test_call` (boolean, nullable)
- `deprecated_caller_name` (text, nullable)
- `deprecated_from_number` (text, nullable)
- `resolved_caller_name` (text, nullable)
- `contact_email` (text, nullable)
- `contact_lead_status` (text, nullable)
- `contact_lead_score` (integer, nullable)
- `contact_service_interests` (ARRAY, nullable)
- `contact_last_seen` (timestamp with time zone, nullable)
- `contact_created_at` (timestamp with time zone, nullable)
- `name_source` (text, nullable)

---
## Table: `campaign_metrics`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `metric_date` (date, NOT NULL)
- `tier` (text, nullable)
- `emails_sent` (integer, nullable, default: 0)
- `emails_delivered` (integer, nullable, default: 0)
- `emails_opened` (integer, nullable, default: 0)
- `emails_clicked` (integer, nullable, default: 0)
- `emails_replied` (integer, nullable, default: 0)
- `emails_bounced` (integer, nullable, default: 0)
- `calls_made` (integer, nullable, default: 0)
- `calls_answered` (integer, nullable, default: 0)
- `calls_voicemail` (integer, nullable, default: 0)
- `demos_sent` (integer, nullable, default: 0)
- `demos_viewed` (integer, nullable, default: 0)
- `meetings_booked` (integer, nullable, default: 0)
- `meetings_held` (integer, nullable, default: 0)
- `deals_closed` (integer, nullable, default: 0)
- `mrr_added` (numeric, nullable, default: 0)
- `setup_fees_collected` (numeric, nullable, default: 0)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `metric_date`
- `tier`

**Check Constraints:**
- 2200_54611_1_not_null: id IS NOT NULL
- 2200_54611_3_not_null: metric_date IS NOT NULL
- campaign_metrics_tier_check: (tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'all'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: NO ACTION)

**Indexes (4):**
- `campaign_metrics_org_id_metric_date_tier_key`
- `campaign_metrics_pkey`
- `idx_campaign_metrics_date`
- `idx_campaign_metrics_org`

---
## Table: `campaign_sequences`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `sequence_name` (text, NOT NULL)
- `current_step` (integer, nullable, default: 1)
- `total_steps` (integer, nullable, default: 5)
- `status` (text, nullable, default: 'pending'::text)
- `last_contact_at` (timestamp with time zone, nullable)
- `next_contact_at` (timestamp with time zone, nullable)
- `next_action` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `org_id` (uuid, nullable)

**Primary Key:** id

**Unique Constraints:**
- `lead_id`
- `sequence_name`

**Check Constraints:**
- 2200_54483_1_not_null: id IS NOT NULL
- 2200_54483_3_not_null: sequence_name IS NOT NULL
- campaign_sequences_status_check: (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'completed'::text, 'opted_out'::text]))

**Foreign Key Relationships:**
- `lead_id` → `leads.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `campaign_sequences_lead_id_sequence_name_key`
- `campaign_sequences_pkey`
- `idx_campaign_sequences_lead_id`
- `idx_campaign_sequences_next_contact`
- `idx_campaign_sequences_status`

---
## Table: `campaigns`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `name` (text, NOT NULL)
- `status` (text, NOT NULL, default: 'draft'::text)
- `lead_count` (integer, nullable, default: 0)
- `emails_sent` (integer, nullable, default: 0)
- `calls_completed` (integer, nullable, default: 0)
- `filters` (jsonb, nullable, default: '{}'::jsonb)
- `email_template_id` (uuid, nullable)
- `assistant_profile_id` (uuid, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_52746_1_not_null: id IS NOT NULL
- 2200_52746_3_not_null: name IS NOT NULL
- 2200_52746_4_not_null: status IS NOT NULL

**Indexes (2):**
- `campaigns_pkey`
- `idx_campaigns_org_id`

---
## Table: `carrier_forwarding_rules`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `country_code` (text, NOT NULL)
- `country_name` (text, NOT NULL)
- `recommended_twilio_country` (text, NOT NULL)
- `carrier_codes` (jsonb, NOT NULL)
- `forwarding_cost_estimate` (text, nullable)
- `avg_latency_ms` (integer, nullable)
- `warning_message` (text, nullable)
- `setup_notes` (text, nullable)
- `is_active` (boolean, nullable, default: true)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `country_code`

**Check Constraints:**
- 2200_112676_1_not_null: id IS NOT NULL
- 2200_112676_2_not_null: country_code IS NOT NULL
- 2200_112676_3_not_null: country_name IS NOT NULL
- 2200_112676_4_not_null: recommended_twilio_country IS NOT NULL
- 2200_112676_5_not_null: carrier_codes IS NOT NULL
- valid_country_code_format: (country_code ~ '^[A-Z]{2}$'::text)

**Indexes (5):**
- `carrier_forwarding_rules_pkey`
- `idx_carrier_forwarding_rules_codes`
- `idx_carrier_rules_country`
- `idx_carrier_rules_recommended`
- `unique_country_code`

---
## Table: `contacts`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `name` (text, NOT NULL)
- `phone` (text, NOT NULL)
- `email` (text, nullable)
- `service_interests` (ARRAY, nullable, default: '{}'::text[])
- `lead_status` (text, nullable)
- `lead_score` (integer, nullable, default: 0)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `last_contacted_at` (timestamp with time zone, nullable)
- `booking_source` (text, nullable)
- `notes` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `org_id`
- `phone`
- `email`

**Check Constraints:**
- 2200_94087_1_not_null: id IS NOT NULL
- 2200_94087_2_not_null: org_id IS NOT NULL
- 2200_94087_3_not_null: name IS NOT NULL
- 2200_94087_4_not_null: phone IS NOT NULL
- contacts_lead_status_check: (lead_status = ANY (ARRAY['hot'::text, 'warm'::text, 'cold'::text]))
- contacts_name_must_be_real: ((name IS NOT NULL) AND (length(TRIM(BOTH FROM name)) >= 2) AND (name <> 'Unknown Caller'::text) AND (name <> 'Unknown'::text))
- contacts_phone_must_be_e164: (phone ~ '^\+[1-9][0-9]{1,14}$'::text)

**Indexes (7):**
- `contacts_org_email_unique`
- `contacts_org_id_phone_key`
- `contacts_pkey`
- `idx_contacts_org_id`
- `idx_contacts_org_phone`
- `idx_contacts_org_phone_unique`
- `idx_contacts_phone`

---
## Table: `credit_transactions`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `type` (text, NOT NULL)
- `amount_pence` (integer, NOT NULL)
- `direction` (text, NOT NULL)
- `balance_before_pence` (integer, NOT NULL)
- `balance_after_pence` (integer, NOT NULL)
- `call_id` (text, nullable)
- `vapi_call_id` (text, nullable)
- `provider_cost_pence` (integer, nullable)
- `client_charged_pence` (integer, nullable)
- `gross_profit_pence` (integer, nullable)
- `markup_percent` (integer, nullable)
- `cost_breakdown` (jsonb, nullable)
- `stripe_payment_intent_id` (text, nullable)
- `stripe_charge_id` (text, nullable)
- `description` (text, nullable)
- `created_by` (text, nullable, default: 'system'::text)
- `created_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Unique Constraints:**
- `call_id`

**Check Constraints:**
- 2200_125327_19_not_null: created_at IS NOT NULL
- 2200_125327_1_not_null: id IS NOT NULL
- 2200_125327_2_not_null: org_id IS NOT NULL
- 2200_125327_3_not_null: type IS NOT NULL
- 2200_125327_4_not_null: amount_pence IS NOT NULL
- 2200_125327_5_not_null: direction IS NOT NULL
- 2200_125327_6_not_null: balance_before_pence IS NOT NULL
- 2200_125327_7_not_null: balance_after_pence IS NOT NULL
- credit_transactions_amount_pence_check: (amount_pence > 0)
- credit_transactions_direction_check: (direction = ANY (ARRAY['credit'::text, 'debit'::text]))
- credit_transactions_type_check: (type = ANY (ARRAY['topup'::text, 'call_deduction'::text, 'refund'::text, 'adjustment'::text, 'bonus'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (7):**
- `credit_transactions_pkey`
- `credit_txn_call_unique`
- `idx_credit_transactions_call_id`
- `idx_credit_transactions_org_created`
- `idx_credit_transactions_org_id`
- `idx_credit_transactions_org_type`
- `idx_credit_txn_stripe_pi`

---
## Table: `demo_assets`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `name` (text, NOT NULL)
- `asset_type` (text, NOT NULL)
- `demo_type` (text, NOT NULL)
- `url` (text, NOT NULL)
- `description` (text, nullable)
- `active` (boolean, nullable, default: true)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_52888_1_not_null: id IS NOT NULL
- 2200_52888_3_not_null: name IS NOT NULL
- 2200_52888_4_not_null: asset_type IS NOT NULL
- 2200_52888_5_not_null: demo_type IS NOT NULL
- 2200_52888_6_not_null: url IS NOT NULL

**Indexes (1):**
- `demo_assets_pkey`

---
## Table: `demo_bookings`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `agent_id` (uuid, nullable)
- `call_id` (text, nullable)
- `prospect_name` (text, NOT NULL)
- `prospect_email` (text, nullable)
- `prospect_phone` (text, nullable)
- `clinic_name` (text, nullable)
- `timezone` (text, nullable)
- `preferred_time_window` (text, nullable)
- `status` (text, nullable, default: 'pending'::text)
- `email_sent` (boolean, nullable, default: false)
- `email_sent_at` (timestamp with time zone, nullable)
- `sms_sent` (boolean, nullable, default: false)
- `sms_sent_at` (timestamp with time zone, nullable)
- `whatsapp_sent` (boolean, nullable, default: false)
- `whatsapp_sent_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_52958_1_not_null: id IS NOT NULL
- 2200_52958_5_not_null: prospect_name IS NOT NULL

**Indexes (5):**
- `demo_bookings_pkey`
- `idx_demo_bookings_created_at`
- `idx_demo_bookings_email`
- `idx_demo_bookings_org_id`
- `idx_demo_bookings_status`

---
## Table: `demo_send_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `demo_booking_id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `channel` (text, nullable)
- `asset_id` (uuid, nullable)
- `recipient_address` (text, nullable)
- `demo_url` (text, nullable)
- `status` (text, nullable, default: 'pending'::text)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_52971_1_not_null: id IS NOT NULL

**Indexes (1):**
- `demo_send_log_pkey`

---
## Table: `email_events`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `template_id` (text, nullable)
- `status` (text, NOT NULL)
- `provider` (text, nullable, default: 'resend'::text)
- `provider_message_id` (text, nullable)
- `subject` (text, nullable)
- `from_email` (text, nullable)
- `to_email` (text, nullable)
- `tracking_id` (text, nullable)
- `opened_at` (timestamp with time zone, nullable)
- `clicked_at` (timestamp with time zone, nullable)
- `bounced_at` (timestamp with time zone, nullable)
- `error_message` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_52761_1_not_null: id IS NOT NULL
- 2200_52761_5_not_null: status IS NOT NULL

**Indexes (2):**
- `email_events_pkey`
- `idx_email_events_lead_id`

---
## Table: `email_templates`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `name` (text, NOT NULL)
- `subject` (text, NOT NULL)
- `html_body` (text, NOT NULL)
- `text_body` (text, nullable)
- `variables` (jsonb, nullable, default: '[]'::jsonb)
- `is_active` (boolean, nullable, default: true)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_52772_1_not_null: id IS NOT NULL
- 2200_52772_3_not_null: name IS NOT NULL
- 2200_52772_4_not_null: subject IS NOT NULL
- 2200_52772_5_not_null: html_body IS NOT NULL

**Indexes (1):**
- `email_templates_pkey`

---
## Table: `email_tracking`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `sequence_id` (uuid, nullable)
- `email_subject` (text, NOT NULL)
- `email_variant` (text, nullable)
- `from_email` (text, NOT NULL)
- `to_email` (text, NOT NULL)
- `sent_at` (timestamp with time zone, nullable, default: now())
- `delivered_at` (timestamp with time zone, nullable)
- `opened_at` (timestamp with time zone, nullable)
- `clicked_at` (timestamp with time zone, nullable)
- `replied_at` (timestamp with time zone, nullable)
- `bounced` (boolean, nullable, default: false)
- `bounce_reason` (text, nullable)
- `spam_complaint` (boolean, nullable, default: false)
- `tracking_pixel_id` (text, nullable)
- `demo_link_clicked` (boolean, nullable, default: false)
- `resend_message_id` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())
- `cc_email` (text, nullable)
- `org_id` (uuid, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_54507_1_not_null: id IS NOT NULL
- 2200_54507_4_not_null: email_subject IS NOT NULL
- 2200_54507_6_not_null: from_email IS NOT NULL
- 2200_54507_7_not_null: to_email IS NOT NULL

**Foreign Key Relationships:**
- `lead_id` → `leads.id` (ON DELETE: CASCADE)
- `sequence_id` → `campaign_sequences.id` (ON DELETE: SET NULL)

**Indexes (5):**
- `email_tracking_pkey`
- `idx_email_tracking_lead`
- `idx_email_tracking_opened`
- `idx_email_tracking_sent`
- `idx_email_tracking_variant`

---
## Table: `escalation_rules`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `agent_id` (uuid, nullable)
- `trigger_type` (text, NOT NULL)
- `trigger_value` (jsonb, nullable)
- `transfer_number` (text, NOT NULL)
- `transfer_type` (text, nullable, default: 'external'::text)
- `name` (text, NOT NULL)
- `description` (text, nullable)
- `enabled` (boolean, nullable, default: true)
- `priority` (integer, nullable, default: 0)
- `created_at` (timestamp without time zone, nullable, default: now())
- `updated_at` (timestamp without time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_91698_1_not_null: id IS NOT NULL
- 2200_91698_2_not_null: org_id IS NOT NULL
- 2200_91698_4_not_null: trigger_type IS NOT NULL
- 2200_91698_6_not_null: transfer_number IS NOT NULL
- 2200_91698_8_not_null: name IS NOT NULL
- escalation_rules_transfer_type_check: (transfer_type = ANY (ARRAY['external'::text, 'internal'::text]))
- escalation_rules_trigger_type_check: (trigger_type = ANY (ARRAY['wait_time'::text, 'sentiment'::text, 'ai_request'::text, 'manual'::text]))
- valid_transfer_number: (transfer_number ~ '^\+[1-9]\d{1,14}$'::text)

**Foreign Key Relationships:**
- `agent_id` → `agents.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `escalation_rules_pkey`
- `idx_escalation_rules_enabled`
- `idx_escalation_rules_org_agent`
- `idx_escalation_rules_trigger_type`

---
## Table: `failed_recording_uploads`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `call_id` (uuid, nullable)
- `vapi_recording_url` (text, nullable)
- `error_message` (text, nullable)
- `retry_count` (integer, nullable, default: 0)
- `next_retry_at` (timestamp without time zone, nullable)
- `created_at` (timestamp without time zone, nullable, default: now())
- `resolved_at` (timestamp without time zone, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_67128_1_not_null: id IS NOT NULL

**Foreign Key Relationships:**
- `call_id` → `call_logs_legacy.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `failed_recording_uploads_pkey`
- `idx_failed_uploads_call_id`
- `idx_failed_uploads_created_at`
- `idx_failed_uploads_next_retry`
- `idx_failed_uploads_resolved`

---
## Table: `feature_flag_audit_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `flag_key` (text, NOT NULL)
- `org_id` (uuid, nullable)
- `action` (text, NOT NULL)
- `previous_value` (jsonb, nullable)
- `new_value` (jsonb, nullable)
- `changed_by` (uuid, nullable)
- `changed_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_111470_1_not_null: id IS NOT NULL
- 2200_111470_2_not_null: flag_key IS NOT NULL
- 2200_111470_4_not_null: action IS NOT NULL
- feature_flag_audit_log_action_check: (action = ANY (ARRAY['enabled'::text, 'disabled'::text, 'rollout_changed'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: SET NULL)

**Indexes (4):**
- `feature_flag_audit_log_pkey`
- `idx_feature_flag_audit_log_changed_at`
- `idx_feature_flag_audit_log_flag_key`
- `idx_feature_flag_audit_log_org_id`

---
## Table: `feature_flags`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `flag_key` (text, NOT NULL)
- `flag_name` (text, NOT NULL)
- `description` (text, nullable)
- `enabled_globally` (boolean, nullable, default: false)
- `rollout_percentage` (integer, nullable, default: 0)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `flag_key`

**Check Constraints:**
- 2200_111421_1_not_null: id IS NOT NULL
- 2200_111421_2_not_null: flag_key IS NOT NULL
- 2200_111421_3_not_null: flag_name IS NOT NULL
- feature_flags_rollout_percentage_check: ((rollout_percentage >= 0) AND (rollout_percentage <= 100))

**Indexes (4):**
- `feature_flags_flag_key_key`
- `feature_flags_pkey`
- `idx_feature_flags_enabled`
- `idx_feature_flags_flag_key`

---
## Table: `follow_up_tasks`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `lead_id` (uuid, NOT NULL)
- `task_type` (USER-DEFINED, NOT NULL)
- `priority` (USER-DEFINED, nullable, default: 'medium'::task_priority)
- `service_context` (text, NOT NULL)
- `scheduled_for` (timestamp with time zone, NOT NULL)
- `completed_at` (timestamp with time zone, nullable)
- `status` (USER-DEFINED, nullable, default: 'pending'::task_status)
- `error_message` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_95347_1_not_null: id IS NOT NULL
- 2200_95347_2_not_null: org_id IS NOT NULL
- 2200_95347_3_not_null: lead_id IS NOT NULL
- 2200_95347_4_not_null: task_type IS NOT NULL
- 2200_95347_6_not_null: service_context IS NOT NULL
- 2200_95347_7_not_null: scheduled_for IS NOT NULL

**Foreign Key Relationships:**
- `lead_id` → `contacts.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `follow_up_tasks_pkey`
- `idx_follow_up_tasks_lead_id`
- `idx_follow_up_tasks_org_id`
- `idx_follow_up_tasks_scheduled_for`
- `idx_follow_up_tasks_status`

---
## Table: `hallucination_flags`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `agent_id` (uuid, nullable)
- `call_id` (uuid, nullable)
- `transcript` (text, nullable)
- `flagged_claim` (text, nullable)
- `confidence_score` (double precision, nullable)
- `knowledge_base_search_result` (text, nullable)
- `status` (text, NOT NULL, default: 'pending'::text)
- `created_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_62045_10_not_null: created_at IS NOT NULL
- 2200_62045_1_not_null: id IS NOT NULL
- 2200_62045_2_not_null: org_id IS NOT NULL
- 2200_62045_9_not_null: status IS NOT NULL

**Indexes (2):**
- `hallucination_flags_org_id_idx`
- `hallucination_flags_pkey`

---
## Table: `hot_lead_alerts`
**Columns:**
- `id` (uuid, NOT NULL, default: uuid_generate_v4())
- `org_id` (uuid, NOT NULL)
- `call_id` (text, NOT NULL)
- `lead_name` (text, NOT NULL)
- `lead_phone` (text, NOT NULL)
- `service_interest` (text, nullable)
- `urgency_level` (text, nullable, default: 'high'::text)
- `summary` (text, nullable)
- `lead_score` (integer, nullable)
- `sms_message_id` (text, nullable)
- `alert_sent_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `call_id`

**Check Constraints:**
- 2200_91595_1_not_null: id IS NOT NULL
- 2200_91595_2_not_null: org_id IS NOT NULL
- 2200_91595_3_not_null: call_id IS NOT NULL
- 2200_91595_4_not_null: lead_name IS NOT NULL
- 2200_91595_5_not_null: lead_phone IS NOT NULL
- hot_lead_alerts_lead_score_check: ((lead_score >= 0) AND (lead_score <= 100))
- hot_lead_alerts_urgency_level_check: (urgency_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `hot_lead_alerts_org_id_call_id_key`
- `hot_lead_alerts_pkey`
- `idx_hot_lead_alerts_call_id`
- `idx_hot_lead_alerts_created_at`
- `idx_hot_lead_alerts_org_id`

---
## Table: `hot_leads`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `source` (text, nullable)
- `signal_type` (text, nullable)
- `original_message` (text, nullable)
- `ai_response` (text, nullable)
- `detected_at` (timestamp with time zone, nullable, default: now())
- `followed_up` (boolean, nullable, default: false)
- `followed_up_at` (timestamp with time zone, nullable)
- `notes` (text, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)

**Primary Key:** id

**Check Constraints:**
- 2200_52798_1_not_null: id IS NOT NULL

**Indexes (1):**
- `hot_leads_pkey`

---
## Table: `hybrid_forwarding_configs`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `verified_caller_id` (uuid, NOT NULL)
- `sim_phone_number` (text, NOT NULL)
- `forwarding_type` (text, NOT NULL)
- `carrier` (text, NOT NULL)
- `carrier_country_code` (text, nullable, default: 'US'::text)
- `twilio_forwarding_number` (text, NOT NULL)
- `ring_time_seconds` (integer, nullable, default: 25)
- `generated_activation_code` (text, nullable)
- `generated_deactivation_code` (text, nullable)
- `status` (text, NOT NULL, default: 'pending_setup'::text)
- `user_confirmed_setup` (boolean, nullable, default: false)
- `confirmed_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `country_code` (text, nullable, default: 'US'::text)
- `carrier_name` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `sim_phone_number`

**Check Constraints:**
- 2200_112778_12_not_null: status IS NOT NULL
- 2200_112778_1_not_null: id IS NOT NULL
- 2200_112778_2_not_null: org_id IS NOT NULL
- 2200_112778_3_not_null: verified_caller_id IS NOT NULL
- 2200_112778_4_not_null: sim_phone_number IS NOT NULL
- 2200_112778_5_not_null: forwarding_type IS NOT NULL
- 2200_112778_6_not_null: carrier IS NOT NULL
- 2200_112778_8_not_null: twilio_forwarding_number IS NOT NULL
- hybrid_forwarding_configs_carrier_check: (carrier = ANY (ARRAY['att'::text, 'tmobile'::text, 'verizon'::text, 'sprint'::text, 'other_gsm'::text, 'other_cdma'::text, 'international'::text]))
- hybrid_forwarding_configs_forwarding_type_check: (forwarding_type = ANY (ARRAY['total_ai'::text, 'safety_net'::text]))
- hybrid_forwarding_configs_status_check: (status = ANY (ARRAY['pending_setup'::text, 'active'::text, 'disabled'::text]))
- valid_ring_time: ((ring_time_seconds >= 5) AND (ring_time_seconds <= 60))
- valid_sim_phone_e164: (sim_phone_number ~ '^\+[1-9]\d{6,14}$'::text)
- valid_twilio_phone_e164: (twilio_forwarding_number ~ '^\+[1-9]\d{6,14}$'::text)

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)
- `verified_caller_id` → `verified_caller_ids.id` (ON DELETE: CASCADE)

**Indexes (8):**
- `hybrid_forwarding_configs_pkey`
- `idx_forwarding_configs_country`
- `idx_forwarding_configs_country_carrier`
- `idx_forwarding_configs_org_status`
- `idx_forwarding_configs_pending`
- `idx_forwarding_configs_sim_phone`
- `idx_forwarding_configs_verified_id`
- `unique_org_sim`

---
## Table: `import_errors`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `import_id` (uuid, NOT NULL)
- `row_number` (integer, NOT NULL)
- `raw_data` (jsonb, nullable)
- `error_type` (text, NOT NULL)
- `error_message` (text, NOT NULL)
- `field_name` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `org_id` (uuid, NOT NULL)

**Primary Key:** id

**Check Constraints:**
- 2200_58175_1_not_null: id IS NOT NULL
- 2200_58175_2_not_null: import_id IS NOT NULL
- 2200_58175_3_not_null: row_number IS NOT NULL
- 2200_58175_5_not_null: error_type IS NOT NULL
- 2200_58175_6_not_null: error_message IS NOT NULL
- 2200_58175_9_not_null: org_id IS NOT NULL
- import_errors_error_type_check: (error_type = ANY (ARRAY['validation'::text, 'duplicate'::text, 'database'::text, 'format'::text]))

**Foreign Key Relationships:**
- `import_id` → `imports.id` (ON DELETE: CASCADE)

**Indexes (2):**
- `idx_import_errors_import_id`
- `import_errors_pkey`

---
## Table: `imports`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `filename` (text, NOT NULL)
- `file_size_bytes` (integer, nullable)
- `file_path` (text, nullable)
- `status` (text, NOT NULL, default: 'pending'::text)
- `total_rows` (integer, nullable, default: 0)
- `processed_rows` (integer, nullable, default: 0)
- `created_count` (integer, nullable, default: 0)
- `updated_count` (integer, nullable, default: 0)
- `skipped_count` (integer, nullable, default: 0)
- `failed_count` (integer, nullable, default: 0)
- `dedupe_mode` (text, nullable, default: 'skip'::text)
- `column_mapping` (jsonb, nullable, default: '{}'::jsonb)
- `error_message` (text, nullable)
- `uploaded_by` (text, nullable)
- `uploaded_ip` (text, nullable)
- `started_at` (timestamp with time zone, nullable)
- `completed_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_58149_1_not_null: id IS NOT NULL
- 2200_58149_2_not_null: org_id IS NOT NULL
- 2200_58149_3_not_null: filename IS NOT NULL
- 2200_58149_6_not_null: status IS NOT NULL
- imports_dedupe_mode_check: (dedupe_mode = ANY (ARRAY['skip'::text, 'update'::text, 'create'::text]))
- imports_status_check: (status = ANY (ARRAY['pending'::text, 'validating'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'partial'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `idx_imports_created_at`
- `idx_imports_org_id`
- `idx_imports_status`
- `imports_pkey`

---
## Table: `inbound_agent_config`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `vapi_api_key` (text, nullable)
- `vapi_assistant_id` (text, nullable)
- `twilio_account_sid` (text, nullable)
- `twilio_auth_token` (text, nullable)
- `twilio_phone_number` (text, nullable)
- `system_prompt` (text, nullable)
- `first_message` (text, nullable)
- `voice_id` (text, nullable, default: 'Paige'::text)
- `language` (text, nullable, default: 'en-US'::text)
- `max_call_duration` (integer, nullable, default: 600)
- `is_active` (boolean, nullable, default: true)
- `last_synced_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `vapi_phone_number_id` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `org_id`

**Check Constraints:**
- 2200_65967_1_not_null: id IS NOT NULL
- 2200_65967_2_not_null: org_id IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (6):**
- `idx_inbound_agent_config_active`
- `idx_inbound_agent_config_org`
- `idx_inbound_agent_config_phone`
- `idx_inbound_agent_config_vapi_phone_id`
- `inbound_agent_config_org_id_key`
- `inbound_agent_config_pkey`

---
## Table: `integration_settings`
**Columns:**
- `id` (bigint, NOT NULL, default: nextval('integration_settings_id_seq'::regclass))
- `org_id` (text, NOT NULL)
- `vapi_api_key` (text, nullable)
- `vapi_webhook_secret` (text, nullable)
- `twilio_account_sid` (text, nullable)
- `twilio_auth_token` (text, nullable)
- `twilio_from_number` (text, nullable)
- `test_destination_number` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `last_verified_at` (timestamp with time zone, nullable)
- `hot_lead_alert_phone` (text, nullable)
- `transfer_phone_number` (text, nullable)
- `transfer_sip_uri` (text, nullable)
- `transfer_departments` (jsonb, nullable, default: '{"billing": null, "general": null, "medical": null}'::jsonb)

**Primary Key:** id

**Unique Constraints:**
- `org_id`

**Check Constraints:**
- 2200_59487_1_not_null: id IS NOT NULL
- 2200_59487_2_not_null: org_id IS NOT NULL
- valid_alert_phone: ((hot_lead_alert_phone IS NULL) OR (hot_lead_alert_phone ~ '^\+[1-9]\d{1,14}$'::text))
- valid_test_number: ((test_destination_number IS NULL) OR (test_destination_number ~ '^\+[1-9]\d{1,14}$'::text))
- valid_transfer_phone: ((transfer_phone_number IS NULL) OR (transfer_phone_number ~ '^\+[1-9]\d{1,14}$'::text))
- valid_twilio_number: ((twilio_from_number IS NULL) OR (twilio_from_number ~ '^\+[1-9]\d{1,14}$'::text))

**Indexes (3):**
- `idx_integration_settings_org_id`
- `integration_settings_org_id_key`
- `integration_settings_pkey`

---
## Table: `integrations`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `provider` (text, NOT NULL)
- `connected` (boolean, nullable, default: false)
- `last_checked_at` (timestamp with time zone, nullable)
- `config` (jsonb, nullable, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `encrypted_config` (text, nullable)
- `encrypted` (boolean, nullable, default: false)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `provider`

**Check Constraints:**
- 2200_52784_1_not_null: id IS NOT NULL
- 2200_52784_3_not_null: provider IS NOT NULL

**Indexes (3):**
- `idx_integrations_org_provider`
- `integrations_org_id_provider_key`
- `integrations_pkey`

---
## Table: `kb_sync_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `tool_id` (text, nullable)
- `status` (text, NOT NULL, default: 'success'::text)
- `error_message` (text, nullable)
- `duration_ms` (integer, nullable)
- `docs_synced` (integer, nullable)
- `assistants_updated` (integer, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_62006_1_not_null: id IS NOT NULL
- 2200_62006_2_not_null: org_id IS NOT NULL
- 2200_62006_3_not_null: created_at IS NOT NULL
- 2200_62006_5_not_null: status IS NOT NULL

**Indexes (3):**
- `kb_sync_log_org_id_created_at_idx`
- `kb_sync_log_org_id_idx`
- `kb_sync_log_pkey`

---
## Table: `knowledge_base`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `filename` (text, NOT NULL)
- `content` (text, NOT NULL)
- `category` (text, NOT NULL, default: 'general'::text)
- `version` (integer, NOT NULL, default: 1)
- `active` (boolean, NOT NULL, default: true)
- `metadata` (jsonb, NOT NULL, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `updated_at` (timestamp with time zone, NOT NULL, default: now())
- `is_chunked` (boolean, nullable, default: false)
- `chunk_count` (integer, nullable, default: 0)
- `embedding_status` (text, nullable, default: 'pending'::text)

**Primary Key:** id

**Check Constraints:**
- 2200_62019_10_not_null: updated_at IS NOT NULL
- 2200_62019_1_not_null: id IS NOT NULL
- 2200_62019_2_not_null: org_id IS NOT NULL
- 2200_62019_3_not_null: filename IS NOT NULL
- 2200_62019_4_not_null: content IS NOT NULL
- 2200_62019_5_not_null: category IS NOT NULL
- 2200_62019_6_not_null: version IS NOT NULL
- 2200_62019_7_not_null: active IS NOT NULL
- 2200_62019_8_not_null: metadata IS NOT NULL
- 2200_62019_9_not_null: created_at IS NOT NULL

**Indexes (6):**
- `idx_knowledge_base_active`
- `idx_knowledge_base_org_active`
- `idx_knowledge_base_org_id`
- `knowledge_base_org_id_active_idx`
- `knowledge_base_org_id_idx`
- `knowledge_base_pkey`

---
## Table: `knowledge_base_changelog`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `knowledge_base_id` (uuid, NOT NULL)
- `org_id` (uuid, NOT NULL)
- `version_from` (integer, nullable)
- `version_to` (integer, nullable)
- `change_type` (text, NOT NULL)
- `changed_by` (text, nullable)
- `change_summary` (text, nullable)
- `previous_content` (text, nullable)
- `new_content` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_62035_11_not_null: created_at IS NOT NULL
- 2200_62035_1_not_null: id IS NOT NULL
- 2200_62035_2_not_null: knowledge_base_id IS NOT NULL
- 2200_62035_3_not_null: org_id IS NOT NULL
- 2200_62035_6_not_null: change_type IS NOT NULL

**Indexes (2):**
- `knowledge_base_changelog_org_id_idx`
- `knowledge_base_changelog_pkey`

---
## Table: `knowledge_base_chunks`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `knowledge_base_id` (uuid, NOT NULL)
- `org_id` (uuid, NOT NULL)
- `chunk_index` (integer, NOT NULL)
- `content` (text, NOT NULL)
- `token_count` (integer, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `embedding` (USER-DEFINED, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_62384_1_not_null: id IS NOT NULL
- 2200_62384_2_not_null: knowledge_base_id IS NOT NULL
- 2200_62384_3_not_null: org_id IS NOT NULL
- 2200_62384_4_not_null: chunk_index IS NOT NULL
- 2200_62384_5_not_null: content IS NOT NULL
- 2200_62384_8_not_null: created_at IS NOT NULL

**Foreign Key Relationships:**
- `knowledge_base_id` → `knowledge_base.id` (ON DELETE: CASCADE)

**Indexes (7):**
- `idx_knowledge_base_chunks_embedding`
- `idx_knowledge_base_chunks_kb_id`
- `kb_chunks_kb_id_idx`
- `kb_chunks_org_id_idx`
- `knowledge_base_chunks_kb_id_idx`
- `knowledge_base_chunks_org_id_idx`
- `knowledge_base_chunks_pkey`

---
## Table: `lead_scores`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `total_score` (integer, NOT NULL, default: 0)
- `persona_score` (integer, nullable, default: 0)
- `geography_score` (integer, nullable, default: 0)
- `engagement_score` (integer, nullable, default: 0)
- `priority_tier` (text, nullable)
- `scoring_notes` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `org_id` (uuid, nullable)

**Primary Key:** id

**Unique Constraints:**
- `lead_id`

**Check Constraints:**
- 2200_54456_1_not_null: id IS NOT NULL
- 2200_54456_3_not_null: total_score IS NOT NULL
- lead_scores_priority_tier_check: (priority_tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]))

**Foreign Key Relationships:**
- `lead_id` → `leads.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `idx_lead_scores_lead_id`
- `idx_lead_scores_tier`
- `idx_lead_scores_total`
- `lead_scores_lead_id_key`
- `lead_scores_pkey`

---
## Table: `leads`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `name` (text, nullable)
- `email` (text, NOT NULL)
- `phone` (text, nullable)
- `industry` (text, nullable)
- `use_case` (text, nullable)
- `status` (text, nullable, default: 'new'::text)
- `scheduled_call_time` (timestamp without time zone, nullable)
- `created_at` (timestamp without time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `company` (text, nullable)
- `source` (text, nullable, default: 'website'::text)
- `call_log_id` (uuid, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `notes` (text, nullable)
- `clinic_name` (text, nullable)
- `clinic_type` (text, nullable)
- `lead_source` (text, nullable, default: 'inbound_call'::text)
- `demo_datetime` (timestamp with time zone, nullable)
- `pain_points` (text, nullable)
- `estimated_call_volume` (text, nullable)
- `org_id` (uuid, nullable)
- `contact_name` (text, nullable)
- `company_name` (text, nullable)
- `country` (text, nullable)
- `city` (text, nullable)
- `tags` (jsonb, nullable, default: '[]'::jsonb)
- `last_contacted_at` (timestamp with time zone, nullable)
- `latest_email_status` (text, nullable)
- `personalization_data` (jsonb, nullable, default: '{}'::jsonb)
- `opted_out` (boolean, nullable, default: false)
- `import_id` (uuid, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_30522_1_not_null: id IS NOT NULL
- 2200_30522_3_not_null: email IS NOT NULL
- leads_source_check: (source = ANY (ARRAY['website'::text, 'call'::text, 'referral'::text, 'demo'::text, 'other'::text, 'apify_google_places'::text, 'apify_instagram'::text, 'manual'::text, 'csv_import'::text]))

**Foreign Key Relationships:**
- `call_log_id` → `call_logs_legacy.id` (ON DELETE: SET NULL)
- `import_id` → `imports.id` (ON DELETE: NO ACTION)

**Indexes (10):**
- `idx_leads_call_log`
- `idx_leads_created_at`
- `idx_leads_email`
- `idx_leads_import_id`
- `idx_leads_opted_out`
- `idx_leads_org_id`
- `idx_leads_personalization`
- `idx_leads_phone`
- `idx_leads_status`
- `leads_pkey`

---
## Table: `managed_phone_numbers`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `subaccount_id` (uuid, NOT NULL)
- `phone_number` (text, NOT NULL)
- `twilio_phone_sid` (text, NOT NULL)
- `country_code` (text, NOT NULL, default: 'US'::text)
- `number_type` (text, NOT NULL, default: 'local'::text)
- `vapi_phone_id` (text, nullable)
- `vapi_credential_id` (text, nullable)
- `voice_enabled` (boolean, nullable, default: true)
- `sms_enabled` (boolean, nullable, default: true)
- `status` (text, NOT NULL, default: 'provisioning'::text)
- `monthly_cost_cents` (integer, NOT NULL, default: 150)
- `provisioned_at` (timestamp with time zone, nullable)
- `released_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `updated_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Unique Constraints:**
- `twilio_phone_sid`
- `org_id`
- `phone_number`

**Check Constraints:**
- 2200_124180_12_not_null: status IS NOT NULL
- 2200_124180_13_not_null: monthly_cost_cents IS NOT NULL
- 2200_124180_16_not_null: created_at IS NOT NULL
- 2200_124180_17_not_null: updated_at IS NOT NULL
- 2200_124180_1_not_null: id IS NOT NULL
- 2200_124180_2_not_null: org_id IS NOT NULL
- 2200_124180_3_not_null: subaccount_id IS NOT NULL
- 2200_124180_4_not_null: phone_number IS NOT NULL
- 2200_124180_5_not_null: twilio_phone_sid IS NOT NULL
- 2200_124180_6_not_null: country_code IS NOT NULL
- 2200_124180_7_not_null: number_type IS NOT NULL
- managed_phone_numbers_number_type_check: (number_type = ANY (ARRAY['local'::text, 'toll_free'::text, 'mobile'::text]))
- managed_phone_numbers_status_check: (status = ANY (ARRAY['provisioning'::text, 'active'::text, 'released'::text, 'failed'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)
- `subaccount_id` → `twilio_subaccounts.id` (ON DELETE: CASCADE)

**Indexes (8):**
- `idx_managed_numbers_active`
- `idx_managed_numbers_org`
- `idx_managed_numbers_phone`
- `idx_managed_numbers_subaccount`
- `idx_managed_numbers_vapi`
- `managed_phone_numbers_pkey`
- `managed_phone_numbers_twilio_phone_sid_key`
- `unique_phone_per_org`

---
## Table: `messages`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `contact_id` (uuid, nullable)
- `call_id` (uuid, nullable)
- `direction` (text, NOT NULL)
- `method` (text, NOT NULL)
- `recipient` (text, NOT NULL)
- `subject` (text, nullable)
- `content` (text, NOT NULL)
- `status` (text, NOT NULL, default: 'sent'::text)
- `error_message` (text, nullable)
- `service_provider` (text, nullable)
- `external_message_id` (text, nullable)
- `sent_at` (timestamp with time zone, nullable, default: now())
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id, id, inserted_at

**Check Constraints:**
- 2200_109941_10_not_null: status IS NOT NULL
- 2200_109941_1_not_null: id IS NOT NULL
- 2200_109941_2_not_null: org_id IS NOT NULL
- 2200_109941_5_not_null: direction IS NOT NULL
- 2200_109941_6_not_null: method IS NOT NULL
- 2200_109941_7_not_null: recipient IS NOT NULL
- 2200_109941_9_not_null: content IS NOT NULL
- messages_direction_check: (direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))
- messages_method_check: (method = ANY (ARRAY['sms'::text, 'email'::text]))
- messages_status_check: (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'bounced'::text]))

**Foreign Key Relationships:**
- `call_id` → `call_logs_legacy.id` (ON DELETE: SET NULL)
- `contact_id` → `contacts.id` (ON DELETE: SET NULL)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (9):**
- `idx_messages_call_id`
- `idx_messages_contact_id`
- `idx_messages_method`
- `idx_messages_org_contact_method`
- `idx_messages_org_id`
- `idx_messages_org_method_sent`
- `idx_messages_sent_at`
- `idx_messages_status`
- `messages_pkey`

---
## Table: `notifications`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `user_id` (uuid, NOT NULL)
- `type` (USER-DEFINED, NOT NULL)
- `title` (text, NOT NULL)
- `message` (text, NOT NULL)
- `related_entity_id` (uuid, nullable)
- `related_entity_type` (text, nullable)
- `status` (USER-DEFINED, nullable, default: 'unread'::notification_status)
- `read_at` (timestamp with time zone, nullable)
- `action_url` (text, nullable)
- `priority` (USER-DEFINED, nullable, default: 'normal'::notification_priority)
- `channels` (jsonb, nullable, default: '["in_app"]'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())
- `expires_at` (timestamp with time zone, nullable, default: (now() + '30 days'::interval))

**Primary Key:** id

**Check Constraints:**
- 2200_95431_1_not_null: id IS NOT NULL
- 2200_95431_2_not_null: org_id IS NOT NULL
- 2200_95431_3_not_null: user_id IS NOT NULL
- 2200_95431_4_not_null: type IS NOT NULL
- 2200_95431_5_not_null: title IS NOT NULL
- 2200_95431_6_not_null: message IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (6):**
- `idx_notifications_created_desc`
- `idx_notifications_entity`
- `idx_notifications_expires`
- `idx_notifications_org`
- `idx_notifications_user_unread`
- `notifications_pkey`

---
## Table: `onboarding_submissions`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `company_name` (text, NOT NULL)
- `user_email` (text, NOT NULL)
- `phone_number` (text, NOT NULL)
- `greeting_script` (text, NOT NULL)
- `pdf_url` (text, nullable)
- `status` (text, nullable, default: 'pending'::text)
- `assigned_to` (text, nullable)
- `notes` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `voice_preference` (text, nullable)
- `website` (text, nullable)
- `utm_source` (text, nullable)
- `utm_medium` (text, nullable)
- `utm_campaign` (text, nullable)
- `plan` (text, nullable)
- `time_to_complete_seconds` (integer, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_123031_1_not_null: id IS NOT NULL
- 2200_123031_2_not_null: company_name IS NOT NULL
- 2200_123031_3_not_null: user_email IS NOT NULL
- 2200_123031_4_not_null: phone_number IS NOT NULL
- 2200_123031_5_not_null: greeting_script IS NOT NULL
- voice_preference_valid: (voice_preference = ANY (ARRAY['AI (Neutral)'::text, 'Male Voice'::text, 'Female Voice'::text, NULL::text]))

**Indexes (2):**
- `idx_onboarding_submissions_status`
- `onboarding_submissions_pkey`

---
## Table: `org_credentials`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `provider` (text, NOT NULL)
- `encrypted_config` (text, NOT NULL)
- `is_active` (boolean, nullable, default: true)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `metadata` (jsonb, nullable)
- `last_verified_at` (timestamp with time zone, nullable)
- `connected_calendar_email` (text, nullable)
- `connected_email` (text, nullable)
- `verification_error` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `provider`

**Check Constraints:**
- 2200_98943_1_not_null: id IS NOT NULL
- 2200_98943_2_not_null: org_id IS NOT NULL
- 2200_98943_3_not_null: provider IS NOT NULL
- 2200_98943_4_not_null: encrypted_config IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: NO ACTION)

**Indexes (4):**
- `idx_org_credentials_lookup`
- `idx_org_credentials_metadata`
- `org_credentials_pkey`
- `unique_org_provider`

---
## Table: `org_feature_flags`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `flag_key` (text, NOT NULL)
- `enabled` (boolean, NOT NULL)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `flag_key`

**Check Constraints:**
- 2200_111436_1_not_null: id IS NOT NULL
- 2200_111436_2_not_null: org_id IS NOT NULL
- 2200_111436_3_not_null: flag_key IS NOT NULL
- 2200_111436_4_not_null: enabled IS NOT NULL

**Foreign Key Relationships:**
- `flag_key` → `feature_flags.flag_key` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `idx_org_feature_flags_enabled`
- `idx_org_feature_flags_flag_key`
- `idx_org_feature_flags_org_id`
- `org_feature_flags_org_id_flag_key_key`
- `org_feature_flags_pkey`

---
## Table: `org_settings`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `setting_key` (text, NOT NULL)
- `setting_value` (jsonb, NOT NULL)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `setting_key`

**Check Constraints:**
- 2200_103816_1_not_null: id IS NOT NULL
- 2200_103816_2_not_null: org_id IS NOT NULL
- 2200_103816_3_not_null: setting_key IS NOT NULL
- 2200_103816_4_not_null: setting_value IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (2):**
- `org_settings_org_id_setting_key_key`
- `org_settings_pkey`

---
## Table: `org_tools`
**Columns:**
- `id` (bigint, NOT NULL, default: nextval('org_tools_id_seq'::regclass))
- `org_id` (uuid, NOT NULL)
- `tool_name` (character varying, NOT NULL)
- `vapi_tool_id` (character varying, NOT NULL)
- `description` (text, nullable)
- `enabled` (boolean, nullable, default: true)
- `created_at` (timestamp without time zone, nullable, default: now())
- `updated_at` (timestamp without time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `tool_name`

**Check Constraints:**
- 2200_101227_1_not_null: id IS NOT NULL
- 2200_101227_2_not_null: org_id IS NOT NULL
- 2200_101227_3_not_null: tool_name IS NOT NULL
- 2200_101227_4_not_null: vapi_tool_id IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `idx_org_tools_org_id`
- `idx_org_tools_tool_name`
- `org_tools_org_id_tool_name_key`
- `org_tools_pkey`

---
## Table: `organizations`
**Columns:**
- `id` (uuid, NOT NULL, default: uuid_generate_v4())
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `name` (text, NOT NULL)
- `email` (text, NOT NULL)
- `phone_number` (text, nullable)
- `website` (text, nullable)
- `industry` (text, nullable)
- `plan` (text, nullable, default: 'starter'::text)
- `billing_status` (text, nullable, default: 'active'::text)
- `calls_this_month` (integer, nullable, default: 0)
- `minutes_this_month` (numeric, nullable, default: 0)
- `cost_this_month` (numeric, nullable, default: 0)
- `settings` (jsonb, nullable, default: '{}'::jsonb)
- `status` (text, NOT NULL, default: 'active'::text)
- `timezone` (text, nullable, default: 'UTC'::text)
- `vapi_assistant_id` (text, nullable)
- `vapi_phone_number_id` (text, nullable)
- `telephony_country` (text, nullable, default: 'US'::text)
- `assigned_twilio_number` (text, nullable)
- `forwarding_carrier` (text, nullable)
- `telephony_mode` (text, nullable, default: 'byoc'::text)
- `vapi_credential_id` (text, nullable)
- `wallet_balance_pence` (integer, nullable, default: 0)
- `wallet_low_balance_pence` (integer, nullable, default: 500)
- `wallet_auto_recharge` (boolean, nullable, default: false)
- `wallet_recharge_amount_pence` (integer, nullable, default: 5000)
- `wallet_markup_percent` (integer, nullable, default: 50)
- `stripe_default_pm_id` (text, nullable)
- `stripe_customer_id` (text, nullable)
- `debt_limit_pence` (integer, NOT NULL, default: 500)

**Primary Key:** id

**Unique Constraints:**
- `email`

**Check Constraints:**
- 2200_32782_15_not_null: status IS NOT NULL
- 2200_32782_1_not_null: id IS NOT NULL
- 2200_32782_31_not_null: debt_limit_pence IS NOT NULL
- 2200_32782_4_not_null: name IS NOT NULL
- 2200_32782_5_not_null: email IS NOT NULL
- organizations_billing_status_check: (billing_status = ANY (ARRAY['active'::text, 'past_due'::text, 'cancelled'::text, 'trial'::text]))
- organizations_plan_check: (plan = ANY (ARRAY['starter'::text, 'professional'::text, 'enterprise'::text, 'prepaid'::text]))
- organizations_telephony_mode_check: (telephony_mode = ANY (ARRAY['byoc'::text, 'managed'::text, 'none'::text]))
- valid_telephony_country_format: ((telephony_country IS NULL) OR (telephony_country ~ '^[A-Z]{2}$'::text))
- valid_twilio_number_format: ((assigned_twilio_number IS NULL) OR (assigned_twilio_number ~ '^\+[1-9]\d{1,14}$'::text))

**Indexes (11):**
- `idx_organizations_billing_status`
- `idx_organizations_carrier`
- `idx_organizations_email`
- `idx_organizations_telephony`
- `idx_organizations_telephony_country`
- `idx_organizations_telephony_mode`
- `idx_organizations_telephony_provisioned`
- `idx_organizations_vapi_credential`
- `idx_organizations_wallet_balance`
- `organizations_email_key`
- `organizations_pkey`

---
## Table: `orphaned_recordings`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `storage_path` (text, nullable)
- `detected_at` (timestamp without time zone, nullable, default: now())
- `deleted_at` (timestamp without time zone, nullable)
- `size_bytes` (bigint, nullable)

**Primary Key:** id

**Unique Constraints:**
- `storage_path`

**Check Constraints:**
- 2200_67146_1_not_null: id IS NOT NULL

**Indexes (6):**
- `idx_orphaned_recordings_cleanup_status`
- `idx_orphaned_recordings_deleted`
- `idx_orphaned_recordings_detected`
- `idx_orphaned_recordings_storage_path`
- `orphaned_recordings_pkey`
- `orphaned_recordings_storage_path_key`

---
## Table: `outbound_agent_config`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `vapi_api_key` (text, nullable)
- `vapi_assistant_id` (text, nullable)
- `twilio_account_sid` (text, nullable)
- `twilio_auth_token` (text, nullable)
- `twilio_phone_number` (text, nullable)
- `system_prompt` (text, nullable)
- `first_message` (text, nullable)
- `voice_id` (text, nullable, default: 'Paige'::text)
- `language` (text, nullable, default: 'en-US'::text)
- `max_call_duration` (integer, nullable, default: 600)
- `is_active` (boolean, nullable, default: true)
- `last_synced_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `vapi_phone_number_id` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `org_id`

**Check Constraints:**
- 2200_62459_1_not_null: id IS NOT NULL
- 2200_62459_2_not_null: org_id IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `idx_outbound_agent_config_is_active`
- `idx_outbound_agent_config_org_id`
- `idx_outbound_agent_config_vapi_phone_id`
- `outbound_agent_config_org_id_key`
- `outbound_agent_config_pkey`

---
## Table: `outreach_templates`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, nullable)
- `name` (text, NOT NULL)
- `subject` (text, NOT NULL)
- `body_html` (text, NOT NULL)
- `body_text` (text, nullable)
- `sequence_step` (integer, nullable)
- `persona_target` (text, nullable)
- `merge_tags` (jsonb, nullable, default: '[]'::jsonb)
- `is_active` (boolean, nullable, default: true)
- `send_delay_hours` (integer, nullable, default: 0)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_54591_1_not_null: id IS NOT NULL
- 2200_54591_3_not_null: name IS NOT NULL
- 2200_54591_4_not_null: subject IS NOT NULL
- 2200_54591_5_not_null: body_html IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: NO ACTION)

**Indexes (3):**
- `idx_outreach_templates_persona`
- `idx_outreach_templates_step`
- `outreach_templates_pkey`

---
## Table: `payment_events_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `event_type` (text, NOT NULL)
- `user_id` (uuid, nullable)
- `email` (text, nullable)
- `amount` (numeric, nullable)
- `currency` (text, nullable)
- `status` (text, nullable)
- `request_id` (text, nullable)
- `tx_ref` (text, nullable)
- `error_message` (text, nullable)
- `metadata` (jsonb, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_79448_1_not_null: id IS NOT NULL
- 2200_79448_2_not_null: event_type IS NOT NULL

**Indexes (2):**
- `idx_payment_events_log_tx_ref`
- `payment_events_log_pkey`

---
## Table: `phone_blacklist`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `phone` (character varying, NOT NULL)
- `reason` (character varying, nullable)
- `created_at` (timestamp without time zone, nullable, default: now())
- `created_by` (uuid, nullable)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `phone`

**Check Constraints:**
- 2200_57689_1_not_null: id IS NOT NULL
- 2200_57689_2_not_null: org_id IS NOT NULL
- 2200_57689_3_not_null: phone IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (3):**
- `idx_phone_blacklist_org_phone`
- `phone_blacklist_org_id_phone_key`
- `phone_blacklist_pkey`

---
## Table: `phone_numbers`
**Columns:**
- `id` (uuid, NOT NULL, default: uuid_generate_v4())
- `created_at` (timestamp with time zone, nullable, default: now())
- `phone_number` (text, NOT NULL)
- `phone_sid` (text, NOT NULL)
- `country` (text, nullable, default: 'US'::text)
- `area_code` (text, nullable)
- `locality` (text, nullable)
- `region` (text, nullable)
- `status` (text, nullable, default: 'active'::text)
- `voice_url` (text, nullable)
- `fallback_url` (text, nullable)
- `status_callback_url` (text, nullable)
- `monthly_cost` (numeric, nullable, default: 1.00)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)

**Primary Key:** id

**Unique Constraints:**
- `phone_sid`
- `phone_number`

**Check Constraints:**
- 2200_32804_1_not_null: id IS NOT NULL
- 2200_32804_3_not_null: phone_number IS NOT NULL
- 2200_32804_4_not_null: phone_sid IS NOT NULL
- phone_numbers_status_check: (status = ANY (ARRAY['active'::text, 'inactive'::text, 'released'::text]))

**Indexes (5):**
- `idx_phone_numbers_number`
- `idx_phone_numbers_status`
- `phone_numbers_phone_number_key`
- `phone_numbers_phone_sid_key`
- `phone_numbers_pkey`

---
## Table: `pipeline_stages`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `lead_id` (uuid, nullable)
- `stage` (text, NOT NULL)
- `entered_at` (timestamp with time zone, nullable, default: now())
- `exited_at` (timestamp with time zone, nullable)
- `days_in_stage` (integer, nullable)
- `notes` (text, nullable)
- `lost_reason` (text, nullable)
- `won_tier` (text, nullable)
- `won_mrr` (numeric, nullable)
- `won_setup_fee` (numeric, nullable)
- `metadata` (jsonb, nullable, default: '{}'::jsonb)
- `created_at` (timestamp with time zone, nullable, default: now())
- `org_id` (uuid, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_54571_1_not_null: id IS NOT NULL
- 2200_54571_3_not_null: stage IS NOT NULL
- pipeline_stages_stage_check: (stage = ANY (ARRAY['not_contacted'::text, 'contacted'::text, 'demo_sent'::text, 'demo_viewed'::text, 'meeting_booked'::text, 'meeting_held'::text, 'proposal_sent'::text, 'negotiating'::text, 'closed_won'::text, 'closed_lost'::text]))

**Foreign Key Relationships:**
- `lead_id` → `leads.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `idx_pipeline_stages_current`
- `idx_pipeline_stages_lead`
- `idx_pipeline_stages_stage`
- `pipeline_stages_pkey`

---
## Table: `processed_webhook_events`
**Columns:**
- `id` (bigint, NOT NULL, default: nextval('processed_webhook_events_id_seq'::regclass))
- `event_id` (text, NOT NULL)
- `call_id` (text, NOT NULL)
- `event_type` (text, NOT NULL)
- `received_at` (timestamp with time zone, nullable, default: now())
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `event_id`

**Check Constraints:**
- 2200_59331_1_not_null: id IS NOT NULL
- 2200_59331_2_not_null: event_id IS NOT NULL
- 2200_59331_3_not_null: call_id IS NOT NULL
- 2200_59331_4_not_null: event_type IS NOT NULL

**Indexes (5):**
- `idx_processed_events_call_id`
- `idx_processed_events_event_id`
- `idx_processed_events_received_at`
- `processed_webhook_events_event_id_key`
- `processed_webhook_events_pkey`

---
## Table: `profiles`
**Columns:**
- `id` (uuid, NOT NULL)
- `email` (text, NOT NULL)
- `org_id` (uuid, nullable)
- `role` (text, nullable, default: 'user'::text)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `full_name` (text, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_96572_1_not_null: id IS NOT NULL
- 2200_96572_2_not_null: email IS NOT NULL
- profiles_role_check: (role = ANY (ARRAY['owner'::text, 'admin'::text, 'user'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (2):**
- `idx_profiles_org_id`
- `profiles_pkey`

---
## Table: `recent_calls`
**Columns:**
- `id` (uuid, nullable)
- `call_sid` (text, nullable)
- `call_type` (text, nullable)
- `from_number` (text, nullable)
- `to_number` (text, nullable)
- `status` (text, nullable)
- `duration_seconds` (integer, nullable)
- `sentiment` (text, nullable)
- `booking_created` (boolean, nullable)
- `total_cost` (numeric, nullable)
- `created_at` (timestamp with time zone, nullable)

---
## Table: `recording_downloads`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `call_id` (uuid, nullable)
- `user_id` (uuid, nullable)
- `downloaded_at` (timestamp without time zone, nullable, default: now())
- `ip_address` (inet, nullable)
- `user_agent` (text, nullable)
- `download_duration_seconds` (integer, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_67106_1_not_null: id IS NOT NULL

**Foreign Key Relationships:**
- `call_id` → `call_logs_legacy.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `idx_recording_downloads_call_id`
- `idx_recording_downloads_downloaded_at`
- `idx_recording_downloads_user_id`
- `recording_downloads_pkey`

---
## Table: `recording_upload_metrics`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `call_id` (uuid, NOT NULL)
- `call_type` (text, NOT NULL)
- `status` (text, NOT NULL)
- `duration_ms` (integer, nullable)
- `file_size_bytes` (bigint, nullable)
- `error_message` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_69422_1_not_null: id IS NOT NULL
- 2200_69422_2_not_null: call_id IS NOT NULL
- 2200_69422_3_not_null: call_type IS NOT NULL
- 2200_69422_4_not_null: status IS NOT NULL
- recording_upload_metrics_call_type_check: (call_type = ANY (ARRAY['inbound'::text, 'outbound'::text]))
- recording_upload_metrics_status_check: (status = ANY (ARRAY['success'::text, 'failure'::text]))

**Foreign Key Relationships:**
- `call_id` → `call_logs_legacy.id` (ON DELETE: CASCADE)

**Indexes (3):**
- `idx_recording_metrics_created_at`
- `idx_recording_metrics_org_created`
- `recording_upload_metrics_pkey`

---
## Table: `recording_upload_queue`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `call_id` (uuid, NOT NULL)
- `vapi_call_id` (text, nullable)
- `org_id` (uuid, nullable)
- `recording_url` (text, NOT NULL)
- `call_type` (text, NOT NULL)
- `priority` (text, NOT NULL, default: 'normal'::text)
- `status` (text, NOT NULL, default: 'pending'::text)
- `error_message` (text, nullable)
- `attempt_count` (integer, nullable, default: 0)
- `max_attempts` (integer, nullable, default: 3)
- `processing_started_at` (timestamp without time zone, nullable)
- `completed_at` (timestamp without time zone, nullable)
- `last_error_at` (timestamp without time zone, nullable)
- `created_at` (timestamp without time zone, nullable, default: now())
- `updated_at` (timestamp without time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_69395_1_not_null: id IS NOT NULL
- 2200_69395_2_not_null: call_id IS NOT NULL
- 2200_69395_5_not_null: recording_url IS NOT NULL
- 2200_69395_6_not_null: call_type IS NOT NULL
- 2200_69395_7_not_null: priority IS NOT NULL
- 2200_69395_8_not_null: status IS NOT NULL
- recording_upload_queue_call_type_check: (call_type = ANY (ARRAY['inbound'::text, 'outbound'::text]))
- recording_upload_queue_priority_check: (priority = ANY (ARRAY['high'::text, 'normal'::text, 'low'::text]))
- recording_upload_queue_status_check: (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))

**Foreign Key Relationships:**
- `call_id` → `call_logs_legacy.id` (ON DELETE: CASCADE)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (3):**
- `idx_recording_upload_queue_locked_until`
- `idx_recording_upload_queue_status_priority`
- `recording_upload_queue_pkey`

---
## Table: `security_audit_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (text, NOT NULL)
- `user_id` (text, nullable)
- `action` (text, NOT NULL)
- `details` (jsonb, nullable)
- `ip_address` (text, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_100095_1_not_null: id IS NOT NULL
- 2200_100095_2_not_null: org_id IS NOT NULL
- 2200_100095_4_not_null: action IS NOT NULL

**Indexes (1):**
- `security_audit_log_pkey`

---
## Table: `services`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `name` (text, NOT NULL)
- `price` (numeric, NOT NULL, default: 0)
- `keywords` (ARRAY, NOT NULL, default: '{}'::text[])
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_109982_1_not_null: id IS NOT NULL
- 2200_109982_2_not_null: org_id IS NOT NULL
- 2200_109982_3_not_null: name IS NOT NULL
- 2200_109982_4_not_null: price IS NOT NULL
- 2200_109982_5_not_null: keywords IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `idx_services_keywords`
- `idx_services_org_created`
- `idx_services_org_id`
- `services_pkey`

---
## Table: `sms_delivery_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `job_id` (text, NOT NULL)
- `org_id` (uuid, NOT NULL)
- `recipient_phone` (text, NOT NULL)
- `message` (text, NOT NULL)
- `status` (text, NOT NULL)
- `attempt_number` (integer, NOT NULL, default: 1)
- `delivery_time_ms` (integer, nullable)
- `twilio_sid` (text, nullable)
- `error_message` (text, nullable)
- `metadata` (jsonb, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `updated_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Unique Constraints:**
- `job_id`

**Check Constraints:**
- 2200_117463_12_not_null: created_at IS NOT NULL
- 2200_117463_13_not_null: updated_at IS NOT NULL
- 2200_117463_1_not_null: id IS NOT NULL
- 2200_117463_2_not_null: job_id IS NOT NULL
- 2200_117463_3_not_null: org_id IS NOT NULL
- 2200_117463_4_not_null: recipient_phone IS NOT NULL
- 2200_117463_5_not_null: message IS NOT NULL
- 2200_117463_6_not_null: status IS NOT NULL
- 2200_117463_7_not_null: attempt_number IS NOT NULL
- sms_delivery_log_status_check: (status = ANY (ARRAY['processing'::text, 'delivered'::text, 'failed'::text, 'dead_letter'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (7):**
- `idx_sms_delivery_log_created_at`
- `idx_sms_delivery_log_failures`
- `idx_sms_delivery_log_job_id`
- `idx_sms_delivery_log_org_id`
- `idx_sms_delivery_log_status`
- `sms_delivery_log_job_id_key`
- `sms_delivery_log_pkey`

---
## Table: `telephony_country_audit_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `old_country` (text, nullable)
- `new_country` (text, NOT NULL)
- `changed_by` (uuid, nullable)
- `changed_at` (timestamp with time zone, NOT NULL, default: now())
- `ip_address` (text, nullable)
- `user_agent` (text, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_112723_1_not_null: id IS NOT NULL
- 2200_112723_2_not_null: org_id IS NOT NULL
- 2200_112723_4_not_null: new_country IS NOT NULL
- 2200_112723_6_not_null: changed_at IS NOT NULL

**Foreign Key Relationships:**
- `changed_by` → `profiles.id` (ON DELETE: NO ACTION)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (2):**
- `idx_telephony_audit_org_id`
- `telephony_country_audit_log_pkey`

---
## Table: `transfer_queue`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `call_id` (uuid, NOT NULL)
- `escalation_rule_id` (uuid, nullable)
- `from_agent_id` (uuid, nullable)
- `to_number` (text, NOT NULL)
- `reason` (text, NOT NULL)
- `trigger_data` (jsonb, nullable)
- `status` (text, nullable, default: 'pending'::text)
- `error_message` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: now())
- `completed_at` (timestamp without time zone, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_91724_1_not_null: id IS NOT NULL
- 2200_91724_2_not_null: org_id IS NOT NULL
- 2200_91724_3_not_null: call_id IS NOT NULL
- 2200_91724_6_not_null: to_number IS NOT NULL
- 2200_91724_7_not_null: reason IS NOT NULL
- transfer_queue_status_check: (status = ANY (ARRAY['pending'::text, 'initiated'::text, 'completed'::text, 'failed'::text]))

**Foreign Key Relationships:**
- `escalation_rule_id` → `escalation_rules.id` (ON DELETE: SET NULL)
- `from_agent_id` → `agents.id` (ON DELETE: SET NULL)
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (4):**
- `idx_transfer_queue_call`
- `idx_transfer_queue_rule`
- `idx_transfer_queue_status`
- `transfer_queue_pkey`

---
## Table: `twilio_subaccounts`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `twilio_account_sid` (text, NOT NULL)
- `twilio_auth_token_encrypted` (text, NOT NULL)
- `friendly_name` (text, NOT NULL)
- `status` (text, NOT NULL, default: 'active'::text)
- `a2p_brand_id` (text, nullable)
- `a2p_campaign_id` (text, nullable)
- `a2p_registration_status` (text, nullable, default: 'pending'::text)
- `shaken_stir_enabled` (boolean, nullable, default: false)
- `stripe_customer_id` (text, nullable)
- `monthly_number_cost_cents` (integer, nullable, default: 150)
- `created_at` (timestamp with time zone, NOT NULL, default: now())
- `updated_at` (timestamp with time zone, NOT NULL, default: now())
- `suspended_at` (timestamp with time zone, nullable)
- `closed_at` (timestamp with time zone, nullable)
- `suspension_reason` (text, nullable)

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `twilio_account_sid`

**Check Constraints:**
- 2200_124153_13_not_null: created_at IS NOT NULL
- 2200_124153_14_not_null: updated_at IS NOT NULL
- 2200_124153_1_not_null: id IS NOT NULL
- 2200_124153_2_not_null: org_id IS NOT NULL
- 2200_124153_3_not_null: twilio_account_sid IS NOT NULL
- 2200_124153_4_not_null: twilio_auth_token_encrypted IS NOT NULL
- 2200_124153_5_not_null: friendly_name IS NOT NULL
- 2200_124153_6_not_null: status IS NOT NULL
- twilio_subaccounts_a2p_registration_status_check: (a2p_registration_status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'not_required'::text]))
- twilio_subaccounts_status_check: (status = ANY (ARRAY['active'::text, 'suspended'::text, 'closed'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (5):**
- `idx_twilio_subaccounts_active`
- `idx_twilio_subaccounts_org_id`
- `one_subaccount_per_org`
- `twilio_subaccounts_pkey`
- `twilio_subaccounts_twilio_account_sid_key`

---
## Table: `user_org_roles`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `user_id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `role` (text, nullable, default: 'member'::text)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())
- `invited_by` (uuid, nullable)
- `invited_at` (timestamp without time zone, nullable, default: now())
- `accepted_at` (timestamp without time zone, nullable)

**Primary Key:** id

**Unique Constraints:**
- `user_id`
- `org_id`

**Check Constraints:**
- 2200_58000_1_not_null: id IS NOT NULL

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (6):**
- `idx_user_org_roles_org`
- `idx_user_org_roles_role`
- `idx_user_org_roles_user`
- `idx_user_org_roles_user_org`
- `user_org_roles_pkey`
- `user_org_roles_user_id_org_id_key`

---
## Table: `user_settings`
**Columns:**
- `user_id` (uuid, NOT NULL)
- `business_name` (text, nullable)
- `system_prompt` (text, nullable)
- `voice_personality` (text, nullable)
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** user_id

**Check Constraints:**
- 2200_59707_1_not_null: user_id IS NOT NULL
- user_settings_voice_personality_check: (voice_personality = ANY (ARRAY['professional'::text, 'friendly'::text, 'casual'::text]))

**Indexes (1):**
- `user_settings_pkey`

---
## Table: `vapi_webhook_reliability`
**Columns:**
- `date` (timestamp with time zone, nullable)
- `total_calls` (bigint, nullable)
- `reconciled_calls` (bigint, nullable)
- `webhook_calls` (bigint, nullable)
- `webhook_reliability_percentage` (numeric, nullable)

---
## Table: `verified_caller_ids`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `phone_number` (text, NOT NULL)
- `friendly_name` (text, nullable)
- `twilio_caller_id_sid` (text, nullable)
- `twilio_call_sid` (text, nullable)
- `status` (text, NOT NULL, default: 'pending'::text)
- `verification_code_hash` (text, nullable)
- `verification_code_expires_at` (timestamp with time zone, nullable)
- `verification_attempts` (integer, nullable, default: 0)
- `verified_at` (timestamp with time zone, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())
- `updated_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Unique Constraints:**
- `org_id`
- `phone_number`

**Check Constraints:**
- 2200_112746_1_not_null: id IS NOT NULL
- 2200_112746_2_not_null: org_id IS NOT NULL
- 2200_112746_3_not_null: phone_number IS NOT NULL
- 2200_112746_7_not_null: status IS NOT NULL
- max_verification_attempts: (verification_attempts <= 5)
- valid_phone_e164: (phone_number ~ '^\+[1-9]\d{6,14}$'::text)
- verified_caller_ids_status_check: (status = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text, 'expired'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: CASCADE)

**Indexes (6):**
- `idx_verified_caller_ids_org_status`
- `idx_verified_caller_ids_pending`
- `idx_verified_caller_ids_phone`
- `idx_verified_caller_ids_twilio_sid`
- `unique_org_phone`
- `verified_caller_ids_pkey`

---
## Table: `view_actionable_leads`
**Columns:**
- `id` (uuid, nullable)
- `org_id` (uuid, nullable)
- `phone` (text, nullable)
- `name` (text, nullable)
- `email` (text, nullable)
- `lead_status` (text, nullable)
- `lead_score` (integer, nullable)
- `created_at` (timestamp with time zone, nullable)
- `updated_at` (timestamp with time zone, nullable)
- `last_contacted_at` (timestamp with time zone, nullable)
- `days_since_contact` (numeric, nullable)
- `follow_up_overdue` (boolean, nullable)

---
## Table: `voice_sessions`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `user_id` (uuid, nullable)
- `started_at` (timestamp with time zone, nullable, default: now())
- `ended_at` (timestamp with time zone, nullable)
- `duration_seconds` (integer, nullable)
- `status` (text, nullable)

**Primary Key:** id

**Check Constraints:**
- 2200_59721_1_not_null: id IS NOT NULL

**Indexes (1):**
- `voice_sessions_pkey`

---
## Table: `voice_test_transcripts`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `session_id` (uuid, nullable)
- `user_id` (uuid, nullable)
- `role` (text, nullable)
- `content` (text, nullable)
- `timestamp` (timestamp with time zone, nullable, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_59735_1_not_null: id IS NOT NULL
- voice_test_transcripts_role_check: (role = ANY (ARRAY['user'::text, 'assistant'::text]))

**Foreign Key Relationships:**
- `session_id` → `voice_sessions.id` (ON DELETE: CASCADE)

**Indexes (1):**
- `voice_test_transcripts_pkey`

---
## Table: `webhook_delivery_log`
**Columns:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `org_id` (uuid, NOT NULL)
- `event_type` (text, NOT NULL)
- `event_id` (text, NOT NULL)
- `received_at` (timestamp with time zone, NOT NULL)
- `status` (text, NOT NULL)
- `attempts` (integer, NOT NULL, default: 0)
- `last_attempt_at` (timestamp with time zone, nullable)
- `completed_at` (timestamp with time zone, nullable)
- `error_message` (text, nullable)
- `job_id` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: now())

**Primary Key:** id

**Check Constraints:**
- 2200_111340_12_not_null: created_at IS NOT NULL
- 2200_111340_1_not_null: id IS NOT NULL
- 2200_111340_2_not_null: org_id IS NOT NULL
- 2200_111340_3_not_null: event_type IS NOT NULL
- 2200_111340_4_not_null: event_id IS NOT NULL
- 2200_111340_5_not_null: received_at IS NOT NULL
- 2200_111340_6_not_null: status IS NOT NULL
- 2200_111340_7_not_null: attempts IS NOT NULL
- webhook_delivery_log_status_check: (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'dead_letter'::text]))

**Foreign Key Relationships:**
- `org_id` → `organizations.id` (ON DELETE: NO ACTION)

**Indexes (9):**
- `idx_webhook_delivery_created_at`
- `idx_webhook_delivery_log_created_at`
- `idx_webhook_delivery_log_failed`
- `idx_webhook_delivery_log_job_id`
- `idx_webhook_delivery_log_org_id`
- `idx_webhook_delivery_log_status`
- `idx_webhook_delivery_org_id`
- `idx_webhook_delivery_status`
- `webhook_delivery_log_pkey`

---
## Table: `webhook_events`
**Columns:**
- `event_id` (text, NOT NULL)
- `event_type` (text, NOT NULL)
- `processed` (boolean, nullable, default: false)
- `processed_at` (timestamp with time zone, nullable)
- `payload` (jsonb, nullable)
- `created_at` (timestamp with time zone, nullable, default: now())

**Primary Key:** event_id

**Check Constraints:**
- 2200_79438_1_not_null: event_id IS NOT NULL
- 2200_79438_2_not_null: event_type IS NOT NULL

**Indexes (2):**
- `idx_webhook_events_processed`
- `webhook_events_pkey`

---