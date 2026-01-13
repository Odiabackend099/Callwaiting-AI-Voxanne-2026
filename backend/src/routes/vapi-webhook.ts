/**
 * Vapi Webhook Handler
 * Intercepts Vapi messages and injects RAG context before AI response
 * This is the scalable approach - retrieves KB chunks dynamically on every call
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../services/supabase-client';
import { generateEmbedding } from '../services/embeddings';
import { log } from '../services/logger';
import { verifyVapiSignature } from '../utils/vapi-webhook-signature';

const vapiWebhookRouter = Router();

const SIMILARITY_THRESHOLD = 0.65;
const MAX_CHUNKS = 5;
const MAX_CONTEXT_LENGTH = 3000;

// Rate limiting: 100 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/vapi/webhook
 * Vapi sends message here before generating response
 * We retrieve relevant KB chunks and return them
 * Vapi includes chunks in its system prompt for the response
 */
vapiWebhookRouter.post('/webhook', webhookLimiter, async (req: Request, res: Response) => {
  const requestStart = Date.now();
  try {
    log.info('Vapi-Webhook', '🔍 REQUEST START', { timestamp: requestStart });
    const { message, assistantId } = req.body;

    const nodeEnv = process.env.NODE_ENV || 'development';
    const secret = process.env.VAPI_WEBHOOK_SECRET;

    const step1Start = Date.now();
    log.info('Vapi-Webhook', 'Step 1: Signature verification START');

    if (!secret) {
      if (nodeEnv === 'production') {
        log.error('Vapi-Webhook', 'Missing VAPI_WEBHOOK_SECRET in production, rejecting');
        return res.status(500).json({ success: false, error: 'Webhook not configured' });
      }
      log.warn('Vapi-Webhook', 'VAPI_WEBHOOK_SECRET not configured, accepting unsigned webhooks (dev mode)');
    } else {
      const signature = req.headers['x-vapi-signature'] as string;
      const timestamp = req.headers['x-vapi-timestamp'] as string;
      const rawBody = typeof (req as any).rawBody === 'string' ? (req as any).rawBody : JSON.stringify(req.body);

      const ok = verifyVapiSignature({
        secret,
        signature,
        timestamp,
        rawBody
      });

      if (!ok) {
        log.warn('Vapi-Webhook', 'Invalid webhook signature, rejecting', { assistantId });
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing message'
      });
    }

    log.info('Vapi-Webhook', 'Message received', {
      assistantId,
      messageLength: message.length
    });

    // OPTIMIZATION: Run org resolution and embedding generation in parallel
    // This saves ~651ms by not waiting for org resolution before starting embedding
    const step2Start = Date.now();
    log.info('Vapi-Webhook', 'Step 2 & 3: Parallel execution START (org + embedding)', { assistantId });

    const [retrievalOrgId, embedding] = await Promise.all([
      // Org resolution
      (async () => {
        if (typeof assistantId !== 'string' || assistantId.trim().length === 0) {
          return null;
        }

        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('org_id')
          .eq('vapi_assistant_id', assistantId)
          .maybeSingle();

        if (agentError) {
          log.warn('Vapi-Webhook', 'Failed to resolve org_id from assistantId', {
            assistantId,
            error: agentError.message
          });
          return null;
        }

        return (agent as any)?.org_id ?? null;
      })(),

      // Embedding generation (runs in parallel)
      generateEmbedding(message)
    ]);

    log.info('Vapi-Webhook', 'Step 2 & 3: Parallel execution COMPLETE', {
      duration: Date.now() - step2Start,
      orgId: retrievalOrgId
    });

    if (!retrievalOrgId) {
      log.warn('Vapi-Webhook', 'No org_id resolved for assistantId; returning without context', { assistantId });
      return res.json({
        success: true,
        message,
        context: '',
        chunks: [],
        hasContext: false
      });
    }

    // Embedding already generated in parallel above
    // Search for similar chunks
    const step4Start = Date.now();
    log.info('Vapi-Webhook', 'Step 4: Vector search START');

    let similarChunks: Array<{
      id: string;
      content: string;
      similarity: number;
    }> = [];

    try {
      const { data, error } = await supabase.rpc('match_knowledge_chunks', {
        query_embedding: embedding,
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

    log.info('Vapi-Webhook', 'Step 4: Vector search COMPLETE', { duration: Date.now() - step4Start, chunkCount: similarChunks.length });

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

    const totalDuration = Date.now() - requestStart;
    log.info('Vapi-Webhook', '✅ REQUEST COMPLETE', {
      totalDuration,
      hasContext,
      chunkCount: similarChunks.length
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
