# Priority 7: HIPAA Compliance (BAA + PHI Redaction) - Implementation Plan

**Status:** 🔄 In Progress
**Start Date:** 2026-01-28
**Priority Level:** 🔴 CRITICAL (Healthcare Clients)
**Estimated Completion:** 5-7 days

---

## Executive Summary

**Business Impact:** Unlocks $100K+ enterprise healthcare deals by ensuring legal compliance for organizations handling Protected Health Information (PHI). Without HIPAA compliance, healthcare organizations cannot legally use the platform.

**What HIPAA Compliance Requires:**
1. Business Associate Agreement (BAA) with all vendors handling PHI
2. PHI redaction in stored transcripts and logs
3. Data retention policies (GDPR/HIPAA alignment)
4. Audit logging for compliance verification
5. Documented compliance procedures

---

## Phase 1: Business Associate Agreement (BAA) - Day 1

### 1.1 Supabase Enterprise Plan & BAA

**Current Status:** Using Supabase Pro plan without BAA

**Action Items:**
1. **Upgrade to Supabase Enterprise**
   - Contact: support@supabase.com
   - Request: HIPAA-compliant tier + BAA
   - Cost: ~$599/month (vs current $25/month)
   - Timeline: 1-2 business days for approval

2. **BAA Review & Signing**
   - Legal review of Supabase BAA terms
   - Sign electronically via DocuSign
   - Store signed BAA in compliance folder
   - Add renewal date to calendar (typically annual)

3. **Enable HIPAA Features**
   - Database encryption at rest (already enabled)
   - Audit logging (already enabled via RLS)
   - Point-in-time recovery (PITR) for 30 days
   - IP allowlisting (optional, for extra security)

**Deliverables:**
- ✅ Supabase Enterprise account active
- ✅ Signed BAA on file
- ✅ HIPAA features enabled
- ✅ Compliance documentation updated

---

### 1.2 Other Vendor BAAs

**Vendors Handling PHI:**

| Vendor | PHI Exposure | BAA Required | Status |
|--------|--------------|--------------|--------|
| **Vapi (Voice)** | Call transcripts, audio recordings | ✅ Yes | ⏳ Contact needed |
| **Twilio (SMS)** | SMS message content | ✅ Yes | ⏳ Contact needed |
| **Supabase** | Database storage | ✅ Yes | ⏳ In progress |
| **Vercel (Hosting)** | No PHI (frontend only) | ❌ No | N/A |
| **Sentry (Monitoring)** | Error logs (may contain PHI) | ✅ Yes | ⏳ Enable scrubbing |

**Action Items:**
1. **Vapi BAA:**
   - Contact: enterprise@vapi.ai
   - Request: HIPAA-compliant plan + BAA
   - Verify: Audio recordings encrypted at rest, transcripts redacted

2. **Twilio BAA:**
   - Already available for Enterprise accounts
   - Request via support ticket
   - Cost: Included in enterprise pricing

3. **Sentry PHI Scrubbing:**
   - Enable PII scrubbing (already partially done)
   - Add custom scrubbing rules for PHI patterns
   - Test: Verify no SSN/PHI in error logs

**Deliverables:**
- ✅ All vendor BAAs signed
- ✅ Compliance matrix updated
- ✅ PHI exposure audit complete

---

## Phase 2: PHI Redaction Implementation - Days 2-3

### 2.1 Identify PHI in System

**PHI Categories (45 CFR 164.514):**

1. **Names** - Already collected (necessary for service)
2. **Geographic subdivisions** - ZIP codes (collected, not redacted)
3. **Dates** - Birth dates, appointment dates (collected, not redacted)
4. **Telephone numbers** - Stored (necessary for service)
5. **Email addresses** - Stored (necessary for service)
6. **Social Security Numbers** - ❌ Should NEVER be collected
7. **Medical Record Numbers** - ❌ Should NEVER be collected
8. **Health Plan Numbers** - ❌ Should NEVER be collected
9. **Account Numbers** - ❌ Should NEVER be collected
10. **Credit Card Numbers** - ⚠️ Risk in transcripts
11. **Diagnoses/Symptoms** - ⚠️ High risk in transcripts

