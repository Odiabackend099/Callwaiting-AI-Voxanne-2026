/**
 * Campaign Orchestration Service
 * Handles lead scoring, sequencing, email sending, and call scheduling
 * for the 90-day outreach campaign
 */

import { supabase } from './supabase-client';
import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD);

// Types
export interface LeadScore {
  leadId: string;
  totalScore: number;
  personaScore: number;
  geographyScore: number;
  engagementScore: number;
  priorityTier: 'A' | 'B' | 'C';
}

export interface PersonalizationData {
  google_review_count?: number;
  common_complaint?: string;
  recent_review_keywords?: string[];
  website_has_online_booking?: boolean;
  estimated_procedures_per_month?: number;
  competitor_using_ai?: boolean;
  pain_point_identified?: string;
}

export interface Lead {
  id: string;
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  clinic_name?: string;
  city?: string;
  country?: string;
  source?: string;
  personalization_data?: PersonalizationData;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  sequence_step: number;
  merge_tags: string[];
}

export interface CampaignMetrics {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  callsMade: number;
  callsAnswered: number;
  demosSent: number;
  meetingsBooked: number;
  dealsClosed: number;
  mrrAdded: number;
}

// Persona scoring weights
const PERSONA_SCORES: Record<string, number> = {
  'plastic surgeon': 10,
  'plastic surgery': 10,
  'cosmetic surgeon': 10,
  'skin care': 9,
  'skincare': 9,
  'dermatology': 9,
  'dermatologist': 9,
  'med spa': 7,
  'medspa': 7,
  'medical spa': 7,
  'aesthetics': 8,
  'aesthetic clinic': 8,
  'beauty clinic': 6,
  'default': 5
};

// Geography scoring (UK cities)
const GEOGRAPHY_SCORES: Record<string, number> = {
  'london': 10,
  'leeds': 8,
  'manchester': 8,
  'birmingham': 8,
  'bristol': 7,
  'nottingham': 7,
  'liverpool': 7,
  'sheffield': 6,
  'newcastle': 6,
  'edinburgh': 7,
  'glasgow': 7,
  'cardiff': 6,
  'default': 5
};

/**
 * Calculate lead score based on persona, geography, and engagement
 */
export async function scoreLead(leadId: string): Promise<LeadScore> {
  // Fetch lead data
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Calculate persona score
  const clinicType = (lead.source || lead.company_name || '').toLowerCase();
  let personaScore = PERSONA_SCORES['default'];
  for (const [keyword, score] of Object.entries(PERSONA_SCORES)) {
    if (clinicType.includes(keyword)) {
      personaScore = Math.max(personaScore, score);
    }
  }

  // Calculate geography score
  const city = (lead.city || '').toLowerCase();
  let geographyScore = GEOGRAPHY_SCORES['default'];
  for (const [cityName, score] of Object.entries(GEOGRAPHY_SCORES)) {
    if (city.includes(cityName)) {
      geographyScore = score;
      break;
    }
  }

  // Calculate engagement score (based on available data)
  let engagementScore = 5; // Default
  const personalization = lead.personalization_data as PersonalizationData || {};
  
  if (personalization.google_review_count) {
    if (personalization.google_review_count >= 50) engagementScore = 10;
    else if (personalization.google_review_count >= 20) engagementScore = 8;
    else if (personalization.google_review_count >= 10) engagementScore = 6;
  }
  
  if (personalization.pain_point_identified) {
    engagementScore = Math.min(10, engagementScore + 2);
  }

  // Calculate total score (weighted)
  const totalScore = Math.round(
    (personaScore * 0.4) + 
    (geographyScore * 0.3) + 
    (engagementScore * 0.3)
  ) * 10; // Scale to 0-100

  // Assign tier
  let priorityTier: 'A' | 'B' | 'C';
  if (totalScore >= 80) priorityTier = 'A';
  else if (totalScore >= 60) priorityTier = 'B';
  else priorityTier = 'C';

  const leadScore: LeadScore = {
    leadId,
    totalScore,
    personaScore,
    geographyScore,
    engagementScore,
    priorityTier
  };

  // Upsert score to database
  await supabase
    .from('lead_scores')
    .upsert({
      lead_id: leadId,
      total_score: totalScore,
      persona_score: personaScore,
      geography_score: geographyScore,
      engagement_score: engagementScore,
      priority_tier: priorityTier,
      updated_at: new Date().toISOString()
    }, { onConflict: 'lead_id' });

  return leadScore;
}

/**
 * Score all leads and assign tiers
 */
