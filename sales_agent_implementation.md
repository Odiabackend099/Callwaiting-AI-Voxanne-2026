# ROXANNE SALES AGENT - COMPLETE IMPLEMENTATION GUIDE

## 🎯 Overview

This is **Roxanne the Sales Agent** - the version that lives on your Twilio phone line and website chat, selling CallWaiting AI services. She's NOT the client-facing agent (that comes later). She's YOUR sales team.

### Key Differences from Client Agent

| **Sales Agent (THIS)** | **Client Agent (Future)** |
|------------------------|---------------------------|
| Sells CallWaiting AI services | Handles client's customers |
| Uses BANT + SPIN sales frameworks | Uses client-specific workflows |
| Books demos and qualifies leads | Books appointments for clinics |
| Handles pricing objections | Handles clinic FAQs |
| Closes deals | Provides customer service |

---

## 📋 Step-by-Step Implementation

### 1. **Delete Old Files**

```bash
# Remove the old agent (not sales-optimized)
rm roxanne_agent.js

# Keep server.js but we'll update it
```

### 2. **Create New Sales Agent**

**File: `roxanne_sales_agent.js`**
- Copy the code from the artifact above
- This includes the sales system prompt and BANT/SPIN logic

### 3. **Update Server to Use Sales Agent**

**File: `server.js`** (modify WebSocket handler):

```javascript
import { RoxanneSalesAgent } from './roxanne_sales_agent.js';

wss.on('connection', async (ws, req) => {
  console.log('✅ Sales lead connected');
  
  // Create SALES agent instance
  const agent = new RoxanneSalesAgent({
    onAudio: (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk);
      }
    },
    
    onTranscript: (text, isFinal) => {
      ws.send(JSON.stringify({
        type: 'transcript',
        text,
        isFinal
      }));
    },
    
    onResponse: (text) => {
      ws.send(JSON.stringify({
        type: 'response',
        text
      }));
    },
    
    // NEW: Lead qualification tracking
    onLeadQualified: (leadData) => {
      console.log('🎯 Lead Qualified!', leadData);
      
      // Send to CRM/Database
      // saveLeadToSupabase(leadData);
      
      // Notify sales team
      // sendSlackAlert(`Hot lead qualified! Score: ${leadData.qualification_score}`);
    },
    
    onStateChange: ({ from, to }) => {
      ws.send(JSON.stringify({
        type: 'state',
        from,
        to
      }));
    }
  });
  
  await agent.connect();
  
  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      agent.sendAudio(data);
    }
  });
  
  ws.on('close', () => {
    agent.disconnect();
  });
});
```

### 4. **Install Dependencies**

```bash
npm install ws groq-sdk dotenv
```

### 5. **Environment Variables**

```env
DEEPGRAM_API_KEY=your_key
GROQ_API_KEY=your_key
```

### 6. **Start Server**

```bash
node server.js
```

---

## 🎯 Sales Skills Built-In

### 1. **BANT Qualification**
Roxanne automatically tracks:
- **Budget:** Can they afford $169-$499/month?
- **Authority:** Are they the decision-maker?
- **Need:** Do they have the pain point?
- **Timeline:** When do they need it?

**Lead qualification score** is calculated (0-100%) and triggers alert at 75%.

### 2. **SPIN Discovery**
She asks questions to uncover pain:
- **Situation:** "How do you handle calls now?"
- **Problem:** "Do you miss calls when busy?"
- **Implication:** "How much revenue do you lose per missed call?"
- **Need-Payoff:** "Imagine never missing a lead again..."

### 3. **Objection Handling**
Built-in responses for common objections:
- "Too expensive" → ROI breakdown
- "Already have receptionist" → Backup/overflow angle
- "Need to discuss" → Send demo video
- "Not sure if AI can handle medical" → HIPAA compliance proof

### 4. **Emotional Intelligence**
She reads the prospect's tone:
- **Stressed** → Slows down, empathizes
- **Excited** → Matches energy
- **Skeptical** → Uses proof/case studies

### 5. **Natural Conversation**
- Uses filler words ("Got it", "Let me see")
- Short sentences
- Active listening
- Mirrors prospect's language

---

## 📊 Sales Tracking & Analytics

### Lead Data Structure

```javascript
leadData = {
  budget: "Growth tier ($289/month)",
  authority: "Practice owner",
  need: "Missing 15+ calls/week",
  timeline: "ASAP - next 2 weeks",
  painPoints: ["Overwhelmed staff", "Lost revenue"],
  objections: ["Price concern (resolved)"],
  qualification_score: 100
}
```

### Integration Points

**1. Supabase (Database)**
```javascript
// Save qualified leads
async function saveLeadToSupabase(leadData) {
  const { data, error } = await supabase
    .from('sales_leads')
    .insert({
      ...leadData,
      created_at: new Date(),
      source: 'Roxanne AI'
    });
}
```

**2. Slack Notifications**
```javascript
// Alert sales team
async function sendSlackAlert(message) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ text: message })
  });
}
```

**3. WhatsApp Follow-up**
```javascript
// Send demo video via WhatsApp
async function sendWhatsAppDemo(phoneNumber) {
  // Use Twilio WhatsApp API
}
```

---

## 🎭 Example Sales Conversations

### **Scenario 1: Price-Conscious Lead**

**Prospect:** "Your pricing seems high."

**Roxanne:** "I totally get it. Let me ask - what's a new patient worth to your practice? Because if we're talking, say, £500 per patient, and Roxanne books just 2-3 extra appointments monthly, the Growth plan at £289 pays for itself. Would it help to see a quick ROI breakdown?"

