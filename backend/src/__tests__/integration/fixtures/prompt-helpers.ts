/**
 * Prompt construction helpers for RAG integration
 */

interface PromptContext {
  userQuestion: string;
  retrievedContext: Array<{ content: string; similarity_score?: number }>;
  clinicName: string;
}

/**
 * Build a RAG-augmented prompt for AI responses
 */
export function buildRagPrompt({
  userQuestion,
  retrievedContext,
  clinicName,
}: PromptContext): string {
  const contextSection = buildContextSection(retrievedContext);

  return `You are an AI assistant for ${clinicName}.

User Question: ${userQuestion}

${contextSection}

Instructions:
- ONLY answer based on the context above
- If context is empty or doesn't contain relevant information, respond with: "I don't have that information in my database."
- Never invent or hallucinate information
- Be professional and helpful
- Keep responses concise (1-2 sentences)`;
}

/**
 * Build the [CONTEXT] section of the prompt
 */
function buildContextSection(
  context: Array<{ content: string; similarity_score?: number }>
): string {
  if (context.length === 0) {
    return `[CONTEXT]
No relevant information found in database.
[END_CONTEXT]`;
  }

  const contextItems = context
    .map((item) => {
      const score = item.similarity_score 
        ? ` (confidence: ${(item.similarity_score * 100).toFixed(0)}%)`
        : '';
      return `- ${item.content}${score}`;
    })
    .join('\n');

  return `[CONTEXT]
${contextItems}
[END_CONTEXT]`;
}

/**
 * Extract context items from RAG search results
 */
export function extractContextItems(
  results: Array<{ content: string; similarity_score?: number }>
): string[] {
  return results.map((r) => r.content);
}

/**
 * Validate that a prompt contains required context sections
 */
export function validateRagPrompt(prompt: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!prompt.includes('[CONTEXT]')) {
    errors.push('Missing [CONTEXT] opening tag');
  }

  if (!prompt.includes('[END_CONTEXT]')) {
    errors.push('Missing [END_CONTEXT] closing tag');
  }

  if (prompt.includes('never invent') === false && 
      prompt.includes('hallucinate') === false) {
    errors.push('Missing instruction to prevent hallucination');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if prompt would allow hallucination
 */
export function wouldAllowHallucination(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for danger signs
  const dangerSigns = [
    'you can make up',
    'feel free to invent',
    'use your best guess',
    'add your own knowledge',
  ];

  return dangerSigns.some((sign) => lowerPrompt.includes(sign));
}
