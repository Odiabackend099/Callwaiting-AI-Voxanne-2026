# VOXANNE LEAD GENERATION PLAYBOOK
## Complete System for Generating Qualified Leads

---

## 🎯 EXECUTIVE SUMMARY

**Goal:** Generate 5-15 qualified leads per week, book 1-3 demos, convert to paying customers.

**Three Channels:**
1. **Cold Email** (1,332 UK cosmetic clinics) - 10-week warmup campaign
2. **Inbound Calls** (Voxanne voice agent) - 24/7 lead qualification
3. **Lead Scraping** (Apify + Google Maps) - Expand to Nigeria, law firms, dental

**Expected Results (Month 1):**
- 6-10 email replies
- 1-3 demos booked
- 1-2 customers (£289-£578 MRR)

---

## 📋 CHANNEL 1: COLD EMAIL CAMPAIGN

### Setup (5 minutes)

```bash
# 1. Set Resend API key in .env
export RESEND_API_KEY="re_xxxxx"

# 2. Verify leads are loaded
node lead-gen-system.js status

# 3. Start sending (Week 1: 15/day)
node lead-gen-system.js send-emails 15
```

### Campaign Structure

**10-Week Warmup Schedule:**
```
Week 1:  15 emails/day  (105 total)
Week 2:  25 emails/day  (175 total)
Week 3:  40 emails/day  (280 total)
Week 4:  50 emails/day  (350 total)
Week 5:  65 emails/day  (455 total)
Week 6:  80 emails/day  (560 total)
Week 7:  95 emails/day  (665 total)
Week 8: 110 emails/day  (770 total)
Week 9: 130 emails/day  (910 total)
Week 10: 150 emails/day (1,050 total)
```

**Email Sequence (6 emails over 21 days):**
1. **Day 0:** Initial outreach ("Quick question about after-hours calls?")
2. **Day 3:** Follow-up #1 (ROI calculation: £720k/year in lost revenue)
3. **Day 7:** Follow-up #2 (Audio demo link)
4. **Day 10:** Follow-up #3 (Case study)
5. **Day 14:** Follow-up #4 (Soft breakup: "Should I close your file?")
6. **Day 21:** Final follow-up (Last chance)

### Daily Workflow

**Each morning (9am UK time):**
```bash
# Send daily batch
node lead-gen-system.js send-emails 15

# Check status
node lead-gen-system.js status

# Monitor replies in support@callwaitingai.dev inbox
```

**Each week (Friday):**
```bash
# Generate report
node lead-gen-system.js generate-report

# Review metrics:
# - Open rate (target: 25-35%)
# - Reply rate (target: 5-10%)
# - Conversion rate (target: 1-3%)
```

### Expected Metrics

| Metric | Week 1 | Week 2 | Week 3 | Month 1 |
|--------|--------|--------|--------|---------|
| Emails Sent | 105 | 280 | 560 | 1,050 |
| Opens | 26 | 70 | 140 | 280 |
| Replies | 5 | 14 | 28 | 52 |
| Demos Booked | 1 | 3 | 7 | 15 |
| Customers | 0 | 1 | 2 | 5 |
| MRR | £0 | £289 | £578 | £1,445 |

---

## 📞 CHANNEL 2: INBOUND CALL HANDLING

### Voxanne Voice Agent Configuration

**When a prospect calls:**
1. **Greeting (10s):** "Hi! This is Voxanne from CallWaiting AI. How can I help?"
2. **Discovery (60-90s):** Ask SPIN questions
   - "How do you handle calls now?"
   - "Do you miss calls when busy?"
   - "What's a missed call worth to you?"
3. **Pitch (30s):** "We handle that 24/7 with AI. Want a demo?"
4. **Close (15s):** "What's your WhatsApp? I'll send details + book Monday."

### Setup

