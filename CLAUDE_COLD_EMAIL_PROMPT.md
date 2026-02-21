# 🤖 Claude Code Implementation Prompt for Cold Email System

Copy and paste this prompt into Claude Code to implement the automated lead generation system:

---

## Prompt for Claude Code

```
I need you to implement the complete cold email automation system for Voxanne AI as specified in COLD_EMAIL_STRATEGY_2026.md.

**Context:**
- Primary email: support@voxanne.ai
- Target markets: US, UK, Canada, Turkey, Nigeria
- Target audience: Healthcare SMBs (dental, dermatology, physical therapy clinics)
- Tech stack: Node.js + TypeScript + Supabase + Resend API
- Goal: Automate lead scraping, email sending, and tracking

**Phase 1: Infrastructure Audit**
1. Read COLD_EMAIL_STRATEGY_2026.md to understand the complete system
2. Audit our current email infrastructure (check backend/.env for Resend configuration)
3. Verify DNS records for voxanne.ai (SPF, DKIM, DMARC)
4. Create a checklist of what's missing for email deliverability

**Phase 2: Database Setup**
1. Create Supabase migration for `cold_email_leads` table as specified in the strategy document
2. Add indexes for performance (status, country, campaign)
3. Create helper functions for lead management
4. Test the schema with sample data

**Phase 3: Lead Scraping Implementation**
1. Create `backend/src/scripts/scrape-leads.ts` with Apollo.io integration
2. Implement email verification using ZeroBounce API
3. Add rate limiting and error handling
4. Create npm script: `npm run scrape:leads`

**Phase 4: Email Service Implementation**
1. Create `backend/src/services/cold-email-service.ts`
2. Implement email template personalization ({{FirstName}}, {{ClinicName}}, etc.)
3. Add email sequence logic (5 emails per campaign)
4. Integrate with Instantly.ai or Resend API for sending

**Phase 5: Automation Scheduler**
1. Create `backend/src/jobs/cold-email-automation.ts`
2. Schedule daily lead scraping at 9 AM UTC
3. Schedule email sending at optimal local times per country
4. Add Slack notifications for replies and meetings booked

**Phase 6: Analytics Dashboard**
1. Create SQL queries for weekly performance reports
2. Build API endpoints for cold email metrics (/api/cold-email/stats)
3. Add tracking for opens, clicks, replies, meetings booked
4. Create simple frontend dashboard page to visualize metrics

**Phase 7: Testing & Documentation**
1. Test lead scraping with 10 sample leads
2. Test email sending to my own email first
3. Verify deliverability (inbox vs spam folder)
4. Document setup instructions in README_COLD_EMAIL.md

**Important Security Notes:**
- Store all API keys in .env (never commit them)
- Use environment variables for Apollo.io, ZeroBounce, Instantly.ai keys
- Implement rate limiting to avoid API bans
- Add unsubscribe webhook handler for compliance

**Deliverables:**
1. ✅ Supabase migration for cold_email_leads table
2. ✅ Lead scraping script with verification
3. ✅ Email sending service with personalization
4. ✅ Automation scheduler (cron jobs)
5. ✅ Analytics API endpoints
6. ✅ Simple dashboard for metrics
7. ✅ Testing checklist and documentation

**Success Criteria:**
- Can scrape 100 leads from Apollo.io in <2 minutes
- Can verify emails with ZeroBounce (>50% valid rate)
- Can send personalized emails using templates
- Emails land in inbox (not spam) with >95% deliverability
- Dashboard shows real-time metrics (opens, clicks, replies)

Please start with Phase 1 (Infrastructure Audit) and work through each phase sequentially. Ask me for API keys when needed, but NEVER commit them to Git.

Let me know if you need any clarification on the implementation details.
```

---

## Required API Keys (You'll Need to Provide These)

When Claude asks for API keys, provide:

