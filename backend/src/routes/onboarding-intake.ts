import { Router } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';
import { Resend } from 'resend';
import multer from 'multer';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// File upload setup (copy from founder-console-v2.ts pattern)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max (increased for real PDFs)
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'));
    }
  }
});

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'PDF file must be smaller than 100MB',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message,
      code: err.code
    });
  } else if (err) {
    return res.status(400).json({
      error: 'Upload failed',
      message: err.message
    });
  }
  next();
};

// POST /api/onboarding-intake
router.post('/', upload.single('pricing_pdf'), handleMulterError, async (req, res) => {
  try {
    const { company, email, phone, greeting_script } = req.body;
    const file = req.file;

    // Validate required fields
    if (!company || !email || !phone || !greeting_script) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let pdfUrl: string | null = null;

    // Upload PDF to Supabase Storage if provided
    if (file) {
      const fileName = `${Date.now()}_${company.replace(/\s+/g, '_')}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('onboarding-documents')
        .upload(fileName, file.buffer, {
          contentType: 'application/pdf',
        });

      if (uploadError) {
        log.error('OnboardingIntake', 'PDF upload failed', { error: uploadError });
      } else {
        // Generate signed URL (valid for 7 days)
        const { data: urlData } = await supabase.storage
          .from('onboarding-documents')
          .createSignedUrl(fileName, 7 * 24 * 60 * 60);

        pdfUrl = urlData?.signedUrl || null;
      }
    }

    // Save to database
    const { data: submission, error: dbError } = await supabase
      .from('onboarding_submissions')
      .insert({
        company_name: company,
        user_email: email,
        phone_number: phone,
        greeting_script: greeting_script,
        pdf_url: pdfUrl,
        status: 'pending',
      })
      .select('id')
      .single();

    if (dbError) {
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    // 1. Send confirmation email to USER
    try {
      log.info('OnboardingIntake', 'Sending confirmation email to user', { email });
      const userEmailResult = await resend.emails.send({
        from: 'Voxanne AI <noreply@voxanne.ai>',
        to: email,
        subject: 'Thank you for your submission - Voxanne AI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3498db;">Thank You for Your Submission!</h1>

            <p>Hi ${company},</p>

            <p>We've successfully received your onboarding information. Our team will review your submission and configure your AI agent within the next 24 hours.</p>

            <h2 style="color: #2c3e50;">What's Next?</h2>
            <ol>
              <li>Our team will review your pricing sheet and greeting script</li>
              <li>We'll configure your AI agent based on your requirements</li>
              <li>You'll receive setup instructions via email within 24 hours</li>
            </ol>

            <p><strong>Submission ID:</strong> ${submission.id}</p>

            <hr style="border: 1px solid #eee; margin: 30px 0;">

            <p style="color: #7f8c8d; font-size: 14px;">
              If you have any questions, reply to this email or contact us at support@voxanne.ai
            </p>

            <p style="color: #7f8c8d; font-size: 14px;">
              Best regards,<br>
              The Voxanne AI Team
            </p>
          </div>
        `,
      });
      log.info('OnboardingIntake', 'User confirmation email sent successfully', {
        email,
        emailId: userEmailResult.data?.id
      });
    } catch (emailError) {
      log.error('OnboardingIntake', 'User confirmation email failed (non-critical)', {
        error: emailError instanceof Error ? emailError.message : String(emailError)
      });
    }

    // 2. Send detailed notification to SUPPORT TEAM
    log.info('OnboardingIntake', 'Sending notification to support team');
    const supportEmailResult = await resend.emails.send({
      from: 'Voxanne AI <noreply@voxanne.ai>',
      to: 'support@voxanne.ai',
      subject: `🔔 New Onboarding: ${company}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h1 style="color: #e74c3c;">🔔 New Onboarding Submission</h1>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #2c3e50; margin-top: 0;">Company Information</h2>
            <p><strong>Company:</strong> ${company}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
            <p><strong>Submission ID:</strong> ${submission.id}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">📄 Pricing PDF</h3>
            ${pdfUrl ? `<p><a href="${pdfUrl}" style="color: #007bff; font-weight: bold;">📎 View PDF Document</a></p>` : '<p style="color: #6c757d;">No PDF provided</p>'}
          </div>

          <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">🎤 Greeting Script</h3>
            <pre style="background: white; padding: 15px; border-radius: 4px; overflow-x: auto;">${greeting_script}</pre>
          </div>

          <hr style="border: 1px solid #eee; margin: 30px 0;">

          <h3 style="color: #28a745;">✅ Action Required</h3>
          <ol>
            <li>Review the pricing PDF and greeting script</li>
            <li>Configure the AI agent in the dashboard</li>
            <li>Send setup instructions to <a href="mailto:${email}">${email}</a></li>
          </ol>

          <p>
            <a href="https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/editor"
               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View in Supabase
            </a>
          </p>
        </div>
      `,
    });
    log.info('OnboardingIntake', 'Support notification email sent successfully', {
      emailId: supportEmailResult.data?.id
    });

    // Send Slack alert (optional - don't fail if Slack is not configured)
    try {
      await sendSlackAlert('🔔 New Onboarding Submission', {
        company,
        phone,
        email,
        has_pdf: file ? 'Yes' : 'No',
      });
    } catch (slackError) {
      log.warn('OnboardingIntake', 'Slack alert failed (non-critical)', {
        error: slackError instanceof Error ? slackError.message : String(slackError)
      });
    }

    log.info('OnboardingIntake', 'Submission received', {
      submission_id: submission.id,
      company,
    });

    return res.json({ success: true, submission_id: submission.id });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log.error('OnboardingIntake', 'Failed', {
      error: errorMessage,
      stack: errorStack,
      body: req.body,
      hasFile: !!req.file
    });
    console.error('OnboardingIntake Error:', errorMessage, errorStack);
    return res.status(500).json({
      error: 'Failed to process submission',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

export default router;
