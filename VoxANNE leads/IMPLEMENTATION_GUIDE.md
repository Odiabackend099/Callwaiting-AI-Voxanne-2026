# VOXANNE LEAD GENERATION - IMPLEMENTATION GUIDE

## 🎯 OBJECTIVE
Deploy a complete, battle-tested lead generation system for Voxanne AI that generates 5-15 qualified leads per week.

---

## 📋 SYSTEM OVERVIEW

### Three Integrated Channels

**1. Cold Email (Primary - 70% of leads)**
- 1,332 pre-filtered UK cosmetic clinic leads
- 6-email sequence over 21 days
- 10-week warmup campaign (15→150 emails/day)
- Expected: 5-10 replies/week, 1-3 demos/week

**2. Inbound Calls (Secondary - 20% of leads)**
- Voxanne voice agent answers 24/7
- SPIN discovery framework
- Direct demo booking
- WhatsApp follow-up capture
- Expected: 10-20 calls/week, 2-5 demos/week

**3. Lead Scraping (Tertiary - 10% of leads)**
- Apify Google Maps integration
- Expand to Nigeria, dental, legal, veterinary
- 3,000+ additional leads by Week 4
- Expected: 30+ new leads/week

---

## ⚡ QUICK START (5 MINUTES)

### Step 1: Set API Key
```bash
export RESEND_API_KEY="re_xxxxx"  # Get from https://resend.com
```

### Step 2: Launch System
```bash
cd /Users/mac/Desktop/VOXANNE\ WEBSITE/VoxANNE\ leads
bash START_LEAD_GEN.sh
```

### Step 3: Choose Action
```
1. Send cold emails (15/day)
2. Check status
3. Generate report
4. Log a conversion
5. Exit
```

### Step 4: Monitor Results
- Check inbox: support@callwaitingai.dev
- View metrics: `node lead-gen-system.js status`
- Weekly report: `node lead-gen-system.js generate-report`

---

## 🔧 DETAILED SETUP

### Phase 1: Cold Email Campaign (Week 1)

**1. Verify Environment**
```bash
# Check Resend API key
echo $RESEND_API_KEY

# Check leads are loaded
node lead-gen-system.js status
# Should show: 1,332 leads loaded
```

**2. Send First Batch**
```bash
# Send 15 emails (Week 1 warmup)
node lead-gen-system.js send-emails 15

# Expected output:
# ✅ 1/15 - email1@clinic.com
# ✅ 2/15 - email2@clinic.com
# ... (with 50-second delays between sends)
```

**3. Monitor Replies**
- Check support@callwaitingai.dev inbox every 2 hours
- Expected first reply: Day 1-2
- Expected reply rate: 5-10% (52-105 replies from 1,050 emails)

**4. Log Conversions**
```bash
# When someone replies and books a demo
node lead-gen-system.js log-conversion "email@clinic.com" "2025-01-15"
```

### Phase 2: Automation Setup (Week 1)

**1. Set Up Cron Jobs**
```bash
bash setup-cron-jobs.sh
# Installs:
# - Daily emails at 9am (Mon-Fri)
# - Weekly report at 5pm (Friday)
# - Daily status at 8am
```

**2. Verify Cron Installation**
```bash
crontab -l
# Should show 3 new jobs
```

**3. Monitor Logs**
```bash
tail -f cron-logs/daily-emails.log
tail -f cron-logs/weekly-report.log
```

### Phase 3: Inbound Call Handler (Week 2)

**1. Verify Twilio Setup**
```bash
echo $TWILIO_PHONE_NUMBER
echo $STWILIO_ACCOUNT_SID
# Should both be set
```

**2. Test Voxanne Handler**
```bash
# Call +12526453035 from any phone
# Voxanne should answer and ask discovery questions
```

**3. Configure Webhook**
```
POST https://your-domain.com/api/twilio/voice
Headers:
  Authorization: Bearer $TWILIO_AUTH_TOKEN
Body: Call details from Twilio
```

**4. Monitor Calls**
```bash
# View call logs in Supabase
SELECT * FROM call_tracking ORDER BY call_date DESC;
```

### Phase 4: Database Setup (Week 1)

**1. Create Supabase Schema**
```bash
# Copy contents of setup-supabase-schema.sql
# Paste into Supabase SQL Editor
# Run all queries
```

**2. Verify Tables Created**
```sql
-- In Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
-- Should show: leads, email_tracking, conversions, call_tracking, campaign_metrics
```

**3. Test Data Insert**
```sql
INSERT INTO leads (email, clinic_name, city, country, source, status)
VALUES ('test@example.com', 'Test Clinic', 'London', 'UK', 'email', 'pending');
```

