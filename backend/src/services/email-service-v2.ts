/**
 * Email Service V2
 * Enhanced email service using native Resend SDK
 * Supports appointment confirmations, contact forms, and hot lead alerts
 */

import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email addresses from environment
const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@voxanne.ai';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@voxanne.ai';

// Types
interface AppointmentConfirmationData {
  name: string;
  email: string;
  date: string; // e.g., "Monday, February 5, 2026"
  time: string; // e.g., "2:00 PM GMT"
  duration: string; // e.g., "30 minutes"
  calendlyUrl?: string;
  icsFile?: string; // Base64 encoded ICS file
}

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

interface HotLeadAlertData {
  leadInfo: string;
  conversationSummary: string;
  contactEmail?: string;
  contactPhone?: string;
  timestamp: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * EmailServiceV2 - Static methods for sending various email types
 */
export class EmailServiceV2 {
  /**
   * Send appointment confirmation to customer
   */
  static async sendAppointmentConfirmation(
    data: AppointmentConfirmationData
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #0066cc;
      margin: 0;
      font-size: 24px;
    }
    .check-icon {
      font-size: 48px;
      color: #10b981;
      margin-bottom: 10px;
    }
    .details {
      background-color: #f9fafb;
      border-left: 4px solid #0066cc;
      padding: 20px;
      margin: 30px 0;
      border-radius: 4px;
    }
    .details-row {
      display: flex;
      margin-bottom: 12px;
      align-items: center;
    }
    .details-row:last-child {
      margin-bottom: 0;
    }
    .details-icon {
      margin-right: 12px;
      font-size: 18px;
    }
    .details-label {
      font-weight: 600;
      min-width: 80px;
    }
    .details-value {
      color: #555;
    }
    .section {
      margin: 25px 0;
    }
    .section h2 {
      font-size: 18px;
      color: #111;
      margin-bottom: 12px;
    }
    .section ul {
      margin: 0;
      padding-left: 20px;
    }
    .section li {
      margin-bottom: 8px;
      color: #555;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .contact-info {
      margin-top: 15px;
    }
    .contact-info a {
      color: #0066cc;
      text-decoration: none;
    }
    .contact-info a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check-icon">✅</div>
      <h1>Your Voxanne AI Demo is Confirmed</h1>
    </div>

    <p>Hi <strong>${data.name}</strong>,</p>

    <p>Thank you for booking a demo with Voxanne AI! We're excited to show you how our AI voice agents can transform your business communications.</p>

    <div class="details">
      <div class="details-row">
        <span class="details-icon">📅</span>
        <span class="details-label">Date:</span>
        <span class="details-value">${data.date}</span>
      </div>
      <div class="details-row">
        <span class="details-icon">🕐</span>
        <span class="details-label">Time:</span>
        <span class="details-value">${data.time}</span>
      </div>
      <div class="details-row">
        <span class="details-icon">⏱️</span>
        <span class="details-label">Duration:</span>
        <span class="details-value">${data.duration}</span>
      </div>
    </div>

    <div class="section">
      <h2>What to expect:</h2>
      <ul>
        <li>Personalized demo of our AI voice agents</li>
        <li>Live demonstration of appointment booking</li>
        <li>Q&A about your specific business needs</li>
        <li>Discussion of integration options</li>
      </ul>
    </div>

    <div class="section">
      <h2>Preparation (Optional):</h2>
      <ul>
        <li>Think about your current call volume and pain points</li>
        <li>List any specific features you'd like to see</li>
        <li>Note any integrations you currently use (calendar, CRM, etc.)</li>
      </ul>
    </div>

