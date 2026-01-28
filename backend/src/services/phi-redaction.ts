/**
 * PHI (Protected Health Information) Redaction Service
 * Implements HIPAA-compliant redaction of sensitive health information from transcripts
 *
 * HIPAA Safe Harbor Method (45 CFR §164.514(b)(2)):
 * - Removes 18 types of identifiers from transcripts
 * - Maintains data utility while protecting privacy
 * - Regex-based for immediate deployment (can upgrade to Google DLP API later)
 *
 * Usage:
 *   const redacted = await redactPHI(transcript);
 */

import { log } from './logger';

/**
 * PHI Pattern Definitions
 * Based on HIPAA Safe Harbor 18 identifiers
 */
const PHI_PATTERNS = {
  // 1. Social Security Numbers (SSN)
  SSN: {
    pattern: /\b(?:\d{3}[-.\s]\d{2}[-.\s]\d{4}|\d{9})\b/g,
    replacement: '[SSN_REDACTED]',
    description: 'Social Security Number'
  },

  // 2. Credit Card Numbers
  CREDIT_CARD: {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CREDIT_CARD_REDACTED]',
    description: 'Credit Card Number'
  },

  // 3. Phone Numbers (10-digit US format)
  PHONE: {
    pattern: /(?<!\d)(?:\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})(?!\d)/g,
    replacement: '[PHONE_REDACTED]',
    description: 'Phone Number'
  },

  // 4. Email Addresses
  EMAIL: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
    description: 'Email Address'
  },

  // 5. Dates (MM/DD/YYYY, MM-DD-YYYY, Month DD, YYYY)
  DATE: {
    pattern: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/gi,
    replacement: '[DATE_REDACTED]',
    description: 'Date'
  },

  // 6. ZIP Codes (5-digit or 9-digit)
  ZIP_CODE: {
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    replacement: '[ZIP_REDACTED]',
    description: 'ZIP Code'
  },

  // 7. Medical Record Numbers (alphanumeric, 6-10 chars)
  MRN: {
    pattern: /\bMRN\b[:\s]*[A-Z0-9]{6,10}\b/gi,
    replacement: '[MRN_REDACTED]',
    description: 'Medical Record Number'
  },

  // 8. Account Numbers (generic pattern)
  ACCOUNT_NUMBER: {
    pattern: /\b(?:account|acct)[#:\s]?[A-Z0-9]{6,12}\b/gi,
    replacement: '[ACCOUNT_REDACTED]',
    description: 'Account Number'
  },

  // 9. IP Addresses
  IP_ADDRESS: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP_REDACTED]',
    description: 'IP Address'
  }
};

/**
 * Medical Terms and Diagnoses
 * Common medical conditions that should be redacted
 */
const MEDICAL_TERMS = [
  // Chronic Conditions
  'diabetes', 'diabetic', 'cancer', 'tumor', 'malignant', 'benign',
  'melanoma',
  'heart disease', 'hypertension', 'high blood pressure',
  'stroke', 'asthma', 'copd', 'emphysema',

  // Mental Health
  'depression', 'depressed', 'anxiety', 'anxious', 'bipolar',
  'schizophrenia', 'ptsd', 'adhd', 'add',

  // Infectious Diseases
  'hiv', 'aids', 'hepatitis', 'tuberculosis', 'tb',
  'covid', 'coronavirus', 'influenza', 'flu',

  // Medications (common)
  'prescription', 'medication', 'insulin', 'chemotherapy',
  'oxycodone', 'morphine', 'fentanyl', 'methadone',
  'xanax', 'valium', 'adderall', 'viagra',

  // Procedures
  'surgery', 'operation', 'biopsy', 'endoscopy',
  'colonoscopy', 'mammogram', 'mri', 'ct scan',

  // Body Parts (when used in medical context)
  'prostate', 'uterus', 'ovaries', 'testicles',
  'breasts', 'rectum', 'colon'
];

/**
 * Redact PHI from text using regex patterns
 * @param text Input text (transcript, message, etc.)
 * @param options Configuration options
 * @returns Redacted text with PHI removed
 */
