import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Resend } from 'resend';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';
import { supabase } from '../services/supabase-client';
import { config } from '../config';

const router = Router();
const resend = new Resend(config.RESEND_API_KEY);

// Zod schema for Calendly webhook events
const CalendlyEventSchema = z.object({
  event: z.string(),
  payload: z.object({
    event_type: z.object({
      name: z.string(),
    }),
    invitee: z.object({
      name: z.string(),
      email: z.string().email(),
      text_reminder_number: z.string().optional(),
      uri: z.string(),
    }),
    event: z.object({
      start_time: z.string(),
      end_time: z.string(),
    }),
    cancel_url: z.string().optional(),
    reschedule_url: z.string().optional(),
  }),
});

type CalendlyEvent = z.infer<typeof CalendlyEventSchema>;

/**
 * Verify Calendly webhook signature (if CALENDLY_WEBHOOK_SECRET is set)
 */
function verifyWebhookSignature(req: Request): boolean {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (development mode)
  if (!secret) {
    log.warn('Calendly', 'Webhook signature verification skipped (no secret configured)');
    return true;
  }

  const signature = req.headers['calendly-webhook-signature'] as string;
  if (!signature) {
    log.error('Calendly', 'Missing webhook signature header');
    return false;
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  const isValid = signature === expectedSignature;
  if (!isValid) {
    log.error('Calendly', 'Invalid webhook signature', {
      received: signature.substring(0, 20) + '...',
      expected: expectedSignature.substring(0, 20) + '...',
    });
  }

  return isValid;
}

/**
 * Send appointment confirmation email to invitee
 */
async function sendConfirmationEmail(
  inviteeName: string,
  inviteeEmail: string,
  startTime: string,
  endTime: string,
  cancelUrl?: string,
  rescheduleUrl?: string
): Promise<void> {
  const fromEmail = config.FROM_EMAIL || 'noreply@voxanne.ai';

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const formattedDate = startDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = `${startDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${endDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

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
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Appointment Confirmed</h1>
        </div>
        <div class="content">
          <p>Hi ${inviteeName},</p>
          <p>Your appointment with Voxanne AI has been confirmed!</p>

          <h3>📅 Appointment Details:</h3>
          <ul>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedTime}</li>
          </ul>

          <p>We look forward to speaking with you!</p>

          ${
            cancelUrl || rescheduleUrl
              ? `
          <div style="margin-top: 20px;">
            ${rescheduleUrl ? `<a href="${rescheduleUrl}" class="button">Reschedule</a>` : ''}
            ${cancelUrl ? `<a href="${cancelUrl}" class="button" style="background: #dc2626;">Cancel</a>` : ''}
          </div>
          `
              : ''
          }
        </div>
        <div class="footer">
          <p>Voxanne AI - Intelligent Voice Solutions</p>
          <p>Need help? Contact us at support@voxanne.ai</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: inviteeEmail,
      subject: '✅ Your Appointment with Voxanne AI is Confirmed',
      html,
    });
    log.info('Calendly', 'Confirmation email sent', { email: inviteeEmail });
  } catch (error) {
    log.error('Calendly', 'Failed to send confirmation email', {
      email: inviteeEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Send notification to support team
 */
async function sendSupportNotification(
  eventType: string,
  inviteeName: string,
  inviteeEmail: string,
  phone: string | undefined,
  startTime: string
): Promise<void> {
  const supportEmail = 'support@voxanne.ai';
  const fromEmail = config.FROM_EMAIL || 'noreply@voxanne.ai';

  const startDate = new Date(startTime);
  const formattedDateTime = startDate.toLocaleString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #000; padding: 20px; border: 2px solid #00ff00; }
        h2 { color: #00ff00; }
        .info { margin: 10px 0; }
        .label { color: #00aaff; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📅 ${eventType === 'invitee.created' ? 'NEW' : 'CANCELLED'} Calendly Booking</h2>

        <div class="info">
          <span class="label">Event Type:</span> ${eventType}
        </div>
        <div class="info">
          <span class="label">Name:</span> ${inviteeName}
        </div>
        <div class="info">
          <span class="label">Email:</span> ${inviteeEmail}
        </div>
        ${
          phone
            ? `<div class="info"><span class="label">Phone:</span> ${phone}</div>`
            : ''
        }
        <div class="info">
          <span class="label">Appointment:</span> ${formattedDateTime}
        </div>

        <p style="margin-top: 20px; color: #fff;">
          ${
            eventType === 'invitee.created'
              ? 'A new appointment has been booked. Prepare for the call!'
              : 'An appointment has been cancelled.'
          }
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: supportEmail,
      subject: `${eventType === 'invitee.created' ? '📅 New' : '❌ Cancelled'} Calendly Booking - ${inviteeName}`,
      html,
    });
    log.info('Calendly', 'Support notification sent', { event: eventType });
  } catch (error) {
    log.error('Calendly', 'Failed to send support notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Store booking in database (optional - requires calendly_bookings table)
 */
async function storeBooking(event: CalendlyEvent): Promise<void> {
  try {
    const { data, error } = await supabase.from('calendly_bookings').insert({
      event_type: event.event,
      invitee_name: event.payload.invitee.name,
      invitee_email: event.payload.invitee.email,
      invitee_phone: event.payload.invitee.text_reminder_number,
      invitee_uri: event.payload.invitee.uri,
      appointment_type: event.payload.event_type.name,
      start_time: event.payload.event.start_time,
      end_time: event.payload.event.end_time,
      cancel_url: event.payload.cancel_url,
      reschedule_url: event.payload.reschedule_url,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Table might not exist - log warning but don't fail
      log.warn('Calendly', 'Could not store booking in database', {
        error: error.message,
        hint: 'calendly_bookings table may not exist',
      });
    } else {
      log.info('Calendly', 'Booking stored in database');
    }
  } catch (error) {
    log.warn('Calendly', 'Database storage failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/webhooks/calendly
 * Handle Calendly webhook events
 */
router.post('/calendly', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(req)) {
      log.error('Calendly', 'Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse and validate event
    const event = CalendlyEventSchema.parse(req.body);

    log.info('Calendly', 'Webhook received', {
      event: event.event,
      invitee: event.payload.invitee.name,
      email: event.payload.invitee.email,
    });

    // Handle invitee.created event
    if (event.event === 'invitee.created') {
      // Send confirmation email to invitee
      await sendConfirmationEmail(
        event.payload.invitee.name,
        event.payload.invitee.email,
        event.payload.event.start_time,
        event.payload.event.end_time,
        event.payload.cancel_url,
        event.payload.reschedule_url
      );

      // Send notification to support team
      await sendSupportNotification(
        event.event,
        event.payload.invitee.name,
        event.payload.invitee.email,
        event.payload.invitee.text_reminder_number,
        event.payload.event.start_time
      );

      // Store booking in database (optional)
      await storeBooking(event);

      // Send Slack alert
      await sendSlackAlert('📅 New Calendly Booking', {
        name: event.payload.invitee.name,
        email: event.payload.invitee.email,
        phone: event.payload.invitee.text_reminder_number || 'N/A',
        appointment: new Date(event.payload.event.start_time).toLocaleString('en-GB'),
      });
    }

    // Handle invitee.canceled event
    if (event.event === 'invitee.canceled') {
      // Send notification to support team
      await sendSupportNotification(
        event.event,
        event.payload.invitee.name,
        event.payload.invitee.email,
        event.payload.invitee.text_reminder_number,
        event.payload.event.start_time
      );

      // Send Slack alert
      await sendSlackAlert('❌ Calendly Booking Cancelled', {
        name: event.payload.invitee.name,
        email: event.payload.invitee.email,
        appointment: new Date(event.payload.event.start_time).toLocaleString('en-GB'),
      });
    }

    // Return 200 OK immediately
    return res.status(200).json({ success: true });
  } catch (error) {
    log.error('Calendly', 'Webhook processing failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Send error alert to Slack
    await sendSlackAlert('🔴 Calendly Webhook Error', {
      error: error instanceof Error ? error.message : String(error),
      body: JSON.stringify(req.body, null, 2).substring(0, 500),
    });

    // Still return 200 to prevent Calendly from retrying
    return res.status(200).json({ success: false, error: 'Processing failed' });
  }
});

export default router;