**Data Flow Analysis:**

```
Incoming Call → Vapi Transcription → Webhook → Backend Storage
                                                    ↓
                                            call_logs.transcript
                                            call_logs.metadata
                                            messages.content
```

**PHI Storage Locations:**
- `call_logs.transcript` - Full conversation text (HIGH RISK)
- `call_logs.metadata` - JSON with caller details
- `messages.content` - SMS content (MEDIUM RISK)
- `contacts.notes` - Manual notes by staff (HIGH RISK)
- `appointments.notes` - Appointment details (MEDIUM RISK)

---

### 2.2 PHI Redaction Strategy

**Option 1: Google Cloud DLP API (Recommended)**

**Pros:**
- Industry-standard PHI detection (trained on medical data)
- Detects 150+ PHI/PII types automatically
- HIPAA-compliant itself
- Low latency (<100ms per transcript)

**Cons:**
- Cost: $1 per 1,000 API calls (~$100/month for 100K calls)
- External API dependency

**Implementation:**
```typescript
// backend/src/services/phi-redaction.ts
import { DlpServiceClient } from '@google-cloud/dlp';

const dlp = new DlpServiceClient({
  keyFilename: process.env.GOOGLE_DLP_KEY_PATH
});

export async function redactPHI(text: string): Promise<string> {
  const [response] = await dlp.deidentifyContent({
    parent: `projects/${process.env.GOOGLE_PROJECT_ID}/locations/global`,
    deidentifyConfig: {
      infoTypeTransformations: {
        transformations: [
          {
            primitiveTransformation: {
              replaceWithInfoTypeConfig: {}
            },
            infoTypes: [
              { name: 'PHONE_NUMBER' },
              { name: 'US_SOCIAL_SECURITY_NUMBER' },
              { name: 'CREDIT_CARD_NUMBER' },
              { name: 'EMAIL_ADDRESS' },
              { name: 'DATE_OF_BIRTH' },
              { name: 'MEDICAL_RECORD_NUMBER' },
              { name: 'US_HEALTHCARE_NPI' },
              { name: 'MEDICAL_TERM' }, // Diagnoses, symptoms
              { name: 'PERSON_NAME' } // Optional: redact all names
            ]
          }
        ]
      }
    },
    item: { value: text }
  });

  return response.item?.value || text;
}
```

**Option 2: Regex-Based Redaction (Fallback)**

**Pros:**
- No external dependency
- Zero cost
- Instant (<1ms)

**Cons:**
- Less accurate (false positives/negatives)
- Must maintain regex patterns manually
- Doesn't detect medical terms well

**Implementation:**
```typescript
// backend/src/services/phi-redaction-regex.ts

const PHI_PATTERNS = {
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  CREDIT_CARD: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  PHONE: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  DOB: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  ZIP: /\b\d{5}(-\d{4})?\b/g
};

export function redactPHIRegex(text: string): string {
  let redacted = text;

  redacted = redacted.replace(PHI_PATTERNS.SSN, '[SSN REDACTED]');
  redacted = redacted.replace(PHI_PATTERNS.CREDIT_CARD, '[CREDIT_CARD REDACTED]');
  redacted = redacted.replace(PHI_PATTERNS.PHONE, '[PHONE REDACTED]');
  redacted = redacted.replace(PHI_PATTERNS.EMAIL, '[EMAIL REDACTED]');
  redacted = redacted.replace(PHI_PATTERNS.DOB, '[DOB REDACTED]');

  // Medical terms (basic - not comprehensive)
  const medicalTerms = [
    'diabetes', 'cancer', 'hiv', 'aids', 'depression', 'anxiety',
    'heart disease', 'stroke', 'prescription', 'medication'
  ];

  medicalTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    redacted = redacted.replace(regex, '[MEDICAL_TERM_REDACTED]');
  });

  return redacted;
}
```

**Recommendation:** Use Google DLP API for production, regex as fallback if API fails.

---

### 2.3 Implement Redaction Pipeline

