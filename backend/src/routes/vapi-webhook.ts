/**
 * Vapi Webhook Handler
 * Intercepts Vapi messages and injects RAG context before AI response
 * This is the scalable approach - retrieves KB chunks dynamically on every call
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { generateEmbedding } from '../services/embeddings';
import { log } from '../services/logger';

const vapiWebhookRouter = Router();

const SIMILARITY_THRESHOLD = 0.65;
const MAX_CHUNKS = 5;
const MAX_CONTEXT_LENGTH = 3000;

/**
 * POST /api/vapi/webhook
 * Vapi sends message here before generating response
 * We retrieve relevant KB chunks and return them
 * Vapi includes chunks in its system prompt for the response
 */
vapiWebhookRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { message, assistantId, orgId } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing message' 
      });
    }

    log.info('Vapi-Webhook', 'Message received', { 
      assistantId,
      messageLength: message.length 
    });

    let retrievalOrgId = orgId;
    if (!retrievalOrgId && assistantId) {
      log.warn('Vapi-Webhook', 'No orgId provided', { assistantId });
      return res.json({
        success: true,
        message,
        context: '',
        chunks: [],
        hasContext: false
      });
    }

    // Generate embedding for the message
    let messageEmbedding: number[];
    try {
      messageEmbedding = await generateEmbedding(message);
    } catch (error: any) {
      log.warn('Vapi-Webhook', 'Embedding generation failed', { 
        error: error?.message 
      });
      return res.json({
        success: true,
        message,
        context: '',
        chunks: [],
        hasContext: false
      });
    }

    // Search for similar chunks
    let similarChunks: Array<{ 
      id: string; 
      content: string; 
      similarity: number;
    }> = [];

    try {
      const { data, error } = await supabase.rpc('match_knowledge_chunks', {
        query_embedding: messageEmbedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: MAX_CHUNKS,
        p_org_id: retrievalOrgId
      });

      if (error) {
        log.warn('Vapi-Webhook', 'RPC search failed, trying fallback', { 
          error: error.message 
        });
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('knowledge_base_chunks')
          .select('id, content')
          .eq('org_id', retrievalOrgId)
          .order('created_at', { ascending: false })
          .limit(MAX_CHUNKS);

        if (!fallbackError && fallbackData) {
          similarChunks = fallbackData.map(chunk => ({
            id: chunk.id,
            content: chunk.content,
            similarity: 0.5
          }));
        }
      } else if (data && data.length > 0) {
        similarChunks = data.map((chunk: any) => ({
          id: chunk.id,
          content: chunk.content,
          similarity: chunk.similarity || 0.7
        }));
      }
    } catch (error: any) {
      log.error('Vapi-Webhook', 'Chunk retrieval failed', { 
        error: error?.message 
      });
    }

    // Format chunks into context
    let contextStr = '';
    if (similarChunks && similarChunks.length > 0) {
      contextStr = 'RELEVANT KNOWLEDGE BASE INFORMATION:\n\n';
      let currentLength = contextStr.length;

      for (const chunk of similarChunks) {
        if (!chunk.content) continue;

        const chunkText = `${chunk.content}\n\n`;
        if (currentLength + chunkText.length > MAX_CONTEXT_LENGTH) {
          break;
        }

        contextStr += chunkText;
        currentLength += chunkText.length;
      }
    }

    const hasContext = contextStr.length > 0;

    log.info('Vapi-Webhook', 'Context retrieved', { 
      assistantId,
      chunkCount: similarChunks.length,
      contextLength: contextStr.length,
      hasContext
    });

    return res.json({
      success: true,
      message,
      context: contextStr,
      chunks: similarChunks.map(c => ({
        id: c.id,
        similarity: c.similarity
      })),
      hasContext,
      chunkCount: similarChunks.length
    });
  } catch (error: any) {
    log.error('Vapi-Webhook', 'Webhook processing failed', { 
      error: error?.message 
    });

    return res.json({
      success: true,
      message: req.body.message || '',
      context: '',
      chunks: [],
      hasContext: false,
      error: error?.message
    });
  }
});

/**
 * GET /api/vapi/webhook/health
 * Health check for Vapi webhook
 */
vapiWebhookRouter.get('/webhook/health', (req: Request, res: Response) => {
  return res.json({
    status: 'healthy',
    service: 'vapi-webhook',
    timestamp: new Date().toISOString()
  });
});

export { vapiWebhookRouter };
