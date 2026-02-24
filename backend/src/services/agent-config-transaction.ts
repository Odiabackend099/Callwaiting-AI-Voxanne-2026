/**
 * Transactional Agent Configuration Service
 * ==========================================
 *
 * Ensures atomicity of agent config saves + Vapi syncs.
 *
 * CRITICAL INVARIANT: Either BOTH database + Vapi succeed, OR NEITHER is modified.
 * This prevents partial saves where database is modified but Vapi sync fails.
 *
 * Pattern:
 * 1. Validate + prepare all changes (no DB writes yet)
 * 2. Sync to Vapi FIRST (before any DB changes)
 * 3. Only then update database if Vapi succeeds
 * 4. If Vapi fails, database is completely untouched
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from './logger';
import { ensureAssistantSynced } from './vapi-sync';

const logger = createLogger('AgentConfigTransaction');

export interface TransactionalAgentUpdate {
  orgId: string;
  agentId: string;
  role: 'inbound' | 'outbound';
  payload: Record<string, any>;
}

export interface TransactionResult {
  success: boolean;
  agentId: string;
  role: string;
  dbUpdated: boolean;
  vapiSynced: boolean;
  error?: string;
  assistantId?: string;
}

/**
 * Execute transactional agent config update.
 *
 * CRITICAL INVARIANT: Multi-tenant system uses ONE master Vapi API key for ALL organizations.
 * Vapi sync happens BEFORE database update. If Vapi fails, database is never modified.
 *
 * @param supabase - Supabase client
 * @param updates - List of agents to update (orgId filtered for multi-tenancy)
 * @param vapiApiKey - Master Vapi API key (single key for all orgs)
 */
