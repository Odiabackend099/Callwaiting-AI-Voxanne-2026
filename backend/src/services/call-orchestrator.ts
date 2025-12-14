import { supabase } from './supabase-client';
import { VapiClient } from './vapi-client';
import { CallOutcome } from '../types/call-outcome';
import { withTimeout } from '../utils/timeout-helper';

/**
 * Idempotent call creation with proper error handling
 * Prevents orphaned calls and ensures DB consistency
 */
export async function createCallIdempotent(params: {
  leadId: string;
  orgId: string;
  agentId: string;
  phone: string;
  vapiApiKey: string;
  assistantId: string;
  phoneNumberId: string;
  customerName: string;
  variableValues: Record<string, string>;
  metadata: Record<string, string>;
  firstMessage: string;
  idempotencyKey: string;
}) {
  const {
    leadId,
    orgId,
    agentId,
    phone,
    vapiApiKey,
    assistantId,
    phoneNumberId,
    customerName,
    variableValues,
    metadata,
    firstMessage,
    idempotencyKey
  } = params;

  // STEP 1: Insert pending call record FIRST (with idempotency key)
  const { data: pendingCall, error: insertError } = await supabase
    .from('call_tracking')
    .insert({
      org_id: orgId,
      lead_id: leadId,
      agent_id: agentId,
      phone: phone,
      called_at: new Date().toISOString(),
      // Use QUEUED as the initial state so it is treated as an active call.
      call_outcome: CallOutcome.QUEUED,
      idempotency_key: idempotencyKey,
      metadata: { status: 'pending' }
    })
    .select()
    .single();

  // Handle duplicate (idempotency key conflict)
  if (insertError?.code === '23505') {
    const { data: existing } = await supabase
      .from('call_tracking')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();
    
    return { 
      success: false, 
      error: 'Call already in progress',
      callId: existing?.id 
    };
  }

  if (insertError || !pendingCall) {
    throw new Error(`Failed to create pending call: ${insertError?.message}`);
  }

  try {
    // STEP 2: Call Vapi API with timeout
    const vapiClient = new VapiClient(vapiApiKey);
    
    const vapiCall = await withTimeout(
      vapiClient.createOutboundCall({
        assistantId,
        phoneNumberId,
        idempotencyKey,
        customer: {
          number: phone,
          name: customerName
        },
        assistantOverrides: {
          variableValues,
          metadata,
          firstMessage
        }
      }),
      30000,
      'Vapi API timeout - request took longer than 30 seconds'
    );

    // STEP 3: Update with Vapi call ID
    await supabase
      .from('call_tracking')
      .update({
        vapi_call_id: vapiCall.id,
        call_outcome: CallOutcome.QUEUED
      })
      .eq('id', pendingCall.id);

    return {
      success: true,
      callId: pendingCall.id,
      vapiCallId: vapiCall.id
    };

  } catch (error: any) {
    // STEP 4: Mark as failed (don't delete - keep for audit)
    await supabase
      .from('call_tracking')
      .update({
        call_outcome: CallOutcome.FAILED,
        metadata: { 
          error: error.message,
          failed_at: new Date().toISOString()
        }
      })
      .eq('id', pendingCall.id);

    throw error;
  }
}