1. **Apollo.io API Key:**
   - Sign up at: https://app.apollo.io
   - Go to Settings > API
   - Copy your API key
   - Add to backend/.env: `APOLLO_API_KEY=your-key-here`

2. **ZeroBounce API Key:**
   - Sign up at: https://www.zerobounce.net
   - Go to API > API Key
   - Copy your API key
   - Add to backend/.env: `ZEROBOUNCE_API_KEY=your-key-here`

3. **Instantly.ai API Key (Optional - if not using Resend):**
   - Sign up at: https://instantly.ai
   - Go to Settings > API
   - Copy your API key
   - Add to backend/.env: `INSTANTLY_API_KEY=your-key-here`

4. **Zoho Email Credentials (For Manual Inbox Checks Only):**
   - **DO NOT GIVE THESE TO CLAUDE**
   - Use them only for manual verification
   - Check your inbox after test emails to verify deliverability

---

## Alternative Simpler Prompt (If You Want Just Lead Scraping First)

```
I want to implement just the lead scraping part of the cold email system first.

**Task:**
1. Read COLD_EMAIL_STRATEGY_2026.md (focus on Phase 3: Lead Generation)
2. Create Supabase table for storing leads (cold_email_leads)
3. Build a script that scrapes 100 dental clinic leads from Apollo.io for the US market
4. Verify emails using ZeroBounce API
5. Save verified leads to Supabase

**Expected Output:**
- Database migration file
- Script: backend/src/scripts/scrape-leads.ts
- NPM command: npm run scrape:leads -- --country=US --specialty=dental --limit=100

Please implement this and test with 10 leads first. I'll provide API keys when needed.
```

---

## What to Expect from Claude

Claude will:
1. ✅ Read the strategy document
2. ✅ Create database migrations
3. ✅ Write TypeScript scripts for lead scraping
4. ✅ Integrate APIs (Apollo, ZeroBounce)
5. ✅ Build email automation logic
6. ✅ Create analytics queries
7. ✅ Test the system end-to-end

Claude will **NOT:**
- ❌ Access your Zoho email directly (security risk)
- ❌ Commit API keys to Git (security best practice)
- ❌ Send real emails without testing first
- ❌ Buy email lists (that's against best practices)

---

## Quick Start Commands (After Implementation)

Once Claude finishes implementation, you can run:

```bash
# Step 1: Install new dependencies
cd backend
npm install apollo-sdk zerobounce-sdk node-schedule

# Step 2: Apply database migration
npx supabase db push

# Step 3: Test lead scraping (10 leads)
npm run scrape:test

# Step 4: Scrape 100 leads for US dental market
npm run scrape:leads -- --country=US --specialty=dental --limit=100

# Step 5: Test email sending (send to yourself)
npm run email:test -- --to=your-email@example.com

# Step 6: Start automation (daily scraping + email sending)
npm run cold-email:start

# Step 7: View dashboard
npm run dev
# Then open: http://localhost:3000/dashboard/cold-email
```

---

## Timeline Estimate

- **Phase 1-2 (Infrastructure + Database):** 2 hours
- **Phase 3 (Lead Scraping):** 3 hours
- **Phase 4 (Email Service):** 4 hours
- **Phase 5 (Automation):** 3 hours
- **Phase 6 (Analytics):** 2 hours
- **Phase 7 (Testing):** 2 hours

**Total:** ~16 hours of development time

---

## Success Checklist

After implementation, verify:

- [ ] Can scrape leads from Apollo.io
- [ ] Leads are saved to Supabase database
- [ ] Emails are verified with ZeroBounce
- [ ] Can send test emails to yourself
- [ ] Test emails land in inbox (not spam)
- [ ] Email templates are personalized correctly
- [ ] Automation runs on schedule
- [ ] Dashboard shows metrics
- [ ] Unsubscribe link works
- [ ] Compliance footers included

---

**Ready to implement? Copy the main prompt above and paste it into Claude Code!** 🚀
