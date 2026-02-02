/**
 * Email Service V2 Integration Examples
 * Shows how to integrate the email service into real routes
 */

import { Request, Response } from 'express';
import {
  EmailServiceV2,
  generateICSFile,
  formatEmailDate,
  formatEmailTime
} from '../services/email-service-v2';

/**
 * Example 1: Calendly Webhook Handler
 * When someone books a demo via Calendly, send confirmation email
 */
export async function handleCalendlyWebhook(req: Request, res: Response) {
  try {
    const { event, payload } = req.body;

    // Only handle booking events
    if (event !== 'invitee.created') {
      return res.status(200).json({ message: 'Event ignored' });
    }

    // Extract booking details from Calendly payload
    const {
      name,
      email,
      scheduled_event
    } = payload;

    const startTime = new Date(scheduled_event.start_time);
    const endTime = new Date(scheduled_event.end_time);

    // Generate ICS file for calendar invite
    const icsContent = generateICSFile({
      startTime,
      endTime,
      summary: 'Voxanne AI Demo',
      description: 'Personalized demo of Voxanne AI voice agents. We\'ll show you how our AI can transform your business communications.',
      location: scheduled_event.location || 'Zoom (link sent separately)',
      organizerEmail: process.env.FROM_EMAIL || 'hello@voxanne.ai',
      attendeeEmail: email,
      attendeeName: name
    });

    // Send appointment confirmation
    const result = await EmailServiceV2.sendAppointmentConfirmation({
      name,
      email,
      date: formatEmailDate(startTime),
      time: formatEmailTime(startTime, 'GMT'),
      duration: '30 minutes',
      calendlyUrl: scheduled_event.uri,
      icsFile: icsContent
    });

    if (result.success) {
      console.log(`[Calendly] Confirmation sent to ${email} (${result.id})`);
      return res.status(200).json({
        success: true,
        emailId: result.id
      });
    } else {
      console.error(`[Calendly] Failed to send confirmation: ${result.error}`);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('[Calendly] Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Example 2: Contact Form Submission Handler
 * When someone submits contact form on website
 */
export async function handleContactFormSubmission(req: Request, res: Response) {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Send notification to support team
    const notificationResult = await EmailServiceV2.sendContactFormNotification({
      name,
      email,
      phone,
      subject,
      message
    });

    if (!notificationResult.success) {
      console.error('[Contact Form] Failed to notify support:', notificationResult.error);
      // Continue anyway - user should still get confirmation
    }

    // Send confirmation to user
    const confirmationResult = await EmailServiceV2.sendContactFormConfirmation({
      name,
      email,
      phone,
      subject,
      message
    });

    if (confirmationResult.success) {
      console.log(`[Contact Form] Confirmation sent to ${email} (${confirmationResult.id})`);
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message. We\'ll respond within 24 hours.',
        emailId: confirmationResult.id
      });
    } else {
      console.error('[Contact Form] Failed to send confirmation:', confirmationResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send confirmation email'
      });
    }
  } catch (error: any) {
    console.error('[Contact Form] Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Example 3: Chat Widget Lead Detection
 * When AI detects a hot lead in chat conversation
 */
export async function handleChatLeadDetected(leadData: {
  name?: string;
  email?: string;
  phone?: string;
  conversationId: string;
  qualificationScore: number;
  keywords: string[];
  messages: Array<{ role: string; content: string }>;
}) {
  try {
    // Only alert on high-quality leads (score > 7)
    if (leadData.qualificationScore < 7) {
      console.log(`[Chat] Lead score too low (${leadData.qualificationScore}), skipping alert`);
      return { success: true, skipped: true };
    }

    // Build lead info summary
    const leadInfo = [
      leadData.name ? `Name: ${leadData.name}` : null,
      leadData.email ? `Email: ${leadData.email}` : null,
      leadData.phone ? `Phone: ${leadData.phone}` : null,
      `Qualification Score: ${leadData.qualificationScore}/10`,
      `Keywords: ${leadData.keywords.join(', ')}`
    ].filter(Boolean).join('\n');

    // Build conversation summary
    const conversationSummary = leadData.messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Send hot lead alert
    const result = await EmailServiceV2.sendHotLeadAlert({
      leadInfo,
      conversationSummary,
      contactEmail: leadData.email,
      contactPhone: leadData.phone,
      timestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long'
      })
    });

    if (result.success) {
      console.log(`[Chat] Hot lead alert sent (${result.id})`);
      return { success: true, emailId: result.id };
    } else {
      console.error(`[Chat] Failed to send hot lead alert: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('[Chat] Exception sending hot lead alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Example 4: Appointment Reminder (Scheduled Job)
 * Send reminder 24 hours before appointment
 */
export async function sendAppointmentReminder(appointmentData: {
  customerName: string;
  customerEmail: string;
  appointmentTime: Date;
  duration: number;
  meetingLink?: string;
}) {
  try {
    const { customerName, customerEmail, appointmentTime, duration, meetingLink } = appointmentData;

    // Calculate end time
    const endTime = new Date(appointmentTime.getTime() + duration * 60 * 1000);

    // Generate ICS file
    const icsContent = generateICSFile({
      startTime: appointmentTime,
      endTime,
      summary: 'Voxanne AI Demo Reminder',
      description: `Reminder: Your Voxanne AI demo is tomorrow!\n\n${meetingLink ? `Meeting Link: ${meetingLink}` : ''}`,
      location: meetingLink || 'Virtual',
      organizerEmail: process.env.FROM_EMAIL || 'hello@voxanne.ai',
      attendeeEmail: customerEmail,
      attendeeName: customerName
    });

    // Send reminder email
    const result = await EmailServiceV2.sendAppointmentConfirmation({
      name: customerName,
      email: customerEmail,
      date: formatEmailDate(appointmentTime),
      time: formatEmailTime(appointmentTime, 'GMT'),
      duration: `${duration} minutes`,
      icsFile: icsContent
    });

    if (result.success) {
      console.log(`[Reminders] Sent reminder to ${customerEmail} (${result.id})`);
      return { success: true, emailId: result.id };
    } else {
      console.error(`[Reminders] Failed to send reminder: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('[Reminders] Exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Example 5: Error Handling and Retry Logic
 * Robust error handling for production use
 */
export async function sendEmailWithRetry(
  emailType: 'appointment' | 'contact_form' | 'hot_lead',
  data: any,
  maxRetries: number = 3
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Email Retry] Attempt ${attempt}/${maxRetries} for ${emailType}`);

      let result;

      switch (emailType) {
        case 'appointment':
          result = await EmailServiceV2.sendAppointmentConfirmation(data);
          break;
        case 'contact_form':
          result = await EmailServiceV2.sendContactFormConfirmation(data);
          break;
        case 'hot_lead':
          result = await EmailServiceV2.sendHotLeadAlert(data);
          break;
        default:
          return { success: false, error: 'Invalid email type' };
      }

      if (result.success) {
        console.log(`[Email Retry] Success on attempt ${attempt}`);
        return { success: true, emailId: result.id };
      }

      lastError = result.error || 'Unknown error';
      console.error(`[Email Retry] Attempt ${attempt} failed: ${lastError}`);

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[Email Retry] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } catch (error: any) {
      lastError = error.message;
      console.error(`[Email Retry] Exception on attempt ${attempt}:`, error);

      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error(`[Email Retry] All ${maxRetries} attempts failed. Last error: ${lastError}`);
  return { success: false, error: lastError };
}

/**
 * Example 6: Batch Email Sending (Newsletter, Announcements)
 * Send emails to multiple recipients with rate limiting
 */
export async function sendBatchEmails(
  recipients: Array<{ name: string; email: string }>,
  emailData: any,
  emailType: 'appointment' | 'contact_form',
  rateLimit: number = 10 // emails per second
): Promise<{
  total: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    total: recipients.length,
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };

  const delayBetweenEmails = 1000 / rateLimit; // ms

  for (const recipient of recipients) {
    try {
      const data = { ...emailData, ...recipient };

      let result;
      if (emailType === 'appointment') {
        result = await EmailServiceV2.sendAppointmentConfirmation(data);
      } else {
        result = await EmailServiceV2.sendContactFormConfirmation(data);
      }

      if (result.success) {
        results.sent++;
        console.log(`[Batch] Sent to ${recipient.email} (${result.id})`);
      } else {
        results.failed++;
        results.errors.push(`${recipient.email}: ${result.error}`);
        console.error(`[Batch] Failed to send to ${recipient.email}: ${result.error}`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
    } catch (error: any) {
      results.failed++;
      results.errors.push(`${recipient.email}: ${error.message}`);
      console.error(`[Batch] Exception for ${recipient.email}:`, error);
    }
  }

  console.log(`[Batch] Complete: ${results.sent}/${results.total} sent, ${results.failed} failed`);
  return results;
}

export default {
  handleCalendlyWebhook,
  handleContactFormSubmission,
  handleChatLeadDetected,
  sendAppointmentReminder,
  sendEmailWithRetry,
  sendBatchEmails
};
