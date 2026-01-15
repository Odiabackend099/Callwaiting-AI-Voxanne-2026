/**
 * Contextual Memory Hand-off System
 * 
 * Detects when an Inbound Agent call ends WITHOUT booking confirmation,
 * extracts context (lead keyword, service type), and triggers Outbound Agent
 * (Sarah) to follow up with contextually relevant SMS.
 * 
 * Example:
 * - Patient: "I'm interested in Rhinoplasty"
 * - Call ends without booking
 * - System triggers: Sarah → SMS with "Rhinoplasty Guide PDF" link
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

interface VapiCallWebhook {
  event: string;
  data: {
    call: {
      id: string;
      status: "ended" | "active" | "ringing";
      startedAt: string;
      endedAt: string;
      duration: number;
      transcript?: string;
      messages?: Array<{
        role: "user" | "assistant";
        message: string;
      }>;
      leadId?: string;
      clinicId?: string;
      assistant?: {
        name: string;
      };
      messages_metadata?: {
        keywords?: string[];
        entities?: {
          service_type?: string;
          treatment?: string;
          provider_mentioned?: string;
        };
      };
    };
  };
}

interface ContextMemory {
  lead_id: string;
  clinic_id: string;
  primary_keyword: string;
  keywords: string[];
  service_type?: string;
  transcript_excerpt?: string;
  confidence_score: number;
}

interface OutboundCampaign {
  id: string;
  lead_id: string;
  clinic_id: string;
  campaign_type: "follow_up_sms" | "follow_up_call" | "educational_content";
  context_memory: ContextMemory;
  assigned_to_agent: string; // e.g., "Sarah"
  trigger_event: string;
  triggered_at: string;
  scheduled_for?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  metadata: {
    pdf_guide_url?: string;
    message_template?: string;
    max_retries?: number;
  };
}

/**
 * Process Vapi webhook for call_ended events
 * 
 * Detects if call ended without booking, extracts context,
 * and triggers outbound campaign
 * 
 * @param webhook - Vapi webhook payload
 * @param supabase - Supabase client
 * @returns Outbound campaign details or null if booking was confirmed
 */
export async function handleVapiCallEnded(
  webhook: VapiCallWebhook,
  supabase: ReturnType<typeof createClient>
): Promise<OutboundCampaign | null> {
  const { call } = webhook.data;

  // Only process ended calls
  if (call.status !== "ended") {
    return null;
  }

  // Get lead and clinic info
  const leadId = call.leadId;
  const clinicId = call.clinicId;

  if (!leadId || !clinicId) {
    console.warn("Missing leadId or clinicId in webhook");
    return null;
  }

  try {
    // Step 1: Check if booking was confirmed
    const bookingConfirmed = await wasBookingConfirmed(
      supabase,
      leadId,
      call.id
    );

    if (bookingConfirmed) {
      console.log(`Lead ${leadId}: Booking confirmed, no follow-up needed`);
      return null;
    }

    // Step 2: Extract context memory from transcript
    const contextMemory = await extractContextMemory(
      supabase,
      call.transcript || "",
      leadId,
      clinicId,
      call.messages_metadata
    );

    if (!contextMemory) {
      console.warn(`Failed to extract context for lead ${leadId}`);
      return null;
    }

    // Step 3: Get PDF guide URL for the service type
    const pdfGuideUrl = await getPdfGuideUrl(
      supabase,
      clinicId,
      contextMemory.service_type || contextMemory.primary_keyword
    );

    // Step 4: Create outbound campaign
    const campaign = await createOutboundCampaign(
      supabase,
      {
        lead_id: leadId,
        clinic_id: clinicId,
        campaign_type: "follow_up_sms",
        context_memory: contextMemory,
        assigned_to_agent: "Sarah", // Outbound Agent
        trigger_event: `call_ended_no_booking[${call.id}]`,
        metadata: {
          pdf_guide_url: pdfGuideUrl,
          message_template: `Hi {first_name}! 👋 We loved chatting about your ${contextMemory.primary_keyword} inquiry. Here's your personalized guide: ${pdfGuideUrl}. When ready to book, just reply YES!`,
        },
      }
    );

    console.log(
      `✅ Outbound campaign created for lead ${leadId}: ${campaign.id}`
    );

    return campaign;
  } catch (error) {
    console.error("Error handling Vapi call webhook:", error);
    return null;
  }
}

