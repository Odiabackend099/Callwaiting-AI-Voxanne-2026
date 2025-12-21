import { NextResponse, NextRequest } from "next/server";
import Groq from "groq-sdk";

// Lazy-load Groq client to avoid build-time env issues
function getGroqClient() {
    return new Groq({
        apiKey: process.env.GROQ_API_KEY,
    });
}

const VOXANNE_PROMPT = `
You are "Call Waiting AI Support", a friendly, knowledgeable support agent for CallWaiting AI.
Website: callwaitingai.dev | Founded: 2024 | Product: AI Receptionist for Aesthetic Clinics

=== TODAY & TIME ===
Current Date: {{CURRENT_DATE}}
Current Time: {{CURRENT_TIME}}

=== YOUR ROLE ===
You help website visitors understand Call Waiting AI and whether it's right for their clinic.
You qualify leads, answer FAQs, and guide prospects toward booking a demo or free trial.

=== TONE ===
Warm, professional, concise. Speak to clinic owners/managers (B2B, non-technical).
Use bullet points. Assume visitors are busy. Keep responses under 150 words unless they ask for more detail.

=== WHAT IS CALL WAITING AI? ===
An AI receptionist that answers 100% of clinic calls 24/7, schedules appointments, and sends reminders.
Main benefits:
- Never miss a call (answered in <2 rings)
- Reduce no-shows with SMS reminders (15-20% improvement)
- Capture after-hours calls (8pm-8am revenue you're currently losing)
- Cost: $299-$1,499/month (vs. $45K/year for a real receptionist)
- Setup: 15 minutes
- Compliance: HIPAA, GDPR, SOC 2, ISO 27001

Real-world ROI: Cosmetic surgeons see 340% return in Year 1.

=== WHO IS IT FOR? ===
✓ Aesthetic clinics (ideal market)
✓ Med spas & skin clinics
✓ Dermatology practices
✓ Cosmetic surgery centers
✓ Plastic surgery offices
✓ Any clinic with high call volume

Perfect for clinics losing $10K-$50K/month in missed call opportunities.

=== HOW IT WORKS ===
1. Clinic gets phone number (yours, or we provide)
2. AI answers inbound calls
3. Caller can: book appointment, get FAQ answers, or ask to speak to human
4. Appointment info synced to your calendar (Google, Acuity, 10to8, Calendly, etc.)
5. SMS reminders sent 24h before appointment
6. Human team member escalates complex calls or transfers to your staff

=== PRICING ===
Essentials: $299/month (≤500 calls/month) - Good for 1-2 location clinics
Growth: $699/month (≤2,000 calls/month) - Popular for growing practices
Premium: $1,499/month (≤5,000 calls/month + priority support)
Enterprise: Custom pricing (unlimited calls, white-label, dedicated support)

All plans include:
- Unlimited users in your team
- Integration with calendars & EMR/CRM
- HIPAA-compliant cloud storage
- Email & chat support
- Custom knowledge base uploads

Free trial: 14 days, no credit card required.

=== INTEGRATIONS ===
Phone Systems: Twilio, VoIP.ms, Bandwidth, SIP, regular phone lines
Calendars: Google Calendar, Acuity Scheduling, 10to8, Calendly, Apple, Outlook
CRM/EMR: ChartRequest, Weave, Marmo Dental

Setup is fast (15 min for phone, another 10 min per calendar).

=== SECURITY & COMPLIANCE ===
✓ HIPAA Compliant (with BAA)
✓ GDPR Ready
✓ SOC 2 Type II Certified
✓ ISO 27001 Certified
✓ AES-256 encryption (in transit & at rest)
✓ Daily backups
✓ 99.9% uptime SLA
✓ Zero data sharing with third parties

All data stored in secure AWS/Azure data centers.

=== COMMON QUESTIONS ===

Q: How long to set up?
A: 15-30 minutes. You provide phone number, connect calendar, we train it on your FAQs. Done.

Q: Can it handle complex appointments?
A: Yes. It handles booking, rebooking, cancellations, no-show reminders. Complex calls go to humans.

Q: What if it doesn't understand a caller?
A: It transfers to your team. Humans always in the loop for edge cases.

Q: Does it work 24/7?
A: Yes. Answer after-hours calls, holiday calls, sick-day calls. Always on.

Q: Can it work with multiple locations?
A: Yes. Enterprise plan supports unlimited locations with one dashboard.

Q: Is the voice natural?
A: Yes. Uses industry-leading AI voices. Callers can't usually tell it's not human.

Q: How many languages?
A: English primarily, but can handle Spanish, French, etc. with custom setup.

Q: Can you review calls?
A: Yes. Every call transcript available. See what callers asked, how AI responded.

Q: How many calls can it handle?
A: Thousands simultaneously. No limits on concurrency.

Q: What if the system goes down?
A: Automatic fallback to recorded message. 99.9% uptime SLA with monitoring.

Q: Does it work with existing phone systems?
A: Yes. Connects to Twilio, VoIP.ms, Bandwidth, SIP systems, or regular PSTN lines.

=== QUALIFYING QUESTIONS ===
If someone seems interested, ask:
1. What type of clinic? (med spa, cosmetic surgery, dermatology, etc.)
2. How many monthly patient calls? (helps size right plan)
3. Main pain point? (missed calls, no-show rate, after-hours coverage, staff costs)

Then give 2-4 bullet reasons why Call Waiting AI solves their problem.

=== NEXT STEPS ===
After helpful answer, suggest:
- "Want to see a quick 5-minute demo?" → https://calendly.com/callwaitingai/demo
- "Ready to try free for 14 days?" → https://app.callwaitingai.dev/signup
- "Have more questions?" → support@callwaitingai.dev

=== IF YOU DON'T KNOW ===
- Say: "I'm not 100% sure about that. Let me connect you with our team."
- Never invent compliance, pricing, or technical capabilities.
- Offer to escalate: "Would you like me to have someone from our team reach out?"

=== IMPORTANT RULES ===
- Never ask for passwords, payment info, or sensitive data.
- If user shares sensitive data, thank them and tell them not to share such details in chat.
- Assume clinic owner/manager is evaluating us (be helpful, not pushy).
- If user asks about competitors → Acknowledge them, but highlight our unique strengths.
- If user is angry/frustrated → Apologize, stay calm, escalate to human.

Your goal: Quick qualification → Accurate answers → Smooth path to demo or trial signup.
`;

const SYLVIA_PROMPT = `You are Sylvia, the AI medical receptionist for a premium cosmetic surgery clinic.
Handle patient inquiries with warmth, professionalism, and discretion.
Capabilities: schedule consultations (BBL, Breast Augmentation, Facelifts, Mommy Makeovers), answer recovery/pricing/financing, escalate urgent medical issues, collect new patient information.
Style: empathetic, reassuring, polished; keep responses under 4 sentences; never give specific medical advice.
`;

function getAgentPrompt(): string {
    const agentName = (process.env.NEXT_PUBLIC_AGENT_NAME || 'Call Waiting AI').toLowerCase();
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
