import { ContactFormInput, OnboardingFormInput } from './validation-schemas';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Store contact form submission in database
 */
export async function storeContactSubmission(data: ContactFormInput): Promise<{ id: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('Supabase credentials not configured - submission will not be stored');
    return { id: 'mock-' + Date.now() };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/contact_submissions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
        created_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error:', error);
      throw new Error(`Failed to store submission: ${response.status}`);
    }

    const result: SupabaseResponse<{ id: string }[]> = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (result.data && result.data.length > 0) {
      return { id: result.data[0].id };
    }

    return { id: 'unknown' };
  } catch (error) {
    console.error('Error storing contact submission:', error);
    // Don't throw - allow form submission even if database storage fails
    return { id: 'error-' + Date.now() };
  }
}

/**
 * Store onboarding form submission in database
 */
export async function storeOnboardingSubmission(data: OnboardingFormInput): Promise<{ id: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('Supabase credentials not configured - submission will not be stored');
    return { id: 'mock-' + Date.now() };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_submissions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        company_name: data.company,
        company_website: data.website || null,
        contact_email: data.email,
        contact_phone: data.phone,
        greeting_script: data.greetingScript,
        pricing_pdf_url: data.pricingPdfUrl || null,
        additional_details: data.additionalDetails || null,
        created_at: new Date().toISOString(),
        status: 'pending',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error:', error);
      throw new Error(`Failed to store submission: ${response.status}`);
    }

    const result: SupabaseResponse<{ id: string }[]> = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (result.data && result.data.length > 0) {
      return { id: result.data[0].id };
    }

    return { id: 'unknown' };
  } catch (error) {
    console.error('Error storing onboarding submission:', error);
    // Don't throw - allow form submission even if database storage fails
    return { id: 'error-' + Date.now() };
  }
}

/**
 * Create Slack alert for urgent contact submissions
 */
export async function sendSlackAlert(type: 'contact' | 'onboarding', data: any): Promise<void> {
  const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK) {
    return; // Slack alerts optional
  }

  try {
    const message = type === 'contact'
      ? `🔔 *New Contact Submission*\n*Name:* ${data.name}\n*Email:* ${data.email}\n*Subject:* ${data.subject}\n*Message:* ${data.message.substring(0, 100)}...`
      : `🚀 *New Onboarding Submission*\n*Company:* ${data.company}\n*Email:* ${data.email}\n*Phone:* ${data.phone}`;

    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    console.error('Error sending Slack alert:', error);
    // Don't throw - Slack alerts are optional
  }
}
