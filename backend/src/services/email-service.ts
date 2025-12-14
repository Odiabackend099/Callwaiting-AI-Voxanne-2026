/**
 * Email Service
 * Handles sending emails via SMTP (using Resend or native SMTP)
 */

import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  to_name?: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  from_name?: string;
}

interface SendEmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

// Initialize SMTP transporter
const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.resend.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER || process.env.RESEND_API_KEY;
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });
};

export async function sendEmailViaSmtp(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const transporter = createTransporter();

    const fromEmail = options.from || process.env.FROM_EMAIL || 'noreply@callwaitingai.dev';
    const fromName = options.from_name || 'Voxanne by CallWaiting AI';

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: options.to_name ? `${options.to_name} <${options.to}>` : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[Email Service] Email sent successfully to ${options.to}`);
    console.log(`[Email Service] Message ID: ${info.messageId}`);

    return {
      success: true,
      message_id: info.messageId
    };
  } catch (error: any) {
    console.error('[Email Service] Error sending email:', error);

    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

/**
 * Send templated demo email
 */
export async function sendDemoEmailTemplate(
  to_email: string,
  to_name: string,
  clinic_name: string,
  demo_url: string,
  demo_type: 'outbound_intro' | 'inbound_intro' | 'feature_overview'
): Promise<SendEmailResult> {
  const subject = `Your ${demo_type === 'outbound_intro' ? 'Outbound' : 'Inbound'} Voxanne Demo - ${clinic_name}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0066cc; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .cta-button {
            display: inline-block;
            background-color: #0066cc;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Voxanne AI Demo</h1>
            <p>The #1 AI Receptionist for ${clinic_name}</p>
        </div>
        <div class="content">
            <p>Hi ${to_name},</p>

            <p>Thanks for your interest in Voxanne! We've prepared a personalized demo showing exactly how our AI receptionist can transform ${clinic_name}'s phone operations.</p>

            <p><strong>What you'll see in this 60-90 second video:</strong></p>
            <ul>
                <li>✓ 24/7 automatic call answering (zero missed calls)</li>
                <li>✓ Real-time appointment booking</li>
                <li>✓ Intelligent lead qualification</li>
                <li>✓ Emergency protocol detection</li>
                <li>✓ Integration with your EMR/booking system</li>
            </ul>

            <p><strong>Click below to watch your demo:</strong></p>
            <a href="${demo_url}" class="cta-button">Watch Your Demo</a>

            <p><strong>Key Benefits for ${clinic_name}:</strong></p>
            <ul>
                <li>Recover 40% more leads from after-hours calls</li>
                <li>3x more booked consultations</li>
                <li>Eliminate voicemail backlog</li>
                <li>HIPAA-compliant & fully secure</li>
            </ul>

            <p>Questions? Just reply to this email or call us at +44 7424 038250.</p>

            <p>Best regards,<br/>
            <strong>The Voxanne Team</strong><br/>
            CallWaiting AI<br/>
            <a href="https://callwaitingai.dev">callwaitingai.dev</a>
            </p>
        </div>
        <div class="footer">
            <p>© 2025 CallWaiting AI. All rights reserved.</p>
            <p>Collage House, 17 King Edward Road, Ruislip, London HA4 7AE, UK</p>
        </div>
    </div>
</body>
</html>
  `;

  const textBody = `
Your Voxanne AI Demo

Hi ${to_name},

Thanks for your interest in Voxanne! We've prepared a personalized demo showing exactly how our AI receptionist can transform ${clinic_name}'s phone operations.

Watch your demo: ${demo_url}

What you'll see (60-90 seconds):
✓ 24/7 automatic call answering (zero missed calls)
✓ Real-time appointment booking
✓ Intelligent lead qualification
✓ Emergency protocol detection
✓ Integration with your EMR/booking system

Key Benefits for ${clinic_name}:
✓ Recover 40% more leads from after-hours calls
✓ 3x more booked consultations
✓ Eliminate voicemail backlog
✓ HIPAA-compliant & fully secure

Questions? Reply to this email or call +44 7424 038250.

Best regards,
The Voxanne Team
CallWaiting AI
https://callwaitingai.dev
  `;

  return sendEmailViaSmtp({
    to: to_email,
    to_name,
    subject,
    html: htmlBody,
    text: textBody
  });
}

export default { sendEmailViaSmtp, sendDemoEmailTemplate };
