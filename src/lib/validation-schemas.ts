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
  website: z.string().optional().default(''),
  phone: z.string().min(10, 'Valid phone number is required'),
  pricingPdfUrl: z.string().optional().default(''),
  greetingScript: z.string().min(20, 'Greeting script must be at least 20 characters').max(2000),
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
