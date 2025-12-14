/**
 * Campaign API Routes
 * Endpoints for campaign orchestration, lead management, and outreach
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import campaignOrchestration, {
  scoreLead,
  scoreAllLeads,
  getLeadsByTier,
  launchCampaignSequence,
  sendCampaignEmail,
  updatePipelineStage,
  queueOutboundCall,
  getCampaignMetrics,
  getPipelineSummary,
  getLeadsNeedingFollowUp
} from '../services/campaign-orchestration';

const router = Router();

// ============================================
// LEAD SCORING ENDPOINTS
// ============================================

/**
 * POST /api/campaigns/score-lead
 * Score a single lead
 */
router.post('/score-lead', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      res.status(400).json({ error: 'Missing leadId' });
      return;
    }

    const score = await scoreLead(leadId);
    res.json({ success: true, score });
  } catch (error: any) {
    console.error('[POST /campaigns/score-lead] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/campaigns/opt-out
 * Mark a lead as opted out of all campaigns and stop sequences
 */
router.post('/opt-out', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      res.status(400).json({ error: 'Missing leadId' });
      return;
    }

    // Mark lead as opted out and set status to lost
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({ opted_out: true, status: 'lost' })
      .eq('id', leadId);

    if (updateLeadError) {
      throw updateLeadError;
    }

    // Pause any active sequences for this lead
    const { error: updateSeqError } = await supabase
      .from('campaign_sequences')
      .update({ status: 'opted_out', updated_at: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('status', 'active');

    if (updateSeqError) {
      throw updateSeqError;
    }

    res.json({ success: true, message: 'Lead opted out of campaigns' });
  } catch (error: any) {
    console.error('[POST /campaigns/opt-out] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/campaigns/score-all
 * Score all leads and assign tiers
 */
router.post('/score-all', async (req: Request, res: Response) => {
  try {
    const result = await scoreAllLeads();
    res.json({ 
      success: true, 
      message: `Scored all leads: ${result.tierA} Tier A, ${result.tierB} Tier B, ${result.tierC} Tier C`,
      ...result 
    });
  } catch (error: any) {
    console.error('[POST /campaigns/score-all] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/campaigns/leads/:tier
 * Get leads by tier (A, B, or C)
 */
router.get('/leads/:tier', async (req: Request, res: Response): Promise<void> => {
  try {
    const tier = req.params.tier.toUpperCase() as 'A' | 'B' | 'C';
    
    if (!['A', 'B', 'C'].includes(tier)) {
      res.status(400).json({ error: 'Invalid tier. Must be A, B, or C' });
      return;
    }

    const leads = await getLeadsByTier(tier);
    res.json({ success: true, tier, count: leads.length, leads });
  } catch (error: any) {
    console.error('[GET /campaigns/leads/:tier] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CAMPAIGN SEQUENCE ENDPOINTS
// ============================================

/**
 * POST /api/campaigns/launch
 * Launch campaign sequence for a tier or list of leads
 */
router.post('/launch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tier, leadIds, sequenceName } = req.body;

    let targetLeadIds: string[] = leadIds || [];

    // If tier specified, get leads from that tier
    if (tier && !leadIds) {
      const tierLeads = await getLeadsByTier(tier.toUpperCase());
      targetLeadIds = tierLeads.map(l => l.id);
    }

    if (targetLeadIds.length === 0) {
      res.status(400).json({ error: 'No leads to launch campaign for' });
      return;
    }

    const name = sequenceName || `tier_${tier?.toLowerCase() || 'custom'}_campaign`;
    const result = await launchCampaignSequence(targetLeadIds, name);

    res.json({
      success: true,
      message: `Launched ${name} for ${result.launched} leads`,
      ...result
    });
  } catch (error: any) {
    console.error('[POST /campaigns/launch] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/campaigns/sequences
 * Get all active campaign sequences
 */
router.get('/sequences', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('campaign_sequences')
      .select(`
        *,
        leads (id, contact_name, company_name, email, city)
      `)
      .order('next_contact_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ success: true, count: data?.length || 0, sequences: data });
  } catch (error: any) {
    console.error('[GET /campaigns/sequences] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/campaigns/sequences/:id
 * Update a campaign sequence (pause, resume, etc.)
 */
router.patch('/sequences/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, nextAction, nextContactAt } = req.body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (nextAction) updateData.next_action = nextAction;
    if (nextContactAt) updateData.next_contact_at = nextContactAt;

    const { data, error } = await supabase
      .from('campaign_sequences')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, sequence: data });
  } catch (error: any) {
    console.error('[PATCH /campaigns/sequences/:id] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMAIL ENDPOINTS
// ============================================

/**
 * POST /api/campaigns/send-email
 * Send personalized email to a lead
 */
router.post('/send-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId, templateStep, extraData, ccEmail } = req.body;

    if (!leadId) {
      res.status(400).json({ error: 'Missing leadId' });
      return;
    }

    const step = templateStep || 1;
    const result = await sendCampaignEmail(leadId, step, extraData || {}, ccEmail);

    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('[POST /campaigns/send-email] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/campaigns/send-batch-emails
 * Send emails to multiple leads (with rate limiting)
 */
router.post('/send-batch-emails', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadIds, templateStep, extraData, delayMs, ccEmail } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ error: 'Missing or invalid leadIds array' });
      return;
    }

    // Limit batch size to prevent overload
    const maxBatch = 50;
    if (leadIds.length > maxBatch) {
      res.status(400).json({
        error: `Batch size too large. Maximum ${maxBatch} emails per request.`
      });
      return;
    }

    // DAILY WARM-UP CAP: limit total emails sent per day during warm-up
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('email_tracking')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .lte('sent_at', `${today}T23:59:59.999Z`);

    const dailyCap = Number(process.env.CAMPAIGN_DAILY_CAP || 20);
    if ((count || 0) >= dailyCap) {
      res.status(429).json({
        error: 'Daily warm-up cap reached. Try again tomorrow or increase CAMPAIGN_DAILY_CAP.'
      });
      return;
    }

    const step = templateStep || 1;
    const delay = delayMs || 2000; // 2 second delay between emails by default
    const results: { leadId: string; success: boolean; error?: string }[] = [];

    for (const leadId of leadIds) {
      const result = await sendCampaignEmail(leadId, step, extraData || {}, ccEmail);
      results.push({ leadId, success: result.success, error: result.error });

      // Rate limiting delay
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Sent ${sent} emails, ${failed} failed`,
      sent,
      failed,
      results
    });
  } catch (error: any) {
    console.error('[POST /campaigns/send-batch-emails] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/campaigns/email-tracking
 * Get email tracking data
 */
router.get('/email-tracking', async (req: Request, res: Response) => {
  try {
    const { leadId, limit } = req.query;

    let query = supabase
      .from('email_tracking')
      .select(`
        *,
        leads (id, contact_name, company_name, email)
      `)
      .order('sent_at', { ascending: false })
      .limit(Number(limit) || 100);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ success: true, count: data?.length || 0, emails: data });
  } catch (error: any) {
    console.error('[GET /campaigns/email-tracking] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/campaigns/track-email-event
 * Track email open/click events (webhook from Resend)
 */
router.post('/track-email-event', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId, eventType, timestamp } = req.body;

    if (!messageId || !eventType) {
      res.status(400).json({ error: 'Missing messageId or eventType' });
      return;
    }

    const updateData: any = {};
    const eventTime = timestamp || new Date().toISOString();

    switch (eventType) {
      case 'delivered':
        updateData.delivered_at = eventTime;
        break;
      case 'opened':
        updateData.opened_at = eventTime;
        break;
      case 'clicked':
        updateData.clicked_at = eventTime;
        break;
      case 'bounced':
        updateData.bounced = true;
        break;
      case 'complained':
        updateData.spam_complaint = true;
        break;
    }

    const { error } = await supabase
      .from('email_tracking')
      .update(updateData)
      .eq('resend_message_id', messageId);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[POST /campaigns/track-email-event] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CALL ENDPOINTS
// ============================================

/**
 * POST /api/campaigns/queue-call
 * Queue an outbound call for a lead
 */
router.post('/queue-call', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId, agentId, scheduledTime } = req.body;

    if (!leadId || !agentId) {
      res.status(400).json({ error: 'Missing leadId or agentId' });
      return;
    }

    const scheduled = scheduledTime ? new Date(scheduledTime) : undefined;
    const result = await queueOutboundCall(leadId, agentId, scheduled);

    if (result.success) {
      res.json({ success: true, callId: result.callId });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('[POST /campaigns/queue-call] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/campaigns/queue-calls
 * Queue multiple outbound calls
 */
router.post('/queue-calls', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadIds, agentId, scheduledTime } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || !agentId) {
      res.status(400).json({ error: 'Missing leadIds array or agentId' });
      return;
    }

    const scheduled = scheduledTime ? new Date(scheduledTime) : undefined;
    const results: { leadId: string; success: boolean; callId?: string; error?: string }[] = [];

    for (const leadId of leadIds) {
      const result = await queueOutboundCall(leadId, agentId, scheduled);
      results.push({ leadId, ...result });
    }

    const queued = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Queued ${queued} calls, ${failed} failed`,
      queued,
      failed,
      results
    });
  } catch (error: any) {
    console.error('[POST /campaigns/queue-calls] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/campaigns/call-tracking
 * Get call tracking data
 */
router.get('/call-tracking', async (req: Request, res: Response) => {
  try {
    const { leadId, limit } = req.query;

    let query = supabase
      .from('call_tracking')
      .select(`
        *,
        leads (id, contact_name, company_name, phone)
      `)
      .order('called_at', { ascending: false })
      .limit(Number(limit) || 100);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ success: true, count: data?.length || 0, calls: data });
  } catch (error: any) {
    console.error('[GET /campaigns/call-tracking] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PIPELINE ENDPOINTS
// ============================================

/**
 * GET /api/campaigns/pipeline
 * Get pipeline visualization data
 */
router.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const summary = await getPipelineSummary();

    // Get leads in each stage with details
    const { data: pipelineData, error } = await supabase
      .from('pipeline_stages')
      .select(`
        *,
        leads (id, contact_name, company_name, email, city, phone)
      `)
      .is('exited_at', null)
      .order('entered_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Group by stage
    const stages: Record<string, any[]> = {};
    for (const item of pipelineData || []) {
      const stage = item.stage;
      if (!stages[stage]) stages[stage] = [];
      stages[stage].push({
        ...item.leads,
        enteredAt: item.entered_at,
        notes: item.notes
      });
    }

    res.json({ success: true, summary, stages });
  } catch (error: any) {
    console.error('[GET /campaigns/pipeline] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/campaigns/pipeline/:leadId
 * Update lead pipeline stage
 */
router.patch('/pipeline/:leadId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;
    const { stage, notes, wonData } = req.body;

    if (!stage) {
      res.status(400).json({ error: 'Missing stage' });
      return;
    }

    await updatePipelineStage(leadId, stage, notes, wonData);

    res.json({ success: true, message: `Lead moved to ${stage}` });
  } catch (error: any) {
    console.error('[PATCH /campaigns/pipeline/:leadId] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// METRICS ENDPOINTS
// ============================================

/**
 * GET /api/campaigns/metrics
 * Get campaign metrics for dashboard
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const from = dateFrom ? new Date(dateFrom as string) : undefined;
    const to = dateTo ? new Date(dateTo as string) : undefined;

    const metrics = await getCampaignMetrics(undefined, from, to);
    const pipeline = await getPipelineSummary();

    // Calculate rates
    const openRate = metrics.emailsSent > 0 
      ? ((metrics.emailsOpened / metrics.emailsSent) * 100).toFixed(1) 
      : '0';
    const clickRate = metrics.emailsSent > 0 
      ? ((metrics.emailsClicked / metrics.emailsSent) * 100).toFixed(1) 
      : '0';
    const answerRate = metrics.callsMade > 0 
      ? ((metrics.callsAnswered / metrics.callsMade) * 100).toFixed(1) 
      : '0';

    res.json({
      success: true,
      metrics: {
        ...metrics,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        answerRate: `${answerRate}%`
      },
      pipeline,
      mrrProgress: {
        current: metrics.mrrAdded,
        target: 25000,
        percentage: ((metrics.mrrAdded / 25000) * 100).toFixed(1)
      }
    });
  } catch (error: any) {
    console.error('[GET /campaigns/metrics] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/campaigns/follow-ups
 * Get leads needing follow-up
 */
router.get('/follow-ups', async (req: Request, res: Response) => {
  try {
    const leads = await getLeadsNeedingFollowUp();
    res.json({ success: true, count: leads.length, leads });
  } catch (error: any) {
    console.error('[GET /campaigns/follow-ups] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEMPLATE ENDPOINTS
// ============================================

/**
 * GET /api/campaigns/templates
 * Get all email templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('outreach_templates')
      .select('*')
      .order('sequence_step', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ success: true, templates: data });
  } catch (error: any) {
    console.error('[GET /campaigns/templates] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/campaigns/templates/:id
 * Update an email template
 */
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subject, body_html, body_text, is_active } = req.body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (subject) updateData.subject = subject;
    if (body_html) updateData.body_html = body_html;
    if (body_text) updateData.body_text = body_text;
    if (typeof is_active === 'boolean') updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('outreach_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, template: data });
  } catch (error: any) {
    console.error('[PUT /campaigns/templates/:id] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
