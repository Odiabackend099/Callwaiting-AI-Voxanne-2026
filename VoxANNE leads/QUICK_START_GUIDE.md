# VOXANNE LEAD GENERATION - QUICK START (5 MINUTES)

## ⚡ TL;DR

You have **1,332 UK cosmetic clinic leads** ready to contact. Start generating revenue TODAY.

```bash
# 1. Set API key
export RESEND_API_KEY="re_xxxxx"  # Get from https://resend.com

# 2. Start sending emails
bash START_LEAD_GEN.sh

# 3. Monitor replies
# Check: support@callwaitingai.dev inbox

# 4. Book demos with Voxanne
# Voxanne answers calls 24/7, qualifies prospects, books demos
```

---

## 📊 WHAT YOU'LL GET

**Month 1:**
- 6-10 email replies
- 1-3 demos booked
- 1-2 customers
- **£289-£578 MRR**

**Month 3:**
- 30-45 replies
- 10-15 demos
- 5-10 customers
- **£1.5k-£3k MRR**

---

## 🚀 STEP-BY-STEP SETUP

### Step 1: Get Resend API Key (2 min)
```
1. Go to https://resend.com
2. Sign up (free)
3. Copy API key
4. Run: export RESEND_API_KEY="re_xxxxx"
```

### Step 2: Verify Leads (1 min)
```bash
node lead-gen-system.js status
# Should show: 1,332 leads loaded
```

### Step 3: Start Campaign (2 min)
```bash
bash START_LEAD_GEN.sh
# Choose option 1: Send emails
# Sends 15 emails (Week 1 warmup)
```

### Step 4: Set Up Automation (Optional)
```bash
bash setup-cron-jobs.sh
# Automatically sends 15 emails every morning at 9am
```

---

## 📈 EXPECTED RESULTS

| Metric | Week 1 | Week 2 | Week 3 | Month 1 |
|--------|--------|--------|--------|---------|
| Emails Sent | 105 | 280 | 560 | 1,050 |
| Replies | 5 | 14 | 28 | 52 |
| Demos | 1 | 3 | 7 | 15 |
| Customers | 0 | 1 | 2 | 5 |
| MRR | £0 | £289 | £578 | £1,445 |

---

## 💬 EMAIL SEQUENCE

**Day 0:** "Quick question about after-hours calls?"
→ Introduce problem, ask for 60-second demo call

**Day 3:** Follow-up with ROI
→ "If you're missing 10 calls/month at £6k each, that's £720k/year lost"

**Day 7:** Audio demo
→ "Here's what your patients would hear at 9pm Saturday"

**Day 10:** Case study
→ "One London clinic captured 12 extra consultations in 2 weeks"

**Day 14:** Soft breakup
→ "Should I close your file?"

**Day 21:** Final follow-up
→ "Last chance to explore this"

---

## 📞 INBOUND CALLS (VOXANNE)

When a prospect calls:

1. **Greeting (10s):** "Hi! This is Voxanne from CallWaiting AI. How can I help?"
2. **Discovery (60s):** Ask about their call handling
3. **Pitch (30s):** "We handle that 24/7 with AI"
4. **Close (15s):** "What's your WhatsApp? I'll send details"

**Expected:** 10-20 calls/week, 2-5 demos booked

---

## 🎯 DAILY WORKFLOW

**Every morning (9am):**
```bash
node lead-gen-system.js send-emails 15
```

**Every Friday (5pm):**
```bash
node lead-gen-system.js generate-report
```

**When someone replies:**
```bash
# Log the conversion
node lead-gen-system.js log-conversion "email@clinic.com" "2025-01-15"
```

---

## 🔥 HOT LEAD SIGNALS

When you see these, **prioritize immediately:**
- ✅ "How fast can we get started?"
- ✅ "I need this this week"
- ✅ "What's the cost?"
- ✅ "Can I try it first?"
- ✅ Mentions competitor by name

**Action:** Offer same-day callback from human sales rep

---

## 📊 TRACKING DASHBOARD

View real-time metrics:
```bash
node lead-gen-system.js status
```

**Key metrics to monitor:**
- Open rate (target: 25-35%)
- Reply rate (target: 5-10%)
- Conversion rate (target: 1-3%)
- MRR growth

---

## ⚠️ COMMON ISSUES

**Problem:** Emails not sending
- **Fix:** Check RESEND_API_KEY is set
- Run: `echo $RESEND_API_KEY`

**Problem:** Low open rate
- **Fix:** A/B test subject lines
- Try: "Quick question, {{firstName}}?" vs "{{clinicName}} — after 6pm?"

**Problem:** No replies
- **Fix:** Simplify message, add clear CTA
- Include: "Reply with your mobile"

---

## 📚 FULL DOCUMENTATION

- **Playbook:** `LEAD_GEN_PLAYBOOK.md` (comprehensive guide)
- **System:** `lead-gen-system.js` (all commands)
- **Schema:** `setup-supabase-schema.sql` (database setup)

---

## 🎓 COMMANDS REFERENCE

```bash
# Check status
node lead-gen-system.js status

# Send emails (15 = Week 1 warmup)
node lead-gen-system.js send-emails 15

# Generate weekly report
node lead-gen-system.js generate-report

# Log a conversion
node lead-gen-system.js log-conversion "email@clinic.com" "2025-01-15"

# Track email opens
node lead-gen-system.js track-opens
```

---

## 🚀 NEXT STEPS

1. ✅ Get Resend API key
2. ✅ Run `bash START_LEAD_GEN.sh`
3. ✅ Send first batch of 15 emails
4. ✅ Monitor replies in inbox
5. ✅ Set up cron jobs for automation
6. ✅ Expand to Nigeria (Week 4)
7. ✅ Add inbound call handling (Week 2)

---

## 💰 REVENUE PROJECTION

**Conservative (1-2% conversion):**
- Month 1: £289-£578 MRR
- Month 3: £1.5k-£3k MRR
- Month 6: £3k-£6k MRR

**Aggressive (3-5% conversion):**
- Month 1: £1.5k-£3k MRR
- Month 3: £6k-£12k MRR
- Month 6: £12k-£25k MRR

---

## 📞 SUPPORT

- **Email:** support@callwaitingai.dev
- **Slack:** #lead-gen
- **Escalation:** Austyn (CEO)

---

**Ready to start?**

```bash
bash START_LEAD_GEN.sh
```

🚀 Let's generate some leads!