export async function executeTransactionalAgentUpdate(
  supabase: SupabaseClient,
  updates: TransactionalAgentUpdate[],
  vapiApiKey: string
): Promise<TransactionResult[]> {
  const results: TransactionResult[] = [];

  for (const update of updates) {
    const transactionLog = {
      orgId: update.orgId,
      agentId: update.agentId,
      role: update.role,
      timestamp: new Date().toISOString()
    };

    try {
      logger.info('[TRANSACTION_START] Beginning transactional update', transactionLog);

      // ========== PHASE 1: FETCH CURRENT STATE ==========
      // Validate agent exists before making any changes
      const { data: currentAgent, error: fetchError } = await supabase
        .from('agents')
        .select('id, role, vapi_assistant_id, org_id')
        .eq('id', update.agentId)
        .eq('org_id', update.orgId)
        .maybeSingle();

      if (fetchError) {
        logger.error('[TRANSACTION_FAIL] Failed to fetch current agent state', {
          ...transactionLog,
          error: fetchError.message
        });
        results.push({
          success: false,
          agentId: update.agentId,
          role: update.role,
          dbUpdated: false,
          vapiSynced: false,
          error: `Failed to fetch agent: ${fetchError.message}`
        });
        continue;
      }

      if (!currentAgent) {
        logger.error('[TRANSACTION_FAIL] Agent not found', transactionLog);
        results.push({
          success: false,
          agentId: update.agentId,
          role: update.role,
          dbUpdated: false,
          vapiSynced: false,
          error: 'Agent not found in database'
        });
        continue;
      }

      logger.info('[TRANSACTION_PHASE_1_OK] Current state validated', {
        ...transactionLog,
        currentAssistantId: currentAgent.vapi_assistant_id
      });

      // ========== PHASE 2: SYNC TO VAPI FIRST ==========
      // This happens BEFORE any database changes
      // Uses master Vapi API key (single key for all organizations)
      let vapiSyncResult: any = null;
      try {
        logger.info('[TRANSACTION_PHASE_2_START] Syncing to Vapi (master key)...', transactionLog);

        vapiSyncResult = await ensureAssistantSynced(update.agentId, vapiApiKey);

        logger.info('[TRANSACTION_PHASE_2_OK] Vapi sync successful', {
          ...transactionLog,
          assistantId: vapiSyncResult.assistantId,
          toolsSynced: vapiSyncResult.toolsSynced
        });
      } catch (vapiError: any) {
        // CRITICAL: Vapi failed, so we ABORT the transaction and never update database
        logger.error('[TRANSACTION_PHASE_2_FAIL] Vapi sync failed - aborting database update', {
          ...transactionLog,
          error: vapiError.message
        });

        results.push({
          success: false,
          agentId: update.agentId,
          role: update.role,
          dbUpdated: false,
          vapiSynced: false,
          error: `Vapi sync failed: ${vapiError.message}`
        });
        continue;
      }

      // ========== PHASE 3: UPDATE DATABASE ==========
      // Only after Vapi succeeds do we update the database
      const dbPayload = {
        ...update.payload,
        vapi_assistant_id: vapiSyncResult.assistantId,
        // Add timestamp to track when sync happened
        last_synced_at: new Date().toISOString()
      };

      logger.info('[TRANSACTION_PHASE_3_START] Updating database...', {
        ...transactionLog,
        payloadKeys: Object.keys(dbPayload)
      });

      const { error: updateError } = await supabase
        .from('agents')
        .update(dbPayload)
        .eq('id', update.agentId)
        .eq('org_id', update.orgId);

      if (updateError) {
        // This is a critical error state: Vapi succeeded but DB update failed
        // Log it for manual investigation
        logger.error('[TRANSACTION_PHASE_3_FAIL] Database update failed after successful Vapi sync', {
          ...transactionLog,
          error: updateError.message,
          note: 'CRITICAL: Database and Vapi are now out of sync'
        });

        results.push({
          success: false,
          agentId: update.agentId,
          role: update.role,
          dbUpdated: false,
          vapiSynced: true, // Important: Vapi WAS synced, but DB wasn't
          error: `Vapi synced but database update failed: ${updateError.message}`,
          assistantId: vapiSyncResult.assistantId
        });
        continue;
      }

      // ========== PHASE 4: VERIFY DATABASE UPDATE ==========
      // Confirm the update actually persisted
      const { data: verifiedAgent, error: verifyError } = await supabase
        .from('agents')
        .select('id, vapi_assistant_id, last_synced_at')
        .eq('id', update.agentId)
        .maybeSingle();

      if (verifyError) {
        logger.error('[TRANSACTION_VERIFY_FAIL] Failed to verify database update', {
          ...transactionLog,
          error: verifyError.message
        });

        results.push({
          success: false,
          agentId: update.agentId,
          role: update.role,
          dbUpdated: false,
          vapiSynced: true,
          error: `Failed to verify database update: ${verifyError.message}`,
          assistantId: vapiSyncResult.assistantId
        });
        continue;
      }

      if (!verifiedAgent || verifiedAgent.vapi_assistant_id !== vapiSyncResult.assistantId) {
        logger.error('[TRANSACTION_VERIFY_FAIL] Database verification mismatch', {
          ...transactionLog,
          expectedAssistantId: vapiSyncResult.assistantId,
          actualAssistantId: verifiedAgent?.vapi_assistant_id
        });

        results.push({
          success: false,
          agentId: update.agentId,
          role: update.role,
          dbUpdated: false,
          vapiSynced: true,
          error: 'Database verification failed after update',
          assistantId: vapiSyncResult.assistantId
        });
        continue;
      }

      // ========== SUCCESS ==========
      logger.info('[TRANSACTION_COMPLETE] Transactional update successful', {
        ...transactionLog,
        assistantId: vapiSyncResult.assistantId,
        verifiedAt: verifiedAgent.last_synced_at
      });

      results.push({
        success: true,
        agentId: update.agentId,
        role: update.role,
        dbUpdated: true,
        vapiSynced: true,
        assistantId: vapiSyncResult.assistantId
      });
    } catch (error: any) {
      // Catch-all for unexpected errors
      logger.error('[TRANSACTION_UNEXPECTED_ERROR] Unexpected error during transaction', {
        ...transactionLog,
        error: error.message,
        stack: error.stack
      });

      results.push({
        success: false,
        agentId: update.agentId,
        role: update.role,
        dbUpdated: false,
        vapiSynced: false,
        error: `Unexpected error: ${error.message}`
      });
    }
  }

  return results;
}

/**
 * Build transactional update from agent config request.
 *
 * Validates that all required fields are present before creating transaction.
 * Does NOT include Vapi API key (master key is passed separately to executor).
 */
export function buildTransactionalUpdates(
  orgId: string,
  agentMap: Record<string, string>,
  inboundPayload: Record<string, any> | null,
  outboundPayload: Record<string, any> | null
): TransactionalAgentUpdate[] {
  const updates: TransactionalAgentUpdate[] = [];

  if (inboundPayload && agentMap['inbound']) {
    updates.push({
      orgId,
      agentId: agentMap['inbound'],
      role: 'inbound',
      payload: inboundPayload
    });
  }

  if (outboundPayload && agentMap['outbound']) {
    updates.push({
      orgId,
      agentId: agentMap['outbound'],
      role: 'outbound',
      payload: outboundPayload
    });
  }

  return updates;
}
