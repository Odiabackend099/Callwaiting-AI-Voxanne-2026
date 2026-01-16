import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY);

async function main() {
  const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'Austyn@callwaitingai.dev';
  const fromName = process.env.OUTREACH_FROM_NAME || 'Austyn at CallWaiting AI';
  const ccEmail = process.env.CAMPAIGN_CC_EMAIL || 'austyneguale@gmail.com';

  const emailContent = {
    from: `${fromName} <${fromEmail}>`,
    to: 'egualesamuel@gmail.com',
    cc: ccEmail,
    subject: 'Eguale, I analyzed your potential for Voxanne',
    html: `<p>Hi Eguale,</p>
<p>I was researching aesthetic clinics and noticed something about your practice:</p>
<p><strong>Many potential patients struggle to reach practices by phone during peak hours.</strong></p>
<p>At £200-500 per appointment, even 3 missed calls per week = £36,000/year in lost revenue.</p>
<p>I built an AI receptionist (Voxanne) specifically for clinics like yours. It answers 100% of calls, books appointments, and sends reminders - 24/7.</p>
<p>Would you like to see a 2-minute demo of how it handles a real patient call?</p>
<p>Best,<br>Austyn<br>Founder, CallWaiting AI</p>
<p style="font-size:12px;color:#666;margin-top:20px;">Reply <strong>"STOP"</strong> to opt out - I'll remove you immediately.</p>`,
    text: `Hi Eguale,

I was researching aesthetic clinics and noticed something about your practice:

Many potential patients struggle to reach practices by phone during peak hours.

At £200-500 per appointment, even 3 missed calls per week = £36,000/year in lost revenue.

I built an AI receptionist (Voxanne) specifically for clinics like yours. It answers 100% of calls, books appointments, and sends reminders - 24/7.

Would you like to see a 2-minute demo of how it handles a real patient call?

Best,
Austyn
Founder, CallWaiting AI

Reply "STOP" to opt out - I'll remove you immediately.`
  };

  try {
    const response = await resend.emails.send(emailContent);
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', response.data?.id);
    console.log('To: egualesamuel@gmail.com');
    console.log('CC:', ccEmail);
    console.log('From:', `${fromName} <${fromEmail}>`);
    console.log('\nCheck your inbox/promotions folder in a few seconds.');
  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }
}

main();
