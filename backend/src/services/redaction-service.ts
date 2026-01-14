import { log } from './logger';

export class RedactionService {

    // Medical Terms Dictionary (MVP)
    // In production, this should be an extensive list or an NLP model
    private static MEDICAL_TERMS = [
        'heart issues', 'heart condition', 'cardiac',
        'surgery', 'operation', 'procedure',
        'medication', 'drugs', 'prescriptions',
        'cancer', 'tumor', 'oncology',
        'diabetes', 'insulin',
        'pregnant', 'pregnancy',
        'facelift', 'rhinoplasty', 'breast augmentation',
        'botox', 'fillers', 'liposuction', 'tummy tuck',
        'anesthesia', 'medical history', 'blood pressure',
        'chlamydia', 'gonorrhea', 'std', 'sti', 'hiv', 'aids'
    ];

    /**
     * Redacts PII and PHI from text
     * @param text The raw transcript or summary
     * @returns The redacted text
     */
    static redact(text: string): string {
        if (!text) return '';

        let redacted = text;

        // 1. Redact Email Addresses
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        redacted = redacted.replace(emailRegex, '[REDACTED: EMAIL]');

        // 2. Redact Phone Numbers (International & UK Formats)
        // More robust regex covering +44, 07, US formats, etc.
        const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,6}/g;
        // Basic length check to avoid redacting 4-digit years unless they look really like phone parts
        // The above regex is aggressive. Let's make it smarter or apply it carefully.
        // Actually, for a Redaction Service, aggressive is safer than leaky.
        // But let's use the one from smoke-test-suite which passed:
        // /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,6}/g
        redacted = redacted.replace(phoneRegex, '[REDACTED: PHONE]');

        // 3. Redact UK Postcodes (Basic Pattern)
        const postcodeRegex = /\b([A-Z]{1,2}[0-9][A-Z0-9]? [0-9][ABD-HJLNP-UW-Z]{2})\b/gi;
        redacted = redacted.replace(postcodeRegex, '[REDACTED: POSTCODE]');

        // 4. Redact Medical Terms (Case Insensitive)
        this.MEDICAL_TERMS.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            redacted = redacted.replace(regex, '[REDACTED: MEDICAL]');
        });

        return redacted;
    }
}
