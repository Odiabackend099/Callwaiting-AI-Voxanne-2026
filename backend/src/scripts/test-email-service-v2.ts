/**
 * Test Script for Email Service V2
 * Tests all email templates and functionality
 */

import dotenv from 'dotenv';
import { EmailServiceV2, generateICSFile, formatEmailDate, formatEmailTime } from '../services/email-service-v2';

// Load environment variables
dotenv.config();

async function testEmailServiceV2() {
  console.log('🧪 Testing Email Service V2\n');

  // Verify environment variables
  console.log('📋 Environment Check:');
  console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  FROM_EMAIL: ${process.env.FROM_EMAIL || 'hello@voxanne.ai'}`);
  console.log(`  SUPPORT_EMAIL: ${process.env.SUPPORT_EMAIL || 'support@voxanne.ai'}`);
  console.log('');

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is required. Please set it in .env file.');
    process.exit(1);
  }

  // Test email address (change this to your email for testing)
  const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
  console.log(`📧 Test emails will be sent to: ${TEST_EMAIL}\n`);

  // Test 1: Appointment Confirmation Email
  console.log('--- Test 1: Appointment Confirmation ---');
  try {
    // Generate ICS file
    const startTime = new Date('2026-02-10T14:00:00Z');
    const endTime = new Date('2026-02-10T14:30:00Z');

    const icsContent = generateICSFile({
      startTime,
      endTime,
      summary: 'Voxanne AI Demo',
      description: 'Personalized demo of Voxanne AI voice agents. We\'ll show you how our AI can transform your business communications.',
      location: 'Zoom (link will be sent separately)',
      organizerEmail: process.env.FROM_EMAIL || 'hello@voxanne.ai',
      attendeeEmail: TEST_EMAIL,
      attendeeName: 'John Smith'
    });

    const result1 = await EmailServiceV2.sendAppointmentConfirmation({
      name: 'John Smith',
      email: TEST_EMAIL,
      date: formatEmailDate(startTime),
      time: formatEmailTime(startTime, 'GMT'),
      duration: '30 minutes',
      icsFile: icsContent
    });

    if (result1.success) {
      console.log(`✅ Appointment confirmation sent (ID: ${result1.id})`);
    } else {
      console.error(`❌ Failed to send appointment confirmation: ${result1.error}`);
    }
  } catch (error: any) {
    console.error(`❌ Exception in test 1: ${error.message}`);
  }
  console.log('');

  // Test 2: Contact Form Notification (to support)
  console.log('--- Test 2: Contact Form Notification ---');
  try {
    const result2 = await EmailServiceV2.sendContactFormNotification({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '+1-555-123-4567',
      subject: 'Interested in Enterprise Plan',
      message: 'Hi, I\'m interested in learning more about your enterprise plan. We have a team of 50 sales reps and receive about 500 calls per day. Can you provide pricing and implementation timeline?\n\nThanks,\nJane'
    });

    if (result2.success) {
      console.log(`✅ Contact form notification sent (ID: ${result2.id})`);
    } else {
      console.error(`❌ Failed to send contact form notification: ${result2.error}`);
    }
  } catch (error: any) {
    console.error(`❌ Exception in test 2: ${error.message}`);
  }
  console.log('');

  // Test 3: Contact Form Confirmation (to user)
  console.log('--- Test 3: Contact Form Confirmation ---');
  try {
    const result3 = await EmailServiceV2.sendContactFormConfirmation({
      name: 'Jane Doe',
      email: TEST_EMAIL,
      phone: '+1-555-123-4567',
      subject: 'Interested in Enterprise Plan',
      message: 'Hi, I\'m interested in learning more about your enterprise plan...'
    });

    if (result3.success) {
      console.log(`✅ Contact form confirmation sent (ID: ${result3.id})`);
    } else {
      console.error(`❌ Failed to send contact form confirmation: ${result3.error}`);
    }
  } catch (error: any) {
    console.error(`❌ Exception in test 3: ${error.message}`);
  }
  console.log('');

  // Test 4: Hot Lead Alert
  console.log('--- Test 4: Hot Lead Alert ---');
  try {
    const result4 = await EmailServiceV2.sendHotLeadAlert({
      leadInfo: 'Medical clinic owner looking for AI receptionist solution',
      conversationSummary: `User asked about:
- Pricing for 200 calls/day
- HIPAA compliance
- Google Calendar integration
- Trial period availability

Strong buying signals:
- Mentioned current pain point (missing 30% of calls)
- Asked about implementation timeline
- Ready to book demo

Conversation quality score: 9/10`,
      contactEmail: 'dr.smith@medicalclinic.com',
      contactPhone: '+1-555-987-6543',
      timestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long'
      })
    });

    if (result4.success) {
      console.log(`✅ Hot lead alert sent (ID: ${result4.id})`);
    } else {
      console.error(`❌ Failed to send hot lead alert: ${result4.error}`);
    }
  } catch (error: any) {
    console.error(`❌ Exception in test 4: ${error.message}`);
  }
  console.log('');

  // Test 5: ICS File Generation
  console.log('--- Test 5: ICS File Generation ---');
  try {
    const testStart = new Date('2026-03-15T10:00:00Z');
    const testEnd = new Date('2026-03-15T10:30:00Z');

    const icsContent = generateICSFile({
      startTime: testStart,
      endTime: testEnd,
      summary: 'Test Calendar Event',
      description: 'This is a test calendar event',
      location: 'Virtual (Zoom)',
      organizerEmail: 'organizer@voxanne.ai',
      attendeeEmail: 'attendee@example.com',
      attendeeName: 'Test Attendee'
    });

    const expectedFields = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'SUMMARY:Test Calendar Event',
      'DESCRIPTION:This is a test calendar event',
      'LOCATION:Virtual (Zoom)',
      'ORGANIZER',
      'ATTENDEE',
      'VALARM',
      'END:VCALENDAR'
    ];

    const missingFields = expectedFields.filter(field => !icsContent.includes(field));

    if (missingFields.length === 0) {
      console.log('✅ ICS file generated with all required fields');
      console.log(`   File size: ${icsContent.length} bytes`);
    } else {
      console.error(`❌ ICS file missing fields: ${missingFields.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`❌ Exception in test 5: ${error.message}`);
  }
  console.log('');

  // Test 6: Date/Time Formatting Helpers
  console.log('--- Test 6: Date/Time Formatting ---');
  try {
    const testDate = new Date('2026-02-15T14:30:00Z');

    const formattedDate = formatEmailDate(testDate);
    const formattedTime = formatEmailTime(testDate, 'GMT');

    console.log(`  Date: ${formattedDate}`);
    console.log(`  Time: ${formattedTime}`);

    if (formattedDate && formattedTime) {
      console.log('✅ Date/time formatting working correctly');
    } else {
      console.error('❌ Date/time formatting failed');
    }
  } catch (error: any) {
    console.error(`❌ Exception in test 6: ${error.message}`);
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('✅ Email Service V2 Testing Complete');
  console.log('═══════════════════════════════════════');
  console.log('\nCheck your email inbox and spam folder for test emails.');
  console.log('Also check support@voxanne.ai inbox for internal notifications.\n');
}

// Run tests
testEmailServiceV2().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