### Phase 5: Expansion (Week 3-4)

**1. Scrape Additional Leads**
```bash
# Use Apify Google Maps scraper
# Config: apify-google-maps-config.json
# Search: "dental clinic", "law firm", "vet clinic"
```

**2. Filter & Import**
```bash
# Run filter-leads.cjs on new data
node filter-leads.cjs
# Adds to filtered-leads.json
```

**3. Nigeria Market (Week 4)**
```bash
# Adjust pricing to Naira
# Use WhatsApp instead of email
# Update Voxanne accent/language
```

---

## 📊 DAILY OPERATIONS

### Morning (9am)
```bash
# Automated by cron, but can run manually:
node lead-gen-system.js send-emails 15
```

### Midday
```bash
# Check status
node lead-gen-system.js status

# Monitor inbox for replies
# Expected: 1-2 replies per 100 emails sent
```

### When Prospect Replies
```bash
# 1. Read reply
# 2. Send Voxanne audio demo (if interested)
# 3. Offer same-day demo call
# 4. Get WhatsApp for follow-up
# 5. Log in system:
node lead-gen-system.js log-conversion "email@clinic.com" "2025-01-15"
```

### Friday (5pm)
```bash
# Automated by cron:
node lead-gen-system.js generate-report

# Review:
# - Open rate (target: 25-35%)
# - Reply rate (target: 5-10%)
# - Conversion rate (target: 1-3%)
# - MRR growth
```

---

## 🎯 WEEKLY TARGETS

| Week | Emails/Day | Total Sent | Expected Replies | Expected Demos | Expected Customers |
|------|-----------|-----------|-----------------|----------------|-------------------|
| 1 | 15 | 105 | 5 | 1 | 0 |
| 2 | 25 | 175 | 14 | 3 | 1 |
| 3 | 40 | 280 | 28 | 7 | 2 |
| 4 | 50 | 350 | 35 | 9 | 3 |
| 5 | 65 | 455 | 45 | 11 | 4 |

---

## 🚨 TROUBLESHOOTING

### Issue: "RESEND_API_KEY not set"
```bash
# Solution:
export RESEND_API_KEY="re_xxxxx"
# Verify:
echo $RESEND_API_KEY
```

### Issue: "No leads found"
```bash
# Check file exists:
ls -la filtered-leads.json

# Check file has data:
head -20 filtered-leads.json

# Regenerate if needed:
node filter-leads.cjs
```

### Issue: "Emails not sending"
```bash
# Check SMTP connection:
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 587,
  auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
});
transporter.verify((err, valid) => {
  console.log(err ? 'Error: ' + err : 'SMTP OK');
});
"
```

### Issue: "Low open rate"
```bash
# A/B test subject lines:
# Try: "Quick question, {{firstName}}?"
# vs: "{{clinicName}} — after 6pm?"

# Check sending time:
# Best: 9-10am or 2-3pm UK time
# Avoid: Monday, Friday, after 5pm
```

### Issue: "Voxanne not answering calls"
```bash
# Check Twilio webhook:
curl -X POST https://your-domain.com/api/twilio/voice \
  -H "Authorization: Bearer $TWILIO_AUTH_TOKEN"

# Check logs:
node mcp0_get_logs --service=twilio
```

---

## 📈 METRICS DASHBOARD

### Real-Time Status
```bash
node lead-gen-system.js status
```

**Output shows:**
- Total leads: 1,332
- Sent: 105 (7.9%)
- Unsent: 1,227
- Opened: 26 (24.8% open rate)
- Replied: 5 (4.8% reply rate)
- Converted: 1
- MRR: £289

### Weekly Report
```bash
node lead-gen-system.js generate-report
```

**Generates:**
- Summary metrics
- Top performing cities
- Recent conversions
- Next actions

### Supabase Dashboards
```sql
-- Lead funnel
SELECT * FROM lead_funnel;

-- City performance
SELECT * FROM city_performance ORDER BY conversion_rate DESC;

-- Weekly metrics
SELECT * FROM weekly_metrics ORDER BY week_start DESC;
```

---

## 💰 REVENUE TRACKING

### Log a Conversion
```bash
node lead-gen-system.js log-conversion "email@clinic.com" "2025-01-15" "Growth tier"
```

### View Conversions
```sql
SELECT 
  email,
  tier,
  monthly_value,
  converted_date
FROM conversions
ORDER BY converted_date DESC;
```

### Calculate MRR
```sql
SELECT 
  SUM(monthly_value) as total_mrr,
  COUNT(*) as customer_count,
  AVG(monthly_value) as avg_customer_value
FROM conversions
WHERE converted_at IS NOT NULL;
```

---

## 🔄 WEEKLY REVIEW PROCESS

