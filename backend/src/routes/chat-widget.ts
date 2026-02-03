import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Groq from 'groq-sdk';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';
import { supabase } from '../services/supabase-client';

const router = Router();

// Lazy-load Groq client (only initialize when needed)
let groq: Groq | null = null;

function getGroqClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) {
    log.warn('GROQ_API_KEY not configured. Chat widget will return error responses.');
    return null;
  }

  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return groq;
}

// Zod schema for chat message validation
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1, 'At least one message is required'),
  sessionId: z.string().optional(), // For tracking conversations
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;
type ChatRequest = z.infer<typeof ChatRequestSchema>;

// System prompt for the chat widget (UK pricing and contact info)
const SYSTEM_PROMPT = `You are Voxanne, an intelligent AI assistant for Voxanne AI - a Voice-as-a-Service platform that helps businesses automate phone calls with AI.

Your role is to:
1. Answer questions about Voxanne AI's services
2. Qualify leads by understanding their business needs
3. Guide them to book a demo or contact sales
4. Be professional, friendly, and concise

**PRICING (UK):**
- **Starter Plan:** £350/month + £1,000 setup fee (400 minutes/month included)
- **Professional Plan:** £550/month + £3,000 setup fee (1,200 minutes/month included)
- **Enterprise Plan:** £800/month + £7,000 setup fee (2,000 minutes/month included)

**KEY FEATURES:**
- AI voice agents for inbound and outbound calls
- Appointment booking and calendar integration
- Knowledge base integration (answer customer questions)
- SMS follow-ups and notifications
- Real-time call transcription and analytics
- CRM integration (Salesforce, HubSpot, etc.)

**IDEAL CUSTOMERS:**
- Healthcare clinics (dentists, dermatology, physiotherapy)
- Professional services (law firms, accountants, consultants)
- Home services (plumbers, electricians, HVAC)
- Any business receiving 20+ calls per day

**CONTACT INFORMATION:**
- Phone: +44 7424 038250
- Email: support@voxanne.ai
- Book a demo: https://calendly.com/austyneguale/30min
- Website: https://voxanne.ai

**CONVERSATION STYLE:**
- Keep responses concise (2-4 sentences max unless asked for details)
- Ask qualifying questions (industry, call volume, pain points)
- Suggest booking a demo after 2-3 exchanges
- Use UK English spelling and currency
- Be enthusiastic but professional

**QUALIFYING QUESTIONS TO ASK:**
1. What industry are you in?
2. How many calls does your business receive per day?
3. What's your biggest challenge with phone calls? (missed calls, booking, customer service)
4. Are you currently using any call handling solution?

**LEAD SCORING (track internally, don't mention):**
- Hot lead: Healthcare/professional services, 50+ calls/day, mentions missed calls
- Warm lead: Service business, 20-50 calls/day, interested in automation
- Cold lead: Low call volume (<20/day), just browsing

When users show interest, encourage them to book a demo at the Calendly link or call directly.`;

/**
 * Qualify lead based on conversation (background task)
 */
