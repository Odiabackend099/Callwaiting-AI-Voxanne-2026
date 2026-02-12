import { z } from 'zod';

/**
 * Validation schemas for form submissions
 * Used by both frontend and backend API routes
 */

export const ContactFormSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().default(''),
  subject: z.string().optional().default('Website Contact Form'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;

export const OnboardingFormSchema = z.object({
  company: z.string().min(2, 'Company name is required').max(200),
  website: z.union([
    z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+(\/[a-zA-Z0-9-._~:\/\?#\[\]@!$&'\(\)*+,;%=]*)?$/, 'Please enter a valid website (e.g., yourcompany.com or https://yourcompany.com)'),
    z.string().url('Please enter a valid URL'),
    z.literal('')
  ]).optional().default(''),
  phone: z.string().min(8, 'Phone number is too short').regex(/^\+[\d\s\-\(\)]{7,19}$/, 'Please enter a valid phone number starting with + and country code (e.g., +1 555 123 4567, +44 7700 900000)'),
  pricingPdfUrl: z.string().optional().default(''),
  greetingScript: z.string().min(5, 'Greeting script must be at least 5 characters').max(2000),
  additionalDetails: z.string().optional().default(''),
  email: z.string().email('Valid email is required'),
});

export type OnboardingFormInput = z.infer<typeof OnboardingFormSchema>;

/**
 * Validate contact form input
 */
export function validateContactForm(data: unknown): ContactFormInput {
  return ContactFormSchema.parse(data);
}

/**
 * Validate onboarding form input
 */
export function validateOnboardingForm(data: unknown): OnboardingFormInput {
  return OnboardingFormSchema.parse(data);
}
