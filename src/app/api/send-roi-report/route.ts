import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Rate limiting - simple in-memory store (for production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0] : 'unknown';
}

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const userLimit = requestCounts.get(key);

    if (!userLimit || now > userLimit.resetTime) {
        requestCounts.set(key, { count: 1, resetTime: now + 3600000 }); // 1 hour window
        return true;
    }

    if (userLimit.count >= 5) { // 5 requests per hour
        return false;
    }

    userLimit.count++;
    return true;
}

// Email validation
function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
        return false;
    }

    email = email.trim().toLowerCase();

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return false;
    }

    // Prevent common attacks
    if (email.includes('\n') || email.includes('\r') || email.includes(',')) {
        return false;
    }

    // Check length
    if (email.length > 254) {
        return false;
    }

    return true;
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting check
        const rateLimitKey = getRateLimitKey(request);
        if (!checkRateLimit(rateLimitKey)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        const { email, missedCallsPerWeek = 10 } = await request.json();

        // Email validation
        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: 'Please provide a valid email address.' },
                { status: 400 }
            );
        }

        // Sanitize email
        const sanitizedEmail = email.trim().toLowerCase();

        // Validate missedCallsPerWeek
        const callsPerWeek = parseInt(missedCallsPerWeek, 10);
        if (isNaN(callsPerWeek) || callsPerWeek < 1 || callsPerWeek > 1000) {
            return NextResponse.json(
                { error: 'Missed calls must be a number between 1 and 1000.' },
                { status: 400 }
            );
        }

        // Calculate ROI metrics using REAL 2025 industry data
        const missedCallsPerMonth = callsPerWeek * 4;

        // Research-backed figures (December 2025):
        // - Average procedure value: $10,000 (blended avg of surgeries + med spa)
        // - Conversion rate: 30% (realistic for phone inquiries in cosmetic surgery)
        // Sources: ASPS 2025 Statistics, FirstPageSage Conversion Data
        const avgProcedureValue = 10000;
        const conversionRate = 0.30;

        const monthlyRevenueLoss = Math.round(missedCallsPerMonth * avgProcedureValue * conversionRate);
        const yearlyRevenueLoss = monthlyRevenueLoss * 12;

        // With Call Waiting AI (98% call answer rate - industry-leading)
        const withCallWaitingAIMissed = Math.round(missedCallsPerMonth * 0.02);
        const withCallWaitingAIRevenueSaved = Math.round((missedCallsPerMonth - withCallWaitingAIMissed) * avgProcedureValue * conversionRate);
        const yearlyRevenueSaved = withCallWaitingAIRevenueSaved * 12;

        // Create HTML email with professional ROI report
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Personalized ROI Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Your ROI Report</h1>
                            <p style="margin: 10px 0 0 0; color: #e0f2fe; font-size: 16px;">Personalized Revenue Analysis</p>
                        </td>
                    </tr>

                    <!-- Current Situation -->
                    <tr>
                        <td style="padding: 40px 30px; border-bottom: 2px solid #f1f5f9;">
                            <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 24px; font-weight: 700;">📊 Your Current Situation</h2>
                            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                <p style="margin: 0 0 10px 0; color: #7f1d1d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Missed Calls</p>
                                <p style="margin: 0; color: #991b1b; font-size: 36px; font-weight: 700;">${missedCallsPerWeek} <span style="font-size: 18px; font-weight: 400;">per week</span></p>
                                <p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 14px;">${missedCallsPerMonth} missed calls per month</p>
                            </div>
                            
                            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
                                <p style="margin: 0 0 10px 0; color: #7f1d1d; font-size: 14px; font-weight: 600; text-transform: uppercase;">Revenue Loss</p>
                                <p style="margin: 0; color: #991b1b; font-size: 42px; font-weight: 700;">$${monthlyRevenueLoss.toLocaleString()}<span style="font-size: 18px; font-weight: 400;">/month</span></p>
                                <p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 16px; font-weight: 600;">$${yearlyRevenueLoss.toLocaleString()} per year</p>
                            </div>
                        </td>
                    </tr>

                    <!-- With Call Waiting AI -->
                    <tr>
                        <td style="padding: 40px 30px; background-color: #f0fdf4;">
                            <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 24px; font-weight: 700;">✨ With Call Waiting AI AI</h2>
                            
                            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                                <p style="margin: 0 0 10px 0; color: #d1fae5; font-size: 14px; font-weight: 600; text-transform: uppercase;">98% Call Answer Rate</p>
                                <p style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700;">$${withCallWaitingAIRevenueSaved.toLocaleString()}</p>
                                <p style="margin: 10px 0 0 0; color: #d1fae5; font-size: 16px;">saved per month</p>
                            </div>

                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td width="50%" style="padding-right: 10px;">
                                        <div style="background-color: #ffffff; border: 2px solid #10b981; padding: 20px; border-radius: 8px; text-align: center;">
                                            <p style="margin: 0 0 5px 0; color: #065f46; font-size: 12px; font-weight: 600;">YEARLY SAVINGS</p>
                                            <p style="margin: 0; color: #047857; font-size: 24px; font-weight: 700;">$${yearlyRevenueSaved.toLocaleString()}</p>
                                        </div>
                                    </td>
                                    <td width="50%" style="padding-left: 10px;">
                                        <div style="background-color: #ffffff; border: 2px solid #10b981; padding: 20px; border-radius: 8px; text-align: center;">
                                            <p style="margin: 0 0 5px 0; color: #065f46; font-size: 12px; font-weight: 600; text-transform: uppercase;">MISSED CALLS</p>
                                            <p style="margin: 0; color: #047857; font-size: 24px; font-weight: 700;">Only ${withCallWaitingAIMissed}/mo</p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ROI Breakdown -->
                    <tr>
                        <td style="padding: 40px 30px; border-top: 2px solid #f1f5f9;">
                            <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 20px; font-weight: 700;">📈 How We Calculated This</h2>
                            <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
                                <tr style="background-color: #f8fafc;">
                                    <td style="padding: 12px; color: #475569;">Missed calls per month</td>
                                    <td style="padding: 12px; color: #0f172a; font-weight: 600; text-align: right;">${missedCallsPerMonth}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; color: #475569;">Average procedure value</td>
                                    <td style="padding: 12px; color: #0f172a; font-weight: 600; text-align: right;">$${avgProcedureValue.toLocaleString()}</td>
                                </tr>
                                <tr style="background-color: #f8fafc;">
                                    <td style="padding: 12px; color: #475569;">Conversion rate (industry avg)</td>
                                    <td style="padding: 12px; color: #0f172a; font-weight: 600; text-align: right;">${(conversionRate * 100)}%</td>
                                </tr>
                                <tr style="border-top: 2px solid #e2e8f0;">
                                    <td style="padding: 12px; color: #0f172a; font-weight: 700;">Monthly revenue loss</td>
                                    <td style="padding: 12px; color: #dc2626; font-weight: 700; font-size: 18px; text-align: right;">$${monthlyRevenueLoss.toLocaleString()}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                        <td style="padding: 40px 30px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); text-align: center;">
                            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 24px; font-weight: 700;">Ready to Stop Losing Revenue?</h3>
                            <p style="margin: 0 0 25px 0; color: #cbd5e1; font-size: 16px;">Book a demo and see Call Waiting AI in action</p>
                            <a href="https://callwaitingai.dev" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 16px;">Book Your Demo →</a>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">CallWaiting AI - Never Miss Another Patient</p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">This report was generated based on industry averages for cosmetic surgery practices.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        // Configure nodemailer with Zoho SMTP
        const transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || 'support@callwaitingai.dev',
                pass: process.env.SMTP_PASSWORD,
            },
        });

        // Send email
        const info = await transporter.sendMail({
            from: '"CallWaiting AI" <support@callwaitingai.dev>',
            to: sanitizedEmail,
            subject: `Your ROI Report: You're Losing $${monthlyRevenueLoss.toLocaleString()}/Month`,
            html: htmlContent,
        });

        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Email sent:', info.messageId);
        }

        return NextResponse.json({
            success: true,
            message: 'ROI report sent successfully',
            emailId: info.messageId,
            metrics: {
                missedCallsPerWeek: callsPerWeek,
                missedCallsPerMonth,
                monthlyRevenueLoss,
                yearlyRevenueLoss,
                withCallWaitingAIRevenueSaved,
                yearlyRevenueSaved,
            }
        });

    } catch (error) {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error generating ROI report:', error);
        }

        return NextResponse.json(
            { error: 'Failed to send ROI report. Please try again later.' },
            { status: 500 }
        );
    }
}
