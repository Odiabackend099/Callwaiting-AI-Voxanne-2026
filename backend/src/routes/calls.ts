import express, { Request, Response } from 'express';
import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';
import { getSignedRecordingUrl } from '../services/call-recording-storage';

export const callsRouter = express.Router();

const vapiApiKey = process.env.VAPI_API_KEY;
const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

const vapi = vapiApiKey ? new VapiClient(vapiApiKey) : (null as any);

type StartCallLead = {
  id: string;
  phone: string;
  name?: string | null;
  company?: string | null;
  city?: string | null;
  email?: string | null;
};

function maskPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `***${digits.slice(-4)}`;
}

function normalizeE164(raw: string): string {
  return (raw || '').trim().replace(/[\s\-()]/g, '');
}

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((value || '').trim());
}

function getInMemoryLeads(): StartCallLead[] {
  return (((globalThis as any).__VOXANNE_IN_MEMORY_LEADS__ as StartCallLead[]) || [])
    .filter(Boolean);
}

function resolveLeadsFromIds(leadIds: string[]): StartCallLead[] {
  const store = getInMemoryLeads();
  const byId = new Map(store.map((l) => [l.id, l] as const));
  return (leadIds || []).map((id) => byId.get(id)).filter(Boolean) as StartCallLead[];
}

// Start calls for multiple leads (bulk call trigger)
callsRouter.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      leads,
      leadIds,
      vapiAgentId,
      vapiPhoneNumberId,
      selectedVoice
    }: {
      leads?: StartCallLead[];
      leadIds?: string[];
      vapiAgentId?: string;
      vapiPhoneNumberId?: string;
      selectedVoice?: string;
    } = req.body;

    // Validate required fields
    const finalLeads: StartCallLead[] = Array.isArray(leads) && leads.length > 0
      ? leads
      : (Array.isArray(leadIds) && leadIds.length > 0 ? resolveLeadsFromIds(leadIds) : []);

    if (!finalLeads || finalLeads.length === 0) {
      const bodyKeys = Object.keys(req.body || {});
      res.status(400).json({
        error: 'Invalid payload: provide leads[] (recommended) or leadIds[] (legacy).',
        bodyKeys
      });
      return;
    }

    if (!vapiAgentId) {
      res.status(400).json({
        error: 'Vapi Agent ID is required',
        action: 'Configure Vapi Agent ID in the dashboard'
      });
      return;
    }

    if (!selectedVoice) {
      res.status(400).json({
        error: 'Voice selection is required',
        action: 'Select a voice in the dashboard'
      });
      return;
    }

    // Create Vapi client with user's API key from env (backend still needs this for API calls)
    const backendVapiKey = process.env.VAPI_API_KEY;
    if (!backendVapiKey) {
      res.status(500).json({
        error: 'Backend Vapi API key not configured',
        action: 'Contact administrator to configure VAPI_API_KEY'
      });
      return;
    }

    const vapiClient = new VapiClient(backendVapiKey);

    const candidatePhoneNumberId = (vapiPhoneNumberId || '').trim();
    const envPhoneNumberId = (process.env.VAPI_PHONE_NUMBER_ID || '').trim();
    const resolvedPhoneNumberId = looksLikeUuid(candidatePhoneNumberId) ? candidatePhoneNumberId : envPhoneNumberId;
    if (!resolvedPhoneNumberId) {
      res.status(400).json({
        error: 'Vapi phone number ID is required',
        action: 'Configure VAPI_PHONE_NUMBER_ID on the backend or enter a Vapi Phone Number ID in the dashboard'
      });
      return;
    }

    const results: any[] = [];

    for (const lead of finalLeads) {
      try {
        const normalizedPhone = normalizeE164(lead.phone);
        if (!normalizedPhone || !isValidE164(normalizedPhone)) {
          results.push({
            leadId: lead.id,
            error: 'Invalid lead phone number',
            details: `Expected E.164 format like +15551234567, got: ${maskPhone(normalizedPhone)}`
          });
          continue;
        }

        // Build personalized first message
        const personalizedFirstMessage = `Hi ${lead.name || 'there'}, I'm calling about ${lead.company || 'your business'} in ${lead.city || 'your area'}. Do you have a quick moment to chat?`;

        // Create call with user-provided config and voice
        const call = await vapiClient.createOutboundCall({
          assistantId: vapiAgentId,
          phoneNumberId: resolvedPhoneNumberId,
          customer: {
            number: normalizedPhone,
            name: lead.name || undefined
          },
          assistantOverrides: {
            variableValues: {
              name: lead.name || '',
              company: lead.company || '',
              city: lead.city || '',
              email: lead.email || '',
              personalizedMessage: personalizedFirstMessage
            }
          }
        });

        results.push({
          leadId: lead.id,
          call: { id: call.id },
          success: true
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const vapiDetails = err?.response?.data;
        console.error('Failed to create call for lead:', lead.id, { status, message: err?.message });
        results.push({
          leadId: lead.id,
          error: 'Failed to create call',
          details: vapiDetails || err.message,
          status
        });
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error('[POST /calls/start] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to start calls'
    });
  }
});