/**
 * Check if a booking was confirmed during the call
 * 
 * @param supabase - Supabase client
 * @param lead_id - Lead identifier
 * @param call_id - Vapi call identifier
 * @returns true if booking confirmed
 */
async function wasBookingConfirmed(
  supabase: ReturnType<typeof createClient>,
  lead_id: string,
  call_id: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("contact_id", lead_id)
      .eq("vapi_call_id", call_id)
      .eq("status", "confirmed")
      .single();

    return !!data;
  } catch (err) {
    // No appointment found = no booking
    return false;
  }
}

/**
 * Extract context memory from call transcript
 * 
 * Uses keyword extraction and NER to identify:
 * - Primary service type (Rhinoplasty, Facelift, etc.)
 * - Secondary keywords
 * - Confidence score
 * 
 * @param supabase - Supabase client
 * @param transcript - Call transcript
 * @param lead_id - Lead identifier
 * @param clinic_id - Clinic identifier
 * @param metadata - Pre-extracted metadata from AI
 * @returns Context memory object
 */
async function extractContextMemory(
  supabase: ReturnType<typeof createClient>,
  transcript: string,
  lead_id: string,
  clinic_id: string,
  metadata?: {
    keywords?: string[];
    entities?: Record<string, string>;
  }
): Promise<ContextMemory | null> {
  if (!transcript && !metadata) {
    return null;
  }

  // Keywords to match against (cosmetic procedures)
  const serviceKeywords = [
    "rhinoplasty",
    "facelift",
    "liposuction",
    "breast",
    "botox",
    "filler",
    "laser",
    "skin",
    "abdominoplasty",
    "tummy tuck",
    "implant",
  ];

  let primaryKeyword = "";
  let confidence = 0;

  // Method 1: Use pre-extracted metadata from Vapi AI
  if (metadata?.entities?.service_type) {
    primaryKeyword = metadata.entities.service_type.toLowerCase();
    confidence = 0.95;
  }

  // Method 2: Simple keyword matching in transcript
  if (!primaryKeyword && transcript) {
    const transcriptLower = transcript.toLowerCase();
    for (const keyword of serviceKeywords) {
      if (transcriptLower.includes(keyword)) {
        primaryKeyword = keyword;
        confidence = 0.8;
        break;
      }
    }
  }

  // Method 3: Use metadata keywords
  if (!primaryKeyword && metadata?.keywords) {
    primaryKeyword = metadata.keywords[0];
    confidence = 0.7;
  }

  if (!primaryKeyword) {
    return null;
  }

  // Extract all matching keywords
  const allKeywords = [];
  const transcriptLower = transcript.toLowerCase();
  for (const keyword of serviceKeywords) {
    if (transcriptLower.includes(keyword)) {
      allKeywords.push(keyword);
    }
  }

  // Get service type from catalog
  const serviceType = await getServiceTypeFromKeyword(
    supabase,
    clinic_id,
    primaryKeyword
  );

  return {
    lead_id,
    clinic_id,
    primary_keyword: primaryKeyword,
    keywords: Array.from(new Set(allKeywords)), // deduplicate
    service_type: serviceType || primaryKeyword,
    transcript_excerpt: transcript.substring(0, 200),
    confidence_score: confidence,
  };
}

/**
 * Get standardized service type from keyword
 * 
 * @param supabase - Supabase client
 * @param clinic_id - Clinic identifier
 * @param keyword - Search keyword
 * @returns Service type name
 */