```bash
# 1. Verify Twilio credentials
echo $TWILIO_PHONE_NUMBER
echo $STWILIO_ACCOUNT_SID

# 2. Configure webhook to Voxanne handler
# POST https://your-domain.com/api/twilio/voice

# 3. Test with a call to +12526453035
```

### Expected Conversion

- **Calls/week:** 10-20 (from email + organic)
- **Demos booked:** 2-5 per week
- **Conversion rate:** 10-20% (higher than email)

---

## 🔍 CHANNEL 3: LEAD SCRAPING & EXPANSION

### Phase 1: UK Expansion (Week 2-3)

**New verticals:**
- Dental practices (2,000+ leads)
- Law firms (1,500+ leads)
- Veterinary clinics (1,000+ leads)
- Physiotherapy (800+ leads)

**Setup:**
```bash
# Use Apify Google Maps scraper
# Config: apify-google-maps-config.json

# Search terms:
# - "dental clinic near London"
# - "law firm near Manchester"
# - "vet clinic near Birmingham"
```

### Phase 2: Nigeria Expansion (Week 4-5)

**Target markets:**
- Lagos (plastic surgery, medical clinics)
- Abuja (law firms, consulting)
- Port Harcourt (medical practices)

**Adjustments:**
- Use WhatsApp instead of email (higher response)
- Pricing in Naira (₦50k-₦150k/month)
- Voxanne speaks with Nigerian accent
- Local case studies (Lagos clinic: +12 consultations)

**Setup:**
```bash
# Scrape Nigerian businesses
# Filter: reviews >20, rating >4.0
# Extract: WhatsApp, phone, email
```

### Expected Results

| Market | Leads | Week 1 Contacts | Expected Conversions |
|--------|-------|-----------------|----------------------|
| UK Cosmetic | 1,332 | 15 | 5-10/month |
| UK Dental | 2,000 | 25 | 8-15/month |
| UK Legal | 1,500 | 20 | 5-10/month |
| Nigeria | 3,000 | 30 | 10-20/month |
| **TOTAL** | **7,832** | **90** | **28-55/month** |

---

## 📊 LEAD TRACKING & ANALYTICS

### Supabase Tables

**1. leads**
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  clinic_name TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  website TEXT,
  category TEXT,
  source TEXT (email, call, scrape),
  status TEXT (pending, contacted, replied, demo_booked, converted),
  created_at TIMESTAMP,
  contacted_at TIMESTAMP,
  replied_at TIMESTAMP,
  demo_date TIMESTAMP,
  converted_at TIMESTAMP,
  monthly_value DECIMAL
);
```

**2. email_tracking**
```sql
CREATE TABLE email_tracking (
  id UUID PRIMARY KEY,
  lead_id UUID,
  message_id TEXT,
  tracking_id TEXT,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP
);
```

**3. conversions**
```sql
CREATE TABLE conversions (
  id UUID PRIMARY KEY,
  lead_id UUID,
  email TEXT,
  demo_date TIMESTAMP,
  converted_date TIMESTAMP,
  tier TEXT (Essentials, Growth, Premium),
  monthly_value DECIMAL,
  notes TEXT
);
```

### Daily Metrics to Track

```bash
# Run daily
node lead-gen-system.js status

# Monitor:
# - Total leads contacted
# - Open rate (should be 25-35%)
# - Reply rate (should be 5-10%)
# - Demo booking rate (should be 20-30% of replies)
# - Conversion rate (should be 50-70% of demos)
```

### Weekly Report

```bash
# Run every Friday
node lead-gen-system.js generate-report

