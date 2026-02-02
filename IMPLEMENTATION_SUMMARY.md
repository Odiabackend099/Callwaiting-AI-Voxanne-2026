# Lead Capture System Implementation Summary

## Correct Pricing Information (from Frontend)

**Starter Plan:**
- Price: £350/month
- Setup Fee: £1,000
- Included: 400 minutes/month
- Overage: £0.45/min
- Features: Google Calendar integration, Basic analytics, Email support

**Professional Plan:** (Most Popular)
- Price: £550/month
- Setup Fee: £3,000
- Included: 1,200 minutes/month
- Overage: £0.40/min
- Features: EHR system integration, Advanced analytics, Custom AI training, Priority support

**Enterprise Plan:**
- Price: £800/month
- Setup Fee: £7,000
- Included: 2,000 minutes/month
- Overage: £0.35/min
- Features: White-glove onboarding, Dedicated success manager, 24/7 phone support, SLA guarantees

## Contact Information

- **Phone**: +44 7424 038250 (24/7 for critical issues)
- **Calendly**: https://calendly.com/austyneguale/30min
- **Support Email**: support@voxanne.ai
- **Sales Email**: sales@voxanne.ai
- **Office**: Collage House, 2nd Floor, 17 King Edward Road, Ruislip, London HA4 7AE, United Kingdom

## API Keys (Already Provided)

- **Resend API**: `re_9V4LPZyw_K4WDg6topgmnnsGdtuQQ6FoE`
- **Groq API**: `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`

## Dependencies Already Installed

✅ `groq-sdk` (v0.9.1)
✅ `resend` (v6.6.0)
✅ `zod` (v4.1.13)

## Dependency to Add Manually

❌ `@react-email/components` - Install with: `npm install @react-email/components`

## Implementation Tasks

### Phase 1: Frontend Updates
1. ✅ Create constants file with Calendly URL
2. Update all 12+ Calendly links to new URL
3. Build AI chat widget component
4. Update contact form with backend integration
5. Verify phone number consistency

### Phase 2: Backend Implementation
1. Create Calendly webhook handler
2. Create contact form API route
3. Build enhanced email service with Resend SDK
4. Create email templates (React Email)
5. Implement lead qualification logic
6. Create chat widget API route (Groq integration)

### Phase 3: Database
1. Create `calendly_bookings` table
2. Create `contact_submissions` table
3. Create `chat_widget_leads` table (optional)
4. Apply all migrations

### Phase 4: Testing
1. Test all Calendly links redirect correctly
2. Test chat widget responses and design
3. Test contact form submission
4. Test email delivery (appointment, contact, hot lead)
5. End-to-end user journey testing

## Files That Need Calendly URL Update

1. `/src/components/Pricing.tsx` (line 110) - Currently: `callwaitingai/demo`
2. `/src/components/NavbarRedesigned.tsx` (lines 73, 125)
3. `/src/components/HowItWorks.tsx`
4. `/src/app/verify-email/page.tsx`
5. `/src/app/login/page.tsx`
6. `/src/app/api/chat/route.ts`
7. `/src/app/api/chat/route-enhanced.ts`
8. `/src/components/Hero.tsx` (legacy)
9. `/src/components/Navbar.tsx` (legacy)
10. `/src/components/CaseStudies.tsx`
11. `/src/components/HeroCalendlyReplica.tsx`
12. `/src/components/BookingModal.tsx`

## Chat Widget System Prompt (Corrected Pricing)

See plan file at `/Users/mac/.claude/plans/humble-dazzling-hanrahan.md` for full system prompt with correct UK pricing in GBP.

## Next Steps

1. Launch multiple specialized agents in parallel
2. Verify all implementations
3. Run comprehensive testing suite
4. Document deployment procedures
