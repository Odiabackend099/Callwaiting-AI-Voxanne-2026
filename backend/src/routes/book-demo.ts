import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { sendEmailViaSmtp } from '../services/email-service';

const router = Router();

// POST /api/book-demo
// Handle demo booking requests
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, clinic_name, clinic_type, notes } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !clinic_name) {
      return res.status(400).json({
        error: 'Missing required fields: name, email, phone, clinic_name'
      });
    }

    // Store booking in database
    const { data: booking, error: dbError } = await supabase
      .from('demo_bookings')
      .insert({
        org_id: 'a0000000-0000-0000-0000-000000000001', // Default org for public bookings
        agent_id: null,
        call_id: null,
        prospect_name: name,
        prospect_email: email,
        prospect_phone: phone,
        clinic_name,
        timezone: null,
        preferred_time_window: null,
        status: 'pending',
        email_sent: false,
        sms_sent: false,
        whatsapp_sent: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Book Demo] Database error:', dbError);
      // Continue with email sending even if DB fails
    }

    // Send confirmation email to prospect
    const prospectEmailResult = await sendEmailViaSmtp({
      to: email,
      to_name: name,
      subject: 'Demo Booking Confirmed - Call Waiting AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">Demo Booking Confirmed</h2>
          <p>Hi ${name},</p>
          <p>Thank you for booking a demo with Call Waiting AI! We've received your request and will contact you shortly.</p>
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3>Booking Details:</h3>
            <p><strong>Clinic:</strong> ${clinic_name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          <p>Our team will reach out within 24 hours to schedule your personalized demo.</p>
          <p>Questions? Call us at +44 7424 038250</p>
          <br>
          <p>Best regards,<br>The Call Waiting AI Team</p>
        </div>
      `,
      text: `
        Demo Booking Confirmed
        
        Hi ${name},
        
        Thank you for booking a demo with Call Waiting AI! We've received your request and will contact you shortly.
        
        Booking Details:
        Clinic: ${clinic_name}
        Phone: ${phone}
        Email: ${email}
        ${notes ? `Notes: ${notes}` : ''}
        
        Our team will reach out within 24 hours to schedule your personalized demo.
        
        Questions? Call us at +44 7424 038250
        
        Best regards,
        The Call Waiting AI Team
      `
    });

    // Send notification email to sales team
    const salesEmailResult = await sendEmailViaSmtp({
      to: 'support@voxanne.ai',
      cc: 'austyn.callwaitingai@gmail.com',
      subject: `New Demo Booking: ${clinic_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff6600;">New Demo Booking Received!</h2>
          <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border: 1px solid #ffeaa7;">
            <h3>Contact Information:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Clinic:</strong> ${clinic_name}</p>
            <p><strong>Type:</strong> ${clinic_type || 'general'}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          <p>Please contact the prospect within 24 hours to schedule their demo.</p>
          <p>Time received: ${new Date().toLocaleString()}</p>
        </div>
      `,
      text: `
        NEW DEMO BOOKING RECEIVED!
        
        Contact Information:
        Name: ${name}
        Email: ${email}
        Phone: ${phone}
        Clinic: ${clinic_name}
        Type: ${clinic_type || 'general'}
        ${notes ? `Notes: ${notes}` : ''}
        
        Please contact the prospect within 24 hours to schedule their demo.
        Time received: ${new Date().toLocaleString()}
      `
    });

    // Log results
    console.log('[Book Demo] Prospect email result:', prospectEmailResult);
    console.log('[Book Demo] Sales email result:', salesEmailResult);

    // Return success response
    return res.json({
      success: true,
      message: 'Demo booking confirmed! We will contact you within 24 hours.',
      booking_id: booking?.id
    });

  } catch (error: any) {
    console.error('[Book Demo] Error:', error);
    return res.status(500).json({
      error: 'Failed to process booking. Please try again or contact support.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export { router as bookDemoRouter };
