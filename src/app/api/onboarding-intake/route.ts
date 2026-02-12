import { NextRequest, NextResponse } from 'next/server';
import { validateOnboardingForm } from '@/lib/validation-schemas';
import { sendOnboardingEmails } from '@/lib/email-service';
import { storeOnboardingSubmission, sendSlackAlert } from '@/lib/database-service';
import { ZodError } from 'zod';

/**
 * POST /api/onboarding-intake
 * Handles onboarding form submissions with optional file upload
 */
export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData();

    // Extract fields
    const company = formData.get('company') as string;
    let website = formData.get('website') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const greetingScript = formData.get('greetingScript') as string;
    const additionalDetails = formData.get('additionalDetails') as string;
    const file = formData.get('file') as File | null;

    // Normalize website URL - add https:// if missing and not empty
    if (website && !website.match(/^https?:\/\//i)) {
      website = `https://${website}`;
    }

    // Validate input
    const validatedData = validateOnboardingForm({
      company,
      website,
      phone,
      email,
      greetingScript,
      additionalDetails,
      pricingPdfUrl: file ? `uploaded-${Date.now()}` : '',
    });

    // Handle file upload if provided
    if (file && file.size > 0) {
      // Validate file
      if (!file.type.includes('pdf')) {
        return NextResponse.json(
          {
            success: false,
            error: 'File must be a PDF',
          },
          { status: 400 }
        );
      }

      if (file.size > 100 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            error: 'File must be smaller than 100MB',
          },
          { status: 413 }
        );
      }

      // In production, you would upload to Supabase Storage here
      // For now, we'll just note that a file was received
      console.log(`File received: ${file.name} (${file.size} bytes)`);
    }

    // Store in database
    const submission = await storeOnboardingSubmission(validatedData);

    // Send emails
    const emailResult = await sendOnboardingEmails(validatedData);

    if (!emailResult.success) {
      console.warn('Email sending failed:', emailResult.error);
    }

    // Send Slack alert
    await sendSlackAlert('onboarding', validatedData);

    return NextResponse.json(
      {
        success: true,
        message: 'Your onboarding information has been received. Our team will configure your instance within 24 hours.',
        submissionId: submission.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Onboarding form submission error:', error);

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
 * GET /api/onboarding-intake
 * Health check
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      endpoint: '/api/onboarding-intake',
      method: 'POST',
      accepts: 'multipart/form-data',
    },
    { status: 200 }
  );
}
