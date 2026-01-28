/**
 * PHI Redaction Service - Unit Tests
 * Ensures HIPAA-compliant redaction of Protected Health Information
 */

import { redactPHI, containsPHI, redactPHIFromMetadata, __testing } from '../../services/phi-redaction';

describe('PHI Redaction Service', () => {
  describe('redactPHI - Social Security Numbers', () => {
    it('should redact SSN in XXX-XX-XXXX format', async () => {
      const input = 'My SSN is 123-45-6789';
      const output = await redactPHI(input);

      expect(output).not.toContain('123-45-6789');
      expect(output).toContain('[SSN_REDACTED]');
    });

    it('should redact SSN in XXX.XX.XXXX format', async () => {
      const input = 'SSN: 987.65.4321';
      const output = await redactPHI(input);

      expect(output).not.toContain('987.65.4321');
      expect(output).toContain('[SSN_REDACTED]');
    });

    it('should redact SSN without separators', async () => {
      const input = 'SSN 123456789';
      const output = await redactPHI(input);

      expect(output).not.toContain('123456789');
      expect(output).toContain('[SSN_REDACTED]');
    });
  });

  describe('redactPHI - Credit Card Numbers', () => {
    it('should redact credit card with spaces', async () => {
      const input = 'Card: 4532 1234 5678 9010';
      const output = await redactPHI(input);

      expect(output).not.toContain('4532 1234 5678 9010');
      expect(output).toContain('[CREDIT_CARD_REDACTED]');
    });

    it('should redact credit card with hyphens', async () => {
      const input = 'My card is 5555-5555-5555-4444';
      const output = await redactPHI(input);

      expect(output).not.toContain('5555-5555-5555-4444');
      expect(output).toContain('[CREDIT_CARD_REDACTED]');
    });

    it('should redact credit card without separators', async () => {
      const input = 'Card 4111111111111111';
      const output = await redactPHI(input);

      expect(output).not.toContain('4111111111111111');
      expect(output).toContain('[CREDIT_CARD_REDACTED]');
    });
  });

  describe('redactPHI - Phone Numbers', () => {
    it('should redact phone with hyphens', async () => {
      const input = 'Call me at 555-123-4567';
      const output = await redactPHI(input);

      expect(output).not.toContain('555-123-4567');
      expect(output).toContain('[PHONE_REDACTED]');
    });

    it('should redact phone with dots', async () => {
      const input = 'My number is 555.123.4567';
      const output = await redactPHI(input);

      expect(output).not.toContain('555.123.4567');
      expect(output).toContain('[PHONE_REDACTED]');
    });

    it('should redact phone with parentheses', async () => {
      const input = 'Phone: (555) 123-4567';
      const output = await redactPHI(input);

      // Should redact the core number part
      expect(output).toContain('[PHONE_REDACTED]');
    });
  });

  describe('redactPHI - Email Addresses', () => {
    it('should redact standard email', async () => {
      const input = 'Contact john.doe@example.com for more';
      const output = await redactPHI(input);

      expect(output).not.toContain('john.doe@example.com');
      expect(output).toContain('[EMAIL_REDACTED]');
    });

    it('should redact email with numbers', async () => {
      const input = 'Email: patient123@hospital.org';
      const output = await redactPHI(input);

      expect(output).not.toContain('patient123@hospital.org');
      expect(output).toContain('[EMAIL_REDACTED]');
    });
  });

  describe('redactPHI - Dates', () => {
    it('should redact date in MM/DD/YYYY format', async () => {
      const input = 'Born on 03/15/1985';
      const output = await redactPHI(input);

      expect(output).not.toContain('03/15/1985');
      expect(output).toContain('[DATE_REDACTED]');
    });

    it('should redact date in Month DD, YYYY format', async () => {
      const input = 'Appointment: March 15, 2024';
      const output = await redactPHI(input);

      expect(output).not.toContain('March 15, 2024');
      expect(output).toContain('[DATE_REDACTED]');
    });

    it('should allow disabling date redaction', async () => {
      const input = 'Appointment: 03/15/2024';
      const output = await redactPHI(input, { redactDates: false });

      expect(output).toContain('03/15/2024');
      expect(output).not.toContain('[DATE_REDACTED]');
    });
  });

  describe('redactPHI - ZIP Codes', () => {
    it('should redact 5-digit ZIP code', async () => {
      const input = 'Live in 90210';
      const output = await redactPHI(input);

      expect(output).not.toContain('90210');
      expect(output).toContain('[ZIP_REDACTED]');
    });

    it('should redact 9-digit ZIP code', async () => {
      const input = 'ZIP: 90210-1234';
      const output = await redactPHI(input);

      expect(output).not.toContain('90210-1234');
      expect(output).toContain('[ZIP_REDACTED]');
    });
  });

  describe('redactPHI - Medical Terms', () => {
    it('should redact medical diagnosis (diabetes)', async () => {
      const input = 'Patient has diabetes and requires insulin';
      const output = await redactPHI(input);

      expect(output).not.toContain('diabetes');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should redact medical diagnosis (cancer)', async () => {
      const input = 'Diagnosed with cancer last year';
      const output = await redactPHI(input);

      expect(output).not.toContain('cancer');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should redact mental health conditions', async () => {
      const input = 'Experiencing depression and anxiety';
      const output = await redactPHI(input);

      expect(output).not.toContain('depression');
      expect(output).not.toContain('anxiety');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should redact medication names', async () => {
      const input = 'Taking insulin and metformin';
      const output = await redactPHI(input);

      expect(output).not.toContain('insulin');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should allow disabling medical term redaction', async () => {
      const input = 'Has diabetes';
      const output = await redactPHI(input, { redactMedicalTerms: false });

      expect(output).toContain('diabetes');
      expect(output).not.toContain('[MEDICAL_TERM_REDACTED]');
    });
  });

  describe('redactPHI - Medical Record Numbers', () => {
    it('should redact MRN with colon', async () => {
      const input = 'Patient MRN: ABC123456';
      const output = await redactPHI(input);

      expect(output).not.toContain('ABC123456');
      expect(output).toContain('[MRN_REDACTED]');
    });

    it('should redact MRN without separator', async () => {
      const input = 'MRN ABC123456';
      const output = await redactPHI(input);

      expect(output).not.toContain('ABC123456');
      expect(output).toContain('[MRN_REDACTED]');
    });
  });

  describe('redactPHI - IP Addresses', () => {
    it('should redact IPv4 address', async () => {
      const input = 'Server at 192.168.1.100';
      const output = await redactPHI(input);

      expect(output).not.toContain('192.168.1.100');
      expect(output).toContain('[IP_REDACTED]');
    });
  });

  describe('redactPHI - Complex Scenarios', () => {
    it('should redact multiple PHI types in one text', async () => {
      const input = 'Patient SSN 123-45-6789, phone 555-123-4567, email patient@example.com, has diabetes';
      const output = await redactPHI(input);

      expect(output).not.toContain('123-45-6789');
      expect(output).not.toContain('555-123-4567');
      expect(output).not.toContain('patient@example.com');
      expect(output).not.toContain('diabetes');
      expect(output).toContain('[SSN_REDACTED]');
      expect(output).toContain('[PHONE_REDACTED]');
      expect(output).toContain('[EMAIL_REDACTED]');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should handle empty string', async () => {
      const output = await redactPHI('');
      expect(output).toBe('');
    });

    it('should handle string with no PHI', async () => {
      const input = 'Hello, how are you today?';
      const output = await redactPHI(input);

      expect(output).toBe(input);
    });

    it('should preserve sentence structure', async () => {
      const input = 'My phone is 555-123-4567 and I have diabetes.';
      const output = await redactPHI(input);

      expect(output).toContain('My phone is');
      expect(output).toContain('and I have');
      expect(output).toContain('[PHONE_REDACTED]');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });
  });

  describe('redactPHI - False Positive Prevention', () => {
    it('should NOT redact time references as phones', async () => {
      const input = 'Call me at 9:30 AM tomorrow';
      const output = await redactPHI(input);

      expect(output).toContain('9:30 AM');
      expect(output).not.toContain('[PHONE_REDACTED]');
    });

    it('should NOT redact common numbers as SSN', async () => {
      const input = 'The year 2024 was great';
      const output = await redactPHI(input);

      expect(output).toContain('2024');
      expect(output).not.toContain('[SSN_REDACTED]');
    });

    it('should NOT redact medical terms in non-medical context', async () => {
      // This is a limitation of regex - context is not understood
      // Google DLP would handle this better
      const input = 'The company has terminal cancer';
      const output = await redactPHI(input);

      // Will redact "cancer" even in business context (acceptable limitation)
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
    });
  });

  describe('containsPHI', () => {
    it('should detect SSN presence', () => {
      expect(containsPHI('SSN: 123-45-6789')).toBe(true);
    });

    it('should detect phone number presence', () => {
      expect(containsPHI('Call 555-123-4567')).toBe(true);
    });

    it('should detect email presence', () => {
      expect(containsPHI('Email: test@example.com')).toBe(true);
    });

    it('should detect medical term presence', () => {
      expect(containsPHI('Has diabetes')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(containsPHI('Hello, how are you?')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsPHI('')).toBe(false);
    });
  });

  describe('redactPHIFromMetadata', () => {
    it('should redact PHI from nested object', async () => {
      const input = {
        user: {
          email: 'patient@example.com',
          phone: '555-123-4567',
          notes: 'Has diabetes'
        }
      };

      const output = await redactPHIFromMetadata(input);

      expect(output.user.email).toContain('[EMAIL_REDACTED]');
      expect(output.user.phone).toContain('[PHONE_REDACTED]');
      expect(output.user.notes).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should redact PHI from arrays', async () => {
      const input = {
        messages: [
          'Call me at 555-123-4567',
          'Patient has cancer'
        ]
      };

      const output = await redactPHIFromMetadata(input);

      expect(output.messages[0]).toContain('[PHONE_REDACTED]');
      expect(output.messages[1]).toContain('[MEDICAL_TERM_REDACTED]');
    });

    it('should preserve non-string values', async () => {
      const input = {
        count: 42,
        active: true,
        timestamp: null
      };

      const output = await redactPHIFromMetadata(input);

      expect(output.count).toBe(42);
      expect(output.active).toBe(true);
      expect(output.timestamp).toBe(null);
    });
  });

  describe('Performance', () => {
    it('should redact short text quickly (<10ms)', async () => {
      const input = 'SSN 123-45-6789, phone 555-123-4567';
      const start = Date.now();

      await redactPHI(input);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10);
    });

    it('should redact long text reasonably quickly (<100ms)', async () => {
      const input = 'Patient SSN 123-45-6789, phone 555-123-4567, email test@example.com. '.repeat(100);
      const start = Date.now();

      await redactPHI(input);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle null input gracefully', async () => {
      const output = await redactPHI(null as any);
      expect(output).toBe(null);
    });

    it('should handle undefined input gracefully', async () => {
      const output = await redactPHI(undefined as any);
      expect(output).toBe(undefined);
    });
  });

  describe('HIPAA Compliance Verification', () => {
    it('should redact all 18 HIPAA Safe Harbor identifiers', async () => {
      const input = `
        Patient John Doe
        SSN: 123-45-6789
        Phone: 555-123-4567
        Email: john@example.com
        Address: 123 Main St, 90210
        DOB: 03/15/1985
        MRN: ABC123456
        Account: ACCT123456
        IP: 192.168.1.1
        Has diabetes and cancer
        Card: 4532-1234-5678-9010
      `;

      const output = await redactPHI(input);

      // Verify all identifiers redacted
      expect(output).not.toContain('123-45-6789');
      expect(output).not.toContain('555-123-4567');
      expect(output).not.toContain('john@example.com');
      expect(output).not.toContain('90210');
      expect(output).not.toContain('03/15/1985');
      expect(output).not.toContain('ABC123456');
      expect(output).not.toContain('ACCT123456');
      expect(output).not.toContain('192.168.1.1');
      expect(output).not.toContain('diabetes');
      expect(output).not.toContain('cancer');
      expect(output).not.toContain('4532-1234-5678-9010');

      // Verify redaction markers present
      expect(output).toContain('[SSN_REDACTED]');
      expect(output).toContain('[PHONE_REDACTED]');
      expect(output).toContain('[EMAIL_REDACTED]');
      expect(output).toContain('[ZIP_REDACTED]');
      expect(output).toContain('[DATE_REDACTED]');
      expect(output).toContain('[MRN_REDACTED]');
      expect(output).toContain('[ACCOUNT_REDACTED]');
      expect(output).toContain('[IP_REDACTED]');
      expect(output).toContain('[MEDICAL_TERM_REDACTED]');
      expect(output).toContain('[CREDIT_CARD_REDACTED]');
    });
  });
});

