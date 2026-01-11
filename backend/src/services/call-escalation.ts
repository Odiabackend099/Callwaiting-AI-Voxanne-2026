/**
 * Call Escalation Service
 * Business logic for evaluating escalation rules and managing transfers
 */

import { supabase } from './supabase-client';

export interface EscalationRule {
    id: string;
    org_id: string;
    agent_id?: string;
    trigger_type: 'wait_time' | 'sentiment' | 'ai_request' | 'manual';
    trigger_value: any;
    transfer_number: string;
    transfer_type: 'external' | 'internal';
    name: string;
    description?: string;
    enabled: boolean;
    priority: number;
}

export interface TransferQueueEntry {
    id: string;
    org_id: string;
    call_id: string;
    escalation_rule_id?: string;
    from_agent_id?: string;
    to_number: string;
    reason: string;
    trigger_data?: any;
    status: 'pending' | 'initiated' | 'completed' | 'failed';
    error_message?: string;
    created_at: string;
    completed_at?: string;
}

/**
 * Get all enabled escalation rules for an organization
 * @param orgId Organization ID
 * @param agentId Optional agent ID to filter rules
 * @returns Array of escalation rules, sorted by priority (highest first)
 */
export async function getEscalationRules(
    orgId: string,
    agentId?: string
): Promise<EscalationRule[]> {
    let query = supabase
        .from('escalation_rules')
        .select('*')
        .eq('org_id', orgId)
        .eq('enabled', true)
        .order('priority', { ascending: false });

    // Include both agent-specific rules and global rules (agent_id is null)
    if (agentId) {
        query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Create a transfer queue entry
 * @param params Transfer parameters
 * @returns Created transfer queue entry
 */
export async function createTransferQueue(params: {
    callId: string;
    orgId: string;
    toNumber: string;
    reason: string;
    escalationRuleId?: string;
    fromAgentId?: string;
    triggerData?: any;
}): Promise<TransferQueueEntry> {
    const { data, error } = await supabase
        .from('transfer_queue')
        .insert({
            org_id: params.orgId,
            call_id: params.callId,
            escalation_rule_id: params.escalationRuleId || null,
            from_agent_id: params.fromAgentId || null,
            to_number: params.toNumber,
            reason: params.reason,
            trigger_data: params.triggerData || null,
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update transfer queue status
 * @param transferId Transfer queue entry ID
 * @param status New status
 * @param errorMessage Optional error message if failed
 */
export async function updateTransferStatus(
    transferId: string,
    status: 'initiated' | 'completed' | 'failed',
    errorMessage?: string
): Promise<void> {
    const updateData: any = {
        status,
        updated_at: new Date().toISOString()
    };

    if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
        updateData.error_message = errorMessage;
    }

    const { error } = await supabase
        .from('transfer_queue')
        .update(updateData)
        .eq('id', transferId);

    if (error) throw error;
}

/**
 * Check if escalation is needed for a call
 * @param callId Call ID
 * @param orgId Organization ID
 * @param agentId Agent ID
 * @param callData Call data for evaluation
 * @returns Escalation decision with rule and reason if needed
 */
export async function isEscalationNeeded(
    callId: string,
    orgId: string,
    agentId: string,
    callData: {
        waitTime?: number;
        sentiment?: number;
        aiRequested?: boolean;
    }
): Promise<{
    needed: boolean;
    rule?: EscalationRule;
    reason?: string;
    triggerData?: any;
}> {
    try {
        const rules = await getEscalationRules(orgId, agentId);

        // Evaluate rules in priority order
        for (const rule of rules) {
            // Wait time trigger
            if (rule.trigger_type === 'wait_time' && callData.waitTime !== undefined) {
                const maxWait = rule.trigger_value?.max_wait_seconds || 300;
                if (callData.waitTime >= maxWait) {
                    return {
                        needed: true,
                        rule,
                        reason: 'wait_time_exceeded',
                        triggerData: {
                            actual_wait_time: callData.waitTime,
                            max_wait_time: maxWait
                        }
                    };
                }
            }

            // Sentiment trigger
            if (rule.trigger_type === 'sentiment' && callData.sentiment !== undefined) {
                const threshold = rule.trigger_value?.sentiment_threshold || -0.5;
                if (callData.sentiment <= threshold) {
                    return {
                        needed: true,
                        rule,
                        reason: 'negative_sentiment',
                        triggerData: {
                            actual_sentiment: callData.sentiment,
                            sentiment_threshold: threshold
                        }
                    };
                }
            }

            // AI request trigger
            if (rule.trigger_type === 'ai_request' && callData.aiRequested) {
                return {
                    needed: true,
                    rule,
                    reason: 'ai_requested',
                    triggerData: {
                        ai_requested: true
                    }
                };
            }
        }

        return { needed: false };
    } catch (error) {
        console.error('[Call Escalation] Error checking escalation:', error);
        return { needed: false };
    }
}

/**
 * Execute a call transfer
 * @param callId Call ID
 * @param orgId Organization ID
 * @param toNumber Transfer destination number
 * @param reason Transfer reason
 * @param escalationRuleId Optional escalation rule ID
 * @param triggerData Optional trigger data snapshot
 * @returns Transfer queue entry
 */
export async function executeTransfer(
    callId: string,
    orgId: string,
    toNumber: string,
    reason: string,
    escalationRuleId?: string,
    triggerData?: any
): Promise<TransferQueueEntry> {
    // Create transfer queue entry
    const transfer = await createTransferQueue({
        callId,
        orgId,
        toNumber,
        reason,
        escalationRuleId,
        triggerData
    });

    // TODO: Integrate with Vapi/Twilio to actually execute the transfer
    // For now, just mark as initiated
    await updateTransferStatus(transfer.id, 'initiated');

    return transfer;
}