export async function scoreAllLeads(): Promise<{ tierA: number; tierB: number; tierC: number }> {
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id');

  if (error || !leads) {
    throw new Error('Failed to fetch leads');
  }

  let tierA = 0, tierB = 0, tierC = 0;

  for (const lead of leads) {
    try {
      const score = await scoreLead(lead.id);
      if (score.priorityTier === 'A') tierA++;
      else if (score.priorityTier === 'B') tierB++;
      else tierC++;
    } catch (e) {
      console.error(`Failed to score lead ${lead.id}:`, e);
    }
  }

  return { tierA, tierB, tierC };
}

/**
 * Get leads by tier
 */
export async function getLeadsByTier(tier: 'A' | 'B' | 'C'): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('lead_scores')
    .select(`
      lead_id,
      total_score,
      priority_tier,
      leads (*)
    `)
    .eq('priority_tier', tier)
    .order('total_score', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch tier ${tier} leads: ${error.message}`);
  }

  // Filter out opted-out leads to respect unsubscribe requests
  return (data || [])
    .filter((item: any) => !item.leads?.opted_out)
    .map((item: any) => ({
      ...item.leads,
      score: item.total_score,
      tier: item.priority_tier
    }));
}

/**
 * Launch campaign sequence for a list of leads
 */
export async function launchCampaignSequence(
  leadIds: string[], 
  sequenceName: string,
  totalSteps: number = 5
): Promise<{ launched: number; failed: number }> {
  let launched = 0, failed = 0;

  for (const leadId of leadIds) {
    try {
      // Skip opted-out leads (unsubscribe honored globally)
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, opted_out')
        .eq('id', leadId)
        .single();

      if (leadError || !lead || lead.opted_out) {
        console.warn(`Skipping lead ${leadId} (not found or opted out)`);
        failed++;
        continue;
      }

      // Create sequence record
      await supabase
        .from('campaign_sequences')
        .upsert({
          lead_id: leadId,
          sequence_name: sequenceName,
          current_step: 1,
          total_steps: totalSteps,
          status: 'active',
          next_contact_at: new Date().toISOString(),
          next_action: 'send_email_1'
        }, { onConflict: 'lead_id,sequence_name' });

      // Create initial pipeline stage
      await supabase
        .from('pipeline_stages')
        .insert({
          lead_id: leadId,
          stage: 'not_contacted',
          entered_at: new Date().toISOString()
        });

      launched++;
    } catch (e) {
      console.error(`Failed to launch sequence for lead ${leadId}:`, e);
      failed++;
    }
  }

  return { launched, failed };
}

/**
 * Get email template by step
 */
export async function getEmailTemplate(step: number, persona: string = 'all'): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('outreach_templates')
    .select('*')
    .eq('sequence_step', step)
    .eq('is_active', true)
    .or(`persona_target.eq.${persona},persona_target.eq.all`)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    subject: data.subject,
    body_html: data.body_html,
    body_text: data.body_text,
    sequence_step: data.sequence_step,
    merge_tags: data.merge_tags || []
  };
}

/**
 * Replace merge tags in template
 */
export function replaceMergeTags(template: string, lead: Lead, extraData: Record<string, string> = {}): string {
  const replacements: Record<string, string> = {
    '[FirstName]': lead.contact_name || lead.name || 'there',
    '[ClinicName]': lead.clinic_name || lead.company_name || 'your clinic',
    '[City]': lead.city || 'your area',
    '[Email]': lead.email || '',
    '[Phone]': lead.phone || '',
    '[PainPoint]': lead.personalization_data?.pain_point_identified || 
      'Patients often mention difficulty reaching your office by phone.',
    '[CompetitorName]': extraData.CompetitorName || 'A nearby clinic',
    '[CompetitorClinic]': extraData.CompetitorClinic || 'A competitor in your area',
    '[SimilarClinic]': extraData.SimilarClinic || 'A similar clinic',
    '[Region]': extraData.Region || lead.city || 'your region',
    '[DemoUrl]': extraData.DemoUrl || 'https://callwaitingai.dev/demo',
    '[CalendarLink]': extraData.CalendarLink || 'https://calendly.com/callwaitingai',
    '[LogoUrl]': extraData.LogoUrl || process.env.OUTREACH_LOGO_URL || 'https://callwaitingai.dev/logo.png',
    ...extraData
  };

  let result = template;
  for (const [tag, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(tag.replace(/[[\]]/g, '\\$&'), 'g'), value);
  }

  return result;
}

/**
 * Send personalized email to lead
 */
export async function sendCampaignEmail(
  leadId: string,
  templateStep: number,
  extraData: Record<string, string> = {},
  ccEmail?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead || !lead.email) {
    return { success: false, error: 'Lead not found or no email' };
  }

  // Fetch template
  const template = await getEmailTemplate(templateStep);
  if (!template) {
    return { success: false, error: `Template for step ${templateStep} not found` };
  }

  // Personalize content
  const subject = replaceMergeTags(template.subject, lead, extraData);
  const htmlBody = replaceMergeTags(template.body_html, lead, extraData);
  const textBody = replaceMergeTags(template.body_text, lead, extraData);

  const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'Austyn@callwaitingai.dev';
  const fromName = process.env.OUTREACH_FROM_NAME || 'Austyn at CallWaiting AI';
  const campaignCcEmail =
    ccEmail ||
    process.env.CAMPAIGN_CC_EMAIL ||
    'austyneguale@gmail.com';

  try {
    // Build email payload
    const emailPayload: any = {
      from: `${fromName} <${fromEmail}>`,
      to: lead.email,
      subject: subject,
      html: htmlBody,
      text: textBody
    };

    // Always use the resolved campaignCcEmail for visibility.
    // Use BCC so the lead does not see your internal address.
    if (campaignCcEmail) {
      emailPayload.bcc = [campaignCcEmail];
    }

    // Send via Resend
    const response = await resend.emails.send(emailPayload);

    // Track email
    await supabase
      .from('email_tracking')
      .insert({
        lead_id: leadId,
        email_subject: subject,
        email_variant: template.name,
        from_email: fromEmail,
        to_email: lead.email,
        cc_email: campaignCcEmail || null,
        sent_at: new Date().toISOString(),
        resend_message_id: response.data?.id
      });

    // Update sequence
    await supabase
      .from('campaign_sequences')
      .update({
        current_step: templateStep,
        last_contact_at: new Date().toISOString(),
        next_action: `send_email_${templateStep + 1}`,
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId);

    // Update pipeline stage if first contact
    if (templateStep === 1) {
      await updatePipelineStage(leadId, 'contacted');
    }

    return { success: true, messageId: response.data?.id };
  } catch (e: any) {
    console.error('Failed to send email:', e);

    // Track bounce/failure
    await supabase
      .from('email_tracking')
      .insert({
        lead_id: leadId,
        email_subject: subject,
        email_variant: template.name,
        from_email: fromEmail,
        to_email: lead.email,
        cc_email: campaignCcEmail || null,
        sent_at: new Date().toISOString(),
        bounced: true,
        bounce_reason: e.message
      });

    return { success: false, error: e.message };
  }
}

/**
 * Update pipeline stage for a lead
 */
export async function updatePipelineStage(
  leadId: string, 
  newStage: string,
  notes?: string,
  wonData?: { tier: string; mrr: number; setupFee: number }
): Promise<void> {
  // Close current stage
  await supabase
    .from('pipeline_stages')
    .update({
      exited_at: new Date().toISOString()
    })
    .eq('lead_id', leadId)
    .is('exited_at', null);

  // Create new stage
  const stageData: any = {
    lead_id: leadId,
    stage: newStage,
    entered_at: new Date().toISOString(),
    notes
  };

  if (newStage === 'closed_won' && wonData) {
    stageData.won_tier = wonData.tier;
    stageData.won_mrr = wonData.mrr;
    stageData.won_setup_fee = wonData.setupFee;
  }

  await supabase
    .from('pipeline_stages')
    .insert(stageData);

  // Update lead status
  await supabase
    .from('leads')
    .update({ 
      status: newStage === 'closed_won' ? 'converted' : 
              newStage === 'closed_lost' ? 'lost' : 'active'
    })
    .eq('id', leadId);
}

/**
 * Queue outbound call for a lead
 */
export async function queueOutboundCall(
  leadId: string,
  agentId: string,
  scheduledTime?: Date
): Promise<{ success: boolean; callId?: string; error?: string }> {
  // Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead || !lead.phone) {
    return { success: false, error: 'Lead not found or no phone number' };
  }

  // Create call tracking record
  const { data: callRecord, error: insertError } = await supabase
    .from('call_tracking')
    .insert({
      lead_id: leadId,
      agent_id: agentId,
      called_at: scheduledTime?.toISOString() || new Date().toISOString(),
      call_outcome: 'pending'
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  // Note: Actual Vapi call would be triggered here or via a separate job
  // For now, we just queue it in the database

  return { success: true, callId: callRecord.id };
}

/**
 * Get campaign metrics for dashboard
 */
export async function getCampaignMetrics(
  orgId?: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<CampaignMetrics> {
  const fromDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = dateTo || new Date();

  // Email metrics
  const { data: emailData } = await supabase
    .from('email_tracking')
    .select('id, opened_at, clicked_at, bounced')
    .gte('sent_at', fromDate.toISOString())
    .lte('sent_at', toDate.toISOString());

  const emailsSent = emailData?.length || 0;
  const emailsOpened = emailData?.filter(e => e.opened_at).length || 0;
  const emailsClicked = emailData?.filter(e => e.clicked_at).length || 0;

  // Call metrics
  const { data: callData } = await supabase
    .from('call_tracking')
    .select('id, answered, demo_sent, meeting_booked')
    .gte('called_at', fromDate.toISOString())
    .lte('called_at', toDate.toISOString());

  const callsMade = callData?.length || 0;
  const callsAnswered = callData?.filter(c => c.answered).length || 0;
  const demosSent = callData?.filter(c => c.demo_sent).length || 0;
  const meetingsBooked = callData?.filter(c => c.meeting_booked).length || 0;

  // Pipeline metrics
  const { data: wonDeals } = await supabase
    .from('pipeline_stages')
    .select('won_mrr, won_setup_fee')
    .eq('stage', 'closed_won')
    .gte('entered_at', fromDate.toISOString())
    .lte('entered_at', toDate.toISOString());

  const dealsClosed = wonDeals?.length || 0;
  const mrrAdded = wonDeals?.reduce((sum, d) => sum + (d.won_mrr || 0), 0) || 0;

  return {
    emailsSent,
    emailsOpened,
    emailsClicked,
    callsMade,
    callsAnswered,
    demosSent,
    meetingsBooked,
    dealsClosed,
    mrrAdded
  };
}

/**
 * Get pipeline summary
 */
export async function getPipelineSummary(): Promise<Record<string, number>> {
  const stages = [
    'not_contacted',
    'contacted',
    'demo_sent',
    'demo_viewed',
    'meeting_booked',
    'meeting_held',
    'proposal_sent',
    'negotiating',
    'closed_won',
    'closed_lost'
  ];

  const summary: Record<string, number> = {};

  for (const stage of stages) {
    const { count } = await supabase
      .from('pipeline_stages')
      .select('*', { count: 'exact', head: true })
      .eq('stage', stage)
      .is('exited_at', null);

    summary[stage] = count || 0;
  }

  return summary;
}

/**
 * Get leads needing follow-up
 */
export async function getLeadsNeedingFollowUp(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('campaign_sequences')
    .select(`
      lead_id,
      current_step,
      next_action,
      next_contact_at,
      leads (*)
    `)
    .eq('status', 'active')
    .lte('next_contact_at', new Date().toISOString())
    .order('next_contact_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch follow-ups: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    ...item.leads,
    currentStep: item.current_step,
    nextAction: item.next_action
  }));
}

/**
 * Handle call outcome and queue follow-ups
 */
export async function handleCallOutcome(
  leadId: string,
  callId: string,
  interested: boolean,
  demoBooked: boolean,
  notes?: string
): Promise<void> {
  try {
    // Fetch lead
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead) {
      console.error('Lead not found for follow-up', { leadId });
      return;
    }

    // Update lead status
    const newStatus = interested ? 'qualified' : 'not_interested';
    await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);

    // Queue follow-up based on outcome
    if (interested && !demoBooked) {
      // Send follow-up email for interested leads
      await sendCampaignEmail(leadId, 1, {
        ClinicName: lead.clinic_name || lead.company_name || 'your clinic',
        FirstName: lead.contact_name || lead.name || 'there',
        City: lead.city || 'your area',
      });
    } else if (demoBooked) {
      // Send demo confirmation email
      await sendCampaignEmail(leadId, 2, {
        ClinicName: lead.clinic_name || lead.company_name || 'your clinic',
        FirstName: lead.contact_name || lead.name || 'there',
        City: lead.city || 'your area',
      });
    } else if (!interested) {
      // Send nurture email for not interested
      await sendCampaignEmail(leadId, 3, {
        ClinicName: lead.clinic_name || lead.company_name || 'your clinic',
        FirstName: lead.contact_name || lead.name || 'there',
        City: lead.city || 'your area',
      });
    }

    console.log('Follow-up queued', { leadId, status: newStatus });
  } catch (err) {
    console.error('Failed to handle call outcome', { error: err });
  }
}

export default {
  scoreLead,
  scoreAllLeads,
  getLeadsByTier,
  launchCampaignSequence,
  sendCampaignEmail,
  updatePipelineStage,
  queueOutboundCall,
  getCampaignMetrics,
  getPipelineSummary,
  getLeadsNeedingFollowUp,
  handleCallOutcome
};