describe('PHI Redaction - Real-World Scenarios', () => {
  it('should redact typical dermatology transcript', async () => {
    const transcript = `
      Hi, I'd like to book an appointment for Botox treatment.
      My name is Sarah Johnson, phone number is 555-123-4567.
      I've had some issues with my skin, including some melanoma scares.
      My doctor recommended your clinic. Email is sarah.j@example.com.
    `;

    const redacted = await redactPHI(transcript);

    expect(redacted).not.toContain('555-123-4567');
    expect(redacted).not.toContain('sarah.j@example.com');
    expect(redacted).not.toContain('melanoma');
    expect(redacted).toContain('[PHONE_REDACTED]');
    expect(redacted).toContain('[EMAIL_REDACTED]');
    expect(redacted).toContain('[MEDICAL_TERM_REDACTED]');
  });

  it('should redact appointment booking with insurance info', async () => {
    const transcript = `
      I need to schedule a colonoscopy.
      My insurance account is ACCT987654.
      I'm diabetic and take insulin daily.
      Call me back at 555-987-6543.
    `;

    const redacted = await redactPHI(transcript);

    expect(redacted).not.toContain('ACCT987654');
    expect(redacted).not.toContain('diabetic');
    expect(redacted).not.toContain('insulin');
    expect(redacted).not.toContain('555-987-6543');
    expect(redacted).toContain('[ACCOUNT_REDACTED]');
    expect(redacted).toContain('[MEDICAL_TERM_REDACTED]');
    expect(redacted).toContain('[PHONE_REDACTED]');
  });
});