    <div class="footer">
      <p><strong>Questions before our meeting?</strong></p>
      <div class="contact-info">
        <p>Call us at <a href="tel:+447424038250">+44 7424 038250</a></p>
        <p>Or reply to this email</p>
      </div>
      <p style="margin-top: 20px;">
        Best regards,<br>
        <strong>The Voxanne AI Team</strong>
      </p>
    </div>
  </div>
</body>
</html>
      `;

      const textBody = `
Your Voxanne AI Demo is Confirmed ✅

Hi ${data.name},

Thank you for booking a demo with Voxanne AI!

📅 Date: ${data.date}
🕐 Time: ${data.time}
⏱️ Duration: ${data.duration}

What to expect:
- Personalized demo of our AI voice agents
- Live demonstration of appointment booking
- Q&A about your specific business needs
- Discussion of integration options

Questions? Call us at +44 7424 038250 or reply to this email.

Best regards,
The Voxanne AI Team
      `.trim();

      // Send email with calendar attachment if provided
      const emailOptions: any = {
        from: `Voxanne AI <${FROM_EMAIL}>`,
        to: data.email,
        subject: 'Your Voxanne AI Demo is Confirmed ✅',
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'appointment_confirmation' },
          { name: 'source', value: 'calendly' }
        ]
      };

      // Add ICS attachment if provided
      if (data.icsFile) {
        emailOptions.attachments = [
          {
            filename: 'appointment.ics',
            content: data.icsFile
          }
        ];
      }

      const response = await resend.emails.send(emailOptions);

      if (response.error) {
        console.error('[EmailServiceV2] Error sending appointment confirmation:', response.error);
        return {
          success: false,
          error: response.error.message
        };
      }

      console.log('[EmailServiceV2] Appointment confirmation sent successfully:', response.data?.id);
      return {
        success: true,
        id: response.data?.id
      };
    } catch (error: any) {
      console.error('[EmailServiceV2] Exception sending appointment confirmation:', error);
      return {
        success: false,
        error: error.message || 'Failed to send appointment confirmation'
      };
    }
  }

  /**
   * Send contact form notification to support team
   */
  static async sendContactFormNotification(
    data: ContactFormData
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #0066cc;
      color: white;
      padding: 15px 20px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
    }
    .field {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    .field:last-child {
      border-bottom: none;
    }
    .field-label {
      font-weight: 600;
      color: #374151;
      margin-bottom: 5px;
      display: block;
    }
    .field-value {
      color: #6b7280;
      word-wrap: break-word;
    }
    .message-box {
      background-color: #f9fafb;
      padding: 15px;
      border-left: 3px solid #0066cc;
      margin-top: 10px;
      white-space: pre-wrap;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>[Contact Form] ${data.subject}</h1>
    </div>

    <div class="field">
      <span class="field-label">From:</span>
      <span class="field-value">${data.name}</span>
    </div>

    <div class="field">
      <span class="field-label">Email:</span>
      <span class="field-value"><a href="mailto:${data.email}">${data.email}</a></span>
    </div>

    ${data.phone ? `
    <div class="field">
      <span class="field-label">Phone:</span>
      <span class="field-value"><a href="tel:${data.phone}">${data.phone}</a></span>
    </div>
    ` : ''}

    <div class="field">
      <span class="field-label">Subject:</span>
      <span class="field-value">${data.subject}</span>
    </div>

    <div class="field">
      <span class="field-label">Message:</span>
      <div class="message-box">${data.message}</div>
    </div>
  </div>
</body>
</html>
      `;

      const textBody = `
[Contact Form] ${data.subject}

New Contact Form Submission:

From: ${data.name}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}\n` : ''}Subject: ${data.subject}

Message:
${data.message}
      `.trim();

      const response = await resend.emails.send({
        from: `Voxanne AI Contact Form <${FROM_EMAIL}>`,
        to: SUPPORT_EMAIL,
        replyTo: data.email,
        subject: `[Contact Form] ${data.subject} - ${data.name}`,
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'contact_form' },
          { name: 'source', value: 'website' }
        ]
      });

      if (response.error) {
        console.error('[EmailServiceV2] Error sending contact form notification:', response.error);
        return {
          success: false,
          error: response.error.message
        };
      }

      console.log('[EmailServiceV2] Contact form notification sent successfully:', response.data?.id);
      return {
        success: true,
        id: response.data?.id
      };
    } catch (error: any) {
      console.error('[EmailServiceV2] Exception sending contact form notification:', error);
      return {
        success: false,
        error: error.message || 'Failed to send contact form notification'
      };
    }
  }

  /**
   * Send confirmation email to user who submitted contact form
   */
  static async sendContactFormConfirmation(
    data: ContactFormData
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #0066cc;
      margin: 0;
      font-size: 24px;
    }
    .check-icon {
      font-size: 48px;
      color: #10b981;
      margin-bottom: 10px;
    }
    .content {
      color: #555;
      margin: 20px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check-icon">✉️</div>
      <h1>We've Received Your Message</h1>
    </div>

    <div class="content">
      <p>Hi <strong>${data.name}</strong>,</p>

      <p>Thank you for contacting Voxanne AI! We've received your message and our team will respond within 24 hours.</p>

      <p>In the meantime, feel free to explore our resources:</p>
      <ul>
        <li><a href="https://voxanne.ai/demo">Book a live demo</a></li>
        <li><a href="https://voxanne.ai/pricing">View pricing</a></li>
        <li><a href="https://voxanne.ai/blog">Read our blog</a></li>
      </ul>

      <p>If you have an urgent question, call us at <a href="tel:+447424038250">+44 7424 038250</a>.</p>
    </div>

    <div class="footer">
      <p>
        Best regards,<br>
        <strong>The Voxanne AI Team</strong>
      </p>
    </div>
  </div>
</body>
</html>
      `;