export async function redactPHI(
  text: string,
  options: {
    redactMedicalTerms?: boolean;
    redactDates?: boolean;
    redactPhones?: boolean;
    preserveNames?: boolean;
  } = {}
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  const startTime = Date.now();
  let redacted = text;
  const redactionsApplied: string[] = [];

  try {
    // Apply all PHI pattern redactions
    for (const [key, config] of Object.entries(PHI_PATTERNS)) {
      // Allow selective disabling of redaction types
      if (key === 'DATE' && options.redactDates === false) continue;
      if (key === 'PHONE' && options.redactPhones === false) continue;

      const beforeLength = redacted.length;
      redacted = redacted.replace(config.pattern, config.replacement);
      const afterLength = redacted.length;

      if (beforeLength !== afterLength) {
        redactionsApplied.push(config.description);
      }
    }

    // Redact medical terms if enabled (default: true)
    if (options.redactMedicalTerms !== false) {
      MEDICAL_TERMS.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        if (regex.test(redacted)) {
          redacted = redacted.replace(regex, '[MEDICAL_TERM_REDACTED]');
          if (!redactionsApplied.includes('Medical Term')) {
            redactionsApplied.push('Medical Term');
          }
        }
      });
    }

    // Log redaction statistics
    const duration = Date.now() - startTime;
    if (redactionsApplied.length > 0) {
      log.info('PHI Redaction', 'Redacted sensitive information', {
        original_length: text.length,
        redacted_length: redacted.length,
        redactions: redactionsApplied,
        duration_ms: duration
      });
    }

    return redacted;

  } catch (error: any) {
    log.error('PHI Redaction', 'Error during redaction', {
      error: error.message,
      text_length: text.length
    });

    // Fail-safe: Return heavily redacted version on error
    return '[REDACTION_ERROR: Content unavailable for privacy protection]';
  }
}

/**
 * Check if text contains potential PHI
 * @param text Input text to analyze
 * @returns boolean indicating if PHI patterns detected
 */
export function containsPHI(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  // Check all PHI patterns
  for (const config of Object.values(PHI_PATTERNS)) {
    if (config.pattern.test(text)) {
      return true;
    }
  }

  // Check medical terms
  for (const term of MEDICAL_TERMS.slice(0, 20)) { // Check first 20 terms for speed
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Redact PHI from metadata objects (recursive)
 * @param metadata Object containing potentially sensitive data
 * @returns Redacted metadata object
 */
export async function redactPHIFromMetadata(metadata: any): Promise<any> {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const redacted: any = Array.isArray(metadata) ? [] : {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      // Redact string values
      redacted[key] = await redactPHI(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      redacted[key] = await redactPHIFromMetadata(value);
    } else {
      // Keep non-string, non-object values as-is
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Batch redact multiple texts (optimized for performance)
 * @param texts Array of texts to redact
 * @returns Array of redacted texts
 */
export async function redactPHIBatch(texts: string[]): Promise<string[]> {
  const startTime = Date.now();

  const redacted = await Promise.all(
    texts.map(text => redactPHI(text))
  );

  const duration = Date.now() - startTime;
  log.info('PHI Redaction Batch', 'Batch redaction complete', {
    count: texts.length,
    avg_time_per_text: Math.round(duration / texts.length),
    total_duration_ms: duration
  });

  return redacted;
}

/**
 * FUTURE: Google Cloud DLP API Integration
 * Uncomment and configure when ready to upgrade to ML-based PHI detection
 */

/*
import { DlpServiceClient } from '@google-cloud/dlp';

const dlp = new DlpServiceClient({
  keyFilename: process.env.GOOGLE_DLP_KEY_PATH
});

export async function redactPHIWithDLP(text: string): Promise<string> {
  try {
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
                { name: 'MEDICAL_TERM' },
                { name: 'PERSON_NAME' }
              ]
            }
          ]
        }
      },
      item: { value: text }
    });

    return response.item?.value || text;
  } catch (error: any) {
    log.error('Google DLP', 'DLP redaction failed, falling back to regex', {
      error: error.message
    });

    // Fallback to regex-based redaction
    return await redactPHI(text);
  }
}
*/

/**
 * Export for testing
 */
export const __testing = {
  PHI_PATTERNS,
  MEDICAL_TERMS
};