**Architecture:**

```
Webhook Receives Transcript
         ↓
   Redact PHI (async)
         ↓
    Store Redacted Version
         ↓
   Original Deleted (optional)
```

**Files to Create/Modify:**

1. **`backend/src/services/phi-redaction.ts`** (NEW)
   - Google DLP integration
   - Regex fallback
   - Caching layer (avoid re-redacting same text)

2. **`backend/src/routes/webhooks.ts`** (MODIFY)
   - Add PHI redaction before storing transcript
   - Log redaction success/failure

3. **`backend/src/middleware/phi-protection.ts`** (NEW)
   - Middleware to redact PHI in API responses
   - Protect against accidental PHI exposure in logs

**Implementation:**

```typescript
// backend/src/routes/webhooks.ts (webhook handler)
import { redactPHI } from '../services/phi-redaction';

app.post('/api/webhooks/vapi', async (req, res) => {
  const { transcript, ...rest } = req.body;

  // Redact PHI from transcript before storing
  const redactedTranscript = await redactPHI(transcript);

  await supabase.from('call_logs').insert({
    org_id,
    transcript: redactedTranscript,
    original_length: transcript.length,
    redacted_at: new Date().toISOString(),
    ...rest
  });

  res.status(200).send('OK');
});
```

**Deliverables:**
- ✅ PHI redaction service implemented
- ✅ Webhook pipeline updated
- ✅ Unit tests for redaction accuracy
- ✅ Performance benchmarks (<100ms per transcript)

---

## Phase 3: Data Retention Policies - Day 4

### 3.1 GDPR/HIPAA Data Retention

**Requirements:**
- **HIPAA:** Retain records for 6 years minimum
- **GDPR:** Delete upon request within 30 days
- **CCPA (California):** Right to deletion within 45 days

**Strategy:**
1. **Soft Delete** - Mark as deleted, actually delete after 30 days
2. **Hard Delete** - Irreversibly remove from database
3. **Anonymize** - Remove all identifiers, keep for analytics

**Implementation:**

```typescript
// backend/migrations/20260128_add_data_retention.sql
ALTER TABLE contacts ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE call_logs ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN deleted_at TIMESTAMPTZ;

-- Create deletion audit log
CREATE TABLE data_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id),
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reason TEXT
);
```

```typescript
// backend/src/jobs/gdpr-cleanup.ts
import { supabase } from '../services/supabase-client';

export async function scheduleGDPRCleanup() {
  // Run daily at 2 AM UTC
  cron.schedule('0 2 * * *', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Hard delete soft-deleted records older than 30 days
    const tables = ['contacts', 'call_logs', 'messages', 'appointments'];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .not('deleted_at', 'is', null)
        .lt('deleted_at', thirtyDaysAgo.toISOString());

      if (error) {
        log.error('GDPR Cleanup', `Failed to delete from ${table}`, { error });
      } else {
        log.info('GDPR Cleanup', `Deleted ${data?.length || 0} records from ${table}`);
      }
    }
  });
}
```

**Deliverables:**
- ✅ Soft delete columns added
- ✅ GDPR cleanup job scheduled
- ✅ Deletion audit log created
- ✅ User-facing deletion request endpoint

---

### 3.2 Compliance Dashboard

**Requirements:**
- View all data for a specific user/contact
- Export data (GDPR data portability)
- Request deletion (GDPR right to be forgotten)
- Audit log of all access/deletions

**Implementation:**

