/**
 * Type-Safe Supabase Database Schema
 *
 * This file defines strict TypeScript types that EXACTLY match the Supabase schema.
 * Using these types prevents schema mismatches at compile-time.
 *
 * Benefits:
 * - ✅ Typos in column names become compile errors
 * - ✅ Wrong provider values are caught by TypeScript
 * - ✅ Schema changes are immediately visible
 * - ✅ IDE autocompletion works correctly
 */

/**
 * Strict provider type - prevents typos like 'google-calendar' or 'twillio'
 * These MUST match the CHECK constraint in org_credentials table
 */
export type ProviderType = 'vapi' | 'twilio' | 'google_calendar' | 'resend' | 'elevenlabs';

/**
 * Exact schema match for org_credentials table
 * Enforces correct column names and types
 */
export interface OrgCredentialsRow {
  id: string;
  org_id: string;
  provider: ProviderType;  // NOT 'service_type' - prevents old typo
  encrypted_config: string;  // AES-256-GCM: "iv:authTag:content" (hex-encoded)
  is_active: boolean;
  last_verified_at: string | null;  // ISO timestamp or null
  verification_error: string | null;
  created_at: string;  // ISO timestamp
  updated_at: string;  // ISO timestamp
}

/**
 * Insert type - omits auto-generated fields
 */
export type OrgCredentialsInsert = Omit<OrgCredentialsRow, 'id' | 'created_at' | 'updated_at'>;

/**
 * Update type - only allows updating certain fields
 */
export type OrgCredentialsUpdate = Partial<Omit<OrgCredentialsRow, 'id' | 'org_id'>>;

/**
 * Schema for assistant_org_mapping table
 * Fast O(1) lookup for webhook handlers to resolve org_id from assistant_id
 */
export interface AssistantOrgMappingRow {
  id: string;
  vapi_assistant_id: string;  // Unique, used as primary lookup key
  org_id: string;
  assistant_role: 'inbound' | 'outbound' | null;
  assistant_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Database type definitions
 * Can be extended with full Database interface if using typed Supabase client
 */
export interface Database {
  public: {
    Tables: {
      org_credentials: {
        Row: OrgCredentialsRow;
        Insert: OrgCredentialsInsert;
        Update: OrgCredentialsUpdate;
      };
      assistant_org_mapping: {
        Row: AssistantOrgMappingRow;
      };
    };
  };
}

/**
 * Utility: Check if a string is a valid provider
 */
export function isValidProvider(value: any): value is ProviderType {
  return ['vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs'].includes(value);
}

/**
 * Utility: Get all valid providers
 */
export function getValidProviders(): ProviderType[] {
  return ['vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs'];
}
