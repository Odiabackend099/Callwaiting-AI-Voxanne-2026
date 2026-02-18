/**
 * Prompt Injection Service
 *
 * Ensures that regardless of custom user prompts, the AI agent always knows:
 * 1. It has access to the bookClinicAppointment tool
 * 2. When and how to use it
 * 3. What information is required
 *
 * This is the "system-level instruction" that cannot be overridden by user prompts.
 */

import { log } from './logger';

/**
 * Tool usage anchor - guaranteed instructions for tool invocation
 * Kept concise to avoid hitting Vapi's prompt length limits
 */
const BOOKING_TOOL_ANCHOR = `
## BOOKING TOOL INSTRUCTIONS (CRITICAL - DO NOT IGNORE)

🔇 SILENT EXECUTION RULE:
NEVER announce that you are using a tool. The caller should only hear natural conversation.
❌ Don't say: "Let me call the booking tool" or "I'm using check availability"
✅ Do say: "Let me check the schedule..." (then use tool silently)

When a customer wants to book an appointment:
1. Collect required info IN THIS ORDER:
   a) Date and time (convert "next Tuesday" to YYYY-MM-DD format)
   b) Full name
   c) MOBILE PHONE NUMBER (for SMS confirmation) ← PRIORITY
   d) Email (optional, only if caller volunteers it)

2. CHECK AVAILABILITY FIRST (mandatory):
   - Call checkAvailability tool (silently)
   - Wait for response showing available slots
   - Offer 2-3 specific times from results

3. BOOK APPOINTMENT (only after availability confirmed):
   - Repeat back: "So that's [DATE] at [TIME], correct?"
   - Wait for confirmation
   - Call bookClinicAppointment tool IMMEDIATELY (silently)
   - Parameters:
     * appointmentDate: YYYY-MM-DD format
     * appointmentTime: HH:MM (24-hour format, e.g., 14:30)
     * patientName: Full name
     * patientPhone: Mobile number (REQUIRED for SMS)
     * patientEmail: (optional) Email if provided

4. ERROR HANDLING:
   - If booking fails with "slot_unavailable": Return to step 2
   - If tool unavailable: Collect info and transfer to human agent
   - Never proceed to step 3 without completing step 2

CRITICAL: All tool calls are SILENT operations. Caller only hears your natural responses.
`;

/**
 * Enhance system prompt with booking tool instructions
 *
 * Strategy:
 * - Preserve all user-provided context (clinic info, persona, etc.)
 * - Append non-negotiable booking instructions
 * - Keep total length under Vapi limits (~8000 chars)
 *
 * @param userPrompt - The system prompt from agent config or user input
 * @returns Enhanced prompt with booking instructions
 */
export function enhanceSystemPrompt(userPrompt: string): string {
  // If prompt is already enhanced, don't double it
  if (userPrompt.includes('BOOKING TOOL INSTRUCTIONS')) {
    log.warn('PromptInjector', 'Prompt already enhanced, returning as-is');
    return userPrompt;
  }

  // Build enhanced prompt
  const enhanced = userPrompt + BOOKING_TOOL_ANCHOR;

  // Sanity check for length (Vapi limit is typically 8000 chars)
  if (enhanced.length > 7500) {
    log.warn('PromptInjector', 'Enhanced prompt approaching length limit', {
      originalLength: userPrompt.length,
      enhancedLength: enhanced.length,
      warning: 'Consider shortening user prompt'
    });
  }

  log.info('PromptInjector', 'Prompt enhanced with booking instructions', {
    originalLength: userPrompt.length,
    enhancedLength: enhanced.length,
    anchorLength: BOOKING_TOOL_ANCHOR.length
  });

  return enhanced;
}

/**
 * Validate prompt for booking readiness
 *
 * Check if a system prompt has the necessary booking context
 * to succeed in live booking scenarios.
 *
 * @param prompt - System prompt to validate
 * @returns Validation result with warnings
 */
