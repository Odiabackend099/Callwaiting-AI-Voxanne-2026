import { NextResponse, NextRequest } from "next/server";

// Get backend URL
function getBackendUrl(): string {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
}

/**
 * Next.js API Route for Chat Widget
 * Proxies requests to the backend chat-widget endpoint
 * The backend handles Groq AI calls and lead qualification
 */

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
        requestCounts.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
        return true;
    }

    if (userLimit.count >= 15) { // 15 requests per minute
        return false;
    }

    userLimit.count++;
    return true;
}

export async function POST(req: NextRequest) {
    try {
        // Rate limiting check
        const rateLimitKey = getRateLimitKey(req);
        if (!checkRateLimit(rateLimitKey)) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again in a moment." },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { messages, sessionId } = body;

        // Input validation
        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            );
        }

        if (messages.length === 0 || messages.length > 50) {
            return NextResponse.json(
                { error: "Messages array must contain 1-50 messages" },
                { status: 400 }
            );
        }

        // Proxy request to backend
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/chat-widget`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, sessionId }),
        });

        const data = await response.json();

        // Backend returns { success, message, sessionId, fallback? }
        // Frontend expects { reply }
        if (response.ok && data.message) {
            return NextResponse.json({
                reply: data.message,
                sessionId: data.sessionId,
                fallback: data.fallback
            });
        }

        // If backend returned an error
        if (!response.ok) {
            console.error('Backend chat widget error:', data);
            return NextResponse.json(
                { error: data.error || "I'm having trouble right now. Please try again or contact support@voxanne.ai" },
                { status: response.status }
            );
        }

        // Fallback if no message
        return NextResponse.json({
            reply: "I'm sorry, I didn't catch that. Could you please rephrase?",
            fallback: true
        });

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        // Log detailed error information in development
        if (process.env.NODE_ENV === 'development') {
            console.error("Chat Widget API error:", {
                message: error?.message,
                stack: error?.stack,
            });
        }

        return NextResponse.json(
            { error: "I'm having trouble right now. Please reach out to support@voxanne.ai or call +44 7424 038250." },
            { status: 500 }
        );
    }
}
