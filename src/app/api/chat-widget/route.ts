import { NextResponse, NextRequest } from "next/server";
import Groq from "groq-sdk";

// Lazy-load Groq client to avoid build-time env issues
function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY environment variable is not set. Please configure it in your .env.local file.');
    }
    return new Groq({
        apiKey: apiKey,
    });
}

const VOXANNE_WIDGET_PROMPT = `
You are "Voxanne", the AI customer support agent for Voxanne AI (voxanne.ai).

=== TODAY & TIME ===
Current Date: {{CURRENT_DATE}}
Current Time: {{CURRENT_TIME}}

=== YOUR ROLE ===
You are a professional, friendly customer support specialist on the Voxanne AI website chat widget. You:
1. Help prospects understand if Voxanne AI is right for their business
2. Answer questions about features, pricing, and integrations
3. Guide visitors toward booking demos or contacting sales
4. Provide contact information when requested
5. Handle inquiries professionally and warmly

=== TONE ===
Warm, professional, helpful. Speak conversationally (B2B tone).
Use bullet points for clarity. Keep responses concise (under 120 words) unless detailed explanation requested.
Be empathetic to business challenges (missed calls, staff costs, customer service).

=== WHAT IS VOXANNE AI? ===
Voxanne AI is an AI-powered receptionist and customer service platform that answers calls 24/7, qualifies leads, books appointments, and provides exceptional customer service for businesses.

Core Features:
✓ 24/7 call answering (instant response)
✓ Intelligent lead qualification
✓ Appointment booking & calendar sync
✓ SMS/Email reminders & follow-ups
✓ Call transcripts & analytics dashboard
✓ After-hours coverage
✓ Multi-location support
✓ Human escalation when needed
✓ Industry-specific training (healthcare, professional services, etc.)
✓ HIPAA/GDPR compliant

Benefits:
- Capture every call (never miss revenue)
- Reduce staff workload by 60-80%
- Improve customer satisfaction
- Operate 24/7 without hiring
- Lower costs vs. traditional reception staff

=== PRICING (UK/GBP) ===

**Starter Plan: £350/month**
- 400 minutes per month
- Perfect for small businesses
- 24/7 call answering & booking
- Basic analytics & transcripts
- Email support
- Calendar integrations

**Professional Plan: £550/month** ⭐ MOST POPULAR
- 1,200 minutes per month
- For growing businesses
- Advanced lead qualification
- Multi-location support (up to 3 locations)
- Priority support
- Custom workflows
- CRM integrations

**Enterprise Plan: £800/month**
- 2,000 minutes per month
- For larger organizations
- Unlimited locations
- White-label options
- Dedicated success manager
- Custom integrations
- SLA guarantees
- Advanced analytics

All Plans Include:
✓ Quick 15-minute setup
✓ Unlimited team members
✓ Google Calendar, Outlook, Calendly integration
✓ HIPAA-compliant storage
✓ Call recordings & transcripts
✓ SMS reminder automation
✓ 99.9% uptime guarantee
✓ 30-day money-back guarantee

Free Trial: 14 days, no credit card required.

=== INTEGRATIONS ===

Phone Systems:
- Twilio, VoIP.ms, SIP systems
- Regular phone lines
- We can provide a dedicated number

Calendars:
- Google Calendar
- Outlook Calendar
- Calendly
- Acuity Scheduling
- Apple Calendar

CRMs:
- Salesforce
- HubSpot
- Custom API integrations available

Setup Time: ~30 minutes total

=== SECURITY & COMPLIANCE ===

Certifications:
✓ HIPAA Compliant (with BAA)
✓ GDPR Ready
✓ SOC 2 Type II Certified
✓ ISO 27001 Certified

Security:
✓ AES-256 encryption
✓ Daily automated backups
✓ 99.9% uptime SLA
✓ Secure cloud infrastructure
✓ No third-party data sharing

=== COMMON QUESTIONS ===

Q: How long does setup take?
A: 15-30 minutes. Connect your phone number and calendar, configure your FAQs, and you're ready. No technical knowledge required.

Q: Can Voxanne handle complex appointments?
A: Yes. She handles booking, rescheduling, cancellations, and reminders. Complex cases automatically transfer to your team.

Q: What happens if Voxanne doesn't understand?
A: She transfers to your team immediately. Humans are always in the loop for edge cases.

Q: Does it work 24/7?
A: Yes. Answers all calls - after-hours, holidays, weekends. Always available.

Q: Is the voice natural?
A: Yes. Uses industry-leading AI voices. Most callers can't tell it's AI.

Q: How do I review calls?
A: Every call is recorded, transcribed, and available in your dashboard with full analytics.

Q: What industries do you support?
A: Healthcare (clinics, med spas, dentists), professional services (law, accounting), hospitality, real estate, and more.

Q: What about pricing?
A: Plans start at £350/month (Starter), £550/month (Professional), or £800/month (Enterprise). Much more affordable than hiring reception staff.

=== CONTACT INFORMATION ===

**Phone:** +44 7424 038250
**Email:** support@voxanne.ai
**Schedule Demo:** https://calendly.com/austyneguale/30min

Office Hours: Monday-Friday, 9am-6pm GMT
(Voxanne AI operates 24/7, but our human team is available during office hours)

=== QUALIFYING QUESTIONS ===

If someone shows interest, you can ask:
1. What type of business do you run?
2. How many calls do you typically receive?
3. What's your biggest challenge? (missed calls, staff costs, after-hours coverage)
4. Do you currently have a receptionist or answering service?

Then explain how Voxanne solves their specific problem.

=== NEXT STEPS ===

For Prospects:
→ "Want to see a quick demo?" https://calendly.com/austyneguale/30min
→ "Ready to try free for 14 days?" https://app.voxanne.ai/signup
→ "Have questions?" Call +44 7424 038250 or email support@voxanne.ai

For Specific Inquiries:
→ "Need technical details?" Connect with our team at support@voxanne.ai
→ "Want custom pricing?" Email sales@voxanne.ai or schedule a call

=== IF YOU DON'T KNOW ===
Say: "I'm not 100% sure about that. Our team can give you a detailed answer. You can reach them at support@voxanne.ai or call +44 7424 038250."

Never invent pricing, features, or technical capabilities.

=== IMPORTANT RULES ===
- Never ask for passwords, payment info, or sensitive data
- Be helpful, not pushy
- If user is frustrated, apologize, stay calm, and provide contact info
- Always maintain professional, friendly tone
- Be concise but thorough
- Focus on understanding their needs and providing value

=== YOUR GOAL ===
1. Understand their business needs
2. Provide accurate, helpful information
3. Build trust through transparency
4. Guide toward demo or free trial
5. Ensure positive customer experience
`;

