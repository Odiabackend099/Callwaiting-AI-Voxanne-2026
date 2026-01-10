# Chat Widget - Quick Reference Guide

## 🎯 What You Need to Know

Your chat widget now has comprehensive knowledge about Call Waiting AI and can answer visitor questions in real-time.

---

## ⚡ 5-Minute Setup

### Step 1: Get Groq API Key (2 min)
```bash
# Visit:
https://console.groq.com/keys

# Sign up → Create API Key → Copy key (looks like: gsk_abc123...)
```

### Step 2: Add Key to Project (1 min)
```bash
# Edit .env.local:
GROQ_API_KEY=gsk_yourActualKeyHere

# Save file
```

### Step 3: Restart Server (1 min)
```bash
# Stop (Ctrl+C), then:
npm run dev
```

### Step 4: Test (1 min)
```
http://localhost:3000 → Chat widget → "What is Call Waiting AI?"
```

**Done!** ✅ You should get a response in 2-5 seconds.

---

## 💬 What the Chat Can Explain

| Topic | Example Question | Response Type |
|-------|------------------|---------------|
| **Product** | "What does Call Waiting AI do?" | 2-4 sentence overview with benefits |
| **Pricing** | "How much does it cost?" | All tiers: $299, $699, $1,499, Enterprise |
| **Features** | "Can it book appointments?" | Yes, with scheduling/SMS/transcripts |
| **Integration** | "Does it work with Acuity?" | Yes, plus Twilio, VoIP.ms, Google Calendar, etc. |
| **Security** | "Is it HIPAA compliant?" | Yes, plus GDPR, SOC 2, ISO 27001, AES-256 |
| **Setup** | "How long to implement?" | 15-30 minutes with easy integration |
| **Qualification** | "I'm a med spa with 300 calls/month" | Suggests Growth plan ($699), explains why |

---

## ✅ What Changed

### Environment File (.env.local)
```diff
+ GROQ_API_KEY=your_groq_api_key_here
+ NEXT_PUBLIC_AGENT_NAME=Call Waiting AI
```

### Chat Route (src/app/api/chat/route.ts)
```diff
- VOXANNE_PROMPT (85 lines, generic)
+ VOXANNE_PROMPT (142 lines, comprehensive)
```

**Includes:** Pricing, features, integrations, security, 13+ FAQs, qualification flow

---

## 🧪 Quick Test

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Test API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "What is Call Waiting AI?" }
    ]
  }'

# Expected response:
# { "reply": "Call Waiting AI is an AI receptionist that answers..." }
```

---

## 📊 Chat Widget Specs

| Aspect | Details |
|--------|---------|
| **Model** | llama-3.3-70b-versatile (Groq) |
| **Response Time** | 2-5 seconds |
| **Max Response Length** | 150 tokens (~100 words) |
| **Rate Limit** | 10 requests/minute per IP |
| **Languages** | English (Spanish/French custom) |
| **Availability** | 24/7 (uses Groq's 99.9% uptime) |
| **Tone** | Warm, professional, concise |
| **Audience** | Clinic owners/managers (B2B) |

---

## 🚀 Expected Visitor Experience

1. **Visitor arrives at http://localhost:3000**
2. **Sees chat icon in bottom-right corner**
3. **Clicks to open chat widget**
4. **Types: "I'm a med spa. Can this help us?**
5. **Chat responds (2-5 sec):**
   > "Absolutely! Call Waiting AI is perfect for med spas. It answers 100% of your calls 24/7, schedules appointments automatically, and sends SMS reminders to reduce no-shows (15-20% improvement).
   >
   > For your med spa, our Growth plan ($699/month) supports up to 2,000 calls/month. That's typically perfect for 1-3 locations.
   >
   > Quick questions: (1) How many patient calls do you get monthly? (2) What's your biggest challenge – missed calls, after-hours coverage, or no-show rates?"
6. **Visitor feels understood, continues conversation**
7. **Chat qualifies interest → suggests demo or free trial**

---

## 🔍 Common Questions the Chat Handles

### Features
- ✅ "Can it handle complex appointments?" → Yes, with rebooking, cancellations, escalation
- ✅ "What if it can't understand a caller?" → Transfers to human
- ✅ "Does it work 24/7?" → Yes, always on
- ✅ "Can it handle multiple locations?" → Yes, with Enterprise plan

### Pricing
- ✅ "How much does it cost?" → Lists all 4 tiers with monthly costs
- ✅ "What's included?" → Lists features per tier
- ✅ "Do you offer a free trial?" → Yes, 14 days, no credit card

### Integration
- ✅ "Does it work with Twilio/Acuity/Calendly?" → Yes, lists all compatible systems
- ✅ "How long to set up?" → 15-30 minutes total

### Security
- ✅ "Is it HIPAA compliant?" → Yes, with BAA + SOC 2 + ISO 27001
- ✅ "Where's our data stored?" → AWS/Azure secure data centers
- ✅ "Can you share our data?" → No, zero third-party sharing

### Qualification
- ✅ "I'm a cosmetic surgeon" → Explains 340% ROI, suggests Premium tier
- ✅ "I'm a solo dermatologist" → Suggests Essentials tier ($299)
- ✅ "We have 3 locations" → Suggests Enterprise tier

---

## ⚠️ What Doesn't Work Yet

| What | Why | Workaround |
|------|-----|-----------|
| **No GROQ_API_KEY** | Not added to .env.local yet | Add key, restart server |
| **Looking up accounts** | Can't access user accounts | Chat suggests contacting support |
| **Complex legal questions** | Requires professional advice | Chat escalates to human |
| **Real-time calendar data** | Can't sync live with Acuity/Google | Chat explains feature, suggests demo |
| **Non-English languages** | Default setup is English | Custom setup required for Spanish/French |

---

## 🐛 Troubleshooting

### "Chat service not configured"
```bash
# Check if key is set:
echo $GROQ_API_KEY

