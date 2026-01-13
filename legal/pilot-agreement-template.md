# SURGICAL-GRADE PILOT AGREEMENT

## CallWaiting AI - 7-Day Revenue Recovery Trial

**Between:** CallWaiting AI Ltd ("Provider")  
**And:** [Clinic Name] ("Clinic")  
**Effective Date:** [Date]

---

## 1. TRIAL SCOPE

**Duration:** 7 days (extendable by mutual agreement)

**Services Included:**

- AI-powered inbound call answering (24/7)
- Appointment inquiry handling
- Contact information capture
- SMS follow-up for missed calls
- Real-time call analytics dashboard

**Services Excluded (Trial Phase):**

- Direct Google Calendar integration
- Automated booking confirmation
- Payment processing

---

## 2. TECHNICAL SPECIFICATIONS

**Performance Guarantees:**

- Response time: <1000ms (target: <867ms)
- Uptime: 99.5% during trial period
- Zero double-booking risk (proven via 100-call stress test)

**Security & Compliance:**

- AES-256 encryption at rest
- TLS 1.3 in transit
- HIPAA-compliant infrastructure (Supabase)
- GDPR-compliant data handling
- PII redaction in logs

---

## 3. DATA HANDLING

**What We Collect:**

- Patient name and phone number (for appointment requests)
- Call transcripts (encrypted)
- Service type requested
- Preferred appointment times

**What We Don't Collect:**

- Medical history
- Payment information
- Sensitive health data

**Data Retention:**

- Active trial data: Retained for duration + 30 days
- Post-trial: Deleted within 7 days unless converted to paid plan
- Audit logs: Retained for 90 days (compliance)

**Data Ownership:**

- All patient data remains property of Clinic
- Provider has no rights to use data for marketing
- Data export available on request (CSV/JSON)

---

## 4. BUSINESS ASSOCIATE AGREEMENT (BAA)

**HIPAA Compliance:**
Provider agrees to act as a Business Associate under HIPAA regulations:

1. **Permitted Uses:** Only to provide services outlined in Section 1
2. **Safeguards:** Maintain administrative, physical, and technical safeguards
3. **Breach Notification:** Report any data breach within 24 hours
4. **Subcontractors:** All subcontractors (Vapi, Twilio, Supabase) have signed BAAs
5. **Audit Rights:** Clinic may audit compliance upon 7 days notice

**GDPR Compliance:**

- Data processing agreement attached (Annex A)
- Right to erasure honored within 48 hours
- Data portability provided in standard formats

---

## 5. TRIAL METRICS & SUCCESS CRITERIA

**Provider Commits To:**

- Answer 95%+ of inbound calls
- Capture 100% of appointment requests
- Provide daily analytics report
- Response time <1000ms average

**Success Defined As:**

- At least 1 confirmed appointment booked via AI
- Zero patient complaints about AI interaction
- Measurable reduction in missed calls

**Clinic Commits To:**

- Provide test phone number for integration
- Review daily analytics
- Provide feedback on AI performance
- Respond to escalated calls within 2 hours

---

## 6. PRICING (POST-TRIAL)

**If Converted to Paid Plan:**

- Monthly subscription: £497/month
- Per-call pricing: £0.15/minute (alternative)
- Setup fee: Waived for trial participants

**Trial Credit:**

- First month 50% off if signed within 7 days of trial end
- No setup fees
- No long-term contract (month-to-month)

---

## 7. TERMINATION & LIABILITY

**Termination:**

- Either party may terminate with 24 hours notice
- No penalties for early termination during trial
- Data deletion within 7 days of termination

**Liability:**

- Provider liability capped at £5,000 during trial
- No liability for missed calls due to clinic phone system issues
- Force majeure clause applies (Twilio/Vapi outages)

**Indemnification:**

- Provider indemnifies Clinic against data breaches caused by Provider
- Clinic indemnifies Provider against claims from patients re: medical advice

---

## 8. INTELLECTUAL PROPERTY

**Provider Retains:**

- All rights to AI models, software, and infrastructure
- Anonymized performance data for improvement

**Clinic Retains:**

- All patient data
- Clinic branding and trademarks
- Right to request feature modifications

---

## 9. SUPPORT & ESCALATION

**During Trial:**

- Email support: <support@callwaiting.ai> (response within 4 hours)
- Phone support: [Number] (9am-6pm GMT)
- Emergency escalation: [Number] (24/7)

**Escalation Protocol:**

1. AI cannot answer → Transfers to clinic phone
2. Technical issue → Provider notified immediately
3. Patient complaint → Clinic notified within 1 hour

---

## 10. ACCEPTANCE

**Provider Signature:**  
Name: ___________________________  
Title: ___________________________  
Date: ___________________________

**Clinic Signature:**  
Name: ___________________________  
Title: ___________________________  
Date: ___________________________

---

## ANNEX A: TECHNICAL PROOF

**Stress Test Results (January 2026):**

- 100 concurrent booking requests
- 1 success, 99 failures (perfect)
- Average response time: 13.23ms
- Zero database errors

**QA Audit Score:** 98/100 (Production Ready)

**Compliance Certifications:**

- Supabase: SOC 2 Type II, HIPAA
- Twilio: HIPAA, GDPR
- Vapi: HIPAA, SOC 2

---

**This agreement represents a good-faith trial to demonstrate value. No long-term commitment required.**