      const textBody = `
We've Received Your Message ✉️

Hi ${data.name},

Thank you for contacting Voxanne AI! We've received your message and our team will respond within 24 hours.

In the meantime, feel free to explore our resources:
- Book a live demo: https://voxanne.ai/demo
- View pricing: https://voxanne.ai/pricing
- Read our blog: https://voxanne.ai/blog

If you have an urgent question, call us at +44 7424 038250.

Best regards,
The Voxanne AI Team
      `.trim();

      const response = await resend.emails.send({
        from: `Voxanne AI <${FROM_EMAIL}>`,
        to: data.email,
        subject: 'We\'ve Received Your Message - Voxanne AI',
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'contact_form_confirmation' },
          { name: 'source', value: 'website' }
        ]
      });

      if (response.error) {
        console.error('[EmailServiceV2] Error sending contact form confirmation:', response.error);
        return {
          success: false,
          error: response.error.message
        };
      }

      console.log('[EmailServiceV2] Contact form confirmation sent successfully:', response.data?.id);
      return {
        success: true,
        id: response.data?.id
      };
    } catch (error: any) {
      console.error('[EmailServiceV2] Exception sending contact form confirmation:', error);
      return {
        success: false,
        error: error.message || 'Failed to send contact form confirmation'
      };
    }
  }

  /**
   * Send hot lead alert to support team
   */
  static async sendHotLeadAlert(
    data: HotLeadAlertData
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #dc2626 0%, #f97316 100%);
      color: white;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
    }
    .fire-icon {
      font-size: 36px;
      margin-bottom: 5px;
    }
    .alert-box {
      background-color: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-section {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
    }
    .info-label {
      font-weight: 600;
      color: #374151;
      display: block;
      margin-bottom: 5px;
    }
    .info-value {
      color: #6b7280;
      white-space: pre-wrap;
    }
    .action-required {
      background-color: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
      text-align: center;
      font-weight: 600;
      color: #92400e;
    }
    .timestamp {
      color: #9ca3af;
      font-size: 14px;
      text-align: right;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="fire-icon">🔥</div>
      <h1>Hot Lead from Chat Widget</h1>
    </div>

    <div class="alert-box">
      <p style="margin: 0;"><strong>New qualified lead from website chat requiring immediate follow-up</strong></p>
    </div>

    <div class="info-section">
      <span class="info-label">Lead Information:</span>
      <div class="info-value">${data.leadInfo}</div>
    </div>

    ${data.contactEmail ? `
    <div class="info-section">
      <span class="info-label">Email:</span>
      <div class="info-value"><a href="mailto:${data.contactEmail}">${data.contactEmail}</a></div>
    </div>
    ` : ''}

    ${data.contactPhone ? `
    <div class="info-section">
      <span class="info-label">Phone:</span>
      <div class="info-value"><a href="tel:${data.contactPhone}">${data.contactPhone}</a></div>
    </div>
    ` : ''}

    <div class="info-section">
      <span class="info-label">Conversation Summary:</span>
      <div class="info-value">${data.conversationSummary}</div>
    </div>

    <div class="action-required">
      ⚡ Recommended Action: Follow up within 24 hours
    </div>

    <div class="timestamp">
      Received: ${data.timestamp}
    </div>
  </div>
</body>
</html>
      `;

      const textBody = `
🔥 Hot Lead from Chat Widget

New qualified lead from website chat:

${data.leadInfo}

${data.contactEmail ? `Email: ${data.contactEmail}\n` : ''}${data.contactPhone ? `Phone: ${data.contactPhone}\n` : ''}
Conversation Summary:
${data.conversationSummary}

⚡ Recommended Action: Follow up within 24 hours

Received: ${data.timestamp}
      `.trim();

      const response = await resend.emails.send({
        from: `Voxanne AI Alerts <${FROM_EMAIL}>`,
        to: SUPPORT_EMAIL,
        subject: '🔥 Hot Lead from Chat Widget',
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'hot_lead_alert' },
          { name: 'source', value: 'chat_widget' },
          { name: 'priority', value: 'high' }
        ]
      });

      if (response.error) {
        console.error('[EmailServiceV2] Error sending hot lead alert:', response.error);
        return {
          success: false,
          error: response.error.message
        };
      }

      console.log('[EmailServiceV2] Hot lead alert sent successfully:', response.data?.id);
      return {
        success: true,
        id: response.data?.id
      };
    } catch (error: any) {
      console.error('[EmailServiceV2] Exception sending hot lead alert:', error);
      return {
        success: false,
        error: error.message || 'Failed to send hot lead alert'
      };
    }
  }

  // ============================================================================
  // Onboarding Cart Abandonment Emails (3-email sequence)
  // ============================================================================

  /**
   * Escapes HTML special characters in user-supplied strings before embedding
   * them in HTML email bodies to prevent injection (Fix 4).
   */
  private static escHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Email 1 (>=1hr): Soft nudge — warm, non-pushy
   */
  static async sendAbandonmentSoftNudge(
    email: string,
    clinicName: string
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F0F9FF; }
    .container { background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .logo { text-align: center; margin-bottom: 30px; font-size: 20px; font-weight: 700; color: #1D4ED8; }
    h1 { color: #020412; font-size: 22px; margin-bottom: 8px; }
    .cta { display: inline-block; background-color: #1D4ED8; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #BFDBFE; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Voxanne AI</div>
    <h1>Your AI receptionist is almost ready.</h1>
    <p>Hi there,</p>
    <p>You started setting up an AI receptionist for <strong>${EmailServiceV2.escHtml(clinicName)}</strong> but didn't finish the last step.</p>
    <p>Your personalized setup is still saved — just pick up where you left off. It takes less than 60 seconds to activate.</p>
    <p style="text-align: center;">
      <a href="https://app.voxanne.ai/dashboard/onboarding" class="cta">Complete Setup</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">No pressure — your progress is saved whenever you're ready.</p>
    <div class="footer">
      <p>Voxanne AI — Your 24/7 AI Receptionist</p>
      <p style="font-size:11px;margin-top:8px;">Don't want these emails? <a href="https://app.voxanne.ai/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

      const textBody = `Your AI receptionist is almost ready.

Hi there,

You started setting up an AI receptionist for ${clinicName} but didn't finish the last step.

Your personalized setup is still saved — just pick up where you left off:
https://app.voxanne.ai/dashboard/onboarding

No pressure — your progress is saved whenever you're ready.

— Voxanne AI`;

      const response = await resend.emails.send({
        from: `Voxanne AI <${FROM_EMAIL}>`,
        to: email,
        subject: 'Your AI receptionist is almost ready',
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'abandonment' },
          { name: 'sequence', value: '1' },
        ],
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, id: response.data?.id };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to send abandonment email 1' };
    }
  }

  /**
   * Email 2 (>=24hr): Pain reminder — pain-focused with stats
   */
  static async sendAbandonmentPainReminder(
    email: string,
    clinicName: string
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F0F9FF; }
    .container { background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .logo { text-align: center; margin-bottom: 30px; font-size: 20px; font-weight: 700; color: #1D4ED8; }
    h1 { color: #020412; font-size: 22px; margin-bottom: 8px; }
    .stat-box { background-color: #F0F9FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center; }
    .stat-number { font-size: 32px; font-weight: 700; color: #1D4ED8; }
    .stat-label { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .cta { display: inline-block; background-color: #1D4ED8; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #BFDBFE; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Voxanne AI</div>
    <h1>How many calls did ${EmailServiceV2.escHtml(clinicName)} miss today?</h1>
    <p>The average medical practice misses <strong>30% of incoming calls</strong>. Each missed call is a patient going to a competitor.</p>
    <div class="stat-box">
      <div class="stat-number">$150–$400</div>
      <div class="stat-label">Average revenue lost per missed call</div>
    </div>
    <p>Your AI receptionist answers every call in 2 seconds, 24/7 — including nights, weekends, and lunch breaks. No hold music. No voicemail.</p>
    <p style="text-align: center;">
      <a href="https://app.voxanne.ai/dashboard/onboarding" class="cta">Activate Your AI Receptionist</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">Setup takes less than 60 seconds. Your progress is still saved.</p>
    <div class="footer">
      <p>Voxanne AI — Your 24/7 AI Receptionist</p>
      <p style="font-size:11px;margin-top:8px;">Don't want these emails? <a href="https://app.voxanne.ai/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

      const textBody = `How many calls did ${clinicName} miss today?

The average medical practice misses 30% of incoming calls. Each missed call is a patient going to a competitor.

$150-$400 — Average revenue lost per missed call.

Your AI receptionist answers every call in 2 seconds, 24/7 — including nights, weekends, and lunch breaks.

Activate your AI receptionist:
https://app.voxanne.ai/dashboard/onboarding

Setup takes less than 60 seconds. Your progress is still saved.

— Voxanne AI`;

      const response = await resend.emails.send({
        from: `Voxanne AI <${FROM_EMAIL}>`,
        to: email,
        subject: `How many calls did ${clinicName} miss today?`,
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'abandonment' },
          { name: 'sequence', value: '2' },
        ],
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, id: response.data?.id };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to send abandonment email 2' };
    }
  }

  /**
   * Email 3 (>=48hr): Objection killer — £10 credit offer
   */
  static async sendAbandonmentObjectionKiller(
    email: string,
    clinicName: string
  ): Promise<SendEmailResult> {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F0F9FF; }
    .container { background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .logo { text-align: center; margin-bottom: 30px; font-size: 20px; font-weight: 700; color: #1D4ED8; }
    h1 { color: #020412; font-size: 22px; margin-bottom: 8px; }
    .credit-box { background: linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; color: white; }
    .credit-amount { font-size: 36px; font-weight: 700; }
    .credit-label { font-size: 14px; opacity: 0.9; margin-top: 4px; }
    .cta { display: inline-block; background-color: #1D4ED8; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #BFDBFE; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Voxanne AI</div>
    <h1>We added £10 to your account.</h1>
    <p>Hi there,</p>
    <p>We know trying something new for ${EmailServiceV2.escHtml(clinicName)} is a big decision. So we've added a £10 credit to your Voxanne account — no strings attached.</p>
    <div class="credit-box">
      <div class="credit-amount">£10.00</div>
      <div class="credit-label">Credit applied to your account</div>
    </div>
    <p>Use it toward your AI phone number and first call credits. That's enough to cover your first week of AI-powered call handling.</p>
    <p><strong>What you get:</strong></p>
    <ul>
      <li>A dedicated local phone number patients trust</li>
      <li>24/7 AI receptionist that never puts callers on hold</li>
      <li>Automatic appointment booking into your calendar</li>
      <li>SMS follow-ups that reduce no-shows</li>
    </ul>
    <p style="text-align: center;">
      <a href="https://app.voxanne.ai/dashboard/onboarding" class="cta">Claim Your £10 Credit</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">This credit expires in 30 days. Your setup progress is still saved.</p>
    <div class="footer">
      <p>Voxanne AI — Your 24/7 AI Receptionist</p>
      <p style="font-size:11px;margin-top:8px;">Don't want these emails? <a href="https://app.voxanne.ai/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

      const textBody = `We added £10 to your account.

Hi there,

We know trying something new for ${clinicName} is a big decision. So we've added a £10 credit to your Voxanne account — no strings attached.

£10.00 Credit applied to your account

Use it toward your AI phone number and first call credits. That's enough to cover your first week of AI-powered call handling.

What you get:
- A dedicated local phone number patients trust
- 24/7 AI receptionist that never puts callers on hold
- Automatic appointment booking into your calendar
- SMS follow-ups that reduce no-shows

Claim your credit:
https://app.voxanne.ai/dashboard/onboarding

This credit expires in 30 days. Your setup progress is still saved.

— Voxanne AI`;

      const response = await resend.emails.send({
        from: `Voxanne AI <${FROM_EMAIL}>`,
        to: email,
        subject: 'We added £10 to your account',
        html: htmlBody,
        text: textBody,
        tags: [
          { name: 'category', value: 'abandonment' },
          { name: 'sequence', value: '3' },
        ],
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, id: response.data?.id };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to send abandonment email 3' };
    }
  }
}

/**
 * Generate ICS (iCalendar) file content for calendar invites
 */
export function generateICSFile(params: {
  startTime: Date;
  endTime: Date;
  summary: string;
  description: string;
  location?: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
}): string {
  const {
    startTime,
    endTime,
    summary,
    description,
    location,
    organizerEmail,
    attendeeEmail,
    attendeeName
  } = params;

  // Format dates to ICS format (YYYYMMDDTHHMMSSZ)
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substring(7)}@voxanne.ai`;
  const dtstamp = formatICSDate(new Date());
  const dtstart = formatICSDate(startTime);
  const dtend = formatICSDate(endTime);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Voxanne AI//Demo Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    location ? `LOCATION:${location}` : '',
    `ORGANIZER;CN=Voxanne AI:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${attendeeName};RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Voxanne AI Demo in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  return icsContent;
}

/**
 * Helper: Format date for email display
 */
export function formatEmailDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Helper: Format time for email display
 */
export function formatEmailTime(date: Date, timezone?: string): string {
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return timezone ? `${timeStr} ${timezone}` : timeStr;
}

export default EmailServiceV2;