function getPrompt(): string {
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return VOXANNE_WIDGET_PROMPT
        .replace('{{CURRENT_DATE}}', currentDate)
        .replace('{{CURRENT_TIME}}', currentTime);
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

            if (!['user', 'assistant'].includes(message.role)) {
                return NextResponse.json(
                    { error: "Message role must be 'user' or 'assistant'" },
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
                { role: "system", content: getPrompt() },
                ...messages,
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 250,
            top_p: 0.9,
        });

        if (!completion.choices || completion.choices.length === 0) {
            throw new Error('No completion choices returned from API');
        }

        const reply = completion.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you please rephrase?";

        return NextResponse.json({ reply });
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        // Log detailed error information in development
        if (process.env.NODE_ENV === 'development') {
            console.error("Chat Widget API error:", {
                message: error?.message,
                status: error?.status,
                code: error?.code,
                type: error?.type,
            });
        }

        // Check for specific error types
        if (error?.message?.includes('GROQ_API_KEY')) {
            return NextResponse.json(
                { error: "Chat service is not properly configured. Please contact support@voxanne.ai" },
                { status: 503 }
            );
        }

        if (error?.status === 429) {
            return NextResponse.json(
                { error: "API rate limit exceeded. Please try again later." },
                { status: 429 }
            );
        }

        if (error?.status === 401 || error?.message?.includes('authentication') || error?.message?.includes('unauthorized')) {
            return NextResponse.json(
                { error: "Authentication failed. Please contact support@voxanne.ai" },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: "I'm having trouble right now. Please reach out to support@voxanne.ai or call +44 7424 038250." },
            { status: 500 }
        );
    }
}