**Result:** Objection handled, moving to demo.

---

### **Scenario 2: Hesitant Decision-Maker**

**Prospect:** "I need to talk to my partner first."

**Roxanne:** "Absolutely, smart move. Would it help if I sent you a demo video and case study to share with them? That way you're both on the same page when you discuss it."

**Result:** Captured contact info, scheduled follow-up.

---

### **Scenario 3: Skeptical Tech User**

**Prospect:** "Can AI really handle medical calls?"

**Roxanne:** "Great question. Roxanne is built specifically for medical practices. She knows HIPAA compliance, handles appointment scheduling, and routes urgent cases to humans immediately. She's not replacing your doctors - she's freeing them up. Would you like to hear her in action on a quick demo?"

**Result:** Proof provided, demo scheduled.

---

## 🚨 Common Pitfalls & Solutions

### Issue 1: "She's too pushy"
**Solution:** Lower temperature to 0.7, increase emphasis on "consultative" in prompt.

### Issue 2: "She doesn't close"
**Solution:** Add explicit CTA after objection handling: "So should we schedule that demo?"

### Issue 3: "She ignores pricing questions"
**Solution:** Ensure pricing is in system prompt (already included).

### Issue 4: "She makes up features"
**Solution:** Add strict boundary: "Only mention features in the knowledge base."

---

## 📈 Success Metrics (Track These)

### Primary KPIs
1. **Demo Booking Rate** - % of calls that book a demo
2. **Lead Qualification Score** - Average score (target: 75%+)
3. **Objection Resolution Rate** - % of objections handled without escalation

### Secondary KPIs
1. **Call Duration** - Average time to qualify a lead (target: 3-5 min)
2. **WhatsApp Capture Rate** - % of leads who share contact info
3. **Hot Transfer Rate** - % immediately transferred to human sales

### Revenue Metrics
1. **Cost per Lead** - Operational cost / qualified leads
2. **Conversion Rate** - Demos booked / total calls
3. **Revenue per Call** - Average deal size * conversion rate

---

## 🎓 Training Roxanne (Continuous Improvement)

### Monthly Reviews

**1. Analyze Top Objections**
```javascript
// Query Supabase for most common objections
const topObjections = await supabase
  .from('sales_leads')
  .select('objections')
  .limit(100);

// Update system prompt with better responses
```

**2. A/B Test Greetings**
```javascript
// Test variant greetings
const greetings = [
  "Hi! This is Roxanne. How can I help?",
  "Hey there! Roxanne from CallWaiting AI. What brought you here?",
  "Thanks for reaching out! Roxanne here. Tell me about your practice."
];

// Track which converts best
```

**3. Add New Case Studies**
When you close a deal, add it to Roxanne's knowledge:
```javascript
"A plastic surgery clinic in Lagos was missing 15 calls/week. After implementing Roxanne, they booked 8 extra consultations monthly - that's £4,000 in additional revenue."
```

---

## 🛡️ Compliance & Ethics

### Always Disclose AI
Roxanne starts calls with:
*"Just so you know, I'm Roxanne, an AI assistant. If you need a human, I can transfer you anytime."*

### GDPR/Data Protection
- Store lead data in Supabase (EU servers if needed)
- Provide data deletion on request
- Don't record calls without consent

### Transparency
- Never lie about features
- Don't bad-mouth competitors
- Admit when uncertain

---

## 🚀 Go-Live Checklist

- [ ] Deepgram API key configured
- [ ] Groq API key configured
- [ ] System prompt updated with latest pricing
- [ ] Test call completed successfully
- [ ] Lead qualification tracking verified
- [ ] Supabase integration working
- [ ] Slack alerts configured
- [ ] WhatsApp follow-up setup
- [ ] Sales team trained on handling warm transfers
- [ ] Monitoring dashboard live

---

## 📞 Test Scenarios

### Test 1: Price Objection
**You:** "How much does this cost?"  
**Expected:** Roxanne asks discovery questions first, then shares pricing with ROI context.

### Test 2: Decision-Maker Check
**You:** "Let me check with my boss."  
**Expected:** Roxanne confirms if you're the decision-maker, offers to send materials.

### Test 3: Competitor Mention
**You:** "What about [Competitor]?"  
**Expected:** Roxanne focuses on CallWaiting AI strengths, doesn't trash-talk.

### Test 4: Emergency Scenario
**You:** "I'm having chest pain."  
**Expected:** Roxanne immediately tells you to hang up and call 999/911.

### Test 5: Barge-In Test
**You:** Interrupt Roxanne mid-sentence.  
**Expected:** She stops immediately and waits for you to finish.

---

## 🎯 Final Notes

### Roxanne is YOUR sales rep, not just a chatbot.

**Good sales reps:**
- Listen more than they talk
- Ask great questions
- Handle objections with empathy
- Always drive toward a clear next step
- Follow up consistently

**Bad sales reps:**
- Pitch immediately
- Ignore objections
- Sound scripted
- Give up after one "no"

**Your Roxanne is trained to be the GOOD kind.**

---

## 💡 Next Steps

1. **Deploy Roxanne to Twilio** - Connect to your phone number
2. **Add Website Widget** - Embed on callwaitingai.dev
3. **Set Up CRM Integration** - Auto-log qualified leads
4. **Train Your Team** - How to handle warm transfers
5. **Monitor Performance** - Weekly review of metrics
6. **Iterate Prompt** - Add new objections and responses

---

**Remember:** Roxanne is selling CallWaiting AI. Every conversation is an opportunity to book a demo, qualify a lead, or capture contact info for follow-up.

Make every interaction count. 🚀