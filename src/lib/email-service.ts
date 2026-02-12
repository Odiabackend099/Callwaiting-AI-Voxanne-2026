import { ContactFormInput, OnboardingFormInput } from './validation-schemas';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPPORT_EMAIL = 'support@voxanne.ai';

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send contact form confirmation and support notification emails
 */
export async function sendContactFormEmails(data: ContactFormInput): Promise<EmailResponse> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - emails will not be sent');
    return { success: true }; // Don't fail form submission if email service unavailable
  }

  try {
    // Send confirmation email to user
    await sendUserConfirmationEmail({
      userEmail: data.email,
      userName: data.name,
      subject: data.subject || 'Website Contact Form',
      message: data.message,
    });

    // Send notification to support team
    await sendSupportNotificationEmail({
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject || 'Website Contact Form',
      message: data.message,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending contact form emails:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending emails',
    };
  }
}

/**
 * Send onboarding form confirmation and support notification emails
 */
export async function sendOnboardingEmails(data: OnboardingFormInput): Promise<EmailResponse> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - emails will not be sent');
    return { success: true }; // Don't fail form submission if email service unavailable
  }

  try {
    // Send confirmation email to user
    await sendOnboardingUserConfirmationEmail({
      userEmail: data.email,
      companyName: data.company,
    });

    // Send notification to support team
    await sendOnboardingSupportNotificationEmail({
      company: data.company,
      email: data.email,
      phone: data.phone,
      website: data.website,
      greetingScript: data.greetingScript,
      additionalDetails: data.additionalDetails,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending onboarding emails:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending emails',
    };
  }
}

/**
 * Send confirmation email to user after contact form submission
 */
async function sendUserConfirmationEmail({
  userEmail,
  userName,
  subject,
  message,
}: {
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Voxanne AI <noreply@voxanne.ai>`,
      to: userEmail,
      subject: 'Thank you for contacting Voxanne AI',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1e40af; margin-bottom: 20px;">Thank you for reaching out!</h1>

            <p>Hi ${userName},</p>

            <p>We've received your message and appreciate you contacting us. Our team will review your inquiry and get back to you within 24 hours.</p>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin-top: 0;">Your Message:</h3>
              <p>${message}</p>
            </div>

            <p>In the meantime, feel free to:</p>
            <ul>
              <li><a href="https://voxanne.ai" style="color: #1e40af; text-decoration: none;">Visit our website</a></li>
              <li><a href="https://voxanne.ai/docs" style="color: #1e40af; text-decoration: none;">Check our documentation</a></li>
              <li>Reply to this email with any additional questions</li>
            </ul>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #666;">
              <strong>Voxanne AI</strong><br />
              The #1 AI Receptionist for Clinics<br />
              <a href="https://voxanne.ai" style="color: #1e40af; text-decoration: none;">voxanne.ai</a>
            </p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send confirmation email: ${response.statusText}`);
  }
}

/**
 * Send notification email to support team after contact form submission
 */
async function sendSupportNotificationEmail({
  name,
  email,
  phone,
  subject,
  message,
}: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}): Promise<void> {
  const isUrgent = ['urgent', 'emergency', 'critical', 'asap'].some(keyword =>
    subject.toLowerCase().includes(keyword) || message.toLowerCase().includes(keyword)
  );

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Voxanne AI <noreply@voxanne.ai>`,
      to: SUPPORT_EMAIL,
      subject: `${isUrgent ? '🚨 URGENT - ' : ''}New Contact Form Submission: ${subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            ${isUrgent ? '<div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;"><strong style="color: #dc2626;">⚠️ MARKED AS URGENT</strong></div>' : ''}

            <h2 style="color: #1e40af;">New Contact Form Submission</h2>

            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #1e40af; text-decoration: none;">${email}</a></p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
              <p><strong>Subject:</strong> ${subject}</p>
            </div>

            <h3 style="color: #1e40af;">Message:</h3>
            <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="white-space: pre-wrap;">${message}</p>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p><a href="mailto:${email}" style="display: inline-block; background-color: #1e40af; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Reply to ${name}</a></p>
            </div>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send support notification: ${response.statusText}`);
  }
}

/**
 * Send confirmation email to user after onboarding form submission
 */
async function sendOnboardingUserConfirmationEmail({
  userEmail,
  companyName,
}: {
  userEmail: string;
  companyName: string;
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Voxanne AI <noreply@voxanne.ai>`,
      to: userEmail,
      subject: 'Welcome to Voxanne AI - Your AI Receptionist Awaits',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1e40af; margin-bottom: 20px;">Welcome to Voxanne AI! 🎉</h1>

            <p>Hi ${companyName},</p>

            <p>Thank you for submitting your onboarding information! We're excited to help you deploy an AI receptionist for your clinic.</p>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin-top: 0;">What's Next:</h3>
              <ol style="color: #333;">
                <li><strong>Configuration:</strong> Our team will configure your AI agent within 24 hours</li>
                <li><strong>Testing:</strong> We'll set up a test environment for you to preview</li>
                <li><strong>Launch:</strong> Once you approve, we'll deploy to production</li>
                <li><strong>Support:</strong> We'll provide ongoing training and support</li>
              </ol>
            </div>

            <p><strong>Expected Timeline:</strong> Configuration complete within 24 hours</p>

            <p>Our team will reach out via email to discuss any customizations or questions. You can also reply to this email anytime.</p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #666;">
                Questions? <a href="mailto:support@voxanne.ai" style="color: #1e40af; text-decoration: none;">Contact our team</a><br />
                <strong>Voxanne AI</strong> - The #1 AI Receptionist for Clinics
              </p>
            </div>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send onboarding confirmation email: ${response.statusText}`);
  }
}

/**
 * Send notification email to support team after onboarding form submission
 */
async function sendOnboardingSupportNotificationEmail({
  company,
  email,
  phone,
  website,
  greetingScript,
  additionalDetails,
}: {
  company: string;
  email: string;
  phone: string;
  website: string;
  greetingScript: string;
  additionalDetails: string;
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Voxanne AI <noreply@voxanne.ai>`,
      to: SUPPORT_EMAIL,
      subject: `New Onboarding Submission: ${company}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">🚀 New Onboarding Submission</h2>

            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Company:</strong> ${company}</p>
              <p><strong>Contact Email:</strong> <a href="mailto:${email}" style="color: #1e40af; text-decoration: none;">${email}</a></p>
              <p><strong>Phone:</strong> ${phone}</p>
              ${website ? `<p><strong>Website:</strong> <a href="${website}" style="color: #1e40af; text-decoration: none;">${website}</a></p>` : ''}
            </div>

            <h3 style="color: #1e40af;">Greeting Script:</h3>
            <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
              <p style="white-space: pre-wrap; font-size: 14px;">${greetingScript}</p>
            </div>

            ${additionalDetails ? `
              <h3 style="color: #1e40af;">Additional Details:</h3>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <p style="white-space: pre-wrap; font-size: 14px;">${additionalDetails}</p>
              </div>
            ` : ''}

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p><a href="mailto:${email}" style="display: inline-block; background-color: #1e40af; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Reply to ${company}</a></p>
            </div>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send onboarding support notification: ${response.statusText}`);
  }
}
