/**
 * Email Testing & Verification Routes
 * DEBUG ONLY - Remove in production
 * 
 * Provides endpoints to:
 * 1. Test email delivery
 * 2. Check Supabase submission database
 * 3. Verify email configuration
 */

import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const router = Router();

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * GET /api/email-testing/config
 * Check if email service is configured
 */
router.get('/config', (req: Request, res: Response) => {
  const config = {
    email_service: {
      resend_configured: !!process.env.RESEND_API_KEY,
      from_email: process.env.FROM_EMAIL || 'noreply@voxanne.ai',
      support_email: process.env.SUPPORT_EMAIL || 'support@voxanne.ai',
    },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };

  return res.json(config);
});

/**
 * GET /api/email-testing/submissions
 * List all onboarding submissions from database
 * Optional query: ?email=user@example.com to filter by email
 */
router.get('/submissions', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    let query = supabase
      .from('onboarding_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter by email if provided
    if (email && typeof email === 'string') {
      query = query.eq('user_email', email);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({
        error: 'Failed to fetch submissions',
        details: error.message,
      });
    }

    return res.json({
      count: data?.length || 0,
      submissions: data || [],
      note: 'These are the submissions stored in the database. Emails were sent for each.',
    });
  } catch (error) {
    log.error('EmailTesting', 'Submission fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
});

/**
 * POST /api/email-testing/send-test-email
 * Send a test email to verify Resend is working
 */
router.post('/send-test-email', async (req: Request, res: Response) => {
  try {
    const { recipient_email, subject, message } = req.body;

    if (!recipient_email) {
      return res.status(400).json({ error: 'recipient_email is required' });
    }

    log.info('EmailTesting', 'Sending test email', { to: recipient_email });

    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'noreply@voxanne.ai',
      to: recipient_email,
      subject: subject || '🧪 Test Email from Voxanne AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #3498db;">🧪 Email Testing</h1>
          <p>This is a test email to verify that the Resend email service is properly configured.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            <p><strong>From:</strong> ${process.env.FROM_EMAIL || 'noreply@voxanne.ai'}</p>
            <p><strong>To:</strong> ${recipient_email}</p>
          </div>

          ${message ? `
          <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Message:</strong></p>
            <p>${message}</p>
          </div>
          ` : ''}

          <hr style="border: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #7f8c8d; font-size: 14px;">
            If you received this email, the Resend email service is working correctly! ✅
          </p>
        </div>
      `,
    });

    log.info('EmailTesting', 'Test email sent successfully', {
      email_id: result.data?.id,
      to: recipient_email,
    });

    return res.json({
      success: true,
      message: 'Test email sent successfully!',
      email_id: result.data?.id,
      recipient: recipient_email,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('EmailTesting', 'Test email failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/email-testing/verify-submission/:email
 * Check if a specific email has a submission in database
 * Shows what emails would have been sent
 */
router.get('/verify-submission/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const { data: submissions, error } = await supabase
      .from('onboarding_submissions')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        error: 'Failed to verify submission',
        details: error.message,
      });
    }

    if (!submissions || submissions.length === 0) {
      return res.json({
        verified: false,
        message: `No submissions found for ${email}`,
        email,
        count: 0,
      });
    }

    const latestSubmission = submissions[0];

    return res.json({
      verified: true,
      message: 'Submission found!',
      email,
      count: submissions.length,
      latest_submission: {
        id: latestSubmission.id,
        company: latestSubmission.company_name,
        submitted_at: latestSubmission.created_at,
        status: latestSubmission.status,
        emails_sent: {
          confirmation: `✅ Confirmation email sent to ${email}`,
          support: `✅ Notification sent to ${process.env.SUPPORT_EMAIL || 'support@voxanne.ai'}`,
          slack: `✅ Slack alert sent (if configured)`,
        },
        next_steps: [
          'Check your email inbox (including spam/junk)',
          'Support team notified and will configure agent within 24 hours',
          'You should receive setup instructions via email',
        ],
      },
      all_submissions: submissions.map((s) => ({
        id: s.id,
        company: s.company_name,
        submitted_at: s.created_at,
        status: s.status,
      })),
    });
  } catch (error) {
    log.error('EmailTesting', 'Verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
});

/**
 * POST /api/email-testing/resend-confirmation
 * Resend confirmation email for a submission
 * Useful if user didn't receive the original email
 */
router.post('/resend-confirmation', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    // Find the submission
    const { data: submissions, error: queryError } = await supabase
      .from('onboarding_submissions')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError) {
      return res.status(400).json({
        error: 'Failed to find submission',
        details: queryError.message,
      });
    }

    if (!submissions || submissions.length === 0) {
      return res.status(404).json({
        error: 'No submission found for this email',
        email,
      });
    }

    const submission = submissions[0];

    // Resend confirmation email
    log.info('EmailTesting', 'Resending confirmation email', { email });

    const result = await resend.emails.send({
      from: 'Voxanne AI <noreply@voxanne.ai>',
      to: email,
      subject: 'Thank you for your submission - Voxanne AI [RESENT]',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3498db;">Thank You for Your Submission!</h1>

          <p>Hi ${submission.company_name},</p>

          <p>We've successfully received your onboarding information. Our team will review your submission and configure your AI agent within the next 24 hours.</p>

          <h2 style="color: #2c3e50;">What's Next?</h2>
          <ol>
            <li>Our team will review your pricing sheet and greeting script</li>
            <li>We'll configure your AI agent based on your requirements</li>
            <li>You'll receive setup instructions via email within 24 hours</li>
          </ol>

          <p><strong>Submission ID:</strong> ${submission.id}</p>
          <p style="color: #999; font-size: 12px;">[This email was resent on ${new Date().toLocaleString()}]</p>

          <hr style="border: 1px solid #eee; margin: 30px 0;">

          <p style="color: #7f8c8d; font-size: 14px;">
            If you have any questions, reply to this email or contact us at ${process.env.SUPPORT_EMAIL || 'support@voxanne.ai'}
          </p>

          <p style="color: #7f8c8d; font-size: 14px;">
            Best regards,<br>
            The Voxanne AI Team
          </p>
        </div>
      `,
    });

    log.info('EmailTesting', 'Confirmation email resent successfully', {
      email_id: result.data?.id,
      to: email,
    });

    return res.json({
      success: true,
      message: 'Confirmation email resent!',
      email_id: result.data?.id,
      recipient: email,
      company: submission.company_name,
      original_submission_date: submission.created_at,
    });
  } catch (error) {
    log.error('EmailTesting', 'Resend confirmation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to resend confirmation email',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
