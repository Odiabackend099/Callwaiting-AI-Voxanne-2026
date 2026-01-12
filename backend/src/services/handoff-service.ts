
import { supabase } from './supabase-client';
import { log } from './logger';

export interface HandoffContext {
    sessionId: string;
    tenantId: string;
    timestamp: string;
    patient: {
        phoneNumber: string;
        name?: string;
        isNewPatient?: boolean;
        dateOfBirth?: string;
    };
    intent?: {
        serviceCategory?: string;
        specificInterest?: string;
        urgency?: string;
    };
    status: 'screening_incomplete' | 'screening_complete' | 'slot_held' | 'otp_sent' | 'verified' | 'handoff_ready' | 'completed';
    scheduling?: {
        heldSlotId?: string;
        proposedTime?: string;
        slotExpiresAt?: string;
    };
    verification?: {
        status: 'pending' | 'verified' | 'failed';
        method: 'sms_otp';
        timestamp: string;
    };
    conversationSummary?: string;
}

export class HandoffService {

    /**
     * Create or update a handoff state
     */
    async updateHandoffState(context: HandoffContext) {
        try {
            // Upsert based on session_id or patient_phone + tenant_id basic logic
            // Ideally session_id is consistent.

            const { data, error } = await supabase
                .from('handoff_states')
                .upsert({
                    tenant_id: context.tenantId,
                    session_id: context.sessionId,
                    patient_phone: context.patient.phoneNumber,
                    stage: context.status,
                    context: context,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'session_id' })
                .select()
                .single();

            if (error) {
                log.error('HandoffService', 'Error updating handoff state', { error: error.message });
                throw error;
            }

            return data;
        } catch (error: any) {
            console.error('Failed to update handoff state:', error);
            throw error;
        }
    }

    /**
     * Retrieve the latest handoff context for a patient phone number
     * Used by Voxan (Inbound Agent) to "remember"
     */
    async getHandoffContext(tenantId: string, patientPhone: string): Promise<HandoffContext | null> {
        try {
            // Get the most recent active handoff state
            const { data, error } = await supabase
                .from('handoff_states')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('patient_phone', patientPhone)
                .neq('stage', 'completed') // Only active sessions
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                if (error && error.code !== 'PGRST116') { // PGRST116 is no rows
                    log.error('HandoffService', 'Error fetching context', { error: error.message });
                }
                return null;
            }

            return data.context as HandoffContext;

        } catch (error: any) {
            log.error('HandoffService', 'Error getting handoff context', { error: error.message });
            return null;
        }
    }

    /**
     * Mark a handoff as completed (session finished)
     */
    async completeHandoff(sessionId: string) {
        const { error } = await supabase
            .from('handoff_states')
            .update({ stage: 'completed' })
            .eq('session_id', sessionId);

        if (error) {
            log.error('HandoffService', 'Error completing handoff', { sessionId, error: error.message });
        }
    }
}

export const handoffService = new HandoffService();