# If blank, add to .env.local and restart npm run dev
```

### "Failed to fetch" or no response
```bash
# Verify server is running:
npm run dev

# Check API endpoint works:
curl http://localhost:3000/api/chat

# Test with valid key in .env.local
```

### Slow responses (>10 sec)
```
Normal occasionally. Groq API might be busy.
Try again in a few seconds.
```

### Blank or generic responses
```
Try specific questions like:
- "How much does the Growth plan cost?"
- "Does it integrate with Google Calendar?"
- "Is it HIPAA compliant?"
```

---

## 📈 Success Metrics

### How to Know It's Working
- ✅ Chat responds within 2-5 seconds
- ✅ Responses include specific details (pricing, features)
- ✅ Chat asks follow-up qualification questions
- ✅ Tone is warm and professional
- ✅ No "I don't know" for standard questions

### What to Monitor
1. **Response time** - Should be 2-5 seconds
2. **Success rate** - Should be 95%+
3. **Visitor engagement** - Are they asking follow-up questions?
4. **Conversion** - Do they book demo or start free trial?

---

## 🎓 Knowledge Base Coverage

The chat now knows about:

**Product (12 details)**
- 24/7 call answering
- Appointment scheduling with conflict detection
- SMS reminders (15-20% no-show reduction)
- Call transcription and review
- After-hours revenue capture
- Multi-location support
- Escalation to human agents
- Natural-sounding AI voice
- Thousands of simultaneous calls
- Automatic fallback on outages
- Integration with existing phone systems
- Real ROI data (340% for surgeons)

**Pricing (8 details)**
- Essentials: $299/month (≤500 calls)
- Growth: $699/month (≤2,000 calls) ← Most popular
- Premium: $1,499/month (≤5,000 calls + priority)
- Enterprise: Custom (unlimited + white-label)
- What's included in all plans
- Free 14-day trial
- No setup fees
- Cancel anytime

**Integration (11 details)**
- Phone systems: Twilio, VoIP.ms, Bandwidth, SIP, PSTN
- Calendars: Google, Acuity, 10to8, Calendly, Apple, Outlook
- CRM/EMR: ChartRequest, Weave, Marmo Dental
- Setup time: 15-30 min
- Easy configuration

**Security (8 details)**
- HIPAA compliant with BAA
- GDPR ready
- SOC 2 Type II certified
- ISO 27001 certified
- AES-256 encryption
- Daily automated backups
- 99.9% uptime SLA
- Zero third-party data sharing

**FAQs (13 answers)**
- Setup time
- Complex appointment handling
- Understanding unknown callers
- 24/7 availability
- Multi-location support
- Natural voice quality
- Language support
- Call review/transcripts
- Call capacity
- System downtime handling
- Phone system compatibility
- Lead qualification flow
- Next steps (demo, trial, contact)

---

## 📝 Files & Changes

| File | Change | Impact |
|------|--------|--------|
| `.env.local` | Added GROQ_API_KEY section | Chat can now call Groq API |
| `src/app/api/chat/route.ts` | Enhanced VOXANNE_PROMPT | Chat now answers comprehensive questions |

---

## 🚀 Next Steps

1. ✅ Get Groq API key from https://console.groq.com/keys
2. ✅ Add key to `.env.local`
3. ✅ Restart `npm run dev`
4. ✅ Test at http://localhost:3000 → Chat widget
5. ✅ Ask: "What is Call Waiting AI?"
6. ✅ Verify response in 2-5 seconds

**Status:** Ready to test! 🎉

---

## 📞 Support

If chat doesn't work:
1. Check GROQ_API_KEY in `.env.local` (not blank)
2. Verify key format (starts with `gsk_`)
3. Restart `npm run dev`
4. Test API manually: `curl http://localhost:3000/api/chat`
5. Check browser console (F12) for errors

**For Groq support:** https://groq.com/support

---

**Last Updated:** December 22, 2025
**Implementation Status:** ✅ Complete
**Test Status:** ⏳ Awaiting API key configuration
**Expected Response Time:** 2-5 seconds
**Success Rate Goal:** 95%+