async function qualifyLead(messages: ChatMessage[], sessionId?: string): Promise<void> {
  try {
    // Extract user messages only
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    // Simple keyword-based lead scoring
    let score = 0;
    let leadStatus = 'cold';
    const tags: string[] = [];

    // High-value industries
    if (
      /healthcare|clinic|dental|dermatology|doctor|medical/i.test(userMessages)
    ) {
      score += 30;
      tags.push('healthcare');
    }
    if (/law|legal|solicitor|attorney/i.test(userMessages)) {
      score += 25;
      tags.push('legal');
    }
    if (
      /plumber|electrician|hvac|contractor|home service/i.test(userMessages)
    ) {
      score += 20;
      tags.push('home_services');
    }

    // Call volume indicators
    if (/50\+|hundreds?|many calls|busy/i.test(userMessages)) {
      score += 25;
      tags.push('high_volume');
    }
    if (/20|30|40|moderate/i.test(userMessages)) {
      score += 15;
      tags.push('medium_volume');
    }

    // Pain points
    if (/missed calls|lost business|can't answer/i.test(userMessages)) {
      score += 20;
      tags.push('pain_missed_calls');
    }
    if (/booking|appointment|scheduling/i.test(userMessages)) {
      score += 15;
      tags.push('pain_booking');
    }
    if (/customer service|support|frustrated customers/i.test(userMessages)) {
      score += 10;
      tags.push('pain_customer_service');
    }

    // Intent signals
    if (/demo|show me|interested|pricing|how much/i.test(userMessages)) {
      score += 25;
      tags.push('intent_high');
    }
    if (/just looking|curious|researching/i.test(userMessages)) {
      score += 5;
      tags.push('intent_low');
    }

    // Determine lead status
    if (score >= 60) {
      leadStatus = 'hot';
    } else if (score >= 30) {
      leadStatus = 'warm';
    }

    // Store lead qualification (optional - requires chat_widget_leads table)
    const { error } = await supabase.from('chat_widget_leads').insert({
      session_id: sessionId || `chat_${Date.now()}`,
      lead_score: score,
      status: leadStatus,
      tags,
      conversation_summary: userMessages.substring(0, 500),
      created_at: new Date().toISOString(),
    });

    if (error) {
      log.warn('ChatWidget', 'Could not store lead qualification', {
        error: error.message,
        hint: 'chat_widget_leads table may not exist',
      });
    }

    // Send Slack alert for hot leads
    if (leadStatus === 'hot' && score >= 70) {
      await sendSlackAlert('🔥 Hot Lead from Chat Widget', {
        score,
        status: leadStatus,
        tags: tags.join(', '),
        summary: userMessages.substring(0, 200),
        action: 'Someone is very interested! Follow up ASAP.',
      });
    }

    log.info('ChatWidget', 'Lead qualified', {
      sessionId,
      score,
      status: leadStatus,
      tags,
    });
  } catch (error) {
    log.warn('ChatWidget', 'Lead qualification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/chat-widget
 * Handle chat widget conversations using Groq
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { messages, sessionId } = ChatRequestSchema.parse(req.body);

    log.info('ChatWidget', 'Chat request received', {
      sessionId,
      messageCount: messages.length,
    });

    // Check if Groq is configured
    const groqClient = getGroqClient();
    if (!groqClient) {
      return res.status(503).json({
        success: false,
        error: 'Chat service temporarily unavailable. Please contact support@voxanne.ai',
      });
    }

    // Prepare messages with system prompt
    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Call Groq API with error handling
    let completion;
    try {
      completion = await groqClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Fast, high-quality model
        messages: conversationMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 500, // Keep responses concise
        top_p: 0.9,
      });
    } catch (groqError: any) {
      log.error('ChatWidget', 'Groq API error', {
        error: groqError.message,
        statusCode: groqError.status,
        sessionId,
      });

      // Return fallback response instead of 500
      return res.status(200).json({
        success: true,
        message: "I'm temporarily unavailable. Please book a demo at https://calendly.com/austyneguale/30min or call us at +44 7424 038250.",
        sessionId: sessionId || `chat_${Date.now()}`,
        fallback: true,
      });
    }

    const assistantMessage = completion.choices[0]?.message?.content;

    if (!assistantMessage) {
      log.warn('ChatWidget', 'Empty response from Groq', { sessionId });
      return res.status(200).json({
        success: true,
        message: "I'm having trouble responding. Please try again or contact us directly.",
        sessionId: sessionId || `chat_${Date.now()}`,
        fallback: true,
      });
    }

    log.info('ChatWidget', 'Response generated', {
      sessionId,
      responseLength: assistantMessage.length,
      tokensUsed: completion.usage?.total_tokens,
    });

    // Qualify lead in background (async, don't wait)
    qualifyLead([...messages, { role: 'assistant', content: assistantMessage }], sessionId).catch(
      (err) => {
        log.warn('ChatWidget', 'Background lead qualification failed', {
          error: err.message,
        });
      }
    );

    return res.status(200).json({
      success: true,
      message: assistantMessage,
      sessionId: sessionId || `chat_${Date.now()}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn('ChatWidget', 'Validation error', {
        errors: error.errors,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    log.error('ChatWidget', 'Chat request failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Send error alert to Slack (only for server errors, not API errors)
    if (!(error instanceof Error && error.message.includes('Groq'))) {
      await sendSlackAlert('🔴 Chat Widget Error', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: req.body.sessionId || 'unknown',
      });
    }

    // Return fallback response if Groq API fails
    return res.status(200).json({
      success: true,
      message:
        "I'm temporarily unavailable. Please book a demo at https://calendly.com/austyneguale/30min or call us at +44 7424 038250. We'd love to chat!",
      sessionId: req.body.sessionId || `chat_${Date.now()}`,
      fallback: true,
    });
  }
});

/**
 * GET /api/chat-widget/health
 * Health check endpoint for chat widget
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if Groq is configured
    const groqClient = getGroqClient();
    if (!groqClient) {
      return res.status(503).json({
        success: false,
        groq: 'not_configured',
        error: 'GROQ_API_KEY not set',
        timestamp: new Date().toISOString(),
      });
    }

    // Test Groq API connectivity
    const testCompletion = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 10,
    });

    const isHealthy = testCompletion.choices.length > 0;

    return res.status(200).json({
      success: true,
      groq: isHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('ChatWidget', 'Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(503).json({
      success: false,
      groq: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
