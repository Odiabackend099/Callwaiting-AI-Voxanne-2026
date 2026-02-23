import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Forward to backend API to save contact
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

    // Save contact to database
    const contactResponse = await fetch(`${backendUrl}/api/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone: phone || null,
        source: 'website_booking_form',
        leadStatus: 'warm',
        notes: 'Contact initiated booking - redirected to Calendly',
      }),
    });

    if (!contactResponse.ok) {
      const errorData = await contactResponse.json();
      console.error('Failed to save contact:', errorData);
      // Don't fail - continue to send email notification
    }

    // Send notification email to support team
    try {
      await fetch(`${backendUrl}/api/contact-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,
          email,
          phone: phone || 'Not provided',
          subject: '🔥 New Booking Lead - Redirected to Calendly',
          message: `New contact details submitted from booking form:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n\nUser was redirected to Calendly to complete scheduling.`,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the submission if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Contact details saved successfully',
    });
  } catch (error) {
    console.error('Contact lead API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