**Every Friday at 5pm:**

1. **Generate Report**
   ```bash
   node lead-gen-system.js generate-report
   ```

2. **Review Metrics**
   - Open rate: 25-35% (good), <20% (bad)
   - Reply rate: 5-10% (good), <3% (bad)
   - Conversion: 1-3% (good), <1% (bad)

3. **Analyze Top Performers**
   - Which cities have highest conversion?
   - Which email subject lines got most opens?
   - Which objections came up most?

4. **Optimize for Next Week**
   - A/B test new subject lines
   - Update objection responses
   - Adjust sending times if needed

5. **Plan Expansion**
   - Week 3: Scrape dental/legal leads
   - Week 4: Launch Nigeria market
   - Week 5: Add SMS channel

---

## ✅ SUCCESS CRITERIA

### Month 1 (Weeks 1-4)
- [ ] 1,050 emails sent
- [ ] 50+ replies received
- [ ] 10+ demos booked
- [ ] 3-5 customers acquired
- [ ] £867-£1,445 MRR
- [ ] 25-35% open rate
- [ ] 5-10% reply rate
- [ ] 1-3% conversion rate

### Month 2 (Weeks 5-8)
- [ ] 2,100 emails sent (total)
- [ ] 120+ replies received
- [ ] 30+ demos booked
- [ ] 10-15 customers acquired
- [ ] £2,890-£4,335 MRR
- [ ] Voxanne handling 20+ calls/week
- [ ] Nigeria market launched

### Month 3 (Weeks 9-12)
- [ ] 3,150 emails sent (total)
- [ ] 200+ replies received
- [ ] 60+ demos booked
- [ ] 25-40 customers acquired
- [ ] £7,225-£11,560 MRR
- [ ] Multi-channel optimization complete

---

## 🎓 TEAM TRAINING

### Sales Rep Training
1. Read: `LEAD_GEN_PLAYBOOK.md`
2. Learn: BANT qualification framework
3. Practice: Demo call script
4. Monitor: Daily metrics

### Developer Training
1. Understand: `lead-gen-system.js` architecture
2. Deploy: Supabase schema
3. Configure: Twilio webhook
4. Monitor: Logs and errors

### Manager Training
1. Review: Weekly reports
2. Analyze: Conversion funnel
3. Optimize: A/B tests
4. Plan: Expansion phases

---

## 📞 SUPPORT MATRIX

| Issue | Owner | Response Time | Escalation |
|-------|-------|----------------|------------|
| Email delivery | Resend support | 1 hour | support@callwaitingai.dev |
| Call handling | Twilio support | 2 hours | Austyn |
| Database | Supabase support | 1 hour | Tech lead |
| Strategy | Austyn (CEO) | 4 hours | Board |

---

## 🚀 LAUNCH CHECKLIST

**Before Day 1:**
- [ ] RESEND_API_KEY set
- [ ] Leads verified (1,332)
- [ ] Email sequence reviewed
- [ ] Twilio configured
- [ ] Supabase schema created
- [ ] Team trained
- [ ] Monitoring set up

**Day 1:**
- [ ] Send first 15 emails
- [ ] Monitor inbox
- [ ] Test Voxanne calls
- [ ] Log first metrics

**Week 1:**
- [ ] Send 105 emails total
- [ ] Get 5+ replies
- [ ] Book 1+ demo
- [ ] Set up cron jobs

**Week 2:**
- [ ] Increase to 25/day
- [ ] Deploy Voxanne live
- [ ] Get 14+ replies
- [ ] Book 3+ demos

**Week 3:**
- [ ] Increase to 40/day
- [ ] Scrape new leads
- [ ] Get 28+ replies
- [ ] Book 7+ demos

**Week 4:**
- [ ] Increase to 50/day
- [ ] Launch Nigeria market
- [ ] Get 35+ replies
- [ ] Book 9+ demos

---

## 🎯 SUCCESS DEFINITION

**You've succeeded when:**
1. ✅ 1,050+ emails sent (first month)
2. ✅ 50+ replies received (5-10% reply rate)
3. ✅ 10+ demos booked (20-30% of replies)
4. ✅ 3-5 customers acquired (30-50% of demos)
5. ✅ £867-£1,445 MRR generated
6. ✅ System running on autopilot (cron jobs)
7. ✅ Voxanne handling 20+ calls/week
8. ✅ Expansion to Nigeria underway

---

**Ready to launch?**

```bash
cd /Users/mac/Desktop/VOXANNE\ WEBSITE/VoxANNE\ leads
export RESEND_API_KEY="re_xxxxx"
bash START_LEAD_GEN.sh
```

🚀 **Let's generate leads and build Voxanne's customer base!**
