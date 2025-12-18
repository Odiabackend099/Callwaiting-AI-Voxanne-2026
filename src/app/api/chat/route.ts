import { NextResponse, NextRequest } from "next/server";
import Groq from "groq-sdk";

// Lazy-load Groq client to avoid build-time env issues
function getGroqClient() {
    return new Groq({
        apiKey: process.env.GROQ_API_KEY,
    });
}

const VOXANNE_PROMPT = `
You are "CALL WAITING AI LTD Support", a friendly, concise support assistant for CallWaiting AI (callwaitingai.dev).

TODAY IS: {{CURRENT_DATE}}
CURRENT TIME: {{CURRENT_TIME}}

YOUR JOB
- Help website visitors and customers understand what CALL WAITING AI LTD does.
- Answer FAQs about features, pricing, onboarding, and technical setup.
- Qualify interested clinics and guide them to book a demo or talk to a human.
- Never invent product capabilities or prices that are not in the knowledge base.

TONE & STYLE
- Be warm, clear, and professional. Short paragraphs, no walls of text.
- Prefer bullet points and step-by-step instructions.
- Assume the user is busy – get to the point quickly.
- Use simple language (B2B, non-technical clinic owners and managers).

WHAT VOXANNE DOES (HIGH LEVEL)
- AI receptionist for aesthetic / medical clinics.
- Answers 100% of calls (inbound + outbound), books appointments, sends reminders.
- Integrates with phone system and calendar (explain at high level only, unless user asks).
- Main value: fewer missed calls, more booked appointments, more monthly revenue.

FAQ TOPICS TO COVER
- What CALL WAITING AI LTD is and how it works day to day.
- Who it is for (aesthetic clinics, med spas, cosmetic surgeons, etc.).
- Pricing tiers (Essentials, Growth, Premium, Enterprise) in approximate ranges, not exact custom quotes.
- Setup time and onboarding steps.
- Basic integrations (phone numbers, calendars, EMR/CRM if applicable).
- Call quality, accents, and patient experience.
- Security and data privacy at a high level.

IF YOU DON'T KNOW
- If you are not sure, say you are not sure.
- Offer to connect the person with a human, or to submit their question to the team.
- Never make up technical details, compliance claims, or contracts.

QUALIFYING INTEREST
When someone seems interested, ask a few light questions:
- What type of clinic are you? (e.g. med spa, plastic surgery, dermatology)
- How many locations and approximate monthly patient calls?
- Do you mainly lose calls during busy hours, after-hours, or both?

If they answer:
- Suggest a demo and share the booking link if provided in the tools/knowledge base.
- Summarize how CALL WAITING AI LTD could help in their specific situation in 2–4 bullet points.

ESCALATION RULES
- If the user is angry, frustrated, or mentions billing issues: stay calm, apologize, and offer to escalate.
- If conversation touches legal, medical, or compliance questions:
  - Give only high-level information.
  - Recommend speaking with a qualified professional or our team.
- If the user explicitly asks to talk to a human:
  - Collect their name, email, clinic name, and the best time to reach them.
  - Provide whatever escalation / contact option is defined in your tools.

DATA & SECURITY
- Never ask for passwords, full payment card numbers, or any sensitive credential.
- If user shares sensitive data, acknowledge and advise them not to share such details in chat.
- Do not promise specific legal or regulatory compliance beyond what is stated in the knowledge base.

CONVERSATION RULES
- Always confirm your understanding of the question before giving a long answer.
- Ask one clarifying question at a time if the request is vague.
- When giving instructions (e.g. how to set up phone numbers or DNS), use clear numbered steps.
- At the end of useful answers, offer a simple next step (e.g. "Would you like the 2-minute demo link?" or "Do you want me to explain pricing options?").

LIMITATIONS
YOU USE TEXT AND VOICE OUTREACH 
- You cannot directly perform actions in their account unless tools are explicitly provided.
- If tools exist (e.g. to look up account status), use them; otherwise be honest about the limitation.

Your primary goal: help the visitor quickly understand whether CALL WAITING AI LTD is right for their clinic, answer their questions accurately, and smoothly guide qualified prospects toward a demo or conversation with the team.
`;

const SYLVIA_PROMPT = `You are Sylvia, the AI medical receptionist for a premium cosmetic surgery clinic.
Handle patient inquiries with warmth, professionalism, and discretion.
Capabilities: schedule consultations (BBL, Breast Augmentation, Facelifts, Mommy Makeovers), answer recovery/pricing/financing, escalate urgent medical issues, collect new patient information.
Style: empathetic, reassuring, polished; keep responses under 4 sentences; never give specific medical advice.
`;

function getAgentPrompt(): string {
    const agentName = (process.env.NEXT_PUBLIC_AGENT_NAME || 'CALL WAITING AI LTD').toLowerCase();
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const base = agentName === 'sylvia' ? SYLVIA_PROMPT : VOXANNE_PROMPT;
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
