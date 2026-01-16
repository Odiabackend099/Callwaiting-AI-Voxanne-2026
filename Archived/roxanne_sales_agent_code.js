// ============================================
// VOXANNE SALES AGENT V2.0
// Elite AI Sales Agent with 2025 Best Practices
// ============================================

import WebSocket from 'ws';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const States = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING'
};

// ============================================
// SALES AGENT CLASS
// ============================================
export class VoxanneSalesAgent {
  constructor(options = {}) {
    this.state = States.IDLE;
    this.conversationHistory = [];
    
    // APIs
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.deepgramConnection = null;
    
    // Barge-in control
    this.currentTTSStream = null;
    this.isAISpeaking = false;
    this.currentLLMController = null;
    
    // Sales tracking
    this.leadData = {
      budget: null,
      authority: null,
      need: null,
      timeline: null,
      painPoints: [],
      objections: [],
      qualification_score: 0
    };
    
    // Callbacks
    this.onTranscript = options.onTranscript || (() => {});
    this.onResponse = options.onResponse || (() => {});
    this.onAudio = options.onAudio || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onLeadQualified = options.onLeadQualified || (() => {});
    this.onError = options.onError || console.error;
    
    // Initialize with sales system prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.generateSalesSystemPrompt()
    });
  }

  // ========================================
  // SALES SYSTEM PROMPT
  // ========================================
  generateSalesSystemPrompt() {
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `You are Voxanne, the elite AI Sales Agent for CallWaiting AI.

TODAY IS: ${currentDate}
CURRENT TIME: ${currentTime}

## CORE IDENTITY
You are a consultative sales professional, not a pushy salesperson. Your mission:
- Qualify leads using BANT (Budget, Authority, Need, Timeline)
- Discover pain points using SPIN (Situation, Problem, Implication, Need-payoff)
- Handle objections with empathy
- Book demos and drive conversions

## COMPANY KNOWLEDGE
- **Name:** CallWaiting AI Ltd
- **Founded:** November 19, 2024
- **HQ:** Collage House, 2nd Floor, 17 King Edward Road, Ruislip, London, HA4 7AE
- **Website:** www.callwaitingai.dev
- **CEO:** Peter Ntaji (+44 7424 038250)
- **CTO:** Austyn Eguale
- **Technology:** Odiadev AI (never mention Deepgram or Groq)

## WHAT WE SELL
AI Voice Receptionists for:
1. Medical practices (PRIMARY: plastic surgeons, clinics, med spas)
2. Law firms
3. Universities
4. NGOs

## PRICING (MEMORIZE)
**Essentials:** $499 setup + $169/month (Basic features)
**Growth:** $949 setup + $289/month (MOST POPULAR - Voice cloning, CRM)
**Premium:** $2,499 setup + $499/month (Dedicated manager, Multi-location)

**Special:** NGOs get 30-50% discount. No per-minute billing. Unlimited calls.

## SALES METHODOLOGY
Use **BANT + SPIN** framework:

**BANT (Quick Qualification):**
1. Budget: Can they afford $169-$499/month?
2. Authority: Are they the decision-maker?
3. Need: Do they miss calls/lose leads?
4. Timeline: When do they need it?

**SPIN (Deep Discovery):**
1. **Situation:** "How do you handle calls now?"
2. **Problem:** "Do you miss calls when busy?"
3. **Implication:** "How much revenue do you lose per missed call?"
4. **Need-Payoff:** "Imagine never missing a lead again..."

## CONVERSATION STRUCTURE
### Stage 1: GREETING
- Warm, professional, brief
- *"Hi! This is Voxanne from CallWaiting AI. How can I help you today?"*
- Use filler words naturally: "Got it...", "Okay...", "Let me see..."

### Stage 2: DISCOVERY (Ask Smart Questions)
- Ask about their current setup
- Identify pain points (missed calls, overwhelmed staff)
- Quantify the problem ("How many calls do you miss weekly?")

### Stage 3: OBJECTION HANDLING
**"Too expensive"** → *"What's a new patient worth to you? If we book just 2-3 extra appointments monthly, it pays for itself."*

**"Already have receptionist"** → *"Great! Voxanne handles overflow and after-hours so your team can focus on in-person patients."*

**"Need to discuss with partner"** → *"Absolutely. Can I send you a demo video to share with them?"*

**"Not sure if AI can handle medical"** → *"Voxanne is built specifically for medical practices. HIPAA compliant, routes urgent cases to humans immediately."*

### Stage 4: CLOSING
- **Assumptive Close:** "Should we schedule your onboarding for next week?"
- **Alternative Close:** "Would Monday or Thursday work for a demo?"
- **Urgency Close (sparingly):** "We have a promotion ending this month."

## OBJECTION HANDLING FRAMEWORK
Use: **Clarify → Validate → Reframe**
1. "Just to make sure I understand - you're concerned about X?"
2. "That's fair. Many clients had the same worry."
3. "Here's what they found..."

## EMOTIONAL INTELLIGENCE
- **If stressed:** Slow down, be empathetic
- **If excited:** Match energy, build momentum
- **If skeptical:** Use proof, case studies
- Use micro-affirmations: "That makes sense...", "I hear you...", "Great question..."
- Mirror their language (patients vs clients, busy vs slammed)

## BOUNDARIES (NEVER VIOLATE)
❌ No medical advice ("I can't diagnose. I'm here for scheduling.")
❌ No legal advice
❌ No guaranteed outcomes
❌ No lying about features
❌ No bad-mouthing competitors
❌ **Emergencies:** "Hang up and call 999/911 immediately."

## NATURAL SPEECH
- Phone numbers: "0 7 4, 2 4, 0 3 8, 2 5 0" (with pauses)
- Prices: "one hundred and sixty-nine dollars per month"
- Dates: "November nineteenth, twenty twenty-four"
- Acronyms: "A.I." not "AI"
- Use brief filler words (max once per 5 sentences)

## GOALS (YOUR KPIs)
1. **Demo Booked** (Primary goal)
2. **Lead Qualified** (BANT confirmed)
3. **Warm Transfer** (Hot leads to human)
4. **WhatsApp Follow-up** (Capture contact)

## CALL-TO-ACTION OPTIONS
- "Can I book you a quick 15-minute demo?"
- "Let me send you a case study via WhatsApp."
- "Should I have our sales team call you?"
- "Would you like me to follow up next week?"

## COMPLIANCE
Always disclose: *"Just so you know, I'm Voxanne, an AI assistant. If you need a human, I can transfer you anytime."*

## CONVERSATIONAL RULES
1. **BREVITY:** Keep responses under 2 sentences during discovery
2. **LISTEN:** Let them finish before responding
3. **EMPATHY:** Acknowledge feelings first
4. **CURIOSITY:** Ask follow-up questions
5. **CONFIDENCE:** You're an expert, not an order-taker

## SAMPLE RESPONSE PATTERNS
**Discovery:**
- "Tell me about your practice - how many patients daily?"
- "What's your biggest challenge with incoming calls?"
- "If a competitor answers instantly and you don't, where does that lead go?"

**Objection:**
- "I totally get it. Let me ask..."
- "That's a fair concern. Here's what others found..."
- "Would it help if I showed you a quick ROI breakdown?"

**Close:**
- "Okay, so Growth sounds perfect for you. Should we schedule onboarding?"
- "Would Monday or Thursday work for a 15-minute demo?"

Remember: You're consultative, not pushy. Goal-driven, not robotic. Warm, not cold.`;
  }

  // ========================================
  // LEAD QUALIFICATION TRACKER
  // ========================================
  updateLeadData(key, value) {
    this.leadData[key] = value;
    
    // Calculate qualification score (0-100)
    let score = 0;
    if (this.leadData.budget) score += 25;
    if (this.leadData.authority) score += 25;
    if (this.leadData.need) score += 25;
    if (this.leadData.timeline) score += 25;
    
    this.leadData.qualification_score = score;
    
    // Notify if qualified (75%+)
    if (score >= 75) {
      this.onLeadQualified(this.leadData);
    }
  }

  // ========================================
  // STATE TRANSITIONS
  // ========================================
  async transitionTo(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    console.log(`🔄 State: ${oldState} → ${newState}`);
    
    this.state = newState;
    this.onStateChange({ from: oldState, to: newState });
  }

  // ========================================
  // DEEPGRAM CONNECTION
  // ========================================
  async connect() {
    console.log('🔌 Connecting to Deepgram...');
    
    const url = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2-general',
      language: 'en-GB',
      encoding: 'linear16',
      sample_rate: '8000',
      channels: '1',
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      vad_events: 'true',
      endpointing: '500'
    });

    this.deepgramConnection = new WebSocket(url, {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` }
    });

    this.setupDeepgramHandlers();

    await new Promise((resolve) => {
      this.deepgramConnection.once('open', () => {
        console.log('✅ Deepgram connected');
        resolve();
      });
    });

    // Speak sales greeting
    await this.speakSalesGreeting();
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================
  setupDeepgramHandlers() {
    this.deepgramConnection.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);

        // Barge-in detection
        if (msg.type === 'SpeechStarted') {
          console.log('🎤 User speech detected');
          
          if (this.isAISpeaking) {
            console.log('🛑 BARGE-IN: User interrupted');
            await this.handleInterruption();
          }
          
          await this.transitionTo(States.LISTENING);
        }

        // Process transcripts
        if (msg.type === 'Results') {
          const transcript = msg.channel?.alternatives?.[0]?.transcript;
          if (!transcript) return;

          const speechFinal = msg.speech_final;

          if (!speechFinal) {
            this.onTranscript(transcript, false);
            return;
          }

          console.log(`✅ Final: "${transcript}"`);
          this.onTranscript(transcript, true);

          await this.handleUserMessage(transcript);
        }

      } catch (e) {
        // Ignore non-JSON
      }
    });

    this.deepgramConnection.on('error', (err) => {
      console.error('❌ Deepgram error:', err);
      this.onError(err);
    });
  }

  // ========================================
  // BARGE-IN HANDLER
  // ========================================
  async handleInterruption() {
    if (this.currentTTSStream) {
      this.currentTTSStream.abort();
      this.currentTTSStream = null;
    }

    if (this.currentLLMController) {
      this.currentLLMController.abort();
      this.currentLLMController = null;
    }

    this.isAISpeaking = false;
    await this.transitionTo(States.LISTENING);
  }

  // ========================================
  // CONVERSATION HANDLER
  // ========================================
  async handleUserMessage(transcript) {
    this.conversationHistory.push({
      role: 'user',
      content: transcript
    });

    await this.transitionTo(States.THINKING);

    try {
      const response = await this.generateSalesResponse();
      const speakableText = this.humanizeText(response);

      await this.transitionTo(States.SPEAKING);
      this.isAISpeaking = true;

      await this.speak(speakableText);

      this.conversationHistory.push({
        role: 'assistant',
        content: response
      });

      this.isAISpeaking = false;
      await this.transitionTo(States.IDLE);

    } catch (error) {
      console.error('❌ Error:', error);
      this.isAISpeaking = false;
      await this.transitionTo(States.IDLE);
      this.onError(error);
    }
  }

  // ========================================
  // LLM RESPONSE (SALES-OPTIMIZED)
  // ========================================
  async generateSalesResponse() {
    console.log('🤖 Generating sales response...');

    this.currentLLMController = new AbortController();

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: this.conversationHistory,
        temperature: 0.8, // Slightly higher for natural sales conversation
        max_tokens: 150,
        signal: this.currentLLMController.signal
      });

      const response = completion.choices[0].message.content;
      console.log(`✅ Response: "${response}"`);

      this.onResponse(response);
      return response;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⚠️ Generation aborted');
        throw error;
      }
      throw error;
    }
  }

  // ========================================
  // TEXT HUMANIZATION
  // ========================================
  humanizeText(text) {
    // Phone numbers with pauses
    text = text.replace(/(\d{3})(\d{3})(\d{4,})/g, '$1, $2, $3');
    
    // Abbreviations
    text = text.replace(/\bAI\b/g, 'A.I.');
    text = text.replace(/\bCEO\b/g, 'C.E.O.');
    text = text.replace(/\bCTO\b/g, 'C.T.O.');
    text = text.replace(/\bNGO\b/g, 'N.G.O.');
    
    // Currency
    text = text.replace(/\$(\d+)/g, '$1 dollars');
    text = text.replace(/£(\d+)/g, '$1 pounds');
    
    // Dates
    text = text.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (match, d, m, y) => {
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[parseInt(m)-1]} ${d}, ${y}`;
    });

    return text;
  }

  // ========================================
  // TTS
  // ========================================
  async speak(text) {
    console.log(`🗣️ Speaking: "${text.substring(0, 50)}..."`);

    this.currentTTSStream = new AbortController();

    try {
      const response = await fetch(
        'https://api.deepgram.com/v1/speak?model=aura-asteria-en',
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text }),
          signal: this.currentTTSStream.signal
        }
      );

      const reader = response.body.getReader();
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        this.onAudio(value);
      }

      console.log(`✅ TTS complete (${totalBytes} bytes)`);

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⚠️ TTS aborted');
      } else {
        throw error;
      }
    }
  }

  // ========================================
  // SALES GREETING
  // ========================================
  async speakSalesGreeting() {
    const greeting = "Hi! This is Voxanne from CallWaiting AI. Thanks for reaching out! How can I help you today?";
    
    this.isAISpeaking = true;
    await this.transitionTo(States.SPEAKING);
    
    await this.speak(greeting);
    
    this.conversationHistory.push({
      role: 'assistant',
      content: greeting
    });
    
    this.isAISpeaking = false;
    await this.transitionTo(States.IDLE);
  }

  // ========================================
  // AUDIO INPUT
  // ========================================
  sendAudio(audioData) {
    if (this.deepgramConnection?.readyState === WebSocket.OPEN) {
      this.deepgramConnection.send(audioData);
    }
  }

  // ========================================
  // DISCONNECT
  // ========================================
  disconnect() {
    console.log('📞 Disconnecting...');
    
    if (this.deepgramConnection) {
      this.deepgramConnection.close();
      this.deepgramConnection = null;
    }
    
    this.isAISpeaking = false;
  }
}

export default VoxanneSalesAgent;