```typescript
// backend/src/routes/compliance.ts (NEW)
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const complianceRouter = Router();
complianceRouter.use(requireAuth);

/**
 * GET /api/compliance/data-export/:contactId
 * Export all data for a contact (GDPR data portability)
 */
complianceRouter.get('/data-export/:contactId', async (req, res) => {
  const { contactId } = req.params;
  const orgId = req.user.orgId;

  // Fetch all data for this contact
  const [contact, calls, messages, appointments] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', contactId).eq('org_id', orgId).single(),
    supabase.from('call_logs').select('*').eq('contact_id', contactId).eq('org_id', orgId),
    supabase.from('messages').select('*').eq('contact_id', contactId).eq('org_id', orgId),
    supabase.from('appointments').select('*').eq('contact_id', contactId).eq('org_id', orgId)
  ]);

  const exportData = {
    contact: contact.data,
    calls: calls.data,
    messages: messages.data,
    appointments: appointments.data,
    exported_at: new Date().toISOString()
  };

  res.json(exportData);
});

/**
 * POST /api/compliance/request-deletion/:contactId
 * Request deletion of all data for a contact (GDPR right to be forgotten)
 */
complianceRouter.post('/request-deletion/:contactId', async (req, res) => {
  const { contactId } = req.params;
  const orgId = req.user.orgId;
  const { reason } = req.body;

  // Soft delete all related data
  await Promise.all([
    supabase.from('contacts').update({ deleted_at: new Date().toISOString() }).eq('id', contactId).eq('org_id', orgId),
    supabase.from('call_logs').update({ deleted_at: new Date().toISOString() }).eq('contact_id', contactId).eq('org_id', orgId),
    supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('contact_id', contactId).eq('org_id', orgId),
    supabase.from('appointments').update({ deleted_at: new Date().toISOString() }).eq('contact_id', contactId).eq('org_id', orgId)
  ]);

  // Log deletion request
  await supabase.from('data_deletion_log').insert({
    entity_type: 'contact',
    entity_id: contactId,
    org_id: orgId,
    requested_by: req.user.id,
    reason
  });

  res.json({
    success: true,
    message: 'Data marked for deletion. Will be permanently deleted in 30 days.'
  });
});

export default complianceRouter;
```

**Deliverables:**
- ✅ Data export endpoint (/api/compliance/data-export/:contactId)
- ✅ Deletion request endpoint (/api/compliance/request-deletion/:contactId)
- ✅ Audit logging for all compliance actions
- ✅ Frontend compliance dashboard page

---

## Phase 4: Documentation & Procedures - Day 5

### 4.1 HIPAA Compliance Documentation

**Files to Create:**

1. **`HIPAA_COMPLIANCE.md`** - Main compliance document
   - BAA vendors list
   - PHI handling procedures
   - Data retention policies
   - Incident response plan
   - Training requirements

2. **`PRIVACY_POLICY.md`** - Public-facing privacy policy
   - What data is collected
   - How it's used
   - How it's protected
   - User rights (GDPR/CCPA)

3. **`DATA_BREACH_RESPONSE.md`** - Incident response runbook
   - Detection procedures
   - Notification timeline (72 hours for GDPR)
   - Remediation steps
   - Post-mortem template

**Deliverables:**
- ✅ HIPAA compliance documentation complete
- ✅ Privacy policy updated
- ✅ Breach response plan documented
- ✅ Staff training materials prepared

---

### 4.2 Compliance Checklist

**Pre-Launch Checklist:**

```markdown
# HIPAA Compliance Checklist

## Business Associate Agreements
- [ ] Supabase BAA signed
- [ ] Vapi BAA signed
- [ ] Twilio BAA signed
- [ ] Sentry PII scrubbing enabled

## Technical Safeguards
- [ ] PHI redaction implemented (Google DLP)
- [ ] Encryption at rest (Supabase)
- [ ] Encryption in transit (HTTPS/TLS)
- [ ] Access logging enabled (RLS audit)
- [ ] Automatic session timeout (30 min)
- [ ] MFA available for admins

## Administrative Safeguards
- [ ] Privacy policy published
- [ ] Staff training completed
- [ ] Incident response plan documented
- [ ] Data retention policy implemented
- [ ] Regular security audits scheduled

## Physical Safeguards
- [ ] N/A (cloud-hosted, vendor responsibility)

## Compliance Testing
- [ ] PHI redaction accuracy >99%
- [ ] Data export functionality tested
- [ ] Deletion request tested
- [ ] Audit logs verified
- [ ] Penetration testing completed
```

---

## Phase 5: Testing & Validation - Days 6-7

### 5.1 Automated Testing

**Create Test Suite:**