export function validateBookingPrompt(prompt: string): {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!prompt) {
    return {
      isValid: false,
      warnings: ['Prompt is empty'],
      suggestions: ['Provide a basic system prompt describing the assistant role']
    };
  }

  // Check for booking-related keywords
  const bookingKeywords = ['book', 'appointment', 'schedule', 'availability'];
  const hasBookingContext = bookingKeywords.some(keyword =>
    prompt.toLowerCase().includes(keyword)
  );

  if (!hasBookingContext) {
    warnings.push('Prompt does not mention booking/scheduling');
    suggestions.push('Add context like "Your goal is to schedule appointments"');
  }

  // Check for tool instruction anchor
  if (!prompt.includes('BOOKING TOOL INSTRUCTIONS')) {
    suggestions.push('Prompt needs enhancement with booking tool instructions');
  }

  // Check for persona/context
  if (prompt.length < 50) {
    warnings.push('Prompt is very short and may lack context');
    suggestions.push('Add personality, clinic details, and booking guidelines');
  }

  // Check for length limit
  if (prompt.length > 7000) {
    warnings.push('Prompt is quite long and may exceed Vapi limits when enhanced');
    suggestions.push('Consider condensing the prompt to under 5000 characters');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    suggestions
  };
}

/**
 * Extract booking requirements from prompt
 *
 * Analyze what the prompt reveals about what info the AI should collect
 * for booking.
 *
 * @param prompt - System prompt to analyze
 * @returns Detected booking requirements
 */
export function detectBookingRequirements(prompt: string): {
  requiresName: boolean;
  requiresEmail: boolean;
  requiresPhone: boolean;
  requiresServiceType: boolean;
  suggestedServices: string[];
} {
  const lowerPrompt = prompt.toLowerCase();

  return {
    requiresName: lowerPrompt.includes('name') || lowerPrompt.includes('patient'),
    requiresEmail: lowerPrompt.includes('email') || lowerPrompt.includes('contact'),
    requiresPhone: lowerPrompt.includes('phone') || lowerPrompt.includes('number'),
    requiresServiceType: lowerPrompt.includes('service') || lowerPrompt.includes('treatment'),
    suggestedServices: extractServices(prompt)
  };
}

/**
 * Extract service types mentioned in prompt
 */
function extractServices(prompt: string): string[] {
  const services = [
    'botox',
    'filler',
    'consultation',
    'checkup',
    'laser',
    'peel',
    'facial',
    'injection',
    'wellness'
  ];

  return services.filter(service =>
    prompt.toLowerCase().includes(service)
  );
}

/**
 * Create a minimal booking prompt if user provides empty/invalid prompt
 */
export function createDefaultBookingPrompt(): string {
  const defaultPrompt = `You are a professional front desk concierge for a medical clinic. Your role is to:
1. Greet customers warmly
2. Answer questions about services
3. Schedule appointments when requested

Be professional, helpful, and always confirm all booking details before submitting.`;

  return enhanceSystemPrompt(defaultPrompt);
}

/**
 * Debug helper - show before/after prompt enhancement
 */
export function debugPromptEnhancement(userPrompt: string): void {
  const enhanced = enhanceSystemPrompt(userPrompt);
  const validation = validateBookingPrompt(enhanced);

  log.info('PromptInjector', '📋 PROMPT ENHANCEMENT DEBUG', {
    originalLength: userPrompt.length,
    enhancedLength: enhanced.length,
    isValid: validation.isValid,
    warnings: validation.warnings,
    suggestions: validation.suggestions
  });

  console.log('\n=== ORIGINAL PROMPT ===');
  console.log(userPrompt);
  console.log('\n=== ENHANCEMENT ANCHOR ===');
  console.log(BOOKING_TOOL_ANCHOR);
  console.log('\n=== ENHANCED PROMPT ===');
  console.log(enhanced);
  console.log('\n=== VALIDATION ===');
  console.log(JSON.stringify(validation, null, 2));
}
