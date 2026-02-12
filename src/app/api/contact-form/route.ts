import { NextRequest, NextResponse } from 'next/server';
import { validateContactForm } from '@/lib/validation-schemas';
import { sendContactFormEmails } from '@/lib/email-service';
import { storeContactSubmission, sendSlackAlert } from '@/lib/database-service';
import { ZodError } from 'zod';

/**
 * POST /api/contact-form
 * Handles contact form submissions
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = validateContactForm(body);

    // Store in database
    const submission = await storeContactSubmission(validatedData);

    // Send emails
    const emailResult = await sendContactFormEmails(validatedData);

    if (!emailResult.success) {
      console.warn('Email sending failed:', emailResult.error);
    }

    // Send Slack alert
    await sendSlackAlert('contact', validatedData);

    return NextResponse.json(
      {
        success: true,
        message: 'Your message has been received. We will get back to you within 24 hours.',
        submissionId: submission.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form submission error:', error);

    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process your submission. Please try again or email support@voxanne.ai directly.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contact-form
 * Health check
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      endpoint: '/api/contact-form',
      method: 'POST',
    },
    { status: 200 }
  );
}
