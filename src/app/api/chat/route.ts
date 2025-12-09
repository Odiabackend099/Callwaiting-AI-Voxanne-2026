import { NextResponse, NextRequest } from "next/server";
import Groq from "groq-sdk";

// Lazy-load Groq client to avoid build-time env issues
function getGroqClient() {
    return new Groq({
        apiKey: process.env.GROQ_API_KEY,
    });
}

const ROXANNE_PROMPT = `You are Roxanne, the world-class AI Sales Agent for CallWaiting AI operating at the Maya (Sesame AI) standard.

TODAY IS: {{CURRENT_DATE}}
CURRENT TIME: {{CURRENT_TIME}}

Identity: Human-level conversation, emotional intelligence, internet awareness, mission-driven.
Persona: Warm British-Nigerian professional; consultative, curious, empathetic, goal-oriented.
Company: We build AI Voice Receptionists for medical practices (plastic surgeons, med spas, dermatologists, cosmetic dentists). HIPAA compliant; no per-minute fees.
Pricing: Essentials $169/mo ($499 setup); Growth $289/mo ($949 setup); Premium $499/mo ($2,499 setup).

Skills: Discuss wide-ranging topics and pivot back to mission; read tone and adapt; use search when needed; steer to booking demos.
Frameworks: BANT + SPIN; Conversation stages: Greeting → Discovery → Objection Handling → Closing.
Boundaries: No medical/legal advice; no guarantees; escalate emergencies.
Goals: Book demos, qualify leads (BANT ≥75%), capture WhatsApp; keep responses concise.
`;

const SYLVIA_PROMPT = `You are Sylvia, the AI medical receptionist for a premium cosmetic surgery clinic.
Handle patient inquiries with warmth, professionalism, and discretion.
Capabilities: schedule consultations (BBL, Breast Augmentation, Facelifts, Mommy Makeovers), answer recovery/pricing/financing, escalate urgent medical issues, collect new patient information.
Style: empathetic, reassuring, polished; keep responses under 4 sentences; never give specific medical advice.
`;

function getAgentPrompt(): string {
    const agentName = (process.env.NEXT_PUBLIC_AGENT_NAME || 'Roxanne').toLowerCase();
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const base = agentName === 'sylvia' ? SYLVIA_PROMPT : ROXANNE_PROMPT;
    return base.replace('{{CURRENT_DATE}}', currentDate).replace('{{CURRENT_TIME}}', currentTime);
}

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

    if (userLimit.count >= 10) { // 10 requests per minute
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
                { error: "Rate limit exceeded. Please try again later." },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { messages } = body;

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

        // Validate message structure
        for (const message of messages) {
            if (!message.role || !message.content) {
                return NextResponse.json(
                    { error: "Each message must have role and content" },
                    { status: 400 }
                );
            }

            if (!['user', 'assistant', 'system'].includes(message.role)) {
                return NextResponse.json(
                    { error: "Message role must be 'user', 'assistant', or 'system'" },
                    { status: 400 }
                );
            }

            if (typeof message.content !== 'string' || message.content.length === 0) {
                return NextResponse.json(
                    { error: "Message content must be a non-empty string" },
                    { status: 400 }
                );
            }

            if (message.content.length > 4000) {
                return NextResponse.json(
                    { error: "Message content cannot exceed 4000 characters" },
                    { status: 400 }
                );
            }
        }

        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: getAgentPrompt() },
                ...messages,
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 150,
            top_p: 0.9,
        });

        if (!completion.choices || completion.choices.length === 0) {
            throw new Error('No completion choices returned from API');
        }

        const reply = completion.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you repeat it?";

        return NextResponse.json({ reply });
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            console.error("Chat API error:", error?.message);
        }

        // Return appropriate error response
        if (error?.status === 429) {
            return NextResponse.json(
                { error: "API rate limit exceeded. Please try again later." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "Failed to generate response. Please try again." },
            { status: 500 }
        );
    }
}
