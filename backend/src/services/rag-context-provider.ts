/**
 * RAG Context Provider
 * Retrieves relevant knowledge base chunks and injects them into AI responses
 * This is the critical missing piece that makes the AI actually use the KB
 */

import { supabase } from './supabase-client';
import { generateEmbedding } from './embeddings';
import { log } from './logger';

const SIMILARITY_THRESHOLD = 0.6;
const MAX_CHUNKS = 5;
const MAX_CONTEXT_LENGTH = 2000; // chars

/**
 * Get RAG context for a user query
 * This function:
 * 1. Embeds the user's question
 * 2. Searches for similar chunks in the KB
 * 3. Returns formatted context for the AI to use
 */
export async function getRagContext(
  userQuery: string,
  orgId: string
): Promise<{ context: string; chunkCount: number; hasContext: boolean }> {
  try {
    if (!userQuery || userQuery.trim().length === 0) {
      return { context: '', chunkCount: 0, hasContext: false };
    }

    // Generate embedding for the user's query
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(userQuery);
    } catch (error: any) {
      log.warn('RAG', 'Failed to embed query, proceeding without context', { 
        error: error?.message 
      });
      return { context: '', chunkCount: 0, hasContext: false };
    }

    // Search for similar chunks using vector similarity
    let similarChunks: Array<{ id: string; content: string; similarity: number }> = [];
    try {
      const { data, error } = await supabase.rpc('match_knowledge_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: MAX_CHUNKS,
        p_org_id: orgId
      });

      if (error) {
        log.warn('RAG', 'Vector search failed', { error: error.message });
        return { context: '', chunkCount: 0, hasContext: false };
      }

      similarChunks = data || [];
    } catch (error: any) {
      log.warn('RAG', 'RPC call failed, trying direct query', { error: error?.message });
      
      // Fallback: try direct query without RPC
      try {
        const { data, error: queryError } = await supabase
          .from('knowledge_base_chunks')
          .select('id, content')
          .eq('org_id', orgId)
          .limit(MAX_CHUNKS);

        if (queryError) {
          log.warn('RAG', 'Fallback query also failed', { error: queryError.message });
          return { context: '', chunkCount: 0, hasContext: false };
        }

        similarChunks = (data || []).map((chunk: any) => ({
          id: chunk.id,
          content: chunk.content,
          similarity: 0.5 // Fallback similarity score
        }));
      } catch (fallbackError: any) {
        log.error('RAG', 'All retrieval methods failed', { error: fallbackError?.message });
        return { context: '', chunkCount: 0, hasContext: false };
      }
    }

    if (!similarChunks || similarChunks.length === 0) {
      return { context: '', chunkCount: 0, hasContext: false };
    }

    // Format chunks into context string
    let contextStr = 'RELEVANT KNOWLEDGE BASE INFORMATION:\n\n';
    let currentLength = contextStr.length;

    for (const chunk of similarChunks) {
      if (!chunk.content) continue;

      const chunkText = `- ${chunk.content}\n\n`;
      if (currentLength + chunkText.length > MAX_CONTEXT_LENGTH) {
        break;
      }

      contextStr += chunkText;
      currentLength += chunkText.length;
    }

    const hasContext = contextStr.length > 'RELEVANT KNOWLEDGE BASE INFORMATION:\n\n'.length;

    if (hasContext) {
      log.info('RAG', 'Context retrieved', { 
        orgId,
        chunkCount: similarChunks.length,
        contextLength: contextStr.length 
      });
    }

    return {
      context: contextStr,
      chunkCount: similarChunks.length,
      hasContext
    };
  } catch (error: any) {
    log.error('RAG', 'getRagContext failed', { error: error?.message });
    return { context: '', chunkCount: 0, hasContext: false };
  }
}

/**
 * Format context for injection into system prompt
 */
export function formatContextForSystemPrompt(context: string): string {
  if (!context || context.trim().length === 0) {
    return '';
  }

  return `

---
${context}
---

Use the above knowledge base information to answer questions accurately. If the information is not in the knowledge base, say so honestly.`;
}

/**
 * Inject RAG context into a system prompt
 * This is called before sending the message to Vapi
 */
export function injectRagContextIntoPrompt(
  basePrompt: string,
  ragContext: string
): string {
  if (!ragContext || ragContext.trim().length === 0) {
    return basePrompt;
  }

  // Insert context before the final instructions
  const contextInjection = formatContextForSystemPrompt(ragContext);
  return basePrompt + contextInjection;
}
