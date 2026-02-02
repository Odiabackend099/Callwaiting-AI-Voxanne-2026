export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          active: boolean | null
          allowed_idle_time_seconds: number | null
          average_rating: number | null
          created_at: string | null
          description: string | null
          faq: Json | null
          first_message: string | null
          functions: Json | null
          goodbye_phrases: string[] | null
          id: string
          initial_message: string | null
          integrations: Json | null
          interrupt_sensitivity: string | null
          is_active: boolean | null
          knowledge_base_ids: string[] | null
          knowledge_base_urls: string[] | null
          language: string | null
          max_call_duration: number | null
          max_tokens: number | null
          model: string | null
          name: string
          org_id: string | null
          organization_id: string | null
          prompt_synced_at: string | null
          prompt_syncing_at: string | null
          role: string | null
          settings: Json | null
          system_prompt: string
          temperature: number | null
          total_calls: number | null
          total_minutes: number | null
          updated_at: string | null
          vapi_assistant_id: string | null
          vapi_assistant_id_outbound: string | null
          vapi_phone_number_id: string | null
          voice: string | null
          voice_id: string | null
          voice_model: string | null
          voice_provider: string | null
        }
        Insert: {
          active?: boolean | null
          allowed_idle_time_seconds?: number | null
          average_rating?: number | null
          created_at?: string | null
          description?: string | null
          faq?: Json | null
          first_message?: string | null
          functions?: Json | null
          goodbye_phrases?: string[] | null
          id?: string
          initial_message?: string | null
          integrations?: Json | null
          interrupt_sensitivity?: string | null
          is_active?: boolean | null
          knowledge_base_ids?: string[] | null
          knowledge_base_urls?: string[] | null
          language?: string | null
          max_call_duration?: number | null
          max_tokens?: number | null
          model?: string | null
          name: string
          org_id?: string | null
          organization_id?: string | null
          prompt_synced_at?: string | null
          prompt_syncing_at?: string | null
          role?: string | null
          settings?: Json | null
          system_prompt: string
          temperature?: number | null
          total_calls?: number | null
          total_minutes?: number | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          vapi_assistant_id_outbound?: string | null
          vapi_phone_number_id?: string | null
          voice?: string | null
          voice_id?: string | null
          voice_model?: string | null
          voice_provider?: string | null
        }
        Update: {
          active?: boolean | null
          allowed_idle_time_seconds?: number | null
          average_rating?: number | null
          created_at?: string | null
          description?: string | null
          faq?: Json | null
          first_message?: string | null
          functions?: Json | null
          goodbye_phrases?: string[] | null
          id?: string
          initial_message?: string | null
          integrations?: Json | null
          interrupt_sensitivity?: string | null
          is_active?: boolean | null
          knowledge_base_ids?: string[] | null
          knowledge_base_urls?: string[] | null
          language?: string | null
          max_call_duration?: number | null
          max_tokens?: number | null
          model?: string | null
          name?: string
          org_id?: string | null
          organization_id?: string | null
          prompt_synced_at?: string | null
          prompt_syncing_at?: string | null
          role?: string | null
          settings?: Json | null
          system_prompt?: string
          temperature?: number | null
          total_calls?: number | null
          total_minutes?: number | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          vapi_assistant_id_outbound?: string | null
          vapi_phone_number_id?: string | null
          voice?: string | null
          voice_id?: string | null
          voice_model?: string | null
          voice_provider?: string | null
        }
        Relationships: []
      }
      appointment_holds: {
        Row: {
          appointment_id: string | null
          calendar_id: string
          call_sid: string
          created_at: string | null
          deleted_at: string | null
          expires_at: string
          id: string
          org_id: string
          otp_code: string | null
          otp_sent_at: string | null
          patient_name: string | null
          patient_phone: string | null
          slot_time: string
          status: string
          updated_at: string | null
          verification_attempts: number | null
        }
        Insert: {
          appointment_id?: string | null
          calendar_id: string
          call_sid: string
          created_at?: string | null
          deleted_at?: string | null
          expires_at: string
          id?: string
          org_id: string
          otp_code?: string | null
          otp_sent_at?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          slot_time: string
          status?: string
          updated_at?: string | null
          verification_attempts?: number | null
        }
        Update: {
          appointment_id?: string | null
          calendar_id?: string
          call_sid?: string
          created_at?: string | null
          deleted_at?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          otp_code?: string | null
          otp_sent_at?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          slot_time?: string
          status?: string
          updated_at?: string | null
          verification_attempts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_holds_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_holds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reservations: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          org_id: string
          patient_name: string | null
          patient_phone: string
          scheduled_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          org_id: string
          patient_name?: string | null
          patient_phone: string
          scheduled_at: string
          status: string
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          patient_name?: string | null
          patient_phone?: string
          scheduled_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reservations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          calendar_link: string | null
          confirmation_sent: boolean | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          duration_minutes: number | null
          google_calendar_event_id: string | null
          id: string
          org_id: string
          scheduled_at: string
          service_type: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Insert: {
          calendar_link?: string | null
          confirmation_sent?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
          id?: string
          org_id: string
          scheduled_at: string
          service_type: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Update: {
          calendar_link?: string | null
          confirmation_sent?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
          id?: string
          org_id?: string
          scheduled_at?: string
          service_type?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          org_id: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          org_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          org_id?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_log: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          org_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_sessions: {
        Row: {
          created_at: string | null
          device_type: string | null
          expires_at: string
          id: string
          ip_address: unknown
          last_activity_at: string | null
          location: string | null
          org_id: string
          revoked_at: string | null
          revoked_reason: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          last_activity_at?: string | null
          location?: string | null
          org_id: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          last_activity_at?: string | null
          location?: string | null
          org_id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_verification_log: {
        Row: {
          backup_age_hours: number | null
          backup_id: string | null
          backup_size_mb: number | null
          checks_failed: number
          checks_passed: number
          created_at: string
          error_details: Json | null
          id: string
          status: string
          verification_details: Json | null
          verified_at: string
        }
        Insert: {
          backup_age_hours?: number | null
          backup_id?: string | null
          backup_size_mb?: number | null
          checks_failed?: number
          checks_passed?: number
          created_at?: string
          error_details?: Json | null
          id?: string
          status: string
          verification_details?: Json | null
          verified_at?: string
        }
        Update: {
          backup_age_hours?: number | null
          backup_id?: string | null
          backup_size_mb?: number | null
          checks_failed?: number
          checks_passed?: number
          created_at?: string
          error_details?: Json | null
          id?: string
          status?: string
          verification_details?: Json | null
          verified_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          calendar_event_id: string | null
          confirmation_token: string | null
          created_at: string
          created_by: string
          end_time: string
          id: string
          notes: string | null
          org_id: string
          patient_confirmed_at: string | null
          patient_email: string
          provider_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          confirmation_token?: string | null
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          notes?: string | null
          org_id: string
          patient_confirmed_at?: string | null
          patient_email: string
          provider_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          confirmation_token?: string | null
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          notes?: string | null
          org_id?: string
          patient_confirmed_at?: string | null
          patient_email?: string
          provider_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs_legacy: {
        Row: {
          agent_name: string | null
          booking_created: boolean | null
          call_sid: string
          call_type: string | null
          created_at: string | null
          deepgram_cost: number | null
          duration_seconds: number | null
          end_time: string | null
          ended_at: string | null
          error_message: string | null
          from_number: string | null
          groq_cost: number | null
          id: string
          intent: string | null
          lead_id: string | null
          metadata: Json | null
          org_id: string
          outcome: string | null
          outcome_summary: string | null
          recording_duration: number | null
          recording_duration_seconds: number | null
          recording_format: string | null
          recording_signed_url: string | null
          recording_signed_url_expires_at: string | null
          recording_size_bytes: number | null
          recording_status: string | null
          recording_storage_path: string | null
          recording_uploaded_at: string | null
          recording_url: string | null
          sentiment: string | null
          start_time: string | null
          started_at: string | null
          status: string | null
          tags: string[] | null
          to_number: string | null
          total_cost: number | null
          transcript: string | null
          transcript_only_fallback: boolean | null
          transcript_text: string | null
          transfer_reason: string | null
          transfer_requested: boolean | null
          transfer_time: string | null
          transfer_to: string | null
          twilio_cost: number | null
          updated_at: string | null
          vapi_call_id: string | null
        }
        Insert: {
          agent_name?: string | null
          booking_created?: boolean | null
          call_sid: string
          call_type?: string | null
          created_at?: string | null
          deepgram_cost?: number | null
          duration_seconds?: number | null
          end_time?: string | null
          ended_at?: string | null
          error_message?: string | null
          from_number?: string | null
          groq_cost?: number | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          metadata?: Json | null
          org_id: string
          outcome?: string | null
          outcome_summary?: string | null
          recording_duration?: number | null
          recording_duration_seconds?: number | null
          recording_format?: string | null
          recording_signed_url?: string | null
          recording_signed_url_expires_at?: string | null
          recording_size_bytes?: number | null
          recording_status?: string | null
          recording_storage_path?: string | null
          recording_uploaded_at?: string | null
          recording_url?: string | null
          sentiment?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          to_number?: string | null
          total_cost?: number | null
          transcript?: string | null
          transcript_only_fallback?: boolean | null
          transcript_text?: string | null
          transfer_reason?: string | null
          transfer_requested?: boolean | null
          transfer_time?: string | null
          transfer_to?: string | null
          twilio_cost?: number | null
          updated_at?: string | null
          vapi_call_id?: string | null
        }
        Update: {
          agent_name?: string | null
          booking_created?: boolean | null
          call_sid?: string
          call_type?: string | null
          created_at?: string | null
          deepgram_cost?: number | null
          duration_seconds?: number | null
          end_time?: string | null
          ended_at?: string | null
          error_message?: string | null
          from_number?: string | null
          groq_cost?: number | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          metadata?: Json | null
          org_id?: string
          outcome?: string | null
          outcome_summary?: string | null
          recording_duration?: number | null
          recording_duration_seconds?: number | null
          recording_format?: string | null
          recording_signed_url?: string | null
          recording_signed_url_expires_at?: string | null
          recording_size_bytes?: number | null
          recording_status?: string | null
          recording_storage_path?: string | null
          recording_uploaded_at?: string | null
          recording_url?: string | null
          sentiment?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          tags?: string[] | null
          to_number?: string | null
          total_cost?: number | null
          transcript?: string | null
          transcript_only_fallback?: boolean | null
          transcript_text?: string | null
          transfer_reason?: string | null
          transfer_requested?: boolean | null
          transfer_time?: string | null
          transfer_to?: string | null
          twilio_cost?: number | null
          updated_at?: string | null
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_logs_org_id"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_tracking: {
        Row: {
          agent_id: string | null
          answered: boolean | null
          call_notes: string | null
          call_outcome: string | null
          called_at: string | null
          created_at: string | null
          demo_sent: boolean | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          meeting_booked: boolean | null
          metadata: Json | null
          org_id: string | null
          phone: string | null
          sentiment: string | null
          sequence_id: string | null
          started_at: string | null
          status: string | null
          transcript: string | null
          vapi_call_id: string | null
          voicemail: boolean | null
        }
        Insert: {
          agent_id?: string | null
          answered?: boolean | null
          call_notes?: string | null
          call_outcome?: string | null
          called_at?: string | null
          created_at?: string | null
          demo_sent?: boolean | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          meeting_booked?: boolean | null
          metadata?: Json | null
          org_id?: string | null
          phone?: string | null
          sentiment?: string | null
          sequence_id?: string | null
          started_at?: string | null
          status?: string | null
          transcript?: string | null
          vapi_call_id?: string | null
          voicemail?: boolean | null
        }
        Update: {
          agent_id?: string | null
          answered?: boolean | null
          call_notes?: string | null
          call_outcome?: string | null
          called_at?: string | null
          created_at?: string | null
          demo_sent?: boolean | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          meeting_booked?: boolean | null
          metadata?: Json | null
          org_id?: string | null
          phone?: string | null
          sentiment?: string | null
          sequence_id?: string | null
          started_at?: string | null
          status?: string | null
          transcript?: string | null
          vapi_call_id?: string | null
          voicemail?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_tracking_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tracking_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tracking_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tracking_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "campaign_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string | null
          created_at: string | null
          id: string
          org_id: string
          speaker: string
          text: string
          timestamp: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          speaker: string
          text: string
          timestamp?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          speaker?: string
          text?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_direction: string
          call_sid: string | null
          call_type: string
          contact_id: string | null
          created_at: string
          duration_seconds: number | null
          end_time: string | null
          from_number: string | null
          id: string
          intent: string | null
          metadata: Json | null
          notes: string | null
          org_id: string
          outcome: string | null
          outcome_summary: string | null
          recording_storage_path: string | null
          recording_url: string | null
          sentiment: string | null
          start_time: string | null
          status: string | null
          to_number: string | null
          transcript: string | null
          transcript_text: string | null
          updated_at: string
          vapi_call_id: string
        }
        Insert: {
          call_direction: string
          call_sid?: string | null
          call_type?: string
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          from_number?: string | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          notes?: string | null
          org_id: string
          outcome?: string | null
          outcome_summary?: string | null
          recording_storage_path?: string | null
          recording_url?: string | null
          sentiment?: string | null
          start_time?: string | null
          status?: string | null
          to_number?: string | null
          transcript?: string | null
          transcript_text?: string | null
          updated_at?: string
          vapi_call_id: string
        }
        Update: {
          call_direction?: string
          call_sid?: string | null
          call_type?: string
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_time?: string | null
          from_number?: string | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          notes?: string | null
          org_id?: string
          outcome?: string | null
          outcome_summary?: string | null
          recording_storage_path?: string | null
          recording_url?: string | null
          sentiment?: string | null
          start_time?: string | null
          status?: string | null
          to_number?: string | null
          transcript?: string | null
          transcript_text?: string | null
          updated_at?: string
          vapi_call_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_unified_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_unified_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          calls_answered: number | null
          calls_made: number | null
          calls_voicemail: number | null
          created_at: string | null
          deals_closed: number | null
          demos_sent: number | null
          demos_viewed: number | null
          emails_bounced: number | null
          emails_clicked: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          id: string
          meetings_booked: number | null
          meetings_held: number | null
          metric_date: string
          mrr_added: number | null
          org_id: string | null
          setup_fees_collected: number | null
          tier: string | null
        }
        Insert: {
          calls_answered?: number | null
          calls_made?: number | null
          calls_voicemail?: number | null
          created_at?: string | null
          deals_closed?: number | null
          demos_sent?: number | null
          demos_viewed?: number | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          meetings_held?: number | null
          metric_date: string
          mrr_added?: number | null
          org_id?: string | null
          setup_fees_collected?: number | null
          tier?: string | null
        }
        Update: {
          calls_answered?: number | null
          calls_made?: number | null
          calls_voicemail?: number | null
          created_at?: string | null
          deals_closed?: number | null
          demos_sent?: number | null
          demos_viewed?: number | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          meetings_held?: number | null
          metric_date?: string
          mrr_added?: number | null
          org_id?: string | null
          setup_fees_collected?: number | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sequences: {
        Row: {
          created_at: string | null
          current_step: number | null
          id: string
          last_contact_at: string | null
          lead_id: string | null
          next_action: string | null
          next_contact_at: string | null
          org_id: string | null
          sequence_name: string
          status: string | null
          total_steps: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step?: number | null
          id?: string
          last_contact_at?: string | null
          lead_id?: string | null
          next_action?: string | null
          next_contact_at?: string | null
          org_id?: string | null
          sequence_name: string
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step?: number | null
          id?: string
          last_contact_at?: string | null
          lead_id?: string | null
          next_action?: string | null
          next_contact_at?: string | null
          org_id?: string | null
          sequence_name?: string
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          assistant_profile_id: string | null
          calls_completed: number | null
          created_at: string | null
          email_template_id: string | null
          emails_sent: number | null
          filters: Json | null
          id: string
          lead_count: number | null
          name: string
          org_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assistant_profile_id?: string | null
          calls_completed?: number | null
          created_at?: string | null
          email_template_id?: string | null
          emails_sent?: number | null
          filters?: Json | null
          id?: string
          lead_count?: number | null
          name: string
          org_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assistant_profile_id?: string | null
          calls_completed?: number | null
          created_at?: string | null
          email_template_id?: string | null
          emails_sent?: number | null
          filters?: Json | null
          id?: string
          lead_count?: number | null
          name?: string
          org_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      carrier_forwarding_rules: {
        Row: {
          avg_latency_ms: number | null
          carrier_codes: Json
          country_code: string
          country_name: string
          created_at: string | null
          forwarding_cost_estimate: string | null
          id: string
          is_active: boolean | null
          recommended_twilio_country: string
          setup_notes: string | null
          updated_at: string | null
          warning_message: string | null
        }
        Insert: {
          avg_latency_ms?: number | null
          carrier_codes: Json
          country_code: string
          country_name: string
          created_at?: string | null
          forwarding_cost_estimate?: string | null
          id?: string
          is_active?: boolean | null
          recommended_twilio_country: string
          setup_notes?: string | null
          updated_at?: string | null
          warning_message?: string | null
        }
        Update: {
          avg_latency_ms?: number | null
          carrier_codes?: Json
          country_code?: string
          country_name?: string
          created_at?: string | null
          forwarding_cost_estimate?: string | null
          id?: string
          is_active?: boolean | null
          recommended_twilio_country?: string
          setup_notes?: string | null
          updated_at?: string | null
          warning_message?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          booking_source: string | null
          created_at: string | null
          email: string | null
          id: string
          last_contacted_at: string | null
          lead_score: number | null
          lead_status: string | null
          metadata: Json | null
          name: string
          notes: string | null
          org_id: string
          phone: string
          service_interests: string[] | null
          updated_at: string | null
        }
        Insert: {
          booking_source?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_score?: number | null
          lead_status?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          org_id: string
          phone: string
          service_interests?: string[] | null
          updated_at?: string | null
        }
        Update: {
          booking_source?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_score?: number | null
          lead_status?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string
          service_interests?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      demo_assets: {
        Row: {
          active: boolean | null
          asset_type: string
          created_at: string | null
          demo_type: string
          description: string | null
          id: string
          name: string
          org_id: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          asset_type: string
          created_at?: string | null
          demo_type: string
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          asset_type?: string
          created_at?: string | null
          demo_type?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          url?: string
        }
        Relationships: []
      }
      demo_bookings: {
        Row: {
          agent_id: string | null
          call_id: string | null
          clinic_name: string | null
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          org_id: string | null
          preferred_time_window: string | null
          prospect_email: string | null
          prospect_name: string
          prospect_phone: string | null
          sms_sent: boolean | null
          sms_sent_at: string | null
          status: string | null
          timezone: string | null
          whatsapp_sent: boolean | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          agent_id?: string | null
          call_id?: string | null
          clinic_name?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          org_id?: string | null
          preferred_time_window?: string | null
          prospect_email?: string | null
          prospect_name: string
          prospect_phone?: string | null
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          status?: string | null
          timezone?: string | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          agent_id?: string | null
          call_id?: string | null
          clinic_name?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          org_id?: string | null
          preferred_time_window?: string | null
          prospect_email?: string | null
          prospect_name?: string
          prospect_phone?: string | null
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          status?: string | null
          timezone?: string | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Relationships: []
      }
      demo_send_log: {
        Row: {
          asset_id: string | null
          channel: string | null
          created_at: string | null
          demo_booking_id: string | null
          demo_url: string | null
          id: string
          org_id: string | null
          recipient_address: string | null
          status: string | null
        }
        Insert: {
          asset_id?: string | null
          channel?: string | null
          created_at?: string | null
          demo_booking_id?: string | null
          demo_url?: string | null
          id?: string
          org_id?: string | null
          recipient_address?: string | null
          status?: string | null
        }
        Update: {
          asset_id?: string | null
          channel?: string | null
          created_at?: string | null
          demo_booking_id?: string | null
          demo_url?: string | null
          id?: string
          org_id?: string | null
          recipient_address?: string | null
          status?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          created_at: string | null
          error_message: string | null
          from_email: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          opened_at: string | null
          org_id: string | null
          provider: string | null
          provider_message_id: string | null
          status: string
          subject: string | null
          template_id: string | null
          to_email: string | null
          tracking_id: string | null
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          from_email?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          org_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          status: string
          subject?: string | null
          template_id?: string | null
          to_email?: string | null
          tracking_id?: string | null
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          error_message?: string | null
          from_email?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          org_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          to_email?: string | null
          tracking_id?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string | null
          html_body: string
          id: string
          is_active: boolean | null
          name: string
          org_id: string | null
          subject: string
          text_body: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          html_body: string
          id?: string
          is_active?: boolean | null
          name: string
          org_id?: string | null
          subject: string
          text_body?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          html_body?: string
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string | null
          subject?: string
          text_body?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      email_tracking: {
        Row: {
          bounce_reason: string | null
          bounced: boolean | null
          cc_email: string | null
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          demo_link_clicked: boolean | null
          email_subject: string
          email_variant: string | null
          from_email: string
          id: string
          lead_id: string | null
          metadata: Json | null
          opened_at: string | null
          org_id: string | null
          replied_at: string | null
          resend_message_id: string | null
          sent_at: string | null
          sequence_id: string | null
          spam_complaint: boolean | null
          to_email: string
          tracking_pixel_id: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounced?: boolean | null
          cc_email?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          demo_link_clicked?: boolean | null
          email_subject: string
          email_variant?: string | null
          from_email: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          org_id?: string | null
          replied_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          spam_complaint?: boolean | null
          to_email: string
          tracking_pixel_id?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounced?: boolean | null
          cc_email?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          demo_link_clicked?: boolean | null
          email_subject?: string
          email_variant?: string | null
          from_email?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          org_id?: string | null
          replied_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          spam_complaint?: boolean | null
          to_email?: string
          tracking_pixel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "campaign_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          agent_id: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          org_id: string
          priority: number | null
          transfer_number: string
          transfer_type: string | null
          trigger_type: string
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          org_id: string
          priority?: number | null
          transfer_number: string
          transfer_type?: string | null
          trigger_type: string
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          org_id?: string
          priority?: number | null
          transfer_number?: string
          transfer_type?: string | null
          trigger_type?: string
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_recording_uploads: {
        Row: {
          call_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          next_retry_at: string | null
          resolved_at: string | null
          retry_count: number | null
          vapi_recording_url: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          vapi_recording_url?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          vapi_recording_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_recording_uploads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_recording_uploads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "recent_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          flag_key: string
          id: string
          new_value: Json | null
          org_id: string | null
          previous_value: Json | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          flag_key: string
          id?: string
          new_value?: Json | null
          org_id?: string | null
          previous_value?: Json | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          flag_key?: string
          id?: string
          new_value?: Json | null
          org_id?: string | null
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled_globally: boolean | null
          flag_key: string
          flag_name: string
          id: string
          rollout_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled_globally?: boolean | null
          flag_key: string
          flag_name: string
          id?: string
          rollout_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled_globally?: boolean | null
          flag_key?: string
          flag_name?: string
          id?: string
          rollout_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      follow_up_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string
          metadata: Json | null
          org_id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          scheduled_for: string
          service_context: string
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          org_id: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          scheduled_for: string
          service_context: string
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          org_id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          scheduled_for?: string
          service_context?: string
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hallucination_flags: {
        Row: {
          agent_id: string | null
          call_id: string | null
          confidence_score: number | null
          created_at: string
          flagged_claim: string | null
          id: string
          knowledge_base_search_result: string | null
          org_id: string
          status: string
          transcript: string | null
        }
        Insert: {
          agent_id?: string | null
          call_id?: string | null
          confidence_score?: number | null
          created_at?: string
          flagged_claim?: string | null
          id?: string
          knowledge_base_search_result?: string | null
          org_id: string
          status?: string
          transcript?: string | null
        }
        Update: {
          agent_id?: string | null
          call_id?: string | null
          confidence_score?: number | null
          created_at?: string
          flagged_claim?: string | null
          id?: string
          knowledge_base_search_result?: string | null
          org_id?: string
          status?: string
          transcript?: string | null
        }
        Relationships: []
      }
      hot_lead_alerts: {
        Row: {
          alert_sent_at: string | null
          call_id: string
          created_at: string | null
          id: string
          lead_name: string
          lead_phone: string
          lead_score: number | null
          org_id: string
          service_interest: string | null
          sms_message_id: string | null
          summary: string | null
          urgency_level: string | null
        }
        Insert: {
          alert_sent_at?: string | null
          call_id: string
          created_at?: string | null
          id?: string
          lead_name: string
          lead_phone: string
          lead_score?: number | null
          org_id: string
          service_interest?: string | null
          sms_message_id?: string | null
          summary?: string | null
          urgency_level?: string | null
        }
        Update: {
          alert_sent_at?: string | null
          call_id?: string
          created_at?: string | null
          id?: string
          lead_name?: string
          lead_phone?: string
          lead_score?: number | null
          org_id?: string
          service_interest?: string | null
          sms_message_id?: string | null
          summary?: string | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hot_lead_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_leads: {
        Row: {
          ai_response: string | null
          detected_at: string | null
          followed_up: boolean | null
          followed_up_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          notes: string | null
          org_id: string | null
          original_message: string | null
          signal_type: string | null
          source: string | null
        }
        Insert: {
          ai_response?: string | null
          detected_at?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          notes?: string | null
          org_id?: string | null
          original_message?: string | null
          signal_type?: string | null
          source?: string | null
        }
        Update: {
          ai_response?: string | null
          detected_at?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          notes?: string | null
          org_id?: string | null
          original_message?: string | null
          signal_type?: string | null
          source?: string | null
        }
        Relationships: []
      }
      hybrid_forwarding_configs: {
        Row: {
          carrier: string
          carrier_country_code: string | null
          carrier_name: string | null
          confirmed_at: string | null
          country_code: string | null
          created_at: string | null
          forwarding_type: string
          generated_activation_code: string | null
          generated_deactivation_code: string | null
          id: string
          org_id: string
          ring_time_seconds: number | null
          sim_phone_number: string
          status: string
          twilio_forwarding_number: string
          updated_at: string | null
          user_confirmed_setup: boolean | null
          verified_caller_id: string
        }
        Insert: {
          carrier: string
          carrier_country_code?: string | null
          carrier_name?: string | null
          confirmed_at?: string | null
          country_code?: string | null
          created_at?: string | null
          forwarding_type: string
          generated_activation_code?: string | null
          generated_deactivation_code?: string | null
          id?: string
          org_id: string
          ring_time_seconds?: number | null
          sim_phone_number: string
          status?: string
          twilio_forwarding_number: string
          updated_at?: string | null
          user_confirmed_setup?: boolean | null
          verified_caller_id: string
        }
        Update: {
          carrier?: string
          carrier_country_code?: string | null
          carrier_name?: string | null
          confirmed_at?: string | null
          country_code?: string | null
          created_at?: string | null
          forwarding_type?: string
          generated_activation_code?: string | null
          generated_deactivation_code?: string | null
          id?: string
          org_id?: string
          ring_time_seconds?: number | null
          sim_phone_number?: string
          status?: string
          twilio_forwarding_number?: string
          updated_at?: string | null
          user_confirmed_setup?: boolean | null
          verified_caller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hybrid_forwarding_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hybrid_forwarding_configs_verified_caller_id_fkey"
            columns: ["verified_caller_id"]
            isOneToOne: false
            referencedRelation: "verified_caller_ids"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          created_at: string | null
          error_message: string
          error_type: string
          field_name: string | null
          id: string
          import_id: string
          org_id: string
          raw_data: Json | null
          row_number: number
        }
        Insert: {
          created_at?: string | null
          error_message: string
          error_type: string
          field_name?: string | null
          id?: string
          import_id: string
          org_id: string
          raw_data?: Json | null
          row_number: number
        }
        Update: {
          created_at?: string | null
          error_message?: string
          error_type?: string
          field_name?: string | null
          id?: string
          import_id?: string
          org_id?: string
          raw_data?: Json | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          column_mapping: Json | null
          completed_at: string | null
          created_at: string | null
          created_count: number | null
          dedupe_mode: string | null
          error_message: string | null
          failed_count: number | null
          file_path: string | null
          file_size_bytes: number | null
          filename: string
          id: string
          org_id: string
          processed_rows: number | null
          skipped_count: number | null
          started_at: string | null
          status: string
          total_rows: number | null
          updated_at: string | null
          updated_count: number | null
          uploaded_by: string | null
          uploaded_ip: string | null
        }
        Insert: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_count?: number | null
          dedupe_mode?: string | null
          error_message?: string | null
          failed_count?: number | null
          file_path?: string | null
          file_size_bytes?: number | null
          filename: string
          id?: string
          org_id: string
          processed_rows?: number | null
          skipped_count?: number | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
          updated_at?: string | null
          updated_count?: number | null
          uploaded_by?: string | null
          uploaded_ip?: string | null
        }
        Update: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_count?: number | null
          dedupe_mode?: string | null
          error_message?: string | null
          failed_count?: number | null
          file_path?: string | null
          file_size_bytes?: number | null
          filename?: string
          id?: string
          org_id?: string
          processed_rows?: number | null
          skipped_count?: number | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
          updated_at?: string | null
          updated_count?: number | null
          uploaded_by?: string | null
          uploaded_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_agent_config: {
        Row: {
          created_at: string | null
          first_message: string | null
          id: string
          is_active: boolean | null
          language: string | null
          last_synced_at: string | null
          max_call_duration: number | null
          org_id: string
          system_prompt: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          updated_at: string | null
          vapi_api_key: string | null
          vapi_assistant_id: string | null
          vapi_phone_number_id: string | null
          voice_id: string | null
        }
        Insert: {
          created_at?: string | null
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_synced_at?: string | null
          max_call_duration?: number | null
          org_id: string
          system_prompt?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string | null
          vapi_api_key?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          voice_id?: string | null
        }
        Update: {
          created_at?: string | null
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_synced_at?: string | null
          max_call_duration?: number | null
          org_id?: string
          system_prompt?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string | null
          vapi_api_key?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_agent_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          created_at: string | null
          hot_lead_alert_phone: string | null
          id: number
          last_verified_at: string | null
          org_id: string
          test_destination_number: string | null
          transfer_departments: Json | null
          transfer_phone_number: string | null
          transfer_sip_uri: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_from_number: string | null
          updated_at: string | null
          vapi_api_key: string | null
          vapi_webhook_secret: string | null
        }
        Insert: {
          created_at?: string | null
          hot_lead_alert_phone?: string | null
          id?: number
          last_verified_at?: string | null
          org_id: string
          test_destination_number?: string | null
          transfer_departments?: Json | null
          transfer_phone_number?: string | null
          transfer_sip_uri?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_from_number?: string | null
          updated_at?: string | null
          vapi_api_key?: string | null
          vapi_webhook_secret?: string | null
        }
        Update: {
          created_at?: string | null
          hot_lead_alert_phone?: string | null
          id?: number
          last_verified_at?: string | null
          org_id?: string
          test_destination_number?: string | null
          transfer_departments?: Json | null
          transfer_phone_number?: string | null
          transfer_sip_uri?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_from_number?: string | null
          updated_at?: string | null
          vapi_api_key?: string | null
          vapi_webhook_secret?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json | null
          connected: boolean | null
          created_at: string | null
          encrypted: boolean | null
          encrypted_config: string | null
          id: string
          last_checked_at: string | null
          org_id: string | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          connected?: boolean | null
          created_at?: string | null
          encrypted?: boolean | null
          encrypted_config?: string | null
          id?: string
          last_checked_at?: string | null
          org_id?: string | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          connected?: boolean | null
          created_at?: string | null
          encrypted?: boolean | null
          encrypted_config?: string | null
          id?: string
          last_checked_at?: string | null
          org_id?: string | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kb_sync_log: {
        Row: {
          assistants_updated: number | null
          created_at: string
          docs_synced: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          org_id: string
          status: string
          tool_id: string | null
        }
        Insert: {
          assistants_updated?: number | null
          created_at?: string
          docs_synced?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          org_id: string
          status?: string
          tool_id?: string | null
        }
        Update: {
          assistants_updated?: number | null
          created_at?: string
          docs_synced?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          org_id?: string
          status?: string
          tool_id?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          active: boolean
          category: string
          chunk_count: number | null
          content: string
          created_at: string
          embedding_status: string | null
          filename: string
          id: string
          is_chunked: boolean | null
          metadata: Json
          org_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          category?: string
          chunk_count?: number | null
          content: string
          created_at?: string
          embedding_status?: string | null
          filename: string
          id?: string
          is_chunked?: boolean | null
          metadata?: Json
          org_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          category?: string
          chunk_count?: number | null
          content?: string
          created_at?: string
          embedding_status?: string | null
          filename?: string
          id?: string
          is_chunked?: boolean | null
          metadata?: Json
          org_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      knowledge_base_changelog: {
        Row: {
          change_summary: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          knowledge_base_id: string
          new_content: string | null
          org_id: string
          previous_content: string | null
          version_from: number | null
          version_to: number | null
        }
        Insert: {
          change_summary?: string | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          knowledge_base_id: string
          new_content?: string | null
          org_id: string
          previous_content?: string | null
          version_from?: number | null
          version_to?: number | null
        }
        Update: {
          change_summary?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          knowledge_base_id?: string
          new_content?: string | null
          org_id?: string
          previous_content?: string | null
          version_from?: number | null
          version_to?: number | null
        }
        Relationships: []
      }
      knowledge_base_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          knowledge_base_id: string
          org_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          knowledge_base_id: string
          org_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          knowledge_base_id?: string
          org_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_chunks_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_chunks_backup_20260128: {
        Row: {
          chunk_index: number | null
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string | null
          knowledge_base_id: string | null
          org_id: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          knowledge_base_id?: string | null
          org_id?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          knowledge_base_id?: string | null
          org_id?: string | null
          token_count?: number | null
        }
        Relationships: []
      }
      knowledge_base_chunks_backup_20260128_manual: {
        Row: {
          chunk_index: number | null
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string | null
          knowledge_base_id: string | null
          org_id: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          knowledge_base_id?: string | null
          org_id?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          knowledge_base_id?: string | null
          org_id?: string | null
          token_count?: number | null
        }
        Relationships: []
      }
      knowledge_base_chunks_backup_20260128_v2: {
        Row: {
          chunk_index: number | null
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string | null
          knowledge_base_id: string | null
          org_id: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          knowledge_base_id?: string | null
          org_id?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string | null
          knowledge_base_id?: string | null
          org_id?: string | null
          token_count?: number | null
        }
        Relationships: []
      }
      lead_scores: {
        Row: {
          created_at: string | null
          engagement_score: number | null
          geography_score: number | null
          id: string
          lead_id: string | null
          org_id: string | null
          persona_score: number | null
          priority_tier: string | null
          scoring_notes: string | null
          total_score: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          engagement_score?: number | null
          geography_score?: number | null
          id?: string
          lead_id?: string | null
          org_id?: string | null
          persona_score?: number | null
          priority_tier?: string | null
          scoring_notes?: string | null
          total_score?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          engagement_score?: number | null
          geography_score?: number | null
          id?: string
          lead_id?: string | null
          org_id?: string | null
          persona_score?: number | null
          priority_tier?: string | null
          scoring_notes?: string | null
          total_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          call_log_id: string | null
          city: string | null
          clinic_name: string | null
          clinic_type: string | null
          company: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          demo_datetime: string | null
          email: string
          estimated_call_volume: string | null
          id: string
          import_id: string | null
          industry: string | null
          last_contacted_at: string | null
          latest_email_status: string | null
          lead_source: string | null
          metadata: Json | null
          name: string | null
          notes: string | null
          opted_out: boolean | null
          org_id: string | null
          pain_points: string | null
          personalization_data: Json | null
          phone: string | null
          scheduled_call_time: string | null
          source: string | null
          status: string | null
          tags: Json | null
          updated_at: string | null
          use_case: string | null
        }
        Insert: {
          call_log_id?: string | null
          city?: string | null
          clinic_name?: string | null
          clinic_type?: string | null
          company?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          demo_datetime?: string | null
          email: string
          estimated_call_volume?: string | null
          id?: string
          import_id?: string | null
          industry?: string | null
          last_contacted_at?: string | null
          latest_email_status?: string | null
          lead_source?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          opted_out?: boolean | null
          org_id?: string | null
          pain_points?: string | null
          personalization_data?: Json | null
          phone?: string | null
          scheduled_call_time?: string | null
          source?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
          use_case?: string | null
        }
        Update: {
          call_log_id?: string | null
          city?: string | null
          clinic_name?: string | null
          clinic_type?: string | null
          company?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          demo_datetime?: string | null
          email?: string
          estimated_call_volume?: string | null
          id?: string
          import_id?: string | null
          industry?: string | null
          last_contacted_at?: string | null
          latest_email_status?: string | null
          lead_source?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          opted_out?: boolean | null
          org_id?: string | null
          pain_points?: string | null
          personalization_data?: Json | null
          phone?: string | null
          scheduled_call_time?: string | null
          source?: string | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
          use_case?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "recent_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          call_id: string | null
          contact_id: string | null
          content: string
          created_at: string | null
          direction: string
          error_message: string | null
          external_message_id: string | null
          id: string
          method: string
          org_id: string
          recipient: string
          sent_at: string | null
          service_provider: string | null
          status: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          call_id?: string | null
          contact_id?: string | null
          content: string
          created_at?: string | null
          direction: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          method: string
          org_id: string
          recipient: string
          sent_at?: string | null
          service_provider?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          call_id?: string | null
          contact_id?: string | null
          content?: string
          created_at?: string | null
          direction?: string
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          method?: string
          org_id?: string
          recipient?: string
          sent_at?: string | null
          service_provider?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "recent_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          channels: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          message: string
          org_id: string
          priority: Database["public"]["Enums"]["notification_priority"] | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_url?: string | null
          channels?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message: string
          org_id: string
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          channels?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          org_id?: string
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credentials: {
        Row: {
          connected_calendar_email: string | null
          connected_email: string | null
          created_at: string | null
          encrypted_config: string
          id: string
          is_active: boolean | null
          last_verified_at: string | null
          metadata: Json | null
          org_id: string
          provider: string
          updated_at: string | null
          verification_error: string | null
        }
        Insert: {
          connected_calendar_email?: string | null
          connected_email?: string | null
          created_at?: string | null
          encrypted_config: string
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          metadata?: Json | null
          org_id: string
          provider: string
          updated_at?: string | null
          verification_error?: string | null
        }
        Update: {
          connected_calendar_email?: string | null
          connected_email?: string | null
          created_at?: string | null
          encrypted_config?: string
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          metadata?: Json | null
          org_id?: string
          provider?: string
          updated_at?: string | null
          verification_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_feature_flags: {
        Row: {
          created_at: string | null
          enabled: boolean
          flag_key: string
          id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled: boolean
          flag_key: string
          id?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_feature_flags_flag_key_fkey"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["flag_key"]
          },
          {
            foreignKeyName: "org_feature_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tools: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: number
          org_id: string
          tool_name: string
          updated_at: string | null
          vapi_tool_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: number
          org_id: string
          tool_name: string
          updated_at?: string | null
          vapi_tool_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: number
          org_id?: string
          tool_name?: string
          updated_at?: string | null
          vapi_tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_tools_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          assigned_twilio_number: string | null
          billing_status: string | null
          calls_this_month: number | null
          cost_this_month: number | null
          created_at: string | null
          email: string
          forwarding_carrier: string | null
          id: string
          industry: string | null
          minutes_this_month: number | null
          name: string
          phone_number: string | null
          plan: string | null
          settings: Json | null
          status: string
          telephony_country: string | null
          timezone: string | null
          updated_at: string | null
          vapi_assistant_id: string | null
          vapi_phone_number_id: string | null
          website: string | null
        }
        Insert: {
          assigned_twilio_number?: string | null
          billing_status?: string | null
          calls_this_month?: number | null
          cost_this_month?: number | null
          created_at?: string | null
          email: string
          forwarding_carrier?: string | null
          id?: string
          industry?: string | null
          minutes_this_month?: number | null
          name: string
          phone_number?: string | null
          plan?: string | null
          settings?: Json | null
          status?: string
          telephony_country?: string | null
          timezone?: string | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          website?: string | null
        }
        Update: {
          assigned_twilio_number?: string | null
          billing_status?: string | null
          calls_this_month?: number | null
          cost_this_month?: number | null
          created_at?: string | null
          email?: string
          forwarding_carrier?: string | null
          id?: string
          industry?: string | null
          minutes_this_month?: number | null
          name?: string
          phone_number?: string | null
          plan?: string | null
          settings?: Json | null
          status?: string
          telephony_country?: string | null
          timezone?: string | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      orphaned_recordings: {
        Row: {
          deleted_at: string | null
          detected_at: string | null
          id: string
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          deleted_at?: string | null
          detected_at?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          deleted_at?: string | null
          detected_at?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: []
      }
      outbound_agent_config: {
        Row: {
          created_at: string | null
          first_message: string | null
          id: string
          is_active: boolean | null
          language: string | null
          last_synced_at: string | null
          max_call_duration: number | null
          org_id: string
          system_prompt: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          updated_at: string | null
          vapi_api_key: string | null
          vapi_assistant_id: string | null
          vapi_phone_number_id: string | null
          voice_id: string | null
        }
        Insert: {
          created_at?: string | null
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_synced_at?: string | null
          max_call_duration?: number | null
          org_id: string
          system_prompt?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string | null
          vapi_api_key?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          voice_id?: string | null
        }
        Update: {
          created_at?: string | null
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_synced_at?: string | null
          max_call_duration?: number | null
          org_id?: string
          system_prompt?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string | null
          vapi_api_key?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number_id?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_agent_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          merge_tags: Json | null
          name: string
          org_id: string | null
          persona_target: string | null
          send_delay_hours: number | null
          sequence_step: number | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          merge_tags?: Json | null
          name: string
          org_id?: string | null
          persona_target?: string | null
          send_delay_hours?: number | null
          sequence_step?: number | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          merge_tags?: Json | null
          name?: string
          org_id?: string | null
          persona_target?: string | null
          send_delay_hours?: number | null
          sequence_step?: number | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events_log: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          email: string | null
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          request_id: string | null
          status: string | null
          tx_ref: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          request_id?: string | null
          status?: string | null
          tx_ref?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          request_id?: string | null
          status?: string | null
          tx_ref?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      phone_blacklist: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          org_id: string
          phone: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id: string
          phone: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          org_id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_blacklist_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          area_code: string | null
          country: string | null
          created_at: string | null
          fallback_url: string | null
          id: string
          locality: string | null
          metadata: Json | null
          monthly_cost: number | null
          phone_number: string
          phone_sid: string
          region: string | null
          status: string | null
          status_callback_url: string | null
          voice_url: string | null
        }
        Insert: {
          area_code?: string | null
          country?: string | null
          created_at?: string | null
          fallback_url?: string | null
          id?: string
          locality?: string | null
          metadata?: Json | null
          monthly_cost?: number | null
          phone_number: string
          phone_sid: string
          region?: string | null
          status?: string | null
          status_callback_url?: string | null
          voice_url?: string | null
        }
        Update: {
          area_code?: string | null
          country?: string | null
          created_at?: string | null
          fallback_url?: string | null
          id?: string
          locality?: string | null
          metadata?: Json | null
          monthly_cost?: number | null
          phone_number?: string
          phone_sid?: string
          region?: string | null
          status?: string | null
          status_callback_url?: string | null
          voice_url?: string | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string | null
          days_in_stage: number | null
          entered_at: string | null
          exited_at: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          metadata: Json | null
          notes: string | null
          org_id: string | null
          stage: string
          won_mrr: number | null
          won_setup_fee: number | null
          won_tier: string | null
        }
        Insert: {
          created_at?: string | null
          days_in_stage?: number | null
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          metadata?: Json | null
          notes?: string | null
          org_id?: string | null
          stage: string
          won_mrr?: number | null
          won_setup_fee?: number | null
          won_tier?: string | null
        }
        Update: {
          created_at?: string | null
          days_in_stage?: number | null
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          metadata?: Json | null
          notes?: string | null
          org_id?: string | null
          stage?: string
          won_mrr?: number | null
          won_setup_fee?: number | null
          won_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          call_id: string
          created_at: string | null
          event_id: string
          event_type: string
          id: number
          received_at: string | null
        }
        Insert: {
          call_id: string
          created_at?: string | null
          event_id: string
          event_type: string
          id?: number
          received_at?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: number
          received_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          org_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          org_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_downloads: {
        Row: {
          call_id: string | null
          download_duration_seconds: number | null
          downloaded_at: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          call_id?: string | null
          download_duration_seconds?: number | null
          downloaded_at?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          call_id?: string | null
          download_duration_seconds?: number | null
          downloaded_at?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_downloads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_downloads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "recent_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_upload_metrics: {
        Row: {
          call_id: string
          call_type: string
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          status: string
        }
        Insert: {
          call_id: string
          call_type: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          status: string
        }
        Update: {
          call_id?: string
          call_type?: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_upload_metrics_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_upload_metrics_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "recent_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_upload_queue: {
        Row: {
          attempt_count: number | null
          call_id: string
          call_type: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          last_error_at: string | null
          max_attempts: number | null
          org_id: string | null
          priority: string
          processing_started_at: string | null
          recording_url: string
          status: string
          updated_at: string | null
          vapi_call_id: string | null
        }
        Insert: {
          attempt_count?: number | null
          call_id: string
          call_type: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_error_at?: string | null
          max_attempts?: number | null
          org_id?: string | null
          priority?: string
          processing_started_at?: string | null
          recording_url: string
          status?: string
          updated_at?: string | null
          vapi_call_id?: string | null
        }
        Update: {
          attempt_count?: number | null
          call_id?: string
          call_type?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_error_at?: string | null
          max_attempts?: number | null
          org_id?: string | null
          priority?: string
          processing_started_at?: string | null
          recording_url?: string
          status?: string
          updated_at?: string | null
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_upload_queue_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_upload_queue_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "recent_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_upload_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          org_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          org_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          org_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string | null
          id: string
          keywords: string[]
          name: string
          org_id: string
          price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          keywords?: string[]
          name: string
          org_id: string
          price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          keywords?: string[]
          name?: string
          org_id?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_delivery_log: {
        Row: {
          attempt_number: number
          created_at: string
          delivery_time_ms: number | null
          error_message: string | null
          id: string
          job_id: string
          message: string
          metadata: Json | null
          org_id: string
          recipient_phone: string
          status: string
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          delivery_time_ms?: number | null
          error_message?: string | null
          id?: string
          job_id: string
          message: string
          metadata?: Json | null
          org_id: string
          recipient_phone: string
          status: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          delivery_time_ms?: number | null
          error_message?: string | null
          id?: string
          job_id?: string
          message?: string
          metadata?: Json | null
          org_id?: string
          recipient_phone?: string
          status?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_delivery_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_country_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          ip_address: string | null
          new_country: string
          old_country: string | null
          org_id: string
          user_agent: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_country: string
          old_country?: string | null
          org_id: string
          user_agent?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_country?: string
          old_country?: string | null
          org_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telephony_country_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_country_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_queue: {
        Row: {
          call_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          escalation_rule_id: string | null
          from_agent_id: string | null
          id: string
          org_id: string
          reason: string
          status: string | null
          to_number: string
          trigger_data: Json | null
        }
        Insert: {
          call_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          escalation_rule_id?: string | null
          from_agent_id?: string | null
          id?: string
          org_id: string
          reason: string
          status?: string | null
          to_number: string
          trigger_data?: Json | null
        }
        Update: {
          call_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          escalation_rule_id?: string | null
          from_agent_id?: string | null
          id?: string
          org_id?: string
          reason?: string
          status?: string | null
          to_number?: string
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_queue_escalation_rule_id_fkey"
            columns: ["escalation_rule_id"]
            isOneToOne: false
            referencedRelation: "escalation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_queue_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_roles: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          org_id: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          org_id?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          org_id?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_org_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          business_name: string | null
          system_prompt: string | null
          updated_at: string | null
          user_id: string
          voice_personality: string | null
        }
        Insert: {
          business_name?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          user_id: string
          voice_personality?: string | null
        }
        Update: {
          business_name?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          user_id?: string
          voice_personality?: string | null
        }
        Relationships: []
      }
      verified_caller_ids: {
        Row: {
          created_at: string | null
          friendly_name: string | null
          id: string
          org_id: string
          phone_number: string
          status: string
          twilio_call_sid: string | null
          twilio_caller_id_sid: string | null
          updated_at: string | null
          verification_attempts: number | null
          verification_code_expires_at: string | null
          verification_code_hash: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          friendly_name?: string | null
          id?: string
          org_id: string
          phone_number: string
          status?: string
          twilio_call_sid?: string | null
          twilio_caller_id_sid?: string | null
          updated_at?: string | null
          verification_attempts?: number | null
          verification_code_expires_at?: string | null
          verification_code_hash?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          friendly_name?: string | null
          id?: string
          org_id?: string
          phone_number?: string
          status?: string
          twilio_call_sid?: string | null
          twilio_caller_id_sid?: string | null
          updated_at?: string | null
          verification_attempts?: number | null
          verification_code_expires_at?: string | null
          verification_code_hash?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verified_caller_ids_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      voice_test_transcripts: {
        Row: {
          content: string | null
          id: string
          role: string | null
          session_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          id?: string
          role?: string | null
          session_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          id?: string
          role?: string | null
          session_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_test_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_log: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          job_id: string | null
          last_attempt_at: string | null
          org_id: string
          received_at: string
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          org_id: string
          received_at: string
          status: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          org_id?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      call_analytics_summary: {
        Row: {
          avg_duration_seconds: number | null
          bookings_created: number | null
          call_type: string | null
          date: string | null
          negative_calls: number | null
          positive_calls: number | null
          status: string | null
          total_calls: number | null
          total_cost: number | null
          total_seconds: number | null
        }
        Relationships: []
      }
      recent_calls: {
        Row: {
          booking_created: boolean | null
          call_sid: string | null
          call_type: string | null
          created_at: string | null
          duration_seconds: number | null
          from_number: string | null
          id: string | null
          sentiment: string | null
          status: string | null
          to_number: string | null
          total_cost: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      book_appointment_atomic: {
        Args: {
          p_duration_minutes: number
          p_org_id: string
          p_patient_email: string
          p_patient_name: string
          p_patient_phone: string
          p_scheduled_at: string
          p_service_type: string
        }
        Returns: Json
      }
      book_appointment_with_lock: {
        Args: {
          p_contact_id: string
          p_duration_minutes: number
          p_lock_key?: number
          p_metadata?: Json
          p_notes?: string
          p_org_id: string
          p_scheduled_at: string
          p_service_id?: string
        }
        Returns: Json
      }
      calculate_lead_temperature: {
        Args: {
          p_booked: boolean
          p_duration: number
          p_intent: string
          p_status: string
        }
        Returns: string
      }
      check_duplicate_booking: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_client_email: string
        }
        Returns: boolean
      }
      claim_slot_atomic: {
        Args: {
          p_calendar_id: string
          p_call_sid: string
          p_hold_duration_minutes?: number
          p_org_id: string
          p_patient_name?: string
          p_patient_phone?: string
          p_slot_time: string
        }
        Returns: {
          action: string
          error: string
          hold_id: string
          success: boolean
        }[]
      }
      cleanup_expired_holds: {
        Args: never
        Returns: {
          deleted_count: number
        }[]
      }
      cleanup_old_auth_audit_logs: { Args: never; Returns: number }
      cleanup_old_backup_verification_logs: { Args: never; Returns: number }
      cleanup_old_sms_delivery_logs: { Args: never; Returns: number }
      cleanup_old_webhook_logs: { Args: never; Returns: number }
      complete_voice_session: {
        Args: { p_session_id: string; p_status?: string }
        Returns: undefined
      }
      confirm_held_slot: {
        Args: {
          p_contact_id: string
          p_hold_id: string
          p_org_id: string
          p_service_type: string
        }
        Returns: {
          appointment_id: string
          error: string
          success: boolean
        }[]
      }
      create_inbound_call_atomically: {
        Args: {
          p_agent_id: string
          p_lead_id: string
          p_metadata?: Json
          p_org_id: string
          p_phone_number: string
          p_vapi_call_id: string
        }
        Returns: {
          call_logs_id: string
          call_tracking_id: string
          error_message: string
          success: boolean
        }[]
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_channels?: Json
          p_message: string
          p_org_id: string
          p_priority?: Database["public"]["Enums"]["notification_priority"]
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      create_session: {
        Args: {
          p_device_type?: string
          p_expires_in_hours?: number
          p_ip_address?: string
          p_org_id: string
          p_session_token: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      expire_old_notifications: { Args: never; Returns: undefined }
      find_or_create_client: {
        Args: {
          p_company?: string
          p_email: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      generate_booking_id: { Args: never; Returns: string }
      get_backup_verification_history: {
        Args: { p_days?: number }
        Returns: {
          backup_age_hours: number
          checks_failed: number
          checks_passed: number
          status: string
          verified_at: string
        }[]
      }
      get_cached_search: { Args: { p_query_hash: string }; Returns: Json }
      get_client_booking_count: {
        Args: { p_client_email: string }
        Returns: number
      }
      get_contacts_paged: {
        Args: {
          p_lead_status?: string
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_search?: string
        }
        Returns: {
          booking_source: string
          email: string
          id: string
          last_contacted_at: string
          name: string
          notes: string
          phone: string
          total_count: number
        }[]
      }
      get_dead_letter_sms: {
        Args: { p_limit?: number }
        Returns: {
          attempt_number: number
          created_at: string
          error_message: string
          id: string
          job_id: string
          message: string
          org_id: string
          recipient_phone: string
        }[]
      }
      get_latest_backup_verification: {
        Args: never
        Returns: {
          backup_age_hours: number
          checks_failed: number
          checks_passed: number
          error_details: Json
          status: string
          verified_at: string
        }[]
      }
      get_org_enabled_features: {
        Args: { p_org_id: string }
        Returns: {
          description: string
          flag_key: string
          flag_name: string
        }[]
      }
      get_service_price_by_keyword: {
        Args: { p_keyword: string; p_org_id: string }
        Returns: number
      }
      get_sms_delivery_stats: {
        Args: { p_hours?: number; p_org_id: string }
        Returns: {
          avg_delivery_time_ms: number
          dead_letter: number
          delivered: number
          failed: number
          success_rate: number
          total_sent: number
        }[]
      }
      get_user_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      is_feature_enabled: {
        Args: { p_flag_key: string; p_org_id: string }
        Returns: boolean
      }
      log_agent_config_change: {
        Args: {
          p_agent_id: string
          p_change_summary?: string
          p_change_type: string
          p_changed_by: string
          p_ip_address?: string
          p_new_values?: Json
          p_old_values?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      log_auth_event:
        | {
            Args: {
              p_event_type: string
              p_ip_address?: unknown
              p_metadata?: Json
              p_org_id: string
              p_user_agent?: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_event_type: string
              p_ip_address?: string
              p_metadata?: Json
              p_org_id: string
              p_user_agent?: string
              p_user_id: string
            }
            Returns: string
          }
      match_knowledge_chunks: {
        Args: {
          match_count: number
          match_threshold: number
          p_org_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
        }[]
      }
      normalize_phone: { Args: { phone: string }; Returns: string }
      release_hold: {
        Args: { p_hold_id: string; p_org_id: string }
        Returns: {
          success: boolean
        }[]
      }
      revoke_all_sessions: { Args: { p_user_id: string }; Returns: number }
      revoke_session: { Args: { p_session_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_agent_and_integrations: {
        Args: {
          p_agent_first_message?: string
          p_agent_id: string
          p_agent_language?: string
          p_agent_max_call_duration?: number
          p_agent_system_prompt?: string
          p_agent_voice?: string
          p_org_id: string
          p_twilio_account_sid?: string
          p_twilio_auth_token?: string
          p_twilio_from_number?: string
          p_vapi_phone_number_id?: string
          p_vapi_public_key?: string
          p_vapi_secret_key?: string
          p_vapi_validated_at?: string
          p_vapi_validation_status?: string
        }
        Returns: Json
      }
      update_call_completed_atomically: {
        Args: {
          p_call_tracking_id?: string
          p_duration_seconds: number
          p_org_id: string
          p_vapi_call_id: string
        }
        Returns: {
          call_logs_updated: boolean
          call_tracking_updated: boolean
          error_message: string
          success: boolean
        }[]
      }
      update_call_with_recording_atomically: {
        Args: {
          p_call_type?: string
          p_org_id: string
          p_recording_storage_path?: string
          p_recording_url?: string
          p_transcript?: string
          p_vapi_call_id: string
        }
        Returns: {
          call_logs_updated: boolean
          calls_updated: boolean
          error_message: string
          success: boolean
        }[]
      }
      update_feature_flag: {
        Args: {
          p_enabled_globally?: boolean
          p_flag_key: string
          p_rollout_percentage?: number
        }
        Returns: boolean
      }
      update_recording_status: {
        Args: {
          p_call_id: string
          p_org_id: string
          p_status: string
          p_storage_path?: string
        }
        Returns: boolean
      }
      validate_email: { Args: { email: string }; Returns: boolean }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      notification_priority: "low" | "normal" | "high" | "urgent"
      notification_status: "unread" | "read" | "archived"
      notification_type:
        | "hot_lead"
        | "appointment_booked"
        | "appointment_reminder"
        | "missed_call"
        | "system_alert"
        | "voicemail"
      task_priority: "high" | "medium" | "low"
      task_status: "pending" | "in_progress" | "completed" | "failed"
      task_type: "sms_follow_up" | "call_back" | "email"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      notification_priority: ["low", "normal", "high", "urgent"],
      notification_status: ["unread", "read", "archived"],
      notification_type: [
        "hot_lead",
        "appointment_booked",
        "appointment_reminder",
        "missed_call",
        "system_alert",
        "voicemail",
      ],
      task_priority: ["high", "medium", "low"],
      task_status: ["pending", "in_progress", "completed", "failed"],
      task_type: ["sms_follow_up", "call_back", "email"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.72.7 (currently installed v2.67.1)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
