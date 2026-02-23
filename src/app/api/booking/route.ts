import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, scheduledAt, scheduledTime } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !scheduledAt || !scheduledTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Combine date and time into a single timestamp
    const appointmentDate = new Date(scheduledAt);
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);

    // Forward to backend API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact: {
          firstName,
          lastName,
          email,
          phone: phone || null,
        },
        appointment: {
          scheduledAt: appointmentDate.toISOString(),
          durationMinutes: 30,
          notes: 'Booked via website booking form',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create appointment');
    }

    const result = await response.json();

    // Send confirmation email
    try {
      await fetch(`${backendUrl}/api/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          appointmentDate: appointmentDate.toISOString(),
          appointmentTime: scheduledTime,
          confirmationNumber: result.appointmentId || generateConfirmationNumber(),
        }),
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    return NextResponse.json({
      success: true,
      appointmentId: result.appointmentId,
      confirmationNumber: result.appointmentId || generateConfirmationNumber(),
      message: 'Appointment booked successfully',
    });
  } catch (error) {
    console.error('Booking API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateConfirmationNumber(): string {
  const prefix = 'VOX';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
