import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Resend } from 'resend';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';
import { supabase } from '../services/supabase-client';
import { config } from '../config';

const router = Router();

// Lazy-load Resend client (only initialize when needed)
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!config.RESEND_API_KEY) {
    log.warn('RESEND_API_KEY not configured. Contact form emails disabled.');
    return null;
  }

  if (!resend) {
    resend = new Resend(config.RESEND_API_KEY);
  }

  return resend;
}

// Zod schema for contact form validation
const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  company: z.string().optional(),
});

type ContactFormData = z.infer<typeof ContactFormSchema>;

// Urgent subjects that trigger immediate Slack alerts
const URGENT_SUBJECTS = [
  'urgent',
  'emergency',
  'critical',
  'production',
  'down',
  'outage',
  'broken',
];

/**
 * Check if subject is urgent based on keywords
 */
function isUrgentSubject(subject: string): boolean {
  const lowerSubject = subject.toLowerCase();
  return URGENT_SUBJECTS.some((keyword) => lowerSubject.includes(keyword));
}

/**
 * Send email to support team
 */
async function sendSupportEmail(data: ContactFormData): Promise<void> {
  const supportEmail = 'support@voxanne.ai';
  const fromEmail = config.FROM_EMAIL || 'noreply@voxanne.ai';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
        .content { padding: 30px; }
        .field { margin-bottom: 20px; }
        .label { font-weight: bold; color: #667eea; display: block; margin-bottom: 5px; }
        .value { background: #f9f9f9; padding: 10px; border-radius: 4px; border-left: 3px solid #667eea; }
        .message { background: #f9f9f9; padding: 20px; border-radius: 4px; border-left: 3px solid #667eea; white-space: pre-wrap; }
        .footer { text-align: center; padding: 20px; background: #f9f9f9; font-size: 12px; color: #666; }
        .urgent { background: #fee2e2; border-left-color: #dc2626; }
        .urgent-badge { display: inline-block; background: #dc2626; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 New Contact Form Submission</h1>
          ${
            isUrgentSubject(data.subject)
              ? '<p style="margin: 10px 0 0 0; font-size: 14px;">⚠️ This message has been marked as urgent</p>'
              : ''
          }
        </div>
        <div class="content">
          ${
            isUrgentSubject(data.subject)
              ? '<span class="urgent-badge">🚨 URGENT</span>'
              : ''
          }

          <div class="field">
            <span class="label">From:</span>
            <div class="value">${data.name}</div>
          </div>

          ${
            data.company
              ? `
          <div class="field">
            <span class="label">Company:</span>
            <div class="value">${data.company}</div>
          </div>
          `
              : ''
          }

          <div class="field">
            <span class="label">Email:</span>
            <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
          </div>

          ${
            data.phone
              ? `
          <div class="field">
            <span class="label">Phone:</span>
            <div class="value"><a href="tel:${data.phone}">${data.phone}</a></div>
          </div>
          `
              : ''
          }

          <div class="field">
            <span class="label">Subject:</span>
            <div class="value ${isUrgentSubject(data.subject) ? 'urgent' : ''}">${data.subject}</div>
          </div>

          <div class="field">
            <span class="label">Message:</span>
            <div class="message ${isUrgentSubject(data.subject) ? 'urgent' : ''}">${data.message}</div>
          </div>

          <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 4px; border-left: 3px solid #0ea5e9;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Quick Actions:</strong><br>
              Reply to: <a href="mailto:${data.email}">${data.email}</a><br>
              ${data.phone ? `Call: <a href="tel:${data.phone}">${data.phone}</a>` : ''}
            </p>
          </div>
        </div>
        <div class="footer">
          <p>Voxanne AI Contact Form</p>
          <p>Received: ${new Date().toLocaleString('en-GB')}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const resendClient = getResendClient();
  if (!resendClient) {
    log.warn('ContactForm', 'Skipping support email - Resend not configured', {
      from: data.email,
      subject: data.subject,
    });
    return; // Don't throw error, just skip email
  }

  try {
    await resendClient.emails.send({
      from: fromEmail,
      to: supportEmail,
      replyTo: data.email, // Enable direct reply to user
      subject: `${isUrgentSubject(data.subject) ? '🚨 URGENT - ' : ''}Contact Form: ${data.subject}`,
      html,
    });
    log.info('ContactForm', 'Support email sent', {
      from: data.email,
      subject: data.subject,
    });
  } catch (error) {
    log.error('ContactForm', 'Failed to send support email', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - email failure shouldn't block form submission
  }
}

/**
 * Send confirmation email to user
 */
async function sendConfirmationEmail(data: ContactFormData): Promise<void> {
  const fromEmail = config.FROM_EMAIL || 'noreply@voxanne.ai';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 4px; border-left: 3px solid #f59e0b; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Message Received</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>

          <p>Thank you for contacting Voxanne AI! We've received your message and will get back to you within 24 hours.</p>

          <div class="highlight">
            <strong>Your Message:</strong><br>
            <em>${data.subject}</em>
          </div>

          ${
            isUrgentSubject(data.subject)
              ? `
          <p style="color: #dc2626; font-weight: bold;">
            🚨 We noticed your message is marked as urgent. Our team will prioritize this and respond as soon as possible.
          </p>
          `
              : ''
          }

          <p>In the meantime, you can:</p>
          <ul>
            <li>Explore our documentation at <a href="https://voxanne.ai/docs">voxanne.ai/docs</a></li>
            <li>Book a demo call at <a href="https://calendly.com/austyneguale/30min">calendly.com/austyneguale/30min</a></li>
            <li>Call us at <a href="tel:+447424038250">+44 7424 038250</a></li>
          </ul>

          <p>Best regards,<br>The Voxanne AI Team</p>
        </div>
        <div class="footer">
          <p>Voxanne AI - Intelligent Voice Solutions</p>
          <p>This is an automated confirmation. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const resendClient = getResendClient();
  if (!resendClient) {
    log.warn('ContactForm', 'Skipping confirmation email - Resend not configured', {
      email: data.email,
    });
    return; // Don't throw error, just skip email
  }

  try {
    await resendClient.emails.send({
      from: fromEmail,
      to: data.email,
      subject: 'We received your message - Voxanne AI',
      html,
    });
    log.info('ContactForm', 'Confirmation email sent', { email: data.email });
  } catch (error) {
    log.error('ContactForm', 'Failed to send confirmation email', {
      email: data.email,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - confirmation email is nice-to-have
  }
}

/**
 * Store submission in database (optional - requires contact_submissions table)
 */
async function storeSubmission(data: ContactFormData): Promise<void> {
  try {
    const { error } = await supabase.from('contact_submissions').insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      company: data.company,
      is_urgent: isUrgentSubject(data.subject),
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Table might not exist - log warning but don't fail
      log.warn('ContactForm', 'Could not store submission in database', {
        error: error.message,
        hint: 'contact_submissions table may not exist',
      });
    } else {
      log.info('ContactForm', 'Submission stored in database');
    }
  } catch (error) {
    log.warn('ContactForm', 'Database storage failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/contact-form
 * Handle contact form submissions
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const data = ContactFormSchema.parse(req.body);

    log.info('ContactForm', 'Submission received', {
      from: data.email,
      subject: data.subject,
      urgent: isUrgentSubject(data.subject),
    });

    // Send emails in parallel
    await Promise.all([
      sendSupportEmail(data),
      sendConfirmationEmail(data),
    ]);

    // Store in database (optional, async)
    storeSubmission(data).catch((err) => {
      log.warn('ContactForm', 'Background storage failed', { error: err.message });
    });

    // Send Slack alert for urgent messages or all messages
    if (isUrgentSubject(data.subject)) {
      await sendSlackAlert('🚨 URGENT Contact Form Submission', {
        from: `${data.name} <${data.email}>`,
        phone: data.phone || 'N/A',
        company: data.company || 'N/A',
        subject: data.subject,
        message: data.message.substring(0, 200) + (data.message.length > 200 ? '...' : ''),
      });
    } else {
      // Send non-urgent alerts to Slack as well (optional)
      await sendSlackAlert('📧 New Contact Form Submission', {
        from: `${data.name} <${data.email}>`,
        subject: data.subject,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you within 24 hours.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn('ContactForm', 'Validation error', {
        errors: error.errors,
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    log.error('ContactForm', 'Submission processing failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Send error alert to Slack
    await sendSlackAlert('🔴 Contact Form Error', {
      error: error instanceof Error ? error.message : String(error),
      body: JSON.stringify(req.body, null, 2).substring(0, 500),
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to process your submission. Please try again or contact support@voxanne.ai directly.',
    });
  }
});

export default router;