// Create outbound call
callsRouter.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId, phoneNumber, assistantId } = req.body;

    if (!leadId || !phoneNumber || !assistantId) {
      res.status(400).json({
        error: 'Missing required fields: leadId, phoneNumber, assistantId'
      });
      return;
    }

    // Fetch lead details from Supabase
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, contact_name, company_name')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Get phone number ID from environment
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      res.status(500).json({
        error: 'VAPI_PHONE_NUMBER_ID not configured. Please import Twilio number first.'
      });
      return;
    }

    // Create call via Vapi API
    const call = await vapi.createOutboundCall({
      assistantId,
      phoneNumberId,
      customer: {
        number: phoneNumber,
        name: lead.contact_name || undefined
      }
    });

    // Create call log entry in Supabase
    const { error: insertError } = await supabase.from('call_logs').insert({
      vapi_call_id: call.id,
      lead_id: leadId,
      to_number: phoneNumber,
      status: 'queued',
      metadata: {
        assistantId,
        leadName: lead.contact_name,
        company: lead.company_name
      }
    });

    if (insertError) {
      console.error('[POST /calls/create] Failed to insert call log:', insertError);
      // Don't fail the response, call was created successfully
    }

    console.log('[POST /calls/create] Call created:', {
      callId: call.id,
      leadId,
      phoneNumber
    });

    res.json({
      success: true,
      callId: call.id,
      message: `Call queued to ${phoneNumber}`
    });
  } catch (error: any) {
    console.error('[POST /calls/create] Error:', error?.response?.data || error.message);
    res.status(500).json({
      error: error?.response?.data?.message || error.message || 'Failed to create call'
    });
  }
});

// Get call details
callsRouter.get('/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const call = await vapi.getCall(callId);
    res.json(call);
  } catch (error: any) {
    console.error('[GET /calls/:id] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch call details'
    });
  }
});

// Get recording URL for a call
callsRouter.get('/:callId/recording', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    // Fetch call_logs to get recording_url or storage path
    const { data: callLog, error: callError } = await supabase
      .from('call_logs')
      .select('recording_url, recording_storage_path, recording_signed_url_expires_at, vapi_call_id')
      .eq('vapi_call_id', callId)
      .maybeSingle();

    if (callError) {
      console.error('[GET /calls/:callId/recording] DB error:', callError.message);
      res.status(500).json({ error: 'Failed to fetch call recording' });
      return;
    }

    if (!callLog) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    if (!callLog.recording_url && !callLog.recording_storage_path) {
      res.status(404).json({ error: 'No recording available for this call' });
      return;
    }

    // If it's a storage path, generate signed URL
    if (callLog.recording_storage_path) {
      const signedUrl = await getSignedRecordingUrl(callLog.recording_storage_path);
      if (!signedUrl) {
        res.status(500).json({ error: 'Failed to generate recording URL' });
        return;
      }
      res.json({ 
        recordingUrl: signedUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        expiresIn: 3600
      });
    } else if (callLog.recording_url) {
      // Direct URL from Vapi (legacy)
      res.json({ 
        recordingUrl: callLog.recording_url,
        expiresAt: callLog.recording_signed_url_expires_at,
        expiresIn: callLog.recording_signed_url_expires_at 
          ? Math.floor((new Date(callLog.recording_signed_url_expires_at).getTime() - Date.now()) / 1000)
          : 900
      });
    }
  } catch (error: any) {
    console.error('[GET /calls/:callId/recording] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

// Refresh recording URL (before expiry)
callsRouter.post('/:callId/recording/refresh', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    // Fetch call_logs to get storage path
    const { data: callLog, error: callError } = await supabase
      .from('call_logs')
      .select('recording_storage_path, vapi_call_id')
      .eq('vapi_call_id', callId)
      .maybeSingle();

    if (callError) {
      console.error('[POST /calls/:callId/recording/refresh] DB error:', callError.message);
      res.status(500).json({ error: 'Failed to refresh recording URL' });
      return;
    }

    if (!callLog || !callLog.recording_storage_path) {
      res.status(404).json({ error: 'Recording not found or not stored' });
      return;
    }

    // Generate fresh signed URL
    const signedUrl = await getSignedRecordingUrl(callLog.recording_storage_path);
    if (!signedUrl) {
      res.status(500).json({ error: 'Failed to generate recording URL' });
      return;
    }

    // Update the signed URL in database
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await supabase
      .from('call_logs')
      .update({
        recording_signed_url: signedUrl,
        recording_signed_url_expires_at: expiresAt
      })
      .eq('vapi_call_id', callId);

    res.json({ 
      recordingUrl: signedUrl,
      expiresAt,
      expiresIn: 3600
    });
  } catch (error: any) {
    console.error('[POST /calls/:callId/recording/refresh] Error:', error.message);
    res.status(500).json({ error: 'Failed to refresh recording URL' });
  }
});

// List calls
callsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    const calls = await vapi.listCalls(Number(limit));
    res.json(calls);
  } catch (error: any) {
    console.error('[GET /calls] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to list calls'
    });
  }
});

export default callsRouter;
