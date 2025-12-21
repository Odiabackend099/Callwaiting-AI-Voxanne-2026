// Test script to verify email configuration
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { sendEmailViaSmtp } = require('./dist/services/email-service');

async function testEmail() {
  console.log('Testing email configuration...');
  console.log('SMTP Host:', process.env.SMTP_HOST);
  console.log('SMTP User:', process.env.SMTP_USER ? 'SET' : 'NOT SET');
  console.log('SMTP Password:', process.env.SMTP_PASSWORD ? 'SET' : 'NOT SET');
  console.log('From Email:', process.env.FROM_EMAIL);
  
  const result = await sendEmailViaSmtp({
    to: 'callsupport@callwaitingai.dev',
    to_name: 'Test Recipient',
    subject: 'TEST: Email Configuration Verification',
    html: `
      <h2>Email Configuration Test</h2>
      <p>This is a test email to verify the SMTP configuration is working.</p>
      <p>Time sent: ${new Date().toISOString()}</p>
    `,
    text: `
      Email Configuration Test
      
      This is a test email to verify the SMTP configuration is working.
      Time sent: ${new Date().toISOString()}
    `
  });
  
  console.log('Email result:', result);
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
  } else {
    console.log('❌ Email failed to send:', result.error);
  }
}

testEmail().catch(console.error);