async function getServiceTypeFromKeyword(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  keyword: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("services")
      .select("name, aliases")
      .eq("clinic_id", clinic_id)
      .ilike("aliases", `%${keyword}%`)
      .single();

    return data?.name || null;
  } catch (err) {
    return null;
  }
}

/**
 * Get PDF guide URL for a service
 * 
 * Retrieves marketing materials (guide PDFs) specific to service type
 * 
 * @param supabase - Supabase client
 * @param clinic_id - Clinic identifier
 * @param service_type - Service name or keyword
 * @returns PDF guide URL
 */
async function getPdfGuideUrl(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  service_type: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("marketing_assets")
      .select("asset_url")
      .eq("clinic_id", clinic_id)
      .eq("asset_type", "pdf_guide")
      .ilike("title", `%${service_type}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return data?.asset_url || null;
  } catch (err) {
    return null;
  }
}

/**
 * Create outbound campaign record
 * 
 * Inserts campaign and schedules with outbound agent queue
 * 
 * @param supabase - Supabase client
 * @param campaign - Campaign details
 * @returns Created campaign with ID
 */
async function createOutboundCampaign(
  supabase: ReturnType<typeof createClient>,
  campaign: Omit<OutboundCampaign, "id" | "triggered_at" | "status">
): Promise<OutboundCampaign> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("outbound_campaigns")
    .insert({
      lead_id: campaign.lead_id,
      clinic_id: campaign.clinic_id,
      campaign_type: campaign.campaign_type,
      context_memory: campaign.context_memory,
      assigned_to_agent: campaign.assigned_to_agent,
      trigger_event: campaign.trigger_event,
      triggered_at: now,
      status: "pending",
      metadata: campaign.metadata,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    ...campaign,
    id: data.id,
    triggered_at: now,
    status: "pending",
  };
}

/**
 * Process outbound campaign (for Outbound Agent queue)
 * 
 * Called by edge function to send SMS via designated agent
 * 
 * @param supabase - Supabase client
 * @param campaign_id - Campaign identifier
 * @returns Success status
 */
export async function executeOutboundCampaign(
  supabase: ReturnType<typeof createClient>,
  campaign_id: string
): Promise<{ success: boolean; message: string; sms_id?: string }> {
  try {
    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("*, leads(phone_number, first_name)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    // Get lead phone and personalize message
    const lead = campaign.leads;
    const message = campaign.metadata.message_template
      .replace("{first_name}", lead.first_name || "there")
      .replace("{service_keyword}", campaign.context_memory.primary_keyword);

    // Send SMS via Twilio (or configured SMS provider)
    const smsResult = await sendSmsViaProvider(
      lead.phone_number,
      message,
      campaign.clinic_id
    );

    if (!smsResult.success) {
      throw new Error(`SMS send failed: ${smsResult.error}`);
    }

    // Update campaign status
    await supabase
      .from("outbound_campaigns")
      .update({
        status: "completed",
        metadata: {
          ...campaign.metadata,
          sms_id: smsResult.sms_id,
          sent_at: new Date().toISOString(),
        },
      })
      .eq("id", campaign_id);

    return {
      success: true,
      message: `SMS sent successfully to ${lead.phone_number}`,
      sms_id: smsResult.sms_id,
    };
  } catch (err) {
    // Mark campaign as failed
    await supabase
      .from("outbound_campaigns")
      .update({ status: "failed" })
      .eq("id", campaign_id);

    return {
      success: false,
      message: `Campaign execution failed: ${err}`,
    };
  }
}

/**
 * Send SMS via configured provider (mock implementation)
 * 
 * @param phone - Recipient phone number
 * @param message - SMS message content
 * @param clinic_id - Clinic for provider config lookup
 * @returns SMS send result with ID
 */
async function sendSmsViaProvider(
  phone: string,
  message: string,
  clinic_id: string
): Promise<{ success: boolean; sms_id?: string; error?: string }> {
  // TODO: Implement Twilio/SMS provider integration
  // For now, mock success
  return {
    success: true,
    sms_id: `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };
}