# Review:
# - Conversion funnel
# - Top performing cities
# - MRR progress
# - Next week's targets
```

---

## 🚀 EXECUTION TIMELINE

### Week 1: Cold Email Launch
- [ ] Set RESEND_API_KEY in .env
- [ ] Verify 1,332 leads loaded
- [ ] Send 15 emails/day (105 total)
- [ ] Monitor inbox for replies
- [ ] Expected: 5 replies, 1 demo

### Week 2: Ramp Up + Inbound Setup
- [ ] Increase to 25 emails/day (175 total)
- [ ] Configure Voxanne inbound call handler
- [ ] Test with internal calls
- [ ] Expected: 14 replies, 3 demos

### Week 3: Multi-Channel
- [ ] Increase to 40 emails/day (280 total)
- [ ] Voxanne handling live calls
- [ ] Start scraping UK dental/legal
- [ ] Expected: 28 replies, 7 demos

### Week 4-5: Expansion
- [ ] Increase to 50-65 emails/day
- [ ] Expand to Nigeria market
- [ ] Set up WhatsApp outreach
- [ ] Expected: 50+ replies, 15+ demos

### Month 2: Optimization
- [ ] A/B test email subject lines
- [ ] Optimize Voxanne pitch based on call data
- [ ] Expand to additional verticals
- [ ] Target: 5-10 customers, £1.5k-£3k MRR

---

## 💡 OPTIMIZATION TACTICS

### Email Optimization

**A/B Test (Week 2):**
- Subject line: "Quick question, {{firstName}}?" vs "{{clinicName}} — after 6pm?"
- Send time: 9am vs 2pm
- Track opens/replies, use winner for rest of campaign

**Personalization:**
- Use actual first name (not "there")
- Reference clinic name
- Mention specific city
- Include relevant case study

### Call Optimization

**Voxanne Improvements:**
- Add more SPIN discovery questions
- Test different closing lines
- Record calls, review best/worst
- Update objection responses weekly

**Hot Lead Signals:**
- Prospect asks "How fast can we start?"
- Mentions competitor by name
- Confirms budget available
- Decision-maker confirmed
→ **Action:** Offer same-day callback from human sales

### Conversion Optimization

**Demo Call Structure (15 minutes):**
1. **Greeting (1m):** Build rapport
2. **Discovery (3m):** Understand their situation
3. **Demo (5m):** Show Voxanne in action
4. **Objection Handling (3m):** Address concerns
5. **Close (3m):** Book onboarding or send proposal

**Closing Techniques:**
- "Should we get you set up this week?"
- "Which tier makes sense for your clinic?"
- "Can I send you the onboarding docs?"

---

## ⚠️ TROUBLESHOOTING

### Problem: Low Email Open Rate (<20%)

**Causes:**
- Subject line not compelling
- Sending at wrong time
- Email flagged as spam

**Solutions:**
- A/B test subject lines
- Send 9-10am or 2-3pm UK time
- Check spam folder
- Verify SPF/DKIM records

### Problem: No Replies

**Causes:**
- Email not reaching inbox
- Message not resonating
- No clear CTA

**Solutions:**
- Test with known email address
- Simplify message (under 100 words)
- Add specific CTA ("Reply with your mobile")
- Include social proof (case study)

### Problem: Demos Not Converting

**Causes:**
- Demo not showing value
- Price objection
- Not addressing pain point

**Solutions:**
- Lead with ROI calculation
- Show real call examples
- Offer 30-day guarantee
- Get commitment on call

---

## 📞 SUPPORT CONTACTS

- **Email:** support@callwaitingai.dev
- **Slack:** #lead-gen channel
- **Escalation:** Austyn (CEO)

---

## ✅ SUCCESS CHECKLIST

- [ ] RESEND_API_KEY configured
- [ ] 1,332 leads verified
- [ ] Cold email campaign started (15/day)
- [ ] Voxanne inbound handler deployed
- [ ] Supabase tracking tables created
- [ ] Daily status checks automated
- [ ] Weekly reports scheduled
- [ ] Team trained on qualification framework
- [ ] Demo call script prepared
- [ ] Conversion tracking live

**Target:** 5-10 customers by end of Month 1 = £1.5k-£3k MRR

🚀 **Let's generate some leads!**
