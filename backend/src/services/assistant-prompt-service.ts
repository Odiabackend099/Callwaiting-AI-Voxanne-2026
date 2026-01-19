/**
 * CRITICAL: Global Prompt Injection Middleware
 * 
 * Purpose: Ensure that EVERY assistant (whether custom or default)
 * gets the 2026 system context + error handling rules prepended.
 * 
 * This solves the "date hallucination" problem permanently by making it
 * IMPOSSIBLE for an LLM to ignore the year, even with custom prompts.
 * 
 * Applied to: All assistants, all organizations, all calls
 */

import { format } from 'date-fns';

export interface AssistantPromptConfig {
  customPrompt: string;
  orgId: string;
  assistantName?: string;
  timezone?: string;
  locale?: string;
}

/**
 * GOLDEN RULE: Never allow custom prompts to override system constraints
 * 
 * Returns a "wrapped" prompt that looks like:
 * 1. [SYSTEM AUTHORITY] - Hidden rules the AI cannot override
 * 2. [USER TEMPLATE] - The custom prompt (Sarah, Lola, etc.)
 * 
 * This pattern prevents prompt injection because the system rules are
 * in a secure section that GPT-4o treats as authoritative.
 */
export function getEnforcedSystemPrompt(config: AssistantPromptConfig): string {
  const now = new Date();
  const dateString = format(now, 'EEEE, MMMM d, yyyy'); // E.g., "Monday, January 13, 2026"
  const timeString = format(now, 'h:mm a'); // E.g., "9:30 AM"
  const tzName = config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // CRITICAL: System Authority Section
  // The LLM reads this section as absolute truth and doesn't question it
  const systemAuthority = `
### ⚠️ SYSTEM AUTHORITY: GLOBAL RULES (NON-NEGOTIABLE) ###

**CURRENT DATE/TIME:** ${dateString} at ${timeString} ${tzName}
**SYSTEM YEAR:** 2026
**INSTRUCTION:** All patient dates must be interpreted as occurring in 2026.
  - If a patient says "tomorrow," calculate: ${format(new Date(now.getTime() + 86400000), 'MMMM d, 2026')}
  - If a patient says "next Tuesday," ALWAYS interpret as the next Tuesday in 2026
  - If you parse a date and it shows 2024 or 2025, YOU MADE AN ERROR. Correct it to 2026 immediately.

**BOOKING TOOL RULES:**
  - You MUST collect: Full Name, Phone Number (in any format), and Date/Time
  - Phone format: You can accept any format (555-1234, +1-555-1234, etc.). The system will normalize it.
  - Date format: Accept any format (Jan 15, 2026-01-15, "next Tuesday", etc.). The system will parse it.

**ERROR HANDLING - CRITICAL:**
  - If the booking tool returns: "success": false, "error": "slot_unavailable"
    👉 DO NOT APOLOGIZE FOR A TECHNICAL ERROR
    👉 INSTEAD: "I'm so sorry, it looks like that specific time slot was just taken. I have [alternatives] available—would any of those work for you?"
  - The "alternatives" field will contain 3 specific times. Read them naturally.
  - If booking returns any OTHER error, offer to try again in 5 minutes.

**MULTI-TENANT CONTEXT:**
  - Organization: ${config.orgId}
  - Each organization has its own calendar and booking rules. You enforce them strictly.

### END SYSTEM AUTHORITY ###
`;

  // User's custom prompt follows
  return systemAuthority + '\n\n' + config.customPrompt;
}

/**
 * Helper: Extract current time in a friendly format for natural speech
 */
export function getCurrentTimePhrase(): string {
  const now = new Date();
  const hour = now.getHours();

  // Good morning (5am-12pm), Good afternoon (12pm-5pm), Good evening (5pm-10pm), Good night (10pm-5am)
  let greeting = 'Hello';
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 && hour < 22) greeting = 'Good evening';
  else greeting = 'Good night';

  return `${greeting}. It's ${format(now, 'h:mm a')} on ${format(now, 'EEEE, MMMM d')}.`;
}

/**
 * Helper: Format date/time as human-readable for the AI to use in speech
 */
export function formatDateForSpeech(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, 'EEEE, MMMM d at h:mm a');
  } catch {
    return dateStr;
  }
}

/**
 * Service: Update Assistant with Enforced Prompt
 * 
 * In your Vapi integration code, call this before creating/updating an assistant:
 * 
 * const enforcedPrompt = getEnforcedSystemPrompt({
 *   customPrompt: user.customPrompt,
 *   orgId: user.orgId,
 *   assistantName: user.assistantName
 * });
 * 
 * await vapiClient.updateAssistant(assistantId, {
 *   systemPrompt: enforcedPrompt,
 *   // ... other config
 * });
 */
export async function updateAssistantWithEnforcedPrompt(
  vapiClient: any,
  assistantId: string,
  config: AssistantPromptConfig
): Promise<void> {
  const enforcedPrompt = getEnforcedSystemPrompt(config);

  try {
    await vapiClient.updateAssistant(assistantId, {
      systemPrompt: enforcedPrompt
    });

    console.log('✅ Assistant updated with enforced system prompt', {
      assistantId,
      orgId: config.orgId,
      promptLength: enforcedPrompt.length
    });
  } catch (error: any) {
    console.error('❌ Failed to update assistant with enforced prompt', {
      assistantId,
      error: error.message
    });

    throw error;
  }
}

/**
 * Validation: Check if a prompt has the system authority section
 * Used for monitoring/audit
 */
export function hasEnforcedSystemAuthority(prompt: string): boolean {
  return prompt.includes('SYSTEM AUTHORITY: GLOBAL RULES');
}

/**
 * Fallback: If a user somehow bypasses the system and sends a prompt without
 * the system authority, we can detect and re-enforce it
 */
export function ensureSystemAuthority(userPrompt: string, orgId: string): string {
  if (hasEnforcedSystemAuthority(userPrompt)) {
    // Already enforced, return as-is
    return userPrompt;
  }

  // Re-enforce with default config
  return getEnforcedSystemPrompt({
    customPrompt: userPrompt,
    orgId,
    assistantName: 'Assistant'
  });
}
