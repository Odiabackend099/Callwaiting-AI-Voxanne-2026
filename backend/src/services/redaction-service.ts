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
        // CRITICAL FIX: Previous regex matched dates like "2023-01-15" and addresses like "123 Main St"
        // Use specific patterns with length validation to avoid false positives
        
        // UK phones: +44 or 07 prefix, then 9-12 digits (total 10-13 characters)
        const ukPhoneRegex = /((\+44|0)\d{1,2}[\s.-]?|\(?0\d{1,2}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{1,2}/g;
        redacted = redacted.replace(ukPhoneRegex, '[REDACTED: PHONE]');
        
        // US phones: (XXX) XXX-XXXX or XXX-XXX-XXXX, with 10 digits total
        const usPhoneRegex = /(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
        redacted = redacted.replace(usPhoneRegex, '[REDACTED: PHONE]');
        
        // International format: +[country code] [digits], minimum 10 digits total
        const intlPhoneRegex = /\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
        redacted = redacted.replace(intlPhoneRegex, '[REDACTED: PHONE]');

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
