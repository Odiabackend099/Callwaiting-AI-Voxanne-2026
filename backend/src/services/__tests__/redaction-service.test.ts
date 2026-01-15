/**
 * Unit Tests for RedactionService
 * Tests PII/PHI redaction patterns for GDPR/HIPAA compliance
 */

import { RedactionService } from '../../services/redaction-service';
import { MOCK_PII_TEXT_SAMPLES } from '../../tests/utils/mock-data';

describe('RedactionService', () => {
    describe('Email Redaction', () => {
        it('should redact email addresses', () => {
            const text = 'Contact me at john.doe@example.com for details.';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: EMAIL]');
            expect(redacted).not.toContain('john.doe@example.com');
        });

        it('should redact multiple email addresses', () => {
            const text = 'Emails: john@test.com and sarah@example.org';
            const redacted = RedactionService.redact(text);

            const emailCount = (redacted.match(/\[REDACTED: EMAIL\]/g) || []).length;
            expect(emailCount).toBe(2);
        });

        it('should handle various email formats', () => {
            const emails = [
                'simple@example.com',
                'first.last@example.co.uk',
                'user+tag@domain.com',
                'test_user@sub.domain.com',
            ];

            emails.forEach((email) => {
                const redacted = RedactionService.redact(`Email: ${email}`);
                expect(redacted).toContain('[REDACTED: EMAIL]');
                expect(redacted).not.toContain(email);
            });
        });
    });

    describe('Phone Number Redaction', () => {
        it('should redact UK phone numbers with 07 prefix', () => {
            const text = 'My number is 07700 123456';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: PHONE]');
            expect(redacted).not.toContain('07700 123456');
        });

        it('should redact UK phone numbers with +44 prefix', () => {
            const text = 'Call me on +44 20 1234 5678';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: PHONE]');
            expect(redacted).not.toContain('+44 20 1234 5678');
        });

        it('should redact US phone numbers', () => {
            const text = 'Phone: (310) 555-1234';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: PHONE]');
            expect(redacted).not.toContain('(310) 555-1234');
        });

        it('should redact international phone numbers', () => {
            const text = 'International: +1 310 555 1234';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: PHONE]');
            expect(redacted).not.toContain('+1 310 555 1234');
        });

        it('should NOT redact dates that look like phone numbers', () => {
            const text = 'Date: 2023-01-15';
            const redacted = RedactionService.redact(text);

            // Should NOT be redacted as phone number
            expect(redacted).toContain('2023-01-15');
            expect(redacted).not.toContain('[REDACTED: PHONE]');
        });

        it('should NOT redact addresses that contain numbers', () => {
            const text = '123 Main Street';
            const redacted = RedactionService.redact(text);

            // Should NOT be redacted as phone number
            expect(redacted).toContain('123 Main Street');
            // Note: May be redacted as postcode if it matches UK postcode pattern
        });
    });

    describe('Postcode Redaction', () => {
        it('should redact UK postcodes', () => {
            const text = 'Address: London W1G 6AX';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: POSTCODE]');
            expect(redacted).not.toContain('W1G 6AX');
        });

        it('should handle various UK postcode formats', () => {
            const postcodes = ['SW1A 1AA', 'M1 1AE', 'B33 8TH', 'CR2 6XH', 'DN55 1PT'];

            postcodes.forEach((postcode) => {
                const redacted = RedactionService.redact(`Postcode: ${postcode}`);
                expect(redacted).toContain('[REDACTED: POSTCODE]');
                expect(redacted).not.toContain(postcode);
            });
        });
    });

    describe('Medical Terms Redaction', () => {
        it('should redact heart-related medical history', () => {
            const text = 'I have had heart issues in the past';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('heart issues');
        });

        it('should redact medication mentions', () => {
            const text = 'I take medication for diabetes';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('medication');
            expect(redacted).not.toContain('diabetes');
        });

        it('should redact surgical procedures', () => {
            const text = 'I had surgery last year';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('surgery');
        });

        it('should redact pregnancy-related information', () => {
            const text = 'I am currently pregnant';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('pregnant');
        });

        it('should redact STI/STD mentions', () => {
            const terms = ['chlamydia', 'gonorrhea', 'std', 'sti', 'hiv', 'aids'];

            terms.forEach((term) => {
                const redacted = RedactionService.redact(`History of ${term}`);
                expect(redacted).toContain('[REDACTED: MEDICAL]');
                expect(redacted).not.toContain(term);
            });
        });

        it('should be case-insensitive for medical terms', () => {
            const text = 'I have HEART ISSUES and take MEDICATION';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('HEART ISSUES');
            expect(redacted).not.toContain('MEDICATION');
        });
    });

    describe('Cosmetic Procedure Redaction', () => {
        it('should redact facelift mentions', () => {
            const text = 'I had a facelift procedure';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('facelift');
        });

        it('should redact rhinoplasty mentions', () => {
            const text = 'Interested in rhinoplasty';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('rhinoplasty');
        });

        it('should redact breast augmentation mentions', () => {
            const text = 'Previous breast augmentation surgery';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('breast augmentation');
        });

        it('should redact botox and fillers', () => {
            const text = 'I get botox and fillers regularly';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('botox');
            expect(redacted).not.toContain('fillers');
        });
    });

    describe('Multiple PII Redaction', () => {
        it('should redact multiple types of PII in same text', () => {
            const text = MOCK_PII_TEXT_SAMPLES.withMultiplePII;
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: EMAIL]');
            expect(redacted).toContain('[REDACTED: PHONE]');
            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).not.toContain('sarah@test.com');
            expect(redacted).not.toContain('07700123456');
            expect(redacted).not.toContain('breast augmentation');
        });

        it('should preserve non-PII content', () => {
            const text = 'I would like to schedule a consultation for next week.';
            const redacted = RedactionService.redact(text);

            expect(redacted).toBe(text); // Should be unchanged
            expect(redacted).not.toContain('[REDACTED');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty string', () => {
            const redacted = RedactionService.redact('');
            expect(redacted).toBe('');
        });

        it('should handle null input', () => {
            const redacted = RedactionService.redact(null as any);
            expect(redacted).toBe('');
        });

        it('should handle undefined input', () => {
            const redacted = RedactionService.redact(undefined as any);
            expect(redacted).toBe('');
        });

        it('should handle text with only PII', () => {
            const text = 'john@example.com';
            const redacted = RedactionService.redact(text);

            expect(redacted).toBe('[REDACTED: EMAIL]');
        });

        it('should handle very long text efficiently', () => {
            const longText = 'This is a test. '.repeat(1000) + 'Email: test@example.com';
            const redacted = RedactionService.redact(longText);

            expect(redacted).toContain('[REDACTED: EMAIL]');
            expect(redacted).not.toContain('test@example.com');
        });

        it('should handle text with special characters', () => {
            const text = 'Email: test+tag@example.com (special chars!)';
            const redacted = RedactionService.redact(text);

            expect(redacted).toContain('[REDACTED: EMAIL]');
            expect(redacted).toContain('(special chars!)');
        });
    });

    describe('GDPR/HIPAA Compliance', () => {
        it('should redact all special category data', () => {
            const text = `
        Patient has heart condition and diabetes.
        Contact: john@example.com, phone 07700123456.
        Address: London W1G 6AX.
        Previous surgery for breast augmentation.
      `;

            const redacted = RedactionService.redact(text);

            // Verify all PII/PHI is redacted
            expect(redacted).toContain('[REDACTED: MEDICAL]');
            expect(redacted).toContain('[REDACTED: EMAIL]');
            expect(redacted).toContain('[REDACTED: PHONE]');
            expect(redacted).toContain('[REDACTED: POSTCODE]');

            // Verify original data is not present
            expect(redacted).not.toContain('heart condition');
            expect(redacted).not.toContain('diabetes');
            expect(redacted).not.toContain('john@example.com');
            expect(redacted).not.toContain('07700123456');
            expect(redacted).not.toContain('W1G 6AX');
            expect(redacted).not.toContain('breast augmentation');
        });

        it('should preserve non-sensitive clinical context', () => {
            const text = 'Patient interested in consultation for cosmetic procedure.';
            const redacted = RedactionService.redact(text);

            // Should preserve general context
            expect(redacted).toContain('consultation');
            expect(redacted).not.toContain('[REDACTED');
        });
    });
});
