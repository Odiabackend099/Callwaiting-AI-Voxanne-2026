/**
 * Knowledge Base Type Definitions
 * Provides type safety for KB documents, metadata, and operations
 */

export const KB_CATEGORIES = ['products_services', 'operations', 'ai_guidelines', 'general'] as const;
export type KBCategory = typeof KB_CATEGORIES[number];

/**
 * Metadata stored with KB documents
 */
export interface KBMetadata {
  source: 'dashboard' | 'beverly_seed';
  bytes: number;
  vapi_file_id?: string;
  synced_at?: string;
}

/**
 * Knowledge Base Document
 */
export interface KBDocument {
  id: string;
  org_id: string;
  filename: string;
  content: string;
  category: KBCategory;
  version: number;
  active: boolean;
  metadata: KBMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * Beverly KB Seed Document
 */
export interface BeverlyKBSeedDoc {
  filename: string;
  category: KBCategory;
  content: string;
}

/**
 * KB CRUD Request Payloads
 */
export interface CreateKBDocumentRequest {
  filename: string;
  content: string;
  category?: KBCategory;
  active?: boolean;
}

export interface UpdateKBDocumentRequest {
  filename?: string;
  content?: string;
  category?: KBCategory;
  active?: boolean;
}

/**
 * KB Sync Request
 */
export interface SyncKBRequest {
  toolName?: string;
  assistantRoles?: Array<'inbound' | 'outbound'>;
}

/**
 * KB Sync Response
 */
export interface SyncKBResponse {
  success: boolean;
  toolId: string;
  assistantsUpdated: Array<{
    role: string;
    assistantId: string;
  }>;
}

/**
 * Vapi File Upload Response
 */
export interface VapiFileUploadResponse {
  id: string;
  name?: string;
  size?: number;
}

/**
 * Vapi Tool Response
 */
export interface VapiToolResponse {
  id: string;
  type?: string;
  function?: {
    name: string;
  };
}

/**
 * KB Sync Log Entry (for rate limiting)
 */
export interface KBSyncLog {
  id: string;
  org_id: string;
  created_at: string;
  tool_id?: string;
  status: 'success' | 'failed';
  error_message?: string;
}

/**
 * Metadata Update Result
 */
export interface MetadataUpdateResult {
  success: boolean;
  error?: any;
}
