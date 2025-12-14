import { supabase } from './supabase-client';
import { sendEmailViaSmtp } from './email-service';
import { sendSmsTwilio, sendWhatsAppTwilio } from './twilio-service';

// Types
export interface DemoRecipient {
  name: string;
  email?: string;
  phone?: string;
  clinic_name: string;
}

export interface DemoContext {
  demo_type: 'outbound_intro' | 'inbound_intro' | 'feature_overview';
  agent_id: string;
  call_id?: string;
}

// Helper: Get Demo Asset
async function getDemoAsset(org_id: string, demo_type: string) {
  const { data, error } = await supabase
    .from('demo_assets')
    .select('id, url')
    .eq('org_id', org_id)
    .eq('demo_type', demo_type)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error(`Error fetching demo asset for type ${demo_type}:`, error);
    return null;
  }
  return data || null;
}

// Helper: Create Booking
async function createDemoBooking(org_id: string, agent_id: string, recipient: DemoRecipient, context: DemoContext) {
  const { data, error } = await supabase
    .from('demo_bookings')
    .insert([
      {
        org_id,
        agent_id,
        prospect_name: recipient.name,
        prospect_email: recipient.email,
        prospect_phone: recipient.phone,
        clinic_name: recipient.clinic_name,
        call_id: context.call_id,
        status: 'pending'
      }
    ])
    .select('id')
    .single();

  if (error) {
    console.error('Error creating demo booking:', error);
    return null;
  }
  return data?.id || null;
}

// Helper: Log Send
async function logDemoSend(
  demo_booking_id: string,
  org_id: string,
  channel: string,
  recipient_address: string,
  demo_url: string,
  asset_id?: string
) {
  await supabase.from('demo_send_log').insert([
    {
      demo_booking_id,
      org_id,
      channel,
      asset_id,
      recipient_address,
      demo_url,
      status: 'pending'
    }
  ]);
}

// Service: Send Demo Email
export async function sendDemoEmail(recipient: DemoRecipient, context: DemoContext) {
  if (!recipient.email) throw new Error('Email required');

  // Get agent to find org
  const { data: agent } = await supabase
    .from('agents')
    .select('org_id')
    .eq('id', context.agent_id)
    .single();

  if (!agent) throw new Error('Agent not found');

  // Get demo asset
  const demoAsset = await getDemoAsset(agent.org_id, context.demo_type);
  if (!demoAsset) throw new Error(`No demo asset found for type: ${context.demo_type}`);

  // Create booking
  const bookingId = await createDemoBooking(agent.org_id, context.agent_id, recipient, context);
  if (!bookingId) throw new Error('Failed to create demo booking');

  // Send email
  const emailSubject = `Your Voxanne AI Demo - ${recipient.clinic_name}`;
  const emailBody = `
Hi ${recipient.name},

Thanks for your interest in Voxanne, the AI receptionist for ${recipient.clinic_name}!

Here's your personalized demo: ${demoAsset.url}

This 60-90 second video shows exactly how Voxanne can:
✓ Answer 24/7 calls
✓ Book appointments automatically
✓ Qualify leads in real-time
✓ Recover revenue from missed calls

If you have questions or want to schedule a live walkthrough, just reply to this email!

Best regards,
The Voxanne Team
CallWaiting AI
https://callwaitingai.dev
  `;

  const emailResult = await sendEmailViaSmtp({
    to: recipient.email,
    to_name: recipient.name,
    subject: emailSubject,
    html: emailBody,
    text: emailBody
  });

  if (!emailResult.success) throw new Error(emailResult.error || 'Failed to send email');

  // Log and update
  await logDemoSend(bookingId, agent.org_id, 'email', recipient.email, demoAsset.url, demoAsset.id);
  await supabase.from('demo_bookings').update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq('id', bookingId);

  return { success: true, booking_id: bookingId, demo_url: demoAsset.url };
}

// Service: Send Demo SMS
export async function sendDemoSms(recipient: DemoRecipient, context: DemoContext) {
  if (!recipient.phone) throw new Error('Phone required');

  const { data: agent } = await supabase.from('agents').select('org_id').eq('id', context.agent_id).single();
  if (!agent) throw new Error('Agent not found');

  const demoAsset = await getDemoAsset(agent.org_id, context.demo_type);
  if (!demoAsset) throw new Error(`No demo asset found for type: ${context.demo_type}`);

  const bookingId = await createDemoBooking(agent.org_id, context.agent_id, recipient, context);
  if (!bookingId) throw new Error('Failed to create demo booking');

  const smsMessage = `Hi ${recipient.name}! Watch your Voxanne AI demo here: ${demoAsset.url} - See how we capture 100% of calls 24/7!`;

  const smsResult = await sendSmsTwilio({ to: recipient.phone, message: smsMessage });
  if (!smsResult.success) throw new Error(smsResult.error || 'Failed to send SMS');

  await logDemoSend(bookingId, agent.org_id, 'sms', recipient.phone, demoAsset.url, demoAsset.id);
  await supabase.from('demo_bookings').update({ sms_sent: true, sms_sent_at: new Date().toISOString() }).eq('id', bookingId);

  return { success: true, booking_id: bookingId, demo_url: demoAsset.url };
}

// Service: Send Demo WhatsApp
export async function sendDemoWhatsApp(recipient: DemoRecipient, context: DemoContext) {
  if (!recipient.phone) throw new Error('Phone required');

  const { data: agent } = await supabase.from('agents').select('org_id').eq('id', context.agent_id).single();
  if (!agent) throw new Error('Agent not found');

  const demoAsset = await getDemoAsset(agent.org_id, context.demo_type);
  if (!demoAsset) throw new Error(`No demo asset found for type: ${context.demo_type}`);

  const bookingId = await createDemoBooking(agent.org_id, context.agent_id, recipient, context);
  if (!bookingId) throw new Error('Failed to create demo booking');

  const whatsappMessage = `Hi ${recipient.name}! 👋\n\nHere's your Voxanne AI demo: ${demoAsset.url}\n\nSee how we answer 100% of calls 24/7! 📞✨`;

  const whatsappResult = await sendWhatsAppTwilio({ to: recipient.phone, message: whatsappMessage });
  if (!whatsappResult.success) throw new Error(whatsappResult.error || 'Failed to send WhatsApp');

  await logDemoSend(bookingId, agent.org_id, 'whatsapp', recipient.phone, demoAsset.url, demoAsset.id);
  await supabase.from('demo_bookings').update({ whatsapp_sent: true, whatsapp_sent_at: new Date().toISOString() }).eq('id', bookingId);

  return { success: true, booking_id: bookingId, demo_url: demoAsset.url };
}
