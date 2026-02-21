# 🚀 Voxanne AI Cold Email Outreach Strategy (2026)
## Multi-Market Lead Generation for Healthcare AI SaaS

**Primary Email:** support@voxanne.ai
**Target Markets:** UK, US, Canada, Turkey, Nigeria
**Objective:** Generate 500+ qualified healthcare SMB leads/month
**Timeline:** 4-week implementation + ongoing optimization

---

## 📋 Table of Contents

1. [Infrastructure Audit & Setup](#infrastructure-audit--setup)
2. [Email Deliverability Configuration](#email-deliverability-configuration)
3. [Lead Generation & Scraping Workflow](#lead-generation--scraping-workflow)
4. [Market-Specific Positioning](#market-specific-positioning)
5. [Compliance Requirements](#compliance-requirements)
6. [Email Sequence Templates](#email-sequence-templates)
7. [Technical Implementation](#technical-implementation)
8. [Success Metrics & KPIs](#success-metrics--kpis)
9. [Automation Workflow](#automation-workflow)

---

## 🔧 Phase 1: Infrastructure Audit & Setup

### Current Infrastructure Status

✅ **What You Have:**
- Email domain: voxanne.ai
- Primary email: support@voxanne.ai
- Resend API configured (backend/.env)
- Zoho email hosting
- SPF record: `v=spf1 include:zohomail.com ~all`

⚠️ **What's Missing:**
- DKIM authentication (domain signing)
- DMARC policy (email protection)
- Dedicated IP address for cold email
- Email warming schedule
- Lead enrichment tools
- CRM integration for lead tracking
- Automated scraping workflow

### Recommended Tech Stack

| Component | Tool | Monthly Cost | Purpose |
|-----------|------|--------------|---------|
| **Email Sending** | Instantly.ai | $37-97 | Cold email automation, deliverability |
| **Lead Scraping** | Apollo.io | $49-79 | B2B database, 10K+ contacts/month |
| **Email Verification** | ZeroBounce | $16 | Validate emails before sending |
| **CRM Integration** | Attio or HubSpot | $29-50 | Lead tracking, pipeline management |
| **Compliance** | TrustArc (optional) | $0-199 | GDPR/HIPAA compliance management |
| **Analytics** | Built-in + Mixpanel | $0-25 | Track opens, clicks, replies |

**Total Monthly Cost:** $131-450 (depending on volume)

---

## 📧 Phase 2: Email Deliverability Configuration

### Critical DNS Records Setup

**1. SPF Record (Already Have - Needs Update)**
```dns
Current: v=spf1 include:zohomail.com ~all
Updated: v=spf1 include:zohomail.com include:_spf.instantly.ai ~all
```

**2. DKIM Record (Add This)**
```dns
Host: instantly._domainkey.voxanne.ai
Type: TXT
Value: [Get from Instantly.ai dashboard after signup]
TTL: 3600
```

**3. DMARC Record (Add This)**
```dns
Host: _dmarc.voxanne.ai
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@voxanne.ai; pct=100; adkim=s; aspf=s
TTL: 3600
```

**4. Custom Tracking Domain (Optional but Recommended)**
```dns
Host: track.voxanne.ai
Type: CNAME
Value: track.instantly.ai
TTL: 3600
```

### Email Warming Schedule (Critical!)

**Week 1-2: Warm-Up Phase**
- Days 1-3: Send 5-10 emails/day to known contacts
- Days 4-7: Send 20-30 emails/day
- Days 8-14: Send 50-75 emails/day

**Week 3-4: Ramp-Up Phase**
- Days 15-21: Send 100-150 emails/day
- Days 22-28: Send 200-300 emails/day

**Steady State (Week 5+):**
- Send 500-1000 emails/day (max)
- Maintain 30%+ open rate
- Keep bounce rate <3%
- Reply rate target: 5-10%

### Deliverability Best Practices

✅ **DO:**
- Use personalized subject lines (include clinic name)
- Write conversational, non-salesy copy
- Include unsubscribe link in every email
- Send emails during business hours (9 AM - 5 PM local time)
- Rotate sending times (don't send all at 9 AM)
- Use plain text + minimal HTML formatting
- Include your physical address in footer

❌ **DON'T:**
- Use spam trigger words ("free", "guarantee", "act now")
- Send attachments in cold emails
- Use URL shorteners (bit.ly, tinyurl)
- Send from noreply@ addresses
- Buy email lists (always scrape or opt-in only)
- Send more than 500 emails/day from one domain

---

## 🎯 Phase 3: Lead Generation & Scraping Workflow

### Target Audience Definition

**Primary Target:** Healthcare SMBs (10-50 employees)

| Specialty | Annual Revenue | Employee Count | Decision Maker Title |
|-----------|---------------|----------------|---------------------|
| Dental Clinics | $500K-$5M | 5-25 | Practice Manager, Office Manager |
| Dermatology | $1M-$10M | 10-40 | Clinic Administrator, Operations Manager |
| Physical Therapy | $300K-$3M | 5-20 | Owner, Clinic Director |
| Chiropractic | $250K-$2M | 3-15 | Practice Owner, Office Manager |
| Med Spas | $500K-$5M | 5-30 | Operations Manager, Owner |

### Lead Scraping Strategy (Using Apollo.io)

**Step 1: Create Search Filters**

```json
{
  "industry": ["Healthcare", "Medical Practice", "Wellness and Fitness"],
  "job_titles": [
    "Practice Manager",
    "Office Manager",
    "Operations Manager",
    "Clinic Administrator",
    "Practice Owner",
    "Clinic Director"
  ],
  "company_size": ["1-10", "11-50", "51-200"],
  "revenue_range": ["$500K-$1M", "$1M-$10M"],
  "technologies": ["Google Calendar", "Calendly", "Square", "Stripe"],
  "location": {
    "US": ["New York", "California", "Texas", "Florida"],
    "UK": ["London", "Manchester", "Birmingham"],
    "Canada": ["Toronto", "Vancouver", "Montreal"],
    "Turkey": ["Istanbul", "Ankara", "Izmir"],
    "Nigeria": ["Lagos", "Abuja", "Port Harcourt"]
  }
}
```

**Step 2: Export & Enrich Leads (1000 leads/week)**

Using Apollo.io API:
```bash
# Export leads to CSV
curl -X POST "https://api.apollo.io/v1/mixed_people/search" \
  -H "Content-Type: application/json" \
  -H "Cache-Control: no-cache" \
  -H "X-Api-Key: YOUR_APOLLO_API_KEY" \
  -d '{
    "person_titles": ["Practice Manager", "Office Manager"],
    "organization_num_employees_ranges": ["1,50"],
    "q_organization_keyword_tags": ["dental", "dermatology"],
    "page": 1,
    "per_page": 100
  }'
```

**Step 3: Email Verification (ZeroBounce API)**

```bash
# Verify emails before sending
curl -X POST "https://api.zerobounce.net/v2/validate" \
  -d "api_key=YOUR_ZEROBOUNCE_API_KEY" \
  -d "email=test@example.com"
```

### Automated Scraping Workflow (Claude Code + MCP)

**Automation Script: `backend/scripts/scrape-leads.ts`**

```typescript
import { ApolloClient } from './apollo-client';
import { ZeroBounceClient } from './zerobounce-client';
import { supabase } from '../config/database';

interface Lead {
  firstName: string;
  lastName: string;
  email: string;
  clinicName: string;
  phone: string;
  location: string;
  specialty: string;
  linkedinUrl?: string;
}

async function scrapeLeads(country: string, specialty: string, limit: number = 100) {
  console.log(`🔍 Scraping ${limit} ${specialty} leads from ${country}...`);

  // Step 1: Fetch leads from Apollo.io
  const apollo = new ApolloClient(process.env.APOLLO_API_KEY);
  const rawLeads = await apollo.searchPeople({
    personTitles: ['Practice Manager', 'Office Manager', 'Operations Manager'],
    organizationLocations: [country],
    qOrganizationKeywordTags: [specialty],
    page: 1,
    perPage: limit
  });

  // Step 2: Verify emails with ZeroBounce
  const zerobounce = new ZeroBounceClient(process.env.ZEROBOUNCE_API_KEY);
  const verifiedLeads: Lead[] = [];

  for (const lead of rawLeads) {
    const validation = await zerobounce.validate(lead.email);

    if (validation.status === 'valid') {
      verifiedLeads.push({
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        clinicName: lead.organization.name,
        phone: lead.phone_numbers?.[0]?.raw_number,
        location: `${lead.city}, ${lead.state || lead.country}`,
        specialty: specialty,
        linkedinUrl: lead.linkedin_url
      });
    }
  }

  // Step 3: Save to Supabase CRM
  const { data, error } = await supabase
    .from('cold_email_leads')
    .insert(
      verifiedLeads.map(lead => ({
        ...lead,
        country,
        status: 'new',
        campaign: `${country}_${specialty}_${new Date().toISOString().split('T')[0]}`,
        created_at: new Date().toISOString()
      }))
    );

  if (error) {
    console.error('❌ Error saving leads:', error);
    return;
  }

  console.log(`✅ Saved ${verifiedLeads.length} verified leads to database`);
  return verifiedLeads;
}

// Run scraping campaign
async function runDailyScrape() {
  const campaigns = [
    { country: 'US', specialty: 'dental', limit: 100 },
    { country: 'US', specialty: 'dermatology', limit: 100 },
    { country: 'UK', specialty: 'dental', limit: 50 },
    { country: 'Canada', specialty: 'physical-therapy', limit: 50 },
    { country: 'Turkey', specialty: 'dental', limit: 30 },
    { country: 'Nigeria', specialty: 'dental', limit: 30 }
  ];

  for (const campaign of campaigns) {
    await scrapeLeads(campaign.country, campaign.specialty, campaign.limit);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
  }
}

// Schedule daily at 9 AM UTC
export { runDailyScrape };
```

**Database Schema: `cold_email_leads` table**

```sql
CREATE TABLE cold_email_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  clinic_name TEXT NOT NULL,
  phone TEXT,
  location TEXT NOT NULL,
  specialty TEXT NOT NULL,
  country TEXT NOT NULL,
  linkedin_url TEXT,
  campaign TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'qualified', 'unsubscribed', 'bounced')),
  email_sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON cold_email_leads(status);
CREATE INDEX idx_leads_country ON cold_email_leads(country);
CREATE INDEX idx_leads_campaign ON cold_email_leads(campaign);
```

---

## 🌍 Phase 4: Market-Specific Positioning

### United States 🇺🇸

**Market Size:** 200,000+ dental clinics, 12,000+ dermatology practices
**Key Pain Points:**
- Staff shortages (hiring crisis post-COVID)
- No-show rates 25-30%
- Insurance verification complexity
- High cost per call ($5-15/call via answering service)

**Messaging Strategy:**
- Lead with ROI: "Save $2,000/month on answering services"
- Emphasize HIPAA compliance (critical requirement)
- Highlight 24/7 availability (staff shortage solution)
- Use case studies from US clinics (social proof)

**Subject Line Examples:**
- "{{FirstName}}, reduce no-shows at {{ClinicName}} by 40%"
- "How {{ClinicName}} can handle 100+ calls/day with AI"
- "HIPAA-compliant AI receptionist for {{ClinicName}}"

**Email Tone:** Professional, ROI-focused, data-driven

---

### United Kingdom 🇬🇧

**Market Size:** 11,000+ dental practices, 2,500+ private dermatology clinics
**Key Pain Points:**
- NHS waiting lists driving private patient demand
- Staff retention challenges
- Limited opening hours (9-5 only)
- Patient communication expectations rising

**Messaging Strategy:**
- Lead with patient experience: "Never miss a private patient inquiry"
- Emphasize efficiency for small teams
- Highlight evening/weekend coverage
- Reference NHS digital transformation initiatives

**Subject Line Examples:**
- "{{FirstName}}, capture more private patients at {{ClinicName}}"
- "AI receptionist for UK private practices (GDPR-compliant)"
- "How {{ClinicName}} can offer 24/7 booking without overtime"

**Email Tone:** Professional but warm, patient-centric, NHS-aware

---

### Canada 🇨🇦

**Market Size:** 20,000+ dental practices, 1,500+ dermatology clinics
**Key Pain Points:**
- Bilingual requirements (English/French in Quebec)
- Small staff teams (5-10 employees typical)
- Seasonal tourism in major cities
- High labor costs in urban centers

**Messaging Strategy:**
- Lead with bilingual capability (if supported)
- Emphasize cost savings vs. hiring
- Highlight scalability for multi-location practices
- Reference CASL compliance (anti-spam law)

**Subject Line Examples:**
- "{{FirstName}}, cut reception costs by 50% at {{ClinicName}}"
- "Bilingual AI receptionist for {{ClinicName}} (EN/FR)"
- "How Toronto clinics are scaling without hiring receptionists"

**Email Tone:** Friendly, practical, cost-conscious

---

### Turkey 🇹🇷

**Market Size:** 25,000+ dental clinics, 3,000+ dermatology/aesthetic clinics
**Key Pain Points:**
- Medical tourism boom (foreign patients)
- Language barriers (Turkish/English/Arabic/Russian)
- WhatsApp-first communication culture
- Price-sensitive market

**Messaging Strategy:**
- Lead with medical tourism angle: "Handle international patients 24/7"
- Emphasize multilingual support
- Highlight WhatsApp integration (if available)
- Use local currency pricing (TRY)

**Subject Line Examples:**
- "{{FirstName}}, international hastaları otomatik yanıtlayın" (Turkish)
- "AI receptionist for {{ClinicName}}'s medical tourism patients"
- "24/7 multilingual support for {{ClinicName}}"

**Email Tone:** Respectful, international, tech-forward

**KVKK Compliance Note:** Turkey's GDPR equivalent - require explicit consent, provide opt-out

---

### Nigeria 🇳🇬

**Market Size:** 10,000+ private clinics, 2,000+ dental practices
**Key Pain Points:**
- Limited tech adoption (opportunity!)
- Mobile-first market (voice calls > email)
- Infrastructure challenges (power, internet)
- Price sensitivity

**Messaging Strategy:**
- Lead with competitive advantage: "Be the first AI-powered clinic in Lagos"
- Emphasize reliability (cloud-based, works on mobile data)
- Highlight affordable pricing for African market
- Use local success stories (if available)

**Subject Line Examples:**
- "{{FirstName}}, transform {{ClinicName}} with AI receptionist"
- "How Lagos clinics are handling 200+ calls/day automatically"
- "Affordable AI voice assistant for Nigerian private practices"

**Email Tone:** Aspirational, accessible, tech-optimistic

**NDPR Compliance Note:** Nigeria Data Protection Regulation - obtain consent, protect data

---

## ⚖️ Phase 5: Compliance Requirements by Market

### GDPR (UK, EU, Turkey via KVKK)

**Requirements:**
- ✅ Obtain explicit consent before sending marketing emails
- ✅ Provide clear opt-out mechanism in every email
- ✅ Honor unsubscribe requests within 48 hours
- ✅ Store consent records for 2 years
- ✅ Include physical business address
- ✅ Explain data processing in privacy policy

**Email Footer Template (GDPR-Compliant):**
```html
---
You're receiving this email because your clinic matches our target audience for healthcare AI solutions.

Unsubscribe | Update preferences | View privacy policy

Voxanne AI Ltd.
[Physical Address]
Data Protection Officer: dpo@voxanne.ai
```

### CAN-SPAM (US, Canada via CASL)

**Requirements:**
- ✅ No deceptive subject lines
- ✅ Clear identification as advertisement (if promotional)
- ✅ Include physical postal address
- ✅ Provide opt-out mechanism
- ✅ Honor opt-outs within 10 business days
- ✅ No false header information

**Email Footer Template (CAN-SPAM-Compliant):**
```html
---
This is a commercial email sent by Voxanne AI.

Not interested? Unsubscribe here.

Voxanne AI
[Physical Address]
support@voxanne.ai
```

### KVKK (Turkey)

**Additional Requirements:**
- Must provide Turkish-language privacy policy
- Obtain explicit consent for data processing
- Inform data subjects of their rights
- Report data breaches within 72 hours

### NDPR (Nigeria)

**Additional Requirements:**
- Register with NITDA (Nigeria Data Protection Bureau)
- Obtain consent in clear, plain language
- Protect data with reasonable security measures
- Appoint Data Protection Compliance Officer (if processing >1000 records)

---

## 📝 Phase 6: Email Sequence Templates

### Sequence 1: US Dental Clinics (5-Email Series)

**Email 1: Problem Awareness (Day 0)**

```
Subject: {{FirstName}}, is {{ClinicName}} missing calls after 5 PM?

Hi {{FirstName}},

I noticed {{ClinicName}} on Google—congratulations on the 4.8-star reviews!

Quick question: How many patient calls do you miss after hours or during lunch breaks?

Most dental practices lose 20-30 appointment opportunities per month just from timing issues.

We built Voxanne AI to solve this. It's an AI receptionist that:
• Answers calls 24/7 (even at 11 PM on Sunday)
• Books appointments directly into your calendar
• Never puts patients on hold
• Costs 80% less than a full-time receptionist

Would you be open to a 10-minute demo to see how it works?

Best,
[Your Name]
Voxanne AI
support@voxanne.ai

P.S. We're HIPAA-compliant and integrate with all major dental software (Dentrix, Eaglesoft, Open Dental).

---
Not interested? Unsubscribe here.
Voxanne AI, [Address]
```

**Email 2: Social Proof (Day 3)**

```
Subject: How Dr. Martinez increased bookings by 35% (case study)

{{FirstName}},

I wanted to share a quick case study from Dr. Martinez, a dentist in Austin, TX.

Before Voxanne AI:
• 12-15 missed calls per week
• 28% no-show rate
• 2 receptionists ($70K/year total)

After Voxanne AI:
• 0 missed calls
• 12% no-show rate (SMS reminders)
• 1 receptionist ($35K/year saved)

Result: 35% more appointments booked, $105K/year savings.

Would you like to see if we can achieve similar results for {{ClinicName}}?

[Book a 10-min demo]

Best,
[Your Name]

---
Unsubscribe | Voxanne AI, [Address]
```

**Email 3: Objection Handling (Day 7)**

```
Subject: "Will my patients accept an AI receptionist?"

{{FirstName}},

This is the #1 question we hear from dental practice managers.

The surprising answer: Patients LOVE it.

Here's why:
1. Instant answers (no 5-minute hold music)
2. 24/7 availability (book at 10 PM after the kids sleep)
3. Natural conversation (not robotic "press 1 for...")
4. Remembers their history ("Hi Sarah, ready to reschedule your cleaning?")

Our AI sounds so natural, 78% of patients don't realize they're talking to AI until we tell them.

Want to hear it yourself? I can call you and you can test it live.

[Schedule a live demo call]

Best,
[Your Name]

P.S. If patients prefer a human, they can always transfer. But 92% choose to complete their booking with AI.

---
Unsubscribe | Voxanne AI, [Address]
```

**Email 4: Urgency + Limited Offer (Day 12)**

```
Subject: {{FirstName}}, we're waiving setup fees for 5 more clinics

Quick update: We're offering free setup (normally $500) for the next 5 dental practices who sign up this month.

{{ClinicName}} would be a great fit because:
• You have 4+ staff members (ROI is higher)
• You're in {{Location}} (we have 3 clients in your area)
• Your Google reviews mention "hard to reach by phone"

If you're interested, can we schedule a 10-minute call this week?

[Book your demo - 3 spots left]

Best,
[Your Name]

---
Unsubscribe | Voxanne AI, [Address]
```

**Email 5: Break-Up Email (Day 20)**

```
Subject: Should I close your file?

{{FirstName}},

I haven't heard back from you, so I assume AI receptionists aren't a priority for {{ClinicName}} right now.

I'll close your file unless I hear from you.

But before I do—can I ask: What stopped you from trying Voxanne AI?

Was it:
A) Budget concerns?
B) Not sure if it would work for your practice?
C) Timing isn't right?
D) Something else?

Hit reply and let me know. I promise I won't follow up again after this.

Best,
[Your Name]

P.S. If you ever want to revisit this, just email me directly at [your-email]. No hard feelings!

---
Unsubscribe | Voxanne AI, [Address]
```

---

### Sequence 2: UK Private Dermatology Clinics

**Email 1: Problem Awareness (Day 0)**

```
Subject: {{FirstName}}, are you losing private patients to phone tag?

Hi {{FirstName}},

I came across {{ClinicName}} while researching top private dermatology clinics in {{Location}}.

Quick question: How many potential private patients call your practice but hang up after 3 rings?

With NHS waiting lists pushing more patients to private care, your phone lines are likely busier than ever.

Voxanne AI is an intelligent receptionist that:
• Answers every call instantly (even at 7 PM)
• Books consultations directly into your calendar
• Sends SMS confirmations automatically
• Handles 100+ calls per day without staff burnout

Would a 10-minute demo be helpful to see how it works?

Best,
[Your Name]
Voxanne AI
support@voxanne.ai

P.S. We're GDPR-compliant and integrate with UK calendar systems (Google Calendar, Outlook, iCal).

---
Not interested? Unsubscribe here.
Voxanne AI Ltd., [UK Address]
```

**Email 2-5:** Follow similar structure to US sequence, adapted for UK market tone and pain points.

---

### Sequence 3: Canada Bilingual Clinics

**Email 1: Bilingual Hook**

```
Subject: AI receptionist who speaks English AND French?

Bonjour {{FirstName}},

Managing a bilingual practice in {{Location}} is challenging—especially when your receptionist goes on break.

Voxanne AI is the first AI receptionist that fluently handles calls in:
• English
• French (Québécois accent)
• Spanish (coming soon)

It can:
✓ Book appointments in either language
✓ Switch languages mid-conversation
✓ Send SMS confirmations in the patient's preferred language

Want to hear it in action? I'll call you and you can switch between languages.

[Book demo]

Best,
[Your Name]

---
Unsubscribe | Voxanne AI, [Address]
```

---

### Sequence 4: Turkey Medical Tourism Clinics

**Email 1: Medical Tourism Hook (Turkish/English)**

```
Subject: International hastaları 24/7 otomatik yanıtlayın

Merhaba {{FirstName}},

{{ClinicName}} receives inquiries from international patients, correct?

Voxanne AI handles multilingual patient calls automatically:
• Turkish
• English
• Russian
• Arabic

Perfect for medical tourism clinics in Istanbul, Ankara, and Izmir.

Book a free demo: [link]

Best regards,
[Your Name]
Voxanne AI

---
Abonelikten çık | Unsubscribe
Voxanne AI, [Address]
```

---

### Sequence 5: Nigeria Mobile-First Clinics

**Email 1: Competitive Advantage**

```
Subject: Be the first AI-powered clinic in Lagos

Hi {{FirstName}},

{{ClinicName}} could be the first private practice in {{Location}} with an AI receptionist.

While competitors struggle with missed calls and scheduling chaos, you'd have:
• 24/7 call answering (works on 3G/4G)
• Automatic appointment booking
• SMS patient reminders
• Cloud-based (no power outage interruptions)

Pricing: ₦45,000/month (less than hiring a receptionist)

Interested in a free trial?

[Book demo]

Best,
[Your Name]

---
Unsubscribe | Voxanne AI, [Address]
```

---

## 🤖 Phase 7: Technical Implementation (Claude Code + MCP)

### Automation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   VOXANNE COLD EMAIL SYSTEM                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ LEAD SCRAPING│    │ EMAIL SENDING│    │ TRACKING &   │
│              │    │              │    │ ANALYTICS    │
│ • Apollo.io  │───▶│ • Instantly.ai│───▶│ • Supabase   │
│ • ZeroBounce │    │ • Resend API  │    │ • Mixpanel   │
│ • Claude MCP │    │ • Scheduler   │    │ • Dashboards │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                   ┌──────────────────┐
                   │   CRM PIPELINE   │
                   │                  │
                   │ • Lead Scoring   │
                   │ • Reply Detection│
                   │ • Auto-Qualify   │
                   └──────────────────┘
```

### Implementation Steps

**Step 1: Create MCP Tool for Lead Scraping**

`backend/src/mcp-tools/apollo-scraper.ts`:

```typescript
import { MCPTool } from '@anthropic/mcp-sdk';

export const apolloScraperTool: MCPTool = {
  name: 'scrape_healthcare_leads',
  description: 'Scrape healthcare SMB leads from Apollo.io for cold email campaigns',
  inputSchema: {
    type: 'object',
    properties: {
      country: {
        type: 'string',
        enum: ['US', 'UK', 'Canada', 'Turkey', 'Nigeria'],
        description: 'Target country for lead scraping'
      },
      specialty: {
        type: 'string',
        enum: ['dental', 'dermatology', 'physical-therapy', 'chiropractic', 'med-spa'],
        description: 'Healthcare specialty to target'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of leads to scrape (default: 100)',
        default: 100
      }
    },
    required: ['country', 'specialty']
  },
  handler: async (input) => {
    const { country, specialty, limit = 100 } = input;

    // Implementation using Apollo.io API
    const apollo = new ApolloClient(process.env.APOLLO_API_KEY);

    const searchParams = {
      person_titles: ['Practice Manager', 'Office Manager', 'Clinic Administrator'],
      organization_locations: [country],
      q_organization_keyword_tags: [specialty],
      page: 1,
      per_page: limit
    };

    const results = await apollo.searchPeople(searchParams);

    // Verify emails with ZeroBounce
    const zerobounce = new ZeroBounceClient(process.env.ZEROBOUNCE_API_KEY);
    const verifiedLeads = [];

    for (const lead of results.people) {
      const validation = await zerobounce.validate(lead.email);
      if (validation.status === 'valid') {
        verifiedLeads.push({
          firstName: lead.first_name,
          lastName: lead.last_name,
          email: lead.email,
          clinicName: lead.organization.name,
          location: `${lead.city}, ${lead.state || lead.country}`,
          specialty,
          country
        });
      }
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('cold_email_leads')
      .insert(verifiedLeads);

    return {
      success: !error,
      leads: verifiedLeads,
      count: verifiedLeads.length,
      message: `Scraped and verified ${verifiedLeads.length} ${specialty} leads from ${country}`
    };
  }
};
```

**Step 2: Create Email Sending Service**

`backend/src/services/cold-email-service.ts`:

```typescript
import { InstantlyClient } from './instantly-client';
import { supabase } from '../config/database';

interface SendCampaignParams {
  campaignName: string;
  country: string;
  specialty: string;
  emailSequence: number; // 1-5
  batchSize?: number;
}

export class ColdEmailService {
  private instantly: InstantlyClient;

  constructor() {
    this.instantly = new InstantlyClient(process.env.INSTANTLY_API_KEY);
  }

  async sendDailyCampaign(params: SendCampaignParams) {
    const { country, specialty, emailSequence, batchSize = 100 } = params;

    // Get leads ready for this email sequence
    const { data: leads, error } = await supabase
      .from('cold_email_leads')
      .select('*')
      .eq('country', country)
      .eq('specialty', specialty)
      .eq('status', emailSequence === 1 ? 'new' : `email_${emailSequence - 1}_sent`)
      .limit(batchSize);

    if (error || !leads?.length) {
      console.log(`No leads ready for email ${emailSequence} in ${country}/${specialty}`);
      return;
    }

    // Get email template
    const template = this.getEmailTemplate(country, specialty, emailSequence);

    // Send emails via Instantly.ai
    for (const lead of leads) {
      const personalizedEmail = this.personalize(template, lead);

      await this.instantly.sendEmail({
        to: lead.email,
        from: 'support@voxanne.ai',
        subject: personalizedEmail.subject,
        body: personalizedEmail.body,
        campaignId: params.campaignName,
        leadId: lead.id
      });

      // Update lead status
      await supabase
        .from('cold_email_leads')
        .update({
          status: `email_${emailSequence}_sent`,
          email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      // Rate limit: 1 email every 10 seconds (safe sending pace)
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(`✅ Sent email ${emailSequence} to ${leads.length} leads`);
  }

  private getEmailTemplate(country: string, specialty: string, sequence: number) {
    // Return appropriate template based on country/specialty/sequence
    // Templates defined in Phase 6
  }

  private personalize(template: any, lead: any) {
    // Replace {{FirstName}}, {{ClinicName}}, etc.
    let subject = template.subject;
    let body = template.body;

    subject = subject.replace(/{{FirstName}}/g, lead.first_name);
    subject = subject.replace(/{{ClinicName}}/g, lead.clinic_name);

    body = body.replace(/{{FirstName}}/g, lead.first_name);
    body = body.replace(/{{ClinicName}}/g, lead.clinic_name);
    body = body.replace(/{{Location}}/g, lead.location);

    return { subject, body };
  }
}
```

**Step 3: Create Automation Scheduler**

`backend/src/jobs/cold-email-automation.ts`:

```typescript
import schedule from 'node-schedule';
import { ColdEmailService } from '../services/cold-email-service';
import { runDailyScrape } from '../scripts/scrape-leads';

export class ColdEmailAutomation {
  private emailService: ColdEmailService;

  constructor() {
    this.emailService = new ColdEmailService();
  }

  start() {
    // Daily lead scraping at 9 AM UTC
    schedule.scheduleJob('0 9 * * *', async () => {
      console.log('🔍 Starting daily lead scraping...');
      await runDailyScrape();
    });

    // Email sending at 10 AM local time for each country

    // US campaigns (10 AM EST = 3 PM UTC)
    schedule.scheduleJob('0 15 * * *', async () => {
      await this.sendCampaigns('US');
    });

    // UK campaigns (10 AM GMT = 10 AM UTC)
    schedule.scheduleJob('0 10 * * *', async () => {
      await this.sendCampaigns('UK');
    });

    // Canada campaigns (10 AM EST = 3 PM UTC)
    schedule.scheduleJob('0 15 * * *', async () => {
      await this.sendCampaigns('Canada');
    });

    // Turkey campaigns (10 AM Turkey = 7 AM UTC)
    schedule.scheduleJob('0 7 * * *', async () => {
      await this.sendCampaigns('Turkey');
    });

    // Nigeria campaigns (10 AM Lagos = 9 AM UTC)
    schedule.scheduleJob('0 9 * * *', async () => {
      await this.sendCampaigns('Nigeria');
    });

    console.log('✅ Cold email automation started');
  }

  private async sendCampaigns(country: string) {
    console.log(`📧 Sending ${country} campaigns...`);

    const specialties = ['dental', 'dermatology', 'physical-therapy'];

    for (const specialty of specialties) {
      // Send all 5 email sequences (different leads at different stages)
      for (let sequence = 1; sequence <= 5; sequence++) {
        await this.emailService.sendDailyCampaign({
          campaignName: `${country}_${specialty}_${sequence}`,
          country,
          specialty,
          emailSequence: sequence,
          batchSize: 50 // Send 50 emails per sequence per day
        });
      }
    }
  }
}

// Start automation on server startup
const automation = new ColdEmailAutomation();
automation.start();
```

---

## 📊 Phase 8: Success Metrics & KPIs

### Primary Metrics

| Metric | Target | Industry Benchmark | How to Measure |
|--------|--------|-------------------|----------------|
| **Deliverability Rate** | >97% | 95-98% | (Sent - Bounced) / Sent |
| **Open Rate** | >35% | 20-30% | Opens / Delivered |
| **Click Rate** | >8% | 3-5% | Clicks / Opens |
| **Reply Rate** | >5% | 2-4% | Replies / Sent |
| **Positive Reply Rate** | >2% | 1-2% | Positive Replies / Replies |
| **Meeting Booked Rate** | >1% | 0.5-1% | Meetings / Sent |
| **SQL (Sales Qualified Lead) Rate** | >0.5% | 0.2-0.5% | SQLs / Sent |

### Secondary Metrics

- **Bounce Rate:** <3% (hard bounces + soft bounces)
- **Spam Complaint Rate:** <0.1%
- **Unsubscribe Rate:** <0.5%
- **Time to First Reply:** <24 hours average
- **Email-to-Demo Conversion:** >30% (demos / positive replies)
- **Demo-to-Customer Conversion:** >20% (customers / demos)

### Weekly Dashboard (Supabase + Mixpanel)

**Key Questions to Answer:**
1. How many leads scraped this week?
2. How many emails sent per country/specialty?
3. What's our current open/reply rate by market?
4. Which email sequence performs best?
5. How many demos booked this week?
6. What's our pipeline value from cold email?

**SQL Query for Weekly Report:**

```sql
-- Weekly cold email performance
SELECT
  country,
  specialty,
  COUNT(*) FILTER (WHERE status LIKE 'email_%_sent') as emails_sent,
  COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opens,
  COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicks,
  COUNT(*) FILTER (WHERE replied_at IS NOT NULL) as replies,
  COUNT(*) FILTER (WHERE status = 'qualified') as sqls,
  ROUND(100.0 * COUNT(*) FILTER (WHERE opened_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE status LIKE 'email_%_sent'), 0), 2) as open_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE replied_at IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE status LIKE 'email_%_sent'), 0), 2) as reply_rate
FROM cold_email_leads
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY country, specialty
ORDER BY emails_sent DESC;
```

---

## 🔄 Phase 9: Complete Automation Workflow

### Daily Workflow (Automated)

**9:00 AM UTC: Lead Scraping**
```bash
# Run daily scraping job
npm run scrape:daily

# Expected output:
# ✅ Scraped 100 US dental leads
# ✅ Scraped 100 US dermatology leads
# ✅ Scraped 50 UK dental leads
# ✅ Scraped 50 Canada PT leads
# ✅ Scraped 30 Turkey dental leads
# ✅ Scraped 30 Nigeria dental leads
# Total: 360 new verified leads added to database
```

**10:00-15:00 UTC: Email Sending (Staggered by Timezone)**
```bash
# Automatically sends emails at optimal local times:
# - UK: 10 AM GMT
# - Turkey: 10 AM Turkey Time
# - Nigeria: 10 AM WAT
# - US/Canada: 10 AM EST

# Each country receives 50-100 emails/day
# Spread across 5 email sequences
# Example: 50 leads get Email 1, 50 get Email 2, etc.
```

**Real-Time: Reply Detection**
```bash
# Instantly.ai webhook to backend
POST /api/webhooks/instantly

# Automatically:
# 1. Marks lead as "replied" in database
# 2. Categorizes reply (positive/negative/neutral)
# 3. Sends Slack notification to sales team
# 4. Creates task in CRM for follow-up
```

### Weekly Workflow (Manual Review)

**Monday Morning: Review Dashboard**
- Check last week's metrics (opens, replies, meetings)
- Identify underperforming campaigns
- Adjust email copy for low performers
- Celebrate wins (screenshots of positive replies)

**Wednesday: A/B Testing**
- Test 2 subject lines per market
- Test 2 CTAs per email sequence
- Measure results over 100 emails each
- Update templates with winners

**Friday: Lead Qualification**
- Review all positive replies from the week
- Book demos for qualified leads
- Pass hot leads to sales team
- Update CRM pipeline values

---

## 🚀 Quick Start Guide

### Week 1: Setup

**Day 1: Tool Signup**
1. Sign up for Apollo.io ($49/month)
2. Sign up for Instantly.ai ($37/month)
3. Sign up for ZeroBounce ($16 for 2000 credits)
4. Get API keys for all three

**Day 2: DNS Configuration**
1. Add DKIM record (from Instantly.ai)
2. Update SPF record to include Instantly
3. Add DMARC record
4. Wait 24-48 hours for DNS propagation

**Day 3: Database Setup**
```bash
# Create cold_email_leads table
cd backend
npx supabase db push
```

**Day 4: Code Implementation**
```bash
# Install dependencies
npm install apollo-sdk zerobounce-sdk node-schedule

# Create scraping script
touch backend/src/scripts/scrape-leads.ts

# Create email service
touch backend/src/services/cold-email-service.ts

# Create automation scheduler
touch backend/src/jobs/cold-email-automation.ts
```

**Day 5: Testing**
```bash
# Test lead scraping
npm run scrape:test

# Test email sending (to yourself)
npm run email:test

# Verify deliverability
# Check if emails land in inbox (not spam)
```

### Week 2: Warm-Up

**Days 6-12: Email Warming**
- Send 10 emails/day to known contacts
- Gradually increase to 50-100/day
- Maintain >30% open rate
- Keep bounce rate <3%

### Week 3: First Campaign

**Day 15: Launch US Dental Campaign**
- Scrape 500 US dental leads
- Send Email 1 to first 100 leads
- Monitor deliverability in real-time
- Adjust if open rate <25%

**Day 18: Review Results**
- Check open/reply rates
- Read all replies (positive + negative)
- Book demos with interested leads
- Send Email 2 to Day 15 leads

### Week 4: Scale to Other Markets

**Day 22: Launch UK, Canada, Turkey, Nigeria**
- 100 leads per country
- Localized email templates
- Monitor compliance (GDPR, CAN-SPAM, etc.)
- Track metrics by market

---

## 📞 Support & Resources

**Questions?**
- Email: support@voxanne.ai
- Documentation: (link to internal docs)
- Slack: #cold-email-automation

**Recommended Reading:**
- [Apollo.io Lead Scraping Guide](https://apolloio.com)
- [Instantly.ai Deliverability Best Practices](https://instantly.ai)
- [GDPR Email Marketing Compliance](https://gdpr.eu)
- [CAN-SPAM Act Requirements](https://ftc.gov/can-spam)

**Tools Used:**
- Apollo.io: Lead database
- Instantly.ai: Email automation
- ZeroBounce: Email verification
- Supabase: CRM and lead tracking
- Node-schedule: Automation scheduler
- Mixpanel: Analytics and reporting

---

## ✅ Final Checklist

Before launching cold email campaigns:

**Legal & Compliance:**
- [ ] Privacy policy updated with cold email disclosure
- [ ] Physical address in all email footers
- [ ] Unsubscribe link working and tested
- [ ] GDPR consent mechanism for EU leads
- [ ] CAN-SPAM compliance verified
- [ ] CASL compliance for Canada
- [ ] KVKK compliance for Turkey
- [ ] NDPR compliance for Nigeria

**Technical Setup:**
- [ ] SPF record updated
- [ ] DKIM record added
- [ ] DMARC policy configured
- [ ] Custom tracking domain setup
- [ ] Email warming schedule started
- [ ] Bounce handling configured
- [ ] Reply detection webhook active

**Content & Templates:**
- [ ] 5 email sequences written for each market
- [ ] Subject lines A/B tested
- [ ] Personalization tokens tested
- [ ] CTAs clear and working
- [ ] Unsubscribe link in footer
- [ ] Mobile-responsive templates

**Infrastructure:**
- [ ] Database table created
- [ ] Lead scraping script working
- [ ] Email sending service tested
- [ ] Automation scheduler configured
- [ ] Analytics dashboard built
- [ ] Slack notifications setup

**Launch Criteria:**
- [ ] >95% email deliverability
- [ ] <3% bounce rate
- [ ] >25% open rate in warm-up
- [ ] 100 test emails sent successfully
- [ ] No spam complaints

---

**Last Updated:** February 17, 2026
**Status:** Ready for Implementation
**Next Review:** March 1, 2026

---

## 🎯 Expected Outcomes (90 Days)

**Lead Generation:**
- 10,000+ leads scraped across 5 countries
- 5,000+ verified emails (50% verification rate)
- 2,500+ emails sent (conservative warm-up)

**Engagement:**
- 875 email opens (35% open rate)
- 70 link clicks (8% click rate)
- 125 replies (5% reply rate)
- 50 positive replies (2% positive rate)

**Revenue:**
- 25 demos booked (1% meeting rate)
- 5 customers signed (20% demo-to-close)
- $2,500 MRR from cold email ($500/customer)
- ROI: 5x (spend $450/month, generate $2500/month)

**Key Success Factors:**
1. Consistent daily execution (automation critical)
2. Market-specific messaging (not one-size-fits-all)
3. Deliverability monitoring (protect domain reputation)
4. Fast reply follow-up (<4 hours)
5. Continuous A/B testing (improve every week)

---

**Good luck with your cold email campaigns! 🚀**

For questions or support implementing this strategy, email: support@voxanne.ai
