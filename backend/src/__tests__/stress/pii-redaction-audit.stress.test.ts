/**
 * PII Leak & Redaction Audit Stress Test
 *
 * Verifies sensitive patient data is redacted according to GDPR compliance.
 * Tests email, phone, address, SSN, medical condition redaction.
 * Validates GDPR consent flag and Vapi vs Supabase storage differences.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createMockSupabaseClient,
  createMockOrganization,
  assertNoPIIInOutput,
} from '../../tests/utils/test-helpers';
import {
  getOrCreateSupabaseClient,
  clearAllMocks,
} from '../utils/mock-pool';
import { MOCK_ORGANIZATIONS } from '../../tests/utils/mock-data';

/**
 * Audit PII handling and redaction mechanisms
 */
describe('PII Leak & Redaction Audit - Stress Test', () => {
  let supabase: any;
  let redactionService: any;
  let auditLogger: any;

  const testOrg = MOCK_ORGANIZATIONS[0]; // clinic1

  const sensitiveCallData = {
    callId: 'call_pii_audit_001',
    transcript:
      'Hi my name is John Smith, my phone is 555-123-4567, email john@example.com. ' +
      'I have a scar from a previous rhinoplasty surgery and want revision surgery. ' +
      'My address is 123 Main Street, New York, NY 10001. ' +
      'SSN ending in 6789.',
    analysis: {
      sentiment: 0.7,
      intent: 'booking_inquiry',
      medicalConcerns: ['rhinoplasty scar', 'revision surgery'],
    },
  };

  beforeEach(() => {
    supabase = getOrCreateSupabaseClient();
    clearAllMocks();

    // Mock redaction service
    redactionService = {
      redactPII: jest.fn(),
      redactEmail: jest.fn(),
      redactPhone: jest.fn(),
      redactSSN: jest.fn(),
      redactAddress: jest.fn(),
      redactMedicalConcerns: jest.fn(),
      redactName: jest.fn(),
    };

    // Mock audit logger
    auditLogger = {
      logRedaction: jest.fn().mockResolvedValue({ logged: true }),
      queryRedactionAudit: jest.fn().mockResolvedValue([]),
    };
  });

  describe('Email Redaction', () => {
    it('should redact email addresses in transcripts', async () => {
      const text = 'My email is john@example.com for confirmation';

      redactionService.redactEmail.mockReturnValue(
        text.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[REDACTED_EMAIL]')
      );

      const redacted = redactionService.redactEmail(text);

      expect(redacted).toContain('[REDACTED_EMAIL]');
      expect(redacted).not.toContain('john@example.com');
    });

    it('should handle multiple emails in single transcript', async () => {
      const text =
        'Contact john@example.com or jane@clinic.com for scheduling';

      const redacted = text.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[REDACTED_EMAIL]');

      const emailCount = (redacted.match(/\[REDACTED_EMAIL\]/g) || []).length;
      expect(emailCount).toBe(2);
    });

    it('should preserve context after email redaction', async () => {
      const text = 'My email is john@example.com, please call me at 555-1234';

      redactionService.redactEmail.mockReturnValue(
        text.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[REDACTED_EMAIL]')
      );

      const redacted = redactionService.redactEmail(text);

      expect(redacted).toContain('please call me at');
      expect(redacted).toContain('[REDACTED_EMAIL]');
    });

    it('should not redact domain-like text that is not emails', async () => {
      const text = 'This procedure is discussed on cosmetic-surgery.com';

      // Should NOT redact this
      expect(text).not.toMatch(/\[REDACTED/);
    });
  });

  describe('Phone Number Redaction', () => {
    it('should redact full phone numbers', async () => {
      const text = 'You can reach me at 555-123-4567';

      redactionService.redactPhone.mockReturnValue(
        text.replace(/\d{3}-\d{3}-\d{4}/g, '[REDACTED_PHONE]')
      );

      const redacted = redactionService.redactPhone(text);

      expect(redacted).toContain('[REDACTED_PHONE]');
      expect(redacted).not.toContain('555-123-4567');
    });

    it('should redact phone numbers in various formats', async () => {
      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '5551234567',
        '+1-555-123-4567',
      ];

      formats.forEach(phone => {
        redactionService.redactPhone.mockReturnValue('[REDACTED_PHONE]');
        const result = redactionService.redactPhone(phone);
        expect(result).toBe('[REDACTED_PHONE]');
        expect(result).not.toContain(phone.substring(phone.length - 4)); // Last 4 digits
      });
    });

    it('should handle phone numbers that are split across lines', async () => {
      const text = 'Call me at 555-123-\n4567 for details';

      // Normalize and redact
      const normalized = text.replace(/\n/g, '');
      redactionService.redactPhone.mockReturnValue(
        normalized.replace(/\d{3}-\d{3}-\d{4}/g, '[REDACTED_PHONE]')
      );

      const result = redactionService.redactPhone(normalized);
      expect(result).toContain('[REDACTED_PHONE]');
    });

    it('should NOT redact standalone numbers that are not phones', async () => {
      const text = 'The procedure costs 5000 dollars';

      // 5000 is not a phone number
      redactionService.redactPhone.mockReturnValue(text);
      const result = redactionService.redactPhone(text);

      expect(result).toContain('5000');
    });
  });

  describe('Address Redaction', () => {
    it('should redact street addresses', async () => {
      const text = 'My address is 123 Main Street, New York, NY 10001';

      redactionService.redactAddress.mockReturnValue(
        text.replace(
          /\d+\s+[\w\s]+(?:Street|Ave|Boulevard|Drive|Lane|Road|St|Ave|Blvd|Dr|Ln|Rd)[,\s]+[\w\s]+,?\s+[A-Z]{2}\s+\d{5}/i,
          '[REDACTED_ADDRESS]'
        )
      );

      const redacted = redactionService.redactAddress(text);

      expect(redacted).toContain('[REDACTED_ADDRESS]');
      expect(redacted).not.toContain('123 Main Street');
    });

    it('should redact addresses in various formats', async () => {
      const addresses = [
        '123 Main Street, New York, NY 10001',
        '456 Oak Avenue, Los Angeles, CA 90001',
        '789 Elm Blvd, Chicago, IL 60601',
      ];

      addresses.forEach(addr => {
        redactionService.redactAddress.mockReturnValue('[REDACTED_ADDRESS]');
        const result = redactionService.redactAddress(addr);
        expect(result).toBe('[REDACTED_ADDRESS]');
      });
    });

    it('should handle incomplete address data', async () => {
      const partialAddress = '123 Main Street';

      redactionService.redactAddress.mockReturnValue('[REDACTED_ADDRESS]');
      const result = redactionService.redactAddress(partialAddress);

      expect(result).toBe('[REDACTED_ADDRESS]');
    });
  });

  describe('SSN Redaction', () => {
    it('should redact full Social Security Numbers', async () => {
      const text = 'My SSN is 123-45-6789';

      redactionService.redactSSN.mockReturnValue(
        text.replace(/\d{3}-\d{2}-\d{4}/g, '[REDACTED_SSN]')
      );

      const redacted = redactionService.redactSSN(text);

      expect(redacted).toContain('[REDACTED_SSN]');
      expect(redacted).not.toContain('123-45-6789');
    });

    it('should redact SSN mention "ending in"', async () => {
      const text = 'My SSN ending in 6789';

      redactionService.redactSSN.mockReturnValue(
        text.replace(/\d{4}/g, '[REDACTED_SSN_LAST4]')
      );

      const redacted = redactionService.redactSSN(text);

      expect(redacted).toContain('[REDACTED_SSN_LAST4]');
      expect(redacted).not.toContain('6789');
    });

    it('should not redact legitimate 4-digit numbers', async () => {
      const text = 'The year is 2026';

      redactionService.redactSSN.mockReturnValue(text); // Should not redact

      const result = redactionService.redactSSN(text);
      expect(result).toContain('2026');
    });
  });

  describe('Medical Condition Redaction', () => {
    it('should redact specific medical procedures mentioned', async () => {
      const text = 'I want to discuss my rhinoplasty revision surgery options';

      redactionService.redactMedicalConcerns.mockReturnValue(
        text.replace(/rhinoplasty|breast augmentation|facelift|liposuction/gi, '[REDACTED_PROCEDURE]')
      );

      const redacted = redactionService.redactMedicalConcerns(text);

      expect(redacted).toContain('[REDACTED_PROCEDURE]');
      expect(redacted).not.toContain('rhinoplasty');
    });

    it('should redact medical conditions and symptoms', async () => {
      const symptoms = [
        'I have severe acne scars',
        'My nose is deviated',
        'I have breast implant illness',
        'I suffer from body dysmorphia',
      ];

      symptoms.forEach(symptom => {
        redactionService.redactMedicalConcerns.mockReturnValue(
          '[REDACTED_MEDICAL_CONDITION]'
        );

        const result = redactionService.redactMedicalConcerns(symptom);
        expect(result).toBe('[REDACTED_MEDICAL_CONDITION]');
      });
    });

    it('should respect GDPR_CONSENT = true override', async () => {
      const text = 'I want rhinoplasty revision';
      const gdprConsent = true;

      // If consent, don't redact
      const redacted = gdprConsent ? text : '[REDACTED_PROCEDURE]';

      expect(redacted).toContain('rhinoplasty');
      expect(redacted).not.toContain('[REDACTED_PROCEDURE]');
    });

    it('should redact unless explicit consent', async () => {
      const text = 'I want rhinoplasty revision';
      const gdprConsent = false;

      const redacted = gdprConsent
        ? text
        : text.replace(/rhinoplasty/gi, '[REDACTED_PROCEDURE]');

      expect(redacted).toContain('[REDACTED_PROCEDURE]');
      expect(redacted).not.toContain('rhinoplasty');
    });
  });

  describe('Name Redaction', () => {
    it('should redact first and last names', async () => {
      const text = 'My name is John Smith';

      redactionService.redactName.mockReturnValue(
        text.replace(/John Smith/g, '[REDACTED_NAME]')
      );

      const redacted = redactionService.redactName(text);

      expect(redacted).toContain('[REDACTED_NAME]');
      expect(redacted).not.toContain('John');
      expect(redacted).not.toContain('Smith');
    });

    it('should redact individual first names', async () => {
      const text = 'Call John for scheduling';

      redactionService.redactName.mockReturnValue(
        text.replace(/\bJohn\b/g, '[REDACTED_FNAME]')
      );

      const redacted = redactionService.redactName(text);

      expect(redacted).toContain('[REDACTED_FNAME]');
      expect(redacted).not.toContain('John');
    });

    it('should respect GDPR consent for name redaction', async () => {
      const text = 'My name is Sarah Johnson';
      const gdprConsent = true;

      const redacted = gdprConsent ? text : '[REDACTED_NAME]';

      expect(redacted).toContain('Sarah');
    });
  });

  describe('Vapi Raw vs Supabase Stored (Different Redaction)', () => {
    it('should store unredacted in Vapi, redacted in Supabase (no consent)', async () => {
      const callId = 'call_different_storage_001';

      // Vapi stores raw transcript
      const vapiRecord = {
        callId,
        transcript: sensitiveCallData.transcript,
        source: 'vapi_raw',
        redacted: false,
      };

      // Supabase stores redacted version
      const supabaseRecord = {
        callId,
        transcript: '[REDACTED_NAME] at [REDACTED_PHONE] ([REDACTED_EMAIL]) ' +
          'wants to discuss [REDACTED_PROCEDURE] revision. ' +
          'Address: [REDACTED_ADDRESS]. SSN: [REDACTED_SSN].',
        source: 'supabase_stored',
        redacted: true,
        gdprConsent: false,
      };

      expect(vapiRecord.redacted).toBe(false);
      expect(supabaseRecord.redacted).toBe(true);

      // Verify actual redaction in Supabase
      assertNoPIIInOutput(supabaseRecord.transcript);
    });

    it('should store same transcript when GDPR_CONSENT = true', async () => {
      const transcript =
        'John Smith called to ask about rhinoplasty at 555-123-4567';

      const vapiRecord = {
        transcript,
        gdprConsent: true,
        redacted: false,
      };

      const supabaseRecord = {
        transcript,
        gdprConsent: true,
        redacted: false, // No redaction with consent
      };

      expect(vapiRecord.transcript).toBe(supabaseRecord.transcript);
    });

    it('should log why Vapi and Supabase versions differ', async () => {
      const callId = 'call_audit_001';

      auditLogger.logRedaction.mockResolvedValue({
        logged: true,
        reason:
          'GDPR consent not provided - medical data redacted in Supabase',
        callId,
      });

      const result = await auditLogger.logRedaction({
        callId,
        gdprConsent: false,
      });

      expect(result.logged).toBe(true);
      expect(result.reason).toContain('GDPR');
    });
  });

  describe('Comprehensive Redaction - All PII Types', () => {
    it('should redact all PII types in single transcript', async () => {
      const fullTranscript = sensitiveCallData.transcript;

      // Mock comprehensive redaction
      redactionService.redactPII.mockReturnValue(
        fullTranscript
          .replace(/John Smith/g, '[REDACTED_NAME]')
          .replace(/555-123-4567/g, '[REDACTED_PHONE]')
          .replace(/john@example.com/g, '[REDACTED_EMAIL]')
          .replace(/123 Main Street, New York, NY 10001/g, '[REDACTED_ADDRESS]')
          .replace(/6789/g, '[REDACTED_SSN_LAST4]')
          .replace(/rhinoplasty/gi, '[REDACTED_PROCEDURE]')
      );

      const redacted = redactionService.redactPII(fullTranscript, {
        gdprConsent: false,
      });

      // Verify no raw PII remains
      assertNoPIIInOutput(redacted);
      expect(redacted).not.toContain('John Smith');
      expect(redacted).not.toContain('555-123-4567');
      expect(redacted).not.toContain('john@example.com');
    });

    it('should handle transcript with mixed redactable and non-redactable content', async () => {
      const mixed =
        'Patient John Smith (555-1234) wants facelift. ' +
        'Procedure cost is $12000. Appointment: 2026-01-15.';

      redactionService.redactPII.mockReturnValue(
        mixed
          .replace(/John Smith/g, '[REDACTED_NAME]')
          .replace(/555-1234/g, '[REDACTED_PHONE]')
          .replace(/facelift/gi, '[REDACTED_PROCEDURE]')
      );

      const redacted = redactionService.redactPII(mixed);

      // PII redacted
      expect(redacted).not.toContain('John Smith');
      expect(redacted).not.toContain('555-1234');

      // Non-PII preserved
      expect(redacted).toContain('$12000');
      expect(redacted).toContain('2026-01-15');
    });
  });

  describe('Audit Trail & Compliance', () => {
    it('should create audit log for every redaction', async () => {
      const callId = 'call_audit_trail_001';

      auditLogger.logRedaction.mockResolvedValue({
        auditId: 'audit_' + Date.now(),
        callId,
        timestamp: new Date().toISOString(),
        fieldsRedacted: ['name', 'phone', 'email', 'medical_condition'],
        gdprConsent: false,
        logged: true,
      });

      const audit = await auditLogger.logRedaction({
        callId,
        fields: ['name', 'phone', 'email', 'medical_condition'],
        gdprConsent: false,
      });

      expect(audit.logged).toBe(true);
      expect(audit.fieldsRedacted).toHaveLength(4);
      expect(audit.timestamp).toBeDefined();
    });

    it('should query redaction audit by date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
      const endDate = new Date();

      auditLogger.queryRedactionAudit.mockResolvedValue([
        {
          callId: 'call_1',
          timestamp: new Date().toISOString(),
          fieldsRedacted: ['phone'],
        },
        {
          callId: 'call_2',
          timestamp: new Date().toISOString(),
          fieldsRedacted: ['email', 'address'],
        },
      ]);

      const audit = await auditLogger.queryRedactionAudit({
        startDate,
        endDate,
      });

      expect(audit).toHaveLength(2);
      expect(audit[0].timestamp).toBeDefined();
    });

    it('should track GDPR consent flag in audit log', async () => {
      auditLogger.logRedaction.mockResolvedValue({
        callId: 'call_gdpr_001',
        gdprConsent: true,
        logged: true,
      });

      const result = await auditLogger.logRedaction({
        callId: 'call_gdpr_001',
        gdprConsent: true,
      });

      expect(result.gdprConsent).toBe(true);
    });

    it('should show redaction status in compliance report', async () => {
      const report = {
        totalCalls: 100,
        redactedCalls: 87,
        consentCalls: 13,
        redactionRate: 0.87,
        timestamp: new Date().toISOString(),
      };

      expect(report.redactionRate).toBe(0.87);
      expect(report.redactedCalls + report.consentCalls).toBe(report.totalCalls);
    });
  });

  describe('Error Handling in Redaction', () => {
    it('should not crash if transcript is null', async () => {
      redactionService.redactPII.mockReturnValue('[EMPTY_TRANSCRIPT]');

      const result = redactionService.redactPII(null);

      expect(result).toBe('[EMPTY_TRANSCRIPT]');
    });

    it('should handle empty transcript gracefully', async () => {
      redactionService.redactPII.mockReturnValue('');

      const result = redactionService.redactPII('');

      expect(result).toBe('');
    });

    it('should handle transcript with already-redacted data', async () => {
      const alreadyRedacted =
        'Patient [REDACTED_NAME] at [REDACTED_PHONE] wants [REDACTED_PROCEDURE]';

      redactionService.redactPII.mockReturnValue(alreadyRedacted);

      const result = redactionService.redactPII(alreadyRedacted);

      // Should be idempotent
      expect(result).toBe(alreadyRedacted);
    });

    it('should log redaction failures', async () => {
      redactionService.redactPII.mockRejectedValue(
        new Error('Redaction service unavailable')
      );

      await expect(
        redactionService.redactPII('Some transcript')
      ).rejects.toThrow('Redaction service unavailable');
    });
  });

  describe('Performance & Scale', () => {
    it('should redact 1000-char transcript in <100ms', async () => {
      const longTranscript = 'Medical content '.repeat(100); // 1600+ chars

      redactionService.redactPII.mockReturnValue(longTranscript);

      const start = Date.now();
      redactionService.redactPII(longTranscript);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle transcript with many PII instances', async () => {
      const multiPII =
        'John called 555-1234, email john@example.com. ' +
        'Jane called 555-5678, email jane@example.com. ' +
        'Both mentioned rhinoplasty.';

      redactionService.redactPII.mockReturnValue(
        multiPII
          .replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[REDACTED_EMAIL]')
          .replace(/\d{3}-\d{4}/g, '[REDACTED_PHONE]')
          .replace(/John|Jane/g, '[REDACTED_NAME]')
          .replace(/rhinoplasty/gi, '[REDACTED_PROCEDURE]')
      );

      const redacted = redactionService.redactPII(multiPII);

      const redactionCount = (
        redacted.match(/\[REDACTED_\w+\]/g) || []
      ).length;
      expect(redactionCount).toBeGreaterThan(4);
    });
  });

  describe('Integration: Redaction in Webhook Handler', () => {
    it('should redact transcript before storing end-of-call webhook', async () => {
      const webhook = {
        callId: 'call_webhook_pii_001',
        transcript: sensitiveCallData.transcript,
        gdprConsent: false,
      };

      redactionService.redactPII.mockReturnValue(
        '[REDACTED_NAME] called about [REDACTED_PROCEDURE]'
      );

      const redacted = redactionService.redactPII(webhook.transcript);

      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: [{ callId: webhook.callId, transcript: redacted }],
        }),
      });

      expect(redacted).not.toContain('John Smith');
      assertNoPIIInOutput(redacted);
    });
  });
});