```typescript
// backend/src/__tests__/hipaa-compliance.test.ts
import { redactPHI } from '../services/phi-redaction';

describe('HIPAA Compliance - PHI Redaction', () => {
  it('should redact Social Security Numbers', async () => {
    const input = 'My SSN is 123-45-6789 and my phone is 555-1234.';
    const output = await redactPHI(input);
    expect(output).not.toContain('123-45-6789');
    expect(output).toContain('[SSN]');
  });

  it('should redact credit card numbers', async () => {
    const input = 'My card is 4532-1234-5678-9010';
    const output = await redactPHI(input);
    expect(output).not.toContain('4532-1234-5678-9010');
    expect(output).toContain('[CREDIT_CARD]');
  });

  it('should redact medical diagnoses', async () => {
    const input = 'Patient has diabetes and takes insulin.';
    const output = await redactPHI(input);
    expect(output).not.toContain('diabetes');
    expect(output).toContain('[MEDICAL_TERM]');
  });

  it('should handle false positives gracefully', async () => {
    const input = 'Call me at 9 AM tomorrow.';
    const output = await redactPHI(input);
    expect(output).toContain('9 AM'); // Should NOT redact "9 AM" as phone
  });
});
```

**Deliverables:**
- ✅ 50+ unit tests for PHI redaction
- ✅ Integration tests for data retention
- ✅ Manual QA checklist completed
- ✅ Performance benchmarks documented

---

### 5.2 Compliance Audit

**Third-Party Audit (Optional but Recommended):**
- Hire HIPAA compliance consultant ($2K-5K)
- Conduct security penetration testing
- Review all documentation
- Provide compliance certification

**Self-Audit Checklist:**
- Run automated test suite
- Manually test PHI redaction with real transcripts
- Verify BAAs signed with all vendors
- Test data export/deletion workflows
- Review audit logs for anomalies

**Deliverables:**
- ✅ Audit report completed
- ✅ Compliance gaps identified and fixed
- ✅ Certification obtained (if using third-party)
- ✅ Final sign-off from legal team

---

## Cost Breakdown

| Item | Cost | Frequency |
|------|------|-----------|
| Supabase Enterprise Plan | $599/month | Monthly |
| Google Cloud DLP API | $100/month | Monthly (100K transcripts) |
| Vapi Enterprise (with BAA) | $500/month | Monthly (estimated) |
| Twilio Enterprise BAA | $0 (included) | N/A |
| Third-Party Compliance Audit | $3,000 | One-time |
| Legal Review | $1,500 | One-time |
| **Total One-Time** | **$4,500** | - |
| **Total Recurring** | **$1,199/month** | Monthly |

**ROI Analysis:**
- Cost: $1,199/month
- Unlock: $100K+ healthcare enterprise deals
- Break-even: 1.2% of single enterprise contract
- **Conclusion:** Mandatory investment for healthcare market

---

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1. BAA Signing | 1 day | All vendor BAAs signed |
| 2. PHI Redaction | 2 days | Redaction pipeline implemented |
| 3. Data Retention | 1 day | GDPR cleanup + compliance API |
| 4. Documentation | 1 day | HIPAA docs + policies |
| 5. Testing | 2 days | Automated tests + audit |
| **Total** | **7 days** | **HIPAA-compliant platform** |

---

## Success Criteria

- ✅ All vendor BAAs signed and on file
- ✅ PHI redaction accuracy >99% (verified via test suite)
- ✅ Data retention policies implemented and tested
- ✅ Compliance documentation complete
- ✅ Zero PHI exposure in error logs/monitoring
- ✅ Audit log covers all PHI access/modifications
- ✅ Legal team sign-off obtained
- ✅ Healthcare customers can legally use platform

---

## Next Steps (After Priority 7)

Once HIPAA compliance is complete:
1. **Priority 8:** Disaster Recovery & Backup Verification
2. **Priority 9:** Developer Operations (CI/CD, Feature Flags)
3. **Priority 10:** Advanced Authentication (MFA, SSO)

---

**Start Implementation:** Ready to begin Priority 7 Phase 1 (BAA Signing)
